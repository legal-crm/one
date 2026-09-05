// ============================================================
// [SECURITY] 로그인 기기 & 세션 관리 타입 정의
// ============================================================

export type DeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export type SessionStatus = 'active' | 'revoked' | 'expired';

export type UserRoleCategory = 'ADMIN' | 'LAWYER' | 'STAFF' | 'CLIENT';

export interface DeviceInfo {
  deviceType: DeviceCategory;
  os: string;              // e.g. "Windows 11", "macOS Sonoma", "iOS 17.5", "Android 14"
  browser: string;         // e.g. "Chrome 124", "Safari 17", "Whale 3.2", "Edge 123"
  userAgent: string;
  ipAddress: string;
  location: string;        // e.g. "대한민국 서울", "대한민국 부산", "미국 캘리포니아"
}

export interface UserSession {
  id: string;                      // 세션 고유 식별자 (UUID)
  userId: string;                  // 사용자 ID (변호사 ID, 관리자 이메일, 직원 ID)
  userName: string;                // 사용자 이름
  userEmail?: string;              // 이메일
  userRole: UserRoleCategory;      // 계정 역할
  firmName?: string;               // 소속 로펌/법인명
  device: DeviceInfo;              // 기기 정보
  isCurrentSession: boolean;       // 현재 접속 중인 브라우저/기기 여부
  status: SessionStatus;           // 세션 상태
  createdAt: string;               // 최초 로그인 일시 (ISO)
  lastActiveAt: string;            // 최종 활동 일시 (ISO)
  expiresAt: string;               // 세션 자동 만료 예정 일시 (ISO)
  revokedAt?: string;              // 강제 종료 일시 (ISO)
  revokedBy?: string;              // 강제 종료 수행자 ('user' | 'admin' | 'system')
  revokeReason?: string;           // 강제 종료 사유
  isSuspicious?: boolean;          // 이상 징후 감지 여부 (다중 IP, 해외 등)
  suspiciousReason?: string;       // 이상 징후 사유
}

export interface LoginAuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRoleCategory;
  device: DeviceInfo;
  status: 'SUCCESS' | 'FAILED' | 'LOCKED' | 'REVOKED';
  timestamp: string;
  failureReason?: string;
}

export interface SessionFilterOptions {
  searchKeyword: string;
  roleFilter: 'all' | UserRoleCategory;
  statusFilter: 'all' | SessionStatus;
  onlySuspicious: boolean;
}

export interface SessionRevokeBroadcastPayload {
  sessionId: string;
  userId: string;
  revokedBy: string;
  reason?: string;
  timestamp: number;
}
