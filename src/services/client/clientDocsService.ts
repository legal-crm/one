// ============================================================
// 의뢰인 서류 작성기 서버 연결 (H-0): 서명·도장 저장, 작성 중 초안, 면책신청 요청·직접 내려받음 기록
//  * 서명·도장: 비공개 저장소 client-assets/{내 계정}/…, 본인만 열람
//  * 초안: 주민등록번호 칸은 보내지 않고, 서버도 주민번호 형식을 거절한다 (L8)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export interface SignAsset { id: string; kind: 'signature' | 'seal'; source: 'pad' | 'seal_maker' | 'photo'; path: string; label?: string; createdAt: string; url?: string }

async function myUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function listSignAssets(): Promise<RpcResult<SignAsset[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('client_sign_assets').select('id, kind, source, storage_path, label, created_at').order('created_at', { ascending: false }).limit(30);
  if (error) return toRpcError(error);
  const rows: SignAsset[] = (data || []).map((r: any) => ({ id: r.id, kind: r.kind, source: r.source, path: r.storage_path, label: r.label || undefined, createdAt: r.created_at }));
  if (rows.length) {
    const { data: urls } = await supabase.storage.from('client-assets').createSignedUrls(rows.map(r => r.path), 600);
    (urls || []).forEach((u: any, i: number) => { if (u?.signedUrl) rows[i].url = u.signedUrl; });
  }
  return { ok: true, data: rows };
}

export async function saveSignAsset(kind: SignAsset['kind'], source: SignAsset['source'], dataUrl: string, label?: string): Promise<RpcResult<SignAsset>> {
  const uid = await myUserId();
  if (!uid) return { ok: false, code: 'login', message: '서명·도장을 저장하려면 로그인해 주세요.' };
  const blob = dataUrlToBlob(dataUrl);
  if (blob.size > 2 * 1024 * 1024) return { ok: false, code: 'size', message: '이미지가 너무 커요(2MB 넘음).' };
  const id = crypto.randomUUID();
  const path = `${uid}/${kind}/${id}.png`;
  const up = await supabase.storage.from('client-assets').upload(path, blob, { contentType: blob.type || 'image/png', upsert: false });
  if (up.error) return toRpcError(up.error);
  const { data, error } = await supabase.from('client_sign_assets').insert({ kind, source, storage_path: path, label: label || null }).select('id, created_at').single();
  if (error) {
    await supabase.storage.from('client-assets').remove([path]);
    return toRpcError(error);
  }
  return { ok: true, data: { id: data.id, kind, source, path, label, createdAt: data.created_at, url: dataUrl } };
}

export async function deleteSignAsset(a: SignAsset): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('client_sign_assets').delete().eq('id', a.id);
  if (error) return toRpcError(error);
  await supabase.storage.from('client-assets').remove([a.path]);
  return { ok: true, data: true };
}

/** 저장된 이미지를 PDF에 넣을 수 있게 data URL로 */
export async function signAssetDataUrl(a: SignAsset): Promise<string | null> {
  if (a.url?.startsWith('data:')) return a.url;
  const { data, error } = await supabase.storage.from('client-assets').download(a.path);
  if (error || !data) return null;
  return await new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => resolve(null);
    r.readAsDataURL(data);
  });
}

export async function loadDocDraft<T>(docKey: string): Promise<RpcResult<T | null>> {
  if (!(await myUserId())) return { ok: true, data: null };
  const { data, error } = await supabase.from('client_doc_drafts').select('data').eq('doc_key', docKey).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: (data?.data as T) ?? null };
}

export async function saveDocDraft(docKey: string, draft: Record<string, unknown>): Promise<RpcResult<true>> {
  const uid = await myUserId();
  if (!uid) return { ok: false, code: 'login', message: '로그인하면 작성 내용을 저장해 이어서 쓸 수 있어요.' };
  const { error } = await supabase.from('client_doc_drafts').upsert({ user_id: uid, doc_key: docKey, data: draft }, { onConflict: 'user_id,doc_key' });
  if (error) return toRpcError(error);
  return { ok: true, data: true };
}

/** 마이김변 변호사 사건: '변호사에게 접수 요청' 또는 '직접 내려받음'을 사무소에 알린다 */
export async function recordDischargeEvent(caseKey: string, kind: 'request' | 'self_download'): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('client_discharge_event', { p_case_key: caseKey, p_kind: kind });
  if (error) return toRpcError(error);
  return { ok: true, data: String(data) };
}

export async function lastDischargeRequest(caseKey: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('client_discharge_events').select('created_at').eq('case_key', caseKey).eq('kind', 'request').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.created_at || null;
}
