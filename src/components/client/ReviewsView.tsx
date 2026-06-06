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
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-200 text-xs font-extrabold rounded-full border border-indigo-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>실시간 채무 감면 성공 사례</span>
          </span>
          
          <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-tight">
            회생톡 회생파산 성공후기
          </h1>
          
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            가압류/독촉의 위기에서 벗어나 성공적으로 빚 탕감을 마친 분들의 생생한 후기입니다. 
            동일 채무 분야의 변호사에게 1:1 상담을 신청하여 직접 기적을 만들어보세요.
          </p>
          
          {/* Micro statistics banner */}
          <div className="grid grid-cols-3 gap-3 md:gap-5 pt-4 border-t border-slate-700/50">
            <div className="space-y-1">
              <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">누적 탕감액</span>
              <span className="block text-sm md:text-lg font-bold text-amber-400">84억 5,000만원+</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">인가면책 성공률</span>
              <span className="block text-sm md:text-lg font-bold text-indigo-400">98.7%</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">평균 감면율</span>
              <span className="block text-sm md:text-lg font-bold text-emerald-400">최대 78%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="검색어 입력 (예: 코인, 독촉, 이소민...)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-brand"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 font-semibold self-end md:self-center">
            검색 결과: <strong className="text-brand dark:text-brand-light">{filteredReviews.length}</strong>건
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                categoryFilter === cat
                  ? 'bg-brand border-brand text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List Grid */}
      {filteredReviews.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">일치하는 성공 후기가 없습니다.</h4>
          <p className="text-xs text-slate-500">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
          <button
            onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); setPage(1); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors"
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
                <div key={rev.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-lg transition-all p-5 flex flex-col justify-between space-y-5 group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">{rev.category}</span>
                      <div className="flex text-amber-400 text-xs">★★★★★</div>
                    </div>
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-850 dark:text-white leading-snug group-hover:text-brand dark:group-hover:text-brand-light transition-colors line-clamp-2">
                      "{rev.title}"
                    </h3>
                    <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-950/40 dark:to-slate-950/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-2 text-xs font-bold">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>기존 채무액</span>
                        <span className="line-through">{rev.originalDebt.toLocaleString()}만원</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-850 dark:text-white">
                        <span>조정 후 채무</span>
                        <span className="text-indigo-600 dark:text-indigo-450">
                          {rev.remainingDebt === 0 ? "전액 탕감 (0원)" : `${rev.remainingDebt.toLocaleString()}만원`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px]">
                        <span className="text-emerald-600 dark:text-emerald-450">총 감면 혜택</span>
                        <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 px-2 py-0.5 rounded font-extrabold">
                          {reductionRate}% 감면 (-{saved.toLocaleString()}만원)
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-normal line-clamp-3 md:line-clamp-none">{rev.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {rev.tags.map(t => (
                        <button key={t} onClick={() => { setSearchQuery(t); setPage(1); }} className="text-[10px] text-slate-500 dark:text-slate-450 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-md hover:text-brand-hover dark:hover:text-brand-light transition-colors font-medium cursor-pointer">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold">{rev.author}</span>
                      <div className="flex items-center gap-2">
                        <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-5.5 h-5.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100" />
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-350 text-[11px] leading-none">{rev.lawyerName}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">도산 전담 변호사</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => onReviewClick(rev)} className="w-full text-center py-2.5 bg-brand hover:bg-brand dark:bg-blue-650 dark:hover:bg-brand text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer">
                      <HeartHandshake className="w-3.5 h-3.5" />
                      <span>이 변호사에게 동일 사건 상담 신청</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8 border-t border-slate-100 dark:border-slate-800/80 mt-8">
              <button type="button" disabled={activePage === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                이전
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} type="button" onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 text-xs font-black rounded-xl transition-all cursor-pointer border ${activePage === p ? 'bg-brand border-brand text-white shadow-sm shadow-brand/20 scale-105 font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button type="button" disabled={activePage === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
