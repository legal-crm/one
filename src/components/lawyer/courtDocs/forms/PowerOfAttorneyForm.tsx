
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 위임장 — 법원 HWPX 원본 텍스트 1:1 완전 재현
 * 테이블 없이 단순 텍스트 필드 형식
 */
export const PowerOfAttorneyForm: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court } = data;
  const caseNumber = court?.caseNumber || '20    개회        ';
  const applicationDate = court?.applicationDate || '20  .   .   .';

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">

      {/* 제목 — 법원 원본: 밑줄 + 넓은 자간 */}
      <h1 className="text-center text-[24px] font-bold mb-12">
        <span className="underline tracking-[0.8em]">위 임 장</span>
      </h1>

      {/* 인적사항 — 법원 원본: 테이블 없이 단순 텍스트 */}
      <div className="mb-8 space-y-1">
        <p>
          <span className="tracking-[0.5em]">성      명</span>: {debtor?.name || ''}
        </p>
        <p>
          <span className="tracking-[0.5em]">주      소</span>: {debtor?.address || ''}
        </p>
        <p>
          주민등록번호: {debtor?.residentNumber || ''}
        </p>
      </div>

      {/* 본문 — 법원 원본 그대로 */}
      <p className="mb-8 indent-4">
        본인은 위 사람을 대리인으로 정하여 다음 사항의 권한을 위임합니다.
      </p>

      {/* 다 음 */}
      <h2 className="text-center text-[18px] font-bold mb-8 tracking-[0.5em]">다    음</h2>

      {/* 위임사항 — 법원 원본 형식 */}
      <div className="mb-4 space-y-2">
        <p>
          <span className="underline">위임사항</span>: 사건번호 ({caseNumber})
        </p>
        <p className="ml-12">
          신청인 ({debtor?.name || ''})
        </p>
        <p className="ml-4">
          ({court?.lawyerFirm || ''} {court?.lawyerName || ''} 변호사)
        </p>
      </div>

      {/* 첨부 */}
      <div className="mt-16 mb-8">
        <p>※ 첨부: 인감증명서 1부</p>
      </div>

      {/* 서명란 — 법원 원본 그대로 */}
      <div className="mt-8 text-center">
        <p className="mb-8">{applicationDate}</p>
      </div>

      <div className="space-y-1">
        <p className="ml-16">
          <span className="underline tracking-[0.3em]">위 임 인</span>
          {'                    '}(서명 또는 날인)
        </p>
        <p className="ml-16">
          <span className="tracking-[0.5em]">주      소</span>{'  '}{debtor?.address || ''}
        </p>
        <p className="ml-16">
          주민등록번호{'  '}{debtor?.residentNumber || ''}
        </p>
      </div>

      {/* 법원 귀중 */}
      <div className="mt-16 text-right text-[18px] font-bold">
        {court?.courtName || ''} 귀중
      </div>
    </div>
  );
};
