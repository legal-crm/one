import React, { useState, useMemo, useCallback } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, AlertCircle, CheckCircle2, Clock, 
  Calendar, Search, Filter, Download, Plus, MessageCircle, ArrowRight,
  UserCheck, ShieldAlert, ChevronRight, RefreshCw, Send, Check, Sparkles,
  ExternalLink, FileText, Smartphone, MoreHorizontal, UserX, CalendarClock,
  Layers, ShieldCheck, CreditCard, ChevronDown, Award,
  ChevronLeft, ChevronsLeft, ChevronsRight, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, User as LawyerType, FeeInstallment, 
  FeeSettlementSummary, AlimtokMilestone, StaffRole 
} from '../../types';
import { getCrmExt, updateCrmExt, loadCrmExtMap } from '../../services/crmService';
import FeeAlimtokModal from './FeeAlimtokModal';
import FeeNotificationSettingsModal from './FeeNotificationSettingsModal';
import FeeScheduleCreateModal from './FeeScheduleCreateModal';
import FeeSettlementCalendarView from './FeeSettlementCalendarView';
import { feeAmountWon, feeTotalWon, loadFeeNotificationSettings } from '../../services/alimtokService';
import { localYmd, parseLocalYmd, addMonthsClamped } from '../../utils/localDate';
import { getOfficeProfile } from '../../services/lawyer/officeProfile';
import { useDialog } from '../common/DialogProvider';

interface Props {
  requests: ConsultRequest[];
  activeLawyer: LawyerType;
  onNavigateToClientCrm: (clientId: string, targetDetailTab?: 'info' | 'fees' | 'court' | 'documents') => void;
}

// 기획서 4.7 5대 보기 탭 + 전체
export type FeeFilterTab = 'all' | 'overdue' | 'upcoming_week' | 'high_risk' | 'normal' | 'completed';

// 수임료 수납 정렬 옵션
export type FeeSortOption = 
  | 'contract_desc'       // 최근 계약순 (기본값)
  | 'contract_asc'        // 오래된 계약순
  | 'due_date_asc'        // 납부 마감 임박순
  | 'remaining_fee_desc'  // 미수 잔금 높은순
  | 'total_fee_desc'      // 총 수임료 높은순
  | 'client_name_asc';    // 의뢰인 이름순

export default function FeeSettlementTab({
  requests,
  activeLawyer,
  onNavigateToClientCrm,
}: Props) {
  const dialog = useDialog();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeFilterTab, setActiveFilterTab] = useState<FeeFilterTab>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'rehab' | 'bankruptcy'>('all');
  const [sortOption, setSortOption] = useState<FeeSortOption>('contract_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  // 모달 상태
  const [isScheduleCreateOpen, setIsScheduleCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scheduleModalTargetId, setScheduleModalTargetId] = useState<string | undefined>();
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState<number>(0);

  // 알림톡 모달
  const [alimtokModalConfig, setAlimtokModalConfig] = useState<{
    isOpen: boolean;
    client?: ConsultRequest;
    installment?: FeeInstallment;
    initialMilestone?: AlimtokMilestone;
    totalFee: number;
    totalPaid: number;
  }>({
    isOpen: false,
    totalFee: 0,
    totalPaid: 0,
  });

  // 납부 연기 모달
  const [deferModalConfig, setDeferModalConfig] = useState<{
    isOpen: boolean;
    client?: ConsultRequest;
    installment?: FeeInstallment;
    newDueDate: string;
    reason: string;
  }>({
    isOpen: false,
    newDueDate: '',
    reason: '의뢰인 급여일 변경 요청',
  });

  const todayStr = localYmd();
  const today = useMemo(() => parseLocalYmd(todayStr)!, [todayStr]);

  // CRM 확장 데이터 및 수임료 요약 집계
  const settlementList: FeeSettlementSummary[] = useMemo(() => {
    void scheduleRefreshKey;
    const crmMap = loadCrmExtMap();

    return requests.map(req => {
      const ext = crmMap[req.id] || getCrmExt(req.id);
      const schedule: FeeInstallment[] = ext.feeSchedule || [];
      
      const totalFee = feeTotalWon(ext.totalFee || ext.contractAmount) || (schedule.reduce((s, i) => s + feeAmountWon(i), 0)) || 0;
      const paidInstallments = schedule.filter(i => i.status === 'paid');
      const totalPaidFromSchedule = paidInstallments.reduce((s, i) => s + feeAmountWon(i), 0);
      const totalPaid = schedule.length > 0 ? totalPaidFromSchedule : feeTotalWon(ext.totalPaid);
      const remainingFee = Math.max(0, totalFee - totalPaid);

      const totalInstallments = schedule.length;
      const completedInstallments = paidInstallments.length;
      const remainingInstallments = Math.max(0, totalInstallments - completedInstallments);

      // 다음 납부 회차
      const pendingList = schedule
        .filter(i => i.status === 'pending' || i.status === 'overdue')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      const nextPending = pendingList[0];

      const nextDueDate = nextPending?.dueDate;
      const nextDueAmount = nextPending ? feeAmountWon(nextPending) : 0;
      const nextDueRound = nextPending?.round;

      // 상태 판별
      let status: FeeSettlementSummary['status'] = 'normal';
      if (schedule.length === 0) {
        status = 'no_schedule';
      } else if (remainingFee === 0 && totalFee > 0) {
        status = 'completed';
      } else if (nextPending) {
        if (nextPending.status === 'overdue' || (nextDueDate && nextDueDate < todayStr)) {
          status = 'overdue';
        } else if (nextDueDate === todayStr) {
          status = 'due_today';
        } else if (nextDueDate) {
          const dueDateObj = parseLocalYmd(nextDueDate) || new Date(NaN);
          const diffDays = Math.round((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7 && diffDays >= 0) {
            status = 'upcoming';
          }
        }
      }

      // 2회 이상 연기 / 연속 연체 집중관리 대상
      const totalRescheduled = schedule.reduce((sum, i) => sum + (i.rescheduledCount || 0), 0);
      const consecutiveOverdueCount = schedule.filter(i => i.status === 'overdue').length;
      const isHighRiskTarget = totalRescheduled >= 2 || consecutiveOverdueCount >= 2;

      return {
        clientId: req.id,
        clientName: req.clientName,
        realClientName: req.realClientName,
        phone: req.phone || '',
        caseType: (ext.caseType as any) || req.requestType || 'individual_rehab',
        caseNumber: ext.courtCase?.caseNumber,
        courtName: ext.courtCase?.courtName,
        contractDate: ext.contractDate || ext.contracts?.[0]?.contractDate || (req.createdAt ? req.createdAt.slice(0, 10) : undefined),
        filingDate: ext.courtCase?.filedDate,
        totalFee,
        totalPaid,
        remainingFee,
        totalInstallments,
        completedInstallments,
        remainingInstallments,
        nextDueDate,
        nextDueAmount,
        nextDueRound,
        status,
        feeSchedule: schedule,
        isHighRiskTarget,
        rescheduledCount: totalRescheduled,
      };
    });
  }, [requests, scheduleRefreshKey, todayStr, today]);

  // 요약 4칸 카드 지표 산출
  const metrics = useMemo(() => {
    let monthlyTarget = 0;
    let monthlyCollected = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let highRiskCount = 0;
    let upcomingWeekCount = 0;
    let completedCount = 0;
    let normalCount = 0;
    let totalContractRevenue = 0;
    let totalReceivable = 0;

    const currentYearMonth = todayStr.slice(0, 7);

    settlementList.forEach(item => {
      totalContractRevenue += item.totalFee;
      totalReceivable += item.remainingFee;

      if (item.status === 'completed') completedCount++;
      if (item.status === 'normal') normalCount++;
      if (item.status === 'overdue') {
        totalOverdue += item.nextDueAmount || 0;
        overdueCount++;
      }
      if (item.status === 'upcoming' || item.status === 'due_today') {
        upcomingWeekCount++;
      }
      if (item.isHighRiskTarget) {
        highRiskCount++;
      }

      // 당월 입금 목표 및 실적
      item.feeSchedule.forEach(inst => {
        const amt = feeAmountWon(inst);
        if (inst.dueDate && inst.dueDate.startsWith(currentYearMonth)) {
          monthlyTarget += amt;
        }
        if (inst.paidDate && inst.paidDate.startsWith(currentYearMonth) && inst.status === 'paid') {
          monthlyCollected += amt;
        }
      });
    });

    const collectionRate = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyCollected / monthlyTarget) * 100)) : 0;

    return {
      monthlyTarget,
      monthlyCollected,
      collectionRate,
      totalOverdue,
      overdueCount,
      highRiskCount,
      upcomingWeekCount,
      completedCount,
      normalCount,
      totalContractRevenue,
      totalReceivable,
    };
  }, [settlementList, todayStr]);

  // 필터링된 목록
  const filteredList = useMemo(() => {
    return settlementList.filter(item => {
      // 1. 보기 탭 5종 필터
      if (activeFilterTab === 'overdue' && item.status !== 'overdue') return false;
      if (activeFilterTab === 'upcoming_week' && item.status !== 'upcoming' && item.status !== 'due_today') return false;
      if (activeFilterTab === 'high_risk' && !item.isHighRiskTarget) return false;
      if (activeFilterTab === 'normal' && (item.status !== 'normal' || item.isHighRiskTarget)) return false;
      if (activeFilterTab === 'completed' && item.status !== 'completed') return false;

      // 2. 사건유형 필터
      if (caseTypeFilter !== 'all') {
        const isRehab = item.caseType === 'individual_rehab' || item.caseType === 'rehab';
        if (caseTypeFilter === 'rehab' && !isRehab) return false;
        if (caseTypeFilter === 'bankruptcy' && isRehab) return false;
      }

      // 3. 검색어 필터
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const m1 = (item.realClientName || item.clientName || '').toLowerCase().includes(q);
        const m2 = (item.phone || '').includes(q);
        const m3 = (item.caseNumber || '').toLowerCase().includes(q);
        const m4 = (item.courtName || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4) return false;
      }

      return true;
    });
  }, [settlementList, activeFilterTab, caseTypeFilter, searchTerm]);

  // 정렬된 목록
  const sortedList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      switch (sortOption) {
        case 'contract_desc': {
          const dateA = a.contractDate || '';
          const dateB = b.contractDate || '';
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateB.localeCompare(dateA);
        }
        case 'contract_asc': {
          const dateA = a.contractDate || '';
          const dateB = b.contractDate || '';
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.localeCompare(dateB);
        }
        case 'due_date_asc': {
          const dateA = a.nextDueDate || '';
          const dateB = b.nextDueDate || '';
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.localeCompare(dateB);
        }
        case 'remaining_fee_desc': {
          return b.remainingFee - a.remainingFee;
        }
        case 'total_fee_desc': {
          return b.totalFee - a.totalFee;
        }
        case 'client_name_asc': {
          const nameA = a.realClientName || a.clientName || '';
          const nameB = b.realClientName || b.clientName || '';
          return nameA.localeCompare(nameB, 'ko');
        }
        default:
          return 0;
      }
    });
    return list;
  }, [filteredList, sortOption]);

  // 페이징 계산 (10건 단위)
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedList.length);
  const pagedList = sortedList.slice(startIndex, endIndex);

  // 체크박스 선택
  const handleToggleSelect = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedClientIds.size === pagedList.length && pagedList.length > 0) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(pagedList.map(item => item.clientId)));
    }
  };

  // 원클릭 입금 확인 (수납 처리)
  const handleMarkAsPaid = async (item: FeeSettlementSummary, targetInstallment?: FeeInstallment) => {
    const ext = getCrmExt(item.clientId);
    const schedule = ext.feeSchedule || [];
    
    const instToPay = targetInstallment || schedule.find(i => i.status === 'pending' || i.status === 'overdue');
    if (!instToPay) {
      toast.info('납부 대기 중인 회차가 없습니다.');
      return;
    }

    const updatedSchedule = schedule.map(i => {
      if (i.id === instToPay.id) {
        return {
          ...i,
          status: 'paid' as const,
          paidDate: todayStr,
          paymentMethod: i.paymentMethod || '계좌이체',
        };
      }
      return i;
    });

    const newPaidAmount = updatedSchedule
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + feeAmountWon(i), 0);

    await updateCrmExt(item.clientId, {
      ...ext,
      totalPaid: newPaidAmount,
      feeSchedule: updatedSchedule,
      lastActivityAt: new Date().toISOString(),
    });

    setScheduleRefreshKey(k => k + 1);
    toast.success(`${item.realClientName || item.clientName} 의뢰인 [${instToPay.round}차 / ₩${feeAmountWon(instToPay).toLocaleString()}원] 입금 처리가 완료되었습니다.`);

    const targetReq = requests.find(r => r.id === item.clientId);
    if (targetReq && loadFeeNotificationSettings().sendReceiptOnPaid) {
      setAlimtokModalConfig({
        isOpen: true,
        client: targetReq,
        installment: { ...instToPay, status: 'paid', paidDate: todayStr },
        initialMilestone: 'fee_receipt',
        totalFee: item.totalFee,
        totalPaid: newPaidAmount,
      });
    }
  };

  // 납부 연기 처리
  const handleConfirmDeferral = async () => {
    if (!deferModalConfig.client || !deferModalConfig.installment) return;
    if (!deferModalConfig.newDueDate) {
      toast.error('연기할 납부 예정일을 입력해주세요.');
      return;
    }

    const clientId = deferModalConfig.client.id;
    const ext = getCrmExt(clientId);
    const schedule = ext.feeSchedule || [];

    const updatedSchedule = schedule.map(i => {
      if (i.id === deferModalConfig.installment?.id) {
        const currentCount = i.rescheduledCount || 0;
        return {
          ...i,
          originalDueDate: i.originalDueDate || i.dueDate,
          dueDate: deferModalConfig.newDueDate,
          rescheduledCount: currentCount + 1,
          deferralReason: deferModalConfig.reason,
          status: 'pending' as const,
        };
      }
      return i;
    });

    await updateCrmExt(clientId, {
      ...ext,
      feeSchedule: updatedSchedule,
      lastActivityAt: new Date().toISOString(),
    });

    setScheduleRefreshKey(k => k + 1);
    toast.success(`납부 예정일이 ${deferModalConfig.newDueDate}로 변경되었습니다.`);
    setDeferModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // 신규 분납 스케줄 저장
  const handleSaveSchedule = async (clientId: string, totalFee: number, schedule: FeeInstallment[]) => {
    const ext = getCrmExt(clientId);
    const paidBefore = (ext.feeSchedule || []).filter(i => i.status === 'paid').length;
    if (paidBefore > 0) {
      const confirmed = await dialog.confirm({
        title: '수임료 분납 일정 변경',
        message: `이미 납부 처리된 회차가 ${paidBefore}건 있습니다. 새 일정으로 바꾸면 기존 납부 기록이 지워집니다. 계속할까요?`,
        confirmText: '새 일정으로 변경',
        cancelText: '취소',
        variant: 'warning',
      });
      if (!confirmed) return;
    }
    const wonSchedule = schedule.map(i => ({ ...i, amountUnit: 'won' as const }));
    const totalPaid = wonSchedule
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + feeAmountWon(i), 0);

    await updateCrmExt(clientId, {
      ...ext,
      totalFee: totalFee % 10000 === 0 ? totalFee / 10000 : totalFee,
      totalPaid,
      feeSchedule: wonSchedule,
      lastActivityAt: new Date().toISOString(),
    });

    setScheduleRefreshKey(k => k + 1);
  };

  // CSV 다운로드
  const handleExportCsv = () => {
    if (sortedList.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = [
      '의뢰인명', '연락처', '사건유형', '사건번호', '법원', '계약일', '법원접수일',
      '총수임료', '기납부액', '미수잔금', '총회차', '납부회차', '남은회차',
      '다음납부일', '다음납부예정액', '상태', '집중관리대상'
    ];

    const rows = sortedList.map(i => [
      i.realClientName || i.clientName,
      i.phone,
      i.caseType === 'bankruptcy' ? '개인파산' : '개인회생',
      i.caseNumber || '-',
      i.courtName || '-',
      i.contractDate || '-',
      i.filingDate || '-',
      i.totalFee,
      i.totalPaid,
      i.remainingFee,
      i.totalInstallments,
      i.completedInstallments,
      i.remainingInstallments,
      i.nextDueDate || '-',
      i.nextDueAmount || 0,
      i.status,
      i.isHighRiskTarget ? '집중관리' : '일반'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `수임료_분납_정산현황_${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 파일이 다운로드되었습니다.');
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-16 text-slate-800">
      
      {/* ── 1. 페이지 헤더 ── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase bg-blue-50 text-[#1E3A5F] px-2.5 py-0.5 rounded-md">
              수납 작업 큐
            </span>
            <span className="text-xs text-slate-400">· 분납 일정 등록은 사건 2단계에서도 바로 진행할 수 있습니다</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#1E3A5F]" />
            <span>수임료 수납</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 목록 뷰 / 정산 캘린더 토글 */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>목록</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-[#1E3A5F] text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>캘린더</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <span>알림 설정</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScheduleModalTargetId(requests[0]?.id);
              setIsScheduleCreateOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#1E3A5F] hover:bg-[#152a45] rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>분납 일정 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 요약 4칸 카드 (기획서 4.7: 같은 스타일로 두고 연체 금액만 로즈 강조) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* 카드 1: 당월 입금 목표 & 달성률 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">당월 입금 목표</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            ₩{metrics.monthlyTarget.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
            <span>수납액: ₩{metrics.monthlyCollected.toLocaleString()}</span>
            <span className="font-bold text-blue-700">{metrics.collectionRate}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${metrics.collectionRate}%` }} />
          </div>
        </div>

        {/* 카드 2: 🚨 연체 미납 관리 (기획서: 로즈 테두리 & 텍스트로 강조) */}
        <div 
          onClick={() => setActiveFilterTab('overdue')}
          className="bg-rose-50/40 p-5 rounded-2xl border border-rose-300 shadow-xs space-y-2 cursor-pointer hover:border-rose-400 transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>연체 미납 관리</span>
            </span>
            <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-black rounded-full">
              {metrics.overdueCount}건
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight tabular-nums">
            ₩{metrics.totalOverdue.toLocaleString()}
          </div>
          <div className="text-xs text-rose-600 font-bold flex items-center justify-between pt-1">
            <span>즉시 독촉 안내 필요</span>
            <span className="group-hover:underline">모아보기 →</span>
          </div>
          <div className="w-full bg-rose-200/60 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${metrics.overdueCount > 0 ? 100 : 0}%` }} />
          </div>
        </div>

        {/* 카드 3: 집중 관리 대상 (2회+ 연기/연체) */}
        <div 
          onClick={() => setActiveFilterTab('high_risk')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 cursor-pointer hover:border-amber-400 transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>집중 관리 (2회+ 미룸)</span>
            </span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
              {metrics.highRiskCount}명
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            {metrics.highRiskCount}<span className="text-sm font-medium text-slate-500 ml-1">사건</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
            <span>분납 일정 재조정 권장</span>
            <span className="font-bold text-amber-700 group-hover:underline">조회 →</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${metrics.highRiskCount > 0 ? 60 : 0}%` }} />
          </div>
        </div>

        {/* 카드 4: 잔여 미수 잔금 파이프라인 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">향후 유입 잔여 잔금</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            ₩{metrics.totalReceivable.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
            <span>약정 총액: ₩{metrics.totalContractRevenue.toLocaleString()}</span>
            <span className="text-emerald-700 font-bold">진행 {settlementList.length}건</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

      </div>

      {/* ── 3 & 4. 캘린더 뷰 vs 목록 뷰 ── */}
      {viewMode === 'calendar' ? (
        <FeeSettlementCalendarView
          settlementList={settlementList}
          requests={requests}
          todayStr={todayStr}
          onMarkAsPaid={handleMarkAsPaid}
          onOpenAlimtok={(client, inst, totalFee, totalPaid) => {
            setAlimtokModalConfig({
              isOpen: true,
              client,
              installment: inst,
              initialMilestone: inst.status === 'overdue' ? 'fee_overdue' : inst.dueDate === todayStr ? 'fee_due' : 'fee_upcoming',
              totalFee,
              totalPaid,
            });
          }}
          onOpenDeferModal={(client, inst) => {
            const d = addMonthsClamped(parseLocalYmd(inst.dueDate) || new Date(), 1);
            setDeferModalConfig({
              isOpen: true,
              client,
              installment: inst,
              newDueDate: localYmd(d),
              reason: '의뢰인 급여일 변경 요청',
            });
          }}
          onNavigateToClientCrm={onNavigateToClientCrm}
        />
      ) : (
        <>
          {/* ── 3. 보기 탭 5종 + 검색 툴바 (기획서 4.7) ── */}
          <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* 보기 탭 5종: 연체 · 이번 주 예정 · 집중 관리(2회+) · 진행 중 · 완납 (+ 전체) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
              {[
                { id: 'all' as const, label: '전체', count: settlementList.length },
                { id: 'overdue' as const, label: '⚠️ 연체', count: metrics.overdueCount, isAlert: true },
                { id: 'upcoming_week' as const, label: '이번 주 예정', count: metrics.upcomingWeekCount },
                { id: 'high_risk' as const, label: '🚨 집중 관리 (2회+)', count: metrics.highRiskCount },
                { id: 'normal' as const, label: '진행 중', count: metrics.normalCount },
                { id: 'completed' as const, label: '완납', count: metrics.completedCount },
              ].map(tab => {
                const isSelected = activeFilterTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveFilterTab(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] ${
                      isSelected
                        ? tab.isAlert ? 'bg-rose-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
                        : tab.isAlert && tab.count > 0
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 검색, 사건 구분 및 정렬 */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 min-w-[180px] md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="의뢰인명, 연락처, 사건번호..."
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-slate-900 placeholder-slate-400"
                />
              </div>

              <select
                value={caseTypeFilter}
                onChange={e => {
                  setCaseTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">사건: 전체</option>
                <option value="rehab">개인회생</option>
                <option value="bankruptcy">개인파산</option>
              </select>

              {/* 정렬 셀렉트 */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={sortOption}
                  onChange={e => {
                    setSortOption(e.target.value as FeeSortOption);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="contract_desc">최근 계약순</option>
                  <option value="contract_asc">오래된 계약순</option>
                  <option value="due_date_asc">납부 마감 임박순</option>
                  <option value="remaining_fee_desc">미수 잔금 높은순</option>
                  <option value="total_fee_desc">총 수임료 높은순</option>
                  <option value="client_name_asc">의뢰인 이름순</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── 4. 수납 테이블 (기획서 4.7 7열 정제) ── */}
          {/* 7열: 의뢰인·사건 · 약정/수납 진행 막대 · 다음 납부(일자·금액·D-day) · 상태 · 연기 횟수 · 남은 회차 · ⋯ */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[880px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-[24%]">의뢰인 · 사건</th>
                    <th className="py-3.5 px-3 w-[20%] text-right">약정 / 수납 진행 막대</th>
                    <th className="py-3.5 px-3 w-[18%]">다음 납부 (일자·금액·D-day)</th>
                    <th className="py-3.5 px-3 w-[12%] text-center">상태</th>
                    <th className="py-3.5 px-3 w-[10%] text-center">연기 횟수</th>
                    <th className="py-3.5 px-3 w-[8%] text-center">남은 회차</th>
                    <th className="py-3.5 px-4 w-[16%] text-center">관리 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {sortedList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 space-y-2">
                        <p className="text-sm font-bold text-slate-600">조건에 일치하는 수납 대상이 없습니다.</p>
                        <p className="text-xs text-slate-400">필터 조건을 변경하거나 분납 일정을 등록해 보세요.</p>
                      </td>
                    </tr>
                  ) : (
                    pagedList.map(item => {
                      const isSelected = selectedClientIds.has(item.clientId);
                      const paymentPercent = item.totalFee > 0 ? Math.min(100, Math.round((item.totalPaid / item.totalFee) * 100)) : 0;
                      const isRehab = item.caseType === 'individual_rehab' || item.caseType === 'rehab';

                      // 상태 배지
                      let statusBadge = { label: '정상', color: 'text-slate-700 bg-slate-100 border-slate-200', emoji: '📄' };
                      if (item.status === 'completed') {
                        statusBadge = { label: '완납 완료', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', emoji: '✅' };
                      } else if (item.status === 'overdue') {
                        statusBadge = { label: '연체 미납', color: 'text-rose-700 bg-rose-50 border-rose-200', emoji: '⚠️' };
                      } else if (item.status === 'due_today') {
                        statusBadge = { label: '오늘 마감', color: 'text-orange-700 bg-orange-50 border-orange-200', emoji: '📅' };
                      } else if (item.status === 'upcoming') {
                        statusBadge = { label: '예정 (7일내)', color: 'text-blue-700 bg-blue-50 border-blue-200', emoji: '⏳' };
                      } else if (item.status === 'no_schedule') {
                        statusBadge = { label: '일정 미등록', color: 'text-slate-500 bg-slate-100 border-slate-200', emoji: '—' };
                      }

                      return (
                        <tr 
                          key={item.clientId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            item.isHighRiskTarget ? 'bg-amber-50/20' : isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          {/* 1. 의뢰인 · 사건 */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">
                                {item.realClientName || item.clientName}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-xs font-bold ${
                                isRehab ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}>
                                {isRehab ? '개인회생' : '개인파산'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono flex-wrap">
                              <span>{item.phone || '-'}</span>
                              {item.contractDate && (
                                <span className="text-slate-600 font-sans font-medium bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/80">
                                  계약 {item.contractDate}
                                </span>
                              )}
                              {item.caseNumber && (
                                <span className="text-slate-400 font-sans">· {item.caseNumber}</span>
                              )}
                            </div>
                          </td>

                          {/* 2. 약정 / 수납 진행 막대 */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="font-black text-slate-900 text-sm">
                              ₩{item.totalPaid.toLocaleString()}
                              <span className="text-xs font-normal text-slate-400 ml-1">/ ₩{item.totalFee.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 mt-1">
                              <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden inline-block">
                                <div 
                                  className={`h-full rounded-full transition-all ${paymentPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                  style={{ width: `${paymentPercent}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-700">{paymentPercent}%</span>
                            </div>
                          </td>

                          {/* 3. 다음 납부 (일자·금액·D-day) */}
                          <td className="py-3.5 px-3">
                            {item.remainingFee === 0 || !item.nextDueDate ? (
                              <span className="text-slate-400 text-xs">완납 또는 대기 없음</span>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-800 text-xs">
                                  {item.nextDueDate.slice(5)} · ₩{item.nextDueAmount.toLocaleString()}원
                                </div>
                                <div className="text-xs mt-0.5">
                                  {(() => {
                                    const due = parseLocalYmd(item.nextDueDate) || new Date(NaN);
                                    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diff < 0) {
                                      return <span className="font-black text-rose-600">D+{-diff} ({Math.abs(diff)}일 연체)</span>;
                                    }
                                    if (diff === 0) {
                                      return <span className="font-black text-orange-600">D-Day (오늘 마감)</span>;
                                    }
                                    return <span className="font-bold text-blue-700">D-{diff} ({item.nextDueRound}회차)</span>;
                                  })()}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 4. 상태 */}
                          <td className="py-3.5 px-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${statusBadge.color}`}>
                              <span>{statusBadge.emoji}</span>
                              <span>{statusBadge.label}</span>
                            </span>
                          </td>

                          {/* 5. 연기 횟수 (집중 관리 여부) */}
                          <td className="py-3.5 px-3 text-center">
                            {item.isHighRiskTarget ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-md text-xs font-black inline-flex items-center gap-0.5">
                                🚨 {item.rescheduledCount}회 (집중)
                              </span>
                            ) : item.rescheduledCount > 0 ? (
                              <span className="text-xs font-bold text-slate-600">
                                {item.rescheduledCount}회 연기
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0회</span>
                            )}
                          </td>

                          {/* 6. 남은 회차 */}
                          <td className="py-3.5 px-3 text-center">
                            {item.remainingInstallments === 0 ? (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                완납
                              </span>
                            ) : (
                              <span className="font-bold text-slate-700 text-xs">
                                {item.remainingInstallments}회 남음
                              </span>
                            )}
                          </td>

                          {/* 7. 작업 액션 (주 버튼 '입금 확인' + ⋯) */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.remainingFee > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(item)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                                  title="당회차 입금 확인 처리"
                                >
                                  입금 확인
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToClientCrm(item.clientId, 'fees')}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                >
                                  수납 내역
                                </button>
                              )}

                              {/* 더보기 (⋯) 메뉴 */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setActiveRowMenuId(activeRowMenuId === item.clientId ? null : item.clientId)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  title="더보기"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {activeRowMenuId === item.clientId && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 space-y-0.5 animate-fadeIn text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveRowMenuId(null);
                                        const targetReq = requests.find(r => r.id === item.clientId);
                                        const targetInst = item.feeSchedule.find(i => i.status === 'pending' || i.status === 'overdue') || item.feeSchedule[0];
                                        if (targetReq && targetInst) {
                                          setAlimtokModalConfig({
                                            isOpen: true,
                                            client: targetReq,
                                            installment: targetInst,
                                            initialMilestone: item.status === 'overdue' ? 'fee_overdue' : item.status === 'due_today' ? 'fee_due' : 'fee_upcoming',
                                            totalFee: item.totalFee,
                                            totalPaid: item.totalPaid,
                                          });
                                        } else {
                                          toast.info('발송 가능한 분납 일정이 없습니다.');
                                        }
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                                      <span>알림톡 발송</span>
                                    </button>

                                    {item.remainingFee > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveRowMenuId(null);
                                          const targetReq = requests.find(r => r.id === item.clientId);
                                          const targetInst = item.feeSchedule.find(i => i.status === 'pending' || i.status === 'overdue');
                                          if (targetReq && targetInst) {
                                            const d = addMonthsClamped(parseLocalYmd(targetInst.dueDate) || new Date(), 1);
                                            setDeferModalConfig({
                                              isOpen: true,
                                              client: targetReq,
                                              installment: targetInst,
                                              newDueDate: localYmd(d),
                                              reason: '의뢰인 급여일 변경 요청',
                                            });
                                          }
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                                      >
                                        <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                                        <span>납부일 연기</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveRowMenuId(null);
                                        onNavigateToClientCrm(item.clientId, 'fees');
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                      <span>사건 상세 (CRM)</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── 하단 페이지네이션 바 ── */}
            <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              {/* 왼쪽: 건수 및 페이지 정보 */}
              <div className="text-slate-500 font-medium flex items-center gap-2">
                <span>
                  전체 <strong className="text-slate-800 font-bold">{sortedList.length}</strong>건 중{' '}
                  {sortedList.length === 0 ? (
                    '0건'
                  ) : (
                    <>
                      <strong className="text-slate-800 font-bold">{startIndex + 1}</strong>~
                      <strong className="text-slate-800 font-bold">{endIndex}</strong>건 표시
                    </>
                  )}
                </span>
                {sortedList.length > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>
                      <strong className="text-slate-800 font-bold">{validCurrentPage}</strong> / {totalPages} 페이지
                    </span>
                  </>
                )}
              </div>

              {/* 오른쪽: 페이지 단위 및 페이지 이동 버튼 */}
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                {/* 페이지당 건수 */}
                <div className="flex items-center gap-1.5 text-slate-500">
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10건씩 보기</option>
                    <option value={20}>20건씩 보기</option>
                    <option value={50}>50건씩 보기</option>
                  </select>
                </div>

                {/* 페이지 이동 버튼 바 */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
                    {/* 맨 앞으로 */}
                    {totalPages > 3 && (
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={validCurrentPage === 1}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors press-scale"
                        title="첫 페이지"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* 이전 페이지 */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={validCurrentPage === 1}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-0.5 press-scale"
                      title="이전 페이지"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">이전</span>
                    </button>

                    {/* 번호 버튼들 */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => {
                          if (totalPages <= 7) return true;
                          if (p === 1 || p === totalPages) return true;
                          return Math.abs(p - validCurrentPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                          if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400 select-none">
                                ...
                              </span>
                            );
                          }
                          const pageNum = p as number;
                          const isActive = validCurrentPage === pageNum;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`min-w-[30px] h-7 text-xs font-bold rounded-lg transition-all cursor-pointer press-scale ${
                                isActive
                                  ? 'bg-[#1E3A5F] text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                    </div>

                    {/* 다음 페이지 */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={validCurrentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-0.5 press-scale"
                      title="다음 페이지"
                    >
                      <span className="hidden sm:inline">다음</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* 맨 뒤로 */}
                    {totalPages > 3 && (
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={validCurrentPage === totalPages}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors press-scale"
                        title="마지막 페이지"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 5. 분납 일정 신규 등록 모달 ── */}
      {isScheduleCreateOpen && (
        <FeeScheduleCreateModal
          isOpen={isScheduleCreateOpen}
          onClose={() => setIsScheduleCreateOpen(false)}
          clients={requests}
          selectedClientId={scheduleModalTargetId}
          onSaveSchedule={handleSaveSchedule}
        />
      )}

      {/* ── 6. 알림톡 규칙 설정 모달 ── */}
      {isSettingsOpen && (
        <FeeNotificationSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* ── 7. 단일/일괄 알림톡 발송 모달 ── */}
      {alimtokModalConfig.isOpen && alimtokModalConfig.client && alimtokModalConfig.installment && (
        <FeeAlimtokModal
          isOpen={alimtokModalConfig.isOpen}
          onClose={() => setAlimtokModalConfig(prev => ({ ...prev, isOpen: false }))}
          client={{
            id: alimtokModalConfig.client.id,
            clientName: alimtokModalConfig.client.realClientName || alimtokModalConfig.client.clientName || '의뢰인',
            phone: alimtokModalConfig.client.phone || '',
          }}
          installment={alimtokModalConfig.installment}
          totalFeeWon={alimtokModalConfig.totalFee}
          totalPaidWon={alimtokModalConfig.totalPaid}
          firmName={getOfficeProfile(activeLawyer.name).firmName || activeLawyer.firmName || ''}
          lawyerName={activeLawyer.name || ''}
          initialMilestone={alimtokModalConfig.initialMilestone}
          onSent={() => {
            setScheduleRefreshKey(k => k + 1);
          }}
        />
      )}

      {/* ── 8. 납부 약속 연기 모달 ── */}
      {deferModalConfig.isOpen && deferModalConfig.client && deferModalConfig.installment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">납부 약속일 연기 및 재조정</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeferModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 text-sm">
                  {deferModalConfig.client.realClientName || deferModalConfig.client.clientName} 의뢰인
                </div>
                <div className="text-slate-500">
                  대상: {deferModalConfig.installment.round}회차 (₩{feeAmountWon(deferModalConfig.installment).toLocaleString()}원)
                </div>
                <div className="text-slate-500">
                  기존 납부일: <span className="font-bold text-slate-700">{deferModalConfig.installment.dueDate}</span>
                </div>
                <div className="text-amber-700 font-bold">
                  현재까지 연기 횟수: {deferModalConfig.installment.rescheduledCount || 0}회
                  {(deferModalConfig.installment.rescheduledCount || 0) >= 1 && (
                    <span className="text-rose-600 block text-xs mt-0.5">
                      ⚠️ 이번 연기 처리 시 누적 2회로 「집중 관리 대상」으로 지정됩니다.
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">새 납부 예정일</label>
                <input
                  type="date"
                  value={deferModalConfig.newDueDate}
                  onChange={e => setDeferModalConfig(prev => ({ ...prev, newDueDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">연기 사유</label>
                <input
                  type="text"
                  value={deferModalConfig.reason}
                  onChange={e => setDeferModalConfig(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="예: 급여 지급일 25일로 변경, 병원비 지출로 2주 유예 등"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeferModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeferral}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                납부일 연기 확정
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
