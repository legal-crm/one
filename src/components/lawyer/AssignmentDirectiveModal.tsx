import React, { useState } from 'react';
import { X, Send, SkipForward } from 'lucide-react';
import type { DirectivePriority, StaffRole } from '../../types';
import { DIRECTIVE_PRIORITY_CONFIG } from '../../types';

interface AssignmentDirectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 메모 없이 배정 */
  onSkip: () => void;
  /** 지시사항과 함께 배정 */
  onSubmit: (data: { memo: string; priority: DirectivePriority; deadline?: string }) => void;
  assigneeName: string;
  assigneeRole: StaffRole;
  clientName: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: '대표 변호사',
  LAWYER: '변호사',
  CONSULTANT: '상담 직원',
  STAFF: '사무 직원',
  ACCOUNTING: '경리',
};

export default function AssignmentDirectiveModal({
  isOpen, onClose, onSkip, onSubmit,
  assigneeName, assigneeRole, clientName,
}: AssignmentDirectiveModalProps) {
  const [memo, setMemo] = useState('');
  const [priority, setPriority] = useState<DirectivePriority>('normal');
  const [deadline, setDeadline] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({
      memo: memo.trim(),
      priority,
      deadline: deadline || undefined,
    });
    setMemo('');
    setPriority('normal');
    setDeadline('');
  };

  const handleSkip = () => {
    onSkip();
    setMemo('');
    setPriority('normal');
    setDeadline('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            📋 배정 지시
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4 space-y-4">
          {/* 배정 대상 정보 */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-medium">배정 대상</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-md font-bold">{ROLE_LABELS[assigneeRole] || assigneeRole}</span>
                <span className="font-bold text-slate-900">{assigneeName}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-medium">고객</span>
              <span className="font-bold text-slate-900">{clientName}</span>
            </div>
          </div>

          {/* 우선순위 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">🏷️ 우선순위</label>
            <div className="flex gap-2">
              {(Object.entries(DIRECTIVE_PRIORITY_CONFIG) as [DirectivePriority, typeof DIRECTIVE_PRIORITY_CONFIG[DirectivePriority]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setPriority(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer press-scale whitespace-nowrap ${
                    priority === key
                      ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor} ring-1 ring-current/20`
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* 지시사항 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">📝 지시사항 (선택)</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 다음달 퇴사 예정이라 언제 취업 예정인지 꼭 확인해야 함"
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all"
            />
          </div>

          {/* 회신 기한 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">📅 회신 기한 (선택)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer press-scale transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <SkipForward className="w-3.5 h-3.5" />
            메모 없이 배정
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand hover:bg-brand-hover text-white cursor-pointer press-scale transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            지시사항과 배정
          </button>
        </div>
      </div>
    </div>
  );
}
