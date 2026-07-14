import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Heart, ChevronRight, CheckCircle2, MapPin } from 'lucide-react';
import type { User } from '../../types';
import LawyerProfileModal from './LawyerProfileModal';

const FAVORITES_KEY = 'lawyer_favorites';
function loadFavorites(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[]); } catch { return new Set<string>(); }
}
function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
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
  lawyers: User[];
  onSelectLawyer: (lawyerId: string) => void;
  selectionMode?: boolean;
  maxSelections?: number;
  onConfirmSelection?: (lawyerIds: string[]) => void;
}

export default function LawyersView({ lawyers, onSelectLawyer, selectionMode, maxSelections = 3, onConfirmSelection }: LawyersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [page, setPage] = useState(1);
  const [profileLawyer, setProfileLawyer] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedLawyerIds, setSelectedLawyerIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedLawyerIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= maxSelections) {
        alert(`최대 ${maxSelections}명까지만 선택 가능합니다.`);
        return prev;
      }
      return [...prev, id];
    });
  }, [maxSelections]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  };

  const filtered = lawyers.filter(l => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = l.name.toLowerCase().includes(queryLower) || l.fields.some(f => f.toLowerCase().includes(queryLower)) || l.bio.toLowerCase().includes(queryLower);
    const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
    const matchesFav = !showFavoritesOnly || favorites.has(l.id);
    return matchesSearch && matchesRegion && matchesFav;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── 광고 등급별 변호사 분류 (랜덤 셔플) ──
  const topAdLawyers = useMemo(() => 
    lawyers.filter(l => l.adTier === 'top').sort(() => Math.random() - 0.5)
  , [lawyers]);
  
  const regionalAdLawyers = useMemo(() => 
    lawyers.filter(l => l.adTier === 'regional' && (selectedRegion === '전체' || (l.adRegion && l.adRegion.includes(selectedRegion))))
      .sort(() => Math.random() - 0.5)
  , [lawyers, selectedRegion]);

  // 일반 목록: 기본 노출 광고 먼저, 무료 회원은 뒤에
  const sortedFiltered = useMemo(() => {
    const adInList = filtered.filter(l => l.adTier === 'basic');
    const freeInList = filtered.filter(l => !l.adTier || (l.adTier !== 'basic'));
    return [...adInList.sort(() => Math.random() - 0.5), ...freeInList];
  }, [filtered]);

  const sortedTotalPages = Math.ceil(sortedFiltered.length / ITEMS_PER_PAGE);
  const sortedPaginated = sortedFiltered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className={`space-y-6 animate-fadeIn font-sans ${selectionMode ? 'pb-28' : ''}`}>
      {selectionMode && (
        <div className="bg-gradient-to-r from-brand to-indigo-600 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg shadow-brand/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight">
              변호사 <span className="text-white/90 text-base">{selectedLawyerIds.length}/{maxSelections}</span>명 선택됨
            </span>
          </div>
          {selectedLawyerIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedLawyerIds([])}
              className="text-white/70 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              선택 초기화
            </button>
          )}
        </div>
      )}
      {/* Filter & Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl shadow-premium border border-slate-100 dark:border-slate-800">
        <input
          type="text"
          placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none font-bold"
        />
      </div>

      {/* ── 상단 노출 광고 (상품 3) ── */}
      {topAdLawyers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-premium overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full"></span>
              광고 · 추천 변호사
            </h3>
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium select-none" title="변호사가 직접 등록한 유료 노출 광고입니다">
              AD 광고 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-200 text-[10px] text-slate-300 font-bold">ⓘ</span>
            </span>
          </div>
          <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topAdLawyers.slice(0, 6).map((l) => (
              <div
                key={l.id}
                onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)}
                className="relative group p-5 rounded-xl border-2 border-violet-100 bg-gradient-to-br from-violet-50/50 to-white hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300 cursor-pointer"
              >
                <span className="absolute top-3 right-3 bg-violet-100 text-violet-600 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-violet-200">
                  광고
                </span>
                {selectionMode && (
                  <div className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedLawyerIds.includes(l.id) ? 'bg-brand border-brand scale-110' : 'bg-white border-slate-300 group-hover:border-brand/50'
                  }`}>
                    {selectedLawyerIds.includes(l.id) && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <img src={l.avatarData || l.avatar} alt={l.name} className="w-[72px] h-[72px] rounded-xl object-cover border-2 border-violet-100 shadow-sm" />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <span className="font-extrabold text-[15px] text-slate-900 block truncate">{l.name}</span>
                    <span className="text-xs text-slate-500 block">{l.region} · {l.courtJurisdiction || l.region + '법원'}</span>
                    <div className="flex flex-wrap gap-1">
                      {l.fields.slice(0, 3).map(f => (
                        <span key={f} className="text-[11px] text-violet-600 font-bold px-1.5 py-0.5 bg-violet-50 border border-violet-100 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {l.catchphrase && (
                  <p className="mt-3 text-xs text-slate-500 italic leading-relaxed border-t border-violet-100/50 pt-2.5">
                    "{l.catchphrase}"
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3 text-slate-400">
                    {l.successRate && <span>인가율 <strong className="text-violet-600">{l.successRate}%</strong></span>}
                    {l.totalCases && <span>수임 <strong className="text-violet-600">{l.totalCases}건</strong></span>}
                  </div>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    상담 가능
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Region Selection Grid */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-premium space-y-5 text-left">
        <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-4 bg-brand rounded-full"></span>
          <span>지역별 관할 법원 전담 파트너 찾기</span>
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {REGIONS.map((reg) => (
            <button 
              key={reg.value} 
              type="button" 
              onClick={() => { setSelectedRegion(reg.value); setPage(1); }} 
              className={`py-3 text-[13px] font-bold rounded-xl text-center transition-all duration-300 cursor-pointer border ${
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

      {/* ── 지역 상단 노출 광고 (상품 4) — 지역 필터 적용 시에만 표시 ── */}
      {selectedRegion !== '전체' && regionalAdLawyers.length > 0 && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-premium overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full"></span>
              <MapPin className="w-4 h-4 text-emerald-500" />
              광고 · {selectedRegion} 지역 변호사
            </h3>
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium select-none">
              AD 광고 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-200 text-[10px] text-slate-300 font-bold">ⓘ</span>
            </span>
          </div>
          <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {regionalAdLawyers.slice(0, 4).map((l) => (
              <div
                key={l.id}
                onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)}
                className="relative group p-4 rounded-xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer"
              >
                <span className="absolute top-3 right-3 bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                  광고
                </span>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img src={l.avatarData || l.avatar} alt={l.name} className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-100" />
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="font-extrabold text-sm text-slate-900 block">{l.name}</span>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <MapPin className="w-3 h-3" />
                      <span className="font-medium">{l.courtJurisdiction || l.region + ' 법원'} 인근</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {l.fields.slice(0, 3).map(f => (
                        <span key={f} className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-left text-sm text-slate-600 dark:text-slate-400 font-bold">
            이 변호사들이 당신의 채무 상황을 끝까지 함께 관리해주는 <span className="text-brand font-bold">전담 파트너</span>가 됩니다. (총 {sortedFiltered.length}명 활동 중)
          </div>
          <button
            type="button"
            onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold border transition-all cursor-pointer shrink-0 ${
              showFavoritesOnly
                ? 'bg-rose-50 border-rose-200 text-rose-500'
                : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-400'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>즐겨찾기 {favorites.size > 0 ? `(${favorites.size})` : ''}</span>
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-premium">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-500">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900 dark:text-slate-200 text-base">해당 조건에 맞는 변호사가 없습니다</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">다른 지역을 선택하거나 검색어를 변경해 보세요.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedPaginated.map(l => (
                <div key={l.id} onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)} className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 border p-6 flex flex-col sm:flex-row gap-5 transition-all duration-300 group relative overflow-hidden text-left cursor-pointer ${
                  selectionMode && selectedLawyerIds.includes(l.id)
                    ? 'border-brand ring-2 ring-brand/20 shadow-brand/10'
                    : l.adTier === 'basic' ? 'border-blue-100 dark:border-blue-800 ring-1 ring-blue-100' : 'border-slate-100 dark:border-slate-800'
                }`}>
                  {/* Subtle top brand line overlay */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] ${l.adTier === 'basic' ? 'bg-gradient-to-r from-transparent via-blue-400/30 to-transparent' : 'bg-gradient-to-r from-transparent via-brand/20 to-transparent'}`}></div>
                  {l.adTier === 'basic' && (
                    <span className="absolute top-3 right-3 bg-blue-50 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-200 z-10">
                      광고
                    </span>
                  )}
                  {selectionMode && (
                    <div className={`absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10 ${
                      selectedLawyerIds.includes(l.id)
                        ? 'bg-brand border-brand scale-110 shadow-md shadow-brand/30'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-brand/50'
                    }`}>
                      {selectedLawyerIds.includes(l.id) && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="relative shrink-0 self-start sm:self-center">
                    <img src={l.avatar} alt={l.name} className="w-20 h-20 rounded-full object-cover bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 shadow-sm" />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">{l.name} 변호사</h3>
                        <span className="text-sm text-slate-500 dark:text-slate-500 font-medium">{l.region}지방법원 전담 지원</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(l.id, e)}
                          className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-rose-300 hover:bg-rose-50 transition-all cursor-pointer group/fav"
                        >
                          <Heart className={`w-4 h-4 transition-colors ${
                            favorites.has(l.id)
                              ? 'fill-rose-500 text-rose-500'
                              : 'text-slate-300 group-hover/fav:text-rose-400'
                          }`} />
                        </button>
                        <span className="bg-brand/5 border border-brand/20 text-brand text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">수임 75건 이상</span>
                      </div>
                    </div>
                    
                    <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{l.bio}</p>
                    
                    <div className="flex flex-wrap gap-1">
                      {l.fields.map(f => (
                        <span key={f} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-md font-bold">#{f}</span>
                      ))}
                    </div>
                    
                    {/* 4 Dedicated Care Pillars */}
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>상황 밀착 상담</span>
                      <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>채무 전략 관리</span>
                      <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>사건 신속 진행</span>
                      <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>면책 후 신용 케어</span>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-[13px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{l.recentActivity}</span>
                      </span>
                      <button 
                        onClick={() => onSelectLawyer(l.id)} 
                        className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-4.5 py-2 rounded-xl transition-all duration-300 text-[13px] cursor-pointer shadow-sm hover:shadow-brand-sm transform hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        전담 변호사 시작하기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {sortedTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <button type="button" disabled={page === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === 1 ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>이전</button>
                {Array.from({ length: sortedTotalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === pNum ? 'bg-brand border-brand text-white shadow-md shadow-brand/20 scale-105' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>{pNum}</button>
                  );
                })}
                <button type="button" disabled={page === sortedTotalPages} onClick={() => { setPage(prev => Math.min(sortedTotalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === sortedTotalPages ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>다음</button>
              </div>
            )}
          </>
        )}
      </div>
      {/* 변호사 프로필 모달 */}
      {profileLawyer && (
        <LawyerProfileModal
          lawyer={profileLawyer}
          onClose={() => setProfileLawyer(null)}
          onConsult={(lawyerId) => {
            setProfileLawyer(null);
            onSelectLawyer(lawyerId);
          }}
          isFavorite={favorites.has(profileLawyer.id)}
          onToggleFavorite={() => toggleFavorite(profileLawyer.id)}
        />
      )}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-4xl mx-auto">
            <button
              type="button"
              disabled={selectedLawyerIds.length === 0}
              onClick={() => onConfirmSelection?.(selectedLawyerIds)}
              className={`w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all duration-300 cursor-pointer ${
                selectedLawyerIds.length > 0
                  ? 'bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 active:scale-[0.98]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {selectedLawyerIds.length > 0
                ? `선택한 ${selectedLawyerIds.length}명의 변호사에게 상담 요청하기`
                : '변호사를 선택해주세요'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
