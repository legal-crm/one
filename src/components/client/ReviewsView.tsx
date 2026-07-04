import React, { useState } from 'react';
import { Search, X, CheckCircle, AlertTriangle, HeartHandshake } from 'lucide-react';
import { SuccessReview } from '../../types';

interface ReviewsViewProps {
  reviews: SuccessReview[];
  onReviewClick: (rev: SuccessReview) => void;
}

const ITEMS_PER_PAGE = 9;
const CATEGORIES = ['전체', '코인/주식 손실', '신용카드 연체', '개인파산', '연대보증 채무', '프리랜서 회생'];

export default function ReviewsView({ reviews, onReviewClick }: ReviewsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const filteredReviews = reviews.filter(rev => {
    const categoryMatches = categoryFilter === '전체' || rev.category === categoryFilter;
    if (!searchQuery) return categoryMatches;
    const query = searchQuery.toLowerCase().trim();
    const searchMatches =
      rev.title.toLowerCase().includes(query) ||
      rev.content.toLowerCase().includes(query) ||
      rev.lawyerName.toLowerCase().includes(query) ||
      rev.tags.some(t => t.toLowerCase().includes(query));
    return categoryMatches && searchMatches;
  });

  const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE);
  const activePage = Math.min(page, Math.max(1, totalPages));
  const paginatedReviews = filteredReviews.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-8 animate-fadeIn text-left font-sans">
      {/* Page Header */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800 transition-all duration-300">
        <div className="absolute right-0 top-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-200 text-xs font-bold rounded-full border border-indigo-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>실시간 채무 감면 성공 사례</span>
          </span>
          
          <h1 className="text-2xl md:text-3.5xl font-bold tracking-tight leading-tight">
            my김변 회생파산 성공사례
          </h1>
          
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed font-medium">
            가압류/독촉의 위기에서 벗어나 성공적으로 빚 탕감을 마친 분들의 생생한 후기입니다. 
            동일 채무 분야의 변호사에게 1:1 상담을 신청하여 직접 기적을 만들어보세요.
          </p>
          
          {/* Micro statistics banner */}
          <div className="grid grid-cols-3 gap-3 md:gap-5 pt-4 border-t border-slate-700/50">
            <div className="space-y-1">
              <span className="block text-[12px] md:text-xs text-slate-500 font-bold">누적 탕감액</span>
              <span className="block text-sm md:text-lg font-bold text-amber-400">84억 5,000만원+</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[12px] md:text-xs text-slate-500 font-bold">인가면책 성공률</span>
              <span className="block text-sm md:text-lg font-bold text-indigo-400">98.7%</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[12px] md:text-xs text-slate-500 font-bold">평균 감면율</span>
              <span className="block text-sm md:text-lg font-bold text-emerald-400">최대 78%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-premium space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="검색어 입력 (예: 코인, 독촉, 이소민...)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none font-bold"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setPage(1); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold self-end md:self-center">
            검색 결과: <strong className="text-brand dark:text-brand-light text-sm">{filteredReviews.length}</strong>건
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-brand border-brand text-white shadow-sm shadow-brand/10 scale-[1.02]'
                  : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List Grid */}
      {filteredReviews.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-12 rounded-2xl text-center space-y-3 shadow-premium">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-200">일치하는 성공 사례가 없습니다.</h4>
          <p className="text-xs text-slate-600">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
          <button
            onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); setPage(1); }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedReviews.map(rev => {
              const saved = rev.originalDebt - rev.remainingDebt;
              const reductionRate = Math.round((saved / rev.originalDebt) * 100);
              return (
                <div key={rev.id} className="bg-slate-50/90 dark:bg-slate-850/50 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-6 flex flex-col justify-between space-y-6 group relative overflow-hidden text-left">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand/10 to-transparent"></div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug group-hover:text-brand dark:group-hover:text-brand-light transition-colors line-clamp-2">
                      "{rev.title}"
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium line-clamp-3 md:line-clamp-none">{rev.content}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {rev.tags.map(t => (
                        <button key={t} onClick={() => { setSearchQuery(t); setPage(1); }} className="text-[12px] text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md hover:text-brand-hover dark:hover:text-brand-light transition-colors font-bold cursor-pointer">
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">{rev.author} 의뢰인님</span>
                      <div className="flex items-center gap-2">
                        <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shadow-sm" />
                        <div className="text-left">
                          <span className="block font-bold text-slate-700 dark:text-slate-300 text-[13px] leading-none">{rev.lawyerName}</span>
                          <span className="text-[12px] text-slate-500 font-bold">도산 전담 변호사</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => onReviewClick(rev)} className="w-full text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-brand-sm cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.98]">
                      <HeartHandshake className="w-4 h-4" />
                      <span>이 변호사에게 동일 사건 상담 신청</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
              <button type="button" disabled={activePage === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${activePage === 1 ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
                이전
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                return (
                  <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${activePage === pNum ? 'bg-brand border-brand text-white shadow-md shadow-brand/20 scale-105' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>{pNum}</button>
                );
              })}
              <button type="button" disabled={activePage === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${activePage === totalPages ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
