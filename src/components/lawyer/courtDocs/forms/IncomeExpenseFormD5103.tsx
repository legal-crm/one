
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const IncomeExpenseFormD5103: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const { debtor, repaymentSummary, monthlyLedger, ledgerTotals } = data;

  const isBelow60 = repaymentSummary.medianIncomeRatio <= 60;
  const isAbove60 = repaymentSummary.medianIncomeRatio > 60;

  return (
    <>
      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
        <h1 className="text-center text-[24px] font-bold mb-8">[신청서 첨부서류 3]<br/>수입 및 지출에 관한 목록</h1>
        
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-[18px] font-bold">I. 현재의 수입 목록</h2>
          <span className="text-[14px]">(단위: 원)</span>
        </div>
        
        <table className="w-full border-collapse border border-black text-[14px] mb-8 text-center">
          <tbody>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2" rowSpan={2} colSpan={1}>수입 상황</td>
              <td className="border border-black bg-gray-50 font-semibold p-2" colSpan={2}>자영(상호)</td>
              <td className="border border-black bg-gray-50 font-semibold p-2" colSpan={2}>고용(직장명)</td>
            </tr>
            <tr>
              <td className="border border-black p-2" colSpan={2}>{debtor.employmentType === '영업소득자' ? debtor.workplaceName : ''}</td>
              <td className="border border-black p-2" colSpan={2}>{debtor.employmentType === '급여소득자' ? debtor.workplaceName : ''}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2">업종</td>
              <td className="border border-black p-2" colSpan={2}></td>
              <td className="border border-black bg-gray-50 font-semibold p-2">직위</td>
              <td className="border border-black p-2">{debtor.jobTitle}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2">종사 경력</td>
              <td className="border border-black p-2" colSpan={4}>{debtor.tenureYearsMonths}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2">근무 기간</td>
              <td className="border border-black p-2" colSpan={4}></td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2">명목</td>
              <td className="border border-black bg-gray-50 font-semibold p-2">기간 구분</td>
              <td className="border border-black bg-gray-50 font-semibold p-2">금액</td>
              <td className="border border-black bg-gray-50 font-semibold p-2">연간 환산 금액</td>
              <td className="border border-black bg-gray-50 font-semibold p-2">압류, 가압류 등 유무</td>
            </tr>
            <tr>
              <td className="border border-black p-2">급여</td>
              <td className="border border-black p-2">월간</td>
              <td className="border border-black p-2 text-right">{ledgerTotals.monthlyAverageIncome.toLocaleString('ko-KR')}</td>
              <td className="border border-black p-2 text-right">{ledgerTotals.annualNetIncome.toLocaleString('ko-KR')}</td>
              <td className="border border-black p-2">{repaymentSummary.hasGarnishment ? '있음' : '없음'}</td>
            </tr>
            <tr>
              <td className="border border-black p-2">상여금 등</td>
              <td className="border border-black p-2">연간</td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2" colSpan={2}>연 수입</td>
              <td className="border border-black p-2 text-right" colSpan={3}>{ledgerTotals.annualNetIncome.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-2" colSpan={2}>월 평균 수입 ( {ledgerTotals.annualNetIncome.toLocaleString('ko-KR')} ÷ 12 )</td>
              <td className="border border-black p-2 text-right" colSpan={3}>{ledgerTotals.monthlyAverageIncome.toLocaleString('ko-KR')}원</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-[18px] font-bold mb-2">II. 변제 계획 수행 시의 예상 지출 목록 <span className="text-[14px] font-normal">(해당란에 ☑ 표시)</span></h2>
        <div className="border border-black p-4 mb-8 text-[15px]">
          <div className="mb-4">
            <span>{isBelow60 ? '☑' : '☐'} 채무자가 예상하는 생계비가 보건복지부 공표 기준 중위소득의 100분의 60 이하인 경우</span>
            <div className="ml-6 mt-1">
              보건복지부 공표 ({repaymentSummary.householdSize})인 가구 기준 중위소득 ({repaymentSummary.medianIncomeAmount.toLocaleString('ko-KR')})원의 약 ({repaymentSummary.medianIncomeRatio.toFixed(1)})%인 ({repaymentSummary.monthlyLivingCost.toLocaleString('ko-KR')})원을 지출할 것으로 예상됩니다.
            </div>
          </div>
          <div>
            <span>{isAbove60 ? '☑' : '☐'} 채무자가 예상하는 생계비가 보건복지부 공표 기준 중위소득의 100분의 60을 초과하는 경우</span>
            <div className="ml-6 mt-1">
              보건복지부 공표 ({repaymentSummary.householdSize})인 가구 기준 중위소득 ({repaymentSummary.medianIncomeAmount.toLocaleString('ko-KR')})원의 약 ({repaymentSummary.medianIncomeRatio.toFixed(1)})%인 ({(repaymentSummary.monthlyLivingCost + repaymentSummary.additionalLivingCost).toLocaleString('ko-KR')})원을 지출할 것으로 예상됩니다(뒷면 표에 내역과 사유를 상세히 기재하십시오).
            </div>
          </div>
        </div>

        <h2 className="text-[18px] font-bold mb-2">III. 가족관계</h2>
        <table className="w-full border-collapse border border-black text-[14px] text-center">
          <thead>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[10%]">관계</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[15%]">성명</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[10%]">연령</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[20%]">동거 여부 및 기간</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[15%]">직업</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[10%]">월 수입</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[10%]">재산 총액</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[10%]">부양 유무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 h-10"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
            <tr>
              <td className="border border-black p-2 h-10"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
            <tr>
              <td className="border border-black p-2 h-10"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
        <h1 className="text-center text-[24px] font-bold mb-8">[별지] 월평균소득 산출 내역서</h1>
        
        <table className="w-full border-collapse border border-black text-[11px] mb-8 text-center" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-1 w-[8%]">소득내용</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <th key={`month-header-${m}`} className="border border-black bg-gray-50 font-semibold p-1">{m}월</th>
              ))}
              <th className="border border-black bg-gray-50 font-semibold p-1 w-[10%]">합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">기본급</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`base-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.baseIncome?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{ledgerTotals.annualTotalIncome.toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">상여금</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`bonus-${i}`} className="border border-black p-1"></td>
              ))}
              <td className="border border-black p-1 text-right">0</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">소득합계</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`total-income-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.baseIncome?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{ledgerTotals.annualTotalIncome.toLocaleString('ko-KR')}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-[11px] mb-8 text-center" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-1 w-[8%]">공제내용</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <th key={`deduct-header-${m}`} className="border border-black bg-gray-50 font-semibold p-1">{m}월</th>
              ))}
              <th className="border border-black bg-gray-50 font-semibold p-1 w-[10%]">합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">소득세</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`tax-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.incomeTax?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.incomeTax || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">지방소득세</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`local-tax-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.localTax?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.localTax || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">건강보험</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`health-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.healthIns?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.healthIns || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">국민연금</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`pension-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.nationalPension?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.nationalPension || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">고용보험</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`employ-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.employmentIns?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.employmentIns || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">장기요양</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`ltcare-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.longTermCareIns?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{monthlyLedger.reduce((sum, row) => sum + (row.longTermCareIns || 0), 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">공제합계</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`total-deduct-${i}`} className="border border-black p-1 truncate">{monthlyLedger[i]?.totalDeduction?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right">{ledgerTotals.annualTotalDeductions.toLocaleString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 font-semibold p-1">실수령</td>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                <td key={`net-${i}`} className="border border-black p-1 truncate font-semibold text-blue-600">{monthlyLedger[i]?.netIncome?.toLocaleString('ko-KR') || ''}</td>
              ))}
              <td className="border border-black p-1 text-right font-semibold text-blue-600">{ledgerTotals.annualNetIncome.toLocaleString('ko-KR')}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-[14px] text-center">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[20%]">종합결산</th>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[20%]">연 소득총액</th>
              <td className="border border-black p-2 text-right">{ledgerTotals.annualTotalIncome.toLocaleString('ko-KR')}원</td>
              <th className="border border-black bg-gray-50 font-semibold p-2 w-[20%]">연 공제총액</th>
              <td className="border border-black p-2 text-right">{ledgerTotals.annualTotalDeductions.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2">연 실수령액</th>
              <td className="border border-black p-2 text-right" colSpan={4}>{ledgerTotals.annualNetIncome.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2 text-blue-700">월평균수입</th>
              <td className="border border-black p-2 text-right font-bold text-blue-700" colSpan={4}>{ledgerTotals.monthlyAverageIncome.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2 text-red-700">기준중위소득 조정금액</th>
              <td className="border border-black p-2 text-right font-bold text-red-700" colSpan={4}>{(repaymentSummary.monthlyLivingCost + repaymentSummary.additionalLivingCost).toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 font-semibold p-2 text-green-700">월평균가용소득</th>
              <td className="border border-black p-2 text-right font-bold text-green-700" colSpan={4}>{repaymentSummary.monthlyDisposableIncome.toLocaleString('ko-KR')}원</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
};
