// ============================================================
// [SECURITY] 통합 어드민 포털 진입 경로 & 브라우저 표시용 세션 마커
// ------------------------------------------------------------
// - 진입 경로(VITE_ADMIN_SECRET_PATH)는 노출을 줄이는 용도일 뿐 인가 수단이 아니다.
//   (Vite 환경변수는 번들에 포함되므로 비밀이 될 수 없음)
// - 실제 인가는 서버가 판정한다: Supabase JWT app_metadata.role = 'admin' + MFA(aal2).
//   (supabase/migrations/021 is_platform_admin, AdminRole의 getUser 서버 확인)
// - 운영 빌드에 VITE_ADMIN_SECRET_PATH가 없으면 관리자 포털 진입을 막는다.
//   (이전: 예비 경로 2종이 코드·문서에 하드코딩되어 환경변수를 넣어도 항상 열렸음)
// ============================================================

import { secureGetItem, secureSetItem, secureRemoveItem } from './secureStorage';

const configuredPath = String((import.meta as any).env?.VITE_ADMIN_SECRET_PATH || '').trim();

/** 관리자 포털 경로 (?role=<값>). 운영에서 미설정이면 빈 문자열 → 포털 비활성 */
export const ADMIN_PORTAL_PATH: string = configuredPath || (import.meta.env.DEV ? 'adm_sec_dev' : '');

export function isAdminPortalRole(roleParam: string | null | undefined): boolean {
  return !!ADMIN_PORTAL_PATH && !!roleParam && roleParam === ADMIN_PORTAL_PATH;
}

/** 30분 미활동 시 자동 로그아웃 */
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const MARKER_KEY = 'legal_crm_admin_session';

export interface AdminSessionMarker {
  email: string;
  lastActiveAt: number;
  /** DEV 빌드 전용 즉시 로그인 (운영 빌드에서는 무시) */
  dev?: boolean;
}

/**
 * 새로고침 시 관리자 화면을 먼저 띄우기 위한 표시값.
 * 권한 근거가 아니다 — AdminRole이 마운트 시 서버(getUser)·MFA 단계를 다시 확인하고,
 * DB 접근은 RLS(is_platform_admin)가 판정한다.
 */
export function readAdminMarker(): AdminSessionMarker | null {
  try {
    const raw = secureGetItem(MARKER_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<AdminSessionMarker>;
    if (!m || typeof m.lastActiveAt !== 'number' || typeof m.email !== 'string') return null;
    if (Date.now() - m.lastActiveAt > ADMIN_IDLE_TIMEOUT_MS) return null;
    if (m.dev && !import.meta.env.DEV) return null;
    return { email: m.email, lastActiveAt: m.lastActiveAt, dev: !!m.dev };
  } catch {
    return null;
  }
}

export function writeAdminMarker(email: string, dev = false): void {
  try {
    const marker: AdminSessionMarker = { email, lastActiveAt: Date.now(), ...(dev ? { dev: true } : {}) };
    secureSetItem(MARKER_KEY, JSON.stringify(marker));
  } catch {}
}

export function touchAdminMarker(): void {
  const m = readAdminMarker();
  if (m) writeAdminMarker(m.email, !!m.dev);
}

export function clearAdminMarker(): void {
  try { secureRemoveItem(MARKER_KEY); } catch {}
}

/** 마커의 마지막 활동 시각 (만료 여부와 무관하게 원본 값) */
export function getAdminMarkerLastActive(): number | null {
  try {
    const raw = secureGetItem(MARKER_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return typeof m?.lastActiveAt === 'number' ? m.lastActiveAt : null;
  } catch {
    return null;
  }
}
