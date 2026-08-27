import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12'}`}>
      <span className={compact ? 'text-3xl' : 'text-4xl'}>{icon}</span>
      <p className={`font-bold text-slate-700 ${compact ? 'mt-2 text-sm' : 'mt-3 text-base'}`}>{title}</p>
      <p className={`text-slate-400 max-w-xs ${compact ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs'}`}>{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-4 px-5 py-2.5 text-xs font-bold text-brand border border-brand/20 rounded-xl hover:bg-brand/5 transition-colors press-scale whitespace-nowrap">{actionLabel}</button>
      )}
    </div>
  );
}
