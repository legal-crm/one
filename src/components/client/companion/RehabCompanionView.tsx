import React, { useState, useEffect, useCallback } from 'react';
import {
  RehabCompanionCase,
  BankruptcyCompanionCase,
  RepaymentRoundItem
} from '../../../types';
import {
  loadRehabCompanionCase,
  saveRehabCompanionCase,
  syncCompanionWithCrmCase,
  loadBankruptcyCase
} from '../../../services/companionService';
import CompanionDashboard from './CompanionDashboard';
import BankruptcyCompanionDashboard from './BankruptcyCompanionDashboard';
import SupportCenterTab from './SupportCenterTab';
import RecoveryAcademyTab from './RecoveryAcademyTab';
import CaseRegistrationModal from './CaseRegistrationModal';
import RepaymentPaymentModal from './RepaymentPaymentModal';
import LifeCrisisModal from './LifeCrisisModal';
import { HeartHandshake, BookOpen, Layers, Plus, Scale } from 'lucide-react';
import { secureGetItem } from '../../../utils/secureStorage';

interface RehabCompanionViewProps {
  userAlias?: string;
  clientId?: string;
  onNavigateToChat?: (reqId?: string) => void;
  onNavigateToLawyers?: () => void;
}

/** CRM(담당 변호사 등록 정보)이 있으면 동기화, 없으면 이 기기에 저장된 사건 — 둘 다 없으면 null */
function resolveRehabCase(clientId: string | undefined, alias: string): RehabCompanionCase | null {
  if (clientId) {
    try {
      const raw = secureGetItem('legal_crm_data');
      const crmData = raw ? JSON.parse(raw) : {};
      const ext = crmData[clientId];
      if (ext && (ext.courtCase || ext.decisionSummary || ext.repaymentPlan)) {
        return syncCompanionWithCrmCase(clientId, ext, alias);
      }
    } catch { /* ignore */ }
  }
  return loadRehabCompanionCase(clientId);
}

const TAB_BASE = 'px-3.5 min-h-[44px] rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap';

export default function RehabCompanionView({
  userAlias = '회원',
  clientId,
}: RehabCompanionViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'support' | 'academy'>('dashboard');
  const [rehabCase, setRehabCase] = useState<RehabCompanionCase | null>(() => resolveRehabCase(clientId, userAlias));
  const [bankruptcyCase, setBankruptcyCase] = useState<BankruptcyCompanionCase | null>(() => loadBankruptcyCase(clientId));
  // 저장된 사건 유형에 맞춰 시작 모드 결정
  const [caseTypeMode, setCaseTypeMode] = useState<'rehab' | 'bankruptcy'>(() => (!rehabCase && bankruptcyCase ? 'bankruptcy' : 'rehab'));

  const refreshData = useCallback(() => {
    setRehabCase(resolveRehabCase(clientId, userAlias));
    setBankruptcyCase(loadBankruptcyCase(clientId));
  }, [clientId, userAlias]);

  useEffect(() => {
    refreshData();
    window.addEventListener('legal_crm_data_updated', refreshData);
    window.addEventListener('storage', refreshData);
    return () => {
      window.removeEventListener('legal_crm_data_updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, [refreshData]);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [selectedRoundItem, setSelectedRoundItem] = useState<RepaymentRoundItem | null>(null);

  const handleOpenPaymentModal = (roundItem: RepaymentRoundItem) => {
    setSelectedRoundItem(roundItem);
    setIsPaymentOpen(true);
  };

  const emptyState = (kind: 'rehab' | 'bankruptcy') => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
        <Scale className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          {kind === 'rehab' ? '등록된 개인회생 사건이 없습니다' : '등록된 개인파산 사건이 없습니다'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          사건번호와 {kind === 'rehab' ? '변제 조건(월 변제금·납부일·회차)' : '관할 법원'}을 등록하면 납부 일정과 절차 진행을 이곳에서 관리할 수 있습니다.
          마이김변 변호사에게 사건을 맡기셨다면, 담당 변호사가 사건 정보를 입력하는 대로 자동으로 표시됩니다.
        </p>
      </div>
      <button
        type="button"
        onClick={() => { setCaseTypeMode(kind); setIsRegisterOpen(true); }}
        className="inline-flex items-center gap-1.5 px-5 min-h-[44px] bg-brand hover:bg-brand-hover text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>내 사건 등록하기</span>
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left pb-16">

      {/* ═══ 상단 모드 전환 & 서브 네비게이션 ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 px-4 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl" role="group" aria-label="사건 유형">
          <button
            type="button"
            aria-pressed={caseTypeMode === 'rehab'}
            onClick={() => setCaseTypeMode('rehab')}
            className={`px-3.5 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              caseTypeMode === 'rehab' ? 'bg-white dark:bg-slate-900 text-brand shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            🌱 개인회생동행
          </button>
          <button
            type="button"
            aria-pressed={caseTypeMode === 'bankruptcy'}
            onClick={() => setCaseTypeMode('bankruptcy')}
            className={`px-3.5 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              caseTypeMode === 'bankruptcy' ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            🕊️ 개인파산·면책동행
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="동행 메뉴">
          {([
            { id: 'dashboard', label: '동행 대시보드', icon: Layers },
            { id: 'support', label: '공적 지원센터', icon: HeartHandshake },
            { id: 'academy', label: '회복 아카데미', icon: BookOpen },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`${TAB_BASE} ${activeSubTab === t.id ? 'bg-brand text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className={`${TAB_BASE} ml-2 px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>사건 등록</span>
          </button>
        </div>
      </div>

      {/* ═══ 탭 컨텐츠 ═══ */}
      {activeSubTab === 'dashboard' && (
        caseTypeMode === 'rehab' ? (
          rehabCase ? (
            <CompanionDashboard
              caseData={rehabCase}
              clientId={clientId}
              onOpenPaymentModal={handleOpenPaymentModal}
              onOpenCrisisModal={() => setIsCrisisOpen(true)}
              onOpenRegisterModal={() => setIsRegisterOpen(true)}
              onUpdateCashflow={(updated) => {
                const updatedCase = { ...rehabCase, cashflow: updated };
                saveRehabCompanionCase(updatedCase, clientId);
                setRehabCase(updatedCase);
              }}
              onNavigateToSupport={() => setActiveSubTab('support')}
            />
          ) : emptyState('rehab')
        ) : (
          bankruptcyCase ? (
            <BankruptcyCompanionDashboard
              caseData={bankruptcyCase}
              clientId={clientId}
              onCaseUpdated={setBankruptcyCase}
              onOpenCrisisModal={() => setIsCrisisOpen(true)}
            />
          ) : emptyState('bankruptcy')
        )
      )}

      {activeSubTab === 'support' && (
        <SupportCenterTab caseData={rehabCase} />
      )}

      {activeSubTab === 'academy' && (
        <RecoveryAcademyTab />
      )}

      {/* ═══ 모달 ═══ */}
      <CaseRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={(registeredType) => {
          refreshData();
          setCaseTypeMode(registeredType === 'bankruptcy' ? 'bankruptcy' : 'rehab');
        }}
        initialAlias={userAlias}
        clientId={clientId}
        initialCaseType={caseTypeMode === 'bankruptcy' ? 'bankruptcy' : 'individual_rehab'}
      />

      <RepaymentPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={refreshData}
        roundItem={selectedRoundItem}
        courtVirtualAccount={rehabCase?.courtVirtualAccount || ''}
        clientId={clientId}
      />

      <LifeCrisisModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        caseId={rehabCase?.id || bankruptcyCase?.id || ''}
        clientId={clientId}
        onNavigateToSupport={() => {
          setIsCrisisOpen(false);
          setActiveSubTab('support');
        }}
      />
    </div>
  );
}
