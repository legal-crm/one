// 통합어드민 › 회원: 개인정보 요청 처리 (OP-11, 법정 기한 10일)
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { useDialog } from '../common/DialogProvider';
import {
  PRIVACY_KIND_LABEL, PRIVACY_STATUS_LABEL, handlePrivacyRequest, listPrivacyRequests, type PrivacyRequest,
} from '../../services/privacy/privacyRequestService';

export default function PrivacyRequestsPanel() {
  const dialog = useDialog();
  const [rows, setRows] = useState<PrivacyRequest[] | null>(null);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const r = await listPrivacyRequests(showDone ? undefined : ['received', 'in_progress']);
    if (r.ok === false) { setError(r.message); setRows([]); return; }
    setError(''); setRows(r.data);
  }, [showDone]);
  useEffect(() => { void load(); }, [load]);

  const act = async (row: PrivacyRequest, status: 'in_progress' | 'done' | 'rejected') => {
    let response = '';
    if (status !== 'in_progress') {
      const v = await dialog.prompt({
        title: status === 'done' ? '처리 완료' : '처리 불가',
        message: '이용자에게 알림으로 보낼 답변을 적어 주세요(200자까지 알림에 보여요). 실명·연락처는 적지 마세요.',
        placeholder: status === 'done' ? '예: 요청하신 상담 기록을 삭제했어요.' : '예: 법령상 보관 의무가 있어 5년간 보관해요.',
      });
      if (!v || !v.trim()) return;
      response = v.trim();
    }
    const r = await handlePrivacyRequest(row.id, status, response);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('저장했어요.');
    void load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white"><ShieldCheck className="w-4 h-4 text-indigo-400" aria-hidden="true" />개인정보 요청</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 min-h-9"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="w-4 h-4" />처리한 요청도 보기</label>
          <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
        </div>
      </div>
      <p className="text-xs text-slate-400">열람·정정·삭제·처리 정지·동의 철회 요청은 10일 안에 답해야 해요. 법률사무소가 보관하는 사건 기록은 그 사무소(개인정보처리자)가 처리해요.</p>
      {error ? <p className="text-sm text-rose-300">{error}</p> : rows === null ? (
        <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">처리할 요청이 없어요.</p>
      ) : (
        <ul className="divide-y divide-[#1E293B]/50">
          {rows.map(r => (
            <li key={r.id} className="py-2.5 flex flex-col lg:flex-row lg:items-center gap-2 text-sm">
              <div className="flex-1 text-slate-200">
                <span className="font-bold">{PRIVACY_KIND_LABEL[r.kind]}</span>
                <span className="text-slate-400"> · {PRIVACY_STATUS_LABEL[r.status]} · {new Date(r.createdAt).toLocaleDateString('ko-KR')} 접수 · </span>
                <span className={r.dueOn < today && (r.status === 'received' || r.status === 'in_progress') ? 'text-rose-300 font-bold' : 'text-slate-400'}>{r.dueOn}까지</span>
                <span className="block text-[11px] text-slate-500">계정 {r.userId.slice(0, 8)}…</span>
                {r.detail && <p className="text-xs text-slate-400 break-words">{r.detail}</p>}
                {r.response && <p className="text-xs text-emerald-300">답변: {r.response}</p>}
              </div>
              {(r.status === 'received' || r.status === 'in_progress') && (
                <div className="flex gap-1.5">
                  {r.status === 'received' && <button type="button" onClick={() => void act(r, 'in_progress')} className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap active:scale-[0.98]">처리 시작</button>}
                  <button type="button" onClick={() => void act(r, 'done')} className="min-h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold whitespace-nowrap active:scale-[0.98]">처리 완료</button>
                  <button type="button" onClick={() => void act(r, 'rejected')} className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold whitespace-nowrap active:scale-[0.98]">처리 불가</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
