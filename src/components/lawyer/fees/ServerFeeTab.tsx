// ============================================================
// 수임료 수납 탭 (FE-1·FE-9) — 서버 기록 하나만 원본
// fee_office_overview(약정이 있는 사건) + cases(약정이 없는 계약 이후 사건 = '일정 없음')
// 이전: 사건 관리 사본(crm_clients.fee_schedule)으로 그리던 FeeSettlementTab과 서버 현황이 같은 화면에 따로 있었다
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, RefreshCw, Search, Wallet } from 'lucide-react';
import { loadFeeOverview, type FeeOverviewRow } from '../../../services/fees/feeService';
import { listCases, listOfficeClients, loadStageDefinitions, stageDef } from '../../../services/cases/caseCoreService';
import DepositAccountEditor from './DepositAccountEditor';
import FeeReminderSettingsCard from './FeeReminderSettingsCard';

const won = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-');
const PAGE = 20;
const seoulToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Filter = 'all' | 'overdue' | 'week' | 'reports' | 'no_schedule' | 'completed';
type Sort = 'next_due' | 'remaining' | 'name';

interface Row {
  caseId: string;
  consultRequestId?: string;
  name: string;
  hasAgreement: boolean;
  totalFeeWon: number;
  paidWon: number;
  remainingWon: number;
  overdueCount: number;
  nextDueOn?: string;
  nextDueWon?: number;
  pendingReports: number;
  overdueWon: number;
}

export interface ServerFeeTabProps {
  officeId: string;
  onOpenCase: (consultRequestId: string) => void;
  /** 사무소 기본 입금 계좌: 바꾸기 / 보기 / 숨김 */
  accountAccess?: 'edit' | 'view' | 'none';
  canExport?: boolean;
  /** 납부 안내 자동 발송 설정 (수납 기록 권한 전체 범위) */
  canEditReminders?: boolean;
}

export default function ServerFeeTab({ officeId, onOpenCase, accountAccess = 'none', canExport = false, canEditReminders = false }: ServerFeeTabProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('next_due');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    const [o, c, d] = await Promise.all([loadFeeOverview(officeId), listCases({ officeId, view: 'active', limit: 1000 }), loadStageDefinitions()]);
    if (o.ok === false) { setError(o.message); setRows([]); return; }
    const cases = c.ok ? c.data : [];
    const defs = d.ok ? d.data : [];
    const byCase = new Map(cases.map(cs => [cs.id, cs]));
    const withAgreement = new Set(o.data.map(r => r.caseId));
    const list: Row[] = o.data.map((r: FeeOverviewRow) => ({
      caseId: r.caseId,
      consultRequestId: r.consultRequestId || byCase.get(r.caseId)?.consultRequestId || undefined,
      name: r.clientDisplayName || r.caseTitle || '이름 없음',
      hasAgreement: true,
      totalFeeWon: r.totalFeeWon,
      paidWon: r.paidWon,
      remainingWon: r.remainingWon,
      overdueCount: r.overdueCount,
      nextDueOn: r.nextDueOn,
      nextDueWon: r.nextDueWon,
      pendingReports: r.pendingReports,
      overdueWon: r.overdueWon,
    }));
    // 계약 이후(2묶음 이상)인데 수납 일정이 없는 사건
    const missing = cases.filter(cs => !withAgreement.has(cs.id) && (stageDef(defs, cs.caseType, cs.stage)?.groupNo ?? 0) >= 2);
    if (missing.length > 0) {
      const cl = await listOfficeClients(officeId, Array.from(new Set(missing.map(m => m.officeClientId))));
      const names = new Map((cl.ok ? cl.data : []).map(x => [x.id, x.displayName]));
      missing.forEach(cs => list.push({
        caseId: cs.id, consultRequestId: cs.consultRequestId || undefined, name: names.get(cs.officeClientId) || cs.title || '이름 없음',
        hasAgreement: false, totalFeeWon: 0, paidWon: 0, remainingWon: 0, overdueCount: 0, pendingReports: 0, overdueWon: 0,
      }));
    }
    setRows(list);
  }, [officeId]);

  useEffect(() => { void load(); }, [load]);

  const today = seoulToday();
  const weekEnd = addDays(today, 7);
  const is = useMemo(() => ({
    overdue: (r: Row) => r.overdueCount > 0,
    week: (r: Row) => r.hasAgreement && r.remainingWon > 0 && !!r.nextDueOn && r.nextDueOn >= today && r.nextDueOn <= weekEnd,
    reports: (r: Row) => r.pendingReports > 0,
    no_schedule: (r: Row) => !r.hasAgreement,
    completed: (r: Row) => r.hasAgreement && r.totalFeeWon > 0 && r.remainingWon === 0,
  }), [today, weekEnd]);

  const counts = useMemo(() => {
    const all = rows || [];
    return {
      all: all.length,
      overdue: all.filter(is.overdue).length,
      week: all.filter(is.week).length,
      reports: all.filter(is.reports).length,
      no_schedule: all.filter(is.no_schedule).length,
      completed: all.filter(is.completed).length,
    } as Record<Filter, number>;
  }, [rows, is]);

  const totals = useMemo(() => (rows || []).reduce((a, r) => ({ total: a.total + r.totalFeeWon, paid: a.paid + r.paidWon, remaining: a.remaining + r.remainingWon, overdue: a.overdue + r.overdueWon }), { total: 0, paid: 0, remaining: 0, overdue: 0 }), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = (rows || []).filter(r => (filter === 'all' ? true : is[filter](r)) && (!q || r.name.toLowerCase().includes(q)));
    list = [...list].sort((a, b) => {
      if (sort === 'remaining') return b.remainingWon - a.remainingWon;
      if (sort === 'name') return a.name.localeCompare(b.name, 'ko');
      // 다음 납부일: 기한 지남 먼저 → 날짜 빠른 순 → 일정 없음 → 완납
      const key = (r: Row) => (!r.hasAgreement ? '8' : r.remainingWon === 0 ? '9' : r.overdueCount > 0 ? `0${r.nextDueOn || ''}` : `1${r.nextDueOn || ''}`);
      return key(a).localeCompare(key(b));
    });
    return list;
  }, [rows, filter, sort, query, is]);

  useEffect(() => { setPage(1); }, [filter, sort, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const pageRows = visible.slice((page - 1) * PAGE, page * PAGE);

  const exportCsv = () => {
    const head = ['의뢰인', '약정(원)', '납부(원)', '남은 금액(원)', '다음 납부일', '다음 납부 금액(원)', '기한 지난 회차', '입금 알림 확인 필요', '상태'];
    const status = (r: Row) => (!r.hasAgreement ? '일정 없음' : r.remainingWon === 0 ? '완납' : r.overdueCount > 0 ? '기한 지남' : '진행 중');
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      // 수식으로 읽히지 않게
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [head, ...visible.map(r => [r.name, r.totalFeeWon, r.paidWon, r.remainingWon, r.nextDueOn || '', r.nextDueWon ?? '', r.overdueCount, r.pendingReports, status(r)])]
      .map(cols => cols.map(esc).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `수납현황_${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success(`${visible.length}건을 내려받았습니다. 의뢰인 이름이 들어 있으니 보관에 주의해 주세요.`);
  };

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'overdue', label: '기한 지남' },
    { id: 'week', label: '7일 안 납부' },
    { id: 'reports', label: '입금 알림 확인' },
    { id: 'no_schedule', label: '일정 없음' },
    { id: 'completed', label: '완납' },
  ];

  return (
    <section className="space-y-4" aria-label="수임료 수납">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-xl text-slate-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-slate-700" />수임료 수납</h2>
        <div className="flex items-center gap-2">
          {canExport && rows && rows.length > 0 && (
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap cursor-pointer active:scale-[0.98]">
              <Download className="w-4 h-4" />엑셀(CSV) 내려받기
            </button>
          )}
          <button onClick={() => { setRows(null); void load(); }} className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap cursor-pointer active:scale-[0.98]">
            <RefreshCw className="w-4 h-4" />새로고침
          </button>
        </div>
      </div>

      {accountAccess !== 'none' && <DepositAccountEditor officeId={officeId} caseId={null} canEdit={accountAccess === 'edit'} />}
      <FeeReminderSettingsCard
        officeId={officeId}
        canEdit={canEditReminders}
        caseNames={Object.fromEntries((rows || []).map(r => [r.caseId, r.name]))}
      />

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />수납 현황을 불러오지 못했습니다: {error}</span>
          <button onClick={() => void load()} className="px-3 min-h-[40px] rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap cursor-pointer">다시 시도</button>
        </div>
      )}

      {rows === null && !error && (
        <div className="space-y-3" aria-busy="true">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      )}

      {rows && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '약정 합계', value: won(totals.total) },
              { label: '납부 합계', value: won(totals.paid) },
              { label: '남은 금액', value: won(totals.remaining) },
              { label: '기한 지난 금액', value: `${won(totals.overdue)} · ${counts.overdue}건` },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3">
                <span className="text-xs text-slate-500 font-bold block">{c.label}</span>
                <strong className="text-base text-slate-900 tabular-nums">{c.value}</strong>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                className={`px-3 min-h-[36px] rounded-lg border text-sm font-bold whitespace-nowrap cursor-pointer active:scale-[0.98] ${filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
                {f.label} <span className="tabular-nums opacity-80">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="의뢰인 이름 검색" aria-label="의뢰인 이름 검색" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
            </label>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="정렬" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="next_due">다음 납부일순</option>
              <option value="remaining">남은 금액 많은순</option>
              <option value="name">이름순</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 bg-white space-y-2">
              <Wallet className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="font-bold text-slate-800">서버에 기록된 수납 일정이 없습니다.</p>
              <p className="text-sm text-slate-600">사건 화면의 '수임료 수납 (서버 기록)'에서 일정을 만들면 여기에 모입니다.</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">조건에 맞는 사건이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-600">
                    <th className="p-3 text-left">의뢰인</th><th className="p-3 text-right">약정</th><th className="p-3 text-right">납부</th>
                    <th className="p-3 text-right">남은 금액</th><th className="p-3 text-left">다음 납부</th><th className="p-3 text-left">확인</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map(r => (
                    <tr key={r.caseId} className={r.consultRequestId ? 'hover:bg-slate-50 cursor-pointer' : ''} onClick={() => r.consultRequestId && onOpenCase(r.consultRequestId)}
                      tabIndex={r.consultRequestId ? 0 : -1} onKeyDown={e => { if (e.key === 'Enter' && r.consultRequestId) onOpenCase(r.consultRequestId); }}>
                      <td className="p-3 font-bold text-slate-900">{r.name}</td>
                      <td className="p-3 text-right tabular-nums">{r.hasAgreement ? won(r.totalFeeWon) : '-'}</td>
                      <td className="p-3 text-right tabular-nums">{r.hasAgreement ? won(r.paidWon) : '-'}</td>
                      <td className="p-3 text-right tabular-nums">{r.hasAgreement ? won(r.remainingWon) : '-'}</td>
                      <td className="p-3 tabular-nums">{!r.hasAgreement ? <span className="text-slate-500">일정 없음</span> : r.remainingWon === 0 ? <span className="text-emerald-700 font-bold">완납</span> : r.nextDueOn ? `${r.nextDueOn} · ${won(r.nextDueWon)}` : '-'}</td>
                      <td className="p-3 space-x-1 whitespace-nowrap">
                        {r.overdueCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">기한 지남 {r.overdueCount}</span>}
                        {r.pendingReports > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">입금 알림 {r.pendingReports}</span>}
                        {!r.hasAgreement && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">일정 만들기 필요</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="이전 쪽" className="p-2 min-h-[40px] rounded-xl border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-700 tabular-nums">{page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} aria-label="다음 쪽" className="p-2 min-h-[40px] rounded-xl border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          <p className="text-xs text-slate-500">사건을 누르면 사건 화면의 수납 기록으로 갑니다. 납부·일정 변경은 사건 화면에서 기록합니다. 회차 상태는 서버가 납부 합계를 회차 순서대로 배분해 계산합니다.</p>
        </>
      )}
    </section>
  );
}
