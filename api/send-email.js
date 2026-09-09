// Vercel Serverless Function: Gmail SMTP Email Sender
// POST /api/send-email
// Uses nodemailer with Gmail SMTP (각 로펌이 자체 Gmail 계정 사용)

import { withAuth } from './_lib/auth-middleware.js';
import { setCorsHeaders } from './_lib/popbill-service.js';

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { senderGmail: reqSender, senderAppPassword: reqPass, recipients, subject, htmlBody } = req.body || {};

  // 서버 환경변수(기본 플랫폼 발신 계정) 또는 요청자 지정 계정 사용
  const senderGmail = reqSender || process.env.GMAIL_SMTP_USER;
  const senderAppPassword = reqPass || process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!senderGmail || !senderAppPassword || !recipients || !subject) {
    return res.status(400).json({ 
      ok: false, 
      error: '발신 Gmail 계정 및 인증 정보(앱 비밀번호), 수신인, 제목은 필수입니다.' 
    });
  }

  try {
    // Dynamic import nodemailer (Vercel serverless에서 사용)
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
      from: `다시시작 CRM <${senderGmail}>`,
      to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
      subject,
      html: htmlBody || '',
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(200).json({ 
      ok: false, 
      error: err.message || 'Gmail SMTP 발송 실패. 앱 비밀번호를 확인해주세요.' 
    });
  }
}

export default withAuth(handler);
