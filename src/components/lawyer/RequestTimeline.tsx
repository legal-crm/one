import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  action: 'RECEIVED' | 'AI_ANALYZED' | 'STAFF_REVIEWED' | 'CONFIRM_REQUESTED' | 'APPROVED' | 'REJECTED' | 'SENT_TO_CLIENT';
  actor: string;
  timestamp: string;
  detail?: string;
}

const ACTION_CONFIG: Record<TimelineEvent['action'], { icon: string; label: string; color: string }> = {
  RECEIVED: { icon: '📥', label: '상담 접수', color: 'text-slate-600' },
  AI_ANALYZED: { icon: '🔬', label: 'AI 분석', color: 'text-blue-600' },
  STAFF_REVIEWED: { icon: '📝', label: '직원 확인', color: 'text-amber-600' },
  CONFIRM_REQUESTED: { icon: '📋', label: '컨펌 요청', color: 'text-amber-600' },
  APPROVED: { icon: '✅', label: '승인', color: 'text-emerald-600' },
  REJECTED: { icon: '❌', label: '반려', color: 'text-red-600' },
  SENT_TO_CLIENT: { icon: '📨', label: '고객 발송', color: 'text-brand' },
};

interface RequestTimelineProps {
  events: TimelineEvent[];
}

export default function RequestTimeline({ events }: RequestTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const latest = sorted[0];
  const rest = sorted.slice(1);
  const latestConfig = ACTION_CONFIG[latest.action];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer w-full"
      >
        <span>📋 처리 이력</span>
        <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px] font-black">{events.length}</span>
        <span className="flex-1" />
        {/* 최근 1건 미리보기 */}
        <span className={`${latestConfig.color} font-bold`}>
          {latestConfig.icon} {latestConfig.label}
        </span>
        <span className="text-slate-400">{formatTime(latest.timestamp)}</span>
        {rest.length > 0 && (expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
      </button>

      {expanded && rest.length > 0 && (
        <div className="mt-2 ml-1 space-y-0">
          {sorted.map((evt) => {
            const cfg = ACTION_CONFIG[evt.action];
            return (
              <div key={evt.id} className="flex items-start gap-2.5 py-1.5 relative">
                <div className="w-5 text-center text-sm shrink-0 leading-none pt-0.5">{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400">{evt.actor}</span>
                    <span className="text-[10px] text-slate-300 ml-auto shrink-0">{formatTime(evt.timestamp)}</span>
                  </div>
                  {evt.detail && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{evt.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
