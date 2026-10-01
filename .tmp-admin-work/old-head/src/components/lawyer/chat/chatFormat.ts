/**
 * 상담 채팅 화면의 금액·시간 표기
 *
 * - 금액: 만 원 단위 값 → "1억 2,200만 원" (이전: "12,200만 원")
 * - 시간: "오후 2:48" (이전: "오후 02:48"), 목록은 오늘/어제/월·일 상대 표기 (이전: "2026. 9. 29.")
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 86_400_000;

const timeFormatter = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const fullFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
});

export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 오늘과의 날짜 차이 (오늘 = 0, 어제 = 1) */
function daysAgo(d: Date, now: Date): number {
  return Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / DAY_MS);
}

/** 날짜 구분선 비교용 로컬 날짜 키 (YYYY-MM-DD) */
export function localDayKey(value: string | number | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 만 원 단위 금액 표기
 * @example formatManwon(12200) → "1억 2,200만 원", formatManwon(320, { unit: false }) → "320만"
 */
export function formatManwon(value: number | null | undefined, { unit = true }: { unit?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const rounded = Math.round(value);
  if (rounded === 0) return '0원';
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const eok = Math.floor(abs / 10000);
  const man = abs % 10000;
  const body = eok > 0
    ? (man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만` : `${eok.toLocaleString()}억`)
    : `${man.toLocaleString()}만`;
  return `${sign}${body}${unit ? ' 원' : ''}`;
}

/** 대화 시각: "오후 2:48" */
export function formatChatTime(value: string | number | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? timeFormatter.format(d) : '';
}

/** 마우스 오버용 전체 일시: "2026년 9월 29일 (화) 오후 2:48" */
export function formatFullDateTime(value: string | number | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? fullFormatter.format(d) : '';
}

/** 메시지함 시각: 오늘은 시각, 어제, 올해는 월·일, 그 이전은 연.월.일 */
export function formatListTime(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return '';
  const diff = daysAgo(d, now);
  if (diff <= 0) return formatChatTime(d);
  if (diff === 1) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 날짜 구분선: 오늘 / 어제 / 9월 29일 (화) / 2025년 12월 3일 (수) */
export function formatDayDivider(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return '';
  const diff = daysAgo(d, now);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}

/** 경과 시간: 12분 / 1시간 / 2일 (1분 미만은 1분) */
export function formatElapsed(from: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = parseDate(from);
  if (!d) return '';
  const minutes = Math.max(1, Math.floor((now.getTime() - d.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

/** 요청 ID 끝 5자리 (영숫자만, 대문자) — 같은 가명의 스레드 구별용 */
export function shortRequestNo(id: string | null | undefined): string {
  return String(id || '').replace(/[^0-9A-Za-z]/g, '').slice(-5).toUpperCase();
}
