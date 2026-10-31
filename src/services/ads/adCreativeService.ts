// ============================================================
// 광고 소재·홈 슬라이드·노출 집계 (AD-5·AD-8·AD-10·CT-5, 20261031002200)
// 소재 이미지는 비공개 버킷 'ad-media'. 승인된 소재만 누구나 읽을 수 있다(서명 주소로 표시).
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

const BUCKET = 'ad-media';
export const AD_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export type CreativeKind = 'banner' | 'card';
export type CreativeStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'retired';
export const CREATIVE_STATUS_LABEL: Record<CreativeStatus, string> = {
  pending: '심사 중', approved: '승인', rejected: '반려', changes_requested: '수정 요청', retired: '내림',
};
export const CREATIVE_KIND_LABEL: Record<CreativeKind, string> = { banner: '메인 배너', card: '프로필 카드' };

export interface AdCreative {
  id: string; officeId: string; lawyerId: string; kind: CreativeKind; status: CreativeStatus;
  headline: string; subline?: string; altText: string; tags: string[];
  imagePath: string; mobileImagePath?: string; warnings: string[]; reviewNote?: string; replacesId?: string;
  createdAt: string; reviewedAt?: string;
}

function mapCreative(r: any): AdCreative {
  return {
    id: r.id, officeId: r.office_id, lawyerId: r.lawyer_id, kind: r.kind, status: r.status,
    headline: r.headline, subline: r.subline || undefined, altText: r.alt_text, tags: r.tags || [],
    imagePath: r.image_path, mobileImagePath: r.mobile_image_path || undefined, warnings: r.warnings || [],
    reviewNote: r.review_note || undefined, replacesId: r.replaces_id || undefined, createdAt: r.created_at, reviewedAt: r.reviewed_at || undefined,
  };
}

const AD_MESSAGES: Array<[RegExp, string]> = [
  [/image must be uploaded to this office folder|image not uploaded/i, '이미지를 먼저 올려 주세요.'],
  [/lawyer is not a member/i, '이 사무소 변호사만 고를 수 있어요.'],
  [/creative kind does not match/i, '메인 배너 광고에는 배너 소재, 그 밖의 광고에는 프로필 카드 소재를 골라 주세요.'],
  [/creative not usable/i, '반려되었거나 내린 소재는 쓸 수 없어요.'],
  [/creative is not waiting/i, '이미 심사한 소재예요.'],
  [/reason required/i, '사유를 입력해 주세요.'],
  [/permission denied/i, '광고 구매 권한이 있는 구성원만 할 수 있어요.'],
];
function adErr<T>(e: { message?: string; code?: string }): RpcResult<T> {
  const m = e?.message || '';
  for (const [re, t] of AD_MESSAGES) if (re.test(m)) return { ok: false, code: e?.code || 'error', message: t };
  return toRpcError(e);
}

/** 화면에서 먼저 보여 주는 경고 (서버 ad_copy_warnings와 같은 뜻) */
export function creativeCopyWarnings(text: string): string[] {
  const out: string[] = [];
  if (/(100|백)\s*%|보장|확실|무조건/.test(text)) out.push('결과를 보장하는 표현');
  if (/성공률|인가율|면책률|승소율|[0-9]+\s*건\s*(수임|처리|해결)|누적/.test(text)) out.push('성공률·처리 건수 같은 실적 수치');
  if (/최고|최초|1위|넘버원|No\.?\s*1|유일/i.test(text)) out.push('최상급·비교 표현');
  if (/전담|추천|배정|매칭/.test(text)) out.push('전담·추천·배정·매칭 표현');
  if (/무료\s*상담|공짜/.test(text)) out.push('무료 상담 표현');
  if (/탕감|감면율|변제율\s*[0-9]/.test(text)) out.push('탕감·감면율 표현');
  return out;
}

export async function uploadAdImage(officeId: string, file: File): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const ext = MIME_EXT[file.type];
  if (!ext) return { ok: false, code: 'type', message: 'WebP·JPG·PNG 이미지만 올릴 수 있어요.' };
  if (file.size > AD_MEDIA_MAX_BYTES) return { ok: false, code: 'size', message: '이미지는 5MB 이하만 올릴 수 있어요.' };
  const path = `${officeId}/${crypto.randomUUID()}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return toRpcError(error);
  return { ok: true, data: path };
}

export async function signedAdUrls(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  if (!isSupabaseConfigured || uniq.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniq, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function submitAdCreative(officeId: string, input: {
  lawyerId: string; kind: CreativeKind; headline: string; subline?: string; altText: string; tags?: string[];
  imagePath: string; mobileImagePath?: string; replacesId?: string;
}): Promise<RpcResult<AdCreative>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('submit_ad_creative', {
    p_office_id: officeId,
    p: {
      lawyer_id: input.lawyerId, kind: input.kind, headline: input.headline, subline: input.subline || '', alt_text: input.altText,
      tags: input.tags || [], image_path: input.imagePath, mobile_image_path: input.mobileImagePath || '', replaces_id: input.replacesId || '',
    },
  });
  if (error) return adErr(error);
  return { ok: true, data: mapCreative(data) };
}

export async function listOfficeCreatives(officeId: string): Promise<RpcResult<AdCreative[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('ad_creatives').select('*').eq('office_id', officeId).order('created_at', { ascending: false }).limit(200);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapCreative) };
}

export async function setOrderCreative(orderId: string, creativeId: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_ad_order_creative', { p_order_id: orderId, p_creative_id: creativeId });
  if (error) return adErr(error);
  return { ok: true, data: true };
}

// ── 관리자 ──────────────────────────────────────────────────
export async function adminListCreatives(status: CreativeStatus | 'all' = 'pending'): Promise<RpcResult<AdCreative[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('ad_creatives').select('*').order('created_at', { ascending: true }).limit(300);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapCreative) };
}

export async function adminReviewCreative(id: string, action: 'approve' | 'reject' | 'changes', note?: string): Promise<RpcResult<AdCreative>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_review_ad_creative', { p_id: id, p_action: action, p_note: note || null });
  if (error) return adErr(error);
  return { ok: true, data: mapCreative(data) };
}

export interface SlotBoardRow { productId: string; productName: string; region?: string; maxSlots: number; active: number; scheduled: number; pending: number }
export async function adminSlotBoard(): Promise<RpcResult<SlotBoardRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_ad_slot_board');
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ productId: r.product_id, productName: r.product_name, region: r.region || undefined, maxSlots: r.max_slots, active: r.active, scheduled: r.scheduled, pending: r.pending })) };
}

// ── 사무소 집계 ─────────────────────────────────────────────
export async function officeAdStats(officeId: string): Promise<Record<string, { impressions: number; profileOpens: number }>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase.rpc('office_ad_stats', { p_office_id: officeId });
  if (error || !data) return {};
  const out: Record<string, { impressions: number; profileOpens: number }> = {};
  for (const r of data as any[]) out[r.order_id] = { impressions: Number(r.impressions) || 0, profileOpens: Number(r.profile_opens) || 0 };
  return out;
}

// ── 고객 홈 슬라이드 ────────────────────────────────────────
export interface HomeAdSlide {
  orderId: string; lawyerId: string; lawyerName: string; officeName?: string; headline: string; subline?: string; altText: string;
  imageUrl?: string; mobileImageUrl?: string; tags: string[];
}
export async function fetchHomeAdSlides(): Promise<HomeAdSlide[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('public_home_ad_slides');
  if (error || !data) return [];
  const rows = data as any[];
  const urls = await signedAdUrls(rows.flatMap(r => [r.image_path, r.mobile_image_path]));
  return rows.map(r => ({
    orderId: r.order_id, lawyerId: r.lawyer_id, lawyerName: r.lawyer_name || '', officeName: r.office_name || undefined,
    headline: r.headline, subline: r.subline || undefined, altText: r.alt_text, tags: r.tags || [],
    imageUrl: urls[r.image_path], mobileImageUrl: r.mobile_image_path ? urls[r.mobile_image_path] : undefined,
  })).filter(s => !!s.imageUrl);
}

// 노출·프로필 열기: 같은 화면에서 같은 광고는 한 번만 세고, 모아서 보낸다 (개인 정보 없음)
const seen = new Set<string>();
let queue: Array<{ order_id: string; kind: 'impression' | 'profile_open' }> = [];
let timer: number | undefined;
export function trackAdEvent(orderId: string, kind: 'impression' | 'profile_open') {
  if (!isSupabaseConfigured || !orderId) return;
  const key = `${orderId}:${kind}`;
  if (seen.has(key)) return;
  seen.add(key);
  queue.push({ order_id: orderId, kind });
  if (timer) return;
  timer = window.setTimeout(() => {
    const batch = queue.slice(0, 30);
    queue = queue.slice(30);
    timer = undefined;
    void supabase.rpc('record_ad_events', { p_events: batch }).then(() => undefined, () => undefined);
  }, 3000);
}
