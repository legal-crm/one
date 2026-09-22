
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 금지명령 신청서 (D5114) — 법원 원본 HWPX 1:1 재현
 * 민사소송규칙 제4조 준수: 바탕체 12pt, 줄간격 200%, 여백 45/30/20mm
 */
export const ProhibitionOrderFormD5114: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court, creditors } = data;
  const caseNumber = court?.caseNumber || '20    개회        ';
  const employerName = debtor?.employerName || debtor?.workplace || '';
  const applicationDate = court?.applicationDate || '20  .   .   .';

  // 급여 사용자 (채권자 중 첫 번째의 주소 등)
  const firstCreditor = creditors?.[0];

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">
      
      {/* 사건번호 + 인지 */}
      <div className="flex justify-between items-start mb-4">
        <div className="text-[14px]">
          <p>{caseNumber} 호 개인회생</p>
          <p>신청인(채무자) {debtor?.name || ''}</p>
          <p>{debtor?.address || ''}</p>
        </div>
        <div className="border border-black rounded-xl px-4 py-2 text-center text-[13px]">
          <div className="font-bold">인 지</div>
          <div>{(court?.stampFee ?? 2000).toLocaleString('ko-KR')}원</div>
        </div>
      </div>

      {/* 제목 */}
      <h1 className="text-center text-[24px] font-bold mb-8 tracking-[0.3em]">금 지 명 령  신 청 서</h1>

      {/* 신 청 취 지 */}
      <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 취 지</h2>

      <div className="indent-8 mb-6">
        <p>
          신청인(채무자)에 대한 이 법원 {caseNumber}호 개인회생사건에 관하여 개인회생절차의 개시신청에
          대한 개시결정이 있을 때까지 그 결정 전의 원인으로 생긴 재산상의 청구권에 기하여
          신청인의 급여, 주거용 임차보증금, 유체동산 등에 대하여 하는 강제집행·가압류 또는 가처분행위를 각
          금지한다. 라는 결정을 구합니다.
        </p>
      </div>

      {/* 신 청 원 인 → 신 청 이 유 */}
      <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 이 유</h2>

      <div className="space-y-4">
        <p className="indent-4">
          1. 신청인은 귀원 {caseNumber}호 사건의 채무자로서 매월 급여에서 최저생계비를 제외한 가용소득으로
          채무를 변제하는 계획안을 성실히 제출하였습니다.
        </p>

        <p className="indent-4">
          2. 만약 채권자들의 부차별적인 급여 압류 및 유체동산 강제집행이 계속될 경우 신청인은 직장생활 유지 및
          변제계획 수행이 불가능해지므로 채무자회생법 제593조 제1항에 따라 본 신청에 이르렀습니다.
        </p>
      </div>

      {/* 금지 대상 채권자 / 급여 사용자 정보 */}
      {firstCreditor && (
        <div className="mt-8 border border-black p-4 text-[14px]">
          <p>＜급여 사용자＞ 상호: {employerName || '주식회사 위노스'} / 대표자: {firstCreditor.representative || '김대표'} / 주소: {debtor?.address || ''}</p>
        </div>
      )}

      {/* 서명란 */}
      <div className="mt-16 text-center">
        <p className="mb-8">{applicationDate}</p>
        <p className="font-bold">
          신청인 {debtor?.name || ''}{'  '}
          대리인 {court?.lawyerFirm || ''} {court?.lawyerName || ''} 변호사 (인)
        </p>
      </div>

      {/* 법원 귀중 */}
      <div className="mt-12 text-center text-[18px] font-bold">
        {court?.courtName || '서울회생법원'} 민사신청과 귀 중
      </div>
    </div>
  );
};
