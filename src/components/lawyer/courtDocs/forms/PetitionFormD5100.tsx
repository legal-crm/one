
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const PetitionFormD5100: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  return (
    <>
      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
        <h1 className="text-center text-[24px] font-bold mb-8">개인회생절차 개시신청서</h1>
        
        <table className="w-full border-collapse border border-black text-[14px] mb-4">
          <tbody>
            <tr>
              <td rowSpan={5} className="border border-black p-2 font-semibold text-center w-[15%]">신청인</td>
              <td className="border border-black p-2 font-semibold text-center w-[15%]">성명</td>
              <td className="border border-black p-2 text-left w-[27.5%]">{data.debtor.name}</td>
              <td className="border border-black p-2 font-semibold text-center w-[15%]">주민등록번호</td>
              <td className="border border-black p-2 text-left w-[27.5%]">{data.debtor.residentNumber}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">주민등록상 주소</td>
              <td colSpan={3} className="border border-black p-2 text-left">{data.debtor.residentAddress}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">현   주  소</td>
              <td colSpan={3} className="border border-black p-2 text-left">{data.debtor.currentAddress}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">송 달 장 소</td>
              <td colSpan={3} className="border border-black p-2 text-left">(송달영수인: {data.debtor.serviceRecipient || ''}) {data.debtor.serviceAddress}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">전화번호(집․직장)</td>
              <td className="border border-black p-2 text-left">{data.debtor.homePhone}</td>
              <td className="border border-black p-2 font-semibold text-center">전화번호(휴대전화)</td>
              <td className="border border-black p-2 text-left">{data.debtor.phone}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-[14px] mb-4">
          <tbody>
            <tr>
              <td rowSpan={4} className="border border-black p-2 font-semibold text-center w-[15%]">대리인</td>
              <td className="border border-black p-2 font-semibold text-center w-[15%]">성     명</td>
              <td colSpan={3} className="border border-black p-2 text-left">{data.lawyer.lawyerName}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">사무실 주소</td>
              <td colSpan={3} className="border border-black p-2 text-left">{data.lawyer.address}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">전화번호</td>
              <td colSpan={3} className="border border-black p-2 text-left">(사무실) {data.lawyer.phone}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center">이메일주소</td>
              <td className="border border-black p-2 text-left w-[27.5%]">{data.lawyer.email}</td>
              <td className="border border-black p-2 font-semibold text-center w-[15%]">팩스번호</td>
              <td className="border border-black p-2 text-left w-[27.5%]">{data.lawyer.fax}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-[14px] mb-4">
          <tbody>
            <tr>
              <td colSpan={4} className="border border-black p-2 text-left">
                주채무자가(또는 보증채무자가, 연대채무자가, 배우자가) 이미 귀 법원에 파산신청 또는 개인회생절차 개시신청을 하였으므로 그 사실을 아래와 같이 기재합니다.
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-semibold text-center w-[25%]">성  명</td>
              <td className="border border-black p-2 text-left w-[25%]"></td>
              <td className="border border-black p-2 font-semibold text-center w-[25%]">사건번호</td>
              <td className="border border-black p-2 text-left w-[25%]"></td>
            </tr>
          </tbody>
        </table>

        <div className="font-semibold text-center text-[18px] mt-8 mb-2">신 청 취 지</div>
        <div className="ml-4 mb-8">
          「신청인에 대하여 개인회생절차를 개시한다.」라는 결정을 구합니다.
        </div>

        <div className="font-semibold text-center text-[18px] mb-2">신 청 이 유</div>
        <div className="ml-4">
          <p>1. 신청인은, 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로, 파산의 원인사실이 발생하였습니다(파산의 원인사실이 생길 염려가 있습니다).</p>
          <div className="mt-2 ml-4">
            <p>
              {data.debtor.employmentType === '급여소득자' ? '☑' : '□'} 신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(급여소득자의 경우).
            </p>
            <p>
              {data.debtor.employmentType === '영업소득자' ? '☑' : '□'} 신청인은 부동산임대소득․사업소득․농업소득․임업소득 그 밖에 이와 유사한 수입을 장래에 계속적으로 또는 반복하여 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(영업소득자의 경우).
            </p>
          </div>
        </div>
      </div>

      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
        <div className="ml-4">
          <p className="mt-4">2. 신청인은 각 회생채권자에 대한 채무 전액의 변제가 곤란하므로, 그 일부를 분할하여 지급할 계획입니다. 즉 현시점에서 계획하고 있는 변제예정액은 {data.repaymentSummary.repaymentMonths}개월간 월 {(data.repaymentSummary.monthlyDisposableIncome ?? 0).toLocaleString('ko-KR')}원씩이고, 이 변제의 준비 및 절차비용지급의 준비를 위하여, 개시결정이 내려지는 경우 {data.court.firstRepaymentDate}을 제1회로 하여, 이후 매월 {data.court.firstRepaymentDate ? data.court.firstRepaymentDate.split('.')[2]?.trim() || '' : ''}일에 개시결정 시 통지되는 개인회생위원의 은행계좌에 동액의 금전을 입금하겠습니다.</p>
          <p className="mt-4">3. 이 사건 개인회생절차에서 적립금을 반환받을 신청인의 예금계좌는 {data.debtor.refundBank}은행 {data.debtor.refundAccount}이며, 신청인의 계좌가 변경되거나 어떤 사유로든 사용할 수 없게 된 경우에는 신청인은 사건담당 회생위원에게 즉시 변경된 예금계좌를 신청인의 통장사본을 첨부하여 신고하겠습니다.</p>
        </div>

        <div className="font-semibold text-center text-[18px] mt-8 mb-2">첨 부 서 류</div>
        <div className="ml-8 mb-12">
          <p>1. 개인회생채권자목록 1통</p>
          <p>2. 재산목록 1통</p>
          <p>3. 수입 및 지출에 관한 목록 1통</p>
          <p>4. 진술서 1통</p>
          <p>5. 수입인지 1통(30,000원)</p>
          <p>6. 송달료납부서 1통(송달료 10회분 ＋ (채권자 수 × 8회분))</p>
          <p>7. 신청인 본인의 예금계좌 사본 1통(대리인의 예금계좌 사본 아님)</p>
          <p>8. 위임장 1통(대리인을 통해 신청하는 경우)</p>
        </div>
        
        <table className="w-full border-collapse border border-black text-[14px] mb-8">
          <tbody>
            <tr>
              <td className="border border-black p-4 text-center">
                <div className="font-semibold text-[16px] mb-4">휴대전화를 통한 정보수신 신청서</div>
                <div className="text-left mb-4 text-[14px] leading-relaxed">
                  위 사건에 관한 개인회생절차 개시결정, 폐지결정, 면책결정, 월 변제액 3개월분 연체의 정보를 예납의무자가 납부한 송달료 잔액 범위 내에서 휴대전화를 통하여 알려 주실 것을 신청합니다.
                </div>
                <div className="text-left mb-6 font-semibold">
                  ▣ 휴대전화번호 : {data.debtor.phone}
                </div>
                <div className="text-right mb-6">
                  신청인  채무자 {data.debtor.name} (서명 또는 날인)
                </div>
                <div className="text-left text-[12px] leading-relaxed">
                  ※ 개인회생절차 개시결정, 폐지결정, 면책결정이 있거나, 변제계획 인가결정 후 월 변제액 3개월분 이상 연체 시 위 휴대전화로 문자메시지가 발송됩니다.<br />
                  ※ 문자메시지 서비스 이용 금액은 메시지 1건당 17원씩 납부된 송달료에서 지급됩니다(송달료가 부족하면 문자메시지가 발송되지 않습니다). 추후 서비스 대상 정보, 이용 금액 등이 변동될 수 있습니다.
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-center mt-12 mb-8">
          <p>{data.court.applicationDate}</p>
          <p className="mt-4">신청인              (서명 또는 날인)</p>
        </div>

        <div className="text-right text-[18px] font-bold">
          {data.court.courtName} 귀중
        </div>
      </div>
    </>
  );
};
