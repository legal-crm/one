import React, { useState, useMemo } from 'react';
import { 
  Scale, FileEdit, Clock, CheckCircle2, AlertTriangle, 
  Send, ExternalLink, ArrowRight, Table, Sparkles, FileText,
  ShieldCheck, RefreshCw, BellRing, Check, Paperclip, Eye, FolderOpen,
  Trophy, Landmark, Calendar, Banknote, Lock, ChevronRight, Shield,
  FileSpreadsheet, Download, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, CrmStatus, DecisionSummaryData } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { localYmd, parseLocalYmd } from '../../../utils/localDate';
import { useDialog } from '../../common/DialogProvider';
import DecisionSummaryCard from './DecisionSummaryCard';
import LegalFlowThirteenStepper from './LegalFlowThirteenStepper';
import { defaultThirteenStageFor } from './journeyStage';
import { computeCourtDeadline, daysUntil, formatYmdWithDow } from '../../../services/court/deadlineCalculator';
import ComprehensiveCorrectionCenter from '../correction/ComprehensiveCorrectionCenter';

export type Stage5SectionTab = 'court-progress' | 'corrections' | 'decision';

interface Stage5CorrectionCenterViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
  onAdvanceToNextStage: () => void;
  onOpenComprehensiveCorrectionModal?: () => void;
  onUpdateStatus?: (newStatus: CrmStatus) => Promise<boolean | void>;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

export default function Stage5CorrectionCenterView({
  clientRequest,
  crmExt,
  activeSection = 'corrections',
  onSelectSection,
  onAdvanceToNextStage,
  onOpenComprehensiveCorrectionModal,
  onUpdateStatus,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
}: Stage5CorrectionCenterViewProps) {
  const dialog = useDialog();

  // 3대 섹션 탭 연동
  const currentSection: Stage5SectionTab = useMemo(() => {
    if (activeSection === 'court-progress' || activeSection === 'decision') {
      return activeSection;
    }
    return 'corrections';
  }, [activeSection]);

  const handleSwitchSection = (section: Stage5SectionTab) => {
    if (onSelectSection) {
      onSelectSection(section);
    }
  };

  const caseNumber = crmExt?.courtCase?.caseNumber || (clientRequest as any)?.caseNumber || '사건번호 미등록';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '관할 법원 미입력';
  const isProhibitionGranted = crmExt?.courtCase?.prohibitionStatus === 'granted' || !!crmExt?.courtCase?.prohibitionGrantedDate;
  const clientName = clientRequest.clientName || '신청인';
  const clientId = clientRequest.id || clientRequest.clientName || 'default_client';

  // 개시결정 상태 판정
  const isCommenced = ['commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || clientRequest.status || '') 
    || !!crmExt?.courtCase?.commencementDate 
    || !!crmExt?.decisionSummary?.commencementDate;

  // 개시결정 등록 폼 상태
  const [commencementDate, setCommencementDate] = useState<string>(
    crmExt?.decisionSummary?.commencementDate || crmExt?.courtCase?.commencementDate || localYmd()
  );
  const [virtualBank, setVirtualBank] = useState<string>(
    crmExt?.decisionSummary?.virtualAccountBank || '신한은행(법원보관금)'
  );
  const [virtualAccount, setVirtualAccount] = useState<string>(
    crmExt?.decisionSummary?.virtualAccountNumber || (crmExt?.courtCase as any)?.courtVirtualAccount || ''
  );
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(
    crmExt?.decisionSummary?.firstPaymentDate || ''
  );
  const [creditorMeetingDate, setCreditorMeetingDate] = useState<string>(
    (crmExt?.courtCase as any)?.creditorMeetingDate || ''
  );
  const [monthlyPayment, setMonthlyPayment] = useState<number>(
    crmExt?.decisionSummary?.monthlyPayment || ((crmExt?.repaymentPlan as any)?.incomeExpense?.monthlyAvailable || 0)
  );
  const [repaymentMonths, setRepaymentMonths] = useState<number>(
    crmExt?.decisionSummary?.repaymentMonths || ((crmExt?.repaymentPlan as any)?.repaymentMonths || 36)
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(!isCommenced);

  // 금지명령 결과 등록 폼 상태
  const [prohibitionStatus, setProhibitionStatus] = useState<string>(
    crmExt?.courtCase?.prohibitionStatus || (isProhibitionGranted ? 'granted' : 'pending')
  );
  const [prohibitionDate, setProhibitionDate] = useState<string>(
    crmExt?.courtCase?.prohibitionGrantedDate || ''
  );
  const [isSavingProhibition, setIsSavingProhibition] = useState(false);

  // 사건 유형 자동 감지 (회생/파산 분기)
  const caseType: 'rehabilitation' | 'bankruptcy' = useMemo(() => {
    const ct = (crmExt as any)?.caseType || (clientRequest as any).caseType || '';
    if (ct.includes('파산') || ct.includes('bankruptcy') || ct === 'bankruptcy') return 'bankruptcy';
    return 'rehabilitation';
  }, [crmExt, clientRequest]);

  // 보정 차수 관리 상태
  const [activeCorrectionRound, setActiveCorrectionRound] = useState<number>(1);
  const [showInlineFullEditor, setShowInlineFullEditor] = useState<boolean>(false);

  // 현재 활성 보정권고 추출
  const activeCorrection = (crmExt?.correctionOrders && crmExt.correctionOrders.length > 0)
    ? crmExt.correctionOrders[0]
    : (crmExt?.corrections && crmExt.corrections.length > 0)
    ? crmExt.corrections[0]
    : null;

  // 보정 송달일 및 기간 (기본 14일)
  const [servedDateInput, setServedDateInput] = useState<string>(
    (activeCorrection as any)?.servedDate || (crmExt as any)?.correctionBriefDraft?.servedDate || ''
  );
  const [periodDaysInput, setPeriodDaysInput] = useState<number>(
    Number((activeCorrection as any)?.periodDays || (crmExt as any)?.correctionBriefDraft?.periodDays) || 14
  );

  // 단일 법원 기한 산출 엔진 (deadlineCalculator.ts)
  const deadlineResult = useMemo(() => {
    if (!servedDateInput) return null;
    return computeCourtDeadline(servedDateInput, periodDaysInput, 'day');
  }, [servedDateInput, periodDaysInput]);

  const finalDeadline = deadlineResult?.date || (activeCorrection as any)?.deadline || (activeCorrection as any)?.dueDate || '';
  const daysLeft = finalDeadline ? daysUntil(finalDeadline) : null;

  // D-Day 정보
  const dDayInfo = useMemo(() => {
    if (!finalDeadline || daysLeft === null) {
      return { text: '송달일 입력 후 법정 기한 자동 계산', isUrgent: false };
    }
    if (daysLeft > 0) {
      return { 
        text: `제출기한 D-${daysLeft} (${formatYmdWithDow(finalDeadline)}까지)`, 
        isUrgent: daysLeft <= 3 
      };
    }
    if (daysLeft === 0) {
      return { text: `오늘 마감 (D-Day, ${formatYmdWithDow(finalDeadline)})`, isUrgent: true };
    }
    return { text: `기한 경과 (D+${Math.abs(daysLeft)}, ${formatYmdWithDow(finalDeadline)})`, isUrgent: true };
  }, [finalDeadline, daysLeft]);

  // 파산 사건 소명서 목록
  const bankruptcyTables = [
    { id: 1, code: 'BK01', title: '재산 상태 소명서', desc: '파산관재인 요구: 현재 보유 재산의 상세 소명' },
    { id: 2, code: 'BK02', title: '채무 발생 경위 소명서', desc: '각 채무별 발생 원인과 자금 사용처 소명' },
    { id: 3, code: 'BK03', title: '면책 불허가 사유 부존재 소명', desc: '도박·사치·편파변제 부존재 입증' },
    { id: 4, code: 'BK04', title: '최근 재산 처분 소명서', desc: '파산 전 2년간 재산 처분 내역 및 대금 사용처' },
    { id: 5, code: 'BK05', title: '가족 재산 형성 경위 소명', desc: '배우자·직계존비속 명의 재산의 자금 출처 소명' },
  ];

  // 회생 7대 소명서 표 목록
  const sevenTables = caseType === 'bankruptcy' ? bankruptcyTables : [
    { id: 1, code: 'T01', title: '표 1. 총 채무 및 채권자별 채무액 내역표', desc: '채권자목록 원금 및 이자 소명' },
    { id: 2, code: 'T02', title: '표 2. 채무 발생 원인 및 변제 경위 소명서', desc: '차입 목적, 생활비·병원비 지출 증빙' },
    { id: 3, code: 'T03', title: '표 3. 최근 1년 이내 차입금 사용처 소명표', desc: '대출금 인출 후 사용처 소명' },
    { id: 4, code: 'T04', title: '표 4. 최근 2년 이내 재산 처분대금 사용처표', desc: '부동산/차량 매각대금 사용처' },
    { id: 5, code: 'T05', title: '표 5. 가족 명의 재산 형성 경위 소명서', desc: '배우자/부모 명의 취득 자금 출처' },
    { id: 6, code: 'T06', title: '표 6. 신용카드 사용 내역 및 환가 소명표', desc: '카드 사용·현금화 여부 소명' },
    { id: 7, code: 'T07', title: '표 7. 월 평균 소득 및 필요경비 산정표', desc: '실소득 증빙 및 생계비 산정' },
  ];

  const hasDraft = !!(crmExt as any)?.correctionBriefDraft;

  // 금지명령 결과 저장
  const handleSaveProhibitionResult = async () => {
    if (!onUpdateCrmExt) return;
    setIsSavingProhibition(true);
    try {
      await onUpdateCrmExt({
        courtCase: {
          ...(crmExt?.courtCase || {}),
          caseType: crmExt?.courtCase?.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
          caseNumber,
          courtName,
          prohibitionStatus,
          prohibitionGrantedDate: prohibitionDate || undefined,
        },
      });
      toast.success('금지명령 심리 결과가 저장되었습니다.');
    } catch (e: any) {
      toast.error('금지명령 결과 저장에 실패했습니다.');
    } finally {
      setIsSavingProhibition(false);
    }
  };

  // 개시결정 정식 등록 핸들러
  const handleRegisterCommencement = async () => {
    if (!virtualAccount.trim()) {
      toast.error('법원 가상계좌번호를 입력해 주세요.');
      return;
    }
    const confirmed = await dialog.confirm({
      title: '법원 개시결정 정식 등록 및 6단계 진입',
      message: `${clientName} 님의 법원 개시결정을 등록하고 사건 상태를 [개시결정 완료(commenced)]로 승격하시겠습니까?\n\n- 결정일자: ${commencementDate}\n- 가상계좌: ${virtualBank} ${virtualAccount}\n- 1회차 납입일: ${firstPaymentDate || '미정'}\n\n등록 후 의뢰인에게 개시결정 및 가상계좌 납부 안내 앱 알림이 자동 발송됩니다.`,
      confirmText: '개시결정 등록 및 승격',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    setIsRegistering(true);
    try {
      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          crmStatus: 'commenced',
          courtCase: {
            ...(crmExt?.courtCase || {}),
            caseType: crmExt?.courtCase?.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
            caseNumber,
            courtName,
            commencementDate,
            creditorMeetingDate,
            courtVirtualAccount: `${virtualBank} ${virtualAccount}`.trim(),
          },
          decisionSummary: {
            ...(crmExt?.decisionSummary || {}),
            courtName,
            caseNumber,
            commencementDate,
            virtualAccountBank: virtualBank,
            virtualAccountNumber: virtualAccount,
            firstPaymentDate,
            monthlyPayment,
            repaymentMonths,
            totalDebt: crmExt?.decisionSummary?.totalDebt || Math.round(((crmExt?.repaymentPlan as any)?.totalPrincipal || 0) / 10000),
            totalRepayment: crmExt?.decisionSummary?.totalRepayment || Math.round(((monthlyPayment || 0) * (repaymentMonths || 36)) / 10000),
            repaymentRate: crmExt?.decisionSummary?.repaymentRate || ((crmExt?.repaymentPlan as any)?.repaymentRatio ? Math.round((crmExt?.repaymentPlan as any).repaymentRatio) : 35),
            totalDischarged: crmExt?.decisionSummary?.totalDischarged || 0,
            dischargeRate: crmExt?.decisionSummary?.dischargeRate || 65,
          },
        });
      }
      if (onUpdateStatus) {
        await onUpdateStatus('commenced');
      }

      addClientNotification({
        type: 'status_change',
        title: `[개시결정] ${clientName}님, 법원 개인회생 개시결정이 인가되었습니다. 가상계좌(${virtualBank} ${virtualAccount})를 확인하세요.`,
        emoji: '🎉',
        linkTab: 'diagnosis',
      });

      toast.success('개시결정이 등록되고 사건 상태가 [개시결정(commenced)]으로 변경되었습니다.');
      setShowRegisterForm(false);
    } catch (e: any) {
      toast.error(e?.message || '개시결정 등록에 실패했습니다.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSaveDecisionSummary = async (updatedData: DecisionSummaryData) => {
    if (!onUpdateCrmExt) return;
    await onUpdateCrmExt({
      decisionSummary: updatedData,
      courtCase: {
        ...(crmExt?.courtCase || {}),
        caseType: crmExt?.courtCase?.caseType || (caseType === 'bankruptcy' ? '개인파산' : '개인회생'),
        caseNumber,
        courtName,
        commencementDate: updatedData.commencementDate,
        courtVirtualAccount: `${updatedData.virtualAccountBank || ''} ${updatedData.virtualAccountNumber || ''}`.trim(),
      },
    });
  };

  const isBk = caseType === 'bankruptcy';
  const currentThirteenStage = crmExt?.thirteenStage || defaultThirteenStageFor(crmExt?.crmStatus, isBk);

  // 주 버튼(Primary CTA) 렌더링 (단일 주 버튼 흐름)
  const renderPrimaryAction = () => {
    if (isCommenced) {
      return (
        <button
          type="button"
          onClick={onAdvanceToNextStage}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <span>Stage 6 (변제·면책 관리)로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      );
    }

    if (currentSection === 'corrections') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInlineFullEditor(true)}
            className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
          >
            <FileEdit className="w-4 h-4 text-emerald-400" />
            <span>보정 답변서 전체 작성기</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchSection('decision')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>개시결정 등록하기</span>
          </button>
        </div>
      );
    }

    if (currentSection === 'decision') {
      return (
        <button
          type="button"
          onClick={() => setShowRegisterForm(true)}
          className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
        >
          <Trophy className="w-4 h-4 text-amber-300" />
          <span>개시결정 등록 폼 열기</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleSwitchSection('corrections')}
        className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
      >
        <span>보정 센터로 이동</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    );
  };

  return (
    <div className="p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      {/* ── 1. 상단 라이트 헤더 & 3대 섹션 네비게이션 ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#1E3A5F]" />
                5단계: 법원 대응 및 보정·개시
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E3A5F] border border-blue-200 text-xs font-semibold flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                {courtName}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
                사건: {caseNumber}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                isCommenced
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isCommenced ? '개시결정 인가 완료' : '보정 심리 진행 중'}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>법원 진행 · 보정 센터 및 결정 등록</span>
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              법원 진행현황을 모니터링하고, 회생위원 보정권고에 따른 소명서를 작성하며, 법원 개시결정(가상계좌)을 정식 등록합니다.
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-slate-600 flex-wrap font-mono">
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                신청인: <strong className="text-slate-900">{clientName}</strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                금지명령: <strong className={isProhibitionGranted ? 'text-emerald-700' : 'text-slate-700'}>
                  {isProhibitionGranted ? '발령 완료' : '심리 중'}
                </strong>
              </span>
              <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                담당: <strong className="text-slate-900">{activeLawyerName}</strong>
              </span>
            </div>
          </div>

          {/* 우측 마스터 액션 버튼 그룹 */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[200px]">
            <a
              href="https://www.scourt.go.kr/portal/information/events/search/search.jsp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center gap-2 press-scale whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>대법원 나의사건검색 열기</span>
            </a>

            {isCommenced ? (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
              >
                <span>Stage 6 (변제·면책)로 진행</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleSwitchSection('decision');
                  setShowRegisterForm(true);
                }}
                className="w-full px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 press-scale cursor-pointer whitespace-nowrap"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>개시결정 등록하기</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 3대 섹션 탭 네비게이션 (법원 진행 · 보정 센터 · 결정 등록) ── */}
        <div className="pt-4 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSwitchSection('court-progress')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'court-progress'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>법원 진행 (사건번호 · 기일 현황)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('corrections')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'corrections'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            <span>보정 센터 ({caseType === 'bankruptcy' ? '5대' : '7대'} 소명서 작성)</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              currentSection === 'corrections'
                ? 'bg-amber-400 text-slate-900'
                : daysLeft !== null && daysLeft <= 3
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-200 text-slate-700'
            }`}>
              {daysLeft !== null ? (daysLeft >= 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`) : '진행'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSection('decision')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer press-scale whitespace-nowrap ${
              currentSection === 'decision'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>결정 등록 (금지명령 · 개시결정)</span>
            {isCommenced && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                currentSection === 'decision' ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
              }`}>
                인가됨
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. 섹션 1: 법원 진행 (court-progress) ── */}
      {currentSection === 'court-progress' && (
        <div className="space-y-6">
          {/* 13단계 세부 절차 읽기 전용 타임라인 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#1E3A5F]" />
                <span>법원 13단계 세부 절차 타임라인</span>
              </h3>
              <span className="text-xs text-slate-500">결정 등록을 통해 절차가 실시간 갱신됩니다.</span>
            </div>

            <LegalFlowThirteenStepper
              currentStageId={currentThirteenStage}
              isBankruptcy={isBk}
              isDismissedRevoked={!!crmExt?.isDismissedRevoked}
              readOnly={true}
              onSelectStage={() => {}}
            />
          </div>

          {/* 사건 및 기일 현황 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-slate-100 pb-2">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#1E3A5F]" />
                  대법원 사건 기본정보
                </span>
                <span className="text-[#1E3A5F] font-mono font-bold">{courtName}</span>
              </div>
              <div className="space-y-1.5">
                <div className="text-base font-bold text-slate-900 font-mono">{caseNumber}</div>
                <div className="text-xs text-slate-500">
                  사건 접수일: <span className="font-mono text-slate-700">{crmExt?.courtCase?.filingDate || (clientRequest as any)?.filingDate || '접수완료'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                대법원 나의사건검색에서 사건진행내역 및 송달문서 조회가 실시간 가능합니다.
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 font-bold border-b border-slate-100 pb-2">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  금지명령 및 개시결정 상태
                </span>
                <span className={`font-mono font-bold ${isProhibitionGranted ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {isProhibitionGranted ? '금지명령 발령' : '심리 중'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-base font-bold text-slate-900">
                  {isCommenced ? '🏛️ 개시결정 인가 완료' : '보정권고 심리 및 개시 대기'}
                </div>
                <div className="text-xs text-slate-500">
                  {isCommenced
                    ? `결정일자: ${crmExt?.courtCase?.commencementDate || crmExt?.decisionSummary?.commencementDate}`
                    : isProhibitionGranted
                    ? '금지명령이 발령되어 채권자의 독촉·새 압류가 금지된 상태입니다.'
                    : '법원 심리가 진행 중입니다.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 섹션 2: 보정 센터 (corrections) — 인라인 보정 작업 환경 ── */}
      {currentSection === 'corrections' && (
        <div className="space-y-6">
          {/* 보정 기한 계산기 & 차수 관리 바 (단일 deadlineCalculator 적용) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    회생위원 보정권고 송달일 등록 & 법정 기한 자동 계산
                  </h3>
                  <p className="text-xs text-slate-500">
                    민법 제157조(초일불산입) 및 제161조(말일 토·공휴일 익일 연장) 산식을 자동 적용합니다.
                  </p>
                </div>
              </div>

              {/* 차수 탭 (1차 / 2차 / 3차 보정) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[1, 2, 3].map((round) => (
                  <button
                    key={round}
                    type="button"
                    onClick={() => setActiveCorrectionRound(round)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer press-scale ${
                      activeCorrectionRound === round
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{round}차 보정</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 송달일자 & 기간 입력 폼 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">보정권고 송달일 *</label>
                <input
                  type="date"
                  value={servedDateInput}
                  onChange={(e) => setServedDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">법원 지정 보정 기간 (일) *</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={periodDaysInput}
                  onChange={(e) => setPeriodDaysInput(Number(e.target.value) || 14)}
                  placeholder="예: 14"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">최종 만료 기한 (D-Day)</label>
                <div className={`p-2 rounded-xl border text-xs flex items-center justify-between font-mono font-bold ${
                  daysLeft !== null && daysLeft <= 3
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <span>{finalDeadline ? formatYmdWithDow(finalDeadline) : '송달일 입력 필요'}</span>
                  {daysLeft !== null && (
                    <span className={`px-2 py-0.5 rounded-md text-xs ${
                      daysLeft <= 0 ? 'bg-rose-600 text-white' : daysLeft <= 3 ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {daysLeft === 0 ? '오늘 마감' : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(deadlineResult?.extendedOver?.length || 0) > 0 && (
              <p className="text-xs text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  민법 제161조에 따라 당초 만료일({deadlineResult?.rawEndDate})이 주말/공휴일에 해당하여 익 영업일({deadlineResult?.date})로 만료일이 자동 연장되었습니다.
                </span>
              </p>
            )}
          </div>

          {/* 소명서 7대 표 목록 (클릭 가능한 button으로 완벽 개편) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#1E3A5F] text-white">
                  <Table className="w-4 h-4" />
                </span>
                <span className="font-bold text-xs text-slate-900">
                  {caseType === 'bankruptcy' ? '파산관재인 5대 표준 소명서' : '회생위원 7대 법원 표준 소명서'}
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {hasDraft ? '보정 답변 초안 있음' : '작성 대기'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInlineFullEditor(true)}
                className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <FileEdit className="w-3.5 h-3.5 text-emerald-400" />
                <span>종합 보정 답변서 작성기 열기</span>
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sevenTables.map((tbl) => (
                  <button 
                    key={tbl.id} 
                    type="button"
                    onClick={() => setShowInlineFullEditor(true)}
                    className="p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs cursor-pointer bg-white hover:bg-blue-50/40 hover:border-blue-300 border-slate-200 text-left press-scale group"
                    title={`${tbl.title} 상세 작성 및 검토`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">
                          {tbl.code}
                        </span>
                        <span className="font-bold text-slate-900 truncate group-hover:text-[#1E3A5F] transition-colors">
                          {tbl.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {tbl.desc}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap bg-slate-50 text-slate-700 border-slate-200 group-hover:bg-[#1E3A5F] group-hover:text-white group-hover:border-[#1E3A5F] transition-all">
                      작성
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 인라인 종합 보정 답변서 모달 호스팅 */}
          {showInlineFullEditor && (
            <div className="bg-slate-50 rounded-2xl border border-slate-300 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#1E3A5F] text-white rounded-xl">
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {activeCorrectionRound}차 보정 답변서 및 7대 소명표 통합 편집기
                    </h4>
                    <p className="text-xs text-slate-500">
                      법원 보정권고 사항에 대한 답변과 7대 소명표 데이터를 실시간 편집하고 법원용 보정서를 생성합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInlineFullEditor(false)}
                  className="px-3 py-1.5 bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  편집기 접기
                </button>
              </div>

              {/* ComprehensiveCorrectionCenter 인라인 임베드 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <ComprehensiveCorrectionCenter
                  clientId={clientId}
                  clientRequest={clientRequest}
                  crmExt={crmExt || ({} as any)}
                  onUpdateCrmExt={onUpdateCrmExt || (async () => {})}
                  activeLawyerName={activeLawyerName}
                  onNavigateToRepayment={() => {
                    toast.info('변제계획안으로 이동합니다.');
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. 섹션 3: 결정 등록 (decision) ── */}
      {currentSection === 'decision' && (
        <div className="space-y-6">
          {/* 금지명령 심리 결과 등록 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">금지명령 및 중지명령 심리 결과 등록</h3>
                  <p className="text-xs text-slate-500">법원의 금지명령 발령 여부와 결정일자를 기록합니다.</p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                prohibitionStatus === 'granted'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {prohibitionStatus === 'granted' ? '✓ 발령 완료' : '심리 진행 중'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">금지명령 결과 *</label>
                <select
                  value={prohibitionStatus}
                  onChange={(e) => setProhibitionStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#1E3A5F]"
                >
                  <option value="pending">심리 중 (결정 대기)</option>
                  <option value="granted">발령 완료 (인용)</option>
                  <option value="rejected">기각</option>
                  <option value="dismissed">각하</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">결정 일자</label>
                <input
                  type="date"
                  value={prohibitionDate}
                  onChange={(e) => setProhibitionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white focus:ring-2 focus:ring-[#1E3A5F]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveProhibitionResult}
                  disabled={isSavingProhibition}
                  className="w-full py-2 bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer press-scale disabled:opacity-50"
                >
                  {isSavingProhibition ? '저장 중...' : '금지명령 결과 저장'}
                </button>
              </div>
            </div>
          </div>

          {/* 법원 개시결정 등록 카드 */}
          {showRegisterForm ? (
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">법원 개인회생 개시결정 정식 등록 & 6단계 승격</h3>
                    <p className="text-xs text-slate-500">
                      개시결정통지서 상의 결정일자, 법원 가상계좌, 1회차 납입일을 입력하면 6단계(변제·면책)로 사건이 정식 승격됩니다.
                    </p>
                  </div>
                </div>
                {isCommenced && (
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer self-start sm:self-auto"
                  >
                    닫기
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">법원 개시결정일 *</label>
                  <input
                    type="date"
                    value={commencementDate}
                    onChange={(e) => setCommencementDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">가상계좌 은행명 *</label>
                  <input
                    type="text"
                    value={virtualBank}
                    onChange={(e) => setVirtualBank(e.target.value)}
                    placeholder="예: 신한은행(법원보관금)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">법원 가상계좌번호 *</label>
                  <input
                    type="text"
                    value={virtualAccount}
                    onChange={(e) => setVirtualAccount(e.target.value)}
                    placeholder="예: 110-384-918231"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">1회차 변제금 납입기일 *</label>
                  <input
                    type="date"
                    value={firstPaymentDate}
                    onChange={(e) => setFirstPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">채권자집회 기일</label>
                  <input
                    type="date"
                    value={creditorMeetingDate}
                    onChange={(e) => setCreditorMeetingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">월 변제금 (원)</label>
                  <input
                    type="number"
                    value={monthlyPayment || ''}
                    onChange={(e) => setMonthlyPayment(Number(e.target.value) || 0)}
                    placeholder="예: 600000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                {isCommenced && (
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRegisterCommencement}
                  disabled={isRegistering}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>{isRegistering ? '등록 중...' : '개시결정 정식 등록 및 6단계 승격'}</span>
                </button>
              </div>
            </div>
          ) : isCommenced && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">🏛️ 인가된 법원 개시결정 핵심 요약</span>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer underline"
                >
                  결정일자 및 가상계좌 정보 재설정
                </button>
              </div>
              <DecisionSummaryCard
                clientName={clientName}
                data={crmExt?.decisionSummary}
                onSave={handleSaveDecisionSummary}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 5. 하단 단일 주 액션 바 (라이트 서페이스, AGENTS.md 준수) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sticky bottom-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isCommenced
              ? 'bg-emerald-600 text-white'
              : daysLeft !== null && daysLeft <= 3
              ? 'bg-rose-600 text-white'
              : 'bg-[#1E3A5F] text-white'
          }`}>
            {isCommenced ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">
                {isCommenced
                  ? '법원 개시결정 인가 완료'
                  : daysLeft !== null
                  ? `보정권고 대응 중 (${daysLeft >= 0 ? `D-${daysLeft}` : `기한경과 D+${Math.abs(daysLeft)}`})`
                  : '법원 심리 및 보정권고 관리'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                isCommenced
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : daysLeft !== null && daysLeft <= 3
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {isCommenced ? 'Stage 6 진행 가능' : 'Stage 5 진행 중'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCommenced
                ? '가상계좌와 1회차 납입일이 등록되었습니다. Stage 6에서 변제금 납부 및 채권자집회를 관리합니다.'
                : '보정기한 내에 7대 소명표를 작성하고 법원에 제출하거나, 개시결정 통지 수령 시 결정정보를 등록하세요.'}
            </p>
          </div>
        </div>

        {/* 주 액션 버튼 */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {renderPrimaryAction()}
        </div>
      </div>
    </div>
  );
}
