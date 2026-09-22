
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 위임장 — 법원 표준 양식 (A4 법원규격)
 */
export const PowerOfAttorneyForm: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court } = data;
  const applicationDate = court?.applicationDate || '20  .   .   .';

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">
      
      <h1 className="text-center text-[28px] font-bold mb-12 tracking-[0.5em]">위  임  장</h1>

      {/* 사건 정보 */}
      <table className="w-full border-collapse border border-black text-[14px] mb-8">
        <tbody>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center w-28">사    건</td>
            <td className="border border-black p-3">{court?.caseNumber || '20    개회        '} 호 개인회생</td>
          </tr>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center">신 청 인<br/>(채무자)</td>
            <td className="border border-black p-3">
              <div>성    명: {debtor?.name || ''}</div>
              <div>주민등록번호: {debtor?.residentNumber || ''}</div>
              <div>주    소: {debtor?.address || ''}</div>
              <div>연 락 처: {debtor?.phone || ''}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 위임 내용 */}
      <div className="mb-8">
        <p className="indent-8 mb-4">
          위 사건에 관하여 다음 사람을 대리인으로 정하고, 아래 기재 사항에 관한 일체의 권한을 위임합니다.
        </p>
      </div>

      {/* 대리인 정보 */}
      <table className="w-full border-collapse border border-black text-[14px] mb-8">
        <tbody>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center w-28" rowSpan={4}>대 리 인</td>
            <td className="border border-black p-3 bg-gray-50 font-semibold w-28 text-center">성    명</td>
            <td className="border border-black p-3">{court?.lawyerName || ''} 변호사</td>
          </tr>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center">소    속</td>
            <td className="border border-black p-3">{court?.lawyerFirm || ''}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center">주    소</td>
            <td className="border border-black p-3">{debtor?.serviceAddress || ''}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 bg-gray-50 font-semibold text-center">연 락 처</td>
            <td className="border border-black p-3">{debtor?.phone || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 위임 사항 */}
      <div className="border border-black p-4 mb-8">
        <h3 className="font-bold text-center mb-4 text-[16px]">위 임 사 항</h3>
        <div className="space-y-2 text-[14px]">
          <p>1. 개인회생절차 개시신청에 관한 일체의 행위</p>
          <p>2. 변제계획안의 제출, 수정 및 변경에 관한 일체의 행위</p>
          <p>3. 채권자목록의 제출, 수정에 관한 일체의 행위</p>
          <p>4. 개인회생절차에서의 심문, 조사, 이의 등에 관한 일체의 행위</p>
          <p>5. 송달 수령에 관한 행위</p>
          <p>6. 기타 위 사건에 관하여 필요한 일체의 소송행위</p>
        </div>
      </div>

      {/* 서명란 */}
      <div className="mt-16 text-center">
        <p className="mb-8">{applicationDate}</p>
        <p className="mb-2 font-bold text-[16px]">
          위임인(채무자) {debtor?.name || ''}{'  '} (서명 또는 날인)
        </p>
      </div>

      <div className="mt-12 text-center text-[18px] font-bold">
        {court?.courtName || '서울회생법원'} 귀중
      </div>
    </div>
  );
};
