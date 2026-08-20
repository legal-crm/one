import React, { useState, useMemo } from 'react';
import { Search, X, AlertTriangle, Eye, ChevronDown, ChevronUp, ArrowLeft, Star, Plus, Lock, Send, MessageSquare, HelpCircle, TrendingDown, Banknote, Briefcase, Users, Home, CreditCard, Store, GraduationCap, ShieldBan, FileCheck, Hammer, Clock, BarChart3, LayoutGrid } from 'lucide-react';
import { ClientQA } from '../../types';
import { toast } from 'sonner';

const QNA_CATEGORIES = ['전체', '코인/주식 손실', '급여 압류', '프리랜서 회생', '배우자 재산', '전세사기 피해', '최근 대출 회생', '자영업자 회생', '전문직 면허보존', '추심 차단', '개인파산 면책', '일용직 소득증빙', '보정권고 지연', '해외선물/주식'];

const CATEGORY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  '전체':           { icon: LayoutGrid,   color: 'text-slate-600',   bg: 'bg-slate-100' },
  '코인/주식 손실':  { icon: TrendingDown, color: 'text-red-600',     bg: 'bg-red-50' },
  '급여 압류':       { icon: Banknote,     color: 'text-amber-600',   bg: 'bg-amber-50' },
  '프리랜서 회생':   { icon: Briefcase,    color: 'text-violet-600',  bg: 'bg-violet-50' },
  '배우자 재산':     { icon: Users,        color: 'text-pink-600',    bg: 'bg-pink-50' },
  '전세사기 피해':   { icon: Home,         color: 'text-orange-600',  bg: 'bg-orange-50' },
  '최근 대출 회생':  { icon: CreditCard,   color: 'text-blue-600',    bg: 'bg-blue-50' },
  '자영업자 회생':   { icon: Store,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
  '전문직 면허보존': { icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  '추심 차단':       { icon: ShieldBan,    color: 'text-rose-600',    bg: 'bg-rose-50' },
  '개인파산 면책':   { icon: FileCheck,    color: 'text-teal-600',    bg: 'bg-teal-50' },
  '일용직 소득증빙': { icon: Hammer,       color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  '보정권고 지연':   { icon: Clock,        color: 'text-cyan-600',    bg: 'bg-cyan-50' },
  '해외선물/주식':   { icon: BarChart3,    color: 'text-sky-600',     bg: 'bg-sky-50' },
};

const ITEMS_PER_PAGE = 10;

// Character limits
const LIMITS = {
  questionTitle: 100,
  questionContent: 2000,
  authorName: 20,
  minTitle: 5,
  minContent: 10,
};

interface QnAViewProps {
  qas: ClientQA[];
  setQas: React.Dispatch<React.SetStateAction<ClientQA[]>>;
  onConsultRequest: (title: string, content: string) => void;
}

// Simple session-based author ID for secret post ownership check
const getSessionAuthorId = (): string => {
  let id = sessionStorage.getItem('qa_author_id');
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('qa_author_id', id);
  }
  return id;
};

export default function QnAView({ qas, setQas, onConsultRequest }: QnAViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [page, setPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'accuracy' | 'latest' | 'question' | 'views'>('latest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedQA, setSelectedQA] = useState<ClientQA | null>(null);

  // Question creation form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategory, setNewCategory] = useState('코인/주식 손실');
  const [customCategory, setCustomCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);

  const currentAuthorId = useMemo(() => getSessionAuthorId(), []);

  const canViewSecret = (qa: ClientQA): boolean => {
    if (qa.authorId === currentAuthorId) return true;
    if (!qa.isSecret) return true;
    return false;
  };

  const filteredQAs = qas.filter(qa => {
    if (categoryFilter !== '전체' && qa.category !== categoryFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (qa.isSecret && !canViewSecret(qa)) {
      return qa.category.toLowerCase().includes(query);
    }
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
  const mockDate = (id: string, createdAt?: string) => {
    if (createdAt) {
      const diff = Date.now() - new Date(createdAt).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return '방금';
      if (mins < 60) return `${mins}분 전`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}시간 전`;
      const days = Math.floor(hours / 24);
      return `${days}일 전`;
    }
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const mins = hash % 60;
    return mins === 0 ? '방금' : `${mins}분 전`;
  };

  const getTotalAnswers = (qa: ClientQA) => {
    if (!qa.answer && (!qa.additionalAnswers || qa.additionalAnswers.length === 0)) return 0;
    return (qa.answer ? 1 : 0) + (qa.additionalAnswers?.length || 0);
  };

  const handleSubmitQuestion = () => {
    const resolvedCategory = newCategory === '__custom__' ? customCategory.trim() : newCategory;

    if (newCategory === '__custom__' && !customCategory.trim()) {
      toast.error('카테고리를 직접 입력해주세요.');
      return;
    }
    if (newTitle.trim().length < LIMITS.minTitle) {
      toast.error(`질문 제목은 최소 ${LIMITS.minTitle}자 이상 입력해주세요.`);
      return;
    }
    if (newContent.trim().length < LIMITS.minContent) {
      toast.error(`질문 내용은 최소 ${LIMITS.minContent}자 이상 입력해주세요.`);
      return;
    }
    if (!newAuthor.trim()) {
      toast.error('작성자 닉네임을 입력해주세요.');
      return;
    }

    const newQA: ClientQA = {
      id: `qa-${Date.now()}`,
      category: resolvedCategory,
      question: newTitle.trim(),
      author: newIsSecret ? '비공개' : newAuthor.trim(),
      answer: '',
      lawyerName: '',
      lawyerAvatar: '',
      badge: newIsSecret ? '비밀 상담' : '답변 대기',
      isSecret: newIsSecret,
      authorId: currentAuthorId,
      createdAt: new Date().toISOString(),
      content: newContent.trim(),
      status: 'waiting',
    };

    setQas(prev => [newQA, ...prev]);
    toast.success('질문이 등록되었습니다. 변호사 답변을 기다려주세요.');

    // Reset form
    setNewTitle('');
    setNewContent('');
    setNewAuthor('');
    setNewIsSecret(false);
    setNewCategory('코인/주식 손실');
    setCustomCategory('');
    setShowCreateForm(false);
  };

  // Character counter component
  const CharCounter = ({ current, max, min }: { current: number; max: number; min?: number }) => {
    const isOver = current > max;
    const isUnderMin = min !== undefined && current > 0 && current < min;
    return (
      <span className={`text-xs font-semibold ${isOver ? 'text-red-500' : isUnderMin ? 'text-amber-500' : current > max * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
        {current} / {max}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn text-left font-sans">
      {/* ── 상세 보기 ── */}
      {selectedQA ? (() => {
        const qa = selectedQA;
        const isSecretAndHidden = qa.isSecret && !canViewSecret(qa);

        if (isSecretAndHidden) {
          return (
            <div className="space-y-6">
              <button
                onClick={() => setSelectedQA(null)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                목록으로 돌아가기
              </button>
              <div className="py-16 text-center space-y-4">
                <Lock className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-lg text-slate-700">비밀 상담 글입니다</h3>
                <p className="text-sm text-slate-500">작성자와 답변 변호사만 열람할 수 있습니다.</p>
              </div>
            </div>
          );
        }

        const allAnswers = qa.answer
          ? [
              { lawyerName: qa.lawyerName, lawyerAvatar: qa.lawyerAvatar, answer: qa.answer, badge: qa.badge },
              ...(qa.additionalAnswers || [])
            ]
          : [...(qa.additionalAnswers || [])];

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
                {qa.isSecret && (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />비밀 상담
                  </span>
                )}
                {qa.status === 'waiting' && (
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">답변 대기중</span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">Q. {qa.question}</h1>
              {qa.content && (
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4 whitespace-pre-wrap">{qa.content}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{qa.author}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />조회 {mockViews(qa.id).toLocaleString()}</span>
                <span>·</span>
                <span>답변 {allAnswers.length}개</span>
                {qa.createdAt && (
                  <>
                    <span>·</span>
                    <span>{mockDate(qa.id, qa.createdAt)}</span>
                  </>
                )}
              </div>
            </div>

            {/* 모든 변호사 답변 */}
            {allAnswers.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-semibold text-base text-slate-700">아직 변호사 답변이 없습니다</h4>
                <p className="text-sm text-slate-500">전문 변호사의 답변을 기다려주세요.</p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-slate-100">
                {allAnswers.map((ans, idx) => (
                  <div key={idx} className="py-5 first:pt-0">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-xs font-bold text-blue-600">답변</span>
                      {ans.lawyerAvatar && <img src={ans.lawyerAvatar} alt={ans.lawyerName} className="w-7 h-7 rounded-full object-cover border border-slate-200" />}
                      <span className="text-sm font-bold text-slate-800">{ans.lawyerName}</span>
                      {idx === 0 && allAnswers.length > 1 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-auto">대표 답변</span>}
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
            )}
          </div>
        );
      })() : (
      <>
      {/* Header */}
      <div className="space-y-2 pt-2 pb-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              나와 비슷한 문제에 대한<br className="md:hidden" />
              답변을 찾아보세요.
            </h1>
            <p className="text-sm text-slate-500 mt-1">도산 전문 변호사들이 직접 답변한 실시간 법률 상담 Q&A입니다.</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4" />
            질문 작성하기
          </button>
        </div>
      </div>

      {/* ── 질문 작성 폼 ── */}
      {showCreateForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 animate-fadeIn shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#1E3A5F]" />
              새 질문 작성
            </h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 카테고리 선택 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">카테고리</label>
            <select
              value={newCategory}
              onChange={e => {
                setNewCategory(e.target.value);
                if (e.target.value !== '__custom__') setCustomCategory('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 font-semibold text-slate-700"
            >
              {QNA_CATEGORIES.filter(c => c !== '전체').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__custom__">기타 (직접 입력)</option>
            </select>
            {newCategory === '__custom__' && (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                maxLength={30}
                placeholder="카테고리를 직접 입력해주세요 (예: 신용불량 회복)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 font-medium text-slate-800 placeholder:text-slate-400 mt-1.5"
              />
            )}
          </div>

          {/* 질문 제목 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">질문 제목</label>
              <CharCounter current={newTitle.length} max={LIMITS.questionTitle} min={LIMITS.minTitle} />
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              maxLength={LIMITS.questionTitle}
              placeholder="궁금한 내용을 한 줄로 요약해주세요"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 font-medium text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* 질문 상세 내용 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">상세 내용</label>
              <CharCounter current={newContent.length} max={LIMITS.questionContent} min={LIMITS.minContent} />
            </div>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              maxLength={LIMITS.questionContent}
              rows={5}
              placeholder={"구체적인 상황을 설명해주시면 변호사의 정확한 답변에 도움이 됩니다.\n(예: 채무 금액, 소득 상태, 현재 진행 중인 절차 등)"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 font-medium text-slate-800 leading-relaxed resize-none placeholder:text-slate-400"
            />
          </div>

          {/* 작성자 닉네임 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">작성자 닉네임</label>
              <CharCounter current={newAuthor.length} max={LIMITS.authorName} />
            </div>
            <input
              type="text"
              value={newAuthor}
              onChange={e => setNewAuthor(e.target.value)}
              maxLength={LIMITS.authorName}
              placeholder="예: 김*수 (직장인)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 font-medium text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* 비밀 상담 토글 */}
          <div className="flex items-center gap-3 p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl">
            <button
              type="button"
              onClick={() => setNewIsSecret(!newIsSecret)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${newIsSecret ? 'bg-amber-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${newIsSecret ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Lock className={`w-3.5 h-3.5 ${newIsSecret ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${newIsSecret ? 'text-amber-700' : 'text-slate-600'}`}>비밀 상담</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">비밀 상담으로 설정하면 다른 고객에게 질문 내용이 공개되지 않습니다.</p>
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-[0.98]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmitQuestion}
              disabled={newTitle.trim().length < LIMITS.minTitle || newContent.trim().length < LIMITS.minContent || !newAuthor.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap shadow-sm"
            >
              <Send className="w-4 h-4" />
              질문 등록하기
            </button>
          </div>
        </div>
      )}

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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {QNA_CATEGORIES.map((cat) => {
            const catIcon = CATEGORY_ICONS[cat] || CATEGORY_ICONS['전체'];
            const IconComp = catIcon.icon;
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(cat); setPage(1); }}
                className={`group relative flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{cat}</span>
                <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-white/15' : catIcon.bg
                }`}>
                  <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : catIcon.color}`} />
                </span>
              </button>
            );
          })}
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
            const date = mockDate(qa.id, qa.createdAt);
            const isSecretAndHidden = qa.isSecret && !canViewSecret(qa);
            const isWaiting = qa.status === 'waiting' || (!qa.answer && (!qa.additionalAnswers || qa.additionalAnswers.length === 0));

            return (
              <div key={qa.id} className="py-5 first:pt-0">
                {/* Category tags */}
                <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
                  <span className="font-semibold">{qa.category}</span>
                  {qa.isSecret && (
                    <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                      <Lock className="w-3 h-3" />비밀
                    </span>
                  )}
                  {isWaiting && (
                    <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-semibold">
                      답변 대기중
                    </span>
                  )}
                </div>

                {/* Question */}
                {isSecretAndHidden ? (
                  <div
                    className="flex items-center gap-2 mb-3 cursor-pointer"
                    onClick={() => { setSelectedQA(qa); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="text-base md:text-lg font-bold text-slate-400 leading-snug">
                      비밀 상담 글입니다
                    </h3>
                  </div>
                ) : (
                  <>
                    <h3
                      className="text-base md:text-lg font-bold text-slate-900 leading-snug mb-3 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => { setSelectedQA(qa); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    >
                      {qa.question}
                    </h3>

                    {/* Primary answer */}
                    {qa.answer && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-bold text-blue-600">답변</span>
                          {qa.lawyerAvatar && <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4 h-4 rounded-full object-cover border border-slate-200" />}
                          <span className="text-xs font-semibold text-slate-700">{qa.lawyerName}</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{qa.answer}</p>
                      </div>
                    )}

                    {/* Waiting state */}
                    {!qa.answer && isWaiting && (
                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                        <MessageSquare className="w-4 h-4" />
                        <span className="font-medium">변호사 답변을 기다리고 있습니다...</span>
                      </div>
                    )}

                    {/* Other answers toggle */}
                    {others.length > 0 && (
                      <div className="mb-3">
                        {isExpanded && (
                          <div className="space-y-3 mb-2 pl-3 border-l-2 border-slate-200">
                            {others.map((other, idx) => (
                              <div key={idx}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-bold text-blue-600">답변</span>
                                  {other.lawyerAvatar && <img src={other.lawyerAvatar} alt={other.lawyerName} className="w-4 h-4 rounded-full object-cover border border-slate-200" />}
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
                              o.lawyerAvatar && <img key={i} src={o.lawyerAvatar} alt={o.lawyerName} className="w-5 h-5 rounded-full border-2 border-white object-cover" />
                            ))}
                          </div>
                          <span>다른 변호사 답변 {others.length}개</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />조회수 {views.toLocaleString()}</span>
                  {totalAnswers > 0 && <span>답변 {totalAnswers}개</span>}
                  <span className="ml-auto">{date} {isWaiting ? '질문 작성됨' : '답변 작성됨'}</span>
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
