// Vercel Serverless Function: Telegram Bot & Multi-Channel Notification API
// POST /api/telegram

import { setCorsHeaders } from './_lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    botToken: reqBotToken,
    chatId: reqChatId,
    text,
    message,
    markdown,
    parseMode = 'Markdown',
    slackWebhookUrl: reqSlackUrl,
    telegram,
  } = req.body || {};

  // 1. 텔레그램 토큰/채팅ID 결정 (요청값 -> telegram 객체 -> 서버 환경변수 순서)
  const botToken = reqBotToken || telegram?.botToken || process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = reqChatId || telegram?.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
  const contentText = markdown || text || message || '';

  // 2. 슬랙 웹훅 결정
  const slackUrl = reqSlackUrl || process.env.SLACK_ADMIN_WEBHOOK_URL;

  const results = {
    telegram: { attempted: false, ok: false },
    slack: { attempted: false, ok: false },
  };

  // --- Telegram 전송 ---
  if (botToken && chatId && contentText) {
    results.telegram.attempted = true;
    try {
      const telegramRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: contentText,
            parse_mode: parseMode,
          }),
        }
      );
      const data = await telegramRes.json();
      results.telegram.ok = !!data.ok;
      if (!data.ok) {
        results.telegram.error = data.description || 'Telegram API 오류';
      }
    } catch (err) {
      results.telegram.ok = false;
      results.telegram.error = err.message || 'Telegram 전송 실패';
    }
  }

  // --- Slack 전송 ---
  if (slackUrl && contentText) {
    results.slack.attempted = true;
    try {
      const slackRes = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contentText }),
      });
      results.slack.ok = slackRes.ok;
      if (!slackRes.ok) {
        results.slack.error = await slackRes.text();
      }
    } catch (err) {
      results.slack.ok = false;
      results.slack.error = err.message || 'Slack 전송 실패';
    }
  }

  // 둘 다 시도되지 않은 경우
  if (!results.telegram.attempted && !results.slack.attempted) {
    return res.status(200).json({
      ok: true,
      notified: false,
      message: '설정된 알림 채널이 없어 발송을 건너뛰었습니다.',
      results,
    });
  }

  const anySuccess = results.telegram.ok || results.slack.ok;
  return res.status(200).json({
    ok: anySuccess,
    results,
    error: anySuccess ? undefined : (results.telegram.error || results.slack.error),
  });
}

