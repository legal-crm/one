// ============================================================
// 법원 기간(기한) 만료일 계산 — 일·주·월 단위
// - 민법 제157조: 초일 불산입 (송달일 다음 날부터 기산)
// - 민법 제160조: 주·월은 역(曆)으로 계산. 최종 주·월에서 기산일에 해당한 날의 전일에 만료,
//   월의 처음부터 기산하면 최종 월의 말일, 최종 월에 해당일이 없으면 그 월의 말일
// - 민법 제161조: 말일이 토요일 또는 공휴일이면 그 익일 만료
//   (토요일·공휴일 판단은 taskTemplateService.calculateCourtDeadlineDetail + utils/koreanHolidays 단일 출처)
// - 민사소송법 제170조가 기간 계산을 민법에 따르도록 정하고 있다.
// ============================================================

import { localYmd, parseLocalYmd } from '../../utils/localDate';
import { calculateCourtDeadlineDetail, CourtDeadlineDetail } from '../taskTemplateService';

export type DeadlineUnit = 'day' | 'week' | 'month';

export interface CourtDeadlineResult extends CourtDeadlineDetail {
  /** 기산일 (기준일 다음 날) */
  startDate: string;
  /** 토요일·공휴일 연장 전 말일 */
  rawEndDate: string;
}

export function computeCourtDeadline(baseYmd: string, amount: number, unit: DeadlineUnit): CourtDeadlineResult | null {
  const base = parseLocalYmd(baseYmd);
  const n = Math.trunc(Number(amount));
  if (!base || !Number.isFinite(n) || n <= 0 || n > 3650) return null;

  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  let rawEnd: Date;

  if (unit === 'day') {
    rawEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  } else if (unit === 'week') {
    rawEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n * 7);
  } else if (start.getDate() === 1) {
    // 월의 처음부터 기산 → 최종 월의 말일 만료
    rawEnd = new Date(start.getFullYear(), start.getMonth() + n, 0);
  } else {
    const finalYear = new Date(start.getFullYear(), start.getMonth() + n, 1).getFullYear();
    const finalMonth = new Date(start.getFullYear(), start.getMonth() + n, 1).getMonth();
    const lastDay = new Date(finalYear, finalMonth + 1, 0).getDate();
    rawEnd = start.getDate() > lastDay
      ? new Date(finalYear, finalMonth, lastDay)            // 해당일이 없으면 그 월의 말일
      : new Date(finalYear, finalMonth, start.getDate() - 1); // 기산일에 해당한 날의 전일
  }

  const detail = calculateCourtDeadlineDetail(localYmd(rawEnd), 0);
  return { ...detail, startDate: localYmd(start), rawEndDate: localYmd(rawEnd) };
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → 'YYYY-MM-DD(요일)' */
export function formatYmdWithDow(ymd: string): string {
  const d = parseLocalYmd(ymd);
  return d ? `${ymd}(${DOW[d.getDay()]})` : ymd;
}

/** 오늘부터 만료일까지 남은 일수 (오늘 만료 = 0, 지났으면 음수) */
export function daysUntil(ymd: string, today: Date = new Date()): number | null {
  const d = parseLocalYmd(ymd);
  if (!d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}
