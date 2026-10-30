// 보정 회차 도구 (CR-3·CR-8·CR-9·CR-11): 원문 파일 읽기 · 수정본 연결 · 전자소송 묶음 · 기간 연장
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, FileSearch, FolderArchive, PencilLine, Printer, Upload } from 'lucide-react';
import type { useDialog } from '../../common/DialogProvider';
import {
  insertCorrectionItems, recordCorrectionExtension, updateCorrectionOrder,
  type CaseExhibit, type CorrectionItem, type CorrectionOrder, type LibraryEntry, type RevisedDoc,
} from '../../../services/corrections/correctionService';
import { readCorrectionSourceFile } from '../../../services/corrections/correctionOcr';
import { ocrItemsToDrafts } from '../../../services/corrections/correctionText';
import { buildCorrectionBundleZip } from '../../../services/corrections/correctionBundle';
import { draftExtensionReason, renderExtensionRequestHtml } from '../../../services/corrections/correctionExtensionDoc';
import { uploadCaseFile } from '../../../services/files/caseFileService';
import { localYmd } from '../../../utils/localDate';

export type EditorTab = 'REPAYMENT_PLAN' | 'CREDITOR_LIST' | 'ASSET_LIST' | 'INCOME_EXPENSE' | 'STATEMENT';
type Dialog = ReturnType<typeof useDialog>;

const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const box = 'bg-white border border-slate-200 rounded-2xl p-3 space-y-2';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function openPrint(html: string) {
  const w = window.open('', '_blank');
  if (!w) { toast.error('팝업이 막혀 있어요. 이 사이트의 팝업을 허용해 주세요.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ── CR-3 원문 파일 읽기 ──
export function OcrReadButton({ order, items, library, editable, dialog, reload }: {
  order: CorrectionOrder; items: CorrectionItem[]; library: LibraryEntry[]; editable: boolean; dialog: Dialog; reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!editable || !order.sourceFileId) return null;
  const run = async () => {
    if (order.ocrStatus === 'done' && order.ocrFileId === order.sourceFileId) {
      const again = await dialog.confirm({ title: '이미 읽은 파일이에요', message: '다시 읽으면 항목이 한 번 더 만들어져요. 그래도 읽을까요?', confirmText: '다시 읽기' });
      if (!again) return;
    }
    setBusy(true);
    const r = await readCorrectionSourceFile(order.sourceFileId!);
    if (r.ok === false) {
      await updateCorrectionOrder(order.id, { ocrStatus: 'failed', ocrFileId: order.sourceFileId });
      setBusy(false);
      toast.error(r.message);
      void reload();
      return;
    }
    const drafts = ocrItemsToDrafts(r.data.items, library, items.length);
    const patch: Parameters<typeof updateCorrectionOrder>[1] = { ocrStatus: 'done', ocrFileId: order.sourceFileId, ocrFound: r.data.found };
    if (!order.sourceText && r.data.transcript) patch.sourceText = r.data.transcript;
    const saved = await updateCorrectionOrder(order.id, patch);
    const ins = drafts.length ? await insertCorrectionItems(order, drafts) : { ok: true as const, data: [] };
    setBusy(false);
    if (saved.ok === false) { toast.error(saved.message); return; }
    if (ins.ok === false) { toast.error(ins.message); return; }
    toast.success(drafts.length
      ? `${drafts.length}개 항목 초안을 만들었어요. 분류와 쉬운 말 제목을 확인한 뒤 의뢰인에게 보내 주세요.`
      : '본문 글만 읽었어요. 항목은 \'원문 번호대로 나누기\'로 나눠 주세요.');
    void reload();
  };
  return (
    <button type="button" disabled={busy} onClick={() => void run()} className={`${btn} border border-indigo-200 text-indigo-700 hover:bg-indigo-50`}>
      <FileSearch className="w-3.5 h-3.5" /> {busy ? '원문 읽는 중…' : '원문 파일 읽기 (초안)'}
    </button>
  );
}

/** 읽은 값과 등록 값이 다르면 알려 준다 (자동 반영 안 함) */
export function OcrFoundNotice({ order, caseNumber }: { order: CorrectionOrder; caseNumber?: string }) {
  const f = order.ocrFound;
  if (order.ocrStatus !== 'done' || (!f.courtName && !f.caseNumber && !f.dueDate)) return null;
  const diffs: string[] = [];
  if (f.dueDate && order.courtDue && f.dueDate !== order.courtDue) diffs.push(`원문 기한 ${f.dueDate} ≠ 계산 기한 ${order.courtDue}`);
  if (f.caseNumber && caseNumber && f.caseNumber.replace(/\s/g, '') !== caseNumber.replace(/\s/g, '')) diffs.push(`원문 사건번호 ${f.caseNumber} ≠ 사건 기록 ${caseNumber}`);
  if (f.courtName && order.courtName && !order.courtName.includes(f.courtName) && !f.courtName.includes(order.courtName)) diffs.push(`원문 법원 ${f.courtName} ≠ 회차 법원 ${order.courtName}`);
  return (
    <div className={`rounded-xl border p-2.5 text-xs ${diffs.length ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`} role={diffs.length ? 'alert' : undefined}>
      <p className="font-bold">원문에서 읽은 값 (참고 — 회차에 자동 반영하지 않아요)</p>
      <p>법원 {f.courtName || '–'} · 사건번호 {f.caseNumber || '–'} · 기한 {f.dueDate || '–'}</p>
      {diffs.map(d => <p key={d} className="font-bold">확인 필요: {d}. 송달일·기간은 원문 기준으로 직접 확인해 주세요.</p>)}
    </div>
  );
}

// ── CR-8 수정본 연결 ──
const REVISION_TARGETS: Array<{ kind: RevisedDoc['kind']; label: string; tab?: EditorTab; match: RegExp }> = [
  { kind: 'plan', label: '변제계획안·변제예정액표', tab: 'REPAYMENT_PLAN', match: /변제계획|가용소득|생계비|변제기간|변제예정/ },
  { kind: 'creditors', label: '채권자목록', tab: 'CREDITOR_LIST', match: /채권자목록|채권현재액|우선채권|장래구상/ },
  { kind: 'property', label: '재산목록', tab: 'ASSET_LIST', match: /재산|보험|해약|보증금|청산가치/ },
  { kind: 'income', label: '수입 및 지출에 관한 목록', tab: 'INCOME_EXPENSE', match: /소득|수입|지출|급여/ },
  { kind: 'statement', label: '진술서', tab: 'STATEMENT', match: /진술서|채무 증대|경위/ },
];

export function RevisedDocsSection({ order, items, officeId, caseKey, editable, onOpenEditor, reload }: {
  order: CorrectionOrder; items: CorrectionItem[]; officeId: string; caseKey: string; editable: boolean;
  onOpenEditor?: (tab: EditorTab) => void; reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const text = items.map(i => `${i.category || ''} ${i.originalText || ''}`).join(' ');
  const suggested = REVISION_TARGETS.filter(t => t.match.test(text) || order.revisedDocs.some(d => d.kind === t.kind));
  const docOf = (kind: RevisedDoc['kind']) => order.revisedDocs.find(d => d.kind === kind);
  const needsFeeCheck = /보수|예납/.test(text);
  const needsChildCheck = /양육비|10항/.test(text);

  const saveDocs = async (next: RevisedDoc[]) => {
    const r = await updateCorrectionOrder(order.id, { revisedDocs: next });
    if (r.ok === false) { toast.error(r.message); return false; }
    void reload();
    return true;
  };
  const upload = async (kind: RevisedDoc['kind'], label: string, file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('파일당 20MB까지 올릴 수 있어요.'); return; }
    setBusy(kind);
    const up = await uploadCaseFile({
      source: 'office', clientKey: caseKey, officeId,
      file: { id: '', name: file.name, category: 'correction', uploadedAt: new Date().toISOString(), uploadedBy: '사무소', dataUrl: await readAsDataUrl(file), mimeType: file.type } as any,
    });
    if (!up.ok || !up.file) { setBusy(null); toast.error(up.message || '수정본을 올리지 못했어요.'); return; }
    const next = [...order.revisedDocs.filter(d => d.kind !== kind), { kind, label, fileId: up.file.id, at: new Date().toISOString() }];
    const ok = await saveDocs(next);
    setBusy(null);
    if (ok) toast.success(`${label} 수정본을 이 회차에 연결했어요.`);
  };
  const markUnchanged = async (kind: RevisedDoc['kind'], label: string, unchanged: boolean) => {
    const next = unchanged
      ? [...order.revisedDocs.filter(d => d.kind !== kind), { kind, label, unchanged: true, at: new Date().toISOString() }]
      : order.revisedDocs.filter(d => d.kind !== kind);
    await saveDocs(next);
  };
  const setCheck = async (key: string, done: boolean) => {
    const r = await updateCorrectionOrder(order.id, { checks: { ...order.checks, [key]: { done, at: new Date().toISOString() } } });
    if (r.ok === false) toast.error(r.message); else void reload();
  };

  if (suggested.length === 0 && !needsFeeCheck && !needsChildCheck) return null;
  return (
    <div className={box}>
      <p className="text-xs font-black text-slate-800 flex items-center gap-1.5"><PencilLine className="w-3.5 h-3.5" /> 고쳐 낼 목록</p>
      <p className="text-xs text-slate-500">항목 내용으로 보아 고쳐야 할 수 있는 목록이에요. 편집기에서 고친 뒤 PDF를 이 회차에 올리면 묶음에 들어가요.</p>
      <ul className="space-y-1.5">
        {suggested.map(t => {
          const d = docOf(t.kind);
          return (
            <li key={t.kind} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-800 min-w-[9rem]">{t.label}</span>
              <span className={d?.fileId ? 'text-emerald-700 font-bold' : d?.unchanged ? 'text-slate-500' : 'text-amber-700'}>
                {d?.fileId ? '수정본 연결됨' : d?.unchanged ? '바뀌지 않음' : '수정본 없음'}
              </span>
              {t.tab && onOpenEditor && <button type="button" onClick={() => onOpenEditor(t.tab!)} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>편집기 열기</button>}
              {editable && (
                <label className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
                  <Upload className="w-3.5 h-3.5" /> {busy === t.kind ? '올리는 중…' : '수정본 올리기'}
                  <input type="file" accept="application/pdf" className="sr-only" disabled={!!busy}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(t.kind, t.label, f); }} />
                </label>
              )}
              {editable && !d?.fileId && (
                <label className="inline-flex items-center gap-1 min-h-[44px]">
                  <input type="checkbox" checked={!!d?.unchanged} onChange={e => void markUnchanged(t.kind, t.label, e.target.checked)} /> 바뀌지 않음(다시 내지 않음)
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {(needsFeeCheck || needsChildCheck) && (
        <div className="pt-1 border-t border-slate-100 space-y-1 text-xs text-slate-700">
          {needsFeeCheck && (
            <label className="flex items-start gap-1.5 min-h-[44px]">
              <input type="checkbox" className="mt-1" disabled={!editable} checked={!!order.checks.trustee_fee?.done} onChange={e => void setCheck('trustee_fee', e.target.checked)} />
              회생위원 보수 확인: 인가 전 금액(예납)과 인가 후 비율(임치액의 %)을 변제계획안·안내문에 맞게 반영했어요.
            </label>
          )}
          {needsChildCheck && (
            <label className="flex items-start gap-1.5 min-h-[44px]">
              <input type="checkbox" className="mt-1" disabled={!editable} checked={!!order.checks.child_support?.done} onChange={e => void setCheck('child_support', e.target.checked)} />
              양육비 조항 확인: 변제계획안 10항(기타 사항)의 양육비 관련 문구를 법원 요구대로 고쳤어요.
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ── CR-9 전자소송 묶음 ──
export function BundleButton({ order, items, exhibits, disabled }: { order: CorrectionOrder; items: CorrectionItem[]; exhibits: CaseExhibit[]; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await buildCorrectionBundleZip(order, items, exhibits);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    if (r.warnings.length) toast.warning(`${r.count}개 파일을 묶었어요. 확인할 점 ${r.warnings.length}개는 묶음 안 '첨부목록'에 적어 뒀어요.`);
    else toast.success(`${r.count}개 파일을 전자소송 순서대로 묶었어요.`);
  };
  return (
    <button type="button" disabled={busy || disabled} onClick={() => void run()} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
      <FolderArchive className="w-3.5 h-3.5" /> {busy ? '묶는 중…' : '전자소송 묶음 내려받기'}
    </button>
  );
}

/** 사무소가 PDF로 저장한 최종 보정서를 회차에 연결 (묶음 1번 파일) */
export function BriefFileUpload({ order, officeId, caseKey, editable, reload }: { order: CorrectionOrder; officeId: string; caseKey: string; editable: boolean; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  if (!editable) return null;
  const upload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('보정서는 PDF로 올려 주세요.'); return; }
    setBusy(true);
    const up = await uploadCaseFile({
      source: 'office', clientKey: caseKey, officeId,
      file: { id: '', name: file.name, category: 'correction', uploadedAt: new Date().toISOString(), uploadedBy: '사무소', dataUrl: await readAsDataUrl(file), mimeType: file.type } as any,
    });
    if (!up.ok || !up.file) { setBusy(false); toast.error(up.message || '보정서를 올리지 못했어요.'); return; }
    const r = await updateCorrectionOrder(order.id, { briefFileId: up.file.id });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('보정서 PDF를 이 회차에 연결했어요.');
    void reload();
  };
  return (
    <label className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
      <Upload className="w-3.5 h-3.5" /> {busy ? '올리는 중…' : order.briefFileId ? '보정서 PDF 바꾸기' : '보정서 PDF 올리기'}
      <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
    </label>
  );
}

// ── CR-11 기간 연장 ──
export function ExtensionSection({ order, items, editable, dialog, reload, header }: {
  order: CorrectionOrder; items: CorrectionItem[]; editable: boolean; dialog: Dialog; reload: () => Promise<void>;
  header: { caseNumber?: string; applicantName?: string; courtName?: string; lawyerName?: string; officeName?: string };
}) {
  const [days, setDays] = useState(String(order.extensionDays || 30));
  const [reason, setReason] = useState(order.extensionNote || draftExtensionReason(items));
  const [open, setOpen] = useState(order.status === 'extension');
  const [busy, setBusy] = useState(false);
  if (order.status === 'submitted' && !order.extensionRequestedOn) return null;

  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 90;
  const print = () => {
    if (!valid) { toast.error('연장 일수는 1~90일로 적어 주세요.'); return; }
    openPrint(renderExtensionRequestHtml({ order, days: n, reason, ...header, courtName: order.courtName || header.courtName, date: localYmd() }));
  };
  const request = async () => {
    if (!valid) { toast.error('연장 일수는 1~90일로 적어 주세요.'); return; }
    if (!reason.trim()) { toast.error('신청 사유를 적어 주세요.'); return; }
    const on = await dialog.prompt({ title: '연장 신청 기록', message: '법원에 연장 신청서를 낸 날짜(YYYY-MM-DD)를 입력하세요.', defaultValue: localYmd() });
    if (!on) return;
    setBusy(true);
    const r = await recordCorrectionExtension(order.id, 'request', { days: n, note: reason, requestedOn: on });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('연장 신청을 기록했어요. 결정이 나면 결과를 기록해 주세요.');
    void reload();
  };
  const decide = async (granted: boolean) => {
    let newDue: string | null = null;
    if (granted) {
      newDue = await dialog.prompt({ title: '연장 허가', message: '법원이 정한 새 보정기한(YYYY-MM-DD)을 입력하세요. 사무소 마감은 새 기한으로 다시 계산돼요.' });
      if (!newDue) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDue)) { toast.error('날짜는 2026-11-30처럼 입력해 주세요.'); return; }
    } else {
      const ok = await dialog.confirm({ title: '연장 불허 기록', message: '기한은 그대로예요. 남은 자료는 기한 안에 내거나 못 낸 사유를 보정서에 적어야 해요.', confirmText: '불허 기록' });
      if (!ok) return;
    }
    setBusy(true);
    const r = await recordCorrectionExtension(order.id, granted ? 'granted' : 'denied', { newDue: newDue || undefined });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(granted ? `새 기한 ${r.data.courtDue}, 사무소 마감 ${r.data.officeDue}로 바꿨어요.` : '불허를 기록했어요.');
    void reload();
  };

  return (
    <div className={box}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full min-h-[44px] flex items-center justify-between text-left">
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> 보정기간 연장</span>
        <span className="text-xs text-slate-500">
          {order.status === 'extension' ? `신청함 (${order.extensionRequestedOn}, ${order.extensionDays}일) · 결정 대기`
            : order.extensionDecision === 'granted' ? `허가 · 원래 기한 ${order.originalCourtDue}`
            : order.extensionDecision === 'denied' ? '불허' : '보정기간은 사유가 있으면 연장을 신청할 수 있어요'}
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          {order.status !== 'extension' && editable && (
            <>
              <label className="block text-xs font-bold text-slate-700 space-y-1">연장 일수 (사무소가 정함)
                <input type="number" min={1} max={90} value={days} onChange={e => setDays(e.target.value)} className="w-32 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm" />
                {!valid && <span className="block text-rose-600 font-medium">1~90일로 적어 주세요.</span>}
              </label>
              <label className="block text-xs font-bold text-slate-700 space-y-1">신청 사유 (의뢰인이 알린 '낼 수 없음' 사유를 불러왔어요 — 변호사가 고쳐 확정)
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReason(draftExtensionReason(items))} className={`${btn} border border-slate-200 text-slate-600`}>사유 다시 불러오기</button>
                <button type="button" onClick={print} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><Printer className="w-3.5 h-3.5" /> 연장 신청서 인쇄</button>
                <button type="button" disabled={busy} onClick={() => void request()} className={`${btn} bg-[#1E3A5F] text-white`}>신청 기록</button>
              </div>
            </>
          )}
          {order.status === 'extension' && editable && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={print} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><Printer className="w-3.5 h-3.5" /> 연장 신청서 다시 인쇄</button>
              <button type="button" disabled={busy} onClick={() => void decide(true)} className={`${btn} bg-emerald-600 text-white`}>허가 (새 기한 입력)</button>
              <button type="button" disabled={busy} onClick={() => void decide(false)} className={`${btn} border border-rose-200 text-rose-700`}>불허</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
