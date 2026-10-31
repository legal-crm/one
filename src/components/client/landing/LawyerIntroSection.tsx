// 홈 '변호사 소개' 띠 (AD-4, 고객 기획서 1-C, 10-24 결정)
// - 메인 배너·상단 노출 광고를 산 변호사가 먼저('광고' 표시), 자리가 남으면 공개 조건을 채운 등록 변호사('등록 변호사' 표시)
// - 같은 묶음 안에서는 세션마다 섞는다 (광고비·실적 순 정렬 없음, 변호사법 제34조)
// - 실적·감면율 같은 숫자는 넣지 않는다. 누르면 프로필을 연다
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { User } from '../../../types';
import { getAffiliation, getAvatarSrc, getDisplayName, isPubliclyListable } from '../lawyerDirectory';

const MAX = 8;
const SEED_KEY = 'mykim_lawyer_intro_seed';

function sessionSeed(): number {
  try {
    const v = sessionStorage.getItem(SEED_KEY);
    if (v) return Number(v) || 1;
    const n = Math.floor(Math.random() * 2 ** 31) + 1;
    sessionStorage.setItem(SEED_KEY, String(n));
    return n;
  } catch { return 1; }
}
function shuffled<T>(list: T[], seed: number): T[] {
  const a = [...list];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const hasRealPhoto = (l: User) => {
  const src = getAvatarSrc(l) || '';
  return !!src && !src.startsWith('data:') && !/ui-avatars|placeholder|dicebear/i.test(src);
};

export default function LawyerIntroSection({ lawyers, onOpenLawyerProfile, onBrowseLawyers }: {
  lawyers: User[];
  onOpenLawyerProfile: (id: string) => void;
  onBrowseLawyers: () => void;
}) {
  const items = useMemo(() => {
    const seed = sessionSeed();
    const pool = lawyers.filter(l => isPubliclyListable(l) && hasRealPhoto(l));
    const ads = pool.filter(l => l.adTier === 'top' || l.adTier === 'banner');
    const rest = pool.filter(l => !ads.includes(l));
    return [
      ...shuffled(ads, seed).map(l => ({ l, ad: true })),
      ...shuffled(rest, seed + 7).map(l => ({ l, ad: false })),
    ].slice(0, MAX);
  }, [lawyers]);

  if (items.length === 0) return null;
  return (
    <section className="bg-white border-t border-slate-100" aria-labelledby="lawyer-intro-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="lawyer-intro-title" className="text-xl sm:text-2xl font-black text-slate-900">마이김변에 등록한 변호사</h2>
            <p className="text-sm text-slate-600 mt-1">순서는 매번 섞여요. 상담할 변호사는 직접 골라 주세요.</p>
          </div>
          <button type="button" onClick={onBrowseLawyers} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap inline-flex items-center gap-1 hover:bg-slate-50 active:scale-[0.98]">
            변호사 찾기 <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="flex gap-3 overflow-x-auto pb-2 snap-x" aria-label="등록 변호사">
          {items.map(({ l, ad }) => (
            <li key={l.id} className="snap-start shrink-0 w-44">
              <button type="button" onClick={() => onOpenLawyerProfile(l.id)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow active:scale-[0.98]">
                <div className="relative aspect-[4/5] bg-slate-100">
                  <img src={getAvatarSrc(l)} alt={`${getDisplayName(l)} 변호사 사진`} loading="lazy" className="w-full h-full object-cover" />
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[11px] font-bold ${ad ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-700 border border-slate-200'}`}>
                    {ad ? '광고' : '등록 변호사'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-black text-slate-900 truncate">{getDisplayName(l)} 변호사</p>
                  <p className="text-xs text-slate-600 truncate">{getAffiliation(l) || '사무소 정보 확인'}</p>
                  {l.region && <p className="text-xs text-slate-500 truncate mt-0.5">{l.region}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {items.some(i => i.ad) && (
          <p className="text-xs text-slate-500">'광고'는 마이김변 정액 광고를 이용하는 변호사예요. 광고 여부는 전문성 인증이나 추천이 아니에요.</p>
        )}
      </div>
    </section>
  );
}
