import type { MouseEvent } from 'react';

/**
 * 고객 사이트 탭(화면) 정의와 명칭 사전
 * - 탭 ID 목록은 여기 한 곳에서 관리한다(URL ?tab=, 뒤로 가기, 알림 링크, 404 판정 공용).
 * - 메뉴·버튼·페이지 제목은 CLIENT_TAB_LABELS의 이름을 그대로 쓴다(같은 화면을 다른 이름으로 부르지 않기).
 */
export const CLIENT_TABS = [
  'landing',
  'request',
  'lawyers',
  'chat',
  'calculator',
  'reviews',
  'qna',
  'mypage',
  'news',
  'notices',
  'inquiry',
  'guide',
  'companion',
  'company',
] as const;

export type ClientTab = (typeof CLIENT_TABS)[number];

export function isClientTab(value: unknown): value is ClientTab {
  return typeof value === 'string' && (CLIENT_TABS as readonly string[]).includes(value);
}

/** 클린 URL 경로 → 탭 (정적 안내 페이지에서 앱으로 들어오는 경우) */
export const CLIENT_PATH_TAB_MAP: Record<string, ClientTab> = {
  '/check': 'request',
  '/lawyers': 'lawyers',
  '/reviews': 'reviews',
  '/qna': 'qna',
  '/news': 'news',
  '/companion': 'companion',
  '/company': 'company',
};

/** 명칭 사전 */
export const CLIENT_TAB_LABELS: Record<ClientTab, string> = {
  landing: '홈',
  request: '내 상황 체크하기',
  lawyers: '변호사 찾기',
  chat: '내 관리방',
  calculator: '변제금 계산기',
  reviews: '이용 후기',
  qna: '상담 사례',
  mypage: '마이페이지',
  news: '법률 정보',
  notices: '공지사항',
  inquiry: '1:1 문의',
  guide: '이용안내',
  companion: '회생동행',
  company: '회사 소개',
};

/** 마이페이지 안의 영역 */
export type MyPageSection = 'companion' | 'diagnosis' | 'settings';

/**
 * 이동 대상 정규화.
 * 알림 linkTab·안내 페이지 CTA·구버전 값('diagnosis', 'fees' 등)을 실제 탭 또는 '체크 시작' 동작으로 바꾼다.
 */
export type ClientNavTarget =
  | { kind: 'tab'; tab: ClientTab; mypageSection?: MyPageSection }
  | { kind: 'start-check' };

export function resolveClientNavTarget(raw: string | null | undefined): ClientNavTarget {
  switch (raw) {
    case 'request':
    case 'diagnosis':
    case 'check':
      return { kind: 'start-check' };
    case 'fees':
      return { kind: 'tab', tab: 'mypage', mypageSection: 'diagnosis' };
    case 'settings':
      return { kind: 'tab', tab: 'mypage', mypageSection: 'settings' };
    case 'home':
      return { kind: 'tab', tab: 'landing' };
    default:
      return isClientTab(raw) ? { kind: 'tab', tab: raw } : { kind: 'tab', tab: 'landing' };
  }
}

/** URL(경로·?tab=)에서 첫 화면 탭을 읽는다 */
export function readInitialClientTab(): ClientTab {
  if (typeof window === 'undefined') return 'landing';
  const mapped = CLIENT_PATH_TAB_MAP[window.location.pathname];
  if (mapped) return mapped;
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  return isClientTab(tabParam) ? tabParam : 'landing';
}

/**
 * 모바일 하단 GNB 높이만큼 비워 두는 여백(safe-area 포함). md 이상은 GNB가 없다.
 * GNB 높이(3.75rem)를 바꾸면 MobileGNB.tsx도 같이 바꾼다.
 */
export const MOBILE_GNB_SPACER = 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0';

/** 탭 링크 주소 (새 탭 열기·주소 복사가 되도록 실제 href를 둔다) */
export function clientTabHref(tab: ClientTab): string {
  return `?tab=${tab}`;
}

/**
 * <a href>를 앱 안 이동으로 처리한다.
 * Ctrl/⌘/Shift 클릭·가운데 클릭은 브라우저 기본 동작(새 탭 등)에 맡긴다.
 */
export function handleSpaLinkClick(e: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  action();
}
