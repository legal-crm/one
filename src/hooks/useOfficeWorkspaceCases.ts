// ============================================================
// 상담 요청이 없는 사건(직접 등록·영업 리드 이관)을 사건 관리 화면용 상담 요청 모양으로 만든다 (CM·SL)
// 원본은 서버 cases·office_clients, 재무 요약은 crm_clients.extension_data.externalProfile.
// (이전: 화면 메모리에만 가짜 상담 요청을 만들어 새로고침·다른 기기에서 사건이 사라졌다)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import {
  OFFICE_CASES_CHANGED_EVENT,
  listOfficeWorkspaceCases,
  workspaceKeyForCase,
  type CaseRecord,
  type OfficeClient,
} from '../services/cases/caseCoreService';
import { serverStageToCrmStatus } from '../services/cases/caseStageMapping';
import { getCrmExt } from '../services/crmService';
import type { ConsultRequest, ConsultStatus, FinancialProfile } from '../types';

export function emptyFinancialProfile(clientName: string): FinancialProfile {
  return {
    clientName, age: 0, gender: undefined as any, maritalStatus: undefined as any, dependents: 0, minorChildren: 0,
    income: 0, debtTotal: 0, priorityDebt: 0, assetsTotal: 0, creditorCount: 0, jobType: undefined as any,
    companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: '', workLocation: '',
    housingType: undefined as any, housingContractHolder: 'self', debtCause: undefined as any, harassmentLevel: undefined as any,
    debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 }, legalActions: [], myAssets: 0,
    spouseAsset: 0, spouseIncome: 0, rentalDeposit: 0, depositLoan: 0, rentCost: 0, medicalCost: 0, educationCost: 0,
    monthlyFixedExpenses: 0, retirementPay: 0, retirementPensionType: 'none', specialCondition: 'none', riskFlags: [],
    clientNotes: [], debts: [], assets: [],
  } as FinancialProfile;
}

const SOURCE_PREFIX: Record<string, string> = { direct: '[직접]', sales_lead: '[영업]', import: '[가져옴]', conversion: '[전환]' };

function toConsultStatus(c: CaseRecord): ConsultStatus {
  const s = serverStageToCrmStatus(c.stage, c.closeReason);
  if (s === 'consulting') return 'counseling';
  if (s === 'cancelled') return 'cancelled';
  return s as ConsultStatus;
}

const savedProfile = (key: string) => (getCrmExt(key) as any)?.externalProfile as Partial<FinancialProfile> | undefined;

export function workspaceCaseToRequest(c: CaseRecord, client: OfficeClient | null, lawyerId: string): ConsultRequest {
  const key = workspaceKeyForCase(c);
  const name = client?.displayName || c.title || '의뢰인';
  const saved = savedProfile(key);
  return {
    id: key,
    clientId: key,
    clientName: name,
    realClientName: client?.realName || undefined,
    phone: client?.phone || '',
    requestType: 'direct',
    maxParticipants: 1,
    status: toConsultStatus(c),
    createdAt: c.createdAt,
    title: c.title || `${SOURCE_PREFIX[c.source] || ''} ${name} 사건`.trim(),
    content: '',
    caseType: (c.caseType === 'bankruptcy' ? '개인파산' : '개인회생') as any,
    createdByLawyerId: lawyerId,
    assignedLawyerId: lawyerId,
    financialProfile: { ...emptyFinancialProfile(name), ...(saved || {}), clientName: name },
  };
}

export function useOfficeWorkspaceCases(officeId: string | undefined) {
  const [rows, setRows] = useState<Array<{ case: CaseRecord; client: OfficeClient | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  // 사건 관리 데이터(재무 요약)를 늦게 불러오면 한 번 더 만든다. 실제로 바뀐 때만 올려 불필요한 다시 그리기를 막는다
  const [profileSig, setProfileSig] = useState('');
  useEffect(() => {
    const check = () => {
      const sig = rows.map(r => JSON.stringify(savedProfile(workspaceKeyForCase(r.case)) || null)).join('|');
      setProfileSig(prev => (prev === sig ? prev : sig));
    };
    check();
    window.addEventListener('legal_crm_data_updated', check);
    return () => window.removeEventListener('legal_crm_data_updated', check);
  }, [rows]);

  const refresh = useCallback(async () => {
    if (!officeId) { setRows([]); return; }
    const r = await listOfficeWorkspaceCases(officeId);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setRows(r.data);
  }, [officeId]);

  useEffect(() => {
    void refresh();
    const onChange = () => { void refresh(); };
    window.addEventListener(OFFICE_CASES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(OFFICE_CASES_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { rows, error, refresh, profileSig };
}
