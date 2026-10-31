// 홈 Hero 오른쪽 슬라이더 (CT-5·AD-4): 서비스 약속 카드 + 브랜드 배너(통합어드민 게시) + 메인 배너 광고(승인 소재)
// - 광고에는 '광고' 표시와 광고책임 변호사·사무소명, 광고끼리 순서는 방문마다 무작위(세션 고정)
// - 광고 비율 상한: 광고 다음에는 브랜드 칸이 오도록 섞고, 광고는 한 바퀴에 최대 5개
// - 움직임 줄이기 설정이면 자동 넘김 없음, 마우스·포커스가 있으면 멈춤
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MainBanner } from '../../../types';
import { fetchHomeAdSlides, trackAdEvent, type HomeAdSlide } from '../../../services/ads/adCreativeService';

type Slide =
  | { type: 'promise'; key: string }
  | { type: 'brand'; key: string; banner: MainBanner }
  | { type: 'ad'; key: string; ad: HomeAdSlide };

const MAX_ADS = 5;
const INTERVAL_MS = 6500;

function sessionShuffle<T extends { orderId: string }>(list: T[]): T[] {
  let seed = Number(sessionStorage.getItem('mykim_ad_seed') || 0);
  if (!seed) { seed = Math.floor(Math.random() * 1e9) + 1; try { sessionStorage.setItem('mykim_ad_seed', String(seed)); } catch { /* 화면 설정 저장 실패는 무시 */ } }
  const score = (id: string) => { let h = seed; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
  return [...list].sort((a, b) => score(a.orderId) - score(b.orderId));
}

export default function HeroSlider({ promise, banners, onOpenLawyerProfile }: {
  promise: React.ReactNode;
  banners: MainBanner[];
  onOpenLawyerProfile?: (lawyerId: string) => void;
}) {
  const [ads, setAds] = useState<HomeAdSlide[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchHomeAdSlides().then(list => { if (!cancelled) setAds(sessionShuffle(list).slice(0, MAX_ADS)); });
    return () => { cancelled = true; };
  }, []);

  const slides: Slide[] = useMemo(() => {
    const brand: Slide[] = banners.filter(b => b.image && b.title).map(b => ({ type: 'brand', key: `b-${b.id}`, banner: b }));
    const out: Slide[] = [{ type: 'promise', key: 'promise' }];
    let bi = 0;
    for (const ad of ads) {
      out.push({ type: 'ad', key: `a-${ad.orderId}`, ad });
      if (bi < brand.length) out.push(brand[bi++]);
    }
    while (bi < brand.length) out.push(brand[bi++]);
    return out;
  }, [banners, ads]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { if (idx >= slides.length) setIdx(0); }, [slides.length, idx]);
  useEffect(() => {
    if (slides.length < 2 || paused || reduceMotion.current) return;
    const t = window.setInterval(() => { if (!document.hidden) setIdx(i => (i + 1) % slides.length); }, INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [slides.length, paused]);

  const current = slides[Math.min(idx, slides.length - 1)];
  useEffect(() => { if (current?.type === 'ad') trackAdEvent(current.ad.orderId, 'impression'); }, [current]);

  if (slides.length === 1) return <>{promise}</>;

  const go = (d: number) => setIdx(i => (i + d + slides.length) % slides.length);
  return (
    <section
      className="lg:col-span-5 relative"
      aria-roledescription="carousel"
      aria-label="안내 및 광고"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    >
      <div aria-live={paused ? 'polite' : 'off'}>
        {current.type === 'promise' && promise}
        {current.type === 'brand' && (
          <figure className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 relative aspect-[4/3]">
            <img src={current.banner.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" loading="lazy" />
            <figcaption className="relative h-full flex flex-col justify-end p-6 text-white" style={{ background: `linear-gradient(to top, ${current.banner.color || 'rgba(15,23,42,0.9), rgba(15,23,42,0.2)'})` }}>
              {current.banner.badge && <span className="self-start text-xs font-bold bg-white/15 rounded-lg px-2 py-0.5 mb-2">{current.banner.badge}</span>}
              <p className="text-xl font-extrabold leading-snug break-keep">{current.banner.title}</p>
              {current.banner.subtitle && <p className="mt-1.5 text-sm text-slate-100 leading-relaxed break-keep">{current.banner.subtitle}</p>}
            </figcaption>
          </figure>
        )}
        {current.type === 'ad' && (
          <button
            type="button"
            onClick={() => { trackAdEvent(current.ad.orderId, 'profile_open'); onOpenLawyerProfile?.(current.ad.lawyerId); }}
            className="block w-full text-left rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 relative aspect-[4/3] active:scale-[0.99] cursor-pointer"
            aria-label={`광고: ${current.ad.lawyerName} 변호사 프로필 보기`}
          >
            <picture>
              {current.ad.mobileImageUrl && <source media="(max-width: 639px)" srcSet={current.ad.mobileImageUrl} />}
              <img src={current.ad.imageUrl} alt={current.ad.altText} className="absolute inset-0 w-full h-full object-cover" />
            </picture>
            <span className="absolute top-3 left-3 text-xs font-bold bg-white text-slate-900 rounded-lg px-2 py-0.5">광고</span>
            <span className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950/90 to-transparent text-white">
              <span className="block text-lg font-extrabold break-keep">{current.ad.headline}</span>
              {current.ad.subline && <span className="block text-sm text-slate-100 mt-0.5 break-keep">{current.ad.subline}</span>}
              <span className="block text-xs text-slate-300 mt-2">광고책임 변호사 {current.ad.lawyerName}{current.ad.officeName ? ` · ${current.ad.officeName}` : ''} · 광고는 무작위 순서</span>
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 active:scale-[0.98]" aria-label="이전 슬라이드">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5" role="tablist" aria-label="슬라이드 고르기">
          {slides.map((s, i) => (
            <button key={s.key} type="button" role="tab" aria-selected={i === idx} aria-label={`${i + 1}번째 슬라이드${s.type === 'ad' ? ' (광고)' : ''}`}
              onClick={() => setIdx(i)} className="min-h-[24px] min-w-[24px] inline-flex items-center justify-center">
              <span className={`block h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-slate-800' : 'w-2 bg-slate-300'}`} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(1)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 active:scale-[0.98]" aria-label="다음 슬라이드">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
