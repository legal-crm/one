
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const RepaymentPlanFormD5110: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const { repaymentSummary, court, trusteeAccount, creditors } = data;

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">
      <h1 className="text-center text-[24px] font-bold mb-8">변제계획안</h1>
      <p className="text-center text-[16px] mb-8">(가용소득만으로 변제하는 경우)</p>
      
      <div className="mb-8">
        <h3 className="font-bold mb-2">제1조 (변제기간)</h3>
        <p>변제기간은 인가일로부터 {repaymentSummary.repaymentMonths}개월간으로 한다.</p>
        <p>최초 변제일: {court.firstRepaymentDate || ''}</p>
      </div>

      <div className="mb-8">
        <h3 className="font-bold mb-2">제2조 (변제에 제공되는 소득)</h3>
        <table className="w-full border-collapse border border-black text-[14px]">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">월평균수입</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">기준중위소득 대비 생계비</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">월 가용소득</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 text-right">{repaymentSummary.monthlyNetIncome.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right">
                {repaymentSummary.monthlyLivingCost.toLocaleString('ko-KR')}원 
                {repaymentSummary.additionalLivingCost > 0 ? ` (추가 ${repaymentSummary.additionalLivingCost.toLocaleString('ko-KR')}원 포함)` : ''}
              </td>
              <td className="border border-black p-2 text-right font-bold">{repaymentSummary.monthlyDisposableIncome.toLocaleString('ko-KR')}원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h3 className="font-bold mb-2">제3조 (개인회생재단채권에 대한 변제)</h3>
        <p>
          {repaymentSummary.isExternalTrustee 
            ? '외부회생위원 보수로 월 가용소득의 1%를 차감하여 지급한다.'
            : '내부회생위원 보수 등 개인회생재단채권은 발생 즉시 수시로 변제한다 (보수 없음).'}
        </p>
      </div>

      <div className="mb-8" style={{ pageBreakBefore: 'always' }}>
        <h3 className="font-bold mb-2">제4조 (일반 개인회생채권에 대한 변제)</h3>
        <p>1. 우선권 있는 개인회생채권: 전액 변제한다.</p>
        <p>2. 일반 개인회생채권: 안분 배당한다.</p>
        <div className="mt-4">
          <h4 className="font-semibold mb-2">채권자별 변제예정액 분배표</h4>
          <table className="w-full border-collapse border border-black text-[14px]">
            <thead>
              <tr>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">순번</th>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">채권자명</th>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">채권현재액</th>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">월 변제예정액</th>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">총 변제예정액</th>
                <th className="border border-black p-2 bg-gray-50 font-semibold text-center">변제율</th>
              </tr>
            </thead>
            <tbody>
              {creditors.map((c) => (
                <tr key={c.id}>
                  <td className="border border-black p-2 text-center">{c.creditorNumber}</td>
                  <td className="border border-black p-2 text-left">{c.name}</td>
                  <td className="border border-black p-2 text-right">{(c.principal + c.interest).toLocaleString('ko-KR')}원</td>
                  <td className="border border-black p-2 text-right">{c.monthlyRepayment.toLocaleString('ko-KR')}원</td>
                  <td className="border border-black p-2 text-right">{c.totalRepayment.toLocaleString('ko-KR')}원</td>
                  <td className="border border-black p-2 text-center">{(c.repaymentRate).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-bold mb-2">제5조 (회생위원 예치계좌 및 납입 기일)</h3>
        <p>계좌정보: {trusteeAccount?.bank || '________ 은행'} {trusteeAccount?.accountNumber || '________________'}</p>
        <p>예금주: {court.courtName} 회생위원</p>
      </div>

      <div className="mb-8">
        <h3 className="font-bold mb-2">제6조 (청산가치 보장의 원칙 확인)</h3>
        <table className="w-full border-collapse border border-black text-[14px]">
          <tbody>
            <tr>
              <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-1/2">총변제액의 현재가치</td>
              <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-1/2">신청인의 재산 (청산가치)</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center">{repaymentSummary.totalRepaymentAmount.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-center">{repaymentSummary.liquidationValue.toLocaleString('ko-KR')}원</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-center font-bold">
          {repaymentSummary.totalRepaymentAmount >= repaymentSummary.liquidationValue 
            ? '총변제액의 현재가치가 청산가치 이상이므로 청산가치 보장의 원칙을 충족함.' 
            : '총변제액의 현재가치가 청산가치보다 적어 청산가치 보장의 원칙에 위배될 우려가 있음.'}
        </p>
      </div>
    </div>
  );
};
