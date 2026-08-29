import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { 
  StaffMember, StaffRole, CrmActivityLog, CrmActivityType,
  CrmNote, CrmNoteCategory, CrmClientExtension, StaffActivityLog, StaffActivityType, StaffMemberStatus,
  DocumentFile, DocumentRequest, DocumentCheckItem, DocumentReviewStatus, ElectronicContract
} from '../types';
import { DEFAULT_REHAB_DOCUMENTS } from '../types';

// ============================================================
// CRM Supabase Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작
// ============================================================

const CRM_STORAGE_KEY = 'legal_crm_data';
const STAFF_STORAGE_KEY = 'legal_crm_staff';

// ── 유틸리티 ──

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── CRM Client Extension 관리 ──

export type CrmDataStore = Record<string, CrmClientExtension>;

export async function loadCrmData(): Promise<CrmDataStore> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('crm_clients')
        .select('*');
      if (!error && data) {
        const store: CrmDataStore = {};
        data.forEach((row: any) => {
          store[row.client_id] = {
            crmStatus: row.crm_status || 'requested',
            assigneeId: row.assignee_id || row.assigned_lawyer_id || row.assigned_consultant_id || row.assigned_staff_id,
            assignedLawyerId: row.assigned_lawyer_id,
            assignedConsultantId: row.assigned_consultant_id,
            assignedStaffId: row.assigned_staff_id,
            documents: row.documents || [],
            notes: row.notes || [],
            activities: row.activities || [],
            contractDate: row.contract_date,
            contractAmount: row.contract_amount,
            lastActivityAt: row.last_activity_at || new Date().toISOString(),
            intakeChannel: row.intake_channel || 'mykim',
            intakeChannelDetail: row.intake_channel_detail,
            isExternalClient: row.is_external_client || false,
            totalFee: row.total_fee,
            totalPaid: row.total_paid,
            feeSchedule: row.fee_schedule || [],
            uploadedFiles: row.uploaded_files || [],
            correctionOrders: row.correction_orders || [],
            courtCase: row.court_case,
            alimtokLogs: row.alimtok_logs || [],
          };
        });
        return store;
      }
    } catch (e) {
      console.warn('[CRM] Supabase load failed, falling back to localStorage', e);
    }
  }
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  // 마이그레이션: 기존 3개 필드 → assigneeId 통합
  for (const id of Object.keys(store)) {
    const ext = store[id];
    if (!ext.assigneeId && (ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId)) {
      ext.assigneeId = ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
    }
  }
  return store;
}

export async function saveCrmClient(clientId: string, ext: CrmClientExtension): Promise<void> {
  // Always save to localStorage
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  // Also persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('crm_clients').upsert({
        client_id: clientId,
        crm_status: ext.crmStatus,
        assignee_id: ext.assigneeId,
        assigned_lawyer_id: ext.assignedLawyerId || ext.assigneeId,
        assigned_consultant_id: ext.assignedConsultantId,
        assigned_staff_id: ext.assignedStaffId,
        documents: ext.documents,
        notes: ext.notes,
        activities: ext.activities,
        contract_date: ext.contractDate,
        contract_amount: ext.contractAmount,
        last_activity_at: ext.lastActivityAt,
        intake_channel: ext.intakeChannel,
        intake_channel_detail: ext.intakeChannelDetail,
        is_external_client: ext.isExternalClient,
        total_fee: ext.totalFee,
        total_paid: ext.totalPaid,
        fee_schedule: ext.feeSchedule,
        uploaded_files: ext.uploadedFiles,
        correction_orders: ext.correctionOrders,
        court_case: ext.courtCase,
        alimtok_logs: ext.alimtokLogs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });
    } catch (e) {
      console.warn('[CRM] Supabase save failed', e);
    }
  }
}

// ── Staff (직원) 관리 ──

export async function loadStaffMembers(): Promise<StaffMember[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          role: row.role as StaffRole,
          email: row.email,
          phone: row.phone,
          avatar: row.avatar,
          isActive: row.is_active ?? true,
          assignedCount: row.assigned_count || 0,
          createdAt: row.created_at,
          permissions: row.permissions || {},
          status: row.status || (row.is_active ? 'active' : 'pending') as StaffMemberStatus,
          invitedBy: row.invited_by,
          approvedAt: row.approved_at,
          removedAt: row.removed_at,
          removalReason: row.removal_reason,
          lastActiveAt: row.last_active_at,
        }));
      }
    } catch (e) {
      console.warn('[CRM] Supabase staff load failed', e);
    }
  }
  return getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
}

export async function saveStaffMember(member: StaffMember): Promise<void> {
  // localStorage
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const idx = members.findIndex(m => m.id === member.id);
  if (idx >= 0) members[idx] = member;
  else members.push(member);
  setLocalData(STAFF_STORAGE_KEY, members);

  // Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').upsert({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
        phone: member.phone,
        avatar: member.avatar,
        is_active: member.isActive,
        assigned_count: member.assignedCount,
        permissions: member.permissions,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[CRM] Supabase staff save failed', e);
    }
  }
}

export async function deleteStaffMember(memberId: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  setLocalData(STAFF_STORAGE_KEY, members.filter(m => m.id !== memberId));

  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').delete().eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff delete failed', e);
    }
  }
}

// ── Activity Log 헬퍼 ──

export function createActivityLog(
  clientId: string,
  actorId: string,
  actorName: string,
  actorRole: StaffRole,
  type: CrmActivityType,
  description: string,
  metadata?: Record<string, string>
): CrmActivityLog {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    clientId,
    actorId,
    actorName,
    actorRole,
    type,
    description,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ── CRM Note 헬퍼 ──

export function createCrmNote(
  category: CrmNoteCategory,
  content: string,
  authorId: string,
  authorName: string,
  outcome?: import('../types').ConsultOutcome,
  reminder?: import('../types').NoteReminder
): CrmNote {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    category,
    content,
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
    ...(outcome ? { outcome } : {}),
    ...(reminder ? { reminder } : {}),
  };
}

/** CRM 고객 데이터 삭제 */
export function deleteCrmClient(clientId: string): void {
  const raw = localStorage.getItem('legal_crm_data');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    delete data[clientId];
    localStorage.setItem('legal_crm_data', JSON.stringify(data));
  } catch { /* ignore */ }
}

// ── CrmClientExtension 초기화 헬퍼 ──

export function createDefaultCrmExtension(clientId: string): CrmClientExtension {
  const docs = DEFAULT_REHAB_DOCUMENTS;
  return {
    crmStatus: 'requested',
    documents: (docs || []).map((d: any) => ({ ...d, reviewStatus: d.reviewStatus || 'not_submitted' })),
    notes: [],
    activities: [{
      id: `act-init-${Date.now()}`,
      clientId,
      actorId: 'system',
      actorName: '시스템',
      actorRole: 'OWNER' as StaffRole,
      type: 'created' as CrmActivityType,
      description: '상담 신청이 접수되었습니다.',
      createdAt: new Date().toISOString(),
    }],
    lastActivityAt: new Date().toISOString(),
    // ── 다채널 CRM 기본값 ──
    intakeChannel: 'mykim',
    isExternalClient: false,
    feeSchedule: [],
    uploadedFiles: [],
    correctionOrders: [],
    alimtokLogs: [],
    documentRequests: [],
  };
}

// ── 문서 양방향 동기화 헬퍼 함수 ──

/** 서류 승인 처리 */
export async function approveDocument(
  clientId: string,
  docId: string,
  reviewerName: string
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;

  ext.documents = ext.documents.map(d =>
    d.id === docId ? {
      ...d,
      checked: true,
      checkedBy: reviewerName,
      checkedAt: new Date().toISOString(),
      reviewStatus: 'approved' as DocumentReviewStatus,
      rejectionReason: undefined,
      rejectedAt: undefined,
    } : d
  );

  // 연결된 파일도 상태 업데이트
  const doc = ext.documents.find(d => d.id === docId);
  if (doc?.linkedFileId && ext.uploadedFiles) {
    ext.uploadedFiles = ext.uploadedFiles.map(f =>
      f.id === doc.linkedFileId ? { ...f, reviewStatus: 'approved' as DocumentReviewStatus } : f
    );
  }

  ext.lastActivityAt = new Date().toISOString();
  await saveCrmClient(clientId, ext);
}

/** 서류 반려 처리 */
export async function rejectDocument(
  clientId: string,
  docId: string,
  reviewerName: string,
  reason: string
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;

  ext.documents = ext.documents.map(d =>
    d.id === docId ? {
      ...d,
      checked: false,
      reviewStatus: 'rejected' as DocumentReviewStatus,
      rejectionReason: reason,
      rejectedAt: new Date().toISOString(),
      checkedBy: reviewerName,
    } : d
  );

  // 연결된 파일도 상태 업데이트
  const doc = ext.documents.find(d => d.id === docId);
  if (doc?.linkedFileId && ext.uploadedFiles) {
    ext.uploadedFiles = ext.uploadedFiles.map(f =>
      f.id === doc.linkedFileId ? { ...f, reviewStatus: 'rejected' as DocumentReviewStatus } : f
    );
  }

  ext.lastActivityAt = new Date().toISOString();
  await saveCrmClient(clientId, ext);
}

/** 변호사 → 고객 추가 서류 요청 */
export async function requestDocument(
  clientId: string,
  request: Omit<DocumentRequest, 'id' | 'requestedAt' | 'fulfilled'>
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;

  const newRequest: DocumentRequest = {
    ...request,
    id: `dreq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestedAt: new Date().toISOString(),
    fulfilled: false,
  };

  ext.documentRequests = [...(ext.documentRequests || []), newRequest];
  ext.lastActivityAt = new Date().toISOString();
  await saveCrmClient(clientId, ext);
}

/** 고객 서류 제출 (uploadedFiles에 저장 + 체크리스트 자동 매핑) */
export async function submitClientDocument(
  clientId: string,
  file: DocumentFile,
  linkedDocId?: string
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;

  // uploadedFiles에 추가
  const newFile: DocumentFile = {
    ...file,
    uploadSource: 'client',
    linkedDocId: linkedDocId,
    reviewStatus: 'submitted',
  };
  ext.uploadedFiles = [...(ext.uploadedFiles || []), newFile];

  // 체크리스트 항목과 매핑
  if (linkedDocId) {
    ext.documents = ext.documents.map(d =>
      d.id === linkedDocId ? {
        ...d,
        reviewStatus: 'submitted' as DocumentReviewStatus,
        linkedFileId: newFile.id,
        submittedAt: new Date().toISOString(),
      } : d
    );

    // documentRequests에서 해당 요청 fulfilled 처리
    if (ext.documentRequests) {
      ext.documentRequests = ext.documentRequests.map(req =>
        req.linkedDocId === linkedDocId && !req.fulfilled ? {
          ...req,
          fulfilled: true,
          fulfilledAt: new Date().toISOString(),
          fulfilledFileId: newFile.id,
        } : req
      );
    }
  }

  ext.lastActivityAt = new Date().toISOString();
  await saveCrmClient(clientId, ext);
}

/** 전자계약 체결 시 CRM 동기화 (수임료, 분납스케줄, 진행상태, 활동로그 일괄 업데이트) */
export async function syncContractToCrm(
  clientId: string,
  contract: ElectronicContract,
  actor?: { id: string; name: string; role: StaffRole }
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId] || createDefaultCrmExtension(clientId);

  const actorInfo = actor || { id: 'system', name: contract.lawyerName || '담당 변호사', role: 'LAWYER' as StaffRole };

  // 수임료 및 분납 스케줄 동기화 (만원 단위 변환)
  ext.totalFee = contract.totalFee;
  ext.contractDate = contract.contractDate;
  ext.contractAmount = contract.totalFee;
  
  if (contract.feeSchedule && contract.feeSchedule.length > 0) {
    ext.feeSchedule = contract.feeSchedule.map(f => ({
      ...f,
      // 분납 금액이 원 단위인 경우 만원 단위로 정규화 (10000 이상이면 / 10000)
      amount: f.amount >= 10000 ? Math.round(f.amount / 10000) : f.amount,
    }));
  }

  // 계약이 완료/서명진행 상태일 때 CRM 상태를 'contracted' (수임 계약)로 자동 승격
  if (['completed', 'signing', 'pending_sign'].includes(contract.status)) {
    if (contract.status === 'completed') {
      ext.crmStatus = 'contracted';
    }
  }

  // 활동 로그(타임라인) 추가
  const logDesc = contract.status === 'completed'
    ? `전자계약 체결 완료 (계약번호: ${contract.id}, 약정 수임료: ${contract.totalFee}만원)`
    : `전자계약서 발송 및 서명 요청 (계약번호: ${contract.id})`;

  ext.activities = [
    ...(ext.activities || []),
    createActivityLog(
      clientId,
      actorInfo.id,
      actorInfo.name,
      actorInfo.role,
      'contract_signed' as CrmActivityType,
      logDesc,
      { contractId: contract.id, status: contract.status }
    )
  ];

  ext.lastActivityAt = new Date().toISOString();
  await saveCrmClient(clientId, ext);
}

// ============================================================
// 케이스 관리 유틸리티 (LeadMaster 이식)
// ============================================================

/** 전화번호 포맷팅 (010-XXXX-XXXX) */
export function formatPhone(value: string): string {
  const digits = value.replace(/[^\d]/g, '').replace(/^\+82/, '0');
  if (digits.startsWith('02')) {
    if (digits.length <= 9) return digits.replace(/(\d{2})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (digits.length <= 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

/** 전화번호 중복 검사 — 기존 requests 중 동일 전화번호 건 반환 */
export function checkDuplicatePhone(
  phone: string,
  requests: Array<{ id: string; clientName?: string; phone?: string; status?: string }>,
  excludeId?: string
): { id: string; clientName?: string; status?: string } | null {
  const normalized = phone.replace(/[^\d]/g, '');
  if (normalized.length < 8) return null;
  for (const r of requests) {
    if (excludeId && r.id === excludeId) continue;
    const rPhone = (r.phone || '').replace(/[^\d]/g, '');
    if (rPhone === normalized) return { id: r.id, clientName: r.clientName, status: r.status };
  }
  return null;
}

/** 출생년도 2자리→4자리 자동변환 (기준점 30) */
export function normalizeBirthYear(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{2}$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return num <= 30 ? `20${trimmed}` : `19${trimmed}`;
  }
  return trimmed;
}

/** 금액 포맷팅 (만원 단위, 3자리 콤마) */
export function formatMoney(amount: number | undefined): string {
  if (amount == null || isNaN(amount)) return '-';
  return `${amount.toLocaleString()}만원`;
}

/** 소프트 삭제 (deletedAt 설정) */
export async function softDeleteCrmClient(clientId: string): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;
  ext.deletedAt = new Date().toISOString();
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('crm_clients').update({
        deleted_at: ext.deletedAt,
        updated_at: new Date().toISOString(),
      }).eq('client_id', clientId);
    } catch (e) {
      console.warn('[CRM] Supabase soft delete failed', e);
    }
  }
}

/** 소프트 삭제 복원 */
export async function restoreCrmClient(clientId: string): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return;
  delete ext.deletedAt;
  ext.crmStatus = 'requested';
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('crm_clients').update({
        deleted_at: null,
        crm_status: 'requested',
        updated_at: new Date().toISOString(),
      }).eq('client_id', clientId);
    } catch (e) {
      console.warn('[CRM] Supabase restore failed', e);
    }
  }
}

/** 휴지통 자동 정리 — 30일 경과 건 영구 삭제, 삭제 건수 반환 */
export function cleanupRecycleBin(): number {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  for (const [id, ext] of Object.entries(store)) {
    if (ext.deletedAt && new Date(ext.deletedAt).getTime() < cutoff) {
      delete store[id];
      deletedCount++;
    }
  }
  if (deletedCount > 0) setLocalData(CRM_STORAGE_KEY, store);
  return deletedCount;
}

// ============================================================
// 직원 관리 확장 서비스 (Staff Management Extended)
// ============================================================

const STAFF_ACTIVITY_STORAGE_KEY = 'legal_crm_staff_activities';

// ── 직원 상태 변경 ──

export async function approveStaffMember(memberId: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const updated = members.map(m => m.id === memberId ? { 
    ...m, 
    status: 'active' as StaffMemberStatus, 
    isActive: true, 
    approvedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  } : m);
  setLocalData(STAFF_STORAGE_KEY, updated);
  
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').update({
        status: 'active',
        is_active: true,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff approve failed', e);
    }
  }
}

export async function rejectStaffMember(memberId: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  setLocalData(STAFF_STORAGE_KEY, members.filter(m => m.id !== memberId));
  
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').delete().eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff reject failed', e);
    }
  }
}

export async function suspendStaffMember(memberId: string, reason?: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const updated = members.map(m => m.id === memberId ? {
    ...m,
    status: 'suspended' as StaffMemberStatus,
    isActive: false,
    removalReason: reason,
  } : m);
  setLocalData(STAFF_STORAGE_KEY, updated);
  
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').update({
        status: 'suspended',
        is_active: false,
        removal_reason: reason,
        updated_at: new Date().toISOString(),
      }).eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff suspend failed', e);
    }
  }
}

export async function reactivateStaffMember(memberId: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const updated = members.map(m => m.id === memberId ? {
    ...m,
    status: 'active' as StaffMemberStatus,
    isActive: true,
    removalReason: undefined,
    lastActiveAt: new Date().toISOString(),
  } : m);
  setLocalData(STAFF_STORAGE_KEY, updated);
  
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').update({
        status: 'active',
        is_active: true,
        removal_reason: null,
        updated_at: new Date().toISOString(),
      }).eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff reactivate failed', e);
    }
  }
}

export async function removeStaffMemberWithReason(memberId: string, reason: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const updated = members.map(m => m.id === memberId ? {
    ...m,
    status: 'removed' as StaffMemberStatus,
    isActive: false,
    removedAt: new Date().toISOString(),
    removalReason: reason,
  } : m);
  setLocalData(STAFF_STORAGE_KEY, updated);
  
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').update({
        status: 'removed',
        is_active: false,
        removed_at: new Date().toISOString(),
        removal_reason: reason,
        updated_at: new Date().toISOString(),
      }).eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff remove failed', e);
    }
  }
}

// ── 직원 활동 로그 ──

export function createStaffActivityLog(
  staffId: string,
  staffName: string,
  actorId: string,
  actorName: string,
  type: StaffActivityType,
  description: string,
  metadata?: Record<string, string>
): StaffActivityLog {
  return {
    id: `sact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    staffId,
    staffName,
    actorId,
    actorName,
    type,
    description,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

export function loadStaffActivityLogs(): StaffActivityLog[] {
  return getLocalData<StaffActivityLog[]>(STAFF_ACTIVITY_STORAGE_KEY, []);
}

export function saveStaffActivityLog(log: StaffActivityLog): void {
  const logs = getLocalData<StaffActivityLog[]>(STAFF_ACTIVITY_STORAGE_KEY, []);
  logs.unshift(log); // 최신 먼저
  // 최대 500개 유지
  if (logs.length > 500) logs.length = 500;
  setLocalData(STAFF_ACTIVITY_STORAGE_KEY, logs);
}

// ── 직원 권한 수정 ──

export async function updateStaffPermissions(memberId: string, permissions: Partial<StaffMember['permissions']>): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const updated = members.map(m => m.id === memberId ? {
    ...m,
    permissions: { ...m.permissions, ...permissions },
  } : m);
  setLocalData(STAFF_STORAGE_KEY, updated);
  
  if (isSupabaseConfigured) {
    try {
      const member = updated.find(m => m.id === memberId);
      if (member) {
        await supabase.from('staff_members').update({
          permissions: member.permissions,
          updated_at: new Date().toISOString(),
        }).eq('id', memberId);
      }
    } catch (e) {
      console.warn('[CRM] Supabase staff permission update failed', e);
    }
  }
}

