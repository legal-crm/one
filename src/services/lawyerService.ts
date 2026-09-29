import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { User } from '../types';

// ============================================================
// Lawyer Supabase Service Layer
// 공개 프로필: lawyers (anon 조회 가능) / 비공개 필드: lawyer_private_profiles (본인·관리자)
// 동기화 흐름은 hooks/useLawyerProfileSync.ts (localStorage는 App.tsx가 오프라인 캐시로 관리)
// ============================================================

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
  // [SECURITY] 인증 비밀값은 절대 DB(공개 조회 가능한 lawyers.data)에 저장하지 않음
  delete extraData.password;

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
    // created_at은 값이 있을 때만 보냄 (없으면 DB 기본값 — 이전: 저장할 때마다 현재 시각으로 덮어씀)
    ...((createdAt ?? lawyer.created_at) ? { created_at: createdAt ?? lawyer.created_at } : {}),
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

  const { password: _legacyPassword, ...safeExtra } = extraData as Record<string, any>;

  return {
    recentActivity: '최근 활동 없음',
    ...safeExtra,
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

// ── 공개/비공개 분리 ──

/**
 * 공개 lawyers 테이블(anon 조회 가능)에 두면 안 되는 필드.
 * lawyer_private_profiles(본인·관리자만 접근)에 저장한다. 028 마이그레이션의 키 목록과 동일하게 유지할 것.
 * (licenseNumber는 승인 변호사 공개 프로필에 표시되므로 공개 필드)
 */
export const PRIVATE_LAWYER_KEYS = [
  'email',
  'licenseImageData',
  'businessNumber',
  'ntsStatus',
  'sealInfo',
  'aiCaseAnalysisNote',
] as const;

type PrivateLawyerKey = typeof PRIVATE_LAWYER_KEYS[number];

/** 변호사 객체를 공개 행(lawyers)과 비공개 데이터(lawyer_private_profiles)로 분리 */
export function splitLawyer(lawyer: User): { row: ReturnType<typeof lawyerToRow>; privateData: Record<string, unknown> } {
  const publicPart: Record<string, unknown> = { ...lawyer };
  const privateData: Record<string, unknown> = {};
  for (const key of PRIVATE_LAWYER_KEYS) {
    if (publicPart[key] !== undefined && publicPart[key] !== null && publicPart[key] !== '') {
      privateData[key] = publicPart[key];
    }
    delete publicPart[key];
  }
  const row = lawyerToRow(publicPart);
  for (const key of PRIVATE_LAWYER_KEYS) delete (row.data as Record<string, unknown>)[key];
  return { row, privateData };
}

/** 비공개 필드만 추출 */
export function pickPrivateLawyerFields(lawyer: Partial<User> | undefined): Partial<Pick<User, PrivateLawyerKey>> {
  const out: Record<string, unknown> = {};
  if (!lawyer) return out;
  for (const key of PRIVATE_LAWYER_KEYS) {
    const v = (lawyer as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out as Partial<Pick<User, PrivateLawyerKey>>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** DB에 저장되는 내용 기준의 비교용 지문 (타임스탬프 제외) — 변경 감지에 사용 */
export function lawyerFingerprint(lawyer: User): string {
  const { row, privateData } = splitLawyer(lawyer);
  const { updated_at: _u, created_at: _c, ...rest } = row as Record<string, unknown>;
  return stableStringify({ row: rest, privateData });
}

// ── DB 입출력 ──

export type FetchLawyersResult =
  | { ok: true; lawyers: User[]; privateIds: Set<string>; privateLoaded: boolean; deletedIds: Set<string> }
  | { ok: false; message: string };

/**
 * lawyers 전체(공개) + 권한이 있는 비공개 프로필을 불러온다.
 * 비공개 프로필은 RLS상 본인·관리자 행만 반환되며, 비로그인이면 조회하지 않는다.
 * @returns privateIds: 비공개 데이터가 실제로 내려온 변호사 ID
 */
export async function fetchLawyersFromDb(): Promise<FetchLawyersResult> {
  if (!isSupabaseConfigured) return { ok: false, message: 'not_configured' };
  try {
    const { data, error } = await supabase
      .from('lawyers')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      logSupabaseError('fetchLawyersFromDb', error);
      return { ok: false, message: error.message };
    }

    // 관리자가 삭제한 프로필 ID (029) — 각 기기의 로컬 사본 제거용. 테이블 미배포 시 빈 목록
    const deletedIds = new Set<string>();
    const { data: tombs, error: tombError } = await supabase.from('lawyer_profile_tombstones').select('lawyer_id');
    if (tombError) console.warn('[LawyerService] 삭제 기록 조회 생략:', tombError.message);
    for (const t of tombs || []) if (t?.lawyer_id) deletedIds.add(String(t.lawyer_id));

    const privateById = new Map<string, Record<string, unknown>>();
    let privateLoaded = false;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: priv, error: privError } = await supabase
        .from('lawyer_private_profiles')
        .select('lawyer_id, data');
      if (privError) {
        // 테이블 미배포(028 전) 또는 권한 없음 → 공개 데이터만 사용
        console.warn('[LawyerService] 비공개 프로필 조회 생략:', privError.message);
      } else {
        privateLoaded = true;
        for (const p of priv || []) {
          if (p?.lawyer_id && p.data && typeof p.data === 'object') privateById.set(String(p.lawyer_id), p.data);
        }
      }
    }

    const lawyers = (data || []).filter(row => !deletedIds.has(String(row.id))).map(row => {
      const base = rowToLawyer(row);
      const priv = privateById.get(base.id);
      return priv ? ({ ...base, ...pickPrivateLawyerFields(priv as Partial<User>) } as User) : base;
    });
    return { ok: true, lawyers, privateIds: new Set(privateById.keys()), privateLoaded, deletedIds };
  } catch (e: any) {
    logSupabaseError('fetchLawyersFromDb (exception)', e);
    return { ok: false, message: e?.message || 'exception' };
  }
}

export interface PushLawyersResult {
  /** 저장 완료 */
  saved: string[];
  /** 신규로 넣으려 했으나 이미 DB에 있음 → 호출 측에서 다시 불러와야 함 */
  conflicted: string[];
  failed: { id: string; message: string }[];
}

/**
 * 변경된 변호사 프로필을 DB에 저장한다 (행 단위 — RLS로 한 행이 거부돼도 나머지는 저장).
 * - existingIds에 있는 행: upsert
 * - 없는 행: INSERT ... ON CONFLICT DO NOTHING (다른 기기의 기존 프로필을 빈 프로필로 덮어쓰지 않도록)
 * 승인 상태·유료 기능 등 관리자 전용 필드는 서버 트리거(028)가 비관리자 쓰기에서 보존한다.
 */
export async function pushLawyerProfiles(
  lawyers: User[],
  existingIds: Set<string>,
  options: { includePrivate: boolean },
): Promise<PushLawyersResult> {
  const result: PushLawyersResult = { saved: [], conflicted: [], failed: [] };
  if (!isSupabaseConfigured) return result;

  for (const lawyer of lawyers) {
    if (!lawyer?.id) continue;
    try {
      const { row, privateData } = splitLawyer(lawyer);
      const isNew = !existingIds.has(lawyer.id);
      const { data, error } = await supabase
        .from('lawyers')
        .upsert(row, { onConflict: 'id', ignoreDuplicates: isNew })
        .select('id');
      if (error) {
        logSupabaseError(`pushLawyerProfiles(${lawyer.id})`, error);
        result.failed.push({ id: lawyer.id, message: error.message });
        continue;
      }
      // 0행: 신규 INSERT가 기존 행과 충돌했거나, 삭제된 프로필(029 tombstone)이라 서버가 건너뜀
      if (!data || data.length === 0) {
        result.conflicted.push(lawyer.id);
        continue;
      }

      // 비공개 행은 data 전체를 교체하므로, 서버 비공개 값을 정상 조회한 뒤에만 쓴다 (조회 실패 시 덮어쓰기 방지)
      if (options.includePrivate && Object.keys(privateData).length > 0) {
        const { error: privError } = await supabase
          .from('lawyer_private_profiles')
          .upsert({ lawyer_id: lawyer.id, data: privateData }, { onConflict: 'lawyer_id' });
        if (privError) {
          logSupabaseError(`pushLawyerProfiles.private(${lawyer.id})`, privError);
          result.failed.push({ id: lawyer.id, message: `비공개 정보 저장 실패: ${privError.message}` });
          continue;
        }
      }
      result.saved.push(lawyer.id);
    } catch (e: any) {
      logSupabaseError(`pushLawyerProfiles(${lawyer.id}) (exception)`, e);
      result.failed.push({ id: lawyer.id, message: e?.message || 'exception' });
    }
  }
  return result;
}

/**
 * 관리자: 로그인 계정이 연결되지 않은 변호사 프로필 삭제 (029 admin_delete_lawyer_profile).
 * 삭제 기록이 남아 다른 기기의 로컬 사본도 다음 동기화 때 제거되고 다시 올라오지 않는다.
 */
export async function adminDeleteLawyerProfile(lawyerId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase가 설정되지 않았습니다.' };
  if (!lawyerId) return { ok: false, message: '프로필 ID가 없습니다.' };
  try {
    const { error } = await supabase.rpc('admin_delete_lawyer_profile', { p_lawyer_id: lawyerId });
    if (error) {
      logSupabaseError(`adminDeleteLawyerProfile(${lawyerId})`, error);
      const msg = error.message || '';
      if (msg.includes('linked to a login account')) return { ok: false, message: '로그인 계정이 연결된 프로필은 삭제할 수 없습니다. 정지 기능을 사용하세요.' };
      if (msg.includes('admin only')) return { ok: false, message: '관리자 권한(MFA 인증 포함)이 확인되지 않았습니다.' };
      if (msg.includes('Could not find the function')) return { ok: false, message: '서버에 삭제 기능(029 마이그레이션)이 아직 적용되지 않았습니다.' };
      return { ok: false, message: msg || '삭제에 실패했습니다.' };
    }
    return { ok: true };
  } catch (e: any) {
    logSupabaseError(`adminDeleteLawyerProfile(${lawyerId}) (exception)`, e);
    return { ok: false, message: e?.message || '삭제에 실패했습니다.' };
  }
}
