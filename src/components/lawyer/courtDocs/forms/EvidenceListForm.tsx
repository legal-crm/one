
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

/**
 * 자료 제출 (증거서류 제출목록) — 법원 표준 양식 (A4 규격)
 * 개인회생 신청 시 첨부할 증빙 서류 목록
 */
export const EvidenceListForm: React.FC<CourtFormProps> = ({ data }) => {
  const { debtor, court, creditors } = data;
  const applicationDate = court?.applicationDate || '20  .   .   .';

  // 기본 제출서류 목록
  const requiredDocs = [
    { category: '기본 서류', items: [
      { name: '주민등록등본 (과거주소 변동사항 포함)', copies: 1 },
      { name: '주민등록초본 (과거주소 변동사항 전체)', copies: 1 },
      { name: '가족관계증명서 (상세)', copies: 1 },
      { name: '혼인관계증명서 (상세)', copies: 1 },
    ]},
    { category: '소득 증명', items: [
      { name: '근로소득 원천징수영수증 (최근 1년)', copies: 1 },
      { name: '급여명세서 (최근 3개월)', copies: 1 },
      { name: '재직증명서', copies: 1 },
      { name: '건강보험 자격득실확인서', copies: 1 },
    ]},
    { category: '재산 증명', items: [
      { name: '부동산등기부등본 (전 소유 부동산)', copies: 1 },
      { name: '자동차등록원부 (갑)', copies: 1 },
      { name: '금융거래확인서 (전 금융기관)', copies: 1 },
      { name: '예금잔액증명서', copies: 1 },
      { name: '보험가입내역 확인서', copies: 1 },
    ]},
    { category: '채무 증명', items: [
      { name: '부채증명서 (전 채권자)', copies: creditors?.length || 1 },
      { name: '신용정보조회서 (전국은행연합회)', copies: 1 },
      { name: '개인신용정보조회서 (NICE/KCB)', copies: 1 },
    ]},
    { category: '기타', items: [
      { name: '인감증명서 또는 본인서명사실확인서', copies: 1 },
      { name: '통장 사본 (변제금 입금용)', copies: 1 },
    ]},
  ];

  let docNum = 0;

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]">
      
      <h1 className="text-center text-[24px] font-bold mb-6 tracking-[0.2em]">첨 부 서 류  목 록</h1>
      
      <div className="text-[14px] mb-6">
        <p>사    건: {court?.caseNumber || ''} 호 개인회생</p>
        <p>신 청 인: {debtor?.name || ''}</p>
      </div>

      <table className="w-full border-collapse border border-black text-[13px] mb-8">
        <thead>
          <tr>
            <th className="border border-black p-2 font-semibold text-center w-10">순번</th>
            <th className="border border-black p-2 font-semibold text-center">서 류 명</th>
            <th className="border border-black p-2 font-semibold text-center w-16">통수</th>
            <th className="border border-black p-2 font-semibold text-center w-20">비 고</th>
          </tr>
        </thead>
        <tbody>
          {requiredDocs.map((cat) => (
            <>
              <tr key={cat.category}>
                <td className="border border-black p-2 font-semibold text-center" colSpan={4}>
                  【{cat.category}】
                </td>
              </tr>
              {cat.items.map((item) => {
                docNum++;
                return (
                  <tr key={item.name}>
                    <td className="border border-black p-2 text-center">{docNum}</td>
                    <td className="border border-black p-2">{item.name}</td>
                    <td className="border border-black p-2 text-center">{item.copies}</td>
                    <td className="border border-black p-2 text-center"></td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>

      <div className="text-[13px] space-y-1">
        <p>※ 위 서류 중 사본 제출이 가능한 서류는 사본에 "원본대조필" 날인을 하여 제출합니다.</p>
        <p>※ 추가 서류가 필요할 경우 법원의 보정명령에 따라 별도 제출합니다.</p>
      </div>

      {/* 서명란 */}
      <div className="mt-12 text-center">
        <p className="mb-6">{applicationDate}</p>
        <p className="font-bold">
          신청인 {debtor?.name || ''}{'  '}
          대리인 {court?.lawyerFirm || ''} {court?.lawyerName || ''} 변호사
        </p>
      </div>

      <div className="mt-8 text-center text-[18px] font-bold">
        {court?.courtName || '서울회생법원'} 귀중
      </div>
    </div>
  );
};
