import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowRight, CheckCircle2, Heart, Info, ListChecks, MapPin, SearchX, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User, SuccessReview } from '../../types';
import { cn } from '../../utils/cn';
import LawyerCard from './LawyerCard';
import LawyerProfileModal from './LawyerProfileModal';
import { Button, EmptyState, FilterChips, PageHeader, Pagination, SearchField } from './ui';
import {
  LAWYER_REGIONS,
  type LawyerRegion,
  getDisplayName,
  isAdLawyer,
  isPubliclyListable,
  loadFavorites,
  saveFavorites,
} from './lawyerDirectory';

const ITEMS_PER_PAGE = 10;
/** 상단 광고는 한 번에 이만큼만 보여 준다 */
const TOP_AD_LIMIT = 6;

interface LawyersViewProps {
  lawyers: User[];
  /**
   * 이 변호사에게 상담 요청.
   * 내 상황 체크를 마친 요청이 있으면 동의 창을 거쳐 바로 보내고, 없으면 체크부터 시작한다(ClientRole이 판단).
   */
  onSelectLawyer: (lawyerId: string) => void;
  /** 여러 명 선택 모드 (ClientRole이 상태를 가진다: 모바일 하단 메뉴 대신 선택 바를 보여 주기 위해) */
  selectionMode?: boolean;
  onSelectionModeChange?: (on: boolean) => void;
  /** 이번에 더 고를 수 있는 변호사 수 (한도 − 이미 요청한 수) */
  maxSelections?: number;
  /** 한 상담에 요청할 수 있는 전체 한도 (안내 문구용) */
  requestLimit?: number;
  onConfirmSelection?: (lawyerIds: string[]) => void;
  hasCompletedCheck?: boolean;
  /** 변호사를 더할 수 있는 진행 중 상담 요청이 있음 (체크를 다시 하지 않고 바로 요청 가능) */
  canRequestNow?: boolean;
  /** 그 상담 요청에서 이미 요청한 변호사 */
  requestedLawyerIds?: string[];
  /** 로그인 전 (요청을 보낼 때 로그인 창이 열린다는 안내용) */
  requiresLogin?: boolean;
  onStartCheck?: () => void;
  /** 내 관리방(상담방)으로 이동 */
  onOpenConsultRoom?: () => void;
  /** 플랫폼 이용 후기 (프로필 모달에서 해당 변호사 후기만 표시) */
  reviews?: SuccessReview[];
}

export default function LawyersView({
  lawyers,
  onSelectLawyer,
  selectionMode = false,
  onSelectionModeChange,
  maxSelections = 3,
  requestLimit = 3,
  onConfirmSelection,
  hasCompletedCheck,
  canRequestNow = false,
  requestedLawyerIds = [],
  requiresLogin = false,
  onStartCheck,
  onOpenConsultRoom,
  reviews,
}: LawyersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<LawyerRegion>('전체');
  const [page, setPage] = useState(1);
  const [profileLawyer, setProfileLawyer] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedLawyerIds, setSelectedLawyerIds] = useState<string[]>([]);
  const listTopRef = useRef<HTMLDivElement>(null);

  // 내 관리방 '즐겨찾기한 변호사에게 요청'에서 넘어오면 즐겨찾기 필터를 켠 채로 연다
  useEffect(() => {
    const favMode = localStorage.getItem('lawyer_view_favorites_mode');
    if (favMode === 'true') {
      setShowFavoritesOnly(true);
      localStorage.removeItem('lawyer_view_favorites_mode');
    }
  }, []);

  const slotsLeft = Math.max(0, maxSelections);
  // 요청할 상담이 있고 더 고를 자리가 있을 때만 선택 화면을 보여 준다
  const isSelecting = selectionMode && canRequestNow && slotsLeft > 0;

  // 선택 모드를 끝내면 고른 목록도 비운다
  useEffect(() => {
    if (!isSelecting) setSelectedLawyerIds([]);
  }, [isSelecting]);

  // 선택 바가 떠 있는 동안에는 키보드로 옮긴 포커스가 바 아래에 가려지지 않도록 스크롤 여백을 늘린다
  useEffect(() => {
    if (!isSelecting) return;
    const root = document.documentElement;
    const prev = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = 'calc(11rem + env(safe-area-inset-bottom))';
    return () => { root.style.scrollPaddingBottom = prev; };
  }, [isSelecting]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedLawyerIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= slotsLeft) {
        toast.info(`이번에는 ${slotsLeft}명까지 고를 수 있습니다.`);
        return prev;
      }
      return [...prev, id];
    });
  }, [slotsLeft]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  // ── 같은 광고 등급 내 무작위 정렬 (방문 세션마다 1회 셔플, 화면 내에서는 순서 고정) ──
  // 정액 광고 상품 간 노출 순서 우대를 없애기 위함 (목록 위 '정렬: 무작위' 안내와 일치)
  const [shuffleSeed] = useState(() => Math.random());
  const rankOf = useCallback((id: string) => {
    let h = Math.floor(shuffleSeed * 2147483647);
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return h;
  }, [shuffleSeed]);

  const listable = useMemo(
    () => lawyers.filter(isPubliclyListable).sort((a, b) => rankOf(a.id) - rankOf(b.id)),
    [lawyers, rankOf]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listable.filter(l => {
      const matchesSearch = !q
        || l.name.toLowerCase().includes(q)
        || (l.fields || []).some(f => f.toLowerCase().includes(q))
        || (l.bio || '').toLowerCase().includes(q)
        || (l.firmName || '').toLowerCase().includes(q);
      const matchesRegion = selectedRegion === '전체' || (l.region || '').includes(selectedRegion);
      const matchesFav = !showFavoritesOnly || favorites.has(l.id);
      return matchesSearch && matchesRegion && matchesFav;
    });
  }, [listable, searchQuery, selectedRegion, showFavoritesOnly, favorites]);

  const hasActiveFilter = !!searchQuery.trim() || selectedRegion !== '전체' || showFavoritesOnly;

  // ── 광고 등급별 분류 (광고와 일반 등록을 섞지 않고 구역을 나눠 표시) ──
  // 상단 광고(top)는 조건 없이 볼 때 맨 위 광고 구역에 노출한다.
  // 검색·지역·즐겨찾기 조건을 걸면 조건에 맞는 광고만 결과의 광고 구역에 보여 준다(조건과 다른 변호사가 섞여 보이지 않게).
  const topAdLawyers = useMemo(
    () => (hasActiveFilter ? [] : listable.filter(l => l.adTier === 'top').slice(0, TOP_AD_LIMIT)),
    [listable, hasActiveFilter]
  );
  const paidLawyers = useMemo(() => {
    const shownOnTop = new Set(topAdLawyers.map(l => l.id));
    return filtered.filter(l => isAdLawyer(l) && !shownOnTop.has(l.id));
  }, [filtered, topAdLawyers]);
  const freeLawyers = useMemo(() => filtered.filter(l => !isAdLawyer(l)), [filtered]);

  const freeTotalPages = Math.max(1, Math.ceil(freeLawyers.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, freeTotalPages);
  const freePaginated = freeLawyers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const resultCount = filtered.length;
  const adCount = topAdLawyers.length + paidLawyers.length;

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRegion('전체');
    setShowFavoritesOnly(false);
    setPage(1);
  };

  const changePage = (p: number) => {
    setPage(p);
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const lawyerById = useMemo(() => new Map(lawyers.map(l => [l.id, l])), [lawyers]);
  const selectionFull = selectedLawyerIds.length >= slotsLeft;

  const renderCard = (l: User, isAd: boolean, className?: string) => {
    const isRequested = requestedLawyerIds.includes(l.id);
    return (
      <LawyerCard
        key={l.id}
        lawyer={l}
        isAd={isAd}
        className={className}
        isFavorite={favorites.has(l.id)}
        onToggleFavorite={() => toggleFavorite(l.id)}
        onOpenProfile={() => setProfileLawyer(l)}
        onRequest={() => onSelectLawyer(l.id)}
        isRequested={isRequested}
        selection={isSelecting && !isRequested ? {
          selected: selectedLawyerIds.includes(l.id),
          disabled: selectionFull,
          onToggle: () => toggleSelection(l.id),
        } : undefined}
      />
    );
  };

  const enterSelectionMode = () => {
    onSelectionModeChange?.(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 목록 위 안내 한 줄: 지금 상태에서 할 수 있는 다음 행동 ──
  const renderGuide = () => {
    if (isSelecting) {
      return (
        <div className="rounded-2xl border border-brand/20 bg-brand-light px-4 py-3.5 sm:px-5 flex items-start gap-3">
          <ListChecks className="w-5 h-5 text-brand mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0 text-sm leading-relaxed break-keep">
            <p className="font-bold text-slate-900">상담을 요청할 변호사를 {slotsLeft}명까지 고르세요</p>
            <p className="text-slate-700">카드를 누르면 프로필을 볼 수 있어요. 보내기 전에 받는 변호사를 확인하고 동의합니다.</p>
          </div>
        </div>
      );
    }
    if (canRequestNow && slotsLeft === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Info className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-slate-700 leading-relaxed break-keep">
              이 상담은 이미 변호사 {requestLimit}명에게 요청했어요. 기존 요청을 취소하면 다른 변호사를 고를 수 있습니다.
            </p>
          </div>
          {onOpenConsultRoom && (
            <Button variant="secondary" onClick={onOpenConsultRoom} className="self-start sm:self-auto">내 관리방 보기</Button>
          )}
        </div>
      );
    }
    if (canRequestNow) {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-sm leading-relaxed break-keep">
              <p className="font-bold text-emerald-950">체크 결과로 바로 상담을 요청할 수 있어요</p>
              <p className="text-emerald-900">
                {requestedLawyerIds.length > 0
                  ? `이미 ${requestedLawyerIds.length}명에게 요청했고, ${slotsLeft}명을 더 고를 수 있어요.`
                  : `여러 변호사의 제안을 비교하려면 ${slotsLeft}명까지 한 번에 고르세요.`}
                {requiresLogin && ' 요청을 보낼 때 로그인합니다.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={enterSelectionMode} leftIcon={<ListChecks className="w-4 h-4" aria-hidden="true" />} className="self-start sm:self-auto">
            여러 명 골라 요청하기
          </Button>
        </div>
      );
    }
    if (!hasCompletedCheck) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Info className="w-5 h-5 text-brand mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-sm leading-relaxed break-keep">
              <p className="font-bold text-slate-900">상담 요청 전에 내 상황 체크(약 3분)가 필요해요</p>
              <p className="text-slate-700">변호사를 먼저 골라도 됩니다. 체크를 마치면 그 변호사에게 보낼지 확인해요.</p>
            </div>
          </div>
          {onStartCheck && (
            <Button onClick={onStartCheck} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />} className="self-start sm:self-auto">
              내 상황 체크하기
            </Button>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="변호사 찾기"
        description="변호사를 비교하고 직접 고르세요. 플랫폼은 특정 변호사를 추천하거나 배정하지 않습니다."
        className="mb-0 pb-4"
      >
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600" aria-label="변호사 찾기 안내">
          <li className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            <span>등록 변호사 <strong className="text-slate-900">{listable.length}명</strong></span>
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            <span>계약 전 스텔스 가명 상담</span>
          </li>
          <li className="flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            <span>최대 {requestLimit}명 동시 요청</span>
          </li>
        </ul>
      </PageHeader>

      {renderGuide()}

      {/* 검색·필터 */}
      <div className="space-y-3">
        <SearchField
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setPage(1); }}
          label="변호사 검색"
          placeholder="변호사 이름, 사무소, 분야로 검색"
        />
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-slate-400 mt-3.5 shrink-0 hidden sm:block" aria-hidden="true" />
          <FilterChips
            options={LAWYER_REGIONS.map(r => ({ value: r, label: r }))}
            value={selectedRegion}
            onChange={(v) => { setSelectedRegion(v); setPage(1); }}
            label="사무소 지역"
            className="flex-1 min-w-0"
          />
        </div>
        <p className="text-xs text-slate-500 break-keep">방문 상담을 원하면 사무소 지역을 고르세요.</p>
      </div>

      {/* 상단 광고 (상품: 상단 노출) — 모바일은 가로로 넘겨 보기 */}
      {topAdLawyers.length > 0 && (
        <section aria-labelledby="lawyers-top-ads" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 id="lawyers-top-ads" className="text-lg font-bold text-slate-900">광고 변호사</h2>
            <span className="text-xs text-slate-500 font-bold shrink-0">AD</span>
          </div>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
            {topAdLawyers.map(l => (
              <div key={l.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
                {renderCard(l, true, 'h-full')}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 break-keep">
            '광고' 표시는 정액 광고상품 이용을 의미하며, 전문성 인증이나 추천이 아닙니다. 광고비는 상담 건수·수임 여부와 무관한 고정금액입니다.
          </p>
        </section>
      )}

      {/* 목록 */}
      <div ref={listTopRef} className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm font-bold text-slate-900" aria-live="polite">
            {hasActiveFilter ? `조건에 맞는 변호사 ${resultCount}명` : `변호사 ${resultCount}명`}
          </p>
          <button
            type="button"
            onClick={() => { setShowFavoritesOnly(v => !v); setPage(1); }}
            aria-pressed={showFavoritesOnly}
            className={cn(
              'ml-auto min-h-11 inline-flex items-center gap-1.5 px-3.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors',
              showFavoritesOnly ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400',
            )}
          >
            <Heart className={cn('w-4 h-4', showFavoritesOnly && 'fill-rose-500 text-rose-500')} aria-hidden="true" />
            즐겨찾기만{favorites.size > 0 ? ` ${favorites.size}` : ''}
          </button>
          <p className="basis-full text-xs text-slate-500 break-keep">
            정렬: 무작위 · 광고 {adCount}건 포함 · 체크 결과(사건 정보)는 목록 순서에 반영하지 않습니다
          </p>
        </div>

        {resultCount === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              icon={showFavoritesOnly ? <Heart className="w-6 h-6" /> : <SearchX className="w-6 h-6" />}
              title={showFavoritesOnly && favorites.size === 0 ? '즐겨찾기한 변호사가 없습니다' : '조건에 맞는 변호사가 없습니다'}
              description={showFavoritesOnly && favorites.size === 0
                ? '카드의 하트를 누르면 즐겨찾기에 담겨 나중에 다시 볼 수 있어요.'
                : '다른 지역을 고르거나 검색어를 바꿔 보세요.'}
              action={hasActiveFilter ? <Button variant="secondary" onClick={resetFilters}>조건 초기화</Button> : undefined}
            />
          </div>
        ) : (
          <>
            {paidLawyers.length > 0 && (
              <section aria-labelledby="lawyers-paid" className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 id="lawyers-paid" className="text-lg font-bold text-slate-900">
                    광고 · 지역 변호사 <span className="text-sm font-bold text-slate-500">{paidLawyers.length}명</span>
                  </h2>
                  <span className="text-xs text-slate-500 font-bold shrink-0">AD</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paidLawyers.map(l => renderCard(l, true))}
                </div>
              </section>
            )}

            {freeLawyers.length > 0 && (
              <section aria-labelledby="lawyers-free" className="space-y-3">
                <h2 id="lawyers-free" className="text-lg font-bold text-slate-900">
                  등록 변호사 <span className="text-sm font-bold text-slate-500">{freeLawyers.length}명</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {freePaginated.map(l => renderCard(l, false))}
                </div>
                <Pagination page={currentPage} totalPages={freeTotalPages} onChange={changePage} />
              </section>
            )}
          </>
        )}

        <p className="text-xs text-slate-500 leading-relaxed break-keep">
          상담을 요청할 변호사는 이용자가 직접 선택합니다. 상담 및 사건 수행은 선택한 변호사가 독립적으로 진행합니다.
        </p>
      </div>

      {/* 변호사 프로필 모달 (선택 모드에서도 프로필을 보고 그 자리에서 고를 수 있다) */}
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
          reviews={reviews}
          isRequested={requestedLawyerIds.includes(profileLawyer.id)}
          selection={isSelecting && !requestedLawyerIds.includes(profileLawyer.id) ? {
            selected: selectedLawyerIds.includes(profileLawyer.id),
            disabled: selectionFull,
            onToggle: () => toggleSelection(profileLawyer.id),
            limitText: `이번에는 ${slotsLeft}명까지 고를 수 있어요. 다른 변호사를 빼면 고를 수 있습니다.`,
          } : undefined}
        />
      )}

      {/* 선택 바: 모바일 하단 메뉴 자리(z-45)를 대신 쓴다. 본문 끝이 가려지지 않도록 같은 높이의 여백을 둔다 */}
      {isSelecting && (
        <>
          <div aria-hidden="true" className={selectedLawyerIds.length > 0 ? 'h-40' : 'h-28'} />
          <div
            role="region"
            aria-label="선택한 변호사"
            className="fixed inset-x-0 bottom-0 z-45 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900" aria-live="polite">
                  변호사 {selectedLawyerIds.length}/{slotsLeft}명 선택
                </p>
                <button
                  type="button"
                  onClick={() => onSelectionModeChange?.(false)}
                  className="ml-auto min-h-11 px-3 -mr-3 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 whitespace-nowrap"
                >
                  선택 그만하기
                </button>
              </div>
              {selectedLawyerIds.length > 0 && (
                <ul className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1" aria-label="고른 변호사">
                  {selectedLawyerIds.map(id => {
                    const l = lawyerById.get(id);
                    const name = l ? getDisplayName(l) : '선택한';
                    return (
                      <li key={id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSelection(id)}
                          aria-label={`${name} 변호사 선택 해제`}
                          className="min-h-11 inline-flex items-center gap-1.5 pl-3.5 pr-2.5 rounded-xl bg-brand-light border border-brand/15 text-sm font-bold text-brand whitespace-nowrap hover:bg-brand/10"
                        >
                          {name} 변호사
                          <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                size="lg"
                fullWidth
                disabled={selectedLawyerIds.length === 0}
                onClick={() => onConfirmSelection?.(selectedLawyerIds)}
              >
                {selectedLawyerIds.length > 0 ? `${selectedLawyerIds.length}명에게 상담 요청하기` : '변호사를 골라 주세요'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
