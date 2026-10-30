import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Search } from 'lucide-react';
import { listAccounts, setAccountStatus, type AccountKind, type AccountRow } from '../../services/admin/adminOpsService';

/**
 * 계정 관리 (OP-9·OP-10, 서버 기준).
 * 가입 계정(auth) + 가명 + 변호사 계정 + 사무소 직원을 합쳐 페이지 단위로 본다. 이메일은 가린다.
 * 정지하면 로그인 세션이 끊기고 상담·사건 표를 읽고 쓸 수 없다.
 */
const PAGE = 30;
const KINDS: Array<{ key: AccountKind | ''; label: string }> = [
  { key: '', label: '전체' }, { key: 'client', label: '의뢰인' }, { key: 'lawyer', label: '변호사' }, { key: 'staff', label: '사무소 직원' }, { key: 'admin', label: '관리자' },
];
const KIND_LABEL: Record<AccountKind, string> = { client: '의뢰인', lawyer: '변호사', staff: '사무소 직원', admin: '관리자' };

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');

export default function AccountsPanel() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AccountKind | ''>('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<AccountRow | null>(null);
  const [reason, setReason] = useState('');
  const [untilDays, setUntilDays] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listAccounts({ search: query, kind: kind || undefined, limit: PAGE, offset: page * PAGE });
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setRows(r.data.rows);
    setTotal(r.data.total);
  }, [query, kind, page]);
  useEffect(() => { void load(); }, [load]);

  const applyStatus = async (row: AccountRow, status: 'active' | 'suspended') => {
    if (status === 'suspended' && !reason.trim()) { toast.error('정지 사유를 적어 주세요.'); return; }
    setBusy(true);
    const until = status === 'suspended' && untilDays ? new Date(Date.now() + Number(untilDays) * 86400000) : null;
    const res = await setAccountStatus(row.userId, status, reason, until);
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(status === 'suspended' ? `정지했어요 · 로그인 세션 ${res.data.revokedSessions}개를 끊었어요.` : '정지를 풀었어요.');
    setTarget(null);
    setReason('');
    setUntilDays('');
    void load();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-4" aria-labelledby="accounts-title">
      <div className="space-y-1">
        <h2 id="accounts-title" className="text-base font-extrabold text-white">계정 관리 (서버 기준)</h2>
        <p className="text-xs text-slate-400">가명·계정 번호·이메일 앞부분·변호사 ID로 찾을 수 있어요. 변호사 승인·정지는 '변호사 심사'에서 해요.</p>
      </div>
      <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(search); }}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="가명·이메일 앞부분·계정 번호" aria-label="계정 검색"
            className="w-full min-h-[44px] rounded-xl bg-[#0B0F19] border border-[#1E293B] pl-9 pr-3 text-sm text-white placeholder-slate-500" />
        </div>
        <button type="submit" className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer">찾기</button>
      </form>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="계정 종류">
        {KINDS.map(k => (
          <button key={k.key || 'all'} type="button" onClick={() => { setKind(k.key); setPage(0); }} aria-pressed={kind === k.key}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer ${kind === k.key ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-400/40' : 'text-slate-300 border border-[#1E293B]/80 hover:bg-white/5'}`}>
            {k.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-rose-200" role="alert"><AlertTriangle className="w-4 h-4" aria-hidden="true" /> {error}</div>
      ) : rows === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">찾는 계정이 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="py-2 pr-3 font-bold">종류</th>
                <th className="py-2 pr-3 font-bold">가명 / 변호사 ID</th>
                <th className="py-2 pr-3 font-bold">이메일</th>
                <th className="py-2 pr-3 font-bold">가입</th>
                <th className="py-2 pr-3 font-bold">마지막 로그인</th>
                <th className="py-2 pr-3 font-bold">상태</th>
                <th className="py-2 font-bold"><span className="sr-only">조치</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60">
              {rows.map(r => (
                <tr key={r.userId} className="text-slate-200">
                  <td className="py-2 pr-3 whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                  <td className="py-2 pr-3">{r.alias || r.lawyerId || '–'}</td>
                  <td className="py-2 pr-3 text-slate-400">{r.email || '–'}{r.provider ? ` · ${r.provider}` : ''}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{fmt(r.createdAt)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{fmt(r.lastSignInAt)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.status === 'suspended'
                      ? <span className="text-xs font-bold text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg px-2 py-0.5" title={r.statusReason}>정지{r.statusUntil ? ` (~${new Date(r.statusUntil).toLocaleDateString('ko-KR')})` : ''}</span>
                      : <span className="text-xs text-emerald-200">이용 중</span>}
                  </td>
                  <td className="py-2 text-right">
                    {r.kind !== 'admin' && (
                      r.status === 'suspended'
                        ? <button type="button" onClick={() => void applyStatus(r, 'active')} disabled={busy}
                            className="min-h-[44px] px-3 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 whitespace-nowrap active:scale-[0.98] cursor-pointer">정지 풀기</button>
                        : <button type="button" onClick={() => { setTarget(r); setReason(''); setUntilDays(''); }}
                            className="min-h-[44px] px-3 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 whitespace-nowrap active:scale-[0.98] cursor-pointer">정지</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>총 {total.toLocaleString()}개</span>
        <div className="flex gap-1.5">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
            className="min-h-[44px] px-3 rounded-xl border border-[#1E293B] text-slate-200 disabled:opacity-40 whitespace-nowrap active:scale-[0.98] cursor-pointer">이전</button>
          <span className="self-center">{page + 1} / {pages}</span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}
            className="min-h-[44px] px-3 rounded-xl border border-[#1E293B] text-slate-200 disabled:opacity-40 whitespace-nowrap active:scale-[0.98] cursor-pointer">다음</button>
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
          <div className="bg-[#161B26] border border-[#1E293B] rounded-3xl w-full max-w-md p-6 space-y-4">
            <h3 id="suspend-title" className="text-base font-black text-white">{target.alias || target.lawyerId || '이 계정'} 정지</h3>
            <p className="text-xs text-slate-300 leading-relaxed">정지하면 로그인 세션이 끊기고, 상담·사건·서류를 읽고 쓸 수 없어요. 다시 로그인하면 정지 사유가 보여요.</p>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-200">사유 (필수, 본인에게 보여요)</span>
              <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} rows={3}
                className="w-full rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 py-2 text-sm text-white" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-200">기간 (일, 비우면 풀 때까지)</span>
              <input type="number" min={1} max={365} value={untilDays} onChange={e => setUntilDays(e.target.value ? Math.min(365, Math.max(1, Number(e.target.value))) : '')}
                className="w-full min-h-[44px] rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-white" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} disabled={busy}
                className="min-h-[44px] px-4 rounded-xl text-sm font-bold text-slate-200 border border-[#1E293B] hover:bg-white/5 whitespace-nowrap active:scale-[0.98] cursor-pointer">닫기</button>
              <button type="button" onClick={() => void applyStatus(target, 'suspended')} disabled={busy}
                className="min-h-[44px] px-4 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-60">
                {busy ? '처리 중…' : '정지하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
