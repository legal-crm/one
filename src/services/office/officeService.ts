// ============================================================
// 사무소·구성원·초대 서비스 (RB-1·RB-2·RB-3·RB-5·RB-10)
// 원본은 서버(offices·office_members·office_invites·office_audit_logs). 브라우저 저장 없음.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { OfficeMemberRole, PermissionScope } from './officePermissions';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from './rpcResult';

export interface OfficeContext {
  officeId: string;
  officeName: string;
  memberId: string;
  role: OfficeMemberRole;
  customRoleId: string | null;
  isVerifiedLawyer: boolean;
  lawyerId: string | null;
  permissions: Record<string, PermissionScope>;
}

export interface OfficeMember {
  id: string;
  officeId: string;
  userId: string;
  lawyerId: string | null;
  displayName: string;
  email: string | null;
  role: OfficeMemberRole;
  customRoleId: string | null;
  scopeOverrides: Record<string, PermissionScope>;
  supervisingMemberId: string | null;
  status: 'active' | 'suspended' | 'left';
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface OfficeInvite {
  id: string;
  role: OfficeMemberRole;
  email: string | null;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export interface OfficeAuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  actorMemberId: string | null;
  createdAt: string;
}

export interface OfficeCustomRole {
  id: string;
  name: string;
  baseRole: Exclude<OfficeMemberRole, 'owner' | 'custom'>;
  scopes: Record<string, PermissionScope>;
}

const mapMember = (r: any): OfficeMember => ({
  id: r.id, officeId: r.office_id, userId: r.user_id, lawyerId: r.lawyer_id ?? null,
  displayName: r.display_name || '', email: r.email ?? null, role: r.role, customRoleId: r.custom_role_id ?? null,
  scopeOverrides: r.scope_overrides || {}, supervisingMemberId: r.supervising_member_id ?? null,
  status: r.status, joinedAt: r.joined_at, lastActiveAt: r.last_active_at ?? null,
});

/** 내 사무소 목록·역할·권한표 (대표 사무소가 먼저). 빈 배열 = 어느 사무소에도 속하지 않음 */
export async function loadMyOfficeContexts(): Promise<RpcResult<OfficeContext[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('my_office_context');
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      officeId: r.office_id, officeName: r.office_name || '', memberId: r.member_id, role: r.role,
      customRoleId: r.custom_role_id ?? null, isVerifiedLawyer: r.is_verified_lawyer === true,
      lawyerId: r.lawyer_id ?? null, permissions: r.permissions || {},
    })),
  };
}

export async function listOfficeMembers(officeId: string): Promise<RpcResult<OfficeMember[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_members').select('*').eq('office_id', officeId).order('joined_at');
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapMember) };
}

export async function listOfficeInvites(officeId: string): Promise<RpcResult<OfficeInvite[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_invites')
    .select('id, role, email, expires_at, created_at, used_at, revoked_at')
    .eq('office_id', officeId).order('created_at', { ascending: false }).limit(100);
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({ id: r.id, role: r.role, email: r.email, expiresAt: r.expires_at, createdAt: r.created_at, usedAt: r.used_at, revokedAt: r.revoked_at })),
  };
}

export async function createOfficeInvite(params: {
  officeId: string; role: Exclude<OfficeMemberRole, 'owner'>; email?: string; ttlHours: 24 | 48 | 168; customRoleId?: string;
}): Promise<RpcResult<{ inviteId: string; token: string; expiresAt: string; url: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_office_invite', {
    p_office_id: params.officeId, p_role: params.role, p_email: params.email || null,
    p_ttl_hours: params.ttlHours, p_custom_role_id: params.customRoleId || null,
  });
  if (error) return toRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  const url = `${window.location.origin}/?role=lawyer&officeInvite=${encodeURIComponent(row.token)}`;
  return { ok: true, data: { inviteId: row.invite_id, token: row.token, expiresAt: row.expires_at, url } };
}

export async function peekOfficeInvite(token: string): Promise<RpcResult<{ officeName: string; role: OfficeMemberRole; expiresAt: string; emailRestricted: boolean; valid: boolean } | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('peek_office_invite', { p_token: token });
  if (error) return toRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: true, data: null };
  return { ok: true, data: { officeName: row.office_name || '', role: row.role, expiresAt: row.expires_at, emailRestricted: row.email_restricted, valid: row.valid === true } };
}

export async function acceptOfficeInvite(token: string, displayName: string): Promise<RpcResult<{ officeId: string; role: OfficeMemberRole }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('accept_office_invite', { p_token: token, p_display_name: displayName });
  if (error) return toRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, data: { officeId: row.office_id, role: row.role } };
}

export async function revokeOfficeInvite(inviteId: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('revoke_office_invite', { p_invite_id: inviteId });
  return error ? toRpcError(error) : { ok: true, data: true };
}

export async function updateOfficeMember(memberId: string, patch: {
  role?: Exclude<OfficeMemberRole, 'owner'>; status?: OfficeMember['status'];
  scopeOverrides?: Record<string, PermissionScope>; customRoleId?: string; supervisingMemberId?: string;
}): Promise<RpcResult<OfficeMember>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('update_office_member', {
    p_member_id: memberId, p_role: patch.role ?? null, p_status: patch.status ?? null,
    p_scope_overrides: patch.scopeOverrides ?? null, p_custom_role_id: patch.customRoleId ?? null,
    p_supervising_member_id: patch.supervisingMemberId ?? null,
  });
  if (error) return toRpcError(error);
  return { ok: true, data: mapMember(data) };
}

export async function listOfficeCustomRoles(officeId: string): Promise<RpcResult<OfficeCustomRole[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_custom_roles').select('id, name, base_role, scopes').eq('office_id', officeId).order('name');
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ id: r.id, name: r.name, baseRole: r.base_role, scopes: r.scopes || {} })) };
}

export async function saveOfficeCustomRole(officeId: string, role: { id?: string; name: string; baseRole: OfficeCustomRole['baseRole']; scopes: Record<string, PermissionScope> }): Promise<RpcResult<OfficeCustomRole>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('save_office_custom_role', {
    p_office_id: officeId, p_id: role.id || null, p_name: role.name, p_base_role: role.baseRole, p_scopes: role.scopes,
  });
  if (error) return toRpcError(error);
  return { ok: true, data: { id: data.id, name: data.name, baseRole: data.base_role, scopes: data.scopes || {} } };
}

export async function listOfficeAuditLogs(officeId: string, opts: { limit?: number; before?: string } = {}): Promise<RpcResult<OfficeAuditLog[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('office_audit_logs').select('id, action, target_type, target_id, detail, actor_member_id, created_at')
    .eq('office_id', officeId).order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data, error } = await q;
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({ id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, detail: r.detail || {}, actorMemberId: r.actor_member_id, createdAt: r.created_at })),
  };
}

/** 사무소 활동 기록 남기기 (내보내기·열람 등 화면에서 생기는 일) */
export async function logOfficeEvent(officeId: string, action: string, target?: { type?: string; id?: string }, detail: Record<string, unknown> = {}): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('office_log', {
    p_office_id: officeId, p_action: action, p_target_type: target?.type ?? null, p_target_id: target?.id ?? null, p_detail: detail,
  });
  return error ? toRpcError(error) : { ok: true, data: true };
}

/** 마지막 접속 표시 (5분에 한 번만 서버가 갱신) */
export async function touchOfficeMember(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('touch_office_member');
  if (error) console.warn('[office] 마지막 접속 갱신 실패:', error.message);
}
