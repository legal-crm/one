import React, { useState } from 'react';
import { MessageSquare, Send, Lock, Eye, ChevronDown, ChevronUp, Search, X, HelpCircle, CheckCircle2 } from 'lucide-react';
import { ClientQA, QAAnswer, User } from '../../types';
import { toast } from 'sonner';

const ANSWER_MAX_LENGTH = 3000;
const ANSWER_MIN_LENGTH = 10;

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

  const waitingCount = qas.filter(q => q.status === 'waiting' || (!q.answer && (!q.additionalAnswers || q.additionalAnswers.length === 0))).length;
  const secretCount = qas.filter(q => q.isSecret).length;

  const hasAlreadyAnswered = (qa: ClientQA): boolean => {
    if (!currentLawyer) return false;
    // Check primary answer
    if (qa.lawyerName === currentLawyer.name && qa.answer) return true;
    // Check additional answers
    return (qa.additionalAnswers || []).some(a => a.lawyerId === currentLawyer.id || a.lawyerName === currentLawyer.name);
  };

  const handleSubmitAnswer = (qaId: string) => {
    const text = (answerTexts[qaId] || '').trim();
    if (text.length < ANSWER_MIN_LENGTH) {
      toast.error(`답변은 최소 ${ANSWER_MIN_LENGTH}자 이상 입력해주세요.`);
      return;
    }
    if (!setQas) return;

    const newAnswer: QAAnswer = {
      lawyerName: currentLawyer.name,
      lawyerAvatar: currentLawyer.avatar || currentLawyer.avatarData || '',
      answer: text,
      badge: '전문가 답변',
      createdAt: new Date().toISOString(),
      lawyerId: currentLawyer.id,
    };

    setQas(prev => prev.map(qa => {
      if (qa.id !== qaId) return qa;

      // If this is the first answer, set it as the primary answer
      if (!qa.answer) {
        return {
          ...qa,
          answer: text,
          lawyerName: currentLawyer.name,
          lawyerAvatar: currentLawyer.avatar || currentLawyer.avatarData || '',
          badge: '전문가 답변',
          status: 'answered' as const,
        };
      }

      // Otherwise add as additional answer
      return {
        ...qa,
        additionalAnswers: [...(qa.additionalAnswers || []), newAnswer],
        status: 'answered' as const,
      };
    }));

    setAnswerTexts(prev => ({ ...prev, [qaId]: '' }));
    toast.success('답변이 등록되었습니다.');
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
      <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand" />
            <span>고민상담 Q&A 답변 관리</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed text-left">
            고객들의 법률 고민 질문에 전문 답변을 작성하세요. 양질의 답변은 변호사님의 전문성을 홍보하는 효과가 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
            답변 대기 {waitingCount}건
          </span>
          <span className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
            전체 {qas.length}건
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: 'all' as const, label: '전체 질문', count: qas.length },
          { key: 'waiting' as const, label: '답변 대기', count: waitingCount },
          { key: 'answered' as const, label: '답변 완료', count: qas.length - waitingCount },
          { key: 'secret' as const, label: '비밀 상담', count: secretCount },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${
              filterMode === f.key
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
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
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:border-brand focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand shrink-0"
        >
          {QNA_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Q&A List */}
      {filteredQAs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-semibold text-base text-slate-700">해당 조건의 질문이 없습니다</h4>
          <p className="text-sm text-slate-500">필터를 변경하거나 검색어를 확인해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQAs.map(qa => {
            const isExpanded = expandedQaId === qa.id;
            const isWaiting = qa.status === 'waiting' || (!qa.answer && (!qa.additionalAnswers || qa.additionalAnswers.length === 0));
            const totalAnswers = (qa.answer ? 1 : 0) + (qa.additionalAnswers?.length || 0);
            const alreadyAnswered = hasAlreadyAnswered(qa);
            const currentAnswerText = answerTexts[qa.id] || '';

            return (
              <div key={qa.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all">
                {/* Question Header */}
                <div
                  onClick={() => setExpandedQaId(isExpanded ? null : qa.id)}
                  className="p-4 md:p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{qa.category}</span>
                        {qa.isSecret && (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Lock className="w-3 h-3" />비밀
                          </span>
                        )}
                        {isWaiting ? (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">답변 대기</span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />답변 {totalAnswers}개
                          </span>
                        )}
                        {alreadyAnswered && (
                          <span className="text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded">내 답변 있음</span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm md:text-base text-slate-900 leading-snug">Q. {qa.question}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
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
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 animate-fadeIn">
                    {/* Question Detail */}
                    {qa.content && (
                      <div className="px-5 py-4 bg-slate-50/50">
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap text-left">{qa.content}</p>
                      </div>
                    )}

                    {/* Existing Answers */}
                    {totalAnswers > 0 && (
                      <div className="px-5 py-4 space-y-3 border-t border-slate-100">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">기존 답변 ({totalAnswers}개)</h5>
                        <div className="space-y-3">
                          {qa.answer && (
                            <div className="p-3 bg-blue-50/30 border border-blue-100 rounded-xl text-left">
                              <div className="flex items-center gap-2 mb-2">
                                {qa.lawyerAvatar && <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />}
                                <span className="text-xs font-bold text-slate-700">{qa.lawyerName}</span>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">대표 답변</span>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{qa.answer}</p>
                            </div>
                          )}
                          {(qa.additionalAnswers || []).map((ans, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-left">
                              <div className="flex items-center gap-2 mb-2">
                                {ans.lawyerAvatar && <img src={ans.lawyerAvatar} alt={ans.lawyerName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />}
                                <span className="text-xs font-bold text-slate-700">{ans.lawyerName}</span>
                                {ans.badge && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-auto">{ans.badge}</span>}
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{ans.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Answer Form */}
                    {setQas && (
                      <div className="px-5 py-4 border-t border-slate-200 bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {currentLawyer.avatar && <img src={currentLawyer.avatar} alt={currentLawyer.name} className="w-6 h-6 rounded-full object-cover border border-slate-200" />}
                            <span className="text-xs font-bold text-slate-700">{currentLawyer.name} 답변 작성</span>
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
                          placeholder={alreadyAnswered
                            ? "이미 답변을 작성하셨습니다. 추가 답변을 남기실 수 있습니다."
                            : "고객의 질문에 대한 전문적인 법률 답변을 작성해주세요.\n답변 품질이 높을수록 고객의 상담 신청으로 이어질 가능성이 높습니다."
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 font-medium text-slate-800 leading-relaxed resize-none placeholder:text-slate-400"
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-400">
                            답변 작성 시 변호사님의 프로필이 함께 노출되어 홍보 효과가 있습니다.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSubmitAnswer(qa.id)}
                            disabled={currentAnswerText.trim().length < ANSWER_MIN_LENGTH}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            답변 등록
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
    </div>
  );
}
