import React from 'react';
import { 
  Users, PhoneCall, Clock, AlertTriangle, CheckCircle2, 
  TrendingUp, Sparkles, ChevronRight, PhoneForwarded, Flame
} from 'lucide-react';
import type { SalesLead } from '../../../types/leadTypes';
import { getSalesDashboardMetrics } from '../../../services/leadService';

interface SalesDashboardWidgetProps {
  leads: SalesLead[];
  onSelectQuickFilter: (filterKey: string) => void;
  activeFilter: string;
}

export const SalesDashboardWidget: React.FC<SalesDashboardWidgetProps> = ({
  leads,
  onSelectQuickFilter,
  activeFilter,
}) => {
  const metrics = getSalesDashboardMetrics(leads);

  return (
    <div className="space-y-4">
      {/* KPI Cards Row (5종) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. 총 인입 DB */}
        <button
          type="button"
          onClick={() => onSelectQuickFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer press-scale active:scale-[0.98] ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeFilter === 'all' ? 'text-blue-100' : 'text-slate-500'}`}>
              총 인입 DB
            </span>
            <div className={`p-2 rounded-xl ${activeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Users size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight">{metrics.totalLeads}</span>
            <span className={`text-xs font-bold ${activeFilter === 'all' ? 'text-blue-200' : 'text-slate-400'}`}>건</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'all' ? 'text-blue-200' : 'text-slate-500'}`}>
            미접촉 신규 <strong className={activeFilter === 'all' ? 'text-white' : 'text-blue-600'}>{metrics.newLeads}건</strong>
          </p>
        </button>

        {/* 2. 오늘의 통화 예약 (Today Reminders) */}
        <button
          type="button"
          onClick={() => onSelectQuickFilter('callback')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer press-scale active:scale-[0.98] ${
            activeFilter === 'callback'
              ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeFilter === 'callback' ? 'text-purple-100' : 'text-slate-500'}`}>
              오늘의 예약콜
            </span>
            <div className={`p-2 rounded-xl ${activeFilter === 'callback' ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-600'}`}>
              <Clock size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-300">{metrics.todayReminders}</span>
            <span className={`text-xs font-bold ${activeFilter === 'callback' ? 'text-purple-200' : 'text-slate-400'}`}>건</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'callback' ? 'text-purple-200' : 'text-slate-500'}`}>
            당일 약속된 통화 큐
          </p>
        </button>

        {/* 3. 지연된 리마인더 (Overdue) */}
        <button
          type="button"
          onClick={() => onSelectQuickFilter('overdue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer press-scale active:scale-[0.98] ${
            activeFilter === 'overdue'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
              : metrics.overdueReminders > 0
              ? 'bg-rose-50/50 text-slate-800 border-rose-200 hover:border-rose-300'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeFilter === 'overdue' ? 'text-rose-100' : 'text-slate-500'}`}>
              지연된 통화 경고
            </span>
            <div className={`p-2 rounded-xl ${activeFilter === 'overdue' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black tracking-tight ${metrics.overdueReminders > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {metrics.overdueReminders}
            </span>
            <span className={`text-xs font-bold ${activeFilter === 'overdue' ? 'text-rose-200' : 'text-slate-400'}`}>건</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'overdue' ? 'text-rose-200' : 'text-slate-500'}`}>
            예약 시간 경과 미통화
          </p>
        </button>

        {/* 4. 부재중 관리 큐 (1~3차) */}
        <button
          type="button"
          onClick={() => onSelectQuickFilter('no_answer')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer press-scale active:scale-[0.98] ${
            activeFilter === 'no_answer'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeFilter === 'no_answer' ? 'text-amber-100' : 'text-slate-500'}`}>
              부재중 관리 큐
            </span>
            <div className={`p-2 rounded-xl ${activeFilter === 'no_answer' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <PhoneForwarded size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-300">{metrics.noAnswerLeads}</span>
            <span className={`text-xs font-bold ${activeFilter === 'no_answer' ? 'text-amber-200' : 'text-slate-400'}`}>건</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'no_answer' ? 'text-amber-200' : 'text-slate-500'}`}>
            1~3차 미수신 재시도 대상
          </p>
        </button>

        {/* 5. ⭐️ 고객 전환율 (Conversion Rate) */}
        <button
          type="button"
          onClick={() => onSelectQuickFilter('converted')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer press-scale active:scale-[0.98] ${
            activeFilter === 'converted'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
              : 'bg-gradient-to-br from-emerald-50/70 to-teal-50/50 text-slate-800 border-emerald-200 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeFilter === 'converted' ? 'text-emerald-100' : 'text-emerald-900'}`}>
              ⭐️ 정식 고객 전환율
            </span>
            <div className={`p-2 rounded-xl ${activeFilter === 'converted' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black tracking-tight ${activeFilter === 'converted' ? 'text-white' : 'text-emerald-700'}`}>
              {metrics.conversionRate}%
            </span>
            <span className={`text-xs font-bold ${activeFilter === 'converted' ? 'text-emerald-200' : 'text-slate-500'}`}>
              ({metrics.convertedCount}건 승격)
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'converted' ? 'text-emerald-200' : 'text-emerald-700'}`}>
            CRM 고객으로 이전 완료
          </p>
        </button>
      </div>

      {/* 실시간 영업 현황 배너 */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <Flame size={18} />
          </div>
          <div>
            <span className="font-extrabold text-slate-200">총 콜 시도: {metrics.totalCalls}회</span>
            <span className="text-slate-500 mx-2">|</span>
            <span className="text-slate-300">통화 연결률: <strong className="text-emerald-400">{metrics.connectedRate}%</strong></span>
            <span className="text-slate-500 mx-2">|</span>
            <span className="text-slate-300">상담 진행 중: <strong className="text-indigo-300">{metrics.inProgressLeads}명</strong></span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 self-end sm:self-auto font-medium">
          고객 CRM과 분리된 독립 영업 통계
        </span>
      </div>
    </div>
  );
};

export default SalesDashboardWidget;
