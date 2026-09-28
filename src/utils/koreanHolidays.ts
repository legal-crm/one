// ============================================================
// 대한민국 관공서 공휴일 (연도별)
// - 설날·추석·부처님오신날은 음력이라 해마다 날짜가 달라서 연도별로 등록한다.
// - 대체공휴일·선거일·임시공휴일도 연도별로 등록한다.
// - 등록되지 않은 연도는 고정 공휴일(양력)만 알 수 있으므로 isHolidayDataCovered()로 확인하고
//   화면에 '공휴일 자료 미등록 연도'를 안내한다.
// - 새로 지정되는 임시공휴일은 자동으로 반영되지 않는다. 지정 시 이 표에 추가해야 한다.
// ============================================================

/** 양력 고정 공휴일 (모든 연도 공통) */
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

/** 2026년부터 공휴일로 지정된 날 (공휴일에 관한 법률 개정) */
const FIXED_FROM_2026: Record<string, string> = {
  '05-01': '노동절',
  '07-17': '제헌절',
};

/** 연도별 음력 공휴일·대체공휴일·선거일·임시공휴일 */
const YEARLY_HOLIDAYS: Record<number, Record<string, string>> = {
  2025: {
    '01-27': '임시공휴일',
    '01-28': '설날 연휴', '01-29': '설날', '01-30': '설날 연휴',
    '03-03': '대체공휴일(삼일절)',
    '05-05': '어린이날·부처님오신날',
    '05-06': '대체공휴일',
    '06-03': '대통령선거일',
    '10-05': '추석 연휴', '10-06': '추석', '10-07': '추석 연휴',
    '10-08': '대체공휴일(추석)',
  },
  2026: {
    '02-16': '설날 연휴', '02-17': '설날', '02-18': '설날 연휴',
    '03-02': '대체공휴일(삼일절)',
    '05-24': '부처님오신날',
    '05-25': '대체공휴일(부처님오신날)',
    '06-03': '전국동시지방선거일',
    '08-17': '대체공휴일(광복절)',
    '09-24': '추석 연휴', '09-25': '추석', '09-26': '추석 연휴',
    '10-05': '대체공휴일(개천절)',
  },
  2027: {
    '02-06': '설날 연휴', '02-07': '설날', '02-08': '설날 연휴',
    '02-09': '대체공휴일(설날)',
    '05-13': '부처님오신날',
    '08-16': '대체공휴일(광복절)',
    '09-14': '추석 연휴', '09-15': '추석', '09-16': '추석 연휴',
    '10-04': '대체공휴일(개천절)',
    '10-11': '대체공휴일(한글날)',
    '12-27': '대체공휴일(성탄절)',
  },
  2028: {
    '01-26': '설날 연휴', '01-27': '설날', '01-28': '설날 연휴',
    '04-12': '국회의원선거일',
    '05-02': '부처님오신날',
    '10-02': '추석 연휴', '10-03': '추석·개천절', '10-04': '추석 연휴',
    '10-05': '대체공휴일(추석)',
  },
};

const COVERED_YEARS = Object.keys(YEARLY_HOLIDAYS).map(Number);
export const HOLIDAY_DATA_FIRST_YEAR = Math.min(...COVERED_YEARS);
export const HOLIDAY_DATA_LAST_YEAR = Math.max(...COVERED_YEARS);

/** 해당 연도의 음력·대체·선거 공휴일 자료가 등록돼 있는지 */
export function isHolidayDataCovered(year: number): boolean {
  return !!YEARLY_HOLIDAYS[year];
}

/** 공휴일 이름 (공휴일이 아니면 null). month는 1~12 */
export function getKoreanHoliday(year: number, month: number, day: number): string | null {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const yearly = YEARLY_HOLIDAYS[year]?.[key];
  if (yearly) return yearly;
  if (year >= 2026 && FIXED_FROM_2026[key]) return FIXED_FROM_2026[key];
  return FIXED_HOLIDAYS[key] || null;
}

/** Date 기준 공휴일 이름 */
export function getKoreanHolidayOfDate(d: Date): string | null {
  return getKoreanHoliday(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
