// ============================================================
// 콘텐츠 서버 저장 (CT-1)
// 칼럼·Q&A·후기·배너·공지·변호사 문의·플랫폼 설정의 원본은 서버(Supabase)다.
// 브라우저 저장소로 대체하지 않고, 실패는 호출한 쪽이 화면에 알린다.
// 권한(RLS 025 + 20261030000500): 공개 읽기는 게시본만, 쓰기는 관리자(aal2)만.
// 변호사 Q&A 답변은 lawyer_answer_client_qa 함수, 변호사 문의는 본인 등록만.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { RpcResult } from '../office/rpcResult';
import { secureRemoveItem } from '../../utils/secureStorage';
import type { ContentDiff } from './contentDiff';
export { diffContent, snapshotOf, stableStringify, type ContentDiff } from './contentDiff';

export const CONTENT_TABLES = {
  news: 'news_articles',
  qas: 'client_qas',
  reviews: 'success_reviews',
  banners: 'main_banners',
  notices: 'notices',
  lawyerInquiries: 'lawyer_inquiries',
} as const;

export type ContentTable = typeof CONTENT_TABLES[keyof typeof CONTENT_TABLES];

export const CONFIG_TABLES = {
  platform: 'platform_config',
  popup: 'popup_config',
  matching: 'matching_config',
} as const;

export type ConfigTable = typeof CONFIG_TABLES[keyof typeof CONFIG_TABLES];

/** 예전 버전이 브라우저에 남긴 콘텐츠 사본 키 (서버 전환 후 지움) */
export const LEGACY_CONTENT_KEYS = [
  'legal_crm_news',
  'legal_crm_qas',
  'legal_crm_reviews',
  'legal_crm_banners',
  'legal_crm_notices',
  'legal_crm_inquiries',
  'legal_crm_lawyer_inquiries',
  'legal_crm_platform_config',
  'legal_crm_popup_config',
  'legal_crm_matching_cooldown_hours',
];

export function clearLegacyContentCache(): void {
  try {
    for (const k of LEGACY_CONTENT_KEYS) secureRemoveItem(k);
  } catch {
    // 저장소 접근이 막힌 브라우저는 무시
  }
}

function errText(error: any): string {
  const msg = error?.message || error?.details || String(error || '');
  if (/row-level security|permission denied|42501/i.test(msg)) return '권한이 없습니다. 관리자 2단계 인증 상태를 확인해 주세요.';
  if (/Failed to fetch|NetworkError|timeout/i.test(msg)) return '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.';
  return msg || '알 수 없는 오류';
}

/** 목록 읽기. 서버 미설정이면 ok:false, code 'not_configured' */
export async function fetchContent<T extends { id: string }>(table: ContentTable): Promise<RpcResult<T[]>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  const orderCol = table === 'lawyer_inquiries' ? 'created_at' : 'sort_order';
  let query = supabase.from(table).select('id, data, created_at').order(orderCol, { ascending: table !== 'lawyer_inquiries' });
  if (table !== 'lawyer_inquiries') query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return { ok: false, code: 'load_failed', message: errText(error) };
  const items = (data || []).map((row: any) => ({ ...(row.data || {}), id: row.id }) as T);
  return { ok: true, data: items };
}

/** 차이만 서버에 반영 (관리자 화면) */
export async function applyContentDiff<T extends { id: string }>(table: ContentTable, diff: ContentDiff<T>): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  if (diff.upserts.length > 0) {
    const rows = diff.upserts.map(item => ({ id: item.id, data: item }));
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) return { ok: false, code: 'save_failed', message: errText(error) };
  }
  if (diff.deletes.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', diff.deletes);
    if (error) return { ok: false, code: 'delete_failed', message: errText(error) };
  }
  return { ok: true, data: null };
}

/** 단일 설정 행(id 'main') 읽기 */
export async function fetchConfig<T>(table: ConfigTable): Promise<RpcResult<T | null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  const { data, error } = await supabase.from(table).select('data').eq('id', 'main').maybeSingle();
  if (error) return { ok: false, code: 'load_failed', message: errText(error) };
  return { ok: true, data: (data?.data ?? null) as T | null };
}

export async function saveConfig<T>(table: ConfigTable, value: T): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  const { error } = await supabase.from(table).upsert({ id: 'main', data: value, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return { ok: false, code: 'save_failed', message: errText(error) };
  return { ok: true, data: null };
}

export interface QaAnswerResult {
  held: boolean;
  flaggedTerms: string[];
  data: any;
}

/** 변호사 공개 Q&A 답변 (금지 표현이 걸리면 검토 대기로 저장) */
export async function answerClientQa(qaId: string, answer: string): Promise<RpcResult<QaAnswerResult>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  const { data, error } = await supabase.rpc('lawyer_answer_client_qa', { p_qa_id: qaId, p_answer: answer });
  if (error) return { ok: false, code: 'rpc_failed', message: errText(error) };
  const r = data as any;
  if (!r?.ok) return { ok: false, code: r?.code || 'failed', message: r?.message || '답변을 저장하지 못했습니다.' };
  return { ok: true, data: { held: !!r.held, flaggedTerms: r.flaggedTerms || [], data: r.data } };
}

/** 변호사 문의 등록 (본인 명의, 답변 칸 없이) */
export async function submitLawyerInquiry<T extends { id: string }>(item: T): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', message: '서버가 설정되지 않았습니다.' };
  const { error } = await supabase.from('lawyer_inquiries').insert({ id: item.id, data: item });
  if (error) return { ok: false, code: 'save_failed', message: errText(error) };
  return { ok: true, data: null };
}

/** 로그인한 의뢰인의 상담 요청 쿨다운 남은 초 (서버 계정 기준). 확인 실패면 null */
export async function fetchConsultCooldownRemaining(): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('my_consult_cooldown_remaining');
  if (error) return null;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}
