import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { Member } from '../types';

// ============================================================
// Member Supabase Hybrid Sync Service
// 회원 데이터 관리: localStorage 우선 저장 후 Supabase upsert 동기화
// ============================================================

const STORAGE_KEY = 'legal_crm_members';

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function logSupabaseError(operation: string, error: any) {
  const errorDetail = typeof error === 'object' ? (error?.message || error?.code || JSON.stringify(error)) : String(error);
  console.error(`[MemberService] ${operation} 실패: ${errorDetail}`, error);
}

// ── 변환 함수 (TypeScript camelCase <-> DB snake_case) ──

function toRow(member: Member) {
  return {
    id: member.id,
    email: member.email || '',
    phone: member.phone || '',
    alias: member.alias || '',
    role: member.role,
    login_channel: member.loginChannel || 'email',
    status: member.status || 'active',
    last_active_at: member.lastActiveAt || new Date().toISOString(),
    created_at: member.createdAt || new Date().toISOString(),
  };
}

function fromRow(row: any): Member {
  return {
    id: row.id,
    email: row.email || '',
    phone: row.phone || '',
    alias: row.alias || '',
    role: row.role,
    loginChannel: row.login_channel || 'email',
    status: row.status || 'active',
    lastActiveAt: row.last_active_at || row.created_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// ── 데이터 연동 함수 ──

/**
 * 회원 목록 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백
 */
export async function loadMembers(): Promise<Member[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadMembers', error);
      } else if (data) {
        const members = data.map(fromRow);
        setLocalData(STORAGE_KEY, members);
        return members;
      }
    } catch (e) {
      logSupabaseError('loadMembers (exception)', e);
    }
  }

  // LocalStorage Fallback
  return getLocalData<Member[]>(STORAGE_KEY, []);
}

/**
 * 단일 회원 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function saveMember(member: Member): Promise<void> {
  // 1. LocalStorage 저장
  const members = getLocalData<Member[]>(STORAGE_KEY, []);
  const idx = members.findIndex(m => m.id === member.id);
  if (idx >= 0) {
    members[idx] = member;
  } else {
    members.push(member);
  }
  setLocalData(STORAGE_KEY, members);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('members')
        .upsert(toRow(member), { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveMember', error);
      }
    } catch (e) {
      logSupabaseError('saveMember (exception)', e);
    }
  }
}

/**
 * 전체 회원 목록 일괄 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function saveAllMembers(members: Member[]): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(STORAGE_KEY, members);

  // 2. Supabase 동기화
  if (isSupabaseConfigured && members.length > 0) {
    try {
      const payload = members.map(toRow);
      const { error } = await supabase
        .from('members')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveAllMembers', error);
      }
    } catch (e) {
      logSupabaseError('saveAllMembers (exception)', e);
    }
  }
}

/**
 * 회원 삭제
 * localStorage에서 먼저 삭제 후 Supabase delete
 */
export async function deleteMember(id: string): Promise<void> {
  // 1. LocalStorage 삭제
  const members = getLocalData<Member[]>(STORAGE_KEY, []);
  const filtered = members.filter(m => m.id !== id);
  setLocalData(STORAGE_KEY, filtered);

  // 2. Supabase 삭제
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) {
        logSupabaseError('deleteMember', error);
      }
    } catch (e) {
      logSupabaseError('deleteMember (exception)', e);
    }
  }
}
