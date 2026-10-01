import React from 'react';
import { Clock, FileCheck, Scale, Upload, Bell, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { MyPageModel } from './useMyPageModel';
import { loadClientNotifications } from '../../../services/clientNotificationService';
import type { ClientNotification } from '../../../services/clientNotificationService';

/**
 * v2.0: 사건 활동 타임라인 — 의뢰인이 사건 진행 이력을 한눈에 확인
 * 알림 서비스의 기존 데이터를 타임라인 형태로 시각화
 */

const TIMELINE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  status_change: { icon: Scale, color: 'bg-brand text-white' },
  new_message: { icon: MessageSquare, color: 'bg-blue-500 text-white' },
  document_request: { icon: Upload, color: 'bg-amber-500 text-white' },
  fee_reminder: { icon: Bell, color: 'bg-rose-500 text-white' },
  notice: { icon: FileCheck, color: 'bg-emerald-500 text-white' },
  system: { icon: Clock, color: 'bg-slate-500 text-white' },
};

function formatTimelineDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;

  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

interface CaseActivityTimelineProps {
  vm: MyPageModel;
}

export default function CaseActivityTimeline({ vm }: CaseActivityTimelineProps) {
  const notifications: ClientNotification[] = vm.notifications ?? loadClientNotifications();

  // 최근 20건, 날짜 역순
  const recentItems = [...notifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  if (recentItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">아직 활동 내역이 없습니다</h4>
          <p className="text-xs text-slate-500">사건이 진행되면 변호사의 활동과 서류 제출 이력이 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-hidden="true">
            <Clock className="w-4 h-4" />
          </span>
          사건 활동 타임라인
        </h3>
        <span className="text-xs text-slate-500 font-bold">최근 {recentItems.length}건</span>
      </div>

      <div className="relative">
        {/* 연결선 */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" aria-hidden="true" />

        <ol className="space-y-0" aria-label="사건 활동 타임라인">
          {recentItems.map((item, idx) => {
            const meta = TIMELINE_ICONS[item.type] || TIMELINE_ICONS.system;
            const Icon = meta.icon;
            const isFirst = idx === 0;

            return (
              <li key={item.id} className={`relative flex gap-3 pb-4 ${isFirst ? '' : ''}`}>
                {/* 타임라인 노드 */}
                <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${isFirst ? meta.color : 'bg-slate-100 text-slate-500'} ${isFirst ? 'ring-4 ring-offset-1 ring-brand/20' : ''}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-xs leading-relaxed break-keep ${isFirst ? 'text-slate-900 font-bold' : item.isRead ? 'text-slate-600' : 'text-slate-800 font-bold'}`}>
                    {item.title}
                    {item.body && <span className="text-slate-500 ml-1">— {item.body}</span>}
                  </p>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {formatTimelineDate(item.createdAt)}
                    {!item.isRead && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand ml-1.5 align-middle" />
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
