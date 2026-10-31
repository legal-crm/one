// 통합어드민 › 의뢰인 모니터링 (OP-5·OP-7)
// 관리자는 상담 요청의 운영 정보(가명·상태·변호사 수·자리 응답·건수·신고)만 본다. 연락처·채무·본문은 받지 않는다.
// 원문은 열린 신고가 있을 때만, 사유를 적고 열람한다(관리자 조치 기록에 남음). 스팸은 숨김 처리(원문 보존).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Flag, RefreshCw, Search, EyeOff, Eye, FileSearch } from 'lucide-react';
import { useDialog } from '../common/DialogProvider';
import {
  listConsultReports, loadConsultOverview, openConsultDetail, resolveConsultReport,
  type ConsultDetailForReview, type ConsultOverview, type ConsultReport,
} from '../../services/admin/adminOpsService';
import { adminSetConsultHidden } from '../../services/consultService';

const STATUS_LABEL: Record<string, string> = {
  requested: '요청 대기', responding: '응답 중', comparing: '비교 상담', counseling: '상담 중', contracted: '계약 체결', closed: '종결', cancelled: '취소',
};
const SEAT_LABEL: Record<string, string> = {
  requested: '응답 대기', reviewing: '검토 중', proposed: '제안서', chosen: '선택', declined: '거절', expired: '기한 지남', withdrawn: '철회', released: '반환',
};
const CATEGORY_LABEL: Record<string, string> = { spam: '스팸', abuse: '욕설·괴롭힘', fraud: '사기 의심', privacy: '개인정보', other: '기타' };
const FILTERS = [
  ['all', '전체'], ['requested', '요청 대기'], ['responding', '응답 중'], ['comparing', '비교 상담'], ['counseling', '상담 중'],
  ['contracted', '계약 체결'], ['closed', '종결'], ['hidden', '스팸 숨김'],
] as const;
const PAGE = 30;
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const card = 'bg-[#111622] rounded-2xl border border-[#1E293B]/60';

export default function ConsultMonitorPanel() {
  const dialog = useDialog();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ConsultOverview | null>(null);
  const [error, setError] = useState('');
  const [reports, setReports] = useState<ConsultReport[]>([]);
  const [detail, setDetail] = useState<{ id: string; data: ConsultDetailForReview } | null>(null);

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([loadConsultOverview({ status, search: query, limit: PAGE, offset: page * PAGE }), listConsultReports('open')]);
    if (o.ok === false) { setError(o.message); setData({ total: 0, rows: [], counts: {} }); }
    else { setError(''); setData(o.data); }
    setReports(r.ok ? r.data : []);
  }, [status, query, page]);

  useEffect(() => { void load(); }, [load]);

  const toggleHidden = async (id: string, hidden: boolean) => {
    let reason: string | null = '';
    if (hidden) {
      reason = await dialog.prompt({ title: '스팸 숨김', message: '이 요청을 변호사 화면에서 숨겨요. 원문은 지우지 않아요. 사유를 적어 주세요.', placeholder: '예: 같은 내용 반복 등록' });
      if (!reason || !reason.trim()) return;
    }
    const res = await adminSetConsultHidden(id, hidden, reason || undefined);
    if (res.ok === false) { toast.error(res.error); return; }
    toast.success(hidden ? '숨겼어요.' : '숨김을 풀었어요.');
    void load();
  };

  const openDetail = async (id: string) => {
    const reason = await dialog.prompt({ title: '신고 검토용 원문 열람', message: '열람 기록(관리자·시각·사유)이 남아요. 신고 검토에 필요한 경우에만 여세요.', placeholder: '예: 스팸 신고 내용 확인' });
    if (!reason || !reason.trim()) return;
    const res = await openConsultDetail(id, reason.trim());
    if (res.ok === false) { toast.error(res.message); return; }
    setDetail({ id, data: res.data });
  };

  const resolve = async (rep: ConsultReport, decision: 'resolved' | 'dismissed') => {
    const resolution = await dialog.prompt({ title: decision === 'resolved' ? '신고 처리' : '신고 기각', message: '처리 내용을 적어 주세요. 신고한 사람에게 처리됐다는 알림이 가요(내용은 보내지 않아요).', placeholder: decision === 'resolved' ? '예: 스팸으로 숨김 처리' : '예: 정상 상담으로 확인' });
    if (!resolution || !resolution.trim()) return;
    const res = await resolveConsultReport(rep.id, decision, resolution.trim());
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success('신고를 처리했어요.');
    if (detail?.id === rep.consultRequestId) setDetail(null);
    void load();
  };

  const counts = data?.counts || {};
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[['all', '전체'], ['requested', '요청 대기'], ['responding', '응답 중'], ['comparing', '비교 상담'], ['counseling', '상담 중'], ['contracted', '계약 체결'], ['hidden', '스팸 숨김'], ['open_reports', '열린 신고']].map(([k, label]) => (
          <div key={k} className={`${card} p-3 text-center`}>
            <div className="text-lg font-extrabold text-white">{data ? (counts[k] ?? 0) : '–'}</div>
            <div className="text-xs font-bold text-slate-300">{label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        관리자 화면에는 연락처·채무 정보·상담 본문이 오지 않아요(변호사법 제26조, 제로날리지 원칙). 응답 기한(2영업일)이 지나면 서버가 자리를 돌려주고 의뢰인에게 다른 변호사를 고를 수 있다고 안내해요.
      </p>

      {/* 신고함 */}
      <section className={`${card} p-4 space-y-3 border-rose-500/30`}>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-rose-200"><Flag className="w-4 h-4" aria-hidden="true" />열린 신고 {reports.length}건</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-400">처리할 신고가 없어요.</p>
        ) : (
          <ul className="divide-y divide-[#1E293B]/50">
            {reports.map(rep => (
              <li key={rep.id} className="py-2.5 flex flex-col lg:flex-row lg:items-center gap-2 text-sm">
                <div className="flex-1 text-slate-200">
                  <span className="font-bold">{rep.alias}</span>
                  <span className="text-slate-400"> · {CATEGORY_LABEL[rep.category] || rep.category} · {rep.reporterRole === 'client' ? '의뢰인 신고' : '사무소 신고'} · {fmt(rep.createdAt)}</span>
                  {rep.detail && <p className="mt-0.5 text-xs text-slate-400 break-words">{rep.detail}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => void openDetail(rep.consultRequestId)} className="inline-flex items-center gap-1 min-h-10 px-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap active:scale-[0.98]"><FileSearch className="w-3.5 h-3.5" aria-hidden="true" />원문 열람</button>
                  <button type="button" onClick={() => void toggleHidden(rep.consultRequestId, true)} className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap active:scale-[0.98]">스팸 숨김</button>
                  <button type="button" onClick={() => void resolve(rep, 'resolved')} className="min-h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold whitespace-nowrap active:scale-[0.98]">처리 완료</button>
                  <button type="button" onClick={() => void resolve(rep, 'dismissed')} className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold whitespace-nowrap active:scale-[0.98]">기각</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {detail && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-200">신고 검토용 원문 · {detail.data.alias} (열람 기록됨)</p>
              <button type="button" onClick={() => setDetail(null)} className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold whitespace-nowrap">닫기</button>
            </div>
            {detail.data.title && <p className="text-sm font-bold text-slate-100">{detail.data.title}</p>}
            {detail.data.content && <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{detail.data.content}</p>}
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {detail.data.messages.map((m, i) => (
                <li key={i} className="text-xs text-slate-300"><span className="text-slate-500">{fmt(m.createdAt)} · {m.senderType === 'client' ? '의뢰인' : m.senderType === 'system' ? '시스템' : '변호사'}</span> {m.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 목록 */}
      <section className={`${card} overflow-hidden`}>
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between border-b border-[#1E293B]/60">
          <form className="relative w-full md:max-w-xs" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(search); }}>
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="가명 또는 요청 ID" aria-label="가명 또는 요청 ID 검색" className="w-full min-h-10 bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl pl-9 pr-3 text-sm text-slate-100" />
          </form>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => { setStatus(k); setPage(0); }} className={`min-h-9 px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] ${status === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
            ))}
            <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
        {error ? (
          <div className="p-4 flex items-center justify-between gap-3 text-sm text-rose-200">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="min-h-10 px-4 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap">다시 불러오기</button>
          </div>
        ) : !data ? (
          <div className="p-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />)}</div>
        ) : data.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">조건에 맞는 상담 요청이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#161B26] text-xs text-slate-400 border-b border-[#1E293B]/60">
                  <th className="p-3">가명</th><th className="p-3">상태</th><th className="p-3">요청한 변호사·응답</th><th className="p-3 text-right">제안서</th>
                  <th className="p-3 text-right">메시지</th><th className="p-3">마지막 활동</th><th className="p-3">유입</th><th className="p-3">등록</th><th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/30">
                {data.rows.map(r => (
                  <tr key={r.id} className={r.adminHidden ? 'opacity-60' : ''}>
                    <td className="p-3 text-white font-bold">
                      {r.alias}
                      <span className="block text-[11px] font-normal text-slate-500">{r.id}</span>
                      {r.openReports > 0 && <span className="mt-0.5 inline-block rounded-lg bg-rose-500/15 text-rose-200 px-1.5 text-[11px] font-bold">신고 {r.openReports}</span>}
                    </td>
                    <td className="p-3 text-slate-200">{r.adminHidden ? `숨김${r.adminHiddenReason ? ` · ${r.adminHiddenReason}` : ''}` : (STATUS_LABEL[r.status] || r.status)}</td>
                    <td className="p-3 text-xs text-slate-300">
                      {r.lawyerCount}명
                      {Object.entries(r.seats).length > 0 && <span className="text-slate-400"> · {Object.entries(r.seats).map(([k, n]) => `${SEAT_LABEL[k] || k} ${n}`).join(', ')}</span>}
                      {r.overdueSeats > 0 && <span className="text-amber-300"> · 기한 지남 {r.overdueSeats}</span>}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-200">{r.proposalCount}</td>
                    <td className="p-3 text-right font-mono text-slate-200">{r.messageCount}</td>
                    <td className="p-3 text-xs text-slate-400">{fmt(r.lastMessageAt || r.updatedAt)}</td>
                    <td className="p-3 text-xs text-slate-400">{r.source || '-'}</td>
                    <td className="p-3 text-xs text-slate-400">{fmt(r.createdAt)}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => void toggleHidden(r.id, !r.adminHidden)} aria-label={r.adminHidden ? '숨김 풀기' : '스팸 숨김'} className="min-h-9 px-2.5 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]">
                        {r.adminHidden ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE && (
          <div className="p-3 flex items-center justify-end gap-2 text-xs text-slate-300 border-t border-[#1E293B]/60">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="min-h-9 px-3 rounded-xl bg-slate-800 disabled:opacity-40 whitespace-nowrap">이전</button>
            <span>{page + 1} / {pages}</span>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="min-h-9 px-3 rounded-xl bg-slate-800 disabled:opacity-40 whitespace-nowrap">다음</button>
          </div>
        )}
      </section>
    </div>
  );
}
