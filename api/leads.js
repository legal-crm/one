// Vercel Serverless Function: 영업 DB 자동 접수 (SL-2)
//   POST /api/leads   — 사무소 전용 접수 키로 리드 1건 등록
//     헤더 X-Lead-Key: mkl_… (또는 본문 key)
//     본문(JSON 또는 폼): name·phone 필수, region, caseType('개인회생'|'개인파산'), debtTotal(만원), incomeNet(만원), memo, utm_*
//   응답: { ok: true } 또는 { ok: false, error }. 리드 내용은 돌려주지 않는다.
//
// 랜딩 페이지·광고 매체·대행사 폼이 다른 도메인에서 보내므로 이 함수만 모든 Origin을 허용한다.
// 보호 수단은 접수 키(사무소별, 해시만 저장)·키별 시간당 한도(DB)·IP당 분당 한도·스팸 함정 칸이다.
import { supabase } from './_lib/auth-middleware.js';
import { checkRateLimit } from './_lib/rate-limiter.js';

const MAX_BODY = 20 * 1024;
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : (typeof v === 'number' ? String(v) : ''));
const toManwon = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 10000000 ? String(Math.round(n)) : '';
};

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'object') return b;
  const text = String(b);
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch { /* 폼 */ }
  return Object.fromEntries(new URLSearchParams(text));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lead-Key');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST만 받습니다.' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ ok: false, error: '접수 서버가 설정되지 않았습니다.' });

  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : (req.socket?.remoteAddress || '');
  const limit = checkRateLimit(`leads:${ip}`, 30, 60 * 1000);
  if (limit.isLimited) return res.status(429).json({ ok: false, error: '잠시 후 다시 보내 주세요.' });

  const body = parseBody(req);
  if (body === null) return res.status(413).json({ ok: false, error: '내용이 너무 깁니다.' });

  // 스팸 함정 칸: 사람은 채우지 않는 숨김 칸이 채워져 있으면 저장하지 않고 성공처럼 응답
  if (clip(body.website, 200) || clip(body.homepage, 200)) return res.status(200).json({ ok: true });

  const key = clip(req.headers['x-lead-key'], 100) || clip(body.key, 100);
  if (!key.startsWith('mkl_')) return res.status(401).json({ ok: false, error: '접수 키가 없거나 올바르지 않습니다.' });

  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = clip(body[k], 100);
    if (v) utm[k.replace('utm_', '')] = v;
  }
  const lead = {
    customerName: clip(body.name ?? body.customerName, 40),
    phone: clip(body.phone, 20),
    region: clip(body.region, 40),
    caseType: ['개인회생', '개인파산'].includes(clip(body.caseType, 10)) ? clip(body.caseType, 10) : '',
    debtTotal: toManwon(body.debtTotal),
    incomeNet: toManwon(body.incomeNet),
    specialMemo: clip(body.memo ?? body.specialMemo, 1000),
    utm,
  };

  try {
    const { data, error } = await supabase.rpc('intake_sales_lead', { p_key: key, p_lead: lead });
    if (error) return res.status(500).json({ ok: false, error: '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    if (!data?.ok) {
      const code = data?.code;
      if (code === 'invalid_key') return res.status(401).json({ ok: false, error: '접수 키가 없거나 올바르지 않습니다.' });
      if (code === 'rate_limited') return res.status(429).json({ ok: false, error: '접수가 몰려 잠시 받을 수 없습니다.' });
      return res.status(400).json({ ok: false, error: '이름과 연락처를 확인해 주세요.' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
