import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, Plus, List, LayoutGrid, Download, Upload, 
  Settings, Trash2, ChevronRight, X, Star, Users, CheckCircle2, 
  Clock, AlertTriangle, AlertCircle, Calendar, MessageSquare, 
  MoreHorizontal, ChevronLeft, ArrowUpDown, Shield, FileText, UserPlus,
  ChevronsLeft, ChevronsRight, CalendarDays
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension, StaffMember } from '../../../types';
import { getDisplayClientName } from '../../../utils/clientDisplay';
import { stageForStatus } from '../pipeline/pipelineGates';
import { localYmd, parseLocalYmd } from '../../../utils/localDate';
import { daysUntil, formatYmdWithDow } from '../../../services/court/deadlineCalculator';
import { getKoreanHoliday } from '../../../utils/koreanHolidays';

export type SavedViewTab = 'all' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'stage6' | 'closed';

export interface CaseListViewProps {
  requests: ConsultRequest[];
  getCrmExt: (id: string) => CrmClientExtension;
  selectedId: string;
  onSelectCase: (id: string) => void;
  onNewCase: () => void;
  onOpenChat: (client: ConsultRequest) => void;
  onToggleStar: (id: string) => void;
  onDeleteCase?: (id: string) => void;
  onChangeAssignee?: (id: string, staffId: string) => void;
  staffMembers: StaffMember[];
  currentStaffId?: string;
  onOpenBulkMessage?: () => void;
  onOpenExport?: () => void;
  onOpenImport?: () => void;
  onOpenTrash?: () => void;
  onOpenSettings?: () => void;
}

const STAGE_CONFIG: Record<number, { label: string; color: string; dotColor: string }> = {
  1: { label: '상담·제안', color: 'text-blue-700 bg-blue-50 border-blue-200', dotColor: 'bg-blue-500' },
  2: { label: '수임 계약', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', dotColor: 'bg-indigo-500' },
  3: { label: '서류 준비', color: 'text-amber-700 bg-amber-50 border-amber-200', dotColor: 'bg-amber-500' },
  4: { label: '신청·접수', color: 'text-purple-700 bg-purple-50 border-purple-200', dotColor: 'bg-purple-500' },
  5: { label: '보정·개시', color: 'text-rose-700 bg-rose-50 border-rose-200', dotColor: 'bg-rose-500' },
  6: { label: '변제·면책', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
};

function formatWonShort(amount?: number): string {
  if (!amount || amount <= 0) return '0원';
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  }
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return dateStr.slice(0, 10);
}

export function CaseListView({
  requests,
  getCrmExt,
  selectedId,
  onSelectCase,
  onNewCase,
  onOpenChat,
  onToggleStar,
  onDeleteCase,
  onChangeAssignee,
  staffMembers,
  currentStaffId,
  onOpenBulkMessage,
  onOpenExport,
  onOpenImport,
  onOpenTrash,
  onOpenSettings,
}: CaseListViewProps) {
  // 보기 모드 (리스트 vs 칸반 vs 캘린더)
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');

  // 캘린더 뷰 상태
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth() + 1); // 1~12
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(() => localYmd(new Date()));

  // 저장된 보기 탭 (전체, 1~6단계, 종결)
  const [savedViewTab, setSavedViewTab] = useState<SavedViewTab>('all');

  // 빠른 필터 칩 상태
  const [filterMyCase, setFilterMyCase] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterStar, setFilterStar] = useState(false);

  // 1줄 검색 필터 상태
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // 정렬 상태
  const [sortField, setSortField] = useState<'clientName' | 'stage' | 'debtTotal' | 'createdAt' | 'lastActivity'>('lastActivity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 더보기(⋯) 메뉴 상태
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
      if (!(e.target as HTMLElement).closest('.row-more-menu-container')) {
        setActiveRowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 각 단계별 카운트 계산
  const stageCounts = useMemo(() => {
    const counts = {
      all: requests.length,
      stage1: 0,
      stage2: 0,
      stage3: 0,
      stage4: 0,
      stage5: 0,
      stage6: 0,
      closed: 0,
    };

    requests.forEach(r => {
      const ext = getCrmExt(r.id);
      const isClosed = ['discharged', 'cancelled'].includes(ext.crmStatus);
      if (isClosed) {
        counts.closed++;
      } else {
        const stage = stageForStatus(ext.crmStatus);
        if (stage === 1) counts.stage1++;
        else if (stage === 2) counts.stage2++;
        else if (stage === 3) counts.stage3++;
        else if (stage === 4) counts.stage4++;
        else if (stage === 5) counts.stage5++;
        else if (stage === 6) counts.stage6++;
      }
    });

    return counts;
  }, [requests, getCrmExt]);

  // 필터링된 사건 목록 산출
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const ext = getCrmExt(r.id);
      const stage = stageForStatus(ext.crmStatus);
      const isClosed = ['discharged', 'cancelled'].includes(ext.crmStatus);

      // 1. 저장된 보기 탭 필터
      if (savedViewTab === 'closed') {
        if (!isClosed) return false;
      } else if (savedViewTab !== 'all') {
        if (isClosed) return false;
        const targetStage = parseInt(savedViewTab.replace('stage', ''), 10);
        if (stage !== targetStage) return false;
      }

      // 2. 빠른 필터 칩: 내 담당
      if (filterMyCase && currentStaffId) {
        const assigned = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId;
        if (assigned !== currentStaffId) return false;
      }

      // 3. 빠른 필터 칩: 미배정
      if (filterUnassigned) {
        const assigned = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId;
        if (assigned) return false;
      }

      // 4. 빠른 필터 칩: 중요(즐겨찾기)
      if (filterStar) {
        if (!ext.isStarred) return false;
      }

      // 5. 빠른 필터 칩: 기한 임박 (보정기한 D-7 이내 또는 리마인더 D-1)
      if (filterUrgent) {
        const correctionDeadline = (ext.correctionOrders?.[0] as any)?.deadline;
        const deadlineDiff = correctionDeadline ? daysUntil(correctionDeadline) : null;
        const isCorrectionUrgent = deadlineDiff !== null && deadlineDiff <= 7 && deadlineDiff >= 0;
        const hasPendingReminder = ext.notes?.some(n => n.reminder && !n.reminder.completed);
        if (!isCorrectionUrgent && !hasPendingReminder) return false;
      }

      // 6. 담당자 드롭다운 필터
      if (assigneeFilter !== 'all') {
        const assigned = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId;
        if (assigneeFilter === 'unassigned') {
          if (assigned) return false;
        } else if (assigned !== assigneeFilter) {
          return false;
        }
      }

      // 7. 사건 유형 필터
      if (caseTypeFilter !== 'all') {
        const ct = (ext as any).caseType || r.caseType || '';
        if (caseTypeFilter === 'bankruptcy') {
          if (!ct.includes('파산') && ct !== 'bankruptcy') return false;
        } else if (caseTypeFilter === 'rehab') {
          if (!ct.includes('회생') && ct !== 'individual_rehab') return false;
        } else if (caseTypeFilter === 'unspecified') {
          if (ct) return false;
        }
      }

      // 8. 검색어 필터 (의뢰인명, 전화번호, 사건번호, 메모)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const clientName = (r.clientName || '').toLowerCase();
        const display = getDisplayClientName(r, ext).toLowerCase();
        const phone = (r.phone || '').replace(/[^0-9]/g, '');
        const caseNo = (ext.courtCase?.caseNumber || '').toLowerCase();
        const hasNote = ext.notes?.some(n => (n.content || '').toLowerCase().includes(q));

        if (
          !clientName.includes(q) &&
          !display.includes(q) &&
          !phone.includes(q) &&
          !caseNo.includes(q) &&
          !hasNote
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    requests, getCrmExt, savedViewTab, filterMyCase, filterUnassigned, 
    filterStar, filterUrgent, assigneeFilter, caseTypeFilter, search, currentStaffId
  ]);

  // 정렬 적용
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const extA = getCrmExt(a.id);
      const extB = getCrmExt(b.id);

      if (sortField === 'clientName') {
        const nameA = getDisplayClientName(a, extA);
        const nameB = getDisplayClientName(b, extB);
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'stage') {
        const stageA = stageForStatus(extA.crmStatus);
        const stageB = stageForStatus(extB.crmStatus);
        return sortDir === 'asc' ? stageA - stageB : stageB - stageA;
      }
      if (sortField === 'debtTotal') {
        const debtA = a.financialProfile?.debtTotal || 0;
        const debtB = b.financialProfile?.debtTotal || 0;
        return sortDir === 'asc' ? debtA - debtB : debtB - debtA;
      }
      if (sortField === 'createdAt') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
      }
      // lastActivity (기본)
      const actA = new Date(extA.lastActivityAt || a.createdAt || 0).getTime();
      const actB = new Date(extB.lastActivityAt || b.createdAt || 0).getTime();
      return sortDir === 'asc' ? actA - actB : actB - actA;
    });
  }, [filteredRequests, getCrmExt, sortField, sortDir]);

  // 페이징 계산
  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / perPage));
  const pagedRequests = useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedRequests.slice(start, start + perPage);
  }, [sortedRequests, page, perPage]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // '다음 할 일' 문구 산출 헬퍼
  const getNextActionText = (r: ConsultRequest, ext: CrmClientExtension) => {
    // 1. 미완료 리마인더 우선
    const reminder = ext.notes?.find(n => n.reminder && !n.reminder.completed);
    if (reminder?.reminder) {
      return {
        text: reminder.reminder.action || '상담 리마인더',
        due: reminder.reminder.date,
        isUrgent: true,
        type: 'reminder',
      };
    }

    // 2. 단계별 다음 할 일 문구
    const stage = stageForStatus(ext.crmStatus);
    if (stage === 1) {
      return { text: '맞춤 제안서 발송 및 상담', due: '', isUrgent: false, type: 'stage' };
    }
    if (stage === 2) {
      return { text: '위임계약서 서명 및 착수금 확인', due: '', isUrgent: false, type: 'stage' };
    }
    if (stage === 3) {
      const docChecked = ext.documents?.filter(d => d.checked).length || 0;
      const docTotal = ext.documents?.length || 15;
      return { 
        text: `발급 서류 검토 (${docChecked}/${docTotal})`, 
        due: docChecked < docTotal ? '서류 수합' : '검토 완료', 
        isUrgent: false, 
        type: 'stage' 
      };
    }
    if (stage === 4) {
      return { text: '8대 서식 검토 및 전자소송 접수', due: '접수 준비', isUrgent: false, type: 'stage' };
    }
    if (stage === 5) {
      const cd = (ext.correctionOrders?.[0] as any)?.deadline;
      const left = cd ? daysUntil(cd) : null;
      return { 
        text: '보정 답변서 및 7대 표 작성', 
        due: left !== null ? (left >= 0 ? `D-${left}` : `D+${Math.abs(left)}`) : '보정 심리', 
        isUrgent: left !== null && left <= 3, 
        type: 'stage' 
      };
    }
    if (stage === 6) {
      if (ext.crmStatus === 'discharged') {
        return { text: '면책 결정 확정 (종결)', due: '', isUrgent: false, type: 'stage' };
      }
      return { text: '가상계좌 적립금 납부 확인', due: '변제 진행', isUrgent: false, type: 'stage' };
    }
    return { text: '진행 상태 점검', due: '', isUrgent: false, type: 'stage' };
  };

  // ── 캘린더 뷰 제어 및 이벤트 매핑 로직 ──
  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(y => y - 1);
      setCalMonth(12);
    } else {
      setCalMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(y => y + 1);
      setCalMonth(1);
    } else {
      setCalMonth(m => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth() + 1);
    setSelectedCalDate(localYmd(now));
  };

  // 사건 목록에서 캘린더 이벤트 매핑 (현재 필터링된 사건 대상)
  const calendarEvents = useMemo(() => {
    const events: Array<{
      id: string;
      caseId: string;
      clientName: string;
      caseTypeLabel: string;
      stageNum: number;
      dateStr: string;
      type: 'created' | 'contract' | 'correction' | 'reminder' | 'fee';
      title: string;
      badgeLabel: string;
      isUrgent?: boolean;
      request: ConsultRequest;
      ext: CrmClientExtension;
    }> = [];

    filteredRequests.forEach(r => {
      const ext = getCrmExt(r.id);
      const displayName = getDisplayClientName(r, ext);
      const stage = stageForStatus(ext.crmStatus);
      const caseTypeLabel = (ext as any).caseType || r.caseType || (r.caseType?.includes('파산') ? '개인파산' : '개인회생');

      // 1. 사건 접수/등록일
      if (r.createdAt) {
        const dStr = r.createdAt.slice(0, 10);
        events.push({
          id: `${r.id}-created`,
          caseId: r.id,
          clientName: displayName,
          caseTypeLabel,
          stageNum: stage,
          dateStr: dStr,
          type: 'created',
          title: '사건 접수/등록',
          badgeLabel: '접수',
          isUrgent: false,
          request: r,
          ext,
        });
      }

      // 2. 수임 계약 체결일
      if (ext.contractDate) {
        const dStr = ext.contractDate.slice(0, 10);
        events.push({
          id: `${r.id}-contract`,
          caseId: r.id,
          clientName: displayName,
          caseTypeLabel,
          stageNum: stage,
          dateStr: dStr,
          type: 'contract',
          title: '수임 계약',
          badgeLabel: '계약',
          isUrgent: false,
          request: r,
          ext,
        });
      }

      // 3. 보정명령/보정권고 기한
      if (ext.correctionOrders && ext.correctionOrders.length > 0) {
        ext.correctionOrders.forEach((co, idx) => {
          if (co.deadline) {
            const dStr = co.deadline.slice(0, 10);
            const dl = daysUntil(co.deadline);
            events.push({
              id: `${r.id}-corr-${idx}`,
              caseId: r.id,
              clientName: displayName,
              caseTypeLabel,
              stageNum: stage,
              dateStr: dStr,
              type: 'correction',
              title: co.title ? `보정: ${co.title}` : `보정서 제출 기한 (${dl >= 0 ? `D-${dl}` : `D+${Math.abs(dl)}`})`,
              badgeLabel: dl !== null ? (dl >= 0 ? `보정 D-${dl}` : `보정 D+${Math.abs(dl)}`) : '보정',
              isUrgent: dl !== null && dl <= 7 && dl >= 0,
              request: r,
              ext,
            });
          }
        });
      }

      // 4. 미완료 리마인더
      ext.notes?.forEach((n, idx) => {
        if (n.reminder && !n.reminder.completed && n.reminder.date) {
          const dStr = n.reminder.date.slice(0, 10);
          events.push({
            id: `${r.id}-reminder-${idx}`,
            caseId: r.id,
            clientName: displayName,
            caseTypeLabel,
            stageNum: stage,
            dateStr: dStr,
            type: 'reminder',
            title: n.reminder.action || '상담 리마인더',
            badgeLabel: '리마인더',
            isUrgent: true,
            request: r,
            ext,
          });
        }
      });

      // 5. 분납 약정일
      ext.feeSchedule?.forEach((f, idx) => {
        if (f.dueDate && f.status !== 'paid') {
          const dStr = f.dueDate.slice(0, 10);
          events.push({
            id: `${r.id}-fee-${idx}`,
            caseId: r.id,
            clientName: displayName,
            caseTypeLabel,
            stageNum: stage,
            dateStr: dStr,
            type: 'fee',
            title: `${f.round || idx + 1}차 분납 (${formatWonShort(f.amount)})`,
            badgeLabel: '분납',
            isUrgent: false,
            request: r,
            ext,
          });
        }
      });
    });

    return events;
  }, [filteredRequests, getCrmExt]);

  // 캘린더 매트릭스 계산 (5~6주)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay(); // 0(일) ~ 6(토)
    const lastDate = new Date(calYear, calMonth, 0).getDate();
    const prevLastDate = new Date(calYear, calMonth - 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      year: number;
      month: number;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: number;
      holidayName: string | null;
      events: typeof calendarEvents;
    }> = [];

    const todayStr = localYmd(new Date());

    // 1. 이전 달 날짜들
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevLastDate - i;
      const m = calMonth === 1 ? 12 : calMonth - 1;
      const y = calMonth === 1 ? calYear - 1 : calYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        year: y,
        month: m,
        day: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: new Date(y, m - 1, d).getDay(),
        holidayName: getKoreanHoliday(y, m, d),
        events: calendarEvents.filter(e => e.dateStr === dateStr),
      });
    }

    // 2. 이번 달 날짜들
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        year: calYear,
        month: calMonth,
        day: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek: new Date(calYear, calMonth - 1, d).getDay(),
        holidayName: getKoreanHoliday(calYear, calMonth, d),
        events: calendarEvents.filter(e => e.dateStr === dateStr),
      });
    }

    // 3. 다음 달 날짜들
    const currentCount = days.length;
    const targetLength = currentCount <= 35 ? 35 : 42;
    const needToAdd = targetLength - currentCount;
    for (let d = 1; d <= needToAdd; d++) {
      const m = calMonth === 12 ? 1 : calMonth + 1;
      const y = calMonth === 12 ? calYear + 1 : calYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        year: y,
        month: m,
        day: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: new Date(y, m - 1, d).getDay(),
        holidayName: getKoreanHoliday(y, m, d),
        events: calendarEvents.filter(e => e.dateStr === dateStr),
      });
    }

    return days;
  }, [calYear, calMonth, calendarEvents]);

  // 이번 달 전체 이벤트 개수
  const monthEventCount = useMemo(() => {
    const prefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;
    return calendarEvents.filter(e => e.dateStr.startsWith(prefix)).length;
  }, [calendarEvents, calYear, calMonth]);

  // 현재 선택된 날짜의 이벤트 목록
  const selectedDateEvents = useMemo(() => {
    if (!selectedCalDate) return [];
    return calendarEvents.filter(e => e.dateStr === selectedCalDate);
  }, [calendarEvents, selectedCalDate]);

  return (
    <div className="space-y-4">
      {/* ── 1. 헤더: 제목 '사건 관리' + 주 버튼 '사건 등록' + ⋯ 메뉴 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1E3A5F]" />
            <span>사건 관리</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              전체 {requests.length}건
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            의뢰인의 수임 여정 단계, 다음 할 일, 채무 및 진행 현황을 조회하고 관리합니다.
          </p>
        </div>

        {/* 우측 마스터 액션 버튼 그룹 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNewCase}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#162A45] text-white shadow-xs transition-all cursor-pointer press-scale whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>사건 등록</span>
          </button>

          {/* 더보기 (⋯) 메뉴 */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setIsToolsOpen(v => !v)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer press-scale"
              title="추가 도구 및 목록 설정"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isToolsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 animate-fadeIn text-xs">
                {onOpenBulkMessage && (
                  <button
                    type="button"
                    onClick={() => { onOpenBulkMessage(); setIsToolsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span>대량 알림톡 발송</span>
                  </button>
                )}
                {onOpenExport && (
                  <button
                    type="button"
                    onClick={() => { onOpenExport(); setIsToolsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>엑셀로 내보내기</span>
                  </button>
                )}
                {onOpenImport && (
                  <button
                    type="button"
                    onClick={() => { onOpenImport(); setIsToolsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>엑셀 가져오기</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => { onOpenSettings(); setIsToolsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>목록 및 CRM 설정</span>
                  </button>
                )}
                {onOpenTrash && (
                  <>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => { onOpenTrash(); setIsToolsOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      <span>휴지통 (삭제된 사건)</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 리스트 vs 칸반 vs 캘린더 뷰 토글 */}
          <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 cursor-pointer transition-colors ${
                viewMode === 'list' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="리스트 표 보기"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-2 cursor-pointer transition-colors ${
                viewMode === 'kanban' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="조회용 칸반 보기"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-2 cursor-pointer transition-colors ${
                viewMode === 'calendar' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="사건 캘린더 일정 보기"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. 단계별 저장된 보기(Saved Views) 8개 탭 & 빠른 필터 칩 ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* 단계별 저장된 보기 탭 (전체 · 1~6단계 · 종결) */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {([
            { id: 'all', label: '전체', count: stageCounts.all },
            { id: 'stage1', label: '1 상담·제안', count: stageCounts.stage1 },
            { id: 'stage2', label: '2 수임 계약', count: stageCounts.stage2 },
            { id: 'stage3', label: '3 서류 준비', count: stageCounts.stage3 },
            { id: 'stage4', label: '4 신청·접수', count: stageCounts.stage4 },
            { id: 'stage5', label: '5 보정·개시', count: stageCounts.stage5 },
            { id: 'stage6', label: '6 변제·면책', count: stageCounts.stage6 },
            { id: 'closed', label: '종결', count: stageCounts.closed },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSavedViewTab(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap press-scale flex items-center gap-1.5 ${
                savedViewTab === tab.id
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-xs ${
                savedViewTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 우측 빠른 필터 칩 4종 (내 담당 · 미배정 · 기한 임박 · 중요) */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap w-full md:w-auto justify-end text-xs">
          <button
            type="button"
            onClick={() => { setFilterMyCase(v => !v); setPage(1); }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border press-scale ${
              filterMyCase
                ? 'bg-blue-50 text-[#1E3A5F] border-blue-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>내 담당</span>
          </button>

          <button
            type="button"
            onClick={() => { setFilterUnassigned(v => !v); setPage(1); }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border press-scale ${
              filterUnassigned
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>미배정</span>
          </button>

          <button
            type="button"
            onClick={() => { setFilterUrgent(v => !v); setPage(1); }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border press-scale ${
              filterUrgent
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-600" />
            <span>기한 임박</span>
          </button>

          <button
            type="button"
            onClick={() => { setFilterStar(v => !v); setPage(1); }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border press-scale ${
              filterStar
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Star className={`w-3.5 h-3.5 inline mr-1 ${filterStar ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
            <span>중요</span>
          </button>
        </div>
      </div>

      {/* ── 3. 1줄 통합 검색 & 필터 툴바 ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-1 items-center gap-2 flex-wrap">
          {/* 검색창 */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <input
              type="text"
              placeholder="가명, 의뢰인명, 전화번호, 사건번호..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-7 text-xs focus:ring-2 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] text-slate-900 placeholder-slate-400"
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            {search && (
              <button 
                type="button"
                onClick={() => setSearch('')} 
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 담당자 드롭다운 */}
          <select
            value={assigneeFilter}
            onChange={e => { setAssigneeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">담당자: 전체</option>
            <option value="unassigned">미배정</option>
            {staffMembers.filter(m => m.isActive).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* 사건 유형 필터 */}
          <select
            value={caseTypeFilter}
            onChange={e => { setCaseTypeFilter(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">사건 구분: 전체</option>
            <option value="rehab">개인회생</option>
            <option value="bankruptcy">개인파산</option>
            <option value="unspecified">미지정</option>
          </select>

          {/* 페이지당 건수 */}
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium cursor-pointer"
          >
            <option value={10}>10건씩</option>
            <option value={25}>25건씩</option>
            <option value={50}>50건씩</option>
            <option value={100}>100건씩</option>
          </select>
        </div>

        <div className="text-slate-500 font-medium">
          필터 결과: <strong className="text-slate-800">{sortedRequests.length}</strong>건
        </div>
      </div>

      {/* ── 4. 리스트 뷰 (정제된 7열 표준 테이블) ── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-xs">
                  {/* 1열: 의뢰인 (가명 + 사건 유형) */}
                  <th 
                    className="p-3.5 w-[22%] cursor-pointer hover:text-slate-900" 
                    onClick={() => handleSort('clientName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>의뢰인</span>
                      {sortField === 'clientName' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>

                  {/* 2열: 단계 (흰 칩 + 컬러 점) */}
                  <th 
                    className="p-3.5 w-[14%] cursor-pointer hover:text-slate-900" 
                    onClick={() => handleSort('stage')}
                  >
                    <div className="flex items-center gap-1">
                      <span>단계</span>
                      {sortField === 'stage' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>

                  {/* 3열: 다음 할 일 (문구 + 기한) */}
                  <th className="p-3.5 w-[22%]">
                    <span>다음 할 일</span>
                  </th>

                  {/* 4열: 채무 / 소득 */}
                  <th 
                    className="p-3.5 w-[14%] text-right cursor-pointer hover:text-slate-900" 
                    onClick={() => handleSort('debtTotal')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>채무 / 소득</span>
                      {sortField === 'debtTotal' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>

                  {/* 5열: 담당자 */}
                  <th className="p-3.5 w-[10%] text-center">
                    <span>담당</span>
                  </th>

                  {/* 6열: 최근 활동 */}
                  <th 
                    className="p-3.5 w-[12%] text-right cursor-pointer hover:text-slate-900" 
                    onClick={() => handleSort('lastActivity')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>최근 활동</span>
                      {sortField === 'lastActivity' && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>

                  {/* 7열: ⋯ 더보기 액션 */}
                  <th className="p-3.5 w-[6%] text-center">
                    <span>더보기</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pagedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-3">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="font-bold text-slate-800">조회된 사건이 없습니다.</div>
                        <p className="text-xs text-slate-500">
                          검색어나 필터 조건을 변경해 보거나 신규 사건을 등록하세요.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setSavedViewTab('all');
                            setFilterMyCase(false);
                            setFilterUnassigned(false);
                            setFilterUrgent(false);
                            setFilterStar(false);
                            setAssigneeFilter('all');
                            setCaseTypeFilter('all');
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer press-scale"
                        >
                          필터 초기화
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedRequests.map((r) => {
                    const ext = getCrmExt(r.id);
                    const displayName = getDisplayClientName(r, ext);
                    const stage = stageForStatus(ext.crmStatus);
                    const isClosed = ['discharged', 'cancelled'].includes(ext.crmStatus);
                    const stageInfo = STAGE_CONFIG[stage] || STAGE_CONFIG[1];
                    const nextAction = getNextActionText(r, ext);
                    const caseTypeLabel = (ext as any).caseType || r.caseType || '';
                    const assignedStaff = staffMembers.find(m => m.id === (ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId));

                    return (
                      <tr
                        key={r.id}
                        onClick={() => onSelectCase(r.id)}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          selectedId === r.id ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        {/* 1열: 의뢰인(가명 + 사건유형) */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleStar(r.id);
                              }}
                              className="text-slate-300 hover:text-amber-400 cursor-pointer"
                              title="중요 사건 즐겨찾기"
                            >
                              <Star className={`w-3.5 h-3.5 ${ext.isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate hover:text-[#1E3A5F]">
                                {displayName}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.2 rounded font-medium ${
                                  caseTypeLabel.includes('파산')
                                    ? 'bg-purple-50 text-purple-700'
                                    : caseTypeLabel.includes('회생')
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {caseTypeLabel.includes('파산')
                                    ? '개인파산'
                                    : caseTypeLabel.includes('회생')
                                    ? '개인회생'
                                    : '미지정'}
                                </span>
                                {ext.courtCase?.caseNumber && (
                                  <span className="text-xs font-mono text-slate-400 truncate">
                                    {ext.courtCase.caseNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2열: 단계 (흰 칩 + 컬러 점) */}
                        <td className="p-3.5">
                          {isClosed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-bold whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>{ext.crmStatus === 'discharged' ? '면책 종결' : '기각·폐지'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold whitespace-nowrap shadow-2xs">
                              <span className={`w-1.5 h-1.5 rounded-full ${stageInfo.dotColor}`} />
                              <span>{stage}/6 {stageInfo.label}</span>
                            </span>
                          )}
                        </td>

                        {/* 3열: 다음 할 일 (문구 + 기한) */}
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <span className="text-slate-800 font-medium block truncate">
                              {nextAction.text}
                            </span>
                            {nextAction.due && (
                              <span className={`text-xs font-bold font-mono ${
                                nextAction.isUrgent ? 'text-rose-600' : 'text-slate-500'
                              }`}>
                                {nextAction.due}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4열: 채무 / 소득 */}
                        <td className="p-3.5 text-right font-mono">
                          <div className="font-bold text-slate-900">
                            {formatWonShort(r.financialProfile?.debtTotal)}
                          </div>
                          <div className="text-xs text-slate-500">
                            월 {formatWonShort(r.financialProfile?.income || 0)}
                          </div>
                        </td>

                        {/* 5열: 담당자 */}
                        <td className="p-3.5 text-center">
                          {assignedStaff ? (
                            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {assignedStaff.name}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              미배정
                            </span>
                          )}
                        </td>

                        {/* 6열: 최근 활동 */}
                        <td className="p-3.5 text-right font-mono text-slate-500">
                          <span>{timeAgo(ext.lastActivityAt || r.createdAt)}</span>
                        </td>

                        {/* 7열: ⋯ 더보기 메뉴 */}
                        <td className="p-3.5 text-center relative row-more-menu-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRowMenuId(activeRowMenuId === r.id ? null : r.id);
                            }}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {activeRowMenuId === r.id && (
                            <div 
                              className="absolute right-4 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-1 space-y-0.5 text-left text-xs animate-fadeIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenChat(r);
                                  setActiveRowMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer font-medium"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                                <span>채팅 열기</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleStar(r.id);
                                  setActiveRowMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer font-medium"
                              >
                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                <span>{ext.isStarred ? '중요 해제' : '중요 사건 등록'}</span>
                              </button>
                              {onDeleteCase && (
                                <>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteCase(r.id);
                                      setActiveRowMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>사건 삭제 (휴지통)</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이징 네비게이션 */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              전체 <strong className="text-slate-800 font-bold">{sortedRequests.length}</strong>건 중{' '}
              {sortedRequests.length > 0 ? (page - 1) * perPage + 1 : 0}~
              {Math.min(page * perPage, sortedRequests.length)}건 표시 ({perPage}건씩)
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="첫 페이지"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="이전 페이지"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* 페이지 번호 버튼들 */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                      if (totalPages <= 7) return true;
                      return Math.abs(p - page) <= 2 || p === 1 || p === totalPages;
                    })
                    .map((p, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsisBefore && (
                            <span className="px-1 text-slate-400 select-none">…</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPage(p)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg font-mono font-bold text-xs cursor-pointer transition-colors ${
                              page === p
                                ? 'bg-[#1E3A5F] text-white shadow-xs'
                                : 'border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="다음 페이지"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="마지막 페이지"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. 조회용 칸반 보드 (6단계 열) ── */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px]">
            {[1, 2, 3, 4, 5, 6].map((stageNum) => {
              const stageInfo = STAGE_CONFIG[stageNum];
              const stageCases = filteredRequests.filter(r => {
                const ext = getCrmExt(r.id);
                if (['discharged', 'cancelled'].includes(ext.crmStatus)) return false;
                return stageForStatus(ext.crmStatus) === stageNum;
              });

              return (
                <div key={stageNum} className="flex-1 bg-slate-50/80 rounded-2xl border border-slate-200 p-3.5 flex flex-col min-h-[500px]">
                  {/* 칸반 열 헤더 */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${stageInfo.dotColor}`} />
                      <h4 className="font-bold text-xs text-slate-900">
                        {stageNum}. {stageInfo.label}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                      {stageCases.length}
                    </span>
                  </div>

                  {/* 카드 리스트 */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[650px] pr-1">
                    {stageCases.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        사건 없음
                      </div>
                    ) : (
                      stageCases.map((r) => {
                        const ext = getCrmExt(r.id);
                        const displayName = getDisplayClientName(r, ext);
                        const nextAction = getNextActionText(r, ext);
                        const caseTypeLabel = (ext as any).caseType || r.caseType || '';

                        return (
                          <div
                            key={r.id}
                            onClick={() => onSelectCase(r.id)}
                            className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-[#1E3A5F] hover:shadow-xs transition-all cursor-pointer press-scale space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {displayName}
                              </span>
                              <span className={`text-xs px-1.5 py-0.2 rounded font-medium shrink-0 ${
                                caseTypeLabel.includes('파산')
                                  ? 'bg-purple-50 text-purple-700'
                                  : caseTypeLabel.includes('회생')
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {caseTypeLabel.includes('파산') ? '파산' : caseTypeLabel.includes('회생') ? '회생' : '미지정'}
                              </span>
                            </div>

                            {/* 다음 할 일 배너 */}
                            <div className="p-2 rounded-lg bg-slate-50 text-xs border border-slate-100">
                              <span className="text-slate-500 block text-xs">다음 할 일:</span>
                              <span className="font-medium text-slate-800 line-clamp-1">
                                {nextAction.text}
                              </span>
                              {nextAction.due && (
                                <span className={`text-xs font-bold font-mono ${nextAction.isUrgent ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {nextAction.due}
                                </span>
                              )}
                            </div>

                            {/* 채무액 & 최근 활동 */}
                            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 font-mono">
                              <span className="font-bold text-slate-800">
                                {formatWonShort(r.financialProfile?.debtTotal)}
                              </span>
                              <span>{timeAgo(ext.lastActivityAt || r.createdAt)}</span>
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
        </div>
      )}

      {/* ── 6. 사건 캘린더 뷰 (월간 일정 및 기한 관리) ── */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* 캘린더 툴바 헤더 */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              {/* 월 이동 네비게이션 */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                    title="이전 달"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 border-x border-slate-200 transition-colors cursor-pointer"
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                    title="다음 달"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-[#1E3A5F]" />
                    <span>{calYear}년 {calMonth}월</span>
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A5F] border border-blue-200/80 font-mono">
                    이 달의 사건 일정 {monthEventCount}건
                  </span>
                </div>
              </div>

              {/* 범례 (Legend) */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  접수·유입
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  수임 계약
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  보정 기한
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  리마인더
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  수임료 분납
                </span>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-bold bg-slate-50/40">
              <div className="py-2.5 text-rose-600">일</div>
              <div className="py-2.5 text-slate-700">월</div>
              <div className="py-2.5 text-slate-700">화</div>
              <div className="py-2.5 text-slate-700">수</div>
              <div className="py-2.5 text-slate-700">목</div>
              <div className="py-2.5 text-slate-700">금</div>
              <div className="py-2.5 text-blue-600">토</div>
            </div>

            {/* 캘린더 일자 그리드 */}
            <div className="grid grid-cols-7 bg-slate-200 gap-px">
              {calendarDays.map((cDay, idx) => {
                const isSelected = selectedCalDate === cDay.dateStr;
                const isSun = cDay.dayOfWeek === 0;
                const isSat = cDay.dayOfWeek === 6;
                const isHoli = !!cDay.holidayName;

                return (
                  <div
                    key={`${cDay.dateStr}-${idx}`}
                    onClick={() => setSelectedCalDate(cDay.dateStr)}
                    className={`min-h-[110px] p-2 bg-white transition-colors cursor-pointer flex flex-col justify-between ${
                      !cDay.isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : 'hover:bg-slate-50/70'
                    } ${isSelected ? 'ring-2 ring-[#1E3A5F] ring-inset bg-blue-50/20' : ''}`}
                  >
                    {/* 날짜 상단 (일자 숫자 + 공휴일 라벨) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-mono font-bold inline-flex items-center justify-center ${
                            cDay.isToday
                              ? 'w-5 h-5 rounded-full bg-[#1E3A5F] text-white shadow-2xs'
                              : isHoli || isSun
                              ? 'text-rose-600'
                              : isSat
                              ? 'text-blue-600'
                              : 'text-slate-800'
                          }`}
                        >
                          {cDay.day}
                        </span>

                        {cDay.holidayName && (
                          <span
                            className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1 py-0.2 rounded truncate max-w-[80px]"
                            title={cDay.holidayName}
                          >
                            {cDay.holidayName}
                          </span>
                        )}
                      </div>

                      {/* 사건 이벤트 칩 목록 (최대 3개) */}
                      <div className="space-y-1">
                        {cDay.events.slice(0, 3).map((ev) => {
                          const chipStyle =
                            ev.type === 'correction'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                              : ev.type === 'reminder'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                              : ev.type === 'contract'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                              : ev.type === 'fee'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300';

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCase(ev.caseId);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-medium border truncate transition-all cursor-pointer press-scale flex items-center gap-1 ${chipStyle} ${
                                ev.isUrgent ? 'ring-1 ring-rose-400 font-bold' : ''
                              }`}
                              title={`${ev.clientName} [${ev.badgeLabel}]: ${ev.title} (클릭 시 사건 상세로 이동)`}
                            >
                              <span className="font-bold shrink-0">[{ev.badgeLabel}]</span>
                              <span className="truncate">{ev.clientName}</span>
                            </div>
                          );
                        })}

                        {/* 4개 이상 시 더보기 뱃지 */}
                        {cDay.events.length > 3 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCalDate(cDay.dateStr);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:underline px-1 cursor-pointer"
                          >
                            +{cDay.events.length - 3}건 더보기
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 오늘 표시 텍스트 */}
                    {cDay.isToday && (
                      <span className="text-[10px] text-[#1E3A5F] font-bold mt-1 block text-right">
                        오늘
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 선택된 일자의 사건 상세 패널 ── */}
          {selectedCalDate && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1E3A5F]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{selectedCalDate} 일정 상세</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {selectedDateEvents.length}건
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      선택한 날짜에 예정된 법원 기한, 수임 계약, 리마인더 및 사건 이력을 확인합니다.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCalDate(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>패널 닫기</span>
                </button>
              </div>

              {selectedDateEvents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                  <p className="font-medium text-slate-600">이 날짜에 등록된 사건 일정이 없습니다.</p>
                  <p className="text-slate-400 mt-1">상단 달력에서 색상 칩이 표시된 날짜를 클릭하면 상세 내역을 보실 수 있습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedDateEvents.map((ev) => {
                    const nextAct = getNextActionText(ev.request, ev.ext);
                    const stageInfo = STAGE_CONFIG[ev.stageNum] || STAGE_CONFIG[1];

                    return (
                      <div
                        key={ev.id}
                        className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:border-[#1E3A5F] hover:shadow-xs transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                                ev.type === 'correction'
                                  ? 'bg-rose-100 text-rose-800'
                                  : ev.type === 'reminder'
                                  ? 'bg-amber-100 text-amber-800'
                                  : ev.type === 'contract'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : ev.type === 'fee'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {ev.badgeLabel}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${stageInfo.color}`}>
                                {ev.stageNum}단계 {stageInfo.label}
                              </span>
                            </div>
                            <h5 className="font-bold text-sm text-slate-900">
                              {ev.clientName}
                            </h5>
                          </div>

                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            ev.caseTypeLabel.includes('파산')
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {ev.caseTypeLabel.includes('파산') ? '파산' : '회생'}
                          </span>
                        </div>

                        {/* 일정 상세 내용 */}
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                          <div className="text-slate-500 font-medium flex items-center justify-between">
                            <span>일정 항목</span>
                            {ev.isUrgent && (
                              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> 기한 임박
                              </span>
                            )}
                          </div>
                          <p className="text-slate-900 font-bold text-xs">{ev.title}</p>
                          <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                            다음 할 일: <strong className="text-slate-700">{nextAct.text}</strong>
                          </div>
                        </div>

                        {/* 채무액 & 액션 버튼 */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="font-mono font-bold text-slate-800">
                            {formatWonShort(ev.request.financialProfile?.debtTotal)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenChat(ev.request)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1 transition-colors cursor-pointer text-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                              <span>채팅</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectCase(ev.caseId)}
                              className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] hover:bg-[#162A45] text-white font-bold transition-all cursor-pointer text-xs"
                            >
                              사건 열기
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
