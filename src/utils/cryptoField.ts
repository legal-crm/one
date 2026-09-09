// src/utils/cryptoField.ts
// ============================================================
// [SECURITY At-Rest Encryption] DB 필드 레벨 암호화 유틸리티
// Web Crypto API (AES-256-GCM)를 사용하여 DB 내 민감 정보(채무, 자산 등)를 암호화합니다.
// ============================================================

const SECRET_KEY_STR = import.meta.env.VITE_SESSION_SECRET || 'mykim-legal-crm-default-vault-key-2026';

let cachedCryptoKey: CryptoKey | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const encoder = new TextEncoder();
  const rawKey = encoder.encode(SECRET_KEY_STR);

  // SHA-256을 통해 항상 256비트 AES 키 생성
  const hash = await crypto.subtle.digest('SHA-256', rawKey);
  cachedCryptoKey = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedCryptoKey;
}

export interface EncryptedFieldWrapper {
  __enc: 'v1';
  iv: string;
  data: string;
}

/**
 * 객체나 데이터를 AES-256-GCM으로 암호화하여 DB 저장용 JSONB 래퍼를 반환합니다.
 */
export async function encryptField<T>(payload: T): Promise<EncryptedFieldWrapper | T> {
  if (!payload || typeof payload !== 'object') return payload;

  try {
    const key = await getMasterKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const jsonStr = JSON.stringify(payload);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(jsonStr)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const dataHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      __enc: 'v1',
      iv: ivHex,
      data: dataHex,
    };
  } catch (err) {
    console.error('[SECURITY] 필드 암호화 실패 (폴백 유지):', err);
    return payload;
  }
}

/**
 * DB에서 읽어온 필드가 암호화 래퍼(__enc === 'v1')인 경우 복호화하고,
 * 기존 레거시 평문 데이터인 경우 그대로 반환하여 100% 하위 호환성을 보장합니다.
 */
export async function decryptField<T>(value: any): Promise<T> {
  if (!value || typeof value !== 'object') return value as T;

  // 이미 평문이거나 암호화 래퍼가 아닌 경우 즉시 반환
  if (value.__enc !== 'v1' || !value.iv || !value.data) {
    return value as T;
  }

  try {
    const key = await getMasterKey();
    const ivBytes = new Uint8Array(value.iv.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
    const dataBytes = new Uint8Array(value.data.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      dataBytes
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch (err) {
    console.error('[SECURITY] 필드 복호화 실패:', err);
    return value as T;
  }
}
