import React from 'react';
import { X, MessageSquare, BookOpen, ArrowRight } from 'lucide-react';

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
  onViewCases: (categoryId: string) => void;
}

export default function RemedyModal({ activeRemedyCategory, remedyData, renderRemedyIcon, onClose, onApply, onViewCases }: RemedyModalProps) {
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
    tax_delinquency: 'bg-amber-50 text-amber-500 dark:bg-amber-950/20',
  };
  const iconColor = colorMap[activeRemedyCategory] || 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20';

  const accentColorMap: Record<string, string> = {
    card_loan: 'from-rose-500 to-rose-600',
    bank_loan: 'from-indigo-500 to-indigo-600',
    high_interest: 'from-amber-500 to-amber-600',
    guarantee: 'from-purple-500 to-purple-600',
    investment: 'from-orange-500 to-orange-600',
    freelancer: 'from-emerald-500 to-emerald-600',
    seizure: 'from-rose-500 to-rose-600',
    tax_delinquency: 'from-amber-500 to-amber-600',
  };
  const accentGradient = accentColorMap[activeRemedyCategory] || 'from-indigo-500 to-indigo-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Header */}
        <div className="relative p-6 md:p-8 text-center border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconColor}`}>
              {renderRemedyIcon(data.iconName, "w-7 h-7")}
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                {data.title}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                어떤 도움이 필요하신가요?
              </p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="p-6 md:p-8 space-y-3">
          {/* 변호사 상담 요청하기 */}
          <button 
            onClick={() => onApply(activeRemedyCategory)}
            className={`w-full px-5 py-4 bg-gradient-to-r ${accentGradient} hover:opacity-90 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 whitespace-nowrap`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>변호사 상담 요청하기</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {/* 비슷한 사례 보기 */}
          <button 
            onClick={() => onViewCases(activeRemedyCategory)}
            className="w-full px-5 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            <span>비슷한 사례 보기</span>
            <ArrowRight className="w-4 h-4 ml-1 text-slate-400" />
          </button>
        </div>

      </div>
    </div>
  );
}

