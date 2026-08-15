import React, { useState } from 'react';
import { Search, X, AlertTriangle, Eye, ChevronDown, ChevronUp, ArrowLeft, Star } from 'lucide-react';
import { ClientQA } from '../../types';

const QNA_CATEGORIES = ['전체', '코인/주식 손실', '급여 압류', '프리랜서 회생', '배우자 재산', '전세사기 피해', '최근 대출 회생', '자영업자 회생', '전문직 면허보존', '추심 차단', '개인파산 면책', '일용직 소득증빙', '보정권고 지연', '해외선물/주식'];
const ITEMS_PER_PAGE = 10;

interface QnAViewProps {
  qas: ClientQA[];
  onConsultRequest: (title: string, content: string) => void;
}

export default function QnAView({ qas, onConsultRequest }: QnAViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [page, setPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'accuracy' | 'latest' | 'question' | 'views'>('latest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedQA, setSelectedQA] = useState<ClientQA | null>(null);

  const filteredQAs = qas.filter(qa => {
    if (categoryFilter !== '전체' && qa.category !== categoryFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return qa.question.toLowerCase().includes(query) ||
           qa.category.toLowerCase().includes(query) ||
           qa.answer.toLowerCase().includes(query) ||
           qa.lawyerName.toLowerCase().includes(query);
  });

  const totalPages = Math.ceil(filteredQAs.length / ITEMS_PER_PAGE);
  const activePage = Math.min(page, Math.max(1, totalPages));
  const paginatedQAs = filteredQAs.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mockViews = (id: string) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return (hash * 1337 % 500000) + 10000;
  };
  const mockDate = (id: string) => {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const mins = hash % 60;
    return mins === 0 ? '방금' : `${mins}분 전`;
  };

  const getTotalAnswers = (qa: ClientQA) => 1 + (qa.additionalAnswers?.length || 0);

  return (
    <div className="space-y-5 animate-fadeIn text-left font-sans">
      {/* ── 상세 보기 ── */}
      {selectedQA ? (() => {
        const qa = selectedQA;
        const allAnswers = [
          { lawyerName: qa.lawyerName, lawyerAvatar: qa.lawyerAvatar, answer: qa.answer, badge: qa.badge },
          ...(qa.additionalAnswers || [])
        ];

        return (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedQA(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로 돌아가기
            </button>

            {/* 카테고리 + 질문 */}
            <div className="space-y-3 pb-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{qa.category}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">Q. {qa.question}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{qa.author}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />조회 {mockViews(qa.id).toLocaleString()}</span>
                <span>·</span>
                <span>답변 {allAnswers.length}개</span>
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /></span>
              </div>
            </div>

            {/* 모든 변호사 답변 */}
            <div className="space-y-0 divide-y divide-slate-100">
              {allAnswers.map((ans, idx) => (
                <div key={idx} className="py-5 first:pt-0">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-xs font-bold text-blue-600">답변</span>
                    <img src={ans.lawyerAvatar} alt={ans.lawyerName} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                    <span className="text-sm font-bold text-slate-800">{ans.lawyerName}</span>
                    {idx === 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-auto">대표 답변</span>}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line mb-3">{ans.answer}</p>
                  <button
                    onClick={() => onConsultRequest(
                      `${qa.category} 관련 법률 상담 신청`,
                      `고민 사례 질문:\nQ. ${qa.question}\n\n위 Q&A를 참고하여 ${ans.lawyerName}님께 유사 사건 상담을 신청합니다.`
                    )}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    이 변호사에게 상담 신청
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })() : (
      <>
      {/* Header */}
      <div className="space-y-1 pt-2 pb-4 border-b border-slate-200">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">상담사례</h1>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-4 text-sm text-slate-500 border-b border-slate-100 pb-3">
        {([
          { key: 'accuracy' as const, label: '정확도순' },
          { key: 'latest' as const, label: '최신 답변순' },
          { key: 'question' as const, label: '최신 질문순' },
          { key: 'views' as const, label: '조회순' },
        ]).map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <span className="text-slate-300">·</span>}
            <button
              onClick={() => setSortBy(s.key)}
              className={`font-semibold cursor-pointer transition-colors ${sortBy === s.key ? 'text-slate-900' : 'hover:text-slate-700'}`}
            >
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="사례 키워드 또는 변호사 검색..."
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
            <strong className="text-slate-900">{filteredQAs.length}</strong>개 검색됨 (총 {qas.length}개)
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QNA_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all border cursor-pointer ${
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

      {/* Q&A List */}
      {filteredQAs.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="font-semibold text-base text-slate-900">일치하는 상담사례가 없습니다.</h4>
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
          {paginatedQAs.map(qa => {
            const totalAnswers = getTotalAnswers(qa);
            const others = qa.additionalAnswers || [];
            const isExpanded = expandedIds.has(qa.id);
            const views = mockViews(qa.id);
            const date = mockDate(qa.id);

            return (
              <div key={qa.id} className="py-5 first:pt-0">
                {/* Category tags */}
                <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
                  <span className="font-semibold">{qa.category}</span>
                </div>

                {/* Question */}
                <h3
                  className="text-base md:text-lg font-bold text-slate-900 leading-snug mb-3 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => { setSelectedQA(qa); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  {qa.question}
                </h3>

                {/* Primary answer */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs font-bold text-blue-600">답변</span>
                    <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4 h-4 rounded-full object-cover border border-slate-200" />
                    <span className="text-xs font-semibold text-slate-700">{qa.lawyerName}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{qa.answer}</p>
                </div>

                {/* Other answers toggle */}
                {others.length > 0 && (
                  <div className="mb-3">
                    {isExpanded && (
                      <div className="space-y-3 mb-2 pl-3 border-l-2 border-slate-200">
                        {others.map((other, idx) => (
                          <div key={idx}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs font-bold text-blue-600">답변</span>
                              <img src={other.lawyerAvatar} alt={other.lawyerName} className="w-4 h-4 rounded-full object-cover border border-slate-200" />
                              <span className="text-xs font-semibold text-slate-700">{other.lawyerName}</span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{other.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleExpand(qa.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="flex -space-x-1.5 mr-1">
                        {others.slice(0, 3).map((o, i) => (
                          <img key={i} src={o.lawyerAvatar} alt={o.lawyerName} className="w-5 h-5 rounded-full border-2 border-white object-cover" />
                        ))}
                      </div>
                      <span>다른 변호사 답변 {others.length}개</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />조회수 {views.toLocaleString()}</span>
                  <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /></span>
                  <span className="ml-auto">{date} 답변 작성됨</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-6 border-t border-slate-200">
          <button type="button" disabled={activePage === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${activePage === 1 ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
            이전
          </button>
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            return (
              <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${activePage === pNum ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
                {pNum}
              </button>
            );
          })}
          <button type="button" disabled={activePage === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${activePage === totalPages ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
            다음
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
