// 통화 녹음 대화록·요약 (CL-7·CL-8, 20261101003800). 대화록은 참고용이고 원본 녹음이 기준이다.
import { supabase, isSupabaseConfigured, getAuthHeaders } from '../../supabaseClient';

export interface TranscriptSegment { speaker: '사무소' | '의뢰인' | '그 밖의 사람'; start: number | null; text: string }
export interface CallTranscript {
  id: string; recordingId: string; version: number; model: string | null; segments: TranscriptSegment[]; summary: string;
  facts: { next_contact?: string; client_documents?: string; office_todo?: string }; createdAt: string;
}
type R<T> = { ok: true; data: T } | { ok: false; message: string };

const map = (r: any): CallTranscript => ({
  id: r.id, recordingId: r.recording_id, version: r.version, model: r.model || null, segments: Array.isArray(r.segments) ? r.segments : [],
  summary: r.summary || '', facts: r.facts || {}, createdAt: r.created_at,
});

/** 녹음들의 가장 최근 대화록 */
export async function listLatestTranscripts(recordingIds: string[]): Promise<Map<string, CallTranscript>> {
  const out = new Map<string, CallTranscript>();
  if (!isSupabaseConfigured || recordingIds.length === 0) return out;
  const { data, error } = await supabase.from('call_transcripts').select('*').in('recording_id', recordingIds).order('version', { ascending: false });
  if (error) return out;
  for (const r of data || []) if (!out.has(r.recording_id)) out.set(r.recording_id, map(r));
  return out;
}

export async function createTranscript(recordingId: string): Promise<R<CallTranscript>> {
  try {
    const res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'call-transcript', recordingId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) return { ok: false, message: j?.error || '대화록을 만들지 못했어요.' };
    return { ok: true, data: { id: j.id, recordingId, version: j.version, model: j.model || null, segments: j.segments || [], summary: j.summary || '', facts: j.facts || {}, createdAt: new Date().toISOString() } };
  } catch {
    return { ok: false, message: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

export const fmtStart = (s: number | null) => (s === null || s === undefined ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
