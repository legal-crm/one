
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 개인회생절차 개시신청서 표지 — 법원 원본 1:1 재현
 * 신청인/대리인, 인지/송달료, 사건번호표, 최초면담기일, 당일면담희망 등
 */
export const PetitionCoverPage: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court, lawyer, creditors } = data;
  const creditorCount = creditors?.length || 10;
  
  // 인지: 기본 30,000원 + 금지명령 2,000원 = 32,000원
  const stampFee = court?.stampFee ?? 32000;
  // 송달료: 55,000 + (5,500 × 채권자수 × 8회)
  const serviceFeePer = 5500;
  const serviceFeeRounds = 8;
  const serviceFeeBase = 55000;
  const serviceFeeTotal = serviceFeeBase + (serviceFeePer * creditorCount * serviceFeeRounds);

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>

      {/* 제목 */}
      <h1 className="text-center text-[28px] font-bold mb-16 tracking-[0.3em]">
        개인회생절차 개시신청서
      </h1>

      {/* 신청인 / 대리인 */}
      <div className="text-center mb-12 space-y-2">
        <p className="text-[18px]">
          <span className="tracking-[0.3em]">신청인</span>{'    '}{debtor?.name || ''}
        </p>
        <p className="text-[18px]">
          <span className="tracking-[0.3em]">대리인</span>{'    '}{lawyer?.firmName || court?.lawyerFirm || ''}
        </p>
        <p className="text-[18px]">
          {'              '}변호사 {lawyer?.lawyerName || court?.lawyerName || ''}
        </p>
      </div>

      {/* 인지 / 송달료 */}
      <div className="mb-16 space-y-1">
        <p>
          <span className="tracking-[0.5em] font-semibold">인  지</span>{'    '}
          {stampFee.toLocaleString('ko-KR')}원 (금지명령 포함)
        </p>
        <p>
          <span className="tracking-[0.3em] font-semibold">송달료</span>{'    '}
          {serviceFeeTotal.toLocaleString('ko-KR')}원
          {' {'}
          {serviceFeeBase.toLocaleString('ko-KR')}
          {' + ('}
          {serviceFeePer.toLocaleString('ko-KR')}
          {'원 X [ '}{creditorCount}{' ] X '}{serviceFeeRounds}{'회)}'}
        </p>
      </div>

      {/* 사건번호 / 해당순위번호 / 재판부 / 주심 테이블 */}
      <div className="flex justify-center mb-8">
        <table className="border-collapse border border-black text-[14px] w-[60%]">
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center font-semibold w-[40%] tracking-[0.3em]">사 건 번 호</td>
              <td className="border border-black p-2 text-left w-[60%]">{court?.caseNumber || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center font-semibold tracking-[0.1em]">해당순위번호</td>
              <td className="border border-black p-2 text-left"></td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center font-semibold tracking-[0.3em]">재  판  부</td>
              <td className="border border-black p-2 text-left"></td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center font-semibold tracking-[0.5em]">주      심</td>
              <td className="border border-black p-2 text-left"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 최초면담기일통지 / 영수인 테이블 */}
      <div className="flex justify-center mb-6">
        <table className="border-collapse border border-black text-[14px] w-[60%]">
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center font-semibold w-[60%]">최초면담기일통지</td>
              <td className="border border-black p-2 text-center font-semibold w-[40%] tracking-[0.3em]">영 수 인</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-left">20{'  '}.{'  '}.{'  '}.{'  '}:</td>
              <td className="border border-black p-2 text-left"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 당일면담 희망여부 */}
      <div className="flex justify-center mb-16">
        <table className="border-collapse border border-black text-[14px]">
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center font-semibold" style={{ width: '120px' }}>
                <div>당일면담</div>
                <div>희망여부</div>
              </td>
              <td className="border border-black p-2 text-center" style={{ width: '80px', minHeight: '40px' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 법원 귀중 */}
      <div className="text-center text-[22px] font-bold mt-16">
        {court?.courtName || '서울회생법원'} 귀중
      </div>
    </div>
  );
};
