#!/usr/bin/env node
// ============================================================
// 회사 정보 한 곳 (CT-12): 정적 페이지 푸터·회사 소개 표·JSON-LD를 현재 회사 정보로 맞춘다 (prebuild)
// 원본: 통합어드민 '플랫폼 설정 › 회사 정보'(platform_config id 'company_info') → 없으면 api/_lib/company-info.js 기본값
// 바꾸는 곳: <footer> 안의 '라벨: 값' 줄, about.html 표의 회사명·대표·사업자등록번호, JSON-LD founder·contactPoint email
// 지난 약관 보관본(public/legal-archive)은 그때 그대로 둔다. 실패해도 빌드를 막지 않는다.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCompanyInfo } from '../api/_lib/company-info.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

function htmlFiles() {
  const out = [path.join(ROOT, 'index.html')];
  for (const dir of ['', 'guide', 'articles']) {
    const d = path.join(PUBLIC, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) out.push(path.join(d, f));
  }
  return out.filter(f => fs.existsSync(f));
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function applyCompanyInfo(html, info) {
  const footerLabels = [
    ['상호', info.legalName],
    ['대표', info.ceo],
    ['사업자등록번호', info.businessNumber],
    ['통신판매업 신고', info.mailOrderNumber],
    ['개인정보 보호책임자', info.privacyOfficer],
    ['호스팅 서비스 제공자', info.hosting],
    ['사업장 주소지', info.address],
    ['전화번호', info.phone],
    ['고객문의', info.email],
  ];
  // 푸터 안만
  let out = html.replace(/<footer[\s\S]*?<\/footer>/g, footer => {
    let f = footer;
    for (const [label, value] of footerLabels) {
      // 줄 앞 공백 뒤 '라벨: 값' (값은 줄 끝·'<' 앞까지). '대표'가 '대표이사'·'대표 전화'를 건드리지 않게 콜론 바로 앞까지 일치
      f = f.replace(new RegExp(`(^|\\n|>)(\\s*)(${reEsc(label)}): ([^<\\n]*?)(\\s*)(?=<|\\n)`, 'g'), (_m, a, sp, l, _v, tail) => `${a}${sp}${l}: ${esc(value)}${tail}`);
    }
    // 브랜드 줄 '<p ...>몬스터랩</p>' (상호)
    f = f.replace(/(<p class="text-base font-bold text-slate-200">)[^<]*(<\/p>)/, `$1${esc(info.legalName)}$2`);
    return f;
  });
  // 회사 소개 표
  const tableRows = [['회사명', info.legalName], ['대표', info.ceo], ['사업자등록번호', info.businessNumber]];
  for (const [label, value] of tableRows) {
    out = out.replace(new RegExp(`(<td[^>]*>${reEsc(label)}</td><td[^>]*>)[^<]*(</td>)`, 'g'), `$1${esc(value)}$2`);
  }
  // JSON-LD (founder 이름·고객 문의 이메일)
  out = out.replace(/("founder":\s*\{\s*"@type":\s*"Person",\s*"name":\s*")[^"]*(")/g, `$1${info.ceo.replace(/"/g, '')}$2`);
  out = out.replace(/("contactPoint":\s*\{\s*"@type":\s*"ContactPoint",\s*"email":\s*")[^"]*(")/g, `$1${info.email.replace(/"/g, '')}$2`);
  return out;
}

async function main() {
  // 서버 값은 Vercel 빌드에서만 (로컬 빌드는 기본값 — 추적 파일을 바꾸지 않게)
  const { info, source } = process.env.VERCEL
    ? await fetchCompanyInfo(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    : await fetchCompanyInfo('', '');
  let changed = 0;
  for (const file of htmlFiles()) {
    const prev = fs.readFileSync(file, 'utf8');
    const next = applyCompanyInfo(prev, info);
    if (next !== prev) { fs.writeFileSync(file, next, 'utf8'); changed += 1; }
  }
  console.log(`[company-info] 회사 정보 출처: ${source === 'server' ? '서버(플랫폼 설정)' : '기본값'} · 바꾼 파일 ${changed}개`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => { console.warn('[company-info] 건너뜀:', e?.message || e); });
}
