// ============================================================
// 전자 계약 서비스
// Supabase 우선 + localStorage 폴백 하이브리드 동기화
// ============================================================

import type { ElectronicContract, ContractDocument, ContractDocType, ContractStatus, FeeInstallment } from '../types';
import { CONTRACT_DOC_TYPES } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const STORAGE_KEY = 'electronic_contracts';

function logSupabaseError(op: string, error: any) {
  console.error(`[Contract] ${op} 실패:`, error?.message || error);
}

function contractToRow(c: ElectronicContract) {
  return {
    id: c.id,
    client_id: c.clientId || '',
    client_name: c.clientName || '',
    client_phone: c.clientPhone || '',
    client_address: c.clientAddress || '',
    lawyer_name: c.lawyerName || '',
    law_firm_name: c.lawFirmName || '',
    assigned_lawyer_id: c.assignedLawyerId || null,
    total_fee: c.totalFee || 0,
    court_costs: c.courtCosts || 0,
    fee_schedule: c.feeSchedule || [],
    status: c.status || 'draft',
    contract_date: c.contractDate || null,
    documents: c.documents || [],
    audit_trail: c.auditTrail || [],
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

function rowToContract(row: any): ElectronicContract {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    lawyerName: row.lawyer_name,
    lawFirmName: row.law_firm_name,
    assignedLawyerId: row.assigned_lawyer_id,
    totalFee: row.total_fee,
    courtCosts: row.court_costs,
    feeSchedule: row.fee_schedule || [],
    status: row.status,
    contractDate: row.contract_date,
    documents: row.documents || [],
    auditTrail: row.audit_trail || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── CRUD ──

export function loadContractsLocal(): ElectronicContract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function loadContracts(): Promise<ElectronicContract[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('electronic_contracts').select('*').order('created_at', { ascending: false });
      if (error) logSupabaseError('loadContracts', error);
      else if (data && data.length > 0) return data.map(rowToContract);
    } catch (e) { logSupabaseError('loadContracts (exception)', e); }
  }
  return loadContractsLocal();
}

export async function saveContracts(contracts: ElectronicContract[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  if (isSupabaseConfigured && contracts.length > 0) {
    try {
      const { error } = await supabase.from('electronic_contracts').upsert(contracts.map(contractToRow), { onConflict: 'id' });
      if (error) logSupabaseError('saveContracts', error);
    } catch (e) { logSupabaseError('saveContracts (exception)', e); }
  }
}

export async function getContract(id: string): Promise<ElectronicContract | undefined> {
  const contracts = await loadContracts();
  return contracts.find(c => c.id === id);
}

export async function getContractsByClientId(clientId: string): Promise<ElectronicContract[]> {
  const contracts = await loadContracts();
  return contracts.filter(c => c.clientId === clientId);
}

export async function saveContract(contract: ElectronicContract): Promise<void> {
  // localStorage
  const localContracts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const idx = localContracts.findIndex((c: any) => c.id === contract.id);
  if (idx >= 0) localContracts[idx] = contract;
  else localContracts.unshift(contract);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localContracts));
  
  // Supabase
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('electronic_contracts').upsert(contractToRow(contract), { onConflict: 'id' });
      if (error) logSupabaseError('saveContract', error);
    } catch (e) { logSupabaseError('saveContract (exception)', e); }
  }
}

export async function deleteContract(id: string): Promise<void> {
  const contracts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts.filter((c: any) => c.id !== id)));
  
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('electronic_contracts').delete().eq('id', id);
      if (error) logSupabaseError('deleteContract', error);
    } catch (e) { logSupabaseError('deleteContract (exception)', e); }
  }
}

// ── 새 계약 생성 ──

export function createContract(data: {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress?: string;
  lawyerName: string;
  lawFirmName: string;
  assignedLawyerId?: string;
  totalFee?: number;
  courtCosts?: { creditorCount: number; deliveryFee: number; stampFee: number; miscFee: number };
  feeSchedule?: FeeInstallment[];
}): ElectronicContract {
  const now = new Date().toISOString();
  const localContracts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const id = `EC-${new Date().getFullYear()}-${String(localContracts.length + 1).padStart(4, '0')}`;

  // 기본 문서 세트 생성
  const documents = createDefaultDocuments(data.clientName, data.clientPhone, data.lawyerName, data.lawFirmName);

  const contract: ElectronicContract = {
    id,
    clientId: data.clientId,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    clientAddress: data.clientAddress,
    lawyerName: data.lawyerName,
    lawFirmName: data.lawFirmName,
    assignedLawyerId: data.assignedLawyerId,
    totalFee: data.totalFee ?? 0,
    courtCosts: data.courtCosts ?? { creditorCount: 0, deliveryFee: 0, stampFee: 30000, miscFee: 0 },
    feeSchedule: data.feeSchedule ?? [],
    documents,
    status: 'drafting',
    contractDate: new Date().toISOString().split('T')[0],
    auditTrail: [{ action: '계약서 작성 시작', timestamp: now, actor: 'lawyer' }],
    createdAt: now,
    updatedAt: now,
  };

  saveContract(contract);
  return contract;
}

// ── 기본 문서 세트 ──

function createDefaultDocuments(clientName: string, clientPhone: string, lawyerName: string, firmName: string): ContractDocument[] {
  const types: ContractDocType[] = ['main_contract', 'privacy_consent', 'third_party_consent', 'power_of_attorney', 'installment_agreement', 'procedure_consent', 'id_confirmation'];

  return types.map((type, i) => {
    const cfg = CONTRACT_DOC_TYPES[type];
    return {
      id: `doc-${Date.now()}-${i}`,
      type,
      title: cfg.label,
      content: generateDocContent(type, clientName, clientPhone, lawyerName, firmName),
      signatureRequired: cfg.signatureRequired,
      order: i,
      included: cfg.required,
    };
  });
}

// ── 문서 본문 생성 (예시 텍스트) ──

function generateDocContent(type: ContractDocType, clientName: string, phone: string, lawyerName: string, firmName: string): string {
  const templates: Record<string, string> = {
    main_contract: `개인회생/파산 사건 위임 계약서

위임인 (갑): ${clientName} (연락처: ${phone})
수임인 (을): ${firmName} ${lawyerName}

위임인(이하 '갑')과 수임인(이하 '을')은 다음과 같이 위임계약을 체결한다.

제 1 조 (위임 사무의 범위)
갑은 을에게 개인회생(또는 개인파산·면책) 사건의 신청 및 그에 관련된 일체의 법률 사무를 위임한다.

제 2 조 (수임료 및 비용)
총 수임료와 법원 비용은 별도 합의에 따르며, 분납 스케줄은 본 계약서에 첨부된 납부 스케줄에 따른다.

제 3 조 (계약의 해지)
갑 또는 을은 상대방에 대한 서면 통지로 본 계약을 해지할 수 있으며, 이 경우 이미 수행된 업무에 대한 보수는 정산한다.

제 4 조 (비밀유지)
을은 본 위임 사무의 처리 과정에서 알게 된 갑의 개인정보 및 사건 관련 정보를 제3자에게 누설하지 아니한다.

제 5 조 (기타)
본 계약에 정하지 아니한 사항은 민법 및 변호사법의 관련 규정에 따른다.`,

    privacy_consent: `개인정보 수집·이용 동의서

${firmName}(이하 "사무소")은 개인정보보호법에 따라 아래와 같이 개인정보를 수집·이용합니다.

1. 수집 항목: 성명, 연락처, 주소, 주민등록번호(또는 외국인등록번호), 채무 관련 정보, 소득 및 재산 정보
2. 수집 목적: 개인회생/파산 사건 대리, 법원 서류 작성 및 제출, 채권자 통지
3. 보유 기간: 위임 사무 종료 후 5년 (법령에 의한 보존 기간이 더 긴 경우 해당 기간)
4. 동의 거부권: 귀하는 동의를 거부할 수 있으나, 거부 시 위임 사무 수행이 불가합니다.

위 내용을 충분히 이해하였으며, 개인정보 수집·이용에 동의합니다.`,

    third_party_consent: `제3자 정보제공 동의서

${firmName}은 위임 사무 수행을 위해 아래와 같이 개인정보를 제3자에게 제공합니다.

1. 제공받는 자: 관할 법원, 채권 금융기관, 신용정보원, 국민건강보험공단 등
2. 제공 항목: 성명, 주민등록번호, 채무 내역, 소득 및 재산 정보
3. 제공 목적: 개인회생/파산 신청서 제출, 채권자 목록 작성, 재산 조회
4. 보유 기간: 제공 목적 달성 시까지

위 내용을 충분히 이해하였으며, 제3자 정보 제공에 동의합니다.`,

    power_of_attorney: `위 임 장

위임인: ${clientName}

위 사람은 아래 사건에 관하여 ${firmName} ${lawyerName} 변호사를 대리인으로 선임하고, 다음의 권한을 위임합니다.

1. 개인회생(또는 개인파산·면책) 신청 및 관련 절차 일체
2. 법원 제출 서류의 작성, 제출, 보정
3. 기일 출석 및 의견 진술
4. 기타 위임 사무에 부수되는 일체의 행위`,

    installment_agreement: `수임료 분할납부 약정서

위임인 ${clientName}(이하 "갑")과 ${firmName}(이하 "을")은 수임료 분할납부에 대해 다음과 같이 약정한다.

1. 총 수임료 및 납부 스케줄은 위임 계약서 및 첨부 스케줄에 따른다.
2. 갑이 약정된 납부일로부터 14일 이상 연체할 경우, 을은 서면 통지 후 위임 계약을 해지할 수 있다.
3. 계약 해지 시에도 이미 수행된 업무에 대한 보수는 정산하여야 한다.`,

    procedure_consent: `사건 진행 동의서

의뢰인 ${clientName}은 아래 사항을 충분히 이해하였음을 확인합니다.

1. 개인회생/파산 절차는 법원의 심사를 거쳐 진행되며, 결과를 보장하지 않습니다.
2. 사건 진행 기간은 통상 6개월~1년이 소요되며, 사안에 따라 달라질 수 있습니다.
3. 면책 불허가 사유(사행성, 낭비 등)가 있을 경우 면책이 되지 않을 수 있습니다.
4. 의뢰인은 절차 진행 중 법원이 요구하는 서류를 성실히 제출할 의무가 있습니다.`,

    id_confirmation: `신분증 사본 제출 확인서

${firmName}은 위임 사무 처리를 위해 아래 의뢰인의 신분증 사본을 수령하였음을 확인합니다.

의뢰인: ${clientName}
제출 서류: □ 주민등록증  □ 운전면허증  □ 여권  □ 기타(      )
제출일: ${new Date().toISOString().split('T')[0]}

수령인: ${lawyerName}`,

    spouse_consent: `배우자 동의서

본인은 ${clientName}의 배우자로서, ${clientName}이 ${firmName}에 개인회생(또는 개인파산) 사건을 위임함에 있어, 관련 재산 및 소득 정보의 제공에 동의합니다.`,
  };

  return templates[type] || `${CONTRACT_DOC_TYPES[type]?.label || '문서'}\n\n본 문서의 내용을 확인하고 동의합니다.`;
}

// ── 법원 비용 자동 산출 ──

export function calculateCourtCosts(creditorCount: number): { deliveryFee: number; stampFee: number; total: number } {
  const deliveryFee = creditorCount * 5200; // 2026년 기준 송달료
  const stampFee = 30000; // 개인회생 기본 인지대
  return { deliveryFee, stampFee, total: deliveryFee + stampFee };
}

// ── 분납 스케줄 자동 생성 ──

export function generateFeeSchedule(
  totalFee: number,
  downPayment: number,
  installmentCount: number,
  downPaymentDate: string,
  firstInstallmentDate: string
): FeeInstallment[] {
  const schedule: FeeInstallment[] = [];
  const remaining = totalFee - downPayment;
  const perInstallment = Math.round(remaining / installmentCount);

  // 착수금
  schedule.push({
    id: `fee-${Date.now()}-0`,
    round: 0,
    amount: downPayment,
    dueDate: downPaymentDate,
    status: 'pending',
    memo: '계약금(착수금)',
  });

  // 분할납부
  const startDate = new Date(firstInstallmentDate);
  for (let i = 0; i < installmentCount; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const isLast = i === installmentCount - 1;
    schedule.push({
      id: `fee-${Date.now()}-${i + 1}`,
      round: i + 1,
      amount: isLast ? remaining - perInstallment * (installmentCount - 1) : perInstallment,
      dueDate: d.toISOString().split('T')[0],
      status: 'pending',
      memo: isLast ? '잔금' : `${i + 1}차 분할`,
    });
  }

  return schedule;
}

// ── 감사 추적 ──

export function addAuditLog(contract: ElectronicContract, action: string, actor: 'lawyer' | 'client' | 'system'): ElectronicContract {
  return {
    ...contract,
    auditTrail: [...contract.auditTrail, {
      action,
      timestamp: new Date().toISOString(),
      actor,
      ip: '127.0.0.1',
      userAgent: navigator.userAgent,
    }],
    updatedAt: new Date().toISOString(),
  };
}

// ── 계약 상태 업데이트 ──

export function updateContractStatus(contract: ElectronicContract, status: ContractStatus): ElectronicContract {
  const statusLabels: Record<ContractStatus, string> = {
    drafting: '작성중', pending_sign: '서명대기', client_review: '고객확인',
    signing: '서명진행', completed: '서명완료', cancelled: '취소',
  };
  const updated = addAuditLog(contract, `상태 변경: ${statusLabels[status]}`, 'system');
  return { ...updated, status };
}

// ── Mock 데이터 ──

export function seedMockContracts(): void {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (existing.length > 0) return;
  const mockData = [
    { id: 'EC-2026-0001', clientName: '김철수', clientPhone: '010-1234-5678', status: 'completed' as ContractStatus, totalFee: 220, date: '2026-08-25' },
    { id: 'EC-2026-0002', clientName: '이영희', clientPhone: '010-9876-5432', status: 'pending_sign' as ContractStatus, totalFee: 300, date: '2026-08-21' },
    { id: 'EC-2026-0003', clientName: '박민수', clientPhone: '010-5555-1234', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-19' },
    { id: 'EC-2026-0004', clientName: '최지우', clientPhone: '010-7777-8888', status: 'drafting' as ContractStatus, totalFee: 300, date: '2026-08-12' },
    { id: 'EC-2026-0005', clientName: '강시우', clientPhone: '010-3333-4444', status: 'client_review' as ContractStatus, totalFee: 300, date: '2026-08-09' },
    { id: 'EC-2026-0006', clientName: '한예은', clientPhone: '010-2222-3333', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-07' },
    { id: 'EC-2026-0007', clientName: '송지호', clientPhone: '010-1111-2222', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-04' },
  ];

  const contracts: ElectronicContract[] = mockData.map(m => ({
    ...m,
    clientId: m.id,
    clientAddress: '서울시',
    lawyerName: '김리걸',
    lawFirmName: '법무법인 마이김변',
    assignedLawyerId: 'lawyer-1',
    totalFee: m.totalFee,
    courtCosts: { creditorCount: 10, deliveryFee: 52000, stampFee: 30000, miscFee: 0 },
    feeSchedule: generateFeeSchedule(m.totalFee * 10000, 50 * 10000, 3, m.date, m.date),
    documents: createDefaultDocuments(m.clientName, m.clientPhone, '김리걸', '법무법인 마이김변'),
    contractDate: m.date,
    identityVerification: m.status === 'completed' ? { method: 'kakao', verifiedAt: m.date, deviceInfo: 'Chrome', ipAddress: '127.0.0.1' } : undefined,
    auditTrail: [{ action: '계약서 작성 시작', timestamp: new Date(m.date).toISOString(), actor: 'lawyer' as const }],
    createdAt: new Date(m.date).toISOString(),
    updatedAt: new Date(m.date).toISOString(),
  }));

  saveContracts(contracts);
}
