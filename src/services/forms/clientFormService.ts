// ============================================================
// 의뢰인 서식 작성 요청 서버 서비스 (H-14, 20261031002000)
// 사무소: request_client_form · review_client_form · office_client_forms
// 의뢰인: client_form_view · client_form_respond
// 이전 ClientMobileDocService(변호사 브라우저 localStorage + /mobile-doc?token= 링크)는 삭제했다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { QuestionnaireField } from '../documents/legalDocRegistry';
import type { ClientFormSchema } from './clientFormSchemas';

export type ClientFormStatus = 'requested' | 'in_progress' | 'submitted' | 'needs_fix' | 'accepted' | 'cancelled';
type R<T> = { ok: true; data: T; message?: undefined } | { ok: false; message: string; data?: undefined };

export const CLIENT_FORMS_CHANGED_EVENT = 'mykim:client-forms-changed';
export function notifyClientFormsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLIENT_FORMS_CHANGED_EVENT));
}

export const FORM_STATUS_LABEL: Record<ClientFormStatus, string> = {
  requested: '작성 요청함',
  in_progress: '의뢰인 작성 중',
  submitted: '확인 대기',
  needs_fix: '보완 요청함',
  accepted: '확인 완료',
  cancelled: '요청 취소',
};

export interface ClientFormRequest {
  id: string;
  docCode: string;
  title: string;
  fields: QuestionnaireField[];
  note?: string;
  needsSignature: boolean;
  thirdPartySigner?: string;
  dueOn?: string;
  status: ClientFormStatus;
  fixReason?: string;
  cancelReason?: string;
  requestedAt: string;
  reviewedAt?: string;
  /** 의뢰인 화면: 임시 저장한 답 */
  draft: Record<string, string>;
  submittedVersion?: number;
  /** 사무소 화면: 최신 제출본 */
  submission?: { version: number; answers: Record<string, string>; signatureFileId?: string; fileIds: string[]; submittedAt: string };
}

function msg(error: { message?: string } | null | undefined, fallback: string): string {
  const m = error?.message || '';
  if (/already requested/i.test(m)) return '이미 같은 서식 작성을 요청했어요. 진행 중인 요청을 먼저 확인해 주세요.';
  if (/resident registration/i.test(m)) return '주민등록번호는 적지 말아 주세요. 사무소가 출력할 때만 따로 받아요.';
  if (/required field missing/i.test(m)) return '꼭 채워야 하는 칸이 비어 있어요.';
  if (/signature required/i.test(m)) return '서명을 먼저 해 주세요.';
  if (/signed copy photo required/i.test(m)) return '서명받은 서류 사진을 올려 주세요.';
  if (/reason required/i.test(m)) return '사유를 입력해 주세요.';
  if (/nothing submitted/i.test(m)) return '의뢰인이 아직 보내지 않았어요.';
  if (/request closed/i.test(m)) return '이미 끝난 요청이에요.';
  if (/not allowed|permission/i.test(m)) return '이 작업을 할 권한이 없어요.';
  if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  return fallback;
}

function mapRequest(r: any): ClientFormRequest {
  const sub = r.submission;
  return {
    id: r.id,
    docCode: r.doc_code,
    title: r.title,
    fields: Array.isArray(r.fields) ? r.fields : [],
    note: r.note || undefined,
    needsSignature: !!r.needs_signature,
    thirdPartySigner: r.third_party_signer || undefined,
    dueOn: r.due_on || undefined,
    status: r.status,
    fixReason: r.fix_reason || undefined,
    cancelReason: r.cancel_reason || undefined,
    requestedAt: r.requested_at,
    reviewedAt: r.reviewed_at || undefined,
    draft: r.draft && typeof r.draft === 'object' ? r.draft : {},
    submittedVersion: r.submitted_version ?? undefined,
    submission: sub ? {
      version: sub.version,
      answers: sub.answers || {},
      signatureFileId: sub.signature_file_id || undefined,
      fileIds: Array.isArray(sub.file_ids) ? sub.file_ids : [],
      submittedAt: sub.submitted_at,
    } : undefined,
  };
}

// ── 사무소 ───────────────────────────────────────────────────
export async function requestClientForm(officeId: string, caseKey: string, schema: ClientFormSchema, opts: { note?: string; dueOn?: string } = {}): Promise<R<ClientFormRequest>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc('request_client_form', {
    p_office_id: officeId,
    p_case_key: caseKey,
    p: {
      doc_code: schema.docCode,
      title: schema.title,
      fields: schema.fields,
      note: opts.note || schema.guide,
      needs_signature: !!schema.needsSignature,
      third_party_signer: schema.thirdPartySigner || null,
      due_on: opts.dueOn || null,
    },
  });
  if (error) return { ok: false, message: msg(error, '작성 요청을 보내지 못했어요.') };
  notifyClientFormsChanged();
  return { ok: true, data: mapRequest(data) };
}

export async function reviewClientForm(id: string, action: 'accept' | 'needs_fix' | 'cancel', reason?: string): Promise<R<ClientFormRequest>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc('review_client_form', { p_id: id, p_action: action, p_reason: reason || null });
  if (error) return { ok: false, message: msg(error, '처리하지 못했어요.') };
  notifyClientFormsChanged();
  return { ok: true, data: mapRequest(data) };
}

export async function loadOfficeClientForms(officeId: string, caseKey: string): Promise<R<ClientFormRequest[]>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc('office_client_forms', { p_office_id: officeId, p_case_key: caseKey });
  if (error) return { ok: false, message: msg(error, '작성 요청 목록을 불러오지 못했어요.') };
  return { ok: true, data: (Array.isArray(data) ? data : []).map(mapRequest) };
}

// ── 의뢰인 ───────────────────────────────────────────────────
export async function loadMyClientForms(caseKey: string): Promise<R<ClientFormRequest[]>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc('client_form_view', { p_case_key: caseKey });
  if (error) return { ok: false, message: msg(error, '작성할 서류를 불러오지 못했어요.') };
  return { ok: true, data: (Array.isArray(data) ? data : []).map(mapRequest) };
}

export async function respondClientForm(id: string, action: 'save' | 'submit', p: { answers: Record<string, string>; signatureFileId?: string; fileIds?: string[] }): Promise<R<{ status: ClientFormStatus; version?: number }>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc('client_form_respond', {
    p_id: id,
    p_action: action,
    p: { answers: p.answers, signature_file_id: p.signatureFileId || null, file_ids: p.fileIds || [] },
  });
  if (error) return { ok: false, message: msg(error, action === 'submit' ? '보내지 못했어요.' : '임시 저장하지 못했어요.') };
  notifyClientFormsChanged();
  return { ok: true, data: { status: (data as any)?.status, version: (data as any)?.version } };
}
