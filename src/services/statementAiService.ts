import type { 
  GenerateStatementAiPayload, 
  GenerateStatementAiResponse 
} from '../types/statementTypes';

/**
 * 개인회생·파산 법원 제출용 진술서 Gemini 2.5 Flash 연동 서비스
 */
export class StatementAiService {
  /**
   * 음성 인식 텍스트 또는 고객 메모를 바탕으로 법원 표준 4단 진술서 생성
   */
  static async generateCourtStatement(
    payload: GenerateStatementAiPayload
  ): Promise<GenerateStatementAiResponse> {
    // 1. 서버리스 API 우선 호출 시도
    try {
      const res = await fetch('/api/generate-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[StatementAiService] API fetch failed, trying client-side fallback', apiErr);
    }

    // 2. 클라이언트 직접 호출 (VITE_GEMINI_API_KEY 확인)
    const clientKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY;
    if (clientKey) {
      try {
        const clientResult = await this.callGeminiDirect(clientKey, payload);
        if (clientResult) return clientResult;
      } catch (clientErr) {
        console.warn('[StatementAiService] Client direct call failed', clientErr);
      }
    }

    // 3. 오프라인 / Fallback 스마트 룰베이스 엔진
    return this.generateSmartFallback(payload);
  }

  /**
   * 클라이언트 직접 Gemini 2.5 Flash 호출
   */
  private static async callGeminiDirect(
    apiKey: string,
    payload: GenerateStatementAiPayload
  ): Promise<GenerateStatementAiResponse | null> {
    const isRehab = payload.caseType === 'rehab';
    const prompt = `
당신은 대한민국 법원 회생·파산 실무에 정통한 최고 수준의 법률 전문가입니다.
의뢰인(고객)이 음성 인식이나 일상 메모로 털어놓은 사연을 바탕으로, 대한민국 법원(회생법원/지방법원)에 제출할 공식 【진술서】를 완성도 높은 법률 문체로 작성해주세요.

[사건 및 의뢰인 정보]
- 신청 사건 유형: ${isRehab ? '개인회생' : '개인파산 및 면책'}
- 신청인 성명: ${payload.applicantName || '신청인'}
- 관할 법원: ${payload.courtName || '서울회생법원'}
- 총 채무 규모: 약 ${payload.totalDebtAmount ? payload.totalDebtAmount.toLocaleString() : '미기재'}만 원
- 선택된 주요 사유: ${(payload.selectedKeywords || []).join(', ') || '생계 곤란'}
- 희망 문체 톤: ${payload.tone === 'concise' ? '간결하고 명확하게' : payload.tone === 'emotional' ? '진솔하고 호소력 있게' : '정중하고 격식 있는 법률 문체'}

[고객의 음성 녹음 내용 / 사연 메모]:
"""
${payload.rawVoiceOrText || '(키워드 및 인터뷰 기반 작성)'}
"""
${payload.interviewAnswers ? `
[신청인 6대 심층 인생 Q&A 인터뷰 답변]:
- Q1. 성장 환경 및 가정 배경: ${payload.interviewAnswers.upbringing || '특이사항 없음'}
- Q2. 건강 및 질병/의료비 간병 사정: ${payload.interviewAnswers.healthAndMedical || '특이사항 없음'}
- Q3. 첫 경제활동 및 채무 발생 계기: ${payload.interviewAnswers.firstDebtCause || '특이사항 없음'}
- Q4. 채무 증대 과정 (돌려막기, 고금리 등): ${payload.interviewAnswers.debtGrowthProcess || '특이사항 없음'}
- Q5. 더 이상 갚을 수 없게 된 결정적 순간 (지급불능): ${payload.interviewAnswers.insolvencyCrisis || '특이사항 없음'}
- Q6. 회생/파산을 통한 갱생과 재기 다짐: ${payload.interviewAnswers.futureResolution || '특이사항 없음'}
` : ''}

[지침]:
1. 대법원 양식에 맞추어 다음 4단 섹션으로 구분하여 유효한 JSON으로만 작성하세요 (마크다운 없이 순수 JSON):
{
  "sections": {
    "initialCause": "1. 채무 발생 원인 문단",
    "growthProcess": "2. 채무 증대 경위 문단",
    "insolvencyTrigger": "3. 지급불능 사정 문단",
    "resolution": "4. 반성과 갱생 다짐 문단"
  },
  "fullFormattedText": "법원 정식 서식 통합 전문",
  "safetyWarnings": ["사기죄 의심, 편파변제 의심 등 주의 문구 (없으면 빈 배열)"],
  "suggestedKeywords": ["핵심 키워드"]
}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          response_mime_type: 'application/json'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean);
        return {
          ok: true,
          sections: parsed.sections,
          fullFormattedText: parsed.fullFormattedText,
          safetyWarnings: parsed.safetyWarnings || [],
          suggestedKeywords: parsed.suggestedKeywords || payload.selectedKeywords || []
        };
      }
    }
    return null;
  }

  /**
   * 스마트 룰베이스 엔진 (Fallback)
   */
  private static generateSmartFallback(
    payload: GenerateStatementAiPayload
  ): GenerateStatementAiResponse {
    const isRehab = payload.caseType === 'rehab';
    const name = payload.applicantName || '신청인';
    const keywords = (payload.selectedKeywords && payload.selectedKeywords.length > 0)
      ? payload.selectedKeywords.join(', ')
      : '물가 상승 및 생계비 부족, 소득 감소';
    
    // 법률 위험 키워드 클라이언트 단어 검사
    const safetyWarnings: string[] = [];
    const textToCheck = (payload.rawVoiceOrText || '') + ' ' + keywords;
    if (textToCheck.includes('코인') || textToCheck.includes('주식') || textToCheck.includes('선물') || textToCheck.includes('도박')) {
      safetyWarnings.push('투자/가상자산 손실 관련: 최근 법원 실무준칙에 따라 투자손실금에 대한 사용처 소명 및 최근 대출금의 주식/코인 유입 여부에 대한 변호사 사전 검토가 필요합니다.');
    }
    if (textToCheck.includes('친척') || textToCheck.includes('가족 먼저') || textToCheck.includes('지인 먼저')) {
      safetyWarnings.push('편파변제 주의: 신청 직전 특정 개인(가족/지인) 채무만 먼저 갚은 경우 법원에서 부인권 행사 또는 청산가치 반영을 요구할 수 있으므로 변호사와 상담하시기 바랍니다.');
    }
    if (textToCheck.includes('직장 위장') || textToCheck.includes('소득 높여') || textToCheck.includes('허위')) {
      safetyWarnings.push('신용사기(사기죄) 주의: 대출 당시 허위 재직이나 소득을 기재한 진술은 면책불허가 및 형사적 위험이 있으므로 정확한 사실관계로 수정해야 합니다.');
    }

    const ia = payload.interviewAnswers || {};
    const upbringingPart = ia.upbringing ? `신청인은 과거 ${ia.upbringing}의 환경 속에서 자라며 성실히 생활하고자 하였으나, ` : '';
    const medicalPart = ia.healthAndMedical && !ia.healthAndMedical.includes('문제 없음') ? `또한 ${ia.healthAndMedical} 등의 심각한 건강 및 의료비 지출이 겹치면서 ` : '';
    const firstDebtPart = ia.firstDebtCause ? `${ia.firstDebtCause} 등의 사유로 인하여 ` : `${keywords} 등의 사유로 인하여 `;

    const initialCause = `${upbringingPart}${medicalPart}신청인 ${name}은(는) ${firstDebtPart}가계 수지 및 생계 유지가 급격히 악화되었고, 부족한 생활비와 고정지출을 충당하고자 부득이하게 최초 금융기관 대출 및 신용카드를 이용하게 되었습니다.`;

    const growthPart = ia.debtGrowthProcess ? `${ia.debtGrowthProcess} 등으로 인하여 ` : '채무 연체로 인한 가압류와 신용불량을 방지하고자 불가피하게 카드론 및 저축은행·대부업체 고금리 대출로 돌려막기를 거듭하게 되었고, ';
    const growthProcess = `그러나 악화된 경제 여건이 쉽게 회복되지 못하였고, 기존 대출금의 원리금 상환 부담이 매월 눈덩이처럼 불어나기 시작했습니다. ${growthPart}이로 인해 채무 원금과 이자가 급격히 증대되었습니다.`;

    const crisisPart = ia.insolvencyCrisis ? `${ia.insolvencyCrisis} 등의 상황에 직면하여 ` : '';
    const insolvencyTrigger = `현재 신청인의 월 소득으로는 법정 최저생계비를 유지하기도 빠듯하여, ${crisisPart}매월 청구되는 막대한 원리금과 고율의 이자를 상환할 수 있는 능력이 완전히 고갈되었습니다. 모든 금융거래가 한계에 봉착하여 자력으로는 도저히 채무를 변제할 수 없는 지급불능 상태에 이르게 되었습니다.`;

    const resPart = ia.futureResolution ? `${ia.futureResolution} 등의 각오로 ` : '';
    const resolution = isRehab
      ? `신청인은 자신의 미숙함과 부주의로 인하여 채권자분들께 큰 경제적 손실을 끼쳐드리게 된 점을 깊이 뉘우치며 진심으로 사죄드립니다. ${resPart}법원에서 인가하여 주시는 변제계획에 따라 어떠한 어려움이 따르더라도 정해진 기간 동안 성실히 변제금을 납부하여 갱생할 것을 굳게 다짐하오니 부디 선처하여 주시기를 간곡히 부탁드립니다.`
      : `신청인은 감당할 수 없는 채무로 채권자분들께 피해를 끼치게 된 점을 머리 숙여 사죄드립니다. ${resPart}현재의 신체적·경제적 여건으로는 도저히 정상적인 채무 변제가 불가능하여 부득이 파산 및 면책을 신청하오니, 다시금 성실한 사회의 일원으로 새출발할 수 있도록 부디 자비를 베풀어 주시기를 간절히 호소합니다.`;

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
      safetyWarnings,
      suggestedKeywords: payload.selectedKeywords || ['생활비부족', '돌려막기', '소득감소']
    };
  }
}
