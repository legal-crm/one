import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { writeCopilotAuditLog } from './copilotAuditService';
import type { 
  CaseReview, CaseReviewStatus, FactSnapshot, FactSnapshotData, 
  ReviewFlag, StaffReview, LawyerOpinion, LawyerApproval, ApprovalChecklist, 
  ApprovedClientMessage, ClientMessageContent, CopilotAuditLog
} from '../types/copilot';

const COPILOT_STORAGE_KEY = 'legal_crm_copilot_cases';

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

// ── 역할 및 상태 전이 규칙 ──
const VALID_STATUS_TRANSITIONS: Record<CaseReviewStatus, { nextStatuses: CaseReviewStatus[], requiredRoles: string[][] }> = {
  DRAFT: { nextStatuses: ['STAFF_REVIEWED'], requiredRoles: [['STAFF', 'CONSULTANT', 'LAWYER', 'OWNER']] },
  STAFF_REVIEWED: { nextStatuses: ['LAWYER_REVIEW_REQUIRED', 'MORE_INFO_REQUIRED'], requiredRoles: [['STAFF', 'CONSULTANT', 'LAWYER', 'OWNER']] },
  LAWYER_REVIEW_REQUIRED: { nextStatuses: ['LAWYER_APPROVED', 'LAWYER_REJECTED', 'MORE_INFO_REQUIRED'], requiredRoles: [['LAWYER', 'OWNER']] },
  MORE_INFO_REQUIRED: { nextStatuses: ['STAFF_REVIEWED'], requiredRoles: [['STAFF', 'CONSULTANT', 'LAWYER', 'OWNER']] },
  LAWYER_APPROVED: { nextStatuses: ['SENT_TO_CLIENT', 'APPROVAL_EXPIRED'], requiredRoles: [['LAWYER', 'OWNER']] },
  LAWYER_REJECTED: { nextStatuses: ['STAFF_REVIEWED', 'WITHDRAWN'], requiredRoles: [['LAWYER', 'OWNER']] },
  APPROVAL_EXPIRED: { nextStatuses: ['LAWYER_REVIEW_REQUIRED'], requiredRoles: [['LAWYER', 'OWNER']] },
  SENT_TO_CLIENT: { nextStatuses: ['WITHDRAWN'], requiredRoles: [['LAWYER', 'OWNER', 'STAFF', 'CONSULTANT']] },
  WITHDRAWN: { nextStatuses: [], requiredRoles: [] }
};

function validateRole(actorRole: string, requiredRolesList: string[][]): boolean {
  if (requiredRolesList.length === 0) return true;
  return requiredRolesList.some(roles => roles.includes(actorRole.toUpperCase()));
}
function validateTenantAccess(requestTenantId: string, dataTenantId: string): boolean {
  return requestTenantId === dataTenantId;
}

// ── 핵심 함수 ──

export async function createCaseReview(consultRequestId: string, tenantId: string, createdBy: string): Promise<CaseReview> {
  const newCase: CaseReview = {
    id: crypto.randomUUID(),
    tenantId,
    consultRequestId,
    status: 'DRAFT',
    reviewGrade: 'NORMAL_REVIEW',
    createdBy,
    factSnapshotVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const store = getLocalData<Record<string, CaseReview>>(COPILOT_STORAGE_KEY, {});
  store[newCase.id] = newCase;
  setLocalData(COPILOT_STORAGE_KEY, store);

  writeCopilotAuditLog(tenantId, createdBy, 'system', 'REVIEW_CREATED', 'CaseReview', newCase.id, { consultRequestId });
  return newCase;
}

export async function getCaseReview(caseReviewId: string, tenantId: string): Promise<CaseReview | null> {
  const store = getLocalData<Record<string, CaseReview>>(COPILOT_STORAGE_KEY, {});
  const cr = store[caseReviewId];
  if (cr && validateTenantAccess(tenantId, cr.tenantId)) {
    return cr;
  }
  return null;
}

export async function getCaseReviewsByTenant(tenantId: string): Promise<CaseReview[]> {
  const store = getLocalData<Record<string, CaseReview>>(COPILOT_STORAGE_KEY, {});
  return Object.values(store).filter(cr => cr.tenantId === tenantId);
}

export async function updateCaseReviewStatus(caseReviewId: string, tenantId: string, newStatus: CaseReviewStatus, actorId: string, actorRole: string): Promise<boolean> {
  const cr = await getCaseReview(caseReviewId, tenantId);
  if (!cr) return false;

  const transitionRules = VALID_STATUS_TRANSITIONS[cr.status];
  if (!transitionRules.nextStatuses.includes(newStatus)) {
    throw new Error(`잘못된 상태 전이: ${cr.status} -> ${newStatus}`);
  }
  if (!validateRole(actorRole, transitionRules.requiredRoles)) {
    throw new Error('권한이 부족합니다.');
  }

  cr.status = newStatus;
  cr.updatedAt = new Date().toISOString();

  const store = getLocalData<Record<string, CaseReview>>(COPILOT_STORAGE_KEY, {});
  store[cr.id] = cr;
  setLocalData(COPILOT_STORAGE_KEY, store);

  writeCopilotAuditLog(tenantId, actorId, actorRole, 'REVIEW_CREATED', 'CaseReview', cr.id, { from: cr.status, to: newStatus });
  return true;
}

export async function saveFactSnapshot(caseReviewId: string, tenantId: string, snapshotData: FactSnapshotData, computeResponse: any): Promise<FactSnapshot> {
  const fs: FactSnapshot = {
    id: crypto.randomUUID(),
    caseReviewId,
    version: 1,
    snapshotData,
    computeResponse,
    createdAt: new Date().toISOString()
  };
  const key = `copilot_fact_${caseReviewId}`;
  setLocalData(key, fs);
  writeCopilotAuditLog(tenantId, 'system', 'system', 'FACT_SNAPSHOT_CREATED', 'FactSnapshot', fs.id, { caseReviewId });
  return fs;
}

export async function saveReviewFlags(caseReviewId: string, tenantId: string, flags: ReviewFlag[]): Promise<void> {
  const key = `copilot_flags_${caseReviewId}`;
  setLocalData(key, flags);
}

export async function getReviewFlags(caseReviewId: string, tenantId: string): Promise<ReviewFlag[]> {
  return getLocalData<ReviewFlag[]>(`copilot_flags_${caseReviewId}`, []);
}

export async function submitStaffReview(caseReviewId: string, tenantId: string, staffId: string, staffName: string, notes: string, missingInfoChecked: boolean, factVerified: boolean): Promise<StaffReview> {
  const review: StaffReview = {
    id: crypto.randomUUID(),
    caseReviewId,
    staffId,
    staffName,
    missingInfoChecked,
    factVerified,
    notes,
    submittedAt: new Date().toISOString()
  };
  setLocalData(`copilot_staff_review_${caseReviewId}`, review);
  writeCopilotAuditLog(tenantId, staffId, 'STAFF', 'STAFF_REVIEW_COMPLETED', 'CaseReview', caseReviewId, {});
  return review;
}

export async function saveLawyerOpinion(caseReviewId: string, tenantId: string, lawyerId: string, lawyerName: string, opinion: Partial<LawyerOpinion>): Promise<LawyerOpinion> {
  const lo: LawyerOpinion = {
    id: crypto.randomUUID(),
    caseReviewId,
    lawyerId,
    lawyerName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...opinion
  };
  setLocalData(`copilot_lawyer_opinion_${caseReviewId}`, lo);
  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'LAWYER_OPINION_EDITED', 'CaseReview', caseReviewId, {});
  return lo;
}

export async function approveCaseReview(caseReviewId: string, tenantId: string, lawyerId: string, lawyerName: string, checklist: ApprovalChecklist, documentHash: string, factSnapshotVersion: number, ruleSetVersion: number): Promise<LawyerApproval> {
  if (!checklist.clientDataReviewed || !checklist.clientMessageReviewed || !checklist.legalOpinionReviewed || !checklist.missingInfoReviewed || !checklist.ruleSetReviewed) {
    throw new Error('모든 체크리스트 항목이 확인되어야 합니다.');
  }

  const approval: LawyerApproval = {
    id: crypto.randomUUID(),
    caseReviewId,
    lawyerId,
    lawyerName,
    approvedAt: new Date().toISOString(),
    documentHash,
    factSnapshotVersion,
    ruleSetVersion,
    checklist,
    isValid: true
  };
  setLocalData(`copilot_approval_${caseReviewId}`, approval);
  
  await updateCaseReviewStatus(caseReviewId, tenantId, 'LAWYER_APPROVED', lawyerId, 'LAWYER');
  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'LAWYER_APPROVED', 'CaseReview', caseReviewId, { approvalId: approval.id });
  return approval;
}

export async function rejectCaseReview(caseReviewId: string, tenantId: string, lawyerId: string, reason: string): Promise<void> {
  await updateCaseReviewStatus(caseReviewId, tenantId, 'LAWYER_REJECTED', lawyerId, 'LAWYER');
  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'LAWYER_REJECTED', 'CaseReview', caseReviewId, { reason });
}

export async function sendToClient(caseReviewId: string, tenantId: string, approvalId: string, lawyerId: string, lawyerName: string, messageContent: ClientMessageContent): Promise<ApprovedClientMessage> {
  const cr = await getCaseReview(caseReviewId, tenantId);
  if (cr?.status !== 'LAWYER_APPROVED') {
    throw new Error('LAWYER_APPROVED 상태일 때만 클라이언트에게 보낼 수 있습니다.');
  }

  const msg: ApprovedClientMessage = {
    id: crypto.randomUUID(),
    caseReviewId,
    approvalId,
    lawyerId,
    lawyerName,
    messageContent,
    sentAt: new Date().toISOString()
  };
  setLocalData(`copilot_msg_${msg.id}`, msg);
  await updateCaseReviewStatus(caseReviewId, tenantId, 'SENT_TO_CLIENT', lawyerId, 'LAWYER');
  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'CLIENT_MESSAGE_SENT', 'ApprovedClientMessage', msg.id, {});
  return msg;
}

export async function withdrawClientMessage(messageId: string, tenantId: string, lawyerId: string, reason: string): Promise<void> {
  const msg = getLocalData<ApprovedClientMessage | null>(`copilot_msg_${messageId}`, null);
  if (msg) {
    msg.withdrawnAt = new Date().toISOString();
    msg.withdrawReason = reason;
    setLocalData(`copilot_msg_${messageId}`, msg);
    writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'CLIENT_MESSAGE_WITHDRAWN', 'ApprovedClientMessage', messageId, { reason });
  }
}

export async function invalidateApprovalIfChanged(caseReviewId: string, tenantId: string, currentFactVersion: number, currentRuleSetVersion: number): Promise<boolean> {
  const approval = getLocalData<LawyerApproval | null>(`copilot_approval_${caseReviewId}`, null);
  if (approval && approval.isValid) {
    if (approval.factSnapshotVersion !== currentFactVersion || approval.ruleSetVersion !== currentRuleSetVersion) {
      approval.isValid = false;
      approval.invalidatedAt = new Date().toISOString();
      approval.invalidationReason = '스냅샷 또는 룰셋 버전 변경';
      setLocalData(`copilot_approval_${caseReviewId}`, approval);
      await updateCaseReviewStatus(caseReviewId, tenantId, 'APPROVAL_EXPIRED', 'system', 'system');
      writeCopilotAuditLog(tenantId, 'system', 'system', 'APPROVAL_INVALIDATED', 'LawyerApproval', approval.id, {});
      return true;
    }
  }
  return false;
}

export async function getAuditLogs(caseReviewId: string, tenantId: string): Promise<CopilotAuditLog[]> {
  const logs = getLocalData<CopilotAuditLog[]>('copilot_audit_logs', []);
  return logs.filter(log => log.tenantId === tenantId && (log.targetId === caseReviewId || log.detail?.caseReviewId === caseReviewId));
}
