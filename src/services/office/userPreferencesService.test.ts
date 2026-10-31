import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { sanitizeDashboardCards } from './userPreferencesService';

const ALLOWED = ['consult', 'deadlines', 'waiting', 'review', 'fees'];

describe('오늘의 업무 카드 구성 (HM-4)', () => {
  it('고를 수 있는 카드만, 중복 없이, 4개까지', () => {
    expect(sanitizeDashboardCards(['fees', 'fees', 'nope', 'consult', 'review', 'waiting', 'deadlines'], ALLOWED)).toEqual(['fees', 'consult', 'review', 'waiting']);
  });
  it('2개 미만이거나 배열이 아니면 역할 기본값을 쓰게 null', () => {
    expect(sanitizeDashboardCards(['fees'], ALLOWED)).toBeNull();
    expect(sanitizeDashboardCards(null, ALLOWED)).toBeNull();
    expect(sanitizeDashboardCards('fees,consult', ALLOWED)).toBeNull();
  });
});
