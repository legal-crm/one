// Vercel Serverless Function: 대법원 나의 사건검색 CODEF B2B 중계 API
// POST /api/scourt-proxy

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

  const { courtName = '서울회생법원', caseNumber = '', clientName = '' } = req.body || {};
  const clientId = process.env.CODEF_CLIENT_ID;
  const clientSecret = process.env.CODEF_CLIENT_SECRET;

  // 1. CODEF 상용 API 키가 설정되어 있는 경우: CODEF 실시간 B2B 스크래핑 호출
  if (clientId && clientSecret && caseNumber) {
    try {
      // CODEF OAuth Token 발급
      const tokenRes = await fetch('https://oauth.codef.io/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=read'
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // CODEF 나의사건검색 호출
        const codefRes = await fetch('https://development.codef.io/v1/kr/public/ck/scourt-events/event-list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            courtCode: courtName,
            caseNumber: caseNumber,
            clientName: clientName
          })
        });

        if (codefRes.ok) {
          const resultData = await codefRes.json();
          return res.status(200).json({
            ok: true,
            isB2BLive: true,
            provider: 'CODEF 나의사건검색',
            data: resultData
          });
        }
      }
    } catch (codefErr) {
      console.warn('[CODEF API Failed, Falling back to Deep-Link Guidance]', codefErr.message);
    }
  }

  // 2. 키 미설정 시: 공식 대법원 딥링크 및 원클릭 복사 가이드 반환 (법적 리스크 제로 모드)
  return res.status(200).json({
    ok: true,
    isB2BLive: false,
    apiKeyConfigured: Boolean(clientId && clientSecret),
    courtName,
    caseNumber,
    copySummaryText: `${courtName} ${caseNumber}`,
    mobileUrl: 'https://m.scourt.go.kr',
    webUrl: 'https://www.scourt.go.kr/portal/information/events/search/search.jsp',
    instruction: !clientId ? 'CODEF(codef.io) 기업 계약 후 [CODEF_CLIENT_ID, CODEF_CLIENT_SECRET]을 환경변수에 등록하시면 대법원 CAPTCHA 우회 자동 연계가 활성화됩니다.' : undefined,
    tips: [
      '대법원 공식 모바일 사이트 연결 시 사건번호가 클립보드에 자동 복사됩니다.',
      '화면의 숫자 6자리(자동입력방지)를 입력하시면 실시간 기일 및 송달 내역을 열람하실 수 있습니다.'
    ]
  });
}
