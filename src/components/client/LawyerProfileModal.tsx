import React, { useMemo, useState } from 'react';
import {
  MapPin, Award, BookOpen, Briefcase, Scale, Shield, ChevronRight, Phone, Clock,
  GraduationCap, Building, Heart, Copy, Check, ExternalLink, Navigation, Home, Star, Wallet, BadgeCheck,
} from 'lucide-react';
import type { User, SuccessReview } from '../../types';
import { mockLawFirms } from '../../data';
import { cn } from '../../utils/cn';
import { Badge, Button, Modal, SegmentedTabs } from './ui';
import { getAvatarSrc, getDisplayName, getExperienceYears, isAdLawyer } from './lawyerDirectory';

// ─────────────────────────────────────────────────────────────────────────────
// 변호사 공개 프로필 (고객 사이트 공통 모달 위에서 동작: 포커스 가두기·ESC·배경 스크롤 잠금)
// 원칙: 변호사가 직접 등록했거나 플랫폼이 확인한 정보만 표시한다.
//  - 주소·전화·채널 링크를 임의로 만들어 채우지 않는다 (타인 번호·도메인 노출 위험)
//  - "전문" 표기, 실적 수치, 처리 기한 약속 등 광고규정 위반 소지가 있는 기본값을 쓰지 않는다
//  - 후기는 해당 변호사의 실제 후기만 표시한다
// 모바일은 전체 화면. 소개 영역은 스크롤과 함께 올라가고 탭만 위에 붙어 본문을 넓게 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

interface LawyerProfileModalProps {
  lawyer: User;
  onClose: () => void;
  onConsult: (lawyerId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** 플랫폼 이용 후기 전체 (해당 변호사 것만 필터링하여 표시) */
  reviews?: SuccessReview[];
  /** 이미 상담을 요청한 변호사면 요청 버튼 대신 상태를 보여 준다 */
  isRequested?: boolean;
  /** 변호사 찾기 선택 모드: 하단 버튼이 '선택/선택 해제'로 바뀐다 */
  selection?: { selected: boolean; disabled?: boolean; onToggle: () => void; limitText?: string };
}

type TabKey = 'home' | 'info' | 'reviews';

const isHttpUrl = (url?: string) => !!url && /^https?:\/\//i.test(url.trim());

export default function LawyerProfileModal({
  lawyer,
  onClose,
  onConsult,
  isFavorite,
  onToggleFavorite,
  reviews = [],
  isRequested = false,
  selection,
}: LawyerProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const firmName = lawyer.firmName || lawyer.firm || mockLawFirms.find(f => f.id === lawyer.lawFirmId)?.name || '';
  const displayName = getDisplayName(lawyer);
  const isVerified = lawyer.licenseStatus === 'verified';
  const years = getExperienceYears(lawyer.certYear);

  const lawyerReviews = useMemo(
    () => reviews.filter(r => r.lawyerId === lawyer.id),
    [reviews, lawyer.id]
  );

  const channels = [
    { key: 'web', url: lawyer.websiteUrl, label: '사무소 홈페이지', icon: <Home className="w-4 h-4" aria-hidden="true" /> },
    {
      key: 'youtube', url: lawyer.youtubeUrl, label: '유튜브 채널',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      key: 'blog', url: lawyer.blogUrl, label: '네이버 블로그',
      icon: (
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
        </svg>
      ),
    },
  ].filter(c => isHttpUrl(c.url));

  const handleCopyAddress = async () => {
    if (!lawyer.officeAddress) return;
    try {
      await navigator.clipboard.writeText(lawyer.officeAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch { /* 클립보드 권한 거부 시 무시 */ }
  };

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'home', label: '소개' },
    { id: 'info', label: '경력·정보' },
    { id: 'reviews', label: `후기 ${lawyerReviews.length}` },
  ];

  const infoRows: { label: string; icon: React.ElementType; value?: string; list?: string[] }[] = [
    { label: '소속', icon: Building, value: firmName || undefined },
    { label: '관할 법원', icon: Scale, value: lawyer.courtJurisdiction },
    { label: '경력', icon: Briefcase, list: lawyer.career && lawyer.career.length > 0 ? lawyer.career : undefined },
    { label: '자격', icon: Award, value: lawyer.certYear },
    { label: '등록번호', icon: BadgeCheck, value: isVerified && lawyer.licenseNumber ? `${lawyer.licenseNumber} (플랫폼 확인)` : undefined },
    { label: '소속 변호사회', icon: Shield, value: lawyer.barAssociation },
    { label: '학력', icon: GraduationCap, value: lawyer.education },
    { label: '상담 비용', icon: Wallet, value: lawyer.consultationFee || '상담 요청 시 변호사가 개별 안내' },
  ].filter(r => r.value || (r.list && r.list.length > 0));

  // ── 하단 버튼: 선택 모드면 선택/해제, 아니면 상담 요청 (이미 요청했으면 상태만) ──
  const primaryAction = selection ? (
    <Button
      size="lg"
      variant={selection.selected ? 'secondary' : 'primary'}
      disabled={!selection.selected && selection.disabled}
      onClick={selection.onToggle}
      aria-pressed={selection.selected}
      leftIcon={selection.selected ? <Check className="w-4 h-4" aria-hidden="true" /> : undefined}
      className="flex-1 sm:flex-none"
    >
      {selection.selected ? '선택 해제' : '이 변호사 선택'}
    </Button>
  ) : isRequested ? (
    <Badge tone="brand" size="md" icon={<Check className="w-4 h-4" aria-hidden="true" />} className="ml-auto">
      상담을 요청한 변호사입니다
    </Badge>
  ) : (
    <Button size="lg" onClick={() => onConsult(lawyer.id)} rightIcon={<ChevronRight className="w-4 h-4" aria-hidden="true" />} className="flex-1 sm:flex-none">
      이 변호사에게 상담 요청
    </Button>
  );

  const footer = (
    <div className="w-full flex flex-col gap-2">
      {selection && !selection.selected && selection.disabled && selection.limitText && (
        <p className="text-xs text-slate-600 text-right">{selection.limitText}</p>
      )}
      <div className="w-full flex items-center gap-2">
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={!!isFavorite}
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            className="w-12 h-12 shrink-0 rounded-xl border border-slate-300 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Heart className={cn('w-5 h-5', isFavorite && 'fill-rose-500 text-rose-500')} aria-hidden="true" />
          </button>
        )}
        <div className="flex-1 flex justify-end">{primaryAction}</div>
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`${displayName} 변호사`}
      description={[firmName, lawyer.region].filter(Boolean).join(' · ') || undefined}
      closeLabel="프로필 닫기"
      size="lg"
      mobile="fullscreen"
      bodyClassName="p-0 sm:p-0"
      footer={footer}
    >
      {/* 소개 요약: 스크롤하면 올라가고 탭만 위에 남는다 */}
      <section aria-label="프로필 요약" className="px-5 sm:px-6 pt-5 pb-4 flex items-start gap-4">
        <img
          src={getAvatarSrc(lawyer)}
          alt={`${displayName} 변호사 프로필 사진`}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-slate-100 border border-slate-200 shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {isAdLawyer(lawyer) && <Badge tone="neutral">광고</Badge>}
            {years && <Badge tone="warning" icon={<Award className="w-3 h-3" aria-hidden="true" />}>{years}년차</Badge>}
            {isVerified && (
              <Badge tone="success" icon={<BadgeCheck className="w-3 h-3" aria-hidden="true" />}>
                <span title="플랫폼이 변호사 등록번호를 확인했습니다">등록번호 확인</span>
              </Badge>
            )}
          </div>
          {lawyer.catchphrase && (
            <p className="text-sm text-slate-700 font-medium leading-relaxed break-keep">{lawyer.catchphrase}</p>
          )}
          <ul className="flex flex-wrap gap-1.5" aria-label="취급 분야">
            {lawyer.fields.map(f => (
              <li key={f} className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">{f}</li>
            ))}
          </ul>
          {channels.length > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {channels.map(c => (
                <a
                  key={c.key}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={`${c.label} (새 창)`}
                  title={c.label}
                  className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-brand hover:border-brand/30 hover:bg-brand-light transition-colors"
                >
                  {c.icon}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-5 sm:px-6 py-2 border-y border-slate-100">
        <SegmentedTabs<TabKey> tabs={tabs} value={activeTab} onChange={setActiveTab} ariaLabel="프로필 정보" idPrefix={`lawyer-profile-${lawyer.id}`} />
      </div>

      <div
        role="tabpanel"
        id={`lawyer-profile-${lawyer.id}-panel-${activeTab}`}
        aria-labelledby={`lawyer-profile-${lawyer.id}-tab-${activeTab}`}
        tabIndex={0}
        className="px-5 sm:px-6 py-5 space-y-5 text-left focus-visible:outline-none"
      >
        {activeTab === 'home' && (
          <>
            <section className="rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden="true" /> 변호사 소개
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-keep">
                {lawyer.bio || '등록된 소개글이 없습니다.'}
              </p>
            </section>

            {/* 사무소 위치 — 변호사가 등록한 경우에만 */}
            <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3.5">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" aria-hidden="true" /> 사무소 위치 및 연락처
              </h3>

              {lawyer.officeAddress || lawyer.officePhone ? (
                <div className="space-y-2.5 text-sm">
                  {firmName && (
                    <p className="flex items-start gap-2.5">
                      <Building className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="font-bold text-slate-900">{firmName}</span>
                    </p>
                  )}
                  {lawyer.officeAddress && (
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-start gap-2.5 min-w-0">
                        <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <span className="text-slate-700 leading-snug break-keep">{lawyer.officeAddress}</span>
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="shrink-0 min-h-11 inline-flex items-center gap-1 text-xs font-bold text-brand bg-white border border-slate-200 hover:border-brand/30 px-3 rounded-xl transition-colors whitespace-nowrap"
                      >
                        {copiedAddress
                          ? (<><Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /><span className="text-emerald-700">복사됨</span></>)
                          : (<><Copy className="w-3.5 h-3.5" aria-hidden="true" /><span>주소 복사</span></>)}
                      </button>
                    </div>
                  )}
                  {(lawyer.officePhone || lawyer.officeHours) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {lawyer.officePhone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                          <a href={`tel:${lawyer.officePhone.replace(/[^\d+]/g, '')}`} className="font-bold text-brand hover:underline">{lawyer.officePhone}</a>
                        </span>
                      )}
                      {lawyer.officeHours && (
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Clock className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />{lawyer.officeHours}
                        </span>
                      )}
                    </div>
                  )}
                  {lawyer.officeDirections && (
                    <p className="flex items-start gap-2.5 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                      <Navigation className="w-4 h-4 text-brand mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="whitespace-pre-wrap">{lawyer.officeDirections}</span>
                    </p>
                  )}
                  {lawyer.officeAddress && (
                    <a
                      href={`https://map.kakao.com/link/search/${encodeURIComponent(lawyer.officeAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-11 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-bold text-sm px-4 rounded-xl transition-colors whitespace-nowrap"
                    >
                      카카오맵에서 길찾기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="sr-only">(새 창)</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600 break-keep">
                  사무소 위치·연락처가 아직 등록되지 않았습니다. 상담 요청 후 변호사가 직접 안내합니다.
                  <span className="block text-xs text-slate-500 mt-1">비대면 상담이 가능한지도 상담 요청 때 변호사에게 확인할 수 있습니다.</span>
                </p>
              )}
            </section>
          </>
        )}

        {activeTab === 'info' && (
          <>
            <section className="space-y-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-brand" aria-hidden="true" /> 주요 취급 분야
              </h3>
              <ul className="flex flex-wrap gap-2">
                {(lawyer.specialties || lawyer.fields).map(s => (
                  <li key={s} className="bg-brand-light border border-brand/15 text-brand text-sm px-3 py-1.5 rounded-lg font-bold">{s}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 break-keep">
                취급 분야는 변호사가 직접 입력한 정보이며, 대한변호사협회 전문분야 등록 여부와는 별개입니다.
              </p>
            </section>

            {infoRows.length > 0 && (
              <dl className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {infoRows.map(row => (
                  <div key={row.label} className="flex items-start gap-4 px-4 sm:px-5 py-3.5">
                    <dt className="flex items-center gap-2 w-28 shrink-0 text-sm text-slate-600 font-bold">
                      <row.icon className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      {row.label}
                    </dt>
                    <dd className="flex-1 min-w-0 text-sm text-slate-800">
                      {row.list ? (
                        <ul className="space-y-1">
                          {row.list.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ChevronRight className="w-3.5 h-3.5 text-brand mt-1 shrink-0" aria-hidden="true" /><span className="break-keep">{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="break-keep">{row.value}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}

        {activeTab === 'reviews' && (
          <>
            <p className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed break-keep">
              후기는 이용자의 주관적 의견이며, 사건 결과는 개별 사정에 따라 다릅니다.
            </p>

            {lawyerReviews.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Star className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-700">아직 등록된 후기가 없습니다</p>
                <p className="text-xs text-slate-500">상담을 이용한 의뢰인이 후기를 남기면 이곳에 표시됩니다.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {lawyerReviews.map(review => (
                  <li key={review.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0" aria-hidden="true">
                          {review.author.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-800 truncate">{review.author}</span>
                      </div>
                      {(review.tags?.[0] || review.category) && (
                        <Badge tone="brand">{review.tags?.[0] || review.category}</Badge>
                      )}
                    </div>
                    {review.title && <p className="text-sm font-bold text-slate-900">{review.title}</p>}
                    <p className="text-sm text-slate-700 leading-relaxed break-keep">{review.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 leading-relaxed break-keep">
          본 플랫폼은 이용자가 전문가 정보를 검색·열람할 수 있도록 지원하는 정보기술 서비스입니다.
          플랫폼은 특정 전문가를 추천·배정하지 않으며, 법률상담 및 위임계약은 이용자와 해당 전문가 사이에 직접 체결됩니다.
          전문가의 상담 내용, 업무 수행 결과 또는 사건 결과를 보장하지 않습니다.
        </p>
      </div>
    </Modal>
  );
}
