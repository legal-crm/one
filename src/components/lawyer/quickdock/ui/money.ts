// ============================================================
// 퀵독 금액 입력·표시 유틸
// - 상담 중에는 '350만', '1억2천만'처럼 말하는 대로 입력하는 경우가 많아 한글 단위를 해석한다.
// - 표시값은 원 단위를 버리지 않는다 (예: 1,538,542원 → '153만 8,542원').
// ============================================================

const MONEY_TOKEN = /(\d+(?:\.\d+)?)(억|천만|백만|십만|만|천|백|십)?/y;

/**
 * 금액 문자열 → 원 단위 정수. 해석할 수 없으면 null, 빈 문자열은 0.
 * - 쉼표·공백·'원'은 무시
 * - '1억2천', '3억500'처럼 억 뒤의 만 단위를 생략한 구어체는 만 단위로 해석 (1억 2천만, 3억 500만)
 */
export function parseKoreanMoney(input: string): number | null {
  const s = (input || '').replace(/[\s,원₩]/g, '');
  if (!s) return 0;

  let pos = 0;
  let total = 0;
  let group = 0;
  let afterEok = false;

  while (pos < s.length) {
    MONEY_TOKEN.lastIndex = pos;
    const m = MONEY_TOKEN.exec(s);
    if (!m || m[0].length === 0) return null;
    pos = MONEY_TOKEN.lastIndex;

    const num = parseFloat(m[1]);
    if (!Number.isFinite(num)) return null;

    switch (m[2]) {
      case '억':
        total += (group + num) * 1e8;
        group = 0;
        afterEok = true;
        break;
      case '천만':
        total += (group + num * 1000) * 1e4;
        group = 0;
        break;
      case '백만':
        total += (group + num * 100) * 1e4;
        group = 0;
        break;
      case '십만':
        total += (group + num * 10) * 1e4;
        group = 0;
        break;
      case '만':
        total += (group + num) * 1e4;
        group = 0;
        break;
      case '천':
        group += num * 1000;
        break;
      case '백':
        group += num * 100;
        break;
      case '십':
        group += num * 10;
        break;
      default:
        group += num;
    }
  }

  total += afterEok && group > 0 ? group * 1e4 : group;
  return Math.round(total);
}

/** 1,234,567원 */
export function won(amount: number): string {
  return `${Math.round(Number(amount) || 0).toLocaleString('ko-KR')}원`;
}

/** 1억 2,000만 원 / 153만 8,542원 / 0원 */
export function formatWonKorean(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  if (n === 0) return '0원';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const eok = Math.floor(abs / 1e8);
  const man = Math.floor((abs % 1e8) / 1e4);
  const rest = abs % 1e4;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest > 0) parts.push(rest.toLocaleString('ko-KR'));
  return `${sign}${parts.join(' ')}${rest > 0 ? '원' : ' 원'}`;
}

/** 소수 1자리 퍼센트 (0으로 나누면 0.0%) */
export function percent(part: number, whole: number): string {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}
