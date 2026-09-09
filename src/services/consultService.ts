import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { ConsultRequest, ConsultMessage } from '../types';
import { encryptField, decryptField } from '../utils/cryptoField';
import { validateAndSanitizeConsultRequest } from '../schemas/consultSchema';

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
  const errorDetail = typeof error === 'object' ? (error?.message || error?.code || JSON.stringify(error)) : String(error);
  console.error(`[Consult] ${operation} 실패: ${errorDetail}`, error);
}


// ConsultRequest → DB row 변환 (financial_profile AES-256-GCM 암호화 저장)
async function requestToRow(request: ConsultRequest) {
  const encryptedProfile = await encryptField(request.financialProfile || {});

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
    accepted_lawyer_ids: request.acceptedLawyerIds || [],
    rejection_notified: request.rejectionNotified || false,
    proposals: request.proposals || [],
    title: request.title || '',
    content: request.content || '',
    financial_profile: encryptedProfile,
    phone_consultation_requested: request.phoneConsultationRequested ?? false,
    safe_number: request.safeNumber || null,
    safe_number_assigned_at: request.safeNumberAssignedAt || null,
    safe_number_expires_at: request.safeNumberExpiresAt || null,
    entry_category: request.entryCategory || null,
    created_at: request.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// DB row → ConsultRequest 변환 (financial_profile 자동 복호화)
async function rowToRequest(row: any): Promise<ConsultRequest> {
  const decryptedProfile = await decryptField<any>(row.financial_profile);

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
    acceptedLawyerIds: row.accepted_lawyer_ids,
    rejectionNotified: row.rejection_notified,
    proposals: row.proposals,
    title: row.title,
    content: row.content,
    financialProfile: decryptedProfile || {},
    phoneConsultationRequested: row.phone_consultation_requested,
    safeNumber: row.safe_number,
    safeNumberAssignedAt: row.safe_number_assigned_at,
    safeNumberExpiresAt: row.safe_number_expires_at,
    entryCategory: row.entry_category,
    createdAt: row.created_at,
  };
}

// ── 상담 요청 (ConsultRequest) 관리 ──

export interface ConsultRequestFilter {
  clientId?: string;
  lawyerId?: string;
  includeOpen?: boolean;
  isAdmin?: boolean;
}

export async function loadConsultRequests(filter?: string | ConsultRequestFilter): Promise<ConsultRequest[]> {
  const options: ConsultRequestFilter = typeof filter === 'string' 
    ? { clientId: filter } 
    : (filter || {});

  // [ANTI-BOLA 보안 가드]
  // clientId, lawyerId, isAdmin 중 아무런 스코프도 제공되지 않은 경우,
  // 타인 상담 대량 유출(BOLA/IDOR)을 방지하기 위해 쿼리를 즉시 차단합니다.
  if (!options.clientId && !options.lawyerId && !options.isAdmin) {
    console.warn('[SECURITY Anti-BOLA] loadConsultRequests 호출 시 소유자 또는 역할 스코프가 지정되지 않아 쿼리가 차단되었습니다.');
    return [];
  }

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('consult_requests').select('*').order('created_at', { ascending: false });
      
      if (options.clientId) {
        query = query.eq('client_id', options.clientId);
      } else if (options.lawyerId) {
        if (options.includeOpen) {
          query = query.or(`selected_lawyer_id.eq.${options.lawyerId},accepted_lawyer_ids.cs.{${options.lawyerId}},and(status.eq.requested,request_type.eq.open)`);
        } else {
          query = query.or(`selected_lawyer_id.eq.${options.lawyerId},accepted_lawyer_ids.cs.{${options.lawyerId}}`);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        logSupabaseError('loadConsultRequests', error);
      } else if (data) {
        const mapped = await Promise.all(data.map(rowToRequest));
        return mapped.filter((req: ConsultRequest) => req.id !== 'req-1' && req.id !== 'req-2' && req.id !== 'req-3');
      }
    } catch (e) {
      logSupabaseError('loadConsultRequests (exception)', e);
    }
  }
  
  // LocalStorage Fallback (소유자 기반 스코프 필터링)
  const allRequests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  return allRequests
    .filter(r => {
      if (options.clientId) return r.clientId === options.clientId;
      if (options.lawyerId) {
        const isAssigned = r.selectedLawyerId === options.lawyerId || (r.acceptedLawyerIds || []).includes(options.lawyerId);
        const isOpen = options.includeOpen && r.status === 'requested' && r.requestType === 'open';
        return isAssigned || isOpen;
      }
      if (options.isAdmin) return true;
      return false;
    })
    .filter(r => r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3');
}

export async function saveConsultRequest(request: ConsultRequest): Promise<void> {
  // [SECURITY Zod Validation] 런타임 스키마 검증 및 XSS 태그 정제
  const validation = validateAndSanitizeConsultRequest(request);
  const safeRequest: ConsultRequest = validation.success && validation.data 
    ? ({ ...request, ...validation.data } as unknown as ConsultRequest) 
    : request;

  // Always save to localStorage (클라이언트 메모리/세션은 즉각적인 반응성을 위해 평문 객체 유지)
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  const idx = requests.findIndex(r => r.id === safeRequest.id);
  if (idx >= 0) requests[idx] = safeRequest;
  else requests.push(safeRequest);
  setLocalData(REQUESTS_STORAGE_KEY, requests);

  // Also persist to Supabase if configured (DB 전송 시 financial_profile AES-256-GCM 암호화)
  if (isSupabaseConfigured) {
    try {
      const row = await requestToRow(safeRequest);
      const { error } = await supabase.from('consult_requests').upsert(
        row,
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
      const payload = await Promise.all(requests.map(requestToRow));
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
  // [ANTI-BOLA 보안 가드]
  // 특정 상담 ID 목록이 제공되지 않은 경우, 전체 메시지 덤프를 방지하기 위해 빈 배열을 즉시 반환합니다.
  if (!requestIds || requestIds.length === 0) {
    return [];
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('consult_messages')
        .select('*')
        .in('consult_request_id', requestIds);
      
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
  return allMessages.filter(m => requestIds.includes(m.consultRequestId));
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
