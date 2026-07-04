import React, { useState } from 'react';
import { HelpCircle, AlertTriangle } from 'lucide-react';
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
  const [openedQaId, setOpenedQaId] = useState<string | null>(null);

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

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-200 text-xs font-bold rounded-full border border-indigo-500/30">
            <HelpCircle className="w-3.5 h-3.5 text-brand" />
            <span>실시간 법률 고민 Q&A 상담사례</span>
          </span>
          <h1 className="text-2xl md:text-3.5xl font-bold tracking-tight leading-tight">my김변 법률 상담사례 디렉토리</h1>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            도산 전문 변호인단이 직접 분석하고 탕감/면책 방향을 속결 소명해 낸 실제 고민사례 목록입니다.<br/>
            나와 가장 유사한 채무 유형 및 거주 법원의 고민을 빠르게 찾고 실시간 즉시 1:1 대리인 대응을 시작해 보세요.
          </p>
        </div>
      </div>

      {/* Q&A Filter Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 block uppercase">실시간 키워드 검색</span>
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="사례 키워드 또는 변호사 검색..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 block uppercase mb-1">총 매칭 사례</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200">
              {filteredQAs.length}개 검색됨 (총 {qas.length}개)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          {QNA_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => { setCategoryFilter(cat); setPage(1); }} className={`px-3 py-1.5 text-[12px] sm:text-xs font-bold rounded-xl transition-all border cursor-pointer ${categoryFilter === cat ? 'bg-brand border-brand text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Q&A List */}
      {filteredQAs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-indigo-500 mx-auto" />
          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-200">일치하는 상담사례가 없습니다.</h4>
          <p className="text-xs text-slate-600">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
          <button onClick={() => { setCategoryFilter('전체'); setSearchQuery(''); setPage(1); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-4">
            {paginatedQAs.map(qa => {
              const isOpen = openedQaId === qa.id;
              return (
                <div key={qa.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm">
                  <div onClick={() => setOpenedQaId(isOpen ? null : qa.id)} className="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-start justify-between gap-4">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-indigo-400 text-[12px] font-bold px-2.5 py-0.5 rounded-md">{qa.category}</span>
                        <span className="text-[12px] text-slate-500 font-semibold">{qa.author}</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 shrink-0" />
                          <span className="text-[12px] font-bold text-slate-600 dark:text-slate-400">{qa.lawyerName} 답변</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-200 pr-4 leading-snug">Q. {qa.question}</h4>
                    </div>
                    <span className="text-xs font-bold text-brand shrink-0 select-none pt-1">{isOpen ? '닫기 ▲' : '답변보기 ▼'}</span>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4 bg-slate-50/50 dark:bg-slate-950/20 text-left space-y-4 animate-slideDown">
                      <div className="flex items-start gap-3">
                        <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" />
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{qa.lawyerName}</span>
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-bold px-2 py-0.5 rounded-md">전문가 답변</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal pt-1.5 whitespace-pre-wrap text-left">{qa.answer}</p>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => onConsultRequest(
                            `${qa.category} 관련 법률 상담 신청`,
                            `고민 사례 질문:\nQ. ${qa.question}\n\n위의 Q&A 고민 사례를 확인하고 저에게 동일하게 적용될 수 있는 법리적 가능성을 상담받고 싶습니다. 변호사님의 정밀 가이드가 필요합니다.`
                          )}
                          className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-2xl text-[12px] transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer"
                        >
                          이 변호사에게 유사건 즉시 상담 신청
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8 border-t border-slate-100 dark:border-slate-800 mt-8">
              <button type="button" disabled={activePage === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                이전
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} type="button" onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 text-xs font-bold rounded-xl transition-all cursor-pointer border ${activePage === p ? 'bg-brand border-brand text-white shadow-sm shadow-brand/20 scale-105' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button type="button" disabled={activePage === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
