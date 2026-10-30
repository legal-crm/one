// ============================================================
// 사건 서류 파일 (DP-0) — 비공개 저장소 case-files + case_files 표
// 경로: {사무소 ID}/{상담 요청 ID}/{office|client}/{파일 ID}.{확장자}
// 파일 본문은 저장소에만 두고, 화면 캐시에만 dataUrl을 잠깐 둔다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { DocumentFile } from '../../types';

const BUCKET = 'case-files';
const MAX_BYTES = 20 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
};

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(body || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function errText(e: { message?: string } | null | undefined): string {
  const m = e?.message || '';
  if (/row-level security|permission|unauthorized|403/i.test(m)) return '이 사건에 서류를 올릴 권한이 없어요.';
  if (/mime|type/i.test(m)) return 'PDF와 사진(JPG·PNG·WEBP·HEIC)만 올릴 수 있어요.';
  if (/size|too large|413/i.test(m)) return '파일은 20MB 이하만 올릴 수 있어요.';
  if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했어요.';
  return m || '파일을 올리지 못했어요.';
}

export interface UploadResult { ok: boolean; file?: DocumentFile; message?: string }

/**
 * 파일 하나를 저장소에 올리고 case_files에 기록한다.
 * @param source 'office'(사무소가 올림) | 'client'(의뢰인 제출)
 * @param officeId 의뢰인 제출이면 비워 두면 서버가 담당 사무소를 정한다
 */
export async function uploadCaseFile(params: {
  source: 'office' | 'client';
  clientKey: string;
  officeId?: string;
  file: DocumentFile;
}): Promise<UploadResult> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { source, clientKey, file } = params;
  if (!file.dataUrl) return { ok: false, message: '파일 내용이 없어요.' };
  let officeId = params.officeId;
  if (!officeId && source === 'client') {
    const { data, error } = await supabase.rpc('client_request_office', { p_request_id: clientKey });
    if (error || !data) return { ok: false, message: '담당 사무소를 확인하지 못했어요. 상담 중인 변호사가 있는지 확인해 주세요.' };
    officeId = String(data);
  }
  if (!officeId) return { ok: false, message: '사무소 정보를 확인하지 못했어요. 다시 로그인해 주세요.' };

  const blob = dataUrlToBlob(file.dataUrl);
  if (blob.size > MAX_BYTES) return { ok: false, message: '파일은 20MB 이하만 올릴 수 있어요.' };
  const id = file.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = EXT_BY_MIME[blob.type] || (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const path = `${officeId}/${clientKey}/${source}/${id}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (up.error && !/already exists|Duplicate/i.test(up.error.message)) return { ok: false, message: errText(up.error) };

  const { error } = await supabase.from('case_files').upsert({
    id,
    office_id: officeId,
    client_key: clientKey,
    storage_path: path,
    name: (file.name || '서류').slice(0, 200),
    category: file.category || 'other',
    mime_type: blob.type || file.mimeType || null,
    size_bytes: blob.size,
    upload_source: source,
    linked_doc_id: file.linkedDocId || null,
    review_status: source === 'client' ? 'submitted' : (file.reviewStatus || 'submitted'),
    note: file.notes ? file.notes.slice(0, 500) : null,
  }, { onConflict: 'id' });
  if (error) return { ok: false, message: errText(error) };

  return { ok: true, file: { ...file, id, storagePath: path, fileSize: blob.size, mimeType: blob.type || file.mimeType } };
}

/** 내려받기용 임시 주소 (5분). 화면 사본에 dataUrl이 있으면 그대로 쓴다 */
export async function getCaseFileUrl(file: Pick<DocumentFile, 'dataUrl' | 'storagePath'>): Promise<string | null> {
  if (file.dataUrl) return file.dataUrl;
  if (!file.storagePath || !isSupabaseConfigured) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storagePath, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** 묶음 PDF 등 본문이 필요한 곳: 저장소 파일을 dataUrl로 채운다 (실패한 파일은 그대로 둔다) */
export async function hydrateFileDataUrls<T extends { dataUrl?: string; storagePath?: string }>(files: T[]): Promise<T[]> {
  if (!isSupabaseConfigured) return files;
  return Promise.all(files.map(async f => {
    if (f.dataUrl || !f.storagePath) return f;
    const { data, error } = await supabase.storage.from(BUCKET).download(f.storagePath);
    if (error || !data) return f;
    return { ...f, dataUrl: await blobToDataUrl(data) };
  }));
}

/** 사무소 화면: 의뢰인이 제출한 파일 목록 (사건별) */
export async function listClientSubmittedFiles(officeId: string): Promise<Record<string, DocumentFile[]>> {
  if (!isSupabaseConfigured || !officeId) return {};
  const { data, error } = await supabase.from('case_files').select('*')
    .eq('office_id', officeId).eq('upload_source', 'client').is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(2000);
  if (error || !data) return {};
  const out: Record<string, DocumentFile[]> = {};
  for (const r of data as any[]) {
    (out[r.client_key] ||= []).push({
      id: r.id,
      name: r.name,
      category: r.category,
      uploadedAt: r.created_at,
      uploadedBy: '의뢰인',
      fileSize: r.size_bytes ?? undefined,
      mimeType: r.mime_type ?? undefined,
      storagePath: r.storage_path,
      uploadSource: 'client',
      linkedDocId: r.linked_doc_id ?? undefined,
      reviewStatus: r.review_status,
    } as DocumentFile);
  }
  return out;
}

/** 의뢰인 화면: 내가 제출한 파일 (상담 요청별) */
export async function listMySubmittedFiles(clientKey: string): Promise<DocumentFile[]> {
  if (!isSupabaseConfigured || !clientKey) return [];
  const { data, error } = await supabase.from('case_files').select('*').eq('client_key', clientKey).eq('upload_source', 'client').order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    id: r.id, name: r.name, category: r.category, uploadedAt: r.created_at, uploadedBy: '의뢰인',
    fileSize: r.size_bytes ?? undefined, mimeType: r.mime_type ?? undefined, storagePath: r.storage_path,
    uploadSource: 'client', linkedDocId: r.linked_doc_id ?? undefined, reviewStatus: r.review_status, notes: r.note ?? undefined,
  } as DocumentFile));
}
