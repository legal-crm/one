// 파산 진술서 추가 진술사항을 의뢰인에게 작성 요청하고, 받은 답을 공식 문항 칸으로 가져온다 (BK-7)
// 요청·답은 서버 client_form_requests/submissions (H-14 흐름 재사용). 판단·가능성 문장 없음
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Send } from 'lucide-react';
import {
  CLIENT_FORMS_CHANGED_EVENT, FORM_STATUS_LABEL, loadOfficeClientForms, notifyClientFormsChanged, requestClientForm, type ClientFormRequest,
} from '../../../services/forms/clientFormService';
import { BANKRUPTCY_STATEMENT_DOC_CODE, BANKRUPTCY_STATEMENT_SCHEMA, bankruptcyAnswersFromClient } from '../../../services/forms/clientFormSchemas';

type Answers = Record<string, { answer: 'yes' | 'no' | ''; detail: string }>;

export default function BankruptcyStatementRequest({ officeId, caseKey, current, onImport }: {
  officeId?: string;
  caseKey: string;
  current?: Answers;
  onImport: (answers: Answers) => void;
}) {
  const [req, setReq] = useState<ClientFormRequest | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!officeId) return;
    const r = await loadOfficeClientForms(officeId, caseKey);
    if (r.ok === false) { setReq(null); return; }
    const mine = r.data.filter(x => x.docCode === BANKRUPTCY_STATEMENT_DOC_CODE && x.status !== 'cancelled')
      .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
    setReq(mine[0] || null);
  }, [officeId, caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CLIENT_FORMS_CHANGED_EVENT, h);
    return () => window.removeEventListener(CLIENT_FORMS_CHANGED_EVENT, h);
  }, [load]);

  if (!officeId) return null;

  const send = async () => {
    setBusy(true);
    const r = await requestClientForm(officeId, caseKey, BANKRUPTCY_STATEMENT_SCHEMA);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('의뢰인 \'내 사건\'에 작성 요청을 보냈어요.');
    notifyClientFormsChanged();
    setReq(r.data);
  };

  const importAnswers = () => {
    const ans = req?.submission?.answers;
    if (!ans) return;
    const mapped = bankruptcyAnswersFromClient(ans);
    const n = Object.keys(mapped).length;
    if (n === 0) { toast.info('가져올 답이 없어요.'); return; }
    const overwrite = Object.keys(mapped).filter(k => current?.[k]?.answer).length;
    onImport({ ...(current || {}), ...mapped });
    toast.success(`의뢰인 답 ${n}개를 공식 문항 칸에 넣었어요${overwrite ? ` (이미 적은 ${overwrite}개는 의뢰인 답으로 바뀜)` : ''}. 확인한 뒤 저장해 주세요.`);
  };

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3 space-y-2 text-xs">
      <p className="font-bold text-slate-900">의뢰인에게 직접 답을 받기</p>
      <p className="text-slate-600">공식 11문항을 의뢰인 '내 사건' 화면에 보내 사실을 적게 하고, 받은 답을 아래 칸으로 가져와요.</p>
      {req === undefined ? (
        <div className="h-9 rounded-xl bg-white/70 animate-pulse" />
      ) : !req || req.status === 'accepted' ? (
        <div className="flex items-center gap-2 flex-wrap">
          {req?.status === 'accepted' && <span className="text-emerald-700 font-bold">지난 요청: 확인 완료</span>}
          <button type="button" onClick={() => void send()} disabled={busy}
            className="min-h-[44px] px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]">
            <Send className="w-3.5 h-3.5" aria-hidden="true" />{busy ? '보내는 중…' : '작성 요청 보내기'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-lg bg-white border border-purple-200 px-2 py-1 font-bold text-purple-800">{FORM_STATUS_LABEL[req.status]}</span>
          {req.submission && (
            <button type="button" onClick={importAnswers}
              className="min-h-[44px] px-3 rounded-xl border border-purple-300 bg-white text-purple-800 font-bold whitespace-nowrap inline-flex items-center gap-1.5 active:scale-[0.98]">
              <Download className="w-3.5 h-3.5" aria-hidden="true" />의뢰인 답 가져오기
            </button>
          )}
          <span className="text-slate-500">확인·보완 요청은 서식 허브 '의뢰인 작성 요청'에서 해요.</span>
        </div>
      )}
    </div>
  );
}
