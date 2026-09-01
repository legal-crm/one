import { CourtRegionMapItem } from './types';

/**
 * Formats a number (KRW won) into a Korean string format (e.g., 1억 2,500만원)
 * Requirement: All output must be in Man-won units if possible.
 */
export const formatKoreanCurrency = (amount: number): string => {
  if (amount === 0) return "0원";
  
  const absAmount = Math.abs(amount);
  const eok = Math.floor(absAmount / 100000000);
  const remainderAfterEok = absAmount % 100000000;
  
  const manPart = Math.floor(remainderAfterEok / 10000);
  
  let result = "";
  if (eok > 0) {
    result += `${eok}억 `;
  }
  
  if (manPart > 0) {
    result += `${manPart.toLocaleString()}만원`;
  } else if (eok === 0) {
    // If less than 10,000 won, just show won
    return `${amount.toLocaleString()}원`;
  }
  
  return result.trim();
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error': return 'bg-red-50 text-red-700 border-red-200';
    case 'warn': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'info': default: return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

export const getModeBadgeColor = (mode: string) => {
  if (mode.includes('연장')) return 'bg-indigo-100 text-indigo-800';
  if (mode.includes('감액')) return 'bg-orange-100 text-orange-800';
  if (mode.includes('조율')) return 'bg-green-100 text-green-800';
  if (mode.includes('불가')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
};

export const calculateManAge = (birthDateStr: string, atDateStr?: string): number => {
  if (!birthDateStr || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(birthDateStr)) return 0;
  const birth = new Date(birthDateStr);
  const today = atDateStr ? new Date(atDateStr) : new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const detectJurisdiction = (address: string, map: CourtRegionMapItem[] | undefined) => {
  if (!address || !map || map.length === 0) return { court: '기타지방법원', region: 'Others' as const };
  
  const sortedMap = [...map].sort((a, b) => b.keyword.length - a.keyword.length);

  for (const item of sortedMap) {
    if (address.includes(item.keyword)) {
      return { court: item.court, region: item.region };
    }
  }
  return { court: '기타지방법원', region: 'Others' as const };
};

export const generateDateOptions = () => {
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 10; i >= currentYear - 100; i--) {
    years.push(String(i));
  }
  const months = Array.from({length: 12}, (_, i) => String(i + 1));
  const days = Array.from({length: 31}, (_, i) => String(i + 1));
  return { years, months, days };
};

/**
 * AES-256-GCM 암호화 (Web Crypto API)
 * PIN에서 PBKDF2로 키를 파생하고 AES-GCM으로 암호화
 */
export const encryptReport = async (data: string, pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // PIN -> PBKDF2 key derivation
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // salt(16) + iv(12) + ciphertext -> Base64 URL-safe
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  const b64 = btoa(String.fromCharCode(...combined));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * AES-256-GCM 복호화 (Web Crypto API)
 */
export const decryptReport = async (ciphertext: string, pin: string): Promise<string> => {
  let b64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
};
