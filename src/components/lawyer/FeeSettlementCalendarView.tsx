import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, 
  AlertTriangle, Clock, AlertCircle, Sparkles, MessageCircle, 
  ExternalLink, CalendarClock, DollarSign, Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, FeeInstallment, FeeSettlementSummary, AlimtokMilestone 
} from '../../types';

interface CalendarDayItem {
  clientSummary: FeeSettlementSummary;
  installment: FeeInstallment;
  amountWon: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isPaid: boolean;
}

interface Props {
  settlementList: FeeSettlementSummary[];
  requests: ConsultRequest[];
  todayStr: string;
  onMarkAsPaid: (item: FeeSettlementSummary, inst: FeeInstallment) => void;
  onOpenAlimtok: (client: ConsultRequest, inst: FeeInstallment, totalFee: number, totalPaid: number) => void;
  onOpenDeferModal: (client: ConsultRequest, inst: FeeInstallment) => void;
  onNavigateToClientCrm: (clientId: string, targetDetailTab?: 'info' | 'fees' | 'court' | 'documents') => void;
}

type CalViewMode = 'month' | 'week';
type StatusFilter = 'all' | 'overdue_only' | 'due_today_only' | 'pending_only' | 'paid_only';

const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

const KOREAN_HOLIDAYS: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
  '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
  '10-09': '한글날', '12-25': '성탄절',
  '02-16': '설날 전날', '02-17': '설날', '02-18': '설날 다음날',
  '05-24': '부처님오신날',
  '09-24': '추석 전날', '09-25': '추석', '09-26': '추석 다음날',
};

function getHoliday(month: number, day: number): string | null {
  const key = String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  return KOREAN_HOLIDAYS[key] || null;
}

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function FeeSettlementCalendarView({
  settlementList,
  requests,
  todayStr,
  onMarkAsPaid,
  onOpenAlimtok,
  onOpenDeferModal,
  onNavigateToClientCrm,
}: Props) {
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [calView, setCalView] = useState<CalViewMode>('month');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(todayStr);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 주별 보기 시작일
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const calYear = calMonth.getFullYear();
  const calMon = calMonth.getMonth(); // 0 ~ 11

  const firstDow = new Date(calYear, calMon, 1).getDay();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();

  // 주별 보기 7일 배열
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // 날짜별 분납 항목 맵 구성 (`YYYY-MM-DD` -> CalendarDayItem[])
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarDayItem[]> = {};

    settlementList.forEach(summary => {
      summary.feeSchedule.forEach(inst => {
        if (!inst.dueDate) return;
        const dateKey = inst.dueDate;
        if (!map[dateKey]) {
          map[dateKey] = [];
        }

        const amountWon = inst.amount >= 10000 ? inst.amount : inst.amount * 10000;
        const isPaid = inst.status === 'paid';
        const isDueToday = !isPaid && dateKey === todayStr;
        const isOverdue = !isPaid && (inst.status === 'overdue' || dateKey < todayStr);

        // 필터링 적용
        if (statusFilter === 'overdue_only' && !isOverdue) return;
        if (statusFilter === 'due_today_only' && !isDueToday) return;
        if (statusFilter === 'pending_only' && (isPaid || isOverdue)) return;
        if (statusFilter === 'paid_only' && !isPaid) return;

        map[dateKey].push({
          clientSummary: summary,
          installment: inst,
          amountWon,
          isOverdue,
          isDueToday,
          isPaid,
        });
      });
    });

    return map;
  }, [settlementList, todayStr, statusFilter]);

  // 현재 선택된 날짜의 아이템 목록
  const selectedDayItems = useMemo(() => {
    if (!selectedDateKey) return [];
    return itemsByDate[selectedDateKey] || [];
  }, [selectedDateKey, itemsByDate]);

  // 선택된 날짜 통계
  const selectedDayStats = useMemo(() => {
    const totalAmount = selectedDayItems.reduce((s, i) => s + i.amountWon, 0);
    const paidAmount = selectedDayItems.filter(i => i.isPaid).reduce((s, i) => s + i.amountWon, 0);
    const pendingAmount = totalAmount - paidAmount;
    return { totalAmount, paidAmount, pendingAmount, count: selectedDayItems.length };
  }, [selectedDayItems]);

  // 당월 통계
  const monthStats = useMemo(() => {
    const currentYM = `${calYear}-${String(calMon + 1).padStart(2, '0')}`;
    let targetAmount = 0;
    let collectedAmount = 0;
    let overdueCount = 0;

    Object.entries(itemsByDate).forEach(([dateKey, items]) => {
      if (dateKey.startsWith(currentYM)) {
        items.forEach(item => {
          targetAmount += item.amountWon;
          if (item.isPaid) collectedAmount += item.amountWon;
          if (item.isOverdue) overdueCount++;
        });
      }
    });

    const rate = targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 100) : 0;
    return { targetAmount, collectedAmount, rate, overdueCount };
  }, [itemsByDate, calYear, calMon]);

  return (
    <div className="space-y-6 text-slate-800">

      {/* ── 1. 캘린더 상단 툴바 & 당월 요약 바 ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* 네비게이션 헤더 */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (calView === 'month') {
                  setCalMonth(new Date(calYear, calMon - 1));
                } else {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
                }
              }}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-95"
              title="이전"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-lg sm:text-xl font-black text-white min-w-[160px] text-center tracking-tight">
              {calView === 'month' ? (
                `${calYear}년 ${calMon + 1}월`
              ) : (
                `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekDays[6].getMonth() + 1}월 ${weekDays[6].getDate()}일`
              )}
            </h2>

            <button
              type="button"
              onClick={() => {
                if (calView === 'month') {
                  setCalMonth(new Date(calYear, calMon + 1));
                } else {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }
              }}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-95"
              title="다음"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCalMonth(now);
                const ws = new Date(now);
                ws.setDate(ws.getDate() - ws.getDay());
                ws.setHours(0, 0, 0, 0);
                setWeekStart(ws);
                setSelectedDateKey(todayStr);
              }}
              className="ml-2 text-xs font-bold text-white/80 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              오늘
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-xl border border-white/20 outline-hidden cursor-pointer"
            >
              <option value="all" className="text-slate-900">전체 일정</option>
              <option value="overdue_only" className="text-slate-900">⚠️ 연체 미납만</option>
              <option value="due_today_only" className="text-slate-900">📅 오늘 마감만</option>
              <option value="pending_only" className="text-slate-900">납부 예정만</option>
              <option value="paid_only" className="text-slate-900">수납 완료만</option>
            </select>

            {/* 월/주 토글 */}
            <div className="flex bg-white/10 rounded-xl p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setCalView('month')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  calView === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/70 hover:text-white'
                }`}
              >
                월
              </button>
              <button
                type="button"
                onClick={() => setCalView('week')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  calView === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/70 hover:text-white'
                }`}
              >
                주
              </button>
            </div>
          </div>
        </div>

        {/* 당월 수납 요약 미니 바 */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-500">
              {calMon + 1}월 입금 목표: <strong className="text-slate-900">₩{monthStats.targetAmount.toLocaleString()}</strong>
            </span>
            <span className="w-px h-3 bg-slate-300 hidden sm:inline-block" />
            <span className="font-bold text-emerald-700">
              수납 완료: <strong>₩{monthStats.collectedAmount.toLocaleString()}</strong> ({monthStats.rate}%)
            </span>
            {monthStats.overdueCount > 0 && (
              <>
                <span className="w-px h-3 bg-slate-300 hidden sm:inline-block" />
                <span className="font-bold text-rose-600 animate-pulse">
                  ⚠️ 미납 연체: {monthStats.overdueCount}건
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> 완납
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> 당일마감
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> 연체
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> 예정
            </span>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
          {DAY_HEADERS.map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-2.5 text-center text-xs font-extrabold ${
                idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* ── 2. 월별 그리드 뷰 ── */}
        {calView === 'month' && (
          <div className="grid grid-cols-7 bg-white">
            {/* 첫 주 시작 전 빈 셀 */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={'empty-' + i} className="min-h-[110px] border-b border-r border-slate-100 bg-slate-50/40" />
            ))}

            {/* 일자 셀 루프 */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dow = (firstDow + i) % 7;
              const dateKey = toDateKey(calYear, calMon, day);
              const isToday = dateKey === todayStr;
              const holiday = getHoliday(calMon, day);
              const isHoliday = dow === 0 || !!holiday;
              const items = itemsByDate[dateKey] || [];
              const isSelected = selectedDateKey === dateKey;

              const dayTotal = items.reduce((sum, item) => sum + item.amountWon, 0);
              const hasOverdue = items.some(item => item.isOverdue);
              const hasDueToday = items.some(item => item.isDueToday);

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDateKey(isSelected ? null : dateKey)}
                  className={`min-h-[110px] p-2 border-b border-r border-slate-100 text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                    isSelected ? 'bg-blue-50/50 ring-2 ring-blue-500 ring-inset z-10' : 'hover:bg-slate-50/80'
                  } ${isToday ? 'bg-blue-50/20' : ''}`}
                >
                  <div>
                    {/* 상단 날짜 및 요약 */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        {isToday ? (
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            {day}
                          </span>
                        ) : (
                          <span className={`text-xs font-bold pl-0.5 ${
                            isHoliday ? 'text-rose-600' : dow === 6 ? 'text-blue-600' : 'text-slate-800'
                          }`}>
                            {day}
                          </span>
                        )}
                        {holiday && (
                          <span className="text-[9px] font-bold text-rose-400 truncate max-w-[50px]">{holiday}</span>
                        )}
                      </div>

                      {/* 날짜별 총 예정액 칩 */}
                      {items.length > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                          hasOverdue 
                            ? 'bg-rose-100 text-rose-700 animate-pulse' 
                            : hasDueToday 
                            ? 'bg-amber-100 text-amber-900' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          ₩{(dayTotal / 10000).toLocaleString()}만
                        </span>
                      )}
                    </div>

                    {/* 고객별 분납 뱃지 (최대 2개 노출) */}
                    <div className="space-y-1">
                      {items.slice(0, 2).map((it, idx) => {
                        const name = it.clientSummary.realClientName || it.clientSummary.clientName;
                        return (
                          <div
                            key={idx}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate flex items-center justify-between ${
                              it.isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : it.isOverdue
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : it.isDueToday
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 font-black'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}
                          >
                            <span className="truncate">
                              {it.clientSummary.isHighRiskTarget && '🚨 '}
                              {name}
                            </span>
                            <span className="shrink-0 text-[9px] opacity-80">
                              {(it.amountWon / 10000).toLocaleString()}만
                            </span>
                          </div>
                        );
                      })}

                      {items.length > 2 && (
                        <div className="text-[10px] font-bold text-slate-400 pl-1">
                          +{items.length - 2}건 더보기
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 하단 점 표시 */}
                  {items.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      {items.some(i => i.isOverdue) && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      {items.some(i => i.isDueToday) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {items.some(i => i.isPaid) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      <span className="text-[9px] text-slate-400 font-bold ml-auto">{items.length}건</span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* 마지막 주 남은 빈 셀 */}
            {(() => {
              const lastDow = (firstDow + daysInMonth - 1) % 7;
              return Array.from({ length: lastDow < 6 ? 6 - lastDow : 0 }).map((_, i) => (
                <div key={'trail-' + i} className="min-h-[110px] border-b border-r border-slate-100 bg-slate-50/40" />
              ));
            })()}
          </div>
        )}

        {/* ── 3. 주별 그리드 뷰 ── */}
        {calView === 'week' && (
          <div className="grid grid-cols-7 bg-white">
            {weekDays.map((wd, i) => {
              const dateKey = toDateKey(wd.getFullYear(), wd.getMonth(), wd.getDate());
              const isToday = dateKey === todayStr;
              const holiday = getHoliday(wd.getMonth(), wd.getDate());
              const isHoliday = i === 0 || !!holiday;
              const items = itemsByDate[dateKey] || [];
              const isSelected = selectedDateKey === dateKey;
              const dayTotal = items.reduce((sum, item) => sum + item.amountWon, 0);

              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedDateKey(isSelected ? null : dateKey)}
                  className={`min-h-[220px] p-2.5 border-r border-slate-100 last:border-r-0 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected ? 'bg-blue-50/50 ring-2 ring-blue-500 ring-inset' : 'hover:bg-slate-50'
                  } ${isToday ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-col items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                        isToday ? 'bg-blue-600 text-white shadow-xs' : isHoliday ? 'text-rose-600' : i === 6 ? 'text-blue-600' : 'text-slate-800'
                      }`}>
                        {wd.getDate()}
                      </span>
                      {holiday && <span className="text-[9px] font-bold text-rose-400 mt-0.5">{holiday}</span>}
                      {items.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-500 mt-1">
                          ₩{(dayTotal / 10000).toLocaleString()}만 ({items.length}건)
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {items.map((it, idx) => {
                        const name = it.clientSummary.realClientName || it.clientSummary.clientName;
                        return (
                          <div
                            key={idx}
                            className={`p-1.5 rounded-lg text-xs font-bold border ${
                              it.isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : it.isOverdue
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : it.isDueToday
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{name}</span>
                              <span className="text-[10px] font-medium">{it.installment.round}차</span>
                            </div>
                            <div className="text-[10px] text-right font-black mt-0.5">
                              ₩{it.amountWon.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-slate-400 font-bold">
                    총 {items.length}건
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ── 4. 선택 일자 상세 패널 (Selected Date Action Panel) ── */}
      {selectedDateKey && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>{selectedDateKey.replace(/-/g, '.')} 수납 일정</span>
                  {selectedDateKey === todayStr && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-black rounded-md">
                      오늘 마감 (D-Day)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  총 {selectedDayStats.count}건 대상 (총액 ₩{selectedDayStats.totalAmount.toLocaleString()} / 완납 ₩{selectedDayStats.paidAmount.toLocaleString()})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDateKey(null)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              패널 닫기
            </button>
          </div>

          {selectedDayItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              선택한 날짜에 예정된 수임료 분납 일정이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedDayItems.map((item, idx) => {
                const summary = item.clientSummary;
                const inst = item.installment;
                const isRehab = summary.caseType === 'individual_rehab';
                const req = requests.find(r => r.id === summary.clientId);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      summary.isHighRiskTarget
                        ? 'bg-amber-50/40 border-amber-300'
                        : item.isOverdue
                        ? 'bg-rose-50/30 border-rose-200'
                        : item.isPaid
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    {/* 상단: 고객 정보 & 뱃지 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onNavigateToClientCrm(summary.clientId, 'fees')}
                            className="font-bold text-sm text-slate-900 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                          >
                            <span>{summary.realClientName || summary.clientName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isRehab ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {isRehab ? '개인회생' : '개인파산'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {summary.phone} {summary.courtName ? `· ${summary.courtName}` : ''} {summary.caseNumber || ''}
                        </div>
                      </div>

                      {/* 상태 뱃지 */}
                      <div className="flex flex-col items-end gap-1">
                        {summary.isHighRiskTarget && (
                          <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black animate-pulse">
                            🚨 집중관리 (2회+미룸)
                          </span>
                        )}
                        {item.isPaid ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                            수납 완료
                          </span>
                        ) : item.isOverdue ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">
                            연체 미납
                          </span>
                        ) : item.isDueToday ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-bold">
                            당일 마감
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-medium">
                            납부 대기
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 중단: 회차 및 금액, 계약/접수일 */}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px]">납부 회차 / 금액</span>
                        <div className="font-bold text-slate-900">
                          {inst.round}차 분납 · ₩{item.amountWon.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px]">계약일 / 법원접수</span>
                        <div className="text-[11px] font-medium text-slate-700">
                          계약 {summary.contractDate ? summary.contractDate.replace(/-/g, '.') : '-'} / 접수 {summary.filingDate ? summary.filingDate.replace(/-/g, '.') : '준비중'}
                        </div>
                      </div>
                    </div>

                    {/* 하단 빠른 액션 버튼 바 */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-[11px] text-slate-500">
                        잔금: <strong className="text-slate-800">₩{summary.remainingFee.toLocaleString()}</strong> ({summary.remainingInstallments}회 남음)
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* 1) 고객 상세 */}
                        <button
                          type="button"
                          onClick={() => onNavigateToClientCrm(summary.clientId, 'fees')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          고객상세
                        </button>

                        {/* 2) 입금 확인 */}
                        {!item.isPaid && (
                          <button
                            type="button"
                            onClick={() => onMarkAsPaid(summary, inst)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer press-scale"
                          >
                            입금확인
                          </button>
                        )}

                        {/* 3) 알림톡 발송 */}
                        {req && (
                          <button
                            type="button"
                            onClick={() => onOpenAlimtok(req, inst, summary.totalFee, summary.totalPaid)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                            title="알림톡 발송"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* 4) 납부일 연기 */}
                        {!item.isPaid && req && (
                          <button
                            type="button"
                            onClick={() => onOpenDeferModal(req, inst)}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="납부 약속일 연기"
                          >
                            <CalendarClock className="w-4 h-4" />
                          </button>
                        )}
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
  );
}
