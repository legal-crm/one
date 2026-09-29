/**
 * [PART 4] 클라이언트 "필드 암호화" 제거 — 레거시 암호문 판별만 남긴다.
 *
 * 이전 동작 (보호 효과 없음):
 * - consult_requests.financial_profile, consult_messages.message를 브라우저에서 AES-GCM으로 암호화해 저장했다.
 * - 키는 VITE_SESSION_SECRET(번들에 그대로 포함) 또는 코드 고정값이라 번들을 가진 누구나 복호화할 수 있었다.
 * - 환경변수가 없으면 탭마다 임의 키를 만들어, 담당 변호사를 포함해 아무도 읽지 못하는 데이터가 생겼다.
 *
 * 현재:
 * - 새 데이터는 평문으로 저장한다. 보호는 Supabase RLS(012: 당사자만 조회), 전송 구간 TLS, DB 저장 암호화가 맡는다.
 * - 브라우저 번들에는 어떤 키도 두지 않는다. 기존 암호문은 서버 전용 일회성 스크립트
 *   (supabase/scripts/decrypt-legacy-consult-fields.mjs)로 평문으로 되돌린다.
 * - 스크립트 실행 전 남아 있는 암호문은 화면에 안내 문구로 표시하고, 덮어쓰지 않도록 저장 대상에서 제외한다.
 */

export const LEGACY_ENCRYPTED_MESSAGE_PLACEHOLDER =
  '🔒 이전 방식으로 저장된 메시지입니다. 관리자 데이터 이관 후 표시됩니다.';

const ENC_STR_PREFIX = '__enc_str_v1__:';

/** financial_profile 등 JSONB 레거시 암호문 래퍼인지 */
export function isLegacyEncryptedField(value: unknown): boolean {
  return !!value && typeof value === 'object'
    && (value as any).__enc === 'v1'
    && typeof (value as any).iv === 'string'
    && typeof (value as any).data === 'string';
}

/** consult_messages.message 레거시 암호문인지 */
export function isLegacyEncryptedString(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENC_STR_PREFIX);
}
