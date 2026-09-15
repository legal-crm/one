import React, { useState, useMemo } from 'react';
import { 
  UserCheck, CheckCircle2, AlertTriangle, ShieldCheck, 
  Sparkles, ArrowRight, Scale, Calculator, Phone, FileText,
  ChevronDown, ChevronUp, AlertCircle, HelpCircle, Send,
  Lock, PhoneCall, Check, Coins, Zap, ShieldAlert, Info,
  TrendingUp, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { useDialog } from '../../common/DialogProvider';

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
}: Stage1ConsultationViewProps) {
  const fp = clientRequest.financialProfile || {};
  const debtTotal = fp.debtTotal || (clientRequest as any)?.totalDebt || 0; // 만원
  const income = fp.income || (clientRequest as any)?.income || 0; // 만원
  const assetsTotal = fp.assetsTotal ?? ((fp.myAssets || 0) + (fp.spouseAsset ? Math.round(fp.spouseAsset * 0.5) : 0)); // 만원
  const dependents = fp.dependents ?? (fp.minorChildren ?? 0); // 본인 제외 부양가족 수
  const householdSize = dependents + 1; // 가구원 수

  // 2026년 기준 중위소득 60% 법정 최저생계비 (만원 단위)
  const livingCostMap: Record<number, number> = { 1: 133, 2: 221, 3: 282, 4: 343, 5: 402, 6: 459 };
  const minLivingCost = livingCostMap[householdSize] || (133 + dependents * 60);
  const availableIncome = Math.max(0, income - minLivingCost);
  const isAvailableIncomeSufficient = availableIncome > 0;

  // 요건 1: 자산 vs 채무 (청산가치 보장 여부 및 채무초과 상태)
  const isDebtExceedingAssets = debtTotal > assetsTotal;
  const assetRatio = debtTotal > 0 ? Math.min(100, Math.round((assetsTotal / debtTotal) * 100)) : 0;

  // 요건 3: 결격사유 및 리스크 스크리닝
  const isDebtUnderLimit = debtTotal > 0 && debtTotal <= 150000;
  const debtLimitPercentage = Math.min(100, Math.round((debtTotal / 100000) * 100)); // 무담보 10억 기준 퍼센트
  const hasRecentDischarge = Boolean((clientRequest as any)?.hasRecentDischarge || (fp as any)?.hasRecentDischarge);
  const coinCryptoLoss = fp.debtTypes?.coinCrypto || fp.speculativeLoss || 0;
  const recentLoans = fp.debtTypes?.recentLoans || 0;
  const speculativeDebtRatio = debtTotal > 0 ? Math.round(((coinCryptoLoss + recentLoans) / debtTotal) * 100) : 0;
  const harassmentLevel = fp.harassmentLevel || 'CALL';
  const hasUrgentSeizure = harassmentLevel === 'SEIZURE' || harassmentLevel === 'LAWSUIT' || (fp.legalActions && fp.legalActions.length > 0);

  const isBankruptcy = crmExt?.caseType === 'bankruptcy' || crmExt?.caseType === 'individual_bankruptcy' || income === 0 || !isAvailableIncomeSufficient;

  // 제안서 발송 상태 및 계약 상태 확인
  const proposals = clientRequest.proposals || [];
  const myProposal = proposals.find(p => p.lawyerId === activeLawyer.id) || proposals[0];
  const hasProposalSent = Boolean(myProposal);
  const isContracted = clientRequest.status === 'contracted' || crmExt?.thirteenStage === 'contract_done';

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
  const [debtCheckPassed, setDebtCheckPassed] = useState(() => debtTotal > 0 && debtTotal <= 150000); // 15억 이하
  const [incomeCheckPassed, setIncomeCheckPassed] = useState(() => isBankruptcy ? true : income > 133); // 중위소득 1인 생계비 기준
  const [article595Passed, setArticle595Passed] = useState(true); // 595조 결격사유 없음
  const [caseTypeConfirmed, setCaseTypeConfirmed] = useState(() => crmExt?.crmStatus !== 'requested');

  // 아코디언 섹션 토글
  const [openSection, setOpenSection] = useState<'qualification' | 'article595' | 'casetype'>('qualification');

  const dialog = useDialog();
  const allConditionsMet = debtCheckPassed && incomeCheckPassed && article595Passed && caseTypeConfirmed;

  // 1 Major Action: 적격 확정 및 Gate 1 통과 (2단계 확인 팝업 적용)
  const handleConfirmEligibility = async () => {
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
    toast.success(`${isBankruptcy ? '개인파산' : '개인회생'} 적격성 검토가 완료되었습니다. [Gate 1 통과]`);
  };

  // 적격 안내 알림톡 전송
  const handleSendEligibilityAlimtok = () => {
    addClientNotification({
      type: 'status_change',
      title: `[상담 안내] ${clientRequest.clientName}님, 상담 결과 ${isBankruptcy ? '개인파산·면책' : '개인회생'} 신청 적격 요건을 충족하셨습니다.`,
      emoji: '📱',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientRequest.clientName}님께 적격 판정 및 수임 절차 안내 알림톡이 전송되었습니다.`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 01 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            맞춤 제안서 발송 및 의뢰인 상담·수임 결정
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">실무 진행도:</span>
          <span className="font-mono font-bold text-[#1E3A5F]">
            {isContracted ? '4/4 (수임계약 완료)' : hasProposalSent ? '3/4 (제안서 발송 완료)' : '1/4 (제안서 작성 필요)'}
          </span>
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden ml-1">
            <div 
              className={`h-full rounded-full transition-all ${isContracted ? 'bg-emerald-500' : hasProposalSent ? 'bg-blue-600' : 'bg-amber-500'}`} 
              style={{ width: `${isContracted ? 100 : hasProposalSent ? 75 : 25}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card (스텔스 익명 & 제안서 게이팅 3단계 동적 카드) ── */}
      {isAnonymousPhase ? (
        // [Phase 1: 제안서 미발송 상태 - 100% 스텔스 익명 보호 중 & 제안서 작성 단독 강제]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-blue-500/40 bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-slate-900 text-white shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl shrink-0 mt-0.5 bg-blue-500/20 border border-blue-400/30 text-amber-300 shadow-xs">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                    ⚡ 최우선 필수 작업
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    100% 스텔스 익명 보호 중
                  </span>
                  <span className="text-xs text-blue-200">
                    가명: <strong className="text-white font-mono">{stealthName}</strong>
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  신청인 맞춤 솔루션 및 비용 제안서를 작성하여 고객에게 발송하세요
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  현재 의뢰인은 스텔스 가명으로 보호 중이며, 실명과 연락처는 <strong>비공개 상태</strong>입니다. 변호사 사무실에서는 임의로 전화나 알림톡을 보낼 수 없으며, <strong>맞춤 제안서(탕감률·변제금·수임료)</strong>를 먼저 발송해야 의뢰인이 확인 후 전화 상담을 요청(연락처 공개)할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 press-scale cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>고객 맞춤 제안서 작성 및 발송하기 (Major)</span>
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
              {/* 시연 및 실무 편의를 위한 고객 열람 시뮬레이션 버튼 */}
              <button
                type="button"
                onClick={() => {
                  setIsSimulatedShared(true);
                  if (onSimulateContactShare) onSimulateContactShare();
                  toast.success(`[시뮬레이션] 의뢰인(${realName})이 제안서를 확인하고 전화 상담을 요청했습니다! 실명과 전화번호가 공개되었습니다.`);
                }}
                className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 press-scale cursor-pointer"
                title="고객이 모바일에서 제안서를 확인하고 전화 상담을 요청한 상태를 시뮬레이션합니다."
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>🧪 [시뮬레이션] 고객 제안서 확인 & 전화상담 요청</span>
              </button>
            </div>
          </div>

          {/* 발송된 제안서 핵심 스펙 3열 요약 타일 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-[11px]">예상 채무 탕감률</span>
              <span className="text-base font-black text-emerald-400 mt-0.5 block">
                최대 {myProposal?.reductionRate || 0}%
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-[11px]">예상 월 변제금</span>
              <span className="text-base font-black text-blue-400 mt-0.5 block">
                월 {myProposal?.monthlyPayment || 0}만원 ({myProposal?.duration || 36}개월)
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-[11px]">제안 수임료 및 분납</span>
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
                    연락처 공개 완료: {clientRequest.phone || '010-6623-7195'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  의뢰인({realName}님)이 제안서를 확인하고 1:1 전화 상담을 요청했습니다
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  고객이 변호사님의 제안서를 확인하고 본인의 실명(<strong>{realName}</strong>)과 연락처(<strong>{clientRequest.phone || '010-6623-7195'}</strong>)를 제공하였습니다. 이제 우측 소통창의 전화 걸기 또는 상담을 통해 정식 수임계약을 체결하세요.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <a
                href={`tel:${(clientRequest.phone || '01066237195').replace(/[^0-9]/g, '')}`}
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
              <span className="text-slate-400 block text-[11px]">예상 채무 탕감률</span>
              <span className="text-base font-black text-emerald-400 mt-0.5 block">
                최대 {myProposal?.reductionRate || 0}%
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-[11px]">예상 월 변제금</span>
              <span className="text-base font-black text-blue-400 mt-0.5 block">
                월 {myProposal?.monthlyPayment || 0}만원 ({myProposal?.duration || 36}개월)
              </span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-[11px]">제안 수임료 및 분납</span>
              <span className="text-base font-black text-slate-200 mt-0.5 block truncate">
                {myProposal?.fee || 0}만원 ({myProposal?.installment || '분납 지원'})
              </span>
            </div>
          </div>
        </div>
      ) : (
        // [상황 D: 수임계약 체결 완료 상태]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/80 text-emerald-950 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl shrink-0 mt-0.5 bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  🎉 수임계약 체결 완료
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-emerald-950 mt-1">
                  의뢰인과의 정식 전자 수임계약이 완료되었습니다!
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  다음 단계(Stage 02)로 이동하여 관공서 필수 서류 수집 및 법원 실비(인지대·송달료) 산출을 진행하세요.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onAdvanceToNextStage}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center gap-2 press-scale cursor-pointer shrink-0"
            >
              <span>Stage 02 (계약·착수)로 진행</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 3. 고객 사전 진단 기반 비주얼 요건 검토 & 결격사유 스크리닝 대시보드 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-5 sm:p-6">
        {/* 상단 헤더: 자가진단 데이터 안내 배너 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                의뢰인 온라인 사전 자가진단 분석
              </span>
              <span className="text-xs text-slate-400">
                (가명: <strong className="text-slate-700 font-mono">{stealthName}</strong>)
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              법적 신청 요건 검토 및 제595조 결격사유 사전 스크리닝
            </h3>
          </div>
          <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 max-w-md flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              의뢰인이 <strong>[나의 채무상황 체크]</strong>에서 입력한 사전 진술 기반이며, 유선 심층상담 및 부채증명서 발급 과정에서 수치가 변경될 수 있습니다.
            </span>
          </div>
        </div>

        {/* ── 핵심 2대 요건 비주얼 다이어그램 카드 (자산vs채무, 소득vs생계비) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {/* [요건 1] 자산 vs 채무 규모 (청산가치 보장의 원칙) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">요건 1. 자산 vs 채무 규모</span>
                  <span className="text-[11px] text-slate-500">청산가치 보장의 원칙 (채무초과 여부)</span>
                </div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-lg font-black border ${
                isDebtExceedingAssets 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isDebtExceedingAssets ? '✓ 채무초과 충족' : '⚠ 자산 초과 주의'}
              </span>
            </div>

            {/* 수치 요약 */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200/70 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">총 채무액 (원금 기준)</span>
                <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                  {debtTotal.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-0.5">만원</span>
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">보유 자산 (청산가치)</span>
                <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                  {assetsTotal.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-0.5">만원</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">({assetRatio}%)</span>
                </span>
              </div>
            </div>

            {/* 저울 게이지 바 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                <span>보유 자산 비중 ({assetRatio}%)</span>
                <span>채무 탕감 대상 구간 ({Math.max(0, 100 - assetRatio)}%)</span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(5, assetRatio))}%` }}
                  title={`보유자산: ${assetsTotal}만원`}
                />
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${Math.max(0, 100 - Math.min(100, Math.max(5, assetRatio)))}%` }}
                  title={`탕감 대상 채무: ${Math.max(0, debtTotal - assetsTotal)}만원`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>청산가치 하한선 (최소 변제선)</span>
                <span>법적 면책 기대 구간</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
              {isDebtExceedingAssets ? (
                <>
                  총 자산({assetsTotal.toLocaleString()}만원)보다 채무({debtTotal.toLocaleString()}만원)가 많아 <strong className="text-emerald-700 font-bold">개인회생 신청 요건을 정상 충족</strong>합니다. 36개월간 총 변제액이 청산가치 이상이 되도록 변제계획안을 수립합니다.
                </>
              ) : (
                <>
                  보유 자산이 총 채무를 초과하여 기각 위험이 있습니다. 배우자 재산 50% 분할 기준 및 압류금지 재산(소액보증금 등) 공제 여부를 유선 상담 시 재산정해야 합니다.
                </>
              )}
            </p>
          </div>

          {/* [요건 2] 소득 vs 법정 최저생계비 (월 가용소득 산출) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">요건 2. 소득 vs 법정 최저생계비</span>
                  <span className="text-[11px] text-slate-500">가용소득 요건 ({householdSize}인 가구 기준)</span>
                </div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-lg font-black border ${
                isAvailableIncomeSufficient 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {isAvailableIncomeSufficient ? '✓ 회생 가용소득 확인' : '🏛️ 파산 트랙 권장'}
              </span>
            </div>

            {/* 수치 요약 */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200/70 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">월 실수령 소득</span>
                <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                  {income.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-0.5">만원</span>
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">법정 최저생계비 ({householdSize}인)</span>
                <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                  {minLivingCost.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-0.5">만원</span>
                  <span className="text-[10px] text-emerald-600 font-bold ml-1">
                    (가용소득: {availableIncome}만)
                  </span>
                </span>
              </div>
            </div>

            {/* 소득 분할 스택 바 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                <span>법정 보장 생계비 ({minLivingCost}만원)</span>
                <span className="text-emerald-700">예상 월 변제 가용소득 ({availableIncome}만원)</span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-indigo-400 transition-all duration-500" 
                  style={{ width: `${income > 0 ? Math.min(100, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100)) : 100}%` }}
                  title={`생계비: ${minLivingCost}만원`}
                />
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${income > 0 ? Math.max(0, 100 - Math.min(100, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100))) : 0}%` }}
                  title={`가용소득: ${availableIncome}만원`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>2026년 기준 중위소득 60% 공제</span>
                <span>매월 법원 가상계좌 납입 가능액</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
              {isAvailableIncomeSufficient ? (
                <>
                  생계비 공제 후 매월 약 <strong className="text-emerald-700 font-bold">{availableIncome.toLocaleString()}만원</strong>의 가용소득이 발생하여 36개월간 성실 변제가 가능한 <strong className="text-blue-700 font-bold">개인회생 최적 대상자</strong>입니다.
                </>
              ) : (
                <>
                  현재 소득({income}만원)이 법정 최저생계비({minLivingCost}만원)에 미달합니다. 회생 가용소득이 부족하므로 <strong className="text-purple-700 font-bold">개인파산·면책 트랙</strong>을 우선 검토하거나 추가 소득을 확인하세요.
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── 요건 3: 제595조 결격사유 & 4대 리스크 스크리닝 (신호등 카드) ── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-black text-slate-900">
                채무자회생법 제595조 기각사유 & 실무 리스크 4대 스크리닝
              </span>
            </div>
            <span className="text-[11px] text-slate-400">자가진단 기반 사전 판정</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. 5년 내 면책 이력 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">면책 이력 (제595조 5호)</span>
                <span className={`w-2 h-2 rounded-full ${!hasRecentDischarge ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {!hasRecentDischarge ? '결격사유 없음' : '최근 면책 이력'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {!hasRecentDischarge ? '5년 이내 면책 사실 없음' : '면책 후 5년 경과 확인 필요'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 self-start">
                법정 결격사유 통과
              </span>
            </div>

            {/* 2. 법정 채무한도 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">법정 채무한도</span>
                <span className={`w-2 h-2 rounded-full ${isDebtUnderLimit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {isDebtUnderLimit ? '한도 적합 (안전)' : '법정 한도 초과'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {debtTotal.toLocaleString()}만원 / 무담보 10억 ({debtLimitPercentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, debtLimitPercentage))}%` }} />
              </div>
            </div>

            {/* 3. 사행성·최근 채무 비중 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">사행성·최근 대출</span>
                <span className={`w-2 h-2 rounded-full ${speculativeDebtRatio <= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {speculativeDebtRatio <= 20 ? '정상 채무 구조' : '보정 소명 대비 필요'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {speculativeDebtRatio > 0 
                    ? `비율 ${speculativeDebtRatio}% (${(coinCryptoLoss + recentLoans).toLocaleString()}만원)` 
                    : '투자/도박 손실 채무 없음'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border self-start ${
                speculativeDebtRatio <= 20 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}>
                {speculativeDebtRatio <= 20 ? '인가율 양호' : '청산가치 반영 방어'}
              </span>
            </div>

            {/* 4. 독촉 및 압류 긴급도 */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">추심·독촉 단계</span>
                <span className={`w-2 h-2 rounded-full ${hasUrgentSeizure ? 'bg-amber-500' : 'bg-blue-500'}`} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  {hasUrgentSeizure ? '⚡ 금지명령 긴급 접수' : '정상 상담 진행'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                  {fp.harassmentLevel === 'SEIZURE' 
                    ? '급여/통장 압류 상태' 
                    : fp.harassmentLevel === 'LAWSUIT' 
                      ? '지급명령·소송 진행 중' 
                      : fp.harassmentLevel === 'LETTER' 
                        ? '독촉장 우편 수령' 
                        : '유선/문자 독촉 수신 중'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border self-start ${
                hasUrgentSeizure 
                  ? 'text-amber-700 bg-amber-50 border-amber-200' 
                  : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                {hasUrgentSeizure ? '당일 금지명령 권장' : '절차 안정권'}
              </span>
            </div>
          </div>
        </div>

        {/* ── 사건 유형 확정 트랙 (개인회생 vs 개인파산) ── */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-black text-slate-900">
                사건 진행 트랙 선택 (현재: <strong className="text-[#1E3A5F]">{isBankruptcy ? '개인파산·면책' : '개인회생'}</strong>)
              </span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              AI 추천: {isBankruptcy ? '개인파산·면책 트랙' : '개인회생 트랙'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => onSwitchCaseType && onSwitchCaseType('individual_rehab')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                !isBankruptcy 
                  ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">⚖️ 개인회생 트랙</span>
                {!isBankruptcy && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                정기적인 급여소득 또는 영업소득이 있어 36개월간 가용소득으로 변제 후 잔여 채무 면책
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSwitchCaseType && onSwitchCaseType('bankruptcy')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                isBankruptcy 
                  ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 shadow-xs' 
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">🏛️ 개인파산·면책 트랙</span>
                {isBankruptcy && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                고령, 중증 질환, 실직 등으로 객관적인 근로능력이 결여되어 전액 일괄 면책 도모
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
