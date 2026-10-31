import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { bookingTimeLabel, bookingTurn, currentBookingFor, defaultSlotInput, validateSlots, type ConsultBooking } from './consultBookingService';

const base = (over: Partial<ConsultBooking>): ConsultBooking => ({
  id: 'b1', requestId: 'r1', lawyerId: 'l1', lawyerName: '홍길동', proposedBy: 'office', method: 'phone', slots: [],
  durationMin: 30, status: 'proposed', inCalendar: false, createdAt: '2026-11-01T00:00:00Z', ...over,
});

describe('consult booking helpers', () => {
  it('formats Korean time with weekday', () => {
    // 2026-11-03 01:00Z = 한국 11월 3일(화) 10:00
    expect(bookingTimeLabel('2026-11-03T01:00:00Z')).toBe('11월 3일(화) 10:00');
    expect(bookingTimeLabel(undefined)).toBe('');
  });

  it('validates slot count, range and duplicates', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    expect(validateSlots([], now)).toMatch(/하나 이상/);
    expect(validateSlots(['2026-11-01T00:10:00Z'], now)).toMatch(/30분 뒤/);
    expect(validateSlots(['2027-02-01T00:00:00Z'], now)).toMatch(/60일/);
    expect(validateSlots(['2026-11-02T01:00:00Z', '2026-11-02T01:00:00Z'], now)).toMatch(/두 번/);
    expect(validateSlots(['2026-11-02T01:00:00Z', '2026-11-03T01:00:00Z', '2026-11-04T01:00:00Z', '2026-11-05T01:00:00Z'], now)).toMatch(/3개/);
    expect(validateSlots(['2026-11-02T01:00:00Z', '2026-11-03T01:00:00Z'], now)).toBeNull();
  });

  it('prefers the upcoming confirmed booking over a waiting proposal', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    const list = [
      base({ id: 'p', status: 'proposed', slots: ['2026-11-05T01:00:00Z'] }),
      base({ id: 'c', status: 'confirmed', chosenAt: '2026-11-04T01:00:00Z' }),
      base({ id: 'old', status: 'confirmed', chosenAt: '2026-10-20T01:00:00Z' }),
      base({ id: 'other', lawyerId: 'l2', status: 'confirmed', chosenAt: '2026-11-02T01:00:00Z' }),
    ];
    expect(currentBookingFor(list, 'l1', now)?.id).toBe('c');
    expect(currentBookingFor(list.filter(b => b.id !== 'c'), 'l1', now)?.id).toBe('p');
    expect(currentBookingFor([], 'l1', now)).toBeUndefined();
  });

  it('knows whose turn it is', () => {
    expect(bookingTurn(base({ proposedBy: 'office' }), 'client')).toBe('answer');
    expect(bookingTurn(base({ proposedBy: 'office' }), 'office')).toBe('waiting');
    expect(bookingTurn(base({ status: 'confirmed', chosenAt: '2026-11-04T01:00:00Z' }), 'office')).toBe('confirmed');
    expect(bookingTurn(base({ status: 'cancelled' }), 'client')).toBe('closed');
  });

  it('suggests a weekday 10:00 default', () => {
    // 2026-10-31 토요일 → 다음 평일은 11월 2일(월)
    expect(defaultSlotInput(new Date(2026, 9, 31, 15, 0), 1)).toBe('2026-11-02T10:00');
  });
});
