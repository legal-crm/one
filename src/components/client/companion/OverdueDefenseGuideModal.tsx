import React, { useState } from 'react';
import { 
  X, AlertTriangle, ShieldCheck, CheckCircle2, Clock, 
  HelpCircle, ChevronRight, Landmark, FileText, ArrowRight,
  Scale, Award, DollarSign, RefreshCw, HeartHandshake
} from 'lucide-react';
import { RehabCompanionCase } from '../../../types';
import { getCourtRepealStandard, getEffectiveRoundStatus } from '../../../services/companionService';

interface OverdueDefenseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: RehabCompanionCase;
  onOpenCrisisModal: () => void;
}

function OverdueDefenseGuideModalInner({
  isOpen,
  onClose,
  caseData,
  onOpenCrisisModal
}: OverdueDefenseGuideModalProps) {

  const [activeTab, setActiveTab] = useState<'matrix' | 'partial' | 'modify' | 'special_discharge' | 'appeal'>('matrix');

  const courtThreshold = getCourtRepealStandard(caseData.courtName);
  const overdueCount = (caseData.schedules || []).filter(s => getEffectiveRoundStatus(s) === 'overdue_check_needed').length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-left">
        
        {/* 상단 헤더 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light shrink-0">
              <HeartHandshake className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  도산 실무 가이드
                </span>
                <span className="text-xs bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 font-bold px-2 py-0.5 rounded-full">
                  관할: {courtThreshold.courtName}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-1">
                변제금이 밀렸을 때: 폐지 기준과 3가지 대처 방법
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" aria-hidden="true" />
            <span>회차별 폐지 기준 & 법원 실무</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partial')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'partial'
                ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>① 분납·추가 납부</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('modify')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'modify'
                ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>② 변제계획 변경신청</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('special_discharge')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'special_discharge'
                ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>③ 특별면책 (법 제624조)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appeal')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'appeal'
                ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>폐지결정과 즉시항고 기간</span>
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 dark:text-slate-300">
          
          {/* TAB 1: 회차별 폐지 기준 & 법원별 실무 기준 */}
          {activeTab === 'matrix' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* 내 현재 상태 요약 배너 */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    현재 납부 현황 ({caseData.courtName})
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {overdueCount === 0 ? (
                      <span className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-1" aria-hidden="true" />
                        <span>밀린 회차 없이 납부 중이에요</span>
                      </span>
                    ) : overdueCount <= 2 ? (
                      <span className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                        <Clock className="w-4 h-4 shrink-0 mt-1" aria-hidden="true" />
                        <span>{overdueCount}회 납부 기록이 없어요</span>
                      </span>
                    ) : (
                      <span className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-1" aria-hidden="true" />
                        <span>{overdueCount}회 납부 기록이 없어요 · 담당 변호사와 상의가 필요해요</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                    월 {caseData.monthlyRepaymentAmount?.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 회차별 3단계 폐지 매트릭스 카드 */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-brand dark:text-brand-light" aria-hidden="true" />
                  <span>회차별 미납 시 법원 조치 단계</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1단계 */}
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/60">
                        1 ~ 2회차
                      </span>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400">1단계</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">단순 지연 및 납부 독려</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      곧바로 폐지되지는 않는 경우가 많지만, 다음 달 변제금과 겹쳐 부담이 커집니다. 가능한 금액부터 납부하고 담당 변호사와 상의하세요.
                    </p>
                  </div>

                  {/* 2단계 */}
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md bg-rose-200/60 dark:bg-rose-900/60">
                        3회차
                      </span>
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400">2단계</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">납부 독촉·폐지 검토 가능</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      미납이 누적되면 회생위원·법원이 납부 독촉이나 사유 소명을 요구하고 폐지를 검토할 수 있습니다(채무자회생법 제621조). 통지·기한은 법원마다 다르니 받은 문서를 담당 변호사에게 바로 보여 주세요.
                    </p>
                  </div>

                  {/* 3단계 */}
                  <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-red-800 dark:text-red-200 px-2 py-0.5 rounded-md bg-red-200 dark:bg-red-900">
                        4회차 이상
                      </span>
                      <span className="text-xs font-bold text-red-700 dark:text-red-400">3단계</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">법원의 폐지 결정 가능</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      회생위원 의견 등을 거쳐 재판부가 절차 폐지를 결정할 수 있습니다. 불복하려면 즉시항고 기간(공고일부터 14일) 안에 제기해야 하며, 인용 여부는 법원이 판단합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 법원별 실무 기준 비교표 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-brand dark:text-brand-light" aria-hidden="true" />
                    <span>법원별 폐지 검토 경향 비교</span>
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">참고용 일반 경향 (재판부마다 다름)</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.courtName.includes('서울') 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-xs shrink-0">
                      서울회생법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">비교적 유연한 경향:</strong> 연체 초기에 독촉·소명 기회를 주는 경우가 많습니다. 몇 회에서 폐지를 검토할지는 정해져 있지 않습니다.
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.courtName.includes('수원') || courtThreshold.courtName.includes('부산')
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-amber-700 text-white font-bold text-xs shrink-0">
                      수원·부산회생법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">3회 안팎 연체 시 폐지 검토 가능:</strong> 연체가 누적되면 납부 독촉과 폐지 검토가 진행될 수 있습니다. (재판부·사정에 따라 다름)
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.leniencyLevel === 'STRICT'
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-rose-700 text-white font-bold text-xs shrink-0">
                      기타 지방법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">비교적 엄격한 경향:</strong> 연체 누적에 엄격한 경우가 있어 미납이 생기면 바로 담당 변호사와 상의하는 것이 안전합니다.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 분납·추납 요령 */}
          {activeTab === 'partial' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>먼저 검토할 방법: 법원 가상계좌로 나누어 입금하기</span>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 mt-1 leading-relaxed">
                  한 달 치를 한 번에 채우기 어렵다면 <strong>가능한 금액부터 가상계좌로 나누어 입금</strong>하는 방법을 검토할 수 있습니다. 분납 처리 방식과 최소 금액은 회생위원 안내를 따르세요.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  변제금을 나눠 낼 때 알아 둘 점
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">가용 자금 생길 때마다 수시 입금</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        월 변제금이 50만 원인데 20만 원밖에 없다면 20만 원을 먼저 법원 계좌에 넣으세요. 법원 전산은 누적 입금액으로 관리되므로 미납 총액이 줄어듭니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">입금자명은 본인 성명으로 입력</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        부여받은 법원 가상계좌로 이체할 때 입금자명을 의뢰인 본인 성명(또는 사건번호)으로 지정해야 법원 전산에서 착오 없이 확인됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">회생위원에게 분납 일정 미리 알리기</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        2회 이상 밀릴 것 같다면 회생위원에게 전화나 소명서로 분납 일정을 미리 알리세요. 받아들여지는지와 처리 방식은 회생위원·재판부마다 다릅니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 변제계획 변경신청 */}
          {activeTab === 'modify' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-sm">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  <span>소득 감소·부양가족 증가 시: 변제계획안 변경 신청</span>
                </div>
                <p className="text-xs text-blue-900/80 dark:text-blue-200/80 mt-1 leading-relaxed">
                  인가 후 발생한 실직, 임금 삭감, 중증 질환, 출산 등 객관적 사정변경이 있다면 <strong>월 변제금을 낮추거나 상환 기간을 연장</strong>해달라고 법원에 정식 신청할 수 있습니다.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  변경 신청 사유별 준비 서류
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">실직 또는 권고사직</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      고용보험 수급자격증, 퇴직증명서, 새로운 직장의 급여명세서로 소득 감소 증빙
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">사업 부진 또는 폐업</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      폐업사실증명원, 부가가치세 과세표준증명원으로 매출 급감 객관적 소명
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">본인 또는 가족의 중증 질환</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      진단서, 수술 확인서, 월 고정 의료비 영수증을 제출하여 추가 생계비 인정 요청
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">부양가족 추가 발생</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      자녀 출산, 연로하신 부모님 부양 등 주민등록등본 및 기본증명서 제출
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <strong>유의사항:</strong> 청산가치(보유재산 평가액) 이상의 총 변제액은 유지되어야 변경 인가가 가능합니다.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCrisisModal();
                  }}
                  className="min-h-11 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-sm active:scale-[0.98] inline-flex items-center gap-1.5"
                >
                  <span>담당 변호사와 변경 상의하기</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: 특별면책 (채무자회생법 제624조 제2항) */}
          {activeTab === 'special_discharge' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <span>채무자회생법 제624조 제2항에 따른 특별면책</span>
                </div>
                <p className="text-xs text-blue-900/80 dark:text-blue-200/80 mt-1 leading-relaxed">
                  변제계획을 완료하지 못했더라도 <strong>책임질 수 없는 사유</strong>가 있고, <strong>이미 변제한 금액이 파산 시 배당액(청산가치) 이상</strong>이며, <strong>변제계획 변경이 불가능</strong>하면 법원이 면책결정을 할 수 있는 제도입니다. 면책 여부는 법원이 이해관계인 의견을 들은 뒤 판단하며, 면책되지 않는 채권도 있습니다.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  특별면책 요건 3가지 (모두 충족 필요)
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">채무자의 책임 없는 사유로 인한 변제 불능</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        예: 중증 질병·장해로 일을 할 수 없게 된 경우 등. 해당 여부는 사정과 증빙을 보고 법원이 판단합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">청산가치(파산배당액) 보장 원칙 충족</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        채권자들이 지금까지 변제받은 총액이 파산했을 때 받을 수 있었던 배당액(청산가치)보다 적지 않아야(이상이어야) 합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">변제계획의 변경이 불가능할 것</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        월 변제금을 아무리 최소한으로 낮추더라도 추가 변제 수행 자체가 불가능하다는 점이 인정되어야 합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>상담 안내:</strong> 특별면책 요건 충족 여부는 청산가치와 기납부액 계산이 필요하므로, 납부가 어렵다면 담당 변호사와 먼저 상담하세요.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: 폐지 결정 시 14일 즉시항고 골든타임 */}
          {activeTab === 'appeal' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-base">
                  <Clock className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" />
                  <span>폐지결정 공고일부터 14일: 즉시항고 기간</span>
                </div>
                <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                  폐지결정에 불복하려면 <strong>공고일부터 14일</strong>(채무자회생법 제13조 제2항) 안에 즉시항고장을 내야 합니다. 밀린 변제금을 완납하는 것이 중요하지만, <strong>폐지결정이 취소될지는 법원이 판단</strong>합니다.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  폐지 통지를 받았을 때 할 일 4단계
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-brand dark:text-brand-light text-sm shrink-0">STEP 1</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">대법원 공고일 및 14일 기한 계산</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        공고가 있으면 공고일부터 14일 안에 제기해야 합니다. 기산일과 마감일은 담당 변호사가 결정문·공고를 보고 확인합니다. 기간이 지나면 즉시항고를 할 수 없습니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-brand dark:text-brand-light text-sm shrink-0">STEP 2</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">미납 변제금 전액 가상계좌 입금</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        지인·가족의 도움 등으로 밀린 변제금 총액을 가능한 한 빨리 법원 가상계좌로 입금하고 이체확인증(영수증)을 받아 둡니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-brand dark:text-brand-light text-sm shrink-0">STEP 3</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">즉시항고장 + 완납 영수증 첨부 법원 접수</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        &quot;개인회생 폐지결정에 대한 즉시항고장&quot;에 변제금 완납 영수증을 첨부하여 원심 법원에 제출합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-brand dark:text-brand-light text-sm shrink-0">STEP 4</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">항고법원의 판단</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        항고법원이 미납금 완납 여부와 앞으로의 수행 가능성 등을 보고 원결정 취소 여부를 판단합니다. 결과는 보장되지 않습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>기간이 지나면:</strong> 폐지결정이 확정되어 채권자의 강제집행·추심이 다시 가능해질 수 있고, 다시 절차를 이용하려면 새로 신청해야 할 수 있습니다. 폐지 관련 통지를 받았다면 바로 담당 변호사에게 연락하세요.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* 하단 푸터 액션바 */}
        <div className="p-4 md:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {caseData.assignedLawyerName ? `${caseData.assignedLawyerName} 전담 배정` : '담당 변호사 미배정'}
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCrisisModal();
              }}
              className="flex-1 sm:flex-initial min-h-11 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <HeartHandshake className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>담당 변호사에게 상담·지원 요청하기</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Rules of Hooks: isOpen 가드는 훅을 쓰는 본문 바깥에서 처리
export default function OverdueDefenseGuideModal(props: OverdueDefenseGuideModalProps) {
  if (!props.isOpen) return null;
  return <OverdueDefenseGuideModalInner {...props} />;
}
