// ============================================================
// [AUTH] 초대 링크 토큰 관리 서비스
// 관리자가 직원 초대 링크를 생성하고, 직원이 해당 링크로 회원가입합니다.
// Supabase 미설정 시 localStorage 폴백으로 동작합니다.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { InviteToken, StaffRole } from '../types';
import { randomMixedToken } from '../utils/secureToken';

import { createOfficeInvite, listOfficeInvites, revokeOfficeInvite } from './office/officeService';
import type { OfficeMemberRole } from './office/officePermissions';

const STAFF_TO_OFFICE_ROLE: Record<Exclude<StaffRole, 'OWNER'>, Exclude<OfficeMemberRole, 'owner' | 'custom'>> = {
  LAWYER: 'lawyer', CONSULTANT: 'consultant', STAFF: 'clerk', ACCOUNTING: 'accounting',
};
const OFFICE_TO_STAFF_ROLE: Record<string, StaffRole> = {
  lawyer: 'LAWYER', consultant: 'CONSULTANT', clerk: 'STAFF', accounting: 'ACCOUNTING', custom: 'STAFF', owner: 'OWNER',
};
/** 서버 초대 목록 항목은 토큰 원문이 없어(해시만 저장) 'id:<초대 ID>'로 구분한다 */
export const SERVER_INVITE_PREFIX = 'id:';

const INVITE_STORAGE_KEY = 'legal_crm_invite_tokens';
const INVITE_EXPIRY_HOURS = 48; // 초대 링크 기본 만료 시간

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

/** CSPRNG 초대 토큰 (6자 x 4세그먼트, 약 142bit). Math.random 사용 금지 */
function generateTokenString(): string {
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) segments.push(randomMixedToken(6));
  return segments.join('-'); // 예: "aB3xKz-Lm9pQr-Wx7yNs-Uv2tHg"
}

function rpcErrorToKorean(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (m.includes('already used')) return '이미 사용된 초대 링크입니다.';
  if (m.includes('expired')) return '만료된 초대 링크입니다. 관리자에게 재발급을 요청해주세요.';
  if (m.includes('another email')) return '이 초대 링크는 다른 이메일 계정용으로 발급되었습니다.';
  if (m.includes('invalid')) return '유효하지 않은 초대 링크입니다.';
  return '초대 링크 처리 중 오류가 발생했습니다.';
}

// ── 초대 토큰 생성 ──

export async function generateInviteToken(
  role: StaffRole,
  createdBy: string,
  email?: string,
  expiryHours: number = INVITE_EXPIRY_HOURS
): Promise<InviteToken> {
  if (role === 'OWNER') throw new Error('대표 변호사 역할로는 초대할 수 없습니다.');

  // 서버 사무소 초대 (RB-2): 토큰은 서버가 만들고 해시만 저장한다. 수락해도 변호사 가입 신청이 생기지 않는다.
  if (isSupabaseConfigured) {
    const ttl = (expiryHours <= 24 ? 24 : expiryHours <= 48 ? 48 : 168) as 24 | 48 | 168;
    const res = await createOfficeInvite({ officeId: createdBy, role: STAFF_TO_OFFICE_ROLE[role], email, ttlHours: ttl });
    if (!res.ok) throw new Error(res.message);
    return {
      token: res.data.token, role, email: email || undefined, expiresAt: res.data.expiresAt,
      createdBy, createdAt: new Date().toISOString(), isUsed: false,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const token: InviteToken = {
    token: generateTokenString(),
    role,
    email: email || undefined,
    expiresAt: expiresAt.toISOString(),
    createdBy,
    createdAt: now.toISOString(),
    isUsed: false,
  };

  // Supabase 저장 (설정된 환경에서는 서버 저장 실패 시 링크를 발급하지 않음 — 받는 사람 기기에서 검증 불가)
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('invite_tokens').insert({
      token: token.token,
      role: token.role,
      email: token.email,
      expires_at: token.expiresAt,
      created_by: token.createdBy,
      created_at: token.createdAt,
      is_used: false,
    });
    if (error) {
      console.warn('[Invite] Supabase save failed', error.message);
      throw new Error('초대 링크를 서버에 저장하지 못했습니다. 승인된 변호사 계정으로 로그인했는지 확인해 주세요.');
    }
  }

  // Supabase 미설정(로컬 개발)일 때만 브라우저에 저장. 설정 환경의 발급 목록은 서버에서 조회한다.
  if (!isSupabaseConfigured) {
    const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
    tokens.push(token);
    setLocalData(INVITE_STORAGE_KEY, tokens);
  }

  return token;
}

// ── 초대 토큰 검증 ──

export async function validateInviteToken(tokenString: string): Promise<{
  valid: boolean;
  token?: InviteToken;
  error?: string;
}> {
  const cleaned = (tokenString || '').trim();
  if (cleaned.length < 20) {
    return { valid: false, error: '유효하지 않은 초대 링크입니다.' };
  }

  // Supabase 설정 환경: 서버 RPC(peek_invite_token, 018)로만 검증 — 로컬 저장소 폴백 없음
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('peek_invite_token', { p_token: cleaned });
      if (error) {
        console.warn('[Invite] peek_invite_token failed', error.message);
        return { valid: false, error: '초대 링크를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { valid: false, error: '유효하지 않은 초대 링크입니다.' };
      if (row.is_used) return { valid: false, error: '이미 사용된 초대 링크입니다.' };
      if (new Date(row.expires_at) < new Date()) {
        return { valid: false, error: '만료된 초대 링크입니다. 관리자에게 재발급을 요청해주세요.' };
      }
      return {
        valid: true,
        token: {
          token: cleaned,
          role: row.role,
          expiresAt: row.expires_at,
          createdBy: '',
          createdAt: '',
          isUsed: false,
        },
      };
    } catch (e) {
      console.warn('[Invite] Supabase validate exception', e);
      return { valid: false, error: '초대 링크를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
  }

  // Supabase 미설정(로컬 개발) 전용 폴백
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const found = tokens.find(t => t.token === cleaned);

  if (!found) {
    return { valid: false, error: '유효하지 않은 초대 링크입니다.' };
  }
  if (found.isUsed) {
    return { valid: false, error: '이미 사용된 초대 링크입니다.' };
  }
  if (new Date(found.expiresAt) < new Date()) {
    return { valid: false, error: '만료된 초대 링크입니다. 관리자에게 재발급을 요청해주세요.' };
  }

  return { valid: true, token: found };
}

// ── 초대 토큰 사용 처리 ──

export interface AcceptInviteProfile {
  staffId: string;
  linkedUserId: string;
  name: string;
  email?: string;
  avatar?: string;
  provider?: string;
}

export type AcceptInviteResult =
  | { ok: true; role: StaffRole; invitedBy?: string; staffCreatedOnServer: boolean }
  | { ok: false; error: string };

/**
 * 로그인한 초대 대상자가 초대를 수락한다 (토큰 1회 소비 + 승인 대기 직원 기록 생성).
 * - Supabase: accept_staff_invite RPC(020)가 토큰 검증·소비와 직원 기록 생성을 한 트랜잭션으로 처리한다.
 *   역할·초대자는 서버의 토큰 값으로 정해지므로 클라이언트가 바꿀 수 없다.
 * - 020 미적용 환경: consume_invite_token(018)으로 소비만 하고 staffCreatedOnServer=false를 돌려준다.
 */
export async function acceptStaffInvite(tokenString: string, profile: AcceptInviteProfile): Promise<AcceptInviteResult> {
  const now = new Date().toISOString();
  const cleaned = (tokenString || '').trim();

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('accept_staff_invite', {
      p_token: cleaned,
      p_staff_id: profile.staffId,
      p_linked_user_id: profile.linkedUserId,
      p_name: profile.name,
      p_email: profile.email || null,
      p_avatar: profile.avatar || null,
      p_provider: profile.provider || null,
    });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, role: row?.role as StaffRole, invitedBy: row?.invited_by || undefined, staffCreatedOnServer: true };
    }
    // 020 마이그레이션 미적용(함수 없음) → 018 RPC로 소비만
    const missingFn = error.code === 'PGRST202' || /accept_staff_invite/i.test(error.message || '') && /not find|does not exist/i.test(error.message || '');
    if (!missingFn) {
      console.warn('[Invite] accept_staff_invite failed', error.message);
      return { ok: false, error: rpcErrorToKorean(error.message) };
    }
    const legacy = await supabase.rpc('consume_invite_token', { p_token: cleaned, p_staff_id: profile.staffId });
    if (legacy.error) {
      console.warn('[Invite] consume_invite_token failed', legacy.error.message);
      return { ok: false, error: rpcErrorToKorean(legacy.error.message) };
    }
    return { ok: true, role: legacy.data as StaffRole, staffCreatedOnServer: false };
  }

  // Supabase 미설정(로컬 개발) 전용
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const found = tokens.find(t => t.token === cleaned);
  if (!found || found.isUsed || new Date(found.expiresAt) < new Date()) {
    return { ok: false, error: '유효하지 않은 초대 링크입니다.' };
  }
  setLocalData(
    INVITE_STORAGE_KEY,
    tokens.map(t => (t.token === cleaned ? { ...t, isUsed: true, usedBy: profile.staffId, usedAt: now } : t))
  );
  return { ok: true, role: found.role, invitedBy: found.createdBy, staffCreatedOnServer: false };
}

// ── 초대 토큰 목록 조회 (관리자용) ──

/**
 * 내가 발급한 초대 링크 목록
 * (이전: 이 브라우저 공용 localStorage만 읽어 다른 기기에서 사용된 링크가 계속 '활성'으로 보이고, 다른 변호사 발급분도 섞임)
 */
export async function loadInviteTokens(createdBy: string): Promise<InviteToken[]> {
  if (isSupabaseConfigured) {
    // 서버 사무소 초대 목록 (createdBy = 사무소 ID = 대표 변호사 ID)
    const res = await listOfficeInvites(createdBy);
    if (!res.ok) throw new Error(res.message);
    return res.data.map(r => ({
      token: `${SERVER_INVITE_PREFIX}${r.id}`,
      role: OFFICE_TO_STAFF_ROLE[r.role] || 'STAFF',
      email: r.email || undefined,
      expiresAt: r.revokedAt || r.expiresAt,
      createdBy,
      createdAt: r.createdAt,
      usedAt: r.usedAt || undefined,
      isUsed: !!r.usedAt,
    }));
  }
  return getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []).filter(t => t.createdBy === createdBy);
}

// ── 초대 URL 생성 헬퍼 ──

export function buildInviteUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  // 서버 사무소 초대는 officeInvite, 로컬 개발용(서버 미설정)만 예전 invite 파라미터
  if (isSupabaseConfigured) return `${base}?role=lawyer&officeInvite=${encodeURIComponent(token)}`;
  return `${base}?role=lawyer&invite=${token}`;
}

// ── 만료된 토큰 정리 ──

export function cleanupExpiredTokens(): void {
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const now = new Date();
  const valid = tokens.filter(t =>
    t.isUsed || new Date(t.expiresAt) > now
  );
  setLocalData(INVITE_STORAGE_KEY, valid);
}

// ── 초대 토큰 수동 만료 ──

export async function expireInviteToken(token: string): Promise<void> {
  if (isSupabaseConfigured) {
    if (!token.startsWith(SERVER_INVITE_PREFIX)) throw new Error('초대 링크 만료 처리에 실패했습니다.');
    const res = await revokeOfficeInvite(token.slice(SERVER_INVITE_PREFIX.length));
    if (!res.ok) throw new Error(res.message);
    return;
  }
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const updated = tokens.map(t =>
    t.token === token ? { ...t, expiresAt: new Date().toISOString() } : t
  );
  setLocalData(INVITE_STORAGE_KEY, updated);
}
