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
  loadBankruptcyCase,
  saveBankruptcyCase
} from '../../../services/companionService';
import { SegmentedTabs } from '../ui';
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
  /** clientId로 저장된 기록이 없을 때 차례로 찾아볼 예전 저장 키 (예: 최상위 회생동행 탭에서 쓰던 의뢰인 ID) */
  fallbackClientIds?: string[];
  /** 마이페이지 탭 안에 넣을 때 (바깥 여백을 줄인다) */
  embedded?: boolean;
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

/**
 * 기록이 없으면 예전 저장 키에서도 찾는다.
 * 예전 키에서 찾으면 지금 키(clientId)로 옮겨 저장한다 — 납부 기록 저장이 clientId 키로만 사건을 찾기 때문
 * (이전: 예전 키의 사건은 화면에는 보이지만 납부 기록을 저장하면 '사건 정보를 찾지 못해' 실패)
 */
function resolveRehabCaseWithFallback(clientId: string | undefined, alias: string, fallbackIds: string[] = []): RehabCompanionCase | null {
  const primary = resolveRehabCase(clientId, alias);
  if (primary) return primary;
  for (const id of fallbackIds) {
    if (!id || id === clientId) continue;
    const found = loadRehabCompanionCase(id);
    if (found) {
      if (clientId) saveRehabCompanionCase({ ...found, clientId }, clientId);
      return clientId ? { ...found, clientId } : found;
    }
  }
  return null;
}

function loadBankruptcyCaseWithFallback(clientId: string | undefined, fallbackIds: string[] = []): BankruptcyCompanionCase | null {
  const primary = loadBankruptcyCase(clientId);
  if (primary) return primary;
  for (const id of fallbackIds) {
    if (!id || id === clientId) continue;
    const found = loadBankruptcyCase(id);
    if (found) {
      if (clientId) saveBankruptcyCase(found, clientId);
      return found;
    }
  }
  return null;
}

type CompanionSubTab = 'dashboard' | 'support' | 'academy';
const SUB_TABS: { id: CompanionSubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: '대시보드', icon: <Layers className="w-4 h-4" aria-hidden="true" /> },
  { id: 'support', label: '공적 지원', icon: <HeartHandshake className="w-4 h-4" aria-hidden="true" /> },
  { id: 'academy', label: '회복 아카데미', icon: <BookOpen className="w-4 h-4" aria-hidden="true" /> },
];

export default function RehabCompanionView({
  userAlias = '회원',
  clientId,
  fallbackClientIds,
  embedded = false,
}: RehabCompanionViewProps) {
  const fallbackKey = (fallbackClientIds || []).join('|');
  const [activeSubTab, setActiveSubTab] = useState<CompanionSubTab>('dashboard');
  const [rehabCase, setRehabCase] = useState<RehabCompanionCase | null>(() => resolveRehabCaseWithFallback(clientId, userAlias, fallbackClientIds));
  const [bankruptcyCase, setBankruptcyCase] = useState<BankruptcyCompanionCase | null>(() => loadBankruptcyCaseWithFallback(clientId, fallbackClientIds));
  // 저장된 사건 유형에 맞춰 시작 모드 결정
  const [caseTypeMode, setCaseTypeMode] = useState<'rehab' | 'bankruptcy'>(() => (!rehabCase && bankruptcyCase ? 'bankruptcy' : 'rehab'));

  const refreshData = useCallback(() => {
    setRehabCase(resolveRehabCaseWithFallback(clientId, userAlias, fallbackClientIds));
    setBankruptcyCase(loadBankruptcyCaseWithFallback(clientId, fallbackClientIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, userAlias, fallbackKey]);

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
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center mx-auto">
        <Scale className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900">
          {kind === 'rehab' ? '등록된 개인회생 사건이 없어요' : '등록된 개인파산 사건이 없어요'}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto break-keep">
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
    <div className={embedded ? 'space-y-6 text-left' : 'max-w-5xl mx-auto space-y-6 animate-fadeIn text-left pb-16'}>

      {/* ═══ 상단 메뉴: 탭(모바일에서도 한 줄) · 대시보드일 때만 사건 유형 전환 ═══
          (이전: 탭 3개 + '사건 등록'이 한 줄에서 잘리고, 사건이 없을 때 '사건 등록'이 빈 화면의 '내 사건 등록하기'와 겹침) */}
      <div className="space-y-3">
        <SegmentedTabs<CompanionSubTab>
          tabs={SUB_TABS.map(t => ({ id: t.id, label: t.label, icon: <span className="hidden sm:inline-flex">{t.icon}</span> }))}
          value={activeSubTab}
          onChange={setActiveSubTab}
          ariaLabel="회생동행 메뉴"
          idPrefix="companion"
        />
        {activeSubTab === 'dashboard' && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-full sm:w-fit" role="group" aria-label="사건 유형">
            {([
              { id: 'rehab', label: '개인회생' },
              { id: 'bankruptcy', label: '개인파산·면책' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={caseTypeMode === opt.id}
                onClick={() => setCaseTypeMode(opt.id)}
                className={`flex-1 sm:flex-none px-4 min-h-11 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                  caseTypeMode === opt.id ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 탭 컨텐츠 ═══ */}
      <div role="tabpanel" id={`companion-panel-${activeSubTab}`} aria-labelledby={`companion-tab-${activeSubTab}`}>
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
              onOpenRegisterModal={() => setIsRegisterOpen(true)}
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
      </div>

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
