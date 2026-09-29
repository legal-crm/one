// Vercel Serverless Function: Telegram Bot & Multi-Channel Notification API
// POST /api/telegram

// CORS 헬퍼는 cors-helper에서 직접 가져온다 (이전: popbill-service 경유 → 알림 함수 번들에 팝빌 SDK까지 포함)
import { setCorsHeaders } from '../cors-helper.js';
import { checkMultiTierRateLimit, RATE_LIMIT_TIERS } from '../rate-limiter.js';
import { verifyTurnstileToken } from '../turnstile-validator.js';
import { verifyAuth } from '../auth-middleware.js';

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

  // [AUTH] 이전: Authorization 헤더가 '있기만' 하면 봇 방어를 건너뛰었고(값 검증 없음),
  //        요청자가 임의 botToken/chatId를 넘기면 인증 없이 텔레그램 발송을 중계(오픈 릴레이)했음.
  // 현재: Authorization이 있으면 Supabase 토큰을 실제 검증. 사용자 지정 봇(botToken/slackWebhookUrl)은 로그인 사용자만 허용.
  //       서버 관리자 봇은 로그인 사용자 또는 Turnstile 통과 요청만 허용.
  let authedUser = null;
  if (req.headers.authorization) {
    try {
      authedUser = await verifyAuth(req);
    } catch (e) {
      return res.status(401).json({ ok: false, error: '인증에 실패했습니다. 다시 로그인해 주세요.' });
    }
  }
  const usesCallerCredentials = Boolean(reqBotToken || telegram?.botToken || reqSlackUrl);
  if (usesCallerCredentials && !authedUser) {
    return res.status(401).json({ ok: false, error: '로그인한 사용자만 사용자 지정 알림 채널을 사용할 수 있습니다.' });
  }
  if (!authedUser) {
    const token = turnstileToken || cfToken;
    if (!token) {
      return res.status(403).json({ ok: false, error: '알림 발송을 위해 로그인 또는 봇 방지 인증(Turnstile Token)이 필요합니다.' });
    }
    const cfCheck = await verifyTurnstileToken(token, ip);
    if (!cfCheck.success) {
      return res.status(403).json({ ok: false, error: cfCheck.error || '봇 방지 검증에 실패했습니다.' });
    }
  }

  // 1. 텔레그램 토큰/채팅ID 결정
  //  - 사용자 지정 봇(로그인 사용자): 요청의 botToken + chatId
  //  - 서버 관리자 봇: 채팅방은 항상 서버 환경변수의 관리자 채팅방
  //    (이전: 관리자 봇 토큰을 쓰면서 chatId만 바꿔 임의 채팅방으로 관리자 봇 메시지를 보낼 수 있었음)
  const callerBotToken = reqBotToken || telegram?.botToken;
  const botToken = callerBotToken || process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = callerBotToken
    ? (reqChatId || telegram?.chatId)
    : process.env.TELEGRAM_ADMIN_CHAT_ID;
  // [PART 4] 비로그인(Turnstile만 통과) 요청은 관리자 채팅방에 서식 없는 짧은 글로만 전달
  //   이전: 익명 사용자가 4,000자 본문과 parse_mode(HTML/Markdown)를 정해 관리자 채팅에
  //   '시스템 알림'처럼 보이는 카드·링크를 꾸며 보낼 수 있었다.
  const ALLOWED_PARSE_MODES = new Set(['Markdown', 'MarkdownV2', 'HTML']);
  const rawText = String(markdown || text || message || '');
  const contentText = authedUser
    ? rawText.slice(0, 4000)
    : `[비로그인 요청 · 내용 미검증]\n${rawText.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, 1500)}`;
  const effectiveParseMode = authedUser && ALLOWED_PARSE_MODES.has(parseMode) ? parseMode : undefined;

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
            ...(effectiveParseMode ? { parse_mode: effectiveParseMode } : {}),
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const data = await telegramRes.json();
      results.telegram.ok = !!data.ok;
      if (!data.ok) {
        console.warn('[Telegram API Error]', data.description);
        results.telegram.error = 'Telegram 알림 전송에 실패했습니다.';
      }
    } catch (err) {
      console.error('[Telegram API Exception]', err);
      results.telegram.ok = false;
      results.telegram.error = 'Telegram 알림 전송 중 오류가 발생했습니다.';
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
        signal: AbortSignal.timeout(8000),
      });
      results.slack.ok = slackRes.ok;
      if (!slackRes.ok) {
        console.warn('[Slack Webhook Error]', slackRes.status);
        results.slack.error = `Slack 알림 전송에 실패했습니다. (${slackRes.status})`;
      }
    } catch (err) {
      console.error('[Slack Webhook Exception]', err);
      results.slack.ok = false;
      results.slack.error = 'Slack 알림 전송 중 오류가 발생했습니다.';
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

