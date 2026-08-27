/**
 * 스텔스 가명 생성 유틸리티 v2
 * 
 * 색상/형용사 + 동물/자연물/식물 조합으로 채무 연상 없는 중립적 가명을 생성합니다.
 * 
 * - 수식어 50개 × 명사 80개 = 4,000 기본 조합
 * - Tier 0: 숫자 없음 (4,000명)
 * - Tier 1: 2자리 (328,000명)
 * - Tier 2: 3자리 (3,568,000명)
 * - Tier 3: 4자리 (36,448,000명)
 * 
 * 숫자 혼동 방지: 전체동일(11,222), 3연속(1112), 2자리반복(1212), 순차열(1234) 금지
 */

// ── 수식어 Pool (50개) ──────────────────────────────────────
// 색상 15개 + 형용사 35개
export const MODIFIERS = [
  // 색상
  '파란', '초록', '보라', '하얀', '노란', '빨간', '은빛', '금빛',
  '분홍', '주황', '하늘', '연두', '청록', '자주', '살구',
  // 형용사
  '맑은', '밝은', '고요한', '따뜻한', '작은', '느긋한', '용감한', '상쾌한',
  '반짝이는', '조용한', '활발한', '씩씩한', '당당한', '편안한', '너그러운',
  '재빠른', '가벼운', '자유로운', '즐거운', '유쾌한', '산뜻한', '포근한',
  '아늑한', '시원한', '투명한', '든든한', '담백한', '선명한', '깔끔한',
  '소중한', '싱그러운', '대담한', '정다운', '솔직한', '단단한',
] as const;

// ── 명사 Pool (80개) ────────────────────────────────────────
// 동물 30개 + 자연 30개 + 식물 20개
export const NOUNS = [
  // 🐾 동물
  '고래', '여우', '부엉이', '곰', '참새', '고양이', '토끼', '펭귄',
  '수달', '다람쥐', '돌고래', '사슴', '나비', '해달', '강아지',
  '오리', '두루미', '물개', '판다', '코알라', '독수리', '거북이',
  '앵무새', '기린', '고슴도치', '햄스터', '비둘기', '백조', '청설모', '올빼미',
  // 🌿 자연
  '별빛', '달빛', '햇살', '구름', '바다', '노을', '무지개', '안개',
  '꽃잎', '들꽃', '눈꽃', '이슬', '산들바람', '은하수', '새벽별',
  '보름달', '언덕', '숲', '시냇물', '하늘빛', '바람', '파도', '옹달샘',
  '초원', '호수', '빗방울', '석양', '샛별', '여울', '종달새',
  // 🌸 식물
  '대나무', '소나무', '단풍', '벚꽃', '민들레', '해바라기', '백합',
  '라벤더', '도토리', '은방울', '수선화', '연꽃', '목련', '튤립',
  '코스모스', '클로버', '선인장', '제비꽃', '동백', '매화',
] as const;

// ── 숫자 혼동 방지 필터 ─────────────────────────────────────

/**
 * 혼동 가능성이 있는 숫자인지 판별합니다.
 * 
 * 금지 패턴:
 * 1. 전체 동일 숫자 (11, 222, 3333)
 * 2. 같은 숫자 3연속+ (1112, 3331)
 * 3. 2자리 반복 — 4자리 이상 (1212, 3434)
 * 4. 순차열 — 4자리 이상 (1234, 4321)
 */
export function isConfusingNumber(n: number): boolean {
  const s = String(n);

  // ① 전체 동일 숫자
  if (new Set(s).size === 1) return true;

  // ② 같은 숫자 3연속+
  if (/(.)\1{2,}/.test(s)) return true;

  // ③ 2자리 반복 (4자리 이상만)
  if (s.length >= 4 && s.length % 2 === 0) {
    const half = s.slice(0, 2);
    if (s === half.repeat(s.length / 2)) return true;
  }

  // ④ 순차열 (4자리 이상만)
  if (s.length >= 4) {
    const digits = s.split('').map(Number);
    const isAsc = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
    const isDesc = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
    if (isAsc || isDesc) return true;
  }

  return false;
}

// ── 유효 숫자 풀 사전 계산 ───────────────────────────────────

/** Tier별 유효 숫자 범위에서 혼동 숫자를 제외한 풀 */
function buildValidNumbers(min: number, max: number): number[] {
  const result: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!isConfusingNumber(i)) {
      result.push(i);
    }
  }
  return result;
}

// 모듈 로드 시 한 번만 계산 (성능 최적화)
const VALID_2DIGIT = buildValidNumbers(10, 99);   // 81개
const VALID_3DIGIT = buildValidNumbers(100, 999);  // ~891개

// ── 가명 생성 ───────────────────────────────────────────────

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 스텔스 가명을 생성합니다.
 * 
 * 현재 구현: 수식어 + 명사 + 2자리 숫자 (Tier 1)
 * - DB 연동 시 Tier 0(숫자 없음)부터 시작하여 자동 스케일링 가능
 * - 현재는 클라이언트 단독 생성이므로 Tier 1을 기본값으로 사용
 * 
 * @returns 생성된 가명 문자열 (예: "파란고래_42")
 */
export function generateAlias(): string {
  const modifier = randomItem(MODIFIERS);
  const noun = randomItem(NOUNS);
  const suffix = randomItem(VALID_2DIGIT);

  return `${modifier}${noun}_${suffix}`;
}

/**
 * 가명 생성 예시를 반환합니다. (placeholder용)
 */
export function getAliasExample(): string {
  return '파란고래_42';
}
