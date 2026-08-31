import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { Case } from '../types';

// ============================================================
// Case Supabase Hybrid Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작
// ============================================================

const STORAGE_KEY = 'legal_crm_cases';

// ── 유틸리티 ──

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function logSupabaseError(operation: string, error: any) {
  const errorDetail = typeof error === 'object' ? (error?.message || error?.code || JSON.stringify(error)) : String(error);
  console.error(`[CaseService] ${operation} 실패: ${errorDetail}`, error);
}

function parseNotes(notes: any): string[] {
  if (Array.isArray(notes)) return notes;
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not a JSON array
    }
    return notes ? [notes] : [];
  }
  return [];
}

// ── 변환 함수 ──

function toRow(c: Case) {
  return {
    id: c.id,
    client_id: c.clientId || '',
    client_name: c.clientName || '',
    phone: c.phone || '',
    status: c.status || 'document',
    assigned_lawyer_id: c.assignedLawyerId || '',
    assigned_lawyer_name: c.assignedLawyerName || '',
    debt_total: c.debtTotal ?? 0,
    income: c.income ?? 0,
    notes: c.notes || [],
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

function fromRow(row: any): Case {
  return {
    id: row.id,
    clientId: row.client_id || '',
    clientName: row.client_name || '',
    phone: row.phone || '',
    status: row.status || 'document',
    assignedLawyerId: row.assigned_lawyer_id || '',
    assignedLawyerName: row.assigned_lawyer_name || '',
    debtTotal: Number(row.debt_total) || 0,
    income: Number(row.income) || 0,
    notes: parseNotes(row.notes),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

// ── Case CRUD 비동기 함수 ──

/**
 * 사건 목록 로드: Supabase 우선 조회 후 localStorage 동기화, 실패 시 localStorage 폴백
 */
export async function loadCases(): Promise<Case[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadCases', error);
      } else if (data) {
        const cases = data.map(fromRow);
        setLocalData(STORAGE_KEY, cases);
        return cases;
      }
    } catch (e) {
      logSupabaseError('loadCases (exception)', e);
    }
  }

  return getLocalData<Case[]>(STORAGE_KEY, []);
}

/**
 * 사건 단건 저장: localStorage 즉시 저장 후 Supabase upsert
 */
export async function saveCase(c: Case): Promise<void> {
  // 1. LocalStorage 우선 저장
  const cases = getLocalData<Case[]>(STORAGE_KEY, []);
  const idx = cases.findIndex(item => item.id === c.id);
  if (idx >= 0) {
    cases[idx] = c;
  } else {
    cases.unshift(c);
  }
  setLocalData(STORAGE_KEY, cases);

  // 2. Supabase upsert 동기화
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('cases')
        .upsert(toRow(c), { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveCase', error);
      }
    } catch (e) {
      logSupabaseError('saveCase (exception)', e);
    }
  }
}

/**
 * 사건 일괄 저장: localStorage 즉시 저장 후 Supabase bulk upsert
 */
export async function saveAllCases(cases: Case[]): Promise<void> {
  // 1. LocalStorage 우선 저장
  setLocalData(STORAGE_KEY, cases);

  // 2. Supabase bulk upsert 동기화
  if (isSupabaseConfigured && cases.length > 0) {
    try {
      const payload = cases.map(toRow);
      const { error } = await supabase
        .from('cases')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveAllCases', error);
      }
    } catch (e) {
      logSupabaseError('saveAllCases (exception)', e);
    }
  }
}

/**
 * 사건 삭제: localStorage 즉시 삭제 후 Supabase delete
 */
export async function deleteCase(id: string): Promise<void> {
  // 1. LocalStorage 우선 삭제
  const cases = getLocalData<Case[]>(STORAGE_KEY, []);
  setLocalData(STORAGE_KEY, cases.filter(c => c.id !== id));

  // 2. Supabase delete 동기화
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', id);
      if (error) {
        logSupabaseError('deleteCase', error);
      }
    } catch (e) {
      logSupabaseError('deleteCase (exception)', e);
    }
  }
}
