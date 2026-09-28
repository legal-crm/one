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

/** 기존 화면(ClientInquiry 타입) 호환 변환 */
export function toClientInquiry(i: InquiryPublic, clientName: string): ClientInquiry {
  return {
    id: i.id,
    clientId: '',
    clientName,
    title: i.title,
    content: i.content,
    createdAt: i.createdAt,
    status: (i.status === 'replied' ? 'replied' : 'pending') as ClientInquiry['status'],
    replyContent: i.replyContent,
    repliedAt: i.repliedAt,
  } as ClientInquiry;
}
