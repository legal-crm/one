
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

export const CreditorListFormD5106: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const { creditors, court } = data;

  const securedCreditors = creditors.filter((c) => c.isSecured);
  const unsecuredCreditors = creditors.filter((c) => !c.isSecured);

  const sumCreditors = (list: typeof creditors) => {
    return list.reduce(
      (acc, curr) => {
        acc.principal += curr.principal;
        acc.interest += curr.interest;
        acc.total += curr.principal + curr.interest;
        return acc;
      },
      { principal: 0, interest: 0, total: 0 }
    );
  };

  const securedSum = sumCreditors(securedCreditors);
  const unsecuredSum = sumCreditors(unsecuredCreditors);
  const totalSum = sumCreditors(creditors);

  return (
    <>
      {/* Page 1: 총괄표 */}
      <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
        <div className="text-left font-bold mb-4">[신청서 첨부서류 1]</div>
        <h1 className="text-center text-[24px] font-bold mb-8">개인회생채권자목록</h1>
        <h2 className="text-center text-[18px] mb-4">총괄표</h2>
        <table className="w-full border-collapse border border-black text-[14px]">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">구분</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">채권자수</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">원금합계</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">이자합계</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">채권현재액합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center">담보부 회생채권</td>
              <td className="border border-black p-2 text-center">{securedCreditors.length}</td>
              <td className="border border-black p-2 text-right">{securedSum.principal.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right">{securedSum.interest.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right">{securedSum.total.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center">무담보 회생채권</td>
              <td className="border border-black p-2 text-center">{unsecuredCreditors.length}</td>
              <td className="border border-black p-2 text-right">{unsecuredSum.principal.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right">{unsecuredSum.interest.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right">{unsecuredSum.total.toLocaleString('ko-KR')}원</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center font-bold">합 계</td>
              <td className="border border-black p-2 text-center font-bold">{creditors.length}</td>
              <td className="border border-black p-2 text-right font-bold">{totalSum.principal.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right font-bold">{totalSum.interest.toLocaleString('ko-KR')}원</td>
              <td className="border border-black p-2 text-right font-bold">{totalSum.total.toLocaleString('ko-KR')}원</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-8">
          <p>산정기준일: {court.applicationDate || ''} (신청일)</p>
          <p>※ 주의사항: 채권현재액은 위 산정기준일 현재의 원리금을 기준으로 작성하였습니다.</p>
        </div>
      </div>

      {/* Pages 2+: 채권자별 상세 */}
      {creditors.map((creditor, index) => (
        <div key={creditor.id} className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
          <h2 className="text-center text-[18px] mb-4">개인회생채권자목록 (상세)</h2>
          <table className="w-full border-collapse border border-black text-[14px]">
            <tbody>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-24">채권번호</td>
                <td className="border border-black p-2 text-center w-16">{creditor.creditorNumber}</td>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-24">채권자</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
                  {creditor.name} {creditor.representative ? `(대표자: ${creditor.representative})` : ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채무 발생 원인</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  일자: {creditor.borrowedDate || ''} / 원인: {creditor.debtCauseDetail || ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권현재액</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  원금: {creditor.principal.toLocaleString('ko-KR')}원<br/>
                  이자: {creditor.interest.toLocaleString('ko-KR')}원<br/>
                  합계: {(creditor.principal + creditor.interest).toLocaleString('ko-KR')}원
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>주소</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  우편번호: {creditor.zipCode || ''}<br/>
                  본점 소재지: {creditor.address || ''}<br/>
                  송달장소: {creditor.serviceAddress || ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>연락처</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  대표전화: {creditor.phone || ''} / 팩스: {creditor.fax || ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>보증인 유무</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  {creditor.isGuarantor ? '유 (보증인)' : creditor.guarantorName ? `유 (${creditor.guarantorName})` : '무'}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>담보내용</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  {creditor.isSecured ? creditor.securedCollateralType || '담보 있음' : '없음'}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권 특이사항</td>
                <td className="border border-black p-2 text-left" colSpan={4}>
                  {creditor.memo || '해당없음'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
};
