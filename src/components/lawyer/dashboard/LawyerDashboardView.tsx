import React, { useState, useMemo } from 'react';
import { 
  Users, MessageSquare, Clock, Calendar, AlertTriangle, 
  CheckCircle2, ChevronDown, ChevronUp, ChevronRight, 
  FileText, CreditCard, Scale, Sparkles, Filter, 
  ArrowRight, Shield, Check, Phone, ArrowUpRight
} from 'lucide-react';
import type { ConsultRequest, User, StaffMember, CrmClientExtension } from '../../../types';
import { getDisplayClientName } from '../../../utils/clientDisplay';
import { loadCrmExtMap } from '../../../services/crmService';
import { localYmd, parseLocalYmd } from '../../../utils/localDate';
import { daysUntil, formatYmdWithDow } from '../../../services/court/deadlineCalculator';

export interface PendingProposal {
  id: string;
  reqId: string;
  clientName: string;
  staffId: string;
  staffName: string;
  supervisingLawyerId: string;
  createdAt: string;
  memo?: string;
  [key: string]: any;
}

export interface LawyerDashboardViewProps {
  activeLawyer: User;
  activeStaff: StaffMember | null;
  isLawyerOrOwner: boolean;
  requests: ConsultRequest[];
  pendingProposals: PendingProposal[];
  staffMembers: StaffMember[];
  onNavigateTab: (tabId: string, params?: any) => void;
  onOpenProposalReview: (proposal: PendingProposal) => void;
  onOpenCase: (caseId: string, options?: { stage?: number; section?: string }) => void;
  onOpenChat: (client: ConsultRequest) => void;
  onNewCase: () => void;
}

interface ActionQueueItem {
  id: string;
  type: 'correction' | 'fee_overdue' | 'new_lead' | 'chat_unread' | 'doc_review' | 'proposal_confirm' | 'sign_delayed' | 'court_date';
  title: string;
  clientName: string;
  caseId: string;
  stage?: number;
  stageName?: string;
  timeOrDday: string;
  isOverdue: boolean;
  isToday: boolean;
  isThisWeek: boolean;
  actionLabel: string;
  onAction: () => void;
}

interface ScheduleItem {
  id: string;
  dateStr: string;
  timeStr?: string;
  title: string;
  clientName: string;
  caseId: string;
  type: 'hearing' | 'correction' | 'consult' | 'other';
}

export const LawyerDashboardView: React.FC<LawyerDashboardViewProps> = ({
  activeLawyer,
  activeStaff,
  isLawyerOrOwner,
  requests,
  pendingProposals,
  staffMembers,
  onNavigateTab,
  onOpenProposalReview,
  onOpenCase,
  onOpenChat,
  onNewCase,
}) => {
  // 범위 토글: 내 담당 vs 사무소 전체
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  // 업무함 그룹 접힘 상태
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [weekOpen, setWeekOpen] = useState(true);
  // 사무소 현황 아코디언 (기본 접힘)
  const [officeStatsOpen, setOfficeStatsOpen] = useState(false);

  const todayStr = useMemo(() => localYmd(), []);
  
  // 오늘 날짜 및 요일 헤더 표시 (예: "10월 2일 (금)")
  const todayFormatted = useMemo(() => {
    const d = parseLocalYmd(todayStr);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const dows = ['일', '월', '화', '수', '목', '금', '토'];
    const dow = dows[d.getDay()];
    return `${month}월 ${date}일 (${dow})`;
  }, [todayStr]);

  // CRM 데이터 매핑 로드
  const crmStore = useMemo(() => {
    return loadCrmExtMap();
  }, [requests]);

  const currentUserId = activeStaff?.id || activeLawyer.id;

  // 대상 의뢰인 목록 필터링 (scope 기준)
  const targetRequests = useMemo(() => {
    if (scope === 'all') return requests;
    return requests.filter(r => {
      const ext = crmStore[r.id];
      const assigned = ext?.assigneeId || ext?.assignedLawyerId || ext?.assignedConsultantId || ext?.assignedStaffId;
      if (assigned) return assigned === currentUserId;
      // 미배정인 경우 본인이 대표이거나 직속 배정인 경우
      return r.assignedLawyerId === currentUserId || r.selectedLawyerIds?.includes(currentUserId);
    });
  }, [requests, crmStore, scope, currentUserId]);

  // 1. 핵심 수치 4종 계산
  // (1) 새 상담 요청 건수
  const newLeadsCount = useMemo(() => {
    return targetRequests.filter(r => {
      const ext = crmStore[r.id];
      const status = ext?.crmStatus || 'requested';
      return status === 'requested' || r.status === 'pending';
    }).length;
  }, [targetRequests, crmStore]);

  // (2) 답변 필요 채팅
  const unreadChatCount = useMemo(() => {
    // 의뢰인이 마지막으로 메시지를 남겼거나 미확인된 채팅 수
    return targetRequests.filter(r => {
      return (r.unreadCount && r.unreadCount > 0) || r.status === 'in_progress';
    }).length;
  }, [targetRequests]);

  // (3) 7일 내 기한 임박 (보정명령, 법원 기일 등)
  const upcomingDeadlinesCount = useMemo(() => {
    let count = 0;
    targetRequests.forEach(r => {
      const ext = crmStore[r.id];
      if (!ext) return;
      if (ext.correctionOrders) {
        ext.correctionOrders.forEach(co => {
          if (co.status === 'pending' && co.deadline) {
            const diff = daysUntil(co.deadline, todayStr);
            if (diff >= 0 && diff <= 7) count++;
          }
        });
      }
      if (ext.courtCase?.events) {
        ext.courtCase.events.forEach(ev => {
          if (ev.date) {
            const diff = daysUntil(ev.date, todayStr);
            if (diff >= 0 && diff <= 7) count++;
          }
        });
      }
    });
    return count;
  }, [targetRequests, crmStore, todayStr]);

  // (4) 연체 수납 금액 & 건수
  const overdueFeeStats = useMemo(() => {
    let totalWon = 0;
    let count = 0;
    targetRequests.forEach(r => {
      const ext = crmStore[r.id];
      if (!ext?.feeSchedule) return;
      ext.feeSchedule.forEach(f => {
        if (f.status === 'overdue' || (f.status === 'pending' && f.dueDate && f.dueDate < todayStr)) {
          totalWon += (f.amount || 0);
          count++;
        }
      });
    });
    return { totalWon, count };
  }, [targetRequests, crmStore, todayStr]);

  // 2. 통합 업무함(Action Queue) 아이템 생성
  const actionItems = useMemo(() => {
    const list: ActionQueueItem[] = [];

    targetRequests.forEach(r => {
      const ext = crmStore[r.id];
      const cName = getDisplayClientName(r);

      // A. 보정서 제출 기한
      if (ext?.correctionOrders) {
        ext.correctionOrders.forEach(co => {
          if (co.status === 'pending' && co.deadline) {
            const diff = daysUntil(co.deadline, todayStr);
            list.push({
              id: `corr-${r.id}-${co.orderNumber}`,
              type: 'correction',
              title: `${co.orderNumber || 1}차 보정서 제출`,
              clientName: cName,
              caseId: r.id,
              stage: 5,
              stageName: '5단계 보정·개시',
              timeOrDday: diff < 0 ? `D+${Math.abs(diff)}` : diff === 0 ? 'D-Day' : `D-${diff}`,
              isOverdue: diff < 0,
              isToday: diff === 0,
              isThisWeek: diff > 0 && diff <= 7,
              actionLabel: '보정 열기',
              onAction: () => onOpenCase(r.id, { stage: 5, section: 'corrections' }),
            });
          }
        });
      }

      // B. 착수금/분납금 미납
      if (ext?.feeSchedule) {
        ext.feeSchedule.forEach((f, idx) => {
          if (f.status === 'overdue' || (f.status === 'pending' && f.dueDate && f.dueDate < todayStr)) {
            const diff = f.dueDate ? daysUntil(f.dueDate, todayStr) : -1;
            list.push({
              id: `fee-${r.id}-${idx}`,
              type: 'fee_overdue',
              title: `${f.round || idx + 1}회차 분납금 미납 (${(f.amount || 0).toLocaleString()}원)`,
              clientName: cName,
              caseId: r.id,
              stage: 2,
              stageName: '2단계 계약·수납',
              timeOrDday: diff < 0 ? `D+${Math.abs(diff)}` : 'D-Day',
              isOverdue: diff < 0,
              isToday: diff === 0,
              isThisWeek: false,
              actionLabel: '수납 열기',
              onAction: () => onOpenCase(r.id, { stage: 2, section: 'retainer' }),
            });
          }
        });
      }

      // C. 신규 상담 요청 응답 대기
      if (r.status === 'pending' || ext?.crmStatus === 'requested') {
        const createdDate = r.createdAt ? r.createdAt.slice(0, 10) : todayStr;
        const diff = daysUntil(createdDate, todayStr);
        list.push({
          id: `newlead-${r.id}`,
          type: 'new_lead',
          title: '신규 상담 요청 검토 및 제안서 작성',
          clientName: cName,
          caseId: r.id,
          stage: 1,
          stageName: '1단계 상담·제안',
          timeOrDday: diff === 0 ? '오늘 접수' : `${Math.abs(diff)}일 전`,
          isOverdue: Math.abs(diff) >= 2,
          isToday: diff === 0 || Math.abs(diff) === 1,
          isThisWeek: Math.abs(diff) > 1 && Math.abs(diff) <= 7,
          actionLabel: '제안서 작성',
          onAction: () => onOpenCase(r.id, { stage: 1, section: 'proposal' }),
        });
      }

      // D. 서류 검토 대기 (3단계)
      if (ext?.crmStatus === 'document') {
        const uncheckedDocs = ext.documents?.filter(d => !d.checked) || [];
        if (uncheckedDocs.length > 0) {
          list.push({
            id: `doc-${r.id}`,
            type: 'doc_review',
            title: `제출 서류 검토 (${uncheckedDocs.length}종 대기)`,
            clientName: cName,
            caseId: r.id,
            stage: 3,
            stageName: '3단계 서류 준비',
            timeOrDday: '검토 대기',
            isOverdue: false,
            isToday: true,
            isThisWeek: false,
            actionLabel: '서류 검토',
            onAction: () => onOpenCase(r.id, { stage: 3, section: 'registry' }),
          });
        }
      }
    });

    // E. 제안서 컨펌 요청 (대표 변호사 / 담당 변호사용)
    if (isLawyerOrOwner && pendingProposals.length > 0) {
      pendingProposals.forEach(p => {
        if (scope === 'mine' && p.supervisingLawyerId !== activeLawyer.id) return;
        list.push({
          id: `proposal-confirm-${p.id}`,
          type: 'proposal_confirm',
          title: `제안서 컨펌 승인 요청 (${p.staffName} 작성)`,
          clientName: p.clientName,
          caseId: p.reqId,
          stage: 1,
          stageName: '1단계 제안서 승인',
          timeOrDday: '결재 대기',
          isOverdue: false,
          isToday: true,
          isThisWeek: false,
          actionLabel: '검토 승인',
          onAction: () => onOpenProposalReview(p),
        });
      });
    }

    return list;
  }, [targetRequests, crmStore, todayStr, isLawyerOrOwner, pendingProposals, scope, activeLawyer, onOpenCase, onOpenProposalReview]);

  // 업무함 그룹 분류
  const overdueItems = useMemo(() => actionItems.filter(i => i.isOverdue), [actionItems]);
  const todayItems = useMemo(() => actionItems.filter(i => i.isToday && !i.isOverdue), [actionItems]);
  const thisWeekItems = useMemo(() => actionItems.filter(i => i.isThisWeek && !i.isOverdue && !i.isToday), [actionItems]);

  const totalTasksCount = actionItems.length;

  // 3. 이번 주 일정 위젯 아이템
  const weeklySchedules = useMemo(() => {
    const list: ScheduleItem[] = [];
    targetRequests.forEach(r => {
      const ext = crmStore[r.id];
      const cName = getDisplayClientName(r);
      if (ext?.courtCase?.events) {
        ext.courtCase.events.forEach(ev => {
          if (ev.date) {
            const diff = daysUntil(ev.date, todayStr);
            if (diff >= 0 && diff <= 7) {
              list.push({
                id: `ev-${r.id}-${ev.id || ev.date}`,
                dateStr: ev.date,
                timeStr: ev.time || '기일',
                title: ev.title || (ev.type === 'hearing' ? '채권자집회' : '법원 기일'),
                clientName: cName,
                caseId: r.id,
                type: ev.type === 'hearing' ? 'hearing' : 'other',
              });
            }
          }
        });
      }
      if (ext?.correctionOrders) {
        ext.correctionOrders.forEach(co => {
          if (co.status === 'pending' && co.deadline) {
            const diff = daysUntil(co.deadline, todayStr);
            if (diff >= 0 && diff <= 7) {
              list.push({
                id: `co-${r.id}-${co.orderNumber}`,
                dateStr: co.deadline,
                title: `보정 기한 (${co.orderNumber || 1}차)`,
                clientName: cName,
                caseId: r.id,
                type: 'correction',
              });
            }
          }
        });
      }
    });

    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [targetRequests, crmStore, todayStr]);

  // 4. 사무소 현황 집계 데이터 (단일화된 지표 산식)
  const officeMetrics = useMemo(() => {
    const reqs = scope === 'all' ? requests : targetRequests;
    const total = reqs.length;

    // 단계별 분포 (1~6단계)
    const stageCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let proposalSentCount = 0;
    let contractedCount = 0;
    let commencedCount = 0;
    let totalContractFee = 0;
    let totalCollectedFee = 0;

    const channelCounts: Record<string, number> = {};

    reqs.forEach(r => {
      const ext = crmStore[r.id];
      const status = ext?.crmStatus || 'requested';

      // 채널 집계
      const ch = ext?.intakeChannel || 'mykim';
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;

      // 단계 집계
      if (['requested', 'consulting'].includes(status)) stageCounts[1]++;
      else if (status === 'contracted') stageCounts[2]++;
      else if (status === 'document') stageCounts[3]++;
      else if (status === 'filed') stageCounts[4]++;
      else if (status === 'commenced') stageCounts[5]++;
      else if (['repaying', 'discharged'].includes(status)) stageCounts[6]++;

      if (r.proposals && r.proposals.length > 0) proposalSentCount++;
      if (['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'].includes(status)) {
        contractedCount++;
      }
      if (['commenced', 'repaying', 'discharged'].includes(status)) {
        commencedCount++;
      }

      // 수납 집계
      if (ext?.feeSchedule) {
        ext.feeSchedule.forEach(f => {
          totalContractFee += (f.amount || 0);
          if (f.status === 'paid') totalCollectedFee += (f.amount || 0);
        });
      }
    });

    // 단일 정의 전환율: 계약 체결 건수 ÷ 제안서 발송 건수
    const conversionRate = proposalSentCount > 0 ? Math.round((contractedCount / proposalSentCount) * 100) : 0;
    const collectionRate = totalContractFee > 0 ? Math.round((totalCollectedFee / totalContractFee) * 100) : 0;

    return {
      total,
      stageCounts,
      proposalSentCount,
      contractedCount,
      commencedCount,
      conversionRate,
      totalContractFee,
      totalCollectedFee,
      collectionRate,
      channelCounts,
    };
  }, [requests, targetRequests, crmStore, scope]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── 1. 헤더: 오늘 날짜 + 오늘 처리할 일 건수 + [내 담당 ▾ / 사무소 전체] 토글 ── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
            <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>[{todayFormatted}]</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>오늘 처리할 일</span>
            <span className="text-[#1E3A5F] underline decoration-blue-200 underline-offset-4">{totalTasksCount}건</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
            기한 지남, 오늘 마감, 새 상담 요청 등 주요 액션을 한곳에서 즉시 처리합니다.
          </p>
        </div>

        {/* 범위 선택 드롭다운 + 신규 사건 등록 주 버튼 */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={scope}
              onChange={e => setScope(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs md:text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
            >
              <option value="mine">내 담당 사건</option>
              <option value="all">사무소 전체 사건</option>
            </select>
          </div>

          <button
            onClick={onNewCase}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-[#1E3A5F] hover:bg-[#152a45] text-white shadow-sm transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
          >
            <span>사건 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 핵심 수치 4종 (누르면 필터된 큐/화면으로 이동) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 새 상담 요청 */}
        <button
          onClick={() => onNavigateTab('requests')}
          className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">새 상담 요청</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {newLeadsCount}<span className="text-sm font-medium text-slate-500 ml-1">건</span>
          </div>
          <div className="text-xs text-blue-600 font-bold mt-1.5 flex items-center gap-1">
            <span>미응답 리드 바로가기</span>
          </div>
        </button>

        {/* 답변 필요 채팅 */}
        <button
          onClick={() => onNavigateTab('chat')}
          className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">답변 필요 채팅</span>
            <MessageSquare className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {unreadChatCount}<span className="text-sm font-medium text-slate-500 ml-1">건</span>
          </div>
          <div className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center gap-1">
            <span>상담 채팅방 바로가기</span>
          </div>
        </button>

        {/* 7일 내 기한 */}
        <button
          onClick={() => onNavigateTab('tasks-schedule')}
          className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">7일 내 기한</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-600 mt-2 tracking-tight">
            {upcomingDeadlinesCount}<span className="text-sm font-medium text-slate-500 ml-1">건</span>
          </div>
          <div className="text-xs text-amber-700 font-bold mt-1.5 flex items-center gap-1">
            <span>일정·기한 타임라인</span>
          </div>
        </button>

        {/* 연체 수납 */}
        <button
          onClick={() => onNavigateTab('fee-settlement')}
          className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">연체 수납</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl md:text-2xl font-black text-rose-600 mt-2 tracking-tight truncate" title={`${overdueFeeStats.totalWon.toLocaleString()}원`}>
            ₩{overdueFeeStats.totalWon >= 10000 ? `${Math.floor(overdueFeeStats.totalWon / 10000).toLocaleString()}만` : overdueFeeStats.totalWon.toLocaleString()}
          </div>
          <div className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
            <span>{overdueFeeStats.count}건 연체 관리</span>
          </div>
        </button>
      </div>

      {/* ── 3. 2열 메인 레이아웃: [오늘 처리할 일 통합 업무함] + [이번 주 일정 & 컨펌 요청] ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측 (2열 폭): 통합 업무함 (Action Queue) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>오늘 처리할 일</span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {actionItems.length}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">모든 항목은 해당 단계·화면으로 직결됩니다</span>
            </div>

            <div className="divide-y divide-slate-100">
              {/* 그룹 1: ▾ 기한 지남 */}
              {overdueItems.length > 0 && (
                <div>
                  <button
                    onClick={() => setOverdueOpen(!overdueOpen)}
                    className="w-full px-4 py-2.5 bg-rose-50/60 hover:bg-rose-50 flex items-center justify-between text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-700">기한 지남</span>
                      <span className="bg-rose-500 text-white text-xs font-black px-1.5 py-0.2 rounded-full">
                        {overdueItems.length}
                      </span>
                    </div>
                    {overdueOpen ? <ChevronUp className="w-4 h-4 text-rose-600" /> : <ChevronDown className="w-4 h-4 text-rose-600" />}
                  </button>

                  {overdueOpen && (
                    <div className="divide-y divide-slate-100 bg-white">
                      {overdueItems.map(item => (
                        <div key={item.id} className="p-3.5 md:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{item.clientName}</span>
                              {item.stageName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                  {item.stageName}
                                </span>
                              )}
                              <span className="text-xs font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
                                {item.timeOrDday}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1 truncate">{item.title}</p>
                          </div>
                          <button
                            onClick={item.onAction}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 그룹 2: ▾ 오늘 */}
              <div>
                <button
                  onClick={() => setTodayOpen(!todayOpen)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">오늘 ({todayItems.length})</span>
                  </div>
                  {todayOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {todayOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {todayItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">오늘 예정된 급한 업무가 없습니다.</div>
                    ) : (
                      todayItems.map(item => (
                        <div key={item.id} className="p-3.5 md:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{item.clientName}</span>
                              {item.stageName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                  {item.stageName}
                                </span>
                              )}
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                {item.timeOrDday}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1 truncate">{item.title}</p>
                          </div>
                          <button
                            onClick={item.onAction}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#152a45] text-white shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 그룹 3: ▸ 이번 주 */}
              <div>
                <button
                  onClick={() => setWeekOpen(!weekOpen)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700">이번 주 ({thisWeekItems.length})</span>
                  </div>
                  {weekOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {weekOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {thisWeekItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">이번 주 남은 추가 기한 업무가 없습니다.</div>
                    ) : (
                      thisWeekItems.map(item => (
                        <div key={item.id} className="p-3.5 md:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{item.clientName}</span>
                              {item.stageName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                  {item.stageName}
                                </span>
                              )}
                              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                {item.timeOrDday}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1 truncate">{item.title}</p>
                          </div>
                          <button
                            onClick={item.onAction}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 (1열 폭): 이번 주 일정 & 제안서 컨펌 요청 */}
        <div className="space-y-4">
          {/* 제안서 컨펌 요청 (대표 변호사용 위젯) */}
          {isLawyerOrOwner && pendingProposals.length > 0 && (
            <div className="bg-amber-50/80 rounded-2xl border border-amber-200/90 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-black text-sm text-amber-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>제안서 컨펌 요청</span>
                  <span className="bg-amber-500 text-white text-xs font-black px-1.5 py-0.2 rounded-full">
                    {pendingProposals.length}
                  </span>
                </h4>
              </div>
              <div className="space-y-2">
                {pendingProposals.slice(0, 3).map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 truncate">{p.clientName}</p>
                      <p className="text-xs text-slate-500">{p.staffName} 작성</p>
                    </div>
                    <button
                      onClick={() => onOpenProposalReview(p)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer active:scale-[0.98] shrink-0"
                    >
                      검토
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이번 주 일정 위젯 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#1E3A5F]" />
                <span>이번 주 일정</span>
                <span className="text-xs bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded-md">
                  {weeklySchedules.length}
                </span>
              </h4>
              <button
                onClick={() => onNavigateTab('tasks-schedule')}
                className="text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                전체 보기 →
              </button>
            </div>

            {weeklySchedules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                이번 주 예정된 기일이나 집회가 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5">
                {weeklySchedules.slice(0, 5).map(item => (
                  <div
                    key={item.id}
                    onClick={() => onOpenCase(item.caseId)}
                    className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {item.dateStr.slice(5)} {item.timeStr || ''}
                      </span>
                      <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600">
                        {item.clientName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. 하단 사무소 현황 (기본 접힘/아코디언) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setOfficeStatsOpen(!officeStatsOpen)}
          className="w-full p-4 md:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#1E3A5F]" />
            <span className="font-extrabold text-sm md:text-base text-slate-900">
              사무소 현황 브리핑 ({scope === 'all' ? '전체' : '내 담당'})
            </span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              · 단계별 사건 분포, 수임 전환 퍼널, 수납 현황, 유입 채널
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>{officeStatsOpen ? '접기' : '자세히 보기'}</span>
            {officeStatsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {officeStatsOpen && (
          <div className="p-5 md:p-6 border-t border-slate-100 space-y-6 bg-slate-50/40">
            {/* 1) 단계별 사건 분포 (1~6단계 바) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-700">단계별 사건 분포</span>
                <span className="text-xs font-bold text-slate-500">총 {officeMetrics.total}건</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { stage: 1, label: '1단계 상담·제안', count: officeMetrics.stageCounts[1], color: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { stage: 2, label: '2단계 수임 계약', count: officeMetrics.stageCounts[2], color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                  { stage: 3, label: '3단계 서류 준비', count: officeMetrics.stageCounts[3], color: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { stage: 4, label: '4단계 신청·접수', count: officeMetrics.stageCounts[4], color: 'text-purple-700 bg-purple-50 border-purple-200' },
                  { stage: 5, label: '5단계 보정·개시', count: officeMetrics.stageCounts[5], color: 'text-rose-700 bg-rose-50 border-rose-200' },
                  { stage: 6, label: '6단계 변제·면책', count: officeMetrics.stageCounts[6], color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                ].map(s => (
                  <div key={s.stage} className={`p-3 rounded-xl border ${s.color} text-center`}>
                    <div className="text-lg font-black">{s.count}</div>
                    <div className="text-xs font-bold mt-0.5 truncate">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2) 수임 전환 퍼널 & 수납 현황 (2열) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 수임 전환 퍼널 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-800">수임 전환 퍼널</span>
                  <span className="text-xs font-black text-blue-700">전환율 {officeMetrics.conversionRate}%</span>
                </div>
                <div className="space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>1. 상담 접수</span>
                    <span className="font-bold text-slate-900">{officeMetrics.total}건</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-300 h-1.5 rounded-full" style={{ width: '100%' }} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span>2. 맞춤 제안서 발송</span>
                    <span className="font-bold text-slate-900">{officeMetrics.proposalSentCount}건</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${officeMetrics.total > 0 ? (officeMetrics.proposalSentCount / officeMetrics.total) * 100 : 0}%` }} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span>3. 정식 수임 계약 체결</span>
                    <span className="font-bold text-blue-700">{officeMetrics.contractedCount}건</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-[#1E3A5F] h-1.5 rounded-full" style={{ width: `${officeMetrics.total > 0 ? (officeMetrics.contractedCount / officeMetrics.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* 수납 현황 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-800">수임료 수납 현황</span>
                  <span className="text-xs font-black text-emerald-700">수납률 {officeMetrics.collectionRate}%</span>
                </div>
                <div className="space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>약정 총액</span>
                    <span className="font-bold text-slate-900">{officeMetrics.totalContractFee.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>수납 완료</span>
                    <span className="font-bold text-emerald-600">{officeMetrics.totalCollectedFee.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>미수납/연체 잔액</span>
                    <span className="font-bold text-rose-600">
                      {Math.max(0, officeMetrics.totalContractFee - officeMetrics.totalCollectedFee).toLocaleString()}원
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${officeMetrics.collectionRate}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
