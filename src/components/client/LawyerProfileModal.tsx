import React, { useState } from 'react';
import { X, MapPin, Award, BookOpen, Briefcase, Star, TrendingDown, Scale, Shield, ChevronRight, Phone, MessageSquare, CheckCircle, Clock, Users, GraduationCap, Building } from 'lucide-react';
import type { User } from '../../types';
import { mockLawFirms } from '../../data';

interface LawyerProfileModalProps {
  lawyer: User;
  onClose: () => void;
  onConsult: (lawyerId: string) => void;
}

// 의뢰인 후기 mock
const mockReviews = [
  { id: 1, author: '김○○', rating: 5, date: '2026.06.15', content: '처음 상담할 때부터 너무 친절하고 꼼꼼하게 설명해주셔서 불안한 마음이 많이 줄었습니다. 변제율도 예상보다 낮게 나와서 정말 감사합니다.', tag: '개인회생' },
  { id: 2, author: '박○○', rating: 5, date: '2026.05.28', content: '다른 곳에서 기각될 수 있다고 했는데, 여기서 보정명령 대응까지 완벽하게 처리해주셔서 무사히 인가 받았습니다.', tag: '보정명령 대응' },
  { id: 3, author: '이○○', rating: 4, date: '2026.05.10', content: '진행 과정을 매번 카톡으로 알려주셔서 안심하고 맡길 수 있었습니다. 채권추심도 바로 멈춰주셨어요.', tag: '채권추심 차단' },
  { id: 4, author: '최○○', rating: 5, date: '2026.04.22', content: '가족에게 비밀로 진행해야 했는데, 보안 유지하면서도 빠르게 처리해주셨습니다. 정말 감사드립니다.', tag: '비밀 상담' },
  { id: 5, author: '정○○', rating: 5, date: '2026.04.05', content: '3억이 넘는 채무였는데 변제율 25%로 인가받아서 월 상환금이 크게 줄었습니다. 새 출발할 수 있게 되었어요.', tag: '고액채무' },
];

export default function LawyerProfileModal({ lawyer, onClose, onConsult }: LawyerProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'info' | 'reviews'>('home');

  const firm = mockLawFirms.find(f => f.id === lawyer.lawFirmId);
  const displayName = lawyer.name.replace(' 변호사', '');
  const reviewCount = 12 + (lawyer.matchedCount % 20);
  const avgRating = 4.7 + ((lawyer.matchedCount % 3) * 0.1);

  const tabs = [
    { key: 'home' as const, label: '변호사홈' },
    { key: 'info' as const, label: '변호사 정보' },
    { key: 'reviews' as const, label: `의뢰인 후기 ${reviewCount}` },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-[720px] my-4 sm:my-8 bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* ── 닫기 버튼 ── */}
        <button onClick={onClose} className="absolute top-4 right-4 z-50 w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        {/* ═══════════════════════════════════════
            히어로 섹션
        ═══════════════════════════════════════ */}
        <div className="relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-brand overflow-hidden">
          {/* 배경 글로우 */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-brand/40 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-0 right-1/4 w-[250px] h-[250px] bg-indigo-500/30 rounded-full blur-[80px]"></div>
          </div>

          <div className="relative z-10 px-6 sm:px-8 pt-10 pb-6 flex flex-col sm:flex-row items-center gap-6">
            {/* 프로필 사진 */}
            <div className="relative shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-[3px] border-white/20 shadow-xl">
                <img src={lawyer.avatarData || lawyer.avatar} alt={lawyer.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-[3px] border-white rounded-full"></div>
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{displayName} 변호사</h1>
                <div className="bg-brand/30 border border-brand/40 rounded-full p-1">
                  <CheckCircle className="w-4 h-4 text-brand-light" />
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-white/60">
                <Building className="w-3.5 h-3.5" />
                <span className="font-medium">{firm?.name || '법률사무소'}</span>
                <span className="text-white/30">·</span>
                <MapPin className="w-3.5 h-3.5" />
                <span>{lawyer.region}</span>
              </div>

              {/* 전문 분야 태그 */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                {lawyer.fields.map(f => (
                  <span key={f} className="bg-white/10 border border-white/10 text-white/80 text-[10px] px-2.5 py-1 rounded-lg font-bold">#{f}</span>
                ))}
              </div>

              {/* 캐치프레이즈 */}
              {lawyer.catchphrase && (
                <p className="text-sm text-white/50 font-medium leading-relaxed pt-1 max-w-md">
                  "{lawyer.catchphrase}"
                </p>
              )}
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="relative z-10 flex border-t border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer relative ${
                  activeTab === tab.key
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-brand rounded-t-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            탭 콘텐츠
        ═══════════════════════════════════════ */}
        <div className="p-5 sm:p-7 space-y-6 max-h-[60vh] overflow-y-auto">

          {/* ── TAB: 변호사홈 ── */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 핵심 통계 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '누적 수임', value: `${(lawyer.totalCases || lawyer.matchedCount * 6).toLocaleString()}건`, icon: Briefcase, color: 'text-brand' },
                  { label: '인가 성공률', value: `${lawyer.successRate || 96}%`, icon: Award, color: 'text-emerald-500' },
                  { label: '평균 변제율', value: `${lawyer.avgRepaymentRate || 30}%`, icon: TrendingDown, color: 'text-amber-500' },
                  { label: '의뢰인 만족', value: `${avgRating.toFixed(1)}점`, icon: Star, color: 'text-yellow-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 space-y-1.5">
                    <stat.icon className={`w-5 h-5 mx-auto ${stat.color}`} />
                    <div className="text-lg sm:text-xl font-black text-slate-800">{stat.value}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* 변호사 소개 */}
              <div className="bg-gradient-to-r from-brand/5 to-indigo-500/5 border border-brand/10 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand" />
                  변호사 소개
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{lawyer.bio}</p>
              </div>

              {/* 최근 활동 */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  최근 활동
                </h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                  <span className="text-sm text-emerald-600 font-medium">{lawyer.recentActivity}</span>
                </div>
              </div>

              {/* 전담 서비스 */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand" />
                  전담 서비스 안내
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: '무료 초기 상담', desc: '채무 현황 분석 및 최적 해결 방안 무료 안내', emoji: '💬' },
                    { title: '1:1 밀착 관리', desc: '사건 접수부터 인가까지 전 과정 전담 케어', emoji: '🤝' },
                    { title: '보정명령 긴급 대응', desc: '법원 보정명령 발생 시 48시간 내 즉시 대응', emoji: '⚡' },
                    { title: '신용 회복 가이드', desc: '면책 후 신용 등급 회복 로드맵 무료 제공', emoji: '📈' },
                  ].map(svc => (
                    <div key={svc.title} className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3 hover:border-brand/20 hover:shadow-sm transition-all">
                      <span className="text-lg">{svc.emoji}</span>
                      <div>
                        <h4 className="font-bold text-xs text-slate-800">{svc.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{svc.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: 변호사 정보 ── */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 전문 분야 상세 */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand" />
                  전문 분야
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(lawyer.specialties || lawyer.fields).map(s => (
                    <span key={s} className="bg-brand/5 border border-brand/15 text-brand text-xs px-3 py-1.5 rounded-lg font-bold">{s}</span>
                  ))}
                </div>
              </div>

              {/* 정보 테이블 */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {[
                  { label: '관할 법원', value: lawyer.courtJurisdiction || `${lawyer.region} 법원`, icon: Building },
                  { label: '경력', value: null, icon: Briefcase, list: lawyer.career },
                  { label: '자격', value: lawyer.certYear || '변호사시험 합격', icon: Award },
                  { label: '소속', value: lawyer.barAssociation || '대한변호사협회', icon: Users },
                  { label: '학력', value: lawyer.education || '법학전문대학원 졸업', icon: GraduationCap },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex items-center gap-2 w-24 shrink-0">
                      <row.icon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-400 font-bold">{row.label}</span>
                    </div>
                    <div className="flex-1 text-left">
                      {row.list ? (
                        <div className="space-y-1">
                          {row.list.map((item, i) => (
                            <div key={i} className="text-sm text-slate-700 font-medium flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-brand mt-1 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-700 font-medium">{row.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 인증 뱃지 */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-800">인증 뱃지</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: '대한변협 등록', sub: '도산법 전문', icon: '⚖️' },
                    { label: '회생법원 전담', sub: lawyer.courtJurisdiction || '', icon: '🏛️' },
                    { label: `수임 ${(lawyer.totalCases || 100)}건+`, sub: '인가 실적', icon: '🏆' },
                  ].map(badge => (
                    <div key={badge.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{badge.label}</div>
                        <div className="text-[10px] text-brand font-bold">{badge.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: 의뢰인 후기 ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-5 animate-fadeIn">
              {/* 만족도 요약 */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-5">
                <div className="text-center space-y-1">
                  <div className="text-3xl font-black text-amber-600">{avgRating.toFixed(1)}</div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <div className="text-[10px] text-amber-600/60 font-bold">{reviewCount}건</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[
                    { label: '전문성', pct: 96 },
                    { label: '친절함', pct: 98 },
                    { label: '신속함', pct: 94 },
                    { label: '결과 만족', pct: 95 },
                  ].map(bar => (
                    <div key={bar.label} className="flex items-center gap-2 text-[10px]">
                      <span className="w-14 text-slate-500 font-bold text-right">{bar.label}</span>
                      <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${bar.pct}%` }}></div>
                      </div>
                      <span className="w-8 text-amber-600 font-bold">{bar.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 후기 목록 */}
              <div className="space-y-3">
                {mockReviews.map(review => (
                  <div key={review.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {review.author.charAt(0)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700">{review.author}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} className={`w-3 h-3 ${i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-brand/5 text-brand text-[9px] font-bold px-2 py-0.5 rounded">{review.tag}</span>
                        <span className="text-[10px] text-slate-300">{review.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-10">{review.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            하단 고정 CTA 바
        ═══════════════════════════════════════ */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <button className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer">
              <Phone className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer">
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => onConsult(lawyer.id)}
            className="flex-1 sm:flex-none bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-extrabold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-brand/20 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>이 변호사에게 무료 상담 신청</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
