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
  | 'client-info' | 'court-notes' | 'staff-memo' | 'lawyer-opinion' | 'review-flags' | 'missing-info';

const COPILOT_TABS: { key: CopilotTab; label: string; icon: React.ReactNode; requiresLawyer?: boolean; requiresOwner?: boolean }[] = [
  { key: 'client-info', label: '의뢰인 정보', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'court-notes', label: '관할법원 참고', icon: <Scale className="w-3.5 h-3.5" /> },
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
    caseType: '개인회생',
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
  const [settingsView, setSettingsView] = useState<'none' | 'ruleset'>('none');

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
  const ITEMS_PER_PAGE = 10;
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-black text-xl text-slate-900 flex items-center gap-2.5">
                <Microscope className="w-6 h-6 text-brand" />
                AI 사건 분석
              </h3>
              <p className="text-sm text-slate-500">의뢰인을 선택하면 AI가 재무 상태를 분석하고 법적 쟁점을 자동 검토합니다.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-brand/10 text-brand font-bold px-3 py-1 rounded-lg">{allClients.length}명</span>
              <span className="text-slate-500 font-medium">등록된 의뢰인</span>
            </div>
          </div>
        </div>

        {/* 검색 + 필터 + 정렬 바 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col sm:flex-row gap-3 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setClientPage(0); }}
              placeholder="의뢰인 이름 검색..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-800"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            {[
              { key: 'all' as const, label: '전체' },
              { key: 'new' as const, label: '신규' },
              { key: 'in-progress' as const, label: '상담중' },
            ].map(f => (
              <button key={f.key} onClick={() => { setClientFilter(f.key); setClientPage(0); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${clientFilter === f.key ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
            <select
              value={clientSort}
              onChange={e => setClientSort(e.target.value as typeof clientSort)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="latest">최신순</option>
              <option value="debt-high">채무 높은순</option>
              <option value="debt-low">채무 낮은순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </div>

        {/* 의뢰인 리스트 */}
        {pagedClients.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* 테이블 헤더 - 데스크톱 */}
            <div className="hidden md:flex items-center px-5 py-2.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 tracking-wide">
              <span className="w-[200px] shrink-0">의뢰인</span>
              <span className="w-[72px] shrink-0">상태</span>
              <span className="w-[76px] shrink-0">접수일</span>
              <span className="w-[110px] shrink-0 text-right">총 채무</span>
              <span className="w-[90px] shrink-0 text-right">월 소득</span>
              <span className="w-[56px] shrink-0 text-right">DTI</span>
              <span className="flex-1 text-right pr-6">위험요인</span>
            </div>
            <div className="divide-y divide-slate-50">
            {pagedClients.map((client) => {
              const cfp = client.financialProfile || {};
              const isSample = (client.id || '').startsWith('sample');
              const dateStr = client.createdAt ? new Date(client.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '';
              const debtTotal = cfp.debtTotal || 0;
              const income = cfp.income || 0;
              const dti = income > 0 ? Math.round((debtTotal / (income * 12)) * 100) : 0;
              const riskLevel = dti > 300 ? 'high' : dti > 150 ? 'mid' : 'low';
              const statusLabel = client.status === 'requested' ? '접수' : client.status === 'responding' ? '응답중' : client.status === 'comparing' ? '비교상담' : client.status === 'counseling' ? '전담상담' : client.status || '대기';
              const flagCount = (cfp.riskFlags || []).length;
              const originalIdx = allClients.findIndex(c => c.id === client.id);

              return (
                <button key={client.id} onClick={() => setSelectedClientIdx(originalIdx)}
                  className={`w-full text-left flex items-center px-5 py-3 hover:bg-slate-50/80 active:scale-[0.998] transition-all cursor-pointer border-l-2 ${riskLevel === 'high' ? 'border-l-red-400' : riskLevel === 'mid' ? 'border-l-amber-400' : 'border-l-transparent'} group`}>
                  
                  {/* 의뢰인 이름 */}
                  <div className="flex items-center gap-2.5 w-full md:w-[200px] shrink-0 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                      {(client.clientName || client.client_name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-900 truncate">{client.clientName || client.client_name}</p>
                        {isSample && <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0">샘플</span>}
                      </div>
                      {/* 모바일: 핵심 지표 한 줄 */}
                      <div className="flex items-center gap-1.5 md:hidden text-[11px] text-slate-400 mt-0.5">
                        <span>{statusLabel}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-slate-600 font-semibold">{debtTotal > 0 ? `${debtTotal.toLocaleString()}만원` : '-'}</span>
                        {dti > 0 && <>
                          <span className="text-slate-200">·</span>
                          <span className={dti > 300 ? 'text-red-500 font-bold' : ''}>DTI {dti}%</span>
                        </>}
                      </div>
                    </div>
                  </div>

                  {/* 데스크톱 전용 컬럼 */}
                  <span className="hidden md:block w-[72px] shrink-0 text-xs text-slate-500 font-medium">{statusLabel}</span>
                  <span className="hidden md:block w-[76px] shrink-0 text-xs text-slate-400">{dateStr}</span>
                  <span className="hidden md:block w-[110px] shrink-0 text-right text-sm font-bold text-slate-800">{debtTotal > 0 ? `${debtTotal.toLocaleString()}만원` : '-'}</span>
                  <span className="hidden md:block w-[90px] shrink-0 text-right text-sm text-slate-600">{income > 0 ? `${income.toLocaleString()}만원` : '-'}</span>
                  <span className={`hidden md:block w-[56px] shrink-0 text-right text-xs font-bold ${riskLevel === 'high' ? 'text-red-500' : 'text-slate-500'}`}>
                    {dti > 0 ? `${dti}%` : '-'}
                  </span>
                  <span className="hidden md:flex flex-1 justify-end pr-2">
                    {flagCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {flagCount}건
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                </button>
              );
            })}
            </div>
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
          <div className="flex items-center justify-center gap-1 pt-1">
            <button onClick={() => setClientPage(p => Math.max(0, p - 1))} disabled={clientPage === 0}
              className="w-8 h-8 rounded-lg text-sm text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer">
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setClientPage(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${clientPage === i ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setClientPage(p => Math.min(totalPages - 1, p + 1))} disabled={clientPage >= totalPages - 1}
              className="w-8 h-8 rounded-lg text-sm text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer">
              ›
            </button>
            <span className="text-[11px] text-slate-400 ml-3">
              {filteredClients.length}건 중 {clientPage * ITEMS_PER_PAGE + 1}–{Math.min((clientPage + 1) * ITEMS_PER_PAGE, filteredClients.length)}
            </span>
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
    <div className="space-y-3.5 animate-fadeIn">

      {/* ── 상단 경고 배너 (컴팩트 바) ── */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-amber-800 shadow-xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold">내부 업무보조 초안: </span>
          <span>본 결과는 내부 업무보조를 위한 초안이며, 담당 변호사의 검토·수정·승인 전에는 고객에게 제공할 수 없습니다.</span>
        </div>
      </div>

      {/* ── 헤더: 의뢰인 + 상태 + 액션 ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1E3A5F]" />
                <span>AI 사건 분석</span>
              </h3>
              <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 text-xs px-2.5 py-1 rounded-lg">
                의뢰인: {consultRequest.client_name || consultRequest.clientName || '미확인'}
              </span>
              <span className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-lg border ${statusCfg.color}`}>
                {statusCfg.emoji} {statusCfg.label}
              </span>
              <button onClick={() => { setSelectedClientIdx(-1); setFactOutput(null); setRuleOutput(null); setReviewStatus('DRAFT'); }}
                className="text-xs bg-white border border-slate-200 text-slate-600 rounded-lg px-2.5 py-1 hover:bg-slate-50 font-bold active:scale-[0.98] transition-all cursor-pointer">
                ← 다른 고객 선택
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permissions.canRunFactEngine && (
              <button
                onClick={handleRunCopilot}
                disabled={isRunning}
                className="bg-[#1E3A5F] hover:bg-[#163152] text-white rounded-xl px-5 py-2.5 font-bold text-sm shadow-xs active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{factOutput ? '초안 재생성' : '⚡ 검토 초안 생성'}</span>
              </button>
            )}
            {permissions.canManageRuleSets && (
              <button
                onClick={() => setSettingsView(settingsView === 'ruleset' ? 'none' : 'ruleset')}
                className={`rounded-xl px-3.5 py-2.5 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-1.5 border cursor-pointer ${
                  settingsView === 'ruleset' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-4 h-4" /> 기준 관리
              </button>
            )}

            {permissions.canRequestLawyerReview && factOutput && reviewStatus === 'STAFF_REVIEWED' && (
              <button
                onClick={handleRequestLawyerReview}
                className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-xs"
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

      {/* ── 진행 단계 표시기 + 탭 바 ── */}
      {settingsView === 'none' && (
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* Step Progress Bar */}
        {/* Tab Bar */}
        <div className="border-b border-slate-100 px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {accessibleTabs.map((t) => {
              const groupBreak = t.key === 'staff-memo' || t.key === 'lawyer-opinion';
              return (
                <React.Fragment key={t.key}>
                  {groupBreak && <div className="w-px bg-slate-200 mx-1 my-2" />}
                  <button
                    onClick={() => setActiveTab(t.key)}
                    className={`pb-2.5 pt-3 px-3 border-b-2 flex items-center gap-1.5 transition-all text-xs sm:text-sm font-bold shrink-0 cursor-pointer ${
                      activeTab === t.key
                        ? 'border-[#1E3A5F] text-[#1E3A5F]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {t.key === 'review-flags' && ruleOutput && (
                      <span className="bg-rose-100 text-rose-700 rounded-full px-1.5 text-xs font-black">{ruleOutput.flags.length}</span>
                    )}
                    {t.key === 'missing-info' && factOutput && factOutput.missingFields.length > 0 && (
                      <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 text-xs font-black">{factOutput.missingFields.length}</span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── 탭 콘텐츠 ── */}
        <div className="p-4 sm:p-5">
          {!factOutput && activeTab !== 'client-info' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-bold">검토 초안을 먼저 생성하세요</p>
              <p className="text-xs text-slate-400 mt-1">상단의 "검토 초안 생성" 버튼을 클릭하면 분석이 시작됩니다.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: 고객 입력정보 & AI 초안 분석 2열 분할 뷰 */}
              {activeTab === 'client-info' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  
                  {/* ══════════════════════════════════════════════════════════ */}
                  {/* 좌측 패널 (xl:col-span-5): AI 사건 검토 초안 (즉시 노출) */}
                  {/* ══════════════════════════════════════════════════════════ */}
                  <div className="xl:col-span-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-[#1E3A5F]" />
                        <span>AI 사건 검토 초안</span>
                      </h4>
                      {factOutput && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 초안 산출됨
                        </span>
                      )}
                    </div>

                    {factOutput || rehabCalcResult ? (
                      <>
                        {/* 1. 변제금 진단 결과 핵심 카드 */}
                        {rehabCalcResult && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div>
                                <span className="text-xs text-slate-500 font-bold block">예상 월 변제금</span>
                                <span className="text-2xl sm:text-3xl font-black text-[#1E3A5F] tracking-tight tabular-nums block mt-0.5">
                                  {formatCurrency(rehabCalcResult.monthlyPayment)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-slate-500 font-bold block">예상 탕감률</span>
                                <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight tabular-nums block mt-0.5">
                                  {rehabCalcResult.debtReductionRate}%
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">변제 기간</span>
                                <span className="text-sm font-extrabold text-slate-900 block mt-0.5">{rehabCalcResult.repaymentMonths}개월</span>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">진행 가능성</span>
                                <span className={`text-sm font-extrabold block mt-0.5 ${rehabCalcResult.status === 'POSSIBLE' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {rehabCalcResult.status === 'POSSIBLE' ? '신청 적격' : '정밀 검토'}
                                </span>
                              </div>
                            </div>

                            {rehabCalcResult.statusReason && (
                              <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed text-left">
                                {rehabCalcResult.statusReason}
                              </p>
                            )}

                            <button
                              onClick={() => setShowRehabReport(true)}
                              className="w-full bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                              고객 제안서 초안 작성하기 →
                            </button>
                          </div>
                        )}

                        {/* 2. 코파일럿 재무 및 가용소득 정밀 분석 */}
                        {factOutput && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📊 채무 및 가용소득 분석</h5>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">총 채무</span>
                                <span className="text-base font-black text-slate-900 block mt-0.5 tracking-tight tabular-nums">{fmtMoney(factOutput.factSummary.totalDebt)}</span>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">월 가용소득</span>
                                <span className={`text-base font-black block mt-0.5 tracking-tight tabular-nums ${factOutput.factSummary.disposableIncome > 0 ? 'text-[#1E3A5F]' : 'text-rose-600'}`}>
                                  {fmtMoney(factOutput.factSummary.disposableIncome)}
                                </span>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">월 소득</span>
                                <span className="text-sm font-extrabold text-slate-900 block mt-0.5 tracking-tight tabular-nums">{fmtMoney(factOutput.factSummary.monthlyIncome)}</span>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <span className="text-xs text-slate-500 font-bold block">월 생계비</span>
                                <span className="text-sm font-extrabold text-slate-700 block mt-0.5 tracking-tight tabular-nums">{fmtMoney(factOutput.factSummary.monthlyExpense)}</span>
                              </div>
                            </div>
                            {factOutput.factSummary.assets && (
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                                <div className="grid grid-cols-3 gap-2">
                                  <div><span className="text-slate-400 font-bold">총 시가:</span> <span className="font-extrabold text-slate-900">{fmtMoney(factOutput.factSummary.assets.totalMarketValue)}</span></div>
                                  <div><span className="text-slate-400 font-bold">담보대출:</span> <span className="font-extrabold text-slate-900">{fmtMoney(factOutput.factSummary.assets.totalLoanBalance)}</span></div>
                                  <div><span className="text-slate-400 font-bold">순자산:</span> <span className="font-extrabold text-slate-900">{fmtMoney(factOutput.factSummary.assets.netAssetValue)}</span></div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. 위험 요인 및 법적 쟁점 (Risk Flags) */}
                        {ruleOutput && ruleOutput.flags.length > 0 && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">⚠️ 위험 요인 및 쟁점 ({ruleOutput.flags.length}건)</h5>
                            </div>
                            <div className="space-y-2">
                              {ruleOutput.flags.map((flag, i) => (
                                <div key={i} className="rounded-xl p-3 bg-slate-50 border border-slate-200 text-left">
                                  <p className="text-xs font-extrabold text-slate-900 leading-snug">{flag.message}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 4. 확인 필요 항목 (Missing Fields) */}
                        {factOutput && factOutput.missingFields.length > 0 && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📋 확인 필요 항목 ({factOutput.missingFields.length}건)</h5>
                            <div className="space-y-1.5">
                              {factOutput.missingFields.map((f, i) => (
                                <div key={i} className="rounded-xl p-2.5 bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                                  <span className="font-bold text-slate-800">{f.fieldLabel}</span>
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">{f.importance === 'required' ? '필수' : '권장'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. 변호사 컨펌 요청 카드 */}
                        {confirmRequest && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                            <div className="flex items-center gap-2">
                              {reviewStatus === 'LAWYER_REVIEW_REQUIRED' && <Clock className="w-4 h-4 text-amber-500" />}
                              {reviewStatus === 'LAWYER_APPROVED' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                              {reviewStatus === 'LAWYER_REJECTED' && <XCircle className="w-4 h-4 text-rose-500" />}
                              <h5 className="text-xs font-bold text-slate-700">
                                {reviewStatus === 'LAWYER_REVIEW_REQUIRED' ? '🔔 변호사 컨펌 대기 중' :
                                 reviewStatus === 'LAWYER_APPROVED' ? '✅ 변호사 컨펌 완료' :
                                 reviewStatus === 'LAWYER_REJECTED' ? '❌ 변호사 반려' : '컨펌 요청'}
                              </h5>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
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
                                  className="flex-1 py-2 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-colors active:scale-[0.98]"
                                >
                                  ❌ 반려
                                </button>
                                <button
                                  onClick={() => {
                                    setReviewStatus('LAWYER_APPROVED');
                                    addAuditLog('LAWYER_CONFIRMED', '변호사 컨펌 승인');
                                  }}
                                  className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* 초안 생성 전 안내 및 즉시 생성 플레이스홀더 */
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#1E3A5F] flex items-center justify-center mx-auto">
                          <Microscope className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-base text-slate-900">AI 사건 검토 초안 생성 대기</h4>
                          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                            우측 고객 원본 정보를 바탕으로 <strong>예상 월 변제금, 탕감률, 법적 쟁점</strong>을 AI가 즉시 심층 분석합니다.
                          </p>
                        </div>
                        <button
                          onClick={handleRunCopilot}
                          disabled={isRunning}
                          className="bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer inline-flex items-center gap-2"
                        >
                          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          <span>⚡ 지금 검토 초안 생성하기</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ══════════════════════════════════════════════════════════ */}
                  {/* 우측 패널 (xl:col-span-7): 고객이 입력한 원본 정보 */}
                  {/* ══════════════════════════════════════════════════════════ */}
                  <div className="xl:col-span-7 space-y-3.5">
                    <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-700" />
                      <span>고객이 입력한 원본 정보</span>
                    </h4>

                    {/* 1. 기본 정보 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">👤 기본 정보</h5>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                        {[
                          { label: '의뢰인명', value: fp.clientName || consultRequest.clientName || consultRequest.client_name || '-' },
                          { label: '연락처', value: fp.clientPhone || consultRequest.phone || '-' },
                          { label: '나이', value: fp.age ? `${fp.age}세` : '-' },
                          { label: '성별', value: fp.gender === 'male' ? '남성' : fp.gender === 'female' ? '여성' : '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
                        {[
                          { label: '혼인 상태', value: fp.maritalStatus === 'MARRIED' || fp.maritalStatus === 'married' ? '기혼' : fp.maritalStatus === 'DIVORCED' || fp.maritalStatus === 'divorced' ? '이혼' : fp.maritalStatus === 'SINGLE' || fp.maritalStatus === 'single' ? '미혼' : '-' },
                          { label: '미성년 자녀', value: fp.minorChildren != null ? `${fp.minorChildren}명` : `${fp.dependents || 0}명` },
                          { label: '거주지', value: fp.residence || fp.residenceRegion || fp.address || '-' },
                          { label: '거주 형태', value: fp.housingType === 'rent' ? '월세' : fp.housingType === 'jeonse' ? '전세' : fp.housingType === 'owned' ? '자가' : fp.housingType === 'free' ? '무상거주' : fp.housingType || '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. 소득 및 직업 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">💼 소득 및 직업</h5>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                        {[
                          { label: '월 소득', value: fmtMoney(fp.income || fp.monthlyIncome || 0) },
                          { label: '직업 유형', value: fp.jobType === 'SALARIED' ? '급여소득자' : fp.jobType === 'BUSINESS' ? '자영업' : fp.jobType === 'DAILY' ? '일용직' : fp.jobType === 'FREELANCER' ? '프리랜서' : fp.employmentType || fp.incomeType || '-' },
                          { label: '근무지', value: fp.workLocation || '-' },
                          { label: '배우자 소득', value: fp.spouseIncome ? fmtMoney(fp.spouseIncome) : '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tracking-tight tabular-nums">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. 채무 요약 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">🔴 채무 요약</h5>
                        <span className="text-xs text-slate-400">상세 → '채무현황' 탭</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                        {[
                          { label: '총 채무', value: fmtMoney(fp.debtTotal || 0), highlight: true },
                          { label: '채권자 수', value: fp.creditorCount ? `${fp.creditorCount}개` : `${(fp.debts || []).length}개` },
                          { label: '채무 원인', value: fp.debtCause === 'LIVING' ? '생활비' : fp.debtCause === 'BUSINESS' ? '사업' : fp.debtCause === 'INVESTMENT' ? '투자' : fp.debtCause === 'GUARANTEE' ? '보증' : fp.debtCause === 'GAMBLING' ? '도박' : fp.debtCause || '-' },
                          { label: '독촉/법적조치', value: fp.harassmentLevel === 'CALL' ? '독촉 전화' : fp.harassmentLevel === 'LETTER' ? '내용증명' : fp.harassmentLevel === 'LAWSUIT' ? '소송' : fp.harassmentLevel === 'SEIZURE' ? '압류' : fp.harassmentLevel || '-' },
                        ].map((item: any, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className={`text-sm font-black mt-0.5 tracking-tight tabular-nums ${item.highlight ? 'text-slate-900 text-base' : 'text-slate-900'}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. 자산 현황 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">🏦 자산 현황</h5>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                        {[
                          { label: '총 자산', value: fmtMoney(fp.assetsTotal || 0) },
                          { label: '본인 재산', value: fp.myAssets ? `${fp.myAssets}만원` : '-' },
                          { label: '배우자 자산', value: fp.spouseAsset ? `${fp.spouseAsset}만원` : '-' },
                          { label: '임대보증금', value: fp.rentalDeposit ? `${fp.rentalDeposit}만원` : '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tracking-tight tabular-nums">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
                        {[
                          { label: '퇴직금', value: fp.retirementPay ? `${fp.retirementPay}만원` : '-' },
                          { label: '퇴직연금', value: fp.retirementPensionType === 'pension' ? '가입' : fp.retirementPensionType === 'none' ? '미가입' : fp.retirementPensionType === 'unknown' ? '모름' : '-' },
                          { label: '주택 명의', value: fp.housingContractHolder === 'self' ? '본인' : fp.housingContractHolder === 'spouse' ? '배우자' : fp.housingContractHolder || '-' },
                          { label: '보증금 대출', value: fp.depositLoan ? `${fp.depositLoan}만원` : '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tracking-tight tabular-nums">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {fp.assets && fp.assets.length > 0 && (
                        <table className="w-full text-xs border-t border-slate-100">
                          <thead><tr className="bg-slate-50 text-slate-500">
                            <th className="px-3 py-1.5 text-left font-bold text-xs">자산명</th>
                            <th className="px-3 py-1.5 text-right font-bold text-xs">시장가</th>
                            <th className="px-3 py-1.5 text-center font-bold text-xs">유형</th>
                          </tr></thead>
                          <tbody>
                            {fp.assets.map((a: any, i: number) => (
                              <tr key={i} className="border-t border-slate-50">
                                <td className="px-3 py-1.5 text-slate-700 font-bold">{a.label || a.description || `자산 ${i+1}`}</td>
                                <td className="px-3 py-1.5 text-right font-black text-slate-900">{fmtMoney(a.marketValue || a.value || 0)}</td>
                                <td className="px-3 py-1.5 text-center"><span className="bg-slate-100 rounded-lg px-2 py-0.5 text-xs font-bold">{a.type || '-'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* 5. 생활비 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">🏠 월 생활비</h5>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
                        {[
                          { label: '월세', value: fp.rentCost ? `${fp.rentCost}만` : fp.monthlyRent ? fmtMoney(fp.monthlyRent) : '-' },
                          { label: '의료비', value: fp.medicalCost ? `${fp.medicalCost}만` : '-' },
                          { label: '교육비', value: fp.educationCost ? `${fp.educationCost}만` : '-' },
                          { label: '합계', value: fp.monthlyExpense ? fmtMoney(fp.monthlyExpense) : fp.livingCost ? fmtMoney(fp.livingCost) : '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tracking-tight tabular-nums">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6. 특이사항 */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-700">⚠️ 특이사항 및 전달사항</h5>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-slate-100">
                        {[
                          { label: '24개월 특례', value: fp.specialCondition === 'basic_recipient' ? '기초수급자' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'elderly' ? '고령자' : '해당없음' },
                          { label: '상담 유형', value: consultRequest.consultType || consultRequest.request_type || consultRequest.requestType || '-' },
                          { label: '요청일', value: consultRequest.createdAt?.split('T')[0] || consultRequest.created_at?.split('T')[0] || '-' },
                        ].map((item, i) => (
                          <div key={i} className="px-3.5 py-2.5 text-left">
                            <p className="text-xs font-bold text-slate-400">{item.label}</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {(fp.clientNote || (fp.clientNotes && fp.clientNotes.length > 0)) && (
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-left">
                          <p className="text-xs text-slate-500 font-bold mb-1">의뢰인 전달 메모</p>
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{fp.clientNote || (fp.clientNotes || []).join('\n')}</p>
                        </div>
                      )}
                    </div>

                  </div>
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
          aiAnalysis={factOutput && ruleOutput ? {
            factSummary: factOutput.factSummary,
            riskFlags: ruleOutput.flags,
            missingFields: factOutput.missingFields,
            conflicts: factOutput.conflicts,
            reviewGrade: ruleOutput.reviewGrade,
            courtPracticeNotes: ruleOutput.courtPracticeNotes,
          } : undefined}
          onSendProposal={(proposalData) => {
            // 채팅 연동: 부모(LawyerRole)의 handleSubmitProposalFromDraft 호출
            if (onProposalSent && consultRequest?.id) {
              onProposalSent(consultRequest.id, proposalData);
            }
            setShowRehabReport(false);
            addAuditLog('PROPOSAL_INITIATED', `제안서 발송 - 수임료: ${proposalData.fees.totalFee}원, 의견: ${proposalData.lawyerOpinion.substring(0, 50)}...`);
          }}
          onRequestConfirm={(proposalData, memo) => {
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
