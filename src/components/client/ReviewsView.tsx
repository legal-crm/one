import React, { useState } from 'react';
import { Search, X, AlertTriangle, Eye } from 'lucide-react';
import { SuccessReview } from '../../types';

interface ReviewsViewProps {
  reviews: SuccessReview[];
  onReviewClick: (rev: SuccessReview) => void;
}

const MAX_REVIEWS = 15;
const CATEGORIES = ['전체', '코인/주식 손실', '신용카드 연체', '개인파산', '연대보증 채무', '프리랜서 회생'];

export default function ReviewsView({ reviews, onReviewClick }: ReviewsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'latest' | 'views'>('latest');

  // 최근 15개만 표시 (새 후기가 추가되면 오래된 것 밀려남)
  const recentReviews = reviews.slice(0, MAX_REVIEWS);

  const filteredReviews = recentReviews.filter(rev => {
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

  const mockViews = (id: string) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return (hash * 1337 % 500000) + 10000;
  };
  const mockDate = (id: string) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const days = hash % 30;
    return days === 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`;
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left font-sans">
      {/* Page Header */}
      <div className="space-y-2 pt-2 pb-4 border-b border-slate-200">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
          나와 비슷한 상황의<br className="md:hidden" />
          상담 후기를 찾아보세요.
        </h1>
        <p className="text-sm text-slate-500">
          ※ 최근 {MAX_REVIEWS}건의 후기가 실시간으로 업데이트됩니다. 후기를 클릭하면 해당 변호사 프로필로 이동합니다.
        </p>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-4 text-sm text-slate-500 border-b border-slate-100 pb-3">
        <button
          onClick={() => setSortBy('latest')}
          className={`font-semibold cursor-pointer transition-colors ${sortBy === 'latest' ? 'text-slate-900' : 'hover:text-slate-700'}`}
        >
          최신순
        </button>
        <span className="text-slate-300">·</span>
        <button
          onClick={() => setSortBy('views')}
          className={`font-semibold cursor-pointer transition-colors ${sortBy === 'views' ? 'text-slate-900' : 'hover:text-slate-700'}`}
        >
          조회순
        </button>
      </div>

      {/* Filter and Search */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="검색어 입력 (예: 코인, 독촉, 이소민...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-slate-500 font-medium shrink-0">
            총 <strong className="text-slate-900">{filteredReviews.length}</strong>건
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all border cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="font-semibold text-base text-slate-900">일치하는 후기가 없습니다.</h4>
          <p className="text-sm text-slate-500">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
          <button
            onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); }}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {filteredReviews.map(rev => {
            const views = mockViews(rev.id);
            const date = mockDate(rev.id);

            return (
              <div
                key={rev.id}
                className="py-5 first:pt-0 cursor-pointer group"
                onClick={() => onReviewClick(rev)}
              >
                {/* Category */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500">{rev.category}</span>
                </div>

                {/* Title - 클릭 시 변호사 프로필로 이동 */}
                <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                  {rev.title}
                </h3>

                {/* Content preview */}
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">
                  {rev.content}
                </p>

                {/* Author + lawyer + meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-medium">{rev.author}</span>
                  <span>·</span>
                  <div className="flex items-center gap-1.5">
                    <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-4 h-4 rounded-full object-cover border border-slate-200" />
                    <span className="text-blue-600 font-semibold group-hover:underline">{rev.lawyerName} 변호사 프로필 →</span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {views.toLocaleString()}
                  </span>
                  <span className="ml-auto">{date}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="text-center py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">최근 {MAX_REVIEWS}건의 후기만 표시됩니다. 새로운 후기가 등록되면 가장 오래된 후기가 자동으로 교체됩니다.</p>
      </div>
    </div>
  );
}
