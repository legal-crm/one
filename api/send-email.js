// Vercel Serverless Function: Gmail SMTP Email Sender
// POST /api/send-email
// [SECURITY] 서버 전용 SMTP 자격증명 강제, 클라이언트 비밀번호 전송 완전 차단

import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth, isAdminWithMfa, supabase } from './_lib/auth-middleware.js';
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

  // [SECURITY] 2. 인증 검증 — 승인된 변호사(직원 포함) 또는 플랫폼 관리자만
  // 이전 문제: 제목에 'OTP'·'보안코드'만 넣으면 인증 없이 통과했고, Turnstile 토큰만으로도
  //   회사 Gmail 계정에서 임의 수신자에게 임의 HTML을 보낼 수 있었다(피싱 중계 가능).
  //   관리자 OTP 메일은 더 이상 쓰지 않는다(인증 앱 TOTP로 대체).
  let user = null;
  try {
    user = await verifyAuth(req);
  } catch (_) {
    user = null;
  }
  if (!user) {
    return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
  }

  const isAdmin = isAdminWithMfa(req, user);
  if (!isAdmin) {
    // 서비스 롤 키가 없으면 조회가 RLS에 막혀 거부된다(실패 시 차단)
    const { data: account, error: accountError } = await supabase
      .from('lawyer_accounts')
      .select('approved')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (accountError || !account?.approved) {
      return res.status(403).json({ ok: false, error: '승인된 변호사 계정만 이메일을 보낼 수 있습니다.' });
    }
  }

  // [PART 4] 계정 단위 한도 추가 (이전: IP 단위만 — IP를 바꾸면 한 계정으로 계속 발송 가능)
  const userLimit = checkMultiTierRateLimit(`email:user:${user.id}`, RATE_LIMIT_TIERS.STANDARD);
  if (userLimit.isLimited) {
    return res.status(429).json({ ok: false, error: `이메일 발송 한도를 초과했습니다. (${Math.ceil(userLimit.retryAfter / 60)}분 후 재시도 가능)` });
  }

  const { recipients, subject, htmlBody } = req.body || {};

  // [SECURITY] 3. 입력 제한 (수신자 10명, 제목 200자, 본문 100KB)
  const recipientList = (Array.isArray(recipients) ? recipients : [recipients])
    .map(r => String(r || '').trim())
    .filter(Boolean);
  const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
  if (recipientList.length === 0 || recipientList.length > 10 || !recipientList.every(r => r.length <= 254 && EMAIL_RE.test(r))) {
    return res.status(400).json({ ok: false, error: '수신자 이메일 형식을 확인해 주세요. (최대 10명)' });
  }
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject)) {
    return res.status(400).json({ ok: false, error: '제목은 1~200자, 줄바꿈 없이 입력해 주세요.' });
  }
  if (htmlBody != null && (typeof htmlBody !== 'string' || htmlBody.length > 100_000)) {
    return res.status(400).json({ ok: false, error: '본문이 너무 깁니다. (최대 100KB)' });
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
      to: recipientList.join(', '),
      subject,
      html: htmlBody || '',
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Email Send Error]', err);
    return res.status(200).json({ 
      ok: false, 
      // SMTP 서버 응답 원문은 서버 로그에만 남긴다 (이전: err.message를 그대로 반환)
      error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' 
    });
  }
}
