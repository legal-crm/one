// ============================================================
// [SECURITY] HMAC 세션 서명 유틸리티
// Web Crypto API를 사용하여 localStorage 세션 조작을 방지합니다.
// ============================================================

// 서명 키 (빌드 시 환경변수에서 주입, 없으면 기본값)
const SESSION_SECRET = import.meta.env.VITE_SESSION_SECRET || 'mykimbyun-admin-session-2026-secure-key';

/**
 * 문자열을 HMAC-SHA256으로 서명합니다.
 */
async function hmacSign(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  // ArrayBuffer → hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC 서명을 검증합니다.
 */
async function hmacVerify(message: string, expectedSignature: string): Promise<boolean> {
  const actualSignature = await hmacSign(message);
  return actualSignature === expectedSignature;
}

// ============================================================
// 세션 토큰 생성/검증 (외부 API)
// ============================================================

export interface SecureSession {
  timestamp: number;
  signature: string;
}

/**
 * 서명된 세션 토큰을 생성합니다.
 */
export async function createSecureSession(): Promise<string> {
  const timestamp = Date.now();
  const signature = await hmacSign(String(timestamp));
  const session: SecureSession = { timestamp, signature };
  return JSON.stringify(session);
}

/**
 * 세션 토큰의 서명을 검증하고 만료 여부를 확인합니다.
 * @param sessionData - localStorage에서 읽은 세션 문자열
 * @param timeoutMs - 세션 만료 시간 (밀리초)
 * @returns true면 유효한 세션
 */
export async function verifySecureSession(
  sessionData: string | null,
  timeoutMs: number
): Promise<boolean> {
  if (!sessionData) return false;

  try {
    const session: SecureSession = JSON.parse(sessionData);

    // 필수 필드 확인
    if (!session.timestamp || !session.signature) return false;

    // 만료 확인
    if (Date.now() - session.timestamp > timeoutMs) return false;

    // HMAC 서명 검증 — 조작 감지
    const isValid = await hmacVerify(String(session.timestamp), session.signature);
    return isValid;
  } catch {
    // 레거시 데이터 또는 조작된 데이터
    return false;
  }
}

/**
 * 세션 타임스탬프를 갱신합니다 (활동 시 호출).
 */
export async function refreshSecureSession(): Promise<string> {
  return createSecureSession();
}
