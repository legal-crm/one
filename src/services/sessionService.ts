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

/** 같은 기기의 이전 세션을 '유령 세션'으로 보고 정리하기까지의 무활동 시간 (다른 탭을 끊지 않도록 충분히 길게) */
const STALE_SAME_DEVICE_MS = 30 * 60 * 1000;
/** 하트비트 저장 최소 간격 (입력 이벤트마다 localStorage 전체 재기록 방지) */
const HEARTBEAT_THROTTLE_MS = 30 * 1000;
let lastHeartbeatAt = 0;

/**
 * 로컬에 저장된 모든 세션 목록 로드
 */
function loadStoredSessions(): UserSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      const parsed: UserSession[] = JSON.parse(raw);
      // 과거 버전이 심어둔 가짜 시연 세션(mock-session-*) 정리
      const cleaned = parsed.filter(s => !String(s.id).startsWith('mock-session-'));
      if (cleaned.length !== parsed.length) saveStoredSessions(cleaned);
      return cleaned;
    }
  } catch {}
  return [];
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
 * 신규 세션 등록 (로그인 또는 세션 복원 시 호출)
 */
export async function registerSession(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: UserRoleCategory;
  firmName?: string;
}): Promise<UserSession> {
  const existingSessionId = sessionStorage.getItem(CURRENT_SESSION_ID_KEY);
  const allSessions = loadStoredSessions();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일 유효

  // 1. 현재 브라우저 탭에 이미 활성 세션이 유효하게 등록되어 있다면 중복 생성 대신 갱신(Touch)
  if (existingSessionId) {
    const existingIndex = allSessions.findIndex(
      s => s.id === existingSessionId && s.status === 'active' && s.userId === params.userId
    );
    if (existingIndex !== -1) {
      const existing = allSessions[existingIndex];
      existing.lastActiveAt = now.toISOString();
      existing.userName = params.userName;
      if (params.userEmail) existing.userEmail = params.userEmail;
      if (params.firmName) existing.firmName = params.firmName;
      saveStoredSessions(allSessions);
      return existing;
    }
  }

  const deviceInfo = await getClientDeviceInfo();
  const sessionId = existingSessionId || generateUUID();

  // 2. 동일 기기(동일 OS + 브라우저 + IP + 기기유형)의 이전 유령 세션 정리
  // 새로고침이나 탭 재실행 시 이전 세션이 '다른 기기'로 오인 누적되지 않도록 이전 동일 기기 세션을 자동 만료 처리
  const cleanedSessions = allSessions.map(s => {
    if (
      s.userId === params.userId &&
      s.status === 'active' &&
      now.getTime() - new Date(s.lastActiveAt).getTime() > STALE_SAME_DEVICE_MS &&
      s.device.os === deviceInfo.os &&
      s.device.browser === deviceInfo.browser &&
      s.device.ipAddress === deviceInfo.ipAddress &&
      s.device.deviceType === deviceInfo.deviceType
    ) {
      return {
        ...s,
        status: 'expired' as const,
        revokeReason: '동일 기기에서 신규 세션 연결로 이전 세션 만료',
      };
    }
    return s;
  });

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

  // 로컬 스토리지에 세션 동기화 (기존 동일 ID 제거 후 신규 추가)
  const filtered = cleanedSessions.filter(s => s.id !== sessionId);
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
      const { error } = await supabase.from('user_sessions').insert({
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
      if (error) console.warn('[SESSION] 서버 세션 등록 실패 (이 브라우저에서만 관리됨):', error.message);
    } catch (err) {
      console.warn('[SESSION] Supabase session sync warning:', err);
    }
  }

  return newSession;
}

/**
 * 특정 사용자의 활성 세션 목록 조회 (변호사/관리자 본인용)
 * 동일 기기(동일 PC/브라우저) 중복 세션 자동 정리 및 만료 처리 포함
 */
export async function getActiveSessions(userId: string): Promise<UserSession[]> {
  const currentSessionId = getCurrentSessionId();
  const allSessions = loadStoredSessions();
  const now = Date.now();
  let changed = false;

  // 1. 만료 시간 지난 세션 자동 만료 처리
  allSessions.forEach(s => {
    if (s.status === 'active' && s.expiresAt && new Date(s.expiresAt).getTime() < now) {
      s.status = 'expired';
      changed = true;
    }
  });

  // 2. 동일 사용자, 동일 기기(OS + 브라우저 + IP)의 중복 세션 자동 통합 정리
  // 현재 접속 세션이거나 가장 최근 세션 1개만 활성으로 유지
  const activeForUser = allSessions.filter(s => s.userId === userId && s.status === 'active');
  const seenDevices = new Set<string>();

  // 현재 활성 세션의 기기 핑거프린트 우선 등록
  if (currentSessionId) {
    const current = activeForUser.find(s => s.id === currentSessionId);
    if (current) {
      const key = `${current.device.os}__${current.device.browser}__${current.device.ipAddress}__${current.device.deviceType}`;
      seenDevices.add(key);
    }
  }

  // 최신 활동순으로 정렬하여 동일 기기의 오래된 잔여 세션은 자동 만료 정리
  activeForUser
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
    .forEach(s => {
      const key = `${s.device.os}__${s.device.browser}__${s.device.ipAddress}__${s.device.deviceType}`;
      if (s.id === currentSessionId) return;
      // 같은 기기라도 최근 활동 중인 세션(다른 탭)은 유지 — 오래된 잔여 세션만 정리
      if (seenDevices.has(key) && now - new Date(s.lastActiveAt).getTime() > STALE_SAME_DEVICE_MS) {
        s.status = 'expired';
        s.revokeReason = '동일 기기 중복 세션 자동 통합 정리';
        changed = true;
      } else {
        seenDevices.add(key);
      }
    });

  if (changed) {
    saveStoredSessions(allSessions);
  }

  // 서버에 등록된 다른 기기 세션 병합 (Supabase 설정 + 019 RLS 적용 시)
  const merged = [...allSessions];
  const remote = await fetchRemoteActiveSessions(userId);
  for (const r of remote) {
    if (!merged.some(m => m.id === r.id)) merged.push(r);
  }

  return merged
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
  let target = allSessions.find(s => s.id === sessionId);

  if (!target) {
    // 다른 기기 세션(서버에만 존재)
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase
      .from('user_sessions')
      .update({ status: 'revoked', revoked_at: now, revoked_by: revokedBy, revoke_reason: reason || '원격 로그아웃 요청' })
      .eq('id', sessionId);
    if (error) {
      console.warn('[SESSION] 원격 세션 종료 실패:', error.message);
      return false;
    }
    return true;
  }

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
      const { error } = await supabase
        .from('user_sessions')
        .update({
          status: 'revoked',
          revoked_at: now,
          revoked_by: revokedBy,
          revoke_reason: target.revokeReason,
        })
        .eq('id', sessionId);
      if (error) console.warn('[SESSION] 서버 세션 종료 반영 실패:', error.message);
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

  // 서버 세션(다른 기기) 일괄 종료
  if (isSupabaseConfigured && curId) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({ status: 'revoked', revoked_at: now, revoked_by: 'user', revoke_reason: '다른 모든 기기에서 일괄 로그아웃 실행' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('id', curId)
      .select('id');
    if (error) {
      console.warn('[SESSION] 서버 세션 일괄 종료 실패:', error.message);
    } else if (data) {
      const localIds = new Set(allSessions.map(s => s.id));
      revokedCount += data.filter((r: any) => !localIds.has(r.id)).length;
    }
  }

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

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('user_sessions')
      .update({ status: 'revoked', revoked_at: now, revoked_by: 'admin', revoke_reason: reason || '관리자 긴급 보안 조치' })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) console.warn('[SESSION] 서버 세션 차단 실패:', error.message);
  }

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

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('status, revoke_reason')
        .eq('id', id)
        .maybeSingle();
      // 조회 실패·행 없음(서버 미등록)은 로컬 판정 유지 — 네트워크 장애로 강제 로그아웃하지 않음
      if (!error && data && data.status === 'revoked') {
        session.status = 'revoked';
        session.revokeReason = data.revoke_reason || '다른 기기 또는 관리자에 의해 세션이 종료되었습니다.';
        saveStoredSessions(allSessions);
        return { valid: false, session, reason: session.revokeReason };
      }
    } catch {
      // ignore
    }
  }

  return { valid: true, session };
}

/** 서버(user_sessions)에 등록된 사용자의 활성 세션 (다른 기기 포함) */
async function fetchRemoteActiveSessions(userId: string): Promise<UserSession[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('last_active_at', { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data.map((r: any): UserSession => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email || undefined,
      userRole: r.user_role,
      firmName: r.firm_name || undefined,
      device: {
        deviceType: r.device_type,
        os: r.os,
        browser: r.browser,
        userAgent: r.user_agent || '',
        ipAddress: r.ip_address,
        location: r.location || '',
      },
      isCurrentSession: false,
      status: r.status,
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      expiresAt: r.expires_at,
      isSuspicious: r.is_suspicious || undefined,
      suspiciousReason: r.suspicious_reason || undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * 세션 마지막 활동 시각 갱신 (Heartbeat)
 */
export function touchSessionHeartbeat(sessionId?: string): void {
  const id = sessionId || getCurrentSessionId();
  if (!id) return;
  const nowMs = Date.now();
  if (nowMs - lastHeartbeatAt < HEARTBEAT_THROTTLE_MS) return;
  lastHeartbeatAt = nowMs;

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

  // 기록이 없으면 빈 목록 (가짜 이력을 만들지 않음)
  return [];
}
