// 고객 1:1 문의 — 서버(/api/inquiry)를 통해 저장·조회
// (Turnstile 검증과 비회원 비밀번호 해시는 서버에서 처리. 브라우저에 비밀번호를 저장하지 않는다)
import { getAuthHeaders } from '../supabaseClient';
import type { ClientInquiry } from '../types';

export interface InquiryPublic {
  id: string;
  title: string;
  content: string;
  category?: string;
  status: 'pending' | 'replied' | string;
  createdAt: string;
  replyContent?: string;
  repliedAt?: string;
  attachments?: { fileName: string; fileSize: number; fileType: string }[];
}

type Result<T> = { ok: true } & T | { ok: false; error: string; locked?: boolean };

async function call<T>(action: string, init: RequestInit): Promise<Result<T>> {
  try {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
    const res = await fetch(`/api/inquiry?action=${action}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const json = await res.json().catch(() => null);
    if (!json) return { ok: false, error: `서버 응답 오류 (${res.status})` };
    if (!json.ok) return { ok: false, error: json.error || '요청을 처리하지 못했습니다.', locked: json.locked };
    return json;
  } catch {
    return { ok: false, error: '네트워크 오류로 요청하지 못했습니다.' };
  }
}

export function createInquiry(payload: {
  turnstileToken?: string;
  category?: string;
  nickname?: string;
  password?: string;
  contact?: string;
  title: string;
  content: string;
  source?: string;
  attachments?: { fileName: string; fileSize: number; fileType: string; dataUrl?: string }[];
}) {
  return call<{ id: string; item: InquiryPublic }>('create', { method: 'POST', body: JSON.stringify(payload) });
}

export function lookupInquiry(id: string, password: string) {
  return call<{ item: InquiryPublic }>('lookup', { method: 'POST', body: JSON.stringify({ id, password }) });
}

export function loadMyInquiries() {
  return call<{ items: InquiryPublic[] }>('mine', { method: 'GET' });
}

export type InquiryStatus = 'pending' | 'in_progress' | 'replied' | 'closed';
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  pending: '접수',
  in_progress: '확인 중',
  replied: '답변 완료',
  closed: '종결',
};

export interface AdminInquiry extends InquiryPublic {
  clientName: string;
  isMember: boolean;
  contactInfo?: string;
  source?: string;
  assignee?: string;
  /** 처리 기한 (접수 + 2영업일, CT-8) */
  dueAt?: string;
  /** 첫 답변 알림 결과 */
  replyNotice?: { sent: string[]; failed: string[]; at: string };
  /** 저장소 파일은 5분 주소 */
  attachments?: { fileName: string; fileSize: number; fileType: string; dataUrl?: string }[];
}

/** 관리자: 서버에 접수된 전체 문의 (2단계 인증 관리자만) */
export function adminLoadInquiries() {
  return call<{ items: AdminInquiry[] }>('admin-list', { method: 'GET' });
}

/** 관리자: 답변 저장 (빈 문자열이면 답변 삭제). 첫 답변이면 서버가 알림을 한 번 보낸다 */
export function adminReplyInquiry(id: string, replyContent: string) {
  return call<{ item: AdminInquiry }>('admin-reply', { method: 'POST', body: JSON.stringify({ id, replyContent }) });
}

/** 의뢰인·변호사 화면의 문의 상태 표시 */
export function inquiryStatusView(status: string | undefined): { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' } {
  if (status === 'replied') return { label: '답변 완료', tone: 'success' };
  if (status === 'closed') return { label: '종결', tone: 'neutral' };
  if (status === 'in_progress') return { label: '확인 중', tone: 'info' };
  return { label: '답변 대기', tone: 'warning' };
}

/** 관리자: 상태·담당자 바꾸기 */
export function adminUpdateInquiry(id: string, patch: { status?: InquiryStatus; assignee?: string }) {
  return call<{ item: AdminInquiry }>('admin-update', { method: 'POST', body: JSON.stringify({ id, ...patch }) });
}

/** 기한 표시: 남은 날 또는 지남 (서버 기한이 없으면 접수일 + 주말 뺀 2일) */
export function inquiryDueInfo(createdAt: string, dueAt: string | undefined, status: string): { label: string; overdue: boolean } | null {
  if (status === 'replied' || status === 'closed') return null;
  let due = dueAt ? new Date(dueAt) : null;
  if (!due) {
    const d = new Date(createdAt);
    let left = 2;
    while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1; }
    due = d;
  }
  const ms = due.getTime() - Date.now();
  if (ms < 0) return { label: '기한 지남', overdue: true };
  const hours = Math.floor(ms / 3600000);
  return { label: hours < 24 ? `${Math.max(1, hours)}시간 남음` : `${Math.ceil(hours / 24)}일 남음`, overdue: false };
}

/** 기존 화면(ClientInquiry 타입) 호환 변환 */
export function toClientInquiry(i: InquiryPublic, clientName: string): ClientInquiry {
  return {
    id: i.id,
    clientId: '',
    clientName,
    title: i.title,
    content: i.content,
    createdAt: i.createdAt,
    status: (['in_progress', 'replied', 'closed'].includes(i.status) ? i.status : 'pending') as ClientInquiry['status'],
    replyContent: i.replyContent,
    repliedAt: i.repliedAt,
  } as ClientInquiry;
}
