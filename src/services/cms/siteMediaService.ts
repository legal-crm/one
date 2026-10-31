// ============================================================
// 공개 사이트 이미지 저장소 (CT-7) — 팝업·배너·칼럼 대표 이미지
// 공개 버킷 site-media, 올리기는 플랫폼 관리자만 (서버 정책)
// 이전: 팝업 이미지를 base64로 설정 안에 넣어 방문자마다 큰 설정을 내려받았다
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

export type SiteMediaFolder = 'popup' | 'banner' | 'news' | 'notice';
export const SITE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function uploadSiteMedia(folder: SiteMediaFolder, file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, message: 'JPG·PNG·WEBP·GIF 이미지만 올릴 수 있어요.' };
  if (file.size > SITE_MEDIA_MAX_BYTES) return { ok: false, message: '이미지는 5MB 이하만 올릴 수 있어요.' };
  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) {
    return { ok: false, message: /row-level security|policy|unauthorized|403/i.test(error.message || '') ? '2단계 인증을 마친 관리자만 올릴 수 있어요.' : '이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
  const { data } = supabase.storage.from('site-media').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** 팝업 이동 주소: https 주소 또는 사이트 안 경로(/...)만 */
export function isSafeLink(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (u.startsWith('/') && !u.startsWith('//')) return true;
  return /^https:\/\/[^\s]+$/i.test(u);
}
