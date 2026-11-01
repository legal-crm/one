// 키워드 은행 추세 새로고침 (M-7): 네이버 데이터랩 검색어 트렌드 (최근 12개월, 월 단위)
// POST /api/generate-statement { mode: 'mk-keyword-trend', ids: [uuid…] } — 관리자(2단계 인증)만 (handleAutopilot 안에서 부름)
//  * 키워드마다 따로 묻는다 (한 번에 여러 개를 물으면 비율이 그 묶음의 최댓값 기준이라 모양 비교가 어려움)
//  * 한 번에 10개까지. 결과는 marketing_keyword_set_trend(service role)로 저장
//  * 키: NAVER_CLIENT_ID·NAVER_CLIENT_SECRET (뉴스 검색과 같은 앱). 앱에 '데이터랩(검색어트렌드)' 사용 설정이 있어야 한다

import { supabase } from '../auth-middleware.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** 최근 12개월 구간 (다 끝난 달만: 12개월 전 1일 ~ 지난달 말일, 한국 날짜) — 이번 달 중간값이 추세를 낮게 보이게 하지 않도록 */
export function trendRange(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const end = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 0));
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 12, 1));
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** 데이터랩 응답 → [{period, ratio}] (최대 24개, 비율 소수 둘째 자리) */
export function readDatalab(json) {
  const data = json?.results?.[0]?.data;
  if (!Array.isArray(data)) return [];
  return data.slice(-24).map(p => ({ period: String(p.period || '').slice(0, 10), ratio: Math.round(Number(p.ratio || 0) * 100) / 100 }))
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.period));
}

function explain(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  if (status === 401 || status === 403 || /scope|권한|024|permission/i.test(text)) {
    return "네이버 개발자센터 애플리케이션에 '데이터랩(검색어트렌드)' API 사용 설정이 필요해요.";
  }
  if (status === 429) return '데이터랩 하루 호출 한도를 넘었어요. 내일 다시 시도해 주세요.';
  return `데이터랩 응답 오류 (${status})`;
}

export async function refreshKeywordTrends(ids, deadline = Date.now() + 50000) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return { updated: 0, failed: 0, error: '서버에 NAVER_CLIENT_ID·NAVER_CLIENT_SECRET이 설정되지 않았어요.' };
  const list = (Array.isArray(ids) ? ids : []).filter(x => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
  if (!list.length) return { updated: 0, failed: 0, error: '새로고침할 키워드를 골라 주세요.' };

  const { data: rows, error } = await supabase.from('marketing_keywords').select('id, keyword').in('id', list);
  if (error) return { updated: 0, failed: 0, error: '키워드를 읽지 못했어요.' };

  const range = trendRange();
  let updated = 0;
  let failed = 0;
  let lastError = null;
  for (const row of rows || []) {
    if (deadline - Date.now() < 3000) break;
    try {
      const r = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
        body: JSON.stringify({ ...range, timeUnit: 'month', keywordGroups: [{ groupName: row.keyword.slice(0, 40), keywords: [row.keyword.slice(0, 40)] }] }),
        signal: AbortSignal.timeout(8000),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        failed++;
        lastError = explain(r.status, body);
        if (r.status === 401 || r.status === 403 || r.status === 429) break; // 키·한도 문제는 나머지도 같다
        continue;
      }
      const trend = readDatalab(body);
      const { error: e2 } = await supabase.rpc('marketing_keyword_set_trend', { p_id: row.id, p_trend: trend });
      if (e2) { failed++; lastError = '추세를 저장하지 못했어요.'; continue; }
      updated++;
    } catch (e) {
      failed++;
      lastError = e?.name === 'TimeoutError' ? '데이터랩 응답 시간 초과' : '데이터랩 호출 실패';
    }
  }
  return { updated, failed, error: lastError, range };
}
