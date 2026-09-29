// Vercel Serverless Function: CODEF 중계 통합 (대법원 나의사건검색 + 숨은 채무 조회)
// docs/feature_expansion_plan.md 6-2 — Hobby 함수 12개 한도 대응으로 scourt-proxy·debt-discovery를 합침
//
// 기존 URL은 vercel.json rewrites로 유지된다.
//   /api/scourt-proxy    → /api/codef?product=scourt
//   /api/debt-discovery  → /api/codef?product=debt
// 실제 처리는 api/_lib/routes/scourt-proxy.js, api/_lib/routes/debt-discovery.js (통합 전 코드 그대로)
// ⚠️ debt-discovery는 실연동이 없어 항상 시연 데이터를 돌려준다. 출시 범위에서 빼면 이 라우트를 지운다.

import { createRouter } from './_lib/route-dispatch.js';
import scourtHandler from './_lib/routes/scourt-proxy.js';
import debtDiscoveryHandler from './_lib/routes/debt-discovery.js';

export default createRouter('product', {
  scourt: { handler: scourtHandler, legacyPath: '/api/scourt-proxy' },
  debt: { handler: debtDiscoveryHandler, legacyPath: '/api/debt-discovery' },
});
