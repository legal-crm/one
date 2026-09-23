
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

const fmt = (v: number | undefined | null): string =>
  (v ?? 0).toLocaleString('ko-KR');

export const RepaymentScheduleTable: React.FC<CourtFormProps> = ({ data }) => {
  const { creditors, repaymentSummary, court } = data;
  const months = repaymentSummary?.repaymentMonths || 36;

  // 채권자별 변제 예정액 계산
  const getPrincipal = (c: any): number => c.principal ?? c.currentPrincipal ?? 0;
  const getInterest = (c: any): number => c.interest ?? c.currentInterest ?? 0;
  const getTotal = (c: any): number => getPrincipal(c) + getInterest(c);
  const getMonthly = (c: any): number => c.monthlyRepayment ?? 0;
  const getTotalRepay = (c: any): number => c.totalRepayment ?? (getMonthly(c) * months);

  const totalDebt = creditors.reduce((sum, c) => sum + getTotal(c), 0);
  const totalMonthly = creditors.reduce((sum, c) => sum + getMonthly(c), 0);
  const totalRepayAll = creditors.reduce((sum, c) => sum + getTotalRepay(c), 0);

  return (
    <div className="court-page bg-white pt-[120px] pb-[80px] px-[40px] w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[14px] leading-[1.6] box-border shadow-lg print:shadow-none print:border-none">
      <h1 className="text-center text-[22px] font-bold mb-2 tracking-widest">변제예정액표</h1>
      <p className="text-center text-[13px] mb-6">
        사건: {court?.caseNumber || '20    개회        '} 채무자: {data.debtor?.name || ''}
      </p>

      <div className="text-[13px] mb-4 space-y-1">
        <p>변제기간: {months}개월 ({court?.firstRepaymentDate || ''} ~ )</p>
        <p>월 가용소득: {fmt(repaymentSummary?.monthlyDisposableIncome)}원</p>
        <p>회생위원 보수: 월 가용소득의 1% 차감</p>
      </div>

      {/* 채권자별 변제예정액 총괄표 */}
      <table className="w-full border-collapse border border-black text-[12px] mb-8">
        <thead>
          <tr>
            <th className="border border-black p-2 font-semibold text-center w-10">순번</th>
            <th className="border border-black p-2 font-semibold text-center">채권자</th>
            <th className="border border-black p-2 font-semibold text-center">채권현재액</th>
            <th className="border border-black p-2 font-semibold text-center">안분비율</th>
            <th className="border border-black p-2 font-semibold text-center">월 변제액</th>
            <th className="border border-black p-2 font-semibold text-center">총 변제예정액</th>
            <th className="border border-black p-2 font-semibold text-center">변제율</th>
          </tr>
        </thead>
        <tbody>
          {creditors.map((c: any, idx: number) => (
            <tr key={c.id || idx}>
              <td className="border border-black p-2 text-center">{c.creditorNumber ?? (idx + 1)}</td>
              <td className="border border-black p-2 text-left">{c.name || ''}</td>
              <td className="border border-black p-2 text-right">{fmt(getTotal(c))}원</td>
              <td className="border border-black p-2 text-center">
                {totalDebt > 0 ? ((getTotal(c) / totalDebt) * 100).toFixed(2) : '0.00'}%
              </td>
              <td className="border border-black p-2 text-right">{fmt(getMonthly(c))}원</td>
              <td className="border border-black p-2 text-right">{fmt(getTotalRepay(c))}원</td>
              <td className="border border-black p-2 text-center">
                {getTotal(c) > 0 ? ((getTotalRepay(c) / getTotal(c)) * 100).toFixed(2) : '0.00'}%
              </td>
            </tr>
          ))}
          {/* 합계 행 */}
          <tr className="font-bold">
            <td className="border border-black p-2 text-center" colSpan={2}>합 계</td>
            <td className="border border-black p-2 text-right">{fmt(totalDebt)}원</td>
            <td className="border border-black p-2 text-center">100.00%</td>
            <td className="border border-black p-2 text-right">{fmt(totalMonthly)}원</td>
            <td className="border border-black p-2 text-right">{fmt(totalRepayAll)}원</td>
            <td className="border border-black p-2 text-center">
              {totalDebt > 0 ? ((totalRepayAll / totalDebt) * 100).toFixed(2) : '0.00'}%
            </td>
          </tr>
        </tbody>
      </table>

      {/* 월별 분할 변제 스케줄 (1~6회차 예시) */}
      <h2 className="text-[16px] font-bold mb-3">월별 변제 스케줄</h2>
      <table className="w-full border-collapse border border-black text-[10px]">
        <thead>
          <tr>
            <th className="border border-black p-1 font-semibold text-center" rowSpan={2}>회차</th>
            {creditors.slice(0, 6).map((c: any, idx: number) => (
              <th key={c.id || idx} className="border border-black p-1 font-semibold text-center">
                {c.name?.substring(0, 6) || `채권자${idx + 1}`}
              </th>
            ))}
            <th className="border border-black p-1 font-semibold text-center" rowSpan={2}>월 합계</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6].map(round => (
            <tr key={round}>
              <td className="border border-black p-1 text-center">{round}회</td>
              {creditors.slice(0, 6).map((c: any, idx: number) => (
                <td key={`${round}-${idx}`} className="border border-black p-1 text-right">
                  {fmt(getMonthly(c))}
                </td>
              ))}
              <td className="border border-black p-1 text-right font-semibold">{fmt(totalMonthly)}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-black p-1 text-center">⋮</td>
            {creditors.slice(0, 6).map((_, idx) => (
              <td key={`dots-${idx}`} className="border border-black p-1 text-center">⋮</td>
            ))}
            <td className="border border-black p-1 text-center">⋮</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1 text-center">{months}회</td>
            {creditors.slice(0, 6).map((c: any, idx: number) => (
              <td key={`last-${idx}`} className="border border-black p-1 text-right">
                {fmt(getMonthly(c))}
              </td>
            ))}
            <td className="border border-black p-1 text-right">{fmt(totalMonthly)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 text-[13px]">
        <p>※ 위 변제예정액은 인가결정 시 확정되며, 채권조사확정 결과에 따라 변동될 수 있습니다.</p>
        <p>※ 회생위원 보수는 월 변제액에서 별도 차감됩니다.</p>
      </div>
    </div>
  );
};
