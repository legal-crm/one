// [SEO] IndexNow 즉시 색인 요청 — 서버(/api/generate-statement mode=indexnow)가 Bing·Naver에 전송
// 관리자(2단계 인증) 세션에서만 동작한다.
import { getAuthHeaders } from '../supabaseClient';

export interface IndexNowEngineResult {
  engine: string;
  status: number;
  ok: boolean;
  message: string;
}

export type IndexNowResponse =
  | { ok: true; urls: string[]; results: IndexNowEngineResult[] }
  | { ok: false; error: string; urls?: string[]; results?: IndexNowEngineResult[] };

export async function submitIndexNow(urls: string[]): Promise<IndexNowResponse> {
  try {
    const res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'indexnow', urls }),
    });
    const json = await res.json().catch(() => null);
    if (!json) return { ok: false, error: `서버 응답을 읽지 못했습니다. (HTTP ${res.status})` };
    if (json.ok) return { ok: true, urls: json.urls || [], results: json.results || [] };
    const failed = (json.results || []) as IndexNowEngineResult[];
    return {
      ok: false,
      error: json.error || failed.map(r => `${r.engine}: ${r.message}`).join(' / ') || '전송에 실패했습니다.',
      urls: json.urls,
      results: failed,
    };
  } catch {
    return { ok: false, error: '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.' };
  }
}
