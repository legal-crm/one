// ============================================================
// CSPRNG 기반 토큰 생성 (서명 링크·초대 링크·공유 토큰 공용)
// Math.random / Date.now / ID 조합 토큰은 추측 가능하므로 사용 금지.
// ============================================================

const LOWER_ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MIXED_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function pick(alphabet: string, length: number): string {
  // 편향 없는 샘플링: alphabet 길이의 배수 미만 바이트만 채택
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    const bytes = new Uint8Array(Math.max(16, (length - out.length) * 2));
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < length; i++) {
      if (bytes[i] < limit) out += alphabet[bytes[i] % alphabet.length];
    }
  }
  return out;
}

/** 소문자 영숫자 토큰 (36^length 공간) */
export function randomToken(length: number): string {
  return pick(LOWER_ALNUM, length);
}

/** 대소문자 영숫자 토큰 (62^length 공간) */
export function randomMixedToken(length: number): string {
  return pick(MIXED_ALNUM, length);
}

/** 원격 서명 링크 토큰: sgn- + 24자 (약 124bit) */
export function newRemoteSignToken(): string {
  return `sgn-${randomToken(24)}`;
}
