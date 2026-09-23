import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 개인회생절차 개시신청서 표지 — 대한민국 법원 원본 서식 1:1 완벽 구현
 * - 대법원 표준 A4 정규 비율 (210mm x 297mm) 단일 페이지 완결형
 * - 우측 상단 신청인/대리인 블록
 * - 좌측 인지액 및 송달료 산출 산식 블록
 * - 우측 하단 3종 전산 테이블 (사건번호표 / 최초면담기일표 / 당일면담희망표)
 * - 하단 중앙 관할법원 귀중
 */
export const PetitionCoverPage: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const { debtor, court, lawyer, creditors } = data;
  const creditorCount = creditors?.length || 10;
  
  // 인지: 기본 30,000원 + 금지명령 2,000원 = 32,000원
  const stampFee = court?.stampFee ?? 32000;
  // 송달료: 55,000 + (5,500 × 채권자수 × 8회)
  const serviceFeePer = 5500;
  const serviceFeeRounds = 8;
  const serviceFeeBase = 55000;
  const serviceFeeTotal = serviceFeeBase + (serviceFeePer * creditorCount * serviceFeeRounds);

  // 변호사명 중복 방지 (예: '김우진 변호사' -> '김우진')
  const rawLawyerName = lawyer?.lawyerName || court?.lawyerName || '정충원';
  const cleanLawyerName = rawLawyerName.replace(/변호사/g, '').trim();

  return (
    <div 
      className="court-page bg-white max-w-[210mm] w-[210mm] min-h-[297mm] h-[297mm] mx-auto text-black font-serif px-[22mm] pt-[26mm] pb-[22mm] flex flex-col justify-between box-border shadow-lg print:shadow-none print:border-none print:m-0 print:p-[22mm] select-text"
      style={{ 
        pageBreakAfter: 'always',
        fontFamily: "'Batang', 'BatangChe', 'Gungsuh', serif" 
      }}
    >
      {/* ── 상단 ~ 중단 본문 콘텐츠 영역 ── */}
      <div>
        {/* 1. 대제목 */}
        <h1 className="text-center text-[28px] font-bold tracking-[0.1em] mb-12">
          개인회생절차 &nbsp;개시신청서
        </h1>

        {/* 2. 신청인 / 대리인 표기 (우측 정렬 블록 — 하단 테이블 좌측선과 일치) */}
        <div className="flex justify-end mb-10">
          <div className="w-[340px] space-y-3.5 text-[15px]">
            <div className="flex items-baseline">
              <span className="w-[72px] shrink-0 font-normal">신청인</span>
              <span className="font-semibold text-[15px]">{debtor?.name || '차미선'}</span>
            </div>
            <div className="flex items-baseline">
              <span className="w-[72px] shrink-0 font-normal">대리인</span>
              <div className="space-y-1">
                <div className="font-semibold text-[15px]">{lawyer?.firmName || court?.lawyerFirm || '법률사무소 보광'}</div>
                <div className="font-semibold text-[15px]">변호사 {cleanLawyerName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 인지액 / 송달료 (좌측 정렬 블록) */}
        <div className="mb-10 space-y-3 text-[14px] leading-relaxed">
          <div className="flex items-baseline">
            <span className="w-[72px] shrink-0 font-normal">인 &nbsp; 지</span>
            <span>{stampFee.toLocaleString('ko-KR')}원 (금지명령 포함)</span>
          </div>
          <div className="flex items-baseline">
            <span className="w-[72px] shrink-0 font-normal">송달료</span>
            <span>
              {serviceFeeTotal.toLocaleString('ko-KR')}원
              {' {'}
              {serviceFeeBase.toLocaleString('ko-KR')}
              {' + ('}
              {serviceFeePer.toLocaleString('ko-KR')}
              {'원 X [ '}{creditorCount}{' ] X '}{serviceFeeRounds}{'회)}'}
            </span>
          </div>
        </div>

        {/* 4. 법원 전산 3종 테이블 영역 (우측 정렬) */}
        <div className="flex justify-end">
          <div className="w-[340px] space-y-3.5">
            {/* [테이블 1] 사건번호 / 해당순위번호 / 재판부 / 주심 */}
            <table className="w-full border-collapse border border-black text-[13px]">
              <tbody>
                <tr className="h-[30px]">
                  <td className="border border-black px-2 text-center font-semibold w-[42%] tracking-[0.3em]">
                    사 건 &nbsp;번 호
                  </td>
                  <td className="border border-black px-2.5 text-left font-mono text-[12px] w-[58%]">
                    {court?.caseNumber || ''}
                  </td>
                </tr>
                <tr className="h-[30px]">
                  <td className="border border-black px-2 text-center font-semibold">
                    해당순위번호
                  </td>
                  <td className="border border-black px-2.5 text-left"></td>
                </tr>
                <tr className="h-[30px]">
                  <td className="border border-black px-2 text-center font-semibold tracking-[0.3em]">
                    재 &nbsp;판 &nbsp;부
                  </td>
                  <td className="border border-black px-2.5 text-left"></td>
                </tr>
                <tr className="h-[30px]">
                  <td className="border border-black px-2 text-center font-semibold tracking-[0.6em]">
                    주 &nbsp; &nbsp;심
                  </td>
                  <td className="border border-black px-2.5 text-left"></td>
                </tr>
              </tbody>
            </table>

            {/* [테이블 2] 최초면담기일통지 / 영수인 */}
            <table className="w-full border-collapse border border-black text-[13px]">
              <tbody>
                <tr className="h-[28px]">
                  <td className="border border-black px-2 text-center font-semibold w-[70%]">
                    최초면담기일통지
                  </td>
                  <td className="border border-black px-2 text-center font-semibold w-[30%] tracking-[0.3em]">
                    영 수 인
                  </td>
                </tr>
                <tr className="h-[64px]">
                  <td className="border border-black p-2.5 align-top text-left font-mono text-[13px]">
                    <span>20 &nbsp; . &nbsp; &nbsp; &nbsp; &nbsp; . &nbsp; &nbsp; &nbsp; &nbsp; . &nbsp; &nbsp; &nbsp; &nbsp; :</span>
                  </td>
                  <td className="border border-black p-2 text-center align-middle"></td>
                </tr>
              </tbody>
            </table>

            {/* [테이블 3] 당일면담 희망여부 (테이블 1, 2 좌측선에 정렬) */}
            <table className="border-collapse border border-black text-[12px] w-[115px]">
              <tbody>
                <tr className="h-[32px]">
                  <td className="border border-black p-1 text-center font-semibold leading-tight">
                    <div>당일면담</div>
                    <div>희망여부</div>
                  </td>
                </tr>
                <tr className="h-[44px]">
                  <td className="border border-black text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 하단 관할 법원명 귀중 (중앙 정렬) ── */}
      <div className="text-center text-[22px] font-bold tracking-[0.2em] pb-1">
        {court?.courtName || '서울회생법원'} &nbsp;귀중
      </div>
    </div>
  );
};
