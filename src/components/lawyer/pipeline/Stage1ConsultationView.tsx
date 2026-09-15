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
      {/* ── Next Action Hero Card (제안서 게이팅 동적 카드) ── */}
      {isAnonymousPhase ? (
        // [Phase 1: 제안서 미발송 상태 - 제안서 작성 단독 강제]
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-blue-500/40 bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-slate-900 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 rounded-xl shrink-0 bg-blue-500/20 border border-blue-400/30 text-amber-300 shadow-xs">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                신청인 맞춤 솔루션 및 비용 제안서를 작성하여 고객에게 발송하세요
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {onOpenProposalDraft && (
                <button
                  type="button"
                  onClick={onOpenProposalDraft}
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 press-scale cursor-pointer whitespace-nowrap"
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

      {/* ── 3. 고객 사전진단 계기판 (초슬림 HUD) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
          <span className="p-1 rounded-md bg-[#1E3A5F] text-white">
            <BarChart3 className="w-3.5 h-3.5" />
          </span>
          <span className="font-black text-xs text-slate-900">
            사전 진단 요건 검토 계기판
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({stealthName})
          </span>
        </div>

        {/* 4대 계기판 타일 (한 줄 배치) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 타일 1: 채무 vs 자산 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">1. 채무 vs 자산</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black border ${
                isDebtExceedingAssets ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isDebtExceedingAssets ? '🟢 충족' : '🔴 미달'}
              </span>
            </div>
            <div>
              <div className="text-lg font-black font-mono text-slate-900 leading-tight">
                {assetRatio}% <span className="text-xs font-normal text-slate-500">자산비율</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-0.5 block">
                자산 {assetsTotal.toLocaleString()}만 / 채무 {debtTotal.toLocaleString()}만
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-blue-600 h-full" style={{ width: `${Math.min(100, Math.max(5, assetRatio))}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${Math.max(0, 100 - Math.min(100, Math.max(5, assetRatio)))}%` }} />
            </div>
          </div>

          {/* 타일 2: 월 가용소득 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">2. 월 가용소득</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black border ${
                isAvailableIncomeSufficient ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {isAvailableIncomeSufficient ? '🟢 회생적합' : '🟣 파산권장'}
              </span>
            </div>
            <div>
              <div className={`text-lg font-black font-mono leading-tight ${isAvailableIncomeSufficient ? 'text-emerald-600' : 'text-purple-600'}`}>
                {availableIncome.toLocaleString()} <span className="text-xs font-normal text-slate-500">만원 / 월</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-0.5 block">
                소득 {income.toLocaleString()}만 - 생계비 {minLivingCost.toLocaleString()}만
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-indigo-400 h-full" style={{ width: `${income > 0 ? Math.min(100, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100)) : 100}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${income > 0 ? Math.max(0, 100 - Math.min(100, Math.round((minLivingCost / Math.max(income, minLivingCost)) * 100))) : 0}%` }} />
            </div>
          </div>

          {/* 타일 3: 법정 채무한도 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">3. 법정 채무한도</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black border ${
                isDebtUnderLimit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isDebtUnderLimit ? '🟢 한도 내' : '🔴 초과'}
              </span>
            </div>
            <div>
              <div className="text-lg font-black font-mono text-slate-900 leading-tight">
                {debtLimitPercentage}% <span className="text-xs font-normal text-slate-500">한도점유</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-0.5 block">
                총 {debtTotal.toLocaleString()}만원 / 상한 10억
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, debtLimitPercentage))}%` }} />
            </div>
          </div>

          {/* 타일 4: 결격사유 & 긴급도 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">4. 결격 & 긴급도</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black border ${
                hasUrgentSeizure ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {hasUrgentSeizure ? '⚡ 금지명령' : '🟢 일반'}
              </span>
            </div>
            <div>
              <div className={`text-lg font-black font-mono leading-tight ${hasUrgentSeizure ? 'text-amber-600' : 'text-slate-900'}`}>
                {hasUrgentSeizure ? '독촉 진행' : '양호'} <span className="text-xs font-normal text-slate-500">{speculativeDebtRatio > 0 ? `(사행성 ${speculativeDebtRatio}%)` : ''}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-0.5 block truncate">
                {!hasRecentDischarge ? '면책이력 없음' : '최근 면책'} | {fp.harassmentLevel === 'SEIZURE' ? '압류' : '유선독촉'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className={`h-1.5 rounded-full ${!hasRecentDischarge ? 'bg-emerald-500' : 'bg-rose-500'}`} title="면책이력 통과" />
              <div className={`h-1.5 rounded-full ${speculativeDebtRatio <= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`} title="사행성 비율" />
              <div className={`h-1.5 rounded-full ${!hasUrgentSeizure ? 'bg-emerald-500' : 'bg-amber-500'}`} title="독촉 단계" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
