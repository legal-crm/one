// 서식 허브 › 의뢰인 작성 요청 (H-14)
// 사무소가 보낸 작성 요청과 의뢰인이 보낸 답(최신 제출본)을 보고 확인·보완 요청·취소한다.
// 이전: 변호사 브라우저 localStorage 목록 + 의뢰인이 열 수 없는 /mobile-doc?token= 링크 복사.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileSignature, RefreshCw } from 'lucide-react';
import {
  CLIENT_FORMS_CHANGED_EVENT, FORM_STATUS_LABEL, loadOfficeClientForms, reviewClientForm, type ClientFormRequest,
} from '../../../services/forms/clientFormService';
import { formatWon } from '../../../services/forms/clientFormSchemas';
import { loadCaseFilesByIds } from '../../../services/corrections/correctionService';
import { getCaseFileUrl } from '../../../services/files/caseFileService';

const btn = 'min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

async function openFile(fileId: string) {
  const [f] = await loadCaseFilesByIds([fileId]);
  const url = f ? await getCaseFileUrl({ storagePath: f.storagePath }) : null;
  if (url) window.open(url, '_blank', 'noopener'); else toast.error('파일을 열지 못했어요.');
}

export default function ClientFormRequestsPanel({ officeId, caseKey, onCountChange }: { officeId: string; caseKey: string; onCountChange?: (n: number) => void }) {
  const [list, setList] = useState<ClientFormRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fixFor, setFixFor] = useState<{ id: string; action: 'needs_fix' | 'cancel'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await loadOfficeClientForms(officeId, caseKey);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setList(r.data);
    onCountChange?.(r.data.filter(x => x.status !== 'accepted' && x.status !== 'cancelled').length);
  }, [officeId, caseKey, onCountChange]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CLIENT_FORMS_CHANGED_EVENT, h);
    return () => window.removeEventListener(CLIENT_FORMS_CHANGED_EVENT, h);
  }, [load]);

  const act = async (id: string, action: 'accept' | 'needs_fix' | 'cancel', reason?: string) => {
    setBusyId(id);
    const r = await reviewClientForm(id, action, reason);
    setBusyId(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(action === 'accept' ? '확인 완료로 바꿨어요.' : action === 'needs_fix' ? '의뢰인에게 보완을 요청했어요.' : '요청을 취소했어요.');
    setFixFor(null);
    void load();
  };

  if (error) {
    return (
      <div role="alert" className="bg-white rounded-2xl p-6 border border-rose-200 text-center space-y-2">
        <p className="text-sm font-bold text-rose-800">{error}</p>
        <button type="button" onClick={() => void load()} className={`${btn} bg-white border border-slate-300 text-slate-800`}><RefreshCw className="w-3.5 h-3.5" /> 다시 불러오기</button>
      </div>
    );
  }
  if (!list) {
    return <div className="space-y-2" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  }
  if (list.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-2">
        <FileSignature className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
        <p className="font-bold text-sm text-slate-700">보낸 작성 요청이 없어요.</p>
        <p className="text-xs text-slate-500">서식 카드의 [의뢰인에게 작성 요청]을 누르면 의뢰인 '내 사건' 화면에 작성 칸이 생기고 알림이 가요.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map(req => {
        const sub = req.submission;
        const closed = req.status === 'accepted' || req.status === 'cancelled';
        return (
          <li key={req.id} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-900">{req.title} <span className="text-xs font-mono text-slate-400">#{req.docCode}</span></p>
                <p className="text-xs text-slate-500">요청 {new Date(req.requestedAt).toLocaleDateString('ko-KR')}{req.dueOn ? ` · ${req.dueOn}까지` : ''}{sub ? ` · ${sub.version}번째 제출 ${new Date(sub.submittedAt).toLocaleString('ko-KR')}` : ''}</p>
              </div>
              <span className={`text-xs font-bold rounded-lg px-2 py-0.5 border ${req.status === 'submitted' ? 'bg-blue-50 text-blue-800 border-blue-200' : req.status === 'accepted' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : req.status === 'needs_fix' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                {FORM_STATUS_LABEL[req.status]}
              </span>
            </div>
            {req.status === 'needs_fix' && req.fixReason && <p className="text-xs text-rose-800">보완 요청: {req.fixReason}</p>}
            {req.status === 'cancelled' && req.cancelReason && <p className="text-xs text-slate-600">취소 사유: {req.cancelReason}</p>}

            {sub && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs bg-slate-50 rounded-xl p-3 border border-slate-100">
                {req.fields.map(f => (
                  <div key={f.id} className="min-w-0">
                    <dt className="text-slate-500">{f.label}</dt>
                    <dd className="text-slate-900 font-medium whitespace-pre-wrap break-words">{(f.type === 'currency' ? formatWon(sub.answers[f.id]) : sub.answers[f.id]) || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
            {sub && (sub.signatureFileId || sub.fileIds.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {sub.signatureFileId && <button type="button" onClick={() => void openFile(sub.signatureFileId!)} className={`${btn} bg-white border border-slate-300 text-slate-800`}>의뢰인 서명 보기</button>}
                {sub.fileIds.map((id, i) => <button key={id} type="button" onClick={() => void openFile(id)} className={`${btn} bg-white border border-slate-300 text-slate-800`}>서명본 사진 {i + 1}</button>)}
              </div>
            )}

            {!closed && (
              fixFor?.id === req.id ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800" htmlFor={`fix-${req.id}`}>{fixFor.action === 'needs_fix' ? '의뢰인에게 보낼 보완 요청 사유' : '요청 취소 사유 (사무소 기록)'}</label>
                  <textarea id={`fix-${req.id}`} rows={2} value={fixFor.text} onChange={e => setFixFor({ ...fixFor, text: e.target.value.slice(0, 1000) })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" />
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === req.id || !fixFor.text.trim()} onClick={() => void act(req.id, fixFor.action, fixFor.text.trim())} className={`${btn} bg-slate-900 text-white`}>보내기</button>
                    <button type="button" onClick={() => setFixFor(null)} className={`${btn} bg-white border border-slate-300 text-slate-700`}>닫기</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {req.status === 'submitted' && (
                    <>
                      <button type="button" disabled={busyId === req.id} onClick={() => void act(req.id, 'accept')} className={`${btn} bg-emerald-600 text-white`}><CheckCircle2 className="w-3.5 h-3.5" /> 확인 완료</button>
                      <button type="button" onClick={() => setFixFor({ id: req.id, action: 'needs_fix', text: '' })} className={`${btn} bg-white border border-rose-300 text-rose-700`}>보완 요청</button>
                    </>
                  )}
                  <button type="button" onClick={() => setFixFor({ id: req.id, action: 'cancel', text: '' })} className={`${btn} bg-white border border-slate-300 text-slate-700`}>요청 취소</button>
                </div>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
