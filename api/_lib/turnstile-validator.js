// api/_lib/turnstile-validator.js
// Cloudflare Turnstile (무인증 스마트 봇 방어) 서버 사이드 토큰 검증기

const CLOUDFLARE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare 공식 상시 통과 테스트 시크릿 키 (운영 환경변수 미설정 시 개발/테스트용)
const DUMMY_SECRET_KEY = '1x0000000000000000000000000000000AA';

/**
 * 프론트엔드에서 전달받은 Turnstile 토큰의 진위를 검증합니다.
 * @param {string} token - 클라이언트가 발급받은 cf-turnstile-response 토큰
 * @param {string} remoteIp - 클라이언트 IP (선택 사항)
 * @param {{ allowFallbackWhenMissingKey?: boolean }} [options] - 키 미설정 시 안전 폴백 허용 (비유료/IP제한 엔드포인트 전용)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyTurnstileToken(token, remoteIp = '', options = {}) {
  const isDev = process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production';

  // 로컬 개발 환경에서만 모의 바이패스 토큰 허용
  if (isDev && (token === 'mock_turnstile_pass' || token === 'test-bypass')) {
    console.warn('[SECURITY Turnstile] Mock bypass used (dev mode).');
    return { success: true };
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY || (isDev ? DUMMY_SECRET_KEY : '');
  if (!secretKey) {
    // 시크릿 키가 미구성된 경우에만 안전 폴백 옵션 허용 (운영에서 키가 있으면 mock/빈 토큰 엄격 거부)
    if (options.allowFallbackWhenMissingKey) {
      console.warn('[SECURITY Turnstile] TURNSTILE_SECRET_KEY is not configured. Permitting request under fallback mode (rate-limited).');
      return { success: true };
    }
    console.error('[SECURITY Turnstile] TURNSTILE_SECRET_KEY is not configured in production.');
    return { success: false, error: '보안 인증 서비스 설정이 구성되지 않았습니다.' };
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false, error: '봇 방지 인증(CAPTCHA) 토큰이 누락되었습니다.' };
  }

  // 운영 환경에서 시크릿 키가 구성된 경우 mock 바이패스 토큰 명시적 거부
  if (token === 'mock_turnstile_pass' || token === 'test-bypass') {
    return { success: false, error: '유효하지 않은 보안 인증 토큰입니다.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch(CLOUDFLARE_SITEVERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(6000),
    });

    const data = await res.json();

    if (data.success) {
      return { success: true };
    }

    const errorCodes = data['error-codes'] ? data['error-codes'].join(', ') : '인증 실패';
    console.warn(`[Turnstile] Validation failed: ${errorCodes}`);
    return { success: false, error: `비정상적인 접속 환경이 감지되었습니다. (${errorCodes})` };
  } catch (err) {
    console.error('[Turnstile] Server verification exception:', err);
    // 검증 서버 통신 장애 시 개발 환경에서만 안전 통과
    if (isDev && !process.env.TURNSTILE_SECRET_KEY) {
      return { success: true };
    }
    return { success: false, error: '보안 인증 서버 연결에 실패했습니다.' };
  }
}
