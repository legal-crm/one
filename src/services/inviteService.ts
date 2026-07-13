// ============================================================
// [AUTH] 초대 링크 토큰 관리 서비스
// 관리자가 직원 초대 링크를 생성하고, 직원이 해당 링크로 회원가입합니다.
// Supabase 미설정 시 localStorage 폴백으로 동작합니다.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { InviteToken, StaffRole } from '../types';

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

function generateTokenString(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 6; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-'); // 예: "aB3xKz-Lm9pQr-Wx7yNs-Uv2tHg"
}

// ── 초대 토큰 생성 ──

export async function generateInviteToken(
  role: StaffRole,
  createdBy: string,
  email?: string,
  expiryHours: number = INVITE_EXPIRY_HOURS
): Promise<InviteToken> {
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

  // localStorage 저장
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  tokens.push(token);
  setLocalData(INVITE_STORAGE_KEY, tokens);

  // Supabase 저장
  if (isSupabaseConfigured) {
    try {
      await supabase.from('invite_tokens').insert({
        token: token.token,
        role: token.role,
        email: token.email,
        expires_at: token.expiresAt,
        created_by: token.createdBy,
        created_at: token.createdAt,
        is_used: false,
      });
    } catch (e) {
      console.warn('[Invite] Supabase save failed', e);
    }
  }

  return token;
}

// ── 초대 토큰 검증 ──

export async function validateInviteToken(tokenString: string): Promise<{
  valid: boolean;
  token?: InviteToken;
  error?: string;
}> {
  // Supabase 우선 조회
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('invite_tokens')
        .select('*')
        .eq('token', tokenString)
        .single();

      if (!error && data) {
        const inviteToken: InviteToken = {
          token: data.token,
          role: data.role,
          email: data.email,
          expiresAt: data.expires_at,
          createdBy: data.created_by,
          createdAt: data.created_at,
          usedBy: data.used_by,
          usedAt: data.used_at,
          isUsed: data.is_used,
        };

        if (inviteToken.isUsed) {
          return { valid: false, error: '이미 사용된 초대 링크입니다.' };
        }
        if (new Date(inviteToken.expiresAt) < new Date()) {
          return { valid: false, error: '만료된 초대 링크입니다. 관리자에게 재발급을 요청해주세요.' };
        }
        return { valid: true, token: inviteToken };
      }
    } catch (e) {
      console.warn('[Invite] Supabase validate failed, falling back', e);
    }
  }

  // localStorage 폴백
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const found = tokens.find(t => t.token === tokenString);

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

export async function consumeInviteToken(tokenString: string, usedById: string): Promise<boolean> {
  const now = new Date().toISOString();

  // localStorage 업데이트
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const updated = tokens.map(t =>
    t.token === tokenString
      ? { ...t, isUsed: true, usedBy: usedById, usedAt: now }
      : t
  );
  setLocalData(INVITE_STORAGE_KEY, updated);

  // Supabase 업데이트
  if (isSupabaseConfigured) {
    try {
      await supabase.from('invite_tokens').update({
        is_used: true,
        used_by: usedById,
        used_at: now,
      }).eq('token', tokenString);
    } catch (e) {
      console.warn('[Invite] Supabase consume failed', e);
    }
  }

  return true;
}

// ── 초대 토큰 목록 조회 (관리자용) ──

export function loadInviteTokens(): InviteToken[] {
  return getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
}

// ── 초대 URL 생성 헬퍼 ──

export function buildInviteUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
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
    await supabase.from('invite_tokens').update({ expires_at: new Date().toISOString() }).eq('token', token);
  }
  const tokens = getLocalData<InviteToken[]>(INVITE_STORAGE_KEY, []);
  const updated = tokens.map(t =>
    t.token === token ? { ...t, expiresAt: new Date().toISOString() } : t
  );
  setLocalData(INVITE_STORAGE_KEY, updated);
}
