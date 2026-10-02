import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Banknote, Calendar, CheckCircle2, 
  Send, ExternalLink, Award, FileText, AlertCircle, Clock,
  Trophy, Check, XCircle, Copy, Users, AlertOctagon,
  Scale, FileSpreadsheet, Download, RefreshCw, ChevronRight,
  Sparkles, CheckSquare, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, CrmStatus, DecisionSummaryData } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { useDialog } from '../../common/DialogProvider';
import { localYmd } from '../../../utils/localDate';
import DecisionSummaryCard from './DecisionSummaryCard';
import { getCourtRepealStandard, loadRehabCompanionCase, evaluateOverdueRisk } from '../../../services/companionService';
import RepealDefensePetitionModal from '../postcare/RepealDefensePetitionModal';
import type { RepealDefensePetitionType } from '../../../types/courtPetitionTypes';

export type Stage6SectionTab = 'decision-summary' | 'creditors-meeting' | 'repayment' | 'discharge';

interface Stage6PostCareDischargeViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
  onOpenPostCareModal?: () => void;
  onUpdateStatus?: (newStatus: CrmStatus) => Promise<boolean | void>;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

export default function Stage6PostCareDischargeView({
  clientRequest,
  crmExt,
  activeSection = 'decision-summary',
  onSelectSection,
  onOpenPostCareModal,
  onUpdateStatus,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
}: Stage6PostCareDischargeViewProps) {
  const dialog = useDialog();

  // 4대 섹션 탭 연동
  const currentSection: Stage6SectionTab = useMemo(() => {
    if (
      activeSection === 'creditors-meeting' ||
      activeSection === 'repayment' ||
      activeSection === 'discharge'
    ) {
      return activeSection;
    }
    return 'decision-summary';
  }, [activeSection]);

  const handleSwitchSection = (section: Stage6SectionTab) => {
    if (onSelectSection) {
      onSelectSection(section);
    }
  };

  const ds = crmExt?.decisionSummary;
  const cc: any = crmExt?.courtCase || {};
  const courtName = cc.courtName || ds?.courtName || clientRequest.court || '관할 법원';
  const caseNumber = cc.caseNumber || ds?.caseNumber || (clientRequest as any).caseNumber || '(사건번호 미등록)';
  const clientName = clientRequest.clientName || '신청인';

  const virtualAccount = ds?.virtualAccountNumber
    ? `${ds.virtualAccountBank || ''} ${ds.virtualAccountNumber}`.trim()
    : (cc.courtVirtualAccount || '');
  const creditorsMeetingDate: string = cc.creditorMeetingDate || '';
  const firstPaymentDate: string = ds?.firstPaymentDate || '';
  const monthlyPayment: number = ds?.monthlyPayment || crmExt?.repaymentPlan?.monthlyRepaymentTotal || 0;
  const repaymentMonths: number = ds?.repaymentMonths || crmExt?.repaymentPlan?.months || 36;

  const isDischarged = crmExt?.crmStatus === 'discharged' || clientRequest.status === 'discharged' || !!cc.dischargeDate;
  const isCancelled = crmExt?.crmStatus === 'cancelled' || clientRequest.status === 'cancelled';
  const isConfirmed = !!cc.confirmationDate;

  // 폐지 방어 신청서 모달 상태
  const [repealModalOpen, setRepealModalOpen] = useState(false);
  const [repealPetitionType, setRepealPetitionType] = useState<RepealDefensePetitionType>('REPAYMENT_PLAN_MODIFICATION');

  // 인가결정일 입력 상태
  const [confirmationDateInput, setConfirmationDateInput] = useState<string>(cc.confirmationDate || '');
  const [isSavingConfirmation, setIsSavingConfirmation] = useState(false);

  // 사건 유형 자동 감지
  const caseType: 'rehabilitation' | 'bankruptcy' = useMemo(() => {
    const ct = (crmExt as any)?.caseType || (clientRequest as any).caseType || '';
    if (ct.includes('파산') || ct.includes('bankruptcy') || ct === 'bankruptcy') return 'bankruptcy';
    return 'rehabilitation';
  }, [crmExt, clientRequest]);

  // 회생동행 연계 미납 위험 평가
  const { recordedOverdue, hasPaymentRecords } = useMemo(() => {
    try {
      const cs = loadRehabCompanionCase(clientRequest.id);
      if (!cs) return { recordedOverdue: 0, hasPaymentRecords: false };
      const hasRecords = (cs.schedules || []).some(s => s.status !== 'pending');
      if (cs.sourceType === 'mykim_lawyer' && !hasRecords) return { recordedOverdue: 0, hasPaymentRecords: false };
      return { recordedOverdue: evaluateOverdueRisk(cs).overdueCount, hasPaymentRecords: true };
    } catch {
      return { recordedOverdue: 0, hasPaymentRecords: false };
    }
  }, [clientRequest.id]);

  const [overdueCount, setOverdueCount] = useState<number>(recordedOverdue);
  const courtThreshold = getCourtRepealStandard(courtName);

  // 가상계좌 클립보드 복사
  const handleCopyAccount = async () => {
    if (!virtualAccount) {
      toast.error('등록된 법원 가상계좌가 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(virtualAccount);
      toast.success(`법원 가상계좌(${virtualAccount})가 클립보드에 복사되었습니다.`);
    } catch {
      toast.info(`법원 가상계좌: ${virtualAccount}`);
    }
  };

  // 실질적 가상계좌 납부 안내 발송
  const handleSendPaymentGuide = async () => {
    if (!virtualAccount) {
      toast.error('등록된 법원 가상계좌가 없습니다. 개시결정 요약에서 가상계좌를 먼저 등록해 주세요.');
      return;
    }

    const messageText = `[${courtName} 개인회생 적립금 납부 안내]\n신청인: ${clientName} 님\n사건번호: ${caseNumber}\n납부계좌: ${virtualAccount}\n월 변제금: ${monthlyPayment.toLocaleString()}원\n\n※ 매월 지정된 기일에 법원 가상계좌로 직접 입금하셔야 절차가 원활히 진행됩니다. 3회 이상 미납 시 절차 폐지 위험이 있으니 유의하시기 바랍니다.`;

    const confirmed = await dialog.confirm({
      title: '법원 가상계좌 납부 안내 발송',
      message: `${clientName} 님에게 아래 내용으로 납부 안내를 발송하시겠습니까?\n\n${messageText}`,
      confirmText: '알림톡/문자 발송',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    addClientNotification({
      type: 'status_change',
      title: `[적립금 납부 안내] ${clientName}님, 법원 가상계좌(${virtualAccount})로 당월 변제금(${monthlyPayment.toLocaleString()}원)을 입금해 주세요.`,
      emoji: '🏦',
      linkTab: 'diagnosis',
    });

    toast.success(`${clientName} 님에게 법원 가상계좌 납부 안내가 발송되었습니다.`);
  };

  // 채권자집회 안내 발송
  const handleSendMeetingGuide = async () => {
    if (!creditorsMeetingDate) {
      toast.error('등록된 채권자집회 기일이 없습니다. 집회 기일을 먼저 등록해 주세요.');
      return;
    }

    const messageText = `[${courtName} 채권자집회 출석 안내]\n신청인: ${clientName} 님\n사건번호: ${caseNumber}\n집회기일: ${creditorsMeetingDate}\n\n※ 채권자집회에는 반드시 신분증을 지참하고 본인이 직접 출석하셔야 합니다. 불출석 시 개인회생 절차가 폐지될 수 있으니 시간을 엄수해 주시기 바랍니다.`;

    const confirmed = await dialog.confirm({
      title: '채권자집회 출석 안내 발송',
      message: `${clientName} 님에게 채권자집회 출석 안내를 발송하시겠습니까?\n\n${messageText}`,
      confirmText: '출석 안내 발송',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    addClientNotification({
      type: 'status_change',
      title: `[채권자집회 안내] ${clientName}님, 채권자집회(${creditorsMeetingDate})에 신분증을 지참하고 반드시 출석해 주세요.`,
      emoji: '🏛️',
      linkTab: 'diagnosis',
    });

    toast.success(`${clientName} 님에게 채권자집회 출석 안내가 발송되었습니다.`);
  };

  // 인가결정일 저장 핸들러
  const handleSaveConfirmationDate = async () => {
    if (!confirmationDateInput) {
      toast.error('인가결정일을 입력해 주세요.');
      return;
    }
    if (!onUpdateCrmExt) return;
    setIsSavingConfirmation(true);
    try {
      await onUpdateCrmExt({
        courtCase: {
          ...cc,
          caseType: cc.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
          caseNumber,
          courtName,
          confirmationDate: confirmationDateInput,
        },
      });
      toast.success('변제계획인가결정일이 등록되었습니다.');
    } catch {
      toast.error('인가일자 저장에 실패했습니다.');
    } finally {
      setIsSavingConfirmation(false);
    }
  };

  // 면책 결정 등록 및 사건 종결
  const handleCompleteDischarge = async () => {
    const confirmed = await dialog.confirm({
      title: `${caseType === 'bankruptcy' ? '파산 면책 확정 및 사건 종결' : '회생 면책결정 확정 및 사건 종결'}`,
      message: `${clientName} 님의 ${caseType === 'bankruptcy' ? '파산 및 면책' : '개인회생'} 절차가 모두 완결되었습니까?\n\n- 사건 상태를 [면책 완료(discharged)]로 변경하고 오늘 날짜로 면책일자를 기록합니다.\n- 모든 채무에 대한 법적 면책 효력이 발생하며 신용회복 절차가 진행됩니다.`,
      confirmText: '면책 확정 및 사건 종결',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      const today = localYmd();
      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          crmStatus: 'discharged',
          courtCase: {
            ...cc,
            caseType: cc.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
            caseNumber,
            courtName,
            dischargeDate: today,
          },
        });
      }
      if (onUpdateStatus) {
        await onUpdateStatus('discharged');
      }

      addClientNotification({
        type: 'status_change',
        title: `[면책 결정 확정] 축하드립니다! ${clientName}님의 모든 채무가 면책 결정되어 사건이 성공적으로 종결되었습니다.`,
        emoji: '🎊',
        linkTab: 'diagnosis',
      });

      toast.success(`${clientName} 님의 사건이 성공적으로 면책 종결되었습니다.`);
    } catch (e: any) {
      toast.error(e?.message || '면책 처리에 실패했습니다.');
    }
  };

  // 기각 또는 폐지 처리
  const handleDismissCase = async () => {
    const confirmed = await dialog.confirm({
      title: '사건 기각 또는 폐지 처리',
      message: `이 사건을 법원 기각 또는 폐지(취소) 상태로 처리하시겠습니까?\n\n사건 상태가 [취소/기각(cancelled)]으로 변경됩니다.`,
      confirmText: '기각/폐지 확정',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const today = localYmd();
      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          crmStatus: 'cancelled',
          courtCase: {
            ...cc,
            caseType: cc.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
            caseNumber,
            courtName,
            dismissalDate: today,
          },
        });
      }
      if (onUpdateStatus) {
        await onUpdateStatus('cancelled');
      }
      toast.info('사건이 기각/폐지 처리되었습니다.');
    } catch (e: any) {
      toast.error(e?.message || '기각 처리에 실패했습니다.');
    }
  };

  const handleSaveDecisionSummary = async (updatedData: DecisionSummaryData) => {
    if (!onUpdateCrmExt) return;
    await onUpdateCrmExt({
      decisionSummary: updatedData,
      courtCase: {
        ...cc,
        caseType: cc.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
        caseNumber,
        courtName,
        commencementDate: updatedData.commencementDate,
        courtVirtualAccount: `${updatedData.virtualAccountBank || ''} ${updatedData.virtualAccountNumber || ''}`.trim(),
      },
    });
  };

  // 주 버튼(Primary CTA) 렌더링
  const renderPrimaryAction = () => {
    if (isDischarged) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>면책 확정 및 사건 종결 완료</span>
          </span>
        </div>
      );
    }

    if (isCancelled) {
      return (
        <span className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 font-bold flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-rose-600" />
          <span>기각 또는 폐지 종결됨</span>
        </span>
      );
    }

    // 단계별 주 버튼 흐름: 적립금 확인 → 집회 안내 → 면책 신청 → 사건 종결
    if (currentSection === 'creditors-meeting') {
      return (
        <button
          type="button"
          onClick={handleSendMeetingGuide}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Users className="w-4 h-4 text-blue-300" />
          <span>채권자집회 출석 안내 발송</span>
        </button>
      );
    }

    if (currentSection === 'repayment') {
      return (
        <button
          type="button"
          onClick={handleSendPaymentGuide}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Banknote className="w-4 h-4 text-emerald-300" />
          <span>가상계좌 적립금 납부 안내</span>
        </button>
      );
    }

    if (currentSection === 'discharge') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCompleteDischarge}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>면책 결정 등록 (사건 종결)</span>
          </button>
          <button
            type="button"
            onClick={handleDismissCase}
            className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl border border-rose-300 shadow-xs transition-all flex items-center gap-1 press-scale cursor-pointer whitespace-nowrap"
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>기각·폐지</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSendPaymentGuide}
          className="px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Send className="w-4 h-4 text-blue-300" />
          <span>가상계좌 안내</span>
        </button>
        <button
          type="button"
          onClick={() => handleSwitchSection('repayment')}
          className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <span>변제 관리로 이동</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      {/* ── 1. 상단 라이트 헤더 & 4대 섹션 네비게이션 ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#1E3A5F]" />
                6단계: 변제 관리 및 면책 종결
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E3A5F] border border-blue-200 text-xs font-semibold flex items-center gap-1">
                {courtName}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
                사건: {caseNumber}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                isDischarged
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isCancelled
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {isDischarged ? '면책 완료 (종결)' : isCancelled ? '폐지/기각' : '변제 및 사후관리 진행'}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>인가 후 변제 관리 및 최종 면책</span>
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              법원 가상계좌 적립금 납부 현황을 점검하고, 채권자집회 출석 지도, 미납에 따른 폐지 위험 방어, 최종 면책 결정을 관리합니다.
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-slate-600 flex-wrap font-mono">
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                신청인: <strong className="text-slate-900">{clientName}</strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                가상계좌: <strong className="text-slate-900">{virtualAccount || '미등록'}</strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                월 변제금: <strong className="text-slate-900">{monthlyPayment ? `${monthlyPayment.toLocaleString()}원` : '미입력'}</strong>
              </span>
            </div>
          </div>

          {/* 우측 마스터 액션 버튼 그룹 */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[200px]">
            <button
              type="button"
              onClick={handleCopyAccount}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              <span>가상계좌번호 복사</span>
            </button>

            {!isDischarged && !isCancelled && (
              <button
                type="button"
                onClick={handleCompleteDischarge}
                className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>면책 결정 등록 (사건 종결)</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 4대 섹션 탭 네비게이션 ── */}
        <div className="pt-4 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSwitchSection('decision-summary')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'decision-summary'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>개시결정 요약 (가상계좌 편집)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('creditors-meeting')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'creditors-meeting'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>채권자집회·인가 ({creditorsMeetingDate || '기일 확인'})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('repayment')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'repayment'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>변제 관리 (적립금 · 미납 경고)</span>
            {overdueCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                {overdueCount}회 미납
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('discharge')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'discharge'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>면책 (종결)</span>
            {isDischarged && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                완료
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. 섹션 1: 개시결정 요약 (decision-summary) ── */}
      {currentSection === 'decision-summary' && (
        <div className="space-y-6">
          <DecisionSummaryCard
            clientName={clientName}
            data={crmExt?.decisionSummary}
            onSave={handleSaveDecisionSummary}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-700 block">법원 가상계좌 정보</span>
              <div className="font-mono font-bold text-base text-slate-900">{virtualAccount || '미등록'}</div>
              <p className="text-xs text-slate-500">인가결정 전 매월 변제금을 적립하는 법원 보관금 계좌입니다.</p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-700 block">1회차 변제금 납입기일</span>
              <div className="font-mono font-bold text-base text-slate-900">{firstPaymentDate || '기일 미지정'}</div>
              <p className="text-xs text-slate-500">개시결정문 상의 최초 변제금 납부 시작일입니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 섹션 2: 채권자집회·인가 (creditors-meeting) ── */}
      {currentSection === 'creditors-meeting' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 채권자집회 출석 지도 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">채권자집회 기일 및 출석 요령</h3>
                      <p className="text-xs text-slate-500">채무자 본인 출석 필수 (대리 출석 불가)</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">
                    {creditorsMeetingDate || '기일 미등록'}
                  </span>
                </div>

                <div className="pt-3 space-y-2.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    개인회생 채권자집회는 채무자가 직접 법정에 출석하여 변제계획안에 관한 이의를 진술하는 기일입니다. 정당한 사유 없이 불출석할 경우 절차가 폐지될 수 있습니다.
                  </p>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">관할 법원:</span>
                      <span className="font-bold text-slate-800">{courtName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">집회 일시:</span>
                      <span className="font-bold text-indigo-700">{creditorsMeetingDate || '미정'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">지참물:</span>
                      <span className="font-bold text-emerald-700">주민등록증/운전면허증 (신분증 필수)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  집회 3~7일 전 의뢰인 안내 발송 권장
                </span>
                <button
                  type="button"
                  onClick={handleSendMeetingGuide}
                  className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Send className="w-3.5 h-3.5 text-blue-300" />
                  <span>출석 안내 알림 발송</span>
                </button>
              </div>
            </div>

            {/* 변제계획인가결정 등록 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">변제계획인가결정 등록</h3>
                      <p className="text-xs text-slate-500">채권자집회 후 법원의 변제계획인가 확정 기록</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                    isConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {isConfirmed ? '인가 완료' : '인가 대기'}
                  </span>
                </div>

                <div className="pt-3 space-y-3 text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    채권자집회에서 이의가 없거나 이의가 해결되면 법원은 변제계획을 인가합니다. 인가결정일을 등록하면 정식 인가 단계로 기록됩니다.
                  </p>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="font-bold text-slate-700 block mb-1">변제계획인가 결정일</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={confirmationDateInput}
                        onChange={(e) => setConfirmationDateInput(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveConfirmationDate}
                        disabled={isSavingConfirmation}
                        className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-lg transition-all press-scale cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isSavingConfirmation ? '저장 중...' : '인가일 저장'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {isConfirmed ? `✓ 인가결정일: ${cc.confirmationDate}` : '인가 전 적립금 납부 유지 필요'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. 섹션 3: 변제 관리 (repayment) ── */}
      {currentSection === 'repayment' && (
        <div className="space-y-6">
          {/* 미납 위험 경보 배너 (법 제624조) */}
          <div className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
            overdueCount >= 3
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : overdueCount > 0
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-start gap-2.5">
              {overdueCount >= 3 ? (
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : overdueCount > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold">
                    {overdueCount >= 3
                      ? `⚠️ 법 제624조 폐지 위험 경보 (${overdueCount}회 미납)`
                      : overdueCount > 0
                      ? `변제금 미납 주의 (${overdueCount}회 미납)`
                      : '정상 변제 적립 중 (미납 내역 없음)'}
                  </strong>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/70">
                    {courtName} 실무 기준: {courtThreshold.warningRounds}회 경고 / {courtThreshold.repealRiskRounds}회 이상 연체 시 폐지
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {overdueCount >= 3
                    ? '3회 이상 변제금을 미납하면 법원이 개인회생 폐지 결정을 내릴 수 있습니다. 즉시 변제계획 변경신청서 또는 소명서를 제출해야 합니다.'
                    : overdueCount > 0
                    ? '변제금 납부 지연 시 의뢰인에게 즉시 가상계좌 입금을 지도해 주세요.'
                    : '법원 가상계좌로 정상 납입되고 있습니다. 누락되지 않도록 매월 정기 확인을 진행하세요.'}
                </p>
              </div>
            </div>

            {overdueCount >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setRepealPetitionType('REPAYMENT_PLAN_MODIFICATION');
                  setRepealModalOpen(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale shrink-0 whitespace-nowrap"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>폐지 방어 신청서 작성</span>
              </button>
            )}
          </div>

          {/* 적립금 및 회차 납부 명세 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-700 block">월 변제금 / 총 변제기간</span>
              <div className="font-mono font-bold text-lg text-slate-900">
                {monthlyPayment.toLocaleString()}원 / {repaymentMonths}개월
              </div>
              <p className="text-xs text-slate-500">
                총 변제 예정액: {(monthlyPayment * repaymentMonths).toLocaleString()}원
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-700 block">미납 회차 시뮬레이션</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={repaymentMonths}
                  value={overdueCount}
                  onChange={(e) => setOverdueCount(Number(e.target.value) || 0)}
                  className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
                <span className="text-xs text-slate-600">회 미납</span>
              </div>
              <p className="text-xs text-slate-500">
                미납 누적액: {(overdueCount * monthlyPayment).toLocaleString()}원
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-700 block">의뢰인 가상계좌 알림</span>
                <p className="text-xs text-slate-500 mt-1">
                  법원 가상계좌번호를 의뢰인 알림톡/문자로 즉시 전송합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendPaymentGuide}
                className="w-full py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale"
              >
                <Send className="w-3.5 h-3.5 text-blue-300" />
                <span>가상계좌 납부 안내 발송</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 섹션 4: 면책 (discharge) ── */}
      {currentSection === 'discharge' && (
        <div className="space-y-6">
          {/* 면책 신청 및 확정 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {caseType === 'bankruptcy' ? '파산 면책결정 확정 및 사건 종결' : '개인회생 변제 완료 및 면책결정 확정'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {caseType === 'bankruptcy'
                      ? '파산관재인 절차 종결 후 면책 허가결정이 확정되면 모든 채무가 면책됩니다.'
                      : '36~60개월 변제금을 완납한 후 법원에 면책신청서를 제출하여 면책결정을 확정합니다.'}
                  </p>
                </div>
              </div>

              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                isDischarged
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {isDischarged ? '✓ 면책 종결 완료' : '면책 대기'}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed pt-1">
              <p>
                변제 완료 후 법원 면책신청서 제출 → 법원의 면책결정 공고 → 2주 후 면책결정 확정의 절차로 진행됩니다. 면책결정이 확정되면 한국신용정보원의 1101(개인회생/파산) 특수기록이 해제되어 정상 금융거래가 가능해집니다.
              </p>

              {isDischarged ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5 font-mono text-emerald-950">
                  <div className="flex justify-between">
                    <span>면책 결정일자:</span>
                    <strong className="text-emerald-800">{cc.dischargeDate || '기록됨'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>신용회복 상태:</span>
                    <strong className="text-emerald-800">특수기록 해제 및 신용등급 재산정 대상</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>사건 상태:</span>
                    <strong className="text-emerald-800">최종 종결 (discharged)</strong>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">면책 결정 등록 준비</span>
                    <span className="text-xs text-slate-500">변제 완료 확인 후 실행</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    의뢰인이 변제금을 전액 납부하였거나 파산 면책결정문을 송달받은 경우, 아래 버튼을 눌러 사건을 [면책 완료]로 승격하고 종결 처리합니다.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCompleteDischarge}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                    >
                      <Trophy className="w-4 h-4 text-amber-300" />
                      <span>면책 확정 등록 및 사건 종결</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissCase}
                      className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl border border-rose-300 shadow-xs transition-all cursor-pointer press-scale"
                    >
                      기각·폐지 처리
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. 하단 단일 주 액션 바 (라이트 서페이스, AGENTS.md 준수) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sticky bottom-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isDischarged
              ? 'bg-emerald-600 text-white'
              : isCancelled
              ? 'bg-rose-600 text-white'
              : 'bg-[#1E3A5F] text-white'
          }`}>
            {isDischarged ? <Trophy className="w-5 h-5 text-amber-300" /> : isCancelled ? <XCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">
                {isDischarged
                  ? '면책 확정 및 사건 종결 완료'
                  : isCancelled
                  ? '법원 기각 또는 폐지 종결'
                  : currentSection === 'creditors-meeting'
                  ? '채권자집회 출석 지도 대기'
                  : currentSection === 'repayment'
                  ? '변제 적립금 납부 관리'
                  : currentSection === 'discharge'
                  ? '면책 신청 및 최종 종결'
                  : '인가 후 사후관리 진행 중'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                isDischarged
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isCancelled
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {isDischarged ? '종결됨' : 'Stage 6'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDischarged
                ? '모든 채무 면책이 확정되었습니다. 신용회복 및 사건 종결 절차가 완료되었습니다.'
                : isCancelled
                ? '사건이 기각/폐지 처리되었습니다.'
                : '적립금 납부 누락을 방지하고 채권자집회 출석을 지도한 뒤 최종 면책 결정을 등록하세요.'}
            </p>
          </div>
        </div>

        {/* 주 액션 버튼 */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {renderPrimaryAction()}
        </div>
      </div>

      {/* ── 7. 폐지 방어 신청서 작성 모달 ── */}
      {repealModalOpen && (
        <RepealDefensePetitionModal
          isOpen={repealModalOpen}
          onClose={() => setRepealModalOpen(false)}
          petitionType={repealPetitionType}
          clientRequest={clientRequest}
          crmExt={crmExt || ({} as any)}
          activeLawyerName={activeLawyerName}
        />
      )}
    </div>
  );
}
