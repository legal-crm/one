import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { 
  StaffMember, StaffRole, CrmActivityLog, CrmActivityType,
  CrmNote, CrmNoteCategory, CrmClientExtension, StaffActivityLog, StaffActivityType, StaffMemberStatus,
  DocumentFile, DocumentRequest, DocumentCheckItem, DocumentReviewStatus, ElectronicContract
} from '../types';
import { DEFAULT_REHAB_DOCUMENTS, DEFAULT_BANKRUPTCY_DOCUMENTS } from '../types';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';

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
            documentRequests: row.document_requests || [],
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
        document_requests: ext.documentRequests,
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

// ── amjone8@gmail.com 전용 가상 상담 5선 사전 설정 CRM 프로필 ──
const PREDEFINED_AMJONE_PROFILES: Record<string, Partial<CrmClientExtension>> = {
  'req-amjone-1': {
    crmStatus: 'document',
    caseType: 'bankruptcy',
    intakeChannel: 'mykim',
    preInfo: '무릎 관절염 수술 후 식당 일용직 근로 중단. 성인 자녀 명의 원룸에 친족 무상거주 중. 파산관재인 15대 필수서류 심사 및 1,110만 원 면제재산 동시폐지 신청 준비 중.',
    courtCase: {
      courtName: '서울회생법원',
      status: '서류 취합 중',
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
      },
      {
        id: 'act-amj-1-2',
        clientId: 'req-amjone-1',
        actorId: 'lawyer-1',
        actorName: '김우진 변호사',
        actorRole: 'OWNER',
        type: 'status_change',
        description: '진행 상태를 [서류 수집]으로 변경하였습니다. (파산관재인 15대 필수서류 리스트 알림톡 발송)',
        createdAt: '2026-09-08T11:40:00Z'
      }
    ]
  },
  'req-amjone-2': {
    crmStatus: 'consulting',
    caseType: 'individual_rehab',
    intakeChannel: 'naver_ad',
    intakeChannelDetail: '네이버 검색광고: "코인 손실 개인회생"',
    preInfo: '2024년 해외선물 및 알트코인 투자 손실 9천만 원. IT 개발자(월 310만원). 서울회생법원 주식/가상자산 손실금 청산가치 불반영 및 청년 24개월 변제 특례 검토 중.',
    notes: [
      {
        id: 'note-amj-2-1',
        clientId: 'req-amjone-2',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '서울회생법원 준칙 제408호 적용 대상. 해외선물 거래내역서 및 업비트 거래내역 분석 중. 직장 통보 방지 요청 철저 관리 요망.',
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
      { id: 'fee-1', round: 1, amount: 1000000, dueDate: '2026-09-09', paidDate: '2026-09-09', status: 'paid', paymentMethod: '계좌이체' },
      { id: 'fee-2', round: 2, amount: 800000, dueDate: '2026-10-09', status: 'pending' },
      { id: 'fee-3', round: 3, amount: 700000, dueDate: '2026-11-09', status: 'pending' }
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
    courtCase: {
      courtName: '서울회생법원',
      caseNumber: '2026개회104921',
      status: '금지명령 인용 / 개시 대기',
    },
    notes: [
      {
        id: 'note-amj-4-1',
        clientId: 'req-amjone-4',
        authorId: 'lawyer-1',
        authorName: '김우진 변호사',
        authorRole: 'OWNER',
        content: '서울회생법원 2026개회104921 접수 완료. 금지명령 인용 결정문 송달되어 시중은행 독촉 즉시 전면 중단됨. HUG 안심전세대출 구제 특례 적용 진행 중.',
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
    crmStatus: 'requested',
    caseType: 'individual_rehab',
    intakeChannel: 'blog',
    intakeChannelDetail: '네이버 블로그: "급여 압류 막는 법" 칼럼 유입',
    preInfo: '제조업 생산직(월 260만 원, 4인 가족). 모친 암 수술비로 대부업체 3곳 2,800만 원 등 총 6,200만 원 채무. 연체 직전 추심원 방문 예고 수신. 당일 긴급 전화상담 요청.',
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
  }
};

// ── CrmClientExtension 초기화 헬퍼 ──

export function createDefaultCrmExtension(clientId: string, caseType: 'individual_rehab' | 'bankruptcy' = 'individual_rehab'): CrmClientExtension {
  const predefined = PREDEFINED_AMJONE_PROFILES[clientId] || {};
  const effectiveCaseType = (predefined.caseType as any) || caseType;
  const docs = effectiveCaseType === 'bankruptcy' ? DEFAULT_BANKRUPTCY_DOCUMENTS : DEFAULT_REHAB_DOCUMENTS;
  
  return {
    crmStatus: predefined.crmStatus || 'requested',
    caseType: effectiveCaseType,
    documents: predefined.documents || (docs || []).map((d: any) => ({ ...d, reviewStatus: d.reviewStatus || 'not_submitted' })),
    notes: predefined.notes || [],
    activities: predefined.activities || [{
      id: `act-init-${Date.now()}`,
      clientId,
      actorId: 'system',
      actorName: '시스템',
      actorRole: 'OWNER' as StaffRole,
      type: 'created' as CrmActivityType,
      description: '상담 신청이 접수되었습니다.',
      createdAt: new Date().toISOString(),
    }],
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
    if (['requested', 'consulting'].includes(ext.crmStatus) || contract.status === 'completed') {
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

