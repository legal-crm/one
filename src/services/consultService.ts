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

// ── 상담 요청 (ConsultRequest) 관리 ──

export async function loadConsultRequests(clientId?: string): Promise<ConsultRequest[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('consult_requests').select('*');
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        return data
          .map((row: any) => ({
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
            updatedAt: row.updated_at,
          }))
          .filter((req: ConsultRequest) => req.id !== 'req-1' && req.id !== 'req-2' && req.id !== 'req-3');
      }
    } catch (e) {
      console.warn('[Consult] Supabase requests load failed, falling back to localStorage', e);
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
      await supabase.from('consult_requests').upsert({
        id: request.id,
        client_id: request.clientId,
        client_name: request.clientName,
        phone: request.phone,
        request_type: request.requestType,
        max_participants: request.maxParticipants,
        status: request.status,
        selected_lawyer_id: request.selectedLawyerId,
        selected_lawyer_ids: request.selectedLawyerIds,
        proposals: request.proposals,
        title: request.title,
        content: request.content,
        financial_profile: request.financialProfile,
        phone_consultation_requested: request.phoneConsultationRequested,
        safe_number: request.safeNumber,
        safe_number_assigned_at: request.safeNumberAssignedAt,
        safe_number_expires_at: request.safeNumberExpiresAt,
        entry_category: request.entryCategory,
        created_at: request.createdAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[Consult] Supabase request save failed', e);
    }
  }
}

export async function saveAllConsultRequests(requests: ConsultRequest[]): Promise<void> {
  // Save to localStorage
  const allRequests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  const requestMap = new Map(allRequests.map(r => [r.id, r]));
  for (const r of requests) {
    requestMap.set(r.id, r);
  }
  setLocalData(REQUESTS_STORAGE_KEY, Array.from(requestMap.values()));
  
  if (isSupabaseConfigured && requests.length > 0) {
    try {
      const payload = requests.map(request => ({
        id: request.id,
        client_id: request.clientId,
        client_name: request.clientName,
        phone: request.phone,
        request_type: request.requestType,
        max_participants: request.maxParticipants,
        status: request.status,
        selected_lawyer_id: request.selectedLawyerId,
        selected_lawyer_ids: request.selectedLawyerIds,
        proposals: request.proposals,
        title: request.title,
        content: request.content,
        financial_profile: request.financialProfile,
        phone_consultation_requested: request.phoneConsultationRequested,
        safe_number: request.safeNumber,
        safe_number_assigned_at: request.safeNumberAssignedAt,
        safe_number_expires_at: request.safeNumberExpiresAt,
        entry_category: request.entryCategory,
        created_at: request.createdAt,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('consult_requests').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('[Consult] Supabase requests batch save failed', e);
    }
  }
}

export async function deleteConsultRequest(requestId: string): Promise<void> {
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  setLocalData(REQUESTS_STORAGE_KEY, requests.filter(r => r.id !== requestId));

  if (isSupabaseConfigured) {
    try {
      await supabase.from('consult_requests').delete().eq('id', requestId);
    } catch (e) {
      console.warn('[Consult] Supabase request delete failed', e);
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
      
      if (!error && data) {
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
      console.warn('[Consult] Supabase messages load failed, falling back to localStorage', e);
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
      await supabase.from('consult_messages').upsert({
        id: message.id,
        consult_request_id: message.consultRequestId,
        sender_type: message.senderType,
        sender_id: message.senderId,
        sender_name: message.senderName,
        message: message.message,
        created_at: message.createdAt,
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[Consult] Supabase message save failed', e);
    }
  }
}

export async function saveAllConsultMessages(messages: ConsultMessage[]): Promise<void> {
  const allMessages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  const messageMap = new Map(allMessages.map(m => [m.id, m]));
  for (const m of messages) {
    messageMap.set(m.id, m);
  }
  setLocalData(MESSAGES_STORAGE_KEY, Array.from(messageMap.values()));
  
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
      await supabase.from('consult_messages').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('[Consult] Supabase messages batch save failed', e);
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
    updatedAt: new Date().toISOString()
  }));

  await saveAllConsultRequests(updatedRequests);
  return updatedRequests;
}
