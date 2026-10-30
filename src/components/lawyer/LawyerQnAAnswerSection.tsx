import React, { useState } from 'react';
import { MessageSquare, Send, Lock, Eye, ChevronDown, ChevronUp, Search, X, HelpCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ClientQA, QAAnswer, User } from '../../types';
import { toast } from 'sonner';
import { answerClientQa } from '../../services/cms/contentService';
import { DEFAULT_PROHIBITED_EXPRESSIONS, findProhibitedExpressions } from '../../services/proposalCompliance';

// 서버 함수 qna_flagged_terms 와 같은 목록 (20261030000500_cms_server_content.sql)
const QNA_EXTRA_TERMS = ['전액 탕감', '탕감 보장', '최대 90%', '성공률', '승소율', '전담 변호사', '변호사 배정', '매칭'];
const QNA_TERMS = [...DEFAULT_PROHIBITED_EXPRESSIONS, ...QNA_EXTRA_TERMS];

const ANSWER_MAX_LENGTH = 3000;
const ANSWER_MIN_LENGTH = 10;
const ITEMS_PER_PAGE = 10;

const QNA_CATEGORIES = ['전체', '코인/주식 손실', '급여 압류', '프리랜서 회생', '배우자 재산', '전세사기 피해', '최근 대출 회생', '자영업자 회생', '전문직 면허보존', '추심 차단', '개인파산 면책', '일용직 소득증빙', '보정권고 지연', '해외선물/주식'];

interface LawyerQnAAnswerSectionProps {
  qas: ClientQA[];
  setQas?: React.Dispatch<React.SetStateAction<ClientQA[]>>;
  currentLawyer: User;
}

export default function LawyerQnAAnswerSection({ qas, setQas, currentLawyer }: LawyerQnAAnswerSectionProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'waiting' | 'answered' | 'secret'>('all');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQaId, setExpandedQaId] = useState<string | null>(null);
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  // 금지 표현 경고를 본 답변 (같은 내용으로 한 번 더 누르면 검토 대기로 보냄)
  const [warned, setWarned] = useState<Record<string, { text: string; terms: string[] }>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});

  const handleFilterModeChange = (mode: 'all' | 'waiting' | 'answered' | 'secret') => {
    setFilterMode(mode);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (cat: string) => {
    setCategoryFilter(cat);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const filteredQAs = qas.filter(qa => {
    // Filter mode
    if (filterMode === 'waiting') {
      const isWaiting = qa.status === 'waiting' || (!qa.answer && (!qa.additionalAnswers || qa.additionalAnswers.length === 0));
      if (!isWaiting) return false;
    }
    if (filterMode === 'answered') {
      const isAnswered = qa.answer || (qa.additionalAnswers && qa.additionalAnswers.length > 0);
      if (!isAnswered) return false;
    }
    if (filterMode === 'secret') {
      if (!qa.isSecret) return false;
    }
    // Category
    if (categoryFilter !== '전체' && qa.category !== categoryFilter) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return qa.question.toLowerCase().includes(q) || qa.category.toLowerCase().includes(q) || qa.author.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredQAs.length / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const pagedQAs = filteredQAs.slice((validPage - 1) * ITEMS_PER_PAGE, validPage * ITEMS_PER_PAGE);

  const waitingCount = qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length;
  const secretCount = qas.filter(q => q.isSecret).length;

  const hasAlreadyAnswered = (qa: ClientQA): boolean => {
    if (!currentLawyer) return false;
    // Check primary answer (ID가 있으면 ID로, 과거 데이터는 이름으로)
    if (qa.answer && (qa.lawyerId ? qa.lawyerId === currentLawyer.id : qa.lawyerName === currentLawyer.name)) return true;
    // Check additional answers
    if ((qa.pendingAnswers || []).some(a => a.lawyerId === currentLawyer.id)) return true;
    return (qa.additionalAnswers || []).some(a => a.lawyerId === currentLawyer.id || a.lawyerName === currentLawyer.name);
  };

  const handleSubmitAnswer = async (qaId: string) => {
    const text = (answerTexts[qaId] || '').trim();
    setAnswerErrors(prev => ({ ...prev, [qaId]: '' }));
    if (text.length < ANSWER_MIN_LENGTH) {
      setAnswerErrors(prev => ({ ...prev, [qaId]: `답변은 최소 ${ANSWER_MIN_LENGTH}자 이상 입력해 주세요.` }));
      return;
    }
    if (!setQas || submittingId) return;
    const target = qas.find(q => q.id === qaId);
    if (target && hasAlreadyAnswered(target)) {
      setAnswerErrors(prev => ({ ...prev, [qaId]: '이미 답변한 질문입니다.' }));
      return;
    }
    // 광고 규정 금지 표현: 처음엔 경고만, 같은 내용으로 다시 누르면 관리자 검토 대기로 보낸다
    const terms = findProhibitedExpressions(text, undefined, QNA_TERMS);
    if (terms.length > 0 && warned[qaId]?.text !== text) {
      setWarned(prev => ({ ...prev, [qaId]: { text, terms } }));
      return;
    }

    setSubmittingId(qaId);
    const res = await answerClientQa(qaId, text);
    setSubmittingId(null);
    if (res.ok === false) {
      setAnswerErrors(prev => ({ ...prev, [qaId]: res.message }));
      return;
    }
    const nextData = res.data.data;
    if (nextData) setQas(prev => prev.map(qa => (qa.id === qaId ? { ...qa, ...nextData, id: qa.id } : qa)));
    setAnswerTexts(prev => ({ ...prev, [qaId]: '' }));
    setWarned(prev => { const n = { ...prev }; delete n[qaId]; return n; });
    if (res.data.held) {
      toast.info('관리자 검토 뒤 게시됩니다.', { description: `검토가 필요한 표현: ${res.data.flaggedTerms.join(', ')}` });
    } else {
      toast.success('답변을 게시했습니다.');
    }
  };

  const mockDate = (createdAt?: string) => {
    if (!createdAt) return '';
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-slate-700" />
            <span>고민상담 Q&A 답변 관리</span>
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed text-left">
            고객들의 법률 고민 질문에 전문 답변을 작성하세요. 양질의 답변은 변호사님의 전문성을 홍보하는 효과가 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold px-3.5 py-1.5 rounded-xl whitespace-nowrap">
            답변 대기 {waitingCount}건
          </span>
          <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3.5 py-1.5 rounded-xl whitespace-nowrap">
            전체 {qas.length}건
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2.5">
        {([
          { key: 'all' as const, label: '전체 질문', count: qas.length },
          { key: 'waiting' as const, label: '답변 대기', count: waitingCount },
          { key: 'answered' as const, label: '답변 완료', count: qas.length - waitingCount },
          { key: 'secret' as const, label: '비밀 상담', count: secretCount },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => handleFilterModeChange(f.key)}
            className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
              filterMode === f.key
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Category + Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="질문 검색..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] focus:outline-none text-slate-900"
          />
          {searchQuery && (
            <button onClick={() => handleSearchChange('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={e => handleCategoryFilterChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 shrink-0"
        >
          {QNA_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Q&A List */}
      {filteredQAs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center space-y-3 shadow-xs">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-base text-slate-700">해당 조건의 질문이 없습니다</h4>
          <p className="text-sm text-slate-500">필터를 변경하거나 검색어를 확인해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pagedQAs.map(qa => {
            const isExpanded = expandedQaId === qa.id;
            const isWaiting = qa.status === 'waiting' || (!qa.answer && (!qa.additionalAnswers || qa.additionalAnswers.length === 0));
            const totalAnswers = (qa.answer ? 1 : 0) + (qa.additionalAnswers?.length || 0);
            const alreadyAnswered = hasAlreadyAnswered(qa);
            const currentAnswerText = answerTexts[qa.id] || '';

            return (
              <div key={qa.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all shadow-xs hover:border-slate-300">
                {/* Question Header */}
                <div
                  onClick={() => setExpandedQaId(isExpanded ? null : qa.id)}
                  className="p-5 md:p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">{qa.category}</span>
                        {qa.isSecret && (
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-slate-500" />비밀
                          </span>
                        )}
                        {isWaiting ? (
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">답변 대기</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />답변 {totalAnswers}개
                          </span>
                        )}
                        {alreadyAnswered && (
                          <span className="text-xs font-bold text-white bg-[#1E3A5F] px-2.5 py-0.5 rounded-md">내 답변 있음</span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-base md:text-lg text-slate-900 leading-snug">Q. {qa.question}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                        <span>{qa.author}</span>
                        {qa.createdAt && (
                          <>
                            <span>·</span>
                            <span>{mockDate(qa.createdAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 animate-fadeIn">
                    {/* Question Detail */}
                    {qa.content && (
                      <div className="px-6 py-5 bg-slate-50/50">
                        <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap text-left">{qa.content}</p>
                      </div>
                    )}

                    {/* Existing Answers */}
                    {totalAnswers > 0 && (
                      <div className="px-6 py-5 space-y-3.5 border-t border-slate-100">
                        <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider">기존 답변 ({totalAnswers}개)</h5>
                        <div className="space-y-3">
                          {qa.answer && (
                            <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-left">
                              <div className="flex items-center gap-2.5 mb-2.5">
                                {qa.lawyerAvatar && <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-7 h-7 rounded-full object-cover border border-slate-200" />}
                                <span className="text-sm font-bold text-slate-800">{qa.lawyerName}</span>
                                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md ml-auto">대표 답변</span>
                              </div>
                              <p className="text-sm sm:text-base text-slate-700 leading-relaxed line-clamp-3">{qa.answer}</p>
                            </div>
                          )}
                          {(qa.additionalAnswers || []).map((ans, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left">
                              <div className="flex items-center gap-2.5 mb-2.5">
                                {ans.lawyerAvatar && <img src={ans.lawyerAvatar} alt={ans.lawyerName} className="w-7 h-7 rounded-full object-cover border border-slate-200" />}
                                <span className="text-sm font-bold text-slate-800">{ans.lawyerName}</span>
                                {ans.badge && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md ml-auto">{ans.badge}</span>}
                              </div>
                              <p className="text-sm sm:text-base text-slate-700 leading-relaxed line-clamp-3">{ans.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Answer Form */}
                    {setQas && (
                      <div className="px-6 py-5 border-t border-slate-200 bg-white space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {currentLawyer.avatar && <img src={currentLawyer.avatar} alt={currentLawyer.name} className="w-7 h-7 rounded-full object-cover border border-slate-200" />}
                            <span className="text-sm font-bold text-slate-800">{currentLawyer.name} 답변 작성</span>
                          </div>
                          <span className={`text-xs font-semibold ${currentAnswerText.length > ANSWER_MAX_LENGTH ? 'text-red-500' : currentAnswerText.length > ANSWER_MAX_LENGTH * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {currentAnswerText.length} / {ANSWER_MAX_LENGTH}
                          </span>
                        </div>
                        <textarea
                          value={currentAnswerText}
                          onChange={e => setAnswerTexts(prev => ({ ...prev, [qa.id]: e.target.value }))}
                          maxLength={ANSWER_MAX_LENGTH}
                          rows={4}
                          disabled={alreadyAnswered}
                          placeholder={alreadyAnswered
                            ? "이미 답변한 질문입니다."
                            : "질문에 대한 일반적인 법률 정보를 작성해 주세요.\n결과를 보장하거나 단정하는 표현은 관리자 검토 뒤 게시됩니다."
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 font-medium text-slate-900 leading-relaxed resize-none placeholder:text-slate-400"
                        />
                        {warned[qa.id] && warned[qa.id].text === currentAnswerText.trim() && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-left">
                            광고 규정상 검토가 필요한 표현이 있습니다: <b>{warned[qa.id].terms.join(', ')}</b>. 고쳐서 등록하면 바로 게시되고, 그대로 한 번 더 누르면 관리자 검토 뒤 게시됩니다.
                          </p>
                        )}
                        {answerErrors[qa.id] && (
                          <p className="text-sm text-red-600 text-left" role="alert">{answerErrors[qa.id]}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            답변에는 변호사님의 이름과 사진이 함께 표시됩니다.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSubmitAnswer(qa.id)}
                            disabled={alreadyAnswered || submittingId === qa.id || currentAnswerText.trim().length < ANSWER_MIN_LENGTH}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap shadow-xs"
                          >
                            <Send className="w-4 h-4" />
                            {submittingId === qa.id ? '등록 중…' : warned[qa.id] && warned[qa.id].text === currentAnswerText.trim() ? '검토 요청으로 등록' : '답변 등록'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 페이지네이션 (10개 단위 이동) ── */}
      {filteredQAs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500 font-medium">
            전체 <span className="font-bold text-slate-800">{filteredQAs.length}</span>개 중{' '}
            <span className="font-bold text-slate-800">
              {(validPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(validPage * ITEMS_PER_PAGE, filteredQAs.length)}
            </span>
            개 표시 ({validPage} / {totalPages} 페이지)
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={validPage === 1}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="이전 10개 페이지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`min-w-[32px] h-8 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    validPage === p
                      ? 'bg-[#1E3A5F] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="다음 10개 페이지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

