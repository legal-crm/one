import React from 'react';
import { X, BookOpen, ClipboardList, ArrowRight, Search, Info } from 'lucide-react';

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
    tax_delinquency: 'bg-amber-50 text-amber-500 dark:bg-amber-950/20',
  };
  const iconColor = colorMap[activeRemedyCategory] || 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="relative p-6 md:p-8 text-left border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColor}`}>
              {renderRemedyIcon(data.iconName, "w-6 h-6")}
            </div>
            <div className="space-y-0.5">
              <span className="inline-block text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {data.badgeText}
              </span>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">
                {data.title} 시 확인할 사항
              </h4>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-5 overflow-y-auto text-left">
          {/* 면책 고지 */}
          <div className="bg-blue-50/60 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                이 화면은 {data.title}와 관련하여 일반적으로 확인할 정보와 상담 전 준비사항을 안내합니다. 특정 절차의 이용 가능 여부나 적합성을 판단하지 않습니다.
              </p>
            </div>
          </div>

          {/* 관련 제도 알아보기 */}
          <div className="bg-slate-50 dark:bg-slate-950/30 p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <h5 className="font-bold text-sm text-brand dark:text-brand-light flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>📋 {data.remedyTitle}</span>
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line">
              {data.remedyDesc}
            </p>
          </div>

          {/* 상담 전 준비사항 */}
          <div className="bg-amber-50/40 dark:bg-amber-950/10 p-5 md:p-6 rounded-2xl border border-amber-100 dark:border-amber-900/10 space-y-3">
            <h5 className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span>📝 {data.guideTitle}</span>
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line">
              {data.guideDesc}
            </p>
          </div>
        </div>

        {/* Footer - CTA 분리 */}
        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button 
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              닫기
            </button>
            <button 
              onClick={() => onApply(activeRemedyCategory)}
              className="flex-1 sm:flex-none px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>내 채무현황 정리하기</span>
            </button>
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm hover:shadow-brand-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              <span>전문가 직접 검색하기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2.5 text-center leading-relaxed">
            플랫폼은 선택한 채무유형을 분석하여 특정 전문가를 추천하지 않습니다.
          </p>
        </div>

      </div>
    </div>
  );
}
