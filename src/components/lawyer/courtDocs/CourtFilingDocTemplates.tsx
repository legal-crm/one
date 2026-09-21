/**
 * CourtFilingDocTemplates.tsx
 * 대법원 전자소송 개인회생 13종 법원 표준 전산양식 컴포넌트 모음
 * (실제 법원 접수본 110~140p 및 오토로 표준 규격 준용)
 */

import type { CourtFilingMasterData } from '../../../services/documents/courtFilingEngine';
import { COURT_JURISDICTIONS } from '../../../services/documents/courtFilingEngine';

interface DocTemplateProps {
  data: CourtFilingMasterData;
  isEditable?: boolean;
}

// ── 1. 변제계획안 요약 및 긴급통지 (1p) ──
export const SummaryAndUrgentNoticeDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { repaymentSummary, debtor } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[13px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] print:max-w-none">
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-6">
        <h2 className="text-xl font-bold tracking-tight">[ 변제계획안 요약 ]</h2>
        <span className="text-lg font-bold">{debtor.name} ({debtor.employmentType})</span>
      </div>

      <table className="w-full border-collapse border border-black mb-6 text-center text-[12px]">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-semibold w-1/4">○ 월평균수입</td>
            <td className="border border-black p-2 w-1/4 text-right pr-4">{repaymentSummary.monthlyNetIncome.toLocaleString()}원</td>
            <td className="border border-black p-2 font-semibold w-1/4">○ 가구원수(본인포함)</td>
            <td className="border border-black p-2 w-1/4">{repaymentSummary.householdSize}인 가구</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 기준중위소득 조정금액</td>
            <td className="border border-black p-2 text-right pr-4">{repaymentSummary.monthlyLivingCost.toLocaleString()}원</td>
            <td className="border border-black p-2 font-semibold">○ 기준중위소득 조정비율</td>
            <td className="border border-black p-2">{repaymentSummary.medianIncomeRatio}%</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 월가용소득</td>
            <td colSpan={3} className="border border-black p-2 text-left pl-4 font-bold text-black">
              {repaymentSummary.monthlyDisposableIncome.toLocaleString()}원
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 최초 입금일자</td>
            <td colSpan={3} className="border border-black p-2 text-left pl-4">{data.court.firstRepaymentDate}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 변제기간</td>
            <td colSpan={3} className="border border-black p-2 text-left pl-4">{repaymentSummary.repaymentMonths}개월간</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 총변제예정(유보)액</td>
            <td className="border border-black p-2 text-right pr-4 font-bold">{repaymentSummary.totalRepaymentAmount.toLocaleString()}원</td>
            <td className="border border-black p-2 font-semibold">○ 변제예정액의 현재가치</td>
            <td className="border border-black p-2 text-right pr-4">{Math.round(repaymentSummary.totalRepaymentAmount * 0.92).toLocaleString()}원</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 청산가치</td>
            <td className="border border-black p-2 text-right pr-4">{repaymentSummary.liquidationValue.toLocaleString()}원</td>
            <td className="border border-black p-2 font-semibold">○ 면제재산 신청금액</td>
            <td className="border border-black p-2 text-right pr-4">0원</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 변제율</td>
            <td colSpan={3} className="border border-black p-2 text-left pl-4 font-bold text-black">
              원금의 [ {repaymentSummary.repaymentRatio} ] % 상당액
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 변제형태</td>
            <td className="border border-black p-2">{repaymentSummary.repaymentType}</td>
            <td className="border border-black p-2 font-semibold">○ 탕감예상 채무금액</td>
            <td className="border border-black p-2 text-right pr-4 text-black font-bold">
              {Math.max(0, 46830000 - repaymentSummary.totalRepaymentAmount).toLocaleString()}원
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">○ 기타</td>
            <td colSpan={3} className="border border-black p-2 text-left pl-4 text-[11px]">
              {repaymentSummary.isExternalTrustee && <div>- 외부회생위원 선임 있음</div>}
              {repaymentSummary.hasGarnishment && <div>- 압류·전부명령 채권 있음</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 긴급통지 박스 */}
      <div className="border border-red-500 bg-red-50/40 p-4 rounded text-red-900 text-[12px] space-y-2">
        <div className="font-bold text-red-700 flex items-center gap-1">
          <span>[ 긴 급 통 지 ]</span>
        </div>
        <div>
          ○ <strong>[변제율 인가요건 검증]</strong> 채무자 회생 및 파산에 관한 법률 제614조 제2항 제3호
        </div>
        <div className="text-[11px] text-black leading-relaxed">
          ○ 변제계획의 인가결정일을 기준일로 하여 평가한 개인회생채권의 총금액이 5,000만원 미만인 경우에는 그 총금액의 5%를 초과하여야 인가요건을 충족하게 됩니다.<br />
          ○ 총금액이 5,000만원 이상인 경우에는 변제율이 그 총금액의 3% + 100만원을 초과하여야 인가요건을 충족하게 됩니다.
        </div>
        {repaymentSummary.statutoryWarningMessage ? (
          <div className="bg-red-100 p-2 rounded text-red-800 font-semibold text-[11px]">
            ⚠️ {repaymentSummary.statutoryWarningMessage}
          </div>
        ) : (
          <div className="bg-emerald-100 p-2 rounded text-emerald-900 font-semibold text-[11px]">
            ✓ 본 변제계획안은 채무자회생법 제614조 제2항 제3호(법정 최저변제액 요건) 및 제1호(청산가치 보장 원칙)를 모두 충족합니다.
          </div>
        )}
      </div>
    </div>
  );
};

// ── 2. 개인회생절차 개시신청서 표지 (2p) ──
export const PetitionCoverDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { debtor, lawyer, court, fees } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif flex flex-col justify-between print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px]">
      <div>
        {/* 상단 배지 */}
        <div className="border border-black inline-block p-1 text-[11px] font-bold mb-8">
          <div>중지명령 포함</div>
          <div>금지명령 포함</div>
        </div>

        {/* 대제목 */}
        <div className="text-center my-10">
          <h1 className="text-3xl font-bold tracking-widest">개인회생절차 개시신청서</h1>
        </div>

        {/* 당사자 표기 */}
        <div className="space-y-4 my-12 text-base pl-8">
          <div className="flex">
            <span className="w-32 tracking-wider font-semibold">신청인 (채무자)</span>
            <span className="font-bold text-lg">{debtor.name}</span>
          </div>
          <div className="flex">
            <span className="w-32 tracking-wider font-semibold">대 리 인</span>
            <span>{lawyer.firmName} {lawyer.lawyerName}</span>
          </div>
        </div>

        {/* 인지대 / 송달료 테이블 */}
        <div className="my-10 pl-8 space-y-3 text-[13px]">
          <div className="flex">
            <span className="w-24 font-semibold">인 지</span>
            <span className="font-bold">{fees.totalStamp.toLocaleString()}원 (금지명령 포함)</span>
          </div>
          <div className="flex">
            <span className="w-24 font-semibold">송 달 료</span>
            <span>{fees.totalServiceFee.toLocaleString()}원 {fees.formulaText}</span>
          </div>
        </div>
      </div>

      {/* 우측 접수계 기재란 */}
      <div className="flex justify-end pr-8 my-6">
        <div className="w-64 border-2 border-black text-[12px] text-center">
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1">사 건 번 호</div>
            <div className="p-1 min-h-[24px]">{court.caseNumber}</div>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1">해당순위번호</div>
            <div className="p-1"></div>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1">재 판 부</div>
            <div className="p-1">제 부(단독)</div>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1">주 심</div>
            <div className="p-1"></div>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-2">최초면담기일통지</div>
            <div className="p-2">영 수 인</div>
          </div>
          <div className="grid grid-cols-2">
            <div className="border-r border-black p-2">20 . . . :<br />심문실</div>
            <div className="p-2 text-[10px] flex items-center justify-center">당일면담<br />희망여부</div>
          </div>
        </div>
      </div>

      {/* 하단 법원명 귀중 */}
      <div className="text-center text-xl font-bold tracking-widest pt-8 pb-4">
        {court.courtName} 민사신청과 귀 중
      </div>
    </div>
  );
};

// ── 3. 개인회생절차 개시신청서 본문 (3~4p) ──
export const PetitionBodyDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { debtor, lawyer, court } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[12px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-6">
      <div className="text-center my-4">
        <h2 className="text-2xl font-bold tracking-wider">개인회생절차 개시신청서</h2>
      </div>

      {/* 신청인 인적사항 표 */}
      <table className="w-full border-collapse border border-black text-[11px]">
        <tbody>
          <tr>
            <td rowSpan={5} className="border border-black text-center font-bold w-16 p-2">신청인</td>
            <td className="border border-black p-1 w-20 text-center">성 명</td>
            <td className="border border-black p-1 font-bold">{debtor.name}</td>
            <td className="border border-black p-1 w-24 text-center">주민등록번호</td>
            <td className="border border-black p-1">{debtor.residentNumber}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">주민등록상<br />주 소</td>
            <td colSpan={3} className="border border-black p-1">{debtor.residentAddress}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">현 주 소</td>
            <td colSpan={3} className="border border-black p-1">{debtor.currentAddress}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">송 달 장 소</td>
            <td colSpan={3} className="border border-black p-1">{debtor.serviceAddress} (송달영수인: {lawyer.lawyerName})</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">휴대전화</td>
            <td colSpan={3} className="border border-black p-1">{debtor.phone}</td>
          </tr>
          <tr>
            <td rowSpan={4} className="border border-black text-center font-bold p-2">대리인</td>
            <td className="border border-black p-1 text-center">성 명</td>
            <td colSpan={3} className="border border-black p-1">{lawyer.firmName} {lawyer.lawyerName}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">사무실 주소</td>
            <td colSpan={3} className="border border-black p-1">{lawyer.address}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">전화번호</td>
            <td className="border border-black p-1">{lawyer.phone}</td>
            <td className="border border-black p-1 text-center">FAX번호</td>
            <td className="border border-black p-1">{lawyer.fax}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center">이메일</td>
            <td colSpan={3} className="border border-black p-1">{lawyer.email}</td>
          </tr>
        </tbody>
      </table>

      {/* 신청취지 */}
      <div className="space-y-2 mt-4">
        <h3 className="text-center font-bold text-base tracking-widest my-2">신 청 취 지</h3>
        <p className="indent-4 font-serif text-[13px] p-3 border border-slate-200">
          「신청인에 대하여 개인회생절차를 개시한다.」 라는 결정을 구합니다.
        </p>
      </div>

      {/* 신청이유 */}
      <div className="space-y-3 mt-4 text-[12px] leading-relaxed">
        <h3 className="text-center font-bold text-base tracking-widest my-2">신 청 이 유</h3>
        <p className="indent-4">
          1. 신청인은, 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로, 파산의 원인사실이 발생하였습니다(파산의 원인사실이 생길 염려가 있습니다).
        </p>
        <div className="pl-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">☑</span>
            <span>신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다. (급여소득자의 경우)</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800">
            <span>☐</span>
            <span>신청인은 부동산임대소득·사업소득·농업소득 그 밖에 이와 유사한 수입을 얻을 것으로 예상됩니다. (영업소득자의 경우)</span>
          </div>
        </div>
        <p className="indent-4">
          2. 신청인은, 각 회생채권자에 대한 채무 전액의 변제가 곤란하므로, 그 일부를 분할하여 지급할 계획입니다. 즉 현시점에서 계획하고 있는 변제예정액을 {data.repaymentSummary.repaymentMonths}개월간 성실히 변제하겠습니다.
        </p>
        <p className="indent-4">
          3. 이 사건 개인회생절차에서 변제계획이 불인가될 경우 불인가 결정시까지의 적립금을 반환받을 신청인의 예금계좌는 <strong>{debtor.refundBank} {debtor.refundAccount}</strong> 입니다.
        </p>
      </div>

      {/* 첨부서류 목록 */}
      <div className="border-t border-black pt-3 mt-4 text-[11px]">
        <div className="font-bold mb-1">첨 부 서 류</div>
        <div className="grid grid-cols-2 gap-1 text-black">
          <div>1. 개인회생채권자목록 1통</div>
          <div>2. 재산목록 1통</div>
          <div>3. 수입 및 지출에 관한 목록 1통</div>
          <div>4. 진술서 1통</div>
          <div>5. 변제계획안 1통</div>
          <div>6. 송달료납부서 1통</div>
          <div>7. 신청인 본인의 예금계좌 사본 1통</div>
          <div>8. 위임장 1통</div>
        </div>
      </div>

      {/* 휴대전화를 통한 정보수신 신청서 */}
      <div className="border border-black p-3 text-[11px] space-y-1 mt-4">
        <div className="text-center font-bold text-xs pb-1 border-b border-black">휴대전화를 통한 정보수신 신청서</div>
        <p className="text-[10px] text-black">
          위 사건에 관한 개인회생절차 개시결정, 폐지결정, 면책결정 등의 정보를 휴대전화를 통하여 알려주실 것을 신청합니다.
        </p>
        <div className="flex justify-between items-center pt-1 font-semibold">
          <span>휴대전화 번호 : {debtor.phone}</span>
          <span>신청인 채무자 {debtor.name} (서명 또는 날인)</span>
        </div>
      </div>

      <div className="text-center pt-4">
        <p>{court.applicationDate}</p>
        <p className="mt-2 font-semibold">신청인 {debtor.name} &nbsp;&nbsp;&nbsp;&nbsp; 대리인 {lawyer.firmName} {lawyer.lawyerName} (인)</p>
      </div>
    </div>
  );
};

// ── 4. 개인회생채권자목록 본지 & 부속서류 (5~8p) ──
export const CreditorListDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { creditors, debtor, court } = data;
  const totalPrincipal = creditors.reduce((sum, c) => sum + (c.currentPrincipal || 0), 0);
  const totalInterest = creditors.reduce((sum, c) => sum + (c.currentInterest || 0), 0);
  const grandTotal = totalPrincipal + totalInterest;

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-normal print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-4">
      <div className="flex justify-between items-end border-b border-black pb-1">
        <span className="text-[11px]">{court.caseNumber} 호 채무자 {debtor.name}</span>
        <h2 className="text-xl font-bold tracking-wider">개인회생채권자목록</h2>
        <span className="text-[11px]">산정기준일: {court.applicationDate}</span>
      </div>

      {/* 요약 박스 */}
      <div className="grid grid-cols-2 gap-4 text-[11px]">
        <table className="w-full border-collapse border border-black text-center">
          <tbody>
            <tr>
              <td rowSpan={3} className="border border-black font-bold p-1 w-20">채권현재액<br />합계</td>
              <td className="border border-black p-1 text-left pl-2">합계: {grandTotal.toLocaleString()} 원</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left pl-2">원금: {totalPrincipal.toLocaleString()} 원</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left pl-2">이자: {totalInterest.toLocaleString()} 원</td>
            </tr>
          </tbody>
        </table>
        <table className="w-full border-collapse border border-black text-center">
          <tbody>
            <tr>
              <td className="border border-black font-bold p-1">담보부 회생채권액 합계</td>
              <td className="border border-black p-1">0 원</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1">무담보 회생채권액 합계</td>
              <td className="border border-black p-1 font-bold">{grandTotal.toLocaleString()} 원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-black">
        ※ 개시후이자 등 : 아래 각 채권의 개시결정일 이후의 이자, 지연손해금 등은 채무자회생법 제581조 제2항의 후순위채권입니다.
      </div>

      {/* 채권 테이블 */}
      <table className="w-full border-collapse border border-black text-[11px]">
        <thead className="text-center font-bold">
          <tr>
            <th className="border border-black p-1 w-8">번호</th>
            <th className="border border-black p-1 w-24">채권자</th>
            <th className="border border-black p-1">채권의 원인 및 내용 / 주소</th>
            <th className="border border-black p-1 w-24">부속서류</th>
            <th className="border border-black p-1 w-28">채권현재액 및 산정근거</th>
          </tr>
        </thead>
        <tbody>
          {creditors.map((c, idx) => (
            <tr key={c.id}>
              <td className="border border-black p-1 text-center font-bold">{idx + 1}</td>
              <td className="border border-black p-1 font-semibold text-center">{c.name}</td>
              <td className="border border-black p-1 text-[10px]">
                <div className="font-semibold">{c.debtType.includes('CARD') ? '신용카드 사용대금' : '대여금(신용대출)'}</div>
                <div className="text-black">{c.creditorAddress} (전화: {c.creditorPhone || '고객센터'})</div>
                <div className="text-black">이율: 연 {c.interestRate || 10}%</div>
              </td>
              <td className="border border-black p-1 text-center text-[10px]">
                ☑ 부속서류<br />
                ( {c.annexDocTypes?.map(a => a.replace('ANNEX_', '')).join(', ') || '3, 4'} )
              </td>
              <td className="border border-black p-1 text-right text-[10px]">
                <div className="font-bold">원금: {(c.currentPrincipal || 0).toLocaleString()}원</div>
                <div>이자: {(c.currentInterest || 0).toLocaleString()}원</div>
                <div className="text-black text-[9px]">{c.principalCalculationBasis || '부채증명서 참조'}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 부속서류 3/4 안내 표 */}
      <div className="border border-black p-3 mt-4 text-[11px] space-y-2">
        <div className="font-bold">[부속서류 3: 전부명령의 내역]</div>
        <p className="text-[10px]">
          채권번호 1번 ({creditors[0]?.name}) - 서울회생법원 타채 사건 채권압류 및 전부명령 (인가결정 시 실효 예정)
        </p>
        <div className="font-bold pt-2 border-t border-slate-300">[부속서류 4: 채무자가 연대보증인인 경우]</div>
        <p className="text-[10px]">
          주채무자 채무에 대한 연대보증 분할안분 처리 조항 준용.
        </p>
      </div>
    </div>
  );
};

// ── 5. 재산목록 (9p) ──
export const AssetInventoryDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { repaymentSummary } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-normal print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-4">
      <div className="text-center border-b border-black pb-2">
        <h2 className="text-xl font-bold tracking-wider">재 산 목 록</h2>
        <span className="text-[10px] text-black">(단위 : 원)</span>
      </div>

      <table className="w-full border-collapse border border-black text-[11px]">
        <thead className="text-center font-bold">
          <tr>
            <th className="border border-black p-1 w-28">명 칭</th>
            <th className="border border-black p-1 w-28">금 액 (시가)</th>
            <th className="border border-black p-1 w-16">압류유무</th>
            <th className="border border-black p-1">비 고 및 상세 산정내역</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">현 금</td>
            <td className="border border-black p-1 text-right pr-2">0원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">10만원 미만</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">예 금</td>
            <td className="border border-black p-1 text-right pr-2">1,500,000원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">국민은행, 농협은행 합산 (압류금지 채권 범위 내)</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">보 험</td>
            <td className="border border-black p-1 text-right pr-2">623,281원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">예상해약환급금 합계 (150만원 이하 소액 면제)</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">자동차 / 오토바이</td>
            <td className="border border-black p-1 text-right pr-2">0원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">해당사항 없음 (무소유)</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">임차보증금</td>
            <td className="border border-black p-1 text-right pr-2">0원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">보증금 1,000만원 (주택임대차보호법상 최우선 소액보증금 5,500만원 전액 면제)</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">부동산</td>
            <td className="border border-black p-1 text-right pr-2">0원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">해당사항 없음</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold text-center">예상퇴직금</td>
            <td className="border border-black p-1 text-right pr-2">0원</td>
            <td className="border border-black p-1 text-center">무</td>
            <td className="border border-black p-1 text-[10px] pl-2">퇴직연금(DC형) 가입자로 민사집행법 제246조 압류금지 채권</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1 text-center">합 계</td>
            <td className="border border-black p-1 text-right pr-2">2,123,281원</td>
            <td className="border border-black p-1 text-center">-</td>
            <td className="border border-black p-1 text-[10px] pl-2">총 자산 평가액</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1 text-center">청 산 가 치</td>
            <td className="border border-black p-1 text-right pr-2 text-black font-bold">{repaymentSummary.liquidationValue.toLocaleString()}원</td>
            <td className="border border-black p-1 text-center">-</td>
            <td className="border border-black p-1 text-[10px] pl-2">법정 압류금지재산 공제 후 최종 청산가치 반영액</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ── 6. 수입 및 지출에 관한 목록 (10p) ──
export const IncomeExpenseDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { debtor, repaymentSummary } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-normal print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-4">
      <div className="text-center border-b border-black pb-1">
        <h2 className="text-xl font-bold tracking-wider">수입 및 지출에 관한 목록</h2>
      </div>

      <div className="space-y-1">
        <div className="font-bold text-xs">Ⅰ. 현재의 수입목록</div>
        <table className="w-full border-collapse border border-black text-[11px]">
          <tbody>
            <tr>
              <td rowSpan={2} className="border border-black font-bold text-center w-20">수입상황</td>
              <td className="border border-black p-1 w-20 text-center">고용(직장명)</td>
              <td className="border border-black p-1">{debtor.workplaceName}</td>
              <td className="border border-black p-1 w-20 text-center">직 위</td>
              <td className="border border-black p-1">{debtor.jobTitle}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-center">근무기간</td>
              <td colSpan={3} className="border border-black p-1">{debtor.tenureYearsMonths}</td>
            </tr>
            <tr>
              <td className="border border-black font-bold text-center">급 여</td>
              <td className="border border-black p-1 text-center">월 간</td>
              <td className="border border-black p-1 font-bold text-right pr-2">{repaymentSummary.monthlyNetIncome.toLocaleString()}원</td>
              <td className="border border-black p-1 text-center">연간환산액</td>
              <td className="border border-black p-1 text-right pr-2">{(repaymentSummary.monthlyNetIncome * 12).toLocaleString()}원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-1 pt-2">
        <div className="font-bold text-xs">Ⅱ. 변제계획 수행시의 예상지출 목록</div>
        <div className="border border-black p-3 space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="font-bold">☑</span>
            <span>
              채무자가 예상하는 생계비가 보건복지부 공표 기준중위소득의 60% 이하인 경우:<br />
              보건복지부 공표 ({repaymentSummary.householdSize})인 가족 기준중위소득 ({repaymentSummary.medianIncomeAmount.toLocaleString()}원)의 약 (60)%인 (<strong>{repaymentSummary.monthlyLivingCost.toLocaleString()}원</strong>)을 지출할 것으로 예상됩니다.
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <div className="font-bold text-xs">Ⅲ. 가족관계</div>
        <table className="w-full border-collapse border border-black text-center text-[11px]">
          <thead className="font-semibold">
            <tr>
              <th className="border border-black p-1">관계</th>
              <th className="border border-black p-1">성명</th>
              <th className="border border-black p-1">연령</th>
              <th className="border border-black p-1">동거여부</th>
              <th className="border border-black p-1">직업</th>
              <th className="border border-black p-1">월수입</th>
              <th className="border border-black p-1">부양유무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1">본인</td>
              <td className="border border-black p-1 font-bold">{debtor.name}</td>
              <td className="border border-black p-1">48세</td>
              <td className="border border-black p-1">동거</td>
              <td className="border border-black p-1">{debtor.jobTitle}</td>
              <td className="border border-black p-1 text-right pr-2">{repaymentSummary.monthlyNetIncome.toLocaleString()}원</td>
              <td className="border border-black p-1 font-bold">본인</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── 7. 월평균소득 산출 내역서 (11p, 12개월 테이블) ──
export const MonthlyIncomeLedgerDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { monthlyLedger, ledgerTotals, repaymentSummary } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[10px] leading-normal print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-3">
      <div className="text-center border-b border-black pb-1">
        <h2 className="text-lg font-bold tracking-wider">월평균소득 산출 내역서 (최근 1개년)</h2>
        <span className="text-[9px] text-black">(단위 : 원)</span>
      </div>

      <table className="w-full border-collapse border border-black text-center text-[9px]">
        <thead className="font-bold">
          <tr>
            <th className="border border-black p-1 w-14">소득내용</th>
            {monthlyLedger.map((r, i) => (
              <th key={i} className="border border-black p-1">{r.monthLabel}</th>
            ))}
            <th className="border border-black p-1 w-16">합계</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1 font-semibold">기본급</td>
            {monthlyLedger.map((r, i) => (
              <td key={i} className="border border-black p-1">{r.baseSalary.toLocaleString()}</td>
            ))}
            <td className="border border-black p-1 font-bold">{(monthlyLedger[0]?.baseSalary * 12).toLocaleString()}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold">상여금</td>
            {monthlyLedger.map((r, i) => (
              <td key={i} className="border border-black p-1">{r.bonus.toLocaleString()}</td>
            ))}
            <td className="border border-black p-1 font-bold">{(monthlyLedger[0]?.bonus * 12).toLocaleString()}</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1">소득합계</td>
            {monthlyLedger.map((r, i) => (
              <td key={i} className="border border-black p-1">{(r.baseSalary + r.bonus).toLocaleString()}</td>
            ))}
            <td className="border border-black p-1 text-black">{ledgerTotals.annualTotalIncome.toLocaleString()}</td>
          </tr>
          {/* 공제 항목 */}
          <tr>
            <td className="border border-black p-1 font-semibold">소득세</td>
            {monthlyLedger.map((r, i) => (
              <td key={i} className="border border-black p-1">{r.incomeTax.toLocaleString()}</td>
            ))}
            <td className="border border-black p-1">{(monthlyLedger[0]?.incomeTax * 12).toLocaleString()}</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-semibold">4대보험 등</td>
            {monthlyLedger.map((r, i) => {
              const ins = r.localTax + r.healthInsurance + r.nationalPension + r.employmentInsurance + r.longTermCare;
              return <td key={i} className="border border-black p-1">{ins.toLocaleString()}</td>;
            })}
            <td className="border border-black p-1">
              {((monthlyLedger[0]?.localTax + monthlyLedger[0]?.healthInsurance + monthlyLedger[0]?.nationalPension + monthlyLedger[0]?.employmentInsurance + monthlyLedger[0]?.longTermCare) * 12).toLocaleString()}
            </td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1">공제합계</td>
            {monthlyLedger.map((r, i) => {
              const ded = r.incomeTax + r.localTax + r.healthInsurance + r.nationalPension + r.employmentInsurance + r.longTermCare;
              return <td key={i} className="border border-black p-1">{ded.toLocaleString()}</td>;
            })}
            <td className="border border-black p-1 text-black">{ledgerTotals.annualTotalDeductions.toLocaleString()}</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black p-1">실수령액</td>
            {monthlyLedger.map((r, i) => {
              const total = (r.baseSalary + r.bonus) - (r.incomeTax + r.localTax + r.healthInsurance + r.nationalPension + r.employmentInsurance + r.longTermCare);
              return <td key={i} className="border border-black p-1">{total.toLocaleString()}</td>;
            })}
            <td className="border border-black p-1 text-black">{ledgerTotals.annualNetIncome.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* 종합 요약 */}
      <table className="w-full border-collapse border border-black text-center text-[10px] mt-2 font-semibold">
        <tbody>
          <tr>
            <td className="border border-black p-1">연 소득총액(A)</td>
            <td className="border border-black p-1 text-right pr-2">{ledgerTotals.annualTotalIncome.toLocaleString()}원</td>
            <td className="border border-black p-1">연 공제총액(B)</td>
            <td className="border border-black p-1 text-right pr-2">{ledgerTotals.annualTotalDeductions.toLocaleString()}원</td>
            <td className="border border-black p-1">연 실수령액(C)</td>
            <td className="border border-black p-1 text-right pr-2 font-bold">{ledgerTotals.annualNetIncome.toLocaleString()}원</td>
          </tr>
          <tr>
            <td className="border border-black p-1">월평균수입</td>
            <td className="border border-black p-1 font-bold text-black">{repaymentSummary.monthlyNetIncome.toLocaleString()}원</td>
            <td className="border border-black p-1">기준중위소득 조정액</td>
            <td className="border border-black p-1">{repaymentSummary.monthlyLivingCost.toLocaleString()}원</td>
            <td className="border border-black p-1">월평균 가용소득</td>
            <td className="border border-black p-1 font-bold text-black">{repaymentSummary.monthlyDisposableIncome.toLocaleString()}원</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ── 8. 진술서 및 별지 사유서 (12~15p) ──
export const WrittenStatementDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { statement, debtor } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-4">
      <div className="text-center border-b border-black pb-2">
        <h2 className="text-xl font-bold tracking-widest">진 술 서</h2>
      </div>

      <div className="space-y-1">
        <div className="font-bold text-xs">Ⅰ. 경력</div>
        <p>1. 최종학력 : {statement.education}</p>
        <p>2. 과거 경력 : {debtor.workplaceName} ({debtor.jobTitle}) 재직 중</p>
        <p>3. 과거 결혼/이혼 이력 : {statement.maritalHistory}</p>
      </div>

      <div className="space-y-1 pt-2">
        <div className="font-bold text-xs">Ⅱ. 현재 주거상황</div>
        <p>• 주거 형태 : {statement.housingType} ({statement.housingDetail})</p>
      </div>

      <div className="space-y-1 pt-2">
        <div className="font-bold text-xs">Ⅲ. 부채 상황 및 채무 증대 사유</div>
        <div className="border border-black p-2 text-[10px] space-y-1">
          <div>☑ 주요 채무 원인 : {statement.debtCauses.join(', ')}</div>
          <div>☑ 채권자로부터의 소송/지급명령/가압류 사실 있음 (별지 기재와 같음)</div>
        </div>
      </div>

      {/* 별지 상세 사유서 박스 */}
      <div className="pt-4 border-t-2 border-black">
        <div className="text-center font-bold text-sm mb-3">【별 지】 채무자가 많은 채무를 부담하게 된 사정 등에 관한 진술서</div>
        <div className="border border-black p-4 text-[11px] leading-loose text-justify bg-white min-h-[140px] whitespace-pre-wrap">
          {statement.detailedReasonEssay}
        </div>
      </div>
    </div>
  );
};

// ── 9. 변제계획안 [대법원 전산양식 A5433] (16~24p) ──
export const RepaymentPlanStandardDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { repaymentSummary, debtor, court, creditors } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-4">
      <div className="flex justify-between items-start border-b border-black pb-2">
        <span className="border border-black px-2 py-0.5 text-[10px] font-bold">[전산양식 A5433]</span>
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-widest">변 제 계 획 (안)</h2>
          <span className="text-[10px]">{court.caseNumber} 호 채무자 {debtor.name}</span>
        </div>
        <span className="text-[10px]">{court.applicationDate} 작성</span>
      </div>

      <div className="space-y-3 text-[11px] leading-relaxed">
        <div>
          <strong>1. 변제 기간</strong><br />
          이 사건 변제계획안이 인가되는 날의 다음달 25일부터 {repaymentSummary.repaymentMonths}개월간
        </div>

        <div>
          <strong>2. 변제에 제공되는 소득 또는 재산</strong><br />
          가. 소득: 신청인의 월 평균수입 {repaymentSummary.monthlyNetIncome.toLocaleString()}원에서 법정 생계비 {repaymentSummary.monthlyLivingCost.toLocaleString()}원을 공제한 <strong>월 가용소득 {repaymentSummary.monthlyDisposableIncome.toLocaleString()}원</strong>을 매월 변제에 제공함.<br />
          나. 재산: 청산가치 {repaymentSummary.liquidationValue.toLocaleString()}원 보장.
        </div>

        <div>
          <strong>3. 개인회생재단채권에 대한 변제</strong><br />
          회생위원 보수 150,000원은 인가 전 예납하고, 인가 후 임치금원의 1%를 매월 지급함.
        </div>

        <div>
          <strong>4. 일반의 우선권 있는 개인회생채권에 대한 변제</strong><br />
          국세 등 체납액이 있을 시 최초 분할변제 기일에 우선 변제함.
        </div>

        <div>
          <strong>6. 일반 개인회생채권에 대한 변제</strong><br />
          각 채권자의 원금 액수를 기준으로 월 가용소득을 안분하여 매월 25일에 변제함. (총 변제예정액: {repaymentSummary.totalRepaymentAmount.toLocaleString()}원, 변제율 {repaymentSummary.repaymentRatio}%)
        </div>

        <div className="border-t border-slate-300 pt-2">
          <strong>10. 기타사항 (법원 표준 및 사건별 특약사항)</strong>
          <div className="p-2 border border-black text-[10px] space-y-1.5 mt-1">
            {data.specialClauses && data.specialClauses.filter(c => c.isSelected).length > 0 ? (
              data.specialClauses.filter(c => c.isSelected).map((clause) => (
                <div key={clause.id} className="leading-relaxed">
                  <strong>&lt;{clause.title}&gt;</strong> {clause.content}
                </div>
              ))
            ) : (
              <div><strong>&lt;개인회생재단의 관리처분권 제한&gt;</strong> 채무자의 급여 가압류 적립금 및 공탁금은 회생재단에 속하고 처분권한은 회생위원이 갖는다.</div>
            )}
            {data.trusteeAccount && (
              <div className="pt-1.5 border-t border-slate-200 text-[10px] text-black">
                <strong>&lt;회생위원 임치계좌&gt;</strong> {data.trusteeAccount.bank} {data.trusteeAccount.accountNumber}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 10. 금지명령신청서 (25~26p) ──
export const ProhibitionOrderDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { debtor, lawyer, court } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[12px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px]">{court.caseNumber} 호 개인회생</div>
          <div className="text-[12px]">신청인(채무자) {debtor.name}</div>
          <div className="text-[11px] text-black">{debtor.residentAddress}</div>
        </div>
        <div className="border border-black p-2 text-center text-xs">
          인 지<br />2,000원
        </div>
      </div>

      <div className="text-center my-6">
        <h2 className="text-2xl font-bold tracking-widest">금 지 명 령 신 청 서</h2>
      </div>

      <div className="space-y-2">
        <h3 className="text-center font-bold text-sm tracking-widest">신 청 취 지</h3>
        <p className="indent-4 p-3 border border-black text-[12px]">
          신청인(채무자)에 대한 이 법원 {court.caseNumber}호 개인회생사건에 관하여 개인회생절차의 개시신청에 대한 개시결정이 있을 때까지 신청인에 대하여 그 결정 전의 원인으로 생긴 재산상의 청구권에 기하여 신청인의 급여, 주거용 임차보증금, 유체동산 등에 대하여 하는 강제집행·가압류 또는 가처분행위를 각 금지한다. 라는 결정을 구합니다.
        </p>
      </div>

      <div className="space-y-3 text-[12px]">
        <h3 className="text-center font-bold text-sm tracking-widest">신 청 이 유</h3>
        <p className="indent-4">
          1. 신청인은 귀원 {court.caseNumber}호 사건의 채무자로서 매월 급여에서 최저생계비를 제외한 가용소득으로 채무를 변제하는 계획안을 성실히 제출하였습니다.
        </p>
        <p className="indent-4">
          2. 만약 채권자들의 무차별적인 급여 압류 및 유체동산 강제집행이 계속될 경우 신청인은 직장생활 유지 및 변제계획 수행이 불가능해지므로 채무자회생법 제593조 제1항에 따라 본 신청에 이르렀습니다.
        </p>
        <div className="border border-black p-2 text-[11px]">
          &lt;급여 사용자&gt; 상호 : {debtor.workplaceName} / 대표자 : {debtor.workplaceCeo} / 주소 : {debtor.workplaceAddress}
        </div>
      </div>

      <div className="text-center pt-8">
        <p>{court.applicationDate}</p>
        <p className="mt-2 font-semibold">신청인 {debtor.name} &nbsp;&nbsp;&nbsp;&nbsp; 대리인 {lawyer.firmName} {lawyer.lawyerName} (인)</p>
        <p className="text-center font-bold text-base mt-6">{court.courtName} 민사신청과 귀 중</p>
      </div>
    </div>
  );
};

// ── 11. 중지명령신청서 (사건별 독립 생성, 27~29p) ──
export const StayOrderDoc: React.FC<DocTemplateProps & { caseItem: any; caseIndex: number }> = ({ data, caseItem, caseIndex, isEditable }) => {
  const { debtor, lawyer, court } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[12px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px]">{court.caseNumber} 호 개인회생</div>
          <div className="text-[12px]">신청인(채무자) {debtor.name}</div>
          <div className="text-[11px] text-black">{debtor.residentAddress}</div>
          <div className="text-[12px] font-semibold mt-1">채권자 : {caseItem.creditorName}</div>
        </div>
        <div className="border border-black p-2 text-center text-xs">
          인 지<br />2,000원
        </div>
      </div>

      <div className="text-center my-6">
        <h2 className="text-2xl font-bold tracking-widest">중 지 명 령 신 청 서</h2>
      </div>

      <div className="space-y-2">
        <h3 className="text-center font-bold text-sm tracking-widest">신 청 취 지</h3>
        <p className="indent-4 p-3 border border-black text-[12px]">
          신청인에 대한 이 법원 {court.caseNumber}호 개인회생사건에 관하여 개인회생절차의 개시신청에 대한 결정이 있을 때까지 신청인에 대한 <strong>{caseItem.courtName} {caseItem.caseNumber}호</strong> 사건의 압류 및 강제집행 절차를 중지한다. 라는 결정을 구합니다.
        </p>
      </div>

      <div className="space-y-3 text-[12px]">
        <h3 className="text-center font-bold text-sm tracking-widest">신 청 원 인</h3>
        <p className="indent-4">
          1. 신청인은 귀원 {court.caseNumber}호 사건의 채무자입니다.
        </p>
        <p className="indent-4">
          2. 위 사건의 개시결정 전에 상대방 채권자의 집행절차가 진행되면 채권자 간의 형평을 심각히 해하고 변제계획 수행에 막대한 지장을 초래하므로 채무자회생법 제593조 제1항에 의하여 중지명령을 신청합니다.
        </p>
        <div className="font-bold pt-2">소 명 방 법</div>
        <div>1. 압류 및 추심명령 결정문 사본 1통</div>
      </div>

      <div className="text-center pt-8">
        <p>{court.applicationDate}</p>
        <p className="mt-2 font-semibold">신청인 {debtor.name} &nbsp;&nbsp;&nbsp;&nbsp; 대리인 {lawyer.firmName} {lawyer.lawyerName} (인)</p>
        <p className="text-center font-bold text-base mt-6">{court.courtName} 민사신청과 귀 중</p>
      </div>
    </div>
  );
};

// ── 12. 대법원 및 4대 관할법원별 자료제출목록 (30~33p) ──
export const EvidenceSubmissionListDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { evidenceList, debtor, courtJurisdiction } = data;
  const jurisdictionMeta = COURT_JURISDICTIONS[courtJurisdiction || 'NATIONWIDE'] || COURT_JURISDICTIONS.NATIONWIDE;

  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[10px] leading-normal print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-3">
      <div className="text-center border-b border-black pb-2">
        <div className="flex justify-between items-center text-[9px] text-black mb-1 font-sans">
          <span>{jurisdictionMeta.appliedDate}</span>
          <span className="font-semibold text-black bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {jurisdictionMeta.title}
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-wider">
          {courtJurisdiction === 'DAEJEON'
            ? '대전지방법원 자료제출목록'
            : courtJurisdiction === 'GANGNEUNG'
            ? '【별지 서식】 자료제출목록 (춘천지방법원 강릉지원)'
            : courtJurisdiction === 'CHEONGJU'
            ? '청주지방법원 자료제출목록'
            : '【별지 제7호】 자 료 제 출 목 록'}
        </h2>
        <p className="text-[9px] text-black mt-0.5">{jurisdictionMeta.subTitle}</p>
        <div className="flex justify-between items-center text-[10px] pt-1.5 text-black">
          <span>채무자: <strong>{debtor.name}</strong> (인)</span>
          <span className="text-[9px] text-black">※ 아래 표의 해당란에 체크하고 뒷면에 제출하는 서류를 순서대로 첨부합니다.</span>
        </div>
      </div>

      {/* 법원별 필수 지침 안내 배너 */}
      <div className="p-2.5 border border-amber-300 bg-amber-50/70 text-[9px] text-amber-950 rounded font-sans leading-relaxed">
        <div className="font-bold text-amber-900 flex items-center gap-1 mb-0.5">
          <span>⚖️ {jurisdictionMeta.title} 제출 유의사항</span>
        </div>
        <div>{jurisdictionMeta.specialNotice}</div>
      </div>

      <table className="w-full border-collapse border border-black text-[10px]">
        <thead className="font-bold text-center">
          <tr>
            <th className="border border-black p-1 w-2/5">서 류 명</th>
            <th className="border border-black p-1 w-12">제출</th>
            <th className="border border-black p-1">제출 못하거나 일부만 제출한 이유</th>
            <th className="border border-black p-1 w-14">10번제출</th>
          </tr>
        </thead>
        <tbody>
          {evidenceList.map((ev) => (
            <tr key={ev.id} className={ev.isRequired ? 'bg-indigo-50/20' : ''}>
              <td className="border border-black p-1">
                <div className="font-semibold text-black flex items-center gap-1">
                  {ev.isRequired && <span className="text-red-600 font-bold">*</span>}
                  <span>{ev.name}</span>
                </div>
                <div className="text-[8px] text-gray-800">{ev.categoryTitle}</div>
                {ev.noticeText && (
                  <div className="text-[8px] text-black font-sans mt-0.5 font-medium">
                    {ev.noticeText}
                  </div>
                )}
              </td>
              <td className="border border-black p-1 text-center font-bold text-black text-xs">
                {ev.isSubmitted ? '☑' : '☐'}
              </td>
              <td className="border border-black p-1 text-black text-[9px]">
                {ev.unsubmittedReason || (ev.isSubmitted ? '' : '해당사항 없음')}
              </td>
              <td className="border border-black p-1 text-center">
                {ev.isCreditRehabSubmission ? '☑' : '☐'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── 13. 소송위임장 및 의뢰인 확인서 (34~35p) ──
export const PowerOfAttorneyAndPledgeDoc: React.FC<DocTemplateProps> = ({ data, isEditable }) => {
  const { debtor, lawyer, court } = data;
  return (
    <div className="court-page bg-white pt-[170px] pb-[113px] px-[76px] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[11px] leading-relaxed print:border-none print:shadow-none print:pt-[170px] print:pb-[113px] print:px-[76px] space-y-6">
      <div className="text-center border-b border-black pb-2">
        <h2 className="text-2xl font-bold tracking-widest">소 송 위 임 장</h2>
      </div>

      <div className="border border-black p-3 space-y-1 text-[12px]">
        <div>사 건 : {court.caseNumber} 호 개인회생</div>
        <div>신청인 : {debtor.name} ({debtor.residentNumber})</div>
      </div>

      <p className="indent-4 text-[12px]">
        위 개인회생 사건에 관하여 아래 수임인을 소송대리인으로 선임하고, 일체의 소송행위, 소의 취하, 항고 제기 및 복대리인 선임에 관한 전권을 수여함.
      </p>

      <div className="border border-black p-3 text-[11px] space-y-1">
        <div>수 임 인 : {lawyer.firmName} {lawyer.lawyerName}</div>
        <div>주 소 : {lawyer.address}</div>
        <div>전 화 : {lawyer.phone} / FAX : {lawyer.fax}</div>
      </div>

      <div className="border-t-2 border-black pt-6 space-y-3">
        <div className="text-center font-bold text-base mb-2">확 인 서 (의뢰인 확약)</div>
        <p className="text-[10px] leading-relaxed text-black">
          본인은 귀 사무소에 개인회생 사건을 의뢰함에 있어 재산과 소득을 사실대로 진술하였으며, 채무 누락이나 은닉 시 면책 불허가 및 형사처벌을 받을 수 있음을 명확히 고지받고 이에 서명합니다.
        </p>
        <div className="flex justify-between items-center pt-2 font-bold text-xs">
          <span>{court.applicationDate}</span>
          <span>위 확인자 (사건의뢰인) {debtor.name} (인)</span>
        </div>
      </div>
    </div>
  );
};
