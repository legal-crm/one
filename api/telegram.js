// Vercel Serverless Function: Telegram Bot & Multi-Channel Notification API
// POST /api/telegram

import { setCorsHeaders } from './_lib/popbill-service.js';
import { checkMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';
import { verifyTurnstileToken } from './_lib/turnstile-validator.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // [SECURITY] Multi-Tier Rate Limiting (1분 3회, 10분 5회, 30분 10회 + 30분 Jail)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
  const rateLimit = checkMultiTierRateLimit(`telegram:${ip}`, RATE_LIMIT_TIERS.STRICT);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_TIERS.STRICT.minute.max);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  if (rateLimit.retryAfter > 0) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
  }

  if (rateLimit.isLimited) {
    console.warn(`[SECURITY Telegram RateLimit] Blocked ${ip} (reason: ${rateLimit.reason}, retryAfter: ${rateLimit.retryAfter}s)`);
    return res.status(429).json({
      ok: false,
      error: `Too Many Requests: 알림 발송 한도를 초과하여 차단되었습니다. (${Math.ceil(rateLimit.retryAfter / 60)}분 후 재시도 가능)`,
      retryAfter: rateLimit.retryAfter,
    });
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
    turnstileToken,
    cfToken,
  } = req.body || {};

  // [BOT DEFENSE] 서버 환경변수 봇 사용 시 봇 방어 강제 (임의 스크립트 스팸 방지)
  const isUsingServerToken = !reqBotToken && Boolean(process.env.TELEGRAM_ADMIN_BOT_TOKEN);
  const token = turnstileToken || cfToken;
  if (token) {
    const cfCheck = await verifyTurnstileToken(token, ip);
    if (!cfCheck.success) {
      return res.status(403).json({ ok: false, error: cfCheck.error || '봇 방지 검증에 실패했습니다.' });
    }
  } else if (isUsingServerToken && !req.headers.authorization) {
    return res.status(403).json({ ok: false, error: '공공 알림 발송을 위해 봇 방지 인증(Turnstile Token)이 필요합니다.' });
  }

  // 1. 텔레그램 토큰/채팅ID 결정 (요청값 -> telegram 객체 -> 서버 환경변수 순서)
  const botToken = reqBotToken || telegram?.botToken || process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = reqChatId || telegram?.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
  const contentText = markdown || text || message || '';

  const results = {
    telegram: { attempted: false, ok: false },
    slack: { attempted: false, ok: false },
  };

  // 2. 슬랙 웹훅 결정 (SSRF 방어: 오직 공식 hooks.slack.com 도메인만 허용)
  let slackUrl = reqSlackUrl || process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (slackUrl) {
    try {
      const parsed = new URL(slackUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'hooks.slack.com' || !parsed.pathname.startsWith('/services/')) {
        console.warn(`[SECURITY SSRF Blocked] Invalid Slack Webhook: ${slackUrl}`);
        slackUrl = null;
        results.slack.error = '허용되지 않은 웹훅 도메인입니다. (Slack 공식 도메인만 허용)';
      }
    } catch {
      slackUrl = null;
      results.slack.error = '유효하지 않은 웹훅 URL입니다.';
    }
  }

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

