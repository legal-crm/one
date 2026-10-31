// ============================================================
// 첫 유입 경로·방문 분석 (M-6, 04 기획서 7-1)
//  * 첫 방문의 UTM·참조 도메인·첫 페이지 경로만 이 기기에 90일 보관했다가, 상담 요청을 만들 때
//    consult_requests.first_touch로 보낸다(개인정보 없음, 서버가 허용 칸만 남김).
//  * GA4·네이버 애널리틱스는 환경변수(VITE_GA4_ID·VITE_NAVER_ANALYTICS_ID)가 있을 때만 불러온다.
//    켜기 전에 개인정보 처리방침에 방문 분석 도구를 적어야 한다.
//  * 전환 이벤트에는 입력값(소득·채무 등)을 넣지 않는다. 단계 이름만.
// ============================================================

const KEY = 'mykim_first_touch_v1';
const TTL_MS = 90 * 24 * 3600 * 1000;

export interface FirstTouch {
  source?: string; medium?: string; campaign?: string; content?: string; term?: string;
  landing?: string; referrer?: string; first_at?: string;
}

const clean = (v: string | null | undefined, n = 80) => (v ? v.replace(/[^A-Za-z0-9가-힣._/:\- ]/g, '').slice(0, n) : undefined);

/** 앱 시작 때 한 번: 아직 기록이 없으면(또는 만료) 이번 방문을 첫 유입으로 남긴다. UTM이 있는 새 방문은 만료 전이라도 남기지 않는다(첫 접점 기준). */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const v = JSON.parse(saved) as FirstTouch & { _at?: number };
      if (v._at && Date.now() - v._at < TTL_MS) return;
    }
    const q = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.hostname !== window.location.hostname) referrer = clean(r.hostname, 60);
    } catch { /* 무시 */ }
    const ft: FirstTouch & { _at: number } = {
      source: clean(q.get('utm_source'), 30),
      medium: clean(q.get('utm_medium'), 30),
      campaign: clean(q.get('utm_campaign'), 60),
      content: clean(q.get('utm_content'), 60),
      term: clean(q.get('utm_term'), 60),
      landing: clean(window.location.pathname, 80),
      referrer,
      first_at: new Date().toISOString().slice(0, 10),
      _at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(ft));
  } catch { /* 저장소를 못 쓰면 기록하지 않는다 */ }
}

/** 상담 요청 저장용 (없으면 null) */
export function getFirstTouch(): FirstTouch | null {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return null;
    const { _at, ...rest } = JSON.parse(saved) as FirstTouch & { _at?: number };
    if (_at && Date.now() - _at > TTL_MS) return null;
    const out: FirstTouch = {};
    for (const [k, v] of Object.entries(rest)) if (typeof v === 'string' && v) (out as Record<string, string>)[k] = v;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

// ── 방문 분석 도구 ───────────────────────────────────────────────
const GA4_ID = (import.meta as { env?: Record<string, string> }).env?.VITE_GA4_ID || '';
const NAVER_ID = (import.meta as { env?: Record<string, string> }).env?.VITE_NAVER_ANALYTICS_ID || '';
let loaded = false;

type GtagFn = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: GtagFn; wcs?: { inflow?: (d: string) => void }; wcs_add?: Record<string, string>; wcs_do?: () => void }
}

/** 관리자·변호사 화면에서는 부르지 않는다(고객 사이트만) */
export function initAnalytics(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  if (/^G-[A-Z0-9]{4,20}$/.test(GA4_ID)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
    window.gtag('js', new Date());
    // 주소의 개인 식별 값(?caseLink= 등)을 보내지 않게 경로만
    window.gtag('config', GA4_ID, { page_location: `${window.location.origin}${window.location.pathname}`, anonymize_ip: true });
  }
  if (/^[a-z0-9]{6,30}$/i.test(NAVER_ID)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://wcs.naver.net/wcslog.js';
    s.onload = () => {
      window.wcs_add = window.wcs_add || {};
      window.wcs_add.wa = NAVER_ID;
      try { window.wcs?.inflow?.('mykim.kr'); window.wcs_do?.(); } catch { /* 무시 */ }
    };
    document.head.appendChild(s);
  }
}

/** 전환 단계 (입력값 없음) */
export type FunnelEvent = 'calculator_used' | 'check_started' | 'check_completed' | 'lawyer_list_viewed' | 'consult_request_sent';

export function trackEvent(name: FunnelEvent): void {
  try { window.gtag?.('event', name); } catch { /* 무시 */ }
}
