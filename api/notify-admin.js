// Vercel Serverless Function: 관리자 실시간 알림 (텔레그램 / 슬랙)
// POST /api/notify-admin

export function setCorsHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    title = '🔔 [다시시작 CRM] 관리자 알림',
    message = '',
    markdown = '',
    slackBlocks = null,
    telegram = null,
    slackWebhookUrl = null,
  } = req.body || {};

  // 1. 텔레그램 설정 결정 (환경변수 우선, 없으면 요청 body 값)
  const tgToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN || telegram?.botToken;
  const tgChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || telegram?.chatId;

  // 2. 슬랙 설정 결정 (환경변수 우선, 없으면 요청 body 값)
  const slackUrl = process.env.SLACK_ADMIN_WEBHOOK_URL || slackWebhookUrl;

  const results = {
    telegram: { attempted: false, ok: false },
    slack: { attempted: false, ok: false },
  };

  // --- Telegram 전송 ---
  if (tgToken && tgChatId) {
    results.telegram.attempted = true;
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: markdown || message || title,
          parse_mode: 'Markdown',
        }),
      });
      const tgData = await tgRes.json();
      results.telegram.ok = !!tgData.ok;
      if (!tgData.ok) {
        results.telegram.error = tgData.description || 'Telegram API 오류';
      }
    } catch (err) {
      results.telegram.ok = false;
      results.telegram.error = err.message || 'Telegram 전송 실패';
    }
  }

  // --- Slack 전송 ---
  if (slackUrl) {
    results.slack.attempted = true;
    try {
      const payload = slackBlocks
        ? { blocks: slackBlocks, text: message || title }
        : { text: message || markdown || title };

      const slackRes = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (slackRes.ok) {
        results.slack.ok = true;
      } else {
        const slackErr = await slackRes.text();
        results.slack.ok = false;
        results.slack.error = slackErr || `HTTP ${slackRes.status}`;
      }
    } catch (err) {
      results.slack.ok = false;
      results.slack.error = err.message || 'Slack 전송 실패';
    }
  }

  // 알림 채널이 둘 다 설정되지 않은 경우에도 정상 200 반환 (개발/모의 환경 지원)
  const anyConfigured = results.telegram.attempted || results.slack.attempted;

  return res.status(200).json({
    ok: true,
    notified: anyConfigured,
    results,
    message: anyConfigured
      ? '관리자 알림이 발송되었습니다.'
      : '등록된 텔레그램/슬랙 설정이 없어 알림 발송을 건너뛰었습니다.',
  });
}
