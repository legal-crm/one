import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, MapPin, Award, BookOpen, Briefcase, Scale, Shield, ChevronRight, Phone, Clock,
  GraduationCap, Building, Heart, Copy, Check, ExternalLink, Navigation, Home, Star, Wallet, BadgeCheck,
} from 'lucide-react';
import type { User, SuccessReview } from '../../types';
import { mockLawFirms } from '../../data';

// ─────────────────────────────────────────────────────────────────────────────
// 변호사 공개 프로필
// 원칙: 변호사가 직접 등록했거나 플랫폼이 확인한 정보만 표시한다.
//  - 주소·전화·채널 링크를 임의로 만들어 채우지 않는다 (타인 번호·도메인 노출 위험)
//  - "전문" 표기, 실적 수치, 처리 기한 약속 등 광고규정 위반 소지가 있는 기본값을 쓰지 않는다
//  - 후기는 해당 변호사의 실제 후기만 표시한다
// ─────────────────────────────────────────────────────────────────────────────

interface LawyerProfileModalProps {
  lawyer: User;
  onClose: () => void;
  onConsult: (lawyerId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** 플랫폼 이용 후기 전체 (해당 변호사 것만 필터링하여 표시) */
  reviews?: SuccessReview[];
}

type TabKey = 'home' | 'info' | 'reviews';

const isHttpUrl = (url?: string) => !!url && /^https?:\/\//i.test(url.trim());

export default function LawyerProfileModal({ lawyer, onClose, onConsult, isFavorite, onToggleFavorite, reviews = [] }: LawyerProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const firmName = lawyer.firmName || mockLawFirms.find(f => f.id === lawyer.lawFirmId)?.name || '';
  const displayName = lawyer.name.replace(/\s*변호사$/, '');
  const isVerified = lawyer.licenseStatus === 'verified';

  const lawyerReviews = useMemo(
    () => reviews.filter(r => r.lawyerId === lawyer.id),
    [reviews, lawyer.id]
  );

  const channels = [
    { key: 'web', url: lawyer.websiteUrl, label: '사무소 홈페이지', icon: <Home className="w-4 h-4" /> },
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

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lawyer.officeAddress) return;
    try {
      await navigator.clipboard.writeText(lawyer.officeAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch { /* 클립보드 권한 거부 시 무시 */ }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'home', label: '변호사홈' },
    { key: 'info', label: '변호사 정보' },
    { key: 'reviews', label: `의뢰인 후기 ${lawyerReviews.length}` },
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lawyer-profile-title"
        className="relative w-full max-w-[720px] my-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 버튼 */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              aria-pressed={!!isFavorite}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${isFavorite ? 'bg-rose-500/90 hover:bg-rose-500' : 'bg-black/30 hover:bg-black/50'}`}
            >
              <Heart className={`w-4 h-4 text-white ${isFavorite ? 'fill-white' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="프로필 닫기"
            className="w-11 h-11 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 히어로 */}
        <div className="relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-brand overflow-hidden shrink-0">
          <div className="relative z-10 px-6 sm:px-8 pt-10 pb-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-[3px] border-white/20 shadow-xl shrink-0">
              <img src={lawyer.avatarData || lawyer.avatar} alt={`${displayName} 변호사 프로필 사진`} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 id="lawyer-profile-title" className="text-2xl sm:text-3xl font-black text-white tracking-tight">{displayName} 변호사</h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-lg" title="플랫폼이 변호사 등록번호를 확인했습니다">
                    <BadgeCheck className="w-3.5 h-3.5" /> 등록번호 확인
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-white/80 flex-wrap">
                {firmName && (<><Building className="w-3.5 h-3.5" /><span className="font-medium">{firmName}</span><span className="text-white/40" aria-hidden="true">·</span></>)}
                <MapPin className="w-3.5 h-3.5" />
                <span>{lawyer.region}</span>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                {lawyer.fields.map(f => (
                  <span key={f} className="bg-white/10 border border-white/15 text-white/90 text-xs px-2.5 py-1 rounded-lg font-bold">#{f}</span>
                ))}
              </div>

              {lawyer.catchphrase && (
                <p className="text-sm text-white/80 font-medium leading-relaxed pt-1 max-w-md">"{lawyer.catchphrase}"</p>
              )}

              {channels.length > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                  {channels.map(c => (
                    <a
                      key={c.key}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`${c.label} (새 창)`}
                      title={c.label}
                      className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-all active:scale-95"
                    >
                      {c.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div role="tablist" aria-label="프로필 정보" className="relative z-10 flex border-t border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-h-[44px] py-3 text-sm sm:text-base font-bold transition-all cursor-pointer relative whitespace-nowrap ${activeTab === tab.key ? 'text-white' : 'text-white/70 hover:text-white'}`}
              >
                {tab.label}
                {activeTab === tab.key && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-white rounded-t-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 text-left">
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fadeIn">
              <section className="bg-gradient-to-r from-brand/5 to-indigo-500/5 border border-brand/10 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand" /> 변호사 소개
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                  {lawyer.bio || '등록된 소개글이 없습니다.'}
                </p>
              </section>

              {/* 사무소 위치 — 변호사가 등록한 경우에만 */}
              <section className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1E3A5F]" /> 사무소 위치 및 연락처
                </h3>

                {lawyer.officeAddress || lawyer.officePhone ? (
                  <div className="space-y-2.5 text-sm">
                    {firmName && (
                      <div className="flex items-start gap-2.5">
                        <Building className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <span className="font-bold text-slate-900">{firmName}</span>
                      </div>
                    )}
                    {lawyer.officeAddress && (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                          <span className="text-slate-700 font-medium leading-snug">{lawyer.officeAddress}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="shrink-0 min-h-[36px] flex items-center gap-1 text-xs font-bold text-[#1E3A5F] bg-white border border-slate-200 hover:border-[#1E3A5F]/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedAddress
                            ? (<><Check className="w-3 h-3 text-emerald-600" /><span className="text-emerald-700">복사됨</span></>)
                            : (<><Copy className="w-3 h-3" /><span>주소 복사</span></>)}
                        </button>
                      </div>
                    )}
                    {(lawyer.officePhone || lawyer.officeHours) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        {lawyer.officePhone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                            <a href={`tel:${lawyer.officePhone.replace(/[^\d+]/g, '')}`} className="font-bold text-[#1E3A5F] hover:underline">{lawyer.officePhone}</a>
                          </span>
                        )}
                        {lawyer.officeHours && (
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <Clock className="w-4 h-4 text-slate-500 shrink-0" />{lawyer.officeHours}
                          </span>
                        )}
                      </div>
                    )}
                    {lawyer.officeDirections && (
                      <div className="flex items-start gap-2.5 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                        <Navigation className="w-4 h-4 text-[#1E3A5F] mt-0.5 shrink-0" />
                        <p className="whitespace-pre-wrap">{lawyer.officeDirections}</p>
                      </div>
                    )}
                    {lawyer.officeAddress && (
                      <a
                        href={`https://map.kakao.com/link/search/${encodeURIComponent(lawyer.officeAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 min-h-[44px] bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-extrabold text-sm px-4 py-2 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap"
                      >
                        카카오맵에서 길찾기 <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    사무소 위치·연락처가 아직 등록되지 않았습니다. 상담 요청 후 변호사가 직접 안내합니다.
                    <span className="block text-xs text-slate-500 mt-1">개인회생·파산은 대부분 비대면으로 진행할 수 있습니다.</span>
                  </p>
                )}
              </section>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-6 animate-fadeIn">
              <section className="space-y-3">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-brand" /> 주요 취급 분야
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(lawyer.specialties || lawyer.fields).map(s => (
                    <span key={s} className="bg-brand/5 border border-brand/15 text-brand text-sm px-3.5 py-1.5 rounded-lg font-bold">{s}</span>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  취급 분야는 변호사가 직접 입력한 정보이며, 대한변호사협회 전문분야 등록 여부와는 별개입니다.
                </p>
              </section>

              {infoRows.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {infoRows.map(row => (
                    <div key={row.label} className="flex items-start gap-4 px-5 py-4">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <row.icon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600 font-bold">{row.label}</span>
                      </div>
                      <div className="flex-1 text-left">
                        {row.list ? (
                          <ul className="space-y-1">
                            {row.list.map((item, i) => (
                              <li key={i} className="text-sm text-slate-700 font-medium flex items-start gap-1.5">
                                <ChevronRight className="w-3.5 h-3.5 text-brand mt-1 shrink-0" /><span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {typeof lawyer.totalCases === 'number' && lawyer.totalCases > 0 && (
                <p className="text-xs text-slate-500">누적 수임 {lawyer.totalCases.toLocaleString()}건 (변호사 제공 정보, 플랫폼 미검증)</p>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-base text-slate-800 font-bold">이용 후기 {lawyerReviews.length}건</p>
                <p className="text-xs text-slate-500 mt-1">※ 후기는 이용자의 주관적 의견이며, 사건 결과는 개별 사정에 따라 다릅니다.</p>
              </div>

              {lawyerReviews.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Star className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-bold text-slate-700">아직 등록된 후기가 없습니다</p>
                  <p className="text-xs text-slate-500">상담을 이용한 의뢰인이 후기를 남기면 이곳에 표시됩니다.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {lawyerReviews.map(review => (
                    <li key={review.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0" aria-hidden="true">
                            {review.author.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-800 truncate">{review.author}</span>
                        </div>
                        {(review.tags?.[0] || review.category) && (
                          <span className="bg-brand/5 text-brand text-xs font-bold px-2.5 py-0.5 rounded-lg shrink-0">{review.tags?.[0] || review.category}</span>
                        )}
                      </div>
                      {review.title && <p className="text-sm font-bold text-slate-900">{review.title}</p>}
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">{review.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 text-left">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              본 플랫폼은 이용자가 전문가 정보를 검색·열람할 수 있도록 지원하는 정보기술 서비스입니다.
              플랫폼은 특정 전문가를 추천·배정하지 않으며, 법률상담 및 위임계약은 이용자와 해당 전문가 사이에 직접 체결됩니다.
              전문가의 상담 내용, 업무 수행 결과 또는 사건 결과를 보장하지 않습니다.
            </p>
          </div>
        </div>

        {/* 하단 CTA */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-4 flex items-center justify-end gap-4 shrink-0">
          <button
            type="button"
            onClick={() => onConsult(lawyer.id)}
            className="w-full sm:w-auto min-h-[44px] whitespace-nowrap bg-[#1E3A5F] hover:bg-[#163152] text-white font-extrabold py-3.5 px-8 rounded-xl transition-all shadow-md cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>이 변호사에게 상담 요청</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
