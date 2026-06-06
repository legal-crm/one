import React, { useState } from 'react';
import { BookOpen, ChevronRight, Search } from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  authorName: string;
  authorAvatar: string;
  views: number;
  badge?: string;
}

const NEWS_CATEGORIES = ['전체', '개인회생', '개인파산', '금지명령/추심', '변제금/생계비'];
const ITEMS_PER_PAGE = 6;

interface NewsViewProps {
  newsArticles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onUpdateViews: (id: string) => void;
}

export default function NewsView({ newsArticles, onSelectArticle, onUpdateViews }: NewsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [page, setPage] = useState(1);

  const filtered = newsArticles.filter(art => {
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === '전체' || art.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const sliced = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Page Header */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-200 text-xs font-extrabold rounded-full border border-indigo-500/30">
            <BookOpen className="w-3.5 h-3.5 text-brand" />
            <span>알아두면 좋을 법률 정보</span>
          </span>
          <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-tight">회생톡 법률 정보 &amp; 뉴스 센터</h1>
          <p className="text-slate-350 text-xs md:text-sm leading-relaxed">
            대한변협 등록 도산 전문 변호인단이 집필한 고품격 법률 칼럼과 뉴스입니다.<br/>
            최신 회생 실무 기준과 탕감 노하우를 확인하고 빚 독촉 위기를 신속하게 해결해 보세요.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="관심 있는 키워드나 제목을 입력해 검색하세요 (예: 코인, 압류)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full py-2 pl-9 pr-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-450"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-2.5 text-xs text-slate-405 hover:text-slate-700 font-bold">초기화</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {NEWS_CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => { setCategoryFilter(cat); setPage(1); }} className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${categoryFilter === cat ? 'bg-brand text-white border-brand shadow-sm shadow-brand/10' : 'bg-[#F8FAFC] dark:bg-slate-950 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 space-y-2">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 opacity-55 animate-pulse" />
          <p className="text-sm">검색 결과에 맞는 법률 칼럼이 존재하지 않습니다.</p>
          <p className="text-xs font-semibold text-[#7e7e8f]">다른 단어로 검색하시거나 카테고리를 변경해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sliced.map(art => (
              <div key={art.id} onClick={() => { onSelectArticle(art); onUpdateViews(art.id); }} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden cursor-pointer group text-left">
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-950 shrink-0">
                  <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {art.badge && (
                    <span className={`absolute top-3.5 left-3.5 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full text-white shadow-sm ${art.badge === 'HOT' ? 'bg-orange-500' : art.badge === 'NEW' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>{art.badge}</span>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold"><span>{art.category}</span><span>•</span><span>조회 {art.views}</span></div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-850 dark:text-slate-200 pr-2 leading-snug line-clamp-2 min-h-[38px] group-hover:text-brand dark:group-hover:text-brand-light transition-colors text-left">{art.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-405 leading-relaxed line-clamp-2 text-left">{art.excerpt}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
                    <div className="flex items-center gap-2">
                      <img src={art.authorAvatar} alt={art.authorName} className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" />
                      <span className="text-[10px] font-extrabold text-[#484760] dark:text-slate-400">By {art.authorName}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-350 dark:text-slate-655 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button type="button" disabled={page === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-305 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">이전</button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button key={pageNum} type="button" onClick={() => { setPage(pageNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${page === pageNum ? 'bg-brand text-white border-brand shadow-sm shadow-brand/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'}`}>{pageNum}</button>
                  );
                })}
              </div>
              <button type="button" disabled={page === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-305 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">다음</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
