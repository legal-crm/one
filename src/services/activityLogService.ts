import { supabase, isSupabaseConfigured } from '../supabaseClient';

// ============================================================
// ActivityLog Supabase Hybrid Sync Service
// 활동 로그 데이터 관리: localStorage 우선 저장 후 Supabase upsert 동기화
// ============================================================

export interface ActivityLog {
  id: string;
  memberId?: string;
  memberName: string;
  role: string;
  action: string;
  details: string;
  ip?: string;
  timestamp: string;
}

const STORAGE_KEY = 'legal_crm_activity_logs';

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
  console.error(`[ActivityLogService] ${operation} 실패: ${errorDetail}`, error);
}

// ── 변환 함수 (TypeScript camelCase <-> DB snake_case) ──

function toRow(log: ActivityLog) {
  return {
    id: log.id,
    member_id: log.memberId || null,
    member_name: log.memberName,
    role: log.role,
    action: log.action,
    details: log.details,
    ip: log.ip || null,
    timestamp: log.timestamp || new Date().toISOString(),
  };
}

function fromRow(row: any): ActivityLog {
  return {
    id: row.id,
    memberId: row.member_id || undefined,
    memberName: row.member_name || '',
    role: row.role || '',
    action: row.action || '',
    details: row.details || '',
    ip: row.ip || undefined,
    timestamp: row.timestamp || '',
  };
}

// ── 데이터 연동 함수 ──

/**
 * 활동 로그 목록 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백 (timestamp 기준 내림차순 정렬)
 */
export async function loadActivityLogs(): Promise<ActivityLog[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        logSupabaseError('loadActivityLogs', error);
      } else if (data) {
        const logs = data.map(fromRow);
        setLocalData(STORAGE_KEY, logs);
        return logs;
      }
    } catch (e) {
      logSupabaseError('loadActivityLogs (exception)', e);
    }
  }

  // LocalStorage Fallback
  const logs = getLocalData<ActivityLog[]>(STORAGE_KEY, []);
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * 단일 활동 로그 기록/저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function writeActivityLog(log: ActivityLog): Promise<void> {
  // 1. LocalStorage 저장
  const logs = getLocalData<ActivityLog[]>(STORAGE_KEY, []);
  const idx = logs.findIndex(l => l.id === log.id);
  if (idx >= 0) {
    logs[idx] = log;
  } else {
    logs.unshift(log);
  }
  setLocalData(STORAGE_KEY, logs);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .upsert(toRow(log), { onConflict: 'id' });

      if (error) {
        logSupabaseError('writeActivityLog', error);
      }
    } catch (e) {
      logSupabaseError('writeActivityLog (exception)', e);
    }
  }
}

/**
 * 단일 활동 로그 저장 (writeActivityLog 별칭)
 */
export const saveActivityLog = writeActivityLog;

/**
 * 전체 활동 로그 목록 일괄 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function saveAllActivityLogs(logs: ActivityLog[]): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(STORAGE_KEY, logs);

  // 2. Supabase 동기화
  if (isSupabaseConfigured && logs.length > 0) {
    try {
      const payload = logs.map(toRow);
      const { error } = await supabase
        .from('activity_logs')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveAllActivityLogs', error);
      }
    } catch (e) {
      logSupabaseError('saveAllActivityLogs (exception)', e);
    }
  }
}

/**
 * 활동 로그 삭제
 * localStorage에서 먼저 삭제 후 Supabase delete
 */
export async function deleteActivityLog(id: string): Promise<void> {
  // 1. LocalStorage 삭제
  const logs = getLocalData<ActivityLog[]>(STORAGE_KEY, []);
  const filtered = logs.filter(l => l.id !== id);
  setLocalData(STORAGE_KEY, filtered);

  // 2. Supabase 삭제
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', id);

      if (error) {
        logSupabaseError('deleteActivityLog', error);
      }
    } catch (e) {
      logSupabaseError('deleteActivityLog (exception)', e);
    }
  }
}
