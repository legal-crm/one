import React, { useRef } from 'react';
import { 
  Printer, Download, X, FileText, CheckCircle2, 
  ShieldCheck, AlertCircle, Sparkles, Scale, Info
} from 'lucide-react';
import { toast } from 'sonner';
import type { IncomeExpenseD5103Data } from '../../../types/incomeExpenseTypes';

interface PrintableIncomeExpenseModalProps {
  data: IncomeExpenseD5103Data;
  isOpen: boolean;
  onClose: () => void;
  onAttachToPackage?: () => void;
}

export default function PrintableIncomeExpenseModal({
  data,
  isOpen,
  onClose,
  onAttachToPackage
}: PrintableIncomeExpenseModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 설정 창에서 대상 프린터를 [PDF로 저장]으로 선택하시면 대법원 표준 D5103 서식 PDF가 저장됩니다.');
  };

  const isSalary = data.incomeType === 'SALARY';
  const sal = data.salary;
  const biz = data.business;
  const exp = data.expenses;
  const disp = data.disposableIncome;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* 상단 컨트롤 바 (화면 전용, 인쇄 시 숨김) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
              ⚖️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  대법원 표준 [전산양식 D5103] 채무자의 수입 및 지출에 관한 목록
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  법정 필수 서식
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{data.debtorName}</strong> · 사건: {data.caseNumber} ({data.courtName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAttachToPackage && (
              <button
                onClick={onAttachToPackage}
                className="px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 rounded-xl hover:bg-emerald-900 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                title="전자소송 14종 패키지의 R08 슬롯에 완성본 첨부"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>전자소송 R08 연결</span>
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 저장</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 즉시 인쇄</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 영역 (인쇄 시 이 부분만 A4 크기로 풀페이지 출력) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:bg-white print:p-0">
          <div
            ref={printRef}
            className="max-w-[210mm] mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none border border-slate-200 print:border-none text-slate-900 font-sans leading-relaxed text-[12.5px]"
            style={{ minHeight: '297mm' }}
          >
            {/* 전산양식 헤더 */}
            <div className="flex justify-between items-start text-[11px] text-slate-500 font-mono mb-4 border-b border-slate-200 pb-2">
              <span>[신청서 첨부서류 3]</span>
              <span className="font-bold text-slate-700">[전산양식 D5103]</span>
            </div>

            {/* 메인 타이틀 */}
            <div className="text-center my-6">
              <h1 className="text-2xl font-black tracking-widest text-slate-900 mb-1">
                수입 및 지출에 관한 목록
              </h1>
              <p className="text-xs text-slate-500">
                (채무자 회생 및 파산에 관한 법률 제589조 제2항 제3호)
              </p>
            </div>

            {/* 사건 및 당사자 표시 */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 mb-6 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-slate-700">사 건: {data.caseNumber} 개인회생</span>
                <span className="text-slate-600">신청일자: {data.createdDate}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  <strong>신 청 인(채무자):</strong> {data.debtorName}
                  {data.residentNumberMasked && <span className="ml-2 font-mono text-slate-600">({data.residentNumberMasked})</span>}
                </span>
                <span><strong>대리인 변호사:</strong> {data.attorneyName}</span>
              </div>
            </div>

            {/* ══════════ 1. 현재의 수입목록 ══════════ */}
            <div className="mb-6">
              <h2 className="text-sm font-black text-slate-900 border-b-2 border-slate-800 pb-1 mb-2.5 flex items-center justify-between">
                <span>1. 현재의 수입목록</span>
                <span className="text-xs font-normal text-slate-600">
                  구분: {isSalary ? '급여소득자' : '영업소득자'}
                </span>
              </h2>

              {isSalary ? (
                /* 급여소득자 명세 표 */
                <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="p-2 font-bold w-28 text-slate-700 border-r border-slate-200">근무처(직장명)</td>
                        <td className="p-2 border-r border-slate-200">{sal.employerName}</td>
                        <td className="p-2 font-bold w-24 text-slate-700 border-r border-slate-200">직위/직종</td>
                        <td className="p-2">{sal.jobTitle}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">입사일자</td>
                        <td className="p-2 border-r border-slate-200">{sal.employmentStartDate}</td>
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">1년내 변동</td>
                        <td className="p-2">{sal.hasRecentJobChange ? '있음 (변동 후 소득 평균)' : '없음 (정상 근속)'}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-700 border-r border-slate-200">매월 정기 수령액</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                          {sal.monthlyBasePay.toLocaleString()} 원
                        </td>
                        <td className="p-2 font-bold text-slate-700 border-r border-slate-200">상여금 월환산</td>
                        <td className="p-2 text-right font-mono">
                          {sal.monthlyBonusConverted.toLocaleString()} 원 (연 {sal.annualBonus.toLocaleString()}원)
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">
                          법정 공제액 합계<br />
                          <span className="text-[10px] font-normal text-slate-500">(세금 및 4대보험)</span>
                        </td>
                        <td colSpan={3} className="p-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mb-1">
                            <span>소득세: {sal.incomeTax.toLocaleString()}원</span>
                            <span>주민세: {sal.residentTax.toLocaleString()}원</span>
                            <span>건강보험: {sal.healthInsurance.toLocaleString()}원</span>
                            <span>국민연금: {sal.nationalPension.toLocaleString()}원</span>
                            <span>고용보험: {sal.employmentInsurance.toLocaleString()}원</span>
                          </div>
                          <div className="text-right font-mono font-bold text-rose-700 text-xs">
                            공제 합계: -{sal.totalStatutoryDeductions.toLocaleString()} 원
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-blue-50/60 font-bold">
                        <td className="p-2.5 text-blue-900 border-r border-slate-300">공제 후 월 순수입</td>
                        <td className="p-2.5 text-right font-mono text-blue-900 text-sm border-r border-slate-300">
                          {sal.netMonthlyIncome.toLocaleString()} 원
                        </td>
                        <td className="p-2.5 text-blue-900 border-r border-slate-300">연간 환산액</td>
                        <td className="p-2.5 text-right font-mono text-blue-900">
                          {sal.annualConvertedIncome.toLocaleString()} 원
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* 영업소득자 명세 표 */
                <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="p-2 font-bold w-28 text-slate-700 border-r border-slate-200">수입 명목</td>
                        <td className="p-2 border-r border-slate-200">{biz.businessCategory}</td>
                        <td className="p-2 font-bold w-24 text-slate-700 border-r border-slate-200">상호 및 등록번호</td>
                        <td className="p-2">{biz.businessName} ({biz.businessRegistrationNo})</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">최근 1년 총매출</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                          {biz.annualGrossRevenue.toLocaleString()} 원
                        </td>
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">영업비용(필요경비)</td>
                        <td className="p-2 text-right font-mono text-rose-700">
                          -{biz.annualOperatingExpenses.toLocaleString()} 원
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">제세공과금(소득세)</td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono text-rose-700">
                          -{biz.annualTaxes.toLocaleString()} 원
                        </td>
                        <td className="p-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">연간 순소득액</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {biz.netAnnualBusinessIncome.toLocaleString()} 원
                        </td>
                      </tr>
                      <tr className="bg-blue-50/60 font-bold">
                        <td className="p-2.5 text-blue-900 border-r border-slate-300">월평균 순수입액</td>
                        <td colSpan={3} className="p-2.5 text-right font-mono text-blue-900 text-sm">
                          {biz.monthlyAverageIncome.toLocaleString()} 원 (연간 순소득액 ÷ 12)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* 압류 유무 표시 */}
              <div className="mt-2 text-xs border border-slate-200 rounded p-2 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-700">수입에 대한 압류·가압류 강제집행:</span>
                  <span className="font-bold">
                    {data.seizure.hasSeizure ? (
                      <span className="text-rose-600">■ 유 (법원: {data.seizure.courtName || '관할'}, 사건: {data.seizure.caseNumber || '사건번호'}, 채권자: {data.seizure.creditorName})</span>
                    ) : (
                      <span className="text-emerald-700">■ 무 (압류 사실 없음)</span>
                    )}
                  </span>
                </div>
                {data.seizure.hasSeizure && (
                  <span className="font-mono text-rose-700 font-bold text-[11px]">
                    압류액: {data.seizure.seizedAmount.toLocaleString()}원
                  </span>
                )}
              </div>

              {/* 월평균 총 순수입 소계 배너 */}
              <div className="mt-2 p-2 bg-slate-100 rounded border border-slate-300 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-800">[A] 월평균 총 순수입 합계 (실수령액):</span>
                <span className="text-base font-mono text-slate-950 font-black">
                  {disp.monthlyNetIncome.toLocaleString()} 원
                </span>
              </div>
            </div>

            {/* ══════════ 2. 변제계획 수행시의 예상 지출목록 ══════════ */}
            <div className="mb-6">
              <h2 className="text-sm font-black text-slate-900 border-b-2 border-slate-800 pb-1 mb-2.5 flex items-center justify-between">
                <span>2. 변제계획 수행시의 예상 지출목록 (생계비)</span>
                <span className="text-xs font-normal text-slate-600">
                  부양가족 수: {exp.householdSize}인 가구 (본인 포함)
                </span>
              </h2>

              <div className="text-xs mb-2 text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span>
                    • 2026년 보건복지부 공표 기준 중위소득의 60% 법정 생계비:
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {exp.statutoryBaseCost2026.toLocaleString()} 원
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  신청 구분: {exp.claimedCostOption === 'BELOW_60' 
                    ? '☑ 기준 중위소득의 60% 이하 신청 (표준 법정 생계비)' 
                    : '☑ 기준 중위소득의 60% 초과 신청 (추가 생계비 주장)'}
                </div>
              </div>

              {/* 지출 상세 테이블 */}
              <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="p-2 text-left border-r border-slate-200">비목 구분</th>
                      <th className="p-2 text-right border-r border-slate-200 w-36">월 인정/신청 금액</th>
                      <th className="p-2 text-left">소명 자료 및 지출 내역</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-bold text-slate-800 border-r border-slate-200">1) 기본 생계비</td>
                      <td className="p-2 text-right font-mono font-bold border-r border-slate-200">
                        {exp.claimedBaseCost.toLocaleString()} 원
                      </td>
                      <td className="p-2 text-slate-600">2026년 기준중위소득 60% 법정 인정액 ({exp.householdSize}인 가구)</td>
                    </tr>
                    {exp.additionalHousing > 0 && (
                      <tr>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">2) 추가 주거비(월세)</td>
                        <td className="p-2 text-right font-mono text-rose-700 font-bold border-r border-slate-200">
                          +{exp.additionalHousing.toLocaleString()} 원
                        </td>
                        <td className="p-2 text-slate-600">기준 주거비 초과 실제 월세 (임대차계약서 및 최근 3개월 이체증 첨부)</td>
                      </tr>
                    )}
                    {exp.additionalMedical > 0 && (
                      <tr>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">3) 추가 의료비</td>
                        <td className="p-2 text-right font-mono text-rose-700 font-bold border-r border-slate-200">
                          +{exp.additionalMedical.toLocaleString()} 원
                        </td>
                        <td className="p-2 text-slate-600">본인 및 부양가족의 지속적 질환 치료비 (진단서 및 영수증 첨부)</td>
                      </tr>
                    )}
                    {exp.additionalEducation > 0 && (
                      <tr>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">4) 추가 교육비</td>
                        <td className="p-2 text-right font-mono text-rose-700 font-bold border-r border-slate-200">
                          +{exp.additionalEducation.toLocaleString()} 원
                        </td>
                        <td className="p-2 text-slate-600">미성년 자녀의 필수 공교육비 외 필수교육 지출 (재학증명서 첨부)</td>
                      </tr>
                    )}
                    {exp.additionalChildSupport > 0 && (
                      <tr>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">5) 양육비 지급액</td>
                        <td className="p-2 text-right font-mono text-rose-700 font-bold border-r border-slate-200">
                          +{exp.additionalChildSupport.toLocaleString()} 원
                        </td>
                        <td className="p-2 text-slate-600">이혼에 따른 법정 미성년 자녀 양육비 판결/합의금</td>
                      </tr>
                    )}
                    <tr className="bg-rose-50/70 font-bold">
                      <td className="p-2.5 text-rose-950 border-r border-slate-300">[B] 월평균 총 지출액 합계</td>
                      <td className="p-2.5 text-right font-mono text-rose-900 text-sm border-r border-slate-300">
                        {exp.totalMonthlyExpense.toLocaleString()} 원
                      </td>
                      <td className="p-2.5 text-[11px] text-rose-800">
                        기본생계비({exp.claimedBaseCost.toLocaleString()}원) + 추가생계비({exp.totalAdditionalExpenses.toLocaleString()}원)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 추가 생계비 사유서 요약 */}
              {exp.totalAdditionalExpenses > 0 && (
                <div className="mt-2 text-xs border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="font-bold text-slate-700 block mb-1">📌 추가 생계비 소명 사유 요지:</span>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line text-[11px]">
                    {exp.additionalReasonDetail}
                  </p>
                </div>
              )}
            </div>

            {/* ══════════ 3. 가족관계 (피부양자 명세) ══════════ */}
            <div className="mb-6">
              <h2 className="text-sm font-black text-slate-900 border-b-2 border-slate-800 pb-1 mb-2.5 flex items-center justify-between">
                <span>3. 가족관계 (동거 및 피부양자 현황)</span>
                <span className="text-xs font-normal text-slate-500">
                  주민등록상 동거 및 생계를 같이 하는 가족
                </span>
              </h2>

              <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="p-2 text-center border-r border-slate-200 w-16">관계</th>
                      <th className="p-2 text-center border-r border-slate-200 w-20">성명</th>
                      <th className="p-2 text-center border-r border-slate-200 w-24">생년월일</th>
                      <th className="p-2 text-center border-r border-slate-200 w-16">동거여부</th>
                      <th className="p-2 text-center border-r border-slate-200 w-20">동거기간</th>
                      <th className="p-2 text-center border-r border-slate-200 w-20">부양여부</th>
                      <th className="p-2 text-left border-r border-slate-200">직업 및 소득 유무</th>
                      <th className="p-2 text-center w-20">인정 여부</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.familyMembers.map((m, idx) => (
                      <tr key={m.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/40' : ''}>
                        <td className="p-2 text-center font-bold text-slate-800 border-r border-slate-200">{m.relationship}</td>
                        <td className="p-2 text-center border-r border-slate-200">{m.name}</td>
                        <td className="p-2 text-center font-mono border-r border-slate-200">{m.birthDate}</td>
                        <td className="p-2 text-center border-r border-slate-200">{m.cohabitationStatus}</td>
                        <td className="p-2 text-center border-r border-slate-200">{m.cohabitationPeriod}</td>
                        <td className="p-2 text-center border-r border-slate-200">{m.isSupportedByDebtor ? '부양' : '자활'}</td>
                        <td className="p-2 border-r border-slate-200 text-slate-600">{m.jobAndIncomeDetail}</td>
                        <td className="p-2 text-center">
                          {m.isEligibleDependent ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">인정</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">제외</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10.5px] text-slate-400 mt-1.5">
                ※ 부양가족 인정 기준: 원칙적으로 주민등록상 동거하는 19세 미만 직계비속 또는 60세 이상 직계존속으로서 독립 소득이 최저생계비 미만인 자에 한합니다.
              </p>
            </div>

            {/* ══════════ 4. 가용소득 산출 결과 ══════════ */}
            <div className="mb-8 p-4 rounded-xl border-2 border-slate-900 bg-slate-50/80">
              <h2 className="text-sm font-black text-slate-900 border-b border-slate-300 pb-1.5 mb-3 flex items-center justify-between">
                <span>4. 가용소득 산출 결과 (월 변제예정액)</span>
                <span className="text-xs font-mono font-bold text-blue-700">
                  변제기간: {disp.repaymentMonths}개월
                </span>
              </h2>

              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block mb-1">[A] 월평균 총 순수입</span>
                  <span className="text-base font-black font-mono text-slate-800">
                    {disp.monthlyNetIncome.toLocaleString()} 원
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold block mb-1">[B] 월평균 총 생계비</span>
                  <span className="text-base font-black font-mono text-rose-700">
                    -{disp.monthlyTotalExpense.toLocaleString()} 원
                  </span>
                </div>
                <div className="bg-blue-600 text-white p-3 rounded-lg shadow-sm">
                  <span className="text-xs text-blue-100 font-bold block mb-1">[A - B] 월 가용소득</span>
                  <span className="text-base font-black font-mono text-white">
                    {disp.monthlyDisposableIncome.toLocaleString()} 원
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-200 px-1">
                <span className="text-slate-700">
                  총 가용소득 (월 {disp.monthlyDisposableIncome.toLocaleString()}원 × {disp.repaymentMonths}회):
                </span>
                <span className="text-sm font-mono text-blue-900 font-black">
                  {disp.totalDisposableIncome.toLocaleString()} 원
                </span>
              </div>
            </div>

            {/* 작성일 및 기명날인란 */}
            <div className="text-center my-10 space-y-4">
              <p className="text-sm font-bold text-slate-800">{data.createdDate}</p>
              <div className="flex justify-center items-center gap-12 text-sm">
                <div>
                  <span>신청인(채무자): </span>
                  <strong className="underline ml-1">{data.debtorName}</strong>
                  <span className="text-xs text-slate-400 ml-2">(서명 또는 인)</span>
                </div>
                <div>
                  <span>대리인 변호사: </span>
                  <strong className="underline ml-1">{data.attorneyName}</strong>
                  <span className="text-xs text-slate-400 ml-2">(인)</span>
                </div>
              </div>
              <div className="pt-4">
                <h3 className="text-base font-black text-slate-900 tracking-wider">
                  {data.courtName} 귀중
                </h3>
              </div>
            </div>

            {/* ══════════ 5. 첨부 서류 체크리스트 안내 ══════════ */}
            <div className="mt-8 pt-4 border-t border-slate-300 text-[11px] text-slate-500 space-y-1 bg-slate-50/40 p-3 rounded-lg print:border-none">
              <span className="font-bold text-slate-700 block mb-1">【수입 및 지출에 관한 목록 첨부 서류】</span>
              <p>1. 급여소득자: 근로소득원천징수영수증, 최근 1년 급여명세서 사본, 급여입금통장 사본, 재직증명서, 사업자등록증 사본</p>
              <p>2. 영업소득자: 사업자등록증 사본, 종합소득세 확정신고서, 부가가치세과세표준증명, 매출·매입세금계산서합계표</p>
              <p>3. 부양가족 소명: 주민등록등본, 가족관계증명서(상세), 소득 있는 가족의 소득금액증명원, 건강보험자격득실확인서</p>
              <p>4. 추가생계비 소명: 임대차계약서 사본 및 최근 3개월 월세 이체증, 진단서 및 진료비영수증, 교육비납입증명서</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
