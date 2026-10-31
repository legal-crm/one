// Vercel Serverless Function: 마이김변 업무폰 기기 API (CL-3·CL-4·AP, 11 기획서 4-3)
//   모든 요청: POST /api/device?route=<경로>  (JSON 본문)
//   기기 인증: 헤더 Authorization: Device mkd_…  (연결 때 받은 기기 토큰, 서버엔 SHA-256 해시만)
//   경로
//     pair              {code, device:{model, os_version, app_version, label, line_label, line_mode, permissions}} → {device_token, status}
//     heartbeat         {device_time, app_version, os_version, model, permissions, pending_uploads, failed_uploads} → 정책·번호 해시 소금값
//     contacts          {since?} → [{h, removed}]  (since 없으면 전체: 앱은 6시간마다 전체로 바꿔 끼운다)
//     lookup            {h} → {found, label, stage}  (가명·단계만)
//     logs              {logs:[{key, h, channel, direction, result, duration_sec, occurred_at, body}]} (최대 200건)
//     recordings-init   {log_key, mime_type, size_bytes, duration_sec, recorded_at, original_name, sha256} → 서명 업로드 주소
//     recordings-complete {id} → 서버가 파일을 내려받아 SHA-256을 다시 계산해 기기 지문과 비교
//     notes             {log_key, note, next_contact_at}
//     register-request  {phone, occurred_at, note}
//     commands          {} → 받을 명령(전화 걸기·문자 보내기)
//     command-result    {id, status:'done'|'failed', detail, parts}
//     unpair            {}
//   웹(로그인 사용자): verify-recording {id}  — 웹에서 올린 녹음의 서버 지문 확인 (Authorization: Bearer <JWT>)
//
// 사무소·직원은 토큰으로 정한다. 앱이 보낸 사무소 값은 받지 않는다. 개인정보(번호·문자 내용)는 로그에 남기지 않는다.
import crypto from 'node:crypto';
import { supabase, verifyAuth } from './_lib/auth-middleware.js';
import { checkRateLimit } from './_lib/rate-limiter.js';

const MAX_BODY = 400 * 1024;
const BUCKET = 'call-recordings';

const sha256Hex = (input) => crypto.createHash('sha256').update(input).digest('hex');
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'object') return b;
  const text = String(b);
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return f ? String(f).split(',')[0].trim() : (req.socket?.remoteAddress || '');
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const e = new Error(error.message || 'rpc failed');
    e.code = error.code;
    throw e;
  }
  return data;
}

async function deviceFromRequest(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Device ') ? auth.slice(7).trim() : '';
  if (!/^mkd_[A-Za-z0-9_-]{40,60}$/.test(token)) return { error: 'invalid_token' };
  const info = await rpc('device_auth', { p_token_hash: sha256Hex(token) });
  if (!info?.ok) return { error: info?.error || 'unknown_device', wipe: !!info?.wipe };
  return { device: info };
}

// 저장소 파일을 내려받아 지문 계산 (최대 50MB)
async function hashStoredObject(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { sha: sha256Hex(buf), size: buf.length };
}

async function loadRecording(id) {
  const { data, error } = await supabase.from('call_recordings')
    .select('id, storage_path, device_id, uploaded_by, status, deleted_at')
    .eq('id', id).maybeSingle();
  if (error) throw new Error('recording lookup failed');
  return data;
}

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST만 받습니다.' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ ok: false, error: '서버가 설정되지 않았습니다.' });

  const route = String(req.query?.route || '');
  const body = parseBody(req);
  if (body === null) return res.status(413).json({ ok: false, error: '본문을 읽을 수 없습니다.' });

  try {
    // ── 웹: 올린 녹음 지문 확인 ──
    if (route === 'verify-recording') {
      let user;
      try { user = await verifyAuth(req); } catch { return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' }); }
      if (checkRateLimit(`device-verify:${user.id}`, 20, 60 * 1000).isLimited) return res.status(429).json({ ok: false, error: '잠시 후 다시 시도해 주세요.' });
      if (!isUuid(body.id)) return res.status(400).json({ ok: false, error: '녹음 번호가 없습니다.' });
      const rec = await loadRecording(body.id);
      if (!rec || rec.deleted_at || rec.device_id || rec.uploaded_by !== user.id) return res.status(404).json({ ok: false, error: '녹음을 찾지 못했습니다.' });
      const hashed = rec.status === 'uploading' ? await hashStoredObject(rec.storage_path) : null;
      const result = await rpc('finish_call_recording', {
        p_id: rec.id, p_server_sha: hashed?.sha ?? null, p_size: hashed?.size ?? null, p_actor: user.id, p_device: null,
      });
      return res.status(200).json(result);
    }

    // ── 기기: 연결 ──
    if (route === 'pair') {
      if (checkRateLimit(`device-pair:${clientIp(req)}`, 10, 60 * 1000).isLimited) return res.status(429).json({ ok: false, error: 'rate_limited' });
      const code = clip(body.code, 20);
      if (!code) return res.status(400).json({ ok: false, error: 'code_required' });
      const token = 'mkd_' + crypto.randomBytes(32).toString('base64url');
      const d = body.device && typeof body.device === 'object' ? body.device : {};
      const result = await rpc('device_pair', {
        p_code: code,
        p_token_hash: sha256Hex(token),
        p: {
          model: clip(d.model, 60), os_version: clip(d.os_version, 20), app_version: clip(d.app_version, 20),
          label: clip(d.label, 40), line_label: clip(d.line_label, 30), line_mode: d.line_mode === 'shared' ? 'shared' : 'personal',
          permissions: d.permissions && typeof d.permissions === 'object' ? d.permissions : {},
        },
      });
      if (!result?.ok) return res.status(400).json({ ok: false, error: result?.error || 'pair_failed' });
      return res.status(200).json({ ok: true, device_token: token, device_id: result.device_id, status: result.status });
    }

    const auth = await deviceFromRequest(req);
    if (auth.error) return res.status(auth.wipe ? 410 : 401).json({ ok: false, error: auth.error, wipe: !!auth.wipe });
    const device = auth.device;
    if (checkRateLimit(`device:${device.device_id}`, 120, 60 * 1000).isLimited) return res.status(429).json({ ok: false, error: 'rate_limited' });

    const pendingAllowed = new Set(['heartbeat', 'unpair']);
    if (device.status !== 'active' && !pendingAllowed.has(route)) {
      return res.status(403).json({ ok: false, error: 'waiting_for_approval' });
    }

    switch (route) {
      case 'heartbeat': {
        const data = await rpc('device_heartbeat', {
          p_device_id: device.device_id,
          p: {
            device_time: clip(body.device_time, 40), app_version: clip(body.app_version, 20), os_version: clip(body.os_version, 20),
            model: clip(body.model, 60), permissions: body.permissions && typeof body.permissions === 'object' ? body.permissions : undefined,
            pending_uploads: Number.isFinite(body.pending_uploads) ? body.pending_uploads : undefined,
            failed_uploads: Number.isFinite(body.failed_uploads) ? body.failed_uploads : undefined,
          },
        });
        return res.status(200).json({ ok: true, ...data });
      }
      case 'contacts': {
        const since = clip(body.since, 40) || null;
        const data = await rpc('device_contacts', { p_device_id: device.device_id, p_since: since });
        return res.status(200).json({ ok: true, ...data });
      }
      case 'lookup': {
        const h = clip(body.h, 64).toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(h)) return res.status(400).json({ ok: false, error: 'invalid_hash' });
        const data = await rpc('device_lookup', { p_device_id: device.device_id, p_hash: h });
        return res.status(200).json({ ok: true, ...data });
      }
      case 'logs': {
        const logs = Array.isArray(body.logs) ? body.logs.slice(0, 200) : [];
        const data = await rpc('device_ingest_logs', { p_device_id: device.device_id, p_logs: logs });
        return res.status(200).json({ ok: true, ...data });
      }
      case 'recordings-init': {
        const data = await rpc('device_recording_init', {
          p_device_id: device.device_id,
          p: {
            log_key: clip(body.log_key, 120), mime_type: clip(body.mime_type, 40), size_bytes: body.size_bytes,
            duration_sec: body.duration_sec, recorded_at: clip(body.recorded_at, 40), original_name: clip(body.original_name, 200),
            sha256: clip(body.sha256, 64).toLowerCase(),
          },
        });
        if (!data?.ok) return res.status(400).json({ ok: false, error: data?.error || 'init_failed' });
        if (data.exists) return res.status(200).json({ ok: true, exists: true, id: data.id });
        const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(data.path);
        if (error || !signed) return res.status(500).json({ ok: false, error: 'upload_url_failed' });
        return res.status(200).json({ ok: true, exists: false, id: data.id, upload_url: signed.signedUrl, upload_token: signed.token });
      }
      case 'recordings-complete': {
        if (!isUuid(body.id)) return res.status(400).json({ ok: false, error: 'id_required' });
        const rec = await loadRecording(body.id);
        if (!rec || rec.device_id !== device.device_id) return res.status(404).json({ ok: false, error: 'not_found' });
        const hashed = rec.status === 'uploading' ? await hashStoredObject(rec.storage_path) : null;
        const data = await rpc('finish_call_recording', {
          p_id: rec.id, p_server_sha: hashed?.sha ?? null, p_size: hashed?.size ?? null, p_actor: null, p_device: device.device_id,
        });
        return res.status(200).json(data);
      }
      case 'notes': {
        const data = await rpc('device_add_note', {
          p_device_id: device.device_id, p_log_key: clip(body.log_key, 120), p_note: clip(body.note, 2000),
          p_next_contact_at: clip(body.next_contact_at, 40) || null,
        });
        return res.status(200).json(data);
      }
      case 'register-request': {
        const data = await rpc('device_register_request', {
          p_device_id: device.device_id, p_phone: clip(body.phone, 30), p_occurred_at: clip(body.occurred_at, 40) || null,
          p_note: clip(body.note, 300) || null,
        });
        return res.status(200).json(data);
      }
      case 'commands': {
        const data = await rpc('device_pull_commands', { p_device_id: device.device_id });
        return res.status(200).json({ ok: true, ...data });
      }
      case 'command-result': {
        if (!isUuid(body.id)) return res.status(400).json({ ok: false, error: 'id_required' });
        const data = await rpc('device_command_result', {
          p_device_id: device.device_id, p_id: body.id, p_status: body.status === 'done' ? 'done' : 'failed',
          p: { detail: clip(body.detail, 200), parts: Number.isFinite(body.parts) ? body.parts : null },
        });
        return res.status(200).json(data);
      }
      case 'unpair': {
        const data = await rpc('device_unpair', { p_device_id: device.device_id });
        return res.status(200).json({ ...data, wipe: true });
      }
      default:
        return res.status(404).json({ ok: false, error: 'unknown_route' });
    }
  } catch (err) {
    const denied = err?.code === '42501';
    console.error('[device]', route, err?.code || '', denied ? 'denied' : 'error');
    return res.status(denied ? 403 : 500).json({ ok: false, error: denied ? 'not_allowed' : 'server_error' });
  }
}
