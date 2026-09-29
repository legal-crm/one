// ============================================================
// [SEO] IndexNow 즉시 색인 요청 (Bing·Naver 등 IndexNow 참여 검색엔진)
// ------------------------------------------------------------
// - 관리자(2단계 인증)만 호출 — generate-statement.js 의 mode: 'indexnow' 로 라우팅
//   (Vercel Hobby 함수 12개 한도 때문에 새 함수를 만들지 않음)
// - 키는 공개값이다. https://mykim.kr/<키>.txt 파일 내용과 같아야 검색엔진이 요청을 받아들인다.
// - 이전: 관리자 화면의 'IndexNow 즉시 푸시' 버튼은 아무 요청도 보내지 않고 메모만 남겼다.
// ============================================================
import { verifyAuth, isAdminWithMfa, supabase } from './auth-middleware.js';

export const INDEXNOW_DEFAULT_KEY = '5283c27badad10634284ba2943977400';
const HOST = 'mykim.kr';
const MAX_URLS = 100;

const ENDPOINTS = [
  { engine: 'IndexNow (Bing 외 공유)', url: 'https://api.indexnow.org/indexnow' },
  { engine: 'Naver', url: 'https://searchadvisor.naver.com/indexnow' },
];

const STATUS_TEXT = {
  200: '접수됨',
  202: '접수됨 (키 확인 대기)',
  400: '요청 형식 오류',
  403: '키가 유효하지 않음 (키 파일 확인 필요)',
  422: 'URL이 이 사이트 소속이 아님',
  429: '요청이 너무 많음 (잠시 후 재시도)',
};

/** 같은 호스트의 https URL만, 중복 제거 */
export function normalizeIndexNowUrls(input) {
  const list = Array.isArray(input) ? input : [];
  const out = new Set();
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    try {
      const u = new URL(raw.trim());
      if (u.protocol !== 'https:' || u.hostname !== HOST) continue;
      u.hash = '';
      out.add(u.toString());
    } catch { /* 무시 */ }
    if (out.size >= MAX_URLS) break;
  }
  return [...out];
}

export async function handleIndexNow(req, res) {
  let user = null;
  try { user = await verifyAuth(req); } catch { user = null; }
  if (!user || !isAdminWithMfa(req, user)) {
    return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 사용할 수 있습니다.' });
  }

  const key = String(process.env.INDEXNOW_KEY || INDEXNOW_DEFAULT_KEY).trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return res.status(500).json({ ok: false, error: 'INDEXNOW_KEY 형식이 올바르지 않습니다.' });
  }
  const urls = normalizeIndexNowUrls(req.body?.urls);
  if (urls.length === 0) {
    return res.status(400).json({ ok: false, error: `https://${HOST}/ 로 시작하는 URL을 1개 이상 입력해 주세요.` });
  }

  const payload = JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls });
  const results = await Promise.all(ENDPOINTS.map(async ep => {
    try {
      const r = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });
      return { engine: ep.engine, status: r.status, ok: r.status === 200 || r.status === 202, message: STATUS_TEXT[r.status] || `HTTP ${r.status}` };
    } catch (e) {
      return { engine: ep.engine, status: 0, ok: false, message: e?.name === 'TimeoutError' ? '응답 시간 초과' : '연결 실패' };
    }
  }));

  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : (req.socket?.remoteAddress || '');
  await supabase.from('audit_logs').insert({
    actor_id: user.email || user.id, actor_role: 'admin', action: 'seo_indexnow_submit',
    target_type: 'seo_urls', target_id: `${urls.length} urls: ${urls[0]}`.slice(0, 250),
    auth_uid: user.id, auth_email: user.email || null, ip_address: ip || null,
  }).then(() => {}, () => {});

  return res.status(200).json({ ok: results.some(r => r.ok), urls, results });
}
