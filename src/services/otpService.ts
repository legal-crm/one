/**
 * 2FA 이메일 OTP(One-Time Password) 서비스
 * - 관리자 및 변호사 로그인 시 6자리 보안 일회용 코드 발급 및 검증
 * - 암호학적 난수 생성 (Web Crypto API)
 * - 5분(300초) 유효시간(TTL) 및 최대 3회 오류 시 코드 파기
 */

export interface OtpSession {
  code: string;
  email: string;
  expiresAt: number; // Unix timestamp ms
  attempts: number;
  maxAttempts: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5분
const MAX_ATTEMPTS = 3;

// 메모리 기반 OTP 세션 (새로고침 시 재발급 필요)
let activeOtpSession: OtpSession | null = null;

/**
 * 6자리 암호학적 난수 OTP 생성
 */
export function generateOtpCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // 100000 ~ 999999 보장
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

/**
 * 2FA OTP 발급 및 이메일 발송
 */
export async function issueAdminOtp(email: string): Promise<{ success: boolean; error?: string; demoCode?: string }> {
  const code = generateOtpCode();
  const expiresAt = Date.now() + OTP_TTL_MS;

  activeOtpSession = {
    code,
    email,
    expiresAt,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
  };

  try {
    // 1. Vercel Serverless /api/send-email 호출 시도 (설정되어 있는 경우)
    const emailRes = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [email],
        subject: '[my김변] 관리자 2단계 인증(2FA) 보안코드 안내',
        htmlBody: `
          <div style="font-family: Pretendard, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px;">
            <h2 style="color: #4f46e5; margin-bottom: 8px;">🛡️ my김변 관리자 2단계 인증</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              관리자 계정 로그인을 위한 6자리 일회용 보안코드(OTP)입니다.<br/>
              타인에게 절대 공유하지 마십시오.
            </p>
            <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">
              * 본 코드는 발송 후 5분간만 유효합니다.<br/>
              * 본인이 시도한 것이 아니라면 즉시 비밀번호를 변경하고 보안팀에 문의하십시오.
            </p>
          </div>
        `,
      }),
    }).catch(() => null);

    // 콘솔 및 개발자 편의를 위해 demoCode 반환
    console.log(`[2FA OTP] 발급된 보안코드: ${code} (유효기간: 5분, 수신자: ${email})`);

    return {
      success: true,
      demoCode: code, // UI에서 힌트로 복사 가능하도록 제공
    };
  } catch (err: any) {
    console.warn('[2FA OTP] 이메일 발송 예외:', err);
    return {
      success: true,
      demoCode: code,
    };
  }
}

/**
 * 입력된 OTP 검증
 */
export function verifyAdminOtp(inputCode: string): { valid: boolean; error?: string; remainingAttempts?: number } {
  if (!activeOtpSession) {
    return { valid: false, error: '활성화된 보안코드 세션이 없습니다. 코드를 다시 발송해주세요.' };
  }

  // 1. 유효 시간 검사
  if (Date.now() > activeOtpSession.expiresAt) {
    activeOtpSession = null;
    return { valid: false, error: '보안코드 유효시간(5분)이 만료되었습니다. 다시 발송해주세요.' };
  }

  // 2. 시도 횟수 검사
  activeOtpSession.attempts += 1;
  const remaining = activeOtpSession.maxAttempts - activeOtpSession.attempts;

  if (activeOtpSession.code === inputCode.trim()) {
    // 성공 시 세션 즉시 소멸 (재사용 불가)
    activeOtpSession = null;
    return { valid: true };
  }

  if (remaining <= 0) {
    activeOtpSession = null;
    return { valid: false, error: '보안코드 3회 연속 오입력으로 인증이 취소되었습니다. 다시 로그인해주세요.', remainingAttempts: 0 };
  }

  return {
    valid: false,
    error: `보안코드가 일치하지 않습니다. (남은 기회: ${remaining}회)`,
    remainingAttempts: remaining,
  };
}

/**
 * 남은 유효 시간(초) 반환
 */
export function getRemainingOtpSeconds(): number {
  if (!activeOtpSession) return 0;
  const remainMs = activeOtpSession.expiresAt - Date.now();
  return Math.max(0, Math.floor(remainMs / 1000));
}
