// 사건 검토 (CV-1, 19 기획서) — 계산은 caseReviewCalc.ts, 여기서는 서버 case_reviews 기록
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';
import { emptyReviewInput, type CaseReviewInput, type CaseReviewResult } from './caseReviewCalc';
export * from './caseReviewCalc';

export interface CaseReviewRecord { id: string; input: CaseReviewInput; result: CaseReviewResult; note?: string; createdAt: string; standardVersion?: number }

export async function loadLatestReview(officeId: string, caseKey: string): Promise<RpcResult<CaseReviewRecord | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_reviews').select('id, input, result, note, created_at, standard_version')
    .eq('office_id', officeId).eq('case_key', caseKey).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? { id: data.id, input: { ...emptyReviewInput(), ...data.input }, result: data.result, note: data.note || undefined, createdAt: data.created_at, standardVersion: data.standard_version ?? undefined } : null };
}

export async function saveReview(officeId: string, caseKey: string, input: CaseReviewInput, result: CaseReviewResult, note?: string, standardVersion?: number | null): Promise<RpcResult<{ id: string; createdAt: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_reviews').insert({ office_id: officeId, case_key: caseKey, input, result, note: note?.trim() || null, standard_version: standardVersion ?? null }).select('id, created_at').single();
  if (error) return toRpcError(error);
  return { ok: true, data: { id: data.id, createdAt: data.created_at } };
}
