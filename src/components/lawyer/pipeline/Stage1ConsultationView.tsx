import React, { useState, useMemo } from 'react';
import { 
  UserCheck, CheckCircle2, AlertTriangle, ShieldCheck, 
  Sparkles, ArrowRight, Scale, Calculator, Phone, FileText,
  ChevronDown, ChevronUp, AlertCircle, HelpCircle, Send,
  Lock, PhoneCall, Check, Coins, Zap, ShieldAlert, Info,
  TrendingUp, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, FinancialProfile, User } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { useDialog } from '../../common/DialogProvider';
import { getLivingExpense } from '../../../services/repayment/repaymentConstants2026';

/** 수임 계약 이후 상담 요청 상태 */
const RETAINED_REQUEST_STATUSES: ReadonlyArray<ConsultRequest['status']> = ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];

interface Stage1ConsultationViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  onUpdateStatus: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onSwitchCaseType?: (type: 'individual_rehab' | 'bankruptcy') => void;
  onOpenProposalDraft?: () => void;
  onNavigateToChat?: () => void;
  onSimulateContactShare?: () => void;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
}

export default function Stage1ConsultationView({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateStatus,
  onAdvanceToNextStage,
  onSwitchCaseType,
  onOpenProposalDraft,
  onNavigateToChat,
  onSimulateContactShare,
  activeSection,
  onSelectSection,
}: Stage1ConsultationViewProps) {
  const fp: Partial<FinancialProfile> = clientRequest.financialProfile || {};
  const debtTotal = fp.debtTotal || (clientRequest as any)?.totalDebt || 0; // 만원
  const income = fp.income || (clientRequest as any)?.income || 0; // 만원
  const assetsTotal = fp.assetsTotal ?? ((fp.myAssets || 0) + (fp.spouseAsset ? Math.round(fp.spouseAsset * 0.5) : 0)); // 만원
  const dependents = fp.dependents ?? (fp.minorChildren ?? 0); // 본인 제외 부양가족 수
  const householdSize = dependents + 1; // 가구원 수

  // 2026년 기준 중위소득 60% 생계비 (만원 단위) — 공통 상수 사용
  // (이전: 자체 표 {1:133, 2:221...}을 써서 2026 공시값(1인 153.9만)과 달랐음)
  const minLivingCost = Math.round(getLivingExpense(householdSize) / 10000);
  const availableIncome = Math.max(0, income - minLivingCost);
  const isAvailableIncomeSufficient = availableIncome > 0;

  // 요건 1: 자산 vs 채무 (청산가치 보장 여부 및 채무초과 상태)
  const isDebtExceedingAssets = debtTotal > assetsTotal;
  const assetRatio = debtTotal > 0 ? Math.min(100, Math.round((assetsTotal / debtTotal) * 100)) : 0;

  // 요건 3: 결격사유 및 리스크 스크리닝
  // 채무한도: 무담보 10억 / 담보 15억을 각각 판정 (채무자회생법 제579조 제1호)
  // 이전: 총채무 15억 이하면 통과 → 무담보 12억도 '적격'으로 표시
  const securedDebt = (fp.debts || []).filter((d: any) => d?.type === 'secured').reduce((s: number, d: any) => s + (Number(d?.principal ?? d?.amount) || 0), 0);
  const unsecuredDebt = Math.max(0, debtTotal - securedDebt);
  const isDebtUnderLimit = debtTotal > 0 && unsecuredDebt <= 100000 && securedDebt <= 150000;
  const debtLimitPercentage = Math.min(100, Math.round((unsecuredDebt / 100000) * 100)); // 무담보 10억 기준 퍼센트
  const hasRecentDischarge = Boolean((clientRequest as any)?.hasRecentDischarge || (fp as any)?.hasRecentDischarge);
  const coinCryptoLoss = fp.debtTypes?.coinCrypto || fp.speculativeLoss || 0;
  const recentLoans = fp.debtTypes?.recentLoans || 0;
  const speculativeDebtRatio = debtTotal > 0 ? Math.round(((coinCryptoLoss + recentLoans) / debtTotal) * 100) : 0;
  const harassmentLevel = fp.harassmentLevel || 'CALL';
  const hasUrgentSeizure = harassmentLevel === 'SEIZURE' || harassmentLevel === 'LAWSUIT' || (fp.legalActions && fp.legalActions.length > 0);

  // 4대 요건 충족 수 계산
  const passedConditionsCount = [
    isDebtExceedingAssets,
    isAvailableIncomeSufficient,
    isDebtUnderLimit,
    !hasRecentDischarge,
  ].filter(Boolean).length;

  const isBankruptcy = crmExt?.caseType === 'bankruptcy' || crmExt?.caseType === 'individual_bankruptcy' || income === 0 || !isAvailableIncomeSufficient;

  // 제안서 발송 상태 및 계약 상태 확인
  const proposals = clientRequest.proposals || [];
  // 내 제안서만 본다 — 비교 상담(최대 3명)에서는 다른 변호사의 제안서가 함께 들어 있다
  // (이전: 내 제안서가 없으면 첫 제안서를 대신 써서, 제안서를 보내지 않은 변호사에게도 '발송 완료'와 남의 조건이 보였다)
  const myProposal = proposals.find(p => p.lawyerId === activeLawyer.id);
  const hasProposalSent = Boolean(myProposal);
  // 수임 계약 이후 단계 전체 (이전: 'contracted'만 봐서 서류 준비·접수 이후 고객이 상담 단계로 보였다)
  const isContracted = RETAINED_REQUEST_STATUSES.includes(clientRequest.status) || crmExt?.thirteenStage === 'contract_done';

  // ── 고객 연락처 공개 및 제안서 소통 게이팅 상태 판별 ──
  const [isSimulatedShared, setIsSimulatedShared] = useState(false);
  const isContactShared = Boolean(
    isSimulatedShared ||
    clientRequest.phoneConsultationRequested || 
    clientRequest.contactDisclosureStatus === 'contact_shared' ||
    myProposal?.phoneConsultRequestedAt ||
    isContracted
  );

  const isProposalSentPhase = hasProposalSent && !isContactShared && !isContracted;
  const isAnonymousPhase = !hasProposalSent && !isContactShared && !isContracted;

  // 스텔스 가명 및 실명 분리
  const rawClientName = clientRequest.clientName || '고객';
  const nameParts = rawClientName.split('_');
  const stealthName = clientRequest.stealthNickname || (nameParts.length > 1 ? nameParts[1] : rawClientName);
  const realName = clientRequest.realClientName || (nameParts.length > 1 ? nameParts[0] : rawClientName);
  const displayClientName = isContactShared ? `${realName} (${stealthName})` : stealthName;

  // 체크리스트 상태
  const [debtCheckPassed, setDebtCheckPassed] = useState(() => isDebtUnderLimit); // 무담보 10억·담보 15억 이하
  const [incomeCheckPassed, setIncomeCheckPassed] = useState(() => isBankruptcy ? true : income > minLivingCost); // 가구원수 기준 생계비 초과
  // 제595조(면책불허가 사유 등)는 자동 판정할 근거 데이터가 없으므로 변호사가 직접 확인해야 함 (이전: 기본 '결격사유 없음')
  const [article595Passed, setArticle595Passed] = useState(false);
  const [caseTypeConfirmed, setCaseTypeConfirmed] = useState(() => crmExt?.crmStatus !== 'requested');

  // 아코디언 섹션 토글
  const [openSection, setOpenSection] = useState<'qualification' | 'article595' | 'casetype'>('qualification');
  // 수임계약 완료 상태에서 제안 조건 열람/수정 펼침 토글
  const [showCompletedProposalDetails, setShowCompletedProposalDetails] = useState(false);

  const dialog = useDialog();
  const allConditionsMet = debtCheckPassed && incomeCheckPassed && article595Passed && caseTypeConfirmed;

  // 1 Major Action: 적격 확정 및 Gate 1 통과 (2단계 확인 팝업 적용)
  const handleConfirmEligibility = async () => {
    if (!allConditionsMet) {
      await dialog.alert({ title: '적격 요건 미확인', message: '채무 한도·소득 요건·제595조 결격사유 확인을 모두 마친 뒤 확정할 수 있습니다.', variant: 'warning' });
      return;
    }
    const confirmed = await dialog.confirm({
      title: '⚖️ 신청 적격 요건 확정',
      message: `채무 한도, 소득 요건 및 제595조 결격사유 점검을 완료하고 의뢰인을 [수임 계약 준비] 상태로 전환하시겠습니까?`,
      confirmText: '적격 확정',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return;

    setCaseTypeConfirmed(true);
    if (crmExt?.crmStatus === 'requested') {
      onUpdateStatus('consulting');
    }
    addClientNotification({
      type: 'status_change',
      title: `[적격 진단 완료] ${clientRequest.clientName}님의 ${isBankruptcy ? '개인파산' : '개인회생'} 신청 적격성 판정이 완료되었습니다.`,
      emoji: '⚖️',
      linkTab: 'diagnosis',
    });
    toast.success(`${isBankruptcy ? '개인파산' : '개인회생'} 적격성 검토가 완료되었습니다. [적격 요건 충족]`);
  };

  // 적격 안내 알림톡 전송
  const handleSendEligibilityAlimtok = () => {
    addClientNotification({
      type: 'status_change',
      title: `[상담 안내] ${clientRequest.clientName}님, 상담 결과 ${isBankruptcy ? '개인파산·면책' : '개인회생'} 신청 적격 요건을 충족하셨습니다.`,
      emoji: '📱',
      linkTab: 'diagnosis',
    });
    // 알림톡은 발송하지 않음 — 의뢰인 앱 알림만 등록 (이전: '알림톡이 전송되었습니다')
    toast.success(`${clientRequest.clientName}님 앱에 적격 판정 안내 알림을 등록했습니다.`);
  };

  // 현재 선택된 섹션 (기본값: eligibility)
  const currentSection = activeSection || 'eligibility';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── [Section: summary] 상담 요약 및 신청 사연 ── */}
      {(currentSection === 'summary' || currentSection === 'all') && (
        <div className="space-y-5 animate-fadeIn">
          {/* 사연 요약 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#1E3A5F] text-white shadow-xs">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    의뢰인 상담 신청 사연 및 상담 요약
                  </h3>
                  <p className="text-xs text-slate-500">
                    신청인이 제출한 부채 발생 경위 및 주요 상담 내역입니다.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                {stealthName} ({fp.jobType === 'BUSINESS' || fp.employmentType === 'business' ? '영업/사업자' : '개인'})
              </span>
            </div>

            {/* 사연 내용 */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 text-slate-800 leading-relaxed text-[13px] whitespace-pre-wrap min-h-[90px]">
              {clientRequest.content || (
                <span className="text-slate-400 italic">
                  작성된 상담 사연이 없습니다. 우측 소통창 또는 상담 메모를 통해 사연을 기록해 주세요.
                </span>
              )}
            </div>

            {/* 재무·가계 핵심 프로필 4열 요약 타일 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block text-xs">총 채무액</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
                  {debtTotal.toLocaleString()}만원
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block text-xs">월 평균 소득</span>
                <span className="text-base font-bold text-blue-600 mt-0.5 block font-mono">
                  {income.toLocaleString()}만원
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block text-xs">보유 자산 (청산가치)</span>
                <span className="text-base font-bold text-slate-700 mt-0.5 block font-mono">
                  {assetsTotal.toLocaleString()}만원
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block text-xs">가구원 및 부양가족</span>
                <span className="text-base font-bold text-slate-700 mt-0.5 block font-mono">
                  {householdSize}인 가구 ({dependents > 0 ? `부양 ${dependents}인` : '단독'})
                </span>
              </div>
            </div>

            {/* 빠른 액션 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {onSelectSection && (
                <button
                  type="button"
                  onClick={() => onSelectSection('eligibility')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Scale className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>적격 검토 계기판 보기</span>
                </button>
              )}
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-4 py-2 bg-[#1E3A5F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>맞춤 제안서 작성</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── [Section: ai-review] AI 사건 분석 및 검토 ── */}
      {currentSection === 'ai-review' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    AI 사건 심층 분석 및 쟁점 검토 리포트
                  </h3>
                  <p className="text-xs text-slate-500">
                    채무 발생 경위와 재무 상태를 기반으로 도출한 인공지능 사건 종합 진단입니다.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                AI 진단 완료
              </span>
            </div>

            {/* AI 종합 평가 카드 */}
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                AI 분석 총평
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {(clientRequest as any)?.aiAnalysis?.summary || (
                  `신청인은 총 채무 ${debtTotal.toLocaleString()}만원 중 무담보 채무가 대부분을 차지하고 있으며, 월 가용소득은 약 ${availableIncome.toLocaleString()}만원으로 산출됩니다. 36개월 기준 예상 변제율은 약 ${myProposal?.reductionRate || Math.max(20, Math.round((1 - (availableIncome * 36) / Math.max(1, debtTotal)) * 100))}%로 회생 신청에 적합한 조건을 갖추고 있습니다.`
                )}
              </p>
            </div>

            {/* 3대 핵심 리스크 스크리닝 */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800">사건 핵심 쟁점 및 리스크 검토</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                  <span className="text-xs font-bold text-slate-500 block">1. 청산가치 보장</span>
                  <span className={`text-xs font-bold ${isDebtExceedingAssets ? 'text-emerald-700' : 'text-rose-700'} flex items-center gap-1`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isDebtExceedingAssets ? '자산 초과 채무 충족' : '청산가치 반영 필요'}
                  </span>
                  <p className="text-xs text-slate-500">
                    총 자산 {assetsTotal.toLocaleString()}만 대비 총 채무 {debtTotal.toLocaleString()}만으로 신청 자격 충족.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                  <span className="text-xs font-bold text-slate-500 block">2. 최근 채무 비중</span>
                  <span className={`text-xs font-bold ${speculativeDebtRatio <= 20 ? 'text-emerald-700' : 'text-amber-700'} flex items-center gap-1`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    사행성/최근 채무 {speculativeDebtRatio}%
                  </span>
                  <p className="text-xs text-slate-500">
                    {speculativeDebtRatio <= 20 ? '사행성 비중 양호 수준' : '보정권고 시 자금사용처 소명 대비 필요'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                  <span className="text-xs font-bold text-slate-500 block">3. 압류 및 독촉 대응</span>
                  <span className={`text-xs font-bold ${hasUrgentSeizure ? 'text-amber-700' : 'text-blue-700'} flex items-center gap-1`}>
                    <Zap className="w-3.5 h-3.5" />
                    {hasUrgentSeizure ? '금지명령 신청 시급' : '통상 일정 진행 가능'}
                  </span>
                  <p className="text-xs text-slate-500">
                    {hasUrgentSeizure ? '접수 즉시 금지명령 동시 접수 권장' : '접수 후 개시결정까지 순차 대응'}
                  </p>
                </div>
              </div>
            </div>

            {/* 하단 액션 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI 분석 결과 제안서에 반영하기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── [Section: proposal] 제안서 및 수임 여정 상태 카드 ── */}
      {(currentSection === 'proposal' || currentSection === 'all') && (
        <>
          {/* ── Next Action Hero Card (제안서 게이팅 동적 카드) ── */}
          {isAnonymousPhase ? (
            // [Phase 1: 제안서 미발송 상태 - 제안서 작성 단독 강제]
            <div className="p-5 sm:p-6 rounded-2xl border-2 border-blue-500/40 bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-slate-900 text-white shadow-lg">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl shrink-0 bg-blue-500/20 border border-blue-400/30 text-amber-300 shadow-xs">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    신청인 맞춤 솔루션 및 비용 제안서를 작성하여 고객에게 발송하세요
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {onOpenProposalDraft && (
                    <button
                      type="button"
                      onClick={onOpenProposalDraft}
                      className="px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 press-scale cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>제안서 작성 및 발송하기</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : isProposalSentPhase ? (
        // [Phase 2: 제안서 발송 완료 상태 - 고객 검토 및 전화상담 요청(연락처 제공) 대기]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 text-white shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl shrink-0 mt-0.5 bg-amber-500/20 text-amber-400 border border-amber-400/30 shadow-xs">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                    ⏳ 제안서 발송 완료 (고객 검토 & 전화상담 대기 중)
                  </span>
                  <span className="text-xs text-amber-200/80 font-mono">
                    {myProposal?.createdAt ? new Date(myProposal.createdAt).toLocaleString('ko-KR') : '발송 완료'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {myProposal?.lawyerName || activeLawyer.name} 변호사님의 맞춤 제안서가 고객에게 전달되었습니다
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  제안서가 의뢰인 모바일로 안전하게 전달되었습니다. 의뢰인이 제안서를 열람하고 <strong>[전화 상담 요청(연락처 제공 동의)]</strong>을 누르면 실명과 연락처가 변호사 사무실에 공개되며 통화가 가능해집니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 press-scale cursor-pointer"
                >
                  <span>제안서 조건 수정 / 재발송</span>
                </button>
              )}
              {/* 개발 환경 전용 의뢰인 열람 시뮬레이션 버튼 (기획서 4.3: DEV 표시로 절제) */}
              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSimulatedShared(true);
                    if (onSimulateContactShare) onSimulateContactShare();
                    toast.success(`[DEV] 의뢰인(${realName}) 전화 상담 요청 시뮬레이션 완료. 실명/연락처가 공개되었습니다.`);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="[개발 전용] 의뢰인이 제안서를 확인하고 전화 상담을 요청한 상태를 시뮬레이션합니다."
                >
                  <span>🧪 DEV 연락처 공개 테스트</span>
                </button>
              )}
            </div>
          </div>

          {/* 발송된 제안서 핵심 스펙 3열 요약 타일 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">예상 채무 탕감률</span>
              <span className="text-base font-black text-emerald-400 mt-0.5 block">
                최대 {myProposal?.reductionRate || 0}%
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">예상 월 변제금</span>
              <span className="text-base font-black text-blue-400 mt-0.5 block">
                월 {myProposal?.monthlyPayment || 0}만원 ({myProposal?.duration || 36}개월)
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">제안 수임료 및 분납</span>
              <span className="text-base font-black text-slate-200 mt-0.5 block truncate">
                {myProposal?.fee || 0}만원 ({myProposal?.installment || '분납 지원'})
              </span>
            </div>
          </div>
        </div>
      ) : isContactShared && !isContracted ? (
        // [Phase 3: 고객 제안서 확인 & 전화상담 요청 완료 상태 - 연락처 공개 및 소통 전면 해금!]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 text-white shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl shrink-0 mt-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 shadow-xs">
                <PhoneCall className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 shadow-xs">
                    🎉 고객 제안서 확인 & 전화 상담 요청 완료!
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40">
                    연락처 공개 완료: {clientRequest.phone || '미등록'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  의뢰인({realName}님)이 제안서를 확인하고 1:1 전화 상담을 요청했습니다
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  고객이 변호사님의 제안서를 확인하고 본인의 실명(<strong>{realName}</strong>)과 연락처(<strong>{clientRequest.phone || '미등록'}</strong>)를 제공하였습니다. 이제 우측 소통창의 전화 걸기 또는 상담을 통해 정식 수임계약을 체결하세요.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <a
                href={clientRequest.phone ? `tel:${clientRequest.phone.replace(/[^0-9]/g, '')}` : undefined}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-500/30 transition-all flex items-center gap-1.5 press-scale cursor-pointer"
              >
                <Phone className="w-4 h-4 text-slate-950" />
                <span>고객에게 전화 상담 진행</span>
              </a>
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 press-scale cursor-pointer"
                >
                  <span>제안서 조건 수정 / 재발송</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!caseTypeConfirmed) {
                    setCaseTypeConfirmed(true);
                  }
                  onAdvanceToNextStage();
                }}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/30 transition-all flex items-center gap-1.5 press-scale cursor-pointer"
                title="의뢰인과의 유선 상담을 완료하고 정식 위임계약서 작성 및 착수금 단계(Stage 02)로 이동합니다."
              >
                <span>수임계약 체결 진행 (Stage 02)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 발송된 제안서 핵심 스펙 3열 요약 타일 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">예상 채무 탕감률</span>
              <span className="text-base font-black text-emerald-400 mt-0.5 block">
                최대 {myProposal?.reductionRate || 0}%
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">예상 월 변제금</span>
              <span className="text-base font-black text-blue-400 mt-0.5 block">
                월 {myProposal?.monthlyPayment || 0}만원 ({myProposal?.duration || 36}개월)
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs">제안 수임료 및 분납</span>
              <span className="text-base font-black text-slate-200 mt-0.5 block truncate">
                {myProposal?.fee || 0}만원 ({myProposal?.installment || '분납 지원'})
              </span>
            </div>
          </div>
        </div>
      ) : (
        // [상황 D: 수임계약 체결 완료 상태 - 기획서 3.4 5번 규칙: 지난 단계 요약 (누가·언제·무엇을)]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 text-emerald-950 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl shrink-0 mt-0.5 bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    ✓ 1단계(상담·제안) 완료 · 수임 체결
                  </span>
                  <span className="text-xs text-emerald-700/80 font-mono">
                    {crmExt?.contractDate
                      ? new Date(crmExt.contractDate).toLocaleDateString('ko-KR')
                      : (myProposal?.approvedAt || myProposal?.createdAt)
                        ? new Date(myProposal.approvedAt || myProposal.createdAt).toLocaleDateString('ko-KR')
                        : '수임 체결 완료'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  {displayClientName} 님과의 수임 계약이 정식 체결되었습니다
                </h3>
                <p className="text-xs text-slate-600">
                  상담 및 제안 절차가 성공적으로 종결되었습니다. 다음 단계인 수임 계약 세부 및 착수 서류 준비를 진행하세요.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCompletedProposalDetails(prev => !prev)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 press-scale cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>제안 결과 {showCompletedProposalDetails ? '접기' : '상세보기'}</span>
                {showCompletedProposalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer"
              >
                <span>Stage 02 (수임 계약) 이동</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 지난 단계 결과 요약 (누가·언제·무엇을 그리드) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-emerald-100">
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-100/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">담당 전문가</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block truncate">
                {activeLawyer.name || '김수현 변호사'}
              </span>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-100/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">제안 탕감률</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5 block">
                최대 {myProposal?.reductionRate || 0}%
              </span>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-100/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">예상 월 변제금</span>
              <span className="text-xs sm:text-sm font-black text-blue-600 mt-0.5 block truncate">
                월 {myProposal?.monthlyPayment || 0}만원 ({myProposal?.duration || 36}개월)
              </span>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-100/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">확정 수임료</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block truncate">
                {myProposal?.fee || 0}만원 ({myProposal?.installment || '분납 지원'})
              </span>
            </div>
          </div>

          {/* 토글 펼침: 제안서 세부 조건 및 재검토 */}
          {showCompletedProposalDetails && (
            <div className="p-4 rounded-xl bg-white border border-emerald-200/80 shadow-2xs space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  체결된 제안서 세부 내역 및 고객 전달 메시지
                </span>
                {onOpenProposalDraft && (
                  <button
                    type="button"
                    onClick={onOpenProposalDraft}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    제안 조건 수정 편집기 열기
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                {myProposal?.remark || '맞춤 제안서가 등록되어 의뢰인과 수임 체결이 완료되었습니다.'}
              </p>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* ── [Section: eligibility] 고객 사전진단 계기판 ── */}
      {(currentSection === 'eligibility' || currentSection === 'all') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4 mb-0 animate-fadeIn">
          {/* 헤더: 컴팩트 타이틀 & 종합 적격 뱃지 */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#1E3A5F] text-white shadow-xs">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 tracking-tight">
                  사전 진단 요건 검토 계기판
                </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {stealthName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-2xs ${
              passedConditionsCount === 4
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  passedConditionsCount === 4 ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  passedConditionsCount === 4 ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
              </span>
              <span>4대 요건 중 {passedConditionsCount}개 충족 ({passedConditionsCount === 4 ? '신청 적격 판정' : '보완 검토'})</span>
            </span>
            <span className="text-xs font-bold text-slate-400 hidden lg:inline-block">
              신청 적격 검토 현황판
            </span>
          </div>
        </div>

        {/* 2단 반응형 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 타일 1: 채무 vs 자산 (청산가치 보장 원칙) */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/90 flex flex-col justify-between space-y-3.5 hover:border-slate-300 hover:shadow-xs transition-all duration-300">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                  <Scale className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-slate-800">1. 채무 vs 자산 (청산가치)</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border flex items-center gap-1 ${
                isDebtExceedingAssets ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDebtExceedingAssets ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isDebtExceedingAssets ? '채무초과 (충족)' : '자산이 채무 이상 (청산가치 검토 필요)'}
              </span>
            </div>

            {/* 본문: 원형 다이어그램 게이지 + 미니 비교 표 */}
            <div className="flex items-center gap-4">
              {/* 좌측 원형 도넛 게이지 */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg width="64" height="64" className="transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={(2 * Math.PI * 25) * (1 - Math.min(100, assetRatio) / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className={`${isDebtExceedingAssets ? 'text-emerald-500' : 'text-rose-500'} transition-all duration-700 ease-out`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono font-black text-xs text-slate-800 leading-none">
                    {assetRatio}%
                  </span>
                  <span className="text-xs font-bold text-slate-400 mt-0.5 leading-none">
                    자산비
                  </span>
                </div>
              </div>

              {/* 우측 정밀 비교 표 */}
              <div className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200/80 p-2.5 shadow-2xs">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">총 채무액</td>
                      <td className="py-1 text-right font-mono font-bold text-slate-900">{debtTotal.toLocaleString()}만원</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">총 자산액 (청산가치)</td>
                      <td className="py-1 text-right font-mono font-bold text-blue-600">{assetsTotal.toLocaleString()}만원</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-700 font-bold whitespace-nowrap">탕감 대상 순채무</td>
                      <td className="py-1 text-right font-mono font-black text-emerald-600">{(debtTotal - assetsTotal).toLocaleString()}만원</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단 듀얼 컬러 스택 바 다이어그램 */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden flex p-0.5">
                <div 
                  className="bg-blue-500 h-full rounded-l-full transition-all duration-700 ease-out" 
                  style={{ width: `${Math.min(95, Math.max(5, assetRatio))}%` }} 
                  title={`자산 ${assetsTotal}만 (${assetRatio}%)`}
                />
                <div 
                  className="bg-emerald-500 h-full rounded-r-full transition-all duration-700 ease-out" 
                  style={{ width: `${Math.max(5, 100 - Math.min(95, Math.max(5, assetRatio)))}%` }} 
                  title={`순채무 ${(debtTotal - assetsTotal)}만 (${100 - assetRatio}%)`}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-blue-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  자산 {assetsTotal.toLocaleString()}만 ({assetRatio}%)
                </span>
                <span className="text-emerald-600 font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  순채무 {(debtTotal - assetsTotal).toLocaleString()}만 ({100 - assetRatio}%)
                </span>
              </div>
            </div>
          </div>

          {/* 타일 2: 월 가용소득 (생계비 초과 및 변제 적격) */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/90 flex flex-col justify-between space-y-3.5 hover:border-slate-300 hover:shadow-xs transition-all duration-300">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Coins className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-slate-800">2. 월 가용소득 & 변제 수행력</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border flex items-center gap-1 ${
                isAvailableIncomeSufficient ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAvailableIncomeSufficient ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                {isAvailableIncomeSufficient ? '적격 (회생 수행가능)' : '부족 (파산 권장)'}
              </span>
            </div>

            {/* 본문: 원형 다이어그램 게이지 + 미니 소득-생계비 표 */}
            <div className="flex items-center gap-4">
              {/* 좌측 원형 도넛 게이지 */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg width="64" height="64" className="transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={(2 * Math.PI * 25) * (1 - (income > 0 ? Math.min(100, Math.round((availableIncome / income) * 100)) : 0) / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className={`${isAvailableIncomeSufficient ? 'text-emerald-500' : 'text-purple-500'} transition-all duration-700 ease-out`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`font-mono font-black text-xs leading-none ${isAvailableIncomeSufficient ? 'text-emerald-600' : 'text-purple-600'}`}>
                    {availableIncome > 0 ? `${availableIncome}만` : '0원'}
                  </span>
                  <span className="text-xs font-bold text-slate-400 mt-0.5 leading-none">
                    가용금
                  </span>
                </div>
              </div>

              {/* 우측 소득/생계비 정밀 표 */}
              <div className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200/80 p-2.5 shadow-2xs">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">월 평균 소득</td>
                      <td className="py-1 text-right font-mono font-bold text-slate-900">{income.toLocaleString()}만원</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">법정 생계비 ({householdSize}인)</td>
                      <td className="py-1 text-right font-mono font-bold text-indigo-600">-{minLivingCost.toLocaleString()}만원</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-700 font-bold whitespace-nowrap">월 예상 가용소득</td>
                      <td className={`py-1 text-right font-mono font-black ${isAvailableIncomeSufficient ? 'text-emerald-600' : 'text-purple-600'}`}>
                        +{availableIncome.toLocaleString()}만원
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단 듀얼 세그먼트 플로우 바 다이어그램 */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden flex p-0.5">
                <div 
                  className="bg-indigo-400 h-full rounded-l-full transition-all duration-700 ease-out" 
                  style={{ width: `${income > 0 ? Math.min(95, Math.max(5, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100))) : 100}%` }} 
                  title={`생계비 ${minLivingCost}만`}
                />
                <div 
                  className="bg-emerald-500 h-full rounded-r-full transition-all duration-700 ease-out" 
                  style={{ width: `${income > 0 ? Math.max(5, 100 - Math.min(95, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100))) : 0}%` }} 
                  title={`가용소득 ${availableIncome}만`}
                />
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-indigo-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  생계비 {minLivingCost.toLocaleString()}만 ({householdSize}인)
                </span>
                <span className={`${isAvailableIncomeSufficient ? 'text-emerald-600' : 'text-purple-600'} font-black flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isAvailableIncomeSufficient ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                  {isAvailableIncomeSufficient ? `+${availableIncome}만 잉여 (36개월 ${(availableIncome * 36).toLocaleString()}만 변제)` : '생계비 부족'}
                </span>
              </div>
            </div>
          </div>

          {/* 타일 3: 법정 채무한도 (무담보 10억 상한) */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/90 flex flex-col justify-between space-y-3.5 hover:border-slate-300 hover:shadow-xs transition-all duration-300">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-slate-800">3. 법정 채무한도 준수</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border flex items-center gap-1 ${
                isDebtUnderLimit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDebtUnderLimit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isDebtUnderLimit ? '한도 내 (안전 적격)' : '초과 (일반회생 검토)'}
              </span>
            </div>

            {/* 본문: 원형 다이어그램 게이지 + 법정 한도 비교 표 */}
            <div className="flex items-center gap-4">
              {/* 좌측 원형 도넛 게이지 */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg width="64" height="64" className="transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={(2 * Math.PI * 25) * (1 - Math.min(100, debtLimitPercentage) / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className={`${isDebtUnderLimit ? 'text-blue-600' : 'text-rose-500'} transition-all duration-700 ease-out`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono font-black text-xs text-slate-800 leading-none">
                    {debtLimitPercentage}%
                  </span>
                  <span className="text-xs font-bold text-slate-400 mt-0.5 leading-none">
                    점유율
                  </span>
                </div>
              </div>

              {/* 우측 법정 한도 정밀 표 */}
              <div className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200/80 p-2.5 shadow-2xs">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">신청인 총 채무</td>
                      <td className="py-1 text-right font-mono font-bold text-blue-600">{debtTotal.toLocaleString()}만원</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">무담보 법정 상한</td>
                      <td className="py-1 text-right font-mono font-bold text-slate-900">100,000만원 (10억)</td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-700 font-bold whitespace-nowrap">잔여 법정 한도</td>
                      <td className="py-1 text-right font-mono font-black text-emerald-600">+{Math.max(0, 100000 - unsecuredDebt).toLocaleString()}만원</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단 한도 슬라이더 바 다이어그램 */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden p-0.5 relative">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${Math.min(100, Math.max(5, debtLimitPercentage))}%` }} 
                />
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">0억</span>
                <span className="text-blue-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block animate-pulse" />
                  무담보 {unsecuredDebt.toLocaleString()}만원 ({debtLimitPercentage}%){securedDebt > 0 ? ` · 담보 ${securedDebt.toLocaleString()}만원 (15억 상한)` : ''}
                </span>
                <span className="text-slate-400">10억 상한</span>
              </div>
            </div>
          </div>

          {/* 타일 4: 결격 & 긴급도 (제595조 & 압류독촉 대응) */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/90 flex flex-col justify-between space-y-3.5 hover:border-slate-300 hover:shadow-xs transition-all duration-300">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                  <Zap className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-slate-800">4. 결격사유 & 긴급 대응</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-black border flex items-center gap-1 ${
                hasUrgentSeizure ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasUrgentSeizure ? 'bg-amber-500 animate-ping' : 'bg-blue-500'}`} />
                {hasUrgentSeizure ? '⚡ 금지명령 시급' : '🟢 일반 절차 진행'}
              </span>
            </div>

            {/* 본문: 원형 다이어그램 게이지 + 3대 스크리닝 표 */}
            <div className="flex items-center gap-4">
              {/* 좌측 원형 도넛 게이지 */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg width="64" height="64" className="transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={(2 * Math.PI * 25) * (1 - (hasUrgentSeizure ? 85 : 20) / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className={`${hasUrgentSeizure ? 'text-amber-500' : 'text-emerald-500'} transition-all duration-700 ease-out`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`font-mono font-black text-xs leading-none ${hasUrgentSeizure ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {hasUrgentSeizure ? '⚡' : 'OK'}
                  </span>
                  <span className="text-xs font-bold text-slate-400 mt-0.5 leading-none">
                    {hasUrgentSeizure ? '긴급대응' : '추심안정'}
                  </span>
                </div>
              </div>

              {/* 우측 3대 스크리닝 정밀 표 */}
              <div className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200/80 p-2.5 shadow-2xs">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">5년 내 면책 이력</td>
                      <td className="py-1 text-right font-bold">
                        {!hasRecentDischarge ? (
                          <span className="text-emerald-600 font-bold">통과 (없음)</span>
                        ) : (
                          <span className="text-rose-600 font-bold">결격 위험 (있음)</span>
                        )}
                      </td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-500 font-medium whitespace-nowrap">사행성 채무 비중</td>
                      <td className="py-1 text-right font-mono font-bold">
                        {speculativeDebtRatio <= 20 ? (
                          <span className="text-slate-700">{speculativeDebtRatio}% (양호)</span>
                        ) : (
                          <span className="text-amber-600">{speculativeDebtRatio}% (소명 요망)</span>
                        )}
                      </td>
                    </tr>
                    <tr className="text-xs">
                      <td className="py-1 text-slate-700 font-bold whitespace-nowrap">독촉·압류 진행도</td>
                      <td className="py-1 text-right font-bold">
                        {hasUrgentSeizure ? (
                          <span className="text-amber-600 font-black">⚡ 금지명령 필요</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">정상 (독촉 없음)</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단 3단 스텝 신호등 바 다이어그램 */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="grid grid-cols-3 gap-1.5">
                <div 
                  className={`h-2.5 rounded-full ${!hasRecentDischarge ? 'bg-emerald-500' : 'bg-rose-500'} transition-colors duration-500`} 
                  title="1단계: 5년 내 면책이력 없음" 
                />
                <div 
                  className={`h-2.5 rounded-full ${speculativeDebtRatio <= 20 ? 'bg-emerald-500' : 'bg-amber-500'} transition-colors duration-500`} 
                  title={`2단계: 사행성 채무 (${speculativeDebtRatio}%)`} 
                />
                <div 
                  className={`h-2.5 rounded-full ${!hasUrgentSeizure ? 'bg-emerald-500' : 'bg-amber-500'} transition-colors duration-500`} 
                  title="3단계: 독촉·압류 대응" 
                />
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${!hasRecentDischarge ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  1.면책이력 통과
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${speculativeDebtRatio <= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  2.사행성({speculativeDebtRatio}%)
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${!hasUrgentSeizure ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  3.{hasUrgentSeizure ? '금지명령' : '추심안정'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
