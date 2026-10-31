import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, FileText, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import { loadDebtLedger, DEBT_LEDGER_CHANGED_EVENT } from '../../../services/debt/debtLedgerService';
import type { DebtCertificate } from '../../../services/debt/debtLedgerRules';
import {
  addDispatch, deletePreparedDispatch, dispatchDocsHtml, hasResidentNumber, loadDispatches, updateDispatch, wrapDispatchHtml,
  DOC_KIND_LABEL, METHOD_LABEL, STATUS_LABEL,
  type CreditorDispatch, type DispatchDocKind, type DispatchMethod,
} from '../../../services/debt/creditorDispatchService';
import { matchCreditorPreset, creditorNeedsCheck } from '../../../services/court/creditorAddressDirectory';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import { getSealDataUrl, recordSealUse } from '../../../services/office/sealCache';
import { renderTextPdf, downloadPdfBytes } from '../../../services/court/courtPdfService';
import { savePdfBytesToCase } from '../../../services/court/casePdfSave';
import { getCaseFileUrl } from '../../../services/files/caseFileService';
import { localYmd } from '../../../utils/localDate';

/**
 * 채권자 일괄 발송 (NF-4) — 부채증명 장부의 채권자마다 대리인 선임 통지서·부채증명서 발급 요청서를 만들고
 * 보낸 날·방법·접수 번호·회신을 기록한다. 발급 요청서를 보낸 줄은 장부가 '요청함', 회신을 기록하면 '받음'으로 바뀐다.
 */
interface Props {
  officeId: string;
  caseKey: string;
  debtorName: string;
  procedure: 'rehab' | 'bankruptcy';
  courtName?: string;
  lawyerName?: string;
}

export default function CreditorDispatchPanel({ officeId, caseKey, debtorName, procedure, courtName, lawyerName }: Props) {
  const dialog = useDialog();
  const [ledger, setLedger] = useState<DebtCertificate[] | null>(null);
  const [dispatches, setDispatches] = useState<CreditorDispatch[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<DispatchDocKind[]>(['appointment_notice', 'debt_cert_request']);
  const [method, setMethod] = useState<DispatchMethod>('mail');
  const [name, setName] = useState(debtorName);
  const [birth, setBirth] = useState('');
  const [baseDate, setBaseDate] = useState(localYmd());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [l, d] = await Promise.all([loadDebtLedger(officeId, caseKey), loadDispatches(officeId, caseKey)]);
    if (l.ok === false) { setError(l.message); setLedger([]); return; }
    setError('');
    setLedger(l.data.filter(c => c.status !== 'unavailable'));
    setDispatches(d.ok ? d.data : []);
  }, [officeId, caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const fn = () => void load();
    window.addEventListener(DEBT_LEDGER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(DEBT_LEDGER_CHANGED_EVENT, fn);
  }, [load]);
  useEffect(() => { setName(debtorName); }, [debtorName]);

  const lastByCert = useMemo(() => {
    const m: Record<string, CreditorDispatch> = {};
    dispatches.forEach(d => { const k = d.debtCertificateId || d.creditorKey; if (!m[k]) m[k] = d; });
    return m;
  }, [dispatches]);

  const office = getOfficeProfile(lawyerName);
  const officeMissing = !office.firmName || !office.address || (!office.phone && !office.fax);

  const docInput = (c: DebtCertificate) => {
    const reg = matchCreditorPreset(c.creditorName);
    return {
      reg,
      input: {
        creditorName: reg?.officialName || c.creditorName,
        creditorAddress: reg ? `(${reg.zipCode}) ${reg.serviceAddress || reg.address}` : '',
        creditorFax: reg?.fax || '',
        debtorName: name.trim(),
        debtorBirth: birth || undefined,
        procedure, courtName,
        office: { firmName: office.firmName, lawyerName: office.lawyerName || lawyerName || '', address: office.address, phone: office.phone, fax: office.fax, email: office.email },
        baseDate, issuedOn: localYmd(),
        sealImage: getSealDataUrl('office_seal') || getSealDataUrl('lawyer_seal') || null,
      },
    };
  };

  const check = (): string | null => {
    if (!name.trim()) return '채무자 이름을 넣어 주세요.';
    if (hasResidentNumber(name) || hasResidentNumber(birth)) return '주민등록번호는 넣지 않아요. 생년월일만 적어 주세요.';
    if (kinds.length === 0) return '만들 문서를 하나 이상 골라 주세요.';
    if (selected.size === 0) return '보낼 채권자를 골라 주세요.';
    return null;
  };

  /** 채권자마다 PDF를 사건 서류함에 저장하고 '문서 준비' 기록을 만든다 */
  const prepare = async () => {
    const msg = check(); if (msg) { toast.error(msg); return; }
    setBusy(true);
    let done = 0;
    for (const c of (ledger || []).filter(x => selected.has(x.id))) {
      const { reg, input } = docInput(c);
      const title = `${input.creditorName}_${kinds.map(k => DOC_KIND_LABEL[k].replace(/\s/g, '')).join('_')}`;
      const pdf = await renderTextPdf(wrapDispatchHtml(dispatchDocsHtml(input, kinds), title), { title, pageNumbers: false });
      if (pdf.ok === false) { toast.error(`${c.creditorName}: ${pdf.message}`); continue; }
      const saved = await savePdfBytesToCase({ bytes: pdf.bytes, officeId, caseKey, fileName: `${title}_${localYmd().replace(/-/g, '')}.pdf`, note: '채권자 발송 문서 (NF-4)' });
      if (saved.ok === false) { toast.error(`${c.creditorName}: ${saved.message}`); continue; }
      const rec = await addDispatch(officeId, caseKey, {
        creditorKey: c.id, creditorName: input.creditorName, registryId: reg?.id || null, docKinds: kinds, method,
        recipient: method === 'fax' ? (input.creditorFax || '') : (input.creditorAddress || ''), fileId: saved.file.id, filePath: saved.file.storagePath || null, debtCertificateId: c.id,
      });
      if (rec.ok === false) { toast.error(`${c.creditorName}: ${rec.message}`); continue; }
      if (input.sealImage) recordSealUse('office_seal', title);
      done++;
    }
    setBusy(false);
    if (done > 0) { toast.success(`${done}곳 문서를 사건 서류함에 저장했어요. 보낸 뒤 '보냄 기록'을 남겨 주세요.`); setSelected(new Set()); }
    void load();
    window.dispatchEvent(new Event('mykim:case-files-changed'));
  };

  /** 우편용 묶음 PDF (고른 채권자 전부, 한 파일) */
  const bundle = async () => {
    const msg = check(); if (msg) { toast.error(msg); return; }
    setBusy(true);
    const body = (ledger || []).filter(x => selected.has(x.id)).map(c => dispatchDocsHtml(docInput(c).input, kinds)).join('\n');
    const pdf = await renderTextPdf(wrapDispatchHtml(body, '채권자 발송 묶음'), { title: '채권자 발송 묶음', pageNumbers: false });
    setBusy(false);
    if (pdf.ok === false) { toast.error(pdf.message); return; }
    downloadPdfBytes(pdf.bytes, `채권자발송묶음_${localYmd().replace(/-/g, '')}.pdf`);
  };

  const askDate = async (title: string, message: string) => {
    const v = await dialog.prompt({ title, message, defaultValue: localYmd() });
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { toast.error('날짜는 2026-11-01처럼 입력해 주세요.'); return null; }
    return v;
  };

  const markSent = async (d: CreditorDispatch) => {
    const on = await askDate('보낸 날', `${d.creditorName}에 ${METHOD_LABEL[d.method]}(으)로 보낸 날짜를 입력하세요.`);
    if (!on) return;
    const receipt = await dialog.prompt({ title: '접수 번호 (선택)', message: '등기 번호·팩스 접수 번호가 있으면 적어 주세요.', placeholder: '없으면 비워 두세요' });
    const r = await updateDispatch(d.id, { status: 'sent', sentOn: on, receiptNo: receipt?.trim() || null });
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('보낸 기록을 남겼어요.');
    void load();
  };
  const markReplied = async (d: CreditorDispatch) => {
    const on = await askDate('회신 받은 날', `${d.creditorName} 회신(부채증명서 등)을 받은 날짜를 입력하세요. 부채증명 장부가 '받음'으로 바뀌어요.`);
    if (!on) return;
    const r = await updateDispatch(d.id, { status: 'replied', repliedOn: on });
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('회신을 기록했어요.');
    void load();
  };
  const markFailed = async (d: CreditorDispatch) => {
    const note = await dialog.prompt({ title: '못 보낸 이유', message: '예: 팩스 번호 없음, 반송', placeholder: '이유' });
    if (!note || !note.trim()) return;
    const r = await updateDispatch(d.id, { status: 'failed', sentOn: d.sentOn || localYmd(), resultNote: note.trim() });
    if (r.ok === false) { toast.error(r.message); return; }
    void load();
  };
  const remove = async (d: CreditorDispatch) => {
    const ok = await dialog.confirm({ title: '준비 기록 지우기', message: '문서 준비 기록을 지웁니다. 사건 서류함의 PDF는 남아요.', confirmText: '지우기', variant: 'warning' });
    if (!ok) return;
    const r = await deletePreparedDispatch(d.id);
    if (r.ok === false) { toast.error(r.message); return; }
    void load();
  };
  const openFile = async (d: CreditorDispatch) => {
    if (!d.filePath) { toast.error('문서 위치 정보가 없어요. 사건 서류함에서 열어 주세요.'); return; }
    const url = await getCaseFileUrl({ storagePath: d.filePath });
    if (!url) { toast.error('파일을 열지 못했어요.'); return; }
    window.open(url, '_blank', 'noopener');
  };

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Send className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />채권자 발송 (대리인 선임 통지·부채증명서 발급 요청)</h3>
        <button type="button" onClick={() => void load()} aria-label="새로고침" className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">부채증명 장부의 채권자마다 문서를 만들어 사건 서류함에 저장해요. 문안을 확인한 뒤 보내고, 보낸 날과 회신을 기록하세요. 팩스 자동 발송은 아직 열리지 않았어요. 팩스로 보냈다면 '보냄 기록'에 접수 번호를 남겨 주세요.</p>
      {officeMissing && (
        <p role="status" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">사무소 이름·주소·전화(또는 팩스)가 비어 있어요. 설정 › 사무소 설정 › 사무소 정보를 먼저 채우면 문서에 들어가요.</p>
      )}

      {error ? <p className="text-sm text-rose-700">{error}</p> : ledger === null ? (
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />
      ) : ledger.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">부채증명 장부에 채권자가 없어요. 위 장부에서 채권자를 먼저 넣어 주세요.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <label className="block"><span className="font-bold text-slate-700">채무자 이름</span>
              <input value={name} onChange={e => setName(e.target.value.slice(0, 40))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="font-bold text-slate-700">생년월일 (선택)</span>
              <input type="date" value={birth} onChange={e => setBirth(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="font-bold text-slate-700">산정기준일</span>
              <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="font-bold text-slate-700">보내는 방법</span>
              <select value={method} onChange={e => setMethod(e.target.value as DispatchMethod)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                {(['mail', 'fax', 'email', 'visit', 'other'] as DispatchMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select></label>
          </div>
          <div className="flex gap-3 flex-wrap text-xs">
            {(Object.keys(DOC_KIND_LABEL) as DispatchDocKind[]).map(k => (
              <label key={k} className="flex items-center gap-1.5 font-bold text-slate-800">
                <input type="checkbox" checked={kinds.includes(k)} onChange={e => setKinds(prev => e.target.checked ? [...prev, k] : prev.filter(x => x !== k))} />
                {DOC_KIND_LABEL[k]}
              </label>
            ))}
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {ledger.map(c => {
              const reg = matchCreditorPreset(c.creditorName);
              const last = lastByCert[c.id];
              return (
                <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
                  <input type="checkbox" aria-label={`${c.creditorName} 고르기`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{c.creditorName}{c.branch ? ` (${c.branch})` : ''}</p>
                    <p className="text-xs text-slate-600 truncate">
                      {reg ? `${reg.serviceAddress || reg.address}${reg.fax ? ` · 팩스 ${reg.fax}` : ' · 팩스 정보 없음'}` : '공용 채권자 정보에 없음 — 주소를 직접 적어 보내세요'}
                      {reg && creditorNeedsCheck(reg) && <span className="ml-1 font-bold text-amber-800">(확인 필요)</span>}
                    </p>
                  </div>
                  {last && <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{STATUS_LABEL[last.status]}</span>}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy} onClick={() => void prepare()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-60">
              <FileText className="w-4 h-4" aria-hidden="true" />{busy ? '만드는 중…' : `문서 만들기 (${selected.size}곳)`}
            </button>
            <button type="button" disabled={busy} onClick={() => void bundle()} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-60">
              <Download className="w-4 h-4" aria-hidden="true" />우편용 묶음 PDF
            </button>
          </div>
        </>
      )}

      {dispatches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-800">발송 기록</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
            {dispatches.map(d => (
              <li key={d.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{d.creditorName} · {d.docKinds.map(k => DOC_KIND_LABEL[k]).join(', ')}</p>
                  <p className="text-slate-600">
                    {STATUS_LABEL[d.status]} · {METHOD_LABEL[d.method]}
                    {d.sentOn ? ` · ${d.sentOn} 보냄` : ''}{d.receiptNo ? ` · 접수 ${d.receiptNo}` : ''}
                    {d.repliedOn ? ` · ${d.repliedOn} 회신` : ''}{d.resultNote ? ` · ${d.resultNote}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {d.filePath && <button type="button" onClick={() => void openFile(d)} className="min-h-9 px-2.5 rounded-lg border border-slate-300 font-bold whitespace-nowrap">문서 보기</button>}
                  {d.status === 'prepared' && <button type="button" onClick={() => void markSent(d)} className="min-h-9 px-2.5 rounded-lg bg-slate-900 text-white font-bold whitespace-nowrap">보냄 기록</button>}
                  {(d.status === 'prepared' || d.status === 'sent') && <button type="button" onClick={() => void markFailed(d)} className="min-h-9 px-2.5 rounded-lg border border-slate-300 font-bold whitespace-nowrap">못 보냄</button>}
                  {d.status === 'sent' && <button type="button" onClick={() => void markReplied(d)} className="min-h-9 px-2.5 rounded-lg bg-emerald-700 text-white font-bold whitespace-nowrap">회신 받음</button>}
                  {d.status === 'prepared' && <button type="button" onClick={() => void remove(d)} className="min-h-9 px-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold whitespace-nowrap">지우기</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
