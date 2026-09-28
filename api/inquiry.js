// Vercel Serverless Function: 고객 1:1 문의 등록·조회
//   POST /api/inquiry?action=create  — 문의 등록 (로그인 세션 또는 Cloudflare Turnstile 필수)
//   POST /api/inquiry?action=lookup  — 비회원 문의 조회 (문의번호 + 4자리 비밀번호, 5회 오입력 시 잠금)
//   GET  /api/inquiry?action=mine    — 로그인 회원 본인 문의 목록
//
// 기존: 문의가 브라우저 sessionStorage에만 저장돼 관리자에게 전달되지 않았고, Turnstile 토큰은 검증되지 않았으며,
//       비회원 비밀번호가 평문으로 저장됐다. 이 함수는 service role로 client_inquiries(id, data jsonb)에 저장한다.

import crypto from 'crypto';
import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth, supabase } from './_lib/auth-middleware.js';
import { verifyTurnstileToken } from './_lib/turnstile-validator.js';
import { withMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';

const TABLE = 'client_inquiries';
const MAX_ATTEMPTS = 5;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // base64 합계 (Vercel 요청 본문 한도 4.5MB 내)
const CATEGORIES = new Set(['site_usage', 'account', 'diagnosis', 'lawyer_matching', 'payment', 'bug_report', 'suggestion', 'other']);

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
    status: d.status || 'pending',
    createdAt: d.createdAt,
    replyContent: d.replyContent || undefined,
    repliedAt: d.repliedAt || undefined,
    attachments: (d.attachments || []).map(a => ({ fileName: a.fileName, fileSize: a.fileSize, fileType: a.fileType })),
  };
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

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const body = req.body || {};

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
      const check = await verifyTurnstileToken(body.turnstileToken, ip);
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
    const attachments = [];
    for (const a of rawAttachments) {
      const dataUrl = typeof a?.dataUrl === 'string' ? a.dataUrl : '';
      if (dataUrl && !/^data:(image\/(png|jpeg|gif|webp)|application\/pdf);base64,/.test(dataUrl)) {
        return res.status(400).json({ ok: false, error: '첨부 파일은 이미지(PNG/JPG/GIF/WEBP) 또는 PDF만 가능합니다.' });
      }
      total += dataUrl.length;
      attachments.push({ fileName: clip(a?.fileName, 120), fileSize: Number(a?.fileSize) || 0, fileType: clip(a?.fileType, 60), dataUrl });
    }
    if (total > MAX_ATTACHMENT_BYTES) return res.status(413).json({ ok: false, error: '첨부 파일 용량이 너무 큽니다. (합계 약 2MB 이하)' });

    const id = `inq-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
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
      createdAt: new Date().toISOString(),
    };
    const { error } = await supabase.from(TABLE).insert([{ id, data }]);
    if (error) {
      console.error('[inquiry] insert failed', error.message);
      return res.status(500).json({ ok: false, error: '문의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    return res.status(200).json({ ok: true, id, item: toPublic(id, data) });
  }

  return res.status(400).json({ ok: false, error: '알 수 없는 요청입니다.' });
}

export default withMultiTierRateLimit(handler, RATE_LIMIT_TIERS.STANDARD);
