import React from 'react';
import { X } from 'lucide-react';
import { PlatformConfig } from '../../types';

interface TermsModalProps {
  termsModalType: 'tos' | 'privacy';
  platformConfig: PlatformConfig;
  onClose: () => void;
}

export default function TermsModal({ termsModalType, platformConfig, onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl p-6 md:p-8 space-y-4 relative overflow-hidden text-left animate-fadeIn">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            {termsModalType === 'tos' ? '서비스 이용약관' : '개인정보 처리방침'}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          {termsModalType === 'tos' ? platformConfig.termsOfService : platformConfig.privacyPolicy}
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-6 py-2 rounded-2xl text-xs transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
