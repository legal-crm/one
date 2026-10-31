// ============================================================
// [B-7] 기능 표시에 맞춘 정적 페이지 색인 설정
// - 통합어드민 '플랫폼 설정 › 기능 표시'에서 변제금 계산기를 켜면(외부 변호사 검토 뒤) 다음 배포부터
//   /calculator 의 noindex 를 지워 검색에 나오고 사이트맵에 들어간다. 끄면 다시 noindex.
// - Vercel 빌드에서만 바꾼다 (저장소 파일은 늘 noindex 상태로 둔다). 실패하면 그대로 둔다.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CALC = path.join(ROOT, 'public', 'calculator.html');
const NOINDEX = '<meta name="robots" content="noindex, follow">';

export function setCalculatorIndexable(html, visible) {
  const has = html.includes(NOINDEX);
  if (visible && has) return html.replace(NOINDEX, '<!-- 기능 표시에서 계산기를 켜 색인 허용 (feature-pages-build) -->');
  if (!visible && !has) return html.replace('</title>', `</title>\n    ${NOINDEX}`);
  return html;
}

async function main() {
  if (!process.env.VERCEL) return;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !fs.existsSync(CALC)) return;
  let visible = false;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/platform_config?id=eq.feature_flags&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    visible = rows?.[0]?.data?.features?.calculatorVisible === true;
  } catch (e) {
    console.warn('[feature-pages-build] 기능 표시를 못 읽어 /calculator 를 검색 제외로 둡니다:', e?.message || e);
  }
  const html = fs.readFileSync(CALC, 'utf8');
  const next = setCalculatorIndexable(html, visible);
  if (next !== html) fs.writeFileSync(CALC, next, 'utf8');
  console.log(`[feature-pages-build] /calculator ${visible ? '색인 허용' : '검색 제외'}`);
}

if (process.argv[1]?.endsWith('feature-pages-build.mjs')) {
  try { await main(); } catch (e) { console.warn('[feature-pages-build] 실패 — 그대로 둡니다:', e?.message || e); }
}
