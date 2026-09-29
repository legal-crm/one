import React, { useState } from 'react';
import { Search, X, AlertTriangle, ArrowLeft, HeartHandshake } from 'lucide-react';
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
  const [selectedReview, setSelectedReview] = useState<SuccessReview | null>(null);

  // 최근 15개만 표시 (FIFO)
  const recentReviews = reviews.slice(0, MAX_REVIEWS);
  // 등록된 글이 모두 가상 상담 절차 예시인지 (실제 후기가 없는 상태)
  const allExamples = recentReviews.length > 0 && recentReviews.every(r => r.isExample);

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

  // 이전: 후기 id 해시로 조회수(1만~51만)와 작성일을 만들어 표시하고 '조회순' 정렬을 제공 — 근거 없는 수치라 제거

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
              className="min-h-[44px] flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로 돌아가기
            </button>

            {/* 카테고리 + 제목 */}
            <div className="space-y-2 pb-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {rev.isExample && <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">예시(가상)</span>}
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{rev.category}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">{rev.title}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                {rev.isExample
                  ? <span>실제 이용 후기가 아닌 상담 절차 설명용 가상 예시입니다.</span>
                  : <span>{rev.author} 님</span>}
              </div>
            </div>

            {/* 본문 */}
            <div className="space-y-2">
              <p className="text-sm md:text-base text-slate-700 leading-relaxed whitespace-pre-line">{rev.content}</p>
            </div>

            {/* 태그 */}
            {rev.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {rev.tags.map(t => (
                  <span key={t} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{t.replace(/^#/, '')}</span>
                ))}
              </div>
            )}

            {rev.isExample ? (
              <div className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-200">
                <p className="text-sm text-slate-600 leading-relaxed">
                  특정 변호사의 사건이나 결과를 뜻하지 않습니다. 실제 진행 여부와 결과는 개별 사정과 법원 판단에 따라 달라집니다.
                </p>
                <button
                  onClick={() => onReviewClick(rev)}
                  className="w-full min-h-[44px] text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <HeartHandshake className="w-4 h-4" />
                  전문가 목록 보기
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700">담당 변호사</h3>
                <div className="flex items-center gap-3">
                  {rev.lawyerAvatar && <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />}
                  <span className="text-sm font-bold text-slate-800">{rev.lawyerName}</span>
                </div>
                <button
                  onClick={() => onReviewClick(rev)}
                  className="w-full min-h-[44px] text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <HeartHandshake className="w-4 h-4" />
                  이 변호사 프로필 보기
                </button>
                <p className="text-xs text-slate-500">후기는 이용자의 주관적 의견이며, 사건 결과는 개별 사정에 따라 다릅니다.</p>
              </div>
            )}
          </div>
        );
      })() : (
      <>
      {/* Page Header */}
      <div className="space-y-2 pt-2 pb-4 border-b border-slate-200">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">
          나와 비슷한 상황의<br className="md:hidden" />
          {allExamples ? ' 상담 절차 예시' : ' 상담 후기를 찾아보세요.'}
        </h1>
        <p className="text-sm text-slate-500">
          {allExamples
            ? '※ 실제 이용 후기가 아닌 가상 예시입니다. 상담이 어떤 순서로 진행되는지만 설명하며, 결과를 보장하지 않습니다.'
            : '※ 후기는 이용자의 주관적 의견이며, 사건 결과는 개별 사정에 따라 다릅니다. 예시(가상)로 표시된 글은 실제 후기가 아닙니다.'}
        </p>
      </div>

      {/* Filter and Search */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              aria-label="후기·예시 검색"
              placeholder="검색어 입력 (예: 코인, 독촉, 프리랜서)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-base focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <span className="text-sm text-slate-600 font-medium shrink-0">
            총 <strong className="text-slate-900 font-bold">{filteredReviews.length}</strong>건
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[44px] px-4 py-2 text-sm font-bold rounded-xl transition-all border cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
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
          <h4 className="font-semibold text-base text-slate-900">일치하는 글이 없습니다.</h4>
          <p className="text-sm text-slate-500">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
          <button
            onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); }}
            className="min-h-[44px] px-5 py-2 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {filteredReviews.map(rev => (
            <div key={rev.id} className="py-5.5 first:pt-0">
              {/* Category */}
              <div className="flex items-center gap-2 mb-2">
                {rev.isExample && <span className="text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">예시(가상)</span>}
                <span className="text-xs sm:text-sm font-bold text-[#1E3A5F] bg-[#EEF4FA] px-2.5 py-0.5 rounded-md">{rev.category}</span>
              </div>

              {/* Title - 클릭 시 상세 페이지 */}
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-2">
                <button
                  type="button"
                  className="text-left cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => { setSelectedReview(rev); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  {rev.title}
                </button>
              </h3>

              {/* Content preview */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed line-clamp-2 mb-3">
                {rev.content}
              </p>

              {/* Author + lawyer (실제 후기만) */}
              {!rev.isExample && (
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 font-medium">
                  <span className="font-bold text-slate-700">{rev.author}</span>
                  <span>·</span>
                  <div className="flex items-center gap-1.5">
                    {rev.lawyerAvatar && <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-5 h-5 rounded-full object-cover border border-slate-200" />}
                    <span className="font-semibold text-slate-700">{rev.lawyerName}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="text-center py-4 border-t border-slate-100">
        <p className="text-xs text-slate-500">최근 {MAX_REVIEWS}건까지 표시됩니다.</p>
      </div>
      </>
      )}
    </div>
  );
}
