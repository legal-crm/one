// 3단계 '부채증명서' — 채권자별 부채증명 장부 (DC-1·DC-3·DC-4·DC-5·DC-6·DC-8·DC-9·DC-10·DC-11)
// 흐름: 채권자 후보 → 발급 요청 → 받음 → 값 확인 → 채권자목록 반영(해당 칸만) → 계산.
// 정책은 경고 + 확인 + 기록이고 막지 않는다. 모든 값은 서버(debt_certificates)에 둔다.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, Plus, RefreshCw, Send, Trash2, Upload } from 'lucide-react';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { RepaymentCreditor } from '../../../services/repayment/repaymentTypes';
import { useDialog } from '../../common/DialogProvider';
import {
  ALT_PROOF_LABEL, CATEGORY_LABEL, DOC_TYPES, METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL, UNAVAILABLE_LABEL,
  applyCertificateToCreditors, basisText, checkSum, claimCauseText, claimContentText, duplicateWarnings, interestPart,
  ledgerComplete, ledgerSummary, reviewFlags, won,
  type AltProof, type CertCategory, type CertMethod, type CertValues, type DebtCertificate, type Tri, type UnavailableReason,
} from '../../../services/debt/debtLedgerRules';
import {
  DEBT_LEDGER_CHANGED_EVENT, addDebtCertificates, deleteDebtCertificate, loadAgencyOrders, loadDebtAgencies, loadDebtLedger,
  migrateLegacyDebtOrder, recordAgencyOrder, updateDebtCertificate, type AgencyOrder, type DebtAgency,
} from '../../../services/debt/debtLedgerService';
import { parseCreditorCsvFile } from '../../../services/court/competitorCreditorCsv';
import { loadCaseFilesByIds } from '../../../services/corrections/correctionService';
import DebtAgencySettingsModal from './DebtAgencySettingsModal';
import { getCaseFileUrl, uploadCaseFile } from '../../../services/files/caseFileService';
import { localYmd } from '../../../utils/localDate';
import { addBusinessDaysLocal } from './businessDays';

interface Props {
  officeId: string;
  caseKey: string;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  canEdit: boolean;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
  onOpenAgencyApplication: (rows: DebtCertificate[]) => void;
  /** 보정 항목에서 넘어올 때 펼쳐 보여 줄 채권자 줄 (DC-11) */
  focusCertId?: string | null;
}

const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const input = 'w-full min-h-[40px] rounded-xl border border-slate-200 px-2.5 text-sm bg-white';
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-slate-50 text-slate-600 border-slate-200', requested: 'bg-indigo-50 text-indigo-700 border-indigo-200', received: 'bg-amber-50 text-amber-800 border-amber-200',
  verified: 'bg-blue-50 text-blue-700 border-blue-200', applied: 'bg-emerald-50 text-emerald-700 border-emerald-200', unavailable: 'bg-rose-50 text-rose-700 border-rose-200',
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}
const toInt = (s: string): number | undefined => { const n = Number(String(s).replace(/[^0-9.-]/g, '')); return s.trim() === '' || !Number.isFinite(n) ? undefined : Math.round(n); };
const toRate = (s: string): number | undefined => { const n = Number(String(s).replace(/[^0-9.]/g, '')); return s.trim() === '' || !Number.isFinite(n) ? undefined : n; };

export default function DebtLedgerPanel(p: Props) {
  const { officeId, caseKey, canEdit } = p;
  const dialog = useDialog();
  const [rows, setRows] = useState<DebtCertificate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<DebtAgency[]>([]);
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [orders, setOrders] = useState<AgencyOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const today = localYmd();

  const load = useCallback(async () => {
    const r = await loadDebtLedger(officeId, caseKey);
    if (r.ok === false) { setError(r.message); return; }
    let list = r.data;
    if (list.length === 0 && canEdit) {
      const moved = await migrateLegacyDebtOrder(officeId, caseKey, 0);
      if (moved > 0) {
        toast.info(`이 브라우저에 있던 부채증명 기록 ${moved}곳을 서버 장부로 옮겼어요.`);
        const again = await loadDebtLedger(officeId, caseKey);
        if (again.ok) list = again.data;
      }
    }
    setError(null);
    setRows(list);
    setOrders(await loadAgencyOrders(officeId, caseKey));
  }, [officeId, caseKey, canEdit]);

  useEffect(() => { void load(); void loadDebtAgencies(officeId).then(setAgencies); }, [load, officeId]);
  // 보정 항목에서 '장부에서 보기'로 넘어오면 그 줄을 펼치고 화면으로 옮긴다 (DC-11)
  const focusedRef = React.useRef<string | null>(null);
  useEffect(() => {
    const id = p.focusCertId;
    if (!id || !rows || focusedRef.current === id || !rows.some(r => r.id === id)) return;
    focusedRef.current = id;
    setOpenId(id);
    window.setTimeout(() => document.getElementById(`debt-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }, [p.focusCertId, rows]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(DEBT_LEDGER_CHANGED_EVENT, h);
    return () => window.removeEventListener(DEBT_LEDGER_CHANGED_EVENT, h);
  }, [load]);

  const creditors: RepaymentCreditor[] = (p.crmExt?.repaymentPlan?.creditors || []) as RepaymentCreditor[];
  const summary = useMemo(() => ledgerSummary(rows || [], today), [rows, today]);
  const dupes = useMemo(() => duplicateWarnings(rows || []), [rows]);

  // ── 후보 모으기 (DC-3): 의뢰인 진술·채권자목록에 있는데 장부에 없는 곳 ──
  const candidates = useMemo(() => {
    const have = new Set((rows || []).map(r => r.creditorName.replace(/\s/g, '')));
    const out: Array<{ name: string; source: 'client' | 'office'; amount?: number }> = [];
    const seen = new Set<string>();
    const debts = (p.clientRequest.financialProfile as any)?.debts as Array<{ creditor: string; amount: number }> | undefined;
    (debts || []).forEach(d => {
      const k = String(d?.creditor || '').replace(/\s/g, '');
      if (k && !have.has(k) && !seen.has(k)) { seen.add(k); out.push({ name: String(d.creditor).trim(), source: 'client', amount: Number(d.amount) > 0 ? Math.round(Number(d.amount) * 10000) : undefined }); }
    });
    creditors.forEach(c => {
      const k = String(c.name || '').replace(/\s/g, '');
      if (k && !have.has(k) && !seen.has(k)) { seen.add(k); out.push({ name: c.name.trim(), source: 'office', amount: c.principal || undefined }); }
    });
    return out;
  }, [rows, creditors, p.clientRequest.financialProfile]);
  // 장부에서 반영했는데 채권자목록에 없는 줄 / 채권자목록에 있는데 장부에 없는 채권자
  const missingInList = useMemo(() => (rows || []).filter(r => r.status === 'applied' && !creditors.some(c => c.id === r.appliedCreditorId)), [rows, creditors]);

  const importCandidates = async () => {
    if (candidates.length === 0) return;
    setBusy(true);
    const start = (rows || []).reduce((m, r) => Math.max(m, r.seq), 0);
    const r = await addDebtCertificates(officeId, caseKey, candidates.map((c, i) => ({ creditorName: c.name, seq: start + i + 1, source: c.source, claimedPrincipal: c.amount })));
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`${r.data.length}곳을 장부에 넣었어요.`);
    void load();
  };
  // 다른 프로그램(디던비·로패스·전자소송) 채권자 CSV에서 장부 줄 만들기 (NF-10)
  const csvInputRef = React.useRef<HTMLInputElement>(null);
  const importCsv = async (file: File) => {
    const parsed = await parseCreditorCsvFile(file);
    if (parsed.rows.length === 0) { toast.error(parsed.warnings[0] || '가져올 채권자가 없어요.'); return; }
    const existing = new Set((rows || []).map(r => r.creditorName.replace(/\s/g, '')));
    const fresh = parsed.rows.filter(r => !existing.has(r.name.replace(/\s/g, '')));
    const skipped = parsed.rows.length - fresh.length;
    const ok = await dialog.confirm({
      title: '채권자 CSV 가져오기',
      message: `${parsed.rows.length}곳을 읽었어요${skipped ? ` (이미 장부에 있는 ${skipped}곳은 건너뜀)` : ''}. ${fresh.length}곳을 장부에 '요청 전'으로 넣을까요?${parsed.warnings.length ? `\n\n확인할 점: ${parsed.warnings.slice(0, 3).join(' / ')}` : ''}`,
      confirmText: '장부에 넣기',
    });
    if (!ok || fresh.length === 0) return;
    setBusy(true);
    const start = (rows || []).reduce((m, r) => Math.max(m, r.seq), 0);
    const r = await addDebtCertificates(officeId, caseKey, fresh.map((c, i) => ({ creditorName: c.name, seq: start + i + 1, source: 'office', claimedPrincipal: c.principal })));
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`${r.data.length}곳을 장부에 넣었어요. 금액은 진술 원금으로만 들어가요(증명서로 확인 필요).`);
    void load();
  };
  const addOne = async () => {
    const name = await dialog.prompt({ title: '채권자 추가', message: '채권자(금융기관) 이름을 적어 주세요.' });
    if (!name || !name.trim()) return;
    const start = (rows || []).reduce((m, r) => Math.max(m, r.seq), 0);
    const r = await addDebtCertificates(officeId, caseKey, [{ creditorName: name.trim(), seq: start + 1, source: 'office' }]);
    if (r.ok === false) { toast.error(r.message); return; }
    setOpenId(r.data[0]?.id || null);
    void load();
  };

  // ── 대행사 의뢰 기록 (DC-9) ──
  const recordSend = async () => {
    const targets = (rows || []).filter(r => r.status === 'pending' && r.method === 'agency');
    if (targets.length === 0) { toast.info('대행사로 보낼 \'요청 전\' 줄이 없어요.'); return; }
    const agencyName = agencies.length === 1 ? agencies[0].name : (await dialog.prompt({ title: '대행사 의뢰 기록', message: `대행사 이름을 적어 주세요.${agencies.length ? ` (등록: ${agencies.map(a => a.name).join(', ')})` : ''}`, defaultValue: agencies[0]?.name || '' }));
    if (!agencyName || !agencyName.trim()) return;
    const sentOn = await dialog.prompt({ title: '보낸 날', message: '대행사에 의뢰서를 보낸 날(YYYY-MM-DD)', defaultValue: today });
    if (!sentOn || !/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) { if (sentOn) toast.error('날짜는 2026-10-31처럼 입력해 주세요.'); return; }
    const ag = agencies.find(a => a.name === agencyName.trim());
    const expected = addBusinessDaysLocal(sentOn, ag?.avgBusinessDays || 7);
    setBusy(true);
    const r = await recordAgencyOrder(officeId, caseKey, {
      agencyName: agencyName.trim(), sentOn, method: 'download', certificateIds: targets.map(t => t.id),
      agencyFee: ag?.feePer !== undefined ? ag.feePer * targets.length : undefined, issueFee: ag?.issueFeePer !== undefined ? ag.issueFeePer * targets.length : undefined,
    });
    if (r.ok === false) { setBusy(false); toast.error(r.message); return; }
    for (const t of targets) await updateDebtCertificate(t.id, { status: 'requested', requestedOn: sentOn, expectedOn: expected });
    setBusy(false);
    toast.success(`${targets.length}곳을 '요청함'으로 바꾸고 예정일을 ${expected}로 잡았어요.`);
    void load();
  };

  // ── 채권자목록 반영 (DC-6) ──
  const applyOne = async (row: DebtCertificate) => {
    if (!p.onUpdateCrmExt) return;
    const flags = reviewFlags(row);
    if (flags.length) {
      const ok = await dialog.confirm({ title: '확인할 점이 있어요', message: `${flags.join(' · ')}\n그래도 채권자목록에 반영할까요? 반영 기록이 남아요.`, confirmText: '반영' });
      if (!ok) return;
    }
    const res = applyCertificateToCreditors(creditors, row, () => `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const log = [
      ...(((p.crmExt as any)?.creditorChangeLog || []) as any[]),
      ...res.changes.map(c => ({ ...c, at: new Date().toISOString(), certificateId: row.id })),
    ].slice(-300);
    try {
      await p.onUpdateCrmExt({ repaymentPlan: { ...(p.crmExt?.repaymentPlan || {}), creditors: res.creditors } as any, creditorChangeLog: log } as any);
    } catch {
      toast.error('채권자목록을 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
      return;
    }
    // 발급 불가 + 대체 소명 줄은 상태를 그대로 두고 연결만 남긴다 (기준일이 없을 수 있음)
    const u = await updateDebtCertificate(row.id, row.status === 'unavailable' ? { appliedCreditorId: res.creditorId } : { status: 'applied', appliedCreditorId: res.creditorId });
    if (u.ok === false) { toast.error(u.message); return; }
    toast.success(res.changes.length ? `채권자목록 ${res.changes.length}칸을 고쳤어요. 변제 계산은 서식 작성기에서 다시 계산돼요.` : '바뀐 값이 없어요.');
    void load();
  };

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
        <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" aria-hidden="true" />
        <p className="text-sm text-rose-900 flex-1">{error}</p>
        <button type="button" onClick={() => void load()} className={`${btn} bg-white border border-rose-200 text-rose-800`}>다시 불러오기</button>
      </div>
    );
  }
  if (rows === null) return <div className="space-y-2" aria-busy="true"><div className="h-16 rounded-2xl bg-slate-100 animate-pulse" /><div className="h-48 rounded-2xl bg-slate-100 animate-pulse" /></div>;

  const done = ledgerComplete(rows);
  return (
    <section className="space-y-4" aria-labelledby="debt-ledger-title">
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="debt-ledger-title" className="text-sm font-black text-slate-900">부채증명 장부</h3>
            <p className="text-xs text-slate-500">채권자마다 요청 → 받음 → 값 확인 → 채권자목록 반영. 반영한 값만 서식·변제 계산에 들어가요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} aria-label="새로 고침" className={`${btn} border border-slate-200 text-slate-600`}><RefreshCw className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setAgencyOpen(true)} className={`${btn} border border-slate-200 text-slate-700`}>대행사 설정</button>
            {agencyOpen && <DebtAgencySettingsModal officeId={officeId} onClose={() => setAgencyOpen(false)} onSaved={setAgencies} />}
            {canEdit && <button type="button" onClick={() => p.onOpenAgencyApplication(rows)} className={`${btn} border border-slate-200 text-slate-700`}><FileSpreadsheet className="w-3.5 h-3.5" /> 대행 의뢰서·위임장</button>}
            {canEdit && <button type="button" disabled={busy} onClick={() => void recordSend()} className={`${btn} bg-indigo-600 text-white`}><Send className="w-3.5 h-3.5" /> 대행사에 보냄 기록</button>}
            {canEdit && <button type="button" disabled={busy} onClick={() => csvInputRef.current?.click()} className={`${btn} border border-slate-200 text-slate-700`} title="디던비·로패스·전자소송 채권자 CSV"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV에서 불러오기</button>}
            {canEdit && <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) void importCsv(fl); }} />}
            {canEdit && <button type="button" onClick={() => void addOne()} className={`${btn} bg-[#1E3A5F] text-white`}><Plus className="w-3.5 h-3.5" /> 채권자 추가</button>}
          </div>
        </div>
        <p className="text-xs text-slate-700" aria-live="polite">
          {summary.total}곳 중 받음 {summary.received} · 값 확인 {summary.verified} · 반영 {summary.applied}{summary.unavailable ? ` · 발급 불가 ${summary.unavailable}` : ''}
          {summary.late ? <span className="text-rose-700 font-bold"> · 예정일 지남 {summary.late}</span> : null}
          {done ? <span className="text-emerald-700 font-bold"> · 3단계 부채증명 완료</span> : null}
        </p>
        {candidates.length > 0 && canEdit && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            <span className="text-amber-900 flex-1">장부에 없는 채권자 {candidates.length}곳: {candidates.slice(0, 6).map(c => `${c.name}(${SOURCE_LABEL[c.source]})`).join(', ')}{candidates.length > 6 ? ' …' : ''}</span>
            <button type="button" disabled={busy} onClick={() => void importCandidates()} className={`${btn} bg-amber-600 text-white`}>장부에 넣기</button>
          </div>
        )}
        {missingInList.length > 0 && <p className="text-xs text-rose-700">반영했지만 채권자목록에서 빠진 곳: {missingInList.map(m => m.creditorName).join(', ')} — 다시 반영해 주세요.</p>}
        {dupes.map(d => <p key={d} className="text-xs text-rose-700">{d}</p>)}
        {orders.length > 0 && (
          <p className="text-xs text-slate-500">대행 의뢰: {orders.slice(0, 3).map(o => `${o.sentOn} ${o.agencyName} ${o.certificateIds.length}곳${o.agencyFee !== undefined ? ` · 대행비 ${won(o.agencyFee)}원` : ''}`).join(' / ')}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-1">
          <p className="text-sm font-bold text-slate-700">장부가 비어 있어요</p>
          <p className="text-xs text-slate-500">'채권자 추가'로 넣거나, 의뢰인 진술·채권자목록에 있는 곳을 '장부에 넣기'로 가져오세요. 빈 장부는 3단계 완료로 보지 않아요.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
          {rows.map(r => (
            <LedgerRow key={r.id} row={r} focused={p.focusCertId === r.id} open={openId === r.id} onToggle={() => setOpenId(v => (v === r.id ? null : r.id))}
              canEdit={canEdit} officeId={officeId} caseKey={caseKey} today={today} reload={load} onApply={() => void applyOne(r)} dialog={dialog} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LedgerRow({ row, focused, open, onToggle, canEdit, officeId, caseKey, today, reload, onApply, dialog }: {
  row: DebtCertificate; focused?: boolean; open: boolean; onToggle: () => void; canEdit: boolean; officeId: string; caseKey: string; today: string;
  reload: () => Promise<void>; onApply: () => void; dialog: ReturnType<typeof useDialog>;
}) {
  const [d, setD] = useState(row);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Array<{ id: string; name: string; storagePath: string }>>([]);
  useEffect(() => { setD(row); }, [row]);
  useEffect(() => {
    let cancel = false;
    if (open && row.fileIds.length) void loadCaseFilesByIds(row.fileIds).then(f => { if (!cancel) setFiles(f); });
    return () => { cancel = true; };
  }, [open, row.fileIds]);

  const flags = reviewFlags(row);
  const late = row.status === 'requested' && row.expectedOn && row.expectedOn < today;
  const setV = (patch: Partial<CertValues>) => setD(x => ({ ...x, values: { ...x.values, ...patch } }));
  const sum = checkSum(d.values);

  const save = async (extra: Partial<DebtCertificate> = {}) => {
    setSaving(true);
    const r = await updateDebtCertificate(row.id, {
      creditorName: d.creditorName, branch: d.branch, method: d.method, requestedOn: d.requestedOn, expectedOn: d.expectedOn, receivedOn: d.receivedOn,
      docType: d.docType, values: d.values, category: d.category, attrs: d.attrs, claimedPrincipal: d.claimedPrincipal,
      unavailableReason: d.unavailableReason, altProof: d.altProof, note: d.note, ...extra,
    });
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return false; }
    toast.success('저장했어요.');
    void reload();
    return true;
  };
  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('파일당 20MB까지 올릴 수 있어요.'); return; }
    setSaving(true);
    const up = await uploadCaseFile({
      source: 'office', clientKey: caseKey, officeId,
      file: { id: '', name: file.name, category: 'debt_cert', uploadedAt: new Date().toISOString(), uploadedBy: '사무소', dataUrl: await readAsDataUrl(file), mimeType: file.type } as any,
    });
    if (!up.ok || !up.file) { setSaving(false); toast.error(up.message || '파일을 올리지 못했어요.'); return; }
    const r = await updateDebtCertificate(row.id, { fileIds: [...row.fileIds, up.file.id], ...(row.status === 'pending' || row.status === 'requested' ? { status: 'received', receivedOn: today } : {}) });
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('증명서를 붙였어요. 값을 옮겨 적고 \'값 확인\'을 눌러 주세요.');
    void reload();
  };
  const openFile = async (f: { storagePath: string }) => {
    const url = await getCaseFileUrl({ storagePath: f.storagePath });
    if (url) window.open(url, '_blank', 'noopener'); else toast.error('파일을 열지 못했어요.');
  };
  const markUnavailable = async () => {
    if (!d.unavailableReason) { toast.error('발급이 안 되는 사유를 골라 주세요.'); return; }
    await save({ status: 'unavailable' });
  };
  const remove = async () => {
    const ok = await dialog.confirm({ title: `${row.creditorName} 줄을 지울까요?`, message: '요청 전·요청함 상태의 줄만 지울 수 있어요.', variant: 'danger', confirmText: '지우기' });
    if (!ok) return;
    const r = await deleteDebtCertificate(row.id);
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };

  const money = (k: keyof CertValues, label: string) => (
    <label className="text-xs font-bold text-slate-600 space-y-0.5">{label}
      <input className={input} inputMode="numeric" disabled={!canEdit} value={d.values[k] === undefined ? '' : won(d.values[k] as number)}
        onChange={e => setV({ [k]: toInt(e.target.value) } as any)} />
    </label>
  );
  const date = (k: keyof CertValues, label: string) => (
    <label className="text-xs font-bold text-slate-600 space-y-0.5">{label}
      <input type="date" className={input} disabled={!canEdit} value={(d.values[k] as string) || ''} onChange={e => setV({ [k]: e.target.value || undefined } as any)} />
    </label>
  );
  const tri = (k: keyof DebtCertificate['attrs'], label: string) => (
    <label className="text-xs font-bold text-slate-600 space-y-0.5">{label}
      <select className={input} disabled={!canEdit} value={d.attrs[k]} onChange={e => setD(x => ({ ...x, attrs: { ...x.attrs, [k]: e.target.value as Tri } }))}>
        <option value="unknown">미확정</option><option value="yes">예</option><option value="no">아니오</option>
      </select>
    </label>
  );

  return (
    <li id={`debt-row-${row.id}`} className={focused ? 'ring-2 ring-inset ring-amber-400' : undefined}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full min-h-[48px] px-3 py-2 flex flex-wrap items-center gap-2 text-left hover:bg-slate-50">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-xs font-black text-slate-500 w-6">{row.seq}</span>
        <span className="text-sm font-bold text-slate-900 flex-1 min-w-[8rem] truncate">{row.creditorName}</span>
        <span className="text-xs text-slate-500">{METHOD_LABEL[row.method]}</span>
        {row.values.principal !== undefined && <span className="text-xs font-bold text-slate-800">원금 {won(row.values.principal)}원</span>}
        {row.values.baseDate && <span className="text-xs text-slate-500">기준 {row.values.baseDate}</span>}
        {late && <span className="text-xs font-bold text-rose-700">예정일 지남</span>}
        {flags.map(f => <span key={f} className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-1.5">{f}</span>)}
        <span className={`text-xs font-bold border rounded-lg px-2 py-0.5 ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 bg-slate-50/40">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <label className="text-xs font-bold text-slate-600 space-y-0.5">채권자<input className={input} disabled={!canEdit} value={d.creditorName} onChange={e => setD(x => ({ ...x, creditorName: e.target.value }))} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">발급 방법
              <select className={input} disabled={!canEdit} value={d.method} onChange={e => setD(x => ({ ...x, method: e.target.value as CertMethod }))}>
                {(Object.keys(METHOD_LABEL) as CertMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">요청일<input type="date" className={input} disabled={!canEdit} value={d.requestedOn || ''} onChange={e => setD(x => ({ ...x, requestedOn: e.target.value || undefined }))} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">예정일<input type="date" className={input} disabled={!canEdit} value={d.expectedOn || ''} onChange={e => setD(x => ({ ...x, expectedOn: e.target.value || undefined }))} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">수령일<input type="date" className={input} disabled={!canEdit} value={d.receivedOn || ''} onChange={e => setD(x => ({ ...x, receivedOn: e.target.value || undefined }))} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">의뢰인 진술 원금(원)<input className={input} inputMode="numeric" disabled={!canEdit} value={d.claimedPrincipal === undefined ? '' : won(d.claimedPrincipal)} onChange={e => setD(x => ({ ...x, claimedPrincipal: toInt(e.target.value) }))} /></label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">문서 종류 (산정근거)
              <select className={input} disabled={!canEdit} value={d.docType} onChange={e => setD(x => ({ ...x, docType: e.target.value }))}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600 space-y-0.5">주된 분류
              <select className={input} disabled={!canEdit} value={d.category} onChange={e => setD(x => ({ ...x, category: e.target.value as CertCategory }))}>
                {(Object.keys(CATEGORY_LABEL) as CertCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {files.map(f => <button key={f.id} type="button" onClick={() => void openFile(f)} className={`${btn} border border-blue-200 bg-white text-blue-800`}><Upload className="w-3.5 h-3.5 rotate-180" /> {f.name}</button>)}
            {canEdit && (
              <label className={`${btn} border border-slate-200 bg-white text-slate-700`}>
                <Upload className="w-3.5 h-3.5" /> {saving ? '올리는 중…' : '증명서 붙이기'}
                <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={saving} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
              </label>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-black text-slate-800">증명서 값 (원 단위)</legend>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              {date('baseDate', '산정기준일 (필수)')}
              {date('issueDate', '발급일')}
              {money('principal', '현재 원금')}
              {money('interest', '이자')}
              {money('lateInterest', '연체이자(지연손해금)')}
              {money('otherInterest', '기타이자')}
              {money('advance', '가지급금')}
              {money('legalCost', '법비용')}
              {money('fee', '수수료')}
              {money('otherCost', '기타비용')}
              {money('total', '총채무액(합계)')}
              <label className="text-xs font-bold text-slate-600 space-y-0.5">약정이율(연 %)<input className={input} inputMode="decimal" disabled={!canEdit} value={d.values.normalRate ?? ''} onChange={e => setV({ normalRate: toRate(e.target.value) })} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-0.5">연체이율(연 %)<input className={input} inputMode="decimal" disabled={!canEdit} value={d.values.lateRate ?? ''} onChange={e => setV({ lateRate: toRate(e.target.value) })} /></label>
              {date('loanDate', '대출일(발생일)')}
              <label className="text-xs font-bold text-slate-600 space-y-0.5">대출 과목(발생원인)<input className={input} disabled={!canEdit} value={d.values.loanType || ''} maxLength={60} onChange={e => setV({ loanType: e.target.value || undefined })} /></label>
              {money('initialAmount', '최초 대출금')}
              <label className="text-xs font-bold text-slate-600 space-y-0.5">계좌/관리번호(끝 4자리 권장)<input className={input} disabled={!canEdit} value={d.values.accountNo || ''} maxLength={40} onChange={e => setV({ accountNo: e.target.value || undefined })} /></label>
              <label className="text-xs font-bold text-slate-600 space-y-0.5">보증인<input className={input} disabled={!canEdit} value={d.values.guarantor || ''} maxLength={60} onChange={e => setV({ guarantor: e.target.value || undefined })} /></label>
              {tri('guarantee', '보증 속성')}
              {tri('futureIndemnity', '장래구상권 속성')}
              {tri('secured', '물적담보 속성')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2">
                <label className="inline-flex items-center gap-1 font-bold"><input type="checkbox" disabled={!canEdit} checked={!!d.values.subrogated?.yes} onChange={e => setV({ subrogated: { ...(d.values.subrogated || {}), yes: e.target.checked } })} /> 대위변제 됨</label>
                <input type="date" aria-label="대위변제일" className="min-h-[36px] rounded-lg border border-slate-200 px-2" disabled={!canEdit || !d.values.subrogated?.yes} value={d.values.subrogated?.date || ''} onChange={e => setV({ subrogated: { yes: true, ...d.values.subrogated, date: e.target.value } })} />
                <input aria-label="대위변제자" placeholder="대위변제자" className="min-h-[36px] rounded-lg border border-slate-200 px-2 flex-1" disabled={!canEdit || !d.values.subrogated?.yes} value={d.values.subrogated?.by || ''} onChange={e => setV({ subrogated: { yes: true, ...d.values.subrogated, by: e.target.value } })} />
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2">
                <label className="inline-flex items-center gap-1 font-bold"><input type="checkbox" disabled={!canEdit} checked={!!d.values.assigned?.yes} onChange={e => setV({ assigned: { ...(d.values.assigned || {}), yes: e.target.checked } })} /> 채권 양도됨</label>
                <input type="date" aria-label="양도일" className="min-h-[36px] rounded-lg border border-slate-200 px-2" disabled={!canEdit || !d.values.assigned?.yes} value={d.values.assigned?.date || ''} onChange={e => setV({ assigned: { yes: true, ...d.values.assigned, date: e.target.value } })} />
                <input aria-label="양수인" placeholder="양수인" className="min-h-[36px] rounded-lg border border-slate-200 px-2 flex-1" disabled={!canEdit || !d.values.assigned?.yes} value={d.values.assigned?.to || ''} onChange={e => setV({ assigned: { yes: true, ...d.values.assigned, to: e.target.value } })} />
              </div>
            </div>
            <p className={`text-xs ${sum && !sum.ok ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
              {sum ? (sum.ok ? '검산: 원금 + 이자·비용 = 총채무액 ✓' : `검산: 항목 합 ${won(sum.computed)}원 ≠ 총채무액 (차이 ${won(sum.diff)}원) — 증명서를 다시 확인해 주세요.`) : '총채무액을 넣으면 검산해요.'}
              {' '}채권자목록 이자 칸 = {won(interestPart(d.values))}원 (합계 − 원금)
            </p>
            {(d.values.subrogated?.yes || d.values.assigned?.yes) && (
              <p className="text-xs text-amber-800">대위변제·양도된 채권은 채권자를 {d.values.subrogated?.yes ? `대위변제자(${d.values.subrogated.by || '?'})` : `양수인(${d.values.assigned?.to || '?'})`}로 바꿀지 확인해 주세요. 원채권자는 메모에 남기고, 두 곳이 모두 원금으로 잡히지 않게 해 주세요.</p>
            )}
          </fieldset>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs space-y-1">
            <p className="font-bold text-slate-700">채권자목록에 들어갈 문장 (미리보기)</p>
            <p><span className="text-slate-500">산정근거</span> {basisText(d)}</p>
            <p><span className="text-slate-500">채권의 원인</span> {claimCauseText(d) || <em className="text-amber-700">대출일·대출 과목을 넣으면 만들어져요 (확인 필요)</em>}</p>
            <p><span className="text-slate-500">채권의 내용</span> {claimContentText(d) || '–'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <label className="font-bold text-slate-600 space-y-0.5">발급이 안 되는 사유
              <select className={input} disabled={!canEdit} value={d.unavailableReason || ''} onChange={e => setD(x => ({ ...x, unavailableReason: (e.target.value || undefined) as UnavailableReason | undefined }))}>
                <option value="">해당 없음</option>
                {(Object.keys(UNAVAILABLE_LABEL) as UnavailableReason[]).map(k => <option key={k} value={k}>{UNAVAILABLE_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="font-bold text-slate-600 space-y-0.5">대체 소명
              <select className={input} disabled={!canEdit} value={d.altProof || ''} onChange={e => setD(x => ({ ...x, altProof: (e.target.value || undefined) as AltProof | undefined }))}>
                <option value="">없음</option>
                {(Object.keys(ALT_PROOF_LABEL) as AltProof[]).map(k => <option key={k} value={k}>{ALT_PROOF_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="font-bold text-slate-600 space-y-0.5">메모<input className={input} disabled={!canEdit} value={d.note || ''} maxLength={2000} onChange={e => setD(x => ({ ...x, note: e.target.value || undefined }))} /></label>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}>{saving ? '저장 중…' : '저장'}</button>
              {row.status !== 'verified' && row.status !== 'applied' && row.status !== 'unavailable' && (
                <button type="button" disabled={saving} onClick={() => void save({ status: 'verified', receivedOn: d.receivedOn || today })} className={`${btn} bg-blue-600 text-white`}><CheckCircle2 className="w-3.5 h-3.5" /> 값 확인</button>
              )}
              {(row.status === 'verified' || row.status === 'applied' || (row.status === 'unavailable' && row.altProof)) && (
                <button type="button" disabled={saving} onClick={onApply} className={`${btn} bg-emerald-600 text-white`}>채권자목록에 반영</button>
              )}
              {row.status !== 'unavailable' && <button type="button" disabled={saving} onClick={() => void markUnavailable()} className={`${btn} border border-rose-200 text-rose-700`}>발급 불가로 표시</button>}
              {(row.status === 'verified' || row.status === 'unavailable') && <button type="button" disabled={saving} onClick={() => void save({ status: 'received' })} className={`${btn} border border-slate-200 text-slate-600`}>다시 검수</button>}
              {(row.status === 'pending' || row.status === 'requested') && <button type="button" onClick={() => void remove()} className={`${btn} border border-rose-200 text-rose-700`}><Trash2 className="w-3.5 h-3.5" /> 지우기</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
