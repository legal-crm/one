// ============================================================
// 배정 (RB-8, 20261101003300): 업무량·미배정 사건·리드, 자동 배정 규칙, 일괄 배정, 업무 넘기기
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from './rpcResult';
import { loadOfficeSettings, saveOfficeSettings } from './officeSettingsService';

export type CaseLawyerRule = 'none' | 'owner' | 'least_loaded';
export type SimpleRule = 'none' | 'least_loaded';
export interface AssignmentRules {
  case_lawyer: CaseLawyerRule;
  case_staff: SimpleRule;
  lead: SimpleRule;
  lawyer_pool?: string[];
  staff_pool?: string[];
  lead_pool?: string[];
}
export const DEFAULT_ASSIGNMENT_RULES: AssignmentRules = { case_lawyer: 'none', case_staff: 'none', lead: 'least_loaded' };

export interface MemberLoad { memberId: string; name: string; role: string; casesLawyer: number; casesStaff: number; leadsOpen: number }
export interface UnassignedCase { id: string; title: string; stage: string; stageLabel: string; caseType: string; createdAt: string }
export interface UnassignedLead { id: string; name: string; status: string; source: string; createdAt: string }
export interface AssignmentOverview {
  canCases: boolean; canLeads: boolean; rules: AssignmentRules;
  members: MemberLoad[]; unassignedCases: UnassignedCase[]; unassignedLeads: UnassignedLead[];
}

export async function loadAssignmentOverview(officeId: string): Promise<RpcResult<AssignmentOverview>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_assignment_overview', { p_office_id: officeId });
  if (error) return toRpcError(error);
  const d = (data || {}) as any;
  return {
    ok: true,
    data: {
      canCases: !!d.can_cases,
      canLeads: !!d.can_leads,
      rules: { ...DEFAULT_ASSIGNMENT_RULES, ...(d.rules || {}) },
      members: (d.members || []).map((m: any) => ({
        memberId: m.member_id, name: m.name || '이름 없음', role: m.role,
        casesLawyer: Number(m.cases_lawyer) || 0, casesStaff: Number(m.cases_staff) || 0, leadsOpen: Number(m.leads_open) || 0,
      })),
      unassignedCases: (d.unassigned_cases || []).map((c: any) => ({ id: c.id, title: c.title || '', stage: c.stage, stageLabel: c.stage_label || c.stage, caseType: c.case_type, createdAt: c.created_at })),
      unassignedLeads: (d.unassigned_leads || []).map((l: any) => ({ id: l.id, name: l.name || '', status: l.status, source: l.source || '', createdAt: l.created_at })),
    },
  };
}

export async function saveAssignmentRules(officeId: string, rules: AssignmentRules): Promise<RpcResult<true>> {
  const cur = await loadOfficeSettings<Record<string, unknown>>(officeId, 'assignment');
  const r = await saveOfficeSettings(officeId, 'assignment', rules as unknown as Record<string, unknown>, cur.ok ? cur.data?.version : undefined);
  if (r.ok === false) return { ok: false, code: r.code, message: r.message };
  return { ok: true, data: true };
}

export async function bulkAssign(officeId: string, kind: 'case_lawyer' | 'case_staff' | 'lead', ids: string[], memberId: string): Promise<RpcResult<number>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_bulk_assign', { p_office_id: officeId, p_kind: kind, p_ids: ids, p_member_id: memberId });
  if (error) return toRpcError(error);
  return { ok: true, data: Number(data) || 0 };
}

export async function transferWork(officeId: string, fromMemberId: string, toMemberId: string, reason: string): Promise<RpcResult<{ cases: number; leads: number; lawyerSeatsEmptied: boolean }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_transfer_work', { p_office_id: officeId, p_from: fromMemberId, p_to: toMemberId, p_reason: reason });
  if (error) return toRpcError(error);
  const d = (data || {}) as any;
  return { ok: true, data: { cases: (Number(d.cases_lawyer) || 0) + (Number(d.cases_staff) || 0), leads: Number(d.leads) || 0, lawyerSeatsEmptied: false } };
}
