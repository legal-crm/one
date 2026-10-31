import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false, getAuthHeaders: async () => ({}) }));

// @ts-ignore — 서버 JS 모듈 (응답 읽기만 시험)
import { readGrounding } from '../../../api/_lib/routes/geo-check.js';
import { citationRate, validateQuestion } from './geoCitationService';

describe('AI 검색 인용 점검', () => {
  it('reads Gemini grounding sources and finds mykim.kr rank', () => {
    const data = {
      candidates: [{
        content: { parts: [{ text: '개인회생은   법원이 판단합니다.' }] },
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/a', title: 'scourt.go.kr' } },
            { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/b', title: 'scourt.go.kr' } },
            { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/c', title: 'www.mykim.kr' } },
            { web: { uri: 'https://news.example.test/x', title: '뉴스 기사 제목' } },
          ],
        },
      }],
    };
    const g = readGrounding(data);
    expect(g.sources.map((s: { domain: string }) => s.domain)).toEqual(['scourt.go.kr', 'mykim.kr', 'news.example.test']);
    expect(g.cited).toBe(true);
    expect(g.citedRank).toBe(2);
    expect(g.answer).toBe('개인회생은 법원이 판단합니다.');
  });

  it('handles answers without grounding', () => {
    const g = readGrounding({ candidates: [{ content: { parts: [{ text: '답' }] } }] });
    expect(g.cited).toBe(false);
    expect(g.citedRank).toBeNull();
    expect(g.sourceCount).toBe(0);
  });

  it('validates questions and computes rate', () => {
    expect(validateQuestion('짧음', '')).toMatch(/5~200/);
    expect(validateQuestion('개인회생 기간은 얼마나 걸리나요?', '/guide/a b.html')).toMatch(/주소/);
    expect(validateQuestion('개인회생 기간은 얼마나 걸리나요?', 'https://mykim.kr/guide/a.html')).toBeNull();
    expect(citationRate({ cited_8w: 1, checked_8w: 3 })).toBe(33);
    expect(citationRate({ cited_8w: 0, checked_8w: 0 })).toBeNull();
  });
});
