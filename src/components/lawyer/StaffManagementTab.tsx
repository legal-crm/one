import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Shield, UserPlus, UserMinus, Clock, CheckCircle2, XCircle,
  AlertTriangle, ArrowRightLeft, Search, Filter, ChevronDown, ChevronUp,
  Briefcase, Activity, Mail, Phone, RotateCcw, Trash2, ShieldCheck
} from 'lucide-react';
import type {
  ConsultRequest, User, StaffMember, StaffRole, StaffMemberStatus,
  StaffActivityLog, StaffActivityType, CrmClientExtension, StaffPermissions
} from '../../types';
import {
  STAFF_ROLE_CONFIG, DEFAULT_PERMISSIONS
} from '../../types';
import {
  loadStaffMembers, saveStaffMember, deleteStaffMember,
  approveStaffMember, rejectStaffMember, suspendStaffMember,
  reactivateStaffMember, removeStaffMemberWithReason,
  createStaffActivityLog, loadStaffActivityLogs, saveStaffActivityLog,
  loadCrmData, saveCrmClient,
  type CrmDataStore
} from '../../services/crmService';

// ── 활동 타입 한글 라벨 ──
const ACTIVITY_TYPE_LABELS: Record<StaffActivityType, { label: string; emoji: string; color: string }> = {
  staff_invited:          { label: '직원 초대',     emoji: '📨', color: 'text-blue-400' },
  staff_approved:         { label: '가입 승인',     emoji: '✅', color: 'text-emerald-400' },
  staff_rejected:         { label: '가입 거부',     emoji: '❌', color: 'text-red-400' },
  staff_suspended:        { label: '활동 정지',     emoji: '⚠️', color: 'text-amber-400' },
  staff_removed:          { label: '강제 탈퇴',     emoji: '🚫', color: 'text-red-500' },
  staff_reactivated:      { label: '활동 재개',     emoji: '🔄', color: 'text-emerald-400' },
  case_assigned:          { label: '사건 배정',     emoji: '📋', color: 'text-blue-400' },
  case_transferred:       { label: '사건 이관',     emoji: '🔀', color: 'text-purple-400' },
  case_bulk_transferred:  { label: '일괄 이관',     emoji: '📦', color: 'text-amber-400' },
  permission_changed:     { label: '권한 변경',     emoji: '🔑', color: 'text-pink-400' },
  role_changed:           { label: '역할 변경',     emoji: '🏷️', color: 'text-indigo-400' },
};

interface StaffManagementTabProps {
  requests: ConsultRequest[];
  lawyers: User[];
  activeLawyer: User;
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
}

type SubSection = 'pending' | 'active' | 'cases' | 'logs';

export default function StaffManagementTab({ requests, lawyers, activeLawyer, setRequests }: StaffManagementTabProps) {
  // ── Core State ──
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<StaffActivityLog[]>([]);
  const [crmData, setCrmData] = useState<CrmDataStore>({});
  const [activeSection, setActiveSection] = useState<SubSection>('active');

  // ── 초대 모달 ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('CONSULTANT');

  // ── 강퇴 모달 ──
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState('');
  const [removeReason, setRemoveReason] = useState('');

  // ── 일괄 이관 모달 ──
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkFromId, setBulkFromId] = useState('');
  const [bulkToId, setBulkToId] = useState('');

  // ── 검색/필터 ──
  const [staffSearch, setStaffSearch] = useState('');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logStaffFilter, setLogStaffFilter] = useState<string>('all');

  // ── 초기 로드 ──
  useEffect(() => {
    loadStaffMembers().then(members => {
      // 기존 데이터 호환: status 필드 없는 직원에게 기본값 추가
      const normalized = members.map(m => ({
        ...m,
        status: (m.status || (m.isActive ? 'active' : 'pending')) as StaffMemberStatus,
      }));
      setStaffMembers(normalized);
    });
    setActivityLogs(loadStaffActivityLogs());
    loadCrmData().then(setCrmData);
  }, []);

  // ── 파생 데이터 ──
  const pendingStaff = useMemo(() => staffMembers.filter(m => m.status === 'pending'), [staffMembers]);
  const activeStaff = useMemo(() => staffMembers.filter(m => m.status === 'active'), [staffMembers]);
  const suspendedStaff = useMemo(() => staffMembers.filter(m => m.status === 'suspended'), [staffMembers]);
  const removedStaff = useMemo(() => staffMembers.filter(m => m.status === 'removed'), [staffMembers]);
  const allManagedStaff = useMemo(() => [...activeStaff, ...suspendedStaff], [activeStaff, suspendedStaff]);

  // 직원별 담당 사건 수
  const staffCaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    staffMembers.forEach(m => { counts[m.id] = 0; });
    requests.forEach(r => {
      const ext = crmData[r.id];
      if (ext) {
        if (ext.assignedLawyerId && counts[ext.assignedLawyerId] !== undefined) counts[ext.assignedLawyerId]++;
        if (ext.assignedConsultantId && counts[ext.assignedConsultantId] !== undefined) counts[ext.assignedConsultantId]++;
        if (ext.assignedStaffId && counts[ext.assignedStaffId] !== undefined) counts[ext.assignedStaffId]++;
      }
    });
    return counts;
  }, [staffMembers, requests, crmData]);

  const unassignedCount = useMemo(() => {
    return requests.filter(r => {
      const ext = crmData[r.id];
      return !ext || (!ext.assignedLawyerId && !ext.assignedConsultantId && !ext.assignedStaffId);
    }).length;
  }, [requests, crmData]);

  // ── 로그 기록 헬퍼 ──
  const recordActivity = (staffId: string, staffName: string, type: StaffActivityType, description: string, metadata?: Record<string, string>) => {
    const log = createStaffActivityLog(staffId, staffName, activeLawyer.id, activeLawyer.name, type, description, metadata);
    saveStaffActivityLog(log);
    setActivityLogs(prev => [log, ...prev]);
  };

  // ── 핸들러: 직원 초대 ──
  const handleInviteStaff = async () => {
    if (!inviteName.trim()) return;
    const newStaff: StaffMember = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: inviteName.trim(),
      role: inviteRole,
      email: inviteEmail.trim() || undefined,
      phone: invitePhone.trim() || undefined,
      isActive: false,
      assignedCount: 0,
      createdAt: new Date().toISOString(),
      permissions: DEFAULT_PERMISSIONS[inviteRole],
      status: 'pending',
      invitedBy: activeLawyer.id,
    };
    await saveStaffMember(newStaff);
    setStaffMembers(prev => [...prev, newStaff]);
    recordActivity(newStaff.id, newStaff.name, 'staff_invited', `${newStaff.name}님을 ${STAFF_ROLE_CONFIG[inviteRole].label}(으)로 초대했습니다.`);
    setShowInviteModal(false);
    setInviteName(''); setInviteEmail(''); setInvitePhone(''); setInviteRole('CONSULTANT');
  };

  // ── 핸들러: 승인 ──
  const handleApprove = async (member: StaffMember) => {
    await approveStaffMember(member.id);
    setStaffMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'active' as StaffMemberStatus, isActive: true, approvedAt: new Date().toISOString() } : m));
    recordActivity(member.id, member.name, 'staff_approved', `${member.name}님의 가입을 승인했습니다.`);
  };

  // ── 핸들러: 거부 ──
  const handleReject = async (member: StaffMember) => {
    if (!confirm(`${member.name}님의 가입 요청을 거부하시겠습니까?`)) return;
    await rejectStaffMember(member.id);
    setStaffMembers(prev => prev.filter(m => m.id !== member.id));
    recordActivity(member.id, member.name, 'staff_rejected', `${member.name}님의 가입을 거부했습니다.`);
  };

  // ── 핸들러: 정지 ──
  const handleSuspend = async (member: StaffMember) => {
    if (!confirm(`${member.name}님의 활동을 정지하시겠습니까? 해당 직원의 CRM 접근이 즉시 차단됩니다.`)) return;
    await suspendStaffMember(member.id);
    setStaffMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'suspended' as StaffMemberStatus, isActive: false } : m));
    recordActivity(member.id, member.name, 'staff_suspended', `${member.name}님의 활동을 정지했습니다.`);
  };

  // ── 핸들러: 재활성화 ──
  const handleReactivate = async (member: StaffMember) => {
    await reactivateStaffMember(member.id);
    setStaffMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'active' as StaffMemberStatus, isActive: true } : m));
    recordActivity(member.id, member.name, 'staff_reactivated', `${member.name}님의 활동을 재개했습니다.`);
  };

  // ── 핸들러: 강제 탈퇴 ──
  const handleRemove = async () => {
    if (!removeTargetId || !removeReason.trim()) return;
    const target = staffMembers.find(m => m.id === removeTargetId);
    if (!target) return;
    await removeStaffMemberWithReason(removeTargetId, removeReason.trim());
    setStaffMembers(prev => prev.map(m => m.id === removeTargetId ? { ...m, status: 'removed' as StaffMemberStatus, isActive: false, removedAt: new Date().toISOString(), removalReason: removeReason.trim() } : m));
    recordActivity(removeTargetId, target.name, 'staff_removed', `${target.name}님을 강제 탈퇴 처리했습니다. 사유: ${removeReason.trim()}`);
    setShowRemoveModal(false);
    setRemoveTargetId(''); setRemoveReason('');

    // 담당 사건이 있으면 일괄 이관 유도
    if ((staffCaseCounts[removeTargetId] || 0) > 0) {
      setBulkFromId(removeTargetId);
      setShowBulkTransferModal(true);
    }
  };

  // ── 핸들러: 일괄 이관 ──
  const handleBulkTransfer = async () => {
    if (!bulkFromId || !bulkToId || bulkFromId === bulkToId) return;
    const fromStaff = staffMembers.find(m => m.id === bulkFromId);
    const toStaff = staffMembers.find(m => m.id === bulkToId);
    if (!fromStaff || !toStaff) return;

    let transferredCount = 0;
    const updatedCrmData = { ...crmData };

    requests.forEach(r => {
      const ext = updatedCrmData[r.id];
      if (ext) {
        let changed = false;
        const updatedExt = { ...ext };
        if (ext.assignedLawyerId === bulkFromId) { updatedExt.assignedLawyerId = bulkToId; changed = true; }
        if (ext.assignedConsultantId === bulkFromId) { updatedExt.assignedConsultantId = bulkToId; changed = true; }
        if (ext.assignedStaffId === bulkFromId) { updatedExt.assignedStaffId = bulkToId; changed = true; }
        if (changed) {
          updatedCrmData[r.id] = updatedExt;
          saveCrmClient(r.id, updatedExt);
          transferredCount++;
        }
      }
    });

    setCrmData(updatedCrmData);
    recordActivity(bulkFromId, fromStaff.name, 'case_bulk_transferred',
      `${fromStaff.name}의 담당 사건 ${transferredCount}건을 ${toStaff.name}에게 일괄 이관했습니다.`,
      { fromId: bulkFromId, toId: bulkToId, count: String(transferredCount) });
    
    setShowBulkTransferModal(false);
    setBulkFromId(''); setBulkToId('');
    alert(`${transferredCount}건의 사건이 ${toStaff.name}에게 성공적으로 이관되었습니다.`);
  };

  // ── 필터된 직원 목록 ──
  const filteredActiveStaff = useMemo(() => {
    return allManagedStaff.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                          (m.email || '').toLowerCase().includes(staffSearch.toLowerCase());
      return matchSearch;
    });
  }, [allManagedStaff, staffSearch]);

  // ── 필터된 활동 로그 ──
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const matchType = logFilter === 'all' || log.type === logFilter;
      const matchStaff = logStaffFilter === 'all' || log.staffId === logStaffFilter;
      return matchType && matchStaff;
    });
  }, [activityLogs, logFilter, logStaffFilter]);

  // ── 역할 뱃지 렌더러 ──
  const renderRoleBadge = (role: StaffRole) => {
    const cfg = STAFF_ROLE_CONFIG[role];
    return (
      <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
        {cfg.label}
      </span>
    );
  };

  // ── 상태 뱃지 렌더러 ──
  const renderStatusBadge = (status: StaffMemberStatus) => {
    switch (status) {
      case 'active':
        return <span className="text-emerald-500 text-[12px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 정상</span>;
      case 'pending':
        return <span className="text-amber-400 text-[12px] font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 대기</span>;
      case 'suspended':
        return <span className="text-amber-500 text-[12px] font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 정지</span>;
      case 'removed':
        return <span className="text-red-400 text-[12px] font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> 탈퇴</span>;
    }
  };

  // ── 시간 포맷 ──
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── 페이지 헤더 ── */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand" />
            <span>사용자 관리 (Admin)</span>
          </h3>
          <p className="text-xs text-slate-500">사무실 직원의 접속 권한을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors self-start md:self-center"
        >
          <UserPlus className="w-4 h-4" />
          <span>직원 초대</span>
        </button>
      </div>

      {/* ── 서브 네비게이션 ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: 'pending' as SubSection, label: '승인 대기', icon: Clock, count: pendingStaff.length },
          { key: 'active' as SubSection, label: '승인된 사용자', icon: Users, count: allManagedStaff.length },
          { key: 'cases' as SubSection, label: '사건 배정 현황', icon: Briefcase, count: undefined },
          { key: 'logs' as SubSection, label: '활동 이력', icon: Activity, count: undefined },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 border ${
              activeSection === item.key
                ? 'bg-brand/5 text-brand border-brand/20 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSection === item.key ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-500'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 섹션 1: 승인 대기 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'pending' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-amber-700 text-sm">승인 대기 ({pendingStaff.length})</span>
            </div>
            {pendingStaff.length === 0 ? (
              <div className="p-8 text-center text-amber-400 text-sm">
                대기 중인 요청이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-amber-200">
                {pendingStaff.map(member => (
                  <div key={member.id} className="p-4 flex items-center justify-between gap-4 hover:bg-amber-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 font-bold text-sm shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm">{member.name}</div>
                        <div className="text-[12px] text-slate-500 flex items-center gap-2 flex-wrap">
                          {member.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> {member.email}</span>}
                          {member.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {member.phone}</span>}
                          <span>• {formatRelative(member.createdAt)} 요청</span>
                        </div>
                        <div className="mt-1">{renderRoleBadge(member.role)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(member)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                      </button>
                      <button
                        onClick={() => handleReject(member)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 거부
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 섹션 2: 승인된 사용자 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'active' && (
        <div className="space-y-4">
          {/* 검색 바 */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 이메일 검색..."
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 pl-9 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder-slate-400"
            />
          </div>

          {/* 테이블 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3.5">이름</th>
                    <th className="p-3.5">이메일</th>
                    <th className="p-3.5">권한</th>
                    <th className="p-3.5">상태</th>
                    <th className="p-3.5 text-center">담당 건수</th>
                    <th className="p-3.5 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActiveStaff.map(member => (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 border ${
                            member.role === 'OWNER' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                            member.role === 'LAWYER' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{member.name}</span>
                            {member.phone && <div className="text-[11px] text-slate-400">{member.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500">{member.email || '—'}</td>
                      <td className="p-3.5">{renderRoleBadge(member.role)}</td>
                      <td className="p-3.5">{renderStatusBadge(member.status)}</td>
                      <td className="p-3.5 text-center">
                        <span className="font-bold text-slate-700">{staffCaseCounts[member.id] || 0}건</span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {member.role !== 'OWNER' && (
                            <>
                              {member.status === 'active' && (
                                <button
                                  onClick={() => handleSuspend(member)}
                                  title="활동 정지"
                                  className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {member.status === 'suspended' && (
                                <button
                                  onClick={() => handleReactivate(member)}
                                  title="활동 재개"
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => { setRemoveTargetId(member.id); setShowRemoveModal(true); }}
                                className="bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-500 border border-red-500/15 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Trash2 className="w-3 h-3" /> 강제 탈퇴
                              </button>
                            </>
                          )}
                          {member.role === 'OWNER' && (
                            <span className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> 관리자
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredActiveStaff.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                        등록된 직원이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 제거된 직원 (접을 수 있음) */}
          {removedStaff.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 select-none py-2">
                <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                탈퇴 처리된 직원 ({removedStaff.length}명)
              </summary>
              <div className="bg-slate-50 rounded-xl border border-slate-200 mt-2 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {removedStaff.map(member => (
                    <div key={member.id} className="p-3 flex items-center justify-between text-xs opacity-60">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600">{member.name}</span>
                        {renderRoleBadge(member.role)}
                        <span className="text-slate-400">• {member.removedAt ? formatDate(member.removedAt) : ''} 탈퇴</span>
                      </div>
                      <span className="text-red-400 text-[11px]">{member.removalReason || '사유 미기재'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 섹션 3: 사건 배정 현황 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'cases' && (
        <div className="space-y-4">
          {/* 미배정 경고 */}
          {unassignedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-amber-700">미배정 사건 {unassignedCount}건</span>
                <span className="text-amber-600 ml-1">— 담당 직원이 지정되지 않은 사건이 있습니다.</span>
              </div>
            </div>
          )}

          {/* 직원별 사건 현황 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeStaff.map(member => {
              const count = staffCaseCounts[member.id] || 0;
              return (
                <div key={member.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${
                      member.role === 'OWNER' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                      member.role === 'LAWYER' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                      member.role === 'CONSULTANT' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm">{member.name}</div>
                      <div className="text-[11px]">{renderRoleBadge(member.role)}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-black text-slate-900">{count}<span className="text-sm font-bold text-slate-400 ml-0.5">건</span></div>
                      <div className="text-[11px] text-slate-400">현재 담당 사건</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setBulkFromId(member.id); setShowBulkTransferModal(true); }}
                        disabled={count === 0}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> 이관
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 미배정 카드 */}
            <div className="bg-amber-50/50 rounded-xl border border-amber-200/60 border-dashed p-4 flex flex-col items-center justify-center text-center min-h-[130px]">
              <div className="text-2xl font-black text-amber-500">{unassignedCount}<span className="text-sm font-bold text-amber-400 ml-0.5">건</span></div>
              <div className="text-[11px] text-amber-500 mt-1 font-bold">미배정 사건</div>
            </div>
          </div>

          {/* 일괄 이관 안내 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 flex items-start gap-2">
            <ArrowRightLeft className="w-4 h-4 text-brand mt-0.5 shrink-0" />
            <div className="text-left">
              <strong className="text-slate-700">사건 일괄 이관</strong>: 직원의 "이관" 버튼을 클릭하면 해당 직원의 모든 사건을 다른 직원에게 한번에 이관할 수 있습니다. 퇴사/이직 시 활용하세요.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 섹션 4: 활동 이력 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'logs' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="all">전체 액션</option>
              {(Object.keys(ACTIVITY_TYPE_LABELS) as StaffActivityType[]).map(type => (
                <option key={type} value={type}>{ACTIVITY_TYPE_LABELS[type].emoji} {ACTIVITY_TYPE_LABELS[type].label}</option>
              ))}
            </select>
            <select
              value={logStaffFilter}
              onChange={e => setLogStaffFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="all">전체 직원</option>
              {staffMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* 타임라인 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                기록된 활동 이력이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLogs.slice(0, 50).map(log => {
                  const typeInfo = ACTIVITY_TYPE_LABELS[log.type] || { label: log.type, emoji: '📌', color: 'text-slate-400' };
                  return (
                    <div key={log.id} className="p-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-slate-100 border border-slate-200`}>
                        {typeInfo.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${typeInfo.color} bg-slate-50 border border-slate-200`}>
                            {typeInfo.label}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">{log.staffName}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5 text-left">{log.description}</p>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{formatDate(log.createdAt)}</span>
                          <span>• 실행: {log.actorName}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모달: 직원 초대 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900">직원 초대</h4>
                <p className="text-[12px] text-slate-500">새로운 직원을 사무실에 초대합니다.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-slate-600 font-bold block">이름 *</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                  placeholder="직원 이름 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-slate-600 font-bold block">이메일</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="이메일 주소" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-slate-600 font-bold block">연락처</label>
                <input type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)}
                  placeholder="010-XXXX-XXXX" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-slate-600 font-bold block">역할 지정</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as StaffRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="LAWYER">담당 변호사</option>
                  <option value="CONSULTANT">상담 직원</option>
                  <option value="STAFF">사무 직원</option>
                  <option value="ACCOUNTING">경리 직원</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleInviteStaff}
                disabled={!inviteName.trim()}
                className="flex-1 bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none">
                초대하기
              </button>
              <button onClick={() => setShowInviteModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모달: 강제 탈퇴 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowRemoveModal(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900">강제 탈퇴</h4>
                <p className="text-[12px] text-slate-500">
                  <strong>{staffMembers.find(m => m.id === removeTargetId)?.name}</strong>님을 사무실에서 강제 탈퇴합니다.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-left">
                강제 탈퇴 시 해당 직원의 모든 접근 권한이 즉시 회수됩니다.
                담당 중인 사건이 있는 경우, 탈퇴 후 다른 직원에게 일괄 이관이 필요합니다.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] text-slate-600 font-bold block">탈퇴 사유 *</label>
              <textarea
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                placeholder="강제 탈퇴 사유를 입력해주세요..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleRemove}
                disabled={!removeReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none">
                강제 탈퇴 확인
              </button>
              <button onClick={() => { setShowRemoveModal(false); setRemoveReason(''); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모달: 일괄 이관 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showBulkTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowBulkTransferModal(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900">사건 일괄 이관</h4>
                <p className="text-[12px] text-slate-500">
                  <strong>{staffMembers.find(m => m.id === bulkFromId)?.name}</strong>의 담당 사건 <strong>{staffCaseCounts[bulkFromId] || 0}건</strong>을 이관합니다.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-slate-600 font-bold block">이관 대상 (인수 직원) *</label>
                <select value={bulkToId} onChange={e => setBulkToId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="">직원을 선택하세요</option>
                  {activeStaff.filter(m => m.id !== bulkFromId).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({STAFF_ROLE_CONFIG[m.role].label}) — 현재 {staffCaseCounts[m.id] || 0}건 담당
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleBulkTransfer}
                disabled={!bulkToId}
                className="flex-1 bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none">
                일괄 이관 실행
              </button>
              <button onClick={() => { setShowBulkTransferModal(false); setBulkToId(''); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
