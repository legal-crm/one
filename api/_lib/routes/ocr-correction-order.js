// Vercel Serverless Function: 법원 보정권고서/보정명령서 AI Vision OCR 질문별 분할 파서
// POST /api/ocr?kind=correction  (레거시: /api/ocr-correction-order)
//
// 입력: 보정권고서 스캔본/PDF 이미지 (imageBase64)
// 출력: 질문 항목별 분할 + 7대 표준 보정 템플릿 자동 매핑 결과

import { handleCorsPreflight } from '../cors-helper.js';
import { verifyAuth } from '../auth-middleware.js';
import { verifyTurnstileToken } from '../turnstile-validator.js';
import { maskPiiInObject } from '../pii-masking.js';

// 7대 표준 보정명령 카테고리 → 템플릿 ID 매핑
const CORRECTION_CATEGORY_MAP = {
  LOAN: 'TPL_01_LOAN_USAGE',
  WITHDRAWAL: 'TPL_02_HIGH_VALUE_WITHDRAWAL',
  PREFERENTIAL: 'TPL_03_FAMILY_PREFERENTIAL',
  SPECULATION: 'TPL_04_SPECULATION_CRYPTO',
  SPOUSE: 'TPL_05_SPOUSE_ASSET',
  INCOME: 'TPL_06_INCOME_RECALCULATION',
  INSURANCE: 'TPL_07_INSURANCE_SURRENDER',
  DOCUMENT: null, // 서류 제출 요구 — 별도 템플릿 없이 "첨부하여 제출합니다" 초안
  OTHER: null,     // 기타 — 수동 작성 필요
};

async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // [SECURITY] 1. 인증 검증
  const authHeader = req.headers.authorization;
  const cfToken = req.body?.turnstileToken || req.headers['x-turnstile-token'];

  let isAuthorized = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const user = await verifyAuth(req);
      if (user) isAuthorized = true;
    } catch (_) {}
  }

  if (!isAuthorized && cfToken) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
    const cfCheck = await verifyTurnstileToken(cfToken, ip);
    if (cfCheck.success) isAuthorized = true;
  }

  if (!isAuthorized && process.env.NODE_ENV === 'development') {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return res.status(401).json({
      ok: false,
      error: '인증 토큰(Bearer) 또는 보안 인증(Turnstile)이 필요합니다.'
    });
  }

  const { imageBase64, fileName = '' } = req.body || {};

  // [SECURITY] 2. 페이로드 크기 제한 (최대 10MB)
  if (!imageBase64) {
    return res.status(400).json({ ok: false, error: '이미지 데이터(imageBase64)가 누락되었습니다.' });
  }
  if (typeof imageBase64 === 'string' && imageBase64.length > 14 * 1024 * 1024) {
    return res.status(413).json({ ok: false, error: '업로드 가능한 최대 이미지 용량(10MB)을 초과했습니다.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (geminiKey && imageBase64) {
    try {
      // Data URL에서 mimeType과 순수 base64 분리
      let mimeType = 'image/jpeg';
      let cleanBase64 = imageBase64;
      if (imageBase64.startsWith('data:')) {
        const parts = imageBase64.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        cleanBase64 = parts[1] || '';
      }

      const promptText = `
당신은 대한민국 법원의 개인회생·파산 보정권고서/보정명령서 전문 분석 시스템입니다.
제공된 이미지는 법원이 채무자에게 보낸 보정권고서 또는 보정명령서입니다.

이 문서에서 다음 정보를 정밀하게 추출하세요:

1. 법원명 (예: 서울회생법원, 수원회생법원)
2. 사건번호 (예: 2024개회108492)
3. 보정 제출 기한일 (YYYY-MM-DD 형식)
4. 각 요구사항을 **개별 질문 항목(item)**으로 분할

각 질문 항목에 대해 다음을 판별하세요:
- 번호 또는 순서
- 법원 지시 원문
- 아래 카테고리 중 하나로 분류:
  * LOAN — 최근 대출금 사용처 소명 요구
  * WITHDRAWAL — 고액 출금(100만원+) 사용처 소명 요구
  * PREFERENTIAL — 친인척/지인 편파변제 소명 요구
  * SPECULATION — 주식/코인/도박 손실 소명 요구
  * SPOUSE — 배우자 재산/소득 소명 요구
  * INCOME — 소득 재산정/가용소득 소명 요구
  * INSURANCE — 보험 해약환급금 소명 요구
  * DOCUMENT — 서류 제출 요구 (소명이 아닌 첨부 제출)
  * OTHER — 위 카테고리에 해당하지 않는 기타

반드시 순수 JSON 형식으로만 응답하세요 (마크다운 백틱 없이):
{
  "isValidCorrectionOrder": true,
  "courtName": "서울회생법원",
  "caseNumber": "2024개회108492",
  "dueDate": "2026-10-15",
  "totalItems": 3,
  "items": [
    {
      "itemNumber": 1,
      "instruction": "법원 지시 원문 그대로",
      "category": "LOAN",
      "requiredEvidence": "필요한 증빙자료 목록",
      "isDocumentSubmission": false
    }
  ],
  "confidenceScore": 0.95,
  "failureReason": null
}

[판독 규칙]:
1. 문서가 법원 보정권고서/보정명령서가 아닌 경우 "isValidCorrectionOrder": false로 출력하세요.
2. 항목 번호가 명시되지 않은 경우 문단 단위로 분할하여 순서를 부여하세요.
3. 하나의 항목에 여러 요구가 포함된 경우(예: "A를 소명하고, B도 제출할 것") 개별 항목으로 분리하세요.
4. 서류에 없는 정보는 null로 두세요. 절대로 사건번호나 기한을 지어내지 마세요.
`;

      let candidateText = null;
      const modelNames = ['gemini-2.5-flash', 'gemini-flash-latest'];

      for (const model of modelNames) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: cleanBase64
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                response_mime_type: 'application/json'
              }
            }),
            signal: AbortSignal.timeout(20000)
          });

          if (response.ok) {
            const data = await response.json();
            candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) break;
          }
        } catch (callErr) {
          console.warn(`[Gemini model ${model} failed for correction OCR]`, callErr.message);
        }
      }

      if (candidateText) {
        try {
          const parsed = JSON.parse(candidateText);

          // 7대 표준 템플릿 자동 매핑
          if (parsed.items && Array.isArray(parsed.items)) {
            parsed.items = parsed.items.map(item => {
              const templateId = CORRECTION_CATEGORY_MAP[item.category] || null;

              // 카테고리별 자동 초안 답변 생성
              let autoDraftResponse = '';
              if (item.isDocumentSubmission || item.category === 'DOCUMENT') {
                autoDraftResponse = '위 요구 서류를 첨부하여 제출합니다.';
              } else if (templateId) {
                // 템플릿이 있는 경우 프론트에서 correctionAutomationService의 STANDARD_CORRECTION_TEMPLATES로 채움
                autoDraftResponse = `[${item.category} 표준 템플릿 자동 적용 예정]`;
              }

              return {
                ...item,
                matchedTemplateId: templateId,
                autoDraftResponse,
              };
            });
          }

          // v2.0: 주민번호 뒷자리 자동 마스킹 (개인정보 보호)
          const maskedResult = maskPiiInObject(parsed);

          return res.status(200).json({
            ok: true,
            ...maskedResult,
            source: 'gemini-vision',
          });
        } catch (parseErr) {
          console.error('[Correction OCR parse error]', parseErr.message, candidateText?.slice(0, 200));
          return res.status(200).json({
            ok: false,
            isValidCorrectionOrder: false,
            failureReason: 'AI 응답 파싱 실패 — 보정권고서를 다시 촬영해 주세요.',
            rawText: candidateText?.slice(0, 500),
          });
        }
      }
    } catch (err) {
      console.error('[Correction OCR error]', err.message);
    }
  }

  // Gemini API 키가 없거나 실패한 경우 — 수동 입력 폴백 안내
  return res.status(200).json({
    ok: false,
    isValidCorrectionOrder: false,
    failureReason: 'AI Vision API를 사용할 수 없습니다. 보정권고 항목을 수동으로 입력해 주세요.',
    items: [],
  });
}

export default handler;
