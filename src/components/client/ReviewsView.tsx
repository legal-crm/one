import React, { useState } from 'react';
import { Search, X, AlertTriangle, Eye, ArrowLeft, HeartHandshake } from 'lucide-react';
import { SuccessReview } from '../../types';

interface ReviewsViewProps {
  reviews: SuccessReview[];
  onReviewClick: (rev: SuccessReview) => void;
}

const ITEMS_PER_PAGE = 10;
const CATEGORIES = ['전체', '코인/주식 손실', '신용카드 연체', '개인파산', '연대보증 채무', '프리랜서 회생'];

export default function ReviewsView({ reviews, onReviewClick }: ReviewsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'latest' | 'views'>('latest');
  const [selectedReview, setSelectedReview] = useState<SuccessReview | null>(null);

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

  // 모의 조회수/날짜
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
      {/* ── 상세 보기 ── */}
      {selectedReview ? (() => {
        const rev = selectedReview;

        return (
          <div className="space-y-6">
            {/* 뒤로가기 */}
            <button
              onClick={() => setSelectedReview(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로 돌아가기
            </button>

            {/* 카테고리 + 제목 */}
            <div className="space-y-2 pb-5 border-b border-slate-200">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{rev.category}</span>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">{rev.title}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                <span>{rev.author} 님</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />조회 {mockViews(rev.id).toLocaleString()}</span>
                <span>·</span>
                <span>{mockDate(rev.id)} 작성</span>
              </div>
            </div>

            {/* 후기 내용 */}
            <div className="space-y-2">
              <p className="text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-line">{rev.content}</p>
            </div>

            {/* 태그 */}
            {rev.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {rev.tags.map(t => (
                  <span key={t} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{t}</span>
                ))}
              </div>
            )}

            {/* 담당 변호사 정보 + 상담 신청 */}
            <div className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700">담당 변호사</h3>
              <div className="flex items-center gap-3">
                <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                <div>
                  <span className="text-sm font-bold text-slate-800">{rev.lawyerName} 변호사</span>
                  <span className="text-xs text-slate-400 ml-2">도산 전담</span>
                </div>
              </div>
              <button
                onClick={() => onReviewClick(rev)}
                className="w-full text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <HeartHandshake className="w-4 h-4" />
                이 변호사에게 동일 사건 상담 신청
              </button>
            </div>
          </div>
        );
      })() : (
      <>
      {/* Page Header */}
      <div className="space-y-2 pt-2 pb-4 border-b border-slate-200">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
          나와 비슷한 상황의<br className="md:hidden" />
          상담 후기를 찾아보세요.
        </h1>
        <p className="text-sm text-slate-500">※ 후기는 실제 상담 이용자의 주관적 의견이며, 개별 사례마다 결과가 다를 수 있습니다.</p>
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
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setPage(1); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-slate-500 font-medium shrink-0">
            검색 결과: <strong className="text-slate-900">{filteredReviews.length}</strong>건
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
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
            onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); setPage(1); }}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {paginatedReviews.map(rev => {
            const views = mockViews(rev.id);
            const date = mockDate(rev.id);

            return (
              <div key={rev.id} className="py-5 first:pt-0">
                {/* Category */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500">{rev.category}</span>
                </div>

                {/* Title */}
                <h3
                  className="text-base md:text-lg font-bold text-slate-900 leading-snug mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => setSelectedReview(rev)}
                >
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
                  <div className="flex items-center gap-1">
                    <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-3.5 h-3.5 rounded-full object-cover border border-slate-200" />
                    <span>{rev.lawyerName} 변호사</span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-slate-200">
          <button
            type="button"
            disabled={activePage === 1}
            onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
              activePage === 1
                ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            이전
          </button>
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                  activePage === pNum
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {pNum}
              </button>
            );
          })}
          <button
            type="button"
            disabled={activePage === totalPages}
            onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
              activePage === totalPages
                ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            다음
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
