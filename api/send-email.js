// Vercel Serverless Function: Gmail SMTP Email Sender
// POST /api/send-email
// [SECURITY] 서버 전용 SMTP 자격증명 강제, 클라이언트 비밀번호 전송 완전 차단

import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth } from './_lib/auth-middleware.js';
import { verifyTurnstileToken } from './_lib/turnstile-validator.js';
import { checkMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // [SECURITY] 1. Rate Limiting (IP당 1분 3회, 10분 5회 제한)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
  const rateLimit = checkMultiTierRateLimit(`email:${ip}`, RATE_LIMIT_TIERS.STRICT);

  if (rateLimit.isLimited) {
    return res.status(429).json({
      ok: false,
      error: `이메일 발송 한도를 초과했습니다. (${Math.ceil(rateLimit.retryAfter / 60)}분 후 재시도 가능)`,
      retryAfter: rateLimit.retryAfter,
    });
  }

  // [SECURITY] 2. 인증 검증 (Bearer 세션 토큰 또는 Turnstile 봇 검증)
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
    const cfCheck = await verifyTurnstileToken(cfToken, ip);
    if (cfCheck.success) isAuthorized = true;
  }

  // OTP 인증 메일인 경우 (관리자 2단계 인증 발송 허용)
  const { recipients, subject, htmlBody } = req.body || {};
  const isOtpMail = subject && (subject.includes('2단계 인증') || subject.includes('보안코드') || subject.includes('OTP'));
  if (!isAuthorized && isOtpMail) {
    isAuthorized = true;
  }

  if (!isAuthorized && process.env.NODE_ENV === 'development') {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return res.status(401).json({
      ok: false,
      error: '이메일 발송을 위한 인증 토큰(Bearer) 또는 보안 인증이 필요합니다.'
    });
  }

  // [SECURITY] 3. SMTP 자격증명은 오직 서버 환경변수에서만 로드 (클라이언트에서 비밀번호 전송 완전 차단)
  const senderGmail = process.env.GMAIL_SMTP_USER;
  const senderAppPassword = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!recipients || !subject) {
    return res.status(400).json({ 
      ok: false, 
      error: '수신인(recipients)과 제목(subject)은 필수 항목입니다.' 
    });
  }

  if (!senderGmail || !senderAppPassword) {
    console.warn('[SMTP Error] GMAIL_SMTP_USER 또는 GMAIL_SMTP_APP_PASSWORD 환경변수 미설정');
    return res.status(200).json({ 
      ok: false, 
      error: '서버에 이메일 발송용 SMTP 계정이 구성되지 않았습니다. 관리자에게 문의하세요.' 
    });
  }

  try {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: senderGmail,
        pass: senderAppPassword,
      },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    const mailOptions = {
      from: `my김변 <${senderGmail}>`,
      to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
      subject,
      html: htmlBody || '',
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Email Send Error]', err);
    return res.status(200).json({ 
      ok: false, 
      error: err.message || 'Gmail SMTP 발송에 실패했습니다.' 
    });
  }
}
