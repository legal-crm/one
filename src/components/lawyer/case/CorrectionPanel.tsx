import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Printer, RefreshCw, Scissors, Send, Trash2, Upload } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import {
  CANNOT_REASON_LABEL, CORRECTIONS_CHANGED_EVENT, ITEM_STATUS_LABEL, KIND_LABEL, ORDER_STATUS_LABEL,
  createCorrectionOrder, deleteCorrectionItem, deleteCorrectionOrder, insertCorrectionItems, loadCaseCorrections, loadCaseFilesByIds,
  loadCorrectionLibrary, requestCorrectionItems, reviewCorrectionItem, submitCorrectionOrder, updateCorrectionItem, updateCorrectionOrder,
  type CaseExhibit, type CorrectionItem, type CorrectionKind, type CorrectionOrder, type ItemOwner, type LibraryEntry, type TableType,
} from '../../../services/corrections/correctionService';
import { detectPhotoCount, splitCorrectionText, suggestFromLibrary } from '../../../services/corrections/correctionText';
import { CORRECTION_TABLES, TABLE_OPTIONS, cleanRows, formatMoneyCell } from '../../../services/corrections/correctionTables';
import { buildCorrectionBrief, renderCorrectionBriefHtml } from '../../../services/corrections/correctionBrief';
import { getCaseFileUrl, uploadCaseFile } from '../../../services/files/caseFileService';
import { localYmd } from '../../../utils/localDate';
import type { CourtEvent } from '../../../types';
import { BriefFileUpload, BundleButton, ExtensionSection, OcrFoundNotice, OcrReadButton, RevisedDocsSection, type EditorTab } from './CorrectionOrderTools';
import { CorrectionStatsCard, CourtCorrectionHint, PrecedentTools, T2ImportButton, usePrecedents } from './CorrectionExtras';
import type { CorrectionPrecedent } from '../../../services/corrections/correctionService';

/**
 * 보정 대응 (CR, 서버 기록): 회차 등록 → 원문 나누기 → 의뢰인 요청 → 받기·검토 → 요약보정서 → 제출 기록.
 * 의뢰인 답은 자료로만 받고, 보정서 문장은 변호사가 확정한다(CR-Q2). 분류는 초안이며 확인 전에는 의뢰인에게 나가지 않는다.
 */
interface Props {
  officeId: string;
  caseKey: string;
  caseNumber?: string;
  applicantName?: string;
  courtName?: string;
  lawyerName?: string;
  officeName?: string;
  canManage: boolean;
  canFinalize: boolean;
  /** 사건 조회 기록 (보정 감지 안내, CR-11) */
  courtEvents?: CourtEvent[];
  /** 고쳐 낼 목록 편집기 열기 (CR-8) */
  onOpenEditor?: (tab: EditorTab) => void;
}

const OWNER_LABEL: Record<ItemOwner, string> = { client: '의뢰인', office: '사무소', both: '함께' };
const daysLeft = (ymd?: string) => (ymd ? Math.round((new Date(`${ymd}T00:00:00`).getTime() - new Date(`${localYmd()}T00:00:00`).getTime()) / 86400000) : null);
const ddayText = (ymd?: string) => { const d = daysLeft(ymd); return d === null ? '' : d === 0 ? 'D-day' : d > 0 ? `D-${d}` : `${-d}일 지남`; };
const inputCls = 'w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm bg-white';
const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function CorrectionPanel(props: Props) {
  const { officeId, caseKey, canManage, canFinalize } = props;
  const dialog = useDialog();
  const [orders, setOrders] = useState<CorrectionOrder[] | null>(null);
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [exhibits, setExhibits] = useState<CaseExhibit[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const precedents = usePrecedents(officeId);

  const load = useCallback(async () => {
    const r = await loadCaseCorrections(officeId, caseKey);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setOrders(r.data.orders);
    setItems(r.data.items);
    setExhibits(r.data.exhibits);
    setActiveId(prev => (prev && r.data.orders.some(o => o.id === prev)) ? prev : r.data.orders[0]?.id || null);
  }, [officeId, caseKey]);

  useEffect(() => { void load(); void loadCorrectionLibrary().then(setLibrary); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CORRECTIONS_CHANGED_EVENT, h);
    return () => window.removeEventListener(CORRECTIONS_CHANGED_EVENT, h);
  }, [load]);

  const active = orders?.find(o => o.id === activeId) || null;
  const activeItems = useMemo(() => items.filter(i => i.orderId === activeId).sort((a, b) => a.seq - b.seq), [items, activeId]);
  const locked = active?.status === 'submitted';

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
        <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" aria-hidden="true" />
        <p className="text-sm text-rose-900 flex-1">{error}</p>
        <button type="button" onClick={() => void load()} className={`${btn} bg-white border border-rose-200 text-rose-800`}>다시 불러오기</button>
      </div>
    );
  }
  if (orders === null) {
    return <div className="space-y-2" aria-busy="true"><div className="h-14 rounded-2xl bg-slate-100 animate-pulse" /><div className="h-40 rounded-2xl bg-slate-100 animate-pulse" /></div>;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm" aria-labelledby="correction-panel-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="correction-panel-title" className="text-base font-black text-slate-900">보정 대응 (서버 기록)</h3>
          <p className="text-xs text-slate-500">회차 등록 → 원문 나누기 → 의뢰인 요청 → 검토 → 요약보정서 → 제출 기록</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`} aria-label="새로 고침"><RefreshCw className="w-3.5 h-3.5" /></button>
          {canManage && <button type="button" onClick={() => setShowNew(v => !v)} className={`${btn} bg-[#1E3A5F] text-white hover:bg-slate-800`}>새 회차 등록</button>}
        </div>
      </div>

      {!showNew && <CourtCorrectionHint events={props.courtEvents} orders={orders} canManage={canManage} onRegister={() => setShowNew(true)} />}

      {showNew && canManage && (
        <NewOrderForm officeId={officeId} caseKey={caseKey} defaultCourt={props.courtName}
          onDone={(o) => { setShowNew(false); setActiveId(o.id); void load(); }} onCancel={() => setShowNew(false)} />
      )}

      {orders.length === 0 && !showNew ? (
        <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">등록된 보정 회차가 없어요</p>
          <p className="text-xs text-slate-500">법원 보정권고·보정명령을 받으면 '새 회차 등록'에서 송달일과 기간을 넣어 주세요. 기한과 사무소 마감은 자동으로 계산돼요.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="보정 회차">
          {orders.map(o => (
            <button key={o.id} type="button" role="tab" aria-selected={o.id === activeId} onClick={() => setActiveId(o.id)}
              className={`${btn} border ${o.id === activeId ? 'bg-[#1E3A5F]/5 border-[#1E3A5F]/40 text-[#1E3A5F]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {o.round}차 {KIND_LABEL[o.kind]} · {ORDER_STATUS_LABEL[o.status]}
              {o.status !== 'submitted' && o.officeDue && <span className={(daysLeft(o.officeDue) ?? 99) <= 3 ? 'text-rose-600' : 'text-slate-500'}>· 마감 {ddayText(o.officeDue)}</span>}
            </button>
          ))}
        </div>
      )}

      {active && (
        <OrderDetail
          {...props}
          order={active}
          items={activeItems}
          exhibits={exhibits}
          library={library}
          locked={locked}
          busy={busy}
          setBusy={setBusy}
          reload={load}
          dialog={dialog}
          precedents={precedents.list}
          reloadPrecedents={precedents.reload}
        />
      )}

      {canManage && <CorrectionStatsCard officeId={officeId} />}
    </section>
  );
}

function NewOrderForm({ officeId, caseKey, defaultCourt, onDone, onCancel }: { officeId: string; caseKey: string; defaultCourt?: string; onDone: (o: CorrectionOrder) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<CorrectionKind>('recommendation');
  const [issuer, setIssuer] = useState<'court' | 'commissioner'>('commissioner');
  const [courtName, setCourtName] = useState(defaultCourt || '');
  const [servedOn, setServedOn] = useState('');
  const [periodKind, setPeriodKind] = useState<'days' | 'fixed'>('days');
  const [periodDays, setPeriodDays] = useState('14');
  const [fixedDue, setFixedDue] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async () => {
    if (!servedOn) { setFieldError('송달일을 입력해 주세요. 기한은 송달 다음 날부터 셉니다.'); return; }
    if (periodKind === 'days' && !(Number(periodDays) >= 1)) { setFieldError('기간(일)을 입력해 주세요.'); return; }
    if (periodKind === 'fixed' && !fixedDue) { setFieldError('제출 기한 날짜를 입력해 주세요.'); return; }
    setFieldError(null);
    setBusy(true);
    let sourceFileId: string | undefined;
    if (file) {
      const up = await uploadCaseFile({
        source: 'office', clientKey: caseKey, officeId,
        file: { id: '', name: file.name, category: 'correction_source', uploadedAt: new Date().toISOString(), uploadedBy: '사무소', dataUrl: await readFileAsDataUrl(file), mimeType: file.type } as any,
      });
      if (!up.ok || !up.file) { setBusy(false); toast.error(up.message || '원문 파일을 올리지 못했어요.'); return; }
      sourceFileId = up.file.id;
    }
    const r = await createCorrectionOrder(officeId, caseKey, {
      kind, issuer, courtName: courtName.trim() || undefined, servedOn, periodKind,
      periodDays: periodKind === 'days' ? Number(periodDays) : undefined, fixedDue: periodKind === 'fixed' ? fixedDue : undefined,
      sourceFileId, sourceText: sourceText.trim() || undefined,
    });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`${r.data.round}차 회차를 등록했어요 · 법원 기한 ${r.data.courtDue} · 사무소 마감 ${r.data.officeDue}`);
    onDone(r.data);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1 text-xs font-bold text-slate-700">종류
          <select value={kind} onChange={e => setKind(e.target.value as CorrectionKind)} className={inputCls}>
            {(Object.keys(KIND_LABEL) as CorrectionKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold text-slate-700">보낸 곳
          <select value={issuer} onChange={e => setIssuer(e.target.value as any)} className={inputCls}>
            <option value="commissioner">회생위원</option><option value="court">재판부</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold text-slate-700">법원
          <input value={courtName} onChange={e => setCourtName(e.target.value)} className={inputCls} placeholder="예: 의정부지방법원" />
        </label>
        <label className="space-y-1 text-xs font-bold text-slate-700">송달일 (필수)
          <input type="date" value={servedOn} max={localYmd()} onChange={e => setServedOn(e.target.value)} className={inputCls} />
        </label>
        <fieldset className="space-y-1 text-xs font-bold text-slate-700 sm:col-span-2">
          <legend>기한</legend>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 min-h-[44px]"><input type="radio" checked={periodKind === 'days'} onChange={() => setPeriodKind('days')} /> 송달받은 날부터</label>
            <input type="number" min={1} max={180} value={periodDays} disabled={periodKind !== 'days'} onChange={e => setPeriodDays(e.target.value)} className="w-20 min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm" aria-label="기간(일)" /> 일
            <label className="flex items-center gap-1.5 min-h-[44px] ml-3"><input type="radio" checked={periodKind === 'fixed'} onChange={() => setPeriodKind('fixed')} /> 날짜 지정</label>
            <input type="date" value={fixedDue} disabled={periodKind !== 'fixed'} onChange={e => setFixedDue(e.target.value)} className="min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm" aria-label="제출 기한 날짜" />
          </div>
        </fieldset>
      </div>
      <label className="block space-y-1 text-xs font-bold text-slate-700">원문 파일 (PDF·사진, 선택)
        <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="block text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-bold text-slate-700">원문 글 (복사해 붙여 넣으면 번호대로 항목을 나눠요)
        <textarea value={sourceText} onChange={e => setSourceText(e.target.value)} rows={6} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <p className="text-xs text-slate-500">보정기간은 불변기간이 아니라 사유가 있으면 연장을 신청할 수 있어요. 사무소 마감은 법원 기한 5영업일 전(기간 10일 이하면 2영업일 전)으로 잡히고 회차에서 바꿀 수 있어요.</p>
      {fieldError && <p className="text-xs font-bold text-rose-700" role="alert">{fieldError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={`${btn} border border-slate-200 text-slate-700`}>닫기</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className={`${btn} bg-[#1E3A5F] text-white`}>{busy ? '등록 중…' : '회차 등록'}</button>
      </div>
    </div>
  );
}

type DetailProps = Props & {
  order: CorrectionOrder; items: CorrectionItem[]; exhibits: CaseExhibit[]; library: LibraryEntry[]; locked: boolean;
  busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void>; dialog: ReturnType<typeof useDialog>;
  precedents: CorrectionPrecedent[] | null; reloadPrecedents: () => Promise<void>;
};

function OrderDetail(p: DetailProps) {
  const { order, items, library, locked, canManage, canFinalize, reload, dialog, setBusy, busy } = p;
  const [openId, setOpenId] = useState<string | null>(null);
  const editable = canManage && !locked;
  const draftClientCount = items.filter(i => i.status === 'draft' && i.owner !== 'office' && i.clientTitle).length;

  const saveOrder = async (patch: Parameters<typeof updateCorrectionOrder>[1]) => {
    const r = await updateCorrectionOrder(order.id, patch);
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };

  const split = async () => {
    const text = order.sourceText?.trim() || (await dialog.prompt({ title: '원문 붙여 넣기', message: '보정권고 원문 글을 붙여 넣으세요. 번호(1. 가. ①) 단위로 나눕니다.' })) || '';
    if (!text.trim()) return;
    const parts = splitCorrectionText(text);
    if (parts.length === 0) { toast.info('나눌 내용이 없어요.'); return; }
    const start = items.length;
    const drafts = parts.map((pt, idx) => {
      const s = suggestFromLibrary(pt.text, library);
      return {
        seq: start + idx + 1, label: pt.label, originalText: pt.text, category: s.category, libraryId: s.libraryId, owner: s.owner,
        clientTitle: s.owner === 'office' ? undefined : s.clientTitle, clientGuide: s.clientGuide, neededDocs: s.neededDocs,
        tableType: s.tableType, questions: s.questions, answerText: s.answerText, photoCount: detectPhotoCount(pt.text),
      };
    });
    setBusy(true);
    if (!order.sourceText && text) await updateCorrectionOrder(order.id, { sourceText: text.slice(0, 60000) });
    const r = await insertCorrectionItems(order, drafts);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`${r.data.length}개 항목으로 나눴어요. 분류는 초안이에요 — 의뢰인에게 보내기 전에 확인해 주세요.`);
    void reload();
  };

  const addItem = async () => {
    const r = await insertCorrectionItems(order, [{ seq: items.length + 1, label: String(items.length + 1), owner: 'office' }]);
    if (r.ok === false) { toast.error(r.message); return; }
    setOpenId(r.data[0]?.id || null);
    void reload();
  };

  const requestClient = async () => {
    const ok = await dialog.confirm({
      title: '의뢰인에게 요청할까요?',
      message: `담당이 '의뢰인·함께'이고 쉬운 말 제목이 있는 항목 ${draftClientCount}개를 의뢰인 '내 사건 › 보정 할 일'로 보내고 알림을 보냅니다. 보낸 뒤에는 의뢰인이 그 항목을 볼 수 있어요.`,
      confirmText: '요청 보내기',
    });
    if (!ok) return;
    setBusy(true);
    const r = await requestCorrectionItems(order.id);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`항목 ${r.data}개를 의뢰인에게 요청했어요.`);
    void reload();
  };

  const printBrief = () => {
    const model = buildCorrectionBrief(order, items, p.exhibits, {
      caseNumber: p.caseNumber, applicantName: p.applicantName, courtName: order.courtName || p.courtName,
      lawyerName: p.lawyerName, officeName: p.officeName, date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
    if (model.warnings.length > 0) toast.warning(`확인할 점 ${model.warnings.length}개: ${model.warnings.slice(0, 3).join(' / ')}`);
    const w = window.open('', '_blank');
    if (!w) { toast.error('팝업이 막혀 있어요. 이 사이트의 팝업을 허용해 주세요.'); return; }
    w.document.open();
    w.document.write(renderCorrectionBriefHtml(model));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const submit = async () => {
    const date = await dialog.prompt({ title: '법원 제출 기록', message: '전자소송으로 제출한 날짜(YYYY-MM-DD)를 입력하세요. 기록하면 이 회차는 잠기고 의뢰인에게 제출 안내가 갑니다.', defaultValue: localYmd() });
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error('날짜는 2026-10-30처럼 입력해 주세요.'); return; }
    setBusy(true);
    const r = await submitCorrectionOrder(order.id, date);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('제출을 기록했어요. 의뢰인에게 제출 안내가 갔어요.');
    void reload();
  };

  const removeOrder = async () => {
    const ok = await dialog.confirm({ title: `${order.round}차 회차를 지울까요?`, message: '항목과 의뢰인 답이 함께 지워집니다. 제출한 회차는 지울 수 없어요.', variant: 'danger', confirmText: '지우기' });
    if (!ok) return;
    const r = await deleteCorrectionOrder(order.id);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('회차를 지웠어요.');
    void reload();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <Info label="송달일" value={order.servedOn} />
        <Info label="법원 기한" value={`${order.courtDue || '–'} ${order.status !== 'submitted' ? ddayText(order.courtDue) : ''}`} />
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
          <p className="text-slate-500 font-bold">사무소 마감 {order.officeDueManual ? '(직접 정함)' : '(자동)'}</p>
          {editable ? (
            <input type="date" value={order.officeDue || ''} max={order.courtDue} onChange={e => void saveOrder({ officeDue: e.target.value, officeDueManual: !!e.target.value })}
              className="w-full min-h-[36px] rounded-lg border border-slate-200 px-2 text-sm" aria-label="사무소 마감" />
          ) : <p className="text-sm font-bold text-slate-900">{order.officeDue || '–'}</p>}
        </div>
        <Info label="상태" value={order.status === 'submitted' ? `제출 완료 (${order.submittedOn})` : ORDER_STATUS_LABEL[order.status]} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
        <label className="flex items-center gap-1.5 min-h-[44px]">
          <input type="checkbox" checked={order.clientCanViewSource} disabled={!canManage} onChange={e => void saveOrder({ clientCanViewSource: e.target.checked })} />
          의뢰인에게 법원 원문 보여 주기
        </label>
        <label className="flex items-center gap-1.5 min-h-[44px]">
          <input type="checkbox" checked={order.clientCanViewBrief} disabled={!canManage} onChange={e => void saveOrder({ clientCanViewBrief: e.target.checked })} />
          제출한 보정서 사본 공개 (제출 뒤)
        </label>
        {order.sourceFileId && <SourceFileLink fileId={order.sourceFileId} label="원문 파일 열기" />}
        {order.briefFileId && <SourceFileLink fileId={order.briefFileId} label="보정서 PDF 열기" />}
      </div>

      <OcrFoundNotice order={order} caseNumber={p.caseNumber} />

      <div className="flex flex-wrap gap-2">
        <OcrReadButton order={order} items={items} library={library} editable={editable} dialog={dialog} reload={reload} />
        {editable && <button type="button" disabled={busy} onClick={() => void split()} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><Scissors className="w-3.5 h-3.5" /> 원문 번호대로 나누기</button>}
        {editable && <button type="button" disabled={busy} onClick={() => void addItem()} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>항목 추가</button>}
        {editable && <button type="button" disabled={busy || draftClientCount === 0} onClick={() => void requestClient()} className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}><Send className="w-3.5 h-3.5" /> 의뢰인에게 요청 ({draftClientCount})</button>}
        <button type="button" onClick={printBrief} disabled={items.length === 0} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}><Printer className="w-3.5 h-3.5" /> 요약보정서 미리보기·인쇄</button>
        <BriefFileUpload order={order} officeId={p.officeId} caseKey={p.caseKey} editable={editable} reload={reload} />
        <BundleButton order={order} items={items} exhibits={p.exhibits} disabled={items.length === 0 && !order.briefFileId} />
        {canFinalize && !locked && <button type="button" disabled={busy} onClick={() => void submit()} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}>법원 제출 기록</button>}
        {canFinalize && !locked && <button type="button" disabled={busy} onClick={() => void removeOrder()} className={`${btn} border border-rose-200 text-rose-700 hover:bg-rose-50`}><Trash2 className="w-3.5 h-3.5" /> 회차 지우기</button>}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4">항목이 없어요. 원문 파일을 읽거나, 원문을 번호대로 나누거나, 항목을 직접 추가하세요.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {items.map(it => (
            <ItemRow key={it.id} item={it} open={openId === it.id} onToggle={() => setOpenId(v => (v === it.id ? null : it.id))}
              library={library} editable={editable} reload={reload} dialog={dialog}
              precedents={p.precedents} reloadPrecedents={p.reloadPrecedents} canFinalize={canFinalize}
              maskTerms={[p.applicantName || ''].filter(Boolean)} />
          ))}
        </ul>
      )}

      <RevisedDocsSection order={order} items={items} officeId={p.officeId} caseKey={p.caseKey} editable={editable} onOpenEditor={p.onOpenEditor} reload={reload} />
      <ExtensionSection order={order} items={items} editable={canManage && !locked} dialog={dialog} reload={reload}
        header={{ caseNumber: p.caseNumber, applicantName: p.applicantName, courtName: p.courtName, lawyerName: p.lawyerName, officeName: p.officeName }} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
      <p className="text-slate-500 font-bold">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function SourceFileLink({ fileId, label }: { fileId: string; label: string }) {
  const open = async () => {
    const [f] = await loadCaseFilesByIds([fileId]);
    if (!f) { toast.error('파일을 찾지 못했어요.'); return; }
    const url = await getCaseFileUrl({ storagePath: f.storagePath });
    if (!url) { toast.error('파일을 열지 못했어요.'); return; }
    window.open(url, '_blank', 'noopener');
  };
  return <button type="button" onClick={() => void open()} className="min-h-[44px] text-xs font-bold text-blue-700 underline underline-offset-2 cursor-pointer">{label}</button>;
}

function ItemRow({ item, open, onToggle, library, editable, reload, dialog, precedents, reloadPrecedents, canFinalize, maskTerms }: {
  item: CorrectionItem; open: boolean; onToggle: () => void; library: LibraryEntry[]; editable: boolean;
  reload: () => Promise<void>; dialog: ReturnType<typeof useDialog>;
  precedents: CorrectionPrecedent[] | null; reloadPrecedents: () => Promise<void>; canFinalize: boolean; maskTerms: string[];
}) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(item); }, [item]);
  const clientSide = !['draft', 'office_done'].includes(item.status);
  const canEditSetup = editable && item.status === 'draft';

  const save = async () => {
    setSaving(true);
    const r = await updateCorrectionItem(item.id, {
      label: draft.label, category: draft.category, owner: draft.owner, clientTitle: draft.clientTitle, clientGuide: draft.clientGuide,
      neededDocs: draft.neededDocs, tableType: draft.tableType, questions: draft.questions, answerText: draft.answerText,
      photoCount: draft.photoCount, libraryId: draft.libraryId,
    });
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('항목을 저장했어요.');
    void reload();
  };

  const applyLibrary = (id: string) => {
    const e = library.find(x => x.id === id);
    if (!e) return;
    setDraft(d => ({
      ...d, libraryId: e.id, category: e.category, owner: e.owner, clientTitle: e.owner === 'office' ? d.clientTitle : e.clientTitle,
      clientGuide: e.clientGuide, neededDocs: e.neededDocs, tableType: e.tableType, questions: e.questions, answerText: d.answerText || e.answerTemplate,
    }));
  };

  const review = async (action: 'confirm' | 'needs_fix' | 'office_done' | 'reopen') => {
    let reason: string | undefined;
    if (action === 'needs_fix') {
      const v = await dialog.prompt({ title: '보완 요청', message: '의뢰인에게 보일 사유를 적어 주세요. (예: 해약환급금 증명서가 빠졌어요)' });
      if (!v || !v.trim()) return;
      reason = v;
    }
    const r = await reviewCorrectionItem(item.id, action, reason, item.clientTitle || item.category);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(action === 'confirm' ? `확인 완료${r.data.exhibitNumbers.length ? ` · 소갑 제${r.data.exhibitNumbers[0]}호증` : ''}` : action === 'needs_fix' ? '보완 요청을 보냈어요.' : '저장했어요.');
    void reload();
  };

  const remove = async () => {
    const ok = await dialog.confirm({ title: '항목을 지울까요?', message: '정리 중인 항목만 지울 수 있어요.', variant: 'danger', confirmText: '지우기' });
    if (!ok) return;
    const r = await deleteCorrectionItem(item.id);
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };

  const statusTone = item.status === 'confirmed' || item.status === 'office_done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : item.status === 'submitted' || item.status === 'cannot_submit' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : item.status === 'needs_fix' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <li className="bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full min-h-[44px] px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50 cursor-pointer">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className="text-xs font-black text-slate-500 w-12 shrink-0">{item.label || item.seq}</span>
        <span className="text-sm font-bold text-slate-800 flex-1 truncate">{item.clientTitle || item.category || item.originalText?.slice(0, 40) || '(제목 없음)'}</span>
        <span className="text-xs text-slate-500 shrink-0">{OWNER_LABEL[item.owner]}</span>
        {item.exhibitNumbers.length > 0 && <span className="text-xs font-bold text-slate-600 shrink-0">소갑 {item.exhibitNumbers.join(',')}</span>}
        <span className={`text-xs font-bold border rounded-lg px-2 py-0.5 shrink-0 ${statusTone}`}>{ITEM_STATUS_LABEL[item.status]}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {item.originalText && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap">원문: {item.originalText}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="space-y-1 text-xs font-bold text-slate-700">라이브러리에서 고르기
              <select value={draft.libraryId || ''} disabled={!canEditSetup} onChange={e => applyLibrary(e.target.value)} className={inputCls}>
                <option value="">선택 안 함</option>
                {library.map(l => <option key={l.id} value={l.id}>{l.category} · {l.title}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">담당
              <select value={draft.owner} disabled={!canEditSetup} onChange={e => setDraft(d => ({ ...d, owner: e.target.value as ItemOwner }))} className={inputCls}>
                {(Object.keys(OWNER_LABEL) as ItemOwner[]).map(o => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-700">표 양식
              <select value={draft.tableType || ''} disabled={!canEditSetup} onChange={e => setDraft(d => ({ ...d, tableType: (e.target.value || undefined) as TableType | undefined }))} className={inputCls}>
                <option value="">없음</option>
                {TABLE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>
          {draft.owner !== 'office' && (
            <div className="grid grid-cols-1 gap-2">
              <label className="space-y-1 text-xs font-bold text-slate-700">의뢰인에게 보일 쉬운 말 제목 (필수)
                <input value={draft.clientTitle || ''} disabled={!canEditSetup} onChange={e => setDraft(d => ({ ...d, clientTitle: e.target.value }))} className={inputCls} />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">안내 (왜 필요한지·어디서 받는지)
                <textarea value={draft.clientGuide || ''} disabled={!canEditSetup} rows={2} onChange={e => setDraft(d => ({ ...d, clientGuide: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">필요한 서류 (한 줄에 하나)
                <textarea value={draft.neededDocs.join('\n')} disabled={!canEditSetup} rows={2} onChange={e => setDraft(d => ({ ...d, neededDocs: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">질문 (한 줄에 하나)
                <textarea value={draft.questions.join('\n')} disabled={!canEditSetup} rows={2} onChange={e => setDraft(d => ({ ...d, questions: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
          )}

          {canEditSetup && <T2ImportButton item={item} onDone={() => void reload()} />}
          {!clientSide && item.tableType && item.tableRows.length > 0 && <p className="text-xs text-slate-600">표에 미리 넣은 줄 {item.tableRows.length}개 — 의뢰인에게 요청하면 의뢰인이 사용처를 채워요.</p>}

          {clientSide && <ClientResponseView item={item} />}

          {editable && (
            <PrecedentTools item={item} precedents={precedents} canFinalize={canFinalize} maskTerms={maskTerms}
              onPick={(text) => setDraft(d => ({ ...d, answerText: d.answerText ? `${d.answerText}\n${text}` : text }))}
              onSaved={() => void reloadPrecedents()} />
          )}

          <label className="block space-y-1 text-xs font-bold text-slate-700">보정서 답변 문안 (변호사 확정, '별지 ○'·'소갑 제○호증'은 출력 때 번호로 바뀌어요)
            <textarea value={draft.answerText || ''} disabled={!editable} rows={4} onChange={e => setDraft(d => ({ ...d, answerText: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>

          {editable && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}>{saving ? '저장 중…' : '항목 저장'}</button>
              {item.owner === 'office' && item.status === 'draft' && <button type="button" onClick={() => void review('office_done')} className={`${btn} border border-emerald-200 text-emerald-700`}>사무소 처리 완료</button>}
              {clientSide && !['confirmed'].includes(item.status) && <button type="button" onClick={() => void review('confirm')} className={`${btn} bg-emerald-600 text-white`}>확인 완료</button>}
              {['submitted', 'cannot_submit', 'confirmed'].includes(item.status) && <button type="button" onClick={() => void review('needs_fix')} className={`${btn} border border-amber-300 text-amber-800`}>보완 요청</button>}
              {['confirmed', 'office_done'].includes(item.status) && <button type="button" onClick={() => void review('reopen')} className={`${btn} border border-slate-200 text-slate-600`}>다시 열기</button>}
              {['draft', 'office_done'].includes(item.status) && <button type="button" onClick={() => void remove()} className={`${btn} border border-rose-200 text-rose-700`}><Trash2 className="w-3.5 h-3.5" /> 지우기</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ClientResponseView({ item }: { item: CorrectionItem }) {
  const [files, setFiles] = useState<Array<{ id: string; name: string; storagePath: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    if (item.fileIds.length) void loadCaseFilesByIds(item.fileIds).then(f => { if (!cancelled) setFiles(f); });
    return () => { cancelled = true; };
  }, [item.fileIds]);
  const rows = item.tableType ? cleanRows(item.tableType, item.tableRows) : [];
  const def = item.tableType ? CORRECTION_TABLES[item.tableType] : null;
  const answers = Object.entries(item.clientAnswers || {}).filter(([, v]) => String(v).trim());
  const openFile = async (f: { storagePath: string }) => {
    const url = await getCaseFileUrl({ storagePath: f.storagePath });
    if (url) window.open(url, '_blank', 'noopener'); else toast.error('파일을 열지 못했어요.');
  };
  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2 text-sm">
      <p className="text-xs font-black text-blue-900">의뢰인이 보낸 자료 {item.clientSubmittedAt ? `(${new Date(item.clientSubmittedAt).toLocaleString('ko-KR')})` : '(아직 안 보냄)'}</p>
      {item.status === 'needs_fix' && item.fixReason && <p className="text-xs text-amber-800">보완 요청 사유: {item.fixReason}</p>}
      {item.status === 'cannot_submit' && (
        <p className="text-xs text-slate-800">낼 수 없음: {CANNOT_REASON_LABEL[item.cannotReason || 'other']}{item.cannotNote ? ` · ${item.cannotNote}` : ''}{item.expectedOn ? ` · 발급 예정 ${item.expectedOn}` : ''}</p>
      )}
      {answers.length > 0 && (
        <dl className="space-y-1">
          {answers.map(([q, a]) => <div key={q}><dt className="text-xs font-bold text-slate-600">{q}</dt><dd className="text-sm text-slate-900 whitespace-pre-wrap">{a}</dd></div>)}
        </dl>
      )}
      {def && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr>{def.columns.map(c => <th key={c.key} className="border border-blue-100 bg-white px-2 py-1 text-left">{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{def.columns.map(c => <td key={c.key} className="border border-blue-100 bg-white px-2 py-1">{c.kind === 'money' ? formatMoneyCell(r[c.key]) : r[c.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map(f => (
            <li key={f.id}><button type="button" onClick={() => void openFile(f)} className="min-h-[44px] px-3 rounded-xl bg-white border border-blue-200 text-xs font-bold text-blue-800 inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"><Upload className="w-3.5 h-3.5 rotate-180" /> {f.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
