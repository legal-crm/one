import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { 
  StaffMember, StaffRole, CrmActivityLog, CrmActivityType,
  CrmNote, CrmNoteCategory, CrmClientExtension, StaffActivityLog, StaffActivityType, StaffMemberStatus,
  StaffPermissions, DocumentFile, DocumentRequest, DocumentCheckItem, DocumentReviewStatus, ElectronicContract
} from '../types';
import { DEFAULT_REHAB_DOCUMENTS, DEFAULT_BANKRUPTCY_DOCUMENTS, getStandardDocumentsForClient } from '../types';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';
import { feeTotalWon } from '../utils/feeUnits';
import { thirteenStageAfterStatusChange } from '../components/lawyer/pipeline/journeyStage';

// ============================================================
// CRM Supabase Service Layer
// Supabase 미설정 시 secureStorage (sessionStorage 격리) 폴백으로 동작
// ============================================================

const CRM_STORAGE_KEY = 'legal_crm_data';
const STAFF_STORAGE_KEY = 'legal_crm_staff';

// ── 유틸리티 (단말 보호: sessionStorage 격리 및 탭 종료 시 자동 소멸) ──

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = secureGetItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  secureSetItem(key, JSON.stringify(data));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('legal_crm_data_updated', { detail: { key } }));
  }
}

/** 전체 CRM 고객 확장 데이터 맵 조회 (동기식 secureGetItem) */
export function loadCrmExtMap(): Record<string, CrmClientExtension> {
  return getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
}

/** 동기식으로 특정 고객의 CRM 확장 데이터를 조회 (없으면 기본값 생성) */
export function getCrmExt(clientId: string): CrmClientExtension {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  return store[clientId] || createDefaultCrmExtension(clientId);
}

/** 특정 고객의 CRM 데이터 부분 업데이트 (단축 alias) */
export async function updateCrmExt(clientId: string, updates: Partial<CrmClientExtension>): Promise<boolean> {
  return updateCrmClientExtension(clientId, updates);
}

/** 동기식으로 특정 고객의 CRM 확장 데이터를 조회 (secureGetItem 사용) */
export function getCrmClientSync(clientId: string): CrmClientExtension | null {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  return store[clientId] || null;
}

/** 특정 고객의 CRM 데이터를 부분 업데이트하고 저장 및 브로드캐스트 */
export async function updateCrmClientExtension(clientId: string, updates: Partial<CrmClientExtension>): Promise<boolean> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const current = store[clientId] || createDefaultCrmExtension(clientId);
  const updated: CrmClientExtension = {
    ...current,
    ...updates,
    lastActivityAt: new Date().toISOString()
  };
  return saveCrmClient(clientId, updated);
}

// ── CRM Client Extension 관리 ──

export type CrmDataStore = Record<string, CrmClientExtension>;

export async function loadCrmData(): Promise<CrmDataStore> {
  if (isSupabaseConfigured) {
    const server = await fetchServerCrmData();
    if (server) return server;
  }
  return loadLocalCrmData();
}

/**
 * 서버 불러오기 결과와 성공 여부를 함께 돌려준다.
 * 저장 직전에 최신 데이터를 다시 읽는 곳(채팅 메모 등)은 이 함수를 써서, 서버를 읽지 못했을 때
 * 이 기기의 오래된 사본이나 빈 기본값으로 서버 행 전체를 덮어쓰지 않게 한다.
 * (loadCrmData는 서버 오류 시 알림 없이 이 기기 사본으로 대체한다)
 */
export async function loadCrmDataResult(): Promise<{ ok: boolean; data: CrmDataStore; source: 'server' | 'local' }> {
  if (!isSupabaseConfigured) return { ok: true, data: loadLocalCrmData(), source: 'local' };
  const server = await fetchServerCrmData();
  if (server) {
    return { ok: true, data: server, source: 'server' };
  }
  // 서버 불러오기 실패 시: 이전에는 빈 객체 {}를 주어 데이터가 덮어씌워지는 위험이 있었음 -> 로컬 캐시를 반환하되 ok: false로 표시
  return { ok: false, data: loadLocalCrmData(), source: 'local' };
}

function loadLocalCrmData(): CrmDataStore {
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

/** 서버(crm_clients) 조회. 오류·예외면 null */
async function fetchServerCrmData(): Promise<CrmDataStore | null> {
    try {
      const { data, error } = await supabase
        .from('crm_clients')
        .select('*');
      if (!error && data) {
        const store: CrmDataStore = {};
        data.forEach((row: any) => {
          store[row.client_id] = {
            // 확장 필드(진술서·D5102·D5103·소명표 등) 먼저 복원 후 고정 컬럼으로 덮어씀 (migration 016)
            ...(row.extension_data || {}),
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
            documentRequests: row.document_requests || [],
            correctionOrders: row.correction_orders || [],
            courtCase: row.court_case,
            alimtokLogs: row.alimtok_logs || [],
          };
        });
        return store;
      }
      if (error) console.warn('[CRM] Supabase load failed, falling back to this device copy', error.message);
    } catch (e) {
      console.warn('[CRM] Supabase load failed, falling back to this device copy', e);
    }
  return null;
}

/** @returns 서버(Supabase) 저장 성공 여부 — 미설정 환경에서는 로컬 저장만 하고 true */
export async function saveCrmClient(clientId: string, ext: CrmClientExtension): Promise<boolean> {
  if (!clientId) {
    console.error('[CRM] saveCrmClient called with empty clientId');
    return false;
  }

  // Always save to localStorage with conflict-safe array merging
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const existing = store[clientId];

  // 안전 병합: 기존 로컬에 이미 존재하는 노트/활동로그 중 누락된 항목이 있다면 안전하게 보존
  let mergedExt = { ...ext };
  if (existing) {
    if (existing.notes && existing.notes.length > 0 && ext.notes) {
      const existingNoteIds = new Set(ext.notes.map(n => n.id));
      const missingNotes = existing.notes.filter(n => !existingNoteIds.has(n.id));
      if (missingNotes.length > 0) {
        mergedExt.notes = [...ext.notes, ...missingNotes];
      }
    }
    if (existing.activities && existing.activities.length > 0 && ext.activities) {
      const existingActIds = new Set(ext.activities.map(a => a.id));
      const missingActs = existing.activities.filter(a => !existingActIds.has(a.id));
      if (missingActs.length > 0) {
        mergedExt.activities = [...ext.activities, ...missingActs];
      }
    }
  }

  store[clientId] = mergedExt;
  setLocalData(CRM_STORAGE_KEY, store);

  // Also persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      // 고정 컬럼에 없는 확장 필드(진술서·D5102·D5103·소명표·13단계 등)는 extension_data(jsonb)에 통째로 보관
      // (migration 016). 파일 본문(uploadedFiles)은 기존 uploaded_files 컬럼을 사용하므로 중복 저장하지 않는다.
      // 인증서 금고(certificateVault)는 개인키 원본이 포함되므로 서버 jsonb로 절대 전송하지 않는다.
      const { uploadedFiles: _files, certificateVault: _vault, ...extensionData } = mergedExt as CrmClientExtension & { certificateVault?: unknown };
      const baseRow = {
        client_id: clientId,
        crm_status: mergedExt.crmStatus,
        assignee_id: mergedExt.assigneeId,
        assigned_lawyer_id: mergedExt.assignedLawyerId || mergedExt.assigneeId,
        assigned_consultant_id: mergedExt.assignedConsultantId,
        assigned_staff_id: mergedExt.assignedStaffId,
        documents: mergedExt.documents,
        notes: mergedExt.notes,
        activities: mergedExt.activities,
        contract_date: mergedExt.contractDate,
        contract_amount: mergedExt.contractAmount,
        last_activity_at: mergedExt.lastActivityAt,
        intake_channel: mergedExt.intakeChannel,
        intake_channel_detail: mergedExt.intakeChannelDetail,
        is_external_client: mergedExt.isExternalClient,
        total_fee: mergedExt.totalFee,
        total_paid: mergedExt.totalPaid,
        fee_schedule: mergedExt.feeSchedule,
        uploaded_files: mergedExt.uploadedFiles,
        document_requests: mergedExt.documentRequests,
        correction_orders: mergedExt.correctionOrders,
        court_case: mergedExt.courtCase,
        alimtok_logs: mergedExt.alimtokLogs,
        updated_at: new Date().toISOString(),
      };
      let { error } = await supabase
        .from('crm_clients')
        .upsert({ ...baseRow, extension_data: extensionData }, { onConflict: 'client_id' });
      // migration 016 미적용(extension_data 컬럼 없음) → 기존 컬럼만으로 재시도
      if (error && (error.code === 'PGRST204' || /extension_data/i.test(error.message || ''))) {
        ({ error } = await supabase.from('crm_clients').upsert(baseRow, { onConflict: 'client_id' }));
      }
      if (error) {
        console.warn('[CRM] Supabase save failed', error.message);
        return false;
      }
    } catch (e) {
      console.warn('[CRM] Supabase save failed', e);
      return false;
    }
  }
  return true;
}

// ── Staff (직원) 관리 ──

// Supabase 설정 시 직원 정보는 서버(staff_members)만 사용한다. 쓰기 실패는 예외로 알린다.
// (이전: supabase-js는 오류를 throw하지 않는데 try/catch로만 감싸 실패를 무시 → 화면만 바뀌고 서버는 그대로)

function mapStaffRow(row: any): StaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role as StaffRole,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    isActive: row.is_active ?? false,
    assignedCount: row.assigned_count || 0,
    createdAt: row.created_at,
    permissions: row.permissions || {},
    status: (row.status || (row.is_active ? 'active' : 'pending')) as StaffMemberStatus,
    invitedBy: row.invited_by || undefined,
    approvedAt: row.approved_at || undefined,
    removedAt: row.removed_at || undefined,
    removalReason: row.removal_reason || undefined,
    lastActiveAt: row.last_active_at || undefined,
    authEmail: row.auth_email || undefined,
    authProvider: row.auth_provider || undefined,
    supabaseUserId: row.supabase_user_id || undefined,
    linkedUserId: row.linked_user_id || undefined,
    supervisingLawyerId: row.supervising_lawyer_id || undefined,
  };
}

function staffWriteError(action: string, error: any): Error {
  const msg = error?.message || String(error || '');
  console.error(`[CRM] 직원 ${action} 실패:`, msg);
  return new Error(`직원 정보를 ${action}하지 못했습니다.${msg ? ` (${msg})` : ''}`);
}

/**
 * 직원 목록
 * @param ownerId 대표 변호사 ID — 지정하면 그 대표가 초대한 직원만 돌려준다(다른 사무소 직원 노출 방지)
 */
export async function loadStaffMembers(ownerId?: string): Promise<StaffMember[]> {
  let members: StaffMember[];
  if (isSupabaseConfigured) {
    let query = supabase.from('staff_members').select('*');
    if (ownerId) {
      // 초대자 기록이 없는 직원(020 적용 전 가입)도 내가 발급한 초대 링크로 들어왔으면 포함
      const { data: used } = await supabase
        .from('invite_tokens').select('used_by')
        .eq('created_by', ownerId).eq('is_used', true).limit(200);
      const usedIds = (used || [])
        .map((r: any) => String(r.used_by || ''))
        .filter(id => /^[A-Za-z0-9_\-]+$/.test(id));
      query = usedIds.length > 0
        ? query.or(`invited_by.eq.${ownerId.replace(/[^A-Za-z0-9_\-]/g, '')},id.in.(${usedIds.join(',')})`)
        : query.eq('invited_by', ownerId);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw staffWriteError('불러오', error);
    members = (data || []).map(mapStaffRow);
  } else {
    members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
    if (ownerId) members = members.filter(m => !m.invitedBy || m.invitedBy === ownerId);
  }
  return members;
}

/** 로그인한 계정(변호사 ID)에 연결된 직원 기록 — 없으면 null */
export async function findStaffRecordForUser(userId: string): Promise<StaffMember | null> {
  if (!userId) return null;
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('staff_members').select('*')
      .eq('linked_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw staffWriteError('확인', error);
    return data && data[0] ? mapStaffRow(data[0]) : null;
  }
  return getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []).find(m => m.linkedUserId === userId) || null;
}

export async function saveStaffMember(member: StaffMember): Promise<void> {
  if (member.role === 'OWNER') throw new Error('대표 변호사 역할은 직원에게 부여할 수 없습니다.');
  if (isSupabaseConfigured) {
    const row: Record<string, any> = {
      id: member.id,
      name: member.name,
      role: member.role,
      email: member.email || null,
      phone: member.phone || null,
      avatar: member.avatar || null,
      is_active: member.isActive,
      assigned_count: member.assignedCount,
      permissions: member.permissions,
      status: member.status,
      invited_by: member.invitedBy || null,
      auth_email: member.authEmail || null,
      auth_provider: member.authProvider || null,
      linked_user_id: member.linkedUserId || null,
      supervising_lawyer_id: member.supervisingLawyerId || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('staff_members').upsert(row, { onConflict: 'id' });
    if (error) throw staffWriteError('저장', error);
    return;
  }
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const idx = members.findIndex(m => m.id === member.id);
  if (idx >= 0) members[idx] = member;
  else members.push(member);
  setLocalData(STAFF_STORAGE_KEY, members);
}

/** 서버 update — 적용된 행이 없으면(RLS 거부·없는 직원) 예외 */
async function updateStaffRow(memberId: string, updates: Record<string, any>, action: string): Promise<void> {
  const { data, error } = await supabase
    .from('staff_members')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select('id');
  if (error) throw staffWriteError(action, error);
  if (!data || data.length === 0) throw new Error(`직원 정보를 ${action}하지 못했습니다. 권한이 없거나 이미 삭제된 직원입니다.`);
}

function updateStaffLocal(memberId: string, patch: (m: StaffMember) => StaffMember) {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  setLocalData(STAFF_STORAGE_KEY, members.map(m => m.id === memberId ? patch(m) : m));
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

/**
 * CRM 고객 데이터 삭제 (이 기기 사본에서만)
 * 이전: localStorage를 직접 읽고 써서, 실제 사본(sessionStorage)은 지워지지 않고
 *       예전 localStorage 사본이 남아 있으면 민감 데이터 전체를 다시 localStorage에 기록했다
 */
export function deleteCrmClient(clientId: string): void {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  if (!(clientId in store)) return;
  delete store[clientId];
  setLocalData(CRM_STORAGE_KEY, store);
}

// ── amjone8@gmail.com 전용 가상 상담 5선 사전 설정 CRM 프로필 ──
const PREDEFINED_AMJONE_PROFILES: Record<string, Partial<CrmClientExtension>> = {
  'req-amjone-1': {
    crmStatus: 'document',
    caseType: 'bankruptcy',
    intakeChannel: 'mykim',
    preInfo: '무릎 관절염 수술 후 식당 일용직 근로 중단. 성인 자녀 명의 원룸에 친족 무상거주 중. 파산관재인 15대 필수서류 심사 및 1,110만 원 면제재산 동시폐지 신청 준비 중.',
    contractDate: '2026-08-16',
    contractAmount: 2400000,
    totalFee: 2400000,
    totalPaid: 1200000,
    feeSchedule: [
      { id: 'fee-1-1', round: 1, amount: 600000, dueDate: '2026-08-16', paidDate: '2026-08-16', status: 'paid', memo: '착수금', paymentMethod: '계좌이체' },
      { id: 'fee-1-2', round: 2, amount: 600000, dueDate: '2026-09-01', paidDate: '2026-09-01', status: 'paid', memo: '1회차 분납', paymentMethod: '계좌이체' },
      { id: 'fee-1-3', round: 3, amount: 600000, dueDate: '2026-09-16', status: 'pending', memo: '2회차 분납 (당일 마감)', paymentMethod: '가상계좌' },
      { id: 'fee-1-4', round: 4, amount: 600000, dueDate: '2026-10-16', status: 'pending', memo: '3회차 잔금' }
    ],
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2026하단2019',
      filedDate: '2026-09-05',
      status: '파산관재인 서류 검토 중',
    },
    notes: [
      {
        id: 'note-amj-1-1',
        clientId: 'req-amjone-1',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '1차 전화상담 완료: 만 58세 여성, 무릎 수술 후 근로능력 현저히 부족함. 2년 전 반환보증금 1,000만원 전액 수술비 영수증 확보 완료. 소명 완료 시 동시폐지(관재인 보수 절약) 유력.',
        createdAt: '2026-09-08T11:00:00Z',
        category: 'consultation'
      }
    ],
    activities: [
      {
        id: 'act-amj-1-1',
        clientId: 'req-amjone-1',
        actorId: 'system',
        actorName: '시스템',
        actorRole: 'OWNER',
        type: 'created',
        description: '마이김변 플랫폼을 통해 [개인파산] 무료상담이 접수되었습니다.',
        createdAt: '2026-09-08T10:15:00Z'
      }
    ]
  },
  'req-amjone-2': {
    crmStatus: 'contracted',
    caseType: 'individual_rehab',
    intakeChannel: 'naver_ad',
    intakeChannelDetail: '네이버 검색광고: "코인 손실 개인회생"',
    preInfo: '2024년 해외선물 및 알트코인 투자 손실 9천만 원. IT 개발자(월 310만원). 서울회생법원 주식/가상자산 손실금 청산가치 불반영 및 청년 24개월 변제 특례 검토 중.',
    contractDate: '2026-07-20',
    contractAmount: 3000000,
    totalFee: 3000000,
    totalPaid: 1000000,
    feeSchedule: [
      { id: 'fee-2-1', round: 1, amount: 1000000, dueDate: '2026-07-20', paidDate: '2026-07-20', status: 'paid', memo: '착수금', paymentMethod: '신용카드' },
      { id: 'fee-2-2', round: 2, amount: 500000, dueDate: '2026-08-20', status: 'overdue', memo: '1회차 분납 (연체 27일)', rescheduledCount: 1, originalDueDate: '2026-08-10', deferralReason: '급여 지연 지급' },
      { id: 'fee-2-3', round: 3, amount: 500000, dueDate: '2026-09-10', status: 'overdue', memo: '2회차 분납 (연체 6일)', rescheduledCount: 2, originalDueDate: '2026-09-01', deferralReason: '대출 이자 납부 곤란' },
      { id: 'fee-2-4', round: 4, amount: 500000, dueDate: '2026-10-10', status: 'pending', memo: '3회차 분납' },
      { id: 'fee-2-5', round: 5, amount: 500000, dueDate: '2026-11-10', status: 'pending', memo: '4회차 잔금' }
    ],
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2026개회89211',
      filedDate: '2026-08-01',
      status: '보정권고 송달 / 대응 중',
    },
    notes: [
      {
        id: 'note-amj-2-1',
        clientId: 'req-amjone-2',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '서울회생법원 준칙 제408호 적용 대상. 해외선물 거래내역서 및 업비트 거래내역 분석 중. 직장 통보 방지 요청 철저 관리 요망. ⚠️ 수임료 2회차 연속 미납 상태로 특별 유선 상담 필요.',
        createdAt: '2026-09-08T16:00:00Z',
        category: 'general'
      }
    ],
    activities: [
      {
        id: 'act-amj-2-1',
        clientId: 'req-amjone-2',
        actorId: 'system',
        actorName: '시스템',
        actorRole: 'OWNER',
        type: 'created',
        description: '네이버 파워링크 검색을 통해 [개인회생] 상담이 접수되었습니다.',
        createdAt: '2026-09-08T15:30:00Z'
      }
    ]
  },
  'req-amjone-3': {
    crmStatus: 'contracted',
    caseType: 'bankruptcy',
    intakeChannel: 'youtube',
    intakeChannelDetail: '유튜브: 파산회생 A to Z 채널',
    preInfo: '치킨 호프집 6년 운영 후 폐업. 부채 2억 4천만 원(신보, 은행, 물품대금). 상가보증금 반환 600만 원 영수증 소명 완료. 당뇨 합병증으로 무자력 파산.',
    contractDate: '2026-09-09',
    contractAmount: 2500000,
    totalFee: 2500000,
    totalPaid: 1000000,
    feeSchedule: [
      { id: 'fee-3-1', round: 1, amount: 1000000, dueDate: '2026-09-09', paidDate: '2026-09-09', status: 'paid', memo: '착수금', paymentMethod: '계좌이체' },
      { id: 'fee-3-2', round: 2, amount: 800000, dueDate: '2026-10-09', status: 'pending', memo: '1회차 분납' },
      { id: 'fee-3-3', round: 3, amount: 700000, dueDate: '2026-11-09', status: 'pending', memo: '2회차 잔금' }
    ],
    courtCase: {
      courtName: '수원회생법원',
      status: '수임 계약 체결 / 접수 준비',
    },
    notes: [
      {
        id: 'note-amj-3-1',
        clientId: 'req-amjone-3',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '수임계약 체결 완료. 착수금 100만원 수납. 유체동산 압류 통지서 송달되었으므로 파산신청과 동시에 강제집행 중지명령 신청서 함께 제출 예정.',
        createdAt: '2026-09-09T10:30:00Z',
        category: 'contract'
      }
    ],
    activities: [
      {
        id: 'act-amj-3-1',
        clientId: 'req-amjone-3',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'contract',
        description: '전자 수임계약 체결 완료 (총 수임료 250만원 / 착수금 100만원 수납)',
        createdAt: '2026-09-09T10:20:00Z'
      }
    ]
  },
  'req-amjone-4': {
    crmStatus: 'filed',
    caseType: 'individual_rehab',
    intakeChannel: 'referral',
    intakeChannelDetail: '기존 인가 의뢰인 소개',
    preInfo: '빌라왕 전세사기 피해자(전세대출 1억 8,000만 원 미반환). 서울회생법원 2026개회104921 접수 완료. 금지명령 인용 완료(2026.09.10).',
    contractDate: '2026-08-28',
    contractAmount: 2200000,
    totalFee: 2200000,
    totalPaid: 2200000,
    feeSchedule: [
      { id: 'fee-4-1', round: 1, amount: 1000000, dueDate: '2026-08-28', paidDate: '2026-08-28', status: 'paid', memo: '착수금', paymentMethod: '계좌이체' },
      { id: 'fee-4-2', round: 2, amount: 600000, dueDate: '2026-09-02', paidDate: '2026-09-02', status: 'paid', memo: '1회차 분납', paymentMethod: '계좌이체' },
      { id: 'fee-4-3', round: 3, amount: 600000, dueDate: '2026-09-10', paidDate: '2026-09-10', status: 'paid', memo: '2회차 완납', paymentMethod: '계좌이체' }
    ],
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2026개회104921',
      filedDate: '2026-09-02',
      status: '금지명령 인용 / 개시 대기',
    },
    notes: [
      {
        id: 'note-amj-4-1',
        clientId: 'req-amjone-4',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '서울회생법원 2026개회104921 접수 완료. 금지명령 인용 결정문 송달되어 시중은행 독촉 즉시 전면 중단됨. HUG 안심전세대출 구제 특례 적용 진행 중. 수임료 전액 완납 완료.',
        createdAt: '2026-09-10T09:30:00Z',
        category: 'court'
      }
    ],
    activities: [
      {
        id: 'act-amj-4-1',
        clientId: 'req-amjone-4',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'court_case',
        description: '서울회생법원 금지명령 인용 결정 (사건번호: 2026개회104921)',
        createdAt: '2026-09-10T09:15:00Z'
      }
    ]
  },
  'req-amjone-5': {
    crmStatus: 'contracted',
    caseType: 'individual_rehab',
    intakeChannel: 'blog',
    intakeChannelDetail: '네이버 블로그: "급여 압류 막는 법" 칼럼 유입',
    preInfo: '제조업 생산직(월 260만 원, 4인 가족). 모친 암 수술비로 대부업체 3곳 2,800만 원 등 총 6,200만 원 채무. 연체 직전 추심원 방문 예고 수신. 긴급 전자계약 체결 완료.',
    contractDate: '2026-09-12',
    contractAmount: 2000000,
    totalFee: 2000000,
    totalPaid: 500000,
    feeSchedule: [
      { id: 'fee-5-1', round: 1, amount: 500000, dueDate: '2026-09-12', paidDate: '2026-09-12', status: 'paid', memo: '착수금', paymentMethod: '계좌이체' },
      { id: 'fee-5-2', round: 2, amount: 500000, dueDate: '2026-09-18', status: 'pending', memo: '1회차 분납 (D-2 사전안내)' },
      { id: 'fee-5-3', round: 3, amount: 500000, dueDate: '2026-10-18', status: 'pending', memo: '2회차 분납' },
      { id: 'fee-5-4', round: 4, amount: 500000, dueDate: '2026-11-18', status: 'pending', memo: '3회차 잔금' }
    ],
    courtCase: {
      courtName: '인천지방법원',
      status: '부채증명서 발급 및 신청서 작성 중',
    },
    notes: [],
    activities: [
      {
        id: 'act-amj-5-1',
        clientId: 'req-amjone-5',
        actorId: 'system',
        actorName: '시스템',
        actorRole: 'OWNER',
        type: 'created',
        description: '블로그 콘텐츠를 통해 [신규 상담 신청]이 접수되었습니다. (긴급 전화상담 요청)',
        createdAt: '2026-09-10T08:50:00Z'
      }
    ]
  },

  // ── [Stage 1: 상담·제안] 박지훈 ──
  'req-stage1-lead': {
    crmStatus: 'requested',
    thirteenStage: 'consultation_scheduled',
    caseType: 'individual_rehab',
    intakeChannel: 'direct_input',
    preInfo: '외식업 매장 자영업 대출 등 1억 2,500만원 채무. 월 220만원 순익. 빠른 금지명령과 사업자 개인회생 제안서 발송 대기 중.',
    notes: [
      {
        id: 'note-st1-1',
        clientId: 'req-stage1-lead',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: 'AI 사건 진단 결과 총 채무 1.25억, 월 가용소득 약 85만원 수준으로 예상 탕감률 약 79% 분석됨. 맞춤 제안서 발송 요망.',
        createdAt: '2026-10-01T10:30:00Z',
        category: 'consult'
      }
    ],
    activities: [
      {
        id: 'act-st1-1',
        clientId: 'req-stage1-lead',
        actorId: 'system',
        actorName: '시스템',
        actorRole: 'OWNER',
        type: 'created',
        description: '의뢰인으로부터 [신규 1:1 상담 및 제안서 요청]이 접수되었습니다.',
        createdAt: '2026-10-01T10:00:00Z'
      }
    ]
  },

  // ── [Stage 2-A: 수임계약 - 전자서명 대기] 최수안 ──
  'req-stage2-electronic': {
    crmStatus: 'consulting',
    thirteenStage: 'proposal_sent',
    caseType: 'individual_rehab',
    contractMethod: 'electronic',
    totalFee: 1600000,
    feeSchedule: [
      { id: 'fee-st2e-1', round: 1, amount: 400000, dueDate: '2026-10-05', status: 'pending', memo: '착수금' },
      { id: 'fee-st2e-2', round: 2, amount: 400000, dueDate: '2026-11-05', status: 'pending', memo: '1회차 분납' },
      { id: 'fee-st2e-3', round: 3, amount: 400000, dueDate: '2026-12-05', status: 'pending', memo: '2회차 분납' },
      { id: 'fee-st2e-4', round: 4, amount: 400000, dueDate: '2027-01-05', status: 'pending', memo: '3회차 잔금' },
    ],
    preInfo: '1금융 신용대출 6,800만원. 제안서 조건(수임료 160만) 수락 후 모바일 전자계약서 발송 완료 (원격 서명 대기).',
    activities: [
      {
        id: 'act-st2e-1',
        clientId: 'req-stage2-electronic',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'contract',
        description: '전자 수임계약서 패키지 발송 완료 (의뢰인 휴대폰 본인인증 및 서명 대기)',
        createdAt: '2026-09-28T14:30:00Z'
      }
    ]
  },

  // ── [Stage 2-B: 수임계약 - 방문 체결 요청] 강태양 ──
  'req-stage2-visit': {
    crmStatus: 'consulting',
    thirteenStage: 'proposal_sent',
    caseType: 'individual_rehab',
    contractMethod: 'in_person',
    paperContractInfo: {
      method: 'in_person',
      signedDate: '',
      notes: '방문 희망일시: 2026-10-05 14:00 (신분증 및 소득서류 지참 내방 상담 희망)'
    },
    totalFee: 1700000,
    preInfo: '핸드폰 정지로 전자서명 불가하여 사무소 방문(대면) 체결 요청 접수. 내방 일정 확정 대기 중.',
    notes: [
      {
        id: 'note-st2v-1',
        clientId: 'req-stage2-visit',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '의뢰인이 통신비 체납으로 본인인증이 안 되어 10월 5일 오후 2시 사무소 내방 서면 체결을 요청함. 회의실 예약 및 종이 계약서 서식 인쇄 준비 필요.',
        createdAt: '2026-09-29T11:30:00Z',
        category: 'consult'
      }
    ],
    activities: [
      {
        id: 'act-st2v-1',
        clientId: 'req-stage2-visit',
        actorId: 'client',
        actorName: '강태양',
        actorRole: 'OWNER',
        type: 'contract',
        description: '의뢰인이 [법률사무소 방문 대면 체결] 전환을 요청하였습니다. (희망일: 2026-10-05 14:00)',
        createdAt: '2026-09-29T11:15:00Z'
      }
    ]
  },

  // ── [Stage 2-C: 수임계약 - 우편 등기 요청] 윤하은 ──
  'req-stage2-postal': {
    crmStatus: 'consulting',
    thirteenStage: 'proposal_sent',
    caseType: 'individual_rehab',
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
    },
    totalFee: 1500000,
    preInfo: '강원 춘천 거주로 방문 곤란하여 우편 등기 계약서 발송 요청 접수. 등기우편 발송 대기.',
    activities: [
      {
        id: 'act-st2p-1',
        clientId: 'req-stage2-postal',
        actorId: 'client',
        actorName: '윤하은',
        actorRole: 'OWNER',
        type: 'contract',
        description: '의뢰인이 [우편(등기) 서면 계약] 전환을 요청하였습니다. (수령주소: 강원도 춘천시 영서로 1980)',
        createdAt: '2026-09-30T09:45:00Z'
      }
    ]
  },

  // ── [Stage 3: 서류 준비] 정우성 ──
  'req-stage3-docs': {
    crmStatus: 'document',
    thirteenStage: 'documents_gathering',
    caseType: 'individual_rehab',
    contractDate: '2026-09-15',
    contractAmount: 1800000,
    contractMethod: 'electronic',
    totalFee: 1800000,
    totalPaid: 600000,
    feeSchedule: [
      { id: 'fee-st3-1', round: 1, amount: 600000, dueDate: '2026-09-15', paidDate: '2026-09-15', status: 'paid', memo: '착수금 완납' },
      { id: 'fee-st3-2', round: 2, amount: 400000, dueDate: '2026-10-15', status: 'pending', memo: '1회차 분납' },
      { id: 'fee-st3-3', round: 3, amount: 400000, dueDate: '2026-11-15', status: 'pending', memo: '2회차 분납' },
      { id: 'fee-st3-4', round: 4, amount: 400000, dueDate: '2026-12-15', status: 'pending', memo: '3회차 잔금' }
    ],
    preInfo: '수임계약 체결 완료. 15종 필수서류 수합 중 (동사무소 서류 6종 승인, 세무서 서류 검토 중).',
    documents: [
      { id: 'doc-01', name: '주민등록등본', category: 'basic', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-02', name: '주민등록초본 (과거주소 포함)', category: 'basic', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-03', name: '가족관계증명서 (상세)', category: 'basic', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-04', name: '혼인관계증명서 (상세)', category: 'basic', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-05', name: '인감증명서 (채권자수+3통)', category: 'basic', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-06', name: '지방세 세목별 과세증명서', category: 'property', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-07', name: '근로소득원천징수영수증', category: 'income', required: true, checked: false, reviewStatus: 'submitted' },
      { id: 'doc-08', name: '급여통장 거래내역서 (1년치)', category: 'income', required: true, checked: false, reviewStatus: 'not_submitted' },
      { id: 'doc-09', name: '예금계좌조회서 (계좌정보통합관리원)', category: 'property', required: true, checked: false, reviewStatus: 'not_submitted' },
      { id: 'doc-10', name: '보험계약조회서 및 해약환급금확인서', category: 'property', required: true, checked: false, reviewStatus: 'not_submitted' },
      { id: 'doc-11', name: '임대차계약서 사본', category: 'property', required: true, checked: true, reviewStatus: 'approved' },
      { id: 'doc-12', name: '자동차등록원부 (갑/을)', category: 'property', required: false, checked: false, reviewStatus: 'not_submitted' },
      { id: 'doc-13', name: '부채증명서 (채권사별 각 1통)', category: 'debt', required: true, checked: false, reviewStatus: 'not_submitted' },
    ],
    activities: [
      {
        id: 'act-st3-1',
        clientId: 'req-stage3-docs',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'document',
        description: '공문서 6종(등초본, 가족관계증명서, 임대차계약서 등) 검토 및 최종 승인 완료',
        createdAt: '2026-09-20T11:00:00Z'
      }
    ]
  },

  // ── [Stage 4: 신청·접수] 최은지 ──
  'req-stage4-filing': {
    crmStatus: 'applied',
    thirteenStage: 'petition_filed',
    caseType: 'individual_rehab',
    contractDate: '2026-08-01',
    contractAmount: 1800000,
    totalFee: 1800000,
    totalPaid: 1800000,
    preInfo: '서울회생법원 2026개회10428 접수 완료. 금지명령 인용 송달 완료. 1회차 집회 대기 중.',
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2026개회10428',
      judgeDepartment: '제21단독',
      trusteeName: '박회생 위원',
      status: '금지명령 인용 / 서류 심사 중',
      appliedAt: '2026-08-10',
      prohibitionOrderDate: '2026-08-14'
    },
    activities: [
      {
        id: 'act-st4-1',
        clientId: 'req-stage4-filing',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'court_case',
        description: '서울회생법원 전자접수 완료 (사건번호: 2026개회10428) 및 금지명령 인용 결정',
        createdAt: '2026-08-14T10:00:00Z'
      }
    ]
  },

  // ── [Stage 5: 보정·개시] 김민석 ──
  'req-stage5-correction': {
    crmStatus: 'correction',
    thirteenStage: 'correction_recommended',
    caseType: 'individual_rehab',
    contractDate: '2026-07-20',
    contractAmount: 2000000,
    totalFee: 2000000,
    totalPaid: 2000000,
    preInfo: '수원회생법원 1차 보정권고 수령(기한 14일 이내). 100만원 이상 출금 소명서 및 통장 내역 작성 중.',
    courtCase: {
      courtName: '수원회생법원',
      caseNumber: '2026개회33912',
      judgeDepartment: '제12단독',
      trusteeName: '최도산 위원',
      status: '1차 보정권고 수령 대응 중',
      appliedAt: '2026-08-01'
    },
    correctionOrders: [
      {
        id: 'corr-st5-1',
        orderNumber: 1,
        courtName: '수원회생법원',
        receivedAt: '2026-09-25',
        deadline: '2026-10-09',
        status: 'drafting',
        content: '1. 최근 1년간 각 은행 계좌에서 100만 원 이상 인출된 내역에 대하여 그 사용처를 구체적으로 소명하고 소명자료(영수증 등)를 제출할 것.\n2. 배우자 명의 재산(차량 및 임차보증금)에 대하여 형성 경위를 밝히고 청산가치에 1/2 반영 여부를 재산목록에 보정할 것.',
        responseDocId: 'doc-corr-st5-1'
      }
    ],
    activities: [
      {
        id: 'act-st5-1',
        clientId: 'req-stage5-correction',
        actorId: 'system',
        actorName: '전자소송 연동',
        actorRole: 'OWNER',
        type: 'court_case',
        description: '수원회생법원 1차 보정권고 전자 송달 접수 (기한: 2026-10-09까지)',
        createdAt: '2026-09-25T15:30:00Z'
      }
    ]
  },

  // ── [Stage 6: 변제·면책] 한예은 ──
  'req-stage6-discharge': {
    crmStatus: 'discharged',
    thirteenStage: 'discharge_granted',
    caseType: 'individual_rehab',
    contractDate: '2023-08-10',
    contractAmount: 1800000,
    totalFee: 1800000,
    totalPaid: 1800000,
    preInfo: '36개월 변제금 완납 완료. 법원 면책 결정 송달 및 신용정보원 공공기록 해제 완료.',
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2023개회55120',
      status: '36개월 변제 완료 / 최종 면책 허가 확정',
      appliedAt: '2023-08-20',
      prohibitionOrderDate: '2023-08-25',
      commencementDate: '2023-11-10',
      approvalDate: '2024-02-15',
      dischargeDate: '2026-08-15'
    },
    repaymentPlan: {
      monthlyRepaymentTotal: 780000,
      months: 36,
      totalDebt: 72000000,
      totalLiquidationValue: 6000000,
      totalForgivenAmount: 43920000,
      totalRepaymentRate: 39
    },
    activities: [
      {
        id: 'act-st6-1',
        clientId: 'req-stage6-discharge',
        actorId: 'system',
        actorName: '법원 전자송달',
        actorRole: 'OWNER',
        type: 'court_case',
        description: '서울회생법원 최종 면책 허가 결정 확정 (신용정보원 공공기록 코드 1101 해제)',
        createdAt: '2026-08-15T11:00:00Z'
      }
    ]
  },

  // ── [개인파산 Stage 3] 오동석 ──
  'req-bankruptcy-stage3': {
    crmStatus: 'document',
    thirteenStage: 'documents_gathering',
    caseType: 'bankruptcy',
    preInfo: '68세 고령 무소득 기초수급자 개인파산 서류 준비. 파산 관재인 면담 서류 수합 중.',
    notes: [
      {
        id: 'note-bk-1',
        clientId: 'req-bankruptcy-stage3',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '수급자 증명서 및 생계급여 내역 확보 완료. 법원 파산관재인 예납금(30만원) 안내 완료.',
        createdAt: '2026-09-20T14:00:00Z',
        category: 'consult'
      }
    ],
    activities: [
      {
        id: 'act-bk-1',
        clientId: 'req-bankruptcy-stage3',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'document',
        description: '개인파산 필수 서류(기초생활수급자 증명서 등) 4종 접수 완료',
        createdAt: '2026-09-22T10:00:00Z'
      }
    ]
  }

};

// ── CrmClientExtension 초기화 헬퍼 ──

export function createDefaultCrmExtension(
  clientId: string, 
  caseType: 'individual_rehab' | 'bankruptcy' = 'individual_rehab',
  incomeType?: 'EMPLOYEE' | 'BUSINESS' | 'FREELANCER' | 'DAY_LABORER' | 'PART_TIME'
): CrmClientExtension {
  // 시연용 사전 프로필은 DEV 빌드에서만 적용 (운영에서는 가짜 사건번호·수임료·메모가 실제 고객처럼 저장되던 문제)
  const predefined = PREDEFINED_AMJONE_PROFILES[clientId] || {};
  const effectiveCaseType = (predefined.caseType as any) || caseType;
  const docs = getStandardDocumentsForClient(effectiveCaseType, incomeType);
  
  return {
    crmStatus: predefined.crmStatus || 'requested',
    caseType: effectiveCaseType,
    documents: predefined.documents || (docs || []).map((d: any) => ({ ...d, reviewStatus: d.reviewStatus || 'not_submitted' })),
    notes: predefined.notes || [],
    // 실제 접수 시각을 모르는 상태에서 '지금' 날짜의 가짜 접수 이력을 만들지 않음
    activities: predefined.activities || [],
    lastActivityAt: predefined.lastActivityAt || new Date().toISOString(),
    intakeChannel: predefined.intakeChannel || 'mykim',
    intakeChannelDetail: predefined.intakeChannelDetail,
    isExternalClient: predefined.isExternalClient || false,
    preInfo: predefined.preInfo,
    courtCase: predefined.courtCase,
    contractDate: predefined.contractDate,
    contractAmount: predefined.contractAmount,
    totalFee: predefined.totalFee,
    totalPaid: predefined.totalPaid,
    feeSchedule: predefined.feeSchedule || [],
    uploadedFiles: predefined.uploadedFiles || [],
    correctionOrders: predefined.correctionOrders || [],
    alimtokLogs: predefined.alimtokLogs || [],
    documentRequests: predefined.documentRequests || [],
  };
}

// ── 문서 양방향 동기화 헬퍼 함수 ──

// approve/reject/requestDocument 공통
// - current: 호출부가 가진 최신 고객 데이터의 '사본'. 넘기면 이 기기 사본 대신 이 값을 기준으로 고쳐 저장한다.
//   함수는 이 객체의 최상위 필드(documents·uploadedFiles·documentRequests·lastActivityAt)를 새 값으로 바꾸므로
//   호출 뒤 이 객체가 곧 저장한 값이다 (React state 객체를 그대로 넘기지 말 것).
// - 이전: 이 기기 사본(sessionStorage, 탭 단위)에만 의존해 고객 행이 없으면(새 탭·다른 기기에서는 항상 없음)
//   아무것도 저장하지 않고 끝났는데, 호출부는 성공 안내를 띄웠다.
// - @returns saveCrmClient 결과 (고객 행도 current도 없으면 false)
function resolveDocTarget(clientId: string, current?: CrmClientExtension): CrmClientExtension | null {
  if (current) return current;
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  return store[clientId] || null;
}

/** 서류 승인 처리 */
export async function approveDocument(
  clientId: string,
  docId: string,
  reviewerName: string,
  current?: CrmClientExtension
): Promise<boolean> {
  const ext = resolveDocTarget(clientId, current);
  if (!ext) return false;

  ext.documents = (ext.documents || []).map(d =>
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
  return saveCrmClient(clientId, ext);
}

/** 서류 반려 처리 (current·반환값은 approveDocument와 같음) */
export async function rejectDocument(
  clientId: string,
  docId: string,
  reviewerName: string,
  reason: string,
  current?: CrmClientExtension
): Promise<boolean> {
  const ext = resolveDocTarget(clientId, current);
  if (!ext) return false;

  ext.documents = (ext.documents || []).map(d =>
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
  return saveCrmClient(clientId, ext);
}

/** 변호사 → 고객 추가 서류 요청 (current·반환값은 approveDocument와 같음) */
export async function requestDocument(
  clientId: string,
  request: Omit<DocumentRequest, 'id' | 'requestedAt' | 'fulfilled'>,
  current?: CrmClientExtension
): Promise<boolean> {
  const ext = resolveDocTarget(clientId, current);
  if (!ext) return false;

  const newRequest: DocumentRequest = {
    ...request,
    id: `dreq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestedAt: new Date().toISOString(),
    fulfilled: false,
  };

  ext.documentRequests = [...(ext.documentRequests || []), newRequest];
  ext.lastActivityAt = new Date().toISOString();
  return saveCrmClient(clientId, ext);
}

/** 고객 서류 제출 (uploadedFiles에 저장 + 체크리스트 자동 매핑) */
export async function submitClientDocument(
  clientId: string,
  file: DocumentFile,
  linkedDocId?: string
): Promise<void> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  // CRM 레코드가 아직 없는 의뢰인도 제출이 버려지지 않도록 기본 레코드 생성
  const ext = store[clientId] || createDefaultCrmExtension(clientId);

  // uploadedFiles에 추가 (파일 ID가 없으면 생성 — 체크리스트 연결에 필요)
  const newFile: DocumentFile = {
    ...file,
    id: file.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uploadSource: 'client',
    linkedDocId: linkedDocId,
    reviewStatus: 'submitted',
  };
  ext.uploadedFiles = [...(ext.uploadedFiles || []), newFile];

  // 체크리스트 항목과 매핑
  if (linkedDocId) {
    ext.documents = (ext.documents || []).map(d =>
      d.id === linkedDocId ? {
        ...d,
        reviewStatus: 'submitted' as DocumentReviewStatus,
        linkedFileId: newFile.id,
        submittedAt: new Date().toISOString(),
      } : d
    );

    // documentRequests에서 해당 요청 fulfilled 처리 (커스텀 요청 id 또는 체크리스트 linkedDocId 매칭)
    if (ext.documentRequests) {
      ext.documentRequests = ext.documentRequests.map(req =>
        (req.id === linkedDocId || req.linkedDocId === linkedDocId) && !req.fulfilled ? {
          ...req,
          fulfilled: true,
          fulfilledAt: new Date().toISOString(),
          fulfilledFileId: newFile.id,
        } : req
      );
    }
  }

  ext.lastActivityAt = new Date().toISOString();
  const synced = await saveCrmClient(clientId, ext);
  if (!synced) throw new Error('서버 저장 실패');
}

/**
 * 전자계약 체결/발송 시 CRM 확장 데이터에 반영할 순수 패치 생성
 * - 계약서 금액(totalFee), 계약일(contractDate), 약정액(contractAmount) 동기화
 * - 분납 스케줄: 기존 납부 상태(isPaid, paidAt, paymentMethod, receiptUrl 등) 및 연기/알림 이력 보존
 * - CRM 상태 승격: requested/consulting 상태에서만 contracted로 승격 (filed 이후 진행 사건 덮어쓰기 방지)
 * - 상태 승격 시 thirteenStageAfterStatusChange를 통해 13단계 여정도 일관되게 맞춤
 * - 활동 로그: 같은 계약 ID의 직전 상태와 달라졌을 때만 추가 (금액은 feeTotalWon으로 '원' 단위 포맷)
 */
export function buildContractSyncPatch(
  ext: CrmClientExtension,
  contract: ElectronicContract,
  actor?: { id: string; name: string; role: StaffRole },
  clientId?: string
): Partial<CrmClientExtension> {
  const actorInfo = actor || { id: 'system', name: contract.lawyerName || '담당 변호사', role: 'LAWYER' as StaffRole };
  const patch: Partial<CrmClientExtension> = {
    totalFee: contract.totalFee,
    contractDate: contract.contractDate,
    contractAmount: contract.totalFee,
  };

  // 분납표 보존 매칭: 계약서 feeSchedule을 기반으로 하되, 기존 CRM에 기록된 납부/연기/알림 상태 유지
  if (contract.feeSchedule && contract.feeSchedule.length > 0) {
    const prevList = ext.feeSchedule || [];
    patch.feeSchedule = contract.feeSchedule.map(f => {
      const prev = prevList.find(p => (f.id && p.id === f.id) || p.round === f.round);
      const amountUnit = f.amountUnit || (f.amount >= 10000 ? 'won' : 'manwon');
      return {
        ...f,
        amountUnit,
        status: prev?.status ?? f.status,
        paidDate: prev?.paidDate ?? f.paidDate,
        paymentMethod: prev?.paymentMethod ?? f.paymentMethod,
        memo: prev?.memo ?? f.memo,
        originalDueDate: prev?.originalDueDate ?? f.originalDueDate,
        deferralReason: prev?.deferralReason ?? f.deferralReason,
        rescheduledCount: prev?.rescheduledCount ?? f.rescheduledCount,
        lastNotifiedAt: prev?.lastNotifiedAt ?? f.lastNotifiedAt,
        lastNotifiedType: prev?.lastNotifiedType ?? f.lastNotifiedType,
      };
    });

    // 기납부 금액(totalPaid) 자동 산출 및 보존 (이전: totalPaid 누락으로 CRM 상단 납부 진행률이 불일치하던 문제 해결)
    patch.totalPaid = patch.feeSchedule
      .filter(f => f.status === 'paid')
      .reduce((sum, f) => {
        const amt = f.amountUnit === 'won' ? f.amount : f.amount * 10000;
        return sum + amt;
      }, 0);
  }

  // 상태 승격: client_review / pending_sign / signing / completed 일 때
  // 현재 CRM 상태가 requested 또는 consulting일 때만 'contracted'로 승격 (진행 중인 사건 강제 되돌림 방지)
  const isContractActive = ['completed', 'signing', 'pending_sign', 'client_review'].includes(contract.status);
  if (isContractActive && ['requested', 'consulting'].includes(ext.crmStatus)) {
    patch.crmStatus = 'contracted';
    const isBk = ext.caseType === 'bankruptcy' || ext.caseType === 'individual_bankruptcy';
    patch.thirteenStage = thirteenStageAfterStatusChange(ext.thirteenStage, 'contracted', isBk);
  }

  // 활동 로그(타임라인) 추가: 같은 계약의 직전 활동 로그 상태와 다를 때만 기록
  const lastContractActivity = [...(ext.activities || [])]
    .reverse()
    .find(a => a.metadata?.contractId === contract.id);

  if (!lastContractActivity || lastContractActivity.metadata?.status !== contract.status) {
    const totalWon = feeTotalWon(contract.totalFee);
    const logDesc = contract.status === 'completed'
      ? `전자계약 체결 완료 (계약번호: ${contract.id}, 약정 수임료: ${totalWon.toLocaleString()}원)`
      : `전자계약서 발송 및 서명 요청 (계약번호: ${contract.id})`;

    const targetClientId = clientId || contract.clientId || 'unknown';
    patch.activities = [
      ...(ext.activities || []),
      createActivityLog(
        targetClientId,
        actorInfo.id,
        actorInfo.name,
        actorInfo.role,
        'contract_signed' as CrmActivityType,
        logDesc,
        { contractId: contract.id, status: contract.status }
      )
    ];
  }

  return patch;
}

/** 전자계약 체결 시 CRM 동기화 (수임료, 분납스케줄, 진행상태, 활동로그 일괄 업데이트) */
export async function syncContractToCrm(
  clientId: string,
  contract: ElectronicContract,
  actor?: { id: string; name: string; role: StaffRole }
): Promise<CrmClientExtension | null> {
  const { ok, data: store } = await loadCrmDataResult();
  const currentExt = store[clientId];

  // 읽기 실패이고 로컬 사본도 없으면 데이터 유실 방지를 위해 저장하지 않음
  if (!ok && !currentExt) {
    console.warn(`[syncContractToCrm] CRM 데이터 로드 실패 및 로컬 사본 없음으로 동기화 건너뜀: ${clientId}`);
    return null;
  }

  const ext = currentExt || createDefaultCrmExtension(clientId);
  const patch = buildContractSyncPatch(ext, contract, actor, clientId);
  const merged: CrmClientExtension = {
    ...ext,
    ...patch,
    lastActivityAt: new Date().toISOString(),
  };

  const saved = await saveCrmClient(clientId, merged);
  return saved ? merged : null;
}

// ============================================================
// 케이스 관리 유틸리티 (LeadMaster 이식)
// ============================================================

/** 전화번호 포맷팅 (010-XXXX-XXXX) */
export function formatPhone(value: string): string {
  // 국가번호(+82)는 숫자만 남기기 전에 바꾼다 (이전: '+'를 먼저 지워 '+82 10-…'가 '821-…'로 변형)
  let digits = String(value || '').trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+82')) digits = '0' + digits.slice(3).replace(/^0/, '');
  else if (/^82(1|2|[3-6]\d)/.test(digits) && digits.length >= 11) digits = '0' + digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('02')) {
    if (digits.length <= 9) return digits.replace(/(\d{2})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (digits.length <= 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

/** 국내 휴대폰·일반전화 형식인지 (하이픈 포함 formatPhone 결과 기준) */
export function isValidKoreanPhone(formatted: string): boolean {
  return /^01[016789]-\d{3,4}-\d{4}$/.test(formatted)
    || /^02-\d{3,4}-\d{4}$/.test(formatted)
    || /^0[3-6]\d-\d{3,4}-\d{4}$/.test(formatted)
    || /^070-\d{4}-\d{4}$/.test(formatted);
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
/** 휴지통 보관 기간 */
export const RECYCLE_BIN_RETENTION_DAYS = 30;

/**
 * 소프트 삭제 (deletedAt 설정)
 * @returns serverOk — 서버 반영 여부 (Supabase 미설정이면 true). RLS에 막혀 0행이면 false.
 */
export async function softDeleteCrmClient(clientId: string): Promise<{ serverOk: boolean }> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return { serverOk: false };
  ext.deletedAt = new Date().toISOString();
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  if (!isSupabaseConfigured) return { serverOk: true };
  try {
    const { data, error } = await supabase.from('crm_clients').update({
      deleted_at: ext.deletedAt,
      updated_at: new Date().toISOString(),
    }).eq('client_id', clientId).select('client_id');
    // 이전: 반환 오류를 확인하지 않아 서버 실패가 조용히 묻혔음
    if (error) { console.warn('[CRM] 서버 휴지통 이동 실패:', error.message); return { serverOk: false }; }
    return { serverOk: (data || []).length > 0 };
  } catch (e) {
    console.warn('[CRM] Supabase soft delete failed', e);
    return { serverOk: false };
  }
}

/** 소프트 삭제 복원 — 삭제 전 진행 단계를 유지 (이전: 항상 '요청 대기'로 초기화) */
export async function restoreCrmClient(clientId: string): Promise<{ serverOk: boolean }> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const ext = store[clientId];
  if (!ext) return { serverOk: false };
  delete ext.deletedAt;
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  if (!isSupabaseConfigured) return { serverOk: true };
  try {
    const { data, error } = await supabase.from('crm_clients').update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }).eq('client_id', clientId).select('client_id');
    if (error) { console.warn('[CRM] 서버 복원 실패:', error.message); return { serverOk: false }; }
    return { serverOk: (data || []).length > 0 };
  } catch (e) {
    console.warn('[CRM] Supabase restore failed', e);
    return { serverOk: false };
  }
}

/**
 * 휴지통 정리 — 보관 기간이 지난 건을 이 브라우저와 서버(본인 권한 범위, RLS)에서 영구 삭제
 * (이전: 이 브라우저 저장소에서만 지워 서버 행은 영구 보관됐는데 화면에는 '30일 후 자동 영구 삭제'로 안내)
 */
export async function cleanupRecycleBin(): Promise<{ localDeleted: number; serverDeleted: number; serverError?: string }> {
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  const cutoffMs = Date.now() - RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let localDeleted = 0;
  for (const [id, ext] of Object.entries(store)) {
    if (ext.deletedAt && new Date(ext.deletedAt).getTime() < cutoffMs) {
      delete store[id];
      localDeleted++;
    }
  }
  if (localDeleted > 0) setLocalData(CRM_STORAGE_KEY, store);

  let serverDeleted = 0;
  let serverError: string | undefined;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('crm_clients')
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', new Date(cutoffMs).toISOString())
        .select('client_id');
      if (error) serverError = error.message;
      else serverDeleted = (data || []).length;
    } catch (e) {
      serverError = e instanceof Error ? e.message : '서버 정리 실패';
    }
  }
  return { localDeleted, serverDeleted, serverError };
}

// ============================================================
// 직원 관리 확장 서비스 (Staff Management Extended)
// ============================================================

const STAFF_ACTIVITY_STORAGE_KEY = 'legal_crm_staff_activities';

// ── 직원 상태 변경 ──

/** 가입 승인 — 권한이 비어 있으면(초대 수락 RPC는 빈 권한으로 만든다) 역할 기본 권한을 함께 저장 */
export async function approveStaffMember(memberId: string, permissions?: StaffPermissions): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { status: 'active', is_active: true, approved_at: now, ...(permissions ? { permissions } : {}) }, '승인');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, status: 'active', isActive: true, approvedAt: now, lastActiveAt: now, ...(permissions ? { permissions } : {}) }));
}

export async function rejectStaffMember(memberId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('staff_members').delete().eq('id', memberId).select('id');
    if (error) throw staffWriteError('거부', error);
    if (!data || data.length === 0) throw new Error('가입 요청을 거부하지 못했습니다. 권한이 없거나 이미 처리된 요청입니다.');
    return;
  }
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  setLocalData(STAFF_STORAGE_KEY, members.filter(m => m.id !== memberId));
}

export async function suspendStaffMember(memberId: string, reason?: string): Promise<void> {
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { status: 'suspended', is_active: false, removal_reason: reason || null }, '정지');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, status: 'suspended', isActive: false, removalReason: reason }));
}

export async function reactivateStaffMember(memberId: string): Promise<void> {
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { status: 'active', is_active: true, removal_reason: null }, '재개');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, status: 'active', isActive: true, removalReason: undefined, lastActiveAt: new Date().toISOString() }));
}

export async function removeStaffMemberWithReason(memberId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { status: 'removed', is_active: false, removed_at: now, removal_reason: reason }, '탈퇴 처리');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, status: 'removed', isActive: false, removedAt: now, removalReason: reason }));
}

/** 감독 변호사 지정 (이전: 화면 상태만 바뀌고 저장되지 않음) */
export async function updateStaffSupervisor(memberId: string, supervisingLawyerId: string | undefined): Promise<void> {
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { supervising_lawyer_id: supervisingLawyerId || null }, '저장');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, supervisingLawyerId }));
}

/** 역할 변경 — 권한은 새 역할 기본값으로 초기화. OWNER로는 바꿀 수 없음 */
export async function updateStaffRole(memberId: string, role: StaffRole, permissions: StaffPermissions): Promise<void> {
  if (role === 'OWNER') throw new Error('대표 변호사 역할은 직원에게 부여할 수 없습니다.');
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { role, permissions }, '역할 변경');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, role, permissions }));
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

/**
 * 개별 권한 저장 — 전체 권한 객체를 서버에 그대로 저장
 * (이전: 이 브라우저 localStorage에 직원이 없으면 서버 저장을 건너뛰고도 '저장되었습니다' 표시)
 */
export async function updateStaffPermissions(memberId: string, permissions: StaffPermissions): Promise<void> {
  if (isSupabaseConfigured) {
    await updateStaffRow(memberId, { permissions }, '권한 저장');
    return;
  }
  updateStaffLocal(memberId, m => ({ ...m, permissions: { ...m.permissions, ...permissions } }));
}

