
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 송달장소 및 송달영수인 신고서 — 법원 표준 양식 (A4 규격)
 */
export const ServiceReportForm: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court } = data;
  const applicationDate = court?.applicationDate || '20  .   .   .';

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">

      <h1 className="text-center text-[24px] font-bold mb-8 tracking-[0.2em]">송달장소 및 송달영수인 신고서</h1>

      {/* 사건 정보 */}
      <table className="w-full border-collapse border border-black text-[14px] mb-8">
        <tbody>
          <tr>
            <td className="border border-black p-3 font-semibold text-center w-32">사    건</td>
            <td className="border border-black p-3">{court?.caseNumber || '20    개회        '} 호 개인회생</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold text-center">신 청 인<br/>(채무자)</td>
            <td className="border border-black p-3">
              {debtor?.name || ''} ({debtor?.residentNumber || ''})
            </td>
          </tr>
        </tbody>
      </table>

      {/* 본문 */}
      <div className="mb-8 indent-8">
        <p>
          위 사건에 관하여 신청인은 민사소송법 제184조에 따라 다음과 같이 송달장소 및 송달영수인을 신고합니다.
        </p>
      </div>

      {/* 다 음 */}
      <h2 className="text-center text-[18px] font-bold mb-6 tracking-[0.3em]">다    음</h2>

      <table className="w-full border-collapse border border-black text-[14px] mb-8">
        <tbody>
          <tr>
            <td className="border border-black p-3 font-semibold text-center w-40">1. 송달장소</td>
            <td className="border border-black p-3">
              {debtor?.serviceAddress || court?.lawyerFirm || ''}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold text-center">2. 송달영수인</td>
            <td className="border border-black p-3">
              {debtor?.serviceRecipient || court?.lawyerName || ''} 변호사
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold text-center">3. 전화번호</td>
            <td className="border border-black p-3">
              {debtor?.phone || ''}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold text-center">4. 팩스번호</td>
            <td className="border border-black p-3">
              {debtor?.fax || ''}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 text-[13px]">
        <p>※ 송달장소가 변경된 경우에는 즉시 변경신고서를 제출하여야 합니다.</p>
        <p>※ 송달장소에의 송달이 2회 이상 불능이 된 때에는 민사소송법 제187조에 의하여 발송송달을 할 수 있습니다.</p>
      </div>

      {/* 서명란 */}
      <div className="mt-16 text-center">
        <p className="mb-8">{applicationDate}</p>
        <p className="mb-2 font-bold">
          신청인 {debtor?.name || ''}{'  '} (서명 또는 날인)
        </p>
        <p className="mt-2">
          대리인 {court?.lawyerFirm || ''} {court?.lawyerName || ''} 변호사
        </p>
      </div>

      <div className="mt-12 text-center text-[18px] font-bold">
        {court?.courtName || '서울회생법원'} 귀중
      </div>
    </div>
  );
};
