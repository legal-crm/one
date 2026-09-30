import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, SearchX } from 'lucide-react';
import { SuccessReview } from '../../types';
import { Badge, Button, Callout, Card, EmptyState, FilterChips, PageHeader, Pagination, SearchField } from './ui';

interface ReviewsViewProps {
  reviews: SuccessReview[];
  onReviewClick: (rev: SuccessReview) => void;
}

const ALL = '전체';
const ITEMS_PER_PAGE = 10;

/**
 * 이용 후기 · 상담 절차 예시
 * - 이전: 최근 15건만 표시(나머지는 볼 수 없음), 분야 목록이 고정이라 없는 분야 칩이 보임
 *   → 전체를 페이지로 나눠 보여 주고, 분야 칩은 실제 글이 있는 분야만(건수 포함)
 * - 가상 예시(isExample)는 '예시(가상)'로 표시하고 별점·작성자·변호사 연결을 붙이지 않는다
 */
export default function ReviewsView({ reviews, onReviewClick }: ReviewsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 등록된 글이 모두 가상 상담 절차 예시인지 (실제 후기가 없는 상태)
  const allExamples = reviews.length > 0 && reviews.every((r) => r.isExample);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    reviews.forEach((r) => { if (r?.category) counts.set(r.category, (counts.get(r.category) || 0) + 1); });
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
    return [{ value: ALL, label: ALL, count: reviews.length }, ...cats.map(([value, count]) => ({ value, label: value, count }))];
  }, [reviews]);

  const query = searchQuery.trim().toLowerCase();
  const filtered = reviews.filter((rev) => {
    if (categoryFilter !== ALL && rev.category !== categoryFilter) return false;
    if (!query) return true;
    return (
      rev.title.toLowerCase().includes(query) ||
      rev.content.toLowerCase().includes(query) ||
      (!rev.isExample && (rev.lawyerName || '').toLowerCase().includes(query)) ||
      (rev.tags || []).some((t) => t.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const activePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const selected = selectedId ? reviews.find((r) => r.id === selectedId) || null : null;

  const open = (id: string | null) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  };
  const reset = () => {
    setCategoryFilter(ALL);
    setSearchQuery('');
    setPage(1);
  };

  // ── 상세 ──
  if (selected) {
    const rev = selected;
    return (
      <div className="mx-auto max-w-3xl animate-fadeIn text-left">
        <PageHeader
          back={{ label: allExamples ? '예시 목록' : '후기 목록', onClick: () => open(null) }}
          title={rev.title}
          description={rev.isExample ? '실제 이용 후기가 아닌, 상담 절차를 설명하기 위한 가상 예시예요.' : `${rev.author} 님의 후기`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {rev.isExample && <Badge>예시(가상)</Badge>}
            <Badge tone="brand">{rev.category}</Badge>
          </div>
        </PageHeader>

        <Card as="article" className="text-base leading-relaxed text-slate-800 whitespace-pre-line break-keep">
          {rev.content}
        </Card>

        {(rev.tags || []).length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="태그">
            {rev.tags.map((t) => (
              <li key={t} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">
                #{t.replace(/^#/, '')}
              </li>
            ))}
          </ul>
        )}

        {rev.isExample ? (
          <Card as="section" padded={false} className="mt-6 p-5">
            <p className="text-sm leading-relaxed text-slate-600 break-keep">
              특정 변호사의 사건이나 결과를 뜻하지 않아요. 실제 진행 여부와 결과는 개별 사정과 법원 판단에 따라 달라져요.
            </p>
            <Button className="mt-4 w-full sm:w-auto" onClick={() => onReviewClick(rev)} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              변호사 찾아보기
            </Button>
          </Card>
        ) : (
          <Card as="section" padded={false} className="mt-6 p-5">
            <h2 className="text-sm font-bold text-slate-600">담당 변호사</h2>
            <div className="mt-2 flex items-center gap-3">
              {rev.lawyerAvatar && <img src={rev.lawyerAvatar} alt="" className="h-10 w-10 rounded-full border border-slate-200 object-cover" />}
              <span className="text-base font-bold text-slate-900">{rev.lawyerName}</span>
            </div>
            <Button className="mt-4 w-full sm:w-auto" onClick={() => onReviewClick(rev)} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              이 변호사 프로필 보기
            </Button>
            <p className="mt-3 text-sm text-slate-600 break-keep">후기는 이용자의 주관적인 의견이며, 사건 결과는 개별 사정에 따라 달라요.</p>
          </Card>
        )}
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div className="animate-fadeIn text-left">
      <PageHeader
        title={allExamples ? '상담 절차 예시' : '이용 후기'}
        description={
          allExamples
            ? '상담이 어떤 순서로 진행되는지 보여 드리는 가상 예시예요. 실제 이용 후기가 아니며, 결과를 보장하지 않아요.'
            : '후기는 이용자의 주관적인 의견이며, 사건 결과는 개별 사정에 따라 달라요.'
        }
      />

      {!allExamples && reviews.some((r) => r.isExample) && (
        <Callout tone="neutral" className="mb-6">'예시(가상)'로 표시된 글은 실제 후기가 아니에요.</Callout>
      )}

      <div className="space-y-3">
        <SearchField value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} label="후기 검색" placeholder="예: 코인, 독촉, 프리랜서" />
        <FilterChips options={categoryOptions} value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} label="분야" />
        <p className="text-sm text-slate-600" aria-live="polite">
          {allExamples ? '예시' : '글'} <strong className="font-bold text-slate-900">{filtered.length}</strong>개
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
        <ul className="mt-4 space-y-3">
          {pageItems.map((rev) => (
            <li key={rev.id}>
              <button
                type="button"
                onClick={() => open(rev.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand/40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  {rev.isExample && <Badge>예시(가상)</Badge>}
                  <Badge tone="brand">{rev.category}</Badge>
                </span>
                <span className="mt-2 block text-base font-bold leading-snug text-slate-900 break-keep sm:text-lg">{rev.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-slate-600 line-clamp-2 break-keep">{rev.content}</span>
                <span className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span className="min-w-0 truncate">{rev.isExample ? '상담 절차 예시' : `${rev.author} 님 · ${rev.lawyerName}`}</span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-brand">
                    자세히 보기
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
