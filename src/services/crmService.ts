import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { 
  StaffMember, StaffRole, CrmActivityLog, CrmActivityType,
  CrmNote, CrmNoteCategory, CrmClientExtension
} from '../types';
import { DEFAULT_REHAB_DOCUMENTS } from '../types';

// ============================================================
// CRM Supabase Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작
// ============================================================

const CRM_STORAGE_KEY = 'legal_crm_data';
const STAFF_STORAGE_KEY = 'legal_crm_staff';

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

// ── CRM Client Extension 관리 ──

export type CrmDataStore = Record<string, CrmClientExtension>;

export async function loadCrmData(): Promise<CrmDataStore> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('crm_clients')
        .select('*');
      if (!error && data) {
        const store: CrmDataStore = {};
        data.forEach((row: any) => {
          store[row.client_id] = {
            crmStatus: row.crm_status || 'requested',
            assignedLawyerId: row.assigned_lawyer_id,
            assignedConsultantId: row.assigned_consultant_id,
            assignedStaffId: row.assigned_staff_id,
            documents: row.documents || [],
            notes: row.notes || [],
            activities: row.activities || [],
            contractDate: row.contract_date,
            contractAmount: row.contract_amount,
            lastActivityAt: row.last_activity_at || new Date().toISOString(),
          };
        });
        return store;
      }
    } catch (e) {
      console.warn('[CRM] Supabase load failed, falling back to localStorage', e);
    }
  }
  return getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
}

export async function saveCrmClient(clientId: string, ext: CrmClientExtension): Promise<void> {
  // Always save to localStorage
  const store = getLocalData<CrmDataStore>(CRM_STORAGE_KEY, {});
  store[clientId] = ext;
  setLocalData(CRM_STORAGE_KEY, store);

  // Also persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('crm_clients').upsert({
        client_id: clientId,
        crm_status: ext.crmStatus,
        assigned_lawyer_id: ext.assignedLawyerId,
        assigned_consultant_id: ext.assignedConsultantId,
        assigned_staff_id: ext.assignedStaffId,
        documents: ext.documents,
        notes: ext.notes,
        activities: ext.activities,
        contract_date: ext.contractDate,
        contract_amount: ext.contractAmount,
        last_activity_at: ext.lastActivityAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });
    } catch (e) {
      console.warn('[CRM] Supabase save failed', e);
    }
  }
}

// ── Staff (직원) 관리 ──

export async function loadStaffMembers(): Promise<StaffMember[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          role: row.role as StaffRole,
          email: row.email,
          phone: row.phone,
          avatar: row.avatar,
          isActive: row.is_active ?? true,
          assignedCount: row.assigned_count || 0,
          createdAt: row.created_at,
          permissions: row.permissions || {},
        }));
      }
    } catch (e) {
      console.warn('[CRM] Supabase staff load failed', e);
    }
  }
  return getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
}

export async function saveStaffMember(member: StaffMember): Promise<void> {
  // localStorage
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  const idx = members.findIndex(m => m.id === member.id);
  if (idx >= 0) members[idx] = member;
  else members.push(member);
  setLocalData(STAFF_STORAGE_KEY, members);

  // Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').upsert({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
        phone: member.phone,
        avatar: member.avatar,
        is_active: member.isActive,
        assigned_count: member.assignedCount,
        permissions: member.permissions,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[CRM] Supabase staff save failed', e);
    }
  }
}

export async function deleteStaffMember(memberId: string): Promise<void> {
  const members = getLocalData<StaffMember[]>(STAFF_STORAGE_KEY, []);
  setLocalData(STAFF_STORAGE_KEY, members.filter(m => m.id !== memberId));

  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_members').delete().eq('id', memberId);
    } catch (e) {
      console.warn('[CRM] Supabase staff delete failed', e);
    }
  }
}

// ── Activity Log 헬퍼 ──

export function createActivityLog(
  clientId: string,
  actorId: string,
  actorName: string,
  actorRole: StaffRole,
  type: CrmActivityType,
  description: string,
  metadata?: Record<string, string>
): CrmActivityLog {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    clientId,
    actorId,
    actorName,
    actorRole,
    type,
    description,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ── CRM Note 헬퍼 ──

export function createCrmNote(
  category: CrmNoteCategory,
  content: string,
  authorId: string,
  authorName: string
): CrmNote {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    category,
    content,
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
  };
}

// ── CrmClientExtension 초기화 헬퍼 ──

export function createDefaultCrmExtension(clientId: string): CrmClientExtension {
  const docs = DEFAULT_REHAB_DOCUMENTS;
  return {
    crmStatus: 'requested',
    documents: (docs || []).map((d: any) => ({ ...d })),
    notes: [],
    activities: [{
      id: `act-init-${Date.now()}`,
      clientId,
      actorId: 'system',
      actorName: '시스템',
      actorRole: 'OWNER' as StaffRole,
      type: 'created' as CrmActivityType,
      description: '상담 신청이 접수되었습니다.',
      createdAt: new Date().toISOString(),
    }],
    lastActivityAt: new Date().toISOString(),
  };
}
