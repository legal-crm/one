// 의뢰인 '내 사건' › 부채증명서 진행 (DC-10, CM-11)
// "○곳 중 ○곳 받음"과 발급 중 주의사항만 보여 준다. 금액은 사무소가 켠 경우에만(기본 끔, DC-Q9).
import { useEffect, useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { DEBT_LEDGER_CHANGED_EVENT, loadClientDebtProgress, type ClientDebtProgress } from '../../../services/debt/debtLedgerService';

export default function MyDebtCertProgress({ caseKey }: { caseKey: string }) {
  const [p, setP] = useState<ClientDebtProgress | null>(null);
  useEffect(() => {
    let cancel = false;
    const load = () => void loadClientDebtProgress(caseKey).then(v => { if (!cancel) setP(v); });
    load();
    window.addEventListener(DEBT_LEDGER_CHANGED_EVENT, load);
    return () => { cancel = true; window.removeEventListener(DEBT_LEDGER_CHANGED_EVENT, load); };
  }, [caseKey]);
  if (!p || p.total === 0) return null;
  const allDone = p.received + p.unavailable >= p.total;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2" aria-label="부채증명서 진행">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" /> 부채증명서 {p.total}곳 중 {p.received}곳 받음
      </p>
      {!allDone && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> 발급 중에 알아 두세요</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>증명서를 발급하면 해당 금융기관의 카드·계좌 이용이 멈출 수 있어요. 급여·자동이체 계좌는 미리 사무소와 상의해 주세요.</li>
            <li>금융기관에서 본인 확인 전화가 올 수 있어요. 받으셔서 확인해 주세요.</li>
            <li>인감증명서가 채권자 수만큼 더 필요할 수 있어요. 사무소가 안내한 부수를 준비해 주세요.</li>
          </ul>
        </div>
      )}
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {p.items.map((it, i) => (
          <li key={`${it.name}-${i}`} className={`px-2 py-1 rounded-lg border ${it.received ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : it.unavailable ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`}>
            {it.name} · {it.received ? '받음' : it.unavailable ? '다른 자료로 대신' : '발급 중'}{typeof it.principal === 'number' ? ` · 원금 ${it.principal.toLocaleString('ko-KR')}원` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
