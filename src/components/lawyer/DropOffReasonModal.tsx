import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { DROP_OFF_REASONS } from '../../types';
import type { DropOffReason } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  onConfirm: (reason: DropOffReason, detail: string) => void;
}

export default function DropOffReasonModal({ isOpen, onClose, clientName, onConfirm }: Props) {
  const [selectedReason, setSelectedReason] = useState<DropOffReason | ''>('');
  const [detail, setDetail] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedReason) {
      toast.error('이탈 사유를 선택해 주세요.');
      return;
    }
    onConfirm(selectedReason, detail);
    setSelectedReason('');
    setDetail('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setDetail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">이탈 사유 입력</h2>
              <p className="text-xs text-slate-500">{clientName} 건을 취소 처리합니다</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4 mt-3">취소 사유를 선택해 주세요. 이 기록은 CRM 메모에 자동 저장됩니다.</p>

        {/* Reason Selection */}
        <div className="flex flex-col gap-2 mb-4">
          {DROP_OFF_REASONS.map(reason => (
            <button
              key={reason}
              type="button"
              onClick={() => setSelectedReason(reason)}
              className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${
                selectedReason === reason
                  ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">상세 사유 (선택)</label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="상세 사유를 입력해 주세요"
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.98] whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-red-600 hover:to-red-700 transition-colors active:scale-[0.98] whitespace-nowrap"
          >
            취소 처리 확인
          </button>
        </div>
      </div>
    </div>
  );
}
