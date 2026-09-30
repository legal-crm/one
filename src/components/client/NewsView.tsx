import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, SearchX } from 'lucide-react';
import { NewsArticle } from '../../types';
import { Badge, Button, EmptyState, FilterChips, PageHeader, Pagination, SearchField } from './ui';

const ALL = '전체';
const ITEMS_PER_PAGE = 6;

interface NewsViewProps {
  newsArticles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  onUpdateViews: (id: string) => void;
}

/**
 * 법률 정보(칼럼·뉴스) 목록
 * - 분야 칩은 실제 글이 있는 분야만(건수 포함). 근거 없는 조회수·'HOT' 표시는 하지 않는다('NEW'만 표시)
 * - 카드 전체가 버튼(키보드로 열 수 있음)
 */
export default function NewsView({ newsArticles, onSelectArticle, onUpdateViews }: NewsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    newsArticles.forEach((a) => { if (a?.category) counts.set(a.category, (counts.get(a.category) || 0) + 1); });
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
    return [{ value: ALL, label: ALL, count: newsArticles.length }, ...cats.map(([value, count]) => ({ value, label: value, count }))];
  }, [newsArticles]);

  const query = searchQuery.trim().toLowerCase();
  const filtered = newsArticles.filter((art) => {
    const matchesCategory = categoryFilter === ALL || art.category === categoryFilter;
    if (!matchesCategory) return false;
    if (!query) return true;
    return (
      art.title.toLowerCase().includes(query) ||
      (art.excerpt || '').toLowerCase().includes(query) ||
      (art.content || '').toLowerCase().includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const activePage = Math.min(page, totalPages);
  const sliced = filtered.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);

  const reset = () => {
    setSearchQuery('');
    setCategoryFilter(ALL);
    setPage(1);
  };

  return (
    <div className="animate-fadeIn text-left">
      <PageHeader
        title="법률 정보"
        description="회생·파산 관련 칼럼과 소식이에요. 일반적인 정보이며 개별 사건에 대한 법률 자문이 아니에요. 내 상황은 변호사 상담으로 확인하세요."
      />

      <div className="space-y-3">
        <SearchField
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setPage(1); }}
          label="법률 정보 검색"
          placeholder="예: 코인, 압류, 금지명령"
        />
        <FilterChips options={categoryOptions} value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} label="분야" />
        <p className="text-sm text-slate-600" aria-live="polite">
          글 <strong className="font-bold text-slate-900">{filtered.length}</strong>개
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="찾는 글이 없어요"
          description="다른 검색어나 분야로 찾아보세요."
          action={<Button variant="secondary" onClick={reset}>조건 초기화</Button>}
        />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sliced.map((art) => (
            <li key={art.id} className="h-full">
              <button
                type="button"
                onClick={() => { onSelectArticle(art); onUpdateViews(art.id); }}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xs transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="relative block aspect-video w-full shrink-0 overflow-hidden bg-slate-100">
                  {art.imageUrl ? (
                    <img src={art.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-slate-400" aria-hidden="true">
                      <BookOpen className="h-8 w-8" />
                    </span>
                  )}
                  {art.badge === 'NEW' && <Badge tone="brand" className="absolute left-3 top-3">새 글</Badge>}
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-sm font-bold text-slate-600">
                    {art.category}
                    {art.date ? ` · ${art.date}` : ''}
                  </span>
                  <span className="mt-1.5 block text-base font-bold leading-snug text-slate-900 line-clamp-2 break-keep group-hover:text-brand sm:text-lg">
                    {art.title}
                  </span>
                  {art.excerpt && <span className="mt-2 block text-sm leading-relaxed text-slate-600 line-clamp-2 break-keep">{art.excerpt}</span>}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm">
                    <span className="min-w-0 truncate font-bold text-slate-700">{art.authorName ? `${art.authorName}` : ''}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-brand">
                      읽기
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={activePage} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0 }); }} />
    </div>
  );
}
