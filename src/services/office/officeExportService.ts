// ============================================================
// ST-13 사무소 데이터 내보내기 — 서버(office_data_export)가 사무소 표를 모아 주고,
// 브라우저가 암호(PBKDF2-SHA256 → AES-GCM 256)를 걸어 파일로 내려받는다.
// 암호는 서버로 보내지 않는다. 잃어버리면 파일을 열 수 없다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from './rpcResult';

export const BACKUP_KDF_ITERATIONS = 310_000;
export const MIN_BACKUP_PASSWORD = 10;

export interface EncryptedBackup {
  format: 'mykim-office-backup-encrypted';
  version: 1;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackup(plain: string, password: string, iterations = BACKUP_KDF_ITERATIONS): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  return {
    format: 'mykim-office-backup-encrypted', version: 1,
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    data: b64(ct),
  };
}

/** 암호가 틀리면 예외 (AES-GCM 인증 실패) */
export async function decryptBackup(file: EncryptedBackup, password: string): Promise<string> {
  if (file?.format !== 'mykim-office-backup-encrypted') throw new Error('마이김변 암호 백업 파일이 아니에요.');
  const key = await deriveKey(password, unb64(file.kdf.salt), file.kdf.iterations);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv) }, key, unb64(file.data));
  return new TextDecoder().decode(pt);
}

export async function fetchOfficeExport(officeId: string, encrypted: boolean): Promise<RpcResult<any>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_data_export', { p_office_id: officeId, p_encrypted: encrypted });
  if (error) return toRpcError(error);
  return { ok: true, data };
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 내려받기. password가 없으면 암호 없는 JSON (화면에서 대표 확인 후에만 부른다) */
export async function downloadOfficeExport(officeId: string, password: string | null): Promise<RpcResult<{ counts: Record<string, number>; truncated: string[] }>> {
  if (password !== null && password.length < MIN_BACKUP_PASSWORD) return { ok: false, code: 'weak_password', message: `암호는 ${MIN_BACKUP_PASSWORD}자 이상으로 정해 주세요.` };
  const r = await fetchOfficeExport(officeId, password !== null);
  if (r.ok === false) return r;
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const json = JSON.stringify(r.data);
  if (password !== null) {
    const enc = await encryptBackup(json, password);
    download(`mykim-office-backup-${day}.mykim`, JSON.stringify(enc), 'application/json');
  } else {
    download(`mykim-office-backup-${day}.json`, json, 'application/json');
  }
  return { ok: true, data: { counts: r.data?.counts || {}, truncated: r.data?.truncated || [] } };
}
