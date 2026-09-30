import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adBanners } from '../../../data';
import { buttonClassName } from '../ui';

/**
 * 프리미엄 변호사 쇼케이스 광고 (DEV 전용)
 * data.ts 시드 광고(가상 변호사·근거 없는 수치)는 개발 환경에서만 보인다.
 * 실제 광고 소재 저장·승인 경로가 생기기 전까지 운영에서는 렌더링하지 않는다.
 */
export default function ShowcaseAdSection({ onOpenLawyerProfile }: { onOpenLawyerProfile: (lawyerId: string) => void }) {
  const [ads] = useState(() => (import.meta.env.DEV ? [...adBanners] : []).filter((b) => b.isActive !== false).sort(() => Math.random() - 0.5));
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || ads.length <= 1) return;
    // 움직임 줄이기 설정 사용자는 자동 회전하지 않는다
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setPage((p) => (p + 1) % ads.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, ads.length]);

  if (ads.length === 0) return null;
  const total = ads.length;
  const banner = ads[page % total];
  const navBtn =
    'w-11 h-11 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <section
      className="w-full py-6 md:py-8 bg-slate-50 border-b border-slate-200"
      aria-label="변호사 광고"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-brand-deep rounded-2xl overflow-hidden flex flex-row items-stretch min-h-[150px] md:min-h-[220px]">
          <div className="flex-1 p-5 md:p-8 flex flex-col justify-center min-w-0 relative z-10">
            <span className="inline-block self-start bg-white/15 text-white text-xs font-bold px-2 py-1 rounded-lg mb-2">프리미엄 광고</span>
            <h3 className="text-base md:text-2xl font-bold text-white leading-tight truncate">{banner.title}</h3>
            <p className="mt-1 flex items-center gap-2 min-w-0">
              <span className="text-sm md:text-xl font-extrabold text-white shrink-0">{banner.lawyerName}</span>
              <span className="text-xs md:text-base text-slate-300 truncate">{banner.subtitle}</span>
            </p>
            {banner.tagline && <p className="hidden md:block mt-3 text-base text-slate-300 border-l-2 border-amber-400 pl-3 break-keep">“{banner.tagline}”</p>}
            <div className="mt-4">
              <button type="button" onClick={() => onOpenLawyerProfile(banner.lawyerId)} className={buttonClassName('inverse', 'md')}>
                프로필 보기
              </button>
            </div>
          </div>
          <div className="relative w-[120px] md:w-[220px] shrink-0 overflow-hidden">
            <img src={banner.lawyerAvatar} alt="" className="w-full h-full object-cover object-top" />
          </div>
          {total > 1 && (
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 flex items-center gap-2 z-20">
              <button type="button" aria-label="이전 광고" onClick={() => setPage((p) => (p === 0 ? total - 1 : p - 1))} className={navBtn}>
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="다음 광고" onClick={() => setPage((p) => (p + 1) % total)} className={navBtn}>
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="bg-black/40 px-3 py-1.5 rounded-full text-xs font-bold text-white" aria-live="polite">
                {(page % total) + 1} / {total}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-bold">AD</span>
          변호사가 직접 등록한 유료 광고이며, 무작위 순서로 노출됩니다.
        </p>
      </div>
    </section>
  );
}
