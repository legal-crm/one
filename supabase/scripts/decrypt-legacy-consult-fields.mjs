#!/usr/bin/env node
// =============================================================================
// [PART 4] 일회성 이관: 브라우저 "필드 암호화"로 저장된 상담 데이터를 평문으로 되돌린다.
//
// 대상
//   - consult_requests.financial_profile : {"__enc":"v1","iv":hex,"data":hex}
//   - consult_messages.message           : "__enc_str_v1__:<ivhex>:<datahex>"
//   (AES-256-GCM, 키 = SHA-256(비밀 문자열))
//
// 왜: 비밀 문자열이 VITE_SESSION_SECRET(브라우저 번들에 포함)이라 보호 효과가 없었다.
//     앱은 이제 평문 + RLS로 저장하고, 번들에서 키를 뺐다. 기존 암호문은 이 스크립트로만 풀 수 있다.
//
// 실행 (운영자 PC 또는 CI — 서비스 롤 키가 필요하므로 절대 브라우저/번들에 넣지 말 것)
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LEGACY_SESSION_SECRET="<기존 VITE_SESSION_SECRET 값>" \
//     node supabase/scripts/decrypt-legacy-consult-fields.mjs            # 미리보기(변경 없음)
//   ... node supabase/scripts/decrypt-legacy-consult-fields.mjs --apply    # 실제 반영
//
// 순서: ① 미리보기로 복호화 실패 건수 확인 → ② --apply → ③ Vercel에서 VITE_SESSION_SECRET 삭제 후 재배포
// 복호화 실패 행(탭별 임의 키로 저장된 행 등)은 그대로 둔다. 화면에는 '이전 방식으로 저장된 메시지' 안내가 나온다.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { webcrypto as crypto } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEGACY_SESSION_SECRET } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

// 과거 빌드가 쓰던 키 후보 (순서대로 시도). 두 번째 값은 초기 빌드의 코드 고정 기본값이다.
const SECRET_CANDIDATES = [LEGACY_SESSION_SECRET, 'mykim-legal-crm-default-vault-key-2026'].filter(Boolean);
if (!LEGACY_SESSION_SECRET) {
  console.warn('⚠️ LEGACY_SESSION_SECRET이 없어 코드 고정 기본키만 시도합니다. 운영 데이터 대부분은 복호화되지 않을 수 있습니다.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const hexToBytes = (hex) => new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));
const keyCache = new Map();
async function keyFor(secret) {
  if (keyCache.has(secret)) return keyCache.get(secret);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt']);
  keyCache.set(secret, key);
  return key;
}
async function decryptHex(ivHex, dataHex) {
  for (const secret of SECRET_CANDIDATES) {
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(ivHex) }, await keyFor(secret), hexToBytes(dataHex));
      return new TextDecoder().decode(plain);
    } catch { /* 다음 후보 */ }
  }
  return null;
}

async function* pages(table, columns) {
  const size = 500;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + size - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    if (!data || data.length === 0) return;
    yield data;
    if (data.length < size) return;
  }
}

async function migrateRequests() {
  const stats = { scanned: 0, encrypted: 0, restored: 0, failed: 0 };
  for await (const rows of pages('consult_requests', 'id, financial_profile')) {
    for (const row of rows) {
      stats.scanned++;
      const v = row.financial_profile;
      if (!v || typeof v !== 'object' || v.__enc !== 'v1') continue;
      stats.encrypted++;
      const text = await decryptHex(v.iv, v.data);
      if (text === null) { stats.failed++; console.warn(`  복호화 실패: consult_requests ${row.id}`); continue; }
      let parsed;
      try { parsed = JSON.parse(text); } catch { stats.failed++; continue; }
      if (APPLY) {
        const { error } = await supabase.from('consult_requests').update({ financial_profile: parsed }).eq('id', row.id);
        if (error) { stats.failed++; console.warn(`  저장 실패 ${row.id}: ${error.message}`); continue; }
      }
      stats.restored++;
    }
  }
  return stats;
}

async function migrateMessages() {
  const PREFIX = '__enc_str_v1__:';
  const stats = { scanned: 0, encrypted: 0, restored: 0, failed: 0 };
  for await (const rows of pages('consult_messages', 'id, message')) {
    for (const row of rows) {
      stats.scanned++;
      if (typeof row.message !== 'string' || !row.message.startsWith(PREFIX)) continue;
      stats.encrypted++;
      const [ivHex, dataHex] = row.message.slice(PREFIX.length).split(':');
      const text = ivHex && dataHex ? await decryptHex(ivHex, dataHex) : null;
      if (text === null) { stats.failed++; console.warn(`  복호화 실패: consult_messages ${row.id}`); continue; }
      if (APPLY) {
        const { error } = await supabase.from('consult_messages').update({ message: text }).eq('id', row.id);
        if (error) { stats.failed++; console.warn(`  저장 실패 ${row.id}: ${error.message}`); continue; }
      }
      stats.restored++;
    }
  }
  return stats;
}

console.log(APPLY ? '▶ 반영 모드 (--apply)' : '▶ 미리보기 모드 — 변경하지 않습니다. 반영하려면 --apply');
const req = await migrateRequests();
console.log('consult_requests.financial_profile', req);
const msg = await migrateMessages();
console.log('consult_messages.message', msg);
if (!APPLY) console.log('restored = 복호화 가능한 건수입니다. 확인 후 --apply로 다시 실행하세요.');
