// 보정 항목 → 부채증명 장부 채권자 줄 (DC-11)
// 보정권고에 부채증명·채권액·대위변제·양도 같은 항목이 오면, 원문에 이름이 나온 채권자 줄을 보여 주고 장부로 바로 간다.
import { useEffect, useState } from 'react';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { STATUS_LABEL as CERT_STATUS_LABEL, type DebtCertificate } from '../../../services/debt/debtLedgerRules';
import { loadDebtLedger } from '../../../services/debt/debtLedgerService';
import { isDebtRelatedCorrection, matchLedgerRows } from '../../../services/corrections/correctionDebtMatch';

const ledgerCache = new Map<string, Promise<DebtCertificate[]>>();
function ledgerOf(officeId: string, caseKey: string): Promise<DebtCertificate[]> {
  const k = `${officeId}|${caseKey}`;
  let p = ledgerCache.get(k);
  if (!p) {
    p = loadDebtLedger(officeId, caseKey).then(r => (r.ok ? r.data : []));
    ledgerCache.set(k, p);
    window.setTimeout(() => ledgerCache.delete(k), 30_000);
  }
  return p;
}

export default function CorrectionDebtLink({ officeId, caseKey, text, onOpen }: {
  officeId: string; caseKey: string; text: string; onOpen: (certId?: string) => void;
}) {
  const related = isDebtRelatedCorrection(text);
  const [rows, setRows] = useState<DebtCertificate[] | null>(null);
  useEffect(() => {
    if (!related) return;
    let cancel = false;
    void ledgerOf(officeId, caseKey).then(list => { if (!cancel) setRows(list); });
    return () => { cancel = true; };
  }, [related, officeId, caseKey]);
  if (!related) return null;
  const matched = rows ? matchLedgerRows(text, rows) : [];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />부채증명 장부와 연결된 항목이에요</p>
      {rows === null ? (
        <div className="h-8 rounded-lg bg-amber-100/60 animate-pulse" aria-busy="true" />
      ) : matched.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {matched.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)}
                className="min-h-[40px] px-3 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-900 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] hover:bg-amber-100">
                {r.seq}. {r.creditorName} · {CERT_STATUS_LABEL[r.status]}{r.values.baseDate ? ` · 기준 ${r.values.baseDate}` : ''}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-amber-900 flex-1">원문에서 장부의 채권자 이름을 찾지 못했어요. 장부에서 해당 채권자를 확인해 주세요.</p>
          <button type="button" onClick={() => onOpen()} className="min-h-[40px] px-3 rounded-xl bg-white border border-amber-200 text-xs font-bold text-amber-900 whitespace-nowrap active:scale-[0.98]">부채증명 장부 열기</button>
        </div>
      )}
    </div>
  );
}
