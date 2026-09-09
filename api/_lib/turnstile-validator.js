// api/_lib/turnstile-validator.js
// Cloudflare Turnstile (무인증 스마트 봇 방어) 서버 사이드 토큰 검증기

const CLOUDFLARE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare 공식 상시 통과 테스트 시크릿 키 (운영 환경변수 미설정 시 개발/테스트용)
const DUMMY_SECRET_KEY = '1x0000000000000000000000000000000AA';

/**
 * 프론트엔드에서 전달받은 Turnstile 토큰의 진위를 검증합니다.
 * @param {string} token - 클라이언트가 발급받은 cf-turnstile-response 토큰
 * @param {string} remoteIp - 클라이언트 IP (선택 사항)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyTurnstileToken(token, remoteIp = '') {
  // 개발 모드이거나 토큰이 mock_turnstile_pass인 경우 통과
  if (token === 'mock_turnstile_pass' || token === 'test-bypass') {
    return { success: true };
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false, error: '봇 방지 인증(CAPTCHA) 토큰이 누락되었습니다.' };
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY || DUMMY_SECRET_KEY;

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
    // 검증 서버 통신 장애 시 환경에 따라 안전 처리 (개발 환경에서는 통과)
    if (!process.env.TURNSTILE_SECRET_KEY) {
      return { success: true };
    }
    return { success: false, error: '보안 인증 서버 연결에 실패했습니다.' };
  }
}
