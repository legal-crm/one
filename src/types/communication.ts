// ============================================================
// 내부 소통 시스템 타입 정의
// ============================================================

import type { StaffRole } from '../types';

// ── 내부 메시지 (사건별 스레드) ──

/** 메시지 카테고리 */
export type MessageCategory =
  | 'general'          // 일반
  | 'call'             // 통화 기록
  | 'document'         // 서류 관련
  | 'court'            // 법원 관련
  | 'billing'          // 수임료 관련
  | 'urgent'           // 긴급
  | 'review_request'   // 검토 요청 (코파일럿 연동)
  | 'review_response'; // 검토 응답

/** 메시지 가시성 */
export type MessageVisibility =
  | 'all_staff'     // 전체 직원
  | 'lawyers_only'  // 변호사만 (OWNER + LAWYER)
  | 'designated';   // 지정인만

/** 메시지 대상 유형 */
export type MessageTargetType = 'consult_request' | 'case' | 'copilot_review' | 'general';

/** 내부 메시지 */
export interface InternalMessage {
  /** 메시지 ID */
  id: string;
  /** 사무실 ID */
  tenantId: string;
  /** 대상 유형 (상담요청, 사건, 코파일럿 검토) */
  targetType: MessageTargetType;
  /** 대상 ID */
  targetId: string;
  /** 스레드 루트 메시지 ID (null이면 최상위) */
  parentId: string | null;
  /** 작성자 ID */
  authorId: string;
  /** 작성자 이름 */
  authorName: string;
  /** 작성자 역할 */
  authorRole: string;
  /** 메시지 내용 */
  content: string;
  /** 카테고리 */
  category: MessageCategory;
  /** 가시성 */
  visibility: MessageVisibility;
  /** 지정 열람자 ID 목록 (visibility === 'designated'일 때) */
  designatedUserIds: string[];
  /** @멘션된 직원 ID 목록 */
  mentions: string[];
  /** 고정 여부 */
  isPinned: boolean;
  /** 수정 여부 */
  isEdited: boolean;
  /** 수정 시각 */
  editedAt?: string;
  /** 답글 수 (조회 시 계산) */
  replyCount?: number;
  /** 생성 시각 */
  createdAt: string;
}

/** 카테고리별 설정 */
export const MESSAGE_CATEGORY_CONFIG: Record<MessageCategory, { label: string; emoji: string; color: string }> = {
  general: { label: '일반', emoji: '💬', color: 'text-slate-600' },
  call: { label: '통화', emoji: '📞', color: 'text-blue-600' },
  document: { label: '서류', emoji: '📂', color: 'text-green-600' },
  court: { label: '법원', emoji: '⚖️', color: 'text-purple-600' },
  billing: { label: '수임료', emoji: '💰', color: 'text-amber-600' },
  urgent: { label: '긴급', emoji: '⚠️', color: 'text-red-600' },
  review_request: { label: '검토요청', emoji: '🔬', color: 'text-indigo-600' },
  review_response: { label: '검토응답', emoji: '✅', color: 'text-teal-600' },
};

/** 가시성별 설정 */
export const VISIBILITY_CONFIG: Record<MessageVisibility, { label: string; emoji: string }> = {
  all_staff: { label: '전체', emoji: '🔓' },
  lawyers_only: { label: '변호사 전용', emoji: '🔒' },
  designated: { label: '지정인', emoji: '👤' },
};

// ── 업무 할당 티켓 ──

/** 업무 우선순위 */
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/** 업무 상태 */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** 업무 할당 티켓 */
export interface TaskTicket {
  /** 티켓 ID */
  id: string;
  /** 사무실 ID */
  tenantId: string;
  /** 관련 대상 유형 */
  targetType: MessageTargetType;
  /** 관련 대상 ID */
  targetId: string;
  /** 지시자 ID */
  assignerId: string;
  /** 지시자 이름 */
  assignerName: string;
  /** 수행자 ID */
  assigneeId: string;
  /** 수행자 이름 */
  assigneeName: string;
  /** 업무 제목 */
  title: string;
  /** 업무 설명 */
  description?: string;
  /** 우선순위 */
  priority: TaskPriority;
  /** 상태 */
  status: TaskStatus;
  /** 기한 */
  dueDate?: string;
  /** 완료 시각 */
  completedAt?: string;
  /** 완료 메모 */
  completionNote?: string;
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
}

/** 우선순위별 설정 */
export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; emoji: string; color: string; bgColor: string }> = {
  LOW: { label: '낮음', emoji: '🔵', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  NORMAL: { label: '보통', emoji: '🟡', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  HIGH: { label: '높음', emoji: '🟠', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  URGENT: { label: '긴급', emoji: '🔴', color: 'text-red-600', bgColor: 'bg-red-50' },
};

/** 상태별 설정 */
export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; emoji: string; color: string }> = {
  PENDING: { label: '대기', emoji: '⏳', color: 'text-slate-500' },
  IN_PROGRESS: { label: '진행중', emoji: '🔄', color: 'text-blue-600' },
  COMPLETED: { label: '완료', emoji: '✅', color: 'text-green-600' },
  CANCELLED: { label: '취소', emoji: '❌', color: 'text-slate-400' },
};

// ── 인앱 알림 ──

/** 알림 유형 */
export type NotificationType =
  | 'MENTION'            // @멘션됨
  | 'TASK_ASSIGNED'      // 업무 할당됨
  | 'TASK_COMPLETED'     // 업무 완료됨
  | 'REVIEW_REQUESTED'   // 코파일럿 검토 요청
  | 'REVIEW_APPROVED'    // 검토 승인
  | 'REVIEW_REJECTED'    // 검토 반려
  | 'CASE_ASSIGNED'      // 사건 배정
  | 'CASE_TRANSFERRED'   // 사건 이관
  | 'URGENT_NOTE'        // 긴급 메모
  | 'REPLY_RECEIVED';    // 답글 수신

/** 알림 링크 대상 유형 */
export type NotificationLinkType = 'consult_request' | 'case' | 'copilot_review' | 'task' | 'proposal_review' | 'general';

/** 인앱 알림 */
export interface InAppNotification {
  /** 알림 ID */
  id: string;
  /** 사무실 ID */
  tenantId: string;
  /** 수신자 ID */
  recipientId: string;
  /** 알림 유형 */
  type: NotificationType;
  /** 알림 제목 */
  title: string;
  /** 알림 내용 */
  body: string;
  /** 발신자 ID */
  senderId?: string;
  /** 발신자 이름 */
  senderName?: string;
  /** 링크 대상 유형 */
  linkType: NotificationLinkType;
  /** 링크 대상 ID */
  linkId: string;
  /** 읽음 여부 */
  isRead: boolean;
  /** 읽은 시각 */
  readAt?: string;
  /** 생성 시각 */
  createdAt: string;
}

/** 알림 유형별 설정 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; emoji: string }> = {
  MENTION: { label: '멘션', emoji: '💬' },
  TASK_ASSIGNED: { label: '업무 할당', emoji: '📋' },
  TASK_COMPLETED: { label: '업무 완료', emoji: '✅' },
  REVIEW_REQUESTED: { label: '검토 요청', emoji: '🔬' },
  REVIEW_APPROVED: { label: '검토 승인', emoji: '✅' },
  REVIEW_REJECTED: { label: '검토 반려', emoji: '❌' },
  CASE_ASSIGNED: { label: '사건 배정', emoji: '📁' },
  CASE_TRANSFERRED: { label: '사건 이관', emoji: '🔄' },
  URGENT_NOTE: { label: '긴급 메모', emoji: '⚠️' },
  REPLY_RECEIVED: { label: '답글', emoji: '↩️' },
};
