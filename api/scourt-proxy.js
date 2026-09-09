// Vercel Serverless Function: 대법원 나의 사건검색 CODEF B2B 중계 API
// POST /api/scourt-proxy
// 공식 개발가이드: https://developer.codef.io/products/public/each/ck/scourt-events

let cachedToken = {
  accessToken: null,
  expiresAt: 0
};

// 사건번호 문자열 파싱 헬퍼 (예: "2024개회108492" -> { year: "2024", type: "개회", number: "108492" })
function parseCaseNumber(rawCaseNumber) {
  if (!rawCaseNumber) return { year: '', type: '', number: '' };
  const cleaned = rawCaseNumber.replace(/\s+/g, '');
  const match = cleaned.match(/^(\d{4})([가-힣]{2,4})(\d+)$/);
  if (match) {
    return {
      year: match[1],
      type: match[2],
      number: match[3]
    };
  }
  return { year: '', type: '', number: cleaned };
}

// CODEF OAuth Token 발급 및 캐싱
async function getCodefToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken.accessToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken;
  }

  const tokenRes = await fetch('https://oauth.codef.io/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials&scope=read',
    signal: AbortSignal.timeout(8000)
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`CODEF OAuth 실패: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const expiresInMs = (tokenData.expires_in || 3600) * 1000;
  cachedToken = {
    accessToken: tokenData.access_token,
    expiresAt: now + expiresInMs
  };
  return cachedToken.accessToken;
}

// 개발/시연용 고품질 Mock 법원 사건 데이터 생성기
function generateMockCourtData(courtName, caseNumber, clientName) {
  const parsed = parseCaseNumber(caseNumber);
  const isRehab = parsed.type === '개회' || caseNumber.includes('개회');
  const caseTypeName = isRehab ? '개인회생' : '개인파산 및 면책';
  const targetName = clientName || '홍길동';

  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  const d1 = new Date(today.getTime() - 45 * 86400000); // 45일 전 접수
  const d2 = new Date(today.getTime() - 38 * 86400000); // 금지명령
  const d3 = new Date(today.getTime() - 20 * 86400000); // 개시결정
  const d4 = new Date(today.getTime() + 14 * 86400000); // 집회기일 (14일 후)

  return {
    resCaseList: [
      {
        resCaseNumber: caseNumber || '2025개회108492',
        resCourtName: courtName || '서울회생법원',
        resCaseName: caseTypeName,
        resDeptName: '제31단독',
        resJudgeName: '김회생 판사',
        resReceiveDate: formatDate(d1),
        resClientName: targetName,
        resFinalResult: isRehab ? '개시결정' : '파산선고'
      }
    ],
    resProgressList: [
      {
        date: formatDate(d1),
        content: '개인회생절차 개시신청서 접수',
        result: '접수완료'
      },
      {
        date: formatDate(d2),
        content: '금지명령결정 (각 채권자 통지)',
        result: '인용'
      },
      {
        date: formatDate(new Date(today.getTime() - 30 * 86400000)),
        content: '보정권고 송달 (채무자 대리인)',
        result: '발송'
      },
      {
        date: formatDate(new Date(today.getTime() - 24 * 86400000)),
        content: '보정서 제출 (채무자 대리인)',
        result: '접수'
      },
      {
        date: formatDate(d3),
        content: '개인회생절차 개시결정 (이의기간 및 집회기일 지정)',
        result: '결정'
      }
    ],
    resDateList: [
      {
        date: `${formatDate(d4)} 14:00`,
        place: '3별관 제2호 법정',
        type: '채권자집회기일',
        result: '진행예정'
      }
    ],
    resDeliveryList: [
      {
        docName: '개시결정문 등본',
        target: targetName,
        deliveryDate: formatDate(d3),
        status: '도달 (전자송달)'
      },
      {
        docName: '보정권고 등본',
        target: '담당 변호사',
        deliveryDate: formatDate(new Date(today.getTime() - 30 * 86400000)),
        status: '도달'
      }
    ],
    resRepaymentList: isRehab ? [
      { round: 1, dueDate: '2026-06-15', paidDate: '2026-06-14', amount: 485000, status: '정상납부' },
      { round: 2, dueDate: '2026-07-15', paidDate: '2026-07-15', amount: 485000, status: '정상납부' },
      { round: 3, dueDate: '2026-08-15', paidDate: '2026-08-13', amount: 485000, status: '정상납부' },
      { round: 4, dueDate: '2026-09-15', paidDate: null, amount: 485000, status: '납부대기' }
    ] : []
  };
}

export default async function handler(req, res) {
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
    courtName = '서울회생법원',
    caseNumber = '',
    clientName = '',
    bankCode = '',
    account = '',
    userName1 = '',
    twoWayInfo = null
  } = req.body || {};

  const clientId = process.env.CODEF_CLIENT_ID;
  const clientSecret = process.env.CODEF_CLIENT_SECRET;
  const isProd = process.env.CODEF_ENV === 'production';
  const codefBaseUrl = isProd ? 'https://api.codef.io' : 'https://development.codef.io';

  // 사건번호 파싱
  const parsed = parseCaseNumber(caseNumber);

  // 1. CODEF 상용 API 키가 설정되어 있는 경우: 실시간 B2B 호출
  if (clientId && clientSecret && caseNumber) {
    try {
      const accessToken = await getCodefToken(clientId, clientSecret);

      const requestBody = {
        organization: '0001',
        court_name: courtName,
        caseNumberYear: parsed.year,
        caseNumberType: parsed.type,
        caseNumberNumber: parsed.number,
        userName: clientName,
        timeout: '120'
      };

      if (bankCode) requestBody.bankCode = bankCode;
      if (account) requestBody.account = account;
      if (userName1) requestBody.userName1 = userName1;
      if (twoWayInfo) requestBody.twoWayInfo = twoWayInfo;

      const codefRes = await fetch(`${codefBaseUrl}/v1/kr/public/ck/scourt-events/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20000)
      });

      if (codefRes.ok) {
        const resultJson = await codefRes.json();
        
        // 2-Way 인증(CAPTCHA) 필요 응답 처리
        if (resultJson.result?.code === 'CF-03002' || resultJson.data?.continue2Way) {
          return res.status(200).json({
            ok: true,
            isB2BLive: true,
            needsTwoWay: true,
            continue2Way: true,
            message: '대법원 보안문자(CAPTCHA) 추가 확인이 필요합니다.',
            data: resultJson.data,
            result: resultJson.result
          });
        }

        if (resultJson.result?.code === 'CF-00000') {
          return res.status(200).json({
            ok: true,
            isB2BLive: true,
            provider: 'CODEF 대법원 나의사건검색',
            data: resultJson.data,
            result: resultJson.result
          });
        }
      }
    } catch (codefErr) {
      console.warn('[CODEF Live Call Failed, falling back to simulated high-fidelity data]', codefErr.message);
    }
  }

  // 2. 키 미설정 또는 개발 모드: 고품질 시뮬레이터 데이터 반환 + 공식 딥링크 안내
  const mockData = generateMockCourtData(courtName, caseNumber, clientName);

  return res.status(200).json({
    ok: true,
    isB2BLive: false,
    isMock: true,
    apiKeyConfigured: Boolean(clientId && clientSecret),
    courtName,
    caseNumber,
    copySummaryText: `${courtName} ${caseNumber}`,
    mobileUrl: 'https://m.scourt.go.kr',
    webUrl: 'https://www.scourt.go.kr/portal/information/events/search/search.jsp',
    instruction: !clientId 
      ? 'CODEF(codef.io) 기업 계약 키가 미설정되어 시뮬레이션 데이터 모드로 동작 중입니다. [CODEF_CLIENT_ID, CODEF_CLIENT_SECRET]을 환경변수에 등록하시면 실시간 법원 스크래핑이 활성화됩니다.'
      : undefined,
    data: mockData,
    tips: [
      '대법원 공식 모바일 사이트 연결 시 사건번호가 클립보드에 자동 복사됩니다.',
      '화면의 숫자 6자리(자동입력방지)를 입력하시면 실시간 기일 및 송달 내역을 열람하실 수 있습니다.'
    ]
  });
}
