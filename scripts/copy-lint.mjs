#!/usr/bin/env node
// ============================================================
// [문구 검사] 고객 화면·공개 페이지의 과장·금칙 표현 재유입 방지
// ------------------------------------------------------------
// 실행: npm run lint:copy            (위반이 있으면 종료 코드 1)
//       npm run lint:copy -- --warn  (목록만 출력, 종료 코드 0)
//
// 기준(docs/mykim_client_ui_upgrade_plan.md 0-10 문구 정비):
//  - '전문' 표기는 대한변협 전문분야 등록 변호사만 쓸 수 있어 플랫폼 문구에서 쓰지 않는다
//  - 무료 상담·답변, 시간 약속(1초·1분 만에), 결과 보장·과장(완벽, 인가 유력, 100% 탕감)을 쓰지 않는다
//  - 자동 계산 자료를 변호사 의견서·공인 문서처럼 표기하지 않는다
//  - 유지해야 하는 용어: '스텔스 가명', '스텔스 보증', '100% 익명', '약 3분'
// 코드 주석은 검사하지 않는다. 예외가 꼭 필요하면 해당 줄에 `copy-lint-ignore` 주석을 단다.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WARN_ONLY = process.argv.includes('--warn');

/** 검사 대상 (고객이 보는 화면과 공개 페이지) */
const TARGETS = [
  'index.html',
  'src/components/ClientRole.tsx',
  'src/components/Disclaimers.tsx',
  'src/components/client',
  'src/rehab-chatbot-package/components',
  'src/rehab-chatbot-package/services/calculationService.ts',
  'src/components/common/LegalContractTermsModal.tsx',
  'src/components/common/PremiumProposalReportModal.tsx',
  'src/components/common/ContractPublicVerifierModal.tsx',
  'src/services/lawyerDocShareService.ts',
  'public',
];

/** 검사에서 뺄 파일 (예전 삭제 예정 파일 7개는 2026-09-30 삭제해 목록을 비웠다) */
const SKIP_FILES = new Set([]);

const EXTENSIONS = new Set(['.ts', '.tsx', '.html']);

/**
 * [규칙 id, 정규식, 안내, 적용 범위(선택: 경로 접두사 목록)]
 * 적용 범위를 주지 않으면 모든 검사 대상에 적용한다.
 */
const RULES = [
  // '도산전문법원'처럼 법원을 가리키는 말은 제외
  ['specialist', /전문\s?변호사|(?:도산|회생|파산|채무)\s?전문(?!가 아닌|법원)|전문\s?변호인/, "'전문' 표기 금지 → '회생·파산 사건을 다루는 변호사' 또는 '변호사'"],
  ['free', /100\s?%\s?무료|무료\s?(?:답변|상담|자격\s?진단|진단)|무료상담/, "무료 상담·답변 강조 금지 → '상담 요청 단계 이용료는 없습니다' 등 사실만"],
  // '약 3분이면 끝납니다'(표준 문구)는 허용
  ['speed', /(?<![\d.])(?:1|3|5|10)\s?초(?![과기록])|\d+\s?분\s?만에|(?<!약\s?)\d+\s?분이면\s?(?:충분|끝|완성)|말로\s?\d+\s?분|즉시\s?(?:해결|해방|차단|추심\s?차단)/, "시간·속도 약속 금지 → 내 상황 체크는 '약 3분'만 사용"],
  ['perfect', /완벽/, "'완벽' 등 과장 금지"],
  ['outcome', /인가\s?유력|성공률|승소율|100\s?%\s?(?:탕감|면책|보장|해결|차단|성공|온전)|결과를\s?보장합니다|면책을\s?보장|최대\s?\d+\s?%\s?(?:이상\s?)?(?:탕감|감면)|전액\s?탕감|모든\s?채무\s?100\s?%/, '결과 보장·예측 표현 금지'],
  ['ranking', /업계\s?1위|국내\s?(?:유일|최초|1위)|최고의|No\.?\s?1\b/, '순위·최상급 표현 금지'],
  ['legal-effect', /100\s?%\s?법적\s?효력|완전(?:한|히)?\s?(?:동일한\s?)?법적\s?효력|위[·ㆍ]?변조(?:가)?\s?(?:기술적으로\s?)?불가/, '전자서명·문서 효력 과장 금지'],
  ['fake-authority', /공인\s?(?:법률|진단|검인|변호사\s?날인)|CERTIFIED LEGAL OPINION|정식\s?법률\s?소견서/, '자동 계산 자료를 공인 문서·변호사 의견서처럼 표기 금지'],
  // 병원의 '정밀 진단서'(의료 서류)는 제외
  ['precision', /(?<!병원의\s?)정밀\s?(?:분석|진단)|빅데이터/, "'정밀 분석·빅데이터' 과장 금지"],
  ['staff', /사무장/, "'사무장' 표기 지양 → '사무소 직원'"],
  ['tone', /자폭/, "'자폭' → '삭제'"],
  // 앱 화면의 수치 라벨은 '감면'으로 통일 (공개 안내 글의 일반 설명 '탕감'은 검색어라 허용)
  ['forgive', /탕감/, "'탕감' → '감면'(예상 감면율·예상 감면액)", ['src/']],
];

/** 줄 단위 예외: 검색 키워드(메타·JSON-LD), 부정문 고지, 명시적 예외 표시 */
const LINE_ALLOW = [/name=["']keywords["']/, /"keywords"\s*:/, /copy-lint-ignore/];
/** 규칙별 예외: '보장하지 않습니다' 같은 고지 문장 */
const RULE_ALLOW = {
  outcome: [/보장하지\s?않|보장되지\s?않|단정하거나/],
};

function walk(rel, out) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(abs)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(path.posix.join(rel, name), out);
    }
  } else if (EXTENSIONS.has(path.extname(rel)) && !SKIP_FILES.has(rel)) {
    out.push(rel);
  }
}

/** 주석 줄인지 (코드 파일만). 블록 주석 안쪽도 건너뛴다. */
function makeCommentTracker(isCode) {
  let inBlock = false;
  return (line) => {
    if (!isCode) return false;
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      return true;
    }
    if (t.startsWith('//') || t.startsWith('*')) return true;
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      if (!t.includes('*/')) inBlock = true;
      return true;
    }
    return false;
  };
}

/** 줄 끝 주석(// …)은 떼고 검사 */
function stripTrailingComment(line, isCode) {
  if (!isCode) return line;
  const idx = line.indexOf(' // ');
  return idx >= 0 ? line.slice(0, idx) : line;
}

const files = [];
for (const t of TARGETS) walk(t, files);

const findings = [];
for (const rel of files) {
  const isCode = rel.endsWith('.ts') || rel.endsWith('.tsx');
  const isComment = makeCommentTracker(isCode);
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    if (isComment(raw)) return;
    if (LINE_ALLOW.some(re => re.test(raw))) return;
    const line = stripTrailingComment(raw, isCode);
    for (const [id, re, hint, scope] of RULES) {
      if (scope && !scope.some(prefix => rel.startsWith(prefix))) continue;
      if (RULE_ALLOW[id]?.some(allow => allow.test(line))) continue;
      const m = line.match(re);
      if (m) {
        const at = Math.max(0, (m.index || 0) - 30);
        findings.push({ rel, line: i + 1, id, hint, text: line.slice(at, at + 90).trim() });
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`copy-lint: ${files.length}개 파일 검사, 문제 없음`);
  process.exit(0);
}

const byRule = new Map();
for (const f of findings) byRule.set(f.id, (byRule.get(f.id) || 0) + 1);
for (const f of findings) {
  console.log(`${f.rel}:${f.line}  [${f.id}] ${f.text}`);
}
console.log('');
for (const [id, , hint] of RULES) {
  if (byRule.has(id)) console.log(`  ${id} ${byRule.get(id)}건 — ${hint}`);
}
console.log(`\ncopy-lint: ${files.length}개 파일 검사, ${findings.length}건`);
process.exit(WARN_ONLY ? 0 : 1);
