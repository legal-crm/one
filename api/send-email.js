// Vercel Serverless Function: Gmail SMTP Email Sender
// POST /api/send-email
// Uses nodemailer with Gmail SMTP (각 로펌이 자체 Gmail 계정 사용)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { senderGmail, senderAppPassword, recipients, subject, htmlBody } = req.body;

  if (!senderGmail || !senderAppPassword || !recipients || !subject) {
    return res.status(400).json({ ok: false, error: 'senderGmail, senderAppPassword, recipients, subject are required' });
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
