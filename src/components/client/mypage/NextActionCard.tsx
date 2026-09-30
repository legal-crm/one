import React from 'react';
import { ArrowRight, Bell, CheckCircle2, ClipboardList, Info, Sparkles } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../ui';
import type { NextAction } from './nextAction';

/** 마이페이지 맨 위 '지금 할 일' 카드 (주 버튼 1개) */
const TONE: Record<string, { box: string; icon: React.ReactNode }> = {
  brand: { box: 'border-brand/20 bg-brand-light', icon: <Sparkles className="w-5 h-5 text-brand" aria-hidden="true" /> },
  info: { box: 'border-sky-200 bg-sky-50', icon: <Info className="w-5 h-5 text-sky-700" aria-hidden="true" /> },
  warning: { box: 'border-amber-200 bg-amber-50', icon: <Bell className="w-5 h-5 text-amber-700" aria-hidden="true" /> },
  success: { box: 'border-emerald-200 bg-emerald-50', icon: <CheckCircle2 className="w-5 h-5 text-emerald-700" aria-hidden="true" /> },
  neutral: { box: 'border-slate-200 bg-slate-50', icon: <ClipboardList className="w-5 h-5 text-slate-600" aria-hidden="true" /> },
};

export default function NextActionCard({ next, onAction }: { next: NextAction; onAction: () => void }) {
  const tone = TONE[next.tone] || TONE.neutral;
  return (
    <section aria-labelledby="mypage-next-title" className={cn('rounded-2xl border px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3', tone.box)}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="mt-0.5 shrink-0">{tone.icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600">지금 할 일</p>
          <h2 id="mypage-next-title" className="text-base font-bold text-slate-900 break-keep">{next.title}</h2>
          <p className="mt-0.5 text-sm text-slate-700 leading-relaxed break-keep">{next.description}</p>
        </div>
      </div>
      {next.action && (
        <Button onClick={onAction} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />} className="self-start sm:self-auto shrink-0">
          {next.action.label}
        </Button>
      )}
    </section>
  );
}
