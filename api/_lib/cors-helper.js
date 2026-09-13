// api/_lib/cors-helper.js
// ============================================================
// [SECURITY Strict CORS Policy]
// 와일드카드(*)를 완전 배제하고 공인 도메인 및 Vercel 프리뷰만 허용
// ============================================================

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://mykim.kr',
  'https://www.mykim.kr',
  'https://legal-crm-xi.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;

  // mykim 로펌 Vercel 배포 프리뷰 도메인 허용
  if (/^https:\/\/[a-zA-Z0-9_-]+-mykim\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/legal-crm[a-zA-Z0-9_-]*\.vercel\.app$/.test(origin)) return true;

  return false;
}

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  // 허용되지 않은 Origin에는 Access-Control-Allow-Origin을 아예 세팅하지 않음 (브라우저 차단)
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleCorsPreflight(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
