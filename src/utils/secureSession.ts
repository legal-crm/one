// ============================================================
// [SECURITY] HMAC 세션 서명 유틸리티
// Web Crypto API를 사용하여 localStorage 세션 조작을 방지합니다.
// ============================================================

// 서명 키 (빌드 시 환경변수에서 주입, 없으면 기본값 제거하고 에러 처리)
const SESSION_SECRET = import.meta.env.VITE_SESSION_SECRET;

// 환경변수 미설정 시 DEV 모드에서 경고 출력
if (!SESSION_SECRET && import.meta.env.DEV) {
  console.warn('[SECURITY] VITE_SESSION_SECRET이 설정되지 않았습니다. 보안 세션 기능이 정상 작동하지 않을 수 있습니다.');
}

/**
 * 문자열을 HMAC-SHA256으로 서명합니다.
 */
async function hmacSign(message: string): Promise<string> {
  // [SECURITY] 서명 키가 없으면 안전한 빈 문자열 또는 에러 처리를 위해 임시 키 사용(또는 거부)
  // 여기서는 세션 생성을 거부하기 위해 빈 키 사용시 예외를 발생시키거나 빈 서명을 반환하게 합니다.
  if (!SESSION_SECRET) {
    throw new Error('VITE_SESSION_SECRET is required but not configured.');
  }

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
  if (!SESSION_SECRET) {
    return '';
  }
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
