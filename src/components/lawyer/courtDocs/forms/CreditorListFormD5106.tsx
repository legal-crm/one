
import type { CourtFilingMasterData } from '../../../../services/documents/courtFilingEngine';

interface CourtFormProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

// 안전한 숫자 포맷 헬퍼
const fmt = (v: number | undefined | null): string =>
  (v ?? 0).toLocaleString('ko-KR');

export const CreditorListFormD5106: React.FC<CourtFormProps> = ({ data, isEditable }) => {
  const creditors = data.creditors || [];
  const court = data.court || {} as any;

  // RepaymentCreditor의 실제 필드명 호환: principal OR currentPrincipal, interest OR currentInterest
  const getPrincipal = (c: any): number => c.principal ?? c.currentPrincipal ?? 0;
  const getInterest = (c: any): number => c.interest ?? c.currentInterest ?? 0;
  const getTotal = (c: any): number => getPrincipal(c) + getInterest(c);

  const securedCreditors = creditors.filter((c) => c.isSecured);
  const unsecuredCreditors = creditors.filter((c) => !c.isSecured);

  const sumCreditors = (list: typeof creditors) => {
    return list.reduce(
      (acc, curr) => {
        acc.principal += getPrincipal(curr);
        acc.interest += getInterest(curr);
        acc.total += getTotal(curr);
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
        <h1 className="text-center text-[24px] font-bold mb-8 tracking-widest">개인회생채권자목록</h1>
        
        <div className="text-right text-[14px] mb-4">
          <p>채권현재액 산정기준일: {court.applicationDate || '20    .    .    .'}</p>
          <p>목록 작성일: {court.applicationDate || '20    .    .    .'}</p>
        </div>

        <table className="w-full border-collapse border border-black text-[14px] mb-6">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center" rowSpan={2}>구분</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center" rowSpan={2}>채권자수</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={3}>채권현재액</th>
            </tr>
            <tr>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">원금합계</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">이자합계</th>
              <th className="border border-black p-2 bg-gray-50 font-semibold text-center">채권현재액합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 text-center">담보부 회생채권</td>
              <td className="border border-black p-2 text-center">{securedCreditors.length}</td>
              <td className="border border-black p-2 text-right">{fmt(securedSum.principal)}원</td>
              <td className="border border-black p-2 text-right">{fmt(securedSum.interest)}원</td>
              <td className="border border-black p-2 text-right">{fmt(securedSum.total)}원</td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-center">무담보 회생채권</td>
              <td className="border border-black p-2 text-center">{unsecuredCreditors.length}</td>
              <td className="border border-black p-2 text-right">{fmt(unsecuredSum.principal)}원</td>
              <td className="border border-black p-2 text-right">{fmt(unsecuredSum.interest)}원</td>
              <td className="border border-black p-2 text-right">{fmt(unsecuredSum.total)}원</td>
            </tr>
            <tr className="font-bold">
              <td className="border border-black p-2 text-center">합 계</td>
              <td className="border border-black p-2 text-center">{creditors.length}</td>
              <td className="border border-black p-2 text-right">{fmt(totalSum.principal)}원</td>
              <td className="border border-black p-2 text-right">{fmt(totalSum.interest)}원</td>
              <td className="border border-black p-2 text-right">{fmt(totalSum.total)}원</td>
            </tr>
          </tbody>
        </table>

        <div className="text-[13px] mt-4">
          <p>※ 개시 후 이자 등: 아래 각 채권의 개시결정일 이후의 이자·지연손해금 등은 채무자 회생 및 파산에 관한 법률 제581조제2항, 제446조제1항제1,2호의 후순위채권입니다.</p>
        </div>
      </div>

      {/* Pages 2+: 채권자별 상세 */}
      {creditors.map((creditor: any, index: number) => (
        <div key={creditor.id || index} className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[16px] leading-[2.0]" style={{ pageBreakAfter: 'always' }}>
          <h2 className="text-center text-[18px] font-bold mb-4">개인회생채권자목록 (상세)</h2>
          <table className="w-full border-collapse border border-black text-[14px]">
            <tbody>
              {/* 채권번호 / 채권자 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-32" rowSpan={2}>채권번호</td>
                <td className="border border-black p-2 text-center w-16" rowSpan={2}>{creditor.creditorNumber ?? (index + 1)}</td>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center w-32">채 권 자</td>
                <td className="border border-black p-2 text-left" colSpan={2}>
                  {creditor.name || ''} {creditor.representative ? `(대표자: ${creditor.representative})` : ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center">채권의 원인</td>
                <td className="border border-black p-2 text-left" colSpan={2}>
                  {creditor.borrowedDate || ''}{creditor.borrowedDate ? ' ' : ''}{creditor.debtCauseDetail || creditor.debtType || ''}
                </td>
              </tr>
              {/* 주소 / 연락처 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>주소 및 전화번호</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
                  <div>(주소) {creditor.address || creditor.creditorAddress || ''}</div>
                  <div>(전화) {creditor.creditorPhone || ''}{creditor.fax ? ` (팩스) ${creditor.fax}` : ''}</div>
                </td>
              </tr>
              {/* 채권의 내용 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권의 내용</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
                  {creditor.debtCauseDetail || creditor.debtType || '대출금'}
                  {creditor.annexDocType ? ` (부속서류: ${creditor.annexDocType})` : ''}
                </td>
              </tr>
              {/* 채권현재액(원금) */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권현재액(원금)</td>
                <td className="border border-black p-2 text-right">{fmt(getPrincipal(creditor))}원</td>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center">산정근거</td>
                <td className="border border-black p-2 text-left">{creditor.principalCalculationBasis || '부채증명서 참조'}</td>
              </tr>
              {/* 채권현재액(이자) */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권현재액(이자)</td>
                <td className="border border-black p-2 text-right">{fmt(getInterest(creditor))}원</td>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center">산정근거</td>
                <td className="border border-black p-2 text-left">{creditor.interestCalculationBasis || '연체이자 계산서 참조'}</td>
              </tr>
              {/* 보증인 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>보증인 유무</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
                  {creditor.guarantorName ? `유 (${creditor.guarantorName})` : creditor.isGuarantor ? '유 (보증채무)' : '무'}
                </td>
              </tr>
              {/* 담보 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>담보내용</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
                  {creditor.isSecured ? (creditor.securedCollateralType || '담보 있음') : '없음'}
                </td>
              </tr>
              {/* 특이사항 */}
              <tr>
                <td className="border border-black p-2 bg-gray-50 font-semibold text-center" colSpan={2}>채권 특이사항</td>
                <td className="border border-black p-2 text-left" colSpan={3}>
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
