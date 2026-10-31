// ============================================================
// 통합어드민 SEO·채널 기록 (M0: 브라우저 저장 → 서버)
//  * admin_seo_state: 검색 포털 등록 체크리스트·서치콘솔 속성 (관리자만)
//  * seo_indexnow_log: IndexNow 전송 기록 (수동·빌드 자동)
//  * platform_config 'social_channels': 운영 중인 SNS 채널 → 빌드 때 sameAs로 반영 (누구나 읽기, 관리자 쓰기)
//  * admin_channel_inflow(): 기간별 채널 상담 요청 수 (건수만)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export async function loadSeoState<T>(key: string): Promise<RpcResult<T | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('admin_seo_state').select('data').eq('key', key).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: (data?.data ?? null) as T | null };
}

export async function saveSeoState<T>(key: string, value: T): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('admin_seo_state').upsert({ key, data: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? toRpcError(error) : { ok: true, data: null };
}

export interface IndexNowLogRow {
  id: string; source: 'manual' | 'build'; urls: string[]; ok: boolean;
  results: Array<{ engine: string; status: number; ok: boolean; message?: string }>; error: string | null; createdAt: string;
}

export async function listIndexNowLog(limit = 50): Promise<RpcResult<IndexNowLogRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('seo_indexnow_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, source: r.source, urls: r.urls || [], ok: !!r.ok, results: Array.isArray(r.results) ? r.results : [], error: r.error ?? null, createdAt: r.created_at,
    })),
  };
}

// ── SNS 운영 채널 (sameAs) ──
export const SOCIAL_CHANNELS = [
  { channel: 'naver_blog', label: '네이버 블로그', hint: 'https://blog.naver.com/…' },
  { channel: 'instagram', label: '인스타그램', hint: 'https://www.instagram.com/…' },
  { channel: 'threads', label: '스레드', hint: 'https://www.threads.net/@…' },
  { channel: 'youtube', label: '유튜브', hint: 'https://www.youtube.com/@…' },
  { channel: 'tiktok', label: '틱톡', hint: 'https://www.tiktok.com/@…' },
  { channel: 'facebook', label: '페이스북 페이지', hint: 'https://www.facebook.com/…' },
  { channel: 'kakao_channel', label: '카카오 채널', hint: 'https://pf.kakao.com/…' },
  { channel: 'naver_cafe', label: '네이버 카페', hint: 'https://cafe.naver.com/…' },
] as const;
export type SocialChannelId = typeof SOCIAL_CHANNELS[number]['channel'];
export interface SocialChannel { channel: SocialChannelId; url: string; active: boolean }

/** 빌드 스크립트(scripts/seo-build.mjs SOCIAL_HOSTS)와 같은 주소 규칙 */
export const SOCIAL_URL_RULES: Record<SocialChannelId, RegExp> = {
  naver_blog: /^https:\/\/(m\.)?blog\.naver\.com\//,
  naver_cafe: /^https:\/\/(m\.)?cafe\.naver\.com\//,
  instagram: /^https:\/\/(www\.)?instagram\.com\//,
  threads: /^https:\/\/(www\.)?threads\.(net|com)\//,
  youtube: /^https:\/\/(www\.)?youtube\.com\//,
  tiktok: /^https:\/\/(www\.)?tiktok\.com\//,
  facebook: /^https:\/\/(www\.)?facebook\.com\//,
  kakao_channel: /^https:\/\/pf\.kakao\.com\//,
};

export async function loadSocialChannels(): Promise<RpcResult<SocialChannel[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('platform_config').select('data').eq('id', 'social_channels').maybeSingle();
  if (error) return toRpcError(error);
  const list = Array.isArray((data?.data as any)?.channels) ? ((data!.data as any).channels as SocialChannel[]) : [];
  return { ok: true, data: list };
}

export async function saveSocialChannels(channels: SocialChannel[]): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('platform_config').upsert(
    { id: 'social_channels', data: { channels }, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return error ? toRpcError(error) : { ok: true, data: null };
}

export interface ChannelInflowRow { source: string; medium: string; requests: number }

export async function loadChannelInflow(from: string, to: string): Promise<RpcResult<ChannelInflowRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_channel_inflow', { p_from: from, p_to: to });
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ source: r.source, medium: r.medium || '', requests: Number(r.requests) || 0 })) };
}
