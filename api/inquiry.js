// Vercel Serverless Function: 고객 1:1 문의 등록·조회
//   POST /api/inquiry?action=create  — 문의 등록 (로그인 세션 또는 Cloudflare Turnstile 필수)
//   POST /api/inquiry?action=lookup  — 비회원 문의 조회 (문의번호 + 4자리 비밀번호, 5회 오입력 시 잠금)
//   GET  /api/inquiry?action=mine    — 로그인 회원 본인 문의 목록
//   GET  /api/inquiry?action=admin-list / POST admin-update(상태·담당) / POST admin-reply (2단계 인증 관리자)
//
// CT-8: 상태 4개(접수·확인 중·답변 완료·종결)·담당자·처리 기한(접수 + 2영업일), 첨부는 비공개 저장소(inquiry-files),
//       첫 답변 때 알림 1회(회원: 앱 알림 + 이메일 / 비회원: 연락처가 휴대폰이면 문자, 이메일이면 메일),
//       답변 등록·수정·삭제와 상태 변경은 관리자 조치 기록(admin_actions)에 남김
//
// 기존: 문의가 브라우저 sessionStorage에만 저장돼 관리자에게 전달되지 않았고, Turnstile 토큰은 검증되지 않았으며,
//       비회원 비밀번호가 평문으로 저장됐다. 이 함수는 service role로 client_inquiries(id, data jsonb)에 저장한다.

import crypto from 'crypto';
import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth, isAdminWithMfa, supabase } from './_lib/auth-middleware.js';
import { verifyTurnstileToken } from './_lib/turnstile-validator.js';
import { withMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';

const TABLE = 'client_inquiries';
const MAX_ATTEMPTS = 5;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // base64 합계 (Vercel 요청 본문 한도 4.5MB 내)
const CATEGORIES = new Set(['site_usage', 'account', 'diagnosis', 'lawyer_matching', 'payment', 'bug_report', 'suggestion', 'privacy', 'report', 'other']);
const STATUSES = new Set(['pending', 'in_progress', 'replied', 'closed']);
const BUCKET = 'inquiry-files';
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const SITE = 'https://mykim.kr';

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** 클라이언트에 돌려줄 안전한 필드만 */
function toPublic(id, d) {
  return {
    id,
    title: d.title,
    content: d.content,
    category: d.category,
    status: STATUSES.has(d.status) ? d.status : 'pending',
    createdAt: d.createdAt,
    replyContent: d.replyContent || undefined,
    repliedAt: d.repliedAt || undefined,
    attachments: (d.attachments || []).map(a => ({ fileName: a.fileName, fileSize: a.fileSize, fileType: a.fileType })),
  };
}

async function adminAction(user, action, targetId, before, after) {
  await supabase.from('admin_actions').insert({
    actor_user_id: user.id, actor_email: user.email || null, action, target_type: 'client_inquiry', target_id: targetId,
    before_value: before ?? null, after_value: after ?? null,
  }).then(() => {}, () => {});
}

async function businessDue(fromIso) {
  try {
    const { data, error } = await supabase.rpc('add_business_days', { p_from: fromIso, p_days: 2 });
    if (!error && data) return new Date(data).toISOString();
  } catch { /* 아래 근사치 */ }
  // 공휴일 표를 못 읽으면 주말만 건너뛴 근사치
  const d = new Date(fromIso);
  let left = 2;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = new Date(d.getTime() + 9 * 3600e3).getUTCDay(); if (w !== 0 && w !== 6) left -= 1; }
  return d.toISOString();
}

const isMobile = (v) => /^01[016789]\d{7,8}$/.test(String(v || '').replace(/[^0-9]/g, ''));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const byteLen = (t) => Array.from(t).reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);

async function sendMail(to, subject, text) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) throw new Error('mail not configured');
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({ service: 'gmail', auth: { user, pass }, connectionTimeout: 8000, greetingTimeout: 5000, socketTimeout: 10000 });
  await transporter.sendMail({ from: `마이김변 <${user}>`, to, subject, text });
}

async function sendSms(phone, text) {
  const { messageService, POPBILL_CONFIG } = await import('./_lib/popbill-service.js');
  if (!POPBILL_CONFIG.isConfigured || !POPBILL_CONFIG.senderPhone) throw new Error('sms not configured');
  const sender = POPBILL_CONFIG.senderPhone.replace(/[^0-9]/g, '');
  const receiver = String(phone).replace(/[^0-9]/g, '');
  await new Promise((resolve, reject) => {
    if (byteLen(text) <= 90) {
      messageService.sendSMS(POPBILL_CONFIG.corpNum, sender, receiver, '', text, null, false, POPBILL_CONFIG.userId, `INQ-${Date.now()}`, resolve, reject);
    } else {
      messageService.sendLMS(POPBILL_CONFIG.corpNum, sender, receiver, '', '마이김변 문의 답변', text, null, false, POPBILL_CONFIG.userId, `INQ-${Date.now()}`, resolve, reject);
    }
  });
}

/** 첫 답변 알림 1회. 알림 글에 문의 내용은 넣지 않는다 */
async function notifyReply(id, d) {
  const sent = [];
  const failed = [];
  if (d.ownerUserId) {
    const { error } = await supabase.rpc('notify_user', {
      p_recipient: d.ownerUserId, p_audience: 'client', p_office_id: null, p_kind: 'inquiry_reply',
      p_title: '1:1 문의에 답변이 왔어요', p_body: '문의 내역에서 답변을 확인해 주세요.', p_link_type: 'inquiry', p_link_id: id, p_dedupe_key: `inquiry:${id}`,
    });
    if (error) failed.push('app'); else sent.push('app');
    try {
      const { data } = await supabase.auth.admin.getUserById(d.ownerUserId);
      const email = data?.user?.email;
      if (email) {
        await sendMail(email, '[마이김변] 1:1 문의에 답변이 등록됐어요', `문의하신 내용에 답변이 등록됐어요.\n확인하기: ${SITE}/?tab=inquiry\n\n이 메일에는 문의 내용이 들어 있지 않아요.`);
        sent.push('email');
      }
    } catch { failed.push('email'); }
  } else if (d.contactInfo) {
    try {
      if (isMobile(d.contactInfo)) {
        await sendSms(d.contactInfo, `[마이김변] 1:1 문의 답변이 등록됐어요. ${SITE} 1:1 문의에서 문의번호로 확인하세요.`);
        sent.push('sms');
      } else if (isEmail(d.contactInfo)) {
        await sendMail(d.contactInfo.trim(), '[마이김변] 1:1 문의에 답변이 등록됐어요', `문의(문의번호 ${id})에 답변이 등록됐어요.\n${SITE} 1:1 문의에서 문의번호와 비밀번호로 확인해 주세요.`);
        sent.push('email');
      }
    } catch { failed.push(isMobile(d.contactInfo) ? 'sms' : 'email'); }
  }
  return { sent, failed, at: new Date().toISOString() };
}

async function getUser(req) {
  if (!req.headers.authorization?.startsWith('Bearer ')) return null;
  try { return await verifyAuth(req); } catch { return null; }
}

async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: '문의 서버가 설정되지 않았습니다.' });
  }
  const action = req.query?.action || req.body?.action;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : (req.socket?.remoteAddress || '');

  // ── 로그인 회원 본인 문의 목록 ──
  if (action === 'mine') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    const { data, error } = await supabase.from(TABLE).select('id, data').eq('data->>ownerUserId', user.id).limit(50);
    if (error) return res.status(500).json({ ok: false, error: '문의 내역을 불러오지 못했습니다.' });
    const items = (data || [])
      .map(r => toPublic(r.id, r.data || {}))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.status(200).json({ ok: true, items });
  }

  // ── [PART 3-6] 관리자: 전체 문의 목록 (2단계 인증 관리자만) ──
  // 이전: 관리자 화면은 자기 브라우저 저장소의 시연 문의만 보여 실제 접수된 문의를 볼 수 없었음
  if (action === 'admin-list') {
    const user = await getUser(req);
    if (!user || !isAdminWithMfa(req, user)) return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 조회할 수 있습니다.' });
    const { data, error } = await supabase.from(TABLE).select('id, data').order('id', { ascending: false }).limit(300);
    if (error) return res.status(500).json({ ok: false, error: '문의 목록을 불러오지 못했습니다.' });
    const rows = data || [];
    // 첨부: 저장소 파일은 5분 주소, 예전 base64는 그대로
    const paths = rows.flatMap(r => (r.data?.attachments || []).map(a => a.path).filter(Boolean));
    const signed = {};
    if (paths.length) {
      const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 300);
      (urls || []).forEach(u => { if (u?.path && u.signedUrl) signed[u.path] = u.signedUrl; });
    }
    const items = rows.map(r => {
      const d = r.data || {};
      return {
        ...toPublic(r.id, d),
        clientName: d.clientName || '',
        isMember: Boolean(d.ownerUserId),
        contactInfo: d.contactInfo || undefined,
        source: d.source || 'web',
        assignee: d.assignee || undefined,
        dueAt: d.dueAt || undefined,
        replyNotice: d.replyNotice || undefined,
        // 첨부는 관리자에게만
        attachments: (d.attachments || []).map(a => ({ fileName: a.fileName, fileSize: a.fileSize, fileType: a.fileType, dataUrl: a.path ? signed[a.path] || '' : a.dataUrl })),
      };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.status(200).json({ ok: true, items });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const body = req.body || {};

  // ── [PART 3-6] 관리자: 답변 등록·수정·삭제 (의뢰인 '내 문의'·비회원 조회에 그대로 반영) ──
  if (action === 'admin-reply') {
    const user = await getUser(req);
    if (!user || !isAdminWithMfa(req, user)) return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 답변할 수 있습니다.' });
    const id = clip(body.id, 80);
    const reply = typeof body.replyContent === 'string' ? body.replyContent.trim().slice(0, 4000) : '';
    if (!id) return res.status(400).json({ ok: false, error: '문의번호가 없습니다.' });
    const { data: row } = await supabase.from(TABLE).select('id, data').eq('id', id).maybeSingle();
    if (!row) return res.status(404).json({ ok: false, error: '문의를 찾을 수 없습니다.' });
    const d = row.data || {};
    let next = reply
      ? { ...d, replyContent: reply, repliedAt: new Date().toISOString(), repliedBy: user.email || user.id, status: d.status === 'closed' ? 'closed' : 'replied', assignee: d.assignee || user.email || undefined }
      : { ...d, replyContent: undefined, repliedAt: undefined, repliedBy: undefined, status: 'in_progress' };
    const { error } = await supabase.from(TABLE).update({ data: next }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: '답변을 저장하지 못했습니다.' });
    await adminAction(user, reply ? (d.replyContent ? 'inquiry.reply_edit' : 'inquiry.reply') : 'inquiry.reply_delete', id,
      d.replyContent ? { reply: d.replyContent } : null, reply ? { reply } : null);
    // 첫 답변 때만 알림 (고친 답변은 다시 알리지 않음)
    let notice = d.replyNotice;
    if (reply && !d.replyNotice) {
      notice = await notifyReply(id, d);
      next = { ...next, replyNotice: notice };
      await supabase.from(TABLE).update({ data: next }).eq('id', id).then(() => {}, () => {});
    }
    void ip;
    return res.status(200).json({ ok: true, item: { ...toPublic(id, next), assignee: next.assignee, dueAt: next.dueAt, replyNotice: notice } });
  }

  // ── 관리자: 상태·담당자 바꾸기 ──
  if (action === 'admin-update') {
    const user = await getUser(req);
    if (!user || !isAdminWithMfa(req, user)) return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 바꿀 수 있습니다.' });
    const id = clip(body.id, 80);
    if (!id) return res.status(400).json({ ok: false, error: '문의번호가 없습니다.' });
    const { data: row } = await supabase.from(TABLE).select('id, data').eq('id', id).maybeSingle();
    if (!row) return res.status(404).json({ ok: false, error: '문의를 찾을 수 없습니다.' });
    const d = row.data || {};
    const next = { ...d };
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) return res.status(400).json({ ok: false, error: '상태 값이 올바르지 않습니다.' });
      if (body.status === 'replied' && !d.replyContent) return res.status(400).json({ ok: false, error: '답변을 먼저 작성해 주세요.' });
      next.status = body.status;
    }
    if (body.assignee !== undefined) next.assignee = clip(body.assignee, 80) || undefined;
    const { error } = await supabase.from(TABLE).update({ data: next }).eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: '저장하지 못했습니다.' });
    await adminAction(user, 'inquiry.update', id, { status: d.status || 'pending', assignee: d.assignee || null }, { status: next.status || 'pending', assignee: next.assignee || null });
    return res.status(200).json({ ok: true, item: { ...toPublic(id, next), assignee: next.assignee, dueAt: next.dueAt } });
  }

  // ── 로그인 회원 본인 문의 전체 삭제 (마이페이지 데이터 삭제) ──
  if (action === 'delete-mine') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    const { data, error } = await supabase.from(TABLE).delete().eq('data->>ownerUserId', user.id).select('id');
    if (error) return res.status(500).json({ ok: false, error: '문의 삭제에 실패했습니다.' });
    return res.status(200).json({ ok: true, deleted: (data || []).length });
  }

  // ── 비회원 조회 ──
  if (action === 'lookup') {
    const id = clip(body.id, 80);
    const password = clip(body.password, 4);
    if (!id || !/^\d{4}$/.test(password)) return res.status(400).json({ ok: false, error: '문의번호와 비밀번호 4자리를 입력해 주세요.' });
    const { data: row } = await supabase.from(TABLE).select('id, data').eq('id', id).maybeSingle();
    const d = row?.data;
    // 존재 여부를 구분하지 않는 동일 오류 메시지
    if (!d || !d.passwordHash) return res.status(200).json({ ok: false, error: '문의번호 또는 비밀번호가 일치하지 않습니다.' });
    if ((d.failedAttempts || 0) >= MAX_ATTEMPTS) {
      return res.status(200).json({ ok: false, locked: true, error: '비밀번호를 여러 번 잘못 입력해 조회가 잠겼습니다. 고객센터로 문의해 주세요.' });
    }
    if (!verifyPassword(password, d.passwordHash)) {
      await supabase.from(TABLE).update({ data: { ...d, failedAttempts: (d.failedAttempts || 0) + 1 } }).eq('id', id);
      return res.status(200).json({ ok: false, error: '문의번호 또는 비밀번호가 일치하지 않습니다.' });
    }
    if (d.failedAttempts) await supabase.from(TABLE).update({ data: { ...d, failedAttempts: 0 } }).eq('id', id);
    return res.status(200).json({ ok: true, item: toPublic(id, d) });
  }

  // ── 문의 등록 ──
  if (action === 'create') {
    const user = await getUser(req);
    if (!user) {
      const check = await verifyTurnstileToken(body.turnstileToken, ip, { allowFallbackWhenMissingKey: true });
      if (!check.success) return res.status(403).json({ ok: false, error: check.error || '봇 방지 인증에 실패했습니다.' });
    }
    const title = clip(body.title, 120);
    const content = clip(body.content, 4000);
    if (!title || !content) return res.status(400).json({ ok: false, error: '문의 제목과 내용을 입력해 주세요.' });
    const nickname = clip(body.nickname, 30) || (user ? '회원' : '');
    const password = clip(body.password, 4);
    if (!user) {
      if (!nickname) return res.status(400).json({ ok: false, error: '닉네임을 입력해 주세요.' });
      if (!/^\d{4}$/.test(password)) return res.status(400).json({ ok: false, error: '확인용 비밀번호 4자리 숫자를 입력해 주세요.' });
    }

    const rawAttachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 2) : [];
    let total = 0;
    const pending = [];
    for (const a of rawAttachments) {
      const dataUrl = typeof a?.dataUrl === 'string' ? a.dataUrl : '';
      const m = /^data:(image\/(png|jpeg|gif|webp)|application\/pdf);base64,(.*)$/s.exec(dataUrl);
      if (dataUrl && !m) {
        return res.status(400).json({ ok: false, error: '첨부 파일은 이미지(PNG/JPG/GIF/WEBP) 또는 PDF만 가능합니다.' });
      }
      total += dataUrl.length;
      if (m) pending.push({ fileName: clip(a?.fileName, 120), fileType: m[1], buffer: Buffer.from(m[3], 'base64') });
    }
    if (total > MAX_ATTACHMENT_BYTES) return res.status(413).json({ ok: false, error: '첨부 파일 용량이 너무 큽니다. (합계 약 2MB 이하)' });

    const id = `inq-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
    // 첨부는 비공개 저장소에 (문의 행에는 경로만)
    const attachments = [];
    for (let n = 0; n < pending.length; n += 1) {
      const p = pending[n];
      const path = `${id}/${n + 1}.${MIME_EXT[p.fileType] || 'bin'}`;
      const up = await supabase.storage.from(BUCKET).upload(path, p.buffer, { contentType: p.fileType, upsert: false });
      if (up.error) {
        if (n > 0) await supabase.storage.from(BUCKET).remove(attachments.map(x => x.path)).then(() => {}, () => {});
        return res.status(500).json({ ok: false, error: '첨부 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
      attachments.push({ fileName: p.fileName, fileSize: p.buffer.length, fileType: p.fileType, path });
    }
    const createdAt = new Date().toISOString();
    const data = {
      id,
      ownerUserId: user?.id || null,
      clientId: user?.id || `non-member-${id}`,
      clientName: nickname,
      title,
      content,
      category: CATEGORIES.has(body.category) ? body.category : 'other',
      contactInfo: clip(body.contact, 100) || undefined,
      passwordHash: user ? undefined : hashPassword(password),
      failedAttempts: 0,
      attachments,
      source: clip(body.source, 30) || 'web',
      status: 'pending',
      createdAt,
      dueAt: await businessDue(createdAt),
    };
    const { error } = await supabase.from(TABLE).insert([{ id, data }]);
    if (error) {
      if (attachments.length) await supabase.storage.from(BUCKET).remove(attachments.map(x => x.path)).then(() => {}, () => {});
      console.error('[inquiry] insert failed', error.message);
      return res.status(500).json({ ok: false, error: '문의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    return res.status(200).json({ ok: true, id, item: toPublic(id, data) });
  }

  return res.status(400).json({ ok: false, error: '알 수 없는 요청입니다.' });
}

export default withMultiTierRateLimit(handler, RATE_LIMIT_TIERS.STANDARD);
