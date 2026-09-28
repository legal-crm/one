/**
 * 의뢰인 공동인증서(NPKI) 및 금융인증서 보관함(Certificate Vault) 코어 서비스
 *
 * 실제 보안 수준 (과장 금지 — 이전 주석의 "E2EE / Zero-Knowledge"는 사실이 아님):
 * - 비밀번호만 Web Crypto AES-GCM으로 암호화. 키는 앱 번들에 내장된 고정 시드(FALLBACK_KEY_SEED)에서
 *   파생되므로 번들을 보유한 누구나 복호화 가능 → 서버 KMS/사용자별 키로 전환 전까지 출시 차단 항목.
 * - signPri.key / signCert.der 파일은 Base64 원문 그대로 localStorage에 저장 (암호화 안 됨).
 * - 보관 위치는 현재 브라우저(localStorage)뿐. crmService가 Supabase 저장 전 제거하므로 기기 간 공유되지 않음.
 * - 감사 로그도 같은 localStorage 레코드에 있으므로 위변조 방지·영구 보존이 아님.
 * - 클립보드 30초 소거는 브라우저 권한/포커스에 따라 실패할 수 있음 (결과를 onZeroized로 전달).
 * - 파기는 이 브라우저의 사본만 비움. 내려받은 파일·다른 기기 사본은 남음.
 */

import type { 
  CertificateVaultData, 
  CertificateAccessLog, 
  NpkiCertificateMeta, 
  FinancialCertMeta,
  CertVaultStatus 
} from '../../types';

const VAULT_STORAGE_KEY_PREFIX = 'legal_crm_cert_vault_';

// ── 내부 암호화 키 파생 설정 ──
const ENVELOPE_SALT = new TextEncoder().encode('LEGAL_CRM_CERT_VAULT_SALT_v1_2026');
const FALLBACK_KEY_SEED = 'LEGAL_STEALTH_SECURE_VAULT_KEY_MATERIAL_KR';

/**
 * Web Crypto API를 사용한 AES-GCM 대칭키 획득
 */
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(FALLBACK_KEY_SEED),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENVELOPE_SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 인증서 비밀번호 AES-GCM-256 암호화
 */
export async function encryptCertPassword(plainPassword: string): Promise<{ encryptedPassword: string; iv: string }> {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plainPassword);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return {
      encryptedPassword: encryptedBase64,
      iv: ivBase64
    };
  } catch (err) {
    console.error('Password encryption failed:', err);
    throw new Error('인증서 비밀번호 암호화에 실패했습니다.');
  }
}

/**
 * 암호화된 인증서 비밀번호 AES-GCM-256 복호화
 */
export async function decryptCertPassword(encryptedBase64: string, ivBase64: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Password decryption failed:', err);
    throw new Error('인증서 비밀번호 복호화에 실패했습니다. 키가 일치하지 않거나 훼손되었습니다.');
  }
}

/**
 * 파일을 Base64 문자열로 변환
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Base64 데이터를 Blob으로 다운로드
 */
export function downloadBase64File(base64: string, filename: string, mimeType: string = 'application/octet-stream'): void {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * DER 바이너리/Base64에서 공동인증서 메타데이터 유추/파싱
 */
export function inspectDerCertificate(derBase64: string, defaultClientName: string = '의뢰인'): {
  subjectName: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  isExpired: boolean;
  serialNumber?: string;
  /** DER에서 유효기간을 실제로 읽었는지 여부 (false면 만료일 확인 불가) */
  validityParsed: boolean;
} {
  let issuer = '발급기관 확인 불가';
  const subjectName = defaultClientName;
  let validFrom = '';
  let validTo = '';
  let serialNumber: string | undefined;
  let validityParsed = false;

  try {
    const binary = atob(derBase64);
    if (binary.includes('yessign')) issuer = '금융결제원 (yessign)';
    else if (binary.includes('CrossCert')) issuer = '한국전자인증 (CrossCert)';
    else if (binary.includes('SignKorea')) issuer = '코스콤 (SignKorea)';
    else if (binary.includes('KICA')) issuer = '한국정보인증 (KICA)';
    else if (binary.includes('TradeSign')) issuer = '한국무역정보통신 (TradeSign)';

    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    // X.509 tbsCertificate: [0] version(A0 03 02 01 0x) 다음 INTEGER가 일련번호
    for (let i = 0; i < Math.min(bytes.length - 6, 64); i++) {
      if (bytes[i] === 0xa0 && bytes[i + 1] === 0x03 && bytes[i + 2] === 0x02 && bytes[i + 3] === 0x01 && bytes[i + 5] === 0x02) {
        const len = bytes[i + 6];
        if (len > 0 && len <= 32) {
          serialNumber = Array.from(bytes.slice(i + 7, i + 7 + len)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        break;
      }
    }
    // 유효기간(Validity): 처음 등장하는 UTCTime(0x17)/GeneralizedTime(0x18) 두 개 = notBefore, notAfter
    const times: Date[] = [];
    for (let i = 0; i < bytes.length - 2 && times.length < 2; i++) {
      const tag = bytes[i];
      const len = bytes[i + 1];
      if ((tag === 0x17 && len === 13) || (tag === 0x18 && len === 15)) {
        const s = String.fromCharCode(...bytes.slice(i + 2, i + 2 + len));
        const m = tag === 0x17
          ? s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/)
          : s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
        if (m) {
          let year = parseInt(m[1], 10);
          if (tag === 0x17) year += year < 50 ? 2000 : 1900;
          times.push(new Date(Date.UTC(year, parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10))));
          i += 1 + len;
        }
      }
    }
    if (times.length === 2) {
      validFrom = times[0].toISOString();
      validTo = times[1].toISOString();
      validityParsed = true;
    }
  } catch {
    // 파싱 실패 → 확인 불가로 표시 (임의 만료일을 만들지 않음)
  }

  const now = Date.now();
  const daysRemaining = validityParsed
    ? Math.ceil((new Date(validTo).getTime() - now) / 86400000)
    : 0;

  return {
    subjectName,
    issuer,
    validFrom,
    validTo,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired: validityParsed && daysRemaining <= 0,
    serialNumber,
    validityParsed,
  };
}

/**
 * 만료일(ISO)까지 남은 일수를 "오늘(로컬 자정)" 기준 달력 일수로 재계산한다.
 * 업로드 시점에 저장된 daysRemaining은 시간이 지나도 갱신되지 않으므로 표시할 때마다 이 함수를 쓴다.
 * @returns 남은 일수(만료 시 0 이하), 만료일을 알 수 없으면 null
 */
export function computeDaysRemaining(validTo: string | undefined | null, now: Date = new Date()): number | null {
  if (!validTo) return null;
  const end = new Date(validTo);
  if (isNaN(end.getTime())) return null;
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((endLocal.getTime() - todayLocal.getTime()) / 86400000);
}

/** 배지용 D-day 문자열: 'D-12' | '만료' | '만료일 미확인' */
export function formatVaultDday(validTo: string | undefined | null, now: Date = new Date()): string {
  const d = computeDaysRemaining(validTo, now);
  if (d === null) return '만료일 미확인';
  return d <= 0 ? '만료' : `D-${d}`;
}

/** ISO 일시를 로컬 날짜(YYYY-MM-DD)로 표시. 값이 없거나 잘못되면 '확인 불가' */
export function formatLocalDate(iso: string | undefined | null): string {
  if (!iso) return '확인 불가';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '확인 불가';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 30초 자동 소거 클립보드 복사 (Zeroize)
 * - onCopied(ok): 최초 복사 성공 여부
 * - onZeroized(ok): 소거(빈 문자열 덮어쓰기) 성공 여부. 실패 시 사용자에게 수동 삭제를 안내해야 한다.
 * @returns 취소 함수. clearNow=true면 타이머를 멈추고 즉시 소거를 시도한다 (언마운트 시 사용).
 */
export function copyWithAutoZeroize(
  text: string,
  durationSeconds: number = 30,
  onProgress?: (remainingSec: number) => void,
  onZeroized?: (ok: boolean) => void,
  onCopied?: (ok: boolean) => void
): (clearNow?: boolean) => void {
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  const clearClipboard = async (): Promise<boolean> => {
    if (!clip) return false;
    try { await clip.writeText(''); return true; } catch { return false; }
  };

  if (!clip) {
    if (onCopied) onCopied(false);
  } else {
    clip.writeText(text).then(
      () => { if (onCopied) onCopied(true); },
      (err) => { console.warn('Clipboard write error:', err); if (onCopied) onCopied(false); }
    );
  }

  let remaining = durationSeconds;
  let done = false;
  if (onProgress) onProgress(remaining);

  const intervalId = setInterval(() => {
    remaining -= 1;
    if (onProgress) onProgress(remaining);

    if (remaining <= 0) {
      clearInterval(intervalId);
      done = true;
      clearClipboard().then((ok) => { if (onZeroized) onZeroized(ok); });
    }
  }, 1000);

  return (clearNow?: boolean) => {
    clearInterval(intervalId);
    if (clearNow && !done) {
      done = true;
      // 언마운트 경로: 결과 콜백은 호출하지 않음 (컴포넌트가 이미 사라짐)
      void clearClipboard();
    }
  };
}

/**
 * 감사 로그 항목 생성
 */
export function createAccessLog(
  actorName: string,
  actorRole: string,
  targetItem: CertificateAccessLog['targetItem'],
  purpose: string
): CertificateAccessLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorName,
    actorRole,
    targetItem,
    purpose,
    // 브라우저에서는 실제 접속 IP를 알 수 없으므로 임의 값을 기록하지 않는다 (서버 로그에서 확인)
    ipAddress: undefined,
    device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'Browser'
  };
}

/**
 * 인증서 사본 삭제 (이 브라우저의 localStorage 레코드에서 파일·암호문을 비움)
 * 주의: 내려받은 파일, 다른 기기/브라우저의 사본, 백업은 삭제되지 않는다.
 */
export function shredCertificateVault(
  vault: CertificateVaultData,
  actorName: string,
  reason: string = '사건 종결/면책 확정에 따른 개인정보 파기'
): CertificateVaultData {
  const log = createAccessLog(actorName, '담당자', 'auto_shred', `이 브라우저 사본 삭제: ${reason}`);
  
  return {
    ...vault,
    status: 'shredded',
    shreddedAt: new Date().toISOString(),
    shreddedBy: actorName,
    npki: vault.npki ? {
      ...vault.npki,
      derBase64: '',
      keyBase64: '',
      encryptedPassword: '',
      iv: '',
      isExpired: true,
      daysRemaining: 0,
    } : undefined,
    financial: vault.financial ? {
      ...vault.financial,
      registered: false,
      relayStatus: 'idle',
      lastRelayNumber: undefined,
    } : undefined,
    accessLogs: [log, ...vault.accessLogs]
  };
}

/**
 * 금융인증서 원격 승인 "안내 문구" 생성
 * (이전: simulateFinancialRelayRequest — Math.random으로 2자리 번호를 지어내고 '발송'으로 기록.
 *  실제 승인번호는 발급기관 사이트 화면에만 표시되며, 이 앱은 금융결제원과 연동되어 있지 않다.)
 */
export function buildFinancialRelayGuide(clientName: string, creditorName: string): string {
  return `[${clientName || '의뢰인'}님] ${creditorName} 부채증명서 발급을 위해 금융인증서 로그인 승인이 필요합니다. `
    + `곧 휴대폰 금융인증서 앱(또는 은행 앱)에 인증 요청이 표시되면, 담당자가 전화로 알려드리는 번호와 같은지 확인한 뒤 승인해 주세요. `
    + `번호가 다르거나 요청하지 않은 인증이면 승인하지 마시고 사무실로 연락해 주세요.`;
}

/** 금융인증서 원격 승인 안내를 전달했다는 사실만 기록 (번호·발송 여부를 지어내지 않음) */
export function recordFinancialRelayGuide(
  vault: CertificateVaultData,
  actorName: string,
  actorRole: string,
  creditorName: string
): CertificateVaultData {
  const log = createAccessLog(
    actorName,
    actorRole,
    'relay_request',
    `[${creditorName}] 금융인증서 원격 승인 안내 문구 복사 (자동 발송 아님)`
  );
  return {
    ...vault,
    financial: vault.financial ? {
      ...vault.financial,
      lastRelayRequestAt: new Date().toISOString(),
      lastRelayNumber: undefined,
    } : undefined,
    accessLogs: [log, ...vault.accessLogs]
  };
}

/**
 * 로컬 스토리지 로드
 */
export function loadCertificateVault(clientId: string): CertificateVaultData | null {
  try {
    const raw = localStorage.getItem(`${VAULT_STORAGE_KEY_PREFIX}${clientId}`);
    if (!raw) return null;
    const parsed: CertificateVaultData = JSON.parse(raw);
    // 과거 버전이 자동 생성한 가짜 시연 금고(MOCK_ 인증서) 폐기
    if (parsed?.npki?.derBase64?.includes('MOCK_') || parsed?.npki?.keyBase64?.includes('MOCK_')) {
      localStorage.removeItem(`${VAULT_STORAGE_KEY_PREFIX}${clientId}`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load certificate vault:', err);
    return null;
  }
}

/**
 * 로컬 스토리지 저장
 */
export function saveCertificateVault(vault: CertificateVaultData): void {
  try {
    localStorage.setItem(`${VAULT_STORAGE_KEY_PREFIX}${vault.clientId}`, JSON.stringify(vault));
  } catch (err) {
    console.error('Failed to save certificate vault:', err);
  }
}

// (삭제됨) generateSeedVaultData: 가짜 인증서, 동의 서명, 가상 인물 열람 기록을 만들던 시연용 생성기. 호출처 없이 운영 번들에 포함되어 제거.
