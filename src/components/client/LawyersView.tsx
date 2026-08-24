import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Heart, ChevronRight, CheckCircle2, MapPin, Paperclip, Search, X, ShieldCheck, Scale, Clock, Users } from 'lucide-react';
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

  // ChatView에서 "무료 상담 변호사 수임하기" 클릭 시 좋아요 필터 자동 활성화
  useEffect(() => {
    const favMode = localStorage.getItem('lawyer_view_favorites_mode');
    if (favMode === 'true') {
      setShowFavoritesOnly(true);
      localStorage.removeItem('lawyer_view_favorites_mode');
    }
  }, []);

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

  const filtered = useMemo(() => lawyers.filter(l => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = l.name.toLowerCase().includes(queryLower) || l.fields.some(f => f.toLowerCase().includes(queryLower)) || l.bio.toLowerCase().includes(queryLower);
    const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
    const matchesFav = !showFavoritesOnly || favorites.has(l.id);
    return matchesSearch && matchesRegion && matchesFav;
  }), [lawyers, searchQuery, selectedRegion, showFavoritesOnly, favorites]);

  // ── 광고 등급별 변호사 분류 (안정적 정렬) ──
  const topAdLawyers = useMemo(() => 
    lawyers.filter(l => l.adTier === 'top')
  , [lawyers]);

  // 유료 광고 변호사 (regional + basic) — 큰 카드로 표시, top 제외
  const paidLawyers = useMemo(() => {
    return filtered.filter(l => l.adTier === 'regional' || l.adTier === 'basic');
  }, [filtered]);

  // 무료 변호사 (adTier 없음) — 컴팩트 카드로 표시, top 제외
  const freeLawyers = useMemo(() => {
    return filtered.filter(l => !l.adTier || (l.adTier !== 'regional' && l.adTier !== 'basic' && l.adTier !== 'top'));
  }, [filtered]);

  const freeTotalPages = Math.ceil(freeLawyers.length / ITEMS_PER_PAGE);
  const freePaginated = freeLawyers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalDisplayCount = paidLawyers.length + freeLawyers.length;

  return (
    <div className={`space-y-6 animate-fadeIn font-sans ${selectionMode ? 'pb-28' : ''}`}>

      {/* ── Hero 배너 ── */}
      <div className="bg-[#0F2440] rounded-2xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10">
            <Scale className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">전담 변호사 찾기</h2>
            <p className="text-base text-slate-300 mt-1">관할 법원별 독립 변호사를 비교하고, 나에게 맞는 전문가를 선택하세요</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1"><Users className="w-4 h-4 text-teal-400" /></div>
            <p className="text-xl font-extrabold text-white">{lawyers.length}<span className="text-sm font-bold text-slate-400 ml-0.5">명</span></p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">등록 변호사</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1"><ShieldCheck className="w-4 h-4 text-teal-400" /></div>
            <p className="text-xl font-extrabold text-white">100<span className="text-sm font-bold text-slate-400 ml-0.5">%</span></p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">철저한 익명 상담 보장</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1"><Clock className="w-4 h-4 text-teal-400" /></div>
            <p className="text-xl font-extrabold text-white">2<span className="text-sm font-bold text-slate-400 ml-0.5">시간</span></p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">평균 응답</p>
            {/* <!-- mock: 서비스 예시 데이터 --> */}
          </div>
        </div>
      </div>

      {selectionMode && (
        <div className="bg-[#1E3A5F] rounded-2xl px-5 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">
              변호사 <span className="text-white font-black text-lg">{selectedLawyerIds.length}/{maxSelections}</span>명 선택됨
            </span>
          </div>
          {selectedLawyerIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedLawyerIds([])}
              className="text-white/80 hover:text-white text-sm font-bold transition-colors cursor-pointer"
            >
              선택 초기화
            </button>
          )}
        </div>
      )}
      {/* Filter & Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-10 py-3 text-base focus:ring-1 focus:ring-brand focus:outline-none font-bold"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="검색어 지우기"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── 상단 노출 광고 (상품 3) ── */}
      {topAdLawyers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-1">
            <h3 className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#1E3A5F] rounded-full"></span>
              광고 전문가
            </h3>
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium select-none" title="변호사가 직접 등록한 유료 노출 광고입니다">
              AD 광고 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-200 text-xs text-slate-400 font-bold">ⓘ</span>
            </span>
          </div>
          <div className="px-5 sm:px-6 pb-3">
            <p className="text-xs text-slate-500 mt-1">'광고' 표시는 정액 광고상품 이용을 의미하며, 전문성 인증이나 추천이 아닙니다. 광고비는 상담 건수·수임 여부와 무관한 고정금액입니다.</p>
          </div>
          <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topAdLawyers.slice(0, 6).map((l) => (
              <div
                key={l.id}
                onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)}
                className="relative group p-5 rounded-xl border-2 border-[#1E3A5F]/15 bg-gradient-to-br from-[#1E3A5F]/5 to-white hover:border-[#1E3A5F]/30 hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <span className="absolute top-3 right-3 bg-[#1E3A5F]/10 text-[#1E3A5F] text-xs font-bold px-2 py-0.5 rounded-lg border border-[#1E3A5F]/20">
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
                    <img src={l.avatarData || l.avatar} alt={l.name} className="w-[76px] h-[76px] rounded-xl object-cover border-2 border-[#1E3A5F]/15 shadow-sm" />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <span className="font-bold text-lg text-slate-900 block truncate">{l.name}</span>
                    <span className="text-sm text-slate-600 block font-medium">{l.region} · {l.courtJurisdiction || l.region + '법원'}</span>
                    <div className="flex flex-wrap gap-1">
                      {l.fields.slice(0, 3).map(f => (
                        <span key={f} className="text-xs text-[#1E3A5F] font-bold px-2 py-0.5 bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {l.catchphrase && (
                  <p className="mt-3 text-sm text-slate-600 italic leading-relaxed border-t border-[#1E3A5F]/10 pt-2.5">
                    "{l.catchphrase}"
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-500 font-medium">
                    {l.totalCases && <span>수임 <strong className="text-[#1E3A5F] font-bold">{l.totalCases}건</strong></span>}
                  </div>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    상담 가능
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Region Selection Grid */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5 text-left">
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
                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white shadow-md scale-[1.03]' 
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
        <div className="flex items-center justify-between">
          <div className="text-left text-sm text-slate-600 dark:text-slate-400 font-bold">
            아래 전문가 목록에서 상담을 요청할 변호사를 직접 선택하세요. 플랫폼은 특정 전문가를 추천·배정하지 않습니다. 상담 및 사건 수행은 선택하신 변호사가 독립적으로 진행합니다.
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

        {/* 검색 투명성 바 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800">
          <span>정렬: 무작위</span>
          <span className="text-slate-300">|</span>
          <span>필터: {selectedRegion}{showFavoritesOnly ? ' · 즐겨찾기' : ''}</span>
          <span className="text-slate-300">|</span>
          <span>광고 {topAdLawyers.length + paidLawyers.length}건 포함</span>
          <span className="text-slate-300">|</span>
          <span>사건정보 미반영</span>
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
            {/* ── 지역 광고 변호사 (regional + basic) — 큰 카드 ── */}
            {paidLawyers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">광고 · 지역 전문가</h3>
                  <span className="text-sm text-slate-400 font-medium">({paidLawyers.length}명)</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-slate-400 font-medium select-none">
                    AD 광고 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-200 text-xs text-slate-400 font-bold">ⓘ</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paidLawyers.map(l => (
                    <div key={l.id} onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)} className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-premium hover:shadow-xl hover:-translate-y-0.5 border p-6 flex flex-col sm:flex-row gap-5 transition-all duration-300 group relative overflow-hidden text-left cursor-pointer ${
                      selectionMode && selectedLawyerIds.includes(l.id)
                        ? 'border-brand ring-2 ring-brand/20 shadow-brand/10'
                        : 'border-blue-100 dark:border-blue-800 ring-1 ring-blue-100'
                    }`}>
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
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
                            <h3 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">{l.name}</h3>
                            <span className="text-sm text-slate-500 dark:text-slate-500 font-medium">{l.courtJurisdiction || l.region + ' 법원'} 전담 지원</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-lg border border-blue-200">광고</span>
                            <button type="button" onClick={(e) => toggleFavorite(l.id, e)} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-rose-300 hover:bg-rose-50 transition-all cursor-pointer group/fav">
                              <Heart className={`w-4 h-4 transition-colors ${favorites.has(l.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-300 group-hover/fav:text-rose-400'}`} />
                            </button>
                          </div>
                        </div>
                        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{l.bio}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {l.fields.map(f => (
                            <span key={f} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-bold">#{f}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>상황 밀착 상담</span>
                          <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>채무 전략 관리</span>
                          <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>사건 신속 진행</span>
                          <span className="flex items-center gap-1.5"><span className="text-xs text-brand/75">•</span>면책 후 신용 케어</span>
                        </div>
                        <div className="pt-2 flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800">
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-sm font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{l.recentActivity}</span>
                          </span>
                          <button onClick={() => onSelectLawyer(l.id)} className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all duration-300 text-sm cursor-pointer shadow-sm hover:shadow-brand-sm transform hover:-translate-y-0.5 active:scale-[0.98]">
                            이 전문가에게 상담 요청하기
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 기본등록 변호사 (무료 회원) — 첨부파일 스타일 컴팩트 카드 ── */}
            {freeLawyers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">기본등록 변호사</h3>
                  <span className="text-sm text-slate-400 font-medium">({freeLawyers.length}명)</span>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-0.5 rounded-full">무료 회원</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {freePaginated.map(l => (
                    <div
                      key={l.id}
                      onClick={() => selectionMode ? toggleSelection(l.id) : setProfileLawyer(l)}
                      className={`bg-slate-50/80 border border-slate-100 rounded-2xl p-5 flex items-center gap-4 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all cursor-pointer group/file relative ${
                        selectionMode && selectedLawyerIds.includes(l.id)
                          ? 'border-brand ring-2 ring-brand/20 bg-brand/5'
                          : ''
                      }`}
                    >
                      {selectionMode && (
                        <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                          selectedLawyerIds.includes(l.id)
                            ? 'bg-brand border-brand'
                            : 'bg-white border-slate-300'
                        }`}>
                          {selectedLawyerIds.includes(l.id) && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      <div className="relative shrink-0">
                        <img src={l.avatar} alt={l.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-slate-900 truncate">{l.name}</span>
                          <span className="text-sm text-slate-500 font-medium shrink-0">{l.courtJurisdiction || l.region}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {l.fields.slice(0, 3).map(f => (
                            <span key={f} className="text-xs text-slate-600 font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-md">{f}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 group-hover/file:text-slate-500 transition-colors" />
                    </div>
                  ))}
                </div>

                {/* Pagination — 무료 변호사만 */}
                {freeTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-4">
                    <button type="button" disabled={page === 1} onClick={() => { setPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === 1 ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>이전</button>
                    {Array.from({ length: freeTotalPages }).map((_, idx) => {
                      const pNum = idx + 1;
                      return (
                        <button key={pNum} type="button" onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === pNum ? 'bg-brand border-brand text-white shadow-md shadow-brand/20 scale-105' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>{pNum}</button>
                      );
                    })}
                    <button type="button" disabled={page === freeTotalPages} onClick={() => { setPage(prev => Math.min(freeTotalPages, prev + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${page === freeTotalPages ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>다음</button>
                  </div>
                )}
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
