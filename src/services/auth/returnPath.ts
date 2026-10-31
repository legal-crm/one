// 소셜 로그인 뒤 원래 보던 화면으로 돌아가기 (MY-2)
// 소셜 로그인은 첫 화면 주소로 돌아오므로(/my/… 같은 알림톡 주소가 사라짐) 로그인 직전 주소를 같은 탭에 잠깐 둔다.
// 주소의 개인정보·토큰 칸은 남기지 않는다 (사건 연결 토큰은 pendingCaseLink가 따로 보관).

const KEY = 'mykim_return_path';
const MAX_AGE_MS = 30 * 60 * 1000;
const DROP_PARAMS = ['caseLink', 'code', 'state', 'error', 'error_description', 'access_token', 'refresh_token'];

/** 같은 사이트 안의 주소만 (다른 사이트로 보내는 주소 차단) */
export function sanitizeReturnPath(path: string): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  try {
    const url = new URL(path, 'https://mykim.kr');
    if (url.origin !== 'https://mykim.kr') return null;
    for (const p of DROP_PARAMS) url.searchParams.delete(p);
    if (url.searchParams.has('role')) return null; // 변호사·관리자 화면은 각자 로그인으로
    const out = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
    return out === '/' ? null : out;
  } catch { return null; }
}

export function saveReturnPath(path: string = typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''): void {
  const safe = sanitizeReturnPath(path);
  try {
    if (safe) sessionStorage.setItem(KEY, JSON.stringify({ path: safe, at: Date.now() }));
    else sessionStorage.removeItem(KEY);
  } catch { /* 화면 설정 저장 실패는 무시 */ }
}

/** 보관한 주소를 꺼내고 지운다 (30분 지나면 버린다) */
export function consumeReturnPath(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { path?: string; at?: number };
    if (!v.path || !v.at || Date.now() - v.at > MAX_AGE_MS) return null;
    return sanitizeReturnPath(v.path);
  } catch { return null; }
}
