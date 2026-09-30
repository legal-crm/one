import React from 'react';
import { Award, Briefcase, Check, Heart, MapPin, ShieldCheck } from 'lucide-react';
import type { User } from '../../types';
import { cn } from '../../utils/cn';
import { Badge, Button } from './ui';
import { getAffiliation, getAvatarSrc, getDisplayName, getExperienceYears, isLicenseVerified } from './lawyerDirectory';

/**
 * 변호사 카드 (변호사 찾기 전체에서 1종만 사용)
 * - 카드 어디를 눌러도 프로필이 열린다('프로필 보기' 버튼을 카드 전체로 늘린 방식이라 버튼 안에 버튼이 생기지 않는다)
 * - 기본 모드: [프로필 보기] [상담 요청] / 선택 모드: [프로필 보기] [선택] — 한 카드에 같은 의도의 버튼을 두지 않는다
 * - 광고 상품 이용 변호사는 '광고' 배지를 항상 보여 준다
 */
export interface LawyerCardSelection {
  selected: boolean;
  /** 한도에 닿아 더 고를 수 없음 */
  disabled: boolean;
  onToggle: () => void;
}

interface LawyerCardProps {
  lawyer: User;
  isAd?: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenProfile: () => void;
  /** 기본 모드의 주 버튼 */
  onRequest?: () => void;
  /** 이미 상담을 요청한 변호사 (요청 버튼 대신 상태 표시) */
  isRequested?: boolean;
  /** 선택 모드 */
  selection?: LawyerCardSelection;
  className?: string;
}

export default function LawyerCard({
  lawyer,
  isAd = false,
  isFavorite,
  onToggleFavorite,
  onOpenProfile,
  onRequest,
  isRequested = false,
  selection,
  className,
}: LawyerCardProps) {
  const name = getDisplayName(lawyer);
  const years = getExperienceYears(lawyer.certYear);
  const affiliation = getAffiliation(lawyer);
  const verified = isLicenseVerified(lawyer);
  const summary = lawyer.bio || lawyer.catchphrase || '';
  const fields = (lawyer.fields || []).slice(0, 4);
  const isSelected = !!selection?.selected;

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-white p-4 sm:p-5 transition-shadow hover:shadow-md',
        isSelected ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200 hover:border-slate-300',
        className,
      )}
      aria-label={`${name} 변호사${isAd ? ' (광고)' : ''}`}
    >
      <div className="flex items-start gap-3.5">
        <img
          src={getAvatarSrc(lawyer)}
          alt=""
          loading="lazy"
          className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 min-w-0 pt-0.5 text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
              {name} 변호사
            </h3>
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `${name} 변호사 즐겨찾기 해제` : `${name} 변호사 즐겨찾기 추가`}
              className="relative z-10 -mt-1.5 -mr-1.5 w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Heart className={cn('w-5 h-5', isFavorite && 'fill-rose-500 text-rose-500')} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-slate-600 flex items-center gap-1 min-w-0">
            {affiliation ? (
              <>
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{affiliation}</span>
                <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
              </>
            ) : (
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span className="shrink-0">{lawyer.region}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isAd && <Badge tone="neutral">광고</Badge>}
            {years && (
              <Badge tone="warning" icon={<Award className="w-3 h-3" aria-hidden="true" />}>
                {years}년차
              </Badge>
            )}
            {verified && (
              <Badge tone="success" icon={<ShieldCheck className="w-3 h-3" aria-hidden="true" />}>
                <span title="플랫폼이 변호사 등록번호를 확인했습니다">등록번호 확인</span>
              </Badge>
            )}
            {isRequested && (
              <Badge tone="brand" icon={<Check className="w-3 h-3" aria-hidden="true" />}>
                상담 요청함
              </Badge>
            )}
          </div>
        </div>
      </div>

      {summary && <p className="mt-3 text-sm text-slate-700 leading-relaxed line-clamp-2 break-keep">{summary}</p>}

      {fields.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="취급 분야">
          {fields.map((f) => (
            <li key={f} className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          {/* 카드 전체를 누르면 프로필이 열리도록 버튼 영역을 카드 크기로 늘린다(after:absolute). 다른 버튼은 z-10으로 위에 둔다 */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="min-h-11 -ml-2 px-2 rounded-xl text-sm font-bold text-slate-700 hover:text-brand whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            프로필 보기
            <span className="sr-only">: {name} 변호사</span>
          </button>
          <div className="relative z-10 ml-auto">
            {selection ? (
              <button
                type="button"
                onClick={selection.onToggle}
                aria-pressed={isSelected}
                disabled={!isSelected && selection.disabled}
                className={cn(
                  'min-h-11 px-4 rounded-xl border text-sm font-bold whitespace-nowrap inline-flex items-center gap-2 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isSelected ? 'bg-brand border-brand text-white hover:bg-brand-hover' : 'bg-white border-slate-300 text-slate-800 hover:border-brand hover:text-brand',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center',
                    isSelected ? 'border-white bg-white text-brand' : 'border-slate-300 bg-white',
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </span>
                {isSelected ? '선택됨' : '선택'}
                <span className="sr-only">: {name} 변호사</span>
              </button>
            ) : isRequested ? null : (
              onRequest && (
                <Button size="md" onClick={onRequest}>
                  상담 요청
                  <span className="sr-only">: {name} 변호사</span>
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
