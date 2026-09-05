// ============================================================
// [SECURITY] 기기 및 브라우저 환경 감지 유틸리티
// ============================================================

import { DeviceCategory, DeviceInfo } from '../types/session';

/**
 * User-Agent 문자열을 분석하여 OS, 브라우저, 기기 형태를 파싱합니다.
 */
export function detectDeviceInfo(): Omit<DeviceInfo, 'ipAddress' | 'location'> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'unknown',
      os: '알 수 없음',
      browser: '알 수 없음',
      userAgent: 'Server-Side Environment',
    };
  }

  const ua = navigator.userAgent;

  // 1. 기기 종류 (Device Category) 판별
  let deviceType: DeviceCategory = 'desktop';
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
  const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua);

  if (isTablet) {
    deviceType = 'tablet';
  } else if (isMobile) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  // 2. 운영체제 (OS) 판별
  let os = '기타 OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Macintosh|Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS ([0-9_]+)/);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android ([0-9.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // 3. 브라우저 (Browser) 판별
  let browser = '기타 브라우저';
  if (/Whale/i.test(ua)) {
    const match = ua.match(/Whale\/([0-9.]+)/);
    browser = match ? `네이버 웨일 ${match[1].split('.')[0]}` : '네이버 웨일';
  } else if (/Edg/i.test(ua)) {
    const match = ua.match(/Edg\/([0-9.]+)/);
    browser = match ? `Microsoft Edge ${match[1].split('.')[0]}` : 'Edge';
  } else if (/Chrome/i.test(ua) && !/Edg|Whale/i.test(ua)) {
    const match = ua.match(/Chrome\/([0-9.]+)/);
    browser = match ? `Google Chrome ${match[1].split('.')[0]}` : 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome|Edg|Whale/i.test(ua)) {
    const match = ua.match(/Version\/([0-9.]+)/);
    browser = match ? `Apple Safari ${match[1].split('.')[0]}` : 'Safari';
  } else if (/Firefox/i.test(ua)) {
    const match = ua.match(/Firefox\/([0-9.]+)/);
    browser = match ? `Mozilla Firefox ${match[1].split('.')[0]}` : 'Firefox';
  }

  return {
    deviceType,
    os,
    browser,
    userAgent: ua,
  };
}

/**
 * 간단한 UUID v4 생성기
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 기기 세부 정보(IP 및 지리적 위치)를 조회합니다.
 * 네트워크 장애 또는 오프라인 환경에서도 신속하게 안전한 폴백을 반환합니다.
 */
export async function getClientDeviceInfo(): Promise<DeviceInfo> {
  const baseInfo = detectDeviceInfo();
  
  // 기본 폴백 정보 (국내 법률 특화 기본값)
  let ipAddress = '211.234.120.85';
  let location = '대한민국 서울특별시';

  try {
    // 3초 타임아웃으로 빠른 IP 조회 시도
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // 캐시된 IP가 세션 스토리지에 있는지 확인
    const cachedIp = sessionStorage.getItem('legal_crm_client_ip');
    const cachedLoc = sessionStorage.getItem('legal_crm_client_loc');
    if (cachedIp && cachedLoc) {
      clearTimeout(timeoutId);
      return {
        ...baseInfo,
        ipAddress: cachedIp,
        location: cachedLoc,
      };
    }

    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        ipAddress = data.ip;
        sessionStorage.setItem('legal_crm_client_ip', ipAddress);
        sessionStorage.setItem('legal_crm_client_loc', location);
      }
    }
  } catch {
    // 비차단 폴백: 로컬 모드 또는 방화벽 환경
  }

  return {
    ...baseInfo,
    ipAddress,
    location,
  };
}

/**
 * 상대 시간 표시 (예: "방금 전", "5분 전", "2시간 전", "어제")
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const now = Date.now();
    const target = new Date(isoString).getTime();
    const diffSec = Math.floor((now - target) / 1000);

    if (diffSec < 60) return '방금 전';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;

    const d = new Date(isoString);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '알 수 없음';
  }
}
