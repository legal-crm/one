import React from 'react';
import { X, Scale, AlertTriangle, ArrowRight } from 'lucide-react';

interface RemedyInfo {
  id: string;
  title: string;
  subtitle: string;
  remedyTitle: string;
  remedyDesc: string;
  guideTitle: string;
  guideDesc: string;
  iconName: string;
  badgeText: string;
}

interface RemedyModalProps {
  activeRemedyCategory: string;
  remedyData: Record<string, RemedyInfo>;
  renderRemedyIcon: (iconName: string, className: string) => React.ReactNode;
  onClose: () => void;
  onApply: (categoryId: string) => void;
}

export default function RemedyModal({ activeRemedyCategory, remedyData, renderRemedyIcon, onClose, onApply }: RemedyModalProps) {
  const data = remedyData[activeRemedyCategory];
  if (!data) return null;

  const colorMap: Record<string, string> = {
    card_loan: 'bg-rose-50 text-rose-500 dark:bg-rose-950/20',
    bank_loan: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20',
    high_interest: 'bg-amber-50 text-amber-500 dark:bg-amber-950/20',
    guarantee: 'bg-purple-50 text-purple-500 dark:bg-purple-950/20',
    investment: 'bg-orange-50 text-orange-500 dark:bg-orange-950/20',
    freelancer: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20',
    seizure: 'bg-rose-50 text-rose-500 dark:bg-rose-950/20',
  };
  const iconColor = colorMap[activeRemedyCategory] || 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="relative p-6 md:p-8 text-left border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColor}`}>
              {renderRemedyIcon(data.iconName, "w-6 h-6")}
            </div>
            <div className="space-y-0.5">
              <span className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light">
                {data.badgeText}
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {data.title} 맞춤 법리 솔루션
              </h4>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto text-left">
          <div className="bg-slate-50 dark:bg-slate-950/30 p-5 md:p-6 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-3">
            <h5 className="font-extrabold text-sm text-brand dark:text-brand-light flex items-center gap-2">
              <Scale className="w-4 h-4" />
              <span>법률상 대표적 해법 (Remedy)</span>
            </h5>
            <div className="space-y-2">
              <h6 className="font-bold text-sm text-slate-805 dark:text-slate-200">
                "{data.remedyTitle}"
              </h6>
              <p className="text-xs text-[#7e7e8f] dark:text-slate-400 leading-relaxed font-medium">
                {data.remedyDesc}
              </p>
            </div>
          </div>

          <div className="bg-rose-50/40 dark:bg-rose-950/10 p-5 md:p-6 rounded-2xl border border-rose-100/50 dark:border-rose-900/10 space-y-3">
            <h5 className="font-extrabold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>🚨 변호사의 골든타임 행동 지침</span>
            </h5>
            <div className="space-y-2">
              <h6 className="font-bold text-sm text-slate-850 dark:text-slate-200">
                {data.guideTitle}
              </h6>
              <p className="text-xs text-[#7e7e8f] dark:text-slate-400 leading-relaxed font-medium">
                {data.guideDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-[#7e7e8f] bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              실시간 도산 전문 변호사 매칭 대기 중
            </span>
            <span className="text-brand">안심 100% 비공개 보장</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-3 rounded-2xl text-xs font-extrabold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            닫기
          </button>
          <button 
            onClick={() => onApply(activeRemedyCategory)}
            className="flex-1 sm:flex-none px-7 py-3 bg-brand text-white rounded-2xl text-xs font-extrabold shadow-lg shadow-brand/20 hover:shadow-xl hover:bg-brand-dark transition-all duration-300 transform active:scale-[0.98] animate-pulse hover:animate-none flex items-center justify-center gap-2"
          >
            <span>이 솔루션으로 1:1 진단 및 상담 신청하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
