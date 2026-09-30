import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { NewsArticle } from '../../../types';
import { Badge, Button, SectionHeader } from '../ui';

/** 알아두면 좋을 법률 정보 (관리자 설정 showLegalNews가 켜진 경우에만 노출) */
export default function LegalNewsSection({
  articles,
  onOpenArticle,
  onViewAll,
}: {
  articles: NewsArticle[];
  onOpenArticle: (article: NewsArticle) => void;
  onViewAll: () => void;
}) {
  const items = articles.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section className="w-full py-12 md:py-16 bg-white border-b border-slate-200" aria-labelledby="landing-news-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="landing-news-title"
          title="알아두면 좋을 법률 정보"
          description="회생·파산 절차와 채무 관리에 도움이 되는 글입니다."
          action={
            <Button variant="ghost" onClick={onViewAll} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
              전체 보기
            </Button>
          }
        />
        <ul className="grid gap-5 md:grid-cols-3">
          {items.map((art) => (
            <li key={art.id}>
              <button
                type="button"
                onClick={() => onOpenArticle(art)}
                className="group w-full h-full text-left rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col hover:shadow-md transition-shadow active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="relative block aspect-video w-full overflow-hidden bg-slate-100">
                  {art.imageUrl && (
                    <img src={art.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  )}
                  {art.badge && (
                    <span className="absolute top-3 left-3">
                      <Badge tone="brand">{art.badge}</Badge>
                    </span>
                  )}
                </span>
                <span className="flex-1 p-5 flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-500">{art.category}</span>
                  <span className="font-bold text-base text-slate-900 leading-snug line-clamp-2 group-hover:text-brand transition-colors break-keep">{art.title}</span>
                  <span className="text-sm text-slate-600 leading-relaxed line-clamp-2 break-keep">{art.excerpt}</span>
                  {art.authorName && <span className="mt-auto pt-3 text-sm font-semibold text-slate-600">{art.authorName}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
