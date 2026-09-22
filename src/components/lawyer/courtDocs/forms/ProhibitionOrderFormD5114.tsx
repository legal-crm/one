
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 금지명령 신청서 (D5114) — 법원 HWPX 원본 텍스트 1:1 완전 재현
 * courtFormSchemas.json D5114 section0.xml 원문 그대로
 */
export const ProhibitionOrderFormD5114: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court } = data;
  const caseNumber = court?.caseNumber || '20    개회        ';
  const employerName = debtor?.employerName || debtor?.workplace || '(회사명)';
  const applicationDate = court?.applicationDate || '20  .   .    .';

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">

      {/* 제목 — 법원 원본: 밑줄 + 넓은 자간 */}
      <h1 className="text-center text-[24px] font-bold mb-8">
        <span className="underline tracking-[0.5em]">금지명령  신청서</span>
      </h1>

      {/* 사건/신청인 헤더 — 법원 원본 그대로 */}
      <div className="text-[16px] mb-6 space-y-0">
        <p>
          <span className="tracking-[0.5em]">사      건</span>{'       '}{caseNumber}{' '}개인회생
        </p>
        <p>
          <span className="tracking-[0.3em]">신 청 인</span>{'   '}
          <span className="tracking-[0.3em]">성 명</span>: {debtor?.name || ''}{'  '}
          (주민등록번호{'  '}{debtor?.residentNumber || '      -       '})
        </p>
        <p>
          (<span className="tracking-[0.3em]">채 무 자</span>){'       '}
          <span className="tracking-[0.3em]">주 소</span>: {debtor?.address || ''}
        </p>
      </div>

      {/* 신 청 취 지 */}
      <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.3em] underline">신 청 취 지</h2>

      <div className="indent-8 mb-2 text-[16px]">
        <p>
          신청인에 대한 이 법원 {caseNumber} 개인회생사건에 관하여 개인회생절차의 개시신청에
          대한 결정이 있을 때까지 다음의 각 절차 또는 행위를 금지한다.
        </p>
      </div>
      <div className="ml-4 mb-2 text-[16px]">
        <p>
          1. 개인회생채권에 기하여 신청인 소유의 유체동산과 신청인이 사용자로부터 매월 지급받을
          급료, 제수당, 상여금 기타 명목의 급여 및 퇴직금에 대하여 하는 강제집행 · 가압류 또
          는 가처분.
        </p>
        <p>
          2. 개인회생채권을 변제받거나 변제를 요구하는 일체의 행위.
        </p>
        <p className="ml-4">
          다만, 소송행위를 제외한다.
        </p>
      </div>
      <p className="text-[16px] mb-6">라는 결정을 구합니다.</p>

      {/* 신 청 원 인 — 법원 원본: "신청이유"가 아닌 "신청원인" */}
      <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.3em] underline">신 청 원 인</h2>

      <div className="space-y-2 text-[16px]">
        <p>
          1. 신청인은 귀원 {caseNumber} 개인회생 사건의 신청 채무자입니다.
        </p>
        <p>
          2. 신청인은 위 개인회생 사건에서 신청인이 매월 ({employerName})에서 지급받는 급여에
          서 생계비를 제외한 나머지 가용소득으로 채무를 변제하는 계획안을 제출하였습니다.
        </p>
        <p>
          3. 현재 신청인 소유의 유체동산과 신청인이 사용자로부터 매월 지급받을 급여 및 퇴직금에 대
          하여는 아직 가압류 또는 압류의 집행이 없는 바, 채권자들이 신청인 소유의 유체동산이나
          신청인의 급여 등에 대하여 강제집행·가압류 또는 가처분을 하게 되면 신청인의 개인회생
          절차에 따른 변제계획의 수행에 큰 어려움이 생길 것입니다.
        </p>
        <p>
          4. 또한 채권자들이 신청인으로부터 개인회생채권을 변제받거나 변제를 요구하는 행위를 할 경
          우 채권자 간의 형평을 해하게 되며, 신청인의 정상적인 생활에도 지장을 초래하게 될 것입
          니다.
        </p>
        <p>
          5. 따라서 신청인은 신청인 소유의 유체동산과 급여 및 퇴직금에 대한 강제집행·가압류 또는
          가처분과 개인회생채권의 변제요구행위를 금지시켜야 할 필요가 있으므로, 채무자 회생 및
          파산에 관한 법률 제593조제1항에 따라 이 신청에 이르게 되었습니다.
        </p>
      </div>

      {/* 서명란 — 법원 원본 그대로 */}
      <div className="mt-16 text-center text-[16px]">
        <p className="mb-8">{applicationDate}</p>
        <p className="mb-2">
          {'                                     '}신청인(채무자){'                    '}(서명 또는 날인)
        </p>
        <p className="text-left">
          {'  '}연락 가능한 전화번호: {debtor?.phone || ''}
        </p>
      </div>

      {/* 법원 귀중 — 원본: 파란색 텍스트, 우하단 */}
      <div className="mt-12 text-right text-[18px] font-bold">
        {court?.courtName || ''} 귀중
      </div>
    </div>
  );
};
