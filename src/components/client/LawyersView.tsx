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
    <div className="space-y-6 animate-fadeIn">
      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <input
          type="text"
          placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
        />
      </div>

      {/* Region Selection Grid */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-850 dark:text-white">어떤 지역의 변호사를 찾으시나요?</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {REGIONS.map((reg) => (
            <button key={reg.value} type="button" onClick={() => { setSelectedRegion(reg.value); setPage(1); }} className={`py-3 text-xs font-bold rounded-xl text-center transition-all cursor-pointer border ${selectedRegion === reg.value ? 'bg-brand border-brand text-white shadow-sm shadow-brand/20 scale-105' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border-slate-150/40 dark:border-slate-800 text-slate-700 dark:text-slate-350'}`}>
              {reg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Lawyers */}
      <div className="space-y-6">
        <div className="text-left text-xs text-slate-500 dark:text-slate-400 font-medium">
          총 <span className="text-brand dark:text-brand-light font-bold">{filtered.length}</span>명의 도산 전문 변호사가 활동 중입니다.
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-450">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">해당 조건에 맞는 변호사가 없습니다</h4>
              <p className="text-xs text-slate-500 dark:text-slate-450">다른 지역을 선택하거나 검색어를 변경해 보세요.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paginated.map(l => (
                <div key={l.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-4">
                  <img src={l.avatar} alt={l.name} className="w-20 h-20 rounded-full object-cover bg-slate-100 dark:bg-slate-800 self-start sm:self-center" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{l.name}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{l.region} 법원 지원</span>
                      </div>
                      <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light text-[10px] font-semibold px-2 py-0.5 rounded">수임 75건 이상</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">{l.bio}</p>
                    <div className="flex flex-wrap gap-1">
                      {l.fields.map(f => (
                        <span key={f} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded">#{f}</span>
                      ))}
                    </div>
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{l.recentActivity}</span>
                      </span>
                      <button onClick={() => onSelectLawyer(l.id)} className="bg-brand hover:bg-brand text-white font-semibold px-3 py-1.5 rounded-lg transition-colors text-[11px] cursor-pointer">상담 신청하기</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-4">
                <button type="button" disabled={page === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === 1 ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-850 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'}`}>이전</button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === pNum ? 'bg-brand border-brand text-white shadow-md' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'}`}>{pNum}</button>
                  );
                })}
                <button type="button" disabled={page === totalPages} onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === totalPages ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-850 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'}`}>다음</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
