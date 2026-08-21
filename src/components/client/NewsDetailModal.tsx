import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { NewsArticle } from '../../types';

interface NewsDetailModalProps {
  article: NewsArticle;
  lawyers: { id: string; name: string; avatar: string; bio: string; matchedCount?: number; fields?: string[] }[];
  onClose: () => void;
  onConsultWithLawyer: (lawyerId: string, lawyerName: string, articleTitle: string) => void;
}

export default function NewsDetailModal({ article, lawyers, onClose, onConsultWithLawyer }: NewsDetailModalProps) {
  const matchingLawyer = lawyers.find(l => l.id === article.authorId) || lawyers[0];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header / Cover Image */}
        <div className="relative h-48 md:h-64 w-full bg-slate-200 dark:bg-slate-950 shrink-0">
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-6 left-6 right-6 text-white text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-brand text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                {article.category}
              </span>
              {article.badge && (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full text-white shadow-sm ${
                  article.badge === 'HOT' ? 'bg-[#0D9488]' :
                  article.badge === 'NEW' ? 'bg-[#1E3A5F]' : 'bg-[#0F766E]'
                }`}>
                  {article.badge}
                </span>
              )}
              <span className="text-xs text-slate-300 font-medium">
                조회 {article.views} • {article.date}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold tracking-tight leading-snug drop-shadow-md">
              {article.title}
            </h3>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto text-left flex-1 min-h-0">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border-l-4 border-brand text-slate-700 dark:text-slate-300 text-sm sm:text-base italic leading-relaxed font-semibold">
            "{article.excerpt}"
          </div>
          <div className="text-slate-700 dark:text-slate-200 text-base leading-relaxed space-y-4 font-normal whitespace-pre-wrap">
            {article.content}
          </div>
        </div>

        {/* Lawyer Match Footer */}
        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
            <img 
              src={matchingLawyer.avatar} 
              alt={matchingLawyer.name} 
              className="w-13 h-13 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0" 
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 dark:text-white">{matchingLawyer.name}</span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-md">도산 전문 변호사</span>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block">
                {matchingLawyer.fields?.join(' · ') || '도산 전문'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal line-clamp-1 block">
                {matchingLawyer.bio}
              </span>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button 
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button 
              onClick={() => onConsultWithLawyer(matchingLawyer.id, matchingLawyer.name, article.title)}
              className="flex-1 sm:flex-none px-6 py-3.5 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold rounded-2xl text-sm transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>📞 {matchingLawyer.name} 변호사에게 1:1 상담 예약</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
