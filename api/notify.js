// Vercel Serverless Function: 알림 발송 통합 (텔레그램·슬랙 + 이메일)
// docs/feature_expansion_plan.md 6-2 — Hobby 함수 12개 한도 대응으로 telegram·send-email을 합침
// 웹 푸시(기능 2번)는 이 함수에 channel=push로 추가한다.
//
// 기존 URL은 vercel.json rewrites로 유지된다.
//   /api/telegram    → /api/notify?channel=telegram
//   /api/send-email  → /api/notify?channel=email
// 실제 처리는 api/_lib/routes/telegram.js, api/_lib/routes/send-email.js (통합 전 코드 그대로)

import { createRouter } from './_lib/route-dispatch.js';
import telegramHandler from './_lib/routes/telegram.js';
import sendEmailHandler from './_lib/routes/send-email.js';

export default createRouter('channel', {
  telegram: { handler: telegramHandler, legacyPath: '/api/telegram' },
  email: { handler: sendEmailHandler, legacyPath: '/api/send-email' },
});
