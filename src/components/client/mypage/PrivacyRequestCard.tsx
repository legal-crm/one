// 마이페이지 › 알림·설정: 개인정보 요청 (OP-11). 마이김변이 10일 안에 처리하고 알림으로 알려 드린다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import {
  PRIVACY_KIND_LABEL, PRIVACY_STATUS_LABEL, listPrivacyRequests, submitPrivacyRequest,
  type PrivacyKind, type PrivacyRequest,
} from '../../../services/privacy/privacyRequestService';

export default function PrivacyRequestCard() {
  const [rows, setRows] = useState<PrivacyRequest[] | null>(null);
  const [kind, setKind] = useState<PrivacyKind>('access');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await listPrivacyRequests();
    setRows(r.ok ? r.data : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setSending(true);
    const r = await submitPrivacyRequest(kind, detail);
    setSending(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`요청을 받았어요. ${r.data.dueOn}까지 처리해 알림으로 알려 드려요.`);
    setDetail('');
    void load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><ShieldCheck className="w-4 h-4 text-brand" aria-hidden="true" />개인정보 요청</h3>
      <p className="text-sm text-slate-600">내 정보 열람·정정·삭제, 처리 정지, 동의 철회를 요청할 수 있어요. 마이김변이 10일 안에 처리해요. 상담한 법률사무소가 보관하는 사건 기록은 그 사무소에도 요청해 주세요.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
        <select value={kind} onChange={e => setKind(e.target.value as PrivacyKind)} aria-label="요청 종류" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm">
          {(Object.keys(PRIVACY_KIND_LABEL) as PrivacyKind[]).map(k => <option key={k} value={k}>{PRIVACY_KIND_LABEL[k]}</option>)}
        </select>
        <input value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} placeholder="필요하면 자세한 내용을 적어 주세요 (선택)" aria-label="요청 내용" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" />
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={sending} onClick={() => void send()} className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">요청 보내기</button>
      </div>
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map(r => (
            <li key={r.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">{PRIVACY_KIND_LABEL[r.kind]}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{PRIVACY_STATUS_LABEL[r.status]}</span>
                <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('ko-KR')} 접수 · {r.dueOn}까지</span>
              </div>
              {r.response && <p className="mt-1 text-xs text-slate-600">답변: {r.response}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
