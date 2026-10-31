import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, PenLine, Stamp, Upload, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Button, FormField, inputClass, Callout, Stepper } from '../ui';
import SignaturePadModal from '../sign/SignaturePadModal';
import {
  DISCHARGE_TEMPLATE_PATH, dischargeFileBase, dischargeHtml, dischargeHwpxEdits, emptyDischargeForm, validateDischarge,
  type DischargeForm,
} from '../../../services/court/dischargeApplication';
import { buildHwpx, downloadBlob, fetchTemplate } from '../../../services/court/hwpxBuilder';
import { guard } from '../../../services/court/courtDocGuard';
import { renderTextPdf, downloadPdfBytes } from '../../../services/court/courtPdfService';
import {
  deleteSignAsset, listSignAssets, loadDocDraft, recordDischargeEvent, saveDocDraft, saveSignAsset, signAssetDataUrl, type SignAsset,
} from '../../../services/client/clientDocsService';
import { cleanSealPhoto, makeNameSeal } from '../../../services/client/sealImage';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';

export type DischargeSource = 'self_litigant' | 'external_office' | 'mykim_lawyer' | 'none';

/**
 * 개인회생 면책신청서 작성기 (H-0, 고객 기획서 6-A·변호사 기획서 12번)
 *  사건 확인 → 신청인 정보 → 환급계좌 → 서명·날인 → 확인·내려받기 (PDF + HWPX)
 *  * 신청취지·신청원인은 법원 양식 고정 문구. 이용자는 사실 정보만 넣는다
 *  * 주민등록번호는 화면 메모리에만 두고 저장하지 않는다(L8). 창을 닫으면 지워진다
 *  * 마이김변 변호사 사건: 첫 버튼 '변호사에게 접수 요청', 직접 내려받으면 담당 사무소에 알림(D-Q1)
 *  * mode='office': 변호사가 사건 6단계에서 쓴다 → PDF를 사건 서류함에 저장(onSavePdf), 의뢰인 서명 자리는 비워 둔다
 */
export default function DischargeWriterModal({
  open, onClose, prefill, source = 'none', caseKey, isLoggedIn: isLoggedInProp, mode = 'client', onSavePdf, onLogin,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: Partial<DischargeForm>;
  source?: DischargeSource;
  /** 마이김변 사건의 작업 공간 키 (요청·알림용) */
  caseKey?: string;
  /** 모르면 비워 두면 열 때 세션으로 확인한다 */
  isLoggedIn?: boolean;
  mode?: 'client' | 'office';
  onSavePdf?: (bytes: Uint8Array, fileName: string) => Promise<boolean>;
  onLogin?: () => void;
}) {
  const steps = ['사건 확인', '신청인 정보', '환급계좌', '서명·날인', '확인·내려받기'];
  const [sessionLoggedIn, setSessionLoggedIn] = useState(false);
  useEffect(() => {
    if (!open || isLoggedInProp !== undefined || !isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSessionLoggedIn(!!data.session));
  }, [open, isLoggedInProp]);
  const isLoggedIn = isLoggedInProp ?? sessionLoggedIn;
  const [step, setStep] = useState(source === 'mykim_lawyer' && mode === 'client' ? -1 : 0);
  const [f, setF] = useState<DischargeForm>(() => ({ ...emptyDischargeForm(), ...(prefill || {}) }));
  const [rrn, setRrn] = useState('');
  const [signMethod, setSignMethod] = useState<'image' | 'blank' | null>(mode === 'office' ? 'blank' : null);
  const [signImage, setSignImage] = useState<string | null>(null);
  const [assets, setAssets] = useState<SignAsset[]>([]);
  const [padOpen, setPadOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const draftKey = `discharge:${caseKey ? caseKey.slice(0, 60) : 'own'}`;
  const photoRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  // 초안 불러오기 (로그인한 의뢰인만, 주민번호 없음)
  useEffect(() => {
    if (!open || mode !== 'client' || !isLoggedIn || loadedRef.current) return;
    loadedRef.current = true;
    loadDocDraft<Partial<DischargeForm>>(draftKey).then(r => {
      if (r.ok && r.data) setF(p => ({ ...p, ...r.data, ...(prefill?.caseNumber ? { caseNumber: prefill.caseNumber } : {}), ...(prefill?.courtName ? { courtName: prefill.courtName } : {}) }));
    });
    listSignAssets().then(r => { if (r.ok) setAssets(r.data); });
  }, [open, mode, isLoggedIn, draftKey, prefill]);

  // 작성 내용 자동 저장 (2초 뒤, 주민번호 제외)
  useEffect(() => {
    if (!open || mode !== 'client' || !isLoggedIn || !loadedRef.current) return;
    const t = setTimeout(() => {
      const { ...draft } = f;
      saveDocDraft(draftKey, draft as unknown as Record<string, unknown>).then(r => { if (!r.ok && r.code !== 'login') toast.error(r.message, { id: 'discharge-draft' }); });
    }, 2000);
    return () => clearTimeout(t);
  }, [f, open, mode, isLoggedIn, draftKey]);

  // 창을 닫으면 주민번호를 지운다
  useEffect(() => { if (!open) setRrn(''); }, [open]);

  const set = <K extends keyof DischargeForm>(k: K, v: DischargeForm[K]) => setF(p => ({ ...p, [k]: v }));
  const check = useMemo(() => validateDischarge(f, rrn, signMethod), [f, rrn, signMethod]);
  const errOf = (field: string) => (touched ? check.blocks.find(b => b.field === field)?.message : undefined) || null;

  const stepFields: Record<number, string[]> = {
    0: ['courtName', 'caseNumber'], 1: ['name', 'rrn', 'address', 'phone'], 2: ['bankName', 'accountNumber', 'accountIsOwn'], 3: ['sign'],
  };
  const next = () => {
    const bad = check.blocks.filter(b => (stepFields[step] || []).includes(b.field || ''));
    if (bad.length) { setTouched(true); toast.error(bad[0].message); return; }
    setTouched(false);
    setStep(s => Math.min(4, s + 1));
  };

  const useImage = (dataUrl: string) => { setSignImage(dataUrl); setSignMethod('image'); };
  const keepAsset = async (kind: SignAsset['kind'], src: SignAsset['source'], dataUrl: string) => {
    useImage(dataUrl);
    if (mode !== 'client' || !isLoggedIn) return;
    const r = await saveSignAsset(kind, src, dataUrl);
    if (r.ok) setAssets(a => [r.data, ...a]);
    else toast.error(r.message);
  };

  const notifyOffice = async (kind: 'request' | 'self_download') => {
    if (mode !== 'client' || source !== 'mykim_lawyer' || !caseKey) return true;
    const r = await recordDischargeEvent(caseKey, kind);
    if (!r.ok) { toast.error(r.message); return false; }
    return true;
  };

  const doHwpx = async () => {
    setTouched(true);
    if (!check.ok) { toast.error(check.blocks[0].message); return; }
    setBusy('hwpx');
    try {
      const tpl = await fetchTemplate(DISCHARGE_TEMPLATE_PATH);
      const r = await buildHwpx(tpl, dischargeHwpxEdits(f, rrn));
      const g = guard.missingAnchors(r.missing);
      if (!r.ok || !r.blob) { toast.error(r.error || 'HWPX를 만들지 못했어요.'); return; }
      if (g) { toast.error(g.message); return; }
      await notifyOffice('self_download');
      downloadBlob(r.blob, `${dischargeFileBase(f)}.hwpx`);
      toast.success('HWPX를 내려받았어요. 한글에서 열어 서명·날인 칸을 확인하세요.');
    } catch (e: any) {
      toast.error(e?.message || 'HWPX를 만들지 못했어요.');
    } finally { setBusy(null); }
  };

  const doPdf = async () => {
    setTouched(true);
    if (!check.ok) { toast.error(check.blocks[0].message); return; }
    if (!isLoggedIn) { toast.info('PDF는 로그인한 뒤 만들 수 있어요. HWPX는 지금 받을 수 있어요.'); onLogin?.(); return; }
    setBusy('pdf');
    try {
      const r = await renderTextPdf(dischargeHtml(f, rrn, signMethod === 'image' ? signImage : null), { title: '면책신청서', pageNumbers: false });
      if (r.ok === false) { toast.error(r.message); return; }
      const name = `${dischargeFileBase(f)}.pdf`;
      if (mode === 'office' && onSavePdf) {
        if (await onSavePdf(r.bytes, name)) toast.success('면책신청서 PDF를 사건 서류함에 저장했어요.');
        return;
      }
      await notifyOffice('self_download');
      downloadPdfBytes(r.bytes, name);
      toast.success('PDF를 내려받았어요.');
    } finally { setBusy(null); }
  };

  const requestLawyer = async () => {
    setBusy('request');
    const ok = await notifyOffice('request');
    setBusy(null);
    if (ok) { toast.success('담당 변호사에게 면책신청 접수를 요청했어요. 접수 일정은 변호사가 안내해 드려요.'); onClose(); }
  };

  const footer = step < 0 ? null : (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="ghost" onClick={() => (step === 0 && source === 'mykim_lawyer' && mode === 'client' ? setStep(-1) : step > 0 ? setStep(step - 1) : onClose())}>
        {step === 0 && !(source === 'mykim_lawyer' && mode === 'client') ? '닫기' : '이전'}
      </Button>
      {step < 4 ? <Button onClick={next}>다음</Button> : null}
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={mode === 'office' ? '면책신청서 만들기' : '면책신청서 작성하기'}
        description="법원 양식의 신청취지·신청원인은 그대로 두고, 사건번호·인적사항·환급계좌만 넣어요."
        size="lg"
        mobile="fullscreen"
        subHeader={step >= 0 ? <Stepper steps={steps} current={step} className="px-1" /> : undefined}
        footer={footer}
      >
        {step === -1 && (
          <div className="space-y-4">
            <Callout tone="info" title="마이김변 변호사가 맡은 사건이에요">
              면책신청은 보통 담당 변호사가 접수해요. 먼저 변호사에게 접수를 요청해 보세요. 직접 작성해서 내려받으면 담당 변호사에게 알림이 가요(이중 접수 방지).
            </Callout>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button leftIcon={<Send className="w-4 h-4" aria-hidden="true" />} loading={busy === 'request'} onClick={requestLawyer}>변호사에게 접수 요청</Button>
              <Button variant="secondary" onClick={() => setStep(0)}>직접 작성하기</Button>
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            {source === 'external_office' && <Callout tone="warning">다른 사무소가 맡은 사건이면 그 사무소가 면책신청을 접수하는지 먼저 확인하세요.</Callout>}
            <FormField label="관할 법원" required error={errOf('courtName')} hint="예: 서울회생법원, 수원지방법원">
              {p => <input {...p} className={inputClass} value={f.courtName} onChange={e => set('courtName', e.target.value)} />}
            </FormField>
            <FormField label="사건번호" required error={errOf('caseNumber')} hint="예: 2024개회12345">
              {p => <input {...p} className={inputClass} value={f.caseNumber} onChange={e => set('caseNumber', e.target.value)} inputMode="text" autoComplete="off" />}
            </FormField>
            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="mt-1 w-4 h-4" checked={f.repaymentDone} onChange={e => set('repaymentDone', e.target.checked)} />
              <span>변제계획에 따른 변제를 모두 마쳤어요 <span className="block text-xs text-slate-500">법원 변제현황조회로 완납을 확인한 뒤 제출하세요.</span></span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Callout tone="neutral">실명은 이 서류에만 쓰여요. 가명 화면에는 보이지 않아요.</Callout>
            <FormField label="성명 (실명)" required error={errOf('name')}>
              {p => <input {...p} className={inputClass} value={f.name} onChange={e => set('name', e.target.value)} autoComplete="name" />}
            </FormField>
            <FormField label="주민등록번호" required error={errOf('rrn')} hint="저장하지 않아요. 파일을 만들 때만 쓰고, 창을 닫으면 지워져요.">
              {p => <input {...p} className={inputClass} value={rrn} onChange={e => setRrn(e.target.value.replace(/[^0-9-]/g, '').slice(0, 14))} inputMode="numeric" autoComplete="off" placeholder="000000-0000000" />}
            </FormField>
            <FormField label="주소" required error={errOf('address')}>
              {p => <input {...p} className={inputClass} value={f.address} onChange={e => set('address', e.target.value)} autoComplete="street-address" />}
            </FormField>
            <FormField label="전화번호" required error={errOf('phone')}>
              {p => <input {...p} className={inputClass} value={f.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" />}
            </FormField>
            <FormField label="연락 가능한 전화번호" optional hint="비우면 위 전화번호를 써요.">
              {p => <input {...p} className={inputClass} value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} inputMode="tel" />}
            </FormField>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="은행" required error={errOf('bankName')}>
                {p => <input {...p} className={inputClass} value={f.bankName} onChange={e => set('bankName', e.target.value)} placeholder="예: 국민" />}
              </FormField>
              <FormField label="지점" optional>
                {p => <input {...p} className={inputClass} value={f.bankBranch} onChange={e => set('bankBranch', e.target.value)} />}
              </FormField>
            </div>
            <FormField label="계좌번호" required error={errOf('accountNumber')}>
              {p => <input {...p} className={inputClass} value={f.accountNumber} onChange={e => set('accountNumber', e.target.value.replace(/[^0-9-]/g, ''))} inputMode="numeric" />}
            </FormField>
            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="mt-1 w-4 h-4" checked={f.accountIsOwn} onChange={e => set('accountIsOwn', e.target.checked)} />
              <span>채무자 본인 명의 계좌예요 {errOf('accountIsOwn') && <span className="block text-xs font-bold text-red-600">{errOf('accountIsOwn')}</span>}</span>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {mode === 'office' ? (
              <Callout tone="neutral">사무소에서 만드는 서류는 서명 칸을 비워 둬요. 의뢰인 서명·날인을 받은 뒤 제출하세요.</Callout>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="secondary" leftIcon={<PenLine className="w-4 h-4" aria-hidden="true" />} onClick={() => setPadOpen(true)}>새로 서명하기</Button>
                  <Button variant="secondary" leftIcon={<Stamp className="w-4 h-4" aria-hidden="true" />} onClick={() => {
                    if (!f.name.trim()) { toast.error('먼저 신청인 성명을 넣어 주세요.'); return; }
                    keepAsset('seal', 'seal_maker', makeNameSeal(f.name));
                  }}>이름 도장 만들기</Button>
                  <Button variant="secondary" leftIcon={<Upload className="w-4 h-4" aria-hidden="true" />} onClick={() => photoRef.current?.click()}>내 도장 사진 쓰기</Button>
                  <Button variant={signMethod === 'blank' ? 'primary' : 'ghost'} onClick={() => { setSignMethod('blank'); setSignImage(null); }}>비워 두고 출력해서 직접 서명</Button>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try { await keepAsset('seal', 'photo', await cleanSealPhoto(file)); toast.success('도장 바탕을 지웠어요.'); }
                  catch (err: any) { toast.error(err?.message || '도장 사진을 처리하지 못했어요.'); }
                }} />
                {signMethod === 'image' && signImage && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4">
                    <img src={signImage} alt="고른 서명·도장" className="h-20 w-auto object-contain" />
                    <p className="text-sm text-slate-700">이 서명·도장을 면책신청서에 넣어요.</p>
                  </div>
                )}
                {assets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-800">저장해 둔 서명·도장</p>
                    <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {assets.map(a => (
                        <li key={a.id} className="relative rounded-xl border border-slate-200 bg-white p-2">
                          <button type="button" className="w-full h-16 flex items-center justify-center cursor-pointer active:scale-[0.98]" onClick={async () => {
                            const d = await signAssetDataUrl(a);
                            if (d) useImage(d); else toast.error('이미지를 불러오지 못했어요.');
                          }}>
                            {a.url ? <img src={a.url} alt={a.kind === 'seal' ? '도장' : '서명'} className="max-h-14 w-auto object-contain" /> : <FileText className="w-5 h-5 text-slate-400" aria-hidden="true" />}
                          </button>
                          <button type="button" aria-label="지우기" className="absolute top-1 right-1 p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" onClick={async () => {
                            const r = await deleteSignAsset(a);
                            if (r.ok) setAssets(x => x.filter(y => y.id !== a.id)); else toast.error(r.message);
                          }}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!isLoggedIn && <p className="text-xs text-slate-500">로그인하면 만든 서명·도장을 저장해 다음 서류에도 쓸 수 있어요.</p>}
                {errOf('sign') && <p className="text-xs font-bold text-red-600">{errOf('sign')}</p>}
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-sm">
              <p><span className="text-slate-500">사건</span> <strong className="text-lg text-slate-900">{f.caseNumber}</strong> · {f.courtName}</p>
              <p><span className="text-slate-500">신청인</span> <strong className="text-lg text-slate-900">{f.name}</strong></p>
              <p><span className="text-slate-500">주소</span> <strong className="text-slate-900">{f.address}</strong></p>
              <p><span className="text-slate-500">환급계좌</span> {f.bankName} {f.bankBranch} {f.accountNumber}</p>
              <p><span className="text-slate-500">서명·날인</span> {signMethod === 'image' ? '이미지 넣음' : '비워 둠(출력 뒤 직접)'}</p>
            </div>
            {check.warns.map(w => <Callout key={w.message} tone="warning">{w.message}</Callout>)}
            {check.blocks.length > 0 && <Callout tone="danger" title="고칠 곳이 있어요">{check.blocks.map(b => <span key={b.message} className="block">{b.message}</span>)}</Callout>}
            {source === 'mykim_lawyer' && mode === 'client' && <Callout tone="info">담당 변호사가 접수하는 사건이면 먼저 변호사와 상의하세요. 내려받으면 담당 변호사에게 알림이 가요.</Callout>}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button leftIcon={<Download className="w-4 h-4" aria-hidden="true" />} loading={busy === 'pdf'} disabled={!!busy} onClick={doPdf}>
                {mode === 'office' ? 'PDF로 사건 서류함에 저장' : 'PDF 내려받기'}
              </Button>
              <Button variant="secondary" leftIcon={<FileText className="w-4 h-4" aria-hidden="true" />} loading={busy === 'hwpx'} disabled={!!busy} onClick={doHwpx}>HWPX 내려받기</Button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-1">
              <p>· 전자소송: 대법원 전자소송 사이트에서 사건을 찾아 서류 제출 → 내려받은 PDF를 올려요.</p>
              <p>· 방문·우편: 출력해서 관할 법원에 내요. 종이로 낼 때는 출력본에 자필 서명이나 실물 도장을 찍는 것을 권해요(인쇄된 서명 인정 여부는 법원마다 다를 수 있어요).</p>
              <p>· 관할 법원에 따라 추가 서류를 요구할 수 있어요.</p>
              <a className="inline-block text-brand underline min-h-11 py-3" href="/forms/rehab-discharge-application.hwp" download="개인회생_면책신청서_빈양식.hwp">빈 양식만 받기</a>
            </div>
          </div>
        )}
      </Modal>
      <SignaturePadModal open={padOpen} onClose={() => setPadOpen(false)} signerName={f.name || '신청인'} onComplete={(d) => { setPadOpen(false); keepAsset('signature', 'pad', d); }} />
    </>
  );
}
