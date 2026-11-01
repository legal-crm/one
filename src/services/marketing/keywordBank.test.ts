import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false, getAuthHeaders: async () => ({}) }));

import { kstToday, relatedPages, suggestTopics, trendDirection, validateKeyword, type MarketingKeyword } from './keywordBank';
// @ts-ignore — 서버 JS 모듈
import { readDatalab, trendRange } from '../../../api/_lib/routes/keyword-trend.js';

const kw = (over: Partial<MarketingKeyword>): MarketingKeyword => ({
  id: over.keyword || 'k', keyword: 'k', intent: 'info', covered: false, priority: 3, created_at: '', updated_at: '', ...over,
});
const months = (vals: number[]) => vals.map((ratio, i) => ({ period: `2026-${String(i + 1).padStart(2, '0')}-01`, ratio }));

describe('키워드 은행', () => {
  it('trend direction compares last 3 months with the 3 before', () => {
    expect(trendDirection(months([10, 10, 10, 20, 20, 20])).dir).toBe('up');
    expect(trendDirection(months([20, 20, 20, 10, 10, 10]))).toEqual({ dir: 'down', change: -50 });
    expect(trendDirection(months([10, 10, 10, 11, 10, 10])).dir).toBe('flat');
    expect(trendDirection(months([1, 2])).dir).toBe('unknown');
  });

  it('finds related site pages by words in title/description', () => {
    const pages = [
      { url: '/a', title: '개인회생 신청 자격 조건 정리', description: '' },
      { url: '/b', title: '개인파산 절차', description: '파산 신청 조건 안내' },
    ];
    expect(relatedPages('개인회생 자격', pages).map(p => p.url)).toEqual(['/a']);
    expect(relatedPages('파산 조건', pages).map(p => p.url)).toEqual(['/b']);
    expect(relatedPages('새출발기금', pages)).toEqual([]);
  });

  it('suggests uncovered, not recently used keywords by score', () => {
    const today = new Date('2026-11-01T03:00:00Z');
    const list = [
      kw({ keyword: '다룬 것', priority: 5, covered: true }),
      kw({ keyword: '최근 씀', priority: 5, last_used_on: '2026-10-25' }),
      kw({ keyword: '오래전 씀', priority: 4, last_used_on: '2026-09-01' }),
      kw({ keyword: '검색 많음', priority: 3, monthly_volume: 10000, trend: months([10, 10, 10, 30, 30, 30]) }),
      kw({ keyword: '보통', priority: 2 }),
    ];
    const s = suggestTopics(list, today);
    expect(s.map(x => x.keyword.keyword)).toEqual(['검색 많음', '오래전 씀', '보통']);
    expect(s[0].reasons.join(' ')).toMatch(/검색 증가/);
  });

  it('validates input', () => {
    expect(validateKeyword({ keyword: '가' })).toMatch(/2~40/);
    expect(validateKeyword({ keyword: '개인회생 비용', target_path: 'guide/x' })).toMatch(/\//);
    expect(validateKeyword({ keyword: '개인회생 비용', target_path: '/guide/x.html', monthly_volume: 100 })).toBeNull();
  });

  it('reads DataLab response and builds a 12-month range', () => {
    const t = readDatalab({ results: [{ data: [{ period: '2026-01-01', ratio: 12.345 }, { period: 'bad', ratio: 1 }] }] });
    expect(t).toEqual([{ period: '2026-01-01', ratio: 12.35 }]);
    expect(readDatalab({})).toEqual([]);
    expect(trendRange(new Date('2026-11-01T03:00:00Z'))).toEqual({ startDate: '2025-11-01', endDate: '2026-10-31' });
    expect(trendRange(new Date('2026-11-20T03:00:00Z'))).toEqual({ startDate: '2025-11-01', endDate: '2026-10-31' });
    expect(kstToday(new Date('2026-10-31T16:00:00Z'))).toBe('2026-11-01');
  });
});
