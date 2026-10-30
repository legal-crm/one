// 바깥 채널 알림 발송 (ST-7·ST-8) — POST /api/notify?channel=outbox
// Supabase pg_cron(5분마다, 대기열이 있을 때만)과 팀 방 테스트만 부른다. 헤더 x-mykim-cron = vault 토큰.
// 글에는 종류·건수·링크만 넣는다 (가명·채무액·소득·사건번호·메시지 내용 없음).
import { supabase } from '../auth-middleware.js';

const LAWYER_LINK = 'https://mykim.kr/?role=lawyer';
const LABEL = {
  consult_request_new: '새 상담 요청',
  client_message: '의뢰인 메시지',
  client_document: '의뢰인이 낸 서류',
  fee_client_report: '의뢰인 입금 알림',
  consult_request_due_soon: '응답 기한이 다가온 상담 요청',
  consult_request_expired: '응답 기한이 지난 상담 요청',
  test: '팀 알림 연결 테스트',
};

export function renderOutbox(kind, count) {
  const label = LABEL[kind] || '확인할 알림';
  if (kind === 'test') {
    return { subject: '[마이김변] 팀 알림 연결 테스트', text: '[마이김변] 팀 알림 방이 연결되었습니다. 앞으로 새 상담 요청·의뢰인 메시지 같은 알림이 건수와 링크로만 옵니다.' };
  }
  const n = Math.max(1, Number(count) || 1);
  return {
    subject: `[마이김변] ${label} ${n}건`,
    text: `[마이김변] ${label} ${n}건이 있어요.\n확인하기: ${LAWYER_LINK}\n\n(알림에는 의뢰인 정보가 들어가지 않습니다. 받기 설정은 마이김변 설정 › 내 알림 받기에서 바꿀 수 있어요.)`,
  };
}

async function sendEmail(to, subject, text) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) throw new Error('이메일 발송 계정이 서버에 설정되지 않았습니다');
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    service: 'gmail', auth: { user, pass }, connectionTimeout: 8000, greetingTimeout: 5000, socketTimeout: 10000,
  });
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0f172a">${text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(https:\/\/mykim\.kr\/\S*)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, '<br>')}</div>`;
  await transporter.sendMail({ from: `마이김변 <${user}>`, to, subject, text, html });
}

async function sendTelegram(token, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.error_code === 401 ? '봇 토큰이 맞지 않습니다' : data.error_code === 400 ? '채팅방 ID를 확인해 주세요 (봇을 방에 초대했는지)' : '텔레그램 전송에 실패했습니다');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, error: 'server key missing' });
  const token = String(req.headers['x-mykim-cron'] || '');
  const { data: okToken, error: tokenErr } = await supabase.rpc('check_cron_token', { p_token: token });
  if (tokenErr || okToken !== true) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { data: rows, error } = await supabase.rpc('claim_notification_deliveries', { p_limit: 30 });
  if (error) {
    console.error('[notify-outbox] claim failed:', error.message);
    return res.status(500).json({ ok: false, error: 'claim failed' });
  }
  let sent = 0;
  let failed = 0;
  for (const r of rows || []) {
    const msg = renderOutbox(r.kind, r.open_count);
    try {
      if (r.channel === 'email') await sendEmail(r.email, msg.subject, msg.text);
      else await sendTelegram(r.telegram_token, r.telegram_chat_id, msg.text);
      await supabase.rpc('finish_notification_delivery', { p_id: r.delivery_id, p_status: 'sent', p_error: null });
      sent++;
    } catch (e) {
      await supabase.rpc('finish_notification_delivery', { p_id: r.delivery_id, p_status: 'failed', p_error: String(e?.message || '발송 실패').slice(0, 300) });
      failed++;
    }
  }
  return res.status(200).json({ ok: true, claimed: (rows || []).length, sent, failed });
}
