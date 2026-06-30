import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Plus, Trash2, Search, LayoutGrid, List, GripVertical,
  CheckCircle2, ArrowRightLeft, UserPlus, Settings, Filter,
  FileText, Clock, AlertTriangle
} from 'lucide-react';
import type { 
  ConsultRequest, User, StaffMember, StaffRole, CrmStatus, CrmClientExtension,
  CrmNote, CrmNoteCategory, DocumentCheckItem, CrmActivityLog
} from '../../types';
import { 
  CRM_STATUS_CONFIG, STAFF_ROLE_CONFIG, CRM_NOTE_CATEGORIES, 
  DEFAULT_REHAB_DOCUMENTS, DEFAULT_PERMISSIONS
} from '../../types';
import { 
  loadCrmData, saveCrmClient, loadStaffMembers, saveStaffMember, 
  deleteStaffMember, createActivityLog, createCrmNote, createDefaultCrmExtension,
  type CrmDataStore 
} from '../../services/crmService';

interface CrmTabProps {
  requests: ConsultRequest[];
  lawyers: User[];
  activeLawyer: User;
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  getDisplayPhoneNumber: (r: ConsultRequest) => string;
}

type SortField = 'clientName' | 'createdAt' | 'debtTotal' | 'crmStatus';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'kanban';

const CRM_STATUSES: CrmStatus[] = ['requested','consulting','contracted','document','filed','commenced','repaying','discharged'];

export default function CrmTab({ requests, lawyers, activeLawyer, setRequests, getDisplayPhoneNumber }: CrmTabProps) {
  // ── 기본 State ──
  const [crmData, setCrmData] = useState<CrmDataStore>({});
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // ── 검색/필터/정렬 ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  // ── 페이지네이션 ──
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  
  // ── 선택 ──
  const [selectedId, setSelectedId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // ── 상세 패널 편집 ──
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<CrmStatus>('requested');
  const [editLawyerId, setEditLawyerId] = useState('');
  const [editConsultantId, setEditConsultantId] = useState('');
  const [editStaffId, setEditStaffId] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<CrmNoteCategory>('consult');
  
  // ── 이관 모달 ──
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  
  // ── 직원 관리 패널 ──
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('CONSULTANT');
  
  // ── 일괄 작업 ──
  const [bulkStatus, setBulkStatus] = useState<CrmStatus>('consulting');
  const [bulkAssignee, setBulkAssignee] = useState('');

  // ── 활동 탭 ──
  const [detailTab, setDetailTab] = useState<'info' | 'docs' | 'notes' | 'timeline'>('info');

  // ── 초기 로드 ──
  useEffect(() => {
    loadCrmData().then(setCrmData);
    loadStaffMembers().then(members => {
      setStaffMembers(members);
      // 대표 변호사(현재 로그인) 기반으로 activeStaff 설정
      const owner = members.find(m => m.role === 'OWNER');
      if (owner) setActiveStaff(owner);
      else {
        // 자동으로 현재 변호사를 OWNER로 등록
        const defaultOwner: StaffMember = {
          id: activeLawyer.id,
          name: activeLawyer.name,
          role: 'OWNER',
          isActive: true,
          assignedCount: 0,
          createdAt: new Date().toISOString(),
          permissions: DEFAULT_PERMISSIONS.OWNER,
        };
        setStaffMembers([defaultOwner]);
        setActiveStaff(defaultOwner);
        saveStaffMember(defaultOwner);
      }
    });
  }, [activeLawyer.id, activeLawyer.name]);

  // ── CRM 확장 데이터 가져오기/생성 ──
  const getCrmExt = useCallback((clientId: string): CrmClientExtension => {
    return crmData[clientId] || createDefaultCrmExtension(clientId);
  }, [crmData]);

  const updateCrmExt = useCallback(async (clientId: string, updates: Partial<CrmClientExtension>) => {
    const current = getCrmExt(clientId);
    const updated = { ...current, ...updates, lastActivityAt: new Date().toISOString() };
    setCrmData(prev => ({ ...prev, [clientId]: updated }));
    await saveCrmClient(clientId, updated);
  }, [getCrmExt]);

  // ── 현재 권한 확인 ──
  const currentPermissions = activeStaff?.permissions || DEFAULT_PERMISSIONS.OWNER;

  // ── 필터링 + 정렬 + 페이지네이션 ──
  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => {
      const matchSearch = 
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search);
      
      const ext = getCrmExt(r.id);
      const matchStatus = statusFilter === 'all' || ext.crmStatus === statusFilter;
      
      let matchAssignee = true;
      if (assigneeFilter === 'unassigned') {
        matchAssignee = !ext.assignedLawyerId && !ext.assignedConsultantId;
      } else if (assigneeFilter !== 'all') {
        matchAssignee = ext.assignedLawyerId === assigneeFilter || 
                        ext.assignedConsultantId === assigneeFilter ||
                        ext.assignedStaffId === assigneeFilter;
      }

      // 권한에 따른 필터 (본인 배정 건만)
      if (!currentPermissions.viewAllClients && activeStaff) {
        const isAssigned = ext.assignedLawyerId === activeStaff.id || 
                          ext.assignedConsultantId === activeStaff.id ||
                          ext.assignedStaffId === activeStaff.id;
        if (!isAssigned) return false;
      }
      
      return matchSearch && matchStatus && matchAssignee;
    });

    // 정렬
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'clientName': cmp = a.clientName.localeCompare(b.clientName); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'debtTotal': cmp = a.financialProfile.debtTotal - b.financialProfile.debtTotal; break;
        case 'crmStatus': {
          const ai = CRM_STATUSES.indexOf(getCrmExt(a.id).crmStatus);
          const bi = CRM_STATUSES.indexOf(getCrmExt(b.id).crmStatus);
          cmp = ai - bi; break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [requests, search, statusFilter, assigneeFilter, sortField, sortDir, getCrmExt, currentPermissions, activeStaff]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / perPage));
  const pagedRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

  // 페이지 범위 벗어나면 리셋
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  // ── 선택 변경 시 편집 필드 동기화 ──
  const selectedClient = requests.find(r => r.id === selectedId);
  const selectedExt = selectedId ? getCrmExt(selectedId) : null;

  useEffect(() => {
    if (selectedClient && selectedExt) {
      setEditName(selectedClient.clientName);
      setEditPhone(selectedClient.phone);
      setEditStatus(selectedExt.crmStatus);
      setEditLawyerId(selectedExt.assignedLawyerId || '');
      setEditConsultantId(selectedExt.assignedConsultantId || '');
      setEditStaffId(selectedExt.assignedStaffId || '');
      setDetailTab('info');
    }
  }, [selectedId]);

  // ── 핸들러 ──
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pagedRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagedRequests.map(r => r.id)));
  };

  const handleSaveClientInfo = () => {
    if (!selectedId || !editName.trim()) return;
    setRequests(prev => prev.map(r => r.id === selectedId ? { ...r, clientName: editName.trim(), phone: editPhone.trim() } : r));
  };

  const handleSaveAssignment = async () => {
    if (!selectedId) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const activities = [...ext.activities];
    
    if (editStatus !== ext.crmStatus) {
      activities.push(createActivityLog(selectedId, actor.id, actor.name, actor.role, 'status_change',
        `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[editStatus].label}`));
    }
    if (editLawyerId !== (ext.assignedLawyerId || '')) {
      const newLawyer = [...lawyers, ...staffMembers].find(l => l.id === editLawyerId);
      activities.push(createActivityLog(selectedId, actor.id, actor.name, actor.role, 'assigned',
        `담당 변호사 배정: ${newLawyer?.name || '미배정'}`));
    }

    await updateCrmExt(selectedId, {
      crmStatus: editStatus,
      assignedLawyerId: editLawyerId || undefined,
      assignedConsultantId: editConsultantId || undefined,
      assignedStaffId: editStaffId || undefined,
      activities,
    });
    alert('저장되었습니다.');
  };

  const handleTransfer = async () => {
    if (!selectedId || !transferTargetId) return;
    const ext = getCrmExt(selectedId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const target = [...lawyers, ...staffMembers].find(l => l.id === transferTargetId);
    
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'transferred',
      `사건 이관: ${target?.name || '알 수 없음'} (사유: ${transferReason || '없음'})`
    )];

    await updateCrmExt(selectedId, {
      assignedLawyerId: transferTargetId,
      activities,
    });
    setEditLawyerId(transferTargetId);
    setShowTransferModal(false);
    setTransferTargetId('');
    setTransferReason('');
    alert('사건이 이관되었습니다.');
  };

  const handleAddNote = async () => {
    if (!selectedId || !newNoteContent.trim()) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const note = createCrmNote(newNoteCategory, newNoteContent.trim(), actor.id, actor.name);
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `메모 추가 [${CRM_NOTE_CATEGORIES[newNoteCategory].label}]: ${newNoteContent.trim().slice(0, 30)}...`
    )];
    await updateCrmExt(selectedId, { notes: [...ext.notes, note], activities });
    setNewNoteContent('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    await updateCrmExt(selectedId, { notes: ext.notes.filter(n => n.id !== noteId) });
  };

  const handleToggleDocument = async (docId: string) => {
    if (!selectedId) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const docs = ext.documents.map(d => d.id === docId ? { ...d, checked: !d.checked, checkedBy: !d.checked ? actor.name : undefined, checkedAt: !d.checked ? new Date().toISOString() : undefined } : d);
    const toggled = docs.find(d => d.id === docId);
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'document_checked',
      `서류 ${toggled?.checked ? '확인' : '해제'}: ${toggled?.label}`
    )];
    await updateCrmExt(selectedId, { documents: docs, activities });
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    const member: StaffMember = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      isActive: true,
      assignedCount: 0,
      createdAt: new Date().toISOString(),
      permissions: DEFAULT_PERMISSIONS[newStaffRole],
    };
    setStaffMembers(prev => [...prev, member]);
    await saveStaffMember(member);
    setNewStaffName('');
  };

  const handleRemoveStaff = async (id: string) => {
    if (!confirm('이 직원을 삭제하시겠습니까?')) return;
    setStaffMembers(prev => prev.filter(m => m.id !== id));
    await deleteStaffMember(id);
  };

  // ── 일괄 작업 핸들러 ──
  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    for (const id of selectedIds) {
      const ext = getCrmExt(id);
      const activities = [...ext.activities, createActivityLog(
        id, actor.id, actor.name, actor.role, 'status_change',
        `일괄 상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[bulkStatus].label}`
      )];
      await updateCrmExt(id, { crmStatus: bulkStatus, activities });
    }
    setSelectedIds(new Set());
    alert(`${selectedIds.size}건 상태 변경 완료`);
  };

  const handleBulkAssign = async () => {
    if (selectedIds.size === 0 || !bulkAssignee) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const target = [...lawyers, ...staffMembers].find(l => l.id === bulkAssignee);
    for (const id of selectedIds) {
      const ext = getCrmExt(id);
      const activities = [...ext.activities, createActivityLog(
        id, actor.id, actor.name, actor.role, 'assigned',
        `일괄 배정: ${target?.name || '알 수 없음'}`
      )];
      await updateCrmExt(id, { assignedLawyerId: bulkAssignee, activities });
    }
    setSelectedIds(new Set());
    alert(`${selectedIds.size}건 배정 완료`);
  };

  // ── 칸반 드래그 ──
  const handleKanbanDrop = async (clientId: string, newStatus: CrmStatus) => {
    const ext = getCrmExt(clientId);
    if (ext.crmStatus === newStatus) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...ext.activities, createActivityLog(
      clientId, actor.id, actor.name, actor.role, 'status_change',
      `파이프라인 이동: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[newStatus].label}`
    )];
    await updateCrmExt(clientId, { crmStatus: newStatus, activities });
  };

  // ── 통계 ──
  const stats = useMemo(() => {
    const total = requests.length;
    const byStatus: Record<string, number> = {};
    CRM_STATUSES.forEach(s => byStatus[s] = 0);
    requests.forEach(r => {
      const ext = getCrmExt(r.id);
      byStatus[ext.crmStatus] = (byStatus[ext.crmStatus] || 0) + 1;
    });
    const consulting = (byStatus['consulting'] || 0) + (byStatus['contracted'] || 0);
    const active = (byStatus['document'] || 0) + (byStatus['filed'] || 0) + (byStatus['commenced'] || 0) + (byStatus['repaying'] || 0);
    const thisMonth = requests.filter(r => {
      const d = new Date(r.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, consulting, active, thisMonth, byStatus };
  }, [requests, getCrmExt]);

  // ── 담당자 이름 조회 헬퍼 ──
  const getStaffName = (id?: string) => {
    if (!id) return '미배정';
    const found = [...lawyers, ...staffMembers].find(l => l.id === id);
    return found?.name || '알 수 없음';
  };

  const getStaffRoleBadge = (id?: string) => {
    if (!id) return null;
    const staff = staffMembers.find(s => s.id === id);
    if (staff) {
      const cfg = STAFF_ROLE_CONFIG[staff.role];
      return <span className={`text-[8px] px-1 py-0.5 rounded ${cfg.bgColor} ${cfg.color} font-bold`}>{cfg.label}</span>;
    }
    const lawyer = lawyers.find(l => l.id === id);
    if (lawyer) return <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">변호사</span>;
    return null;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
  };

  // ══════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════

  return (
    <div className="space-y-4 animate-fadeIn">

      {/* ── 헤더 통계 ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              <span>상담 신청 고객 통합 관리 CRM</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">상담이 접수된 전체 의뢰인의 진단 결과, 담당자 지정 및 진행 단계를 상세 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 직원 전환 드롭다운 */}
            {currentPermissions.manageStaff && (
              <select
                value={activeStaff?.id || ''}
                onChange={(e) => {
                  const s = staffMembers.find(m => m.id === e.target.value);
                  if (s) setActiveStaff(s);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600"
              >
                {staffMembers.filter(m => m.isActive).map(m => (
                  <option key={m.id} value={m.id}>{STAFF_ROLE_CONFIG[m.role].label}: {m.name}</option>
                ))}
              </select>
            )}
            {currentPermissions.manageStaff && (
              <button onClick={() => setShowStaffPanel(!showStaffPanel)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors border border-slate-200"
                title="직원 관리">
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
            <div className="text-2xl font-black text-slate-800">{stats.total}</div>
            <div className="text-[10px] text-slate-400 font-bold">전체 고객</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-center">
            <div className="text-2xl font-black text-yellow-600">{stats.consulting}</div>
            <div className="text-[10px] text-yellow-500 font-bold">상담/수임 중</div>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
            <div className="text-2xl font-black text-emerald-600">{stats.active}</div>
            <div className="text-[10px] text-emerald-500 font-bold">진행 사건</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
            <div className="text-2xl font-black text-blue-600">+{stats.thisMonth}</div>
            <div className="text-[10px] text-blue-500 font-bold">이번달 신규</div>
          </div>
        </div>

        {/* 담당자별 건수 */}
        <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-slate-500">
          {staffMembers.filter(m => m.isActive).map(m => {
            const count = requests.filter(r => {
              const ext = getCrmExt(r.id);
              return ext.assignedLawyerId === m.id || ext.assignedConsultantId === m.id || ext.assignedStaffId === m.id;
            }).length;
            return (
              <span key={m.id} className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {m.name}({count})
              </span>
            );
          })}
          <span className="bg-red-50 px-2 py-0.5 rounded border border-red-100 text-red-400">
            미배정({requests.filter(r => { const ext = getCrmExt(r.id); return !ext.assignedLawyerId && !ext.assignedConsultantId; }).length})
          </span>
        </div>
      </div>

      {/* ── 직원 관리 패널 (토글) ── */}
      {showStaffPanel && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-brand" /> 법무법인 직원 관리
            </h3>
            <button onClick={() => setShowStaffPanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
          </div>

          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold">
                <th className="p-2">이름</th><th className="p-2">역할</th><th className="p-2">담당 건수</th><th className="p-2">상태</th><th className="p-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffMembers.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-800">{m.name}</td>
                  <td className="p-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${STAFF_ROLE_CONFIG[m.role].bgColor} ${STAFF_ROLE_CONFIG[m.role].color} font-bold border`}>
                      {STAFF_ROLE_CONFIG[m.role].label}
                    </span>
                  </td>
                  <td className="p-2 text-slate-500">
                    {requests.filter(r => { const ext = getCrmExt(r.id); return ext.assignedLawyerId === m.id || ext.assignedConsultantId === m.id || ext.assignedStaffId === m.id; }).length}건
                  </td>
                  <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${m.isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>{m.isActive ? '활성' : '비활성'}</span></td>
                  <td className="p-2 text-right">
                    {m.role !== 'OWNER' && (
                      <button onClick={() => handleRemoveStaff(m.id)} className="text-slate-400 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input type="text" placeholder="직원 이름" value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800" />
            <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value as StaffRole)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-600">
              <option value="LAWYER">담당 변호사</option>
              <option value="CONSULTANT">상담 직원</option>
              <option value="STAFF">사무 직원</option>
              <option value="ACCOUNTING">경리 직원</option>
            </select>
            <button onClick={handleAddStaff} className="bg-brand hover:bg-brand-hover text-white px-4 py-1.5 rounded-[200px] text-xs font-bold shrink-0">
              <Plus className="w-3.5 h-3.5 inline mr-1" />추가
            </button>
          </div>
        </div>
      )}

      {/* ── 검색 + 필터 + 뷰 토글 ── */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input type="text" placeholder="고객명 또는 연락처 검색..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white border border-slate-200 rounded-[200px] py-1.5 px-4 pl-9 text-xs focus:outline-none focus:ring-1 focus:ring-brand text-slate-800 placeholder-slate-400" />
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end items-center">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
            <option value="all">상태: 전체</option>
            {CRM_STATUSES.map(s => <option key={s} value={s}>{CRM_STATUS_CONFIG[s].emoji} {CRM_STATUS_CONFIG[s].label}</option>)}
          </select>

          <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
            <option value="all">담당자: 전체</option>
            <option value="unassigned">미배정</option>
            {staffMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
            <option value={10}>10건</option>
            <option value={20}>20건</option>
            <option value={50}>50건</option>
          </select>

          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-brand text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('kanban')} className={`p-1.5 ${viewMode === 'kanban' ? 'bg-brand text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 일괄 선택 액션 바 ── */}
      {selectedIds.size > 0 && currentPermissions.assignCases && (
        <div className="bg-brand/5 border border-brand/20 p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
          <span className="font-bold text-brand-light">☑ {selectedIds.size}건 선택됨</span>
          <div className="flex items-center gap-1">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as CrmStatus)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs">
              {CRM_STATUSES.map(s => <option key={s} value={s}>{CRM_STATUS_CONFIG[s].label}</option>)}
            </select>
            <button onClick={handleBulkStatusChange} className="bg-brand hover:bg-brand-hover text-white px-3 py-1 rounded-[200px] text-[11px] font-bold">
              상태 일괄 변경
            </button>
          </div>
          <div className="flex items-center gap-1">
            <select value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs">
              <option value="">담당자 선택</option>
              {staffMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={handleBulkAssign} disabled={!bulkAssignee}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1 rounded-[200px] text-[11px] font-bold">
              담당 일괄 배정
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 ml-auto text-[11px]">선택 해제</button>
        </div>
      )}

      {/* ══════════ 리스트 뷰 ══════════ */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 좌측: 테이블 */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                    <th className="p-2.5 w-8">
                      <input type="checkbox" checked={selectedIds.size === pagedRequests.length && pagedRequests.length > 0} onChange={handleSelectAll}
                        className="rounded border-slate-300" />
                    </th>
                    <th className="p-2.5 cursor-pointer hover:text-slate-600" onClick={() => handleSort('clientName')}>
                      고객명 {sortField === 'clientName' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-2.5 cursor-pointer hover:text-slate-600" onClick={() => handleSort('crmStatus')}>
                      상태 {sortField === 'crmStatus' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-2.5">담당자</th>
                    <th className="p-2.5 cursor-pointer hover:text-slate-600 text-right" onClick={() => handleSort('debtTotal')}>
                      총 채무 {sortField === 'debtTotal' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-2.5 cursor-pointer hover:text-slate-600 text-right" onClick={() => handleSort('createdAt')}>
                      등록일 {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRequests.map(r => {
                    const ext = getCrmExt(r.id);
                    const sc = CRM_STATUS_CONFIG[ext.crmStatus];
                    const isSelected = r.id === selectedId;
                    return (
                      <tr key={r.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-brand/5' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedId(r.id)}>
                        <td className="p-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleToggleSelect(r.id)} className="rounded border-slate-300" />
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-800">{r.clientName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{getDisplayPhoneNumber(r)}</div>
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${sc.bgColor} ${sc.color} ${sc.borderColor} font-bold`}>
                            {sc.emoji} {sc.label}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            {getStaffRoleBadge(ext.assignedLawyerId)}
                            <span className="text-[10px] text-slate-600">{getStaffName(ext.assignedLawyerId)}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-bold text-brand-light text-[11px]">
                          {r.financialProfile.debtTotal.toLocaleString()}만
                        </td>
                        <td className="p-2.5 text-right text-[10px] text-slate-400">
                          <div>{new Date(r.createdAt).toLocaleDateString()}</div>
                          <div className="text-slate-350">{timeAgo(ext.lastActivityAt)}</div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedRequests.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">검색 조건에 부합하는 고객이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-between p-3 border-t border-slate-100 text-xs text-slate-400">
              <span>총 {filteredRequests.length}건 중 {(page-1)*perPage+1}~{Math.min(page*perPage, filteredRequests.length)}건</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-[11px] font-bold ${p === page ? 'bg-brand text-white' : 'hover:bg-slate-100 text-slate-500'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>

          {/* 우측: 상세 패널 */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {selectedClient && selectedExt ? (
              <div className="space-y-0">
                {/* 헤더 */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                  <div>
                    <span className="text-[9px] text-brand font-bold block uppercase tracking-wider">CLIENT DETAIL</span>
                    <h3 className="text-base font-extrabold text-slate-800">{selectedClient.clientName}</h3>
                    <span className="text-[10px] text-slate-400">{getDisplayPhoneNumber(selectedClient)}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded border font-bold ${CRM_STATUS_CONFIG[selectedExt.crmStatus].bgColor} ${CRM_STATUS_CONFIG[selectedExt.crmStatus].color} ${CRM_STATUS_CONFIG[selectedExt.crmStatus].borderColor}`}>
                    {CRM_STATUS_CONFIG[selectedExt.crmStatus].emoji} {CRM_STATUS_CONFIG[selectedExt.crmStatus].label}
                  </span>
                </div>

                {/* 서브탭 */}
                <div className="flex border-b border-slate-100">
                  {([['info','👤 정보'],['docs','📂 서류'],['notes','📝 메모'],['timeline','📅 타임라인']] as [typeof detailTab, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => setDetailTab(key)}
                      className={`flex-1 py-2 text-[11px] font-bold transition-colors ${detailTab === key ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-slate-400 hover:text-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                  {/* ── 정보 탭 ── */}
                  {detailTab === 'info' && (
                    <>
                      {/* 인적 정보 */}
                      {currentPermissions.editClientInfo && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-slate-500 block">인적 정보</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400">의뢰인 이름</label>
                              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400">연락처</label>
                              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800" />
                            </div>
                          </div>
                          <button onClick={handleSaveClientInfo}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 py-1.5 rounded-[200px] text-xs font-semibold">
                            기본 정보 업데이트
                          </button>
                        </div>
                      )}


                      {/* 채무 현황 + 전체 프로필 */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 block">📊 채무 현황 및 의뢰인 프로필</span>
                        
                        {/* 핵심 4대 지표 */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div className="bg-red-50 p-2 rounded border border-red-100"><span className="text-red-300 block text-[9px]">총 채무</span><span className="font-extrabold text-red-500 text-sm">{selectedClient.financialProfile.debtTotal.toLocaleString()}만</span></div>
                          <div className="bg-blue-50 p-2 rounded border border-blue-100"><span className="text-blue-300 block text-[9px]">월 소득</span><span className="font-extrabold text-blue-600 text-sm">{selectedClient.financialProfile.income}만</span></div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-slate-400 block text-[9px]">자산 합산</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.assetsTotal.toLocaleString()}만</span></div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-slate-400 block text-[9px]">소득 대비 부채</span><span className="font-bold text-amber-500">{selectedClient.financialProfile.income > 0 ? (selectedClient.financialProfile.debtTotal / selectedClient.financialProfile.income).toFixed(1) : '-'}배</span></div>
                        </div>

                        {/* 인적사항 */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-500">
                          <span className="text-[9px] font-black text-indigo-400 tracking-wide uppercase block">👤 인적사항</span>
                          {selectedClient.financialProfile.age && (
                            <div className="flex justify-between"><span>나이</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.age}세</span></div>
                          )}
                          <div className="flex justify-between"><span>부양가족</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.dependents}명 ({selectedClient.financialProfile.dependents + 1}인 가구)</span></div>
                          {selectedClient.financialProfile.minorChildren !== undefined && (
                            <div className="flex justify-between"><span>미성년 자녀</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.minorChildren}명</span></div>
                          )}
                          <div className="flex justify-between"><span>혼인 상태</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : selectedClient.financialProfile.maritalStatus === 'MARRIED' ? '기혼' : '이혼'}</span></div>
                          {selectedClient.financialProfile.specialCondition && selectedClient.financialProfile.specialCondition !== 'none' && (
                            <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded text-[10px] text-emerald-600 font-bold text-center mt-1">
                              ⚡ 24개월 특례: {selectedClient.financialProfile.specialCondition === 'basic_recipient' ? '기초생활수급자' : selectedClient.financialProfile.specialCondition === 'severe_disability' ? '중증장애인' : '고령자'}
                            </div>
                          )}
                        </div>

                        {/* 직업·주거 정보 */}
                        {selectedClient.financialProfile.jobType && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-500">
                            <span className="text-[9px] font-black text-cyan-500 tracking-wide uppercase block">💼 직업 · 주거</span>
                            <div className="flex justify-between"><span>직업 유형</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.jobType === 'SALARIED' ? '급여소득' : selectedClient.financialProfile.jobType === 'BUSINESS' ? '영업소득' : selectedClient.financialProfile.jobType === 'DAILY' ? '일용직' : '프리랜서'}{selectedClient.financialProfile.companyName ? ` (${selectedClient.financialProfile.companyName})` : ''}</span></div>
                            {selectedClient.financialProfile.employmentDate && (
                              <div className="flex justify-between"><span>입사/개업일</span><span className="text-slate-700">{selectedClient.financialProfile.employmentDate}</span></div>
                            )}
                            <div className="flex justify-between"><span>거주 지역</span><span className="text-slate-700">{selectedClient.financialProfile.residenceRegion}</span></div>
                            {selectedClient.financialProfile.housingType && (
                              <div className="flex justify-between"><span>거주 형태</span><span className="text-slate-700">{selectedClient.financialProfile.housingType === 'rent' ? '월세' : selectedClient.financialProfile.housingType === 'jeonse' ? '전세' : selectedClient.financialProfile.housingType === 'owned' ? '자가' : '무상거주'}{selectedClient.financialProfile.housingContractHolder ? ` (${selectedClient.financialProfile.housingContractHolder === 'self' ? '본인' : selectedClient.financialProfile.housingContractHolder === 'spouse' ? '배우자' : '타인'}명의)` : ''}</span></div>
                            )}
                            <div className="flex justify-between"><span>임차 보증금</span><span className="text-slate-700">{selectedClient.financialProfile.rentalDeposit?.toLocaleString() || 0}만</span></div>
                            {selectedClient.financialProfile.depositLoan !== undefined && selectedClient.financialProfile.depositLoan > 0 && (
                              <div className="flex justify-between"><span>보증금 대출</span><span className="text-rose-400 font-bold">{selectedClient.financialProfile.depositLoan.toLocaleString()}만</span></div>
                            )}
                            {selectedClient.financialProfile.maritalStatus === 'MARRIED' && (
                              <>
                                <div className="flex justify-between"><span>배우자 재산</span><span className="text-slate-700">{selectedClient.financialProfile.spouseAsset?.toLocaleString() || 0}만</span></div>
                                {selectedClient.financialProfile.spouseIncome !== undefined && (
                                  <div className="flex justify-between"><span>배우자 소득</span><span className="text-slate-700">{selectedClient.financialProfile.spouseIncome}만</span></div>
                                )}
                              </>
                            )}
                            {selectedClient.financialProfile.maritalStatus === 'DIVORCED' && (
                              <>
                                {selectedClient.financialProfile.childSupportReceived !== undefined && selectedClient.financialProfile.childSupportReceived > 0 && (
                                  <div className="flex justify-between"><span>양육비 수령</span><span className="text-emerald-500">+{selectedClient.financialProfile.childSupportReceived}만</span></div>
                                )}
                                {selectedClient.financialProfile.childSupportPaid !== undefined && selectedClient.financialProfile.childSupportPaid > 0 && (
                                  <div className="flex justify-between"><span>양육비 지급</span><span className="text-rose-400">-{selectedClient.financialProfile.childSupportPaid}만</span></div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* 채무 상세 */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-500">
                          <span className="text-[9px] font-black text-red-400 tracking-wide uppercase block">⚠️ 채무 상세</span>
                          <div className="flex justify-between"><span>채무 원인</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.debtCause === 'LIVING' ? '생활비' : selectedClient.financialProfile.debtCause === 'BUSINESS' ? '사업 실패' : selectedClient.financialProfile.debtCause === 'INVESTMENT' ? '투자 실패' : selectedClient.financialProfile.debtCause === 'GAMBLING' ? '도박/사행성' : selectedClient.financialProfile.debtCause === 'GUARANTEE' ? '보증' : '기타'}</span></div>
                          {selectedClient.financialProfile.speculativeLoss !== undefined && selectedClient.financialProfile.speculativeLoss > 0 && (
                            <div className="flex justify-between text-rose-500 font-semibold"><span>1년내 투자 손실</span><span>{selectedClient.financialProfile.speculativeLoss.toLocaleString()}만</span></div>
                          )}
                          {selectedClient.financialProfile.gamblingLoss !== undefined && selectedClient.financialProfile.gamblingLoss > 0 && (
                            <div className="flex justify-between text-rose-500 font-semibold"><span>1년내 도박 채무</span><span>{selectedClient.financialProfile.gamblingLoss.toLocaleString()}만</span></div>
                          )}
                          <div className="flex justify-between text-amber-500"><span>추심 단계</span><span className="font-bold">{selectedClient.financialProfile.harassmentLevel === 'CALL' ? '추심전화' : selectedClient.financialProfile.harassmentLevel === 'LETTER' ? '독촉장' : selectedClient.financialProfile.harassmentLevel === 'LAWSUIT' ? '소송제기' : '압류/가압류'}</span></div>
                          {selectedClient.financialProfile.legalActions && selectedClient.financialProfile.legalActions.some(x => x !== 'none') && (
                            <div className="flex justify-between text-amber-600"><span>법적 조치</span><span className="font-bold">{selectedClient.financialProfile.legalActions.filter(x => x !== 'none').map(x => ({ collection_call: '독촉', court_order: '소장수령', seizure: '급여압류', property_seizure: '부동산압류', credit_drop: '신용하락' }[x] || x)).join(', ')}</span></div>
                          )}
                          <div className="flex justify-between"><span>채권자 수</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.creditorCount}곳</span></div>
                          {selectedClient.financialProfile.priorityDebt !== undefined && selectedClient.financialProfile.priorityDebt > 0 && (
                            <div className="flex justify-between"><span>우선변제 채무</span><span className="font-bold text-orange-500">{selectedClient.financialProfile.priorityDebt.toLocaleString()}만</span></div>
                          )}
                          {/* 채무 유형별 구성 */}
                          {(selectedClient.financialProfile.debtTypes.banks > 0 || selectedClient.financialProfile.debtTypes.cards > 0 || selectedClient.financialProfile.debtTypes.personals > 0) && (
                            <div className="border-t border-slate-200 mt-1 pt-1 space-y-0.5">
                              <span className="text-[9px] text-slate-400 font-bold">채무 유형별 구성</span>
                              {selectedClient.financialProfile.debtTypes.banks > 0 && (
                                <div className="flex justify-between"><span>은행 대출</span><span className="text-slate-700">{selectedClient.financialProfile.debtTypes.banks.toLocaleString()}만</span></div>
                              )}
                              {selectedClient.financialProfile.debtTypes.cards > 0 && (
                                <div className="flex justify-between"><span>카드 채무</span><span className="text-slate-700">{selectedClient.financialProfile.debtTypes.cards.toLocaleString()}만</span></div>
                              )}
                              {selectedClient.financialProfile.debtTypes.personals > 0 && (
                                <div className="flex justify-between"><span>사인간 채무</span><span className="text-slate-700">{selectedClient.financialProfile.debtTypes.personals.toLocaleString()}만</span></div>
                              )}
                              {selectedClient.financialProfile.debtTypes.recentLoans > 0 && (
                                <div className="flex justify-between text-rose-400"><span>최근 고위험 대출</span><span className="font-bold">{selectedClient.financialProfile.debtTypes.recentLoans.toLocaleString()}만</span></div>
                              )}
                              {selectedClient.financialProfile.debtTypes.coinCrypto > 0 && (
                                <div className="flex justify-between text-rose-400"><span>코인/주식 손실</span><span className="font-bold">{selectedClient.financialProfile.debtTypes.coinCrypto.toLocaleString()}만</span></div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 생계비 구성 */}
                        {(selectedClient.financialProfile.rentCost || selectedClient.financialProfile.medicalCost || selectedClient.financialProfile.educationCost || selectedClient.financialProfile.monthlyFixedExpenses) && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-500">
                            <span className="text-[9px] font-black text-teal-500 tracking-wide uppercase block">🏠 월 생계비 구성</span>
                            {selectedClient.financialProfile.rentCost !== undefined && selectedClient.financialProfile.rentCost > 0 && (
                              <div className="flex justify-between"><span>월세</span><span className="text-slate-700">{selectedClient.financialProfile.rentCost}만</span></div>
                            )}
                            {selectedClient.financialProfile.medicalCost !== undefined && selectedClient.financialProfile.medicalCost > 0 && (
                              <div className="flex justify-between"><span>의료비</span><span className="text-slate-700">{selectedClient.financialProfile.medicalCost}만</span></div>
                            )}
                            {selectedClient.financialProfile.educationCost !== undefined && selectedClient.financialProfile.educationCost > 0 && (
                              <div className="flex justify-between"><span>교육비</span><span className="text-slate-700">{selectedClient.financialProfile.educationCost}만</span></div>
                            )}
                            {selectedClient.financialProfile.specialEducationCost !== undefined && selectedClient.financialProfile.specialEducationCost > 0 && (
                              <div className="flex justify-between"><span>특수교육비</span><span className="text-slate-700">{selectedClient.financialProfile.specialEducationCost}만</span></div>
                            )}
                            {selectedClient.financialProfile.monthlyFixedExpenses !== undefined && selectedClient.financialProfile.monthlyFixedExpenses > 0 && (
                              <div className="flex justify-between"><span>고정지출 (통신/보험)</span><span className="text-slate-700">{selectedClient.financialProfile.monthlyFixedExpenses}만</span></div>
                            )}
                          </div>
                        )}

                        {/* 퇴직금 */}
                        {selectedClient.financialProfile.retirementPay !== undefined && selectedClient.financialProfile.retirementPay > 0 && (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-500">
                            <span className="text-[9px] font-black text-amber-500 tracking-wide uppercase block">💼 퇴직금</span>
                            <div className="flex justify-between"><span>예상 퇴직금</span><span className="font-bold text-slate-700">{selectedClient.financialProfile.retirementPay.toLocaleString()}만</span></div>
                            <div className="flex justify-between"><span>퇴직연금 형태</span><span className={selectedClient.financialProfile.retirementPensionType === 'unknown' ? 'font-bold text-amber-500' : 'text-slate-700'}>{selectedClient.financialProfile.retirementPensionType === 'pension' ? '퇴직연금 가입 (0% 반영)' : selectedClient.financialProfile.retirementPensionType === 'none' ? '미가입 (50% 반영)' : '모름 (50% 반영)'}</span></div>
                            {selectedClient.financialProfile.retirementPensionType === 'unknown' && (
                              <div className="bg-amber-50 border border-amber-200 p-1.5 rounded text-[10px] text-amber-600 font-bold text-center">⚠️ 퇴직금 가입 형태 확인 필요</div>
                            )}
                          </div>
                        )}

                        {/* 리스크 플래그 */}
                        {selectedClient.financialProfile.riskFlags && selectedClient.financialProfile.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {selectedClient.financialProfile.riskFlags.map((flag, i) => (
                              <span key={i} className="text-[9px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-bold">🚨 {flag}</span>
                            ))}
                          </div>
                        )}
                      </div>


                      {/* 배정 + 상태 */}
                      {currentPermissions.changeStatus && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[11px] font-bold text-brand-light block">⚙️ 담당자 배정 및 상태</span>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 shrink-0">진행 상태:</span>
                              <select value={editStatus} onChange={e => setEditStatus(e.target.value as CrmStatus)}
                                className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600 flex-1">
                                {CRM_STATUSES.map(s => <option key={s} value={s}>{CRM_STATUS_CONFIG[s].emoji} {CRM_STATUS_CONFIG[s].label}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 shrink-0">담당 변호사:</span>
                              <select value={editLawyerId} onChange={e => setEditLawyerId(e.target.value)}
                                className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600 flex-1">
                                <option value="">미배정</option>
                                {[...lawyers, ...staffMembers.filter(m => m.role === 'LAWYER')].map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 shrink-0">상담 직원:</span>
                              <select value={editConsultantId} onChange={e => setEditConsultantId(e.target.value)}
                                className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600 flex-1">
                                <option value="">미배정</option>
                                {staffMembers.filter(m => m.role === 'CONSULTANT' && m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 shrink-0">사무 직원:</span>
                              <select value={editStaffId} onChange={e => setEditStaffId(e.target.value)}
                                className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600 flex-1">
                                <option value="">미배정</option>
                                {staffMembers.filter(m => m.role === 'STAFF' && m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <button onClick={handleSaveAssignment}
                            className="w-full bg-brand hover:bg-brand-hover text-white py-2 rounded-[200px] text-xs font-extrabold mt-1">
                            배정 및 상태 저장
                          </button>
                        </div>
                      )}

                      {/* 이관 */}
                      {currentPermissions.assignCases && (
                        <div className="space-y-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                          <span className="text-[11px] font-bold text-amber-600 block">↔️ 사건 이관</span>
                          <div className="flex gap-2">
                            <select value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)}
                              className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600 flex-1">
                              <option value="">이관 대상 선택</option>
                              {[...lawyers, ...staffMembers.filter(m => m.role === 'LAWYER')].filter(l => l.id !== editLawyerId).map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          </div>
                          <input type="text" placeholder="이관 사유 (선택)" value={transferReason} onChange={e => setTransferReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800" />
                          <button onClick={handleTransfer} disabled={!transferTargetId}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-1.5 rounded-[200px] text-xs font-bold flex items-center justify-center gap-1">
                            <ArrowRightLeft className="w-3.5 h-3.5" /> 사건 이관 실행
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── 서류 탭 ── */}
                  {detailTab === 'docs' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">📂 필수 서류 체크리스트</span>
                        <span className="text-[10px] text-brand font-bold">
                          {selectedExt.documents.filter(d => d.checked).length}/{selectedExt.documents.length} 완료
                        </span>
                      </div>
                      {/* 프로그레스 바 */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-brand rounded-full h-1.5 transition-all"
                          style={{ width: `${(selectedExt.documents.filter(d => d.checked).length / Math.max(1, selectedExt.documents.length)) * 100}%` }} />
                      </div>
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {selectedExt.documents.map(doc => (
                          <div key={doc.id} onClick={() => handleToggleDocument(doc.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${doc.checked ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}>
                            <span className={`text-sm ${doc.checked ? 'text-emerald-500' : 'text-slate-300'}`}>{doc.checked ? '☑' : '☐'}</span>
                            <span className={`text-xs flex-1 ${doc.checked ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{doc.label}</span>
                            {doc.checkedBy && <span className="text-[9px] text-slate-400">{doc.checkedBy}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 메모 탭 ── */}
                  {detailTab === 'notes' && currentPermissions.writeNotes && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-500 block">📝 CRM 상담 기록</span>
                      {/* 카테고리 + 입력 */}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(Object.entries(CRM_NOTE_CATEGORIES) as [CrmNoteCategory, typeof CRM_NOTE_CATEGORIES[CrmNoteCategory]][]).map(([key, cfg]) => (
                          <button key={key} onClick={() => setNewNoteCategory(key)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${newNoteCategory === key ? `${cfg.color} bg-white border-current font-bold` : 'text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                            {cfg.emoji} {cfg.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="상담 메모 입력..." value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800" />
                        <button onClick={handleAddNote} className="bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-[200px] text-xs font-semibold shrink-0">추가</button>
                      </div>
                      <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                        {[...selectedExt.notes].reverse().map(note => {
                          const catCfg = CRM_NOTE_CATEGORIES[note.category];
                          return (
                            <div key={note.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${catCfg.color} bg-white border font-bold`}>{catCfg.emoji} {catCfg.label}</span>
                                  <span className="text-[10px] text-slate-400">{note.authorName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-350">{timeAgo(note.createdAt)}</span>
                                  <button onClick={() => handleDeleteNote(note.id)} className="text-slate-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                              <p className="text-slate-600 leading-relaxed">{note.content}</p>
                            </div>
                          );
                        })}
                        {selectedExt.notes.length === 0 && (
                          <div className="text-center py-6 text-slate-400 text-[11px]">기록된 메모가 없습니다.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── 타임라인 탭 ── */}
                  {detailTab === 'timeline' && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 block">📅 활동 타임라인</span>
                      <div className="space-y-0 max-h-[450px] overflow-y-auto">
                        {[...selectedExt.activities].reverse().map((act, idx) => (
                          <div key={act.id} className="flex gap-3 pb-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                act.type === 'status_change' ? 'bg-blue-400' :
                                act.type === 'assigned' ? 'bg-emerald-400' :
                                act.type === 'transferred' ? 'bg-amber-400' :
                                act.type === 'document_checked' ? 'bg-purple-400' :
                                act.type === 'note_added' ? 'bg-slate-400' :
                                'bg-slate-300'
                              }`} />
                              {idx < selectedExt.activities.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                            </div>
                            <div className="flex-1 pb-1">
                              <p className="text-xs text-slate-700">{act.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-400">{act.actorName}</span>
                                <span className="text-[9px] text-slate-350">{new Date(act.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedExt.activities.length === 0 && (
                          <div className="text-center py-6 text-slate-400 text-[11px]">활동 기록이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                고객 리스트에서 상세 조회할 고객을 선택해 주십시오.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ 칸반 뷰 ══════════ */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {CRM_STATUSES.map(status => {
              const sc = CRM_STATUS_CONFIG[status];
              const clients = filteredRequests.filter(r => getCrmExt(r.id).crmStatus === status);
              return (
                <div key={status}
                  className="w-56 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    const clientId = e.dataTransfer.getData('clientId');
                    if (clientId) handleKanbanDrop(clientId, status);
                  }}>
                  {/* 컬럼 헤더 */}
                  <div className={`p-3 border-b border-slate-100 ${sc.bgColor}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${sc.color}`}>{sc.emoji} {sc.label}</span>
                      <span className={`text-[10px] ${sc.color} font-bold bg-white/50 px-1.5 py-0.5 rounded`}>{clients.length}</span>
                    </div>
                  </div>
                  {/* 카드 */}
                  <div className="p-2 space-y-2 min-h-[100px] max-h-[500px] overflow-y-auto">
                    {clients.map(r => {
                      const ext = getCrmExt(r.id);
                      return (
                        <div key={r.id}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('clientId', r.id)}
                          onClick={() => { setSelectedId(r.id); setViewMode('list'); }}
                          className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 hover:border-brand/30 cursor-pointer transition-all hover:shadow-sm group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800 truncate">{r.clientName}</span>
                            <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                          </div>
                          <div className="text-[10px] text-red-400 font-bold">{r.financialProfile.debtTotal.toLocaleString()}만</div>
                          <div className="flex items-center gap-1 mt-1.5">
                            {getStaffRoleBadge(ext.assignedLawyerId)}
                            <span className="text-[9px] text-slate-400 truncate">{getStaffName(ext.assignedLawyerId)}</span>
                          </div>
                          <div className="text-[9px] text-slate-350 mt-1">{timeAgo(ext.lastActivityAt)}</div>
                        </div>
                      );
                    })}
                    {clients.length === 0 && (
                      <div className="text-center py-4 text-[10px] text-slate-400">없음</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
