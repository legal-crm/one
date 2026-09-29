// ============================================================
// 관리자 화면용 개인정보 마스킹 (PART 3-3)
// 이전: /(\d{3})-(\d{3,4})-(\d{4})/ 형식만 가려서 '01012345678'·'+82 10 …'은 전체가 노출됐고,
//       의뢰인 실명은 그대로 표시·검색됐다.
// ============================================================

/** 전화번호: 숫자만 추려 앞 3자리·뒤 4자리만 남김 (형식 무관) */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '-';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 이름: "실명_가명" 형식이면 가명만, 아니면 첫 글자와 마지막 글자만 남김 (김*수, 이*) */
export function maskPersonName(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return '익명';
  if (raw.includes('_')) {
    const alias = raw.split('_').slice(1).join('_').trim();
    if (alias) return alias;
  }
  const chars = Array.from(raw);
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** 이메일: 앞 3자만 남김 */
export function maskEmailAddress(email?: string | null): string {
  if (!email) return '-';
  const [name, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${name.slice(0, Math.min(3, name.length))}****@${domain}`;
}
