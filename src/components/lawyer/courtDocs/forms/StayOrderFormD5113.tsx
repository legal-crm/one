
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 중지명령 신청서 (D5113) — 법원 HWPX 원본 텍스트 1:1 완전 재현
 * 신청원인 3항 (신청이유 아님), 소명방법: 결정문 1통
 */
export const StayOrderFormD5113: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court, stayCases } = data;
  const caseNumber = court?.caseNumber || '20    개회        ';
  const applicationDate = court?.applicationDate || '20  .   .   .';

  // 사건이 있으면 각 사건별로, 없으면 빈 양식 1장
  const cases = (stayCases && stayCases.length > 0) ? stayCases : [null];

  return (
    <div className="space-y-8">
      {cases.map((stayCase: any, idx: number) => {
        const creditorName = stayCase?.creditorName || '';
        const creditorAddress = stayCase?.creditorAddress || '';
        const targetCourt = stayCase?.courtName || '○○법원';
        const targetCaseNumber = stayCase?.caseNumber || '20  타채 ○';

        return (
          <div key={stayCase?.id || idx} className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>

            {/* 제목 — 법원 원본: 밑줄 */}
            <h1 className="text-center text-[24px] font-bold mb-8">
              <span className="underline tracking-[0.3em]">중지명령  신청서</span>
            </h1>

            {/* 사건/채무자/상대방 헤더 — 법원 원본: 테이블 없이 단순 텍스트 */}
            <div className="mb-6 space-y-0">
              <p>
                <span className="tracking-[0.5em]">사      건</span>{'       '}{caseNumber}{' '}개인회생
              </p>
              <p>
                (<span className="tracking-[0.3em]">채 무 자</span>){'       '}
                <span className="tracking-[0.3em]">주 소</span>: {debtor?.address || ''}
              </p>
              <p>
                <span className="tracking-[0.3em]">상 대 방</span>{'       '}
                <span className="tracking-[0.3em]">성 명</span>: {creditorName}
              </p>
              <p>
                {'                    '}
                <span className="tracking-[0.3em]">주 소</span>: {creditorAddress}
              </p>
            </div>

            {/* 신 청 취 지 — 법원 원본 */}
            <h2 className="text-center text-[18px] font-bold mb-4">
              <span className="underline tracking-[0.3em]">신 청 취 지</span>
            </h2>

            <div className="indent-4 mb-6">
              <p>
                신청인에 대한 이 법원 {caseNumber} 개인회생사건에 관하여 개인회생절차의
                개시신청에 대한 결정이 있을 때까지 신청인에 대한 {targetCourt} {targetCaseNumber} 호
                사건의 압류·추심명령절차를 중지한다는 결정을 구합니다.
              </p>
            </div>

            {/* 신 청 원 인 — 법원 원본: "신청이유"가 아닌 "신청원인" 3항 */}
            <h2 className="text-center text-[18px] font-bold mb-4">
              <span className="underline tracking-[0.3em]">신 청 원 인</span>
            </h2>

            <div className="space-y-2">
              <p>
                1. 신청인은 귀원 {caseNumber} 개인회생 사건의 신청 채무자입니다.
              </p>
              <p>
                2. 위 사건의 개시결정 전에 신청인의 급여에 대한 압류·추심명령 절차를 진행하게 되면
                채권자 간의 형평을 해하게 되며, 개인회생절차에 따른 변제계획의 수행에 큰 어려움이
                생길 것입니다.
              </p>
              <p>
                3. 따라서 신청인은 채무자 회생 및 파산에 관한 법률 제593조제1항에 따라 이 신청을
                하게 되었습니다.
              </p>
            </div>

            {/* 소 명 방 법 — 법원 원본 */}
            <div className="mt-8 mb-4">
              <h3 className="font-bold mb-2">
                <span className="underline tracking-[0.3em]">소 명 방 법</span>
              </h3>
              <p>1. 결정문 1통</p>
            </div>

            {/* 서명란 — 법원 원본 그대로 */}
            <div className="mt-16 text-center">
              <p className="mb-8">{applicationDate}</p>
              <p>
                신청인(채무자){'                    '}(서명 또는 날인)
              </p>
              <p className="text-left mt-2">
                연락 가능한 전화번호: {debtor?.phone || ''}
              </p>
            </div>

            {/* 법원 귀중 */}
            <div className="mt-12 text-right text-[18px] font-bold">
              {court?.courtName || ''} 귀중
            </div>
          </div>
        );
      })}
    </div>
  );
};
