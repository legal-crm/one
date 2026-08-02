import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { ConsultRequest, ConsultMessage } from '../types';

// ============================================================
// Consult Supabase Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작
// ============================================================

const REQUESTS_STORAGE_KEY = 'legal_crm_requests';
const MESSAGES_STORAGE_KEY = 'legal_crm_messages';

// ── 유틸리티 ──

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Supabase 에러 로깅 (화면에도 표시)
function logSupabaseError(operation: string, error: any) {
  const msg = `[Consult] ${operation} 실패: ${typeof error === 'object' ? JSON.stringify(error) : error}`;
  console.error(msg);
  // 개발/디버그용: 화면에 토스트 표시
  try {
    const el = document.createElement('div');
    el.textContent = `⚠️ DB 저장 오류: ${operation}`;
    el.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:8px 16px;border-radius:8px;z-index:99999;font-size:13px;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  } catch {}
}

// ConsultRequest → DB row 변환 (undefined를 null로, NOT NULL 필드에 기본값 보장)
function requestToRow(request: ConsultRequest) {
  return {
    id: request.id,
    client_id: request.clientId || 'client-temp',
    client_name: request.clientName || '익명 의뢰인',
    phone: request.phone || '',
    request_type: request.requestType || 'open',
    max_participants: request.maxParticipants ?? 3,
    status: request.status || 'requested',
    selected_lawyer_id: request.selectedLawyerId || null,
    selected_lawyer_ids: request.selectedLawyerIds || [],
    proposals: request.proposals || [],
    title: request.title || '',
    content: request.content || '',
    financial_profile: request.financialProfile || {},
    phone_consultation_requested: request.phoneConsultationRequested ?? false,
    safe_number: request.safeNumber || null,
    safe_number_assigned_at: request.safeNumberAssignedAt || null,
    safe_number_expires_at: request.safeNumberExpiresAt || null,
    entry_category: request.entryCategory || null,
    created_at: request.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// DB row → ConsultRequest 변환
function rowToRequest(row: any): ConsultRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    phone: row.phone,
    requestType: row.request_type,
    maxParticipants: row.max_participants,
    status: row.status,
    selectedLawyerId: row.selected_lawyer_id,
    selectedLawyerIds: row.selected_lawyer_ids,
    proposals: row.proposals,
    title: row.title,
    content: row.content,
    financialProfile: row.financial_profile,
    phoneConsultationRequested: row.phone_consultation_requested,
    safeNumber: row.safe_number,
    safeNumberAssignedAt: row.safe_number_assigned_at,
    safeNumberExpiresAt: row.safe_number_expires_at,
    entryCategory: row.entry_category,
    createdAt: row.created_at,
  };
}

// ── 상담 요청 (ConsultRequest) 관리 ──

export async function loadConsultRequests(clientId?: string): Promise<ConsultRequest[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('consult_requests').select('*');
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logSupabaseError('loadConsultRequests', error);
      } else if (data) {
        return data
          .map(rowToRequest)
          .filter((req: ConsultRequest) => req.id !== 'req-1' && req.id !== 'req-2' && req.id !== 'req-3');
      }
    } catch (e) {
      logSupabaseError('loadConsultRequests (exception)', e);
    }
  }
  
  // LocalStorage Fallback
  const allRequests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  return allRequests
    .filter(r => !clientId || r.clientId === clientId)
    .filter(r => r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3');
}

export async function saveConsultRequest(request: ConsultRequest): Promise<void> {
  // Always save to localStorage
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  const idx = requests.findIndex(r => r.id === request.id);
  if (idx >= 0) requests[idx] = request;
  else requests.push(request);
  setLocalData(REQUESTS_STORAGE_KEY, requests);

  // Also persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('consult_requests').upsert(
        requestToRow(request),
        { onConflict: 'id' }
      );
      if (error) {
        logSupabaseError('saveConsultRequest', error);
      }
    } catch (e) {
      logSupabaseError('saveConsultRequest (exception)', e);
    }
  }
}

export async function saveAllConsultRequests(requests: ConsultRequest[]): Promise<void> {
  // Save to localStorage
  setLocalData(REQUESTS_STORAGE_KEY, requests);
  
  if (isSupabaseConfigured && requests.length > 0) {
    try {
      const payload = requests.map(requestToRow);
      const { error } = await supabase.from('consult_requests').upsert(payload, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveAllConsultRequests', error);
      }
    } catch (e) {
      logSupabaseError('saveAllConsultRequests (exception)', e);
    }
  }
}

export async function deleteConsultRequest(requestId: string): Promise<void> {
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  setLocalData(REQUESTS_STORAGE_KEY, requests.filter(r => r.id !== requestId));

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('consult_requests').delete().eq('id', requestId);
      if (error) {
        logSupabaseError('deleteConsultRequest', error);
      }
    } catch (e) {
      logSupabaseError('deleteConsultRequest (exception)', e);
    }
  }
}

// ── 상담 메시지 (ConsultMessage) 관리 ──

export async function loadConsultMessages(requestIds?: string[]): Promise<ConsultMessage[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('consult_messages').select('*');
      if (requestIds && requestIds.length > 0) {
        query = query.in('consult_request_id', requestIds);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logSupabaseError('loadConsultMessages', error);
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          consultRequestId: row.consult_request_id,
          senderType: row.sender_type,
          senderId: row.sender_id,
          senderName: row.sender_name,
          message: row.message,
          createdAt: row.created_at,
        }));
      }
    } catch (e) {
      logSupabaseError('loadConsultMessages (exception)', e);
    }
  }
  
  const allMessages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  return allMessages.filter(m => !requestIds || requestIds.includes(m.consultRequestId));
}

export async function saveConsultMessage(message: ConsultMessage): Promise<void> {
  const messages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  const idx = messages.findIndex(m => m.id === message.id);
  if (idx >= 0) messages[idx] = message;
  else messages.push(message);
  setLocalData(MESSAGES_STORAGE_KEY, messages);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('consult_messages').upsert({
        id: message.id,
        consult_request_id: message.consultRequestId,
        sender_type: message.senderType,
        sender_id: message.senderId,
        sender_name: message.senderName,
        message: message.message,
        created_at: message.createdAt,
      }, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveConsultMessage', error);
      }
    } catch (e) {
      logSupabaseError('saveConsultMessage (exception)', e);
    }
  }
}

export async function saveAllConsultMessages(messages: ConsultMessage[]): Promise<void> {
  setLocalData(MESSAGES_STORAGE_KEY, messages);
  
  if (isSupabaseConfigured && messages.length > 0) {
    try {
      const payload = messages.map(msg => ({
        id: msg.id,
        consult_request_id: msg.consultRequestId,
        sender_type: msg.senderType,
        sender_id: msg.senderId,
        sender_name: msg.senderName,
        message: msg.message,
        created_at: msg.createdAt,
      }));
      const { error } = await supabase.from('consult_messages').upsert(payload, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveAllConsultMessages', error);
      }
    } catch (e) {
      logSupabaseError('saveAllConsultMessages (exception)', e);
    }
  }
}

// ── 마이그레이션 ──

export async function migrateAnonymousRequests(newClientId: string, newClientName: string): Promise<ConsultRequest[]> {
  const requests = await loadConsultRequests('client-temp');
  if (requests.length === 0) return [];

  const updatedRequests = requests.map(req => ({
    ...req,
    clientId: newClientId,
    clientName: req.clientName === '익명 의뢰인' ? newClientName : req.clientName,
  }));

  await saveAllConsultRequests(updatedRequests);
  return updatedRequests;
}
