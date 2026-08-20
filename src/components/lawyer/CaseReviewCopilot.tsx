import React, { useState, useMemo, useCallback, Suspense } from 'react';
import {
  AlertTriangle, FileText, DollarSign, AlertCircle, Scale, StickyNote,
  Gavel, Send, History, ChevronRight, CheckCircle2, XCircle, Clock,
  Search, RefreshCw, Eye, ShieldCheck, FileWarning, Info, Loader2, Settings, MessageSquare, Microscope
} from 'lucide-react';
import { runFactEngine, type FactEngineOutput } from '../../engines/factEngine';
import { runReviewRuleEngine, DEFAULT_REVIEW_RULES, type ReviewRuleEngineOutput } from '../../engines/reviewRuleEngine';
import { useCopilotPermissions } from '../../hooks/useCopilotPermissions';
import type {
  CaseReviewStatus, ReviewFlag, LawyerOpinion as LawyerOpinionType,
  ReviewRuleSet, CourtPracticeNote, CopilotAuditLog,
  ReviewFlagType, RuleSourceType
} from '../../types/copilot';
import {
  CASE_REVIEW_STATUS_CONFIG, FLAG_TYPE_CONFIG, RULE_SOURCE_TYPE_CONFIG
} from '../../types/copilot';
import type { IntakeData, StaffRole } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import CopilotRuleSetManager from './CopilotRuleSetManager';
import ConsultStyleProfileSettings from './ConsultStyleProfile';
import { calculateRepayment, type RehabUserInput, type RehabCalculationResult, formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
const RehabResultReport = React.lazy(() => import('../../rehab-chatbot-package/components/rehab/RehabResultReport'));
import LawyerProposalDraft from './LawyerProposalDraft';
import { mapToRehabUserInput } from './mapToRehabUserInput';

// ============================================================
// 사건검토 코파일럿 메인 컴포넌트
// ============================================================

interface CaseReviewCopilotProps {
  consultRequest?: any;
  consultRequests?: any[];
  tenantId: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  preselectedRequestId?: string;
  onClose?: () => void;
  onProposalSent?: (reqId: string, proposalData: any) => void;
}

// Sample test clients for demo
const SAMPLE_CLIENTS: any[] = [
  {
    id: 'sample-1', clientName: '김영희', phone: '010-1234-5678', status: 'counseling',
    consultType: 'direct_multi', createdAt: '2026-08-10T09:00:00Z',
    financialProfile: {
      clientName: '김영희', clientPhone: '010-1234-5678',
      age: 42, gender: 'female' as const,
      income: 280, debtTotal: 12000, assetsTotal: 500,
      dependents: 2, minorChildren: 1,
      maritalStatus: 'MARRIED',
      jobType: 'SALARIED', companyNameMasked: 'OO전자', employmentDate: '2018-03-01',
      residenceRegion: '서울특별시 강남구', address: '서울특별시 강남구 역삼동',
      workLocation: '서울특별시 서초구',
      hasRecentJobChange: false,
      spouseIncome: 0, spouseAsset: 150,
      housingType: 'jeonse' as const, housingContractHolder: 'self' as const,
      rentalDeposit: 15000, depositLoan: 5000,
      retirementPay: 2400, retirementPensionType: 'pension' as const,
      myAssets: 200,
      debtTypes: { banks: 4500, cards: 4300, personals: 3200, recentLoans: 0, coinCrypto: 0 },
      debtCause: 'LIVING',
      harassmentLevel: 'CALL',
      creditorCount: 4,
      priorityDebt: 0,
      speculativeLoss: 0, gamblingLoss: 0,
      legalActions: ['collection_call'],
      rentCost: 0, medicalCost: 5, educationCost: 30, specialEducationCost: 0,
      monthlyFixedExpenses: 25, monthlyExpense: 180,
      specialCondition: 'none',
      clientNote: '아이 학비 때문에 대출이 늘었습니다. 남편은 실직 상태입니다.',
      riskFlags: [],
      debts: [
        { creditor: '신한은행', principal: 4500, interest: 320, type: 'unsecured' },
        { creditor: 'KB카드', principal: 2800, interest: 180, type: 'unsecured' },
        { creditor: '삼성카드', principal: 1500, interest: 95, type: 'unsecured' },
        { creditor: '현대캐피탈', principal: 3200, interest: 250, type: 'unsecured' },
      ],
      assets: [
        { type: 'deposit', label: '전세보증금', marketValue: 15000 },
        { type: 'insurance', label: '보험 해약금', marketValue: 300, isExempt: true },
      ],
    },
  },
  {
    id: 'sample-2', clientName: '박준혁', phone: '010-9876-5432', status: 'counseling',
    consultType: 'ai_chat', createdAt: '2026-08-12T14:30:00Z',
    financialProfile: {
      clientName: '박준혁', clientPhone: '010-9876-5432',
      age: 35, gender: 'male' as const,
      income: 180, debtTotal: 25000, assetsTotal: 0,
      dependents: 0, minorChildren: 0,
      maritalStatus: 'SINGLE',
      jobType: 'FREELANCER', companyNameMasked: '프리랜서',
      residenceRegion: '경기도 수원시', address: '경기도 수원시 영통구',
      workLocation: '재택근무',
      hasRecentJobChange: true,
      spouseIncome: 0, spouseAsset: 0,
      housingType: 'rent' as const, housingContractHolder: 'self' as const,
      rentalDeposit: 1000, depositLoan: 0,
      retirementPay: 0, retirementPensionType: 'none' as const,
      myAssets: 0,
      debtTypes: { banks: 13000, cards: 4000, personals: 3000, recentLoans: 3000, coinCrypto: 5000 },
      debtCause: 'INVESTMENT',
      harassmentLevel: 'SEIZURE',
      creditorCount: 6,
      priorityDebt: 2000,
      speculativeLoss: 3500, gamblingLoss: 1500,
      legalActions: ['collection_call', 'court_order', 'seizure'],
      rentCost: 40, medicalCost: 0, educationCost: 0, specialEducationCost: 0,
      monthlyFixedExpenses: 15, monthlyExpense: 120,
      specialCondition: 'none',
      clientNote: '코인 투자 실패로 대출이 급증했습니다. 현재 계좌 압류 상태입니다.',
      riskFlags: ['최근 1년 이내 대출 과다', '투자/사행성 채무(코인/주식)', '소득 대비 과다 채무'],
      debts: [
        { creditor: '국민은행', principal: 8000, interest: 480, type: 'secured' },
        { creditor: '우리은행', principal: 5000, interest: 300, type: 'unsecured' },
        { creditor: '롯데카드', principal: 4000, interest: 350, type: 'unsecured' },
        { creditor: '캐시원', principal: 3000, interest: 280, type: 'unsecured', isRecent: true },
        { creditor: '세금 체납', principal: 2000, interest: 0, type: 'tax' },
        { creditor: '사채', principal: 3000, interest: 500, type: 'unsecured', isGamblingOrLuxury: true },
      ],
      assets: [],
    },
  },
];

type CopilotTab =
  | 'client-info' | 'court-notes' | 'staff-memo' | 'lawyer-opinion' | 'approval' | 'audit-log';

const COPILOT_TABS: { key: CopilotTab; label: string; icon: React.ReactNode; requiresLawyer?: boolean; requiresOwner?: boolean }[] = [
  { key: 'client-info', label: '의뢰인 정보', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'court-notes', label: '관할법원 참고', icon: <Scale className="w-3.5 h-3.5" /> },
  { key: 'staff-memo', label: '사무직원 메모', icon: <StickyNote className="w-3.5 h-3.5" /> },
  { key: 'lawyer-opinion', label: '변호사 검토 의견', icon: <Gavel className="w-3.5 h-3.5" />, requiresLawyer: true },
  { key: 'approval', label: '승인 및 발송', icon: <Send className="w-3.5 h-3.5" />, requiresLawyer: true },
  { key: 'audit-log', label: '변경·감사 로그', icon: <History className="w-3.5 h-3.5" />, requiresOwner: true },
];

/** 금액 포맷 */
function fmtMoney(v: number): string {
  if (!v && v !== 0) return '-';
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억 원`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만 원`;
  return `${v.toLocaleString()}원`;
}

/** consultRequest → IntakeData 변환 */
// mapToRehabUserInput은 ./mapToRehabUserInput.ts로 추출됨

function mapToIntakeData(req: any): IntakeData | null {
  if (!req) return null;
  const fp = req.financialProfile || req;
  const income = fp.income || fp.monthlyIncome || 0;
  const debtTotal = fp.debtTotal || 0;

  const debts = (fp.debts || []).map((d: any, i: number) => ({
    id: `debt-${i}`,
    creditor: d.creditor || d.name || `채권자 ${i + 1}`,
    principal: d.principal || d.amount || 0,
    interest: d.interest || 0,
    type: (d.type as 'unsecured' | 'secured' | 'tax') || 'unsecured',
    isGamblingOrLuxury: d.isGamblingOrLuxury || false,
    isRecent: d.isRecent || false,
  }));

  if (debts.length === 0 && debtTotal > 0) {
    debts.push({ id: 'debt-0', creditor: '미상세 채무', principal: debtTotal, interest: 0, type: 'unsecured' as const, isGamblingOrLuxury: false, isRecent: false });
  }

  const assets = (fp.assets || []).map((a: any, i: number) => ({
    id: `asset-${i}`,
    owner: (a.owner as 'self' | 'spouse') || 'self',
    type: a.type || 'deposit',
    label: a.label || a.name || '',
    marketValue: a.marketValue || a.value || 0,
    loanBalance: a.loanBalance || 0,
    hasPledge: a.hasPledge || false,
    isExempt: a.isExempt || false,
  }));

  return {
    clientName: req.client_name || req.clientName || '의뢰인',
    phoneNumber: '',
    birthDate: fp.birthDate || '1985-1-1',
    consultDate: new Date().toISOString().split('T')[0],
    dbVendor: '코파일럿',
    caseType: 'individual_rehab',
    residence: fp.residence || fp.address || '서울특별시',
    workplace: '',
    selectedCourt: fp.selectedCourt || '서울회생법원',
    maritalStatus: fp.maritalStatus || 'single',
    minorChildren: fp.minorChildren || 0,
    minorChildrenFullRecognition: false,
    otherDependents: fp.otherDependents || 0,
    prevHistory: { exists: false },
    incomeSources: [{
      id: 'inc-1',
      type: fp.incomeType || 'worker',
      amount: income,
    }],
    debts,
    assets,
    monthlyLivingCost: fp.monthlyExpense || fp.livingCost || 0,
    monthlyRent: fp.monthlyRent || 0,
    monthlyInsurance: fp.monthlyInsurance || 0,
    extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
    specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
    consultationLogs: [],
  };
}

export default function CaseReviewCopilot({
  consultRequest: singleRequest, consultRequests, tenantId, actorId, actorRole, actorName, preselectedRequestId, onClose, onProposalSent
}: CaseReviewCopilotProps) {
  const permissions = useCopilotPermissions(actorRole as StaffRole);

  // Build selectable client list — 실제 상담 데이터 우선, 없을 때만 샘플
  const allClients = React.useMemo(() => {
    const fromProps = consultRequests || (singleRequest ? [singleRequest] : []);
    if (fromProps.length > 0) return fromProps;
    return SAMPLE_CLIENTS; // 실제 상담이 없을 때 데모용 폴백
  }, [consultRequests, singleRequest]);

  const [selectedClientIdx, setSelectedClientIdx] = useState<number>(-1);
  const consultRequest = selectedClientIdx >= 0 ? allClients[selectedClientIdx] : null;

  // preselectedRequestId가 변경되면 해당 고객 자동 선택
  React.useEffect(() => {
    if (preselectedRequestId && allClients.length > 0) {
      const idx = allClients.findIndex((c: any) => c.id === preselectedRequestId);
      if (idx >= 0) {
        setSelectedClientIdx(idx);
        setFactOutput(null);
        setRuleOutput(null);
        setReviewStatus('DRAFT');
      }
    }
  }, [preselectedRequestId, allClients]);

  // 변제금 진단 결과
  const [rehabCalcResult, setRehabCalcResult] = useState<RehabCalculationResult | null>(null);
  const [rehabUserInput, setRehabUserInput] = useState<RehabUserInput | null>(null);
  const [showRehabReport, setShowRehabReport] = useState(false);

  // 변호사 컨펌 프로세스
  const [confirmRequest, setConfirmRequest] = useState<{requester: string; role: string; memo: string; requestedAt: string} | null>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<CopilotTab>('client-info');

  // 코파일럿 결과 상태
  const [factOutput, setFactOutput] = useState<FactEngineOutput | null>(null);
  const [ruleOutput, setRuleOutput] = useState<ReviewRuleEngineOutput | null>(null);
  const [reviewStatus, setReviewStatus] = useState<CaseReviewStatus>('DRAFT');
  const [isRunning, setIsRunning] = useState(false);
  const [settingsView, setSettingsView] = useState<'none' | 'ruleset' | 'style'>('none');

  // 사무직원 메모 상태
  const [staffNotes, setStaffNotes] = useState('');
  const [missingInfoChecked, setMissingInfoChecked] = useState(false);
  const [factVerified, setFactVerified] = useState(false);

  // 변호사 의견 상태
  const [lawyerOpinion, setLawyerOpinion] = useState({
    procedureOpinion: '',
    legalIssues: '',
    consultationConclusion: '',
    clientGuidance: '',
    nextSteps: '',
  });

  // 승인 체크리스트
  const [checklist, setChecklist] = useState({
    clientDataReviewed: false,
    missingInfoReviewed: false,
    ruleSetReviewed: false,
    legalOpinionReviewed: false,
    clientMessageReviewed: false,
  });
  const [clientMessage, setClientMessage] = useState('');

  // Q&A 피드백 루프
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedbackThread, setFeedbackThread] = useState<{ id: string; author: string; role: string; content: string; type: 'reject' | 'more_info' | 'staff_response'; createdAt: string }[]>([]);
  const [staffResponseContent, setStaffResponseContent] = useState('');

  // 감사 로그
  const [auditLogs, setAuditLogs] = useState<{ time: string; action: string; actor: string; detail: string }[]>([]);

  // 검토 초안 생성
  const handleRunCopilot = useCallback(() => {
    if (!consultRequest) return;
    setIsRunning(true);

    const intakeData = mapToIntakeData(consultRequest);
    if (!intakeData) {
      setIsRunning(false);
      return;
    }

    try {
      const fOut = runFactEngine(intakeData, DEFAULT_SETTINGS);
      setFactOutput(fOut);

      const mockRuleSet: ReviewRuleSet = {
        id: 'default-rs', tenantId, name: '기본 검토 기준', description: '',
        version: 1, status: 'ACTIVE', createdBy: 'system',
        effectiveFrom: '', reviewDueAt: '', approvedByLawyerId: '', approvedAt: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const rOut = runReviewRuleEngine(fOut, mockRuleSet, DEFAULT_REVIEW_RULES, []);
      setRuleOutput(rOut);
      setReviewStatus('DRAFT');

      // 변제금 계산 실행
      try {
        const rehabInput = mapToRehabUserInput(consultRequest);
        const rehabResult = calculateRepayment(rehabInput);
        setRehabCalcResult(rehabResult);
        setRehabUserInput(rehabInput);
        addAuditLog('REHAB_CALCULATED', `월 변제금 ${formatCurrency(rehabResult.monthlyPayment)}, 탕감률 ${rehabResult.debtReductionRate}%`);
      } catch (calcErr) {
        console.warn('변제금 계산 오류 (무시):', calcErr);
      }

      addAuditLog('REVIEW_CREATED', '검토 초안 생성');
      addAuditLog('FACT_SNAPSHOT_CREATED', '사실 스냅샷 저장');
      addAuditLog('RULE_EXECUTED', `${rOut.flags.length}개 플래그 생성`);

      // 초안 생성 완료 후 의뢰인 정보 탭 유지 (하단에 분석 결과 표시)
      setActiveTab('client-info');
    } catch (err) {
      console.error('코파일럿 실행 오류:', err);
    } finally {
      setIsRunning(false);
    }
  }, [consultRequest, tenantId]);

  const addAuditLog = (action: string, detail: string) => {
    setAuditLogs(prev => [{
      time: new Date().toLocaleString('ko-KR'),
      action,
      actor: `${actorName} (${actorRole})`,
      detail,
    }, ...prev]);
  };

  // 사무직원 검토 제출
  const handleStaffSubmit = () => {
    setReviewStatus('STAFF_REVIEWED');
    addAuditLog('STAFF_REVIEW_COMPLETED', staffNotes || '사실확인 완료');
  };

  // 변호사 검토 요청
  const handleRequestLawyerReview = () => {
    setReviewStatus('LAWYER_REVIEW_REQUIRED');
    addAuditLog('LAWYER_REVIEW_OPENED', '변호사 검토 요청');
  };

  // 의견 저장
  const handleSaveOpinion = () => {
    addAuditLog('LAWYER_OPINION_EDITED', '검토 의견 저장');
  };

  // 승인
  const allChecked = Object.values(checklist).every(v => v);
  const handleApprove = () => {
    if (!allChecked) return;
    setReviewStatus('LAWYER_APPROVED');
    addAuditLog('LAWYER_APPROVED', `승인자: ${actorName}`);
  };

  // 고객 발송
  const handleSendToClient = () => {
    if (reviewStatus !== 'LAWYER_APPROVED') return;
    setReviewStatus('SENT_TO_CLIENT');
    addAuditLog('CLIENT_MESSAGE_SENT', '고객에게 발송 완료');
  };

  // 반려 (사유 필수)
  const handleReject = () => {
    if (!rejectReason.trim()) return;
    setReviewStatus('LAWYER_REJECTED');
    addAuditLog('LAWYER_REJECTED', rejectReason.trim());
    setFeedbackThread(prev => [...prev, {
      id: `fb-${Date.now()}`, author: actorName, role: actorRole,
      content: rejectReason.trim(), type: 'reject',
      createdAt: new Date().toISOString(),
    }]);
    setRejectReason('');
    setShowRejectForm(false);
  };

  // 추가확인 요청 (반려 없이 질문만)
  const handleRequestMoreInfo = () => {
    if (!rejectReason.trim()) return;
    setReviewStatus('MORE_INFO_REQUIRED');
    addAuditLog('MORE_INFO_REQUESTED', rejectReason.trim());
    setFeedbackThread(prev => [...prev, {
      id: `fb-${Date.now()}`, author: actorName, role: actorRole,
      content: rejectReason.trim(), type: 'more_info',
      createdAt: new Date().toISOString(),
    }]);
    setRejectReason('');
    setShowRejectForm(false);
  };

  // 직원 보완 제출
  const handleStaffResponse = () => {
    if (!staffResponseContent.trim()) return;
    setFeedbackThread(prev => [...prev, {
      id: `fb-${Date.now()}`, author: actorName, role: actorRole,
      content: staffResponseContent.trim(), type: 'staff_response',
      createdAt: new Date().toISOString(),
    }]);
    addAuditLog('STAFF_REVIEW_COMPLETED', `보완 제출: ${staffResponseContent.trim().substring(0, 50)}`);
    setReviewStatus('STAFF_REVIEWED');
    setStaffResponseContent('');
    setMissingInfoChecked(true);
    setFactVerified(true);
  };

  // 접근 가능한 탭 필터
  const accessibleTabs = COPILOT_TABS.filter(t => {
    if (t.requiresLawyer && !permissions.canEditLawyerOpinion) return false;
    if (t.requiresOwner && !permissions.canViewAuditLog) return false;
    return true;
  });

  const fp = consultRequest?.financialProfile || consultRequest || {};
  const statusCfg = CASE_REVIEW_STATUS_CONFIG[reviewStatus] || CASE_REVIEW_STATUS_CONFIG.DRAFT;

  // 검색/필터/정렬 상태
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState<'latest' | 'debt-high' | 'debt-low' | 'name'>('latest');
  const [clientFilter, setClientFilter] = useState<'all' | 'new' | 'in-progress'>('all');
  const ITEMS_PER_PAGE = 8;
  const [clientPage, setClientPage] = useState(0);

  const filteredClients = useMemo(() => {
    let list = [...allClients];
    // 검색
    if (clientSearch.trim()) {
      const q = clientSearch.trim().toLowerCase();
      list = list.filter(c => (c.clientName || c.client_name || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q));
    }
    // 필터
    if (clientFilter === 'new') list = list.filter(c => c.status === 'requested' || c.status === 'responding');
    if (clientFilter === 'in-progress') list = list.filter(c => c.status === 'comparing' || c.status === 'counseling');
    // 정렬
    list.sort((a, b) => {
      if (clientSort === 'latest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (clientSort === 'debt-high') return ((b.financialProfile?.debtTotal || 0) - (a.financialProfile?.debtTotal || 0));
      if (clientSort === 'debt-low') return ((a.financialProfile?.debtTotal || 0) - (b.financialProfile?.debtTotal || 0));
      return (a.clientName || '').localeCompare(b.clientName || '');
    });
    return list;
  }, [allClients, clientSearch, clientSort, clientFilter]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const pagedClients = filteredClients.slice(clientPage * ITEMS_PER_PAGE, (clientPage + 1) * ITEMS_PER_PAGE);

  if (!consultRequest) {
    return (
      <div className="animate-fadeIn space-y-5">
        {/* 헤더 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <Microscope className="w-5 h-5 text-brand" />
                AI 사건 분석
              </h3>
              <p className="text-xs text-slate-500">의뢰인을 선택하면 AI가 재무 상태를 분석하고 법적 쟁점을 자동 검토합니다.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-brand/10 text-brand font-bold px-2.5 py-1 rounded-lg">{allClients.length}명</span>
              <span className="text-slate-400">등록된 의뢰인</span>
            </div>
          </div>
        </div>

        {/* 검색 + 필터 + 정렬 바 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setClientPage(0); }}
              placeholder="의뢰인 이름 검색..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-800"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            {[
              { key: 'all' as const, label: '전체' },
              { key: 'new' as const, label: '신규' },
              { key: 'in-progress' as const, label: '상담중' },
            ].map(f => (
              <button key={f.key} onClick={() => { setClientFilter(f.key); setClientPage(0); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${clientFilter === f.key ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
            <select
              value={clientSort}
              onChange={e => setClientSort(e.target.value as typeof clientSort)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="latest">최신순</option>
              <option value="debt-high">채무 높은순</option>
              <option value="debt-low">채무 낮은순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </div>

        {/* 의뢰인 카드 리스트 */}
        {pagedClients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedClients.map((client) => {
              const cfp = client.financialProfile || {};
              const isSample = (client.id || '').startsWith('sample');
              const dateStr = client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '';
              const debtTotal = cfp.debtTotal || 0;
              const income = cfp.income || 0;
              const dti = income > 0 ? Math.round((debtTotal / (income * 12)) * 100) : 0;
              const riskLevel = dti > 300 ? 'high' : dti > 150 ? 'mid' : 'low';
              const statusLabel = client.status === 'requested' ? '접수' : client.status === 'responding' ? '응답중' : client.status === 'comparing' ? '비교상담' : client.status === 'counseling' ? '전담상담' : client.status || '대기';
              const statusColor = client.status === 'requested' ? 'bg-blue-100 text-blue-600' : client.status === 'responding' ? 'bg-amber-100 text-amber-600' : client.status === 'comparing' ? 'bg-violet-100 text-violet-600' : client.status === 'counseling' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500';
              const originalIdx = allClients.findIndex(c => c.id === client.id);

              return (
                <button key={client.id} onClick={() => setSelectedClientIdx(originalIdx)}
                  className="text-left bg-white border border-slate-200 rounded-2xl hover:border-brand/50 hover:shadow-md active:scale-[0.98] transition-all group overflow-hidden">
                  {/* 상단 위험도 바 */}
                  <div className={`h-1 w-full ${riskLevel === 'high' ? 'bg-red-400' : riskLevel === 'mid' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <div className="p-4 space-y-3">
                    {/* 아바타 + 이름 + 상태 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${riskLevel === 'high' ? 'bg-red-50 text-red-600' : riskLevel === 'mid' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {(client.clientName || client.client_name || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-sm text-slate-800 truncate">{client.clientName || client.client_name}</p>
                          {isSample && <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-lg text-[9px] font-bold shrink-0">샘플</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${statusColor}`}>{statusLabel}</span>
                          {dateStr && <span className="text-[10px] text-slate-400">{dateStr}</span>}
                        </div>
                      </div>
                    </div>

                    {/* 핵심 지표 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">총 채무</span>
                        <span className="text-[13px] font-extrabold text-slate-900">{debtTotal > 0 ? `${debtTotal.toLocaleString()}만원` : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">월 소득</span>
                        <span className="text-[13px] font-bold text-slate-700">{income > 0 ? `${income.toLocaleString()}만원` : '-'}</span>
                      </div>
                      {/* DTI 바 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400">채무비율 (DTI)</span>
                          <span className={`text-[10px] font-bold ${riskLevel === 'high' ? 'text-red-500' : riskLevel === 'mid' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {dti > 0 ? `${dti}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${riskLevel === 'high' ? 'bg-red-400' : riskLevel === 'mid' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(dti / 5, 100)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* 리스크 플래그 */}
                    {(cfp.riskFlags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(cfp.riskFlags || []).slice(0, 2).map((flag: string, i: number) => (
                          <span key={i} className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-lg font-medium truncate max-w-[120px]">⚠ {flag}</span>
                        ))}
                        {(cfp.riskFlags || []).length > 2 && (
                          <span className="text-[9px] text-slate-400 font-bold">+{cfp.riskFlags.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* 분석 시작 버튼 */}
                    <div className="pt-1">
                      <div className="w-full bg-slate-50 group-hover:bg-brand/5 text-slate-500 group-hover:text-brand text-[11px] font-bold py-2 rounded-xl text-center transition-all flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" />
                        AI 분석 시작
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600 mb-1">
              {clientSearch ? '검색 결과가 없습니다' : '등록된 의뢰인이 없습니다'}
            </p>
            <p className="text-xs text-slate-400">
              {clientSearch ? '다른 검색어를 시도해 보세요' : '신규 상담 요청 탭에서 상담을 먼저 생성하세요'}
            </p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setClientPage(p => Math.max(0, p - 1))} disabled={clientPage === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all">
              이전
            </button>
            <span className="text-xs text-slate-500">
              {clientPage + 1} / {totalPages} 페이지
            </span>
            <button onClick={() => setClientPage(p => Math.min(totalPages - 1, p + 1))} disabled={clientPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all">
              다음
            </button>
          </div>
        )}

        {/* 안내 스텝 */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 mb-3">AI 사건 분석 워크플로</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            {[
              { step: '1', label: '의뢰인 선택', desc: '목록에서 분석할 건 선택' },
              { step: '2', label: 'AI 자동 분석', desc: '재무·법적 쟁점 진단' },
              { step: '3', label: '검토 의견 작성', desc: '변호사 소견 및 전략' },
              { step: '4', label: '승인 및 발송', desc: '제안서 작성·고객 전달' },
            ].map((s, i) => (
              <div key={i} className="flex sm:flex-col items-center sm:items-center gap-2 sm:gap-1 flex-1">
                <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-extrabold shrink-0">{s.step}</div>
                <div className="sm:text-center">
                  <p className="text-[11px] font-bold text-slate-700">{s.label}</p>
                  <p className="text-[10px] text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 animate-fadeIn">

      {/* ── 상단 경고 배너 ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">내부 업무보조 초안</p>
          <p className="text-xs text-amber-700 mt-0.5">
            본 결과는 내부 업무보조를 위한 초안입니다. 담당 변호사의 검토·수정·승인 전에는 고객에게 제공할 수 없습니다.
          </p>
        </div>
      </div>

      {/* ── 헤더: 의뢰인 + 상태 + 액션 ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand" />
              사건검토 코파일럿
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>의뢰인: <span className="font-bold text-slate-700">{consultRequest.client_name || consultRequest.clientName || '미확인'}</span></span>
              {' · '}상태: <span className={`inline-flex items-center gap-1 font-bold ${statusCfg.color}`}>
                {statusCfg.emoji} {statusCfg.label}
              </span>
              <button onClick={() => { setSelectedClientIdx(-1); setFactOutput(null); setRuleOutput(null); setReviewStatus('DRAFT'); }}
                className="ml-2 text-[10px] bg-slate-100 text-slate-500 rounded-lg px-2 py-0.5 hover:bg-slate-200 font-bold active:scale-[0.98] transition-all">
                ← 다른 고객
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permissions.canRunFactEngine && (
              <button
                onClick={handleRunCopilot}
                disabled={isRunning}
                className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {factOutput ? '초안 재생성' : '검토 초안 생성'}
              </button>
            )}
            {permissions.canManageRuleSets && (
              <button
                onClick={() => setSettingsView(settingsView === 'ruleset' ? 'none' : 'ruleset')}
                className={`rounded-xl px-3 py-2 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-1.5 ${
                  settingsView === 'ruleset' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" /> 기준 관리
              </button>
            )}
            {permissions.canManageRuleSets && (
              <button
                onClick={() => setSettingsView(settingsView === 'style' ? 'none' : 'style')}
                className={`rounded-xl px-3 py-2 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-1.5 ${
                  settingsView === 'style' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> 상담 스타일
              </button>
            )}
            {permissions.canRequestLawyerReview && factOutput && reviewStatus === 'STAFF_REVIEWED' && (
              <button
                onClick={handleRequestLawyerReview}
                className="bg-indigo-600 text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                변호사 검토 요청
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 설정 뷰: RuleSet 관리 ── */}
      {settingsView === 'ruleset' && (
        <CopilotRuleSetManager
          tenantId={tenantId}
          actorId={actorId}
          actorRole={actorRole}
          actorName={actorName}
          onBack={() => setSettingsView('none')}
        />
      )}

      {/* ── 설정 뷰: 상담 스타일 프로필 ── */}
      {settingsView === 'style' && (
        <ConsultStyleProfileSettings
          tenantId={tenantId}
          actorId={actorId}
          actorName={actorName}
          onBack={() => setSettingsView('none')}
        />
      )}

      {/* ── 진행 단계 표시기 + 탭 바 ── */}
      {settingsView === 'none' && (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Step Progress Bar */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1 text-[10px] font-bold">
            {[
              { step: 1, label: '자동 분석', done: !!factOutput, tabs: ['client-info', 'court-notes'] },
              { step: 2, label: '직원 확인', done: reviewStatus !== 'DRAFT' && reviewStatus !== 'LAWYER_REVIEW_REQUIRED', tabs: ['staff-memo'] },
              { step: 3, label: '변호사 검토·승인', done: reviewStatus === 'LAWYER_APPROVED' || reviewStatus === 'SENT_TO_CLIENT', tabs: ['lawyer-opinion', 'approval', 'audit-log'] },
            ].map((s, i) => {
              const isCurrent = s.tabs.includes(activeTab);
              return (
                <React.Fragment key={s.step}>
                  {i > 0 && <div className={`flex-1 h-px ${s.done || isCurrent ? 'bg-brand' : 'bg-slate-200'}`} />}
                  <button
                    onClick={() => setActiveTab(s.tabs[0] as CopilotTab)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                      isCurrent ? 'bg-brand/10 text-brand' :
                      s.done ? 'text-green-600' : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center shrink-0 ${
                      s.done ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {s.done ? '✓' : s.step}
                    </span>
                    {s.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Tab Bar with Group Labels */}
        <div className="border-b border-slate-100 px-4 overflow-x-auto">
          <div className="flex gap-0.5 min-w-max">
            {accessibleTabs.map((t, idx) => {
              const groupBreak = t.key === 'staff-memo' || t.key === 'lawyer-opinion';
              return (
                <React.Fragment key={t.key}>
                  {groupBreak && <div className="w-px bg-slate-200 mx-1 my-2" />}
                  <button
                    onClick={() => setActiveTab(t.key)}
                    className={`pb-2.5 pt-3 px-2.5 border-b-2 flex items-center gap-1 transition-all text-[11px] font-bold shrink-0 ${
                      activeTab === t.key
                        ? 'border-brand text-brand'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {t.key === 'review-flags' && ruleOutput && (
                      <span className="bg-red-100 text-red-700 rounded-full px-1.5 text-[10px] font-extrabold">{ruleOutput.flags.length}</span>
                    )}
                    {t.key === 'missing-info' && factOutput && factOutput.missingFields.length > 0 && (
                      <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 text-[10px] font-extrabold">{factOutput.missingFields.length}</span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── 탭 콘텐츠 ── */}
        <div className="p-5">
          {!factOutput && activeTab !== 'client-info' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-bold">검토 초안을 먼저 생성하세요</p>
              <p className="text-xs text-slate-400 mt-1">상단의 "검토 초안 생성" 버튼을 클릭하면 분석이 시작됩니다.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: 고객 입력정보 */}
              {activeTab === 'client-info' && (
                <div className="space-y-5">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-brand" /> 고객이 입력한 원본 정보</h4>

                  {/* 1. 기본 정보 */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">👤 기본 정보</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '의뢰인명', value: fp.clientName || consultRequest.clientName || consultRequest.client_name || '-' },
                        { label: '연락처', value: fp.clientPhone || consultRequest.phone || '-' },
                        { label: '나이', value: fp.age ? `${fp.age}세` : '-' },
                        { label: '성별', value: fp.gender === 'male' ? '남성' : fp.gender === 'female' ? '여성' : '-' },
                        { label: '혼인 상태', value: fp.maritalStatus === 'MARRIED' || fp.maritalStatus === 'married' ? '기혼' : fp.maritalStatus === 'DIVORCED' || fp.maritalStatus === 'divorced' ? '이혼' : fp.maritalStatus === 'SINGLE' || fp.maritalStatus === 'single' ? '미혼' : '-' },
                        { label: '미성년 자녀', value: fp.minorChildren != null ? `${fp.minorChildren}명` : `${fp.dependents || 0}명` },
                        { label: '거주지', value: fp.residence || fp.residenceRegion || fp.address || '-' },
                        { label: '거주 형태', value: fp.housingType === 'rent' ? '월세' : fp.housingType === 'jeonse' ? '전세' : fp.housingType === 'owned' ? '자가' : fp.housingType === 'free' ? '무상거주' : fp.housingType || '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. 소득 및 직업 */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">💼 소득 및 직업</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '월 소득', value: fmtMoney(fp.income || fp.monthlyIncome || 0) },
                        { label: '직업 유형', value: fp.jobType === 'SALARIED' ? '급여소득자' : fp.jobType === 'BUSINESS' ? '자영업/사업자' : fp.jobType === 'DAILY' ? '일용직' : fp.jobType === 'FREELANCER' ? '프리랜서' : fp.employmentType || fp.incomeType || '-' },
                        { label: '근무지', value: fp.workLocation || '-' },
                        { label: '배우자 소득', value: fp.spouseIncome ? fmtMoney(fp.spouseIncome) : '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-blue-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-blue-400 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. 채무 요약 (상세는 '채무현황' 탭) */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">🔴 채무 요약 <span className="text-[10px] text-slate-400 font-normal ml-1">→ 상세는 '채무현황' 탭</span></h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '총 채무', value: fmtMoney(fp.debtTotal || 0) },
                        { label: '채권자 수', value: fp.creditorCount ? `${fp.creditorCount}개` : `${(fp.debts || []).length}개` },
                        { label: '채무 원인', value: fp.debtCause === 'LIVING' ? '생활비' : fp.debtCause === 'BUSINESS' ? '사업' : fp.debtCause === 'INVESTMENT' ? '투자' : fp.debtCause === 'GUARANTEE' ? '보증' : fp.debtCause === 'GAMBLING' ? '도박' : fp.debtCause || '-' },
                        { label: '독촉/법적조치', value: fp.harassmentLevel === 'CALL' ? '독촉 전화' : fp.harassmentLevel === 'LETTER' ? '내용증명' : fp.harassmentLevel === 'LAWSUIT' ? '소송' : fp.harassmentLevel === 'SEIZURE' ? '압류' : fp.harassmentLevel || '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-red-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-red-400 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. 자산 현황 */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">🏦 자산 현황</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '총 자산', value: fmtMoney(fp.assetsTotal || 0) },
                        { label: '본인 재산', value: fp.myAssets ? `${fp.myAssets}만원` : '-' },
                        { label: '배우자 자산', value: fp.spouseAsset ? `${fp.spouseAsset}만원` : '-' },
                        { label: '임대보증금', value: fp.rentalDeposit ? `${fp.rentalDeposit}만원` : '-' },
                        { label: '예상 퇴직금', value: fp.retirementPay ? `${fp.retirementPay}만원` : '-' },
                        { label: '퇴직연금 유형', value: fp.retirementPensionType === 'pension' ? '가입' : fp.retirementPensionType === 'none' ? '미가입' : fp.retirementPensionType === 'unknown' ? '모름' : '-' },
                        { label: '주택 명의자', value: fp.housingContractHolder === 'self' ? '본인' : fp.housingContractHolder === 'spouse' ? '배우자' : fp.housingContractHolder || '-' },
                        { label: '보증금 대출', value: fp.depositLoan ? `${fp.depositLoan}만원` : '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-green-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-green-500 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {fp.assets && fp.assets.length > 0 && (
                      <div className="bg-slate-50 rounded-xl overflow-hidden mt-2">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-100 text-slate-500">
                            <th className="p-2 text-left font-bold">자산명</th>
                            <th className="p-2 text-right font-bold">시장가</th>
                            <th className="p-2 text-center font-bold">유형</th>
                          </tr></thead>
                          <tbody>
                            {fp.assets.map((a: any, i: number) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="p-2 text-slate-700">{a.label || a.description || `자산 ${i+1}`}</td>
                                <td className="p-2 text-right font-bold text-slate-800">{fmtMoney(a.marketValue || a.value || 0)}</td>
                                <td className="p-2 text-center"><span className="bg-slate-200 rounded-lg px-1.5 py-0.5 text-[10px] font-bold">{a.type || '-'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 5. 생활비 */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">🏠 월 생활비</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '월세', value: fp.rentCost ? `${fp.rentCost}만원` : fp.monthlyRent ? fmtMoney(fp.monthlyRent) : '-' },
                        { label: '의료비', value: fp.medicalCost ? `${fp.medicalCost}만원` : '-' },
                        { label: '교육비', value: fp.educationCost ? `${fp.educationCost}만원` : '-' },
                        { label: '고정지출(통신·보험)', value: fp.monthlyFixedExpenses ? `${fp.monthlyFixedExpenses}만원` : '-' },
                        { label: '생활비 합계', value: fp.monthlyExpense ? fmtMoney(fp.monthlyExpense) : fp.livingCost ? fmtMoney(fp.livingCost) : '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-amber-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-amber-500 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 6. 특이사항 */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 mb-2">⚠️ 특이사항</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { label: '24개월 특례', value: fp.specialCondition === 'basic_recipient' ? '기초수급자' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'elderly' ? '고령자' : '해당없음' },
                        { label: '상담 유형', value: consultRequest.consultType || consultRequest.request_type || consultRequest.requestType || '-' },
                        { label: '요청일', value: consultRequest.createdAt?.split('T')[0] || consultRequest.created_at?.split('T')[0] || '-' },
                      ].map((item, i) => (
                        <div key={i} className="bg-purple-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-purple-500 font-bold">{item.label}</p>
                          <p className="text-xs font-extrabold text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {fp.riskFlags && fp.riskFlags.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] text-slate-500 font-bold mb-1">위험 플래그</p>
                        <div className="flex gap-1 flex-wrap">
                          {fp.riskFlags.map((flag: string, i: number) => (
                            <span key={i} className="bg-red-100 text-red-700 rounded-lg px-2 py-0.5 text-[10px] font-bold">{flag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(fp.clientNote || (fp.clientNotes && fp.clientNotes.length > 0)) && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-[10px] text-amber-600 font-bold mb-1">의뢰인 전달 사항</p>
                        <p className="text-xs text-slate-700">{fp.clientNote || (fp.clientNotes || []).join('\n')}</p>
                      </div>
                    )}
                  </div>

                  {/* 7. 코파일럿 채무 분석 (초안 생성 후 표시) */}
                  {factOutput && (
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-slate-500 mb-2">📊 코파일럿 채무 분석 <span className="text-[10px] text-green-500 font-normal ml-1">✓ 초안 생성됨</span></h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: '총 채무', value: fmtMoney(factOutput.factSummary.totalDebt), color: 'text-red-600' },
                        { label: '무담보 채무', value: fmtMoney(factOutput.factSummary.unsecuredDebt) },
                        { label: '담보 채무', value: fmtMoney(factOutput.factSummary.securedDebt) },
                        { label: '조세 채무', value: fmtMoney(factOutput.factSummary.taxDebt) },
                        { label: '월 소득', value: fmtMoney(factOutput.factSummary.monthlyIncome), color: 'text-green-600' },
                        { label: '월 지출 (생계비)', value: fmtMoney(factOutput.factSummary.monthlyExpense) },
                        { label: '가용소득', value: fmtMoney(factOutput.factSummary.disposableIncome), color: factOutput.factSummary.disposableIncome > 0 ? 'text-blue-600' : 'text-red-600' },
                        { label: '부양가족', value: `${factOutput.factSummary.dependents}명` },
                      ].map((item, i) => (
                        <div key={i} className="bg-indigo-50/50 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-indigo-400 font-bold">{item.label}</p>
                          <p className={`text-xs font-extrabold ${item.color || 'text-slate-800'}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {factOutput.factSummary.assets && (
                      <div className="bg-indigo-50/30 rounded-xl p-3 mt-2">
                        <p className="text-[10px] font-bold text-indigo-400 mb-1">자산 요약</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-slate-400">총 시가:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.totalMarketValue)}</span></div>
                          <div><span className="text-slate-400">담보대출:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.totalLoanBalance)}</span></div>
                          <div><span className="text-slate-400">순자산:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.netAssetValue)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                  {/* 7-1. 변제금 진단 결과 (초안 생성 후 표시) */}
                  {rehabCalcResult && (
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-slate-500 mb-2">📋 변제금 진단 결과 <span className="text-[10px] text-green-500 font-normal ml-1">✓ 자동 산출</span></h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {[
                        { label: '예상 월 변제금', value: formatCurrency(rehabCalcResult.monthlyPayment), color: 'text-brand' },
                        { label: '변제 기간', value: `${rehabCalcResult.repaymentMonths}개월`, color: 'text-slate-800' },
                        { label: '예상 탕감률', value: `${rehabCalcResult.debtReductionRate}%`, color: rehabCalcResult.debtReductionRate >= 50 ? 'text-green-600' : 'text-amber-600' },
                        { label: '진행 가능성', value: rehabCalcResult.status === 'POSSIBLE' ? '가능' : rehabCalcResult.status === 'DIFFICULT' ? '어려움' : '불가', color: rehabCalcResult.status === 'POSSIBLE' ? 'text-green-600' : rehabCalcResult.status === 'DIFFICULT' ? 'text-amber-600' : 'text-red-600' },
                      ].map((item, i) => (
                        <div key={i} className="bg-gradient-to-br from-brand/5 to-brand/10 rounded-xl p-2.5 space-y-0.5">
                          <p className="text-[10px] text-brand/60 font-bold">{item.label}</p>
                          <p className={`text-sm font-extrabold ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {rehabCalcResult.statusReason && (
                      <p className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2 mb-2">{rehabCalcResult.statusReason}</p>
                    )}
                    <button
                      onClick={() => setShowRehabReport(true)}
                      className="w-full bg-brand/10 hover:bg-brand/20 text-brand font-bold text-xs py-2.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      고객 제안서 초안 작성
                    </button>
                  </div>
                  )}
                  {/* 7-2. 변호사 컨펌 요청 카드 */}
                  {confirmRequest && (
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <div className={`rounded-2xl p-4 border-2 ${
                      reviewStatus === 'LAWYER_REVIEW_REQUIRED' ? 'bg-amber-50 border-amber-300' :
                      reviewStatus === 'LAWYER_APPROVED' ? 'bg-green-50 border-green-300' :
                      reviewStatus === 'LAWYER_REJECTED' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {reviewStatus === 'LAWYER_REVIEW_REQUIRED' && <Clock className="w-4 h-4 text-amber-500" />}
                        {reviewStatus === 'LAWYER_APPROVED' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {reviewStatus === 'LAWYER_REJECTED' && <XCircle className="w-4 h-4 text-red-500" />}
                        <h5 className="text-xs font-bold text-slate-700">
                          {reviewStatus === 'LAWYER_REVIEW_REQUIRED' ? '🔔 변호사 컨펌 대기 중' :
                           reviewStatus === 'LAWYER_APPROVED' ? '✅ 변호사 컨펌 완료' :
                           reviewStatus === 'LAWYER_REJECTED' ? '❌ 변호사 반려' : '컨펌 요청'}
                        </h5>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-1 mb-3">
                        <p><span className="font-bold">요청자:</span> {confirmRequest.requester} ({confirmRequest.role})</p>
                        <p><span className="font-bold">메모:</span> {confirmRequest.memo}</p>
                        <p><span className="font-bold">요청일:</span> {confirmRequest.requestedAt}</p>
                      </div>
                      {reviewStatus === 'LAWYER_REVIEW_REQUIRED' && permissions.canApproveCaseReview && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setReviewStatus('LAWYER_REJECTED');
                              addAuditLog('LAWYER_REJECTED', '변호사 반려');
                            }}
                            className="flex-1 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition-colors active:scale-[0.98]"
                          >
                            ❌ 반려
                          </button>
                          <button
                            onClick={() => {
                              setReviewStatus('LAWYER_APPROVED');
                              addAuditLog('LAWYER_CONFIRMED', '변호사 컨펌 승인');
                            }}
                            className="flex-[2] py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                          </button>
                        </div>
                      )}
                      {reviewStatus === 'LAWYER_APPROVED' && permissions.canSendToClient && (
                        <button
                          onClick={() => addAuditLog('PROPOSAL_INITIATED', '제안서 발송 시작')}
                          className="w-full py-2.5 bg-brand hover:bg-brand/90 text-white text-xs font-bold rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" /> 고객에게 제안서 발송
                        </button>
                      )}
                    </div>
                  </div>
                  )}
                  {/* 8. 누락정보 (초안 생성 후 표시) */}
                  {factOutput && (factOutput.missingFields.length > 0 || factOutput.conflicts.length > 0) && (
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-slate-500 mb-2">⚠️ 누락·불일치 항목</h5>
                    <div className="space-y-2">
                      {factOutput.missingFields.map((f, i) => (
                        <div key={i} className={`rounded-xl p-2.5 flex items-start gap-2 border ${
                          f.importance === 'required' ? 'bg-red-50 border-red-200' :
                          f.importance === 'recommended' ? 'bg-amber-50 border-amber-200' :
                          'bg-slate-50 border-slate-200'
                        }`}>
                          <span className={`rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 mt-0.5 ${
                            f.importance === 'required' ? 'bg-red-100 text-red-700' :
                            f.importance === 'recommended' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {f.importance === 'required' ? '필수' : f.importance === 'recommended' ? '권장' : '선택'}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{f.fieldLabel}</p>
                            <p className="text-[10px] text-slate-500">{f.description}</p>
                          </div>
                        </div>
                      ))}
                      {factOutput.conflicts.map((c, i) => (
                        <div key={`c-${i}`} className="bg-orange-50 border border-orange-200 rounded-xl p-2.5">
                          <p className="text-xs font-bold text-orange-800">{c.description}</p>
                          <p className="text-[10px] text-orange-600">{c.fieldA} ↔ {c.fieldB}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {/* 9. 위험 플래그 (초안 생성 후 표시) */}
                  {ruleOutput && ruleOutput.flags.length > 0 && (
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                      🚨 위험 플래그
                      {ruleOutput.reviewGrade !== 'NORMAL_REVIEW' && (
                        <span className="bg-red-100 text-red-700 rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold">
                          {ruleOutput.reviewGrade === 'ENHANCED_REVIEW' ? '⚡ 강화 검토' : '🔴 이중 검토'}
                        </span>
                      )}
                    </h5>
                    <div className="space-y-2">
                      {ruleOutput.flags.map((flag, i) => {
                        const ftCfg = FLAG_TYPE_CONFIG[flag.flagType] || FLAG_TYPE_CONFIG.INFO;
                        return (
                          <div key={i} className={`rounded-xl p-3 border-l-4 bg-white border border-slate-200 ${
                            flag.flagType === 'HIGH_RISK' ? 'border-l-red-500' :
                            flag.flagType === 'CAUTION' ? 'border-l-amber-500' :
                            flag.flagType === 'ADDITIONAL_CHECK' ? 'border-l-blue-500' :
                            'border-l-slate-300'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold ${ftCfg.bgColor} ${ftCfg.color}`}>
                                {ftCfg.emoji} {ftCfg.label}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800">{flag.message}</p>
                            {flag.usedInputValues && Object.keys(flag.usedInputValues).length > 0 && (
                              <div className="mt-1.5 bg-slate-50 rounded-lg p-2 space-y-0.5">
                                {Object.entries(flag.usedInputValues).map(([k, v]) => (
                                  <p key={k} className="text-[10px] text-slate-600">
                                    <span className="text-slate-400">{k}:</span> <span className="font-bold">{typeof v === 'number' ? fmtMoney(v) : String(v)}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {ruleOutput.additionalQuestions.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
                        <p className="text-[10px] font-bold text-blue-700 mb-1">📋 추가 질문</p>
                        <ul className="space-y-0.5">{ruleOutput.additionalQuestions.map((q, i) => <li key={i} className="text-[10px] text-blue-600">• {q}</li>)}</ul>
                      </div>
                    )}
                    {ruleOutput.requiredDocuments.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mt-2">
                        <p className="text-[10px] font-bold text-purple-700 mb-1">📄 필요 서류</p>
                        <ul className="space-y-0.5">{ruleOutput.requiredDocuments.map((d, i) => <li key={i} className="text-[10px] text-purple-600">• {d}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  )}

                </div>
              )}

              {/* TAB 5: 관할법원 참고사항 */}
              {activeTab === 'court-notes' && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Scale className="w-4 h-4 text-brand" /> 관할법원 실무 참고사항</h4>
                  {ruleOutput && ruleOutput.courtPracticeNotes.length > 0 ? (
                    ruleOutput.courtPracticeNotes.map((note, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{note.courtName}</span>
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-100 ${RULE_SOURCE_TYPE_CONFIG[note.sourceType]?.color || ''}`}>
                            {RULE_SOURCE_TYPE_CONFIG[note.sourceType]?.label}
                          </span>
                        </div>
                        {note.generalCorrectionRequirements && <p className="text-xs text-slate-600"><span className="font-bold">보정 요구:</span> {note.generalCorrectionRequirements}</p>}
                        {note.documentNotes && <p className="text-xs text-slate-600"><span className="font-bold">서류 참고:</span> {note.documentNotes}</p>}
                        {note.recentChanges && <p className="text-xs text-slate-600"><span className="font-bold">최근 변경:</span> {note.recentChanges}</p>}
                        {note.firmExperienceMemo && <p className="text-xs text-slate-500 italic"><span className="font-bold">내부 경험:</span> {note.firmExperienceMemo}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <p className="text-sm text-slate-500">등록된 관할법원 참고사항이 없습니다.</p>
                      <p className="text-xs text-slate-400 mt-1">설정 → 사건검토 기준 관리에서 법원별 참고사항을 추가할 수 있습니다.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: 사무직원 메모 */}
              {activeTab === 'staff-memo' && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><StickyNote className="w-4 h-4 text-brand" /> 사무직원 사실확인 및 메모</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input type="checkbox" checked={missingInfoChecked} onChange={e => setMissingInfoChecked(e.target.checked)} className="rounded" />
                      <span className="text-sm text-slate-700 font-bold">누락정보 확인 완료</span>
                    </label>
                    <label className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input type="checkbox" checked={factVerified} onChange={e => setFactVerified(e.target.checked)} className="rounded" />
                      <span className="text-sm text-slate-700 font-bold">사실관계 검증 완료</span>
                    </label>
                    <textarea
                      value={staffNotes}
                      onChange={e => setStaffNotes(e.target.value)}
                      placeholder="내부 메모를 작성하세요 (확인 사항, 추가 질문 등)..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                      rows={4}
                    />
                    {permissions.canCreateStaffReview && (
                      <button
                        onClick={handleStaffSubmit}
                        disabled={!missingInfoChecked || !factVerified}
                        className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        사실확인 제출 → 변호사 검토 요청
                      </button>
                    )}

                    {/* Q&A 피드백 스레드 */}
                    {feedbackThread.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h5 className="text-xs font-bold text-slate-500">📋 검토 피드백 이력</h5>
                        {feedbackThread.map(fb => (
                          <div key={fb.id} className={`rounded-xl p-3 text-xs ${
                            fb.type === 'reject' ? 'bg-red-50 border border-red-200' :
                            fb.type === 'more_info' ? 'bg-amber-50 border border-amber-200' :
                            'bg-green-50 border border-green-200'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-bold">{fb.type === 'reject' ? '❌ 반려' : fb.type === 'more_info' ? '❓ 추가확인' : '✅ 보완답변'}</span>
                              <span className="text-slate-500">{fb.author} ({fb.role})</span>
                              <span className="text-slate-400 text-[10px]">{new Date(fb.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-700">{fb.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 직원 보완 제출 (반려/추가확인 상태일 때) */}
                    {(reviewStatus === 'LAWYER_REJECTED' || reviewStatus === 'MORE_INFO_REQUIRED') && permissions.canCreateStaffReview && (
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                        <h5 className="text-xs font-bold text-blue-700">↩️ 보완 내용 작성</h5>
                        <textarea
                          value={staffResponseContent}
                          onChange={e => setStaffResponseContent(e.target.value)}
                          placeholder="변호사 피드백에 대한 보완 내용을 작성하세요..."
                          className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 outline-none"
                          rows={3}
                        />
                        <button
                          onClick={handleStaffResponse}
                          disabled={!staffResponseContent.trim()}
                          className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          보완 제출 → 변호사 재검토 요청
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: 변호사 검토 의견 */}
              {activeTab === 'lawyer-opinion' && permissions.canEditLawyerOpinion && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Gavel className="w-4 h-4 text-brand" /> 담당 변호사 검토 의견</h4>
                  <p className="text-xs text-slate-500">아래 항목은 AI가 확정하지 않으며, 변호사가 직접 작성합니다.</p>
                  {[
                    { key: 'procedureOpinion', label: '검토 가능한 절차 의견', placeholder: '개인회생, 파산, 채무조정 등 검토 의견을 작성하세요...' },
                    { key: 'legalIssues', label: '법률적 쟁점', placeholder: '이 사건의 주요 법률적 쟁점을 기재하세요...' },
                    { key: 'consultationConclusion', label: '상담 결론', placeholder: '1차 상담 결론을 작성하세요...' },
                    { key: 'clientGuidance', label: '고객 안내사항', placeholder: '고객에게 안내할 주의사항을 작성하세요...' },
                    { key: 'nextSteps', label: '다음 단계', placeholder: '추가 상담 일정, 필요 서류 등...' },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">{field.label}</label>
                      <textarea
                        value={(lawyerOpinion as any)[field.key]}
                        onChange={e => setLawyerOpinion(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                        rows={3}
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleSaveOpinion}
                    className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all"
                  >
                    의견 저장
                  </button>
                </div>
              )}

              {/* TAB 8: 승인 및 발송 */}
              {activeTab === 'approval' && permissions.canApproveCaseReview && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><Send className="w-4 h-4 text-brand" /> 승인 및 고객 발송</h4>

                  {reviewStatus === 'SENT_TO_CLIENT' ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm text-green-700 font-bold">고객에게 발송 완료되었습니다.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">승인 전 아래 5가지 항목을 모두 확인하세요.</p>
                      <div className="space-y-2">
                        {[
                          { key: 'clientDataReviewed', label: '고객 입력자료 확인 완료' },
                          { key: 'missingInfoReviewed', label: '누락정보 확인 완료' },
                          { key: 'ruleSetReviewed', label: '적용 기준(RuleSet) 확인 완료' },
                          { key: 'legalOpinionReviewed', label: '법률 의견 직접 검토 완료' },
                          { key: 'clientMessageReviewed', label: '고객 발송문 확인 완료' },
                        ].map(item => (
                          <label key={item.key} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={(checklist as any)[item.key]}
                              onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700 font-bold">{item.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="space-y-1 mt-4">
                        <label className="text-xs font-bold text-slate-600">고객 발송문 편집</label>
                        <textarea
                          value={clientMessage}
                          onChange={e => setClientMessage(e.target.value)}
                          placeholder="고객에게 보낼 1차 검토 의견을 작성하세요..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                          rows={6}
                        />
                        <p className="text-[10px] text-slate-400 italic mt-1">
                          고객이 입력한 자료의 정리와 내부 검토 초안 작성에 업무보조 시스템이 사용되었으며, 최종 내용은 담당 변호사가 검토·승인했습니다.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        {reviewStatus !== 'LAWYER_APPROVED' ? (
                          <button
                            onClick={handleApprove}
                            disabled={!allChecked}
                            className="bg-green-600 text-white rounded-xl px-5 py-2.5 font-bold text-sm hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> 승인
                          </button>
                        ) : (
                          <button
                            onClick={handleSendToClient}
                            className="bg-brand text-white rounded-xl px-5 py-2.5 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center gap-1.5"
                          >
                            <Send className="w-4 h-4" /> 승인 후 고객에게 발송
                          </button>
                        )}
                        <button
                          onClick={() => setShowRejectForm(!showRejectForm)}
                          className="bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" /> {showRejectForm ? '취소' : '반려 / 추가확인'}
                        </button>
                      </div>

                      {/* 반려/추가확인 사유 입력 폼 */}
                      {showRejectForm && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                          <h5 className="text-xs font-bold text-red-700">반려 사유 또는 추가 확인 질문</h5>
                          <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="반려 사유 또는 직원에게 추가 확인할 내용을 작성하세요..."
                            className="w-full bg-white border border-red-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-red-300 outline-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleReject}
                              disabled={!rejectReason.trim()}
                              className="bg-red-600 text-white rounded-xl px-4 py-2 font-bold text-xs hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> 반려
                            </button>
                            <button
                              onClick={handleRequestMoreInfo}
                              disabled={!rejectReason.trim()}
                              className="bg-amber-500 text-white rounded-xl px-4 py-2 font-bold text-xs hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> 추가확인 요청
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 피드백 이력 */}
                      {feedbackThread.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h5 className="text-xs font-bold text-slate-500">📋 검토 피드백 이력</h5>
                          {feedbackThread.map(fb => (
                            <div key={fb.id} className={`rounded-xl p-3 text-xs ${
                              fb.type === 'reject' ? 'bg-red-50 border border-red-200' :
                              fb.type === 'more_info' ? 'bg-amber-50 border border-amber-200' :
                              'bg-green-50 border border-green-200'
                            }`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-bold">{fb.type === 'reject' ? '❌ 반려' : fb.type === 'more_info' ? '❓ 추가확인' : '✅ 보완답변'}</span>
                                <span className="text-slate-500">{fb.author}</span>
                                <span className="text-slate-400 text-[10px]">{new Date(fb.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-slate-700">{fb.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 9: 감사 로그 */}
              {activeTab === 'audit-log' && permissions.canViewAuditLog && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><History className="w-4 h-4 text-brand" /> 변경·감사 로그</h4>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">아직 기록된 이벤트가 없습니다.</p>
                  ) : (
                    <div className="bg-slate-50 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-100 text-slate-500">
                          <th className="p-2 text-left font-bold">시간</th>
                          <th className="p-2 text-left font-bold">동작</th>
                          <th className="p-2 text-left font-bold">실행자</th>
                          <th className="p-2 text-left font-bold">상세</th>
                        </tr></thead>
                        <tbody>
                          {auditLogs.map((log, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="p-2 text-slate-500 whitespace-nowrap">{log.time}</td>
                              <td className="p-2"><span className="bg-indigo-100 text-indigo-700 rounded-lg px-1.5 py-0.5 text-[10px] font-bold">{log.action}</span></td>
                              <td className="p-2 text-slate-700">{log.actor}</td>
                              <td className="p-2 text-slate-600">{log.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </div>

      {/* 변호사 제안서 초안 모달 (기존 RehabResultReport 대체) */}
      {showRehabReport && rehabCalcResult && rehabUserInput && (
        <LawyerProposalDraft
          rehabCalcResult={rehabCalcResult}
          rehabUserInput={rehabUserInput}
          consultRequest={consultRequest}
          onClose={() => setShowRehabReport(false)}
          viewerRole={permissions.canSendToClient ? 'lawyer' : 'staff'}
          onSendProposal={(proposalData) => {
            // 채팅 연동: 부모(LawyerRole)의 handleSubmitProposalFromDraft 호출
            if (onProposalSent && consultRequest?.id) {
              onProposalSent(consultRequest.id, proposalData);
            }
            setShowRehabReport(false);
            addAuditLog('PROPOSAL_INITIATED', `제안서 발송 - 수임료: ${proposalData.fees.totalFee}원, 의견: ${proposalData.lawyerOpinion.substring(0, 50)}...`);
          }}
          onRequestConfirm={(memo) => {
            setShowRehabReport(false);
            setReviewStatus('LAWYER_REVIEW_REQUIRED');
            setConfirmRequest({ requester: actorName, role: actorRole, memo, requestedAt: new Date().toLocaleString('ko-KR') });
            addAuditLog('CONFIRM_REQUESTED', `변호사 컨펌 요청: ${memo}`);
          }}
        />
      )}
    </>
  );
}
