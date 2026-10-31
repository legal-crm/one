// ============================================================
// 직원·권한 — 서버 구성원·권한·활동 기록 (RB-3·RB-4·RB-5·RB-10)
// 원본: office_members·office_custom_roles·office_audit_logs. 모든 변경은 서버 함수(활동 기록 남음).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, History, Lock, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import {
  getOfficeMfaPolicy, listOfficeAuditLogs, listOfficeCustomRoles, listOfficeMembers, offboardOfficeMember, saveOfficeCustomRole, setOfficeMfaPolicy, updateOfficeMember,
  type OfficeAuditLog, type OfficeCustomRole, type OfficeMember,
} from '../../../services/office/officeService';
import {
  OFFICE_ROLE_LABELS, PERMISSION_SCOPE_LABELS, permissionGroups, type OfficeMemberRole, type OfficeRole, type PermissionScope,
} from '../../../services/office/officePermissions';

interface Props {
  officeId: string;
  /** 직원·권한 관리 권한 (대표) */
  canManage: boolean;
}

const STATUS_LABEL: Record<OfficeMember['status'], string> = { active: '사용 중', suspended: '정지', left: '퇴사' };
const ACTION_LABEL: Record<string, string> = {
  'invite.create': '초대 링크 만듦', 'invite.accept': '초대 수락', 'invite.revoke': '초대 링크 만료',
  'member.update': '구성원 정보 변경', 'custom_role.save': '맞춤 역할 저장', 'case.create': '사건 만듦',
  'case.assign': '사건 담당 변경', 'case.trash': '사건 휴지통', 'case.restore': '사건 복구',
  'client_link.create': '의뢰인 연결 링크 만듦', 'client_link.accept': '의뢰인 계정 연결',
  'member.offboard': '퇴사 처리',
};
const ASSIGNABLE_ROLES: Array<Exclude<OfficeMemberRole, 'owner'>> = ['lawyer', 'consultant', 'clerk', 'accounting', 'custom'];

/** 직원 2단계 인증 필수 (RB-7, 기본 켬). 대표는 늘 필수 */
function MfaPolicyRow({ officeId }: { officeId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { void getOfficeMfaPolicy(officeId).then(r => setOn(r.ok ? r.data : true)); }, [officeId]);
  const change = async (v: boolean) => {
    const r = await setOfficeMfaPolicy(officeId, v);
    if (r.ok === false) { toast.error(r.message); return; }
    setOn(r.data);
    toast.success(r.data ? '직원도 2단계 인증을 해야 들어올 수 있어요.' : '직원 2단계 인증 필수를 껐어요. 대표는 계속 필수예요.');
  };
  return (
    <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <input type="checkbox" className="w-4 h-4 mt-0.5" disabled={on === null} checked={on !== false} onChange={e => void change(e.target.checked)} />
      <span><b>직원 2단계 인증 필수</b><span className="block text-xs text-slate-600">켜 두면 직원도 인증 앱 코드를 넣어야 사무소 자료를 볼 수 있어요. 대표는 늘 필수예요.</span></span>
    </label>
  );
}

function lastSeen(iso: string | null) {
  if (!iso) return '접속 기록 없음';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10 * 60_000) return '방금';
  if (diff < 24 * 3600_000) return `${Math.round(diff / 3600_000)}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function ScopeEditor({ baseRole, value, onChange, disabled }: {
  baseRole: OfficeRole; value: Record<string, PermissionScope>; onChange: (v: Record<string, PermissionScope>) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {permissionGroups().map(g => (
        <fieldset key={g.group} className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-black text-slate-700">{g.group}</legend>
          <div className="space-y-1.5">
            {g.items.map(p => {
              const current = value[p.key] ?? p.defaults[baseRole];
              return (
                <label key={p.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-800 flex items-center gap-1">
                    {p.lawyerOnly && <Lock className="w-3 h-3 text-slate-500" aria-label="변호사 전용" />}
                    {p.label}
                  </span>
                  <select
                    disabled={disabled || p.lawyerOnly}
                    value={current}
                    onChange={e => {
                      const next = { ...value };
                      if (e.target.value === p.defaults[baseRole]) delete next[p.key];
                      else next[p.key] = e.target.value as PermissionScope;
                      onChange(next);
                    }}
                    className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {(['none', 'assigned', 'all'] as PermissionScope[]).map(s => <option key={s} value={s}>{PERMISSION_SCOPE_LABELS[s]}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-[11px] text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" aria-hidden="true" />변호사 전용 권한(제안서·계약 발송, 보정서 확정, 공개 Q&A 답변)은 승인된 변호사 계정만 가지며 바꿀 수 없어요.</p>
    </div>
  );
}

export default function OfficeMembersPanel({ officeId, canManage }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [roles, setRoles] = useState<OfficeCustomRole[]>([]);
  const [logs, setLogs] = useState<OfficeAuditLog[]>([]);
  const [editing, setEditing] = useState<OfficeMember | null>(null);
  const [draftRole, setDraftRole] = useState<Exclude<OfficeMemberRole, 'owner'>>('consultant');
  const [draftCustomRoleId, setDraftCustomRoleId] = useState('');
  const [draftScopes, setDraftScopes] = useState<Record<string, PermissionScope>>({});
  const [draftSupervisor, setDraftSupervisor] = useState('');
  const [roleDraft, setRoleDraft] = useState<{ id?: string; name: string; baseRole: OfficeCustomRole['baseRole']; scopes: Record<string, PermissionScope> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    const [m, r] = await Promise.all([listOfficeMembers(officeId), listOfficeCustomRoles(officeId)]);
    if (!m.ok) { setError(m.message); setState('error'); return; }
    setMembers(m.data);
    if (r.ok) setRoles(r.data);
    if (canManage) {
      const l = await listOfficeAuditLogs(officeId, { limit: 100 });
      if (l.ok) setLogs(l.data);
    }
    setState('ready');
  }, [officeId, canManage]);

  useEffect(() => { void load(); }, [load]);

  const memberName = useMemo(() => {
    const map = new Map(members.map(m => [m.id, m.displayName || m.email || '이름 없음']));
    return (id: string | null) => (id ? map.get(id) || '알 수 없음' : '시스템');
  }, [members]);

  const lawyers = members.filter(m => m.status === 'active' && (m.role === 'owner' || m.role === 'lawyer'));

  const openEdit = (m: OfficeMember) => {
    setEditing(m);
    setDraftRole(m.role === 'owner' ? 'lawyer' : m.role);
    setDraftCustomRoleId(m.customRoleId || '');
    setDraftScopes(m.scopeOverrides || {});
    setDraftSupervisor(m.supervisingMemberId || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (draftRole === 'custom' && !draftCustomRoleId) { toast.error('맞춤 역할을 골라 주세요.'); return; }
    setBusy(true);
    const res = await updateOfficeMember(editing.id, {
      role: draftRole, customRoleId: draftRole === 'custom' ? draftCustomRoleId : undefined,
      scopeOverrides: draftScopes, supervisingMemberId: draftSupervisor || undefined,
    });
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('구성원 권한을 저장했어요.');
    setEditing(null);
    await load();
  };

  // 퇴사 처리 (RB-9): 맡던 사건·리드·업무를 넘겨받을 사람에게 옮기고 접속·업무폰을 끊는다
  const [offboarding, setOffboarding] = useState<OfficeMember | null>(null);
  const [handoverId, setHandoverId] = useState('');
  const [offboardReason, setOffboardReason] = useState('');
  const submitOffboard = async () => {
    if (!offboarding) return;
    if (!handoverId) { toast.error('일을 넘겨받을 사람을 골라 주세요.'); return; }
    setBusy(true);
    const res = await offboardOfficeMember(offboarding.id, handoverId, offboardReason);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`퇴사 처리했어요. 사건 ${res.data.cases}건 · 영업 리드 ${res.data.leads}건 · 업무 ${res.data.queue}건을 넘기고 업무폰 ${res.data.devices}대를 해지했어요.`);
    setOffboarding(null);
    await load();
  };

  const setStatus = async (m: OfficeMember, status: OfficeMember['status']) => {
    setBusy(true);
    const res = await updateOfficeMember(m.id, { status });
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(status === 'active' ? '다시 사용할 수 있게 했어요.' : status === 'suspended' ? '사용을 정지했어요. 로그인 세션도 끊었어요.' : '탈퇴 처리했어요.');
    await load();
  };

  const saveRole = async () => {
    if (!roleDraft) return;
    if (!roleDraft.name.trim()) { toast.error('역할 이름을 입력해 주세요.'); return; }
    setBusy(true);
    const res = await saveOfficeCustomRole(officeId, roleDraft);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('맞춤 역할을 저장했어요.');
    setRoleDraft(null);
    await load();
  };

  if (state === 'loading') {
    return (
      <section aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="h-5 w-40 rounded-lg bg-slate-100 animate-pulse" />
        {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-50 animate-pulse" />)}
      </section>
    );
  }
  if (state === 'error') {
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm text-rose-800"><p className="font-bold">구성원 목록을 불러오지 못했어요.</p><p className="mt-1">{error}</p></div>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-3 rounded-xl border border-rose-300 bg-white text-sm font-bold text-rose-700 whitespace-nowrap active:scale-[0.98]">
          <RefreshCw className="w-4 h-4 inline mr-1" aria-hidden="true" />다시 시도
        </button>
      </section>
    );
  }

  const editingBase: OfficeRole = draftRole === 'custom'
    ? (roles.find(r => r.id === draftCustomRoleId)?.baseRole || 'consultant')
    : draftRole;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <Users className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
        <h2 className="text-base font-black text-slate-900">사무소 구성원</h2>
        <span className="text-xs text-slate-600">사용 중 {members.filter(m => m.status === 'active').length}명 · 정지 {members.filter(m => m.status === 'suspended').length}명</span>
        {canManage && (
          <button type="button" onClick={() => setShowLogs(v => !v)} className="ml-auto min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">
            <History className="w-4 h-4 inline mr-1" aria-hidden="true" />{showLogs ? '구성원 보기' : '활동 기록'}
          </button>
        )}
      </header>

      {canManage && !showLogs && <MfaPolicyRow officeId={officeId} />}

      {showLogs ? (
        logs.length === 0 ? <p className="text-sm text-slate-500">아직 활동 기록이 없어요.</p> : (
          <ol className="divide-y divide-slate-100 text-xs max-h-[480px] overflow-y-auto">
            {logs.map(l => (
              <li key={l.id} className="py-2 flex flex-wrap gap-x-3">
                <span className="text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('ko-KR')}</span>
                <span className="font-semibold text-slate-800">{memberName(l.actorMemberId)}</span>
                <span className="text-slate-700">{ACTION_LABEL[l.action] || l.action}</span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <ul className="space-y-2">
          {members.map(m => (
            <li key={m.id} className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{m.displayName || m.email || '이름 없음'}</p>
                <p className="text-xs text-slate-600 truncate">{m.email} · 마지막 접속 {lastSeen(m.lastActiveAt)}</p>
              </div>
              <span className="rounded-lg bg-[#1E3A5F]/10 px-2 py-0.5 text-xs font-bold text-[#1E3A5F]">
                {m.role === 'custom' ? (roles.find(r => r.id === m.customRoleId)?.name || OFFICE_ROLE_LABELS.custom) : OFFICE_ROLE_LABELS[m.role]}
              </span>
              {m.lawyerId && m.role !== 'consultant' && <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 flex items-center gap-1"><ShieldCheck className="w-3 h-3" aria-hidden="true" />변호사</span>}
              <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${m.status === 'active' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800'}`}>{STATUS_LABEL[m.status]}</span>
              {canManage && m.role !== 'owner' && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => openEdit(m)} className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">권한</button>
                  {m.status === 'active'
                    ? <button type="button" disabled={busy} onClick={() => void setStatus(m, 'suspended')} className="min-h-[44px] px-3 rounded-xl border border-amber-300 text-xs font-bold text-amber-800 whitespace-nowrap active:scale-[0.98]">정지</button>
                    : <button type="button" disabled={busy} onClick={() => void setStatus(m, 'active')} className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">다시 사용</button>}
                  {m.status !== 'left' && <button type="button" disabled={busy} onClick={() => { setOffboarding(m); setHandoverId(''); setOffboardReason(''); }} className="min-h-[44px] px-3 rounded-xl border border-rose-300 text-xs font-bold text-rose-700 whitespace-nowrap active:scale-[0.98]">퇴사 처리</button>}
                </div>
              )}
            </li>
          ))}
          {members.length <= 1 && (
            <li className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">
              아직 직원이 없어요. 아래 '직원 초대'에서 초대 링크를 만들어 보내 주세요.
            </li>
          )}
        </ul>
      )}

      {offboarding && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="offboard-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg space-y-4">
            <h3 id="offboard-title" className="text-base font-black text-slate-900">{offboarding.displayName || offboarding.email || '구성원'} 퇴사 처리</h3>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
              <li>맡던 사건·영업 리드·업무를 넘겨받을 사람에게 옮겨요. 사건의 담당 변호사 자리는 변호사에게만 넘어가고, 직원에게 넘기면 담당 변호사 칸이 비어요.</li>
              <li>이 사람의 접속을 모두 끊고 연결된 업무폰을 해지해요.</li>
              <li>활동 기록은 그대로 남고, 퇴사 처리는 되돌릴 수 없어요. 다시 함께하려면 새로 초대해 주세요.</li>
            </ul>
            <label className="block text-xs font-semibold text-slate-700">일을 넘겨받을 사람
              <select value={handoverId} onChange={e => setHandoverId(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                <option value="">고르세요</option>
                {members.filter(x => x.id !== offboarding.id && x.status === 'active').map(x => (
                  <option key={x.id} value={x.id}>{x.displayName || x.email || '이름 없음'} · {OFFICE_ROLE_LABELS[x.role as OfficeRole] || x.role}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">사유 (선택, 활동 기록에 남아요)
              <textarea value={offboardReason} maxLength={200} rows={2} onChange={e => setOffboardReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOffboarding(null)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">취소</button>
              <button type="button" disabled={busy || !handoverId} onClick={() => void submitOffboard()} className="min-h-[44px] px-4 rounded-xl bg-rose-700 text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '처리 중…' : '퇴사 처리'}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 p-4 space-y-3">
          <p className="text-sm font-black text-slate-900">{editing.displayName || editing.email} 권한</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-700">역할
              <select value={draftRole} onChange={e => setDraftRole(e.target.value as any)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                {ASSIGNABLE_ROLES.filter(r => r !== 'lawyer' || !!editing.lawyerId).map(r => <option key={r} value={r}>{OFFICE_ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            {draftRole === 'custom' ? (
              <label className="text-xs font-semibold text-slate-700">맞춤 역할
                <select value={draftCustomRoleId} onChange={e => setDraftCustomRoleId(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="">고르세요</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-xs font-semibold text-slate-700">감독 변호사
                <select value={draftSupervisor} onChange={e => setDraftSupervisor(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="">지정 안 함</option>
                  {lawyers.filter(l => l.id !== editing.id).map(l => <option key={l.id} value={l.id}>{l.displayName || l.email}</option>)}
                </select>
              </label>
            )}
          </div>
          {!editing.lawyerId && <p className="text-[11px] text-slate-600">담당 변호사 역할은 마이김변 승인을 받은 변호사 계정만 받을 수 있어요.</p>}
          <p className="text-xs font-bold text-slate-700">이 사람만 범위 바꾸기 (기본값과 다를 때만 저장)</p>
          <ScopeEditor baseRole={editingBase} value={draftScopes} onChange={setDraftScopes} disabled={busy} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">취소</button>
            <button type="button" disabled={busy} onClick={() => void saveEdit()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      )}

      {canManage && !showLogs && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900">맞춤 역할</h3>
            <button type="button" onClick={() => setRoleDraft({ name: '', baseRole: 'consultant', scopes: {} })} className="ml-auto min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">새 맞춤 역할</button>
          </div>
          {roles.length === 0 && !roleDraft && <p className="text-xs text-slate-500">기본 역할(상담·사무·경리)을 복사해 범위를 고친 역할을 만들 수 있어요.</p>}
          <ul className="flex flex-wrap gap-2">
            {roles.map(r => (
              <li key={r.id}>
                <button type="button" onClick={() => setRoleDraft({ id: r.id, name: r.name, baseRole: r.baseRole, scopes: r.scopes })} className="min-h-[44px] px-3 rounded-xl bg-slate-100 text-xs font-bold text-slate-800 whitespace-nowrap active:scale-[0.98]">
                  {r.name} · {OFFICE_ROLE_LABELS[r.baseRole]} 바탕
                </button>
              </li>
            ))}
          </ul>
          {roleDraft && (
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-700">역할 이름
                  <input value={roleDraft.name} maxLength={30} onChange={e => setRoleDraft(d => d && ({ ...d, name: e.target.value }))} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">바탕 역할
                  <select value={roleDraft.baseRole} onChange={e => setRoleDraft(d => d && ({ ...d, baseRole: e.target.value as any, scopes: {} }))} className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                    {(['consultant', 'clerk', 'accounting', 'lawyer'] as const).map(r => <option key={r} value={r}>{OFFICE_ROLE_LABELS[r]}</option>)}
                  </select>
                </label>
              </div>
              <ScopeEditor baseRole={roleDraft.baseRole} value={roleDraft.scopes} onChange={s => setRoleDraft(d => d && ({ ...d, scopes: s }))} disabled={busy} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRoleDraft(null)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">취소</button>
                <button type="button" disabled={busy} onClick={() => void saveRole()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">저장</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
