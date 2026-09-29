// Vercel Serverless Function: 개인회생·파산 진술서 Gemini 2.5 AI 작성 및 윤문 엔드포인트
// POST /api/generate-statement

import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth, isAdminWithMfa, supabase } from './_lib/auth-middleware.js';
import { verifyTurnstileToken } from './_lib/turnstile-validator.js';
import { withMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';
import { handleIndexNow } from './_lib/indexnow.js';

// ─────────────────────────────────────────────────────────────
// [PART 3-7] 관리자 마케팅 칼럼 생성 (mode: 'marketing' | 'marketing-ping')
//   - Gemini 키는 서버 환경변수만 사용 (이전: 관리자 브라우저 localStorage 평문 저장 + URL 쿼리로 전송)
//   - 관리자(2단계 인증)만 호출 가능
//   - 프롬프트에 결과 보장·근거 없는 수치·"100% 준수" 같은 단정 표현 금지를 명시
// ─────────────────────────────────────────────────────────────
const clipText = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

function buildMarketingPrompt(topic, theme) {
  return `당신은 대한민국 개인회생·파산 정보 칼럼 작가입니다. 아래 주제로 네이버 블로그용 정보성 칼럼을 작성하세요.
주제: "${topic}"
강조 테마: "${theme}"

반드시 지킬 것 (변호사 광고 규정·표시광고법):
- 결과를 보장하거나 단정하지 않는다 (예: "100% 탕감", "무조건 면책", "경매 없이 보장", "스팸 0통 보장" 금지)
- 근거 없는 수치·통계·성공률·"국내 유일"·"특허" 같은 표현을 쓰지 않는다
- "변호사법 100% 준수", "검수 완료" 같은 자기 인증 문구를 쓰지 않는다
- 법원 판단은 사건마다 다르다는 점과, 개별 사안은 변호사 상담이 필요하다는 점을 본문에 밝힌다
- 플랫폼 기능은 사실만 설명한다: 의뢰인이 변호사를 직접 선택, 상담 시 가명 사용 가능, 수임은 선택한 법률사무소가 수행

아래 JSON만 반환하세요:
{
  "title": "검색 친화적 제목 (과장 금지)",
  "summary": "핵심 요약 1~2문장",
  "answerFirst": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
  "fullBody": "1,800자 이상 본문. 중간에 [📷 이미지 1]~[📷 이미지 4] 위치 표시",
  "blogImages": [
    { "title": "대표 썸네일 제목", "role": "역할", "insertPosition": "본문 최상단", "prompt": "English image prompt, no text", "previewTitle": "12~18자 헤드라인", "previewSub": "20~30자 설명", "tag": "대표 썸네일 (1080x1080)" },
    { "title": "비교 인포그래픽", "role": "역할", "insertPosition": "본문 2번 섹션", "prompt": "English prompt", "previewTitle": "헤드라인", "previewSub": "설명", "tag": "비교 인포그래픽" },
    { "title": "앱 화면", "role": "역할", "insertPosition": "본문 3번 섹션", "prompt": "English prompt", "previewTitle": "헤드라인", "previewSub": "설명", "tag": "앱 UI 목업" },
    { "title": "상담 안내 배너", "role": "역할", "insertPosition": "본문 최하단", "prompt": "English prompt", "previewTitle": "헤드라인", "previewSub": "설명", "tag": "전환 CTA 배너" }
  ],
  "hashtags": ["#개인회생", "#개인파산"]
}`;
}

async function handleMarketing(req, res) {
  let user = null;
  try { user = await verifyAuth(req); } catch (_) { user = null; }
  if (!user || !isAdminWithMfa(req, user)) {
    return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 사용할 수 있습니다.' });
  }
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return res.status(200).json({ ok: false, configured: false, error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }
  if (req.body?.mode === 'marketing-ping') {
    return res.status(200).json({ ok: true, configured: true });
  }
  const topic = clipText(req.body?.topic, 200);
  const theme = clipText(req.body?.theme, 60);
  if (!topic) return res.status(400).json({ ok: false, error: '주제를 입력해 주세요.' });

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildMarketingPrompt(topic, theme) }] }],
        generationConfig: { temperature: 0.4, response_mime_type: 'application/json' },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return res.status(200).json({ ok: false, error: `AI 응답 오류 (${r.status})` });
    const data = await r.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ ok: true, content: parsed });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'AI 생성에 실패했습니다.' });
  }
}

// ─────────────────────────────────────────────────────────────
// [PART 4] 통화 녹음 요약 (mode: 'call-summary')
//   이전: 변호사 브라우저가 localStorage/VITE_ 번들에 있는 Gemini 키로 Google에 직접 녹음 파일을 전송
//   현재: 승인된 변호사(직원 포함) 또는 관리자(2단계 인증)만, 서버 키로 호출. 모델은 서버 허용 목록에서만 선택.
//   Vercel 요청 본문 한도(약 4.5MB) 때문에 오디오 base64는 4MB까지만 받는다.
// ─────────────────────────────────────────────────────────────
const CALL_SUMMARY_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];
const CALL_SUMMARY_MAX_BASE64 = 4 * 1024 * 1024;
const AUDIO_MIME_ALLOW = /^audio\/(mpeg|mp3|mp4|m4a|x-m4a|aac|wav|x-wav|webm|ogg|amr|3gpp)$/;

async function handleCallSummary(req, res) {
  let user = null;
  try { user = await verifyAuth(req); } catch (_) { user = null; }
  if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
  if (!isAdminWithMfa(req, user)) {
    const { data: account, error: accountError } = await supabase
      .from('lawyer_accounts')
      .select('approved')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (accountError || !account?.approved) {
      return res.status(403).json({ ok: false, error: '승인된 변호사 계정만 통화 요약을 사용할 수 있습니다.' });
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return res.status(503).json({ ok: false, configured: false, error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const { audioBase64, mimeType, prompt } = req.body || {};
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    return res.status(400).json({ ok: false, error: '녹음 파일이 없습니다.' });
  }
  if (audioBase64.length > CALL_SUMMARY_MAX_BASE64) {
    return res.status(413).json({ ok: false, error: '녹음 파일이 너무 큽니다. 약 3MB 이하 파일만 요약할 수 있습니다.' });
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(audioBase64.slice(0, 2000))) {
    return res.status(400).json({ ok: false, error: '녹음 파일 형식이 올바르지 않습니다.' });
  }
  const safeMime = typeof mimeType === 'string' && AUDIO_MIME_ALLOW.test(mimeType) ? mimeType : 'audio/mpeg';
  const promptText = typeof prompt === 'string' ? prompt.slice(0, 12000) : '';
  if (!promptText.trim()) return res.status(400).json({ ok: false, error: '요약 지시문이 없습니다.' });

  // 함수 최대 실행 시간(vercel.json maxDuration 60초) 안에서만 재시도
  const deadline = Date.now() + 52000;
  for (const model of CALL_SUMMARY_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 8000) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: safeMime, data: audioBase64 } }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(remaining),
      });
      if (!r.ok) {
        console.warn(`[call-summary] ${model} HTTP ${r.status}`);
        continue;
      }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return res.status(200).json({ ok: true, text, model });
    } catch (e) {
      console.warn(`[call-summary] ${model} failed`, e?.message);
    }
  }
  return res.status(200).json({ ok: false, error: 'AI가 요약을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
}

async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (req.body?.mode === 'marketing' || req.body?.mode === 'marketing-ping') {
    return handleMarketing(req, res);
  }
  if (req.body?.mode === 'call-summary') {
    return handleCallSummary(req, res);
  }
  // [SEO] 관리자 IndexNow 즉시 색인 요청 (함수 개수 한도로 이 함수에 둠)
  if (req.body?.mode === 'indexnow') {
    return handleIndexNow(req, res);
  }

  // [SECURITY] 인증 및 봇 방어 검증 (Bearer 세션 토큰 또는 Turnstile 토큰 필수)
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

  // [PART 4] 입력 길이·형식 제한 (이전: 길이 제한 없음, selectedKeywords가 배열이 아니면 .join에서 500)
  const body = req.body || {};
  const caseType = body.caseType === 'bankruptcy' ? 'bankruptcy' : 'rehab';
  const applicantName = clipText(body.applicantName, 40) || '신청인';
  const rawVoiceOrText = typeof body.rawVoiceOrText === 'string' ? body.rawVoiceOrText.slice(0, 8000) : '';
  const selectedKeywords = Array.isArray(body.selectedKeywords)
    ? body.selectedKeywords.map(k => clipText(k, 40)).filter(Boolean).slice(0, 20)
    : [];
  const totalDebtAmount = Number.isFinite(Number(body.totalDebtAmount)) ? Number(body.totalDebtAmount) : 0;
  const monthlyIncome = Number.isFinite(Number(body.monthlyIncome)) ? Number(body.monthlyIncome) : 0;
  const tone = ['formal', 'concise', 'emotional'].includes(body.tone) ? body.tone : 'formal';
  const courtName = clipText(body.courtName, 40) || '회생법원';
  let interviewAnswers = null;
  if (body.interviewAnswers && typeof body.interviewAnswers === 'object') {
    interviewAnswers = {};
    for (const k of ['upbringing', 'healthAndMedical', 'firstDebtCause', 'debtGrowthProcess', 'insolvencyCrisis', 'futureResolution']) {
      if (typeof body.interviewAnswers[k] === 'string') interviewAnswers[k] = body.interviewAnswers[k].slice(0, 2000);
    }
  }

  const hasInterviewAnswers = interviewAnswers && Object.values(interviewAnswers).some(v => typeof v === 'string' && v.trim().length > 0);

  if (!rawVoiceOrText && (!selectedKeywords || selectedKeywords.length === 0) && !hasInterviewAnswers) {
    return res.status(400).json({ ok: false, error: '입력된 내용 또는 선택된 키워드가 없습니다.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // AI 연동 실패 시 규칙 기반 정교한 Fallback 진술서 생성 헬퍼
  const generateRuleBasedFallback = () => {
    const isRehab = caseType === 'rehab';
    const kwText = selectedKeywords.length > 0 ? selectedKeywords.join(', ') : '생계 곤란 및 불가피한 지출';
    const ia = interviewAnswers || {};
    
    const upbringingPart = ia.upbringing ? `신청인은 과거 ${ia.upbringing}의 환경 속에서 자라며 성실히 생활하고자 하였으나, ` : '';
    const medicalPart = ia.healthAndMedical && !ia.healthAndMedical.includes('문제 없음') ? `또한 ${ia.healthAndMedical} 등의 심각한 건강 및 의료비 지출이 겹치면서 ` : '';
    const firstDebtPart = ia.firstDebtCause ? `${ia.firstDebtCause} 등의 사유로 인하여 ` : `${kwText} 등으로 인해 `;
    
    const initialCause = `${upbringingPart}${medicalPart}신청인 ${applicantName}은(는) ${firstDebtPart}가계 수지 및 생계 유지가 급격히 악화되었고, 부족한 생활비와 고정지출을 충당하고자 부득이하게 최초 금융기관 대출 및 신용카드를 이용하게 되었습니다.`;
    
    const growthPart = ia.debtGrowthProcess ? `${ia.debtGrowthProcess} 등으로 인하여 ` : '기존 채무의 연체를 막고자 대출 돌려막기와 카드론을 추가로 이용하게 되었으며, ';
    const growthProcess = `그러나 이후 경기 침체 및 이자 부담이 가중되면서, 매월 발생하는 원리금을 정상적으로 감당하기 어려운 상황에 직면하였습니다. ${growthPart}이로 인해 채무 원금과 고율의 이자가 눈덩이처럼 증대되었습니다.`;
    
    const crisisPart = ia.insolvencyCrisis ? `${ia.insolvencyCrisis} 등의 상황에 직면하여 ` : '';
    const insolvencyTrigger = `결국 ${crisisPart}원리금 상환액이 월 가용소득을 훨씬 초과하게 되었고, 일상적인 최저생계비조차 유지하기 힘든 한계 상황에 도달하였습니다. 더 이상의 추가 대출이나 사적 변제가 불가능하여 최종적으로 지급불능 상태에 이르게 되었습니다.`;
    
    const resPart = ia.futureResolution ? `${ia.futureResolution} 등의 각오로 ` : '';
    const resolution = isRehab
      ? `신청인은 자신의 부주의와 능력 부족으로 채권자분들께 큰 심려와 경제적 피해를 끼쳐드린 점을 뼈저리게 반성하고 있습니다. ${resPart}법원에서 인가하여 주시는 변제계획에 따라 어떠한 어려움이 있더라도 매월 변제금을 성실히 납부하여 채무를 완제하고 갱생할 것을 엄숙히 서약합니다.`
      : `신청인은 감당할 수 없는 채무로 인해 채권자분들께 막대한 고통과 피해를 드리게 된 점을 머리 숙여 사죄드립니다. ${resPart}현재의 건강 상태와 경제적 여건으로는 도저히 채무를 변제할 길이 없어 부득이 파산 및 면책을 신청하오니, 다시금 사회의 일원으로 재기할 수 있도록 부디 선처하여 주시기를 간곡히 호소합니다.`;

    const fullFormattedText = `[지급불능에 이르게 된 구체적 사정]

1. 채무 발생의 원인
${initialCause}

2. 채무가 증대된 구체적 경위
${growthProcess}

3. 지급불능에 이르게 된 결정적 사정
${insolvencyTrigger}

4. 신청인의 반성과 향후 다짐
${resolution}`;

    return {
      ok: true,
      sections: {
        initialCause,
        growthProcess,
        insolvencyTrigger,
        resolution
      },
      fullFormattedText,
      safetyWarnings: [],
      suggestedKeywords: selectedKeywords,
      source: 'rule_based_engine'
    };
  };

  // 1. Gemini API 키가 있는 경우 Gemini 2.5 Flash 호출
  if (geminiKey) {
    try {
      const isRehab = caseType === 'rehab';
      const prompt = `
당신은 대한민국 법원 회생·파산 실무에 정통한 최고 수준의 법률 전문가입니다.
의뢰인(고객)이 모바일 음성 인식이나 거친 일상 메모로 털어놓은 사연을 바탕으로, 대한민국 법원(회생법원/지방법원) 재판부 판사 및 파산관재인에게 제출할 공식 【진술서】를 완성도 높은 법률 문체로 작성해주세요.

[사건 및 의뢰인 정보]
- 신청 사건 유형: ${isRehab ? '개인회생' : '개인파산 및 면책'}
- 신청인 성명: ${applicantName}
- 관할 법원: ${courtName}
- 총 채무 규모: 약 ${totalDebtAmount ? totalDebtAmount.toLocaleString() : '미기재'}만 원
- 월 소득 수준: 약 ${monthlyIncome ? monthlyIncome.toLocaleString() : '미기재'}만 원
- 선택된 주요 사유: ${selectedKeywords.join(', ') || '미선택'}
- 희망 문체 톤: ${tone === 'concise' ? '간결하고 명확하게' : tone === 'emotional' ? '진솔하고 호소력 있게' : '정중하고 격식 있는 법률 문체'}

[고객이 말로 이야기한 원본 사연 / 메모]:
"""
${rawVoiceOrText || '(키워드 및 인터뷰 기반 작성)'}
"""
${hasInterviewAnswers ? `
[신청인 6대 심층 인생 Q&A 인터뷰 답변]:
- Q1. 성장 환경 및 가정 배경: ${interviewAnswers.upbringing || '특이사항 없음'}
- Q2. 건강 및 질병/의료비 간병 사정: ${interviewAnswers.healthAndMedical || '특이사항 없음'}
- Q3. 첫 경제활동 및 채무 발생 계기: ${interviewAnswers.firstDebtCause || '특이사항 없음'}
- Q4. 채무 증대 과정 (돌려막기, 고금리 등): ${interviewAnswers.debtGrowthProcess || '특이사항 없음'}
- Q5. 더 이상 갚을 수 없게 된 결정적 순간 (지급불능): ${interviewAnswers.insolvencyCrisis || '특이사항 없음'}
- Q6. 회생/파산을 통한 갱생과 재기 다짐: ${interviewAnswers.futureResolution || '특이사항 없음'}
` : ''}

[작성 및 심사 지침]:
1. 대법원 및 회생법원 정식 서식 기준에 맞추어 다음 4단 섹션으로 구분하여 작성하세요:
   - initialCause: 1. 채무 발생의 최초 원인 (불가피했던 사정 부각)
   - growthProcess: 2. 채무 증대 경위 (돌려막기, 고금리 이자 부담, 노력에도 불구하고 늘어난 과정)
   - insolvencyTrigger: 3. 지급불능에 이르게 된 결정적 계기 (연체, 한계 도달 시점)
   - resolution: 4. 반성과 향후 갱생 및 변제계획 수행 다짐
2. 고객의 구어체("어...", "그니까요", 감정적 하소연)를 법원 실무에 적합한 단정하고 품격 있는 문장으로 정제하세요.
3. [법률 안전 검증 (Safety Check)]: 
   - 고객의 원문 중 사기죄(대출 직전 허위 소득 증빙 등), 편파변제(친인척만 우선 변제), 재산은닉, 과도한 투기(코인/도박) 등 면책불허가 또는 형사적 위험이 있는 내용이 감지되면 safetyWarnings 배열에 경고 및 소명 권고 문구를 명시하세요.
4. 반드시 유효한 JSON 형식으로만 응답하세요 (마크다운 백틱 없이 순수 JSON):

{
  "sections": {
    "initialCause": "채무 발생 원인 문단 (존댓말 합쇼체/하십시오체)",
    "growthProcess": "채무 증대 경위 문단",
    "insolvencyTrigger": "지급불능에 이르게 된 사정 문단",
    "resolution": "반성과 갱생 다짐 문단"
  },
  "fullFormattedText": "법원 정식 서식에 그대로 붙여넣을 수 있는 4개 섹션 통합 완성본 전문",
  "safetyWarnings": ["감지된 법적 위험 안내문구 (없으면 빈 배열)"],
  "suggestedKeywords": ["핵심 키워드 3~5개"]
}
`;

      const modelNames = ['gemini-2.5-flash', 'gemini-flash-latest'];
      let candidateText = null;

      for (const model of modelNames) {
        try {
          // 키는 URL 쿼리 대신 헤더로 (이전: ?key= → 프록시·로그에 남을 수 있음)
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                response_mime_type: 'application/json'
              }
            }),
            signal: AbortSignal.timeout(18000)
          });

          if (response.ok) {
            const data = await response.json();
            candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) break;
          }
        } catch (callErr) {
          console.warn(`[Gemini API ${model} Error]`, callErr.message);
        }
      }

      if (candidateText) {
        const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.status(200).json({
          ok: true,
          sections: parsed.sections,
          fullFormattedText: parsed.fullFormattedText,
          safetyWarnings: parsed.safetyWarnings || [],
          suggestedKeywords: parsed.suggestedKeywords || selectedKeywords,
          source: 'gemini_ai'
        });
      }
    } catch (e) {
      console.warn('[Gemini Statement Generation failed, falling back to rule engine]', e);
    }
  }

  // Gemini 호출 실패 또는 키 미설정 시: 스마트 룰베이스 엔진 반환
  const fallback = generateRuleBasedFallback();
  return res.status(200).json(fallback);
}

// [SECURITY] STANDARD 다단계 Rate Limiter 래핑
// Gemini 2.5 Flash 진술서 생성 — 건당 ~3원, 반복 생성 방지
export default withMultiTierRateLimit(handler, RATE_LIMIT_TIERS.STANDARD);
