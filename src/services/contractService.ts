// ============================================================
// 전자 계약 서비스
// Supabase 우선 + localStorage 폴백 하이브리드 동기화
// ============================================================

import type { ElectronicContract, ContractDocument, ContractDocType, ContractStatus, FeeInstallment, CourtCosts, BankAccountInfo, SuccessFeeAgreement } from '../types';
import { CONTRACT_DOC_TYPES } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { 
  generateContractOriginalHash, 
  generateContractFinalHash, 
  generateTripleTimestampToken 
} from './integrityService';
import { anchorContractToBlockchain } from './blockchainAnchorService';

const STORAGE_KEY = 'electronic_contracts';

function logSupabaseError(op: string, error: any) {
  console.error(`[Contract] ${op} 실패:`, error?.message || error);
}

import { randomToken, newRemoteSignToken } from '../utils/secureToken';
import { calcCourtFees, DELIVERY_UNIT_FEE_KRW } from './court/courtFees';
import { localYmd, parseLocalYmd, addMonthsClamped } from '../utils/localDate';

/**
 * 제안서→계약 연동 확장 컬럼 (migration 015). 값이 있을 때만 전송해
 * 마이그레이션 적용 전에도 일반 계약 저장이 실패하지 않도록 한다.
 */
function contractExtensionColumns(c: ElectronicContract): Record<string, unknown> {
  const ext: Record<string, unknown> = {};
  if (c.clientRefId) ext.client_ref_id = c.clientRefId;
  if (c.realNameConversionPending !== undefined) ext.real_name_conversion_pending = c.realNameConversionPending;
  if (c.consultRequestId) ext.consult_request_id = c.consultRequestId;
  if (c.sourceProposalId) ext.source_proposal_id = c.sourceProposalId;
  return ext;
}

function contractToRow(c: ElectronicContract) {
  return {
    ...contractExtensionColumns(c),
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
    is_business: c.isBusiness || false,
    business_info: c.businessInfo || null,
    authority_status: c.authorityStatus || 'UNVERIFIED',
    identity_verification: c.identityVerification || null,
    intent_verification: c.intentVerification || null,
    document_hashes: c.documentHashes || null,
    timestamp_token: c.timestampToken || null,
    blockchain_anchor: c.blockchainAnchor || null,
    remote_sign_token: c.remoteSignToken || null,
    vat_included: c.vatIncluded ?? false,
    fee_account: c.feeAccount || null,
    court_cost_account: c.courtCostAccount || null,
    same_as_fee_account: c.sameAsFeeAccount ?? true,
    success_fee: c.successFee || null,
    case_category: c.caseCategory || 'individual_rehab',
    linked_diagnosis_id: c.linkedDiagnosisId || null,
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
    isBusiness: row.is_business,
    businessInfo: row.business_info,
    authorityStatus: row.authority_status,
    identityVerification: row.identity_verification,
    intentVerification: row.intent_verification,
    documentHashes: row.document_hashes,
    timestampToken: row.timestamp_token,
    blockchainAnchor: row.blockchain_anchor,
    remoteSignToken: row.remote_sign_token,
    vatIncluded: row.vat_included ?? false,
    feeAccount: row.fee_account || undefined,
    courtCostAccount: row.court_cost_account || undefined,
    sameAsFeeAccount: row.same_as_fee_account ?? true,
    successFee: row.success_fee || undefined,
    caseCategory: row.case_category || 'individual_rehab',
    linkedDiagnosisId: row.linked_diagnosis_id || undefined,
    clientRefId: row.client_ref_id || undefined,
    realNameConversionPending: row.real_name_conversion_pending ?? undefined,
    consultRequestId: row.consult_request_id || undefined,
    sourceProposalId: row.source_proposal_id || undefined,
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

export async function loadContracts(scope?: { clientId?: string; assignedLawyerId?: string }): Promise<ElectronicContract[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('electronic_contracts').select('*');
      if (scope?.clientId) query = query.eq('client_id', scope.clientId);
      if (scope?.assignedLawyerId) query = query.eq('assigned_lawyer_id', scope.assignedLawyerId);
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) logSupabaseError('loadContracts', error);
      else if (data && data.length > 0) return data.map(rowToContract);
    } catch (e) { logSupabaseError('loadContracts (exception)', e); }
  }
  return loadContractsLocal();
}

/**
 * [Zero-Knowledge] 관리자 전용 온체인 앵커링 관제 데이터 로드
 * 변호사법 제26조(비밀유지의무) 및 개인정보보호법에 의거하여,
 * 최고관리자는 의뢰인의 주민등록상 주소, 전화번호, 계좌번호, 서명 이미지, 첨부 서류 등
 * 민감 개인정보를 열람할 수 없으며,
 * 오직 온체인 블록체인 검증에 필요한 메타데이터(ID, 해시, 폴리곤 TX, 상태 등)만 조회합니다.
 */
export async function loadAdminContractAnchors(): Promise<ElectronicContract[]> {
  if (isSupabaseConfigured) {
    try {
      // 1. 보안 RPC 함수 get_admin_contract_anchors 호출 시도
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_contract_anchors');
      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        return rpcData.map(rowToContract);
      }
      // 권한 거부(관리자·2단계 인증 아님)는 다른 경로로 우회 조회하지 않음 (이전: 조용히 직접 조회·로컬 데이터로 대체)
      if (rpcError && /admin only|42501/i.test(`${rpcError.message} ${rpcError.code}`)) {
        logSupabaseError('get_admin_contract_anchors (권한 없음)', rpcError);
        return [];
      }

      // 2. RPC 미배포 또는 폴백 시 보안 제한 컬럼만 조회 (민감 서류/서명/주소 제외)
      const { data, error } = await supabase
        .from('electronic_contracts')
        .select('id, client_id, client_name, lawyer_name, law_firm_name, assigned_lawyer_id, status, contract_date, is_business, document_hashes, blockchain_anchor, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadAdminContractAnchors', error);
      } else if (data && data.length > 0) {
        return data.map(rowToContract);
      }
    } catch (e) {
      logSupabaseError('loadAdminContractAnchors (exception)', e);
    }
  }
  return loadContractsLocal();
}

export async function saveContracts(contracts: ElectronicContract[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  if (isSupabaseConfigured && contracts.length > 0) {
    try {
      const rows = contracts.map(contractToRow);
      let { error } = await supabase.from('electronic_contracts').upsert(rows, { onConflict: 'id' });
      // migration 015 미적용 시 확장 컬럼 제외 후 재시도
      if (error && (error.code === 'PGRST204' || /column/i.test(error.message || ''))) {
        const extKeys = ['client_ref_id', 'real_name_conversion_pending', 'consult_request_id', 'source_proposal_id'];
        const baseRows = rows.map(r => {
          const copy: Record<string, unknown> = { ...r };
          for (const k of extKeys) delete copy[k];
          return copy;
        });
        ({ error } = await supabase.from('electronic_contracts').upsert(baseRows, { onConflict: 'id' }));
      }
      if (error) logSupabaseError('saveContracts', error);
    } catch (e) { logSupabaseError('saveContracts (exception)', e); }
  }
}

/**
 * 단건 계약서 조회 (Zero Over-fetching)
 * DB 전체 덤프를 전면 제거하고 해당 ID의 계약서 1건만 단건 쿼리합니다.
 */
export async function getContract(id: string): Promise<ElectronicContract | undefined> {
  if (!id) return undefined;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('electronic_contracts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        logSupabaseError('getContract', error);
      } else if (data) {
        return rowToContract(data);
      }
    } catch (e) {
      logSupabaseError('getContract (exception)', e);
    }
  }

  const localContracts = loadContractsLocal();
  return localContracts.find(c => c.id === id);
}

/**
 * 원격 서명용 단건 계약서 조회 (토큰 일치 강제)
 * 비인가 열거형 스크래핑을 원천 차단하기 위해 ID와 토큰이 정확히 일치할 때만 1건 반환
 */
export async function getContractForRemoteSign(contractId: string, token: string): Promise<ElectronicContract | undefined> {
  if (!contractId || !token) return undefined;

  if (isSupabaseConfigured) {
    try {
      // 1. 보안 RPC 함수 호출 시도
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contract_by_remote_token', {
        p_contract_id: contractId,
        p_token: token,
      });
      if (!rpcError && rpcData) {
        return rowToContract(rpcData);
      }

      // 2. 단건 조회 (토큰 일치 강제)
      const { data, error } = await supabase
        .from('electronic_contracts')
        .select('*')
        .eq('id', contractId)
        .eq('remote_sign_token', token)
        .maybeSingle();

      if (error) {
        logSupabaseError('getContractForRemoteSign', error);
      } else if (data) {
        return rowToContract(data);
      }
    } catch (e) {
      logSupabaseError('getContractForRemoteSign (exception)', e);
    }
  }

  const localContracts = loadContractsLocal();
  return localContracts.find(c => c.id === contractId && c.remoteSignToken === token);
}

/**
 * 특정 의뢰인 계약서 조회 (Server-side Filtered)
 * DB 전체를 브라우저로 덤프한 후 JS 메모리에서 거르던 취약 패턴을 제거하고
 * 서버에 직접 client_id 조건을 명시하여 필요한 데이터만 전송받습니다.
 */
export async function getContractsByClientId(clientId: string, altId?: string, phone?: string): Promise<ElectronicContract[]> {
  if (!clientId && !altId && !phone) return [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('electronic_contracts').select('*');
      const orConditions: string[] = [];
      if (clientId) orConditions.push(`client_id.eq.${clientId}`);
      if (altId) orConditions.push(`client_id.eq.${altId}`);
      if (phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        if (clean.length >= 8) {
          orConditions.push(`client_phone.ilike.%${clean.slice(-8)}%`);
        }
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      } else {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        logSupabaseError('getContractsByClientId', error);
      } else if (data && data.length > 0) {
        return data.map(rowToContract);
      }
    } catch (e) {
      logSupabaseError('getContractsByClientId (exception)', e);
    }
  }

  const localContracts = loadContractsLocal();
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  return localContracts.filter(c => {
    if (c.clientId === clientId) return true;
    if (altId && (c.clientId === altId || (c as any).clientRefId === altId)) return true;
    if (clientId && (c as any).clientRefId === clientId) return true;
    if (cleanPhone && c.clientPhone && c.clientPhone.replace(/[^0-9]/g, '') === cleanPhone) return true;
    return false;
  });
}

/** 원격 서명 서버 저장 사용 여부 (Supabase 미설정 로컬 개발 환경은 기존 로컬 저장 흐름 사용) */
export const isRemoteSignServerEnabled = isSupabaseConfigured;

/**
 * 비로그인 원격 서명 단계 저장 (/api/contract?action=remote-sign)
 * - electronic_contracts UPDATE RLS는 로그인 사용자 전용이므로, 문자 링크 서명자는 서버(service role)가
 *   서명 토큰을 검증한 뒤 허용된 필드만 갱신한다.
 */
export async function submitRemoteSignStage(params: {
  stage: 'identity' | 'signature';
  contractId: string;
  remoteSignToken: string;
  identityVerificationId?: string;
  provider?: string;
  providerName?: string;
  clientSignature?: string;
  confirmations?: Record<string, string>;
  agreedTerms?: string[];
}): Promise<{ ok: true; contract: ElectronicContract } | { ok: false; error: string; code?: string }> {
  try {
    const res = await fetch('/api/contract?action=remote-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json.contract) {
      // code: 'contract_closed' = 취소된 계약(서버가 서명·본인인증 저장을 거부)
      return { ok: false, error: json?.error || `서버 저장에 실패했습니다. (${res.status})`, code: typeof json?.code === 'string' ? json.code : undefined };
    }
    const contract = rowToContract(json.contract);
    // 기기 사본도 서버 결과로 갱신
    const local = loadContractsLocal();
    const idx = local.findIndex(c => c.id === contract.id);
    if (idx >= 0) local[idx] = contract; else local.unshift(contract);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    return { ok: true, contract };
  } catch (e: any) {
    return { ok: false, error: e?.message || '네트워크 오류로 저장하지 못했습니다.' };
  }
}

/** @returns 서버(Supabase) 저장 성공 여부 — Supabase 미설정(로컬 전용) 환경은 true */
export async function saveContract(contract: ElectronicContract): Promise<boolean> {
  // localStorage
  const localContracts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const idx = localContracts.findIndex((c: any) => c.id === contract.id);
  if (idx >= 0) localContracts[idx] = contract;
  else localContracts.unshift(contract);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localContracts));
  
  // Supabase
  if (isSupabaseConfigured) {
    try {
      const row = contractToRow(contract);
      let { error } = await supabase.from('electronic_contracts').upsert(row, { onConflict: 'id' });
      // migration 015 미적용(확장 컬럼 없음) → 확장 컬럼 없이 재시도
      if (error && (error.code === 'PGRST204' || /column/i.test(error.message || ''))) {
        const ext = contractExtensionColumns(contract);
        if (Object.keys(ext).length > 0) {
          const baseRow: Record<string, unknown> = { ...row };
          for (const k of Object.keys(ext)) delete baseRow[k];
          ({ error } = await supabase.from('electronic_contracts').upsert(baseRow, { onConflict: 'id' }));
        }
      }
      if (error) {
        logSupabaseError('saveContract', error);
        return false;
      }
    } catch (e) {
      logSupabaseError('saveContract (exception)', e);
      return false;
    }
  }
  return true;
}

/** @returns 서버 삭제 성공 여부 (Supabase 미설정 로컬 전용 환경은 true) */
export async function deleteContract(id: string): Promise<boolean> {
  const contracts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts.filter((c: any) => c.id !== id)));
  
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('electronic_contracts').delete().eq('id', id);
      if (error) { logSupabaseError('deleteContract', error); return false; }
    } catch (e) { logSupabaseError('deleteContract (exception)', e); return false; }
  }
  return true;
}

// ── 새 계약 생성 ──

export function createContract(data: {
  clientId: string;
  clientRefId?: string;
  clientName: string;
  clientPhone: string;
  clientAddress?: string;
  lawyerName: string;
  lawFirmName: string;
  assignedLawyerId?: string;
  totalFee?: number;
  courtCosts?: CourtCosts;
  feeSchedule?: FeeInstallment[];
  vatIncluded?: boolean;
  feeAccount?: BankAccountInfo;
  courtCostAccount?: BankAccountInfo;
  sameAsFeeAccount?: boolean;
  successFee?: SuccessFeeAgreement;
  caseCategory?: 'individual_rehab' | 'individual_bankruptcy' | 'other';
  linkedDiagnosisId?: string;
  isBusiness?: boolean;
  businessInfo?: {
    businessNumber: string;
    companyName: string;
    representativeName: string;
    openingDate: string;
    ntsStatus?: 'VALID' | 'INVALID' | 'CLOSED' | 'SUSPENDED';
    ntsCheckedAt?: string;
    ntsTxId?: string;
  };
}): ElectronicContract {
  const now = new Date().toISOString();
  // 계약 ID·서명 토큰은 기기별 localStorage 개수가 아닌 CSPRNG로 생성한다.
  // (기기마다 EC-2026-0001부터 시작하면 서버 upsert 시 다른 의뢰인의 계약서를 덮어쓴다)
  const id = `EC-${new Date().getFullYear()}-${randomToken(8).toUpperCase()}`;
  const remoteSignToken = newRemoteSignToken();

  // 기본 문서 세트 생성
  const documents = createDefaultDocuments(data.clientName, data.clientPhone, data.lawyerName, data.lawFirmName);

  const contract: ElectronicContract = {
    id,
    clientId: data.clientId,
    clientRefId: data.clientRefId,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    clientAddress: data.clientAddress,
    lawyerName: data.lawyerName,
    lawFirmName: data.lawFirmName,
    assignedLawyerId: data.assignedLawyerId,
    totalFee: data.totalFee ?? 0,
    courtCosts: data.courtCosts ? {
      creditorCount: data.courtCosts.creditorCount ?? 0,
      deliveryFee: data.courtCosts.deliveryFee ?? 0,
      stampFee: data.courtCosts.stampFee ?? 30000,
      miscFee: data.courtCosts.miscFee ?? 0,
      debtCertFee: data.courtCosts.debtCertFee ?? 0,
      debtCertUnitFee: data.courtCosts.debtCertUnitFee ?? 15000,
      deliveryUnitFee: data.courtCosts.deliveryUnitFee ?? DELIVERY_UNIT_FEE_KRW,
      provisionalDeposit: data.courtCosts.provisionalDeposit ?? 0,
      isCustomized: data.courtCosts.isCustomized ?? false,
    } : { creditorCount: 0, deliveryFee: 0, stampFee: 30000, miscFee: 0, debtCertFee: 0, debtCertUnitFee: 15000, deliveryUnitFee: DELIVERY_UNIT_FEE_KRW, provisionalDeposit: 0 },
    feeSchedule: data.feeSchedule ?? [],
    vatIncluded: data.vatIncluded ?? false,
    feeAccount: data.feeAccount,
    courtCostAccount: data.courtCostAccount,
    sameAsFeeAccount: data.sameAsFeeAccount ?? true,
    successFee: data.successFee,
    caseCategory: data.caseCategory || 'individual_rehab',
    linkedDiagnosisId: data.linkedDiagnosisId,
    documents,
    status: 'drafting',
    contractDate: localYmd(),
    isBusiness: data.isBusiness ?? false,
    businessInfo: data.businessInfo,
    authorityStatus: data.isBusiness ? (data.businessInfo?.ntsStatus === 'VALID' ? 'REPRESENTATIVE_VERIFIED' : 'UNVERIFIED') : 'REPRESENTATIVE_VERIFIED',
    remoteSignToken,
    auditTrail: [{ action: '계약서 작성 시작 (회생·파산 특화 전자계약)', timestamp: now, actor: 'lawyer' }],
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
제출일: ${localYmd()}

수령인: ${lawyerName}`,

    spouse_consent: `배우자 동의서

본인은 ${clientName}의 배우자로서, ${clientName}이 ${firmName}에 개인회생(또는 개인파산) 사건을 위임함에 있어, 관련 재산 및 소득 정보의 제공에 동의합니다.`,
  };

  return templates[type] || `${CONTRACT_DOC_TYPES[type]?.label || '문서'}\n\n본 문서의 내용을 확인하고 동의합니다.`;
}

// ── 법원 비용 및 실비 자동 산출 ──

export function calculateCourtCosts(
  creditorCount: number,
  debtCertUnitFee: number = 15000,
  deliveryUnitFee: number = DELIVERY_UNIT_FEE_KRW,
  baseStampFee?: number,
  options?: {
    caseType?: 'rehab' | 'bankruptcy';
    withProhibition?: boolean;
    withStay?: boolean;
    electronic?: boolean;
  }
): { deliveryFee: number; stampFee: number; debtCertFee: number; total: number; courtOnlyTotal: number } {
  // 공통 법원비용 산식(courtFees.ts)으로 완전 단일화: 전자소송(10% 인지 감액) 및 회생 시 금지명령 기본 동시신청 적용
  // (이전: 금지명령 누락 및 30,000원 고정값으로 Stage2 화면과 불일치하던 문제 해결)
  const caseType = options?.caseType || 'rehab';
  const withProhibition = options?.withProhibition ?? (caseType === 'rehab');
  const withStay = options?.withStay ?? false;
  const electronic = options?.electronic ?? true;

  const feeCalc = calcCourtFees({
    caseType,
    creditorCount,
    deliveryUnitFee,
    withProhibition,
    withStay,
    electronic,
  });

  const deliveryFee = creditorCount > 0 ? feeCalc.deliveryFee : 0;
  const stampFee = baseStampFee !== undefined ? baseStampFee : feeCalc.stampFee;
  const debtCertFee = creditorCount * debtCertUnitFee;
  const courtOnlyTotal = deliveryFee + stampFee;
  return { 
    deliveryFee, 
    stampFee, 
    debtCertFee, 
    courtOnlyTotal, 
    total: courtOnlyTotal + debtCertFee 
  };
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
  const remaining = Math.max(0, totalFee - Math.max(0, downPayment));
  // 분납 0회: 잔액이 사라지지 않도록 착수금 외 잔액을 1회로 묶음
  const count = Math.max(remaining > 0 ? 1 : 0, Math.floor(installmentCount) || 0);
  const perInstallment = count > 0 ? Math.round(remaining / count) : 0;

  // 착수금
  schedule.push({
    id: `fee-${Date.now()}-0`,
    round: 0,
    amount: downPayment,
    dueDate: downPaymentDate,
    status: 'pending',
    memo: '계약금(착수금)',
  });

  // 분할납부 (로컬 날짜, 말일 보정: 1/31 → 2/28)
  const startDate = parseLocalYmd(firstInstallmentDate) || new Date();
  for (let i = 0; i < count; i++) {
    const d = addMonthsClamped(startDate, i);
    const isLast = i === count - 1;
    schedule.push({
      id: `fee-${Date.now()}-${i + 1}`,
      round: i + 1,
      amount: isLast ? remaining - perInstallment * (count - 1) : perInstallment,
      dueDate: localYmd(d),
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
      // 브라우저에서는 실제 공인 IP를 알 수 없으므로 임의 값(127.0.0.1)을 기록하지 않음
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }],
    updatedAt: new Date().toISOString(),
  };
}

// ── 계약 상태 업데이트 ──

export function updateContractStatus(contract: ElectronicContract, status: ContractStatus): ElectronicContract {
  const statusLabels: Record<ContractStatus, string> = {
    drafting: '작성중', pending_sign: '서명대기', client_review: '고객확인',
    signing: '서명진행', completed: '서명완료', signed: '서명완료', cancelled: '취소',
  };
  const updated = addAuditLog(contract, `상태 변경: ${statusLabels[status]}`, 'system');
  return { ...updated, status };
}

// ── 4대 법적 효력 완비: 무결성 해시 및 3중 타임스탬프 원자적 체결 완료 ──

export async function finalizeContractWithIntegrity(
  contract: ElectronicContract,
  clientSig: string,
  lawyerSig: string
): Promise<ElectronicContract> {
  const now = new Date().toISOString();
  
  // 1. 원본 해시 산출
  const originalHash = await generateContractOriginalHash(contract);
  
  // 2. 체결본 해시 산출
  const finalHash = await generateContractFinalHash(originalHash, clientSig, lawyerSig, now);
  
  // 3. 3중 타임스탬프 토큰 생성 (통신사 인증 시각 기반)
  const certifiedAt = contract.identityVerification?.certifiedAt || now;
  const txId = contract.identityVerification?.txId || `TX-LOCAL-${Date.now()}`;
  
  const timestampToken = await generateTripleTimestampToken({
    originalHash,
    finalHash,
    certifiedAt,
    txId,
    contractId: contract.id,
  });

  // 4. 계약서 상태 및 감사로그 갱신
  const completedContract: ElectronicContract = {
    ...contract,
    status: 'completed',
    documentHashes: {
      originalHash,
      finalHash,
      algorithm: 'SHA-256',
      signedAt: now,
    },
    timestampToken,
    authorityStatus: contract.isBusiness 
      ? (contract.businessInfo?.ntsStatus === 'VALID' ? 'REPRESENTATIVE_VERIFIED' : 'MANUAL_REVIEW')
      : 'REPRESENTATIVE_VERIFIED',
    updatedAt: now,
    auditTrail: [
      ...contract.auditTrail,
      {
        action: '계약 체결 완료 (양 당사자 서명)',
        timestamp: now,
        actor: 'system',
        documentHash: finalHash,
        details: `SHA-256 원본: ${originalHash.slice(0, 16)}... | 체결본: ${finalHash.slice(0, 16)}... | 시점토큰: ${timestampToken.token}`,
        ip: contract.identityVerification?.ipAddress || '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'System',
      }
    ]
  };

  // 5. 블록체인(Polygon PoS) 분산원장 무결성 영구 각인 (사후 위·변조 원천 차단)
  const anchorInfo = await anchorContractToBlockchain(completedContract);
  completedContract.blockchainAnchor = anchorInfo;
  completedContract.auditTrail.push({
    action: anchorInfo.isRealOnChain ? '전자지문 블록체인 기록 (Polygon)' : '전자지문 서버 보관 (블록체인 미기록)',
    timestamp: anchorInfo.anchoredAt,
    actor: 'system',
    documentHash: finalHash,
    details: anchorInfo.isRealOnChain
      ? `Tx: ${anchorInfo.txHash.slice(0, 18)}... | Block #${anchorInfo.blockNumber.toLocaleString()}`
      : `서버 보관 다이제스트: ${anchorInfo.txHash.slice(0, 18)}... (온체인 미전송 — 트랜잭션 아님)`,
    ip: contract.identityVerification?.ipAddress || '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'System',
  });

  // 저장 실패를 삼키지 않는다 — 호출 측이 '체결 완료'로 안내하지 않도록 예외로 알림
  const saved = await saveContract(completedContract);
  if (!saved) {
    throw new Error('체결본을 서버에 저장하지 못했습니다. 이 기기에만 저장되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
  }
  return completedContract;
}

// ── Mock 데이터 ──

export function seedMockContracts(): void {
  const existing: ElectronicContract[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const existingIds = new Set(existing.map(c => c.id));
  const existingClientIds = new Set(existing.map(c => c.clientId));

  const mockData: Array<any> = [
    { id: 'EC-2026-0001', clientId: 'EC-2026-0001', clientName: '김철수', clientPhone: '010-1234-5678', status: 'completed' as ContractStatus, totalFee: 220, date: '2026-08-25', contractMethod: 'electronic' },
    { id: 'EC-2026-0002', clientId: 'EC-2026-0002', clientName: '이영희', clientPhone: '010-9876-5432', status: 'pending_sign' as ContractStatus, totalFee: 300, date: '2026-08-21', contractMethod: 'electronic' },
    { id: 'EC-2026-0003', clientId: 'EC-2026-0003', clientName: '박민수', clientPhone: '010-5555-1234', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-19', contractMethod: 'electronic' },
    { id: 'EC-2026-0004', clientId: 'EC-2026-0004', clientName: '최지우', clientPhone: '010-7777-8888', status: 'drafting' as ContractStatus, totalFee: 300, date: '2026-08-12', contractMethod: 'electronic' },
    { id: 'EC-2026-0005', clientId: 'EC-2026-0005', clientName: '강시우', clientPhone: '010-3333-4444', status: 'client_review' as ContractStatus, totalFee: 300, date: '2026-08-09', contractMethod: 'electronic' },
    { id: 'EC-2026-0006', clientId: 'EC-2026-0006', clientName: '한예은', clientPhone: '010-2222-3333', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-07', contractMethod: 'electronic' },
    { id: 'EC-2026-0007', clientId: 'EC-2026-0007', clientName: '송지호', clientPhone: '010-1111-2222', status: 'completed' as ContractStatus, totalFee: 300, date: '2026-08-04', contractMethod: 'electronic' },
    
    // ── 단계별 테스트용 전자/서면 계약서 ──
    {
      id: 'EC-ST2-ELECTRONIC',
      clientId: 'req-stage2-electronic',
      clientName: '최수안',
      clientPhone: '010-4499-1234',
      status: 'pending_sign' as ContractStatus,
      totalFee: 160,
      date: '2026-09-28',
      contractMethod: 'electronic'
    },
    {
      id: 'EC-ST2-VISIT',
      clientId: 'req-stage2-visit',
      clientName: '강태양',
      clientPhone: '010-5511-8899',
      status: 'drafting' as ContractStatus,
      totalFee: 170,
      date: '2026-09-29',
      contractMethod: 'in_person',
      paperContractInfo: {
        method: 'in_person',
        signedDate: '',
        notes: '방문 희망일시: 2026-10-05 14:00 (신분증 및 소득서류 지참 내방 상담 희망)'
      }
    },
    {
      id: 'EC-ST2-POSTAL',
      clientId: 'req-stage2-postal',
      clientName: '윤하은',
      clientPhone: '010-6622-3344',
      status: 'drafting' as ContractStatus,
      totalFee: 150,
      date: '2026-09-30',
      contractMethod: 'postal',
      paperContractInfo: {
        method: 'postal',
        signedDate: '',
        notes: '우편 등기 요청: 강원도 춘천시 영서로 1980 102동 504호 (우편번호: 24231)',
        postalInfo: {
          recipientAddress: '강원도 춘천시 영서로 1980',
          recipientDetailAddress: '102동 504호',
          postcode: '24231',
          carrier: '우체국 등기'
        }
      }
    },
    {
      id: 'EC-ST3-DOCS',
      clientId: 'req-stage3-docs',
      clientName: '정우성',
      clientPhone: '010-8888-2222',
      status: 'completed' as ContractStatus,
      totalFee: 180,
      date: '2026-09-15',
      contractMethod: 'electronic'
    },
    {
      id: 'EC-ST4-FILING',
      clientId: 'req-stage4-filing',
      clientName: '최은지',
      clientPhone: '010-7777-1111',
      status: 'completed' as ContractStatus,
      totalFee: 180,
      date: '2026-08-01',
      contractMethod: 'electronic'
    },
    {
      id: 'EC-ST5-CORRECTION',
      clientId: 'req-stage5-correction',
      clientName: '김민석',
      clientPhone: '010-6644-2211',
      status: 'completed' as ContractStatus,
      totalFee: 200,
      date: '2026-07-20',
      contractMethod: 'electronic'
    },
    {
      id: 'EC-ST6-DISCHARGE',
      clientId: 'req-stage6-discharge',
      clientName: '한예은',
      clientPhone: '010-2222-3333',
      status: 'completed' as ContractStatus,
      totalFee: 180,
      date: '2023-08-10',
      contractMethod: 'electronic'
    }
  ];

  const contracts: ElectronicContract[] = mockData.map(m => {
    const isComp = m.status === 'completed';
    const finalHash = isComp ? `7e2b19f0c84139a0491823746193fe1209a8f5c4e92b1034d8719283746152${m.id.slice(-2)}` : undefined;
    const origHash = isComp ? `a8f5c4e92b1034d8719283746152bc41902746193fe1209a827361849201ab${m.id.slice(-2)}` : undefined;
    const txHash = isComp ? `0x4a8c90fe32b9183471dfca92837192847192384719283746182937461829${m.id.slice(-4)}` : undefined;

    return {
      ...m,
      clientId: m.clientId || m.id,
      clientAddress: '서울시 서초구 서초대로 250',
      lawyerName: '김리걸',
      lawFirmName: '법무법인 마이김변',
      assignedLawyerId: 'lawyer-1',
      totalFee: m.totalFee,
      courtCosts: { creditorCount: 10, deliveryFee: 52000, stampFee: 30000, miscFee: 0 },
      feeSchedule: generateFeeSchedule(m.totalFee * 10000, 50 * 10000, 3, m.date, m.date),
      documents: createDefaultDocuments(m.clientName, m.clientPhone, '김리걸', '법무법인 마이김변'),
      contractDate: m.date,
      identityVerification: isComp ? { 
        method: 'kakao_pay_cert', 
        provider: 'kakao',
        providerName: '카카오페이 전자서명인증 (KISA 공인)',
        name: m.clientName,
        carrier: '카카오페이 전자서명인증',
        txId: `KAKAO-CERT-2026-${m.id}`,
        certifiedAt: `${m.date}T10:15:00.000Z`,
        verifiedAt: m.date, 
        deviceInfo: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)', 
        ipAddress: '211.234.12.89' 
      } : undefined,
      documentHashes: (origHash && finalHash) ? {
        originalHash: origHash,
        finalHash: finalHash,
        algorithm: 'SHA-256' as const,
      } : undefined,
      timestampToken: isComp ? {
        token: `TS-2026-${m.id.slice(-4)}-9821-0242ac120002`,
        certifiedAt: `${m.date}T10:15:00.000Z`,
        kstServerTime: `${m.date} 19:15:00`,
        txId: `TS-TX-${m.id}`,
      } : undefined,
      blockchainAnchor: (isComp && txHash && finalHash) ? {
        network: 'Polygon PoS Mainnet (EVM-ChainID: 137)',
        txHash,
        blockNumber: 61845200 + parseInt(m.id.slice(-4), 10),
        anchoredAt: `${m.date}T10:15:30.000Z`,
        explorerUrl: `https://polygonscan.com/tx/${txHash}`,
        verifyUrl: `https://legal-crm-xi.vercel.app/?verifyContractId=${m.id}&hash=${finalHash}`,
        contractHash: finalHash,
        smartContractAddress: '0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1',
      } : undefined,
      auditTrail: [
        { action: '계약서 작성 시작', timestamp: new Date(m.date).toISOString(), actor: 'lawyer' as const },
        ...(isComp ? [
          { action: '위임인 카카오페이 본인인증 완료', timestamp: `${m.date}T10:15:00.000Z`, actor: 'client' as const },
          { action: '위임인 전자서명 날인 완료', timestamp: `${m.date}T10:15:20.000Z`, actor: 'client' as const },
          { action: '[DEV 데모] 계약 체결 완료', timestamp: `${m.date}T10:15:25.000Z`, actor: 'system' as const, documentHash: finalHash },
          { action: '블록체인 분산원장 영구 앵커링 (Polygon PoS)', timestamp: `${m.date}T10:15:30.000Z`, actor: 'system' as const, documentHash: finalHash, details: `Polygon Tx: ${txHash?.slice(0, 18)}...` }
        ] : [])
      ],
      createdAt: new Date(m.date).toISOString(),
      updatedAt: new Date(m.date).toISOString(),
    };
  });

  // 데모 데이터는 이 브라우저(localStorage)에만 둔다 — 개발 빌드가 운영 Supabase를 보더라도 가짜 계약이 DB에 올라가지 않도록
  // (이전: saveContracts()로 Supabase upsert)
  const missingContracts = contracts.filter(c => !existingIds.has(c.id));
  if (missingContracts.length > 0) {
    const merged = [...existing, ...missingContracts];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
}
