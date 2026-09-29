// Vercel Serverless Function: 팝빌 통합 (카카오 알림톡·문자 + 전자세금계산서)
// docs/feature_expansion_plan.md 6-2 — Hobby 함수 12개 한도 대응으로 alimtok·invoice를 합침
//
// 기존 URL은 vercel.json rewrites로 유지된다.
//   /api/alimtok[?action=status|templates|template_mgt_url]  → /api/popbill?service=kakao
//   /api/invoice/<action>                                     → /api/popbill?service=invoice&action=<action>
// 실제 처리는 api/_lib/routes/alimtok.js, api/_lib/routes/invoice.js (통합 전 코드 그대로)

import { createRouter } from './_lib/route-dispatch.js';
import alimtokHandler from './_lib/routes/alimtok.js';
import invoiceHandler from './_lib/routes/invoice.js';

export default createRouter('service', {
  kakao: { handler: alimtokHandler, legacyPath: '/api/alimtok' },
  invoice: { handler: invoiceHandler, legacyPath: '/api/invoice' },
});
