import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Star } from 'lucide-react';
import type { ClientQA, SuccessReview } from '../../../types';
import { Badge, Button, SectionHeader, SegmentedTabs } from '../ui';
import { cn } from '../../../utils/cn';
import { isVerifiedQaAnswer } from '../qaUtils';

/**
 * 상담 사례 (기존 '이용 후기 마키' + '실시간 고민 해결 상담사례' 두 섹션을 탭 하나로 통합)
 * - 변호사가 실제로 답변한 항목(lawyerId + answeredAt)만 변호사 이름을 표시하고,
 *   시드 예시는 '답변 예시'로 표시한다(가상의 변호사 명의 노출 방지).
 * - 자동으로 흐르는 마키는 쓰지 않는다(읽기 어려움, reduced-motion 미대응).
 */
interface CasesSectionProps {
  qas: ClientQA[];
  reviews: SuccessReview[];
  onConsultFromQa: (qa: ClientQA) => void;
  onViewAllQna: () => void;
  onViewAllReviews: () => void;
}

type CaseTab = 'qna' | 'reviews';

const isVerifiedAnswer = isVerifiedQaAnswer;

function QaItem({ qa, onConsult, className }: { qa: ClientQA; onConsult: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const verified = isVerifiedAnswer(qa);
  const panelId = `landing-qa-${qa.id}`;
  return (
    <li className={cn('rounded-2xl border border-slate-200 bg-white overflow-hidden', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="min-w-0 space-y-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{qa.category}</Badge>
            {!verified && <Badge>답변 예시</Badge>}
          </span>
          <span className="block font-bold text-base sm:text-lg text-slate-900 leading-snug break-keep">Q. {qa.question}</span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 pt-1 text-sm font-bold text-brand whitespace-nowrap">
          {open ? '닫기' : '답변 보기'}
          <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div id={panelId} className="px-5 pb-5 pt-4 border-t border-slate-100 bg-slate-50/60 space-y-4 animate-fadeIn">
          <p className="text-sm font-bold text-slate-700">{verified ? `${qa.lawyerName} 답변` : '답변 예시'}</p>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-keep">{qa.answer}</p>
          {!verified && (
            <p className="text-xs text-slate-500 leading-relaxed">
              자주 받는 질문을 바탕으로 구성한 답변 예시입니다. 실제 결과는 개별 사정과 법원 판단에 따라 달라집니다.
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={onConsult} className="min-h-11">
              비슷한 내용으로 상담 요청
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function ReviewCard({ rev, className }: { rev: SuccessReview; className?: string }) {
  return (
    <li className={cn('rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {rev.isExample ? (
          <>
            {/* 가상 예시에는 별점·이용 인증을 붙이지 않는다 */}
            <Badge>예시(가상)</Badge>
            <Badge tone="brand">{rev.category}</Badge>
          </>
        ) : (
          <>
            {typeof rev.rating === 'number' && (
              <span className="inline-flex items-center gap-0.5 mr-1" aria-label={`별점 ${rev.rating}점 (5점 만점)`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} aria-hidden="true" className={cn('w-4 h-4', i <= (rev.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                ))}
              </span>
            )}
            <Badge tone="brand">{rev.tags?.[0] || rev.category || '개인회생'}</Badge>
          </>
        )}
      </div>
      <h3 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">{rev.title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed line-clamp-4 break-keep">{rev.isExample ? rev.content : `“${rev.content}”`}</p>
      <p className="mt-auto pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
        {rev.isExample
          ? '실제 이용자 후기가 아닌 상담 절차 설명용 가상 예시입니다. 결과는 개별 사정과 법원 판단에 따라 달라집니다.'
          : `${rev.author} · 후기는 이용자의 주관적 의견이며, 사건 결과는 개별 사정에 따라 다릅니다.`}
      </p>
    </li>
  );
}

export default function CasesSection({ qas, reviews, onConsultFromQa, onViewAllQna, onViewAllReviews }: CasesSectionProps) {
  const qaItems = qas.slice(0, 3);
  const reviewItems = reviews.slice(0, 3);
  const available: CaseTab[] = [...(qaItems.length ? (['qna'] as const) : []), ...(reviewItems.length ? (['reviews'] as const) : [])];
  const [tab, setTab] = useState<CaseTab>('qna');
  if (available.length === 0) return null;
  const current: CaseTab = available.includes(tab) ? tab : available[0];

  return (
    <section className="w-full py-12 md:py-16 bg-slate-50 border-b border-slate-200" aria-labelledby="landing-cases-title">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="landing-cases-title"
          align="center"
          title="상담 사례와 이용 후기"
          description="비슷한 고민에 어떤 내용을 확인하는지, 상담이 어떻게 진행되는지 살펴보세요."
        />

        {available.length > 1 && (
          <SegmentedTabs<CaseTab>
            ariaLabel="상담 사례 종류"
            idPrefix="landing-cases"
            value={current}
            onChange={setTab}
            tabs={[
              { id: 'qna', label: '상담 사례' },
              { id: 'reviews', label: '이용 후기' },
            ]}
            className="max-w-sm mx-auto mb-8"
          />
        )}

        {current === 'qna' ? (
          <div role={available.length > 1 ? 'tabpanel' : undefined} id="landing-cases-panel-qna" aria-labelledby={available.length > 1 ? 'landing-cases-tab-qna' : undefined}>
            <ul className="space-y-3">
              {qaItems.map((qa, idx) => (
                // 모바일은 2건만 보여 주고 나머지는 '더 보기'로
                <QaItem key={qa.id} qa={qa} onConsult={() => onConsultFromQa(qa)} className={idx >= 2 ? 'hidden sm:block' : undefined} />
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={onViewAllQna} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                상담 사례 더 보기
              </Button>
            </div>
          </div>
        ) : (
          <div role={available.length > 1 ? 'tabpanel' : undefined} id="landing-cases-panel-reviews" aria-labelledby={available.length > 1 ? 'landing-cases-tab-reviews' : undefined}>
            <ul className="grid gap-4 md:grid-cols-3">
              {reviewItems.map((rev, idx) => (
                <ReviewCard key={rev.id} rev={rev} className={idx >= 2 ? 'hidden md:flex' : undefined} />
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={onViewAllReviews} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                이용 후기 더 보기
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
