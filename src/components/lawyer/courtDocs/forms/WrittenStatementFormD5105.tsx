
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const WrittenStatementFormD5105: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const { statement, stayCases } = data;

  return (
    <>
      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0] box-border shadow-lg print:shadow-none print:border-none" style={{ pageBreakAfter: 'always' }}>
        <h1 className="text-center text-[24px] font-bold mb-8">[신청서 첨부서류 4]<br/>진 술 서</h1>
        
        <h2 className="text-[18px] font-bold mb-2">I. 경력</h2>
        
        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">1. 최종 학력</h3>
          <div className="border border-black p-4 text-center">
            {statement.education || '                                           학교 ( 졸업,  중퇴 )'}
          </div>
        </div>

        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">2. 과거 경력 (최근 경력부터 기재하여 주십시오.)</h3>
          <table className="w-full border-collapse border border-black text-[14px] text-center">
            <tbody>
              <tr>
                <td className="border border-black font-semibold p-2 w-[15%]">기간</td>
                <td className="border border-black p-2 text-left" colSpan={5}>
                  년    월    일부터          현재까지 (자영, 근무)
                </td>
              </tr>
              <tr>
                <td className="border border-black font-semibold p-2">업종</td>
                <td className="border border-black p-2 w-[20%]"></td>
                <td className="border border-black font-semibold p-2 w-[15%]">직장명</td>
                <td className="border border-black p-2 w-[20%]"></td>
                <td className="border border-black font-semibold p-2 w-[10%]">직위</td>
                <td className="border border-black p-2 w-[20%]"></td>
              </tr>
              <tr>
                <td className="border border-black font-semibold p-2 w-[15%]">기간</td>
                <td className="border border-black p-2 text-left" colSpan={5}>
                  년    월    일부터          년    월    일까지 (자영, 근무)
                </td>
              </tr>
              <tr>
                <td className="border border-black font-semibold p-2">업종</td>
                <td className="border border-black p-2"></td>
                <td className="border border-black font-semibold p-2">직장명</td>
                <td className="border border-black p-2"></td>
                <td className="border border-black font-semibold p-2">직위</td>
                <td className="border border-black p-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">3. 과거 결혼, 이혼 경력</h3>
          <div className="border border-black p-4 text-center whitespace-pre-line leading-loose">
            {statement.maritalHistory || `년    월    일             와 (결혼, 이혼)\n년    월    일             와 (결혼, 이혼)`}
          </div>
        </div>

        <h2 className="text-[18px] font-bold mb-2 mt-8">II. 현재 주거 상황</h2>
        <div className="ml-4 mb-2">
          거주를 시작한 시점   ( {statement.housingStartDate || '     년    월    일'} )
        </div>
        <table className="w-full border-collapse border border-black text-[14px]">
          <thead>
            <tr>
              <th className="border border-black font-semibold p-2 w-[40%] text-center">거주 상황(해당란에 표시)</th>
              <th className="border border-black font-semibold p-2 w-[60%] text-center">상세한 내역</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '신청인 소유' ? '☑' : '☐'} ㉠ 신청인 소유의 주택
              </td>
              <td className="border border-black p-2" rowSpan={6}>
                {statement.housingDetail || (
                  <div className="leading-loose">
                    임대보증금 (               원)<br/>
                    임대료 (월          원), 연체액 (             원)<br/>
                    임차인 성명 (                 )<br/>
                    소유자 성명 (                 )<br/>
                    신청인과의 관계 (             )
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '사택 또는 기숙사' ? '☑' : '☐'} ㉡ 사택 또는 기숙사
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '임차(전월세) 주택' ? '☑' : '☐'} ㉢ 임차(전․월세) 주택
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '친족 소유 무상거주' ? '☑' : '☐'} ㉣ 친족 소유 주택에 무상 거주
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '친족 이외 무상거주' ? '☑' : '☐'} ㉤ 친족 외 소유 주택에 무상 거주
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2">
                {statement.housingType === '기타' ? '☑' : '☐'} ㉥ 기타(                      )
              </td>
            </tr>
          </tbody>
        </table>
        <div className="text-[13px] mt-2 ml-4">
          ☆ ㉠ 또는 ㉣항을 선택한 분은 주택의 등기부등본을 첨부하여 주십시오.<br/>
          ☆ ㉡ 또는 ㉢항을 선택한 분은 임대차계약서(전월세 계약서) 또는 사용허가서 사본을 첨부하여 주시기 바랍니다.<br/>
          ☆ ㉣ 또는 ㉤항을 선택한 분은 소유자 작성의 거주 증명서를 첨부하여 주십시오.
        </div>
      </div>

      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0] box-border shadow-lg print:shadow-none print:border-none" style={{ pageBreakAfter: 'always' }}>
        <h2 className="text-[18px] font-bold mb-2">III. 부채 상황</h2>
        
        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">1. 채권자로부터 소송․지급명령․전부명령․압류․가압류 등을 받은 경험 ({statement.hasLitigationOrSeizure ? '☑ 있음, ☐ 없음' : '☐ 있음, ☑ 없음'})</h3>
          <table className="w-full border-collapse border border-black text-[14px] text-center">
            <thead>
              <tr>
                <th className="border border-black font-semibold p-2 w-[25%]">내   역</th>
                <th className="border border-black font-semibold p-2 w-[25%]">채권자</th>
                <th className="border border-black font-semibold p-2 w-[25%]">관할법원</th>
                <th className="border border-black font-semibold p-2 w-[25%]">사건번호</th>
              </tr>
            </thead>
            <tbody>
              {stayCases && stayCases.length > 0 ? (
                stayCases.map((c, i) => (
                  <tr key={i}>
                    <td className="border border-black p-2">{c.caseType}</td>
                    <td className="border border-black p-2">{c.creditorName}</td>
                    <td className="border border-black p-2">{c.courtName}</td>
                    <td className="border border-black p-2">{c.caseNumber}</td>
                  </tr>
                ))
              ) : (
                <>
                  <tr>
                    <td className="border border-black p-2 h-10"></td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 h-10"></td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <div className="text-[13px] mt-2">
            ☆ 위 내역란에는 소송, 지급명령, 압류 등으로 그 내용을 기재합니다.<br/>
            ☆ 위 기재 사항에 해당하는 소장․지급명령․전부명령․압류 및 가압류결정의 각 사본을 첨부하여 주십시오.
          </div>
        </div>

        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">2. 개인회생절차에 이르게 된 사정(여러 항목 중복 선택 가능)</h3>
          <div className="border border-black p-4 text-[14px] leading-loose">
            {['생활비 부족', '사업 실패', '보증 채무', '투자 손실', '도박 등', '과소비', '의료비', '기타'].map(cause => (
              <span key={cause} className="inline-block mr-6">
                {(statement.debtCauses || []).includes(cause) ? '☑' : '☐'} {cause}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-6 ml-4">
          <h3 className="font-bold mb-2">3. 채무자가 많은 채무를 부담하게 된 사정 및 개인회생절차 개시의 신청에 이르게 된 사정에 관하여 구체적으로 기재하여 주십시오(추가 기재 시에는 별지를 이용하시면 됩니다).</h3>
          <div className="border border-black p-6 min-h-[300px] whitespace-pre-wrap text-[15px] leading-relaxed text-justify">
            {statement.detailedReasonEssay || ''}
          </div>
        </div>
      </div>
    </>
  );
};
