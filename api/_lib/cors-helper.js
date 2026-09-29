// api/_lib/cors-helper.js
// ============================================================
// [SECURITY Strict CORS Policy]
// 와일드카드(*)를 배제하고 공인 도메인만 허용한다.
//
// [PART 4] 변경
// - 운영 배포(VERCEL_ENV=production)에서는 *.vercel.app 패턴을 허용하지 않는다.
//   이전: `*-mykim.vercel.app`, `legal-crm*.vercel.app` 패턴을 운영에서도 허용 → 누구나 같은 이름 규칙의
//   Vercel 프로젝트를 만들어 허용 Origin을 얻을 수 있었다.
//   프리뷰 도메인 패턴은 프리뷰/개발 배포의 API에서만 허용한다.
// - 추가 Origin은 환경변수 CORS_ALLOWED_ORIGINS(쉼표 구분)로 지정한다.
// - Access-Control-Allow-Credentials를 보내지 않는다. 인증은 쿠키가 아니라 Authorization Bearer 헤더라 필요 없다.
// - CORS는 브라우저 제한일 뿐 접근 제어가 아니다. 각 API의 인증·Turnstile·Rate Limit이 실제 보호 수단이다.
// ============================================================

const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://mykim.kr',
  'https://www.mykim.kr',
  'https://legal-crm-xi.vercel.app',
  ...(IS_PRODUCTION ? [] : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']),
  ...String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s)),
]);

const PREVIEW_ORIGIN_PATTERNS = [
  /^https:\/\/[a-zA-Z0-9_-]+-mykim\.vercel\.app$/,
  /^https:\/\/legal-crm[a-zA-Z0-9_-]*\.vercel\.app$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  if (!IS_PRODUCTION && PREVIEW_ORIGIN_PATTERNS.some(re => re.test(origin))) return true;
  return false;
}

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // 허용되지 않은 Origin에는 Access-Control-Allow-Origin을 아예 세팅하지 않음 (브라우저 차단)

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Turnstile-Token');
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
