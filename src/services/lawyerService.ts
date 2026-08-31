import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { User } from '../types';

// ============================================================
// Lawyer Supabase Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작하는 하이브리드 동기화
// ============================================================

const STORAGE_KEY = 'legal_crm_lawyers';

// ── 로컬 스토리지 헬퍼 ──

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
  console.error(`[LawyerService] ${operation} 실패: ${errorDetail}`, error);
}

// ── 변환 유틸리티 ──

const KNOWN_COLUMNS = new Set([
  'id',
  'lawFirmId',
  'law_firm_id',
  'teamId',
  'team_id',
  'name',
  'firmName',
  'firm_name',
  'role',
  'fields',
  'region',
  'avatar',
  'avatarData',
  'avatar_data',
  'bio',
  'career',
  'education',
  'specialties',
  'successRate',
  'success_rate',
  'totalCases',
  'total_cases',
  'matchedCount',
  'matched_count',
  'avgRepaymentRate',
  'avg_repayment_rate',
  'courtJurisdiction',
  'court_jurisdiction',
  'adTier',
  'ad_tier',
  'aiCaseAnalysisEnabled',
  'ai_case_analysis_enabled',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'data',
]);

/**
 * User(변호사) 객체 → Supabase DB row 변환
 * 핵심 필드는 DB 컬럼으로 매핑하고, 비컬럼 필드는 data JSONB에 저장
 */
export function lawyerToRow(lawyer: any) {
  const {
    id,
    lawFirmId,
    teamId,
    name,
    firmName,
    role,
    fields,
    region,
    avatar,
    avatarData,
    bio,
    career,
    education,
    specialties,
    successRate,
    totalCases,
    matchedCount,
    avgRepaymentRate,
    courtJurisdiction,
    adTier,
    aiCaseAnalysisEnabled,
    createdAt,
    data: nestedData,
  } = lawyer;

  // 비컬럼 필드 추출
  const extraData: Record<string, any> = {
    ...(nestedData && typeof nestedData === 'object' ? nestedData : {}),
  };

  for (const [key, value] of Object.entries(lawyer)) {
    if (!KNOWN_COLUMNS.has(key) && value !== undefined) {
      extraData[key] = value;
    }
  }

  return {
    id: id || '',
    law_firm_id: lawFirmId ?? lawyer.law_firm_id ?? '',
    team_id: teamId ?? lawyer.team_id ?? '',
    name: name || '',
    firm_name: firmName ?? lawyer.firm_name ?? null,
    role: role ?? lawyer.role ?? 'LAWYER',
    fields: fields ?? lawyer.fields ?? [],
    region: region ?? lawyer.region ?? '',
    avatar: avatar ?? lawyer.avatar ?? '',
    avatar_data: avatarData ?? lawyer.avatar_data ?? null,
    bio: bio ?? lawyer.bio ?? '',
    career: career ?? lawyer.career ?? [],
    education: education ?? lawyer.education ?? null,
    specialties: specialties ?? lawyer.specialties ?? [],
    success_rate: successRate ?? lawyer.success_rate ?? null,
    total_cases: totalCases ?? lawyer.total_cases ?? null,
    matched_count: matchedCount ?? lawyer.matched_count ?? 0,
    avg_repayment_rate: avgRepaymentRate ?? lawyer.avg_repayment_rate ?? null,
    court_jurisdiction: courtJurisdiction ?? lawyer.court_jurisdiction ?? null,
    ad_tier: adTier ?? lawyer.ad_tier ?? null,
    ai_case_analysis_enabled: aiCaseAnalysisEnabled ?? lawyer.ai_case_analysis_enabled ?? false,
    data: extraData,
    created_at: createdAt ?? lawyer.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Supabase DB row → User(변호사) 객체 변환
 * data JSONB를 풀어서 확장 필드 복원
 */
export function rowToLawyer(row: any): User {
  const extraData = row.data && typeof row.data === 'object' ? row.data : {};

  let fields: string[] = [];
  if (Array.isArray(row.fields)) {
    fields = row.fields;
  } else if (typeof row.fields === 'string' && row.fields.trim()) {
    try {
      const parsed = JSON.parse(row.fields);
      fields = Array.isArray(parsed) ? parsed : [row.fields];
    } catch {
      fields = [row.fields];
    }
  }

  let career: string[] = [];
  if (Array.isArray(row.career)) {
    career = row.career;
  } else if (typeof row.career === 'string' && row.career.trim()) {
    try {
      const parsed = JSON.parse(row.career);
      career = Array.isArray(parsed) ? parsed : [row.career];
    } catch {
      career = [row.career];
    }
  }

  let specialties: string[] = [];
  if (Array.isArray(row.specialties)) {
    specialties = row.specialties;
  } else if (typeof row.specialties === 'string' && row.specialties.trim()) {
    try {
      const parsed = JSON.parse(row.specialties);
      specialties = Array.isArray(parsed) ? parsed : [row.specialties];
    } catch {
      specialties = [row.specialties];
    }
  }

  return {
    recentActivity: '최근 활동 없음',
    ...extraData,
    id: row.id,
    lawFirmId: row.law_firm_id ?? row.lawFirmId ?? '',
    teamId: row.team_id ?? row.teamId ?? '',
    name: row.name ?? '',
    firmName: row.firm_name ?? row.firmName ?? undefined,
    role: (row.role ?? 'LAWYER') as User['role'],
    fields,
    region: row.region ?? '',
    avatar: row.avatar ?? '',
    avatarData: row.avatar_data ?? row.avatarData ?? undefined,
    bio: row.bio ?? '',
    career,
    education: row.education ?? row.education ?? undefined,
    specialties,
    successRate: row.success_rate != null ? Number(row.success_rate) : (row.successRate != null ? Number(row.successRate) : undefined),
    totalCases: row.total_cases != null ? Number(row.total_cases) : (row.totalCases != null ? Number(row.totalCases) : undefined),
    matchedCount: row.matched_count != null ? Number(row.matched_count) : (row.matchedCount != null ? Number(row.matchedCount) : 0),
    avgRepaymentRate: row.avg_repayment_rate != null ? Number(row.avg_repayment_rate) : (row.avgRepaymentRate != null ? Number(row.avgRepaymentRate) : undefined),
    courtJurisdiction: row.court_jurisdiction ?? row.courtJurisdiction ?? undefined,
    adTier: row.ad_tier ?? row.adTier ?? undefined,
    aiCaseAnalysisEnabled: row.ai_case_analysis_enabled ?? row.aiCaseAnalysisEnabled ?? undefined,
  };
}

// ── CRUD 비동기 함수 ──

/**
 * 변호사 목록 로드 (Supabase 우선, 실패 시 localStorage 폴백)
 */
export async function loadLawyers(): Promise<User[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('lawyers')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        logSupabaseError('loadLawyers', error);
      } else if (data && data.length > 0) {
        const lawyers = data.map(rowToLawyer);
        setLocalData(STORAGE_KEY, lawyers);
        return lawyers;
      }
    } catch (e) {
      logSupabaseError('loadLawyers (exception)', e);
    }
  }

  // LocalStorage Fallback
  return getLocalData<User[]>(STORAGE_KEY, []);
}

/**
 * 단일 변호사 저장 (localStorage 우선 저장 후 Supabase upsert)
 */
export async function saveLawyer(lawyer: User): Promise<void> {
  // 1. LocalStorage 즉시 저장
  const lawyers = getLocalData<User[]>(STORAGE_KEY, []);
  const idx = lawyers.findIndex(l => l.id === lawyer.id);
  if (idx >= 0) {
    lawyers[idx] = lawyer;
  } else {
    lawyers.push(lawyer);
  }
  setLocalData(STORAGE_KEY, lawyers);

  // 2. Supabase 비동기 동기화
  if (isSupabaseConfigured) {
    try {
      const row = lawyerToRow(lawyer);
      const { error } = await supabase
        .from('lawyers')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveLawyer', error);
      }
    } catch (e) {
      logSupabaseError('saveLawyer (exception)', e);
    }
  }
}

/**
 * 변호사 목록 일괄 저장 (localStorage 우선 저장 후 Supabase upsert)
 */
export async function saveAllLawyers(lawyers: User[]): Promise<void> {
  // 1. LocalStorage 즉시 저장
  setLocalData(STORAGE_KEY, lawyers);

  // 2. Supabase 비동기 동기화
  if (isSupabaseConfigured && lawyers.length > 0) {
    try {
      const rows = lawyers.map(lawyerToRow);
      const { error } = await supabase
        .from('lawyers')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveAllLawyers', error);
      }
    } catch (e) {
      logSupabaseError('saveAllLawyers (exception)', e);
    }
  }
}

/**
 * 단일 변호사 삭제 (localStorage 우선 삭제 후 Supabase delete)
 */
export async function deleteLawyer(lawyerId: string): Promise<void> {
  // 1. LocalStorage 즉시 삭제
  const lawyers = getLocalData<User[]>(STORAGE_KEY, []);
  const filtered = lawyers.filter(l => l.id !== lawyerId);
  setLocalData(STORAGE_KEY, filtered);

  // 2. Supabase 비동기 삭제
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('lawyers')
        .delete()
        .eq('id', lawyerId);

      if (error) {
        logSupabaseError('deleteLawyer', error);
      }
    } catch (e) {
      logSupabaseError('deleteLawyer (exception)', e);
    }
  }
}
