// ============================================================
// [SECURITY] 기기 & 세션 관리 통합 서비스
// Supabase user_sessions 연동 + 브라우저 스토리지 폴백 하이브리드 지원
// ============================================================

import { UserSession, LoginAuditEntry, UserRoleCategory, SessionRevokeBroadcastPayload } from '../types/session';
import { getClientDeviceInfo, generateUUID } from '../utils/deviceDetector';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { writeAuditLog } from './auditService';

const SESSIONS_STORAGE_KEY = 'legal_crm_active_sessions';
const LOGIN_HISTORY_STORAGE_KEY = 'legal_crm_login_history';
const CURRENT_SESSION_ID_KEY = 'legal_crm_current_session_id';

// 실시간 탭 간 강제 로그아웃 동기화를 위한 BroadcastChannel
let sessionChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    sessionChannel = new BroadcastChannel('legal_crm_session_security_channel');
  }
} catch {
  // BroadcastChannel 미지원 환경 폴백
}

/**
 * 초기 모의 세션 시드 데이터 생성 (실감나는 데모 및 체험 지원)
 */
function createInitialMockSessions(): UserSession[] {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'mock-session-lawyer1-mobile',
      userId: 'lawyer-1',
      userName: '김동훈 변호사',
      userEmail: 'kimlaw@mykim.kr',
      userRole: 'LAWYER',
      firmName: '법무법인 정론',
      device: {
        deviceType: 'mobile',
        os: 'iOS 17.5',
        browser: 'Apple Safari 17',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
        ipAddress: '112.170.82.41',
        location: '대한민국 서울특별시 서초구',
      },
      isCurrentSession: false,
      status: 'active',
      createdAt: yesterday,
      lastActiveAt: oneHourAgo,
      expiresAt: expires,
    },
    {
      id: 'mock-session-lawyer1-home',
      userId: 'lawyer-1',
      userName: '김동훈 변호사',
      userEmail: 'kimlaw@mykim.kr',
      userRole: 'LAWYER',
      firmName: '법무법인 정론',
      device: {
        deviceType: 'desktop',
        os: 'macOS Sonoma',
        browser: 'Google Chrome 124',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        ipAddress: '220.73.19.102',
        location: '대한민국 경기도 성남시',
      },
      isCurrentSession: false,
      status: 'active',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastActiveAt: yesterday,
      expiresAt: expires,
    },
    {
      id: 'mock-session-admin-office',
      userId: 'pipj601@gmail.com',
      userName: '대표 관리자',
      userEmail: 'pipj601@gmail.com',
      userRole: 'ADMIN',
      firmName: 'my김변 본사 관제센터',
      device: {
        deviceType: 'desktop',
        os: 'Windows 11',
        browser: 'Google Chrome 125',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ipAddress: '211.234.120.85',
        location: '대한민국 서울특별시 강남구',
      },
      isCurrentSession: false,
      status: 'active',
      createdAt: yesterday,
      lastActiveAt: oneHourAgo,
      expiresAt: expires,
    },
    {
      id: 'mock-session-suspicious-staff',
      userId: 'staff-9',
      userName: '이상 접속 의심 계정',
      userEmail: 'staff9@testfirm.com',
      userRole: 'STAFF',
      firmName: '열린 법률사무소',
      device: {
        deviceType: 'desktop',
        os: 'Linux',
        browser: 'Mozilla Firefox 120',
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64)',
        ipAddress: '185.220.101.5',
        location: '네덜란드 암스테르담 (VPN 의심)',
      },
      isCurrentSession: false,
      status: 'active',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      lastActiveAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      expiresAt: expires,
      isSuspicious: true,
      suspiciousReason: '국내 로펌 계정이 비인가 해외 VPN IP 대역에서 로그인됨',
    },
  ];
}

/**
 * 로컬에 저장된 모든 세션 목록 로드
 */
function loadStoredSessions(): UserSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  const defaults = createInitialMockSessions();
  saveStoredSessions(defaults);
  return defaults;
}

/**
 * 로컬 세션 목록 저장
 */
function saveStoredSessions(sessions: UserSession[]): void {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

/**
 * 현재 클라이언트의 세션 ID 반환
 */
export function getCurrentSessionId(): string | null {
  try {
    return sessionStorage.getItem(CURRENT_SESSION_ID_KEY) || localStorage.getItem(CURRENT_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * 신규 세션 등록 (로그인 시 호출)
 */
export async function registerSession(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: UserRoleCategory;
  firmName?: string;
}): Promise<UserSession> {
  const deviceInfo = await getClientDeviceInfo();
  const sessionId = generateUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일 유효

  const newSession: UserSession = {
    id: sessionId,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    userRole: params.userRole,
    firmName: params.firmName,
    device: deviceInfo,
    isCurrentSession: true,
    status: 'active',
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    expiresAt,
  };

  // 현재 탭 세션 ID 저장
  sessionStorage.setItem(CURRENT_SESSION_ID_KEY, sessionId);

  // 로컬 스토리지에 세션 동기화
  const existing = loadStoredSessions();
  // 동일한 현재 탭 이전 세션이 있었다면 정리
  const filtered = existing.filter(s => s.id !== sessionId);
  filtered.unshift(newSession);
  saveStoredSessions(filtered);

  // 로그인 감사 로그 기록
  recordLoginAudit({
    userId: params.userId,
    userName: params.userName,
    userRole: params.userRole,
    device: deviceInfo,
    status: 'SUCCESS',
  });

  // Supabase 연동 시 서버 DB에 비동기 저장
  if (isSupabaseConfigured) {
    try {
      await supabase.from('user_sessions').insert({
        id: sessionId,
        user_id: params.userId,
        user_name: params.userName,
        user_email: params.userEmail || null,
        user_role: params.userRole,
        firm_name: params.firmName || null,
        device_type: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        user_agent: deviceInfo.userAgent,
        ip_address: deviceInfo.ipAddress,
        location: deviceInfo.location,
        status: 'active',
        created_at: now.toISOString(),
        last_active_at: now.toISOString(),
        expires_at: expiresAt,
      });
    } catch (err) {
      console.warn('[SESSION] Supabase session sync warning:', err);
    }
  }

  return newSession;
}

/**
 * 특정 사용자의 활성 세션 목록 조회 (변호사/관리자 본인용)
 */
export async function getActiveSessions(userId: string): Promise<UserSession[]> {
  const currentSessionId = getCurrentSessionId();
  const allSessions = loadStoredSessions();

  return allSessions
    .filter(s => s.userId === userId && s.status === 'active')
    .map(s => ({
      ...s,
      isCurrentSession: s.id === currentSessionId,
    }))
    .sort((a, b) => {
      // 현재 세션 최우선, 그 후 최근 활동순
      if (a.isCurrentSession) return -1;
      if (b.isCurrentSession) return 1;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
}

/**
 * 전사 모든 세션 목록 조회 (통합 어드민용)
 */
export async function getAllSessions(): Promise<UserSession[]> {
  const currentSessionId = getCurrentSessionId();
  const allSessions = loadStoredSessions();

  return allSessions.map(s => ({
    ...s,
    isCurrentSession: s.id === currentSessionId,
  })).sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
}

/**
 * 특정 세션 강제 종료 (원격 로그아웃 / Kill Session)
 */
export async function revokeSession(
  sessionId: string,
  revokedBy: 'user' | 'admin' | 'system' = 'user',
  reason?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const allSessions = loadStoredSessions();
  const target = allSessions.find(s => s.id === sessionId);

  if (!target) return false;

  target.status = 'revoked';
  target.revokedAt = now;
  target.revokedBy = revokedBy;
  target.revokeReason = reason || (revokedBy === 'admin' ? '관리자에 의한 강제 종료' : '원격 로그아웃 요청');
  saveStoredSessions(allSessions);

  // BroadcastChannel로 세션 무효화 전송 (다른 탭/창 실시간 로그아웃)
  if (sessionChannel) {
    const payload: SessionRevokeBroadcastPayload = {
      sessionId,
      userId: target.userId,
      revokedBy,
      reason: target.revokeReason,
      timestamp: Date.now(),
    };
    sessionChannel.postMessage(payload);
  }

  // 감사 로그 기록
  writeAuditLog({
    actor_id: revokedBy === 'admin' ? 'admin' : target.userId,
    actor_role: revokedBy === 'admin' ? 'admin' : (target.userRole.toLowerCase() as any),
    action: 'logout',
    target_type: 'user_session',
    target_id: sessionId,
    detail: {
      device: `${target.device.os} - ${target.device.browser}`,
      ip: target.device.ipAddress,
      revokedBy,
      reason: target.revokeReason,
    },
  });

  // Supabase 연동 시 DB 업데이트
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_sessions')
        .update({
          status: 'revoked',
          revoked_at: now,
          revoked_by: revokedBy,
          revoke_reason: target.revokeReason,
        })
        .eq('id', sessionId);
    } catch (err) {
      console.warn('[SESSION] Supabase revoke error:', err);
    }
  }

  return true;
}

/**
 * 현재 기기를 제외한 다른 모든 세션 일괄 강제 로그아웃
 */
export async function revokeAllOtherSessions(userId: string, currentSessionId?: string): Promise<number> {
  const curId = currentSessionId || getCurrentSessionId();
  const allSessions = loadStoredSessions();
  let revokedCount = 0;
  const now = new Date().toISOString();

  allSessions.forEach(s => {
    if (s.userId === userId && s.id !== curId && s.status === 'active') {
      s.status = 'revoked';
      s.revokedAt = now;
      s.revokedBy = 'user';
      s.revokeReason = '다른 모든 기기에서 일괄 로그아웃 실행';
      revokedCount++;

      // 브로드캐스트
      if (sessionChannel) {
        sessionChannel.postMessage({
          sessionId: s.id,
          userId: s.userId,
          revokedBy: 'user',
          reason: s.revokeReason,
          timestamp: Date.now(),
        });
      }
    }
  });

  saveStoredSessions(allSessions);

  // 감사 로그
  writeAuditLog({
    actor_id: userId,
    actor_role: 'lawyer',
    action: 'logout',
    target_type: 'all_other_sessions',
    detail: { revokedCount },
  });

  return revokedCount;
}

/**
 * 특정 사용자의 모든 세션 긴급 차단 (통합 어드민용 전사 긴급 조치)
 */
export async function revokeAllUserSessionsByAdmin(userId: string, reason: string): Promise<number> {
  const allSessions = loadStoredSessions();
  let count = 0;
  const now = new Date().toISOString();

  allSessions.forEach(s => {
    if (s.userId === userId && s.status === 'active') {
      s.status = 'revoked';
      s.revokedAt = now;
      s.revokedBy = 'admin';
      s.revokeReason = reason || '최고 관리자 긴급 보안 조치로 계정 세션 전면 강제 종료';
      count++;

      if (sessionChannel) {
        sessionChannel.postMessage({
          sessionId: s.id,
          userId: s.userId,
          revokedBy: 'admin',
          reason: s.revokeReason,
          timestamp: Date.now(),
        });
      }
    }
  });

  saveStoredSessions(allSessions);

  writeAuditLog({
    actor_id: 'admin',
    actor_role: 'admin',
    action: 'login_locked',
    target_type: 'user',
    target_id: userId,
    detail: { count, reason },
  });

  return count;
}

/**
 * 현재 클라이언트의 세션이 유효한지 검사 (강제 로그아웃 여부 확인)
 */
export async function checkSessionValidity(sessionId?: string): Promise<{ valid: boolean; session?: UserSession; reason?: string }> {
  const id = sessionId || getCurrentSessionId();
  if (!id) return { valid: false, reason: '세션 정보가 없습니다.' };

  const allSessions = loadStoredSessions();
  const session = allSessions.find(s => s.id === id);

  if (!session) {
    // 세션이 명시적으로 등록되지 않았거나 만료됨
    return { valid: false, reason: '유효한 활성 세션이 존재하지 않습니다.' };
  }

  if (session.status === 'revoked') {
    return {
      valid: false,
      session,
      reason: session.revokeReason || '보안을 위해 다른 기기 또는 관리자에 의해 세션이 강제 종료되었습니다.',
    };
  }

  if (session.status === 'expired' || new Date(session.expiresAt).getTime() < Date.now()) {
    session.status = 'expired';
    saveStoredSessions(allSessions);
    return { valid: false, session, reason: '세션 유효기간이 만료되었습니다.' };
  }

  return { valid: true, session };
}

/**
 * 세션 마지막 활동 시각 갱신 (Heartbeat)
 */
export function touchSessionHeartbeat(sessionId?: string): void {
  const id = sessionId || getCurrentSessionId();
  if (!id) return;

  const allSessions = loadStoredSessions();
  const session = allSessions.find(s => s.id === id);
  if (session && session.status === 'active') {
    session.lastActiveAt = new Date().toISOString();
    saveStoredSessions(allSessions);
  }
}

/**
 * 로그인 이력 기록
 */
export function recordLoginAudit(entry: Omit<LoginAuditEntry, 'id' | 'timestamp'>): void {
  try {
    const history: LoginAuditEntry[] = JSON.parse(localStorage.getItem(LOGIN_HISTORY_STORAGE_KEY) || '[]');
    const newEntry: LoginAuditEntry = {
      ...entry,
      id: generateUUID(),
      timestamp: new Date().toISOString(),
    };
    history.unshift(newEntry);
    // 최근 50건 유지
    localStorage.setItem(LOGIN_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {}
}

/**
 * 특정 사용자의 로그인 이력 조회 (최근 30일/50건)
 */
export function getLoginAuditHistory(userId: string): LoginAuditEntry[] {
  try {
    const history: LoginAuditEntry[] = JSON.parse(localStorage.getItem(LOGIN_HISTORY_STORAGE_KEY) || '[]');
    const userEntries = history.filter(h => h.userId === userId);
    if (userEntries.length > 0) return userEntries;
  } catch {}

  // 기본 목 데이터 생성
  const now = Date.now();
  return [
    {
      id: 'hist-1',
      userId,
      userName: '사용자',
      userRole: 'LAWYER',
      device: {
        deviceType: 'desktop',
        os: 'Windows 11',
        browser: 'Google Chrome 124',
        userAgent: '',
        ipAddress: '211.234.120.85',
        location: '대한민국 서울특별시 서초구',
      },
      status: 'SUCCESS',
      timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist-2',
      userId,
      userName: '사용자',
      userRole: 'LAWYER',
      device: {
        deviceType: 'mobile',
        os: 'iOS 17.5',
        browser: 'Apple Safari 17',
        userAgent: '',
        ipAddress: '112.170.82.41',
        location: '대한민국 서울특별시 서초구',
      },
      status: 'SUCCESS',
      timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist-3',
      userId,
      userName: '사용자',
      userRole: 'LAWYER',
      device: {
        deviceType: 'desktop',
        os: 'Windows 11',
        browser: 'Edge 123',
        userAgent: '',
        ipAddress: '121.134.50.22',
        location: '대한민국 경기도 수원시',
      },
      status: 'SUCCESS',
      timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
