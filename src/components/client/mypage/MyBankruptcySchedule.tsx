// 의뢰인 '내 사건' › 파산 진행 일정 (BK-5·BK-8)
// 진행 날짜만 보여 준다. 동시폐지·면책 가능성 같은 판단은 보여 주지 않는다(제109조).
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { loadClientBankruptcySchedule, type ClientBankruptcySchedule } from '../../../services/cases/bankruptcyCaseService';
import { localYmd } from '../../../utils/localDate';

const ROWS: Array<[keyof ClientBankruptcySchedule, string, string]> = [
  ['filedOn', '법원 접수', ''],
  ['depositDueOn', '예납금 납부 기한', '법원이 정한 예납금을 기한 안에 내야 절차가 이어져요. 금액은 사무소가 안내해요.'],
  ['declaredOn', '파산선고', '선고 뒤 관재인이 연락해 면담과 자료를 요청할 수 있어요.'],
  ['trusteeInterviewOn', '관재인 면담', '요청받은 자료를 챙겨 가 주세요. 모르는 질문은 사무소에 먼저 물어봐 주세요.'],
  ['creditorsMeetingOn', '채권자집회', '사무소가 함께 준비해요. 참석 여부는 사무소 안내를 따라 주세요.'],
  ['dischargeHearingOn', '면책심문', '법원이 부르면 꼭 출석해야 해요. 출석하지 않으면 불이익이 있을 수 있어요.'],
  ['dischargeDecidedOn', '면책 결정', ''],
  ['dischargeConfirmedOn', '면책 확정', '확정 뒤 남은 압류 해제 등은 사무소가 안내해요.'],
];

export default function MyBankruptcySchedule({ caseId }: { caseId: string }) {
  const [s, setS] = useState<ClientBankruptcySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadClientBankruptcySchedule(caseId).then(r => {
      if (cancelled) return;
      if (r.ok === false) setError(r.message); else setS(r.data);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  if (error) return <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>;
  if (!s) return null;
  const rows = ROWS.filter(([k]) => !!s[k]);
  if (rows.length === 0) return null;
  const today = localYmd();
  return (
    <section className="mt-4 rounded-2xl border border-purple-200 bg-white p-3 space-y-2" aria-label="파산 진행 일정">
      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-purple-600" aria-hidden="true" /> 파산·면책 진행 일정</p>
      <ol className="space-y-1.5">
        {rows.map(([k, label, tip]) => {
          const d = String(s[k]);
          const upcoming = d >= today;
          return (
            <li key={k} className={`rounded-xl px-3 py-2 border ${upcoming ? 'border-purple-200 bg-purple-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-sm font-bold text-slate-900">{d} · {label}{upcoming ? ' (예정)' : ''}</p>
              {tip && upcoming && <p className="text-xs text-slate-600 mt-0.5">{tip}</p>}
            </li>
          );
        })}
      </ol>
      {s.depositPaid && <p className="text-xs text-emerald-700">예납금 납부가 확인됐어요.</p>}
    </section>
  );
}
