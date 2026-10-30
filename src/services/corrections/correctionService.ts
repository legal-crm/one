import { supabase, isSupabaseConfigured } from '../../supabaseClient';

// ============================================================
// 보정 대응 서버 서비스 (CR, 20261031001500)
// 회차·항목·소명자료 번호는 서버가 원본이다. 상태 변경(요청·검토·제출)은 서버 함수로만.
// ============================================================

import type { CannotReason, CorrectionKind, CorrectionStatus, ItemOwner, ItemStatus, TableType } from './correctionLabels';
export * from './correctionLabels';

export interface CorrectionOrder {
  id: string;
  officeId: string;
  caseKey: string;
  round: number;
  kind: CorrectionKind;
  courtName?: string;
  issuer: 'court' | 'commissioner';
  servedOn: string;
  periodKind: 'days' | 'fixed';
  periodDays?: number;
  fixedDue?: string;
  courtDue?: string;
  officeDue?: string;
  officeDueManual: boolean;
  status: CorrectionStatus;
  sourceFileId?: string;
  sourceText?: string;
  clientCanViewSource: boolean;
  clientCanViewBrief: boolean;
  brief: { intro?: string; closing?: string; attachments?: string[] };
  submittedOn?: string;
  receiptFileId?: string;
  briefFileId?: string;
  extensionNote?: string;
  /** 원문 파일 읽기(CR-3): 읽은 파일·찾은 값(참고용) */
  ocrStatus: 'none' | 'done' | 'failed';
  ocrAt?: string;
  ocrFileId?: string;
  ocrFound: { courtName?: string; caseNumber?: string; dueDate?: string; itemCount?: number };
  /** 수정본 연결(CR-8) */
  revisedDocs: RevisedDoc[];
  /** 회생위원 보수·양육비 조항 등 확인 기록(CR-8) */
  checks: Record<string, { done: boolean; note?: string; at?: string }>;
  /** 연장(CR-11) */
  extensionRequestedOn?: string;
  extensionDays?: number;
  extensionDecision?: 'granted' | 'denied';
  extensionDecidedOn?: string;
  originalCourtDue?: string;
  createdAt: string;
}

export interface RevisedDoc { kind: 'plan' | 'creditors' | 'property' | 'income' | 'statement' | 'other'; label: string; fileId?: string; unchanged?: boolean; at?: string }

export interface CorrectionItem {
  id: string;
  orderId: string;
  seq: number;
  label?: string;
  originalText?: string;
  category?: string;
  libraryId?: string;
  owner: ItemOwner;
  clientTitle?: string;
  clientGuide?: string;
  neededDocs: string[];
  tableType?: TableType;
  questions: string[];
  photoCount?: number;
  status: ItemStatus;
  clientAnswers: Record<string, string>;
  tableRows: Array<Record<string, string>>;
  fileIds: string[];
  cannotReason?: CannotReason;
  cannotNote?: string;
  expectedOn?: string;
  fixReason?: string;
  answerText?: string;
  exhibitNumbers: number[];
  clientSubmittedAt?: string;
  reviewedAt?: string;
}

export interface CaseExhibit { id: string; number: number; title: string; itemId?: string; fileId?: string; firstDocument?: string; pages?: string }

export interface LibraryEntry {
  id: string;
  officeId?: string;
  category: string;
  title: string;
  clientTitle: string;
  clientGuide?: string;
  neededDocs: string[];
  tableType?: TableType;
  questions: string[];
  owner: ItemOwner;
  answerTemplate?: string;
  keywords: string[];
}

type R<T> = { ok: true; data: T } | { ok: false; message: string };

function msg(error: any, fallback: string): string {
  const m = String(error?.message || '');
  if (m.includes('served_on required')) return '송달일을 입력해 주세요.';
  if (m.includes('due date before served')) return '기한이 송달일보다 앞이에요.';
  if (m.includes('office due must be')) return '사무소 마감은 법원 기한보다 늦을 수 없어요.';
  if (m.includes('locked')) return '제출을 마친 회차라 고칠 수 없어요.';
  if (m.includes('lawyer only')) return '보정서 제출 기록은 변호사만 남길 수 있어요.';
  if (m.includes('no client items ready')) return '의뢰인 몫 항목(담당 = 의뢰인, 쉬운 말 제목 있음)이 없어요.';
  if (m.includes('reason required')) return '사유를 적어 주세요.';
  if (m.includes('nothing submitted yet')) return '의뢰인이 아직 보내지 않은 항목이에요.';
  if (m.includes('submitted date must be')) return '제출일은 송달일과 오늘 사이여야 해요.';
  if (m.includes('already confirmed')) return '사무소가 이미 확인한 항목이에요.';
  if (m.includes('extension days')) return '연장 일수는 1~90일로 적어 주세요.';
  if (m.includes('new due must be')) return '새 기한은 지금 기한보다 뒤여야 해요.';
  if (m.includes('request date must be')) return '신청일은 송달일과 오늘 사이여야 해요.';
  if (m.includes('answer text required')) return '답변 문안이 있는 항목만 선례로 저장할 수 있어요.';
  if (m.includes('precedent limit')) return '선례는 500개까지 저장할 수 있어요. 안 쓰는 선례를 지워 주세요.';
  if (m.includes('not allowed') || m.includes('row-level security')) return '이 사건의 보정을 다룰 권한이 없어요.';
  return fallback;
}

const mapOrder = (r: any): CorrectionOrder => ({
  id: r.id, officeId: r.office_id, caseKey: r.case_key, round: r.round, kind: r.kind, courtName: r.court_name || undefined,
  issuer: r.issuer, servedOn: r.served_on, periodKind: r.period_kind, periodDays: r.period_days ?? undefined, fixedDue: r.fixed_due || undefined,
  courtDue: r.court_due || undefined, officeDue: r.office_due || undefined, officeDueManual: !!r.office_due_manual, status: r.status,
  sourceFileId: r.source_file_id || undefined, sourceText: r.source_text || undefined,
  clientCanViewSource: r.client_can_view_source !== false, clientCanViewBrief: r.client_can_view_brief !== false,
  brief: r.brief && typeof r.brief === 'object' ? r.brief : {}, submittedOn: r.submitted_on || undefined,
  receiptFileId: r.receipt_file_id || undefined, briefFileId: r.brief_file_id || undefined, extensionNote: r.extension_note || undefined,
  ocrStatus: r.ocr_status || 'none', ocrAt: r.ocr_at || undefined, ocrFileId: r.ocr_file_id || undefined,
  ocrFound: r.ocr_found && typeof r.ocr_found === 'object' ? r.ocr_found : {},
  revisedDocs: Array.isArray(r.revised_docs) ? r.revised_docs : [], checks: r.checks && typeof r.checks === 'object' ? r.checks : {},
  extensionRequestedOn: r.extension_requested_on || undefined, extensionDays: r.extension_days ?? undefined,
  extensionDecision: r.extension_decision || undefined, extensionDecidedOn: r.extension_decided_on || undefined, originalCourtDue: r.original_court_due || undefined,
  createdAt: r.created_at,
});

const mapItem = (r: any): CorrectionItem => ({
  id: r.id, orderId: r.order_id, seq: r.seq, label: r.label || undefined, originalText: r.original_text || undefined,
  category: r.category || undefined, libraryId: r.library_id || undefined, owner: r.owner, clientTitle: r.client_title || undefined,
  clientGuide: r.client_guide || undefined, neededDocs: r.needed_docs || [], tableType: r.table_type || undefined,
  questions: Array.isArray(r.questions) ? r.questions : [], photoCount: r.photo_count ?? undefined, status: r.status,
  clientAnswers: r.client_answers && typeof r.client_answers === 'object' ? r.client_answers : {},
  tableRows: Array.isArray(r.table_rows) ? r.table_rows : [], fileIds: r.file_ids || [],
  cannotReason: r.cannot_reason || undefined, cannotNote: r.cannot_note || undefined, expectedOn: r.expected_on || undefined,
  fixReason: r.fix_reason || undefined, answerText: r.answer_text || undefined, exhibitNumbers: r.exhibit_numbers || [],
  clientSubmittedAt: r.client_submitted_at || undefined, reviewedAt: r.reviewed_at || undefined,
});

const mapLibrary = (r: any): LibraryEntry => ({
  id: r.id, officeId: r.office_id || undefined, category: r.category, title: r.title, clientTitle: r.client_title,
  clientGuide: r.client_guide || undefined, neededDocs: r.needed_docs || [], tableType: r.table_type || undefined,
  questions: Array.isArray(r.questions) ? r.questions : [], owner: r.owner, answerTemplate: r.answer_template || undefined,
  keywords: r.keywords || [],
});

// ── 사무소 ──
export async function loadCaseCorrections(officeId: string, caseKey: string): Promise<R<{ orders: CorrectionOrder[]; items: CorrectionItem[]; exhibits: CaseExhibit[] }>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const [o, i, e] = await Promise.all([
    supabase.from('correction_orders').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('round', { ascending: false }),
    supabase.from('correction_items').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('seq', { ascending: true }),
    supabase.from('case_exhibits').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('number', { ascending: true }),
  ]);
  if (o.error || i.error || e.error) return { ok: false, message: '보정 기록을 불러오지 못했어요.' };
  return {
    ok: true,
    data: {
      orders: (o.data || []).map(mapOrder),
      items: (i.data || []).map(mapItem),
      exhibits: (e.data || []).map((x: any) => ({ id: x.id, number: x.number, title: x.title, itemId: x.item_id || undefined, fileId: x.file_id || undefined, firstDocument: x.first_document || undefined, pages: x.pages || undefined })),
    },
  };
}

export interface NewOrderInput {
  kind: CorrectionKind;
  courtName?: string;
  issuer: 'court' | 'commissioner';
  servedOn: string;
  periodKind: 'days' | 'fixed';
  periodDays?: number;
  fixedDue?: string;
  sourceFileId?: string;
  sourceText?: string;
}

export async function createCorrectionOrder(officeId: string, caseKey: string, input: NewOrderInput): Promise<R<CorrectionOrder>> {
  const { data, error } = await supabase.rpc('create_correction_order', {
    p_office_id: officeId, p_case_key: caseKey,
    p: {
      kind: input.kind, court_name: input.courtName || null, issuer: input.issuer, served_on: input.servedOn,
      period_kind: input.periodKind, period_days: input.periodKind === 'days' ? input.periodDays : null,
      fixed_due: input.periodKind === 'fixed' ? input.fixedDue : null, source_file_id: input.sourceFileId || null, source_text: input.sourceText || null,
    },
  });
  if (error) return { ok: false, message: msg(error, '보정 회차를 등록하지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: mapOrder(data) };
}

export async function updateCorrectionOrder(id: string, patch: Partial<Pick<CorrectionOrder,
  'courtName' | 'servedOn' | 'periodKind' | 'periodDays' | 'fixedDue' | 'officeDue' | 'officeDueManual' | 'sourceText' | 'sourceFileId'
  | 'clientCanViewSource' | 'clientCanViewBrief' | 'brief' | 'receiptFileId' | 'briefFileId' | 'extensionNote' | 'kind' | 'issuer'
  | 'revisedDocs' | 'checks' | 'ocrStatus' | 'ocrFileId' | 'ocrFound'>> & { status?: 'itemized' | 'drafting' | 'review' | 'extension' }): Promise<R<CorrectionOrder>> {
  const row: Record<string, unknown> = {};
  if ('courtName' in patch) row.court_name = patch.courtName || null;
  if ('servedOn' in patch) row.served_on = patch.servedOn;
  if ('periodKind' in patch) row.period_kind = patch.periodKind;
  if ('periodDays' in patch) row.period_days = patch.periodDays ?? null;
  if ('fixedDue' in patch) row.fixed_due = patch.fixedDue || null;
  if ('officeDue' in patch) row.office_due = patch.officeDue || null;
  if ('officeDueManual' in patch) row.office_due_manual = !!patch.officeDueManual;
  if ('sourceText' in patch) row.source_text = patch.sourceText || null;
  if ('sourceFileId' in patch) row.source_file_id = patch.sourceFileId || null;
  if ('clientCanViewSource' in patch) row.client_can_view_source = !!patch.clientCanViewSource;
  if ('clientCanViewBrief' in patch) row.client_can_view_brief = !!patch.clientCanViewBrief;
  if ('brief' in patch) row.brief = patch.brief || {};
  if ('receiptFileId' in patch) row.receipt_file_id = patch.receiptFileId || null;
  if ('briefFileId' in patch) row.brief_file_id = patch.briefFileId || null;
  if ('extensionNote' in patch) row.extension_note = patch.extensionNote || null;
  if ('kind' in patch) row.kind = patch.kind;
  if ('issuer' in patch) row.issuer = patch.issuer;
  if ('revisedDocs' in patch) row.revised_docs = patch.revisedDocs || [];
  if ('checks' in patch) row.checks = patch.checks || {};
  if ('ocrStatus' in patch) { row.ocr_status = patch.ocrStatus; row.ocr_at = new Date().toISOString(); }
  if ('ocrFileId' in patch) row.ocr_file_id = patch.ocrFileId || null;
  if ('ocrFound' in patch) row.ocr_found = patch.ocrFound || {};
  if (patch.status) row.status = patch.status;
  const { data, error } = await supabase.from('correction_orders').update(row).eq('id', id).select('*').single();
  if (error) return { ok: false, message: msg(error, '회차를 저장하지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: mapOrder(data) };
}

export async function deleteCorrectionOrder(id: string): Promise<R<true>> {
  const { error, count } = await supabase.from('correction_orders').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: msg(error, '회차를 지우지 못했어요. 변호사만 지울 수 있고, 제출한 회차는 지울 수 없어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: true };
}

export type ItemDraft = Partial<Omit<CorrectionItem, 'id' | 'orderId' | 'status' | 'clientAnswers' | 'exhibitNumbers'>> & { officeDone?: boolean };

function itemRow(d: ItemDraft): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('seq' in d) row.seq = d.seq;
  if ('label' in d) row.label = d.label || null;
  if ('originalText' in d) row.original_text = d.originalText || null;
  if ('category' in d) row.category = d.category || null;
  if ('libraryId' in d) row.library_id = d.libraryId || null;
  if ('owner' in d) row.owner = d.owner;
  if ('clientTitle' in d) row.client_title = d.clientTitle || null;
  if ('clientGuide' in d) row.client_guide = d.clientGuide || null;
  if ('neededDocs' in d) row.needed_docs = d.neededDocs || [];
  if ('tableType' in d) row.table_type = d.tableType || null;
  if ('questions' in d) row.questions = d.questions || [];
  if ('photoCount' in d) row.photo_count = d.photoCount || null;
  if ('answerText' in d) row.answer_text = d.answerText || null;
  if ('tableRows' in d) row.table_rows = d.tableRows || [];
  if ('fileIds' in d) row.file_ids = d.fileIds || [];
  return row;
}

/** 항목 여러 개 만들기 (원문 나누기 결과). 회차 상태를 '항목 정리'로 */
export async function insertCorrectionItems(order: CorrectionOrder, drafts: ItemDraft[]): Promise<R<CorrectionItem[]>> {
  if (drafts.length === 0) return { ok: true, data: [] };
  const rows = drafts.map(d => ({ ...itemRow(d), order_id: order.id, office_id: order.officeId, case_key: order.caseKey }));
  const { data, error } = await supabase.from('correction_items').insert(rows).select('*');
  if (error) return { ok: false, message: msg(error, '항목을 저장하지 못했어요.') };
  if (order.status === 'received') await supabase.from('correction_orders').update({ status: 'itemized' }).eq('id', order.id);
  notifyCorrectionsChanged();
  return { ok: true, data: (data || []).map(mapItem) };
}

export async function updateCorrectionItem(id: string, d: ItemDraft): Promise<R<CorrectionItem>> {
  const row = itemRow(d);
  const { data, error } = await supabase.from('correction_items').update(row).eq('id', id).select('*').single();
  if (error) return { ok: false, message: msg(error, '항목을 저장하지 못했어요.') };
  return { ok: true, data: mapItem(data) };
}

export async function deleteCorrectionItem(id: string): Promise<R<true>> {
  const { error, count } = await supabase.from('correction_items').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: msg(error, '의뢰인에게 요청한 항목은 지울 수 없어요.') };
  return { ok: true, data: true };
}

export async function requestCorrectionItems(orderId: string, itemIds?: string[]): Promise<R<number>> {
  const { data, error } = await supabase.rpc('request_correction_items', { p_order_id: orderId, p_item_ids: itemIds && itemIds.length ? itemIds : null });
  if (error) return { ok: false, message: msg(error, '의뢰인에게 요청하지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: Number(data) || 0 };
}

export async function reviewCorrectionItem(itemId: string, action: 'confirm' | 'needs_fix' | 'office_done' | 'reopen', reason?: string, exhibitTitle?: string): Promise<R<CorrectionItem>> {
  const { data, error } = await supabase.rpc('review_correction_item', { p_item_id: itemId, p_action: action, p_reason: reason?.trim() || null, p_exhibit_title: exhibitTitle?.trim() || null });
  if (error) return { ok: false, message: msg(error, '검토 결과를 저장하지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: mapItem(data) };
}

export async function submitCorrectionOrder(orderId: string, submittedOn: string, receiptFileId?: string, briefFileId?: string): Promise<R<CorrectionOrder>> {
  const { data, error } = await supabase.rpc('submit_correction_order', { p_order_id: orderId, p_submitted_on: submittedOn, p_receipt_file_id: receiptFileId || null, p_brief_file_id: briefFileId || null });
  if (error) return { ok: false, message: msg(error, '제출 기록을 남기지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: mapOrder(data) };
}

export async function loadCorrectionLibrary(): Promise<LibraryEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('correction_item_library').select('*').order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []).map(mapLibrary);
}

export interface CorrectionOverviewRow {
  orderId: string; caseKey: string; round: number; status: CorrectionStatus; servedOn: string; courtDue?: string; officeDue?: string;
  itemsTotal: number; itemsOpen: number; itemsClientWaiting: number; submittedOn?: string;
}

export async function loadCorrectionOverview(officeId: string): Promise<CorrectionOverviewRow[]> {
  if (!isSupabaseConfigured || !officeId) return [];
  const { data, error } = await supabase.rpc('office_correction_overview', { p_office_id: officeId });
  if (error) return [];
  return (data || []).map((r: any) => ({
    orderId: r.order_id, caseKey: r.case_key, round: r.round, status: r.status, servedOn: r.served_on, courtDue: r.court_due || undefined,
    officeDue: r.office_due || undefined, itemsTotal: r.items_total, itemsOpen: r.items_open, itemsClientWaiting: r.items_client_waiting,
    submittedOn: r.submitted_on || undefined,
  }));
}

// ── 의뢰인 ──
export interface ClientCorrectionItem {
  id: string; label?: string; title?: string; guide?: string; neededDocs: string[]; tableType?: TableType; questions: string[];
  photoCount?: number; status: ItemStatus; answers: Record<string, string>; tableRows: Array<Record<string, string>>; fileIds: string[];
  cannotReason?: CannotReason; cannotNote?: string; expectedOn?: string; fixReason?: string;
}
export interface ClientCorrectionOrder {
  id: string; round: number; kind: CorrectionKind; courtName?: string; status: CorrectionStatus; officeDue?: string; courtDue?: string;
  submittedOn?: string; sourceFileId?: string; briefFileId?: string; items: ClientCorrectionItem[];
}

export async function loadClientCorrections(caseKey: string): Promise<R<ClientCorrectionOrder[]>> {
  if (!isSupabaseConfigured) return { ok: true, data: [] };
  const { data, error } = await supabase.rpc('client_correction_view', { p_case_key: caseKey });
  if (error) return { ok: false, message: '보정 할 일을 불러오지 못했어요.' };
  return {
    ok: true,
    data: ((data as any[]) || []).map(o => ({
      id: o.id, round: o.round, kind: o.kind, courtName: o.court_name || undefined, status: o.status, officeDue: o.office_due || undefined,
      courtDue: o.court_due || undefined, submittedOn: o.submitted_on || undefined, sourceFileId: o.source_file_id || undefined,
      briefFileId: o.brief_file_id || undefined,
      items: (o.items || []).map((i: any) => ({
        id: i.id, label: i.label || undefined, title: i.title || undefined, guide: i.guide || undefined, neededDocs: i.needed_docs || [],
        tableType: i.table_type || undefined, questions: Array.isArray(i.questions) ? i.questions : [], photoCount: i.photo_count ?? undefined,
        status: i.status, answers: i.answers || {}, tableRows: Array.isArray(i.table_rows) ? i.table_rows : [], fileIds: i.file_ids || [],
        cannotReason: i.cannot_reason || undefined, cannotNote: i.cannot_note || undefined, expectedOn: i.expected_on || undefined,
        fixReason: i.fix_reason || undefined,
      })),
    })),
  };
}

export async function respondCorrectionItem(itemId: string, action: 'save' | 'submit' | 'cannot', payload: {
  answers?: Record<string, string>; tableRows?: Array<Record<string, string>>; fileIds?: string[];
  cannotReason?: CannotReason; cannotNote?: string; expectedOn?: string;
}): Promise<R<{ status: ItemStatus; fileIds: string[] }>> {
  const p: Record<string, unknown> = {};
  if (payload.answers) p.answers = payload.answers;
  if (payload.tableRows) p.table_rows = payload.tableRows;
  if (payload.fileIds) p.file_ids = payload.fileIds;
  if (payload.cannotReason) p.cannot_reason = payload.cannotReason;
  if (payload.cannotNote) p.cannot_note = payload.cannotNote;
  if (payload.expectedOn) p.expected_on = payload.expectedOn;
  const { data, error } = await supabase.rpc('client_correction_respond', { p_item_id: itemId, p_action: action, p });
  if (error) return { ok: false, message: msg(error, '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') };
  return { ok: true, data: { status: (data as any)?.status, fileIds: (data as any)?.file_ids || [] } };
}

/** 파일 정보 (사무소·의뢰인 공통, RLS 범위 안에서) */
export async function loadCaseFilesByIds(ids: string[]): Promise<Array<{ id: string; name: string; storagePath: string; mimeType?: string; createdAt: string }>> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  const { data, error } = await supabase.from('case_files').select('id, name, storage_path, mime_type, created_at').in('id', ids);
  if (error) return [];
  return (data || []).map((r: any) => ({ id: r.id, name: r.name, storagePath: r.storage_path, mimeType: r.mime_type || undefined, createdAt: r.created_at }));
}

export const CORRECTIONS_CHANGED_EVENT = 'mykim:corrections-changed';
export function notifyCorrectionsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CORRECTIONS_CHANGED_EVENT));
}

// ── 연장 신청·결정 (CR-11) ──
export async function recordCorrectionExtension(orderId: string, action: 'request' | 'granted' | 'denied', p: { days?: number; note?: string; requestedOn?: string; newDue?: string; decidedOn?: string } = {}): Promise<R<CorrectionOrder>> {
  const { data, error } = await supabase.rpc('record_correction_extension', {
    p_order_id: orderId, p_action: action,
    p: { days: p.days ?? null, note: p.note ?? null, requested_on: p.requestedOn ?? null, new_due: p.newDue ?? null, decided_on: p.decidedOn ?? null },
  });
  if (error) return { ok: false, message: msg(error, '연장 기록을 저장하지 못했어요.') };
  notifyCorrectionsChanged();
  return { ok: true, data: mapOrder(data) };
}

// ── 사무소 보정 통계 (CR-12, 개인정보 없음) ──
export interface CorrectionStats {
  byCourt: Array<{ court: string; orders: number; submitted: number; avgDays: number | null; extensions: number }>;
  byCategory: Array<{ court: string; category: string; items: number; cannot: number; needsFix: number }>;
}
export async function loadCorrectionStats(officeId: string): Promise<R<CorrectionStats>> {
  const { data, error } = await supabase.rpc('office_correction_stats', { p_office_id: officeId });
  if (error) return { ok: false, message: msg(error, '보정 통계를 불러오지 못했어요.') };
  const d = (data || {}) as any;
  return {
    ok: true,
    data: {
      byCourt: (d.by_court || []).map((x: any) => ({ court: x.court, orders: Number(x.orders) || 0, submitted: Number(x.submitted) || 0, avgDays: x.avg_days === null || x.avg_days === undefined ? null : Number(x.avg_days), extensions: Number(x.extensions) || 0 })),
      byCategory: (d.by_category || []).map((x: any) => ({ court: x.court, category: x.category, items: Number(x.items) || 0, cannot: Number(x.cannot) || 0, needsFix: Number(x.needs_fix) || 0 })),
    },
  };
}

// ── 선례 문안 보관함 (CR-12, 변호사가 확정한 문안만, 이름·사건번호 가림) ──
export interface CorrectionPrecedent { id: string; category?: string; title: string; answerText: string; courtName?: string; createdAt: string }
const mapPrecedent = (r: any): CorrectionPrecedent => ({ id: r.id, category: r.category || undefined, title: r.title, answerText: r.answer_text, courtName: r.court_name || undefined, createdAt: r.created_at });

export async function loadPrecedents(officeId: string): Promise<R<CorrectionPrecedent[]>> {
  const { data, error } = await supabase.from('correction_precedents').select('*').eq('office_id', officeId).order('created_at', { ascending: false }).limit(500);
  if (error) return { ok: false, message: msg(error, '선례를 불러오지 못했어요.') };
  return { ok: true, data: (data || []).map(mapPrecedent) };
}

export async function savePrecedent(itemId: string, title: string, maskTerms: string[]): Promise<R<CorrectionPrecedent>> {
  const { data, error } = await supabase.rpc('save_correction_precedent', { p_item_id: itemId, p_title: title, p_mask_terms: maskTerms.filter(s => s && s.trim().length >= 2) });
  if (error) return { ok: false, message: msg(error, '선례로 저장하지 못했어요.') };
  return { ok: true, data: mapPrecedent(data) };
}

export async function deletePrecedent(id: string): Promise<R<true>> {
  const { error, count } = await supabase.from('correction_precedents').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: msg(error, '선례를 지우지 못했어요. 변호사만 지울 수 있어요.') };
  return { ok: true, data: true };
}
