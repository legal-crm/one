import React, { useMemo, useState } from 'react';
import { RehabCompanionCase, RepaymentRoundItem, RepaymentVerificationStatus } from '../../../types';
import {
  Award, CheckCircle2, ChevronDown, ChevronRight, Circle, Copy, FileSpreadsheet, FileText, HeartHandshake,
  Layers, LifeBuoy, Pencil, Search, Users, CircleAlert, Wallet
} from 'lucide-react';
import { evaluateOverdueRisk, getEffectiveRoundStatus } from '../../../services/companionService';
import { updateCrmClientExtension } from '../../../services/crmService';
import { localYmd, parseLocalYmd } from '../../../utils/localDate';
import CourtCaseModal from './CourtCaseModal';
import OverdueDefenseGuideModal from './OverdueDefenseGuideModal';
import CreditorMeetingGuideModal from './CreditorMeetingGuideModal';
import BankStatementAuditModal from '../../common/BankStatementAuditModal';
import { getIncomeExpenseProgress, getPropertyProgress, getStatementProgress, loadLocalD5103 } from '../docDrafts';
import { Badge, Button, Callout } from '../ui';
import { cn } from '../../../utils/cn';
import { toast } from 'sonner';

const Fast2ndDocHubModal = React.lazy(() => import('../Fast2ndDocHubModal'));
const ClientStatementModal = React.lazy(() => import('../statement/ClientStatementModal'));
const ClientMonthlyIncomeExpenseModal = React.lazy(() => import('../incomeExpense/ClientMonthlyIncomeExpenseModal'));
const ClientPropertyIntakeModal = React.lazy(() => import('../property/ClientPropertyIntakeModal'));

interface CompanionDashboardProps {
  caseData: RehabCompanionCase;
  /** 마이김변 사건 연결 시 의뢰(consult request) ID — 면책신청 요청 등 CRM 기록용 */
  clientId?: string;
  onOpenPaymentModal: (roundItem: RepaymentRoundItem) => void;
  onOpenCrisisModal: () => void;
  onOpenRegisterModal: () => void;
  onUpdateCashflow: (updated: any) => void;
  onNavigateToSupport?: () => void;
}

const PAID_STATUSES: RepaymentVerificationStatus[] = ['court_confirmed', 'receipt_uploaded', 'self_marked'];
const isPaidRound = (s: RepaymentRoundItem) => PAID_STATUSES.includes(s.status);

// 상태 표시: 색만으로 구분하지 않도록 아이콘·글자를 함께 쓴다(이전: 🟢🔵🟡🔴⚪ 이모지 + 깜빡이는 빨간 칸)
const STATUS_META: Record<RepaymentVerificationStatus, { label: string; dot: string; tile: string }> = {
  court_confirmed: { label: '법원 확인', dot: 'bg-emerald-600', tile: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  receipt_uploaded: { label: '증빙 첨부', dot: 'bg-blue-600', tile: 'border-blue-200 bg-blue-50 text-blue-900' },
  self_marked: { label: '직접 표시', dot: 'bg-amber-500', tile: 'border-amber-200 bg-amber-50 text-amber-900' },
  overdue_check_needed: { label: '기록 없음', dot: 'bg-red-600', tile: 'border-red-200 bg-red-50 text-red-900' },
  pending: { label: '예정', dot: 'bg-slate-300', tile: 'border-slate-200 bg-white text-slate-700' },
};
const LEGEND_ORDER: RepaymentVerificationStatus[] = ['court_confirmed', 'receipt_uploaded', 'self_marked', 'overdue_check_needed', 'pending'];

const STAGE_LABEL: Record<string, string> = {
  preparing: '신청 준비',
  submitted: '접수·서류 검토',
  correction: '보정 진행',
  started: '개시결정',
  approved: '변제계획 인가',
  completed: '변제 완료',
};

const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;
/** 'YYYY-MM-DD' → 'M월 D일' */
const monthDay = (ymd?: string) => (ymd && ymd.length >= 10 ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '');
/** 오늘(로컬 자정) 기준 남은 날 수 */
const daysUntil = (ymd?: string) => {
  const due = parseLocalYmd(ymd || '');
  if (!due) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
};
const ddayText = (d: number) => (Number.isNaN(d) ? '' : d > 0 ? `D-${d}` : d === 0 ? '오늘 납부일' : `${-d}일 지남`);

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'brand' | 'success' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'brand' ? 'border-brand/20 bg-brand-light/60' : tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      )}
    >
      <dt className="text-xs font-bold text-slate-600">{label}</dt>
      <dd className={cn('mt-0.5 text-base font-extrabold tabular-nums', tone === 'brand' ? 'text-brand' : tone === 'success' ? 'text-emerald-800' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

function RoundTile({ item, onOpen }: { item: RepaymentRoundItem; onOpen: (item: RepaymentRoundItem) => void }) {
  const eff = getEffectiveRoundStatus(item);
  const meta = STATUS_META[eff];
  const Icon = PAID_STATUSES.includes(eff) ? CheckCircle2 : eff === 'overdue_check_needed' ? CircleAlert : Circle;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.round}회차 ${monthDay(item.dueDate)} ${meta.label}`}
      className={cn(
        'w-full min-h-16 rounded-xl border px-1 py-2 flex flex-col items-center justify-center gap-0.5 text-center transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        meta.tile
      )}
    >
      <span className="text-xs font-bold">{item.round}회</span>
      <span className="text-xs tabular-nums opacity-80">{Number(item.dueDate.slice(5, 7))}월</span>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  );
}

export default function CompanionDashboard({
  caseData,
  clientId,
  onOpenPaymentModal,
  onOpenCrisisModal,
  onOpenRegisterModal,
  onNavigateToSupport
}: CompanionDashboardProps) {
  const schedules = Array.isArray(caseData?.schedules) ? caseData.schedules : [];
  const documents = Array.isArray(caseData?.documents) ? caseData.documents : [];
  const today = localYmd();
  const thisMonth = today.slice(0, 7);

  // ── 진행 통계 ──
  const totalRounds = caseData?.totalRounds || schedules.length || 0;
  const completedCount = schedules.filter(isPaidRound).length;
  const progressPercent = totalRounds > 0 ? Math.round((completedCount / totalRounds) * 1000) / 10 : 0;
  const allDone = totalRounds > 0 && completedCount >= totalRounds;
  const monthlyRepaymentAmount = caseData?.monthlyRepaymentAmount || 0;
  const totalScheduledAmount = schedules.length > 0
    ? schedules.reduce((sum, s) => sum + (s.scheduledAmount || 0), 0)
    : totalRounds * monthlyRepaymentAmount;
  const totalRecordedAmount = schedules.filter(isPaidRound).reduce((sum, s) => sum + (s.actualPaidAmount ?? s.scheduledAmount ?? 0), 0);
  const totalRemainingAmount = Math.max(0, totalScheduledAmount - totalRecordedAmount);

  const legendCount = useMemo(() => {
    const c: Record<RepaymentVerificationStatus, number> = { court_confirmed: 0, receipt_uploaded: 0, self_marked: 0, overdue_check_needed: 0, pending: 0 };
    schedules.forEach(s => { c[getEffectiveRoundStatus(s)] += 1; });
    return c;
  }, [schedules]);

  // ── 이번 달 할 일: 달력상 이번 달 회차 → 다가오는 회차 → 기록 없는 지난 회차 순으로 고른다 ──
  // (이전: '아직 납부 표시가 없는 첫 회차'를 이번 달로 보여 지난 회차가 이번 달처럼 보이고, 모두 내면 마지막 회차에 '납부일 지남' 표시)
  const overdueRounds = schedules.filter(s => getEffectiveRoundStatus(s) === 'overdue_check_needed');
  const thisMonthRound = schedules.find(s => (s.dueDate || '').slice(0, 7) === thisMonth);
  const nextUpcoming = schedules.find(s => !isPaidRound(s) && (s.dueDate || '') >= today);
  const focusRound = thisMonthRound || nextUpcoming || overdueRounds[0] || null;
  const focusPaid = !!focusRound && isPaidRound(focusRound);
  const focusDays = daysUntil(focusRound?.dueDate);
  const focusAmount = focusRound?.scheduledAmount || monthlyRepaymentAmount;
  const nextAfterFocus = focusRound
    ? schedules.find(s => !isPaidRound(s) && (s.dueDate || '') > (focusRound.dueDate || ''))
    : undefined;
  const upcomingRounds = [...overdueRounds, ...schedules.filter(s => !isPaidRound(s) && (s.dueDate || '') >= today)].slice(0, 3);

  // 연도별 회차(모바일은 접어 두고, 데스크톱은 펼쳐 둔다)
  const roundsByYear = useMemo(() => {
    const map = new Map<string, RepaymentRoundItem[]>();
    schedules.forEach(s => {
      const y = (s.dueDate || '').slice(0, 4) || '미정';
      map.set(y, [...(map.get(y) || []), s]);
    });
    return [...map.entries()];
  }, [schedules]);

  // ── 생활비 점검(입력하지 않은 값은 0 — 임의 소득·생계비로 흑자/적자를 판정하지 않는다) ──
  const cashflow = caseData?.cashflow || { monthlyIncome: 0, essentialLivingCost: 0, repaymentAmount: monthlyRepaymentAmount, otherFixedExpenses: 0 };
  const monthlyIncome = cashflow.monthlyIncome || 0;
  const essentialLivingCost = cashflow.essentialLivingCost || 0;
  const repaymentAmount = cashflow.repaymentAmount || monthlyRepaymentAmount;
  const otherFixedExpenses = cashflow.otherFixedExpenses || 0;
  const hasCashflowInput = monthlyIncome > 0;
  const expectedSurplus = monthlyIncome - (essentialLivingCost + repaymentAmount + otherFixedExpenses);

  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [isDefenseGuideModalOpen, setIsDefenseGuideModalOpen] = useState(false);
  const [isBankAuditModalOpen, setIsBankAuditModalOpen] = useState(false);
  const [isCreditorMeetingModalOpen, setIsCreditorMeetingModalOpen] = useState(false);
  const [isDischargeRequested, setIsDischargeRequested] = useState(false);
  const [showAllRounds, setShowAllRounds] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);

  // 서류 준비 허브 및 서류 모달 상태
  const [isDocHubOpen, setIsDocHubOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isIncomeExpenseModalOpen, setIsIncomeExpenseModalOpen] = useState(false);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  // 서류 실제 작성 상태 (모달이 닫힐 때마다 다시 읽음)
  const docClientId = caseData?.id || 'client-self';
  const docStatus = useMemo(() => ({
    statement: getStatementProgress(docClientId),
    incomeExpense: getIncomeExpenseProgress(loadLocalD5103(docClientId)),
    property: getPropertyProgress(docClientId, caseData?.alias),
  }), [docClientId, caseData?.alias, isStatementModalOpen, isIncomeExpenseModalOpen, isPropertyModalOpen, isDocHubOpen]);
  // 이 기기에 저장해 둔 수지표(연동 대상이 없는 회생동행 사건) — 모달을 열 때 한 번만 읽는다
  const localD5103 = useMemo(
    () => (isIncomeExpenseModalOpen ? loadLocalD5103(docClientId) : null),
    [isIncomeExpenseModalOpen, docClientId],
  );

  // 미납 참고 기준(법원별 일반 경향 — 실제 판단은 재판부)
  const overdueRisk = evaluateOverdueRisk(caseData || ({ schedules: [] } as any));

  const handleOpenCourtSearch = () => setIsCourtModalOpen(true);

  const handleCopyAccount = () => {
    const account = caseData.courtVirtualAccount;
    if (!account) return;
    if (!navigator?.clipboard) {
      toast.error('자동 복사가 되지 않아요. 계좌번호를 길게 눌러 복사해 주세요.');
      return;
    }
    navigator.clipboard
      .writeText(account)
      .then(() => toast.success('법원 가상계좌를 복사했어요.'))
      .catch(() => toast.error('복사하지 못했어요. 계좌번호를 길게 눌러 복사해 주세요.'));
  };

  const handleDischargeRequest = async () => {
    // 마이김변 변호사 사건: CRM에 요청 시각을 기록해 담당 변호사가 확인 / 그 외: 사실대로 안내
    if (caseData.sourceType === 'mykim_lawyer' && clientId) {
      const ok = await updateCrmClientExtension(clientId, { dischargeRequestedAt: new Date().toISOString() });
      if (!ok) {
        toast.error('요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setIsDischargeRequested(true);
      toast.success('면책신청 요청을 담당 변호사에게 전달했습니다. 접수 일정은 변호사가 안내해 드립니다.');
    } else {
      toast.info(
        caseData.sourceType === 'external_office'
          ? '진행 중인 법률사무소에 면책신청 진행을 직접 요청해 주세요.'
          : '면책신청은 관할 법원에 직접 제출합니다. [회복 아카데미]에서 서식을 내려받을 수 있습니다.',
        { duration: 5000 }
      );
    }
  };

  const sourceLabel =
    caseData.sourceType === 'external_office'
      ? (caseData.externalOfficeName ? `${caseData.externalOfficeName} 진행` : '다른 법률사무소 진행')
      : caseData.sourceType === 'self_litigant'
        ? '직접 진행'
        : '마이김변 담당 변호사';

  // ── 도구와 안내: 사건 단계에 맞는 도구를 앞에 둔다 ──
  type ToolId = 'docs' | 'audit' | 'overdue' | 'meeting' | 'court' | 'support';
  const toolDefs: Record<ToolId, { icon: React.ReactNode; title: string; desc: string; onClick: () => void } | null> = {
    docs: { icon: <Layers className="w-5 h-5" />, title: '회생 서류 준비', desc: '진술서·수지표·재산 기초자료 초안을 만들고 담당자에게 보내요', onClick: () => setIsDocHubOpen(true) },
    audit: { icon: <FileSpreadsheet className="w-5 h-5" />, title: '통장·카드 거래 소명', desc: '큰 금액 거래의 사용처를 정리해 법원 제출 양식으로 만들어요', onClick: () => setIsBankAuditModalOpen(true) },
    overdue: { icon: <LifeBuoy className="w-5 h-5" />, title: '변제금이 밀렸을 때', desc: '분납·변제계획 변경 등 대처 방법을 알려 드려요', onClick: () => setIsDefenseGuideModalOpen(true) },
    meeting: { icon: <Users className="w-5 h-5" />, title: '채권자집회 안내', desc: '출석 전에 준비할 것과 진행 순서', onClick: () => setIsCreditorMeetingModalOpen(true) },
    court: { icon: <Search className="w-5 h-5" />, title: '대법원 사건검색', desc: '법원 사이트에서 내 사건 진행을 확인하는 방법', onClick: handleOpenCourtSearch },
    support: onNavigateToSupport
      ? { icon: <HeartHandshake className="w-5 h-5" />, title: '공적 지원 제도', desc: '생계·주거·금융 지원 제도를 찾아봐요', onClick: onNavigateToSupport }
      : null,
  };
  const toolOrder: ToolId[] =
    caseData.caseStage === 'submitted' || caseData.caseStage === 'correction' || caseData.caseStage === 'preparing'
      ? ['audit', 'docs', 'court', 'meeting', 'overdue', 'support']
      : caseData.caseStage === 'started'
        ? ['meeting', 'docs', 'audit', 'court', 'overdue', 'support']
        : ['overdue', 'court', 'support', 'docs', 'audit', 'meeting'];
  const tools = toolOrder.map(id => ({ id, def: toolDefs[id] })).filter(t => !!t.def) as { id: ToolId; def: NonNullable<(typeof toolDefs)[ToolId]> }[];
  const TOOL_PREVIEW = 4;
  const visibleTools = showAllTools ? tools : tools.slice(0, TOOL_PREVIEW);

  // ── 이번 달 카드 문구 ──
  let headline = '';
  let subline = '';
  let statusBadge: React.ReactNode = null;
  if (allDone) {
    headline = '모든 회차의 납부 기록이 등록됐어요';
    subline = `변제를 마치면 법원이 면책 여부를 결정합니다(채무자회생법 제624조). 면책신청서 제출이 필요한지, 법원 기록상 완납이 확인되는지 담당 변호사 또는 법원에 확인해 주세요.${legendCount.self_marked > 0 ? ' 직접 표시한 회차는 법원 확인 전 기록이에요.' : ''}`;
    statusBadge = <Badge tone="success" icon={<Award className="w-3.5 h-3.5" aria-hidden="true" />}>{totalRounds}회차 기록 완료</Badge>;
  } else if (!focusRound) {
    headline = '납부 일정이 아직 없어요';
    subline = '변제 조건(월 변제금·납부일·회차)을 입력하면 매달 납부일과 금액을 알려 드려요.';
  } else if (focusPaid) {
    headline = `${Number(focusRound.dueDate.slice(5, 7))}월 변제금 납부를 기록했어요`;
    subline = `${focusRound.round}회차 · ${STATUS_META[focusRound.status].label}${focusRound.paidDate ? ` · ${monthDay(focusRound.paidDate)} 납부` : ''}`;
    statusBadge = <Badge tone="success" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>기록 완료</Badge>;
  } else {
    headline = `${monthDay(focusRound.dueDate)}까지 ${won(focusAmount)}`;
    subline = `${focusRound.round}회차 변제금${caseData.courtVirtualAccount ? ' · 법원 가상계좌로 납부해요' : ''}`;
    statusBadge = (
      <Badge tone={focusDays < 0 ? 'warning' : focusDays === 0 ? 'warning' : 'brand'} size="md">
        {ddayText(focusDays)}
      </Badge>
    );
  }

  return (
    <div className="space-y-5 text-left">

      {/* ═══ 1. 이번 달 할 일 (가장 위) ═══ */}
      <section aria-labelledby="companion-this-month" className="rounded-3xl border-2 border-brand/15 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand">이번 달 할 일</p>
            <h2 id="companion-this-month" className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums break-keep">
              {headline}
            </h2>
            {subline && <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">{subline}</p>}
          </div>
          {statusBadge}
        </div>

        {/* 법원 가상계좌 */}
        {!allDone && focusRound && caseData.courtVirtualAccount && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                법원 가상계좌
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums break-all select-all">{caseData.courtVirtualAccount}</p>
            </div>
            <Button variant="secondary" onClick={handleCopyAccount} leftIcon={<Copy className="w-4 h-4" aria-hidden="true" />} className="shrink-0">
              복사
            </Button>
          </div>
        )}

        {/* 이번 달을 기록했으면 다음 납부 안내 */}
        {!allDone && focusPaid && nextAfterFocus && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 tabular-nums">
            다음 납부: <b className="text-slate-900">{monthDay(nextAfterFocus.dueDate)}</b> · {won(nextAfterFocus.scheduledAmount || monthlyRepaymentAmount)}
            {!Number.isNaN(daysUntil(nextAfterFocus.dueDate)) && <span className="text-slate-600"> ({ddayText(daysUntil(nextAfterFocus.dueDate))})</span>}
          </p>
        )}

        {/* 기록 없는 지난 회차 — 겁주기보다 할 일을 알려 준다 */}
        {!allDone && overdueRounds.length > 0 && (
          <Callout
            tone="warning"
            title={`납부 기록이 없는 지난 회차가 ${overdueRounds.length}건 있어요`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onOpenPaymentModal(overdueRounds[0])}>
                  {overdueRounds[0].round}회차 기록하기
                </Button>
                <Button variant="ghost" onClick={() => setIsDefenseGuideModalOpen(true)}>
                  밀렸을 때 대처 방법
                </Button>
              </div>
            }
          >
            이미 냈다면 회차를 눌러 기록을 남겨 주세요. 납부가 어려웠다면 미납이 쌓이기 전에 담당 변호사와 상의하는 것이 좋아요.
            {caseData.courtName && overdueRisk.courtThreshold?.repealRiskRounds ? (
              <span className="mt-1 block text-xs">
                참고: {overdueRisk.courtThreshold.courtName}의 일반적인 경향으로는 미납 {overdueRisk.courtThreshold.repealRiskRounds}회 안팎부터 폐지를 검토할 수 있어요. 실제 판단은 재판부가 합니다.
              </span>
            ) : null}
          </Callout>
        )}

        {/* 행동 버튼(주 버튼은 하나) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {allDone ? (
            <Button
              onClick={handleDischargeRequest}
              disabled={isDischargeRequested}
              leftIcon={<Award className="w-4 h-4" aria-hidden="true" />}
              className="w-full sm:w-auto"
            >
              {isDischargeRequested
                ? '면책신청 요청을 보냈어요'
                : caseData.sourceType === 'mykim_lawyer' ? '담당 변호사에게 면책신청 요청' : '면책신청 방법 안내'}
            </Button>
          ) : !focusRound ? (
            <Button onClick={onOpenRegisterModal} leftIcon={<Pencil className="w-4 h-4" aria-hidden="true" />} className="w-full sm:w-auto">
              변제 조건 입력하기
            </Button>
          ) : focusPaid ? (
            <Button variant="secondary" onClick={() => onOpenPaymentModal(focusRound)} className="w-full sm:w-auto">
              기록 보기·고치기
            </Button>
          ) : (
            <Button onClick={() => onOpenPaymentModal(focusRound)} leftIcon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />} className="w-full sm:w-auto">
              납부 기록하기
            </Button>
          )}
          {!allDone && focusRound && (
            <Button variant="ghost" onClick={onOpenCrisisModal} leftIcon={<LifeBuoy className="w-4 h-4" aria-hidden="true" />} className="w-full sm:w-auto">
              이번 달 납부가 어려워요
            </Button>
          )}
        </div>
        {!allDone && focusRound && (
          <p className="text-xs text-slate-600 leading-relaxed">
            기록은 이 기기에 저장되는 개인 기록이에요. 법원의 공식 변제 현황과 다를 수 있어요.
          </p>
        )}
      </section>

      {/* ═══ 2. 사건 요약 · 변제 진행 ═══ */}
      <section aria-labelledby="companion-progress" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h2 id="companion-progress" className="text-lg font-bold text-slate-900 break-keep">
              {caseData.alias} 님의 변제 진행
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="brand">{sourceLabel}</Badge>
              {caseData.courtName && <Badge tone="neutral">{caseData.courtName}</Badge>}
              {caseData.caseNumberMasked && <Badge tone="neutral">사건번호 {caseData.caseNumberMasked}</Badge>}
              {caseData.caseStage && (
                <Badge tone={caseData.caseStage === 'approved' || caseData.caseStage === 'completed' ? 'success' : 'neutral'}>
                  {STAGE_LABEL[caseData.caseStage] || '진행 중'}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={onOpenRegisterModal} leftIcon={<Pencil className="w-4 h-4" aria-hidden="true" />} className="self-start shrink-0">
            사건 정보 변경
          </Button>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-slate-700 tabular-nums">
              납부 기록 {completedCount}/{totalRounds}회
            </p>
            <p className="text-2xl font-extrabold text-brand tabular-nums">{progressPercent}%</p>
          </div>
          <div
            className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-label="변제 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.min(100, progressPercent)}%` }} />
          </div>
          {totalRounds > 0 && (
            <div className="mt-1.5 flex justify-between text-xs text-slate-600 tabular-nums">
              <span>1회차</span>
              {totalRounds >= 4 && <span>{Math.ceil(totalRounds / 2)}회차</span>}
              <span>{totalRounds}회차</span>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Stat label="총 변제 예정액" value={won(totalScheduledAmount)} />
          <Stat label="납부 기록 합계" value={won(totalRecordedAmount)} tone="success" />
          <Stat label="남은 금액" value={won(totalRemainingAmount)} />
        </dl>
        <p className="text-xs text-slate-600 leading-relaxed">직접 남긴 기록을 바탕으로 계산했어요. 법원 공식 변제 현황과 다를 수 있어요.</p>
      </section>

      {/* ═══ 3. 회차별 납부 일정 (모바일: 다가오는 3회차 + 연도별 펼치기) ═══ */}
      <section aria-labelledby="companion-schedule" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div>
            <h2 id="companion-schedule" className="text-lg font-bold text-slate-900">회차별 납부 일정</h2>
            <p className="mt-0.5 text-sm text-slate-600">회차를 누르면 납부 기록을 남기거나 고칠 수 있어요.</p>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-bold text-slate-700" aria-label="상태 표시">
            {LEGEND_ORDER.filter(k => k !== 'overdue_check_needed' || legendCount[k] > 0).map(k => (
              <li key={k} className="inline-flex items-center gap-1.5 tabular-nums">
                <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_META[k].dot)} aria-hidden="true" />
                {STATUS_META[k].label} {legendCount[k]}
              </li>
            ))}
          </ul>
        </div>

        {schedules.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            등록된 납부 일정이 없어요. 변제 조건을 입력하면 회차별 일정이 만들어져요.
          </p>
        ) : (
          <>
            <ol className="md:hidden space-y-2" aria-label="다가오는 회차">
              {upcomingRounds.length === 0 ? (
                <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">남은 회차가 없어요.</li>
              ) : (
                upcomingRounds.map(item => {
                  const eff = getEffectiveRoundStatus(item);
                  return (
                    <li key={item.round}>
                      <button
                        type="button"
                        onClick={() => onOpenPaymentModal(item)}
                        className="w-full min-h-14 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-brand transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-900 tabular-nums">
                            {item.round}회차 · {monthDay(item.dueDate)}
                          </span>
                          <span className="block text-xs text-slate-600 tabular-nums">{won(item.scheduledAmount || monthlyRepaymentAmount)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
                          <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_META[eff].dot)} aria-hidden="true" />
                          {STATUS_META[eff].label}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ol>

            <Button
              variant="secondary"
              fullWidth
              className="md:hidden"
              aria-expanded={showAllRounds}
              aria-controls="companion-all-rounds"
              onClick={() => setShowAllRounds(v => !v)}
              rightIcon={<ChevronDown className={cn('w-4 h-4 transition-transform', showAllRounds && 'rotate-180')} aria-hidden="true" />}
            >
              {showAllRounds ? '전체 회차 접기' : `전체 ${schedules.length}회차 보기`}
            </Button>

            <div id="companion-all-rounds" className={cn(showAllRounds ? 'block' : 'hidden', 'md:block space-y-4')}>
              {roundsByYear.map(([year, items]) => (
                <div key={year} className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-800">{year}년</h3>
                  <ul className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                    {items.map(item => (
                      <li key={item.round}>
                        <RoundTile item={item} onOpen={onOpenPaymentModal} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ═══ 4. 이번 달 생활비 점검 ═══ */}
      <section aria-labelledby="companion-cashflow" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="companion-cashflow" className="text-lg font-bold text-slate-900">이번 달 생활비 점검</h2>
            <p className="mt-0.5 text-sm text-slate-600">월 소득에서 생계비와 변제금을 빼고 남는 돈을 살펴봐요.</p>
          </div>
          <Badge tone={!hasCashflowInput ? 'neutral' : expectedSurplus >= 0 ? 'success' : 'warning'}>
            {!hasCashflowInput ? '소득 미입력' : expectedSurplus >= 0 ? '이번 달 여유 있음' : '이번 달 부족 예상'}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Stat label="월 실수령 소득" value={won(monthlyIncome)} />
          <Stat label="필수 생계비" value={`- ${won(essentialLivingCost)}`} />
          <Stat label="월 변제금" value={`- ${won(repaymentAmount)}`} tone="brand" />
          <Stat label="기타 고정지출" value={`- ${won(otherFixedExpenses)}`} />
        </dl>

        {hasCashflowInput && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3',
              expectedSurplus >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            )}
          >
            <span className="text-sm font-bold text-slate-800">예상 남는 돈</span>
            <span className={cn('text-lg font-extrabold tabular-nums', expectedSurplus >= 0 ? 'text-emerald-800' : 'text-amber-900')}>
              {expectedSurplus >= 0 ? '+' : ''}
              {expectedSurplus.toLocaleString('ko-KR')}원
            </span>
          </div>
        )}

        {!hasCashflowInput ? (
          <Callout tone="neutral">
            월 소득과 생계비를 입력하지 않아 남는 돈을 계산하지 않았어요. [사건 정보 변경]에서 입력하면 이번 달 여유자금을 볼 수 있어요.
          </Callout>
        ) : expectedSurplus < 0 ? (
          <Callout
            tone="warning"
            title="이번 달 생활비가 빠듯할 수 있어요"
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={onOpenCrisisModal} leftIcon={<LifeBuoy className="w-4 h-4" aria-hidden="true" />}>
                  상담·지원 요청하기
                </Button>
                {onNavigateToSupport && (
                  <Button variant="ghost" onClick={onNavigateToSupport}>
                    지원 제도 보기
                  </Button>
                )}
              </div>
            }
          >
            입력한 금액으로는 {Math.abs(expectedSurplus).toLocaleString('ko-KR')}원이 부족해요. 혼자 버티기보다 담당 변호사와 변제계획 변경을 상의하거나 긴급 생계 지원을 알아보세요.
          </Callout>
        ) : null}
      </section>

      {/* ═══ 5. 도구와 안내 (이전: 큰 배너 5개가 이번 달 정보보다 위에 있었음) ═══ */}
      <section aria-labelledby="companion-tools" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
        <h2 id="companion-tools" className="text-lg font-bold text-slate-900">도구와 안내</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visibleTools.map(({ id, def }) => (
            <li key={id}>
              <button
                type="button"
                onClick={def.onClick}
                className="w-full min-h-16 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-brand transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                  {def.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{def.title}</span>
                  <span className="block text-xs text-slate-600 leading-relaxed break-keep">{def.desc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {tools.length > TOOL_PREVIEW && (
          <Button
            variant="ghost"
            onClick={() => setShowAllTools(v => !v)}
            aria-expanded={showAllTools}
            rightIcon={<ChevronDown className={cn('w-4 h-4 transition-transform', showAllTools && 'rotate-180')} aria-hidden="true" />}
          >
            {showAllTools ? '접기' : `도구 ${tools.length - TOOL_PREVIEW}개 더 보기`}
          </Button>
        )}
      </section>

      {/* ═══ 6. 서류 보관함 ═══ */}
      <section aria-labelledby="companion-docs" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="companion-docs" className="text-lg font-bold text-slate-900">서류 보관함</h2>
            <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">
              등록한 서류 목록이에요. 이 기기(브라우저)에만 저장되고 담당 사무소로 자동 전송되지 않아요.
            </p>
          </div>
          <Badge tone="neutral">{documents.length}개</Badge>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
            등록한 서류가 없어요.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{new Date(doc.uploadedAt).toLocaleDateString('ko-KR')} 등록</p>
                  </div>
                </div>
                {doc.dataUrl ? (
                  <a
                    href={doc.dataUrl}
                    download={doc.name}
                    className="w-full min-h-11 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:border-brand hover:text-brand transition-colors"
                  >
                    내려받기<span className="sr-only">: {doc.name}</span>
                  </a>
                ) : (
                  <span className="text-xs text-slate-600">파일 원본은 저장되지 않았습니다.</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 대법원 사건 조회 안내 모달 */}
      <CourtCaseModal
        isOpen={isCourtModalOpen}
        onClose={() => setIsCourtModalOpen(false)}
        courtName={caseData.courtName}
        caseNumber={caseData.caseNumber}
        clientName={caseData.alias}
      />

      {/* 변제금 미납 대처 안내 모달 */}
      <OverdueDefenseGuideModal
        isOpen={isDefenseGuideModalOpen}
        onClose={() => setIsDefenseGuideModalOpen(false)}
        caseData={caseData}
        onOpenCrisisModal={onOpenCrisisModal}
      />

      {/* 통장·카드 거래내역 소명 모달 */}
      <BankStatementAuditModal
        isOpen={isBankAuditModalOpen}
        onClose={() => setIsBankAuditModalOpen(false)}
        clientName={caseData.alias}
        caseNumber={caseData.caseNumber}
        courtName={caseData.courtName}
        isClientMode={true}
      />

      {/* 채권자집회 안내 모달 */}
      <CreditorMeetingGuideModal
        isOpen={isCreditorMeetingModalOpen}
        onClose={() => setIsCreditorMeetingModalOpen(false)}
        courtName={caseData.courtName}
        caseNumber={caseData.caseNumber}
      />

      {/* 서류 준비 허브 */}
      {isDocHubOpen && (
        <React.Suspense fallback={null}>
          <Fast2ndDocHubModal
            isOpen={isDocHubOpen}
            onClose={() => setIsDocHubOpen(false)}
            clientName={caseData.alias || '신청인'}
            clientId={caseData.id || 'client-self'}
            // 작성 여부는 저장된 실제 상태로만 판단(제출 완료일 때만 '완료'). 추정 수치는 넘기지 않는다
            hasStatement={docStatus.statement === 'submitted'}
            hasIncomeExpense={docStatus.incomeExpense === 'submitted'}
            hasProperty={docStatus.property === 'submitted'}
            onOpenStatementModal={() => setIsStatementModalOpen(true)}
            onOpenIncomeExpenseModal={() => setIsIncomeExpenseModalOpen(true)}
            onOpenPropertyModal={() => setIsPropertyModalOpen(true)}
          />
        </React.Suspense>
      )}

      {/* 진술서 작성 모달 */}
      {isStatementModalOpen && (
        <React.Suspense fallback={null}>
          <ClientStatementModal
            isOpen={isStatementModalOpen}
            onClose={() => setIsStatementModalOpen(false)}
            clientId={caseData.id || 'client-self'}
            clientName={caseData.alias || '신청인'}
            courtName={caseData.courtName || ''}
          />
        </React.Suspense>
      )}

      {/* 수지표 작성 모달 */}
      {isIncomeExpenseModalOpen && (
        <React.Suspense fallback={null}>
          <ClientMonthlyIncomeExpenseModal
            isOpen={isIncomeExpenseModalOpen}
            onClose={() => setIsIncomeExpenseModalOpen(false)}
            clientId={caseData.id || 'client-self'}
            clientName={caseData.alias || '신청인'}
            // 변호사 CRM 연동이 없는 사건: 모달이 이 기기에 저장하고, 다시 열면 저장본을 불러온다
            initialD5103={localD5103}
          />
        </React.Suspense>
      )}

      {/* 재산 기초자료 작성 모달 */}
      {isPropertyModalOpen && (
        <React.Suspense fallback={null}>
          <ClientPropertyIntakeModal
            isOpen={isPropertyModalOpen}
            onClose={() => setIsPropertyModalOpen(false)}
            clientId={caseData.id || 'client-self'}
            clientName={caseData.alias || '신청인'}
          />
        </React.Suspense>
      )}
    </div>
  );
}
