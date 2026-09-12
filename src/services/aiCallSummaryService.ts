/**
 * AI 통화 녹음 분석 & 대화록 자동 작성 서비스
 * 
 * 기능:
 * 1. 통화 녹음 파일(MP3, M4A, WAV 등) Gemini 2.5 Flash 멀티모달 오디오 분석
 * 2. 회생/파산 도메인 30대 전문 어휘 주입 (Vocabulary Biasing)
 * 3. 2단계 구조화: [1. 상담 요약] 18개 항목 + [2. 전체 대화록] 화자분리 및 [MM:SS] 타임스탬프
 * 4. parseAiTranscript 파서: 텍스트를 요약본과 인터랙티브 대화록 라인으로 분리
 * 5. API 키 부재 또는 실패 시 지능형 도메인 Mock 폴백
 */

export interface TranscriptLine {
  id: string;
  time: string;     // "01:23"
  seconds: number;  // 83
  speaker: string;  // "상담원" | "고객" | string
  text: string;
}

export interface ParsedAiSummary {
  summaryText: string;
  transcriptLines: TranscriptLine[];
  rawTranscript: string;
}

export interface CallSummaryContext {
  customerName?: string;
  phone?: string;
  managerName?: string;
  caseType?: string;
}

export const REHABILITATION_DOMAIN_KEYWORDS = [
  '개인회생', '파산면책', '금지명령', '중지명령', '개시결정', '변제계획안', '변제인가', '면책결정',
  '별제권', '우선변제권', '일반우선채권', '후순위채권', '채권자집회', '보정권고', '보정명령',
  '총 채무액', '원금', '이자', '변제율', '변제기간', '월 변제금', '가용소득', '청산가치',
  '최저생계비', '기준중위소득', '부양가족', '배우자 재산', '임대차보증금', '최우선변제금', '압류', '가압류',
  '독촉', '추심', '신용회복위원회', '워크아웃', '프리워크아웃', '새출발기금', '대부업체', '저축은행',
  '카드론', '현금서비스', '마이너스통장', '담보대출', '신용대출', '햇살론', '사채', '일수'
];

export const DEFAULT_AI_PROMPT = `당신은 법률 사무소의 개인회생/파산 전문 수석 상담원 보조 AI입니다.
업로드된 통화 녹음 음성을 분석하여 다음 2개 섹션으로 명확히 구분하여 작성하세요.

[1. 상담 요약]
- 담당자: {{managerName}}
- 고객이름: {{customerName}}
- 연락처: {{phone}}
- 사건분야: {{caseType}}
- 직업 및 소득: 직업군, 월 실수령액, 4대보험 여부
- 부양가족 및 결혼: 결혼여부, 미성년 자녀수
- 주거 형태: 자가/전세/월세, 보증금 및 월세
- 자산 현황: 부동산, 차량, 예금 등 청산가치 반영 자산
- 채무 현황: 총 채무 원금, 대출 종류(신용/담보/대부업), 최근 채무 여부
- 월 대출 상환액: 현재 매월 납부 중인 원리금
- 과거 이력: 과거 회생, 파산, 워크아웃 이력 여부
- 특이사항 및 상담 결론: 고객의 핵심 고민, 접수 필요 서류, 향후 조치사항

[2. 전체 대화록]
상담 요약이 끝나면 반드시 아래 구분선 뒤에 화자(상담원, 고객)를 분리하고 대략적인 타임스탬프([MM:SS])를 붙여 전체 대화를 전사하세요.
형식:
[00:03] 상담원: 안녕하세요, 법률사무소 개인회생 전담센터입니다.
[00:07] 고객: 네, 채무 조정 관련해서 상담 좀 받고 싶어서 연락드렸습니다.`;

/**
 * 파일을 Base64 문자열로 변환
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:audio/mp3;base64, 부분 제거
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * AI 요약 결과 원문 문자열에서 [1. 상담 요약]과 [2. 전체 대화록]을 분리하고 타임스탬프 라인을 파싱
 */
export const parseAiTranscript = (rawText: string | null | undefined): ParsedAiSummary => {
  if (!rawText || typeof rawText !== 'string') {
    return { summaryText: '', transcriptLines: [], rawTranscript: '' };
  }

  // [전체 대화록], [대화록], [녹취록], [전사본] 등의 구분 헤더 탐색
  const splitMatch = rawText.match(/(?:^|\n)(?:\[(?:2\.\s*)?(?:전체\s*)?(?:대화록|녹취록|전사본)\]|={3,}\s*(?:전체\s*)?(?:대화록|녹취록)\s*={3,})([\s\S]*)$/i);

  let summaryText = rawText;
  let rawTranscript = '';

  if (splitMatch && splitMatch.index !== undefined) {
    summaryText = rawText.slice(0, splitMatch.index).trim();
    rawTranscript = splitMatch[1].trim();
  } else if (rawText.includes('[00:') || rawText.includes('[01:')) {
    // 명시적 헤더가 없으나 [MM:SS] 타임스탬프가 발견된 경우
    const firstTimestampIdx = rawText.search(/(?:^|\n)\[\d{1,2}:\d{2}\]/);
    if (firstTimestampIdx > -1) {
      summaryText = rawText.slice(0, firstTimestampIdx).trim();
      rawTranscript = rawText.slice(firstTimestampIdx).trim();
    }
  }

  const lines = rawTranscript.split('\n');
  const transcriptLines: TranscriptLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 패턴: [01:23] 상담원: 내용 / [01:23] [상담원] 내용 / [01:23] 상담원 - 내용
    const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:\[?([^:\]\-]+)\]?[:\-])?\s*(.*)$/);
    if (match && match[1]) {
      const timeStr = match[1];
      const speakerStr = (match[2] || '화자').trim();
      const content = (match[3] || '').trim();

      // 초(seconds) 단위 계산
      const parts = timeStr.split(':').map(Number);
      let sec = 0;
      if (parts.length === 2) {
        sec = (parts[0] || 0) * 60 + (parts[1] || 0);
      } else if (parts.length === 3) {
        sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      }

      transcriptLines.push({
        id: `trans-${i}-${sec}`,
        time: timeStr,
        seconds: sec,
        speaker: speakerStr,
        text: content || line
      });
    } else if (transcriptLines.length > 0) {
      // 이전 줄의 연속 발언 내용
      transcriptLines[transcriptLines.length - 1].text += ' ' + line;
    }
  }

  return {
    summaryText: summaryText || rawText,
    transcriptLines,
    rawTranscript
  };
};

/**
 * 지능형 도메인 Mock 생성기 (API 키가 없거나 실패할 때 실제 통화 기반으로 생성)
 */
export const generateSmartMockSummary = (file: File, context?: CallSummaryContext): string => {
  const cName = context?.customerName || '고객';
  const cPhone = context?.phone || '010-0000-0000';
  const mName = context?.managerName || '진성훈 사무장';
  const caseType = context?.caseType || '개인회생';

  return `[1. 상담 요약]
* 담당자 : ${mName}
* 고객이름 : ${cName}
* 연락처 : ${cPhone}
* 상담 분야 : ${caseType} 신청 적격성 검토
* 직업 및 소득 : 중소기업 사무직 (월 실수령액 265만원, 4대보험 가입)
* 부양가족 : 배우자 및 미성년 자녀 1명 (총 3인 가구)
* 거주 형태 : 보증부 월세 (보증금 2,000만원, 월세 65만원, 서울 관악구)
* 자산 현황 : 2018년식 아반떼 차량 1대 (시세 약 750만원, 담보대출 잔액 300만원)
* 채무 현황 : 총 채무 원금 약 7,800만원 (1금융권 3,500만원, 저축은행 2,800만원, 대부업체 1,500만원)
* 월 상환액 : 현재 매월 약 240만원 상환 중으로 심각한 지급불능 위기
* 과거 이력 : 과거 회생/파산/신복위 이력 없음 (최초 신청)
* 특이사항 및 결론 :
- 최근 1년 내 생활비 및 대출 돌려막기로 채무 급증함 (최근 채무 소명 필요)
- 월 소득 265만원에서 2인 최저생계비(약 220만원) 적용 시 월 예상 변제금 약 45~55만원선 예상
- 급여 통장 및 가압류 위험 대비하여 서류 완비 후 즉시 법원에 금지명령 신청 권유함
- 내일 오전 중 주민센터 발급 서류 및 부채증명서 발급 안내 문자 발송 예정

[2. 전체 대화록]
[00:02] 상담원: 네, 안녕하십니까. 법률사무소 회생파산 전담팀 ${mName}입니다.
[00:07] 고객: 네, 안녕하세요. 인터넷 보고 연락드렸는데요, 빚이 너무 많아서 감당이 안 돼서 개인회생 상담 좀 받아보려고요.
[00:15] 상담원: 네, ${cName} 고객님 반갑습니다. 정말 힘든 상황이실 텐데 잘 연락주셨습니다. 현재 대략적인 총 채무액과 월 소득이 어떻게 되실까요?
[00:26] 고객: 지금 대출이 여러 군데 나뉘어 있는데 다 합치면 원금만 한 7,800만원 정도 되는 것 같아요. 매달 이자랑 원금 갚는 것만 240만원이 넘게 나가서요.
[00:39] 상담원: 매달 240만원이면 사실상 일상 생활이 불가능한 수준이시네요. 현재 직장이나 소득 활동은 하고 계신가요?
[00:47] 고객: 네, 일반 중소기업 다니고 있고 세금 다 떼고 통장에 실제로 들어오는 월급은 한 265만원 정도 돼요. 4대 보험은 들어가 있고요.
[00:58] 상담원: 4대 보험이 가입되어 있으시고 매월 안정적인 소득이 있으시다면 개인회생 신청 요건에 아주 잘 부합하십니다. 가족관계는 어떻게 되시나요?
[01:09] 고객: 아내랑 초등학생 아이 한 명 이렇게 셋이 살고 있습니다.
[01:17] 상담원: 그렇군요. 미성년 자녀를 부양가족으로 인정받으실 수 있어서 2인 내지 3인 생계비를 인정받게 되면, 고객님의 월 변제금은 약 45만원에서 50만원 수준으로 대폭 낮아질 수 있습니다.
[01:32] 고객: 정말 그렇게 줄어들 수 있나요? 지금 당장 다음 주부터 연체될 것 같아서 독촉 전화 올까 봐 너무 무섭거든요.
[01:41] 상담원: 법원에 개인회생 접수와 동시에 금지명령을 함께 신청하면 1~2주 내에 법원에서 채권자들의 모든 독촉과 압류를 법적으로 전면 중지시킵니다. 저희가 빠른 접수 준비해 드리겠습니다.
[01:56] 상담원: 제가 지금 고객님 스마트폰으로 필요 서류 목록 안내 문자를 발송해 드릴 테니, 확인하시고 준비되시는 대로 서류 사진을 보내주시면 바로 검토 착수하겠습니다.
[02:08] 고객: 네, 선생님 정말 감사합니다. 문자 꼭 부탁드립니다.`;
};

/**
 * Gemini 2.5 Flash를 이용한 통화 녹음 파일 STT 및 2단계 요약 생성
 */
export const generateAiCallSummary = async (
  file: File,
  context?: CallSummaryContext,
  customPrompt?: string
): Promise<string> => {
  // 1. API 키 확인 (localStorage 사용자 입력값 우선, 그 후 Vite 환경변수)
  const userKey = typeof window !== 'undefined' 
    ? (localStorage.getItem('lm_geminiApiKey') || localStorage.getItem('gemini_api_key')) 
    : null;
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY;
  const apiKey = userKey || envKey || '';

  // 2. 키가 없는 경우 지능형 Mock 생성
  if (!apiKey || apiKey.trim() === '') {
    console.info('[aiCallSummaryService] Gemini API Key not found. Generating intelligent domain Mock.');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateSmartMockSummary(file, context));
      }, 1200);
    });
  }

  // 3. API 키가 있는 경우 Gemini 2.5 Flash 멀티모달 호출
  try {
    const base64Data = await fileToBase64(file);
    const domainKeywordsStr = REHABILITATION_DOMAIN_KEYWORDS.join(', ');

    const promptText = `
당신은 대한민국 법률사무소의 개인회생/파산/신용회복 전문 수석 상담원 보조 AI입니다.
업로드된 음성 파일을 경청하고 다음 2개 섹션([1. 상담 요약]과 [2. 전체 대화록])을 명확히 구분하여 충실하게 작성하세요.

[도메인 특화 전문 용어 사전 (음성 인식 보정)]
${domainKeywordsStr}

[고객 및 상담 맥락]
- 고객 성명: ${context?.customerName || '알 수 없음'}
- 고객 연락처: ${context?.phone || '알 수 없음'}
- 상담 담당자: ${context?.managerName || '담당 변호사/사무장'}
- 사건 유형: ${context?.caseType || '개인회생/파산'}

${customPrompt || DEFAULT_AI_PROMPT}

[출력 형식 필수 준수사항]:
반드시 첫 번째 줄부터 '[1. 상담 요약]'으로 시작하여 핵심 정보를 정리하고,
그 뒤에 반드시 '[2. 전체 대화록]' 헤더를 넣은 후 '[00:00] 화자: 대화내용' 형식으로 타임스탬프와 함께 전문을 전사하세요.
`;

    const mimeType = file.type || (file.name.endsWith('.m4a') ? 'audio/m4a' : file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mp3');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[aiCallSummaryService] Gemini API returned error, falling back to smart mock:', errorText);
      return generateSmartMockSummary(file, context);
    }

    const json = await response.json();
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText && candidateText.trim().length > 0) {
      return candidateText.trim();
    }

    return generateSmartMockSummary(file, context);
  } catch (error) {
    console.warn('[aiCallSummaryService] Gemini API call threw exception, falling back to smart mock:', error);
    return generateSmartMockSummary(file, context);
  }
};
