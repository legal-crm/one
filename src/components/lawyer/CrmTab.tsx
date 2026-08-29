import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Plus, Trash2, Search, LayoutGrid, List, GripVertical,
  CheckCircle2, ArrowRightLeft, UserPlus, Settings, Filter,
  FileText, Clock, AlertTriangle, X, Star, Download, Upload, RotateCcw, Check,
  Phone, Copy, Edit3, Sparkles, TrendingDown, Scale, Calculator,
  Building2, Home, AlertCircle, Calendar, BadgePercent, Coins, Briefcase,
  ShieldCheck, FileCheck2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import TeamworkTab from './TeamworkTab';
import NewCaseModal from './NewCaseModal';
import type { NewCaseData } from './NewCaseModal';
import ImportCasesModal from './ImportCasesModal';
import type { ImportedCase } from './ImportCasesModal';
import ExportCasesModal from './ExportCasesModal';
import DropOffReasonModal from './DropOffReasonModal';
import AssignmentDirectiveModal from './AssignmentDirectiveModal';
import type { 
  ConsultRequest, User, StaffMember, StaffRole, CrmStatus, CrmClientExtension,
  CrmNote, CrmNoteCategory, DocumentCheckItem, CrmActivityLog,
  ConsultOutcome, NoteReminder, DropOffReason,
  DirectivePriority, AssignmentDirective
} from '../../types';
import { 
  CRM_STATUS_CONFIG, STAFF_ROLE_CONFIG, CRM_NOTE_CATEGORIES, 
  DEFAULT_REHAB_DOCUMENTS, DEFAULT_PERMISSIONS, OUTCOME_CONFIG,
  DIRECTIVE_PRIORITY_CONFIG
} from '../../types';
import { 
  loadCrmData, saveCrmClient, loadStaffMembers, saveStaffMember, 
  deleteStaffMember, createActivityLog, createCrmNote, createDefaultCrmExtension,
  deleteCrmClient, softDeleteCrmClient, restoreCrmClient, cleanupRecycleBin,
  formatPhone, checkDuplicatePhone,
  type CrmDataStore 
} from '../../services/crmService';
import { createEvent as createCalendarEvent } from '../../services/calendarEventService';
import type { FeeInstallment, IntakeChannel, CorrectionOrder, DocumentFile, AlimtokLog, AlimtokMilestone } from '../../types';
import { INTAKE_CHANNEL_CONFIG, DOC_CATEGORY_CONFIG, ALIMTOK_MILESTONE_CONFIG, STATUS_TO_MILESTONE } from '../../types';
import { triggerAlimtokOnStatusChange } from '../../services/alimtokService';
import { loadNotificationSettings } from '../../services/notificationService';

interface CrmTabProps {
  requests: ConsultRequest[];
  lawyers: User[];
  activeLawyer: User;
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  getDisplayPhoneNumber: (r: ConsultRequest) => string;
  handleOpenProposalDraft?: (requestId: string) => void;
  setActiveTab?: (tab: string) => void;
  setCopilotPreselectedReqId?: (id: string) => void;
  initialView?: 'leads';
}

type SortField = 'clientName' | 'createdAt' | 'debtTotal' | 'crmStatus' | 'lastActivity' | 'income' | 'reminderCount';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'kanban' | 'leads';

const CRM_STATUSES: CrmStatus[] = ['requested','consulting','contracted','document','filed','commenced','repaying','discharged','cancelled'];

/** 등록 후 48시간 이내 → NEW 뱃지 표시 */
const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;
function isNewCase(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}
/** 재사용 가능한 NEW 뱃지 */
function NewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black tracking-wider text-white bg-rose-500 px-1.5 py-[1px] rounded-md shadow-sm animate-pulse whitespace-nowrap ${className}`}>
      NEW
    </span>
  );
}

export default function CrmTab({ requests, lawyers, activeLawyer, setRequests, getDisplayPhoneNumber, handleOpenProposalDraft, setActiveTab, setCopilotPreselectedReqId, initialView }: CrmTabProps) {
  // ── 기본 State ──
  const [crmData, setCrmData] = useState<CrmDataStore>({});
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView || 'list');
  
  // ── 검색/필터/정렬 ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<CrmStatus>('requested');
  const [editLawyerId, setEditLawyerId] = useState('');       // legacy (이관 등에서 아직 사용)
  const [editConsultantId, setEditConsultantId] = useState(''); // legacy
  const [editStaffId, setEditStaffId] = useState('');           // legacy
  const [editAssigneeId, setEditAssigneeId] = useState('');     // 통합 담당자
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<CrmNoteCategory>('consult');
  const [newNoteOutcome, setNewNoteOutcome] = useState<import('../../types').ConsultOutcome | ''>('');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderAction, setReminderAction] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMemo, setReminderMemo] = useState('');
  
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
  const [detailTab, setDetailTab] = useState<'info' | 'notes' | 'teamwork' | 'timeline' | 'fees' | 'documents' | 'corrections' | 'court' | 'repayment'>('info');

  const [showBulkMessage, setShowBulkMessage] = useState(false);
  const [bulkFilter, setBulkFilter] = useState<string>('doc_overdue');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // ── 케이스 관리 확장 (LeadMaster 이식) ──
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDropOffModalOpen, setIsDropOffModalOpen] = useState(false);
  const [dropOffTargetId, setDropOffTargetId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [starFilter, setStarFilter] = useState(false);

  // ── 배정 지시 모달 ──
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    clientId: string;
    lawyerId: string;
    consultantId: string;
    staffId: string;
    status: CrmStatus;
  } | null>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    loadCrmData().then(data => {
      setCrmData(data);
      // 30일 경과 휴지통 자동 정리
      const cleaned = cleanupRecycleBin();
      if (cleaned > 0) toast.info(`휴지통 ${cleaned}건 자동 정리됨`);
    });
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
          status: 'active',
        };
        setStaffMembers([defaultOwner]);
        setActiveStaff(defaultOwner);
        saveStaffMember(defaultOwner);
      }
    });
  }, [activeLawyer.id, activeLawyer.name]);

  // ── ConsultRequest 상태 → CRM 확장 데이터 자동 동기화 (현재 변호사 관련 요청만) ──
  useEffect(() => {
    requests.forEach(r => {
      // 현재 변호사에게 관련된 요청만 동기화
      const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
      const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
        const targetLawyer = lawyers.find(l => l.id === id);
        return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
      });
      const openMatch = r.requestType === 'open';
      if (!directMatch && !sameFirmMatch && !openMatch) return;

      if (r.status === 'cancelled') {
        const ext = crmData[r.id] || createDefaultCrmExtension(r.id);
        if (ext.crmStatus !== 'cancelled') {
          const updated = { 
            ...ext, 
            crmStatus: 'cancelled' as CrmStatus,
            lastActivityAt: new Date().toISOString(),
            activities: [
              ...(ext.activities || []),
              {
                id: `act-cancel-${Date.now()}`,
                clientId: r.id,
                actorId: 'system',
                actorName: '시스템',
                actorRole: 'OWNER' as StaffRole,
                type: 'status_change' as CrmActivityType,
                description: '의뢰인이 상담 요청을 취소하였습니다.',
                createdAt: new Date().toISOString(),
              },
            ],
          };
          setCrmData(prev => ({ ...prev, [r.id]: updated }));
          saveCrmClient(r.id, updated);
        }
      }
    });
  }, [requests, crmData]);

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
      // 현재 변호사에게 관련된 요청만 표시
      const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
      const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
        const targetLawyer = lawyers.find(l => l.id === id);
        return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
      });
      const openMatch = r.requestType === 'open';
      if (!directMatch && !sameFirmMatch && !openMatch) return false;

      const ext = getCrmExt(r.id);

      // ── 휴지통 뷰 분리 ──
      if (showTrash) {
        return !!ext.deletedAt; // 휴지통에서는 삭제된 건만 표시
      } else {
        if (ext.deletedAt) return false; // 일반 뷰에서는 삭제된 건 숨김
      }

      const matchSearch = 
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search);
      
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'consulting' ? ['requested','consulting'].includes(ext.crmStatus) :
         statusFilter === 'contracted' ? ['contracted','document','filed','commenced','repaying'].includes(ext.crmStatus) :
         statusFilter === 'discharged' ? ['discharged','cancelled'].includes(ext.crmStatus) :
         ext.crmStatus === statusFilter);
      
      // 완료 건 숨기기 (전체 보기에서만 적용)
      if (hideCompleted && statusFilter === 'all' && ['discharged','cancelled'].includes(ext.crmStatus)) return false;
      
      if (channelFilter !== 'all') {
        if ((ext.intakeChannel || 'mykim') !== channelFilter) return false;
      }
      
      let matchAssignee = true;
      const effectiveAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
      if (assigneeFilter === 'unassigned') {
        matchAssignee = !effectiveAssignee;
      } else if (assigneeFilter !== 'all') {
        matchAssignee = effectiveAssignee === assigneeFilter;
      }

      // 권한에 따른 필터 (본인 배정 건만)
      if (!currentPermissions.viewAllClients && activeStaff) {
        if (effectiveAssignee !== activeStaff.id) return false;
      }

      // ── 기간 필터 ──
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00');
        if (new Date(r.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59');
        if (new Date(r.createdAt) > to) return false;
      }

      // ── 즐겨찾기 필터 ──
      if (starFilter && !ext.isStarred) return false;
      
      return matchSearch && matchStatus && matchAssignee;
    });

    // 정렬
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'clientName': cmp = a.clientName.localeCompare(b.clientName); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'debtTotal': cmp = a.financialProfile.debtTotal - b.financialProfile.debtTotal; break;
        case 'income': cmp = a.financialProfile.income - b.financialProfile.income; break;
        case 'lastActivity': {
          const aLast = getCrmExt(a.id).activities.length > 0 ? new Date(getCrmExt(a.id).activities[getCrmExt(a.id).activities.length - 1].timestamp).getTime() : new Date(a.createdAt).getTime();
          const bLast = getCrmExt(b.id).activities.length > 0 ? new Date(getCrmExt(b.id).activities[getCrmExt(b.id).activities.length - 1].timestamp).getTime() : new Date(b.createdAt).getTime();
          cmp = aLast - bLast; break;
        }
        case 'reminderCount': {
          const aRem = getCrmExt(a.id).notes.filter(n => n.reminder && !n.reminder.completed).length;
          const bRem = getCrmExt(b.id).notes.filter(n => n.reminder && !n.reminder.completed).length;
          cmp = aRem - bRem; break;
        }
        case 'crmStatus': {
          const ai = CRM_STATUSES.indexOf(getCrmExt(a.id).crmStatus);
          const bi = CRM_STATUSES.indexOf(getCrmExt(b.id).crmStatus);
          cmp = ai - bi; break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [requests, search, statusFilter, hideCompleted, assigneeFilter, channelFilter, sortField, sortDir, getCrmExt, currentPermissions, activeStaff, activeLawyer, lawyers, showTrash, dateFrom, dateTo, starFilter]);

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
      setEditAssigneeId(selectedExt.assigneeId || selectedExt.assignedLawyerId || selectedExt.assignedConsultantId || '');
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
    const ext = getCrmExt(selectedId);
    const currentAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || '';
    
    // 담당자가 변경되었는지 확인
    const assigneeChanged = editAssigneeId !== currentAssignee;
    
    if (assigneeChanged && editAssigneeId) {
      // 담당자 변경 → 배정 지시 모달 팝업
      setPendingAssignment({
        clientId: selectedId,
        lawyerId: editAssigneeId,
        consultantId: '',
        staffId: '',
        status: editStatus,
      });
      setShowDirectiveModal(true);
    } else {
      // 담당자 변경 없음 또는 미배정으로 변경 → 즉시 저장
      await executeAssignment(selectedId, editStatus, editAssigneeId);
    }
  };

  /** 실제 배정 저장 실행 (모달 결과와 무관하게 호출) */
  const executeAssignment = async (
    clientId: string, status: CrmStatus, assigneeId: string,
    directive?: { memo: string; priority: DirectivePriority; deadline?: string }
  ) => {
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(clientId);
    const activities = [...ext.activities];
    
    if (status !== ext.crmStatus) {
      activities.push(createActivityLog(clientId, actor.id, actor.name, actor.role, 'status_change',
        `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[status].label}`));
    }

    // 배정 대상 정보 파악
    const currentAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || '';
    const newAssignee = [...lawyers, ...staffMembers].find(l => l.id === assigneeId);
    
    if (assigneeId !== currentAssignee) {
      const desc = directive?.memo
        ? `담당자 배정: ${newAssignee?.name || '미배정'} (지시: ${directive.memo.slice(0, 40)}${directive.memo.length > 40 ? '...' : ''})`
        : `담당자 배정: ${newAssignee?.name || '미배정'}`;
      activities.push(createActivityLog(clientId, actor.id, actor.name, actor.role, 'assigned', desc));
    }

    // 배정 지시(Directive) 생성
    let directives = [...(ext.assignmentDirectives || [])];
    if (directive && newAssignee) {
      const newDirective: AssignmentDirective = {
        id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clientId,
        assigneeId: newAssignee.id,
        assigneeName: newAssignee.name,
        assigneeRole: ('role' in newAssignee ? newAssignee.role : 'LAWYER') as StaffRole,
        assignedById: actor.id,
        assignedByName: actor.name,
        assignedByRole: actor.role,
        memo: directive.memo || undefined,
        priority: directive.priority,
        deadline: directive.deadline,
        createdAt: new Date().toISOString(),
      };
      directives.push(newDirective);
    }

    await updateCrmExt(clientId, {
      crmStatus: status,
      assigneeId: assigneeId || undefined,
      assignedLawyerId: assigneeId || undefined,  // 하위 호환
      activities,
      assignmentDirectives: directives.length > 0 ? directives : undefined,
    });
    toast.success('배정이 저장되었습니다.');
  };

  /** 배정 지시 모달: 지시사항과 함께 배정 */
  const handleDirectiveSubmit = async (data: { memo: string; priority: DirectivePriority; deadline?: string }) => {
    if (!pendingAssignment) return;
    await executeAssignment(pendingAssignment.clientId, pendingAssignment.status, pendingAssignment.lawyerId, data);
    setShowDirectiveModal(false);
    setPendingAssignment(null);
  };

  /** 배정 지시 모달: 메모 없이 배정 */
  const handleDirectiveSkip = async () => {
    if (!pendingAssignment) return;
    await executeAssignment(pendingAssignment.clientId, pendingAssignment.status, pendingAssignment.lawyerId);
    setShowDirectiveModal(false);
    setPendingAssignment(null);
  };

  /** 배정 지시 확인 완료 핸들러 */
  const handleAcknowledgeDirective = async (directiveId: string) => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const directives = (ext.assignmentDirectives || []).map(d =>
      d.id === directiveId ? { ...d, acknowledgedAt: new Date().toISOString(), acknowledgedById: actor.id } : d
    );
    await updateCrmExt(selectedId, { assignmentDirectives: directives });
    toast.success('배정 지시를 확인했습니다.');
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
      assigneeId: transferTargetId,
      assignedLawyerId: transferTargetId,  // 하위 호환
      activities,
    });
    setEditAssigneeId(transferTargetId);
    setEditLawyerId(transferTargetId);
    setShowTransferModal(false);
    setTransferTargetId('');
    setTransferReason('');
    toast.success('사건이 이관되었습니다.');
  };

  const handleAddNote = async () => {
    if (!selectedId || !newNoteContent.trim()) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const selectedReq = requests.find(r => r.id === selectedId);
    const clientName = selectedReq?.clientName || '';

    // Build reminder
    let reminder: NoteReminder | undefined;
    if (showReminder && reminderDate && reminderAction.trim()) {
      const tenantId = activeLawyer.lawFirmId || activeLawyer.id;
      const calEvt = await createCalendarEvent(tenantId, {
        title: `[\u{1F514}] ${clientName} - ${reminderAction.trim()}`,
        date: reminderDate,
        type: 'deadline',
        visibility: 'personal',
        createdBy: actor.id,
        createdByName: actor.name,
        createdByRole: actor.role as string,
        description: reminderMemo.trim() || undefined,
      });
      reminder = { date: reminderDate, time: reminderTime || undefined, action: reminderAction.trim(), memo: reminderMemo.trim() || undefined, completed: false, calendarEventId: calEvt.id };
    }

    const note = createCrmNote(
      newNoteCategory, newNoteContent.trim(), actor.id, actor.name,
      newNoteOutcome || undefined, reminder
    );
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `\uBA54\uBAA8 \uCD94\uAC00 [${CRM_NOTE_CATEGORIES[newNoteCategory].label}]: ${newNoteContent.trim().slice(0, 30)}...`
    )];
    await updateCrmExt(selectedId, { notes: [...ext.notes, note], activities });
    setNewNoteContent('');
    setNewNoteOutcome('');
    setShowReminder(false);
    setReminderDate('');
    setReminderAction('');
    setReminderTime('');
    setReminderMemo('');
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
      status: 'active',
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
      await updateCrmExt(id, { assigneeId: bulkAssignee, assignedLawyerId: bulkAssignee, activities });
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
    
    // 알림톡 자동 트리거
    try {
      const notiSettings = loadNotificationSettings();
      if (notiSettings.kakao.autoTrigger) {
        const clientReq = requests.find(r => r.id === clientId);
        if (clientReq) {
          triggerAlimtokOnStatusChange(ext.crmStatus, newStatus, {
            clientName: clientReq.clientName, phone: clientReq.phone,
            firmName: notiSettings.kakao.firmName, lawyerName: notiSettings.kakao.lawyerName,
          }, notiSettings.kakao);
        }
      }
    } catch {}
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
      return <span className={`text-[10px] px-1 py-0.5 rounded ${cfg.bgColor} ${cfg.color} font-bold`}>{cfg.label}</span>;
    }
    const lawyer = lawyers.find(l => l.id === id);
    if (lawyer) return <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">변호사</span>;
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

  // ── 케이스 관리 핸들러 (LeadMaster 이식) ──

  /** 신규 케이스 등록 핸들러 */
  const handleNewCaseRegister = useCallback((data: NewCaseData) => {
    const newId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRequest: ConsultRequest = {
      id: newId, clientId: newId, clientName: data.clientName, phone: data.phone,
      requestType: 'direct', maxParticipants: 1, status: 'counseling',
      createdAt: new Date().toISOString(), title: `[외부] ${data.clientName} 상담`,
      content: data.channelDetail || '',
      financialProfile: {
        clientName: data.clientName, age: 0, gender: data.gender === '여' ? 'female' : 'male',
        maritalStatus: data.maritalStatus === '기혼' ? 'MARRIED' : data.maritalStatus === '이혼' ? 'DIVORCED' : 'SINGLE',
        dependents: data.childrenCount || 0, minorChildren: data.childrenCount || 0,
        income: data.income || 0, debtTotal: data.debtTotal || 0,
        priorityDebt: 0, assetsTotal: 0, creditorCount: 0,
        jobType: (data.jobTypes?.[0] === '직장인' ? 'SALARIED' : data.jobTypes?.[0] === '개인사업자' ? 'SELF_EMPLOYED' : data.jobTypes?.[0] === '프리랜서' ? 'FREELANCE' : 'UNEMPLOYED') as any,
        companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: data.region || '',
        workLocation: '', housingType: (data.housingType === '전세' ? 'jeonse' : data.housingType === '월세' ? 'rent' : data.housingType === '자가' ? 'owned' : 'rent') as any,
        housingContractHolder: 'self',
        debtCause: 'LIVING', harassmentLevel: 'NONE',
        debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
        legalActions: [], myAssets: 0, spouseAsset: 0, spouseIncome: 0,
        rentalDeposit: data.deposit || 0, depositLoan: 0, rentCost: data.rent || 0,
        medicalCost: 0, educationCost: 0, monthlyFixedExpenses: data.loanMonthlyPay || 0,
        retirementPay: 0, retirementPensionType: 'none', specialCondition: 'none',
        riskFlags: [], clientNotes: [], debts: [], assets: [],
      },
    };
    setRequests(prev => [newRequest, ...prev]);
    const ext = createDefaultCrmExtension(newId);
    ext.crmStatus = data.initialStatus;
    ext.intakeChannel = data.intakeChannel;
    ext.intakeChannelDetail = data.channelDetail;
    ext.isExternalClient = true;
    ext.caseType = data.caseType;
    ext.region = data.region;
    if (data.specialMemo) {
      ext.preInfo = data.specialMemo;
    }
    setCrmData(prev => ({ ...prev, [newId]: ext }));
    saveCrmClient(newId, ext);
    setIsNewCaseModalOpen(false);
    toast.success(`${data.clientName} 건이 등록되었습니다.`);
  }, [setRequests]);

  /** 대량 업로드 핸들러 */
  const handleBulkImport = useCallback((cases: ImportedCase[]) => {
    let successCount = 0;
    cases.forEach(c => {
      const newId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newRequest: ConsultRequest = {
        id: newId, clientId: newId, clientName: c.clientName, phone: c.phone,
        requestType: 'direct', maxParticipants: 1, status: 'counseling',
        createdAt: new Date().toISOString(), title: `[일괄] ${c.clientName} 상담`,
        content: c.specialMemo || '',
        financialProfile: {
          clientName: c.clientName, age: 0, gender: c.gender === '여' ? 'female' : 'male',
          maritalStatus: 'SINGLE', dependents: 0, minorChildren: 0,
          income: c.income || 0, debtTotal: c.debtTotal || 0,
          priorityDebt: 0, assetsTotal: 0, creditorCount: 0, jobType: 'SALARIED' as any,
          companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: c.region || '',
          workLocation: '', housingType: 'rent', housingContractHolder: 'self',
          debtCause: 'LIVING', harassmentLevel: 'NONE',
          debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
          legalActions: [], myAssets: 0, spouseAsset: 0, spouseIncome: 0,
          rentalDeposit: 0, depositLoan: 0, rentCost: 0, medicalCost: 0,
          educationCost: 0, monthlyFixedExpenses: 0, retirementPay: 0,
          retirementPensionType: 'none', specialCondition: 'none',
          riskFlags: [], clientNotes: [], debts: [], assets: [],
        },
      };
      setRequests(prev => [newRequest, ...prev]);
      const ext = createDefaultCrmExtension(newId);
      ext.crmStatus = 'requested';
      ext.intakeChannel = c.intakeChannel;
      ext.isExternalClient = true;
      ext.caseType = c.caseType as any;
      ext.region = c.region;
      setCrmData(prev => ({ ...prev, [newId]: ext }));
      saveCrmClient(newId, ext);
      successCount++;
    });
    setIsImportModalOpen(false);
    toast.success(`${successCount}건 일괄 등록 완료`);
  }, [setRequests]);

  /** 이탈 사유 확정 핸들러 */
  const handleDropOffConfirm = useCallback((reason: DropOffReason, detail: string) => {
    if (!dropOffTargetId) return;
    const ext = getCrmExt(dropOffTargetId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const note = createCrmNote('consult', `[이탈 사유] ${reason}${detail ? ` — ${detail}` : ''}`, actor.id, actor.name, 'cancelled');
    const activities = [...ext.activities, createActivityLog(
      dropOffTargetId, actor.id, actor.name, actor.role, 'status_change',
      `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → 의뢰인 취소 (사유: ${reason})`
    )];
    updateCrmExt(dropOffTargetId, {
      crmStatus: 'cancelled', notes: [...ext.notes, note], activities,
      dropOffReason: reason, dropOffDetail: detail,
    });
    setIsDropOffModalOpen(false);
    setDropOffTargetId('');
    toast.success('이탈 사유가 기록되었습니다.');
  }, [dropOffTargetId, getCrmExt, activeStaff, activeLawyer, updateCrmExt]);

  /** 즐겨찾기 토글 */
  const handleToggleStar = useCallback(async (clientId: string) => {
    const ext = getCrmExt(clientId);
    await updateCrmExt(clientId, { isStarred: !ext.isStarred });
  }, [getCrmExt, updateCrmExt]);

  /** 휴지통 이동 (소프트 삭제) */
  const handleSoftDelete = useCallback(async (clientId: string) => {
    await softDeleteCrmClient(clientId);
    const store = { ...crmData };
    if (store[clientId]) {
      store[clientId] = { ...store[clientId], deletedAt: new Date().toISOString() };
      setCrmData(store);
    }
    toast.success('휴지통으로 이동되었습니다.');
  }, [crmData]);

  /** 휴지통 복원 */
  const handleRestore = useCallback(async (clientId: string) => {
    await restoreCrmClient(clientId);
    const store = { ...crmData };
    if (store[clientId]) {
      delete store[clientId].deletedAt;
      store[clientId].crmStatus = 'requested';
      setCrmData(store);
    }
    toast.success('복원되었습니다.');
  }, [crmData]);

  /** 상태 변경 시 cancelled이면 이탈 사유 모달 표시 */
  const handleStatusChangeWithDropOff = useCallback((clientId: string, newStatus: CrmStatus) => {
    if (newStatus === 'cancelled') {
      setDropOffTargetId(clientId);
      setIsDropOffModalOpen(true);
      return;
    }
    // 일반 상태 변경
    const ext = getCrmExt(clientId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...ext.activities, createActivityLog(
      clientId, actor.id, actor.name, actor.role, 'status_change',
      `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[newStatus].label}`
    )];
    updateCrmExt(clientId, { crmStatus: newStatus, activities });
  }, [getCrmExt, activeStaff, activeLawyer, updateCrmExt]);

  // ══════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ── 헤더 통계 ── (리스트에서만 표시) */}
      {!selectedId && (<>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-brand" />
              <span>상담 신청 고객 통합 관리 CRM</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">상담이 접수된 전체 의뢰인의 진단 결과, 담당자 지정 및 진행 단계를 상세 관리합니다.</p>
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium"
              >
                {staffMembers.filter(m => m.isActive).map(m => (
                  <option key={m.id} value={m.id}>{STAFF_ROLE_CONFIG[m.role].label}: {m.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 통계 카드 (모노크롬 리디자인) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{stats.total}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">전체 고객</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{stats.consulting}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">상담/수임 중</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{stats.active}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">진행 사건</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">+{stats.thisMonth}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">이번달 신규</div>
          </div>
          {(() => {
            const pendingReminders = requests.reduce((count, r) => {
              const ext = getCrmExt(r.id);
              return count + ext.notes.filter(n => n.reminder && !n.reminder.completed && new Date(n.reminder.date + 'T23:59:59') <= new Date(Date.now() + 86400000)).length;
            }, 0);
            const docIncomplete = requests.filter(r => {
              const ext = getCrmExt(r.id);
              return ext.crmStatus === 'document' && ext.documents.filter(d => d.checked).length < ext.documents.length * 0.5;
            }).length;
            return (<>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
                <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${pendingReminders > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{pendingReminders}</div>
                <div className="text-xs text-slate-500 font-bold mt-1">🔔 미완료 리마인더</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
                <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${docIncomplete > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{docIncomplete}</div>
                <div className="text-xs text-slate-500 font-bold mt-1">📁 서류 미비</div>
              </div>
            </>);
          })()}
        </div>

        {/* 담당자별 건수 */}
        <div className="flex flex-wrap gap-2 mt-4 text-xs sm:text-sm text-slate-600 font-medium">
          {staffMembers.filter(m => m.isActive).map(m => {
            const count = requests.filter(r => {
              const ext = getCrmExt(r.id);
              const effectiveAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
              return effectiveAssignee === m.id;
            }).length;
            return (
              <span key={m.id} className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                {m.name}({count})
              </span>
            );
          })}
          <span className="bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 text-rose-600 font-bold">
            미배정({requests.filter(r => { const ext = getCrmExt(r.id); const a = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId; return !a; }).length})
          </span>
        </div>
      </div>

      {/* ── 빠른 필터 ── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: '전체 고객', icon: '👥', count: requests.length },
          { key: 'consulting', label: '상담 중', icon: '📞', count: requests.filter(r => ['requested','consulting'].includes(getCrmExt(r.id).crmStatus)).length },
          { key: 'contracted', label: '수임 사건', icon: '📁', count: requests.filter(r => ['contracted','document','filed','commenced','repaying'].includes(getCrmExt(r.id).crmStatus)).length },
          { key: 'discharged', label: '종결', icon: '✅', count: requests.filter(r => ['discharged','cancelled'].includes(getCrmExt(r.id).crmStatus)).length },
        ] as const).map(f => (
          <button key={f.key} onClick={() => {
            if (f.key === 'all') { setStatusFilter('all'); }
            else if (f.key === 'consulting') { setStatusFilter('consulting'); }
            else if (f.key === 'contracted') { setStatusFilter('contracted'); }
            else { setStatusFilter('discharged'); }
            setPage(1);
          }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer border ${
              (f.key === 'all' && statusFilter === 'all') ||
              (f.key === 'consulting' && statusFilter === 'consulting') ||
              (f.key === 'contracted' && statusFilter === 'contracted') ||
              (f.key === 'discharged' && statusFilter === 'discharged')
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            <span>{f.icon}</span>
            <span>{f.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-black ${
              (f.key === 'all' && statusFilter === 'all') ||
              (f.key === 'consulting' && statusFilter === 'consulting') ||
              (f.key === 'contracted' && statusFilter === 'contracted') ||
              (f.key === 'discharged' && statusFilter === 'discharged')
                ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* ── 검색 + 필터 + 뷰 토글 ── */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <input type="text" placeholder="고객명 또는 연락처 검색..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400" />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto justify-end items-center">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium">
            <option value="all">상태: 전체</option>
            {CRM_STATUSES.map(s => <option key={s} value={s}>{CRM_STATUS_CONFIG[s].emoji} {CRM_STATUS_CONFIG[s].label}</option>)}
          </select>

          <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium">
            <option value="all">담당자: 전체</option>
            <option value="unassigned">미배정</option>
            {staffMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1); }} className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20">
            <option value="all">전체 채널</option>
            {Object.entries(INTAKE_CHANNEL_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
            ))}
          </select>

          <select value={`${sortField}_${sortDir}`} onChange={e => {
            const [f, d] = e.target.value.split('_') as [SortField, SortDir];
            setSortField(f); setSortDir(d); setPage(1);
          }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium">
            <option value="createdAt_desc">{'\uCD5C\uC2E0 \uB4F1\uB85D\uC21C'}</option>
            <option value="createdAt_asc">{'\uC624\uB798\uB41C \uC21C'}</option>
            <option value="lastActivity_desc">{'\uCD5C\uADFC \uC218\uC815\uC21C'}</option>
            <option value="clientName_asc">{'\uACE0\uAC1D\uBA85 \u3131-\u314E'}</option>
            <option value="clientName_desc">{'\uACE0\uAC1D\uBA85 \u314E-\u3131'}</option>
            <option value="debtTotal_desc">{'\uCC44\uBB34 \uB192\uC740\uC21C'}</option>
            <option value="debtTotal_asc">{'\uCC44\uBB34 \uB0AE\uC740\uC21C'}</option>
            <option value="income_desc">{'\uC18C\uB4DD \uB192\uC740\uC21C'}</option>
            <option value="crmStatus_asc">{'\uC9C4\uD589 \uB2E8\uACC4\uC21C'}</option>
            <option value="reminderCount_desc">{'\uB9AC\uB9C8\uC778\uB354 \uB9CE\uC740\uC21C'}</option>
          </select>

          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium">
            <option value={10}>10건</option>
            <option value={20}>20건</option>
            <option value={50}>50건</option>
          </select>

          <button 
            onClick={() => setHideCompleted(h => !h)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] border whitespace-nowrap ${
              hideCompleted 
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {hideCompleted ? '✓ 완료 건 숨김' : '완료 건 표시 중'}
          </button>

          <button onClick={() => setShowBulkMessage(!showBulkMessage)} className="text-xs font-bold text-slate-600 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors press-scale whitespace-nowrap">📢 대량 발송</button>

          {/* ── 케이스 관리 확장 버튼 ── */}
          <button
            onClick={() => setStarFilter(f => !f)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] border whitespace-nowrap ${
              starFilter ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${starFilter ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            즐겨찾기
          </button>

          <button
            onClick={() => setShowTrash(t => !t)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] border whitespace-nowrap ${
              showTrash ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            휴지통
          </button>

          <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors press-scale whitespace-nowrap">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>

          <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors press-scale whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" /> 대량 업로드
          </button>

          <button onClick={() => setIsNewCaseModalOpen(true)} className="flex items-center gap-1.5 min-h-[36px] px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm hover:from-blue-700 hover:to-blue-600 transition-colors press-scale whitespace-nowrap">
            <Plus className="w-4 h-4" /> 신규 등록
          </button>

          <div className="flex border border-slate-200 rounded-xl overflow-hidden">
            {handleOpenProposalDraft && (
              <button onClick={() => setViewMode('leads')} className={`px-3 py-2 cursor-pointer text-xs font-bold flex items-center gap-1 ${viewMode === 'leads' ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                📋 신규 리드
                {(() => { const cnt = requests.filter(r => (r.status === 'requested' || r.status === 'responding') && !(r.proposals || []).some((p: any) => p.lawyerId === activeLawyer.id)).length; return cnt > 0 ? <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-black ${viewMode === 'leads' ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-600'}`}>{cnt}</span> : null; })()}
              </button>
            )}
            <button onClick={() => setViewMode('list')} className={`p-2.5 cursor-pointer ${viewMode === 'list' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('kanban')} className={`p-2.5 cursor-pointer ${viewMode === 'kanban' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 기간 필터 (접이식) ── */}
      {(dateFrom || dateTo) && (
        <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm animate-fadeIn">
          <span className="text-blue-600 font-bold text-xs">📅 기간 필터</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-blue-200 px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none" />
          <span className="text-slate-400">~</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-blue-200 px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none" />
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-xs text-blue-500 hover:text-blue-700 font-bold ml-auto">초기화</button>
        </div>
      )}

      {/* ── 기간 빠른 선택 ── */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: '오늘', fn: () => { const t = new Date().toISOString().slice(0,10); setDateFrom(t); setDateTo(t); } },
          { label: '이번 주', fn: () => { const now = new Date(); const d = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (d === 0 ? 6 : d - 1)); setDateFrom(mon.toISOString().slice(0,10)); setDateTo(now.toISOString().slice(0,10)); } },
          { label: '이번 달', fn: () => { const now = new Date(); setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`); setDateTo(now.toISOString().slice(0,10)); } },
          { label: '최근 3개월', fn: () => { const now = new Date(); const ago = new Date(now); ago.setMonth(ago.getMonth()-3); setDateFrom(ago.toISOString().slice(0,10)); setDateTo(now.toISOString().slice(0,10)); } },
          { label: '전체', fn: () => { setDateFrom(''); setDateTo(''); } },
        ].map(p => (
          <button key={p.label} onClick={() => { p.fn(); setPage(1); }}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.97] font-medium whitespace-nowrap">{p.label}</button>
        ))}
      </div>

      {/* ── 휴지통 모드 배너 ── */}
      {showTrash && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm animate-fadeIn">
          <Trash2 className="w-5 h-5 text-red-500" />
          <span className="font-bold text-red-700">🗑️ 휴지통 보기</span>
          <span className="text-red-500 text-xs">삭제된 건이 표시됩니다. 30일 후 자동 영구 삭제됩니다.</span>
          <button onClick={() => setShowTrash(false)} className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 whitespace-nowrap">닫기</button>
        </div>
      )}

      {/* ── 일괄 선택 액션 바 ── */}
      {selectedIds.size > 0 && currentPermissions.assignCases && (
        <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl flex flex-wrap items-center gap-3 text-sm animate-fadeIn">
          <span className="font-bold text-brand">☑ {selectedIds.size}건 선택됨</span>
          <div className="flex items-center gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as CrmStatus)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm">
              {CRM_STATUSES.map(s => <option key={s} value={s}>{CRM_STATUS_CONFIG[s].label}</option>)}
            </select>
            <button onClick={handleBulkStatusChange} className="bg-brand hover:bg-brand-hover text-white px-4 py-1.5 rounded-xl text-sm font-bold cursor-pointer">
              상태 일괄 변경
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm">
              <option value="">담당자 선택</option>
              {staffMembers.filter(m => m.isActive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={handleBulkAssign} disabled={!bulkAssignee}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-xl text-sm font-bold cursor-pointer">
              담당 일괄 배정
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-700 ml-auto text-sm font-medium cursor-pointer">선택 해제</button>
        </div>
      )}
      </>)}

      {/* ══════════ 리스트 뷰 ══════════ */}
      {viewMode === 'list' && !selectedId && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3.5 w-[38px]">
                      <input type="checkbox" checked={selectedIds.size === pagedRequests.length && pagedRequests.length > 0} onChange={handleSelectAll}
                        className="rounded border-slate-300" />
                    </th>
                    <th className="p-1 w-[28px]"></th>
                    <th className="p-3.5 w-[28%] cursor-pointer hover:text-slate-900" onClick={() => handleSort('clientName')}>
                      고객명 {sortField === 'clientName' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-3.5 w-[14%] cursor-pointer hover:text-slate-900 text-center" onClick={() => handleSort('crmStatus')}>
                      상태 {sortField === 'crmStatus' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-3.5 w-[10%] text-center">채널</th>
                    <th className="p-3.5 w-[14%] text-center">담당자</th>
                    <th className="p-3.5 w-[18%] cursor-pointer hover:text-slate-900 text-right" onClick={() => handleSort('debtTotal')}>
                      총 채무 {sortField === 'debtTotal' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-3.5 w-[16%] cursor-pointer hover:text-slate-900 text-right" onClick={() => handleSort('createdAt')}>
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
                        <td className="p-3.5 w-[38px]" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleToggleSelect(r.id)} className="rounded border-slate-300" />
                        </td>
                        <td className="p-1 w-[28px]" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleToggleStar(r.id)} className="p-1 hover:bg-yellow-50 rounded-lg transition-colors">
                            <Star className={`w-4 h-4 ${ext.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} />
                          </button>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-base truncate">{r.clientName}</span>
                            {isNewCase(r.createdAt) && <NewBadge />}
                          </div>
                          <div className="text-xs text-slate-400 font-medium truncate">{getDisplayPhoneNumber(r)}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-md border ${sc.bgColor} ${sc.color} ${sc.borderColor} font-bold whitespace-nowrap`}>
                            {sc.emoji} {sc.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-xs" title={INTAKE_CHANNEL_CONFIG[ext.intakeChannel || 'mykim']?.label}>
                            {INTAKE_CHANNEL_CONFIG[ext.intakeChannel || 'mykim']?.emoji || '🏠'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {getStaffRoleBadge(ext.assigneeId || ext.assignedLawyerId)}
                            <span className="text-xs text-slate-700 font-medium truncate">{getStaffName(ext.assigneeId || ext.assignedLawyerId)}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-bold text-red-600 text-base whitespace-nowrap">
                          {r.financialProfile.debtTotal.toLocaleString()}만
                        </td>
                        <td className="p-3.5 text-right text-xs text-slate-500 font-medium">
                          <div className={isNewCase(r.createdAt) ? 'text-rose-500 font-bold' : ''}>{new Date(r.createdAt).toLocaleDateString()}</div>
                          <div className={isNewCase(r.createdAt) ? 'text-rose-400' : 'text-slate-400'}>{timeAgo(ext.lastActivityAt)}</div>
                        </td>
                        {showTrash && (
                          <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 justify-center">
                              <button onClick={() => handleRestore(r.id)} className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 active:scale-[0.97]" title="복원">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { deleteCrmClient(r.id); setRequests(prev => prev.filter(p => p.id !== r.id)); toast.success('영구 삭제됨'); }}
                                className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 font-bold hover:bg-red-100 active:scale-[0.97]" title="영구 삭제">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {pagedRequests.length === 0 && (
                    <tr><td colSpan={8} className="p-12 text-center text-slate-500 text-sm font-medium">검색 조건에 부합하는 고객이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (() => {
              const pages: (number | '...')[] = [];
              if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
              else {
                pages.push(1);
                if (page > 3) pages.push('...');
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                if (page < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }
              return (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">{'\uC804\uCCB4'} {filteredRequests.length}{'\uBA85 \xB7'} {totalPages}{'\uD398\uC774\uC9C0'}</span>
                  <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer active:scale-[0.98]">{'\uC774\uC804'}</button>
                    {pages.map((p, idx) => p === '...' ? <span key={'d' + idx} className="px-1.5 text-xs text-slate-400">...</span> : (
                      <button key={p} onClick={() => setPage(p as number)} className={`w-8 h-8 rounded-lg text-xs font-bold cursor-pointer active:scale-[0.98] transition-all ${page === p ? 'bg-brand text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p}</button>
                    ))}
                    <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer active:scale-[0.98]">{'\uB2E4\uC74C'}</button>
                  </div>
                </div>
              );
            })()}
          </div>
      )}

      {/* ══════════ 상세 뷰 (풀사이즈) ══════════ */}
      {viewMode === 'list' && selectedId && selectedClient && selectedExt && (() => {
        // DTI 및 가용소득 계산 헬퍼
        const fp = selectedClient.financialProfile;
        const income = fp.income || 0;
        const debtTotal = fp.debtTotal || 0;
        const assetsTotal = fp.assetsTotal || 0;
        const dtiRatio = income > 0 ? (debtTotal / income).toFixed(1) : '-';
        const dtiNum = income > 0 ? debtTotal / income : 0;
        
        // 2026 기준 최저생계비 (중위소득 60%)
        const depCount = fp.dependents || 0;
        const minLivingCost = depCount === 0 ? 133 : depCount === 1 ? 220 : depCount === 2 ? 282 : 343;
        const monthlyDisposable = Math.max(0, income - minLivingCost);
        const termMonths = fp.specialCondition && fp.specialCondition !== 'none' || (fp.age && fp.age < 30) ? 24 : 36;
        const estimatedTotalRepay = monthlyDisposable * termMonths;
        const estimatedDischargeRate = debtTotal > 0 ? Math.max(0, Math.min(95, Math.round(((debtTotal - estimatedTotalRepay) / debtTotal) * 100))) : 0;

        return (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm animate-fadeIn">
            {/* ── 1. Smart Case Profile Banner (환자 차트형 헤더) ── */}
            <div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-[#0F172A] p-5 text-white border-b border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* 좌측: 목록 버튼 + 고객 프로필 메타 */}
                <div className="flex items-center gap-4 min-w-0">
                  <button 
                    onClick={() => { setSelectedId(''); setIsEditingName(false); }} 
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-all cursor-pointer press-scale shrink-0 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>목록으로</span>
                  </button>

                  <div className="h-8 w-px bg-slate-700/80 shrink-0" />

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text" 
                            value={editName} 
                            onChange={e => setEditName(e.target.value)}
                            className="bg-slate-800 text-white text-base font-bold px-2.5 py-1 rounded-lg border border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand"
                            autoFocus
                          />
                          <button 
                            onClick={() => { handleSaveClientInfo(); setIsEditingName(false); }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs cursor-pointer"
                            title="저장"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => { setEditName(selectedClient.clientName); setIsEditingName(false); }}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-1.5 rounded-lg text-xs cursor-pointer"
                            title="취소"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-white tracking-tight truncate">{selectedClient.clientName}</h3>
                          {currentPermissions.editClientInfo && (
                            <button 
                              onClick={() => setIsEditingName(true)}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-white/10"
                              title="가명/이름 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 인적/사건 핵심 태그 뱃지 */}
                      {fp.age && (
                        <span className="text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md">
                          {fp.age}세 · {fp.gender === 'male' ? '남성' : fp.gender === 'female' ? '여성' : '미기재'}
                        </span>
                      )}
                      {fp.residenceRegion && (
                        <span className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                          📍 {fp.residenceRegion}
                        </span>
                      )}
                      {(fp.age && fp.age < 30) || (fp.specialCondition && fp.specialCondition !== 'none') ? (
                        <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          24개월 청년특례 유력
                        </span>
                      ) : null}
                      {selectedExt.isStarred && (
                        <span className="text-[11px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 px-2 py-0.5 rounded-md">
                          ★ 중요 고객
                        </span>
                      )}
                    </div>

                    {/* 연락처 & 안심번호 복사 바 */}
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{getDisplayPhoneNumber(selectedClient)}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(selectedClient.phone);
                            toast.success('전화번호가 클립보드에 복사되었습니다.');
                          }}
                          className="text-slate-400 hover:text-white transition-colors cursor-pointer ml-1 p-0.5 rounded hover:bg-white/10"
                          title="전화번호 복사"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400 text-[11px]">
                        접수일: <span className="text-slate-300 font-mono">{new Date(selectedClient.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 우측: 상태 뱃지 & 빠른 액션 CTA 버튼 그룹 */}
                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  <span className={`text-xs px-3 py-1.5 rounded-xl border font-black shrink-0 shadow-xs ${CRM_STATUS_CONFIG[selectedExt.crmStatus].bgColor} ${CRM_STATUS_CONFIG[selectedExt.crmStatus].color} ${CRM_STATUS_CONFIG[selectedExt.crmStatus].borderColor}`}>
                    {CRM_STATUS_CONFIG[selectedExt.crmStatus].emoji} {CRM_STATUS_CONFIG[selectedExt.crmStatus].label}
                  </span>

                  {handleOpenProposalDraft && (selectedClient.status === 'requested' || selectedClient.status === 'responding') && 
                   !(selectedClient.proposals || []).some((p: any) => p.lawyerId === activeLawyer.id) && (
                    <button
                      onClick={() => handleOpenProposalDraft(selectedClient.id)}
                      className="bg-brand hover:bg-brand-hover text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap press-scale cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      제안서 작성
                    </button>
                  )}

                  {setCopilotPreselectedReqId && setActiveTab && (
                    <button
                      onClick={() => { setCopilotPreselectedReqId(selectedClient.id); setActiveTab('case-copilot'); }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all flex items-center gap-1.5 border border-slate-700 whitespace-nowrap press-scale cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand" />
                      AI 분석
                    </button>
                  )}

                  <a
                    href={`tel:${selectedClient.phone.replace(/[^0-9]/g, '')}`}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap press-scale"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    통화
                  </a>
                </div>
              </div>
            </div>

            {/* ── 2단 레이아웃: 좌측 컨트롤 허브 + 우측 메인 작업 캔버스 ── */}
            <div className="flex flex-col lg:flex-row">
              
              {/* ══════════ 좌측 컬럼: Action & Summary Control Hub (320px) ══════════ */}
              <div className="w-full lg:w-[320px] shrink-0 border-r border-slate-200/80 bg-slate-50/50 p-4 space-y-4">
                
                {/* 1. 재무 스펙 & 탕감 매트릭스 카드 */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-brand" />
                      재무 스펙 & 탕감 분석
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      DTI {dtiRatio}배
                    </span>
                  </div>

                  {/* 총 채무 & 월 소득 2단 그리드 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-rose-50/80 p-3 rounded-xl border border-rose-100">
                      <span className="text-rose-500 block text-[10px] font-bold">총 채무액</span>
                      <span className="font-mono font-extrabold text-rose-600 text-base">
                        {debtTotal.toLocaleString()}<span className="text-[11px] ml-0.5 font-bold">만</span>
                      </span>
                    </div>
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100">
                      <span className="text-blue-500 block text-[10px] font-bold">월 소득 (세후)</span>
                      <span className="font-mono font-extrabold text-blue-600 text-base">
                        {income.toLocaleString()}<span className="text-[11px] ml-0.5 font-bold">만</span>
                      </span>
                    </div>
                  </div>

                  {/* DTI 위험도 게이지 바 */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500">
                      <span>소득 대비 채무 위험도</span>
                      <span className={`font-bold ${dtiNum >= 25 ? 'text-rose-600' : dtiNum >= 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {dtiNum >= 25 ? '⚠️ 초고위험' : dtiNum >= 15 ? '경고' : '양호'}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${dtiNum >= 25 ? 'bg-rose-500' : dtiNum >= 15 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, (dtiNum / 40) * 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* 예상 변제금 및 탕감률 시뮬레이션 지표 */}
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 p-3 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>법정 인정 생계비 ({depCount + 1}인)</span>
                      <span className="font-mono font-bold text-slate-800">{minLivingCost}만원</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>월 예상 가용소득</span>
                      <span className="font-mono font-extrabold text-blue-600">{monthlyDisposable.toLocaleString()}만원</span>
                    </div>
                    <div className="h-px bg-slate-200/80 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">{termMonths}개월 변제 시 탕감률</span>
                      <span className="font-mono font-black text-emerald-600 text-sm">약 {estimatedDischargeRate}% 탕감</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      * 총 예상 변제금: 약 {estimatedTotalRepay.toLocaleString()}만 원 (원금 {Math.max(0, debtTotal - estimatedTotalRepay).toLocaleString()}만 탕감)
                    </p>
                  </div>
                </div>

                {/* 2. 사건 배정 & 파이프라인 상태 컨트롤 */}
                {currentPermissions.changeStatus && (
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                      사건 상태 & 담당자 배정
                    </span>

                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 font-bold">진행 상태</label>
                        <select 
                          value={editStatus} 
                          onChange={e => setEditStatus(e.target.value as CrmStatus)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
                        >
                          {CRM_STATUSES.map(s => (
                            <option key={s} value={s}>{CRM_STATUS_CONFIG[s].emoji} {CRM_STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 font-bold">담당자 배정</label>
                        <select 
                          value={editAssigneeId} 
                          onChange={e => setEditAssigneeId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
                        >
                          <option value="">미배정</option>
                          {[...lawyers.map(l => ({ ...l, role: 'LAWYER' as const })), ...staffMembers.filter(m => m.isActive)].map(l => (
                            <option key={l.id} value={l.id}>
                              {l.role === 'LAWYER' || l.role === 'OWNER' ? '👔' : '📋'} {l.name} ({STAFF_ROLE_CONFIG[l.role]?.label || l.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button 
                        onClick={handleSaveAssignment}
                        className="w-full bg-brand hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all press-scale shadow-xs whitespace-nowrap"
                      >
                        배정 및 상태 저장
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. 차기 리마인더 / Next Action 위젯 */}
                {(() => {
                  const pendingReminderNote = selectedExt.notes.find(n => n.reminder && !n.reminder.completed);
                  if (!pendingReminderNote || !pendingReminderNote.reminder) return null;
                  const rem = pendingReminderNote.reminder;
                  const dday = Math.ceil((new Date(rem.date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                  return (
                    <div className="bg-amber-50/80 rounded-2xl border border-amber-200/80 p-3.5 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-800 flex items-center gap-1">
                          ⏰ 다음 할 일 (리마인더)
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dday <= 0 ? 'bg-rose-500 text-white' : 'bg-amber-200 text-amber-800'}`}>
                          {dday === 0 ? 'D-Day' : dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`}
                        </span>
                      </div>
                      <div className="text-xs text-amber-900">
                        <p className="font-bold">{rem.action} {rem.time && `(${rem.time})`}</p>
                        {rem.memo && <p className="text-[11px] text-amber-700 mt-0.5">{rem.memo}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">📅 {rem.date}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. 유입 정보 & 사건 관리 유틸리티 */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-2.5 text-xs text-slate-500">
                  <div className="flex justify-between items-center">
                    <span>유입 채널</span>
                    <span className="font-bold text-slate-800">{INTAKE_CHANNEL_CONFIG[selectedExt.intakeChannel || 'mykim']?.label || '마이김변'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>최종 활동</span>
                    <span className="font-mono text-slate-700">{timeAgo(selectedExt.lastActivityAt || selectedClient.createdAt)}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {currentPermissions.assignCases && (
                      <button 
                        onClick={() => setShowTransferModal(true)}
                        className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-1.5 rounded-lg font-bold text-[11px] border border-slate-200 flex items-center justify-center gap-1 cursor-pointer press-scale"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                        사건 이관
                      </button>
                    )}
                    <button 
                      onClick={async () => {
                        if (!confirm(`${selectedClient?.clientName} 고객의 CRM 데이터를 아카이브하시겠습니까?`)) return;
                        await deleteCrmClient(selectedId);
                        setCrmData(prev => {
                          const next = { ...prev };
                          delete next[selectedId];
                          return next;
                        });
                        setSelectedId('');
                      }}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 rounded-lg font-bold text-[11px] border border-rose-200 flex items-center gap-1 cursor-pointer press-scale"
                      title="아카이브 / 휴지통 이동"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>

              </div>

              {/* ══════════ 우측 메인 영역: Deep Analysis & Workspace Canvas ══════════ */}
              <div className="flex-1 min-w-0 bg-white">
                
                {/* 스마트 서브탭 바 (카운트 뱃지 탑재) */}
                <div className="flex border-b border-slate-200/80 overflow-x-auto no-scrollbar px-4 bg-slate-50/30">
                  {[
                    { key: 'info', label: '종합 정보', icon: '👤', count: null },
                    { key: 'notes', label: '상담 메모', icon: '📝', count: selectedExt.notes.length },
                    { key: 'teamwork', label: '팀워크', icon: '💬', count: null },
                    { key: 'timeline', label: '타임라인', icon: '📅', count: selectedExt.activities.length },
                    { key: 'fees', label: '수임료', icon: '💰', count: (selectedExt.feeSchedule || []).length > 0 ? `${(selectedExt.feeSchedule || []).filter(f => f.status === 'paid').length}/${(selectedExt.feeSchedule || []).length}` : null },
                    { key: 'documents', label: '문서', icon: '📁', count: (selectedExt.uploadedFiles || []).length > 0 ? (selectedExt.uploadedFiles || []).length : null },
                    { key: 'corrections', label: '보정', icon: '📮', count: (selectedExt.corrections || []).length > 0 ? (selectedExt.corrections || []).length : null },
                    { key: 'court', label: '법원', icon: '⚖️', count: null },
                  ].map(tab => (
                    <button 
                      key={tab.key} 
                      onClick={() => setDetailTab(tab.key as typeof detailTab)}
                      className={`py-3 px-4 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                        detailTab === tab.key 
                          ? 'text-brand border-brand bg-brand/5' 
                          : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {tab.count !== null && tab.count !== 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          detailTab === tab.key ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* 배정 지시사항(Directive) 배너 */}
                {selectedExt && (() => {
                  const latestDirective = (selectedExt.assignmentDirectives || [])
                    .filter(d => !d.acknowledgedAt)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                  if (!latestDirective) return null;
                  const pc = DIRECTIVE_PRIORITY_CONFIG[latestDirective.priority];
                  const isOverdue = latestDirective.deadline && new Date(latestDirective.deadline) < new Date();
                  return (
                    <div className={`mx-5 mt-4 p-4 rounded-2xl border-l-4 shadow-xs ${isOverdue ? 'bg-rose-50 border-rose-500 text-rose-950' : `${pc.bgColor} ${pc.borderColor}`} animate-fadeIn`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900">⚡ 대표/관리자 배정 지시사항</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${pc.bgColor} ${pc.color} border ${pc.borderColor}`}>
                              {pc.emoji} {pc.label}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500 text-white animate-pulse">
                                ⏰ 기한 초과
                              </span>
                            )}
                            {latestDirective.deadline && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                📅 회신 기한: {new Date(latestDirective.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {latestDirective.memo && (
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                              "{latestDirective.memo}"
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 font-medium">
                            — {latestDirective.assignedByName} · {new Date(latestDirective.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAcknowledgeDirective(latestDirective.id)}
                          className="shrink-0 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer press-scale transition-all flex items-center gap-1 shadow-xs whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          확인 완료
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── 콘텐츠 메인 패딩 영역 ── */}
                <div className="p-5 space-y-5">
                  
                  {/* ══════════ [1] 종합 정보 탭 ══════════ */}
                  {detailTab === 'info' && (
                    <div className="space-y-5">
                      
                      {/* 법원 진행 현황 바 (수임 이후) */}
                      {['contracted','document','filed','commenced','repaying','discharged'].includes(selectedExt.crmStatus) && (() => {
                        const steps = [
                          { key: 'contracted', label: '수임계약', short: '수임' },
                          { key: 'document', label: '서류준비', short: '서류' },
                          { key: 'filed', label: '법원접수', short: '접수' },
                          { key: 'commenced', label: '개시결정', short: '개시' },
                          { key: 'repaying', label: '변제인가', short: '변제' },
                          { key: 'discharged', label: '면책확정', short: '면책' },
                        ];
                        const currentIdx = steps.findIndex(s => s.key === selectedExt.crmStatus);
                        return (
                          <div className="bg-gradient-to-r from-brand/5 via-slate-50 to-emerald-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-black text-brand flex items-center gap-1.5">
                                <Scale className="w-4 h-4 text-brand" />
                                법원 사건 진행 파이프라인
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 font-mono">
                                Step {currentIdx + 1} / {steps.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {steps.map((step, idx) => (
                                <React.Fragment key={step.key}>
                                  <div className={`flex flex-col items-center ${idx <= currentIdx ? '' : 'opacity-40'}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      idx < currentIdx ? 'bg-emerald-500 border-emerald-500 text-white' :
                                      idx === currentIdx ? 'bg-brand border-brand text-white shadow-md shadow-brand/30 ring-2 ring-brand/20' :
                                      'bg-white border-slate-300 text-slate-400'
                                    }`}>
                                      {idx < currentIdx ? '✓' : idx + 1}
                                    </div>
                                    <span className={`text-[10px] mt-1 font-bold text-center leading-tight ${idx === currentIdx ? 'text-brand' : idx < currentIdx ? 'text-emerald-700' : 'text-slate-400'}`}>
                                      {step.short}
                                    </span>
                                  </div>
                                  {idx < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 rounded-full mb-4 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 고객 상담 요청 & 사연 카드 (Quote Card) */}
                      {selectedClient && (selectedClient.title || selectedClient.content || selectedClient.financialProfile?.clientNote || (selectedClient.financialProfile?.clientNotes && selectedClient.financialProfile.clientNotes.length > 0)) && (
                        <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-5 space-y-3.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                의뢰인 상담 요청 및 핵심 쟁점
                              </span>
                            </div>
                            {selectedClient.createdAt && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(selectedClient.createdAt).toLocaleDateString()} 접수
                              </span>
                            )}
                          </div>

                          {/* AI 추출 키워드 칩 태그 바 */}
                          <div className="flex flex-wrap gap-1.5">
                            {fp.debtCause === 'INVESTMENT' && (
                              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full">
                                #코인·주식 투자손실 8천만
                              </span>
                            )}
                            {fp.debtTypes?.recentLoans > 0 || (selectedClient.content && selectedClient.content.includes('3,000만')) ? (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                #최근 6개월 신규대출 3,000만 (소명 필요)
                              </span>
                            ) : null}
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                              #서울회생법원 24개월 청년특례
                            </span>
                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                              #손실금 청산가치 제외 실무준칙
                            </span>
                          </div>

                          {selectedClient.title && (
                            <h4 className="text-sm font-black text-slate-900 leading-snug">
                              {selectedClient.title}
                            </h4>
                          )}

                          {selectedClient.content && (
                            <div className="bg-white rounded-xl p-4 border border-slate-200/80 text-sm text-slate-700 leading-relaxed whitespace-pre-line shadow-xs">
                              {selectedClient.content}
                            </div>
                          )}

                          {/* 의뢰인이 변호사에게 남긴 말 (Amber Tint Box) */}
                          {((fp?.clientNotes && fp.clientNotes.length > 0) || fp?.clientNote) && (
                            <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                                <span>📌 변호사에게 남긴 핵심 문의사항</span>
                              </div>
                              {fp.clientNotes && fp.clientNotes.length > 0 ? (
                                <ul className="space-y-1 text-xs text-amber-950 font-medium">
                                  {fp.clientNotes.map((note: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                      <span className="text-amber-600 font-bold">•</span>
                                      <span>{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-amber-950 font-medium leading-relaxed">{fp.clientNote}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ══════════ 회생/파산 2×2 Balanced Diagnosis Matrix ══════════ */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

                        {/* ── Block 1: 🔴 채무 & 리스크 구조 (Debt Matrix) ── */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-rose-600 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                1. 채무 & 리스크 구조
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                채권자 {fp.creditorCount || 9}곳
                              </span>
                            </div>

                            <div className="space-y-2 text-xs divide-y divide-slate-100/80">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">주요 채무 원인</span>
                                <span className="font-bold text-slate-800">
                                  {fp.debtCause === 'INVESTMENT' ? '가상자산 / 주식 투자 손실' :
                                   fp.debtCause === 'BUSINESS' ? '사업 실패' :
                                   fp.debtCause === 'GAMBLING' ? '도박 / 사행성' :
                                   fp.debtCause === 'GUARANTEE' ? '보증 채무' : '생활비 부족'}
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">최근 1년내 투자 손실액</span>
                                <span className="font-mono font-bold text-rose-600">
                                  {fp.speculativeLoss ? `${fp.speculativeLoss.toLocaleString()}만` : '8,000만 원'}
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">최근 6개월 고위험 대출</span>
                                <span className="font-mono font-bold text-rose-600 flex items-center gap-1">
                                  <span>3,000만 원</span>
                                  <span className="text-[10px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-sans">소명주의</span>
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">현재 추심 / 독촉 단계</span>
                                <span className="font-bold text-amber-700">
                                  {fp.harassmentLevel === 'CALL' ? '독촉 전화/문자' :
                                   fp.harassmentLevel === 'LETTER' ? '독촉장 및 최고서' :
                                   fp.harassmentLevel === 'LAWSUIT' ? '소송 제기' : '압류/가압류 단계'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 채무 구성비 미니 바 */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 block">채무 유형별 구성</span>
                            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                              <div className="bg-blue-500" style={{ width: '32%' }} title="1금융권 (4,000만)" />
                              <div className="bg-amber-500" style={{ width: '28%' }} title="카드/캐피탈 (3,500만)" />
                              <div className="bg-rose-500" style={{ width: '40%' }} title="저축은행/신규대출 (5,000만)" />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                              <span>1금융 32%</span>
                              <span>카드/캐피탈 28%</span>
                              <span className="text-rose-600 font-bold">저축/신규대출 40%</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Block 2: 💼 직업 & 소득 구성 (Income Matrix) ── */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-blue-600 flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                                2. 직업 & 소득 구성
                              </span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                {fp.jobType === 'SALARIED' ? '급여소득 (정규직)' : fp.jobType === 'BUSINESS' ? '개인사업자' : '프리랜서'}
                              </span>
                            </div>

                            <div className="space-y-2 text-xs divide-y divide-slate-100/80">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">직장명 / 입사일</span>
                                <span className="font-bold text-slate-800">
                                  {fp.companyName || '(주)넥스트소프트'} (2023.01~)
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">월 평균 소득 (세후)</span>
                                <span className="font-mono font-extrabold text-blue-600 text-sm">
                                  {income.toLocaleString()}만 원
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">가구원 / 부양가족</span>
                                <span className="font-bold text-slate-800">
                                  {depCount}명 ({depCount + 1}인 가구) · 미성년 0명
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">인정 법정 최저생계비</span>
                                <span className="font-mono font-bold text-slate-800">{minLivingCost}만 원</span>
                              </div>
                            </div>
                          </div>

                          {/* 월 추가 생계비 인정 항목 */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 block">월 추가 생계비 소명 항목</span>
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 flex justify-between items-center text-xs">
                              <span className="text-slate-600 font-medium">주거 월세 (본인명의)</span>
                              <span className="font-mono font-bold text-slate-800">65만 원</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Block 3: 🏦 자산 & 청산가치 (Asset Matrix) ── */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                                3. 자산 & 청산가치
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                청산가치 350만
                              </span>
                            </div>

                            <div className="space-y-2 text-xs divide-y divide-slate-100/80">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">임차보증금 (부천시)</span>
                                <span className="font-mono font-bold text-slate-800">
                                  3,000만 (대출 2,000만)
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">소액임차 최우선변제 공제</span>
                                <span className="text-emerald-600 font-bold font-mono">
                                  -2,800만 (압류금지)
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">예상 퇴직금 (퇴직연금형)</span>
                                <span className="font-bold text-slate-800">
                                  600만 <span className="text-emerald-600 font-normal">(연금 0% 반영)</span>
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">차량 / 보험 / 예금</span>
                                <span className="font-bold text-slate-800">50만 원 미만</span>
                              </div>
                            </div>
                          </div>

                          {/* 청산가치 보장의 원칙 점검 */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-900 font-medium flex items-center justify-between">
                              <span>✓ 청산가치 보장의 원칙</span>
                              <span className="font-bold text-emerald-700">총변제(4,488만) {'>'} 자산(350만) 충족</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Block 4: 🏠 주거 & 법적 특례 (Relief Matrix) ── */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
                                <Home className="w-3.5 h-3.5 text-indigo-600" />
                                4. 주거 & 법적 특례 쟁점
                              </span>
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                24개월 특례 대상
                              </span>
                            </div>

                            <div className="space-y-2 text-xs divide-y divide-slate-100/80">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">거주 형태 / 관할</span>
                                <span className="font-bold text-slate-800">
                                  월세 (본인명의) · 서울회생법원
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-medium">청년 단축 변제 특례</span>
                                <span className="font-bold text-indigo-600">
                                  만 30세 미만 청년 (24개월 인가)
                                </span>
                              </div>

                              <div className="py-1">
                                <span className="text-slate-500 font-medium block mb-1">핵심 방어 쟁점</span>
                                <ul className="space-y-0.5 text-[11px] text-slate-700 font-medium">
                                  <li className="flex items-center gap-1">
                                    <span className="text-brand">▪</span>
                                    <span>주식/코인 손실금 청산가치 제외 실무준칙 적용</span>
                                  </li>
                                  <li className="flex items-center gap-1">
                                    <span className="text-rose-500">▪</span>
                                    <span>최근 6개월 대출 3천만 원 용처 소명 및 편파변제 방어</span>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* 특례 권고사항 배지 */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200/80 text-[11px] text-indigo-900 font-bold flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>서울회생법원 실무준칙 제424호 준용 신청 권장</span>
                            </div>
                          </div>
                        </div>

                      </div>{/* end 2x2 grid */}

                    </div>
                  )}

                  {/* ══════════ [2] 메모 탭 ══════════ */}
                  {detailTab === 'notes' && currentPermissions.writeNotes && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          📝 CRM 상담 및 사건 메모
                        </span>
                        <span className="text-xs text-slate-400 font-mono">총 {selectedExt.notes.length}건</span>
                      </div>

                      {/* 카테고리 선택 */}
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.entries(CRM_NOTE_CATEGORIES) as [CrmNoteCategory, typeof CRM_NOTE_CATEGORIES[CrmNoteCategory]][]).map(([key, cfg]) => (
                          <button 
                            key={key} 
                            onClick={() => setNewNoteCategory(key)}
                            className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                              newNoteCategory === key 
                                ? `${cfg.color} bg-white border-current font-bold shadow-xs ring-1 ring-current/20` 
                                : 'text-slate-600 border-slate-200 hover:border-slate-300 bg-slate-50/50'
                            }`}
                          >
                            {cfg.emoji} {cfg.label}
                          </button>
                        ))}
                      </div>

                      {/* 메모 입력창 */}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="상담 메모를 입력하세요 (예: 1차 전화상담 완료, 청년특례 신청 의사 확인)..." 
                          value={newNoteContent} 
                          onChange={e => setNewNoteContent(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !showReminder) handleAddNote(); }}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30" 
                        />
                        <button 
                          onClick={handleAddNote} 
                          className="bg-brand hover:bg-brand-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold shrink-0 cursor-pointer press-scale whitespace-nowrap shadow-xs"
                        >
                          추가
                        </button>
                      </div>

                      {/* 상담 결과 선택 */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-xs font-bold text-slate-500 shrink-0">상담 결과:</span>
                        {(Object.entries(OUTCOME_CONFIG) as [ConsultOutcome, typeof OUTCOME_CONFIG[ConsultOutcome]][]).map(([key, cfg]) => (
                          <button 
                            key={key} 
                            onClick={() => setNewNoteOutcome(newNoteOutcome === key ? '' : key)}
                            className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer press-scale transition-all ${
                              newNoteOutcome === key 
                                ? `${cfg.bgColor} ${cfg.color} border-current font-bold ring-1 ring-current/20` 
                                : 'text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {cfg.emoji} {cfg.label}
                          </button>
                        ))}
                      </div>

                      {/* 리마인더 설정 토글 */}
                      <div className="space-y-2 pt-1">
                        <button 
                          onClick={() => setShowReminder(!showReminder)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer press-scale transition-all flex items-center gap-1.5 ${
                            showReminder ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold' : 'text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          차기 일정 / 리마인더 설정
                        </button>

                        {showReminder && (
                          <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 space-y-3 animate-fadeIn">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { label: '📞 통화', value: '통화' },
                                { label: '💬 문자', value: '문자' },
                                { label: '🤝 방문미팅', value: '방문미팅' },
                                { label: '💰 입금확인', value: '입금확인' },
                                { label: '📄 서류요청', value: '서류요청' },
                              ].map(qa => (
                                <button 
                                  key={qa.value} 
                                  onClick={() => setReminderAction(qa.value)}
                                  className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer press-scale transition-all ${
                                    reminderAction === qa.value 
                                      ? 'bg-amber-200 text-amber-900 border-amber-400 font-bold' 
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                  }`}
                                >
                                  {qa.label}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">날짜</label>
                                <input 
                                  type="date" 
                                  value={reminderDate} 
                                  onChange={e => setReminderDate(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">시간</label>
                                <input 
                                  type="time" 
                                  value={reminderTime} 
                                  onChange={e => setReminderTime(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">액션</label>
                                <input 
                                  type="text" 
                                  value={reminderAction} 
                                  onChange={e => setReminderAction(e.target.value)}
                                  placeholder="직접 입력" 
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">메모 (선택)</label>
                              <textarea 
                                value={reminderMemo} 
                                onChange={e => setReminderMemo(e.target.value)}
                                placeholder="예: 24개월 청년특례 신청 서류 안내 필요"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none h-14" 
                              />
                            </div>
                            <p className="text-[11px] text-amber-700">→ 일정/할일 캘린더에 자동 등록됩니다.</p>
                          </div>
                        )}
                      </div>

                      {/* 메모 목록 */}
                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                        {[...selectedExt.notes].reverse().map(note => {
                          const catCfg = CRM_NOTE_CATEGORIES[note.category];
                          const outCfg = note.outcome ? OUTCOME_CONFIG[note.outcome] : null;
                          const rem = note.reminder;
                          const remDday = rem && !rem.completed ? Math.ceil((new Date(rem.date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000) : null;
                          return (
                            <div key={note.id} className={`p-4 rounded-2xl border text-sm transition-all shadow-xs ${outCfg ? `${outCfg.bgColor} ${outCfg.borderColor} border-l-4` : 'bg-slate-50/70 border-slate-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs px-2 py-0.5 rounded-md ${catCfg.color} bg-white border font-bold shadow-xs`}>
                                    {catCfg.emoji} {catCfg.label}
                                  </span>
                                  {outCfg && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${outCfg.color} font-bold`}>
                                      {outCfg.emoji} {outCfg.label}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-600 font-bold">{note.authorName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400 font-mono">{timeAgo(note.createdAt)}</span>
                                  <button onClick={() => handleDeleteNote(note.id)} className="text-slate-400 hover:text-rose-500 cursor-pointer p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-slate-800 leading-relaxed font-normal whitespace-pre-line">{note.content}</p>
                              {rem && (
                                <div className={`mt-2.5 p-2.5 rounded-xl ${rem.completed ? 'bg-slate-100 text-slate-400' : remDday !== null && remDday <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100/70 text-amber-900'}`}>
                                  <div className="flex items-center gap-2 text-xs font-bold">
                                    <span>{rem.completed ? '✅' : '🔔'}</span>
                                    <span className={rem.completed ? 'line-through' : ''}>{rem.action}{rem.time ? ` ${rem.time}` : ''} ({rem.date})</span>
                                    {!rem.completed && remDday !== null && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                        {remDday === 0 ? 'D-Day' : remDday > 0 ? `D-${remDday}` : `D+${Math.abs(remDday)}`}
                                      </span>
                                    )}
                                    {!rem.completed && (
                                      <button 
                                        onClick={async () => {
                                          if (!selectedId) return;
                                          const ext = getCrmExt(selectedId);
                                          const updatedNotes = ext.notes.map(n => n.id === note.id ? { ...n, reminder: { ...n.reminder!, completed: true, completedAt: new Date().toISOString() } } : n);
                                          await updateCrmExt(selectedId, { notes: updatedNotes });
                                          toast.success('리마인더 완료 처리되었습니다.');
                                        }} 
                                        className="text-emerald-700 hover:text-emerald-900 font-bold ml-auto cursor-pointer"
                                      >
                                        ✓ 완료
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {selectedExt.notes.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">기록된 메모가 없습니다. 위 입력창에서 메모를 추가하세요.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ══════════ [3] 팀워크 탭 ══════════ */}
                  {detailTab === 'teamwork' && (
                    <TeamworkTab
                      tenantId={activeLawyer.lawFirmId || activeLawyer.id}
                      targetType="consult_request"
                      targetId={selectedId}
                      currentUserId={activeStaff?.id || activeLawyer.id}
                      currentUserName={activeStaff?.name || activeLawyer.name}
                      currentUserRole={activeStaff?.role || 'OWNER'}
                      staffMembers={staffMembers}
                    />
                  )}

                  {/* ══════════ [4] 타임라인 탭 ══════════ */}
                  {detailTab === 'timeline' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          📅 사건 활동 타임라인
                        </span>
                        <span className="text-xs text-slate-400 font-mono">총 {selectedExt.activities.length}건</span>
                      </div>
                      <div className="space-y-0 max-h-[500px] overflow-y-auto pl-2">
                        {[...selectedExt.activities].reverse().map((act, idx) => (
                          <div key={act.id} className="flex gap-4 pb-5">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                                act.type === 'status_change' ? 'bg-blue-500 ring-4 ring-blue-100' :
                                act.type === 'assigned' ? 'bg-emerald-500 ring-4 ring-emerald-100' :
                                act.type === 'transferred' ? 'bg-amber-500 ring-4 ring-amber-100' :
                                act.type === 'document_checked' ? 'bg-purple-500 ring-4 ring-purple-100' :
                                'bg-slate-400 ring-4 ring-slate-100'
                              }`} />
                              {idx < selectedExt.activities.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-2" />}
                            </div>
                            <div className="flex-1 pb-1">
                              <p className="text-sm text-slate-800 font-medium">{act.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-600 font-bold">{act.actorName}</span>
                                <span className="text-xs text-slate-400 font-mono">{new Date(act.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedExt.activities.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">활동 기록이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ══════════ [5] 수임료 탭 ══════════ */}
                  {detailTab === 'fees' && (() => {
                    const ext = getCrmExt(selectedId);
                    const schedule = ext.feeSchedule || [];
                    const totalFee = ext.totalFee || 0;
                    const totalPaid = schedule.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
                    return (
                      <div className="space-y-4">
                        {/* 총 수임료 설정 & 게이지 */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              💰 총 약정 수임료
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                defaultValue={totalFee || ''}
                                placeholder="금액 입력"
                                onBlur={async (e) => {
                                  const val = Number(e.target.value);
                                  if (val > 0 && val !== totalFee) await updateCrmExt(selectedId, { ...getCrmExt(selectedId), totalFee: val });
                                }}
                                className="w-28 text-right bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/30"
                              />
                              <span className="text-xs text-slate-600 font-bold">만원</span>
                            </div>
                          </div>
                          {totalFee > 0 && (
                            <>
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-500">납부 완료</span>
                                <span className="font-bold text-emerald-600 font-mono">{totalPaid.toLocaleString()}만원</span>
                              </div>
                              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totalPaid / totalFee) * 100)}%` }} />
                              </div>
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-500">잔여 미수금</span>
                                <span className={`font-bold font-mono ${totalFee - totalPaid > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {(totalFee - totalPaid).toLocaleString()}만원
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* 분납 스케줄 추가 */}
                        <div className="bg-blue-50/50 border border-blue-200/60 p-4 rounded-2xl space-y-3">
                          <p className="text-xs font-bold text-blue-950">➕ 분납 스케줄 추가</p>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="text-[11px] text-slate-500 font-bold mb-1 block">구분</label>
                              <select id="fee-label-select" className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs">
                                <option value="계약금(착수금)">계약금(착수금)</option>
                                <option value="1차 분납">1차 분납</option>
                                <option value="2차 분납">2차 분납</option>
                                <option value="3차 분납">3차 분납</option>
                                <option value="4차 분납">4차 분납</option>
                                <option value="잔금">잔금</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500 font-bold mb-1 block">금액 (만원)</label>
                              <input id="fee-amount-input" type="number" placeholder="예: 50" className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs" />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500 font-bold mb-1 block">납부 예정일</label>
                              <input id="fee-date-input" type="date" className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs" />
                            </div>
                          </div>
                          <button onClick={async () => {
                            const labelEl = document.getElementById('fee-label-select') as HTMLSelectElement;
                            const amtEl = document.getElementById('fee-amount-input') as HTMLInputElement;
                            const dateEl = document.getElementById('fee-date-input') as HTMLInputElement;
                            if (!amtEl?.value || !dateEl?.value) { toast.error('금액과 납부일을 입력해주세요.'); return; }
                            const latestExt = getCrmExt(selectedId);
                            const latestSchedule = latestExt.feeSchedule || [];
                            const newInst: FeeInstallment = {
                              id: `fee-${Date.now()}`, round: latestSchedule.length + 1,
                              amount: Number(amtEl.value), dueDate: dateEl.value, status: 'pending',
                              memo: labelEl.value,
                            };
                            await updateCrmExt(selectedId, { ...latestExt, feeSchedule: [...latestSchedule, newInst] });
                            amtEl.value = ''; dateEl.value = '';
                            toast.success(`${labelEl.value} ${Number(amtEl.value || newInst.amount).toLocaleString()}만원 추가`);
                          }} className="w-full py-2.5 text-xs font-bold text-white bg-brand rounded-xl hover:bg-brand/90 transition-all press-scale whitespace-nowrap shadow-xs">스케줄 추가</button>
                        </div>

                        {/* 분납 리스트 */}
                        {schedule.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-700">📋 분납 스케줄 ({schedule.length}건)</p>
                            {schedule.map(inst => {
                              const isPast = new Date(inst.dueDate) < new Date() && inst.status === 'pending';
                              return (
                                <div key={inst.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all shadow-xs ${inst.status === 'paid' ? 'border-emerald-200 bg-emerald-50/50' : isPast ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-600">{inst.memo || `${inst.round}차`}</span>
                                      <span className="text-sm font-bold text-slate-900 font-mono">{inst.amount.toLocaleString()}만원</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                      📅 {inst.dueDate}
                                      {inst.paidDate && <span className="text-emerald-600 font-medium font-sans"> → {inst.paidDate} 납부완료</span>}
                                      {isPast && inst.status === 'pending' && <span className="text-rose-600 font-bold font-sans"> (기한 경과)</span>}
                                    </p>
                                  </div>
                                  {inst.status === 'pending' && (
                                    <button onClick={async () => {
                                      const latestExt = getCrmExt(selectedId);
                                      const updated = { ...latestExt, feeSchedule: (latestExt.feeSchedule || []).map(f => f.id === inst.id ? { ...f, status: 'paid' as const, paidDate: new Date().toISOString().split('T')[0] } : f) };
                                      await updateCrmExt(selectedId, updated);
                                      toast.success(`${inst.memo || inst.round + '차'} 납부 확인`);
                                    }} className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-200 press-scale whitespace-nowrap">💳 납부 확인</button>
                                  )}
                                  <button onClick={async () => {
                                    const latestExt = getCrmExt(selectedId);
                                    const updated = { ...latestExt, feeSchedule: (latestExt.feeSchedule || []).filter(f => f.id !== inst.id) };
                                    await updateCrmExt(selectedId, updated);
                                  }} className="text-slate-300 hover:text-rose-500 transition-colors p-1" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : isPast ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                                    {inst.status === 'paid' ? '✅ 완료' : isPast ? '⚠️ 연체' : '⏳ 대기'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400 text-xs">등록된 분납 스케줄이 없습니다.</div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ══════════ [6] 문서 탭 ══════════ */}
                  {detailTab === 'documents' && (() => {
                    const ext = getCrmExt(selectedId);
                    const files = ext.uploadedFiles || [];
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            📁 의뢰인 제출 서류 관리
                          </h4>
                          <label className="text-xs font-bold text-brand bg-brand/5 px-3 py-2 rounded-xl border border-brand/20 hover:bg-brand/10 press-scale cursor-pointer whitespace-nowrap flex items-center gap-1">
                            <Upload className="w-3.5 h-3.5" />
                            서류 업로드
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const newDoc: DocumentFile = {
                                  id: `doc-${Date.now()}`, name: file.name,
                                  category: 'other', uploadedAt: new Date().toISOString(),
                                  uploadedBy: activeLawyer.name, fileSize: file.size,
                                  mimeType: file.type, dataUrl: reader.result as string,
                                };
                                await updateCrmExt(selectedId, { ...ext, uploadedFiles: [...files, newDoc] });
                                toast.success(`${file.name} 업로드 완료`);
                              };
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                        </div>

                        {/* 기본 필수 서류 체크리스트 */}
                        <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3">
                          <span className="text-xs font-black text-slate-800 block">✓ 회생/파산 기본 필수 서류 체크</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {ext.documents.map(doc => (
                              <div key={doc.id} onClick={() => handleToggleDocument(doc.id)} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${doc.checked ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                <input type="checkbox" checked={doc.checked} readOnly className="rounded border-slate-300 text-brand" />
                                <span className="text-xs flex-1 truncate">{doc.label}</span>
                                {doc.checked && <span className="text-[10px] text-emerald-600 font-mono">확인완료</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 업로드된 파일 리스트 */}
                        {files.length > 0 ? (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-700 block">첨부 파일 ({files.length}건)</span>
                            {files.map(f => (
                              <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-brand shrink-0" />
                                  <span className="text-xs font-bold text-slate-800 truncate">{f.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">({Math.round(f.fileSize / 1024)} KB)</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <a href={f.dataUrl} download={f.name} className="text-brand hover:text-brand-hover text-xs font-bold flex items-center gap-0.5 p-1">
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  <button onClick={async () => {
                                    const latestExt = getCrmExt(selectedId);
                                    await updateCrmExt(selectedId, { ...latestExt, uploadedFiles: (latestExt.uploadedFiles || []).filter(item => item.id !== f.id) });
                                    toast.success('파일이 삭제되었습니다.');
                                  }} className="text-slate-300 hover:text-rose-500 p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* ══════════ [7] 보정 탭 ══════════ */}
                  {detailTab === 'corrections' && (() => {
                    const ext = getCrmExt(selectedId);
                    const list = ext.corrections || [];
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            📮 법원 보정 권고 / 명령 관리
                          </h4>
                        </div>
                        {list.length > 0 ? (
                          <div className="space-y-3">
                            {list.map(c => (
                              <div key={c.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-amber-900">제{c.round}차 보정 권고</span>
                                  <span className="text-[11px] font-mono text-slate-500">기한: {c.dueDate}</span>
                                </div>
                                <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-10 text-slate-400 text-xs">등록된 보정 권고가 없습니다.</div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ══════════ [8] 법원 탭 ══════════ */}
                  {detailTab === 'court' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          ⚖️ 법원 사건 연동 정보
                        </h4>
                      </div>
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-700">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block mb-1">관할 법원</span>
                            <span className="font-bold text-slate-900 text-sm">서울회생법원</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-1">사건 번호</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">2026개회108422 (접수예정)</span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-200 text-slate-500 text-[11px] leading-relaxed">
                          대법원 나의사건검색 스크래핑 연동 대기 중입니다. 법원 접수 후 사건번호를 등록하면 기일 및 보정명령이 자동 동기화됩니다.
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════ 신규 리드 뷰 ══════════ */}
      {viewMode === 'leads' && handleOpenProposalDraft && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                📋 신규 상담 요청
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">채무 구조와 소득 진단을 검토한 후 제안서를 작성하세요.</p>
            </div>
            <span className="text-xs bg-brand/10 text-brand px-3 py-1.5 rounded-lg font-bold whitespace-nowrap">
              회생파산 전담팀
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {requests
              .filter(r => {
                const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
                const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
                  const targetLawyer = lawyers.find(l => l.id === id);
                  return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
                });
                const openMatch = r.requestType === 'open';
                return (directMatch || sameFirmMatch || openMatch) && (r.status === 'requested' || r.status === 'responding');
              })
              .filter(r => !(r.proposals || []).some((p: any) => p.lawyerId === activeLawyer.id))
              .map((r, idx) => {
                const fp = r.financialProfile;
                const debtRatio = (fp.debtTotal / (fp.income * 12)).toFixed(1);
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
                    {/* 카드 헤더 */}
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          r.requestType === 'direct' ? 'bg-[#1E3A5F] text-white' :
                          r.requestType === 'direct_multi' ? 'bg-slate-800 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {r.requestType === 'direct' ? '단독지명' : r.requestType === 'direct_multi' ? '의뢰인 지정' : '오픈형'}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{r.clientName}</span>
                        {isNewCase(r.createdAt) && <NewBadge />}
                      </div>
                      <span className="bg-rose-50 text-rose-600 font-bold text-[10px] px-2 py-0.5 rounded-md border border-rose-200">제안서 대기</span>
                    </div>

                    {/* 카드 본문 */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 line-clamp-1">{r.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-0.5">{r.content}</p>
                      </div>

                      {/* 핵심 재무 요약 */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500">총채무</div>
                          <div className="text-sm font-black text-slate-900">{fp.debtTotal.toLocaleString()}<span className="text-[10px] font-medium">만</span></div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500">월소득</div>
                          <div className="text-sm font-black text-slate-900">{fp.income}<span className="text-[10px] font-medium">만</span></div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-slate-500">DTI</div>
                          <div className={`text-sm font-black ${Number(debtRatio) > 20 ? 'text-rose-600' : 'text-slate-900'}`}>{debtRatio}<span className="text-[10px] font-medium">배</span></div>
                        </div>
                      </div>

                      {/* 의뢰인 메모 */}
                      {((fp.clientNotes && fp.clientNotes.length > 0) || fp.clientNote) && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">📝 의뢰인 메모</span>
                          {fp.clientNotes && fp.clientNotes.length > 0 ? (
                            <div className="text-xs text-slate-700 line-clamp-2">{fp.clientNotes.join(' / ')}</div>
                          ) : (
                            <div className="text-xs text-slate-700 line-clamp-2">{fp.clientNote}</div>
                          )}
                        </div>
                      )}

                      {/* 위험 플래그 */}
                      <div className="flex flex-wrap gap-1 mt-auto pt-1">
                        {fp.specialCondition && fp.specialCondition !== 'none' && (
                          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-slate-200">
                            ⚡ 특례: {fp.specialCondition === 'basic_recipient' ? '기초수급' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'single_parent' ? '한부모' : fp.specialCondition === 'rent_fraud' ? '전세사기' : '고령자'}
                          </span>
                        )}
                        {fp.riskFlags.map(rf => (
                          <span key={rf} className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-md font-bold border border-rose-200">⚠️ {rf}</span>
                        ))}
                      </div>
                    </div>

                    {/* 카드 푸터: 액션 버튼 */}
                    <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => { setSelectedId(r.id); setViewMode('list'); }}
                        className="text-slate-500 hover:text-slate-700 font-bold py-1.5 px-2.5 rounded-lg text-xs transition-all cursor-pointer hover:bg-slate-100 press-scale"
                      >
                        상세 보기
                      </button>
                      <div className="flex gap-2">
                        {setCopilotPreselectedReqId && setActiveTab && (
                          <button
                            onClick={() => { setCopilotPreselectedReqId(r.id); setActiveTab('case-copilot'); }}
                            className="bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center gap-1 border border-slate-200 whitespace-nowrap press-scale cursor-pointer"
                          >
                            🔬 AI 분석
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenProposalDraft(r.id)}
                          className="bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold py-2 px-4 rounded-xl text-xs tracking-wide transition-all shadow-xs flex items-center gap-1 whitespace-nowrap press-scale cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          제안서 작성
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* 빈 상태 */}
            {requests
              .filter(r => {
                const directMatch = r.selectedLawyerIds?.includes(activeLawyer.id) || r.selectedLawyerId === activeLawyer.id;
                const sameFirmMatch = activeLawyer.lawFirmId && r.selectedLawyerIds?.some(id => {
                  const targetLawyer = lawyers.find(l => l.id === id);
                  return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
                });
                const openMatch = r.requestType === 'open';
                return (directMatch || sameFirmMatch || openMatch) && (r.status === 'requested' || r.status === 'responding');
              })
              .filter(r => !(r.proposals || []).some((p: any) => p.lawyerId === activeLawyer.id))
              .length === 0 && (
              <div className="col-span-full bg-white p-10 text-center rounded-2xl border border-slate-200 space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-700 font-bold">현재 대응할 신규 상담 요청이 없습니다.</p>
                <p className="text-xs text-slate-400">의뢰인이 상담을 요청하면 이곳에 표시됩니다.</p>
                <button onClick={() => setViewMode('list')} className="text-xs text-brand font-bold hover:underline cursor-pointer mt-2">
                  전체 고객 목록 보기 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ 칸반 뷰 ══════════ */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {CRM_STATUSES.map(status => {
              const sc = CRM_STATUS_CONFIG[status];
              const clients = filteredRequests.filter(r => getCrmExt(r.id).crmStatus === status);
              return (
                <div key={status}
                  className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50/50', 'ring-2', 'ring-blue-300/30'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('bg-blue-50/50', 'ring-2', 'ring-blue-300/30'); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.currentTarget.classList.remove('bg-blue-50/50', 'ring-2', 'ring-blue-300/30');
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) handleKanbanDrop(id, status);
                  }}>
                  {/* 컬럼 헤더 */}
                  <div className={`p-4 border-b border-slate-100 ${sc.bgColor}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-black ${sc.color}`}>{sc.emoji} {sc.label}</span>
                      <span className={`text-xs ${sc.color} font-bold bg-white/70 px-2 py-0.5 rounded-md`}>{clients.length}</span>
                    </div>
                  </div>
                  {/* 카드 */}
                  <div className="p-3 space-y-2.5 min-h-[120px] max-h-[550px] overflow-y-auto">
                    {clients.map(r => {
                      const ext = getCrmExt(r.id);
                      return (
                        <div key={r.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', r.id); setDraggedId(r.id); }}
                          onDragEnd={() => setDraggedId(null)}
                          onClick={() => { setSelectedId(r.id); setViewMode('list'); }}
                          className={`bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-brand/40 cursor-pointer transition-all hover:shadow-md group ${draggedId === r.id ? 'opacity-50 scale-95' : ''}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-bold text-slate-900 truncate">{r.clientName}</span>
                              {isNewCase(r.createdAt) && <NewBadge />}
                            </div>
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                          </div>
                          <div className="text-sm text-red-500 font-bold">{r.financialProfile.debtTotal.toLocaleString()}만</div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {getStaffRoleBadge(ext.assigneeId || ext.assignedLawyerId)}
                            <span className="text-xs text-slate-600 font-medium truncate">{getStaffName(ext.assigneeId || ext.assignedLawyerId)}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-1">{timeAgo(ext.lastActivityAt)}</div>
                        </div>
                      );
                    })}
                    {clients.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium">없음</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showBulkMessage && (
        <div className="bg-white border-t border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">📢 타겟 메시지 대량 발송</h3>
            <button onClick={() => setShowBulkMessage(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'doc_overdue', label: '서류 3일+ 미제출', emoji: '📋' },
              { key: 'fee_overdue', label: '분납 2회+ 연체', emoji: '💸' },
              { key: 'hearing_month', label: '이달 집회 참석 대상', emoji: '🏛️' },
              { key: 'correction_urgent', label: '보정 기한 임박 (3일 내)', emoji: '⚠️' },
            ].map(f => (
              <button key={f.key} onClick={() => setBulkFilter(f.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors press-scale cursor-pointer ${bulkFilter === f.key ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
          <div className="bg-slate-50 p-3 rounded-xl">
            <p className="text-xs text-slate-500">대상: <span className="font-bold text-slate-700">{(() => {
              // Simple filter logic based on CRM data
              const filtered = requests.filter(r => {
                const ext = getCrmExt(r.id);
                if (bulkFilter === 'doc_overdue') return ext.documents?.some((d: any) => !d.checked);
                if (bulkFilter === 'fee_overdue') return (ext.feeSchedule || []).filter((f: any) => f.status === 'overdue').length >= 2;
                if (bulkFilter === 'correction_urgent') return (ext.correctionOrders || []).some((c: any) => c.status === 'pending');
                return false;
              });
              return filtered.length;
            })()}명</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { toast.success('알림톡 발송이 예약되었습니다.'); setShowBulkMessage(false); }} className="flex-1 py-2.5 text-xs font-bold text-white bg-yellow-500 rounded-xl hover:bg-yellow-600 transition-colors press-scale whitespace-nowrap cursor-pointer">💬 카카오 알림톡 발송</button>
            <button onClick={() => { toast.success('SMS 발송이 예약되었습니다.'); setShowBulkMessage(false); }} className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors press-scale whitespace-nowrap cursor-pointer">📱 SMS 발송</button>
          </div>
        </div>
      )}

      {/* ── 케이스 관리 모달 ── */}
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onRegister={handleNewCaseRegister}
        existingRequests={requests}
      />
      <ImportCasesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBulkImport}
        existingRequests={requests}
      />
      <ExportCasesModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        requests={filteredRequests}
        getCrmExt={getCrmExt}
      />
      <DropOffReasonModal
        isOpen={isDropOffModalOpen}
        onClose={() => { setIsDropOffModalOpen(false); setDropOffTargetId(''); }}
        clientName={requests.find(r => r.id === dropOffTargetId)?.clientName || ''}
        onConfirm={handleDropOffConfirm}
      />

      {/* ── 배정 지시 모달 ── */}
      <AssignmentDirectiveModal
        isOpen={showDirectiveModal}
        onClose={() => { setShowDirectiveModal(false); setPendingAssignment(null); }}
        onSkip={handleDirectiveSkip}
        onSubmit={handleDirectiveSubmit}
        assigneeName={(() => {
          if (!pendingAssignment) return '';
          return [...lawyers, ...staffMembers].find(l => l.id === pendingAssignment.lawyerId)?.name || '';
        })()}
        assigneeRole={(() => {
          if (!pendingAssignment) return 'STAFF';
          const found = staffMembers.find(m => m.id === pendingAssignment.lawyerId);
          return found?.role || 'LAWYER';
        })()}
        clientName={requests.find(r => r.id === pendingAssignment?.clientId)?.clientName || ''}
      />
    </div>
  );
}
