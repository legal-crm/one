// AI 검색 인용 점검 (M-5): 목표 질문을 Gemini(구글 검색 근거 모드)로 묻고 답변 출처에 mykim.kr이 있는지 기록한다.
// POST /api/generate-statement
//   { mode: 'geo-cron' }                      — pg_cron(pg_net)만, 헤더 x-mykim-cron (vault 토큰)
//   { mode: 'geo-check', questionId? }        — 관리자(2단계 인증) '지금 점검'
//  * 한 번에 최대 5개(시간 한도 50초), 6일 안에 점검한 질문은 건너뜀 (geo_due_questions)
//  * 기록: 인용 여부·출처 순위·함께 인용된 출처 도메인(최대 15)·답변 앞부분 600자. 질문 외 개인정보 없음
//  * 근거 링크는 구글 검색 중계 주소라 '목표 페이지' 일치는 알 수 없고 도메인만 본다

import { supabase, verifyAuth, isAdminWithMfa } from '../auth-middleware.js';
import { textModels } from '../marketing-engine.js';

const SITE_DOMAIN = 'mykim.kr';
const geminiKey = () => process.env.GEMINI_API_KEY_EDITOR || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

const domainOf = (title, uri) => {
  const t = String(title || '').trim().toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(t)) return t.replace(/^www\./, '');
  try { return new URL(String(uri || '')).hostname.replace(/^www\./, ''); } catch { return t.slice(0, 80); }
};

/** Gemini 검색 근거 응답 → 출처 목록·인용 여부 (시험용으로 내보냄) */
export function readGrounding(data) {
  const cand = data?.candidates?.[0] || {};
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];
  for (const c of chunks) {
    const web = c?.web;
    if (!web) continue;
    const domain = domainOf(web.title, web.uri);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    sources.push({ domain, title: String(web.title || '').slice(0, 120) });
  }
  const idx = sources.findIndex(s => s.domain === SITE_DOMAIN || s.domain.endsWith(`.${SITE_DOMAIN}`));
  const text = (cand?.content?.parts || []).map(p => p?.text || '').join('').replace(/\s+/g, ' ').trim();
  return { sources: sources.slice(0, 15), sourceCount: sources.length, cited: idx >= 0, citedRank: idx >= 0 ? idx + 1 : null, answer: text.slice(0, 600) };
}

async function askOne(question, deadline) {
  const key = geminiKey();
  if (!key) return { ok: false, error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' };
  let lastErr = 'AI 응답 오류';
  for (const model of textModels()) {
    const remaining = deadline - Date.now();
    if (remaining < 8000) return { ok: false, error: '시간이 부족해 다음 차례로 넘겼습니다.', skipped: true };
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: question }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(Math.min(30000, remaining - 2000)),
      });
      if (!r.ok) { lastErr = `AI 응답 오류 (${r.status})`; continue; } // 다음 모델로
      const g = readGrounding(await r.json());
      return { ok: true, model, ...g };
    } catch (e) {
      lastErr = e?.name === 'TimeoutError' ? 'AI 응답 시간 초과' : 'AI 호출 실패';
    }
  }
  return { ok: false, error: lastErr };
}

export async function handleGeoCheck(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, error: 'server key missing' });
  const mode = req.body?.mode;
  let trigger = 'cron';
  if (mode === 'geo-cron') {
    const token = String(req.headers['x-mykim-cron'] || '');
    const { data: okToken, error } = await supabase.rpc('check_cron_token', { p_token: token });
    if (error || okToken !== true) return res.status(401).json({ ok: false, error: 'unauthorized' });
  } else {
    let user = null;
    try { user = await verifyAuth(req); } catch { user = null; }
    if (!user || !isAdminWithMfa(req, user)) return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 사용할 수 있습니다.' });
    trigger = 'manual';
  }

  const qid = typeof req.body?.questionId === 'string' && /^[0-9a-f-]{36}$/.test(req.body.questionId) ? req.body.questionId : null;
  const { data: due, error: dueErr } = await supabase.rpc('geo_due_questions', { p_limit: qid ? 1 : 5, p_force_id: qid });
  if (dueErr) return res.status(500).json({ ok: false, error: '점검할 질문을 읽지 못했습니다.' });

  const deadline = Date.now() + 50000;
  const results = [];
  for (const q of due || []) {
    const r = await askOne(q.question, deadline);
    if (r.skipped) break; // 시간이 모자라면 기록하지 않고 다음 호출로
    await supabase.rpc('geo_record_check', {
      p_question_id: q.id,
      p: {
        model: r.model || null, ok: r.ok, cited: !!r.cited, cited_rank: r.citedRank || null, source_count: r.sourceCount || 0,
        sources: r.sources || [], answer_excerpt: r.answer || null, error: r.ok ? null : r.error, trigger_kind: trigger,
      },
    });
    results.push({ id: q.id, ok: r.ok, cited: !!r.cited, rank: r.citedRank || null, error: r.ok ? undefined : r.error });
  }
  return res.status(200).json({ ok: true, checked: results.length, results });
}
