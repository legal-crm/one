// Vercel Serverless Function: 법원 결정문/접수증 실시간 AI Vision OCR 파서
// POST /api/ocr-case

import { handleCorsPreflight } from '../cors-helper.js';
import { verifyAuth } from '../auth-middleware.js';
import { verifyTurnstileToken } from '../turnstile-validator.js';
import { withMultiTierRateLimit, RATE_LIMIT_TIERS } from '../rate-limiter.js';

async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // [SECURITY] 1. 인증 및 봇 방어 검증 (Bearer 세션 토큰 또는 Turnstile 토큰 필수)
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

  // 개발 환경 로컬 테스트 편의 지원
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

  // [SECURITY] 2. 대용량 페이로드 DoS 방어 (최대 10MB 제한)
  if (!imageBase64) {
    return res.status(400).json({ ok: false, error: '이미지 데이터(imageBase64)가 누락되었습니다.' });
  }
  if (typeof imageBase64 === 'string' && imageBase64.length > 14 * 1024 * 1024) {
    return res.status(413).json({ ok: false, error: '업로드 가능한 최대 이미지 용량(10MB)을 초과했습니다.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // 1. Google Gemini Flash Vision API 키가 있는 경우: 실제 실시간 멀티모달 OCR 실행
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
당신은 대한민국 법원의 회생·파산 공식 서류 정밀 판독 시스템입니다.
제공된 이미지가 대한민국 법원의 개인회생 또는 파산 관련 공식 서류(변제계획인가결정문, 개인회생 개시결정문, 전자소송 사건접수증, 채권자목록, 변제계획안 등)인지 엄격하게 검증하고 분석하세요.

반드시 유효한 JSON 형식으로만 결과를 출력하세요. 마크다운 기호 없이 순수 JSON만 반환하세요:
{
  "isValidCourtDoc": true 또는 false (회생·파산 법원 공식 서류이며 사건번호 식별이 가능한 경우 true, 일반 메모/홍보물/무관한 사진/영수증 등은 반드시 false),
  "recognitionStatus": "success" | "invalid_document" | "unreadable",
  "failureReason": "실패 시 구체적인 사유 (예: '법원 공식 결정문/접수증이 아닌 손글씨 메모/광고 이미지입니다', '사건번호가 누락되었거나 식별할 수 없습니다' 등. 성공 시 null)",
  "guidance": "다음 프로세스 안내 문구 (예: '선명한 법원 결정문/접수증 원본 사진을 다시 업로드하시거나, 아래 입력란에 사건번호를 직접 입력해 주세요')",
  "courtName": "관할 법원명 (예: 서울회생법원, 수원회생법원 등. 없으면 null)",
  "caseNumber": "사건번호 (예: 2024개회108492. 식별 불가 시 null)",
  "caseStage": "approved | started | submitted | preparing | null",
  "monthlyRepaymentAmount": 480000 (숫자만, 없으면 null),
  "repaymentDay": 10 (숫자 1~31, 없으면 null),
  "totalRounds": 36 (숫자 36 또는 60, 없으면 null),
  "startRepaymentDate": "2025-07 (YYYY-MM 또는 null)",
  "courtVirtualAccount": "법원 가상계좌 문자열 (없으면 null)",
  "confidenceScore": 0.95 (0.0 ~ 1.0),
  "detectedDocType": "decision_approval | decision_start | case_receipt | invalid_or_unrelated",
  "extractedHighlights": [
    "인식 결과 요약 또는 실패 원인 요약 2~3줄"
  ]
}

[판독 엄격 기준]:
1. 이미지가 법원 공식 회생/파산 서류가 아니거나, 손글씨 메모, 명함, 홍보 전단지, 웹페이지 캡처, 풍경 등 무관한 이미지인 경우:
   - 반드시 "isValidCourtDoc": false, "caseNumber": null, "detectedDocType": "invalid_or_unrelated" 로 출력하세요.
   - 절대로 가짜 사건번호나 기본 계좌번호를 임의로 지어내지 마세요.
   - failureReason에 이미지에서 확인된 내용(예: "손글씨 메모 및 채무탕감 홍보 문구로 확인됨")과 법원 공식 서류가 아닌 이유를 명시하세요.
2. 공식 서류(결정문, 접수증 등)이며 사건번호(예: 202*개회*, 202*하단*)가 명확하게 보일 때만 "isValidCourtDoc": true 로 출력하세요.
`;

      // 이전: 존재하지 않는 'gemini-3.6-flash'를 먼저 호출해 매번 1회 실패
      let candidateText = null;
      const modelNames = ['gemini-2.5-flash', 'gemini-flash-latest'];
      let usedModel = 'gemini-2.5-flash';

      for (const model of modelNames) {
        try {
          // 키는 URL 쿼리 대신 헤더로 전송`n          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
            signal: AbortSignal.timeout(15000)
          });

          if (response.ok) {
            const data = await response.json();
            candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              usedModel = model;
              break;
            }
          }
        } catch (callErr) {
          console.warn(`[Gemini model ${model} failed, trying next]`, callErr.message);
        }
      }

      if (candidateText) {
        let parsed;
        try {
          const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          parsed = JSON.parse(cleanJson);
        } catch (jsonErr) {
          console.warn('[Gemini JSON parse failed]', candidateText);
          parsed = {
            isValidCourtDoc: false,
            recognitionStatus: 'invalid_document',
            failureReason: '문서 판독 결과를 처리하는 중 오류가 발생했습니다.',
            guidance: '사건번호를 직접 입력하시거나 선명한 사진으로 다시 시도해 주세요.',
            confidenceScore: 0.1,
            detectedDocType: 'invalid_or_unrelated',
            extractedHighlights: ['문서 판독 실패']
          };
        }

        // 사건번호 유효성 및 서류 적합성 엄격 검증
        const hasValidCaseNumber = Boolean(parsed.caseNumber && String(parsed.caseNumber).trim().length >= 4 && !String(parsed.caseNumber).includes('예:'));
        if (!hasValidCaseNumber || parsed.isValidCourtDoc === false || parsed.detectedDocType === 'invalid_or_unrelated') {
          parsed.isValidCourtDoc = false;
          parsed.recognitionStatus = 'invalid_document';
          parsed.caseNumber = null;
          if (!parsed.failureReason) {
            parsed.failureReason = '법원 공식 회생·파산 결정문 또는 사건접수증이 아니거나 사건번호를 식별할 수 없습니다.';
          }
          if (!parsed.guidance) {
            parsed.guidance = '선명한 법원 결정문 사진을 다시 올려주시거나, 아래에서 사건번호를 직접 입력해 주세요.';
          }
        } else {
          parsed.isValidCourtDoc = true;
          parsed.recognitionStatus = 'success';
        }

        return res.status(200).json({
          ok: true,
          isRealAiOcr: true,
          engine: `Google Gemini Flash Vision (${usedModel})`,
          result: parsed
        });
      }
    } catch (ocrErr) {
      console.warn('[Gemini Vision OCR Error, Falling back to Heuristic Parser]', ocrErr.message);
    }
  }

  // 2. AI 키 미설정·판독 실패: 파일명으로 사건번호·가상계좌를 지어내지 않고 실패를 알린다
  //    (기존: 파일명에 '인가/개시/접수'가 있으면 가짜 사건번호·계좌를 신뢰도 0.9 이상으로 반환)
  return res.status(200).json({
    ok: true,
    isRealAiOcr: false,
    apiKeyConfigured: Boolean(geminiKey),
    result: {
      isValidCourtDoc: false,
      recognitionStatus: 'unreadable',
      failureReason: '서류를 자동으로 읽지 못했습니다.',
      guidance: '사건번호와 변제 조건을 직접 입력해 주세요.',
      confidenceScore: 0,
      detectedDocType: 'unknown',
      extractedHighlights: []
    }
  });
}

// [SECURITY] STANDARD 다단계 Rate Limiter 래핑
// Gemini 3.6 Flash Vision OCR — 건당 ~6원, 연타 방지 필수
export default withMultiTierRateLimit(handler, RATE_LIMIT_TIERS.STANDARD);
