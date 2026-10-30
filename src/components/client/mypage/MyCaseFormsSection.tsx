// 의뢰인 '내 사건' › 작성할 서류 (H-14)
// 사무소가 보낸 서식 작성 요청을 질문 칸 그대로 채우고, 필요하면 서명하거나(본인)
// 출력해 서명받은 사진을 올린다(제3자, FH-Q3). 임시 저장·보내기는 서버에만 저장한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileSignature, PenLine, Printer, Upload } from 'lucide-react';
import {
  CLIENT_FORMS_CHANGED_EVENT, loadMyClientForms, respondClientForm, type ClientFormRequest,
} from '../../../services/forms/clientFormService';
import { formatWon, validateAnswers } from '../../../services/forms/clientFormSchemas';
import { uploadCaseFile } from '../../../services/files/caseFileService';
import SignaturePadModal from '../sign/SignaturePadModal';
import type { DocumentFile } from '../../../types';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const btn = 'min-h-[44px] px-3 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: '작성해 주세요', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  in_progress: { label: '작성 중', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  submitted: { label: '보냈어요', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  needs_fix: { label: '보완이 필요해요', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
  accepted: { label: '확인됐어요', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function readAsDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(f); });
}

/** 제3자 서명용 출력 (내용 + 서명 칸). 화면 밖으로 데이터를 보내지 않는다 */
function printForSignature(req: ClientFormRequest, answers: Record<string, string>) {
  const rows = req.fields.map(f => {
    const v = answers[f.id] || '';
    const shown = f.type === 'currency' ? (formatWon(v) || v) : v;
    return `<tr><th>${esc(f.label)}</th><td>${esc(shown).replace(/\n/g, '<br>')}</td></tr>`;
  }).join('');
  // 'noopener'를 주면 창 객체가 null이라 내용을 쓸 수 없다 (빈 창이라 열린 쪽 접근 위험 없음)
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) { toast.error('출력 창을 열지 못했어요. 팝업 차단을 풀고 다시 눌러 주세요.'); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(req.title)}</title>
<style>body{font-family:'Nanum Myeongjo',serif;margin:40px;color:#111}h1{text-align:center;font-size:24px;letter-spacing:6px}
table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #333;padding:10px;font-size:14px;vertical-align:top}
th{width:32%;background:#f3f3f3;text-align:left}.sign{margin-top:48px;font-size:15px;line-height:2.2}.line{display:inline-block;width:180px;border-bottom:1px solid #111}
@media print{body{margin:20mm}}</style></head><body><h1>${esc(req.title)}</h1><table>${rows}</table>
<div class="sign"><p>위 내용이 사실임을 확인합니다.</p><p>작성일: <span class="line"></span></p>
<p>${esc(req.thirdPartySigner || '확인자')} 성명: <span class="line"></span> (서명 또는 인)</p>
<p>연락처: <span class="line"></span></p></div>
<p style="margin-top:32px;font-size:12px;color:#555">서명받은 뒤 이 종이를 사진으로 찍어 마이김변 '내 사건'에 올려 주세요. 주민등록번호는 적지 않아도 돼요.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

export default function MyCaseFormsSection({ caseKey }: { caseKey: string }) {
  const [list, setList] = useState<ClientFormRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadMyClientForms(caseKey);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setList(r.data);
  }, [caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CLIENT_FORMS_CHANGED_EVENT, h);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener(CLIENT_FORMS_CHANGED_EVENT, h); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  if (error) return <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>;
  if (!list || list.length === 0) return null;

  return (
    <section className="mt-4 space-y-2" aria-label="작성할 서류">
      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5"><FileSignature className="w-4 h-4 text-blue-600" aria-hidden="true" /> 사무소가 작성을 요청한 서류</p>
      <ul className="space-y-2">
        {list.map(req => <FormCard key={req.id} req={req} caseKey={caseKey} reload={load} />)}
      </ul>
    </section>
  );
}

function FormCard({ req, caseKey, reload }: { req: ClientFormRequest; caseKey: string; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(req.status === 'needs_fix');
  const [answers, setAnswers] = useState<Record<string, string>>(req.draft || {});
  const [fieldError, setFieldError] = useState<{ fieldId: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signatureFileId, setSignatureFileId] = useState<string | undefined>();
  const [signOpen, setSignOpen] = useState(false);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const st = STATUS[req.status] || STATUS.requested;
  const locked = req.status === 'accepted' || req.status === 'submitted';

  const save = async () => {
    setBusy(true);
    const r = await respondClientForm(req.id, 'save', { answers });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('임시 저장했어요. 다른 기기에서도 이어서 쓸 수 있어요.');
    void reload();
  };

  const submit = async () => {
    const err = validateAnswers(req.fields, answers);
    setFieldError(err);
    if (err) { toast.error(err.message); return; }
    if (req.needsSignature && !signatureFileId) { toast.error('서명을 먼저 해 주세요.'); return; }
    if (req.thirdPartySigner && photoIds.length === 0) { toast.error(`${req.thirdPartySigner} 서명을 받은 서류 사진을 올려 주세요.`); return; }
    setBusy(true);
    const r = await respondClientForm(req.id, 'submit', { answers, signatureFileId, fileIds: photoIds });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('사무소에 보냈어요. 확인되면 알려 드릴게요.');
    setOpen(false);
    void reload();
  };

  const upload = async (blob: Blob, name: string): Promise<string | null> => {
    const dataUrl = await readAsDataUrl(blob);
    const up = await uploadCaseFile({
      source: 'client', clientKey: caseKey,
      file: { id: '', name, category: 'other', uploadedAt: new Date().toISOString(), uploadedBy: '의뢰인', mimeType: blob.type, dataUrl, uploadSource: 'client', reviewStatus: 'submitted' } as DocumentFile,
    });
    if (!up.ok || !up.file) { toast.error(up.message || '올리지 못했어요.'); return null; }
    return up.file.id;
  };

  const onSigned = async (dataUrl: string) => {
    setSignOpen(false);
    setBusy(true);
    const blob = await (await fetch(dataUrl)).blob();
    const id = await upload(blob, `${req.title}_서명.png`);
    setBusy(false);
    if (id) { setSignatureFileId(id); toast.success('서명을 저장했어요.'); }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setBusy(true);
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: 20MB를 넘어요.`); continue; }
      const id = await upload(f, f.name);
      if (id) setPhotoIds(p => [...p, id]);
    }
    setBusy(false);
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{req.title}</p>
          {req.dueOn && req.status !== 'accepted' && <p className="text-xs text-amber-800 font-bold">{req.dueOn}까지</p>}
        </div>
        <span className={`text-xs font-bold border rounded-lg px-2 py-0.5 shrink-0 ${st.cls}`}>{st.label}</span>
      </div>
      {req.status === 'needs_fix' && req.fixReason && (
        <p className="text-xs text-rose-800 bg-rose-50 rounded-lg px-2.5 py-2 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /> 사무소: {req.fixReason}</p>
      )}
      {req.status === 'accepted' && <p className="text-xs text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 사무소가 확인했어요.</p>}
      {req.status === 'submitted' && <p className="text-xs text-blue-800">사무소가 확인하고 있어요. 고칠 게 있으면 알려 드릴게요.</p>}
      {req.note && !locked && <p className="text-xs text-slate-700 leading-relaxed">{req.note}</p>}

      {!locked && !open && (
        <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-blue-600 text-white`}><PenLine className="w-4 h-4" aria-hidden="true" /> 작성하기</button>
      )}

      {!locked && open && (
        <div className="space-y-3 pt-1">
          {req.fields.map(f => {
            const v = answers[f.id] || '';
            const set = (nv: string) => { setAnswers(a => ({ ...a, [f.id]: nv.slice(0, 2000) })); if (fieldError?.fieldId === f.id) setFieldError(null); };
            const errId = `ferr-${req.id}-${f.id}`;
            const invalid = fieldError?.fieldId === f.id;
            const common = { 'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? errId : undefined } as const;
            return (
              <div key={f.id} className="space-y-1">
                <label htmlFor={`f-${req.id}-${f.id}`} className="text-xs font-bold text-slate-800">{f.label}{f.required && <span className="text-rose-600"> *</span>}</label>
                {f.type === 'textarea' ? (
                  <textarea id={`f-${req.id}-${f.id}`} value={v} rows={3} placeholder={f.placeholder} onChange={e => set(e.target.value)} {...common}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                ) : f.type === 'select' ? (
                  <select id={`f-${req.id}-${f.id}`} value={v} onChange={e => set(e.target.value)} {...common} className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm bg-white">
                    <option value="">골라 주세요</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'radio' ? (
                  <div id={`f-${req.id}-${f.id}`} role="radiogroup" className="flex flex-wrap gap-2" {...common}>
                    {(f.options || []).map(o => (
                      <button key={o} type="button" role="radio" aria-checked={v === o} onClick={() => set(o)}
                        className={`min-h-[44px] px-3 rounded-xl border text-sm font-bold active:scale-[0.98] ${v === o ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}>{o}</button>
                    ))}
                  </div>
                ) : (
                  <input id={`f-${req.id}-${f.id}`} value={v} placeholder={f.placeholder} {...common}
                    type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'currency' || f.type === 'number' ? 'numeric' : undefined}
                    onChange={e => set(f.type === 'currency' || f.type === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm" />
                )}
                {f.type === 'currency' && v && <p className="text-xs text-slate-500">{formatWon(v)}</p>}
                {f.helpText && <p className="text-xs text-slate-500">{f.helpText}</p>}
                {invalid && <p id={errId} className="text-xs text-rose-700">{fieldError!.message}</p>}
              </div>
            );
          })}

          {req.needsSignature && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
              <p className="text-xs text-slate-700">이 서류는 본인 서명이 필요해요.</p>
              <button type="button" disabled={busy} onClick={() => setSignOpen(true)} className={`${btn} bg-white border border-slate-300 text-slate-800`}>
                <PenLine className="w-4 h-4" aria-hidden="true" /> {signatureFileId ? '서명 다시 하기' : '서명하기'}
              </button>
              {signatureFileId && <p className="text-xs text-emerald-700 font-bold">서명 완료</p>}
            </div>
          )}

          {req.thirdPartySigner && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
              <p className="text-xs text-slate-700">{req.thirdPartySigner} 서명이 필요해요. 내용을 채운 뒤 출력해 서명을 받고, 사진을 찍어 올려 주세요.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => printForSignature(req, answers)} className={`${btn} bg-white border border-slate-300 text-slate-800`}><Printer className="w-4 h-4" aria-hidden="true" /> 출력하기</button>
                <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`${btn} bg-white border border-slate-300 text-slate-800`}><Upload className="w-4 h-4" aria-hidden="true" /> 서명받은 사진 올리기</button>
                <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={e => void onPick(e)} />
              </div>
              {photoIds.length > 0 && <p className="text-xs text-emerald-700 font-bold">사진 {photoIds.length}장 올림</p>}
            </div>
          )}

          <p className="text-xs text-slate-500">주민등록번호는 적지 않아요. 사무소가 법원에 낼 때만 따로 받아요.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-white border border-slate-300 text-slate-800`}>임시 저장</button>
            <button type="button" disabled={busy} onClick={() => void submit()} className={`${btn} bg-blue-600 text-white`}>사무소에 보내기</button>
          </div>
        </div>
      )}
      <SignaturePadModal open={signOpen} onClose={() => setSignOpen(false)} onComplete={d => void onSigned(d)} signerName="의뢰인" />
    </li>
  );
}
