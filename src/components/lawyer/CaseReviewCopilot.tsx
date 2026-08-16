import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle, FileText, DollarSign, AlertCircle, Scale, StickyNote,
  Gavel, Send, History, ChevronRight, CheckCircle2, XCircle, Clock,
  Search, RefreshCw, Eye, ShieldCheck, FileWarning, Info, Loader2, Settings, MessageSquare
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
  onClose?: () => void;
}

// Sample test clients for demo
const SAMPLE_CLIENTS: any[] = [
  {
    id: 'sample-1', clientName: '김영희', phone: '010-1234-5678', status: 'counseling',
    consultType: 'direct_multi', createdAt: '2026-08-10T09:00:00Z',
    financialProfile: {
      income: 280, debtTotal: 12000, assetsTotal: 500,
      dependents: 1, age: 42, residence: '서울특별시 강남구',
      maritalStatus: 'married', minorChildren: 1,
      incomeType: 'worker',
      monthlyExpense: 180, monthlyRent: 50,
      debts: [
        { creditor: '신한은행', principal: 4500, interest: 320, type: 'unsecured' },
        { creditor: 'KB카드', principal: 2800, interest: 180, type: 'unsecured' },
        { creditor: '삼성카드', principal: 1500, interest: 95, type: 'unsecured' },
        { creditor: '현대캐피탈', principal: 3200, interest: 250, type: 'unsecured' },
      ],
      assets: [
        { type: 'deposit', label: '예금', marketValue: 200 },
        { type: 'insurance', label: '보험 해약괈', marketValue: 300, isExempt: true },
      ],
    },
  },
  {
    id: 'sample-2', clientName: '박준혁', phone: '010-9876-5432', status: 'counseling',
    consultType: 'ai_chat', createdAt: '2026-08-12T14:30:00Z',
    financialProfile: {
      income: 180, debtTotal: 25000, assetsTotal: 0,
      dependents: 0, age: 35, residence: '경기도 수원시',
      maritalStatus: 'single', minorChildren: 0,
      incomeType: 'selfEmployed',
      monthlyExpense: 120, monthlyRent: 40,
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
  | 'client-info' | 'debt-status' | 'missing-info' | 'review-flags'
  | 'court-notes' | 'staff-memo' | 'lawyer-opinion' | 'approval' | 'audit-log';

const COPILOT_TABS: { key: CopilotTab; label: string; icon: React.ReactNode; requiresLawyer?: boolean; requiresOwner?: boolean }[] = [
  { key: 'client-info', label: '고객 입력정보', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'debt-status', label: '채무현황', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: 'missing-info', label: '누락정보', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { key: 'review-flags', label: '내부 검토 플래그', icon: <FileWarning className="w-3.5 h-3.5" /> },
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
  consultRequest: singleRequest, consultRequests, tenantId, actorId, actorRole, actorName, onClose
}: CaseReviewCopilotProps) {
  const permissions = useCopilotPermissions(actorRole as StaffRole);

  // Build selectable client list
  const allClients = React.useMemo(() => {
    const fromProps = consultRequests || (singleRequest ? [singleRequest] : []);
    const propsIds = new Set(fromProps.map((r: any) => r.id));
    const samples = SAMPLE_CLIENTS.filter(s => !propsIds.has(s.id));
    return [...fromProps, ...samples];
  }, [consultRequests, singleRequest]);

  const [selectedClientIdx, setSelectedClientIdx] = useState<number>(-1);
  const consultRequest = selectedClientIdx >= 0 ? allClients[selectedClientIdx] : null;

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

      addAuditLog('REVIEW_CREATED', '검토 초안 생성');
      addAuditLog('FACT_SNAPSHOT_CREATED', '사실 스냅샷 저장');
      addAuditLog('RULE_EXECUTED', `${rOut.flags.length}개 플래그 생성`);

      // 초안 생성 완료 후 채무현황 탭으로 자동 이동
      setActiveTab('debt-status');
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

  if (!consultRequest) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn">
        <Search className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">검토할 의뢰인을 선택하세요</h3>
        <p className="text-sm text-slate-500 mb-6">아래 목록에서 의뢰인을 선택하면 사건검토 코파일럿이 시작됩니다.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
          {allClients.map((client, idx) => {
            const fp = client.financialProfile || {};
            return (
              <button key={client.id} onClick={() => setSelectedClientIdx(idx)}
                className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-brand hover:shadow-md active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-extrabold text-sm">
                    {(client.clientName || client.client_name || '?')[0]}
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">{client.clientName || client.client_name}</p>
                    <p className="text-[10px] text-slate-400">{client.consultType} · {client.id.startsWith('sample') ? '샘플 데이터' : '실제 상담'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-red-50 rounded p-1"><span className="text-red-400 block">총 채무</span><span className="font-bold text-red-600">{(fp.debtTotal || 0).toLocaleString()}만</span></div>
                  <div className="bg-blue-50 rounded p-1"><span className="text-blue-400 block">월 소득</span><span className="font-bold text-blue-600">{fp.income || 0}만</span></div>
                  <div className="bg-slate-50 rounded p-1"><span className="text-slate-400 block">채권자</span><span className="font-bold text-slate-700">{(fp.debts || []).length}개</span></div>
                </div>
              </button>
            );
          })}
        </div>
        {allClients.length === 0 && (
          <p className="text-sm text-slate-400 mt-4">등록된 상담 요청이 없습니다. 신규 상담 요청 탭에서 상담을 먼저 생성하세요.</p>
        )}
      </div>
    );
  }

  return (
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
              { step: 1, label: '자동 분석', done: !!factOutput, tabs: ['client-info', 'debt-status', 'missing-info', 'review-flags', 'court-notes'] },
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
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-brand" /> 고객이 입력한 원본 정보</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: '총 채무', value: fmtMoney(fp.debtTotal || 0) },
                      { label: '월 소득', value: fmtMoney(fp.income || fp.monthlyIncome || 0) },
                      { label: '부양가족', value: `${fp.dependents || 0}명` },
                      { label: '거주지', value: fp.residence || fp.address || '-' },
                      { label: '연체 상태', value: fp.delinquencyStatus || fp.q1_status || '-' },
                      { label: '상담 유형', value: consultRequest.request_type || consultRequest.requestType || '-' },
                      { label: '요청일', value: consultRequest.created_at?.split('T')[0] || '-' },
                      { label: '채권자 수', value: `${(fp.debts || []).length || '-'}개` },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-0.5">
                        <p className="text-[11px] text-slate-400 font-bold">{item.label}</p>
                        <p className="text-sm font-extrabold text-slate-800">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {fp.debts && fp.debts.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-600 mb-2 mt-4">채권자별 채무 내역</h5>
                      <div className="bg-slate-50 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-100 text-slate-500">
                            <th className="p-2 text-left font-bold">채권자</th>
                            <th className="p-2 text-right font-bold">원금</th>
                            <th className="p-2 text-center font-bold">유형</th>
                          </tr></thead>
                          <tbody>
                            {fp.debts.map((d: any, i: number) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="p-2 text-slate-700">{d.creditor || d.name || `채권자 ${i+1}`}</td>
                                <td className="p-2 text-right font-bold text-slate-800">{fmtMoney(d.principal || d.amount || 0)}</td>
                                <td className="p-2 text-center"><span className="bg-slate-200 rounded-lg px-1.5 py-0.5 text-[10px] font-bold">{d.type || 'unsecured'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: 채무현황 */}
              {activeTab === 'debt-status' && factOutput && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><DollarSign className="w-4 h-4 text-brand" /> Fact Engine 채무 분석</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-0.5">
                        <p className="text-[11px] text-slate-400 font-bold">{item.label}</p>
                        <p className={`text-sm font-extrabold ${item.color || 'text-slate-800'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {factOutput.factSummary.assets && (
                    <div className="bg-slate-50 rounded-xl p-4 mt-2">
                      <p className="text-xs font-bold text-slate-600 mb-2">자산 요약</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-slate-400">총 시가:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.totalMarketValue)}</span></div>
                        <div><span className="text-slate-400">담보대출:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.totalLoanBalance)}</span></div>
                        <div><span className="text-slate-400">순자산:</span> <span className="font-bold">{fmtMoney(factOutput.factSummary.assets.netAssetValue)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: 누락정보 */}
              {activeTab === 'missing-info' && factOutput && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> 누락정보 및 입력값 확인</h4>
                  {factOutput.missingFields.length === 0 && factOutput.conflicts.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-700 font-bold">모든 주요 정보가 입력되었습니다.</p>
                    </div>
                  ) : (
                    <>
                      {factOutput.missingFields.map((f, i) => (
                        <div key={i} className={`rounded-xl p-3 flex items-start gap-3 border ${
                          f.importance === 'required' ? 'bg-red-50 border-red-200' :
                          f.importance === 'recommended' ? 'bg-amber-50 border-amber-200' :
                          'bg-slate-50 border-slate-200'
                        }`}>
                          <div className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold shrink-0 mt-0.5 ${
                            f.importance === 'required' ? 'bg-red-100 text-red-700' :
                            f.importance === 'recommended' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {f.importance === 'required' ? '필수' : f.importance === 'recommended' ? '권장' : '선택'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{f.fieldLabel}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                          </div>
                        </div>
                      ))}
                      {factOutput.conflicts.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold text-slate-600 mb-2">⚠️ 입력값 불일치</p>
                          {factOutput.conflicts.map((c, i) => (
                            <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-2">
                              <p className="text-sm font-bold text-orange-800">{c.description}</p>
                              <p className="text-xs text-orange-600 mt-0.5">{c.fieldA} ↔ {c.fieldB}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: 내부 검토 플래그 */}
              {activeTab === 'review-flags' && ruleOutput && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
                    <FileWarning className="w-4 h-4 text-red-500" /> 내부 검토 플래그
                    {ruleOutput.reviewGrade !== 'NORMAL_REVIEW' && (
                      <span className="bg-red-100 text-red-700 rounded-lg px-2 py-0.5 text-[10px] font-extrabold ml-2">
                        {ruleOutput.reviewGrade === 'ENHANCED_REVIEW' ? '⚡ 강화 검토' : '🔴 이중 검토 권장'}
                      </span>
                    )}
                  </h4>
                  {ruleOutput.flags.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-700 font-bold">특별한 검토 플래그가 없습니다.</p>
                    </div>
                  ) : (
                    ruleOutput.flags.map((flag, i) => {
                      const ftCfg = FLAG_TYPE_CONFIG[flag.flagType] || FLAG_TYPE_CONFIG.INFO;
                      return (
                        <div key={i} className={`rounded-xl p-4 border-l-4 bg-white border border-slate-200 ${
                          flag.flagType === 'HIGH_RISK' ? 'border-l-red-500' :
                          flag.flagType === 'CAUTION' ? 'border-l-amber-500' :
                          flag.flagType === 'ADDITIONAL_CHECK' ? 'border-l-blue-500' :
                          'border-l-slate-300'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${ftCfg.bgColor} ${ftCfg.color}`}>
                                  {ftCfg.emoji} {ftCfg.label}
                                </span>
                                {flag.sourceType && (
                                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${RULE_SOURCE_TYPE_CONFIG[flag.sourceType]?.color || 'text-slate-500'} bg-slate-100`}>
                                    {RULE_SOURCE_TYPE_CONFIG[flag.sourceType]?.emoji} {RULE_SOURCE_TYPE_CONFIG[flag.sourceType]?.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-slate-800 mt-1">{flag.message}</p>

                              {/* 근거 추적 정보 */}
                              {flag.usedInputValues && Object.keys(flag.usedInputValues).length > 0 && (
                                <div className="mt-2 bg-slate-50 rounded-lg p-2.5 space-y-1">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase">사용된 입력값</p>
                                  {Object.entries(flag.usedInputValues).map(([k, v]) => (
                                    <p key={k} className="text-xs text-slate-600">
                                      <span className="text-slate-400">{k}:</span> <span className="font-bold">{typeof v === 'number' ? fmtMoney(v) : String(v)}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                              {flag.appliedRuleName && (
                                <p className="text-[10px] text-slate-400 mt-2">적용 기준: {flag.appliedRuleName} v{flag.appliedRuleVersion}</p>
                              )}
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 rounded-lg px-2 py-1 text-[10px] font-extrabold shrink-0">
                              담당 변호사 검토 필요
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {ruleOutput.additionalQuestions.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2">
                      <p className="text-xs font-bold text-blue-700 mb-2">📋 추가 질문</p>
                      <ul className="space-y-1">{ruleOutput.additionalQuestions.map((q, i) => <li key={i} className="text-xs text-blue-600">• {q}</li>)}</ul>
                    </div>
                  )}
                  {ruleOutput.requiredDocuments.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-2">
                      <p className="text-xs font-bold text-purple-700 mb-2">📄 필요 서류</p>
                      <ul className="space-y-1">{ruleOutput.requiredDocuments.map((d, i) => <li key={i} className="text-xs text-purple-600">• {d}</li>)}</ul>
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
  );
}
