import React, { useRef } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, Shield } from 'lucide-react';
import type { RepaymentPlanData } from '../../../services/repayment/repaymentTypes';
import { exportCourtRepaymentScheduleExcel } from '../../../services/repayment/repaymentExcelExporter';

interface PrintableRepaymentPlanModalProps {
  plan: RepaymentPlanData;
  isOpen: boolean;
  onClose: () => void;
  lawyerName?: string;
}

export default function PrintableRepaymentPlanModal({
  plan,
  isOpen,
  onClose,
  lawyerName = '담당 변호사',
}: PrintableRepaymentPlanModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isD5111 = plan.formType === 'D5111';
  const unsecuredCreditors = plan.creditors.filter((c) => !c.isSecured);

  const confirmedCreditors = plan.creditors.filter((c) => !c.isUnconfirmed);
  const unconfirmedCreditors = plan.creditors.filter((c) => c.isUnconfirmed);

  const totalConfirmedPrincipal = confirmedCreditors.reduce((s, c) => s + c.principal, 0);
  const totalUnconfirmedPrincipal = unconfirmedCreditors.reduce((s, c) => s + c.principal, 0);

  const totalConfirmedMonthly = confirmedCreditors.reduce((s, c) => s + c.monthlyRepayment, 0);
  const totalUnconfirmedMonthly = unconfirmedCreditors.reduce((s, c) => s + c.monthlyRepayment, 0);

  const totalConfirmedRepayment = confirmedCreditors.reduce((s, c) => s + c.totalRepayment, 0);
  const totalUnconfirmedRepayment = unconfirmedCreditors.reduce((s, c) => s + c.totalRepayment, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* 상단 컨트롤 바 (화면 전용, 인쇄 시 숨김) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  대법원 표준 [전산양식 {isD5111 ? 'D5111' : 'D5110'}] 변제계획안
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {isD5111 ? '가용소득+재산처분 병행' : '가용소득 전용'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                전자소송 제출용 공식 서식 전문 미리보기 및 인쇄 / PDF 출력
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCourtRepaymentScheduleExcel(plan)}
              className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>변제예정액표 엑셀</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 영역 (인쇄 시 이 부분만 풀스크린 인쇄) */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-slate-100/60 print:bg-white print:p-0">
          <div
            ref={printRef}
            className="max-w-[210mm] mx-auto bg-white p-10 sm:p-14 shadow-lg print:shadow-none border border-slate-200 print:border-none text-slate-900 font-sans leading-relaxed text-[13px]"
            style={{ minHeight: '297mm' }}
          >
            {/* 전산양식 헤더 */}
            <div className="text-right text-[11px] text-slate-500 font-mono mb-2">
              [전산양식 {isD5111 ? 'D5111' : 'D5110'}]
            </div>

            <div className="text-center my-6">
              <h1 className="text-2xl font-black tracking-widest text-slate-950 pb-2 border-b-2 border-slate-900 inline-block px-8">
                변 제 계 획 안
              </h1>
            </div>

            {/* 사건 및 당사자 정보 */}
            <div className="space-y-1.5 my-6 text-sm">
              <div className="flex">
                <span className="w-24 font-bold text-slate-700">사 건:</span>
                <span className="font-semibold text-slate-900">
                  {plan.caseNumber || '2026개회        호 개인회생'}
                </span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-slate-700">신청인(채무자):</span>
                <span className="font-semibold text-slate-900">{plan.clientName}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-slate-700">대 리 인:</span>
                <span className="font-semibold text-slate-900">{lawyerName}</span>
              </div>
            </div>

            <hr className="border-slate-300 my-6" />

            {/* 본문 항목 */}
            <div className="space-y-6 text-slate-900">
              {/* 1. 변제기간 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  1. 변제기간
                </h3>
                <p className="pl-4 leading-relaxed text-slate-800">
                  변제개시일인 <strong className="text-slate-950 font-bold">{plan.startYearMonth}. {plan.paymentDayOfMonth}일</strong>부터{' '}
                  <strong className="text-slate-950 font-bold">{plan.endYearMonth}. {plan.paymentDayOfMonth}일</strong>까지{' '}
                  <strong className="text-slate-950 font-bold underline underline-offset-4">{plan.months}개월간</strong> 매월 {plan.paymentDayOfMonth}일에 변제한다.
                </p>
              </section>

              {/* 2. 변제에 제공되는 소득 등 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  2. 변제에 제공되는 소득 등
                </h3>
                <div className="pl-4 space-y-1.5 text-slate-800">
                  <p>
                    가. 채무자의 월평균 실수령 수입:{' '}
                    <strong className="font-bold text-slate-950">{plan.incomeExpense.monthlyNetIncome.toLocaleString()}원</strong>
                  </p>
                  <p>
                    나. 채무자 및 부양가족({plan.incomeExpense.householdSize}인)의 인정 생계비:{' '}
                    <strong className="font-bold text-slate-950">{plan.calculatedLiving.finalTotalLivingExpense.toLocaleString()}원</strong>
                    <span className="text-xs text-slate-500 block pl-4 mt-0.5">
                      (2026 기준 기초생계비 {plan.calculatedLiving.baseLivingExpense.toLocaleString()}원 + 인정 추가주거비 {plan.calculatedLiving.additionalHousingDeduction.toLocaleString()}원 + 기타추가생계비 {(plan.calculatedLiving.totalAdditionalExpense - plan.calculatedLiving.additionalHousingDeduction).toLocaleString()}원)
                    </span>
                  </p>
                  <p>
                    다. 월 실제 가용소득(변제금):{' '}
                    <strong className="font-bold text-blue-900 text-sm">{plan.monthlyRepaymentTotal.toLocaleString()}원</strong>
                    {plan.calculatedLiving.trusteeFee > 0 && (
                      <span className="text-xs text-slate-500 ml-1">
                        (외부회생위원 보수 1% {plan.calculatedLiving.trusteeFee.toLocaleString()}원 별도 차감)
                      </span>
                    )}
                  </p>
                </div>
              </section>

              {/* 3. 재단채권 및 우선권 있는 채권 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  3. 개인회생재단채권 및 우선권 있는 개인회생채권에 대한 변제
                </h3>
                <div className="pl-4 space-y-2 text-slate-800 leading-relaxed">
                  <p>
                    개인회생재단채권은 수시로 우선 변제하며, 조세 등 일반의 우선권 있는 개인회생채권이 있는 경우 일반 개인회생채권에 우선하여 전액 변제에 충당한다.
                  </p>
                  {plan.isTwoStageRepayment && (plan.totalPriorityDebt || 0) > 0 && (
                    <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950">
                      <strong>[우선권 채권 2단계 분할배분 특칙]</strong><br />
                      국세, 지방세, 4대보험료 등 우선권 있는 개인회생채권(합계 <strong className="font-bold font-mono">{plan.totalPriorityDebt?.toLocaleString()}원</strong>)은 법원 실무준칙에 의하여 전체 변제기간의 1/2인 <strong>제1회부터 제{plan.stage1Months}회차까지</strong> 매월 우선 변제하여 전액 완제한다.
                    </div>
                  )}
                </div>
              </section>

              {/* 4. 일반 개인회생채권에 대한 변제 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  4. 일반 개인회생채권에 대한 변제
                </h3>
                <div className="pl-4 space-y-2 text-slate-800 leading-relaxed">
                  {plan.isTwoStageRepayment ? (
                    <p>
                      일반 개인회생채권은 제1단계(제1회~제{plan.stage1Months}회)에는 우선권 채권 충당 후 잔여 가용소득을 안분하여 변제하고, 우선권 채권이 전액 완제된 제2단계(제{plan.stage1Months + 1}회~제{plan.months}회)에는 월 가용소득 전액(<strong className="font-bold text-slate-950 font-mono">{plan.stage2MonthlyRepaymentTotal?.toLocaleString()}원</strong>)을 원금 비율에 따라 안분하여 변제한다.
                    </p>
                  ) : (
                    <p>
                      별첨 [개인회생채권 변제예정액표] 기재와 같이 각 채권자의 원금액 비율에 따라 매월 안분하여 변제하며, 총 {plan.months}회에 걸쳐 총{' '}
                      <strong className="font-bold text-slate-950">{plan.totalRepaymentAmount.toLocaleString()}원</strong>을 변제한다.
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    * 원금 기준 총 변제율: <strong className="font-bold text-blue-900">{plan.totalRepaymentRate}%</strong> (원금 탕감률: {plan.forgivenessRate}%)
                  </p>

                  {plan.totalUnconfirmedReserve && plan.totalUnconfirmedReserve > 0 && (
                    <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs text-indigo-950">
                      <strong>[미확정 채권 공탁 유보금 특칙]</strong><br />
                      채권액이 확정되지 아니하거나 별제권 행사 미료 채권(총 안분액 <strong className="font-bold font-mono">{plan.totalUnconfirmedReserve.toLocaleString()}원</strong>)에 대한 변제액은 채권 확정 시까지 회생위원이 관리하는 공탁계좌에 매월 유보(적립)하며, 채권 조사확정 또는 담보권 실행 종료 후 일괄 지급한다.
                    </div>
                  )}
                </div>
              </section>

              {/* 5. D5111 재산처분에 의한 변제 (D5111 양식인 경우) */}
              {isD5111 && (
                <section className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                  <h3 className="text-sm font-black text-amber-950 mb-1.5">
                    5. 재산처분에 의한 변제 (전산양식 D5111 적용)
                  </h3>
                  <p className="pl-2 leading-relaxed text-amber-900 text-xs">
                    채무자 보유 재산(부동산/자동차 등) 중 청산가치 충족을 위하여{' '}
                    <strong className="font-bold text-amber-950">{plan.requiredDisposalAmount.toLocaleString()}원</strong> 상당을 처분 기한({plan.disposalTargetDeadline || '인가일로부터 1년 이내'}) 내에 환가하여 개인회생 변제에 추가 투입한다.
                  </p>
                </section>
              )}

              {/* 6. 청산가치 보장 및 최저변제액 확인 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  {isD5111 ? '6' : '5'}. 청산가치 보장의 원칙 및 최저변제액 충족 확인
                </h3>
                <div className="pl-4">
                  <table className="w-full text-xs border-collapse border border-slate-300 text-center my-2">
                    <thead className="bg-slate-100 text-slate-900 font-bold">
                      <tr>
                        <th className="border border-slate-300 py-1.5 px-2">항목</th>
                        <th className="border border-slate-300 py-1.5 px-2">산정 금액</th>
                        <th className="border border-slate-300 py-1.5 px-2">법정 요건</th>
                        <th className="border border-slate-300 py-1.5 px-2">충족 여부</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold bg-slate-50/50">
                          (J) 총 청산가치
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-mono">
                          {plan.totalLiquidationValue.toLocaleString()}원
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-slate-600">
                          보유재산 환가액
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold text-emerald-700">
                          기준 확정
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold bg-slate-50/50">
                          (L) 라이프니쯔 현재가치
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-mono font-bold text-blue-900">
                          {plan.presentValue.toLocaleString()}원
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-slate-600">
                          L ≥ J (청산가치 보장)
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold">
                          {plan.satisfiesLiquidationGuarantee ? (
                            <span className="text-emerald-600">보장 충족 (합격)</span>
                          ) : (
                            <span className="text-rose-600">미달 (보정필요)</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold bg-slate-50/50">
                          법정 최저변제액
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-mono">
                          {plan.minimumRepaymentThreshold.toLocaleString()}원
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-slate-600">
                          총변제액 ≥ 최저액
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 font-bold text-emerald-600">
                          충족 (합격)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-500 mt-1">
                    * 서울회생법원 실무준칙에 의거 연 5% 복리할인 라이프니쯔식 현가 계수 {plan.leibnizFactor}(선적립 3개월 적용)를 반영함.
                  </p>
                </div>
              </section>

              {/* 7. 면책의 효력 */}
              <section>
                <h3 className="text-sm font-black text-slate-950 mb-2">
                  {isD5111 ? '7' : '6'}. 면책의 효력
                </h3>
                <p className="pl-4 leading-relaxed text-slate-800">
                  채무자가 본 변제계획에 따른 변제를 완료한 때에는 법 제624조에 따라 면책 결정을 신청하며, 면책 결정이 확정되면 변제계획에 의해 변제되지 아니한 잔여 채무에 대하여 책임이 면제된다.
                </p>
              </section>
            </div>

            {/* 작성일자 및 날인란 */}
            <div className="mt-14 pt-8 text-center space-y-4 text-sm border-t border-slate-200">
              <p className="text-slate-800 font-semibold tracking-wider">
                {plan.submissionDate || new Date().toISOString().slice(0, 10).replace(/-/g, '. ')}
              </p>
              
              <div className="space-y-2 pt-2">
                <div className="flex justify-center items-center gap-6">
                  <span className="font-bold text-slate-800">신청인(채무자):</span>
                  <span className="w-40 text-left font-bold text-slate-950">{plan.clientName}</span>
                  <span className="text-xs text-slate-400 border border-slate-300 px-2 py-0.5 rounded-sm">(인)</span>
                </div>
                <div className="flex justify-center items-center gap-6">
                  <span className="font-bold text-slate-800">대리인 변호사:</span>
                  <span className="w-40 text-left font-bold text-slate-950">{lawyerName}</span>
                  <span className="text-xs text-slate-400 border border-slate-300 px-2 py-0.5 rounded-sm">(인)</span>
                </div>
              </div>

              <div className="pt-8">
                <h2 className="text-lg font-black tracking-widest text-slate-950">
                  {plan.courtName} 귀중
                </h2>
              </div>
            </div>

            {/* ── [별첨] 개인회생채권 변제예정액표 (D5110/D5111 대법원 전산서식 2단 헤더) ── */}
            <div className="mt-16 pt-12 border-t-2 border-slate-900 print:break-before-page">
              <div className="text-right text-[11px] text-slate-500 font-mono mb-2">
                [별첨]
              </div>
              <div className="text-center my-4">
                <h2 className="text-xl font-black tracking-wider text-slate-950 pb-1 inline-block border-b border-slate-800">
                  개인회생채권 변제예정액표
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  사건번호: {plan.caseNumber || '2026개회        호'} | 신청인: {plan.clientName}
                </p>
              </div>

              {/* 2단 헤더 법원 표준 서식 테이블 */}
              <div className="overflow-x-auto my-4">
                <table className="w-full text-[11px] border-collapse border border-slate-400 text-center">
                  <thead className="bg-slate-100 text-slate-900 font-bold">
                    <tr>
                      <th rowSpan={2} className="border border-slate-400 px-1 py-2 w-10">채권<br/>번호</th>
                      <th rowSpan={2} className="border border-slate-400 px-2 py-2 text-left min-w-[120px]">채권자명</th>
                      <th rowSpan={2} className="border border-slate-400 px-1 py-2 w-20">채권의<br/>구분</th>
                      <th colSpan={2} className="border border-slate-400 px-2 py-1.5">(D) 개인회생채권액 (원금)</th>
                      <th rowSpan={2} className="border border-slate-400 px-1 py-2 w-14">안분<br/>비율(%)</th>
                      <th colSpan={2} className="border border-slate-400 px-2 py-1.5">(E) 월 변제예정(유보)액</th>
                      <th colSpan={2} className="border border-slate-400 px-2 py-1.5">(F) 총 변제예정(유보)액</th>
                      <th rowSpan={2} className="border border-slate-400 px-1 py-2 w-14">변제율<br/>(%)</th>
                    </tr>
                    <tr>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">확정 채권</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">미확정 채권</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">확정 채권</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">미확정(유보)</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">확정 채권</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-slate-800 font-semibold text-[10px]">미확정(유보)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {plan.creditors.map((c) => {
                      const isUnconfirmed = !!c.isUnconfirmed;
                      return (
                        <tr key={c.id} className={c.isPriority ? 'bg-amber-50/40' : isUnconfirmed ? 'bg-slate-50/60' : ''}>
                          <td className="border border-slate-400 py-1.5 px-1 font-mono">{c.creditorNumber}</td>
                          <td className="border border-slate-400 py-1.5 px-2 text-left font-semibold">
                            {c.name}
                            {c.isPriority && <span className="ml-1 text-[9px] text-amber-700 font-bold">[우선권]</span>}
                            {isUnconfirmed && <span className="ml-1 text-[9px] text-indigo-700 font-bold">[미확정]</span>}
                          </td>
                          <td className="border border-slate-400 py-1.5 px-1 text-[10px] text-slate-700">
                            {c.isPriority ? '우선권채권' : c.isSecured ? '담보부채권' : '일반회생채권'}
                          </td>
                          {/* (D) 개인회생채권액 */}
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                            {!isUnconfirmed ? c.principal.toLocaleString() : '-'}
                          </td>
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-500">
                            {isUnconfirmed ? c.principal.toLocaleString() : '-'}
                          </td>
                          {/* 안분비율 */}
                          <td className="border border-slate-400 py-1.5 px-1 font-mono text-[10px]">
                            {c.allocationRatio.toFixed(2)}%
                          </td>
                          {/* (E) 월 변제예정액 */}
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                            {!isUnconfirmed ? c.monthlyRepayment.toLocaleString() : '-'}
                          </td>
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-indigo-700 font-medium">
                            {isUnconfirmed ? c.monthlyRepayment.toLocaleString() : '-'}
                          </td>
                          {/* (F) 총 변제예정액 */}
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                            {!isUnconfirmed ? c.totalRepayment.toLocaleString() : '-'}
                          </td>
                          <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-indigo-700 font-medium">
                            {isUnconfirmed ? c.totalRepayment.toLocaleString() : '-'}
                          </td>
                          {/* 변제율 */}
                          <td className="border border-slate-400 py-1.5 px-1 font-mono text-[10px] font-bold">
                            {c.repaymentRate.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}

                    {/* 소계: 확정 채권 */}
                    <tr className="bg-slate-100/70 font-semibold text-[10px]">
                      <td colSpan={3} className="border border-slate-400 py-1.5 px-2 text-center text-slate-800">
                        소계 (확정채권)
                      </td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                        {totalConfirmedPrincipal.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                      <td className="border border-slate-400 py-1.5 px-1 font-mono">
                        {plan.totalPrincipal > 0 ? ((totalConfirmedPrincipal / plan.totalPrincipal) * 100).toFixed(2) : '0'}%
                      </td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                        {totalConfirmedMonthly.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono">
                        {totalConfirmedRepayment.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                      <td className="border border-slate-400 py-1.5 px-1 font-mono">
                        {totalConfirmedPrincipal > 0 ? ((totalConfirmedRepayment / totalConfirmedPrincipal) * 100).toFixed(1) : '0'}%
                      </td>
                    </tr>

                    {/* 소계: 미확정 채권(공탁유보) */}
                    {unconfirmedCreditors.length > 0 && (
                      <tr className="bg-indigo-50/50 font-semibold text-[10px]">
                        <td colSpan={3} className="border border-slate-400 py-1.5 px-2 text-center text-indigo-900">
                          소계 (미확정 채권 공탁유보)
                        </td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-indigo-900">
                          {totalUnconfirmedPrincipal.toLocaleString()}
                        </td>
                        <td className="border border-slate-400 py-1.5 px-1 font-mono">
                          {plan.totalPrincipal > 0 ? ((totalUnconfirmedPrincipal / plan.totalPrincipal) * 100).toFixed(2) : '0'}%
                        </td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-indigo-900">
                          {totalUnconfirmedMonthly.toLocaleString()}
                        </td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-slate-400">-</td>
                        <td className="border border-slate-400 py-1.5 px-1.5 text-right font-mono text-indigo-900">
                          {totalUnconfirmedRepayment.toLocaleString()}
                        </td>
                        <td className="border border-slate-400 py-1.5 px-1 font-mono">
                          {totalUnconfirmedPrincipal > 0 ? ((totalUnconfirmedRepayment / totalUnconfirmedPrincipal) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    )}

                    {/* 총계 (G) / (H) / (I) */}
                    <tr className="bg-slate-200 font-bold text-[11px] text-slate-950">
                      <td colSpan={3} className="border border-slate-400 py-2 px-2 text-center">
                        총계 [ (G) / (H) / (I) ]
                      </td>
                      <td colSpan={2} className="border border-slate-400 py-2 px-2 text-right font-mono">
                        (G) {plan.totalPrincipal.toLocaleString()}원
                      </td>
                      <td className="border border-slate-400 py-2 px-1 font-mono">100.00%</td>
                      <td colSpan={2} className="border border-slate-400 py-2 px-2 text-right font-mono text-blue-900">
                        (H) {plan.monthlyRepaymentTotal.toLocaleString()}원
                      </td>
                      <td colSpan={2} className="border border-slate-400 py-2 px-2 text-right font-mono text-blue-900">
                        (I) {plan.totalRepaymentAmount.toLocaleString()}원
                      </td>
                      <td className="border border-slate-400 py-2 px-1 font-mono text-blue-900">
                        {plan.totalRepaymentRate}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2단계 변제 추가 상세 안내 (2단계 분할 시) */}
              {plan.isTwoStageRepayment && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-slate-900">[2단계 분할변제 회차별 월 변제 안내]</div>
                  <div className="text-slate-700 leading-relaxed text-[11px]">
                    • <strong>제1단계 (제1회 ~ 제{plan.stage1Months}회차, {plan.stage1Months}개월간)</strong>: 월 총 변제금 <span className="font-mono font-bold">{plan.stage1MonthlyRepaymentTotal?.toLocaleString()}원</span> (우선권 채권 우선 전액 충당 및 잔여액 일반채권 안분)<br />
                    • <strong>제2단계 (제{plan.stage1Months! + 1}회 ~ 제{plan.months}회차, {plan.stage2Months}개월간)</strong>: 월 총 변제금 <span className="font-mono font-bold">{plan.stage2MonthlyRepaymentTotal?.toLocaleString()}원</span> (일반 채권 원금비율 전액 안분 변제)
                  </div>
                </div>
              )}

              {/* 하단 법적 고지문 */}
              <div className="mt-4 text-[10px] text-slate-500 leading-relaxed space-y-0.5">
                <p>* 본 변제예정액표는 「채무자 회생 및 파산에 관한 법률」 및 법원 개인회생 실무준칙에 따라 작성되었습니다.</p>
                <p>* 미확정 채권에 대한 변제예정액은 채권 확정 시까지 회생위원이 관리하는 공탁계좌에 매월 유보·적립됩니다.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
