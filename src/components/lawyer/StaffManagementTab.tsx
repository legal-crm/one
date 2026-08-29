import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import {
  Users, Shield, UserPlus, UserMinus, Clock, CheckCircle2, XCircle,
  AlertTriangle, ArrowRightLeft, Search, Filter, ChevronDown, ChevronUp,
  Briefcase, Activity, Mail, Phone, RotateCcw, Trash2, ShieldCheck
} from 'lucide-react';
import { generateInviteToken, buildInviteUrl, loadInviteTokens, expireInviteToken } from '../../services/inviteService';
import type { InviteToken, CustomStaffRole } from '../../types';
import type {
  ConsultRequest, User, StaffMember, StaffRole, StaffMemberStatus,
  StaffActivityLog, StaffActivityType, CrmClientExtension, StaffPermissions
} from '../../types';
import {
  STAFF_ROLE_CONFIG, DEFAULT_PERMISSIONS, registerCustomRole, loadCustomRoles, deleteCustomRole
} from '../../types';
import {
  loadStaffMembers, saveStaffMember, deleteStaffMember,
  approveStaffMember, rejectStaffMember, suspendStaffMember,
  reactivateStaffMember, removeStaffMemberWithReason,
  createStaffActivityLog, loadStaffActivityLogs, saveStaffActivityLog,
  loadCrmData, saveCrmClient, updateStaffPermissions,
  type CrmDataStore
} from '../../services/crmService';

// ── 활동 타입 한글 라벨 ──
const ACTIVITY_TYPE_LABELS: Record<StaffActivityType, { label: string; emoji: string; color: string }> = {
  staff_invited:          { label: '직원 초대',     emoji: '📨', color: 'text-blue-700 font-bold' },
  staff_approved:         { label: '가입 승인',     emoji: '✅', color: 'text-emerald-700 font-bold' },
  staff_rejected:         { label: '가입 거부',     emoji: '❌', color: 'text-rose-700 font-bold' },
  staff_suspended:        { label: '활동 정지',     emoji: '⚠️', color: 'text-amber-800 font-bold' },
  staff_removed:          { label: '강제 탈퇴',     emoji: '🚫', color: 'text-rose-800 font-bold' },
  staff_reactivated:      { label: '활동 재개',     emoji: '🔄', color: 'text-emerald-700 font-bold' },
  case_assigned:          { label: '사건 배정',     emoji: '📋', color: 'text-blue-700 font-bold' },
  case_transferred:       { label: '사건 이관',     emoji: '🔀', color: 'text-purple-700 font-bold' },
  case_bulk_transferred:  { label: '일괄 이관',     emoji: '📦', color: 'text-amber-800 font-bold' },
  permission_changed:     { label: '권한 변경',     emoji: '🔑', color: 'text-pink-700 font-bold' },
  role_changed:           { label: '역할 변경',     emoji: '🏷️', color: 'text-[#1E3A5F] font-bold' },
};

interface StaffManagementTabProps {
  requests: ConsultRequest[];
  lawyers: User[];
  activeLawyer: User;
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
}

type SubSection = 'pending' | 'active' | 'cases' | 'logs' | 'invite-links';

export default function StaffManagementTab({ requests, lawyers, activeLawyer, setRequests }: StaffManagementTabProps) {
  const dialog = useDialog();
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

  // ── 초대 링크 ──
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [showInviteLinkMode, setShowInviteLinkMode] = useState(false);

  // ── 직원 상세 패널 ──
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<StaffPermissions | null>(null);

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
  const [logTimeFilter, setLogTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // ── 초대 링크 관리 ──
  const [inviteTokens, setInviteTokens] = useState<InviteToken[]>([]);

  // ── 커스텀 역할 ──
  const [customRoles, setCustomRoles] = useState<CustomStaffRole[]>([]);
  const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('text-teal-400');
  const [newRoleBg, setNewRoleBg] = useState('bg-teal-500/10');
  const [newRoleBorder, setNewRoleBorder] = useState('border-teal-500/20');

  // ── 초기 로드 ──
  useEffect(() => {
    loadStaffMembers().then(members => {
      const normalized = members.map(m => ({
        ...m,
        status: (m.status || (m.isActive ? 'active' : 'pending')) as StaffMemberStatus,
      }));
      setStaffMembers(normalized);
    });
    setActivityLogs(loadStaffActivityLogs());
    loadCrmData().then(setCrmData);
    // 초대 링크 로드
    setInviteTokens(loadInviteTokens());
    // 커스텀 역할 로드
    setCustomRoles(loadCustomRoles());
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
        const effectiveAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
        if (effectiveAssignee && counts[effectiveAssignee] !== undefined) counts[effectiveAssignee]++;
      }
    });
    return counts;
  }, [staffMembers, requests, crmData]);

  const unassignedCount = useMemo(() => {
    return requests.filter(r => {
      const ext = crmData[r.id];
      const effectiveAssignee = ext?.assigneeId || ext?.assignedLawyerId || ext?.assignedConsultantId || ext?.assignedStaffId;
      return !ext || !effectiveAssignee;
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

  // ── 핸들러: 초대 링크 생성 ──
  const handleGenerateInviteLink = async () => {
    const token = await generateInviteToken(
      inviteRole,
      activeLawyer.id,
      inviteEmail.trim() || undefined
    );
    const url = buildInviteUrl(token.token);
    setGeneratedInviteUrl(url);
    setInviteLinkCopied(false);
    recordActivity('system', '시스템', 'staff_invited', `${STAFF_ROLE_CONFIG[inviteRole].label} 역할의 초대 링크가 생성되었습니다.`);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(generatedInviteUrl).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 3000);
    });
  };

  // ── 핸들러: 승인 ──
  const handleApprove = async (member: StaffMember) => {
    await approveStaffMember(member.id);
    setStaffMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'active' as StaffMemberStatus, isActive: true, approvedAt: new Date().toISOString() } : m));
    recordActivity(member.id, member.name, 'staff_approved', `${member.name}님의 가입을 승인했습니다.`);
  };

  // ── 핸들러: 거부 ──
  const handleReject = async (member: StaffMember) => {
    const confirmed = await dialog.confirm({
      title: '가입 요청 거부',
      message: `${member.name}님의 가입 요청을 거부하시겠습니까?`,
      confirmText: '거부',
      variant: 'danger'
    });
    if (!confirmed) return;
    await rejectStaffMember(member.id);
    setStaffMembers(prev => prev.filter(m => m.id !== member.id));
    recordActivity(member.id, member.name, 'staff_rejected', `${member.name}님의 가입을 거부했습니다.`);
  };

  // ── 핸들러: 정지 ──
  const handleSuspend = async (member: StaffMember) => {
    const confirmed = await dialog.confirm({
      title: '활동 정지 확인',
      message: `${member.name}님의 활동을 정지하시겠습니까?\n해당 직원의 CRM 접근이 즉시 차단됩니다.`,
      confirmText: '활동 정지',
      variant: 'warning'
    });
    if (!confirmed) return;
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
        const effectiveAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
        if (effectiveAssignee === bulkFromId) {
          updatedExt.assigneeId = bulkToId;
          updatedExt.assignedLawyerId = bulkToId;  // 하위 호환
          changed = true;
        }
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
    toast.success(`${transferredCount}건의 사건이 ${toStaff.name}에게 성공적으로 이관되었습니다.`);
  };

  // ── 핸들러: 역할 변경 ──
  const handleRoleChange = async (member: StaffMember, newRole: StaffRole) => {
    if (member.role === newRole) return;
    const confirmed = await dialog.confirm({
      title: '역할 변경 확인',
      message: `${member.name}님의 역할을 ${STAFF_ROLE_CONFIG[member.role].label}에서 ${STAFF_ROLE_CONFIG[newRole].label}(으)로 변경하시겠습니까?\n권한이 새 역할의 기본값으로 초기화됩니다.`,
      confirmText: '역할 변경',
      variant: 'primary'
    });
    if (!confirmed) return;
    
    const oldRole = member.role;
    const updatedMember = { ...member, role: newRole, permissions: DEFAULT_PERMISSIONS[newRole] };
    await saveStaffMember(updatedMember);
    setStaffMembers(prev => prev.map(m => m.id === member.id ? updatedMember : m));
    recordActivity(member.id, member.name, 'role_changed', `${member.name}님의 역할이 ${STAFF_ROLE_CONFIG[oldRole].label}에서 ${STAFF_ROLE_CONFIG[newRole].label}(으)로 변경되었습니다.`);
    toast.success(`${member.name}님의 역할이 ${STAFF_ROLE_CONFIG[newRole].label}(으)로 변경되었습니다.`);
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
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return activityLogs.filter(log => {
      const matchType = logFilter === 'all' || log.type === logFilter;
      const matchStaff = logStaffFilter === 'all' || log.staffId === logStaffFilter;
      let matchTime = true;
      if (logTimeFilter === 'today') matchTime = new Date(log.timestamp) >= startOfDay;
      else if (logTimeFilter === 'week') matchTime = new Date(log.timestamp) >= startOfWeek;
      else if (logTimeFilter === 'month') matchTime = new Date(log.timestamp) >= startOfMonth;
      return matchType && matchStaff && matchTime;
    });
  }, [activityLogs, logFilter, logStaffFilter, logTimeFilter]);

  // ── 역할 뱃지 렌더러 ──
  const renderRoleBadge = (role: StaffRole) => {
    const cfg = STAFF_ROLE_CONFIG[role];
    return (
      <span className={`text-xs px-2.5 py-1 rounded-lg font-black border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor} tracking-tight`}>
        {cfg.label}
      </span>
    );
  };

  // ── 상태 뱃지 렌더러 ──
  const renderStatusBadge = (status: StaffMemberStatus) => {
    switch (status) {
      case 'active':
        return <span className="text-emerald-700 text-xs font-black flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> 정상</span>;
      case 'pending':
        return <span className="text-amber-800 text-xs font-black flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"><Clock className="w-3.5 h-3.5" /> 대기</span>;
      case 'suspended':
        return <span className="text-amber-900 text-xs font-black flex items-center gap-1 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> 정지</span>;
      case 'removed':
        return <span className="text-rose-700 text-xs font-black flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"><XCircle className="w-3.5 h-3.5" /> 탈퇴</span>;
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
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
      {/* ── 페이지 헤더 ── */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-slate-700" />
            <span>사용자 관리 (Admin)</span>
          </h3>
          <p className="text-sm text-slate-500">사무실 직원의 접속 권한을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-[#1E3A5F] hover:bg-[#163152] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all self-start md:self-center cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          <span>직원 초대</span>
        </button>
      </div>

      {/* ── 통계 카드 (모노크롬 리디자인) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: '전체 직원', count: allManagedStaff.length, icon: '👥', section: 'active' as SubSection },
          { label: '활성', count: activeStaff.length, icon: '🟢', section: 'active' as SubSection },
          { label: '승인 대기', count: pendingStaff.length, icon: '⏳', section: 'pending' as SubSection },
          { label: '정지', count: allManagedStaff.filter(s => s.status === 'suspended').length, icon: '⚠️', section: 'active' as SubSection },
        ]).map(card => (
          <button key={card.label} onClick={() => setActiveSection(card.section)}
            className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left transition-all hover:shadow-sm hover:border-slate-300 active:scale-[0.98] cursor-pointer">
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{card.icon}</span>
              {card.label === '승인 대기' && card.count > 0 && (
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
              )}
            </div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${card.label === '승인 대기' && card.count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{card.count}</div>
            <div className="text-xs text-slate-500 font-bold mt-0.5">{card.label}</div>
          </button>
        ))}
      </div>

      {/* ── 서브 네비게이션 ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {([
          { key: 'pending' as SubSection, label: '승인 대기', icon: Clock, count: pendingStaff.length, pulse: pendingStaff.length > 0 },
          { key: 'active' as SubSection, label: '승인된 사용자', icon: Users, count: allManagedStaff.length, pulse: false },
          { key: 'invite-links' as SubSection, label: '초대 링크', icon: Mail, count: inviteTokens.filter(t => !t.isUsed && new Date(t.expiresAt) > new Date()).length, pulse: false },
          { key: 'cases' as SubSection, label: '사건 배정', icon: Briefcase, count: undefined, pulse: false },
          { key: 'logs' as SubSection, label: '활동 이력', icon: Activity, count: undefined, pulse: false },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all shrink-0 border cursor-pointer ${
              activeSection === item.key
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sm:hidden">{item.label.substring(0, 2)}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                item.pulse ? 'bg-rose-500 text-white animate-pulse' :
                activeSection === item.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
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
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-amber-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-amber-800 text-base">승인 대기 ({pendingStaff.length})</span>
            </div>
            {pendingStaff.length === 0 ? (
              <div className="p-10 text-center text-amber-600 text-sm font-medium">
                대기 중인 요청이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-amber-200">
                {pendingStaff.map(member => (
                  <div key={member.id} className="p-5 flex items-center justify-between gap-4 hover:bg-amber-50/50 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-black text-base shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-base">{member.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2.5 flex-wrap mt-0.5 font-medium">
                          {member.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {member.email}</span>}
                          {member.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {member.phone}</span>}
                          <span>• {formatRelative(member.createdAt)} 요청</span>
                        </div>
                        <div className="mt-1.5">{renderRoleBadge(member.role)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(member)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> 승인
                      </button>
                      <button
                        onClick={() => handleReject(member)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" /> 거부
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
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 이메일 검색..."
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder-slate-400"
            />
          </div>

          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredActiveStaff.map(member => {
              const caseCount = staffCaseCounts[member.id] || 0;
              const roleConfig = STAFF_ROLE_CONFIG[member.role];
              const isSuspended = member.status === 'suspended';
              return (
                <div key={member.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${isSuspended ? 'opacity-60 border-red-200' : 'border-slate-200'}`}>
                  {/* 역할 컬러 탑 바 */}
                  <div className={`h-1 ${
                    member.role === 'OWNER' ? 'bg-amber-400' :
                    member.role === 'LAWYER' ? 'bg-brand' :
                    member.role === 'CONSULTANT' ? 'bg-blue-400' :
                    member.role === 'ACCOUNTING' ? 'bg-purple-400' : 'bg-slate-300'
                  }`} />
                  <div className="p-4">
                    {/* 상단: 프로필 */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 border-2 ${
                        member.role === 'OWNER' ? 'bg-amber-100 text-amber-600 border-amber-300' :
                        member.role === 'LAWYER' ? 'bg-brand/10 text-brand border-brand/30' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => { setSelectedStaffDetail(member); setEditPermissions({...member.permissions}); }}
                          className="font-black text-slate-900 text-base hover:text-brand transition-colors cursor-pointer text-left block truncate w-full">
                          {member.name}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          {renderRoleBadge(member.role)}
                          {isSuspended && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{'\uC815\uC9C0'}</span>}
                        </div>
                      </div>
                    </div>
                    {/* 중단: 정보 */}
                    <div className="space-y-2 mb-3">
                      {member.email && <div className="text-xs text-slate-500 truncate"><Mail className="w-3 h-3 inline mr-1 opacity-50" />{member.email}</div>}
                      {member.phone && <div className="text-xs text-slate-500"><Phone className="w-3 h-3 inline mr-1 opacity-50" />{member.phone}</div>}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">{'\uB2F4\uB2F9'} {caseCount}{'\uAC74'}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.min(100, caseCount * 10)}%` }} />
                        </div>
                      </div>
                      {/* 담당 변호사 지정 (비변호사 직원만) */}
                      {member.role !== 'OWNER' && member.role !== 'LAWYER' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">감독 변호사</span>
                          <select
                            value={member.supervisingLawyerId || ''}
                            onChange={e => {
                              const newId = e.target.value;
                              setStaffMembers(prev => prev.map(m => m.id === member.id ? { ...m, supervisingLawyerId: newId || undefined } : m));
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 flex-1 min-w-0"
                          >
                            <option value="">대표 변호사 (기본)</option>
                            {lawyers.filter(l => l.role === 'LAWYER' || (l as any).isOwner).map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {/* 하단: 액션 */}
                    {member.role !== 'OWNER' ? (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                        <select value={member.role} onChange={e => handleRoleChange(member, e.target.value as StaffRole)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 flex-1">
                          <option value="LAWYER">{'\uBCC0\uD638\uC0AC'}</option>
                          <option value="CONSULTANT">{'\uC0C1\uB2F4'}</option>
                          <option value="STAFF">{'\uC0AC\uBB34'}</option>
                          <option value="ACCOUNTING">{'\uACBD\uB9AC'}</option>
                        </select>
                        {member.status === 'active' && (
                          <button onClick={() => handleSuspend(member)} title={'\uD65C\uB3D9 \uC815\uC9C0'}
                            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 cursor-pointer">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {member.status === 'suspended' && (
                          <button onClick={() => handleReactivate(member)} title={'\uD65C\uB3D9 \uC7AC\uAC1C'}
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 cursor-pointer">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => { setRemoveTargetId(member.id); setShowRemoveModal(true); }}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                        <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" /> {'\uAD00\uB9AC\uC790 (\uBCC0\uACBD \uBD88\uAC00)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredActiveStaff.length === 0 && (
              <div className="col-span-full text-center py-10 text-slate-400 text-sm font-medium">
                {'\uB4F1\uB85D\uB41C \uC9C1\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
              </div>
            )}
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

          {/* 시간대 필터 */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all' as const, label: '\uC804\uCCB4' },
              { key: 'today' as const, label: '\uC624\uB298' },
              { key: 'week' as const, label: '\uC774\uBC88 \uC8FC' },
              { key: 'month' as const, label: '\uC774\uBC88 \uB2EC' },
            ]).map(tf => (
              <button key={tf.key} onClick={() => setLogTimeFilter(tf.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-[0.98] cursor-pointer ${
                  logTimeFilter === tf.key
                    ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                {tf.label}
              </button>
            ))}
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

            {/* 모드 탭 */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setShowInviteLinkMode(false); setGeneratedInviteUrl(''); }}
                className={`flex-1 py-2.5 text-xs font-extrabold transition-colors cursor-pointer ${!showInviteLinkMode ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                직접 초대
              </button>
              <button
                onClick={() => setShowInviteLinkMode(true)}
                className={`flex-1 py-2.5 text-xs font-extrabold transition-colors cursor-pointer ${showInviteLinkMode ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🔗 초대 링크
              </button>
            </div>

            {showInviteLinkMode ? (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 font-bold block">역할 지정 *</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as StaffRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]">
                    <option value="LAWYER">담당 변호사</option>
                    <option value="CONSULTANT">상담 직원</option>
                    <option value="STAFF">사무 직원</option>
                    <option value="ACCOUNTING">경리 직원</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 font-bold block">이메일 (선택)</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="특정 이메일로 제한 (선택사항)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  <p className="text-[11px] text-slate-400 font-medium">입력하면 해당 이메일로만 가입 가능합니다.</p>
                </div>
                <button onClick={handleGenerateInviteLink}
                  className="w-full bg-[#1E3A5F] hover:bg-[#163152] text-white py-3 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]">
                  🔗 초대 링크 생성 (48시간 유효)
                </button>
                {generatedInviteUrl && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                    <label className="text-xs text-slate-700 font-bold block">생성된 초대 링크</label>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={generatedInviteUrl}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono select-all font-bold" />
                      <button onClick={handleCopyInviteLink}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          inviteLinkCopied ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white hover:bg-[#163152]'
                        }`}>
                        {inviteLinkCopied ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="text-xs text-amber-700 font-bold">⏰ 이 링크는 48시간 후 만료됩니다.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">이름 *</label>
                    <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                      placeholder="직원 이름 입력" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">이메일</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="이메일 주소" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">연락처</label>
                    <input type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)}
                      placeholder="010-XXXX-XXXX" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">역할 지정</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value as StaffRole)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]">
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
                    className="flex-1 bg-[#1E3A5F] hover:bg-[#163152] text-white py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs active:scale-[0.98]">
                    초대하기
                  </button>
                  <button onClick={() => setShowInviteModal(false)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer">
                    취소
                  </button>
                </div>
              </>
            )}
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
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900">강제 탈퇴</h4>
                <p className="text-[12px] text-slate-500">
                  <strong>{staffMembers.find(m => m.id === removeTargetId)?.name}</strong>님을 사무실에서 강제 탈퇴합니다.
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleRemove}
                disabled={!removeReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs">
                강제 탈퇴 확인
              </button>
              <button onClick={() => { setShowRemoveModal(false); setRemoveReason(''); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer">
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
              <div className="p-2 rounded-xl bg-slate-100 text-[#1E3A5F] border border-slate-200">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20">
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
                className="flex-1 bg-[#1E3A5F] hover:bg-[#163152] text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs">
                일괄 이관 실행
              </button>
              <button onClick={() => { setShowBulkTransferModal(false); setBulkToId(''); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* 섹션 5: 초대 링크 관리 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'invite-links' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 초대 링크 목록 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">🔗 발급된 초대 링크 목록</h4>
                <p className="text-xs text-slate-500 mt-0.5">사무실 직원 및 담당 변호사를 초대할 수 있는 링크를 관리합니다.</p>
              </div>
              <button
                onClick={() => { setShowInviteModal(true); setShowInviteLinkMode(true); }}
                className="bg-[#1E3A5F] hover:bg-[#163152] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start cursor-pointer active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" /> 새 초대 링크 생성
              </button>
            </div>

            {inviteTokens.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Mail className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-extrabold text-slate-800">발급된 초대 링크가 없습니다.</p>
                <p className="text-xs text-slate-400">새 초대 링크를 발급하여 직원 또는 담당 변호사에게 전달하세요.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-bold text-slate-600">역할</th>
                      <th className="text-left p-3 font-bold text-slate-600 hidden sm:table-cell">이메일 제한</th>
                      <th className="text-left p-3 font-bold text-slate-600">상태</th>
                      <th className="text-left p-3 font-bold text-slate-600 hidden md:table-cell">만료</th>
                      <th className="text-left p-3 font-bold text-slate-600">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inviteTokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(token => {
                      const isExpired = new Date(token.expiresAt) <= new Date();
                      const status = token.isUsed ? 'used' : isExpired ? 'expired' : 'active';
                      return (
                        <tr key={token.token} className="hover:bg-slate-50/50">
                          <td className="p-3">{renderRoleBadge(token.role)}</td>
                          <td className="p-3 text-slate-700 font-medium hidden sm:table-cell">{token.email || <span className="text-slate-400">제한 없음</span>}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                              status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              status === 'used' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}>
                              {status === 'active' ? '활성' : status === 'used' ? '사용됨' : '만료'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-medium hidden md:table-cell">{new Date(token.expiresAt).toLocaleDateString('ko-KR')} {new Date(token.expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="p-3">
                            <div className="flex gap-1.5">
                              {status === 'active' && (
                                <>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(buildInviteUrl(token.token));
                                      toast.success('초대 링크가 복사되었습니다.');
                                    }}
                                    className="bg-[#1E3A5F] hover:bg-[#163152] text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                  >
                                    복사
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const confirmed = await dialog.confirm({
                                        title: '초대 링크 만료',
                                        message: '이 초대 링크를 만료 처리하시겠습니까?\n만료 후에는 해당 링크를 통해 가입할 수 없습니다.',
                                        confirmText: '만료 처리',
                                        variant: 'warning'
                                      });
                                      if (confirmed) {
                                        await expireInviteToken(token.token);
                                        const updated = loadInviteTokens();
                                        setInviteTokens(updated);
                                        toast.success('초대 링크가 만료되었습니다.');
                                      }
                                    }}
                                    className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                                  >
                                    만료
                                  </button>
                                </>
                              )}
                              {status !== 'active' && (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 커스텀 역할 관리 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">🏷️ 커스텀 역할 관리</h4>
                <p className="text-xs text-slate-500 mt-0.5">사무실 특성에 맞게 직책/역할을 정의하고 권한을 부여할 수 있습니다.</p>
              </div>
              <button
                onClick={() => setShowCustomRoleForm(!showCustomRoleForm)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
              >
                {showCustomRoleForm ? '접기' : '+ 새 역할 추가'}
              </button>
            </div>

            {showCustomRoleForm && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4 animate-fadeIn">
                <h5 className="font-extrabold text-slate-900 text-sm">새로운 역할 정의</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">역할 ID (영문 대문자) *</label>
                    <input type="text" value={newRoleId} onChange={e => setNewRoleId(e.target.value.toUpperCase().replace(/[^A-Z_]/g, ''))}
                      placeholder="예: INTERN, PARALEGAL" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 font-bold block">표시 이름 *</label>
                    <input type="text" value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)}
                      placeholder="예: 인턴, 파라리걸" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-700 font-bold block">테마 색상</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { color: 'text-teal-900', bg: 'bg-teal-50', border: 'border-teal-200', label: '청록' },
                      { color: 'text-amber-900', bg: 'bg-amber-50', border: 'border-amber-200', label: '주황' },
                      { color: 'text-blue-900', bg: 'bg-blue-50', border: 'border-blue-200', label: '하늘' },
                      { color: 'text-rose-900', bg: 'bg-rose-50', border: 'border-rose-200', label: '장미' },
                      { color: 'text-emerald-900', bg: 'bg-emerald-50', border: 'border-emerald-200', label: '연두' },
                      { color: 'text-purple-900', bg: 'bg-purple-50', border: 'border-purple-200', label: '보라' },
                    ].map(opt => (
                      <button key={opt.color} type="button"
                        onClick={() => { setNewRoleColor(opt.color); setNewRoleBg(opt.bg); setNewRoleBorder(opt.border); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                          newRoleColor === opt.color ? `${opt.bg} ${opt.color} ${opt.border} ring-2 ring-[#1E3A5F]/40 shadow-xs` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!newRoleId || !newRoleLabel) { toast.error('역할 ID와 이름을 입력해주세요.'); return; }
                    if (['OWNER','LAWYER','CONSULTANT','STAFF','ACCOUNTING'].includes(newRoleId)) { toast.error('기본 역할과 동일한 ID는 사용할 수 없습니다.'); return; }
                    const newRole: CustomStaffRole = {
                      id: newRoleId,
                      label: newRoleLabel,
                      color: newRoleColor,
                      bgColor: newRoleBg,
                      borderColor: newRoleBorder,
                      basePermissions: { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: true, manageBilling: false, deleteClients: false, manageCalendar: false },
                      createdAt: new Date().toISOString(),
                    };
                    registerCustomRole(newRole);
                    setCustomRoles(loadCustomRoles());
                    setNewRoleId(''); setNewRoleLabel('');
                    setShowCustomRoleForm(false);
                    recordActivity('system', '시스템', 'role_changed', `커스텀 역할 "${newRoleLabel}" (${newRoleId})이 생성되었습니다.`);
                    toast.success(`커스텀 역할 "${newRoleLabel}"이(가) 생성되었습니다.`);
                  }}
                  className="w-full bg-[#1E3A5F] hover:bg-[#163152] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  역할 생성하기
                </button>
              </div>
            )}

            {/* 기존 + 커스텀 역할 목록 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {['OWNER','LAWYER','CONSULTANT','STAFF','ACCOUNTING'].map(role => {
                const cfg = STAFF_ROLE_CONFIG[role];
                return (
                  <div key={role} className={`${cfg.bgColor} border ${cfg.borderColor} rounded-xl p-4 text-center shadow-2xs transition-all hover:shadow-sm`}>
                    <span className={`text-sm font-black ${cfg.color} block tracking-tight`}>{cfg.label}</span>
                    <div className="text-xs text-slate-500 font-medium mt-1">기본 역할</div>
                  </div>
                );
              })}
              {customRoles.map(role => (
                <div key={role.id} className={`${role.bgColor} border ${role.borderColor} rounded-xl p-4 text-center relative group shadow-2xs transition-all hover:shadow-sm`}>
                  <span className={`text-sm font-black ${role.color} block tracking-tight`}>{role.label}</span>
                  <div className="text-xs text-slate-500 font-medium mt-1">{role.id}</div>
                  <button
                    onClick={async () => {
                      const confirmed = await dialog.confirm({
                        title: '커스텀 역할 삭제',
                        message: `"${role.label}" 역할을 삭제하시겠습니까?`,
                        confirmText: '삭제',
                        variant: 'danger'
                      });
                      if (confirmed) {
                        deleteCustomRole(role.id);
                        setCustomRoles(loadCustomRoles());
                        toast.success(`"${role.label}" 역할이 삭제되었습니다.`);
                      }
                    }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-xs cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 패널: 직원 상세 프로필 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {selectedStaffDetail && editPermissions && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedStaffDetail(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-slideInRight" onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h4 className="font-extrabold text-slate-900">직원 상세 정보</h4>
              <button onClick={() => setSelectedStaffDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 프로필 카드 */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                  selectedStaffDetail.role === 'OWNER' ? 'bg-amber-100 text-amber-600 border-amber-300' :
                  selectedStaffDetail.role === 'LAWYER' ? 'bg-blue-100 text-blue-600 border-blue-300' :
                  selectedStaffDetail.role === 'CONSULTANT' ? 'bg-emerald-100 text-emerald-600 border-emerald-300' :
                  'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  {selectedStaffDetail.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-lg">{selectedStaffDetail.name}</div>
                  <div className="mt-1">{renderRoleBadge(selectedStaffDetail.role)}</div>
                </div>
              </div>

              {/* 기본 정보 */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-700 text-sm flex items-center gap-1.5"><Users className="w-4 h-4 text-brand" /> 기본 정보</h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">이메일</span>
                    <span className="font-bold text-slate-700">{selectedStaffDetail.email || selectedStaffDetail.authEmail || '미등록'}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">연락처</span>
                    <span className="font-bold text-slate-700">{selectedStaffDetail.phone || '미등록'}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">가입일</span>
                    <span className="font-bold text-slate-700">{formatDate(selectedStaffDetail.createdAt)}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">상태</span>
                    {renderStatusBadge(selectedStaffDetail.status)}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">인증 방식</span>
                    <span className="font-bold text-slate-700">{selectedStaffDetail.authProvider === 'google' ? '🔵 Google' : selectedStaffDetail.authProvider === 'email' ? '📧 이메일' : '미설정'}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <span className="text-slate-400 block mb-0.5">담당 사건</span>
                    <span className="font-bold text-slate-700">{staffCaseCounts[selectedStaffDetail.id] || 0}건</span>
                  </div>
                </div>
              </div>

              {/* 권한 토글 */}
              {selectedStaffDetail.role !== 'OWNER' && (
                <div className="space-y-3">
                  <h5 className="font-bold text-slate-700 text-sm flex items-center gap-1.5"><Shield className="w-4 h-4 text-brand" /> 개별 권한 설정</h5>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {([
                      { key: 'viewAllClients' as keyof StaffPermissions, label: '전체 고객 조회', desc: '모든 고객 정보를 열람할 수 있습니다.' },
                      { key: 'editClientInfo' as keyof StaffPermissions, label: '고객 정보 수정', desc: '고객의 연락처, 이름 등을 수정합니다.' },
                      { key: 'changeStatus' as keyof StaffPermissions, label: '상태 변경', desc: 'CRM 상태를 변경할 수 있습니다.' },
                      { key: 'assignCases' as keyof StaffPermissions, label: '사건 배정/이관', desc: '사건을 다른 직원에게 배정합니다.' },
                      { key: 'manageStaff' as keyof StaffPermissions, label: '직원 관리', desc: '직원을 초대/승인/탈퇴 처리합니다.' },
                      { key: 'writeNotes' as keyof StaffPermissions, label: '상담 메모 작성', desc: '상담 노트를 작성할 수 있습니다.' },
                      { key: 'manageBilling' as keyof StaffPermissions, label: '수임료 관리', desc: '수임료 정보를 열람/수정합니다.' },
                      { key: 'deleteClients' as keyof StaffPermissions, label: '고객 삭제', desc: '고객 데이터를 삭제할 수 있습니다.' },
                    ]).map(perm => (
                      <div key={perm.key} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-700">{perm.label}</div>
                          <div className="text-[11px] text-slate-400">{perm.desc}</div>
                        </div>
                        <button
                          onClick={() => {
                            setEditPermissions(prev => prev ? { ...prev, [perm.key]: !prev[perm.key] } : prev);
                          }}
                          className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ml-3 ${
                            editPermissions[perm.key] ? 'bg-brand' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
                            editPermissions[perm.key] ? 'translate-x-5' : 'translate-x-[2px]'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      await updateStaffPermissions(selectedStaffDetail.id, editPermissions);
                      setStaffMembers(prev => prev.map(m => m.id === selectedStaffDetail.id ? { ...m, permissions: editPermissions } : m));
                      recordActivity(selectedStaffDetail.id, selectedStaffDetail.name, 'permission_changed', `${selectedStaffDetail.name}님의 개별 권한이 변경되었습니다.`);
                      toast.success('권한이 저장되었습니다.');
                    }}
                    className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold transition-colors"
                  >
                    권한 변경 저장
                  </button>
                </div>
              )}

              {/* 최근 활동 이력 */}
              <div className="space-y-3">
                <h5 className="font-bold text-slate-700 text-sm flex items-center gap-1.5"><Activity className="w-4 h-4 text-brand" /> 최근 활동</h5>
                <div className="space-y-2">
                  {activityLogs.filter(log => log.staffId === selectedStaffDetail.id).slice(0, 10).map(log => {
                    const typeInfo = ACTIVITY_TYPE_LABELS[log.type] || { label: log.type, emoji: '📌', color: 'text-slate-400' };
                    return (
                      <div key={log.id} className="bg-white border border-slate-100 rounded-lg p-2.5 text-xs flex items-start gap-2">
                        <span>{typeInfo.emoji}</span>
                        <div className="min-w-0">
                          <span className="text-slate-600">{log.description}</span>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(log.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {activityLogs.filter(log => log.staffId === selectedStaffDetail.id).length === 0 && (
                    <div className="text-center text-slate-400 text-xs py-4">활동 이력이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
