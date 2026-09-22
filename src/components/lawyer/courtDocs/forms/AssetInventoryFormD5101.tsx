
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const AssetInventoryFormD5101: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const sumBankBalance = data.assets.bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const sumInsurance = data.assets.insurance.reduce((sum, ins) => sum + ins.refundAmount, 0);
  const grossAssets = data.repaymentSummary.liquidationValue + data.assets.bankDeduction + data.assets.insuranceDeduction + data.assets.leaseDeposit.exemptDeposit;
  const exemptAssets = data.assets.bankDeduction + data.assets.insuranceDeduction + data.assets.leaseDeposit.exemptDeposit;

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
      <div className="text-left mb-4">[신청서 첨부서류 2]</div>
      <h1 className="text-center text-[24px] font-bold mb-8">재 산 목 록</h1>
      
      <table className="w-full border-collapse border border-black text-[14px]">
        <thead>
          <tr>
            <th className="border border-black p-2 bg-gray-50 text-center w-[20%]">명   칭</th>
            <th className="border border-black p-2 bg-gray-50 text-center w-[20%]">금액 또는 시가<br/>(단위: 원)</th>
            <th className="border border-black p-2 bg-gray-50 text-center w-[15%]">압류 유무</th>
            <th className="border border-black p-2 bg-gray-50 text-center w-[45%]">비     고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">현금</td>
            <td className="border border-black p-2 text-right">{(data.assets.cash ?? 0).toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2"></td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">예금</td>
            <td className="border border-black p-2 text-right">{sumBankBalance.toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="border-b border-black py-1">금융기관명</td>
                    <td className="border-b border-black py-1">계좌번호</td>
                    <td className="border-b border-black py-1 text-right">잔고</td>
                  </tr>
                  {data.assets.bankAccounts.map((acc, idx) => (
                    <tr key={idx}>
                      <td className="py-1">({idx + 1}) {acc.bankName}</td>
                      <td className="py-1">{acc.accountNumber}</td>
                      <td className="text-right py-1">{(acc.balance ?? 0).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                  {data.assets.bankAccounts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-1 text-gray-400">없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">보험</td>
            <td className="border border-black p-2 text-right">{sumInsurance.toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="border-b border-black py-1">보험회사명</td>
                    <td className="border-b border-black py-1">증권번호</td>
                    <td className="border-b border-black py-1 text-right">해약반환금</td>
                  </tr>
                  {data.assets.insurance.map((ins, idx) => (
                    <tr key={idx}>
                      <td className="py-1">({idx + 1}) {ins.companyName}</td>
                      <td className="py-1">{ins.policyNumber}</td>
                      <td className="text-right py-1">{(ins.refundAmount ?? 0).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                  {data.assets.insurance.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-1 text-gray-400">없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">자동차<br/>(오토바이 포함)</td>
            <td className="border border-black p-2 text-right">{(data.assets.vehicle.netValue ?? 0).toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2 text-sm">
               평가액 {(data.assets.vehicle.estimatedValue ?? 0).toLocaleString('ko-KR')}원 - 피담보채무액 {(data.assets.vehicle.securedLoan ?? 0).toLocaleString('ko-KR')}원
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">임차보증금<br/><span className="text-[12px] font-normal">(반환받을 금액을 금액란에 적는다.)</span></td>
            <td className="border border-black p-2 text-right">{(data.assets.leaseDeposit.netValue ?? 0).toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               <div className="mb-1">임차물건: {data.assets.leaseDeposit.address}</div>
               <div className="mb-1">보증금 및 월세: 보증금 {(data.assets.leaseDeposit.deposit ?? 0).toLocaleString('ko-KR')}원 / 월세 {(data.assets.leaseDeposit.monthlyRent ?? 0).toLocaleString('ko-KR')}원</div>
               <div>차이 나는 사유: </div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">부동산<br/><span className="text-[12px] font-normal">(환가예상액에서 피담보채권을 뺀 금액을 금액란에 적는다.)</span></td>
            <td className="border border-black p-2 text-right">{(data.assets.realEstate.netValue ?? 0).toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               <div className="mb-1">소재지,면적: {data.assets.realEstate.address} ({data.assets.realEstate.area})</div>
               <div className="mb-1">부동산의 종류: 토지(  ), 건물(  ), 집합건물(  )</div>
               <div className="mb-1">환가예상액: {(data.assets.realEstate.marketValue ?? 0).toLocaleString('ko-KR')}</div>
               <div>담보권 설정된 경우 그 종류 및 담보액: {(data.assets.realEstate.mortgage ?? 0).toLocaleString('ko-KR')}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">사업용 설비,<br/>재고품, 비품 등</td>
            <td className="border border-black p-2 text-right">0</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               <div>품목, 개수: </div>
               <div>구입 시기: </div>
               <div>평가액: </div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">대여금 채권</td>
            <td className="border border-black p-2 text-right">0</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               <div>상대방 채무자 1: <span className="float-right">□ 소명자료 별첨</span></div>
               <div>상대방 채무자 2: <span className="float-right">□ 소명자료 별첨</span></div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">매출금 채권</td>
            <td className="border border-black p-2 text-right">0</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               <div>상대방 채무자 1: <span className="float-right">□ 소명자료 별첨</span></div>
               <div>상대방 채무자 2: <span className="float-right">□ 소명자료 별첨</span></div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">예상 퇴직금</td>
            <td className="border border-black p-2 text-right">{(data.assets.severancePay.netValue ?? 0).toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2">
               근무처: {data.assets.severancePay.company} (압류할 수 없는 퇴직금 {(data.assets.severancePay.exemptAmount ?? 0).toLocaleString('ko-KR')}원 제외)
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">기타 (        )</td>
            <td className="border border-black p-2 text-right">0</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2"></td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-bold">합계</td>
            <td className="border border-black p-2 text-right font-bold">{grossAssets.toLocaleString('ko-KR')}</td>
            <td className="border border-black p-2 text-center"></td>
            <td className="border border-black p-2"></td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-semibold">면제재산 결정신청 금액</td>
            <td className="border border-black p-2 text-right">{exemptAssets.toLocaleString('ko-KR')}</td>
            <td colSpan={2} className="border border-black p-2">
              면제재산 결정신청 내용:
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 text-center font-bold">청산가치</td>
            <td className="border border-black p-2 text-right font-bold text-red-600">{(data.repaymentSummary.liquidationValue ?? 0).toLocaleString('ko-KR')}</td>
            <td colSpan={2} className="border border-black p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
