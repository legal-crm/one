import React, { useState, useEffect } from 'react';
import { 
  RehabCompanionCase, 
  BankruptcyCompanionCase, 
  RepaymentRoundItem 
} from '../../../types';
import { 
  loadRehabCompanionCase, 
  saveRehabCompanionCase,
  loadBankruptcyCase 
} from '../../../services/companionService';
import CompanionDashboard from './CompanionDashboard';
import BankruptcyCompanionDashboard from './BankruptcyCompanionDashboard';
import SupportCenterTab from './SupportCenterTab';
import RecoveryAcademyTab from './RecoveryAcademyTab';
import CaseRegistrationModal from './CaseRegistrationModal';
import RepaymentPaymentModal from './RepaymentPaymentModal';
import LifeCrisisModal from './LifeCrisisModal';
import { Sparkles, Scale, HeartHandshake, BookOpen, Layers, ShieldCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface RehabCompanionViewProps {
  userAlias?: string;
  onNavigateToChat?: (reqId?: string) => void;
  onNavigateToLawyers?: () => void;
}

export default function RehabCompanionView({
  userAlias = '회원',
  onNavigateToChat,
  onNavigateToLawyers
}: RehabCompanionViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'support' | 'academy'>('dashboard');
  const [caseTypeMode, setCaseTypeMode] = useState<'rehab' | 'bankruptcy'>('rehab');
  
  const [rehabCase, setRehabCase] = useState<RehabCompanionCase>(() => loadRehabCompanionCase());
  const [bankruptcyCase, setBankruptcyCase] = useState<BankruptcyCompanionCase>(() => loadBankruptcyCase());
  
  // 모달 상태
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [selectedRoundItem, setSelectedRoundItem] = useState<RepaymentRoundItem | null>(null);

  const refreshData = () => {
    setRehabCase(loadRehabCompanionCase());
    setBankruptcyCase(loadBankruptcyCase());
  };

  const handleOpenPaymentModal = (roundItem: RepaymentRoundItem) => {
    setSelectedRoundItem(roundItem);
    setIsPaymentOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left pb-16">
      
      {/* ═══ 상단 모드 전환 & 서브 네비게이션 ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 px-4 shadow-sm">
        
        {/* 회생/파산 듀얼 모드 토글 */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setCaseTypeMode('rehab')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              caseTypeMode === 'rehab'
                ? 'bg-white dark:bg-slate-900 text-brand shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🌱 개인회생동행 (3~5년 변제)
          </button>
          <button
            type="button"
            onClick={() => setCaseTypeMode('bankruptcy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              caseTypeMode === 'bankruptcy'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🕊️ 개인파산·면책동행
          </button>
        </div>

        {/* 3대 서브 탭 */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'dashboard'
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>동행 대시보드</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('support')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'support'
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>공적 지원센터</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('academy')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'academy'
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>회복 아카데미</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className="ml-2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-brand transition-all flex items-center gap-1 cursor-pointer shrink-0"
            title="새 사건 등록"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>사건 등록</span>
          </button>
        </div>

      </div>

      {/* ═══ 탭 컨텐츠 렌더링 ═══ */}
      {activeSubTab === 'dashboard' && (
        caseTypeMode === 'rehab' ? (
          <CompanionDashboard
            caseData={rehabCase}
            onOpenPaymentModal={handleOpenPaymentModal}
            onOpenCrisisModal={() => setIsCrisisOpen(true)}
            onOpenRegisterModal={() => setIsRegisterOpen(true)}
            onUpdateCashflow={(updated) => {
              const updatedCase = {
                ...rehabCase,
                cashflow: updated
              };
              saveRehabCompanionCase(updatedCase);
              setRehabCase(updatedCase);
            }}
            onNavigateToSupport={() => setActiveSubTab('support')}
          />
        ) : (
          <BankruptcyCompanionDashboard
            caseData={bankruptcyCase}
            onOpenCrisisModal={() => setIsCrisisOpen(true)}
          />
        )
      )}

      {activeSubTab === 'support' && (
        <SupportCenterTab caseData={rehabCase} />
      )}

      {activeSubTab === 'academy' && (
        <RecoveryAcademyTab />
      )}

      {/* ═══ 모달 레이어 ═══ */}
      <CaseRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={refreshData}
        initialAlias={userAlias}
      />

      <RepaymentPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={refreshData}
        roundItem={selectedRoundItem}
        courtVirtualAccount={rehabCase.courtVirtualAccount}
      />

      <LifeCrisisModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        caseId={rehabCase.id}
        onNavigateToSupport={() => {
          setIsCrisisOpen(false);
          setActiveSubTab('support');
        }}
      />

    </div>
  );
}
