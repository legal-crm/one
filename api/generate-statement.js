// Vercel Serverless Function: 개인회생·파산 진술서 Gemini 2.5 AI 작성 및 윤문 엔드포인트
// POST /api/generate-statement

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    caseType = 'rehab',
    applicantName = '신청인',
    rawVoiceOrText = '',
    selectedKeywords = [],
    totalDebtAmount = 0,
    monthlyIncome = 0,
    tone = 'formal',
    courtName = '회생법원'
  } = req.body || {};

  if (!rawVoiceOrText && (!selectedKeywords || selectedKeywords.length === 0)) {
    return res.status(400).json({ ok: false, error: '입력된 내용 또는 선택된 키워드가 없습니다.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;

  // AI 연동 실패 시 규칙 기반 정교한 Fallback 진술서 생성 헬퍼
  const generateRuleBasedFallback = () => {
    const isRehab = caseType === 'rehab';
    const kwText = selectedKeywords.length > 0 ? selectedKeywords.join(', ') : '생계 곤란 및 불가피한 지출';
    
    const initialCause = `신청인 ${applicantName}은(는) 과거 성실히 생활하던 중, ${kwText} 등으로 인해 가계 수지 및 생계 유지가 급격히 악화되었습니다. 예상치 못한 지출과 소득 감소를 메우기 위하여 부득이하게 금융기관 대출 및 신용카드를 최초로 이용하게 되었습니다.`;
    
    const growthProcess = `그러나 이후 경기 침체 및 이자 부담이 가중되면서, 매월 발생하는 원리금을 정상적으로 감당하기 어려운 상황에 직면하였습니다. 기존 채무의 연체를 막고자 대출 돌려막기와 카드론을 추가로 이용하게 되었으며, 이로 인해 채무 원금과 고율의 이자가 눈덩이처럼 증대되었습니다.`;
    
    const insolvencyTrigger = `결국 원리금 상환액이 월 가용소득을 훨씬 초과하게 되었고, 일상적인 최저생계비조차 유지하기 힘든 한계 상황에 도달하였습니다. 더 이상의 추가 대출이나 사적 변제가 불가능하여 최종적으로 지급불능 상태에 이르게 되었습니다.`;
    
    const resolution = isRehab
      ? `신청인은 자신의 부주의와 능력 부족으로 채권자분들께 큰 심려와 경제적 피해를 끼쳐드린 점을 뼈저리게 반성하고 있습니다. 법원에서 인가하여 주시는 변제계획에 따라 어떠한 어려움이 있더라도 매월 변제금을 성실히 납부하여 채무를 완제하고 갱생할 것을 엄숙히 서약합니다.`
      : `신청인은 감당할 수 없는 채무로 인해 채권자분들께 막대한 고통과 피해를 드리게 된 점을 머리 숙여 사죄드립니다. 현재의 건강 상태와 경제적 여건으로는 도저히 채무를 변제할 길이 없어 부득이 파산 및 면책을 신청하오니, 다시금 사회의 일원으로 재기할 수 있도록 부디 선처하여 주시기를 간곡히 호소합니다.`;

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
${rawVoiceOrText || '(키워드 기반 작성)'}
"""

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
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
