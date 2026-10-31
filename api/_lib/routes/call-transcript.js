// ============================================================
// 통화 녹음 대화록·요약 (CL-7·CL-8) — POST /api/generate-statement {mode:'call-transcript', recordingId}
//  * 로그인한 사무소 구성원 → 서버가 권한 확인(call_transcript_prepare) → 비공개 저장소에서 녹음을 읽어 Gemini로 받아 적기
//  * 결과는 call_transcripts 에 새 버전으로 추가 (고치지 않음). 원본 녹음이 기준이고 대화록은 참고용
//  * 대화록·요약에 나온 주민번호·전화·계좌·이메일 형식은 가린다 (statement-masking)
//  * Gemini 요청·응답은 저장하지 않게 (store:false), 녹음 파일은 서버 메모리에서만 다룬다
// ============================================================
import { supabase, verifyAuth } from '../auth-middleware.js';
import { checkRateLimit } from '../rate-limiter.js';
import { buildStatementMasker } from '../statement-masking.js';

const MODELS = (process.env.CALL_TRANSCRIPT_MODELS || 'gemini-2.5-flash,gemini-flash-latest').split(',').map(s => s.trim()).filter(Boolean);
const MIME_OK = /^audio\/(mpeg|mp3|mp4|m4a|x-m4a|aac|wav|x-wav|webm|ogg|amr|3gpp)$/;
const isUuid = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

const PROMPT = `다음은 법률사무소 직원·변호사와 의뢰인(또는 상담 문의자)의 전화 통화 녹음입니다.
1) 들리는 그대로 한국어로 받아 적으세요. 말한 사람을 "사무소", "의뢰인", "그 밖의 사람" 중 하나로 구분하고, 대략의 시작 시각(초)을 적으세요.
2) 통화에서 나온 사실만 3~6줄로 요약하세요. 법률 판단·결과 예측·권유는 쓰지 마세요. 들리지 않거나 확실하지 않은 부분은 "(잘 들리지 않음)"으로 적으세요.
3) 주민등록번호·계좌번호·카드번호는 받아 적지 말고 «주민번호»·«계좌번호»처럼 적으세요.
4) 다음 칸을 아는 만큼만 채우세요(모르면 빈 문자열): 다음 연락 약속, 의뢰인이 낼 서류, 사무소가 할 일.
반드시 아래 JSON만 반환하세요:
{"segments":[{"speaker":"사무소|의뢰인|그 밖의 사람","start":0,"text":"..."}],"summary":"...","facts":{"next_contact":"","client_documents":"","office_todo":""}}`;

export async function handleCallTranscript(req, res) {
  let user = null;
  try { user = await verifyAuth(req); } catch { user = null; }
  if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
  if (checkRateLimit(`call-transcript:${user.id}`, 10, 10 * 60 * 1000).isLimited) {
    return res.status(429).json({ ok: false, error: '대화록은 10분에 10건까지 만들 수 있어요. 잠시 후 다시 시도해 주세요.' });
  }
  const recordingId = req.body?.recordingId;
  if (!isUuid(recordingId)) return res.status(400).json({ ok: false, error: '녹음 번호가 없습니다.' });
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) return res.status(503).json({ ok: false, error: '서버에 AI 키가 설정되지 않았습니다.' });

  const { data: prep, error: prepErr } = await supabase.rpc('call_transcript_prepare', { p_recording: recordingId, p_actor: user.id });
  if (prepErr) return res.status(500).json({ ok: false, error: '녹음을 확인하지 못했습니다.' });
  if (!prep?.ok) {
    const map = {
      not_found: [404, '녹음을 찾지 못했습니다.'],
      not_verified: [409, '아직 파일 확인(지문)이 끝나지 않은 녹음이에요.'],
      forbidden: [403, '이 녹음의 대화록을 만들 권한이 없어요.'],
      too_large: [413, '18MB가 넘는 녹음은 아직 대화록을 만들 수 없어요. 30분 이하로 나눠 올려 주세요.'],
      daily_limit: [429, '오늘 사무소에서 만들 수 있는 대화록 수(100건)를 넘었어요.'],
    };
    const [code, msg] = map[prep?.error] || [400, '대화록을 만들 수 없는 녹음이에요.'];
    return res.status(code).json({ ok: false, error: msg });
  }

  const dl = await supabase.storage.from('call-recordings').download(prep.storage_path);
  if (dl.error || !dl.data) return res.status(500).json({ ok: false, error: '녹음 파일을 읽지 못했습니다.' });
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const mime = MIME_OK.test(String(prep.mime_type || '')) ? prep.mime_type : 'audio/mp4';

  const deadline = Date.now() + 54000;
  let parsed = null;
  let usedModel = null;
  for (const model of MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 8000) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: buf.toString('base64') } }] }],
          store: false,
          generationConfig: { temperature: 0.1, maxOutputTokens: 16384, response_mime_type: 'application/json' },
        }),
        signal: AbortSignal.timeout(remaining),
      });
      if (!r.ok) { console.warn(`[call-transcript] ${model} HTTP ${r.status}`); continue; }
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      parsed = JSON.parse(String(text).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
      usedModel = model;
      break;
    } catch (e) {
      console.warn(`[call-transcript] ${model} failed`, e?.message);
    }
  }
  if (!parsed) return res.status(200).json({ ok: false, error: 'AI가 대화록을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });

  const m = buildStatementMasker({});
  const segments = (Array.isArray(parsed.segments) ? parsed.segments : []).slice(0, 2000).map(s => ({
    speaker: ['사무소', '의뢰인', '그 밖의 사람'].includes(s?.speaker) ? s.speaker : '그 밖의 사람',
    start: Number.isFinite(Number(s?.start)) ? Math.max(0, Math.round(Number(s.start))) : null,
    text: m.mask(String(s?.text || '').slice(0, 2000)),
  }));
  const summary = m.mask(String(parsed.summary || '').slice(0, 3900));
  const f = parsed.facts && typeof parsed.facts === 'object' ? parsed.facts : {};
  const facts = {
    next_contact: m.mask(String(f.next_contact || '').slice(0, 300)),
    client_documents: m.mask(String(f.client_documents || '').slice(0, 500)),
    office_todo: m.mask(String(f.office_todo || '').slice(0, 500)),
  };

  const { data: row, error: insErr } = await supabase.from('call_transcripts').insert({
    recording_id: recordingId, office_id: prep.office_id, version: prep.next_version, model: usedModel,
    segments, summary, facts, created_by: user.id,
  }).select('id, version, created_at').single();
  if (insErr) return res.status(500).json({ ok: false, error: '대화록을 저장하지 못했습니다.' });
  return res.status(200).json({ ok: true, id: row.id, version: row.version, segments, summary, facts, model: usedModel });
}
