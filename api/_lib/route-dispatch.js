// ============================================================
// 통합 함수 라우터 (Vercel Hobby 배포당 함수 12개 한도 대응)
// docs/feature_expansion_plan.md 6-2
// ------------------------------------------------------------
// 의존성이 같은 API를 함수 하나로 합치고, 기존 URL은 vercel.json rewrites로 유지한다.
//   예) /api/ocr-case  →(rewrite)→  /api/ocr?kind=case
//
// 라우트 결정 순서
//   1) 쿼리 파라미터(rewrite destination이 붙인 값)  예: kind=case
//   2) 원래 요청 경로(legacyPath)                   예: /api/ocr-case
//      (Vercel이 rewrite 뒤에도 원래 경로를 req.url에 남기는 경우 대비)
//
// 핸들러에는 통합 전과 같은 경로(legacyPath)로 보이게 req.url을 맞춘다.
//   - rate limiter 키(ip + 경로)가 API별로 분리된 채 유지된다.
//   - invoice의 '/api/invoice/<action>' 경로 판별, alimtok의 ?action= 판별이 그대로 동작한다.
// ============================================================

import { setCorsHeaders } from './cors-helper.js';

const BASE_URL = 'https://mykim.kr';

function firstString(v) {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
  return typeof v === 'string' ? v : '';
}

function pathMatches(pathname, legacyPath) {
  return pathname === legacyPath || pathname.startsWith(`${legacyPath}/`);
}

function parseUrl(raw) {
  try {
    return new URL(raw || '/', BASE_URL);
  } catch {
    return new URL('/', BASE_URL);
  }
}

/**
 * @param {string} param  라우트 이름을 담는 쿼리 파라미터 (예: 'kind')
 * @param {Record<string, { handler: (req: any, res: any) => any, legacyPath: string }>} routes
 */
export function createRouter(param, routes) {
  const names = Object.keys(routes);

  return async function routedHandler(req, res) {
    const url = parseUrl(req.url);

    const fromQuery = firstString(req.query?.[param]) || url.searchParams.get(param) || '';
    let name = names.includes(fromQuery) ? fromQuery : '';
    if (!name) {
      name = names.find((n) => pathMatches(url.pathname, routes[n].legacyPath)) || '';
    }

    if (!name) {
      setCorsHeaders(req, res);
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(404).json({ ok: false, error: '알 수 없는 API 경로입니다.' });
    }

    const route = routes[name];
    if (!pathMatches(url.pathname, route.legacyPath)) {
      url.searchParams.delete(param);
      const qs = url.searchParams.toString();
      req.url = `${route.legacyPath}${qs ? `?${qs}` : ''}`;
    }
    return route.handler(req, res);
  };
}
