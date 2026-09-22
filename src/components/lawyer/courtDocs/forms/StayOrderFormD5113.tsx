
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 중지명령 신청서 (D5113) — 법원 원본 HWPX 기반
 * 개별 강제집행 사건에 대한 중지명령 신청
 */
export const StayOrderFormD5113: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court, stayCases } = data;
  const caseNumber = court?.caseNumber || '20    개회        ';
  const applicationDate = court?.applicationDate || '20  .   .   .';

  return (
    <div className="space-y-8">
      {(stayCases || []).map((stayCase: any, idx: number) => (
        <div key={stayCase.id || idx} className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
          
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
          <h1 className="text-center text-[24px] font-bold mb-8 tracking-[0.3em]">중 지 명 령  신 청 서</h1>

          {/* 신 청 취 지 */}
          <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 취 지</h2>

          <div className="indent-8 mb-8">
            <p>
              신청인(채무자)에 대한 이 법원 {caseNumber}호 개인회생사건에 관하여 개인회생절차의 개시신청에
              대한 개시결정이 있을 때까지 {stayCase.creditorName || '채권자'}의 신청인에 대한
              {' '}{stayCase.courtName || court?.courtName || ''} {stayCase.caseNumber || ''}{' '}
              {stayCase.caseType || '채권압류및추심'} 사건의 강제집행절차를 중지한다.
            </p>
            <p className="mt-2">라는 결정을 구합니다.</p>
          </div>

          {/* 신 청 이 유 */}
          <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 이 유</h2>

          <div className="space-y-4">
            <p className="indent-4">
              1. 신청인은 귀원 {caseNumber}호 개인회생 사건의 신청 채무자입니다.
            </p>
            <p className="indent-4">
              2. {stayCase.creditorName || '채권자'}는 신청인을 상대로 {stayCase.courtName || ''}{' '}
              {stayCase.caseNumber || ''}호 {stayCase.caseType || '채권압류및추심'}을 신청하여,
              {stayCase.thirdPartyDebtor ? ` 제3채무자 ${stayCase.thirdPartyDebtor}에 대한` : ''}{' '}
              {stayCase.seizureTarget || '신청인의 급여채권 및 퇴직금'}에 대하여
              {stayCase.servedDate ? ` ${stayCase.servedDate}` : ''} 강제집행을 하였습니다.
            </p>
            <p className="indent-4">
              3. 위 강제집행이 계속되면 신청인은 변제계획에 따른 변제의 이행이 곤란하게 되므로,
              채무자 회생 및 파산에 관한 법률 제593조 제1항에 따라 위 강제집행절차의 중지를 구하기 위하여
              이 신청에 이르렀습니다.
            </p>
          </div>

          {/* 소 명 방 법 */}
          <div className="mt-8">
            <h3 className="font-bold mb-2">소 명 방 법</h3>
            <p className="indent-4">1. 개인회생절차 개시신청서 사본</p>
            <p className="indent-4">2. {stayCase.caseType || '채권압류및추심'} 결정문 사본</p>
          </div>

          {/* 서명란 */}
          <div className="mt-16 text-center">
            <p className="mb-8">{applicationDate}</p>
            <p className="font-bold">
              신청인 {debtor?.name || ''}{'  '}
              대리인 {court?.lawyerFirm || ''} {court?.lawyerName || ''} 변호사 (인)
            </p>
          </div>

          <div className="mt-12 text-center text-[18px] font-bold">
            {court?.courtName || '서울회생법원'} 민사신청과 귀 중
          </div>
        </div>
      ))}

      {/* stayCases가 비어있을 때 빈 양식 */}
      {(!stayCases || stayCases.length === 0) && (
        <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[14px]">
              <p>{caseNumber} 호 개인회생</p>
              <p>신청인(채무자) {debtor?.name || ''}</p>
            </div>
            <div className="border border-black rounded-xl px-4 py-2 text-center text-[13px]">
              <div className="font-bold">인 지</div>
              <div>2,000원</div>
            </div>
          </div>
          <h1 className="text-center text-[24px] font-bold mb-8 tracking-[0.3em]">중 지 명 령  신 청 서</h1>
          <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 취 지</h2>
          <div className="indent-8 mb-8">
            <p>
              신청인(채무자)에 대한 이 법원 {caseNumber}호 개인회생사건에 관하여 개인회생절차의 개시신청에
              대한 개시결정이 있을 때까지 [채권자명]의 신청인에 대한 [법원] [사건번호] [사건유형] 사건의
              강제집행절차를 중지한다.
            </p>
            <p className="mt-2">라는 결정을 구합니다.</p>
          </div>
          <h2 className="text-center text-[18px] font-bold mb-4 tracking-[0.2em]">신 청 이 유</h2>
          <p className="indent-4 text-gray-400">(중지명령 대상 강제집행 사건이 등록되면 자동으로 내용이 채워집니다)</p>
          <div className="mt-24 text-center">
            <p className="mb-8">{applicationDate}</p>
            <p className="font-bold">신청인 {debtor?.name || ''} (서명 또는 날인)</p>
          </div>
          <div className="mt-12 text-center text-[18px] font-bold">
            {court?.courtName || '서울회생법원'} 민사신청과 귀 중
          </div>
        </div>
      )}
    </div>
  );
};
