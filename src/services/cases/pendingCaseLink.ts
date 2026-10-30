// 사무소가 보낸 사건 연결 링크(?caseLink=)를 로그인하는 동안 잠깐 보관한다.
// 소셜 로그인은 첫 화면 주소로 돌아오므로 주소의 토큰이 사라진다 → 같은 탭의 sessionStorage에만 두고, 연결하면 지운다.
const KEY = 'mykim_pending_case_link';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2시간

export const MY_CASES_CHANGED_EVENT = 'mykim:my-cases-changed';

/** 주소에 연결 토큰이 있으면 보관하고 주소에서 지운다 (토큰이 기록·공유 화면에 남지 않게) */
export function capturePendingCaseLink(): void {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('caseLink');
    if (!token) return;
    sessionStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
    url.searchParams.delete('caseLink');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch { /* 저장소를 못 쓰면 주소의 토큰으로만 처리 */ }
}

export function peekPendingCaseLink(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { token?: string; at?: number };
    if (!v.token || !v.at || Date.now() - v.at > MAX_AGE_MS) { sessionStorage.removeItem(KEY); return null; }
    return v.token;
  } catch { return null; }
}

export function clearPendingCaseLink(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
