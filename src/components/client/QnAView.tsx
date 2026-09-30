import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Lock, MessageSquare, SearchX } from 'lucide-react';
import type { ClientQA } from '../../types';
import { Badge, Button, Callout, Card, EmptyState, FilterChips, PageHeader, Pagination, SearchField } from './ui';
import { isLocalQuestion, isVerifiedExtraAnswer, isVerifiedQaAnswer } from './qaUtils';

/**
 * 상담 사례 (이전: '고민상담 Q&A' 게시판)
 * - 게시판에 올린 질문은 변호사에게 전달되지 않았는데 '답변을 기다려 주세요'로 안내하던 구조 →
 *   '사례 열람 + 상담 요청'으로 바꿨다. 질문 작성 폼은 없애고, 사례마다 '이 사례로 상담 요청하기'를 둔다.
 * - 변호사가 실제로 단 답변만 변호사 이름으로 표시하고, 그 밖은 '답변 예시'로 표시한다(qaUtils).
 * - 근거 없는 조회수·'정확도순' 정렬·'전문' 배지는 표시하지 않는다.
 * - 답변 없는 질문·남의 비밀 글은 목록에 두지 않는다(이 기기에서 쓴 질문만 예외).
 */

const ALL = '전체';
const ITEMS_PER_PAGE = 10;

interface QnAViewProps {
  qas: ClientQA[];
  /** 사례로 상담 요청: 내 상황 체크를 시작하면서 요청 제목·내용을 채운다 */
  onConsultRequest: (title: string, content: string) => void;
  initialCategory?: string;
}

/** 예전 질문 작성 폼이 이 브라우저 세션에 남긴 작성자 ID (비밀 글·내 질문 판별용, 새로 만들지 않는다) */
const readSessionAuthorId = (): string => {
  try {
    return sessionStorage.getItem('qa_author_id') || '';
  } catch {
    return '';
  }
};

type ShownAnswer = { key: string; text: string; verified: boolean; lawyerName?: string };

const answersOf = (qa: ClientQA): ShownAnswer[] => {
  const list: ShownAnswer[] = [];
  if (qa.answer) list.push({ key: 'main', text: qa.answer, verified: isVerifiedQaAnswer(qa), lawyerName: qa.lawyerName });
  (qa.additionalAnswers || []).forEach((a, i) => {
    if (a?.answer) list.push({ key: `extra-${i}`, text: a.answer, verified: isVerifiedExtraAnswer(a), lawyerName: a.lawyerName });
  });
  return list;
};

const answerLabel = (a: ShownAnswer) =>
  a.verified && a.lawyerName ? `${a.lawyerName.replace(/\s*변호사$/, '')} 변호사 답변` : '답변 예시';

const qaTime = (qa: ClientQA) => {
  const t = qa.createdAt ? new Date(qa.createdAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/** 최근 30일 안이면 'N일 전', 그보다 오래되면 날짜 */
const formatWhen = (createdAt?: string) => {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}일 전`;
  return d.toLocaleDateString('ko-KR');
};

export default function QnAView({ qas, onConsultRequest, initialCategory }: QnAViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || ALL);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const authorId = useMemo(() => readSessionAuthorId(), []);

  useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
      setPage(1);
    }
  }, [initialCategory]);

  const isHidden = (qa: ClientQA) => !!qa.isSecret && !isLocalQuestion(qa, authorId);

  // 사례로 보여 줄 글: 읽을 수 있는 답변이 있는 글만. 답변 없는 질문·남의 비밀 글은 열어 봐도 얻을 게 없어 목록에서 뺀다.
  // 이 기기에서 쓴 질문은 예외로 남긴다(변호사에게 전달되지 않았다는 안내와 '이 내용으로 상담 요청'을 보여 주기 위해)
  const visibleQas = useMemo(
    () => qas.filter((qa) => qa && (isLocalQuestion(qa, authorId) || (!qa.isSecret && answersOf(qa).length > 0))),
    [qas, authorId],
  );

  // 분야 칩: 실제 사례가 있는 분야만 (건수 많은 순). 외부에서 지정한 분야는 0건이어도 보여 준다
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    visibleQas.forEach((q) => { if (q?.category) counts.set(q.category, (counts.get(q.category) || 0) + 1); });
    if (initialCategory && initialCategory !== ALL && !counts.has(initialCategory)) counts.set(initialCategory, 0);
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
    return [{ value: ALL, label: ALL, count: visibleQas.length }, ...cats.map(([value, count]) => ({ value, label: value, count }))];
  }, [visibleQas, initialCategory]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleQas
      .filter((qa) => {
        if (categoryFilter !== ALL && qa.category !== categoryFilter) return false;
        if (!query) return true;
        if (isHidden(qa)) return qa.category.toLowerCase().includes(query);
        const answers = answersOf(qa);
        return (
          qa.question.toLowerCase().includes(query) ||
          qa.category.toLowerCase().includes(query) ||
          (qa.content || '').toLowerCase().includes(query) ||
          answers.some((a) => a.text.toLowerCase().includes(query))
        );
      })
      .map((qa, i) => ({ qa, i }))
      .sort((a, b) => qaTime(b.qa) - qaTime(a.qa) || a.i - b.i)
      .map((x) => x.qa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleQas, categoryFilter, searchQuery, authorId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const activePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const selected = selectedId ? qas.find((q) => q.id === selectedId) || null : null;

  const openCase = (id: string) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  };
  const closeCase = () => {
    setSelectedId(null);
    window.scrollTo({ top: 0 });
  };
  const resetFilters = () => {
    setCategoryFilter(ALL);
    setSearchQuery('');
    setPage(1);
  };
  const consultFromCase = (qa: ClientQA) => {
    const local = isLocalQuestion(qa, authorId);
    onConsultRequest(
      `${qa.category} 관련 상담 요청`,
      local
        ? `${qa.question}${qa.content ? `\n\n${qa.content}` : ''}`
        : `참고한 상담 사례:\nQ. ${qa.question}\n\n위 사례와 비슷한 상황입니다. 제 경우에도 해당하는지 상담받고 싶습니다.`,
    );
  };

  // ── 사례 상세 ──
  if (selected) {
    const qa = selected;
    const hidden = isHidden(qa);
    const local = isLocalQuestion(qa, authorId);
    const answers = answersOf(qa);
    return (
      <div className="animate-fadeIn text-left">
        <PageHeader
          back={{ label: '사례 목록', onClick: closeCase }}
          title={hidden ? '비밀 글이에요' : qa.question}
          description={hidden ? '비밀 글은 작성한 기기에서만 볼 수 있어요.' : undefined}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{qa.category}</Badge>
            {qa.isSecret && <Badge icon={<Lock className="h-3 w-3" aria-hidden="true" />}>비밀 글</Badge>}
            {local && <Badge tone="warning">이 기기에만 저장된 질문</Badge>}
            {qa.createdAt && <span className="text-sm text-slate-600">{formatWhen(qa.createdAt)}</span>}
          </div>
        </PageHeader>

        {!hidden && (
          <div className="space-y-4">
            {qa.content && (
              <Card as="section" padded={false} className="p-5">
                <h2 className="text-sm font-bold text-slate-600">질문 내용</h2>
                <p className="mt-2 text-base leading-relaxed text-slate-800 whitespace-pre-line break-keep">{qa.content}</p>
              </Card>
            )}

            {answers.length > 0 ? (
              answers.map((a) => (
                <Card key={a.key} as="section" padded={false} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.verified ? <Badge tone="success">변호사 답변</Badge> : <Badge>답변 예시</Badge>}
                    <h2 className="text-sm font-bold text-slate-800">{answerLabel(a)}</h2>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-slate-800 whitespace-pre-line break-keep">{a.text}</p>
                  {!a.verified && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 break-keep">
                      자주 받는 질문을 바탕으로 구성한 답변 예시예요. 실제 결과는 개별 사정과 법원 판단에 따라 달라져요.
                    </p>
                  )}
                </Card>
              ))
            ) : local ? (
              <Callout tone="warning" title="변호사에게 전달되지 않은 질문이에요">
                이 질문은 이 기기에만 저장돼 있어요. 답이 필요하면 아래에서 이 내용으로 상담을 요청해 주세요.
              </Callout>
            ) : (
              <Callout tone="neutral" title="아직 답변이 없어요">
                비슷한 상황이라면 아래에서 상담을 요청해 보세요.
              </Callout>
            )}
          </div>
        )}

        <Card as="section" padded={false} className="mt-6 p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900">비슷한 상황이라면</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 break-keep">
            약 3분 동안 내 상황을 체크하면, 원하는 변호사를 골라 상담을 요청할 수 있어요.
          </p>
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={() => consultFromCase(qa)}
            rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            {local ? '이 내용으로 상담 요청하기' : '이 사례로 상담 요청하기'}
          </Button>
        </Card>
      </div>
    );
  }

  // ── 사례 목록 ──
  return (
    <div className="animate-fadeIn text-left">
      <PageHeader
        title="상담 사례"
        description="회생·파산 상담에서 자주 받는 질문과 답변을 모았어요. 나와 비슷한 사례를 찾아보세요. 일반적인 안내이며, 내 사건은 변호사 상담으로 확인하세요."
        actions={
          <Button onClick={() => onConsultRequest('회생·파산 상담 요청', '')} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            내 상황으로 상담 요청하기
          </Button>
        }
      />

      <Callout tone="info" className="mb-6" icon={<MessageSquare className="h-4 w-4 text-sky-700" />}>
        여기 있는 답변은 대부분 자주 받는 질문을 바탕으로 만든 예시예요. 내 상황에 대한 답이 필요하면 상담을 요청해 주세요. 고른 변호사가 내 상황을 보고 답해요.
      </Callout>

      <div className="space-y-3">
        <SearchField
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setPage(1); }}
          label="상담 사례 검색"
          placeholder="예: 급여 압류, 코인 손실, 프리랜서"
        />
        <FilterChips
          options={categoryOptions}
          value={categoryFilter}
          onChange={(v) => { setCategoryFilter(v); setPage(1); }}
          label="분야"
        />
        <p className="text-sm text-slate-600" aria-live="polite">
          사례 <strong className="font-bold text-slate-900">{filtered.length}</strong>개
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="찾는 사례가 없어요"
          description="다른 검색어나 분야로 찾아보세요. 내 상황에 맞는 답이 필요하면 상담을 요청할 수 있어요."
          action={<Button variant="secondary" onClick={resetFilters}>조건 초기화</Button>}
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {pageItems.map((qa) => {
            const hidden = isHidden(qa);
            const local = isLocalQuestion(qa, authorId);
            const answers = answersOf(qa);
            const when = formatWhen(qa.createdAt);
            return (
              <li key={qa.id}>
                <button
                  type="button"
                  onClick={() => openCase(qa.id)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand/40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{qa.category}</Badge>
                    {qa.isSecret && <Badge icon={<Lock className="h-3 w-3" aria-hidden="true" />}>비밀 글</Badge>}
                    {local && <Badge tone="warning">이 기기에만 저장된 질문</Badge>}
                    {!hidden && answers.length > 0 && (answers[0].verified ? <Badge tone="success">변호사 답변</Badge> : <Badge>답변 예시</Badge>)}
                  </span>
                  <span className="mt-2 block text-base font-bold leading-snug text-slate-900 break-keep sm:text-lg">
                    {hidden ? '비밀 글이에요' : `Q. ${qa.question}`}
                  </span>
                  {!hidden && answers[0] && (
                    <span className="mt-2 block text-sm leading-relaxed text-slate-600 line-clamp-2 break-keep">{answers[0].text}</span>
                  )}
                  {!hidden && local && answers.length === 0 && (
                    <span className="mt-2 block text-sm leading-relaxed text-slate-600 break-keep">
                      변호사에게 전달되지 않은 질문이에요. 답이 필요하면 이 내용으로 상담을 요청해 주세요.
                    </span>
                  )}
                  <span className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span>
                      {answers.length > 0 ? `답변 ${answers.length}개` : '답변 없음'}
                      {when ? ` · ${when}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-bold text-brand whitespace-nowrap">
                      자세히 보기
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={activePage}
        totalPages={totalPages}
        onChange={(p) => { setPage(p); window.scrollTo({ top: 0 }); }}
      />
    </div>
  );
}
