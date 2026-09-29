// Vercel Serverless Function: AI Vision OCR 통합 (법원 결정문·접수증 + 등본·가족관계증명서·경력 서류)
// docs/feature_expansion_plan.md 6-2 — Hobby 함수 12개 한도 대응으로 ocr-case·ocr-family를 합침
//
// 기존 URL은 vercel.json rewrites로 유지된다.
//   /api/ocr-case    → /api/ocr?kind=case
//   /api/ocr-family  → /api/ocr?kind=family   (본문의 mode: 'job_history' 등은 그대로 전달)
// 실제 처리는 api/_lib/routes/ocr-case.js, api/_lib/routes/ocr-family.js (통합 전 코드 그대로)
// 라우트 파라미터를 'kind'로 둔 이유: ocr-family가 요청 본문에서 이미 'mode'를 쓴다.

import { createRouter } from './_lib/route-dispatch.js';
import ocrCaseHandler from './_lib/routes/ocr-case.js';
import ocrFamilyHandler from './_lib/routes/ocr-family.js';

export default createRouter('kind', {
  case: { handler: ocrCaseHandler, legacyPath: '/api/ocr-case' },
  family: { handler: ocrFamilyHandler, legacyPath: '/api/ocr-family' },
});
