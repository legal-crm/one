// ============================================================
// 사건검토 코파일럿 타입 정의
// ============================================================

/** CaseReview 9단계 상태 */
export type CaseReviewStatus = 
  | 'DRAFT' 
  | 'STAFF_REVIEWED' 
  | 'LAWYER_REVIEW_REQUIRED' 
  | 'MORE_INFO_REQUIRED' 
  | 'LAWYER_APPROVED' 
  | 'LAWYER_REJECTED' 
  | 'APPROVAL_EXPIRED' 
  | 'SENT_TO_CLIENT' 
  | 'WITHDRAWN';

/** ReviewRuleSet 상태 */
export type RuleSetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';

/** 규칙 출처 유형 */
export type RuleSourceType = 'OFFICIAL' | 'PUBLISHED' | 'FIRM_EXPERIENCE' | 'UNVERIFIED';

/** 규칙 출력 유형 */
export type RuleOutputType = 'REVIEW_FLAG' | 'ADDITIONAL_QUESTION' | 'REQUIRED_DOCUMENT' | 'CAUTION' | 'HIGH_RISK';

/** 플래그 유형 */
export type ReviewFlagType = 'INFO' | 'CAUTION' | 'ADDITIONAL_CHECK' | 'HIGH_RISK';

/** 기준 만료 상태 */
export type RuleExpiryStatus = 'CURRENT' | 'REVIEW_DUE' | 'EXPIRED' | 'SUPERSEDED';

/** 검토 등급 */
export type ReviewGrade = 'NORMAL_REVIEW' | 'ENHANCED_REVIEW' | 'SECOND_REVIEW';

/** 감사 이벤트 */
export type CopilotAuditAction = 
  | 'REVIEW_CREATED' | 'FACT_SNAPSHOT_CREATED' | 'RULE_EXECUTED'
  | 'FLAG_CREATED' | 'STAFF_REVIEW_COMPLETED' | 'LAWYER_REVIEW_OPENED'
  | 'LAWYER_OPINION_EDITED' | 'LAWYER_APPROVED' | 'LAWYER_REJECTED'
  | 'APPROVAL_INVALIDATED' | 'CLIENT_MESSAGE_SENT' | 'CLIENT_MESSAGE_WITHDRAWN'
  | 'RULESET_CREATED' | 'RULESET_APPROVED' | 'RULESET_UPDATED'
  | 'UNAUTHORIZED_ACCESS_BLOCKED' | 'MORE_INFO_REQUESTED' | 'APPROVAL_EXPIRED';

/** 규칙 조건 */
export interface RuleCondition {
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS' | 'EXISTS' | 'NOT_EXISTS';
  value: any;
}

/** 규칙 모델 */
export interface ReviewRule {
  id: string;
  ruleSetId: string;
  category: string;
  title: string;
  description: string;
  conditions: RuleCondition[];
  outputType: RuleOutputType;
  outputMessage: string;
  sourceType: RuleSourceType;
  sourceReference: string;
  effectiveFrom: string;
  reviewDueAt: string;
  approvedByLawyerId: string;
  approvedAt: string;
  version: number;
  status: 'ACTIVE' | 'INACTIVE';
  expiryStatus: RuleExpiryStatus;
}

/** 리뷰 규칙 세트 */
export interface ReviewRuleSet {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  version: number;
  status: RuleSetStatus;
  effectiveFrom: string;
  reviewDueAt: string;
  createdBy: string;
  approvedByLawyerId: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 법원 실무 기준 */
export interface CourtPracticeNote {
  id: string;
  tenantId: string;
  courtName: string;
  verifiedDate: string;
  sourceType: RuleSourceType;
  sourceReference: string;
  generalCorrectionRequirements: string;
  documentNotes: string;
  recentChanges: string;
  firmExperienceMemo: string;
  conditions?: RuleCondition[];
  approvedByLawyerId: string;
  approvedAt: string;
  reviewDueAt: string;
  expiryStatus: RuleExpiryStatus;
}

/** 사건 리뷰 상태 */
export interface CaseReview {
  id: string;
  tenantId: string;
  consultRequestId: string;
  clientId?: string;
  status: CaseReviewStatus;
  reviewGrade: ReviewGrade;
  createdBy: string;
  assignedLawyerId?: string;
  factSnapshotVersion: number;
  ruleSetVersion?: number;
  ruleSetId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 사건 사실 데이터 */
export interface FactSnapshotData {
  totalDebt: number;
  securedDebt: number;
  unsecuredDebt: number;
  taxDebt: number;
  monthlyIncome: number;
  monthlyExpense: number;
  disposableIncome: number;
  dependents: number;
  assets: any[];
  recentDebts: any[];
  delinquencyStatus: string;
  seizureStatus: string;
  previousHistory: string;
  creditorCount: number;
  delinquencyMonths: number;
}

/** 사건 사실 스냅샷 */
export interface FactSnapshot {
  id: string;
  caseReviewId: string;
  version: number;
  snapshotData: FactSnapshotData;
  computeResponse: any;
  createdAt: string;
}

/** 리뷰 플래그 */
export interface ReviewFlag {
  id: string;
  caseReviewId: string;
  ruleId?: string;
  flagType: ReviewFlagType;
  message: string;
  usedInputValues: Record<string, any>;
  appliedRuleName?: string;
  appliedRuleVersion?: number;
  sourceType?: RuleSourceType;
  sourceReference?: string;
  judgmentStatus: 'REQUIRES_LAWYER_REVIEW';
}

/** 스태프 리뷰 */
export interface StaffReview {
  id: string;
  caseReviewId: string;
  staffId: string;
  staffName?: string;
  missingInfoChecked: boolean;
  factVerified: boolean;
  notes: string;
  additionalNotes?: string;
  submittedAt: string;
}

/** 변호사 의견 */
export interface LawyerOpinion {
  id: string;
  caseReviewId: string;
  lawyerId: string;
  lawyerName?: string;
  procedureOpinion?: string;
  legalIssues?: string;
  consultationConclusion?: string;
  clientGuidance?: string;
  nextSteps?: string[];
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/** 승인 체크리스트 */
export interface ApprovalChecklist {
  clientDataReviewed: boolean;
  missingInfoReviewed: boolean;
  ruleSetReviewed: boolean;
  legalOpinionReviewed: boolean;
  clientMessageReviewed: boolean;
}

/** 변호사 승인 정보 */
export interface LawyerApproval {
  id: string;
  caseReviewId: string;
  lawyerId: string;
  lawyerName?: string;
  approvedAt: string;
  documentHash: string;
  factSnapshotVersion: number;
  ruleSetVersion: number;
  checklist: ApprovalChecklist;
  isValid: boolean;
  invalidatedAt?: string;
  invalidationReason?: string;
}

/** 클라이언트 메시지 콘텐츠 */
export interface ClientMessageContent {
  summary: string;
  additionalInfoRequired: string[];
  lawyerOpinion: string;
  nextSteps: string[];
  disclaimer: string;
}

/** 승인된 클라이언트 메시지 */
export interface ApprovedClientMessage {
  id: string;
  caseReviewId: string;
  approvalId: string;
  lawyerId: string;
  lawyerName: string;
  messageContent: ClientMessageContent;
  sentAt?: string;
  withdrawnAt?: string;
  withdrawReason?: string;
}

/** 코파일럿 감사 로그 */
export interface CopilotAuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  action: CopilotAuditAction;
  targetType: string;
  targetId: string;
  detail: Record<string, any>;
  createdAt: string;
}

/** 전역 규칙 템플릿 */
export interface GlobalRuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: ReviewRule[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 규칙 템플릿 업데이트 내용 */
export interface RuleTemplateUpdate {
  id: string;
  templateId: string;
  tenantId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  changelog?: string;
  proposedAt: string;
  respondedBy?: string;
  respondedAt?: string;
}

/** 코파일럿 권한 */
export interface CopilotPermissions {
  canRunFactEngine: boolean;
  canRunReviewRules: boolean;
  canCreateStaffReview: boolean;
  canRequestLawyerReview: boolean;
  canEditLawyerOpinion: boolean;
  canApproveCaseReview: boolean;
  canSendToClient: boolean;
  canManageRuleSets: boolean;
  canApproveRuleSets: boolean;
  canViewAuditLog: boolean;
  canWithdrawMessage: boolean;
}

/** 상담 스타일 프로필 */
export interface ConsultStyleProfile {
  tenantId: string;
  explanationLength: 'brief' | 'normal' | 'detailed';
  terminologyLevel: 'easy' | 'moderate' | 'professional';
  requiredCautions: string[];
  postConsultDocuments: string[];
  prohibitedExpressions: string[];
  officialLinkStyle: 'inline' | 'footnote' | 'appendix';
  updatedBy: string;
  updatedAt: string;
}

/** CaseReview 상태 설정 상수 */
export const CASE_REVIEW_STATUS_CONFIG: Record<CaseReviewStatus, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  DRAFT: { label: '초안', emoji: '📝', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' },
  STAFF_REVIEWED: { label: '스태프 검토 완료', emoji: '🧑‍💼', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  LAWYER_REVIEW_REQUIRED: { label: '변호사 검토 필요', emoji: '⚠️', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
  MORE_INFO_REQUIRED: { label: '추가 정보 필요', emoji: '❓', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' },
  LAWYER_APPROVED: { label: '변호사 승인 완료', emoji: '✅', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' },
  LAWYER_REJECTED: { label: '변호사 반려', emoji: '❌', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
  APPROVAL_EXPIRED: { label: '승인 만료', emoji: '⏰', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
  SENT_TO_CLIENT: { label: '의뢰인 발송 완료', emoji: '📤', color: 'text-teal-400', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/20' },
  WITHDRAWN: { label: '철회됨', emoji: '🔙', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/20' }
};

/** 규칙 출처 유형 설정 */
export const RULE_SOURCE_TYPE_CONFIG: Record<RuleSourceType, { label: string; emoji: string; color: string }> = {
  OFFICIAL: { label: '공식', emoji: '🏛️', color: 'text-blue-500' },
  PUBLISHED: { label: '출판됨', emoji: '📚', color: 'text-green-500' },
  FIRM_EXPERIENCE: { label: '로펌 경험', emoji: '💼', color: 'text-orange-500' },
  UNVERIFIED: { label: '미검증', emoji: '❓', color: 'text-gray-500' }
};

/** 플래그 유형 설정 */
export const FLAG_TYPE_CONFIG: Record<ReviewFlagType, { label: string; emoji: string; color: string; bgColor: string }> = {
  INFO: { label: '정보', emoji: 'ℹ️', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  CAUTION: { label: '주의', emoji: '⚠️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  ADDITIONAL_CHECK: { label: '추가 확인', emoji: '🔍', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  HIGH_RISK: { label: '고위험', emoji: '🚨', color: 'text-red-400', bgColor: 'bg-red-500/10' }
};
