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
import feeRemindersHandler from './_lib/routes/fee-reminders.js';
import noticeFallbackHandler from './_lib/routes/notice-fallback.js';

export default createRouter('service', {
  kakao: { handler: alimtokHandler, legacyPath: '/api/alimtok' },
  invoice: { handler: invoiceHandler, legacyPath: '/api/invoice' },
  // 수임료 납부 안내 예약 발송 — Supabase 정기 작업만 부른다 (토큰 확인)
  reminders: { handler: feeRemindersHandler, legacyPath: '/api/fee-reminders' },
  // 담당자 카톡 안내 기한이 지나면 알림톡으로 대신 보냄 (KT-2) — Supabase 정기 작업만 부른다 (토큰 확인)
  'notice-fallback': { handler: noticeFallbackHandler, legacyPath: '/api/notice-fallback' },
});
