import React, { useState, useMemo, useCallback } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, AlertCircle, CheckCircle2, Clock, 
  Calendar, Search, Filter, Download, Plus, MessageCircle, ArrowRight,
  UserCheck, ShieldAlert, ChevronRight, RefreshCw, Send, Check, Sparkles,
  ExternalLink, FileText, Smartphone, MoreHorizontal, UserX, CalendarClock,
  Layers, ShieldCheck, CreditCard, ChevronDown, Award
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

interface Props {
  requests: ConsultRequest[];
  activeLawyer: LawyerType;
  onNavigateToClientCrm: (clientId: string, targetDetailTab?: 'info' | 'fees' | 'court' | 'documents') => void;
}

type FilterTab = 'all' | 'high_risk' | 'overdue' | 'due_today' | 'upcoming_week' | 'normal' | 'completed';

export default function FeeSettlementTab({
  requests,
  activeLawyer,
  onNavigateToClientCrm,
}: Props) {
  // 상태 관리
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<'all' | 'rehab' | 'bankruptcy'>('all');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  // 모달 상태
  const [isScheduleCreateOpen, setIsScheduleCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scheduleModalTargetId, setScheduleModalTargetId] = useState<string | undefined>();
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState<number>(0);

  // 알림톡 단일/일괄 발송 모달
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

  // 약속 날짜 연기 모달
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

  // 오늘 날짜 계산 (자정 기준)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => {
    return today.toISOString().split('T')[0];
  }, [today]);

  // CRM 확장 데이터 및 수임료 요약 집계
  const settlementList: FeeSettlementSummary[] = useMemo(() => {
    // scheduleRefreshKey가 변경되면 재계산 트리거
    void scheduleRefreshKey;
    const crmMap = loadCrmExtMap();

    return requests.map(req => {
      const ext = crmMap[req.id] || getCrmExt(req.id);
      const schedule: FeeInstallment[] = ext.feeSchedule || [];
      
      const totalFee = ext.totalFee || ext.contractAmount || (schedule.reduce((s, i) => s + (i.amount >= 10000 ? i.amount : i.amount * 10000), 0)) || 0;
      
      // 기납부액 계산
      const paidInstallments = schedule.filter(i => i.status === 'paid');
      const totalPaidFromSchedule = paidInstallments.reduce((s, i) => s + (i.amount >= 10000 ? i.amount : i.amount * 10000), 0);
      const totalPaid = ext.totalPaid !== undefined ? ext.totalPaid : totalPaidFromSchedule;
      const remainingFee = Math.max(0, totalFee - totalPaid);

      const totalInstallments = schedule.length || (ext.contractAmount ? 1 : 0);
      const completedInstallments = paidInstallments.length;
      const remainingInstallments = Math.max(0, totalInstallments - completedInstallments);

      // 다음 납부 대상 회차 (미납 또는 대기 중인 첫 번째 회차)
      const pendingItems = schedule
        .filter(i => i.status === 'pending' || i.status === 'overdue')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      
      const nextDueItem = pendingItems[0];
      const nextDueDate = nextDueItem?.dueDate;
      const nextDueAmount = nextDueItem ? (nextDueItem.amount >= 10000 ? nextDueItem.amount : nextDueItem.amount * 10000) : undefined;
      const nextDueRound = nextDueItem?.round;

      // 연체 및 D-Day 판정
      let isOverdue = false;
      let overdueDays = 0;
      let isDueToday = false;
      let overdueRoundsCount = 0;
      let rescheduledCount = 0;

      schedule.forEach(item => {
        if (item.rescheduledCount) {
          rescheduledCount += item.rescheduledCount;
        }
        if (item.status === 'overdue') {
          overdueRoundsCount++;
        }
        if (item.status !== 'paid' && item.dueDate) {
          const due = new Date(item.dueDate);
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            isOverdue = true;
            if (diffDays > overdueDays) {
              overdueDays = diffDays;
            }
          } else if (diffDays === 0) {
            isDueToday = true;
          }
        }
      });

      // 🚨 집중 관리 대상 판정: 
      // 1) 2회 이상 연속/다중 연체 (overdueRoundsCount >= 2)
      // 2) 약속 날짜 2회 이상 연기/유예 (rescheduledCount >= 2)
      // 3) 연체 일수 14일 이상 장기 연체
      const isHighRiskTarget = overdueRoundsCount >= 2 || rescheduledCount >= 2 || overdueDays >= 14;

      // 상태 판정
      let status: FeeSettlementSummary['status'] = 'normal';
      if (totalFee > 0 && remainingFee === 0 && totalInstallments > 0) {
        status = 'completed';
      } else if (isOverdue || overdueRoundsCount > 0) {
        status = 'overdue';
      } else if (isDueToday) {
        status = 'due_today';
      } else if (nextDueDate) {
        const nextDue = new Date(nextDueDate);
        nextDue.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 7) {
          status = 'upcoming';
        } else {
          status = 'normal';
        }
      } else if (totalInstallments === 0) {
        status = 'no_schedule';
      }

      // 의뢰인 이름 파싱
      const rawName = req.clientName || '의뢰인';
      const parts = rawName.split('_');
      const stealthNickname = req.stealthNickname || (parts.length > 1 ? parts[1] : rawName);
      const realClientName = req.realClientName || (parts.length > 1 ? parts[0] : rawName);

      return {
        clientId: req.id,
        clientName: stealthNickname,
        realClientName,
        phone: req.phone || (req as any).userPhone || '010-****-****',
        caseType: ext.caseType || req.caseType || (req.bankruptcyReason ? 'bankruptcy' : 'individual_rehab'),
        caseNumber: ext.courtCase?.caseNumber,
        courtName: ext.courtCase?.courtName,
        contractDate: ext.contractDate,
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
        isOverdue,
        overdueDays,
        overdueRoundsCount,
        rescheduledCount,
        isHighRiskTarget,
        status,
        feeSchedule: schedule,
      };
    });
  }, [requests, scheduleRefreshKey, today]);

  // 상단 대시보드 KPI 집계
  const metrics = useMemo(() => {
    let monthlyTarget = 0;      // 당월 입금 예정액
    let monthlyCollected = 0;   // 당월 수납 완료액
    let totalOverdue = 0;       // 미납/연체 총액
    let overdueCount = 0;       // 연체 건수
    let highRiskCount = 0;      // 🚨 집중 관리 대상 (2회+ 연기/연체)
    let totalReceivable = 0;    // 전체 미수 잔금 파이프라인
    let totalContractRevenue = 0; // 전체 총 계약 수임료
    let dueTodayCount = 0;      // 오늘 마감 건수
    let upcomingWeekCount = 0;  // 이번 주 예정 건수

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    settlementList.forEach(item => {
      totalContractRevenue += item.totalFee;
      totalReceivable += item.remainingFee;

      if (item.isHighRiskTarget) {
        highRiskCount++;
      }

      item.feeSchedule.forEach(inst => {
        const amountWon = inst.amount >= 10000 ? inst.amount : inst.amount * 10000;
        
        // 당월 대상 여부
        if (inst.dueDate && inst.dueDate.startsWith(currentYearMonth)) {
          monthlyTarget += amountWon;
          if (inst.status === 'paid') {
            monthlyCollected += amountWon;
          }
        }

        // 연체 판정
        if (inst.status === 'overdue' || (inst.status === 'pending' && inst.dueDate < todayStr)) {
          totalOverdue += amountWon;
          overdueCount++;
        }

        // 오늘 마감
        if (inst.status !== 'paid' && inst.dueDate === todayStr) {
          dueTodayCount++;
        }

        // 이번 주 마감 (오늘 ~ D+7)
        if (inst.status !== 'paid' && inst.dueDate >= todayStr) {
          const due = new Date(inst.dueDate);
          const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) {
            upcomingWeekCount++;
          }
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
      totalReceivable,
      totalContractRevenue,
      dueTodayCount,
      upcomingWeekCount,
    };
  }, [settlementList, today, todayStr]);

  // 필터링 적용된 고객 리스트
  const filteredList = useMemo(() => {
    return settlementList.filter(item => {
      // 1. 탭 필터
      if (activeFilterTab === 'high_risk' && !item.isHighRiskTarget) return false;
      if (activeFilterTab === 'overdue' && item.status !== 'overdue') return false;
      if (activeFilterTab === 'due_today' && item.status !== 'due_today') return false;
      if (activeFilterTab === 'upcoming_week' && item.status !== 'upcoming') return false;
      if (activeFilterTab === 'normal' && (item.status !== 'normal' || item.isHighRiskTarget)) return false;
      if (activeFilterTab === 'completed' && item.status !== 'completed') return false;

      // 2. 사건 유형 필터
      if (caseTypeFilter === 'rehab' && item.caseType !== 'individual_rehab') return false;
      if (caseTypeFilter === 'bankruptcy' && item.caseType !== 'bankruptcy') return false;

      // 3. 검색어 필터
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item.clientName.toLowerCase().includes(query) || (item.realClientName && item.realClientName.toLowerCase().includes(query));
        const matchPhone = item.phone.includes(query);
        const matchCase = item.caseNumber ? item.caseNumber.toLowerCase().includes(query) : false;
        const matchCourt = item.courtName ? item.courtName.toLowerCase().includes(query) : false;
        if (!matchName && !matchPhone && !matchCase && !matchCourt) {
          return false;
        }
      }

      return true;
    });
  }, [settlementList, activeFilterTab, caseTypeFilter, searchTerm]);

  // 체크박스 핸들러
  const handleToggleSelect = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedClientIds.size === filteredList.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredList.map(item => item.clientId)));
    }
  };

  // 원클릭 입금 확인 (수납 처리)
  const handleMarkAsPaid = async (item: FeeSettlementSummary, targetInstallment?: FeeInstallment) => {
    const ext = getCrmExt(item.clientId);
    const schedule = ext.feeSchedule || [];
    
    // 대상 회차 (지정된 회차 또는 첫 번째 미납 회차)
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
      .reduce((sum, i) => sum + (i.amount >= 10000 ? i.amount : i.amount * 10000), 0);

    await updateCrmExt(item.clientId, {
      ...ext,
      totalPaid: newPaidAmount,
      feeSchedule: updatedSchedule,
      lastActivityAt: new Date().toISOString(),
    });

    setScheduleRefreshKey(k => k + 1);
    toast.success(`${item.realClientName || item.clientName} 의뢰인 [${instToPay.round}차 / ₩${(instToPay.amount >= 10000 ? instToPay.amount : instToPay.amount * 10000).toLocaleString()}] 입금 처리가 완료되었습니다.`);

    // 입금 확인 영수증 알림톡 모달 자동 호출
    const targetReq = requests.find(r => r.id === item.clientId);
    if (targetReq) {
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

  // 약속 날짜 연기 처리
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
    toast.success(`납부 예정일이 ${deferModalConfig.newDueDate}로 변경되었습니다. (연기 누적: ${(deferModalConfig.installment.rescheduledCount || 0) + 1}회)`);
    setDeferModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // 신규 분납 스케줄 저장 핸들러
  const handleSaveSchedule = async (clientId: string, totalFee: number, schedule: FeeInstallment[]) => {
    const ext = getCrmExt(clientId);
    const totalPaid = schedule
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.amount >= 10000 ? i.amount : i.amount * 10000), 0);

    await updateCrmExt(clientId, {
      ...ext,
      totalFee,
      totalPaid,
      feeSchedule: schedule,
      lastActivityAt: new Date().toISOString(),
    });

    setScheduleRefreshKey(k => k + 1);
  };

  // CSV 다운로드 기능
  const handleExportCsv = () => {
    if (filteredList.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = [
      '의뢰인명', '연락처', '사건유형', '사건번호', '법원', '계약일', '법원접수일',
      '총수임료', '기납부액', '미수잔금', '총회차', '납부회차', '남은회차',
      '다음납부일', '다음납부예정액', '상태', '집중관리대상(2회+연기/연체)'
    ];

    const rows = filteredList.map(i => [
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
      i.isHighRiskTarget ? '집중관리(위험)' : '일반'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `수임료_분납_정산현황_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV 엑셀 파일이 다운로드되었습니다.');
  };

  // 일괄 알림톡 발송
  const handleBulkAlimtok = () => {
    if (selectedClientIds.size === 0) {
      toast.error('알림톡을 발송할 의뢰인을 1명 이상 선택해주세요.');
      return;
    }

    const targetList = settlementList.filter(item => selectedClientIds.has(item.clientId));
    toast.info(`선택된 ${targetList.length}명의 의뢰인에게 납부 안내 알림톡 일괄 발송을 진행합니다.`);
    
    // 대표 첫 의뢰인의 모달을 띄워 템플릿 검토 후 일괄 전송
    const firstItem = targetList[0];
    const targetReq = requests.find(r => r.id === firstItem.clientId);
    const firstPending = firstItem.feeSchedule.find(i => i.status === 'pending' || i.status === 'overdue') || firstItem.feeSchedule[0];

    if (targetReq && firstPending) {
      setAlimtokModalConfig({
        isOpen: true,
        client: targetReq,
        installment: firstPending,
        initialMilestone: firstItem.status === 'overdue' ? 'fee_overdue' : firstItem.status === 'due_today' ? 'fee_due' : 'fee_upcoming',
        totalFee: firstItem.totalFee,
        totalPaid: firstItem.totalPaid,
      });
    }
  };

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      
      {/* ── 1. 페이지 헤더 ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#1E3A5F] text-white rounded-2xl shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                수임료 정산 관리 (Fee Settlement Hub)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                회생·파산 의뢰인의 분할 납부 일정, 미수금 추적 및 연체 방지 알림톡을 원스톱으로 관리합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 뷰 모드 전환 토글 (목록 뷰 / 정산 캘린더) */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>목록 뷰</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>정산 캘린더</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚙️ 알림 규칙 설정</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>엑셀 다운로드</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScheduleModalTargetId(requests[0]?.id);
              setIsScheduleCreateOpen(true);
            }}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#1E3A5F] hover:bg-[#163152] rounded-xl transition-all shadow-sm flex items-center gap-1.5 press-scale cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>분납 일정 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 상단 정산 실시간 KPI 대시보드 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: 이번 달 입금 예정액 & 달성률 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">당월 입금 목표</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              ₩{metrics.monthlyTarget.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1 flex items-center justify-between">
              <span>수납 완료: ₩{metrics.monthlyCollected.toLocaleString()}</span>
              <span className="font-bold text-blue-600">{metrics.collectionRate}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics.collectionRate}%` }} 
            />
          </div>
        </div>

        {/* KPI 2: 미납 / 연체 총액 */}
        <div 
          onClick={() => setActiveFilterTab('overdue')}
          className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-3 cursor-pointer hover:border-rose-400 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              미납 / 연체 관리
            </span>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[11px] font-black rounded-full">
              {metrics.overdueCount}건
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 tabular-nums">
              ₩{metrics.totalOverdue.toLocaleString()}
            </div>
            <div className="text-xs text-rose-500 font-medium mt-1 flex items-center justify-between">
              <span>즉시 독촉 알림톡 필요</span>
              <span className="group-hover:underline text-[11px] font-bold">목록 보기 →</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            예정일 경과 미입금 금액 합산
          </div>
        </div>

        {/* KPI 3: 🚨 집중 관리 대상 (2회 이상 연기 / 연속 연체) */}
        <div 
          onClick={() => setActiveFilterTab('high_risk')}
          className="bg-amber-500/10 p-5 rounded-2xl border border-amber-300 shadow-xs space-y-3 cursor-pointer hover:border-amber-500 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              🚨 집중 관리 대상 (2회+)
            </span>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-full animate-pulse">
              {metrics.highRiskCount}명
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-950 tabular-nums">
              {metrics.highRiskCount} <span className="text-sm font-bold text-amber-800">사건 이탈 위험</span>
            </div>
            <div className="text-xs text-amber-700 font-medium mt-1 flex items-center justify-between">
              <span>약속 2회 미룸 / 2회차 연속 연체</span>
              <span className="font-bold group-hover:underline text-[11px]">모아보기 →</span>
            </div>
          </div>
          <div className="text-[11px] text-amber-800/80 font-medium">
            유선 특별상담 및 분납 일정 재조정 권장
          </div>
        </div>

        {/* KPI 4: 전체 미수 잔금 파이프라인 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">향후 유입 잔여 잔금</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              ₩{metrics.totalReceivable.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1 flex items-center justify-between">
              <span>총 계약: ₩{metrics.totalContractRevenue.toLocaleString()}</span>
              <span className="text-emerald-600 font-bold">수납 잔액</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            총 {settlementList.length}개 수임 사건 진행 중
          </div>
        </div>

      </div>

      {/* ── 3 & 4: 뷰 모드에 따른 렌더링 (캘린더 뷰 vs 목록 뷰) ── */}
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
            const d = new Date(inst.dueDate);
            d.setMonth(d.getMonth() + 1);
            setDeferModalConfig({
              isOpen: true,
              client,
              installment: inst,
              newDueDate: d.toISOString().split('T')[0],
              reason: '의뢰인 급여일 변경 요청',
            });
          }}
          onNavigateToClientCrm={onNavigateToClientCrm}
        />
      ) : (
        <>
          {/* ── 3. 스마트 필터 및 퀵 검색 바 ── */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        
        {/* 상태 탭 필터 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilterTab('all')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeFilterTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            전체 보기 ({settlementList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('high_risk')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeFilterTab === 'high_risk'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span>🚨 집중 관리 대상 (2회+)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFilterTab === 'high_risk' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
            }`}>
              {metrics.highRiskCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('overdue')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeFilterTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span>⚠️ 연체 미납</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFilterTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'
            }`}>
              {metrics.overdueCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('due_today')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeFilterTab === 'due_today'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-orange-700 bg-orange-50 hover:bg-orange-100'
            }`}
          >
            <span>📅 오늘 마감 (D-Day)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeFilterTab === 'due_today' ? 'bg-white/20 text-white' : 'bg-orange-200 text-orange-900'
            }`}>
              {metrics.dueTodayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('upcoming_week')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeFilterTab === 'upcoming_week'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            이번 주 예정 ({metrics.upcomingWeekCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('normal')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeFilterTab === 'normal'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            정상 분납 진행중
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('completed')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeFilterTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            완납 완료
          </button>
        </div>

        {/* 검색 및 사건유형 드롭다운 필터 */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="의뢰인명, 연락처, 사건번호(2026개회...), 법원명 검색"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                지우기
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={caseTypeFilter}
              onChange={e => setCaseTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="all">사건유형 전체</option>
              <option value="rehab">개인회생</option>
              <option value="bankruptcy">개인파산</option>
            </select>
          </div>
        </div>

      </div>

      {/* ── 4. 고객별 분납 정산 마스터 테이블 ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* 테이블 상단 툴바 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-slate-900">
              정산 대상 의뢰인 ({filteredList.length}명)
            </span>
            {selectedClientIds.size > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {selectedClientIds.size}명 선택됨
              </span>
            )}
          </div>

          {/* 일괄 액션 버튼 */}
          {selectedClientIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkAlimtok}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-xs transition-all press-scale cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>선택 {selectedClientIds.size}명 납부 알림톡 발송</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedClientIds(new Set())}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
              >
                선택 해제
              </button>
            </div>
          )}
        </div>

        {/* 테이블 본문 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200/80 whitespace-nowrap">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && selectedClientIds.size === filteredList.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 min-w-[170px]">의뢰인 / 사건 정보</th>
                <th className="py-3.5 px-3 min-w-[130px]">계약일 / 법원접수일</th>
                <th className="py-3.5 px-3 min-w-[110px] text-right">총 수임료</th>
                <th className="py-3.5 px-3 min-w-[120px] text-right">기납부액 (진행률)</th>
                <th className="py-3.5 px-3 min-w-[100px] text-right">미수 잔금</th>
                <th className="py-3.5 px-3 min-w-[95px] text-center">분납 회차</th>
                <th className="py-3.5 px-3 min-w-[85px] text-center">남은 회차</th>
                <th className="py-3.5 px-3 min-w-[130px]">다음 납부일</th>
                <th className="py-3.5 px-3 min-w-[135px] text-center">납부 상태</th>
                <th className="py-3.5 px-4 min-w-[160px] text-center">빠른 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400 space-y-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm text-slate-600">
                      해당 조건의 정산 대상 의뢰인이 없습니다.
                    </div>
                    <p className="text-xs text-slate-400">
                      필터 조건을 변경하거나 신규 분납 일정을 등록해보세요.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map(item => {
                  const isSelected = selectedClientIds.has(item.clientId);
                  const paymentPercent = item.totalFee > 0 ? Math.min(100, Math.round((item.totalPaid / item.totalFee) * 100)) : 0;
                  const isRehab = item.caseType === 'individual_rehab';

                  return (
                    <tr 
                      key={item.clientId}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        item.isHighRiskTarget ? 'bg-amber-50/30' : isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* 1. 체크박스 */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.clientId)}
                          className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* 2. 의뢰인 & 사건 정보 (고객 상세 링크) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onNavigateToClientCrm(item.clientId, 'fees')}
                              className="font-bold text-sm text-slate-900 hover:text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                              title="고객 상세페이지로 이동"
                            >
                              <span>{item.realClientName || item.clientName}</span>
                              {item.clientName !== item.realClientName && (
                                <span className="text-[10px] text-slate-400 font-normal">({item.clientName})</span>
                              )}
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </button>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              isRehab ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {isRehab ? '개인회생' : '개인파산'}
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{item.phone}</span>
                            {item.caseNumber && (
                              <span className="text-slate-400">· {item.courtName ? `${item.courtName} ` : ''}{item.caseNumber}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. 계약일 & 법원 접수일 */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1 text-slate-700">
                            <span className="font-bold text-slate-500">계약:</span>
                            <span>{item.contractDate ? item.contractDate.replace(/-/g, '.') : '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">접수:</span>
                            {item.filingDate ? (
                              <span className="text-emerald-700 font-bold">{item.filingDate.replace(/-/g, '.')}</span>
                            ) : item.caseNumber ? (
                              <span className="text-blue-600 font-medium">접수 완료</span>
                            ) : (
                              <span className="text-slate-400">접수 준비중</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. 총 수임료 */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                        ₩{item.totalFee.toLocaleString()}
                      </td>

                      {/* 5. 기납부액 + 진행률 바 */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="font-bold text-emerald-700">
                            ₩{item.totalPaid.toLocaleString()}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
                            <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden inline-block">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${paymentPercent}%` }}
                              />
                            </div>
                            <span className="font-bold">{paymentPercent}%</span>
                          </div>
                        </div>
                      </td>

                      {/* 6. 미수 잔금 */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-bold">
                        {item.remainingFee === 0 ? (
                          <span className="text-emerald-600 font-extrabold">0원 (완납)</span>
                        ) : (
                          <span className="text-slate-900">₩{item.remainingFee.toLocaleString()}</span>
                        )}
                      </td>

                      {/* 7. 분납 회차 (예: 2/5 회차) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800">
                          {item.completedInstallments} / {item.totalInstallments || 1} 회차
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {item.totalInstallments}개월 분납
                        </div>
                      </td>

                      {/* 8. 남은 회차 */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {item.remainingInstallments === 0 ? (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            완납
                          </span>
                        ) : (
                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">
                            {item.remainingInstallments}회 남음
                          </span>
                        )}
                      </td>

                      {/* 9. 다음 납부일 & D-Day */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.remainingFee === 0 || !item.nextDueDate ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800">
                              {item.nextDueDate.replace(/-/g, '.')}
                            </div>
                            <div className="text-[10px]">
                              {(() => {
                                const due = new Date(item.nextDueDate);
                                due.setHours(0, 0, 0, 0);
                                const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (diff < 0) {
                                  return (
                                    <span className="font-black text-rose-600 animate-pulse">
                                      ⚠️ {Math.abs(diff)}일 연체 중
                                    </span>
                                  );
                                }
                                if (diff === 0) {
                                  return (
                                    <span className="font-black text-orange-600">
                                      오늘 마감 (D-Day)
                                    </span>
                                  );
                                }
                                return (
                                  <span className="font-bold text-blue-600">
                                    D-{diff} ({item.nextDueRound}차 ₩{((item.nextDueAmount || 0) / 10000).toLocaleString()}만)
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 10. 납부 상태 뱃지 (🚨 집중 관리 대상 포함) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {/* 🚨 2회 이상 연기 / 연체 집중 관리 뱃지 */}
                          {item.isHighRiskTarget && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[10px] font-black flex items-center gap-0.5 shadow-xs animate-bounce">
                              <AlertCircle className="w-3 h-3" />
                              집중관리 (2회+미룸)
                            </span>
                          )}

                          {/* 기본 상태 뱃지 */}
                          {item.status === 'completed' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold">
                              완납 완료
                            </span>
                          )}
                          {item.status === 'overdue' && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[11px] font-black border border-rose-200">
                              연체 미납
                            </span>
                          )}
                          {item.status === 'due_today' && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-md text-[11px] font-bold border border-orange-200">
                              당일 마감
                            </span>
                          )}
                          {item.status === 'upcoming' && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium border border-blue-100">
                              납부 예정
                            </span>
                          )}
                          {item.status === 'normal' && !item.isHighRiskTarget && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium">
                              정상 분납
                            </span>
                          )}
                          {item.status === 'no_schedule' && (
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleModalTargetId(item.clientId);
                                setIsScheduleCreateOpen(true);
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold cursor-pointer"
                            >
                              + 일정 생성
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 11. 빠른 액션 버튼들 */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* 1) 고객 상세 페이지 이동 버튼 */}
                          <button
                            type="button"
                            onClick={() => onNavigateToClientCrm(item.clientId, 'fees')}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                            title="고객 CRM 상세 보기"
                          >
                            상세
                          </button>

                          {/* 2) 원클릭 입금 확인 버튼 (미납 분납금이 있을 때) */}
                          {item.remainingFee > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(item)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs cursor-pointer press-scale"
                              title="당회차 입금 확인"
                            >
                              입금확인
                            </button>
                          )}

                          {/* 3) 알림톡 발송 버튼 */}
                          <button
                            type="button"
                            onClick={() => {
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
                                toast.info('발송 가능한 분납 회차 일정이 없습니다.');
                              }
                            }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                            title="납부 안내 알림톡 발송"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* 4) 납부 약속 연기 버튼 */}
                          {item.remainingFee > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetReq = requests.find(r => r.id === item.clientId);
                                const targetInst = item.feeSchedule.find(i => i.status === 'pending' || i.status === 'overdue');
                                if (targetReq && targetInst) {
                                  const d = new Date(targetInst.dueDate);
                                  d.setMonth(d.getMonth() + 1);
                                  setDeferModalConfig({
                                    isOpen: true,
                                    client: targetReq,
                                    installment: targetInst,
                                    newDueDate: d.toISOString().split('T')[0],
                                    reason: '의뢰인 급여일 변경 요청',
                                  });
                                }
                              }}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                              title="납부일 연기/일정 변경"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
          totalFeeManwon={Math.round(alimtokModalConfig.totalFee / 10000)}
          totalPaidManwon={Math.round(alimtokModalConfig.totalPaid / 10000)}
          firmName={activeLawyer.firmName || activeLawyer.firm || '법무법인'}
          lawyerName={activeLawyer.name || '담당 변호사'}
          initialMilestone={alimtokModalConfig.initialMilestone}
          onSent={() => {
            setScheduleRefreshKey(k => k + 1);
          }}
        />
      )}

      {/* ── 8. 납부 약속 연기 모달 (2회 이상 연기 시 집중관리 카운트 반영) ── */}
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
                  대상: {deferModalConfig.installment.round}회차 (₩{(deferModalConfig.installment.amount >= 10000 ? deferModalConfig.installment.amount : deferModalConfig.installment.amount * 10000).toLocaleString()}원)
                </div>
                <div className="text-slate-500">
                  기존 납부일: <span className="font-bold text-slate-700">{deferModalConfig.installment.dueDate}</span>
                </div>
                <div className="text-amber-700 font-bold">
                  현재까지 연기 횟수: {deferModalConfig.installment.rescheduledCount || 0}회
                  {(deferModalConfig.installment.rescheduledCount || 0) >= 1 && (
                    <span className="text-rose-600 block text-[11px] mt-0.5">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">연기 사유</label>
                <input
                  type="text"
                  value={deferModalConfig.reason}
                  onChange={e => setDeferModalConfig(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="예: 급여 지급일 25일로 변경, 병원비 지출로 2주 유예 등"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeferModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeferral}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs"
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
