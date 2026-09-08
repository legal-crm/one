import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck, CheckCircle2, Clock, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Activity,
  ListCheck, Briefcase, MessageSquare, FolderHeart,
  Plus, Trash2, X, Repeat, Bell, ChevronDown, User, Check,
  Search, ExternalLink, ChevronFirst, ChevronLast, Sparkles,
  ListFilter, CheckSquare, Layers, Send, ThumbsUp,
  ThumbsDown, RotateCcw, Calculator, ArrowRight, ShieldCheck,
  Kanban
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import {
  getMyTasks, getMyAssignedTasks, getAllTenantTasks,
  createTask, createTaskBatch, updateTaskStatus, deleteTask,
  requestTaskReview, approveTask, rejectTask, toggleSubtask
} from '../../services/taskTicketService';
import type { TaskTicket, TaskPriority, TaskStatus, MessageTargetType, TaskSubtask } from '../../types/communication';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../types/communication';
import {
  TASK_PACKAGE_TEMPLATES, calculateCourtDeadline, type TaskPackageTemplate
} from '../../services/taskTemplateService';
import {
  getVisibleEvents, createEvent, deleteEvent, canDeleteEvent,
  getAvailableVisibilities, getDefaultVisibility,
  EVENT_TYPE_CONFIG, VISIBILITY_CONFIG, RECURRENCE_CONFIG, REMINDER_CONFIG
} from '../../services/calendarEventService';
import type { CalendarEvent, EventType, EventVisibility, RecurrenceType, ReminderType } from '../../services/calendarEventService';
import type { StaffMember } from '../../types';

interface TasksScheduleTabProps {
  tenantId: string;
  userId: string;
  userName: string;
  userRole: string;
  hasManageCalendar?: boolean;
  canAssignTasks?: boolean;
  canManageAllTasks?: boolean;
  canApproveTasks?: boolean;
  requests: any[];
  cases: any[];
  qas: any[] | undefined;
  activeLawyerId: string;
  staffMembers?: StaffMember[];
  lawyers?: any[];
}

type SubTab = 'tasks' | 'calendar' | 'activity';
type TaskViewMode = 'list' | 'kanban';
type TaskScope = 'my' | 'assigned' | 'all';
type TaskFilter = 'all' | 'pending' | 'in_progress' | 'review_requested' | 'completed';
type CalView = 'month' | 'week';
type ActivityFilterType = 'all' | 'request' | 'counseling' | 'case' | 'task' | 'qna';
type ActivityPeriodType = 'all' | 'today' | '7days' | '30days';

const KOREAN_HOLIDAYS: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
  '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
  '10-09': '한글날', '12-25': '성탄절',
  '02-16': '설날 전날', '02-17': '설날', '02-18': '설날 다음날',
  '05-24': '부처님오신날',
  '09-24': '추석 전날', '09-25': '추석', '09-26': '추석 다음날',
};

function getHoliday(_y: number, month: number, day: number): string | null {
  const key = String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  return KOREAN_HOLIDAYS[key] || null;
}

function parseSafeDate(d: any): Date {
  if (!d) return new Date();
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function timeAgo(d: Date): string {
  if (isNaN(d.getTime())) return '방금 전';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return '방금 전';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatSafeFullDate(d: Date): string {
  if (isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${hrs}:${mins}`;
}

function toDateKey(y: number, m: number, d: number): string {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function dDay(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function TasksScheduleTab({
  tenantId, userId, userName, userRole, hasManageCalendar = false,
  canAssignTasks = false, canManageAllTasks = false, canApproveTasks = false,
  requests, cases, qas, activeLawyerId,
  staffMembers = [], lawyers = []
}: TasksScheduleTabProps) {
  const dialog = useDialog();
  const [sub, setSub] = useState<SubTab>('tasks');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('list');
  const [tasks, setTasks] = useState<TaskTicket[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskScope, setTaskScope] = useState<TaskScope>('my');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  
  // 2단계 검토 & 승인/반려 상태
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalNoteInput, setApprovalNoteInput] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNoteInput, setRejectionNoteInput] = useState('');

  // 캘린더 상태
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // 활동 기록 상태
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>('all');
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriodType>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [selectedActivityItem, setSelectedActivityItem] = useState<any | null>(null);
  const ACTIVITY_PER_PAGE = 10;

  const [calView, setCalView] = useState<CalView>('month');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
  });
  const [typeFilters, setTypeFilters] = useState<Record<EventType, boolean>>({
    court: true, consult: true, meeting: true, deadline: true, other: true
  });
  const [visFilter, setVisFilter] = useState<'all' | EventVisibility>('all');

  // 모달 및 위젯 상태
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDeadlineCalculator, setShowDeadlineCalculator] = useState(false);

  // 불변기한 계산기 상태
  const [calcStartDate, setCalcStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [calcDays, setCalcDays] = useState(7);
  const [calcTitle, setCalcTitle] = useState('법원 보정서 제출');
  const [calcTargetId, setCalcTargetId] = useState('general');

  // 템플릿 패키지 일괄 생성 모달 상태
  const [selectedTemplate, setSelectedTemplate] = useState<TaskPackageTemplate>(TASK_PACKAGE_TEMPLATES[0]);
  const [templateAssigneeId, setTemplateAssigneeId] = useState(userId);
  const [templateTargetId, setTemplateTargetId] = useState('general');
  const [templateBaseDate, setTemplateBaseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 권한 체계 정밀 계산
  const isLawyerOrOwner = userRole === 'OWNER' || userRole === 'LAWYER';
  const hasAssignPerm = isLawyerOrOwner || canAssignTasks;
  const hasManageAllPerm = isLawyerOrOwner || canManageAllTasks;
  const hasApprovePerm = isLawyerOrOwner || canApproveTasks;

  const defaultVis = getDefaultVisibility(userRole, hasManageCalendar);
  const availableVis = getAvailableVisibilities(userRole, hasManageCalendar);

  // 새 일정 상태
  const [newEvt, setNewEvt] = useState({
    title: '', date: '', startTime: '', endTime: '',
    type: 'consult' as EventType, visibility: defaultVis,
    description: '', clientName: '',
    recurrence: 'none' as RecurrenceType, reminder: 'none' as ReminderType
  });

  // 새 할일 상태 (서브태스크 및 승인필요 플래그 추가)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: userId,
    priority: 'NORMAL' as TaskPriority,
    dueDate: '',
    targetType: 'general' as MessageTargetType,
    targetId: 'general',
    requiresApproval: false,
    subtasks: [] as { id: string; title: string; completed: boolean }[],
  });
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // 모든 멤버 목록 (변호사 + 활성 스태프)
  const assignableMembers = useMemo(() => {
    const list: { id: string; name: string; roleLabel: string }[] = [];
    list.push({ id: userId, name: `${userName} (본인)`, roleLabel: userRole });
    lawyers.forEach(l => {
      if (l.id !== userId) list.push({ id: l.id, name: l.name, roleLabel: '변호사' });
    });
    staffMembers.filter(s => s.status === 'active' && s.id !== userId).forEach(s => {
      list.push({ id: s.id, name: s.name, roleLabel: s.role || '스태프' });
    });
    return list;
  }, [userId, userName, userRole, lawyers, staffMembers]);

  // 대상 사건/고객 목록 (선택 옵션)
  const targetOptions = useMemo(() => {
    const list: { type: MessageTargetType; id: string; label: string }[] = [
      { type: 'general', id: 'general', label: '📌 일반 업무 (특정 고객 없음)' }
    ];
    (requests || []).slice(0, 20).forEach(r => {
      list.push({
        type: 'consult_request',
        id: r.id,
        label: `💬 상담: ${r.clientName || '익명'} (${r.category || '회생/파산'})`
      });
    });
    (cases || []).slice(0, 25).forEach(c => {
      list.push({
        type: 'case',
        id: c.id,
        label: `📁 사건: ${c.clientName || '의뢰인'} (${c.caseNumber || '사건'})`
      });
    });
    return list;
  }, [requests, cases]);

  // 할일 목록 로드
  const refreshTasks = useCallback(async () => {
    let all: TaskTicket[] = [];
    if (taskScope === 'my') {
      all = await getMyTasks(tenantId, userId);
    } else if (taskScope === 'assigned') {
      all = await getMyAssignedTasks(tenantId, userId);
    } else {
      all = await getAllTenantTasks(tenantId);
    }
    setTasks(all.filter(t => t.status !== 'CANCELLED'));
  }, [tenantId, userId, taskScope]);

  // 캘린더 이벤트 로드
  const refreshEvents = useCallback(async () => {
    const all = await getVisibleEvents(tenantId, userId, userRole);
    setEvents(all);
  }, [tenantId, userId, userRole]);

  useEffect(() => {
    refreshTasks();
    refreshEvents();
  }, [refreshTasks, refreshEvents]);

  // ── 태스크 액션 핸들러 ──
  const handleStartTask = async (id: string) => {
    await updateTaskStatus(tenantId, id, 'IN_PROGRESS');
    toast.success('업무를 시작했습니다');
    refreshTasks();
  };

  const handleCompleteTask = async (id: string) => {
    await updateTaskStatus(tenantId, id, 'COMPLETED', completionNote);
    toast.success('업무를 완료 처리했습니다');
    setCompletingId(null);
    setCompletionNote('');
    refreshTasks();
  };

  // 검토 요청 핸들러
  const handleRequestReview = async (id: string) => {
    await requestTaskReview(tenantId, id, reviewNote);
    toast.success('지시자에게 검토(승인)를 요청했습니다');
    setReviewingId(null);
    setReviewNote('');
    refreshTasks();
  };

  // 승인 완료 핸들러
  const handleApproveTask = async (id: string) => {
    await approveTask(tenantId, id, approvalNoteInput);
    toast.success('업무가 최종 승인 완료되었습니다');
    setApprovingId(null);
    setApprovalNoteInput('');
    refreshTasks();
  };

  // 반려 / 수정보완 핸들러
  const handleRejectTask = async (id: string) => {
    if (!rejectionNoteInput.trim()) {
      toast.error('수정보완 요청 사유를 입력해주세요');
      return;
    }
    await rejectTask(tenantId, id, rejectionNoteInput.trim());
    toast.warning('업무가 반려되어 보완 요청되었습니다');
    setRejectingId(null);
    setRejectionNoteInput('');
    refreshTasks();
  };

  // 서브태스크 완료 토글
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    await toggleSubtask(tenantId, taskId, subtaskId);
    refreshTasks();
  };

  const handleDeleteTask = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: '업무 삭제',
      message: '이 업무를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    await deleteTask(tenantId, id);
    toast.success('업무가 삭제되었습니다');
    refreshTasks();
  };

  // 새 서브태스크 추가 핸들러
  const handleAddSubtaskDraft = () => {
    if (!newSubtaskInput.trim()) return;
    setNewTask(p => ({
      ...p,
      subtasks: [
        ...p.subtasks,
        { id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, title: newSubtaskInput.trim(), completed: false }
      ]
    }));
    setNewSubtaskInput('');
  };

  const handleRemoveSubtaskDraft = (stId: string) => {
    setNewTask(p => ({
      ...p,
      subtasks: p.subtasks.filter(s => s.id !== stId)
    }));
  };

  // 새 단일 할일 생성
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('업무 제목을 입력해주세요');
      return;
    }
    if (!newTask.assigneeId) {
      toast.error('담당자를 선택해주세요');
      return;
    }

    const assignee = assignableMembers.find(m => m.id === newTask.assigneeId);
    await createTask(tenantId, {
      targetType: newTask.targetType,
      targetId: newTask.targetId,
      assignerId: userId,
      assignerName: userName,
      assigneeId: newTask.assigneeId,
      assigneeName: assignee ? assignee.name.replace(' (본인)', '') : userName,
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      subtasks: newTask.subtasks,
      requiresApproval: newTask.requiresApproval,
    });

    toast.success('새 할일이 성공적으로 등록되었습니다');
    setShowAddTaskModal(false);
    setNewTask({
      title: '',
      description: '',
      assigneeId: userId,
      priority: 'NORMAL',
      dueDate: '',
      targetType: 'general',
      targetId: 'general',
      requiresApproval: false,
      subtasks: [],
    });
    refreshTasks();
  };

  // 템플릿 패키지 일괄 등록 핸들러
  const handleApplyTemplatePackage = async () => {
    const assignee = assignableMembers.find(m => m.id === templateAssigneeId);
    const targetOpt = targetOptions.find(o => o.id === templateTargetId);

    const itemsToCreate = selectedTemplate.tasks.map(t => {
      const calcDue = calculateCourtDeadline(templateBaseDate, t.offsetDays);
      return {
        targetType: targetOpt ? targetOpt.type : 'general' as MessageTargetType,
        targetId: templateTargetId,
        assignerId: userId,
        assignerName: userName,
        assigneeId: templateAssigneeId,
        assigneeName: assignee ? assignee.name.replace(' (본인)', '') : userName,
        title: `[${selectedTemplate.name.split(' ')[0]}] ${t.title}`,
        description: t.description,
        priority: t.priority,
        dueDate: calcDue,
        requiresApproval: t.requiresApproval,
        templateId: selectedTemplate.id,
        subtasks: t.subtasks.map(st => ({
          id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: st,
          completed: false
        }))
      };
    });

    await createTaskBatch(tenantId, itemsToCreate);
    toast.success(`'${selectedTemplate.name}'의 ${itemsToCreate.length}개 표준 업무가 일괄 등록되었습니다.`);
    setShowTemplateModal(false);
    refreshTasks();
  };

  // 불변기한 계산 결과로 즉시 할일 + 캘린더 등록 핸들러
  const handleCreateDeadlineTask = async () => {
    const calculatedDate = calculateCourtDeadline(calcStartDate, calcDays);
    const targetOpt = targetOptions.find(o => o.id === calcTargetId);

    // 1. 업무 티켓 생성
    await createTask(tenantId, {
      targetType: targetOpt ? targetOpt.type : 'general',
      targetId: calcTargetId,
      assignerId: userId,
      assignerName: userName,
      assigneeId: userId,
      assigneeName: userName,
      title: `⚖️ [불변기한 D-${calcDays}] ${calcTitle}`,
      description: `송달일: ${calcStartDate} / 법정만료일: ${calculatedDate} (민법 제161조 공휴일 연장 적용)`,
      priority: 'URGENT',
      dueDate: calculatedDate,
      requiresApproval: true,
      subtasks: [
        { id: `st-${Date.now()}-1`, title: '소명 및 보정서류 완비', completed: false },
        { id: `st-${Date.now()}-2`, title: '변호사 최종 검토(컨펌)', completed: false },
        { id: `st-${Date.now()}-3`, title: '전자소송 접수 및 접수증 출력', completed: false }
      ]
    });

    // 2. 캘린더에도 불변기한 일정 동시 등록
    await createEvent(tenantId, {
      title: `⚖️ [기한] ${calcTitle}`,
      date: calculatedDate,
      type: 'deadline',
      visibility: defaultVis,
      description: `송달일(${calcStartDate})로부터 ${calcDays}일 불변기한`,
      createdBy: userId,
      createdByName: userName,
      createdByRole: userRole,
      recurrence: 'none',
      reminder: '1day'
    });

    toast.success(`불변기한 마감일(${calculatedDate})로 할일 및 캘린더가 등록되었습니다.`);
    setShowDeadlineCalculator(false);
    refreshTasks();
    refreshEvents();
  };

  // 새 일정 생성
  const handleAddEvent = async () => {
    if (!newEvt.title.trim() || !newEvt.date) {
      toast.error('제목과 날짜를 입력해주세요');
      return;
    }
    await createEvent(tenantId, {
      ...newEvt,
      createdBy: userId,
      createdByName: userName,
      createdByRole: userRole
    });
    toast.success('일정이 추가되었습니다');
    setShowAddEventModal(false);
    setNewEvt({
      title: '', date: '', startTime: '', endTime: '',
      type: 'consult', visibility: defaultVis,
      description: '', clientName: '',
      recurrence: 'none', reminder: 'none'
    });
    refreshEvents();
  };

  const handleDeleteEvent = async (evt: CalendarEvent) => {
    if (!canDeleteEvent(evt, userId, userRole, hasManageCalendar)) {
      toast.error('삭제 권한이 없습니다');
      return;
    }
    const confirmed = await dialog.confirm({
      title: '일정 삭제',
      message: `'${evt.title}' 일정을 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    await deleteEvent(tenantId, evt.id);
    toast.success('일정이 삭제되었습니다');
    refreshEvents();
  };

  const openAddModalForDate = (dateStr: string) => {
    setNewEvt({
      title: '', date: dateStr, startTime: '', endTime: '',
      type: 'consult', visibility: defaultVis,
      description: '', clientName: '',
      recurrence: 'none', reminder: 'none'
    });
    setShowAddEventModal(true);
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    let result = events;
    result = result.filter(e => typeFilters[e.type]);
    if (visFilter !== 'all') result = result.filter(e => e.visibility === visFilter);
    return result;
  }, [events, typeFilters, visFilter]);

  // Events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [filteredEvents]);

  // Tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskTicket[]> = {};
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const dd = new Date(t.dueDate);
      const key = toDateKey(dd.getFullYear(), dd.getMonth(), dd.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEvents = eventsByDate[todayKey] || [];
  const todayTasks = tasksByDate[todayKey] || [];

  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const firstDow = new Date(calYear, calMon, 1).getDay();
  const isTodayFn = (y: number, m: number, d: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  // 필터링된 할일
  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks.filter(t => t.status !== 'COMPLETED');
    if (filter === 'pending') return tasks.filter(t => t.status === 'PENDING');
    if (filter === 'in_progress') return tasks.filter(t => t.status === 'IN_PROGRESS');
    if (filter === 'review_requested') return tasks.filter(t => t.status === 'REVIEW_REQUESTED');
    return tasks.filter(t => t.status === 'COMPLETED').slice(0, 40);
  }, [tasks, filter]);

  // 칸반 컬럼별 할일
  const kanbanColumns = useMemo(() => {
    return {
      PENDING: tasks.filter(t => t.status === 'PENDING'),
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
      REVIEW_REQUESTED: tasks.filter(t => t.status === 'REVIEW_REQUESTED'),
      COMPLETED: tasks.filter(t => t.status === 'COMPLETED').slice(0, 20),
    };
  }, [tasks]);

  // ══════════════════════════════════════════════════════════════════
  // ── Activity 데이터 수집 및 안전한 파싱
  // ══════════════════════════════════════════════════════════════════
  const activityItems = useMemo(() => {
    const items: {
      id: string;
      type: ActivityFilterType;
      icon: any;
      title: string;
      desc: string;
      fullContent?: string;
      clientName?: string;
      date: Date;
      color: string;
      bg: string;
      badgeLabel: string;
      raw: any;
    }[] = [];

    // 1. 상담 요청
    (requests || []).forEach(r => {
      if (r.status === 'requested' || r.selectedLawyerId === userId || (r.acceptedLawyerIds || []).includes(userId)) {
        items.push({
          id: 'r-' + r.id,
          type: 'request',
          icon: Briefcase,
          title: '상담 요청 접수',
          desc: r.clientName ? `${r.clientName} (${r.category || '회생/파산'})` : '신규 의뢰인 상담 요청',
          clientName: r.clientName,
          fullContent: r.summary || r.financialProfile ? `총 채무: ${(r.financialProfile?.debtTotal || 0).toLocaleString()}원 / 월 소득: ${(r.financialProfile?.income || 0).toLocaleString()}원` : undefined,
          date: parseSafeDate(r.createdAt),
          color: 'text-brand',
          bg: 'bg-brand/10',
          badgeLabel: '상담요청',
          raw: r
        });
      }
      if (r.status === 'counseling' && r.selectedLawyerId === userId) {
        items.push({
          id: 'rc-' + r.id,
          type: 'counseling',
          icon: MessageSquare,
          title: '상담 진행 중',
          desc: r.clientName ? `${r.clientName} 의뢰인과 상담이 활성화되었습니다.` : '상담 진행 중',
          clientName: r.clientName,
          date: parseSafeDate(r.updatedAt || r.createdAt),
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          badgeLabel: '상담진행',
          raw: r
        });
      }
    });

    // 2. 수임 전환
    (cases || []).forEach(c => {
      if (c.assignedLawyerId === userId || isLawyerOrOwner) {
        items.push({
          id: 'c-' + c.id,
          type: 'case',
          icon: FolderHeart,
          title: '수임 전환 성공',
          desc: c.clientName ? `${c.clientName} 의뢰인 사건 수임 계약 완료 (${c.caseNumber || '사건번호 미부여'})` : '수임 전환 완료',
          clientName: c.clientName,
          fullContent: c.notes || `관할법원: ${c.court || '서울회생법원'} / 진행단계: ${c.stage || '접수준비'}`,
          date: parseSafeDate(c.createdAt || c.updatedAt),
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          badgeLabel: '수임전환',
          raw: c
        });
      }
    });

    // 3. Q&A 답변
    if (qas) {
      qas.filter(q => q.answer).forEach(q => {
        items.push({
          id: 'q-' + q.id,
          type: 'qna',
          icon: ListCheck,
          title: 'Q&A 답변 작성',
          desc: (q.question || '').slice(0, 50) + ((q.question || '').length > 50 ? '...' : ''),
          clientName: q.authorName || '상담자',
          fullContent: `질문: ${q.question}

답변: ${q.answer}`,
          date: parseSafeDate(q.answeredAt || q.createdAt),
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          badgeLabel: 'Q&A',
          raw: q
        });
      });
    }

    // 4. 완료된 업무(태스크)
    tasks.filter(t => t.status === 'COMPLETED').forEach(t => {
      items.push({
        id: 't-' + t.id,
        type: 'task',
        icon: CheckCircle2,
        title: '업무 완료',
        desc: `${t.title} (${t.assignerName} → ${t.assigneeName})`,
        clientName: t.assigneeName,
        fullContent: t.completionNote ? `완료 메모: ${t.completionNote}` : t.description,
        date: parseSafeDate(t.completedAt || t.updatedAt || t.createdAt),
        color: 'text-green-600',
        bg: 'bg-green-50',
        badgeLabel: '업무완료',
        raw: t
      });
    });

    // 최신순 정렬
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [requests, cases, qas, tasks, userId, isLawyerOrOwner]);

  // 카테고리별 건수 카운트
  const activityCounts = useMemo(() => {
    const counts = { all: activityItems.length, request: 0, counseling: 0, case: 0, task: 0, qna: 0 };
    activityItems.forEach(item => {
      if (item.type in counts) {
        counts[item.type as keyof typeof counts]++;
      }
    });
    return counts;
  }, [activityItems]);

  // 검색 및 기간 필터링 적용된 목록
  const filteredActivity = useMemo(() => {
    const now = new Date();
    return activityItems.filter(item => {
      // 1. 카테고리 필터
      if (activityFilter !== 'all' && item.type !== activityFilter) return false;

      // 2. 검색어 필터
      if (activitySearchTerm.trim()) {
        const term = activitySearchTerm.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(term);
        const matchDesc = item.desc.toLowerCase().includes(term);
        const matchClient = (item.clientName || '').toLowerCase().includes(term);
        const matchContent = (item.fullContent || '').toLowerCase().includes(term);
        if (!matchTitle && !matchDesc && !matchClient && !matchContent) return false;
      }

      // 3. 기간 필터
      if (activityPeriod !== 'all') {
        const itemTime = item.date.getTime();
        if (activityPeriod === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (itemTime < startOfToday) return false;
        } else if (activityPeriod === '7days') {
          const sevenDaysAgo = now.getTime() - 7 * 86400000;
          if (itemTime < sevenDaysAgo) return false;
        } else if (activityPeriod === '30days') {
          const thirtyDaysAgo = now.getTime() - 30 * 86400000;
          if (itemTime < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [activityItems, activityFilter, activitySearchTerm, activityPeriod]);

  // 페이징 계산
  const totalActivityPages = Math.ceil(filteredActivity.length / ACTIVITY_PER_PAGE) || 1;
  const paginatedActivity = useMemo(() => {
    const startIndex = (activityPage - 1) * ACTIVITY_PER_PAGE;
    return filteredActivity.slice(startIndex, startIndex + ACTIVITY_PER_PAGE);
  }, [filteredActivity, activityPage]);

  // 필터 변경 시 1페이지로 자동 리셋
  const handleCategoryChange = (key: ActivityFilterType) => {
    setActivityFilter(key);
    setActivityPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivitySearchTerm(e.target.value);
    setActivityPage(1);
  };

  const handlePeriodChange = (p: ActivityPeriodType) => {
    setActivityPeriod(p);
    setActivityPage(1);
  };

  const DAY_HEADERS = ['일','월','화','수','목','금','토'];
  const upcomingCourt = events.filter(e => e.type === 'court' && dDay(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const visEmoji = (v: EventVisibility) => VISIBILITY_CONFIG[v].emoji;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 서브탭 바 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
        {([
          { key: 'tasks' as const, label: '할일 목록', icon: CalendarCheck },
          { key: 'calendar' as const, label: '일정 캘린더', icon: Calendar },
          { key: 'activity' as const, label: '활동 기록', icon: Activity },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer press-scale active:scale-[0.98] flex items-center gap-2 ${
              sub === t.key ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ══ 1. Tasks (할일 목록 & 칸반 보드)
         ══════════════════════════════════════════════════════════════════ */}
      {sub === 'tasks' && (
        <div className="space-y-4">
          {/* 상단 컨트롤 바 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 스코프 필터 (지시 권한이 있는 경우) */}
              {hasAssignPerm && (
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {([
                    { key: 'my' as const, label: '내 담당 업무' },
                    { key: 'assigned' as const, label: '내가 지시한 업무' },
                    ...(hasManageAllPerm ? [{ key: 'all' as const, label: '사무소 전체' }] : []),
                  ]).map(sc => (
                    <button
                      key={sc.key}
                      onClick={() => setTaskScope(sc.key)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-[0.98] ${
                        taskScope === sc.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 상태 필터 */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: 'all' as const, label: '전체' },
                  { key: 'pending' as const, label: '대기' },
                  { key: 'in_progress' as const, label: '진행중' },
                  { key: 'review_requested' as const, label: '검토요청' },
                  { key: 'completed' as const, label: '완료' },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98] ${
                      filter === f.key
                        ? 'bg-[#1E3A5F] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* 뷰 모드 토글 (리스트 / 칸반) */}
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setTaskViewMode('list')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                    taskViewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="리스트 뷰"
                >
                  <ListCheck className="w-3.5 h-3.5" /> 리스트
                </button>
                <button
                  onClick={() => setTaskViewMode('kanban')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                    taskViewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="칸반 보드 뷰"
                >
                  <Kanban className="w-3.5 h-3.5" /> 칸반
                </button>
              </div>
            </div>

            {/* 우측 퀵 액션 버튼들 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 법원 불변기한 계산기 버튼 */}
              <button
                onClick={() => setShowDeadlineCalculator(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all shadow-xs"
                title="민법 제161조 기준 법원 보정기한 계산 및 즉시 등록"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-600" />
                <span>⚖️ 불변기한 계산기</span>
              </button>

              {/* 회생/파산 템플릿 패키지 등록 버튼 (지시 권한자용) */}
              {hasAssignPerm && (
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all shadow-xs"
                  title="회생/파산 표준 5단계 업무 세트 일괄 등록"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>📦 회생·파산 템플릿</span>
                </button>
              )}

              {/* 새 할일 추가 / 업무 지시 버튼 */}
              {hasAssignPerm ? (
                <button
                  onClick={() => {
                    setNewTask({
                      title: '',
                      description: '',
                      assigneeId: userId,
                      priority: 'NORMAL',
                      dueDate: '',
                      targetType: 'general',
                      targetId: 'general',
                      requiresApproval: false,
                      subtasks: [],
                    });
                    setShowAddTaskModal(true);
                  }}
                  className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" /> 업무 지시 / 새 할일
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">업무 수행 모드</span>
              )}
            </div>
          </div>

          {/* ══════════ A. 리스트 뷰 (List View) ══════════ */}
          {taskViewMode === 'list' && (
            filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center space-y-4">
                <CalendarCheck className="w-12 h-12 text-slate-200 mx-auto" />
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-700">해당 조건의 업무가 없습니다</p>
                  <p className="text-xs text-slate-400">
                    사무실 업무를 등록하거나 회생·파산 템플릿 패키지로 표준 업무를 일괄 등록해보세요.
                  </p>
                </div>
                {hasAssignPerm && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" /> 템플릿으로 시작
                    </button>
                    <button
                      onClick={() => setShowAddTaskModal(true)}
                      className="inline-flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> 직접 업무 등록
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => {
                  const pri = TASK_PRIORITY_CONFIG[task.priority];
                  const st = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;
                  const isCompleted = task.status === 'COMPLETED';
                  const isAssignee = task.assigneeId === userId;
                  const isAssigner = task.assignerId === userId || isLawyerOrOwner;
                  
                  // D-Day 신호등 계산
                  const dDayVal = task.dueDate ? dDay(task.dueDate) : null;
                  const isOverdue = dDayVal !== null && dDayVal < 0 && !isCompleted;
                  const isDDayToday = dDayVal === 0 && !isCompleted;
                  const isUrgentDue = dDayVal !== null && dDayVal > 0 && dDayVal <= 3 && !isCompleted;

                  // 서브태스크 완료율
                  const subtasksTotal = task.subtasks?.length || 0;
                  const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
                  const subtaskProgress = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                        isOverdue
                          ? 'border-red-300 bg-red-50/20'
                          : isDDayToday
                          ? 'border-orange-300 bg-orange-50/20 ring-1 ring-orange-200'
                          : task.status === 'REVIEW_REQUESTED'
                          ? 'border-indigo-300 bg-indigo-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* 상단 뱃지 라인 */}
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            {/* 우선순위 */}
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${pri.bgColor} ${pri.color}`}>
                              {pri.emoji} {pri.label}
                            </span>

                            {/* 상태 뱃지 */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${st.bgColor} ${st.color}`}>
                              {st.emoji} {st.label}
                            </span>

                            {/* D-Day 신호등 관제 */}
                            {isOverdue && (
                              <span className="text-[10px] text-red-600 font-extrabold flex items-center gap-1 bg-red-100 px-2 py-0.5 rounded-lg animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> 기한 초과 ({Math.abs(dDayVal!)}일 지남)
                              </span>
                            )}
                            {isDDayToday && (
                              <span className="text-[10px] text-orange-700 font-extrabold flex items-center gap-1 bg-orange-100 px-2 py-0.5 rounded-lg animate-pulse">
                                🚨 오늘 마감 (D-Day)
                              </span>
                            )}
                            {isUrgentDue && (
                              <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded-lg">
                                ⏰ 마감 임박 (D-{dDayVal})
                              </span>
                            )}

                            {/* 검토 필수 뱃지 */}
                            {task.requiresApproval && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-indigo-600" /> 컨펌 필수
                              </span>
                            )}

                            {/* 연동 사건/상담 뱃지 */}
                            {task.targetType !== 'general' && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg">
                                {task.targetType === 'case' ? '📁 사건 연동' : '💬 상담 연동'}
                              </span>
                            )}
                          </div>

                          {/* 업무 제목 */}
                          <p className={`text-sm font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {task.title}
                          </p>

                          {/* 업무 설명 */}
                          {task.description && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}

                          {/* 서브태스크 (체크리스트) */}
                          {subtasksTotal > 0 && (
                            <div className="mt-3 bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                  <CheckSquare className="w-3.5 h-3.5 text-brand" /> 서브태스크 ({subtasksDone}/{subtasksTotal})
                                </span>
                                <span className="font-extrabold text-brand">{subtaskProgress}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-brand h-full rounded-full transition-all duration-300"
                                  style={{ width: `${subtaskProgress}%` }}
                                />
                              </div>
                              <div className="space-y-1.5 pt-1">
                                {task.subtasks!.map(st => (
                                  <div
                                    key={st.id}
                                    onClick={() => handleToggleSubtask(task.id, st.id)}
                                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900 select-none"
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                      st.completed ? 'bg-brand border-brand text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                      {st.completed && <Check className="w-3 h-3" />}
                                    </div>
                                    <span className={st.completed ? 'line-through text-slate-400' : ''}>
                                      {st.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 메타데이터 라인 (지시자, 수행자, 기한, 등록시각) */}
                          <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              지시: <strong className="text-slate-700">{task.assignerName}</strong> ➔ 담당: <strong className="text-brand font-bold">{task.assigneeName}</strong>
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                마감일: <span className={isOverdue ? 'text-red-600 font-bold' : isDDayToday ? 'text-orange-600 font-bold' : 'text-slate-700 font-medium'}>{task.dueDate}</span>
                              </span>
                            )}
                            <span>등록: {timeAgo(parseSafeDate(task.createdAt))}</span>
                          </div>

                          {/* 검토 요청 메모 / 승인 반려 메모 표시 */}
                          {task.reviewNote && task.status === 'REVIEW_REQUESTED' && (
                            <div className="mt-2 bg-indigo-50 border border-indigo-200/70 rounded-xl px-3 py-1.5 text-xs text-indigo-800 flex items-center gap-1.5">
                              <Send className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                              <span><strong>검토 요청 메모:</strong> {task.reviewNote}</span>
                            </div>
                          )}
                          {task.approvalNote && (
                            <div className={`mt-2 rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 border ${
                              task.approvalNote.includes('[수정보완 요청]')
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>{task.approvalNote}</span>
                            </div>
                          )}
                          {task.completionNote && !task.approvalNote && (
                            <div className="mt-2 bg-emerald-50 border border-emerald-200/50 rounded-xl px-3 py-1.5 text-xs text-emerald-800 flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>완료 메모: {task.completionNote}</span>
                            </div>
                          )}
                        </div>

                        {/* 우측 조작 버튼 그룹 (2단계 검토 & 상태 변경) */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {/* 1. 대기(PENDING) 상태 ➔ 시작 */}
                          {task.status === 'PENDING' && (
                            <button
                              onClick={() => handleStartTask(task.id)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl px-3 py-1.5 text-xs font-bold active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-2xs"
                            >
                              업무 시작
                            </button>
                          )}

                          {/* 2. 진행중(IN_PROGRESS) 상태 ➔ 검토요청 or 완료 */}
                          {task.status === 'IN_PROGRESS' && (
                            task.requiresApproval ? (
                              <button
                                onClick={() => setReviewingId(reviewingId === task.id ? null : task.id)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-2xs flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" /> 검토 요청
                              </button>
                            ) : (
                              <button
                                onClick={() => setCompletingId(completingId === task.id ? null : task.id)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-bold active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-2xs flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> 완료
                              </button>
                            )
                          )}

                          {/* 3. 검토요청(REVIEW_REQUESTED) 상태 ➔ 지시자/승인권자의 승인 or 반려 */}
                          {task.status === 'REVIEW_REQUESTED' && (
                            (hasApprovePerm || isAssigner) ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setApprovingId(approvingId === task.id ? null : task.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1"
                                >
                                  <ThumbsUp className="w-3 h-3" /> 승인(완료)
                                </button>
                                <button
                                  onClick={() => setRejectingId(rejectingId === task.id ? null : task.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl px-2.5 py-1.5 text-xs font-bold active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                                >
                                  <ThumbsDown className="w-3 h-3" /> 반려
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                🔬 승인 대기중
                              </span>
                            )
                          )}

                          {/* 삭제 버튼 (지시자 또는 대표변호사) */}
                          {isAssigner && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 active:scale-[0.98] transition-all cursor-pointer ml-1"
                              title="업무 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 인라인 입력창 1: 일반 완료 확인 */}
                      {completingId === task.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 animate-fadeIn">
                          <input
                            value={completionNote}
                            onChange={e => setCompletionNote(e.target.value)}
                            placeholder="완료 메모를 입력하세요 (선택 사항)"
                            autoFocus
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
                          />
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer active:scale-[0.98] hover:bg-emerald-700 transition-all shadow-xs"
                          >
                            완료 확인
                          </button>
                          <button
                            onClick={() => { setCompletingId(null); setCompletionNote(''); }}
                            className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 active:scale-[0.98]"
                          >
                            취소
                          </button>
                        </div>
                      )}

                      {/* 인라인 입력창 2: 검토 요청 메모 */}
                      {reviewingId === task.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 animate-fadeIn bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                          <input
                            value={reviewNote}
                            onChange={e => setReviewNote(e.target.value)}
                            placeholder="지시자에게 전달할 작업 요약 및 승인 요청 메모"
                            autoFocus
                            className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/20"
                          />
                          <button
                            onClick={() => handleRequestReview(task.id)}
                            className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer active:scale-[0.98] hover:bg-indigo-700 transition-all shadow-xs flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> 제출
                          </button>
                          <button
                            onClick={() => { setReviewingId(null); setReviewNote(''); }}
                            className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 active:scale-[0.98]"
                          >
                            취소
                          </button>
                        </div>
                      )}

                      {/* 인라인 입력창 3: 최종 승인 메모 */}
                      {approvingId === task.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 animate-fadeIn bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                          <input
                            value={approvalNoteInput}
                            onChange={e => setApprovalNoteInput(e.target.value)}
                            placeholder="승인 의견 및 격려 메모 (예: 잘 작성되었습니다. 최종 제출 승인합니다.)"
                            autoFocus
                            className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-600"
                          />
                          <button
                            onClick={() => handleApproveTask(task.id)}
                            className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer active:scale-[0.98] hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> 최종 승인
                          </button>
                          <button
                            onClick={() => { setApprovingId(null); setApprovalNoteInput(''); }}
                            className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 active:scale-[0.98]"
                          >
                            취소
                          </button>
                        </div>
                      )}

                      {/* 인라인 입력창 4: 반려 및 수정보완 요청 메모 */}
                      {rejectingId === task.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 animate-fadeIn bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                          <input
                            value={rejectionNoteInput}
                            onChange={e => setRejectionNoteInput(e.target.value)}
                            placeholder="보완이 필요한 항목을 구체적으로 적어주세요 (예: 최근 6개월 거래내역 소명 추가 필요)"
                            autoFocus
                            className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-rose-600"
                          />
                          <button
                            onClick={() => handleRejectTask(task.id)}
                            className="bg-rose-600 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer active:scale-[0.98] hover:bg-rose-700 transition-all shadow-xs flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> 보완 요청 전송
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectionNoteInput(''); }}
                            className="bg-slate-100 text-slate-500 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 active:scale-[0.98]"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ══════════ B. 칸반 보드 뷰 (Kanban Board View) ══════════ */}
          {taskViewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-fadeIn">
              {([
                { status: 'PENDING' as TaskStatus, label: '대기 (To-Do)', icon: Clock, count: kanbanColumns.PENDING.length, bg: 'bg-slate-50', headerColor: 'text-slate-700 border-slate-200' },
                { status: 'IN_PROGRESS' as TaskStatus, label: '진행중 (In Progress)', icon: RotateCcw, count: kanbanColumns.IN_PROGRESS.length, bg: 'bg-blue-50/40', headerColor: 'text-blue-800 border-blue-200' },
                { status: 'REVIEW_REQUESTED' as TaskStatus, label: '검토요청 (Review)', icon: Send, count: kanbanColumns.REVIEW_REQUESTED.length, bg: 'bg-indigo-50/40', headerColor: 'text-indigo-800 border-indigo-200' },
                { status: 'COMPLETED' as TaskStatus, label: '완료됨 (Done)', icon: CheckCircle2, count: kanbanColumns.COMPLETED.length, bg: 'bg-emerald-50/30', headerColor: 'text-emerald-800 border-emerald-200' },
              ]).map(col => {
                const colTasks = kanbanColumns[col.status];
                return (
                  <div key={col.status} className={`${col.bg} rounded-2xl border border-slate-200/80 p-3 flex flex-col min-h-[500px]`}>
                    {/* 컬럼 헤더 */}
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200/80">
                      <div className="flex items-center gap-1.5">
                        <col.icon className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-extrabold text-slate-800">{col.label}</span>
                      </div>
                      <span className="text-[11px] font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                        {col.count}
                      </span>
                    </div>

                    {/* 카드 목록 */}
                    <div className="space-y-2.5 flex-1 overflow-y-auto">
                      {colTasks.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400">
                          업무가 없습니다
                        </div>
                      ) : (
                        colTasks.map(t => {
                          const pri = TASK_PRIORITY_CONFIG[t.priority];
                          const dDayVal = t.dueDate ? dDay(t.dueDate) : null;
                          const isOverdue = dDayVal !== null && dDayVal < 0 && t.status !== 'COMPLETED';
                          const subDone = t.subtasks?.filter(s => s.completed).length || 0;
                          const subTotal = t.subtasks?.length || 0;

                          return (
                            <div
                              key={t.id}
                              className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-xs transition-all space-y-2"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${pri.bgColor} ${pri.color}`}>
                                  {pri.emoji} {pri.label}
                                </span>
                                {isOverdue ? (
                                  <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">
                                    기한초과
                                  </span>
                                ) : dDayVal !== null && dDayVal <= 3 && t.status !== 'COMPLETED' ? (
                                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded">
                                    D-{dDayVal}
                                  </span>
                                ) : null}
                              </div>

                              <p className="text-xs font-bold text-slate-900 line-clamp-2">
                                {t.title}
                              </p>

                              {subTotal > 0 && (
                                <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between">
                                  <span>체크리스트: {subDone}/{subTotal}</span>
                                  <span className="font-bold text-brand">{Math.round((subDone / subTotal) * 100)}%</span>
                                </div>
                              )}

                              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="truncate max-w-[90px]">
                                  {t.assigneeName}
                                </span>
                                {t.dueDate && <span>{t.dueDate.slice(5)}</span>}
                              </div>

                              {/* 빠른 다음 단계 액션 버튼 */}
                              <div className="pt-1 flex items-center justify-end gap-1">
                                {t.status === 'PENDING' && (
                                  <button
                                    onClick={() => handleStartTask(t.id)}
                                    className="w-full py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer"
                                  >
                                    시작 ➔
                                  </button>
                                )}
                                {t.status === 'IN_PROGRESS' && (
                                  t.requiresApproval ? (
                                    <button
                                      onClick={() => handleRequestReview(t.id)}
                                      className="w-full py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer"
                                    >
                                      검토 요청 ➔
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCompleteTask(t.id)}
                                      className="w-full py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg cursor-pointer"
                                    >
                                      완료하기 ✓
                                    </button>
                                  )
                                )}
                                {t.status === 'REVIEW_REQUESTED' && (hasApprovePerm || t.assignerId === userId) && (
                                  <button
                                    onClick={() => handleApproveTask(t.id)}
                                    className="w-full py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs"
                                  >
                                    승인 완료 ✓
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ 2. Calendar (일정 캘린더)
         ══════════════════════════════════════════════════════════════════ */}
      {sub === 'calendar' && (
        <div className="space-y-4">
          {(todayEvents.length > 0 || todayTasks.length > 0) && (
            <div className="bg-brand/5 border border-brand/15 rounded-2xl p-4 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand/10 shrink-0">
                <CalendarCheck className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800">
                  오늘의 일정 ({todayEvents.length + todayTasks.length}건)
                </p>
                <div className="mt-1 space-y-0.5">
                  {todayEvents.map(e => {
                    const cfg = EVENT_TYPE_CONFIG[e.type];
                    return (
                      <p key={e.id} className="text-xs text-slate-600">
                        <span className="font-bold">{cfg.emoji}</span> {e.startTime && <span className="text-slate-400">{e.startTime} </span>}
                        {e.title} {e.visibility !== 'personal' && <span className="text-[10px] text-slate-400">{visEmoji(e.visibility)}</span>}
                      </p>
                    );
                  })}
                  {todayTasks.map(t => (
                    <p key={t.id} className="text-xs text-slate-600">
                      📋 <strong className="text-slate-700">[마감]</strong> {t.title} ({t.assigneeName})
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {upcomingCourt.length > 0 && (
            <div className="bg-red-50/60 border border-red-200 rounded-2xl p-4">
              <p className="text-xs font-black text-red-700 mb-2">🏛️ 다가오는 법원 기일</p>
              <div className="flex gap-3 flex-wrap">
                {upcomingCourt.map(e => {
                  const dd = dDay(e.date);
                  return (
                    <div key={e.id} className="bg-white rounded-xl px-3 py-2 border border-red-100 flex items-center gap-2">
                      <span className={`text-xs font-black ${dd <= 3 ? 'text-red-600' : 'text-red-400'}`}>
                        {dd === 0 ? 'D-Day' : 'D-' + dd}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{e.title}</span>
                      <span className="text-[10px] text-slate-400">{e.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0">유형</span>
                  <div className="flex gap-1 flex-wrap">
                    {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map(type => {
                      const cfg = EVENT_TYPE_CONFIG[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setTypeFilters(p => ({ ...p, [type]: !p[type] }))}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1 ${
                            typeFilters[type]
                              ? cfg.bgColor + ' ' + cfg.color + ' border-current/20'
                              : 'bg-slate-50 text-slate-300 border-slate-100 line-through'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <span className="hidden sm:block w-px h-8 bg-slate-200" />

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0">공개</span>
                  <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                    {(['all' as const, ...(['firm', 'lawyers', 'personal'] as EventVisibility[])]).map(v => {
                      const active = visFilter === v;
                      if (v === 'all') {
                        return (
                          <button
                            key={v}
                            onClick={() => setVisFilter('all')}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                              active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            전체
                          </button>
                        );
                      }
                      const vc = VISIBILITY_CONFIG[v];
                      return (
                        <button
                          key={v}
                          onClick={() => setVisFilter(visFilter === v ? 'all' : v)}
                          className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md cursor-pointer transition-all flex items-center gap-1 ${
                            active ? 'bg-white shadow-sm ' + vc.color : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {vc.emoji} {vc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const dk = selectedDay ? toDateKey(calYear, calMon, selectedDay) : todayKey;
                  openAddModalForDate(dk);
                }}
                className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" /> 일정 추가
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {calView === 'month' ? (
                    <>
                      <button
                        onClick={() => setCalMonth(new Date(calYear, calMon - 1))}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <h3 className="text-lg font-black text-white min-w-[140px] text-center">
                        {calYear}년 {calMon + 1}월
                      </h3>
                      <button
                        onClick={() => setCalMonth(new Date(calYear, calMon + 1))}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          const d = new Date(weekStart);
                          d.setDate(d.getDate() - 7);
                          setWeekStart(d);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <h3 className="text-lg font-black text-white min-w-[200px] text-center">
                        {weekStart.getMonth() + 1}월 {weekStart.getDate()}일 ~ {weekDays[6].getMonth() + 1}월 {weekDays[6].getDate()}일
                      </h3>
                      <button
                        onClick={() => {
                          const d = new Date(weekStart);
                          d.setDate(d.getDate() + 7);
                          setWeekStart(d);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-[0.95] transition-all"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCalMonth(new Date());
                      const d = new Date();
                      d.setDate(d.getDate() - d.getDay());
                      d.setHours(0,0,0,0);
                      setWeekStart(d);
                    }}
                    className="text-xs font-bold text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-all"
                  >
                    오늘
                  </button>
                  <div className="flex bg-white/10 rounded-lg p-0.5">
                    <button
                      onClick={() => setCalView('month')}
                      className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${
                        calView === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      월
                    </button>
                    <button
                      onClick={() => setCalView('week')}
                      className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${
                        calView === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      주
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAY_HEADERS.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-sm font-bold py-3 ${
                    i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'
                  } bg-slate-50`}
                >
                  {d}
                </div>
              ))}
            </div>

            {calView === 'month' && (
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={'e' + i} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dow = (firstDow + i) % 7;
                  const isT = isTodayFn(calYear, calMon, day);
                  const holiday = getHoliday(calYear, calMon, day);
                  const dateKey = toDateKey(calYear, calMon, day);
                  const dayTasks = tasksByDate[dateKey] || [];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const sel = selectedDay === day;
                  const isHoliday = dow === 0 || !!holiday;
                  const allItems = [
                    ...dayEvents.map(e => ({ k: 'e' as const, e })),
                    ...dayTasks.map(t => ({ k: 't' as const, t }))
                  ];

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(sel ? null : day)}
                      className={`min-h-[100px] p-2 border-b border-r border-slate-100 text-left transition-all cursor-pointer hover:bg-blue-50/40 ${
                        sel ? 'bg-brand/5 ring-2 ring-brand/30 ring-inset' : ''
                      } ${isT ? 'bg-brand/5' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        {isT ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white text-sm font-black">
                            {day}
                          </span>
                        ) : (
                          <span className={`text-sm font-bold pl-0.5 pt-0.5 ${isHoliday ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                            {day}
                          </span>
                        )}
                        {holiday && <span className="text-[9px] font-bold text-red-400 truncate max-w-[60px]">{holiday}</span>}
                      </div>

                      {allItems.length > 0 && (
                        <div className="space-y-0.5">
                          {allItems.slice(0, 2).map((item, idx) => {
                            if (item.k === 'e') {
                              const cfg = EVENT_TYPE_CONFIG[item.e.type];
                              return (
                                <div
                                  key={idx}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${cfg.bgColor} ${cfg.color}`}
                                >
                                  {item.e.visibility === 'firm' ? '🏢 ' : ''}{cfg.emoji} {item.e.title}
                                </div>
                              );
                            }
                            const pri = TASK_PRIORITY_CONFIG[(item.t as TaskTicket).priority];
                            return (
                              <div
                                key={idx}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${pri.bgColor} ${pri.color}`}
                              >
                                📋 {(item.t as TaskTicket).title}
                              </div>
                            );
                          })}
                          {allItems.length > 2 && (
                            <div className="text-[9px] text-slate-400 font-bold pl-1">
                              +{allItems.length - 2}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
                {(() => {
                  const lastDow = (firstDow + daysInMonth - 1) % 7;
                  return Array.from({ length: lastDow < 6 ? 6 - lastDow : 0 }).map((_, i) => (
                    <div key={'t' + i} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30" />
                  ));
                })()}
              </div>
            )}

            {calView === 'week' && (
              <div className="grid grid-cols-7">
                {weekDays.map((wd, i) => {
                  const isT = isTodayFn(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const holiday = getHoliday(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const dateKey = toDateKey(wd.getFullYear(), wd.getMonth(), wd.getDate());
                  const dayTasks = tasksByDate[dateKey] || [];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isHoliday = i === 0 || !!holiday;

                  return (
                    <div
                      key={i}
                      className={`min-h-[200px] p-2 border-r border-slate-100 last:border-r-0 ${isT ? 'bg-brand/5' : ''}`}
                    >
                      <div className="flex flex-col items-center mb-2">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black ${
                          isT ? 'bg-brand text-white' : isHoliday ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-700'
                        }`}>
                          {wd.getDate()}
                        </span>
                        {holiday && <span className="text-[9px] font-bold text-red-400 mt-0.5">{holiday}</span>}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map(e => {
                          const cfg = EVENT_TYPE_CONFIG[e.type];
                          return (
                            <div key={e.id} className={`text-[10px] font-bold p-1.5 rounded-lg ${cfg.bgColor} ${cfg.color}`}>
                              <div className="truncate">{e.visibility === 'firm' ? '🏢 ' : ''}{cfg.emoji} {e.title}</div>
                              {e.startTime && <div className="text-[9px] opacity-70">{e.startTime}</div>}
                            </div>
                          );
                        })}
                        {dayTasks.map(t => {
                          const pri = TASK_PRIORITY_CONFIG[t.priority];
                          return (
                            <div key={t.id} className={`text-[10px] font-bold p-1.5 rounded-lg ${pri.bgColor} ${pri.color}`}>
                              <div className="truncate">📋 {t.title}</div>
                            </div>
                          );
                        })}
                        {dayEvents.length === 0 && dayTasks.length === 0 && (
                          <p className="text-[10px] text-slate-300 text-center pt-4">-</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ 3. Activity (활동 기록 - 업그레이드 & 10건 단위 페이지네이션)
         ══════════════════════════════════════════════════════════════════ */}
      {sub === 'activity' && (
        <div className="space-y-4">
          {/* 활동 필터 & 검색 툴바 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            {/* 1. 카테고리 탭 (실시간 카운트 뱃지 탑재) */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {([
                { key: 'all' as const, label: '전체 활동', count: activityCounts.all },
                { key: 'request' as const, label: '상담 요청', count: activityCounts.request },
                { key: 'counseling' as const, label: '상담 진행', count: activityCounts.counseling },
                { key: 'case' as const, label: '수임 전환', count: activityCounts.case },
                { key: 'task' as const, label: '업무 완료', count: activityCounts.task },
                { key: 'qna' as const, label: 'Q&A', count: activityCounts.qna },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => handleCategoryChange(f.key)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] flex items-center gap-1.5 ${
                    activityFilter === f.key
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activityFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* 2. 검색창 & 기간 필터 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* 검색창 */}
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={activitySearchTerm}
                  onChange={handleSearchChange}
                  placeholder="의뢰인명, 제목, 활동 내용 검색..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
                />
                {activitySearchTerm && (
                  <button
                    onClick={() => { setActivitySearchTerm(''); setActivityPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 기간 필터 */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">기간:</span>
                <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                  {([
                    { key: 'all' as const, label: '전체' },
                    { key: 'today' as const, label: '오늘' },
                    { key: '7days' as const, label: '최근 7일' },
                    { key: '30days' as const, label: '이번 달' },
                  ]).map(p => (
                    <button
                      key={p.key}
                      onClick={() => handlePeriodChange(p.key)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer active:scale-[0.98] ${
                        activityPeriod === p.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 활동 목록 리스트 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredActivity.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Activity className="w-10 h-10 text-slate-200 mx-auto" />
                <p className="text-sm text-slate-600 font-bold">조건에 맞는 활동 기록이 없습니다</p>
                {(activitySearchTerm || activityFilter !== 'all' || activityPeriod !== 'all') && (
                  <button
                    onClick={() => {
                      setActivityFilter('all');
                      setActivitySearchTerm('');
                      setActivityPeriod('all');
                      setActivityPage(1);
                    }}
                    className="text-xs text-brand font-bold hover:underline"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedActivity.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setSelectedActivityItem(item)}
                    className="flex items-start gap-4 p-4 hover:bg-slate-50/70 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    {/* 아이콘 */}
                    <div className={`p-3 rounded-2xl ${item.bg} ${item.color} shrink-0 group-hover:scale-105 transition-transform`}>
                      <item.icon className="w-5 h-5" />
                    </div>

                    {/* 본문 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${item.bg} ${item.color}`}>
                            {item.badgeLabel}
                          </span>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-brand transition-colors">
                            {item.title}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-500">{timeAgo(item.date)}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 hidden sm:inline">({formatSafeFullDate(item.date)})</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 line-clamp-1 leading-relaxed">
                        {item.desc}
                      </p>

                      {item.fullContent && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 bg-slate-50 rounded-lg px-2.5 py-1">
                          {item.fullContent}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ── 10건 단위 스마트 페이지네이션 컨트롤 바 ──
               ══════════════════════════════════════════════════════════════ */}
            {filteredActivity.length > 0 && (
              <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* 건수 안내 */}
                <div className="text-xs text-slate-500 font-medium">
                  총 <strong className="text-slate-800 font-bold">{filteredActivity.length}</strong>건 중{' '}
                  <strong className="text-slate-800 font-bold">
                    {(activityPage - 1) * ACTIVITY_PER_PAGE + 1}-
                    {Math.min(activityPage * ACTIVITY_PER_PAGE, filteredActivity.length)}
                  </strong>건 표시 (페이지 {activityPage}/{totalActivityPages})
                </div>

                {/* 페이지 버튼 */}
                <div className="flex items-center gap-1">
                  {/* 맨 처음 */}
                  <button
                    onClick={() => setActivityPage(1)}
                    disabled={activityPage === 1}
                    className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all border border-transparent hover:border-slate-200"
                    title="첫 페이지"
                  >
                    <ChevronFirst className="w-4 h-4" />
                  </button>

                  {/* 이전 */}
                  <button
                    onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                    disabled={activityPage === 1}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1 shadow-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> 이전
                  </button>

                  {/* 페이지 번호들 */}
                  <div className="flex gap-1 mx-1">
                    {Array.from({ length: totalActivityPages }).map((_, i) => {
                      const pNum = i + 1;
                      // 너무 많은 페이지 번호 생략 로직 (현재 페이지 주변 5개만 노출)
                      if (
                        totalActivityPages > 7 &&
                        Math.abs(activityPage - pNum) > 2 &&
                        pNum !== 1 &&
                        pNum !== totalActivityPages
                      ) {
                        if (pNum === 2 || pNum === totalActivityPages - 1) {
                          return <span key={pNum} className="px-1 text-xs text-slate-300">...</span>;
                        }
                        return null;
                      }

                      return (
                        <button
                          key={pNum}
                          onClick={() => setActivityPage(pNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
                            activityPage === pNum
                              ? 'bg-[#1E3A5F] text-white shadow-xs'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* 다음 */}
                  <button
                    onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                    disabled={activityPage === totalActivityPages}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1 shadow-xs"
                  >
                    다음 <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* 맨 끝 */}
                  <button
                    onClick={() => setActivityPage(totalActivityPages)}
                    disabled={activityPage === totalActivityPages}
                    className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all border border-transparent hover:border-slate-200"
                    title="마지막 페이지"
                  >
                    <ChevronLast className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ Modal 1: 새 할일 추가 모달 (New Task Modal)
         ══════════════════════════════════════════════════════════════════ */}
      {showAddTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddTaskModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-brand" />
                새 할일 등록 및 업무 지시
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  업무 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  value={newTask.title}
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 재직증명서 및 원천징수영수증 수취"
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    담당자 지정 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={newTask.assigneeId}
                      onChange={e => setNewTask(p => ({ ...p, assigneeId: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-brand appearance-none cursor-pointer"
                    >
                      {assignableMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.roleLabel})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    우선순위
                  </label>
                  <div className="relative">
                    <select
                      value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-brand appearance-none cursor-pointer"
                    >
                      {(Object.keys(TASK_PRIORITY_CONFIG) as TaskPriority[]).map(p => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_CONFIG[p].emoji} {TASK_PRIORITY_CONFIG[p].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    마감 기한 (선택)
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    연결 고객 / 사건 (선택)
                  </label>
                  <div className="relative">
                    <select
                      value={newTask.targetId}
                      onChange={e => {
                        const opt = targetOptions.find(o => o.id === e.target.value);
                        setNewTask(p => ({
                          ...p,
                          targetId: e.target.value,
                          targetType: opt ? opt.type : 'general'
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand appearance-none cursor-pointer truncate pr-7"
                    >
                      {targetOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 컨펌 필수 옵션 */}
              <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>완료 시 지시자의 최종 승인(컨펌) 필요</span>
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    체크 시 담당자가 바로 완료할 수 없으며, 검토 요청 후 지시자가 승인해야 최종 완료됩니다.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newTask.requiresApproval}
                  onChange={e => setNewTask(p => ({ ...p, requiresApproval: e.target.checked }))}
                  className="w-4 h-4 rounded text-brand focus:ring-brand accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* 서브태스크 (체크리스트) 동적 추가 영역 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">
                  서브태스크 체크리스트 (선택)
                </label>
                <div className="flex gap-2">
                  <input
                    value={newSubtaskInput}
                    onChange={e => setNewSubtaskInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtaskDraft(); } }}
                    placeholder="세부 수행 항목을 입력 후 [추가] (Enter)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtaskDraft}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer shrink-0"
                  >
                    추가
                  </button>
                </div>
                {newTask.subtasks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {newTask.subtasks.map(st => (
                      <div key={st.id} className="flex items-center justify-between bg-slate-100/80 px-3 py-1.5 rounded-xl text-xs text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                          {st.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtaskDraft(st.id)}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  상세 요청사항 (선택)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  placeholder="담당자가 처리해야 할 상세 내용 및 주의사항을 적어주세요."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-[0.98] transition-all"
              >
                취소
              </button>
              <button
                onClick={handleCreateTask}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
              >
                할일 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ Modal 1-B: 회생·파산 4대 표준 템플릿 패키지 일괄 등록 모달
         ══════════════════════════════════════════════════════════════════ */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    회생·파산 표준 업무 패키지 일괄 등록
                  </h3>
                  <p className="text-xs text-slate-500">
                    검증된 실무 5단계 업무 프로세스를 원클릭으로 일괄 자동 생성합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. 템플릿 선택 4개 카드 */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                템플릿 패키지 선택
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TASK_PACKAGE_TEMPLATES.map(tpl => {
                  const isSelected = selectedTemplate.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-extrabold text-slate-900">{tpl.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 대상 사건 / 담당자 / 기준일 설정 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  연결 사건 / 의뢰인
                </label>
                <select
                  value={templateTargetId}
                  onChange={e => setTemplateTargetId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-brand"
                >
                  {targetOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  수행 담당자
                </label>
                <select
                  value={templateAssigneeId}
                  onChange={e => setTemplateAssigneeId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-brand"
                >
                  {assignableMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.roleLabel})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  기준 시작일
                </label>
                <input
                  type="date"
                  value={templateBaseDate}
                  onChange={e => setTemplateBaseDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* 3. 패키지에 포함된 표준 업무 미리보기 */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>포함된 표준 업무 ({selectedTemplate.tasks.length}개)</span>
                <span className="text-[11px] text-indigo-600 font-normal">기준일로부터 마감기한 자동 계산됨</span>
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedTemplate.tasks.map((t, idx) => {
                  const pri = TASK_PRIORITY_CONFIG[t.priority];
                  const calcDue = calculateCourtDeadline(templateBaseDate, t.offsetDays);
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="font-extrabold text-slate-400">Step {idx + 1}</span>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${pri.bgColor} ${pri.color}`}>
                            {pri.label}
                          </span>
                          {t.requiresApproval && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-1.5 py-0.2 rounded">
                              컨펌 필수
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 truncate">{t.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{t.description}</p>
                        <p className="text-[10px] text-slate-400 mt-1">체크리스트: {t.subtasks.join(' · ')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">
                          D+{t.offsetDays} ({calcDue.slice(5)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-[0.98]"
              >
                취소
              </button>
              <button
                onClick={handleApplyTemplatePackage}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> {selectedTemplate.tasks.length}개 업무 일괄 발행하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ Modal 1-C: ⚖️ 법원 불변기한 & 보정명령 계산기 모달
         ══════════════════════════════════════════════════════════════════ */}
      {showDeadlineCalculator && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowDeadlineCalculator(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    법원 불변기한 & 보정명령 계산기
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    민법 제161조에 따라 토/일/공휴일 익일 만료가 자동 적용됩니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeadlineCalculator(false)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  보정명령 송달 일자
                </label>
                <input
                  type="date"
                  value={calcStartDate}
                  onChange={e => setCalcStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  법정 보정 기간 선택
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '7일 (통상 보정)', val: 7 },
                    { label: '14일 (상세 소명)', val: 14 },
                    { label: '30일 (특별 기한)', val: 30 },
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setCalcDays(item.val)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        calcDays === item.val
                          ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-300/30 font-extrabold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  관련 사건 / 의뢰인
                </label>
                <select
                  value={calcTargetId}
                  onChange={e => setCalcTargetId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-brand"
                >
                  {targetOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  업무 및 일정 제목
                </label>
                <input
                  value={calcTitle}
                  onChange={e => setCalcTitle(e.target.value)}
                  placeholder="예: 서울회생법원 보정명령 답변서 제출"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              {/* 실시간 계산 결과 박스 */}
              {(() => {
                const finalDate = calculateCourtDeadline(calcStartDate, calcDays);
                const dd = dDay(finalDate);
                const dObj = new Date(finalDate + 'T00:00:00');
                const dow = ['일','월','화','수','목','금','토'][dObj.getDay()];
                return (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-900 font-medium">최종 법정 제출 만료일</span>
                      <span className="text-xs font-black bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md">
                        {dd >= 0 ? `D-${dd} 남음` : `${Math.abs(dd)}일 초과`}
                      </span>
                    </div>
                    <p className="text-lg font-black text-amber-950">
                      {finalDate} ({dow}요일) 23:59까지
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      ※ 기간의 말일이 토요일/공휴일인 경우 그 익일(다음 평일)로 자동 만료 처리되었습니다.
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDeadlineCalculator(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-[0.98]"
              >
                닫기
              </button>
              <button
                onClick={handleCreateDeadlineTask}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
              >
                <CalendarCheck className="w-4 h-4" /> 할일 & 캘린더 동시 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ Modal 2: 새 일정 추가 모달 (Add Event Modal)
         ══════════════════════════════════════════════════════════════════ */}
      {showAddEventModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddEventModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-brand" />
                일정 추가
              </h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">일정 유형</label>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map(type => {
                  const cfg = EVENT_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setNewEvt(p => ({ ...p, type }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1 ${
                        newEvt.type === type
                          ? cfg.bgColor + ' ' + cfg.color + ' border-current shadow-sm ring-2 ring-current/20'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {availableVis.length > 1 && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">공개 범위</label>
                <div className="flex gap-1.5">
                  {availableVis.map(v => {
                    const vc = VISIBILITY_CONFIG[v];
                    return (
                      <button
                        key={v}
                        onClick={() => setNewEvt(p => ({ ...p, visibility: v }))}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1 ${
                          newEvt.visibility === v
                            ? vc.bgColor + ' ' + vc.color + ' border-current shadow-sm ring-2 ring-current/20'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {vc.emoji} {vc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">제목 *</label>
              <input
                value={newEvt.title}
                onChange={e => setNewEvt(p => ({ ...p, title: e.target.value }))}
                placeholder="일정 제목을 입력하세요"
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">날짜 *</label>
                <input
                  type="date"
                  value={newEvt.date}
                  onChange={e => setNewEvt(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">시작</label>
                <input
                  type="time"
                  value={newEvt.startTime}
                  onChange={e => setNewEvt(p => ({ ...p, startTime: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">종료</label>
                <input
                  type="time"
                  value={newEvt.endTime}
                  onChange={e => setNewEvt(p => ({ ...p, endTime: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5" /> 반복
                </label>
                <div className="relative">
                  <select
                    value={newEvt.recurrence}
                    onChange={e => setNewEvt(p => ({ ...p, recurrence: e.target.value as RecurrenceType }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 appearance-none cursor-pointer"
                  >
                    {(Object.keys(RECURRENCE_CONFIG) as RecurrenceType[]).map(key => (
                      <option key={key} value={key}>
                        {RECURRENCE_CONFIG[key].emoji ? RECURRENCE_CONFIG[key].emoji + ' ' : ''}{RECURRENCE_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5" /> 알림
                </label>
                <div className="relative">
                  <select
                    value={newEvt.reminder}
                    onChange={e => setNewEvt(p => ({ ...p, reminder: e.target.value as ReminderType }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 appearance-none cursor-pointer"
                  >
                    {(Object.keys(REMINDER_CONFIG) as ReminderType[]).map(key => (
                      <option key={key} value={key}>
                        {REMINDER_CONFIG[key].emoji ? REMINDER_CONFIG[key].emoji + ' ' : ''}{REMINDER_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">관련 의뢰인</label>
              <input
                value={newEvt.clientName}
                onChange={e => setNewEvt(p => ({ ...p, clientName: e.target.value }))}
                placeholder="선택 사항"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">메모</label>
              <textarea
                value={newEvt.description}
                onChange={e => setNewEvt(p => ({ ...p, description: e.target.value }))}
                placeholder="선택 사항"
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAddEventModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-[0.98] transition-all"
              >
                취소
              </button>
              <button
                onClick={handleAddEvent}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand/90 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ══ Modal 3: 활동 상세 퀵뷰 모달 (Activity Quick View Modal)
         ══════════════════════════════════════════════════════════════════ */}
      {selectedActivityItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedActivityItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${selectedActivityItem.bg} ${selectedActivityItem.color}`}>
                  <selectedActivityItem.icon className="w-5 h-5" />
                </div>
                <div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${selectedActivityItem.bg} ${selectedActivityItem.color}`}>
                    {selectedActivityItem.badgeLabel}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedActivityItem.title}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => setSelectedActivityItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 본문 정보 */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">활동 요약</span>
                <p className="text-slate-800 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedActivityItem.desc}
                </p>
              </div>

              {selectedActivityItem.fullContent && (
                <div>
                  <span className="text-slate-400 block mb-0.5">상세 내용</span>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    {selectedActivityItem.fullContent}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500">
                <div>
                  <span className="text-slate-400 block">발생 일시</span>
                  <span className="font-bold text-slate-700">
                    {formatSafeFullDate(selectedActivityItem.date)} ({timeAgo(selectedActivityItem.date)})
                  </span>
                </div>
                {selectedActivityItem.clientName && (
                  <div>
                    <span className="text-slate-400 block">관련자</span>
                    <span className="font-bold text-slate-700">{selectedActivityItem.clientName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedActivityItem(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
