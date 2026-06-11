import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Lawyer {
  id: string;
  name: string;
  avatar: string;
  region: string;
  bio: string;
  fields: string[];
  recentActivity: string;
}

const REGIONS = [
  { value: '서울', label: '서울' },
  { value: '경기', label: '경기' },
  { value: '춘천/강원', label: '춘천/강원' },
  { value: '제주', label: '제주' },
  { value: '인천/부천', label: '인천/부천' },
  { value: '대구/경북', label: '대구/경북' },
  { value: '청주/충북', label: '청주/충북' },
  { value: '대전/충남/세종', label: '대전/충남/세종' },
  { value: '전주/전북', label: '전주/전북' },
  { value: '부산/울산/경남', label: '부산/울산/경남' },
  { value: '광주/전남', label: '광주/전남' },
  { value: '전체', label: '+ 전체보기' }
];

const ITEMS_PER_PAGE = 10;

interface LawyersViewProps {
  lawyers: Lawyer[];
  onSelectLawyer: (lawyerId: string) => void;
}

export default function LawyersView({ lawyers, onSelectLawyer }: LawyersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [page, setPage] = useState(1);

  const filtered = lawyers.filter(l => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = l.name.toLowerCase().includes(queryLower) || l.fields.some(f => f.toLowerCase().includes(queryLower)) || l.bio.toLowerCase().includes(queryLower);
    const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
    return matchesSearch && matchesRegion;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* Filter & Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl shadow-premium border border-slate-100 dark:border-slate-800">
        <input
          type="text"
          placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none font-bold"
        />
      </div>

      {/* Region Selection Grid */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-premium space-y-5 text-left">
        <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-4 bg-brand rounded-full"></span>
          <span>지역별 관할 법원 전담 파트너 찾기</span>
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {REGIONS.map((reg) => (
            <button 
              key={reg.value} 
              type="button" 
              onClick={() => { setSelectedRegion(reg.value); setPage(1); }} 
              className={`py-3 text-[11px] font-bold rounded-xl text-center transition-all duration-300 cursor-pointer border ${
                selectedRegion === reg.value 
                  ? 'bg-gradient-to-r from-brand to-indigo-600 border-brand text-white shadow-[0_4px_15px_rgba(114,100,255,0.25)] scale-[1.03]' 
                  : 'bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-950/40 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold'
              }`}
            >
              {reg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Lawyers */}
      <div className="space-y-6">
        <div className="text-left text-xs text-slate-500 dark:text-slate-400 font-bold">
          이 변호사들이 당신의 채무 상황을 끝까지 함께 관리해주는 <span className="text-brand dark:text-brand-light font-bold">전담 파트너</span>가 됩니다. (총 {filtered.length}명 활동 중)
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-premium">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">해당 조건에 맞는 변호사가 없습니다</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">다른 지역을 선택하거나 검색어를 변경해 보세요.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paginated.map(l => (
                <div key={l.id} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 border border-slate-100 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-5 transition-all duration-300 group relative overflow-hidden text-left">
                  {/* Subtle top brand line overlay */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand/20 to-transparent"></div>
                  <div className="relative shrink-0 self-start sm:self-center">
                    <img src={l.avatar} alt={l.name} className="w-20 h-20 rounded-full object-cover bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 shadow-sm" />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white tracking-tight">{l.name} 변호사</h3>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{l.region}지방법원 전담 지원</span>
                      </div>
                      <span className="bg-brand/5 border border-brand/20 text-brand dark:text-brand-light text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">수임 75건 이상</span>
                    </div>
                    
                    <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed font-medium">{l.bio}</p>
                    
                    <div className="flex flex-wrap gap-1">
                      {l.fields.map(f => (
                        <span key={f} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-bold">#{f}</span>
                      ))}
                    </div>
                    
                    {/* 4 Dedicated Care Pillars */}
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1.5"><span className="text-[10px] text-brand/75">•</span>상황 밀착 상담</span>
                      <span className="flex items-center gap-1.5"><span className="text-[10px] text-brand/75">•</span>채무 전략 관리</span>
                      <span className="flex items-center gap-1.5"><span className="text-[10px] text-brand/75">•</span>사건 신속 진행</span>
                      <span className="flex items-center gap-1.5"><span className="text-[10px] text-brand/75">•</span>면책 후 신용 케어</span>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{l.recentActivity}</span>
                      </span>
                      <button 
                        onClick={() => onSelectLawyer(l.id)} 
                        className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-4.5 py-2 rounded-xl transition-all duration-300 text-[11px] cursor-pointer shadow-sm hover:shadow-brand-sm transform hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        전담 변호사 시작하기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <button type="button" disabled={page === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === 1 ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>이전</button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === pNum ? 'bg-brand border-brand text-white shadow-md shadow-brand/20 scale-105' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>{pNum}</button>
                  );
                })}
                <button type="button" disabled={page === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === totalPages ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>다음</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
