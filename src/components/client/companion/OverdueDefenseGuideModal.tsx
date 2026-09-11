import React, { useState } from 'react';
import { 
  X, AlertTriangle, ShieldCheck, CheckCircle2, Clock, 
  HelpCircle, ChevronRight, Landmark, FileText, ArrowRight,
  Flame, Award, DollarSign, RefreshCw, AlertOctagon, HeartHandshake
} from 'lucide-react';
import { RehabCompanionCase } from '../../../types';
import { getCourtRepealStandard } from '../../../services/companionService';

interface OverdueDefenseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: RehabCompanionCase;
  onOpenCrisisModal: () => void;
}

export default function OverdueDefenseGuideModal({
  isOpen,
  onClose,
  caseData,
  onOpenCrisisModal
}: OverdueDefenseGuideModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'matrix' | 'partial' | 'modify' | 'special_discharge' | 'appeal'>('matrix');

  const courtThreshold = getCourtRepealStandard(caseData.courtName);
  const overdueCount = (caseData.schedules || []).filter(s => s.status === 'overdue_check_needed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-left">
        
        {/* 상단 헤더 */}
        <div className="p-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs shrink-0">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  도산 전문 실무 가이드
                </span>
                <span className="text-xs bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                  관할: {courtThreshold.courtName}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-black mt-1">
                개인회생 변제금 미납 폐지 기준 & 3대 대처 방안
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>회차별 폐지 기준 & 법원 실무</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partial')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'partial'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>① 분납·추납 비법 (무이자)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('modify')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'modify'
                ? 'border-red-600 text-red-600 dark:text-red-400'
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
                ? 'border-red-600 text-red-600 dark:text-red-400'
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
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>🚨 14일 즉시항고 골든타임</span>
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
                    현재 나의 미납 현황 ({caseData.courtName})
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {overdueCount === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">🟢 정상 납부 진행 중 (미납 0회)</span>
                    ) : overdueCount <= 2 ? (
                      <span className="text-amber-600 dark:text-amber-400">⚡ 주의 단계: {overdueCount}회 미납 발생</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">🚨 위험 단계: {overdueCount}회 연체 누적 (폐지 위험)</span>
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
                  <Flame className="w-4 h-4 text-red-500" />
                  <span>회차별 미납 시 법원 조치 단계</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1단계 */}
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/60">
                        1 ~ 2회차
                      </span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">주의 단계</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">단순 지연 및 납부 독려</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      법원에서 즉시 폐지하지는 않으나, 다음 달 변제금과 겹쳐 부담이 급증합니다. 법원 가상계좌로 분할 입금하여 연체를 끊어야 합니다.
                    </p>
                  </div>

                  {/* 2단계 */}
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md bg-rose-200/60 dark:bg-rose-900/60">
                        3회차
                      </span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">경고 단계</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">폐지 예정 통지서 발송</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      법원에서 &quot;변제금 미납에 따른 개인회생절차 폐지예정 통지서&quot;를 송달합니다. 2주 이내 미납금 납부 또는 사유서 제출이 필요합니다.
                    </p>
                  </div>

                  {/* 3단계 */}
                  <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-red-800 dark:text-red-200 px-2 py-0.5 rounded-md bg-red-200 dark:bg-red-900">
                        4회차 이상
                      </span>
                      <span className="text-xs font-black text-red-600 dark:text-red-400">폐지 착수</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">법원 직권 폐지 결정</div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      회생위원이 폐지 의견서를 제출하고 재판부가 절차를 폐지합니다. 공고 후 14일 이내 완납+즉시항고하지 않으면 영구 효력을 잃습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 법원별 실무 기준 비교표 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-brand" />
                    <span>실무상 법원별 폐지 임계치 비교</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">도산재판부 실무 기준</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.courtName.includes('서울') 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] shrink-0">
                      서울회생법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">4~5회차 연체까지 유예 (비교적 유연):</strong> 사정 소명 시 분납이나 변제계획 변경 검토 기회를 적극 부여합니다.
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.courtName.includes('수원') || courtThreshold.courtName.includes('부산')
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[10px] shrink-0">
                      수원·부산회생법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">3회 연체 시 폐지 착수:</strong> 3회 누적 즉시 폐지 통지서가 발송되며 엄격하게 납부를 요구합니다.
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                    courtThreshold.leniencyLevel === 'STRICT'
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-300 text-slate-800 dark:text-slate-200 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] shrink-0">
                      기타 지방법원
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">3회 연체 즉시 엄격 폐지:</strong> 별도 유예 없이 3회 미납 즉시 직권 폐지 결정을 내리는 경우가 많아 각별한 주의가 필요합니다.
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>가장 안전하고 쉬운 해결책: 법원 가상계좌 쪼개기 입금</span>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 mt-1 leading-relaxed">
                  개인회생 변제금은 일반 대출과 달리 <strong>연체이자가 전혀 붙지 않습니다.</strong> 또한 1회차분을 한 번에 다 못 채우더라도 <strong>1만원 단위로 나누어 입금</strong>할 수 있습니다.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  💡 실무 변제금 분납 3대 행동 원칙
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
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
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">입금자명은 반드시 본인 성명 입력</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        부여받은 법원 가상계좌로 이체할 때 입금자명을 의뢰인 본인 성명(또는 사건번호)으로 지정해야 법원 전산에 착오 없이 즉시 매칭됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">회생위원에게 분납 계획서 사전 제출</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        2회 이상 밀릴 위험이 있다면 회생위원에게 유선 또는 소명서를 통해 분납 일정을 사전 고지하면 폐지 결정을 1~2개월 이상 늦출 수 있습니다.
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
                  📋 변경 신청 인정 사유 체크리스트
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">💼 실직 또는 권고사직</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      고용보험 수급자격증, 퇴직증명서, 새로운 직장의 급여명세서로 소득 감소 증빙
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">📉 사업 부진 또는 폐업</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      폐업사실증명원, 부가가치세 과세표준증명원으로 매출 급감 객관적 소명
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">🏥 본인 또는 가족의 중증 질환</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      진단서, 수술 확인서, 월 고정 의료비 영수증을 제출하여 추가 생계비 인정 요청
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-900 dark:text-white">👶 부양가족 추가 발생</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      자녀 출산, 연로하신 부모님 부양 등 주민등록등본 및 기본증명서 제출
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4">
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <strong>⚠️ 유의사항:</strong> 청산가치(보유재산 평가액) 이상의 총 변제액은 유지되어야 변경 인가가 가능합니다.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCrisisModal();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  변호사에게 변경 요청하기 →
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: 특별면책 (채무자회생법 제624조 제2항) */}
          {activeTab === 'special_discharge' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  <span>채무자회생법 제624조 제2항에 따른 특별면책</span>
                </div>
                <p className="text-xs text-purple-900/80 dark:text-purple-200/80 mt-1 leading-relaxed">
                  변제계획을 완료하지 못했더라도, <strong>도저히 갚을 수 없는 불가항력적 사유</strong>가 있고 <strong>청산가치 이상을 이미 납부</strong>했다면 법원이 잔여 채무 전액을 즉시 면책해 주는 제도입니다.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ⚖️ 특별면책의 3대 필수 요건
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">채무자의 책임 없는 사유로 인한 변제 불능</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        암 등 중증 난치병 진단, 영구 장해 발생, 천재지변, 채무자의 사망 등 객관적으로 근로능력을 상실한 경우
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">청산가치(파산배당액) 보장 원칙 충족</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        지금까지 법원에 납부한 총 변제금 합계액이, 회생 신청 당시 평가된 채무자의 재산 총액(청산가치)보다 많아야 합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">변제계획의 변경이 극히 곤란할 것</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        월 변제금을 아무리 최소한으로 낮추더라도 추가 변제 수행 자체가 불가능하다는 점이 인정되어야 합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                💡 <strong>변호사 자문 권고:</strong> 특별면책 요건 충족 여부는 청산가치와 기납부액 계산이 정밀해야 하므로, 위기에 처하셨다면 즉시 전담 변호사와 상담하세요.
              </div>
            </div>
          )}

          {/* TAB 5: 폐지 결정 시 14일 즉시항고 골든타임 */}
          {activeTab === 'appeal' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-red-600 text-white space-y-2">
                <div className="flex items-center gap-2 font-black text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                  <span>폐지 결정 공고 후 14일 이내: 마지막 부활의 골든타임</span>
                </div>
                <p className="text-xs text-red-100 leading-relaxed">
                  법원에서 개인회생 폐지 결정이 내려지더라도, 대법원 전자공고일로부터 <strong>단 14일(불변기간)</strong> 이내에 <strong>즉시항고장을 제출하고 밀린 변제금을 완납</strong>하면 폐지 결정이 취소되고 회생이 그대로 유지됩니다!
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ⏱️ 폐지 위기 탈출 4단계 긴급 행동 요령
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-red-600 dark:text-red-400 text-sm">STEP 1</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">대법원 공고일 및 14일 기한 계산</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        폐지 결정은 송달이 아닌 대한민국 법원 홈페이지 &quot;전자공고&quot;에 게재된 날의 다음 날부터 기산하여 14일째 되는 날 자정에 마감됩니다. 하루라도 늦으면 재항고가 불가능합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-red-600 dark:text-red-400 text-sm">STEP 2</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">미납 변제금 전액 가상계좌 입금</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        지인 차용, 가족 지원 등을 통해 밀린 변제금 총액을 법원 가상계좌로 즉시 전액 입금하고 이체확인증(영수증)을 확보합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-red-600 dark:text-red-400 text-sm">STEP 3</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">즉시항고장 + 완납 영수증 첨부 법원 접수</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        &quot;개인회생 폐지결정에 대한 즉시항고장&quot;에 변제금 완납 영수증을 첨부하여 원심 법원에 제출합니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <span className="font-black text-red-600 dark:text-red-400 text-sm">STEP 4</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white">법원의 폐지 결정 취소 및 인가 효력 회복</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        재판부에서 미납 변제금 완납을 확인하면 원결정을 취소하고 회생절차를 원래대로 정상화합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                🚨 <strong>14일 경과 시:</strong> 개인회생 사건이 최종 확정 폐지되어 모든 채권자의 압류·추심이 일제히 부활하며, 사건을 처음부터 다시 신청해야 합니다. 폐지 통지를 받으셨다면 1시간도 지체 없이 전담 변호사에게 연락하십시오.
              </div>
            </div>
          )}

        </div>

        {/* 하단 푸터 액션바 */}
        <div className="p-4 md:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {caseData.assignedLawyerName ? `${caseData.assignedLawyerName} 전담 배정` : '마이김변 전담 도산 변호인단'}
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCrisisModal();
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              🚨 전담 변호사에게 긴급 위기 SOS 접수
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
