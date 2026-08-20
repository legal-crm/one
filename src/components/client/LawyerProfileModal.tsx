import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Award, BookOpen, Briefcase, Star, TrendingDown, Scale, Shield, ChevronRight, Phone, MessageSquare, CheckCircle, Clock, Users, GraduationCap, Building, Heart, FileText, Paperclip, Download, Eye, Copy, Check, ExternalLink, Navigation, Home } from 'lucide-react';
import type { User, LawFirm } from '../../types';
import { mockLawFirms } from '../../data';

interface LawyerProfileModalProps {
  lawyer: User;
  onClose: () => void;
  onConsult: (lawyerId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

// 의뢰인 후기 mock
const mockReviews = [
  { id: 1, author: '김○○', date: '2026.06.15', content: '처음 상담할 때부터 너무 친절하고 꼼꼼하게 설명해주셔서 불안한 마음이 많이 줄었습니다. 변제율도 예상보다 낮게 나와서 정말 감사합니다.', tag: '개인회생' },
  { id: 2, author: '박○○', date: '2026.05.28', content: '다른 곳에서 기각될 수 있다고 했는데, 여기서 보정명령 대응까지 완벽하게 처리해주셔서 무사히 인가 받았습니다.', tag: '보정명령 대응' },
  { id: 3, author: '이○○', date: '2026.05.10', content: '진행 과정을 매번 카톡으로 알려주셔서 안심하고 맡길 수 있었습니다. 채권추심도 바로 멈춰주셨어요.', tag: '채권추심 차단' },
  { id: 4, author: '최○○', date: '2026.04.22', content: '가족에게 비밀로 진행해야 했는데, 보안 유지하면서도 빠르게 처리해주셨습니다. 정말 감사드립니다.', tag: '비밀 상담' },
  { id: 5, author: '정○○', date: '2026.04.05', content: '3억이 넘는 채무였는데 변제율 25%로 인가받아서 월 상환금이 크게 줄었습니다. 새 출발할 수 있게 되었어요.', tag: '고액채무' },
];

function getLawyerOfficeInfo(lawyer: User, firm?: LawFirm) {
  const firmName = firm?.name || lawyer.firmName || '법무법인 한빛';
  const region = lawyer.region || '서울';
  const displayName = lawyer.name.replace(' 변호사', '');
  
  const baseChannels = {
    websiteUrl: 'https://hanbitlaw.co.kr',
    youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName + ' 변호사 개인회생')}`,
    blogUrl: `https://section.blog.naver.com/Search/Post.naver?pageNo=1&rangeType=ALL&orderBy=sim&keyword=${encodeURIComponent(displayName + ' 변호사 개인회생')}`,
  };
  
  if (region.includes('부산') || firmName.includes('해원')) {
    return {
      ...baseChannels,
      firmName: firmName.includes('법무') || firmName.includes('법률') ? firmName : `${firmName} 법률사무소`,
      address: '부산광역시 연제구 법원남로 15, 거제빌딩 7층 (연제동)',
      detail: '부산지방법원·부산가정법원 맞은편 도보 2분',
      subway: '3호선 거제역 6번 출구 도보 2분 / 동해선 거제해맞이역 도보 5분',
      phone: '051-507-9012',
      hours: '평일 09:00 ~ 18:00 (야간·주말 예약 상담 가능)',
      parking: '건물 내 지하 1~2층 무료 주차 2시간 지원',
      websiteUrl: 'https://haewonlaw.co.kr',
    };
  }
  
  if (region.includes('경기') || region.includes('수원') || firmName.includes('하늘')) {
    return {
      ...baseChannels,
      firmName: firmName.includes('법무') || firmName.includes('법률') ? firmName : `${firmName} 법률사무소`,
      address: '경기도 수원시 영통구 광교중앙로 248, 광교법조타워 4층 402호',
      detail: '수원고등법원·수원지방법원 정문 앞 도보 3분',
      subway: '신분당선 광교중앙역 4번 출구 버스 5분 / 상현역 2번 출구 도보 10분',
      phone: '031-215-5678',
      hours: '평일 09:00 ~ 18:00 (야간·주말 예약 상담 가능)',
      parking: '지하 1~3층 전용 주차장 무료 이용',
      websiteUrl: 'https://skylawfirm.co.kr',
    };
  }

  // 기본값 (서울 서초 법조타운)
  return {
    ...baseChannels,
    firmName: firmName.includes('법무') || firmName.includes('법률') ? firmName : `${firmName} 법률사무소`,
    address: '서울특별시 서초구 서초대로 250, 스타빌딩 6층 (서초동)',
    detail: '서울회생법원·서울중앙지방법원 인근 도보 3분',
    subway: '2호선 서초역 1번 출구 도보 3분 / 2·3호선 교대역 10번 출구 도보 5분',
    phone: '02-588-1234',
    hours: '평일 09:00 ~ 18:30 (야간·주말 사전 예약 시 상담 가능)',
    parking: '기계식 및 자주식 무료 발렛 주차 지원',
  };
}

export default function LawyerProfileModal({ lawyer, onClose, onConsult, isFavorite, onToggleFavorite }: LawyerProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'info' | 'reviews'>('home');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const firm = mockLawFirms.find(f => f.id === lawyer.lawFirmId);
  const displayName = lawyer.name.replace(' 변호사', '');
  const reviewCount = 12 + (lawyer.matchedCount % 20);
  const officeInfo = getLawyerOfficeInfo(lawyer, firm);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(officeInfo.address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const tabs = [
    { key: 'home' as const, label: '변호사홈' },
    { key: 'info' as const, label: '변호사 정보' },
    { key: 'reviews' as const, label: `의뢰인 후기 ${reviewCount}` },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-[720px] my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* ── 상단 버튼들 ── */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {onToggleFavorite && (
            <button onClick={onToggleFavorite} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isFavorite ? 'bg-rose-500/80 hover:bg-rose-500' : 'bg-black/30 hover:bg-black/50'
            }`}>
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white text-white' : 'text-white'}`} />
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══════════════════════════════════════
            히어로 섹션
        ═══════════════════════════════════════ */}
        <div className="relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-brand overflow-hidden shrink-0">
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
                  <span key={f} className="bg-white/10 border border-white/10 text-white/80 text-xs px-2.5 py-1 rounded-lg font-bold">#{f}</span>
                ))}
              </div>

              {/* 캐치프레이즈 */}
              {lawyer.catchphrase && (
                <p className="text-sm text-white/50 font-medium leading-relaxed pt-1 max-w-md">
                  "{lawyer.catchphrase}"
                </p>
              )}

              {/* ── 공식 채널 바로가기 아이콘 (홈페이지, 유튜브, 네이버 블로그) ── */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                {/* 홈페이지 */}
                <a
                  href={officeInfo.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="사무소 공식 홈페이지"
                  className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                >
                  <Home className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                </a>

                {/* 유튜브 */}
                <a
                  href={officeInfo.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="유튜브 채널"
                  className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-white fill-current transition-colors" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>

                {/* 네이버 블로그 */}
                <a
                  href={officeInfo.blogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="네이버 블로그"
                  className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-white fill-current transition-colors" viewBox="0 0 24 24">
                    <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="relative z-10 flex border-t border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm sm:text-base font-bold transition-all cursor-pointer relative ${
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
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 text-left">

          {/* ── TAB: 변호사홈 ── */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 핵심 통계 */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '누적 수임', value: `${(lawyer.totalCases || lawyer.matchedCount * 6).toLocaleString()}건`, icon: Briefcase, color: 'text-brand' },
                  { label: '전문 분야', value: (lawyer.fields || ['개인회생']).slice(0, 2).join('·'), icon: Scale, color: 'text-indigo-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 space-y-1.5">
                    <stat.icon className={`w-5 h-5 mx-auto ${stat.color}`} />
                    <div className="text-lg sm:text-xl font-black text-slate-900">{stat.value}</div>
                    <div className="text-[12px] text-slate-500 font-bold uppercase">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* 변호사 소개 */}
              <div className="bg-gradient-to-r from-brand/5 to-indigo-500/5 border border-brand/10 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand" />
                  변호사 소개
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{lawyer.bio}</p>
              </div>

              {/* 최근 활동 */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
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
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
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
                        <h4 className="font-bold text-sm text-slate-900">{svc.title}</h4>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">{svc.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 사무소 위치 및 오시는 길 (카카오 지도) ── */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#1E3A5F]" />
                    사무소 위치 및 연락처
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    방문 상담 가능
                  </span>
                </div>

                {/* 사무소 상세 정보 */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">{officeInfo.firmName}</span>
                      <span className="text-xs text-slate-500 ml-2">({officeInfo.detail})</span>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-slate-700 font-medium leading-snug">{officeInfo.address}</span>
                    </div>
                    <button
                      onClick={handleCopyAddress}
                      className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#1E3A5F] hover:text-brand bg-white border border-slate-200 hover:border-[#1E3A5F]/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>주소 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <a
                        href={`tel:${officeInfo.phone}`}
                        className="font-bold text-[#1E3A5F] hover:underline"
                      >
                        {officeInfo.phone}
                      </a>
                    </div>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-500 font-medium">{officeInfo.hours}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                    <Navigation className="w-4 h-4 text-[#1E3A5F] mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p><strong className="text-slate-700">대중교통:</strong> {officeInfo.subway}</p>
                      <p><strong className="text-slate-700">주차 안내:</strong> {officeInfo.parking}</p>
                    </div>
                  </div>
                </div>

                {/* ── 카카오 지도 비주얼 카드 & 길찾기 버튼 ── */}
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {/* 지도 비주얼 목업 배경 */}
                  <div className="h-32 sm:h-36 w-full relative bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 flex items-center justify-center overflow-hidden">
                    {/* 지도 격자 및 도로 라인 시뮬레이션 */}
                    <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      <path d="M -10 60 Q 150 40 400 90 T 800 60" fill="none" stroke="#CBD5E1" strokeWidth="8" />
                      <path d="M 200 -10 L 220 200" fill="none" stroke="#CBD5E1" strokeWidth="6" />
                      <path d="M 350 -10 L 330 200" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                    </svg>

                    {/* 중앙 핀 & 레이블 */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="bg-[#1E3A5F] text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border border-white/20">
                        <Building className="w-3.5 h-3.5 text-teal-400" />
                        <span>{officeInfo.firmName}</span>
                      </div>
                      <div className="w-2.5 h-2.5 bg-[#1E3A5F] rotate-45 -mt-1.5 shadow-sm"></div>
                      <div className="w-2 h-1 bg-black/20 rounded-full mt-0.5 blur-[1px]"></div>
                    </div>

                    {/* 카카오맵 워터마크 뱃지 */}
                    <div className="absolute top-2.5 left-2.5 z-10 bg-[#FEE500] text-[#191919] font-black text-[10px] px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                      <span>kakao</span>
                      <span className="font-bold text-[9px]">map</span>
                    </div>
                  </div>

                  {/* 지도 하단 액션 바 */}
                  <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 font-medium truncate max-w-[260px] sm:max-w-xs">
                      📍 {officeInfo.address}
                    </div>
                    <a
                      href={`https://map.kakao.com/link/search/${encodeURIComponent(officeInfo.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-extrabold text-xs px-3.5 py-2 rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                    >
                      <span>카카오맵으로 길찾기</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── TAB: 변호사 정보 ── */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 전문 분야 상세 */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand" />
                  전문 분야
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(lawyer.specialties || lawyer.fields).map(s => (
                    <span key={s} className="bg-brand/5 border border-brand/15 text-brand text-sm px-3 py-1.5 rounded-lg font-bold">{s}</span>
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
                      <row.icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm text-slate-500 font-bold">{row.label}</span>
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
                <h3 className="font-bold text-base text-slate-900">인증 뱃지</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: '대한변협 등록', sub: '도산법 전문', icon: '⚖️' },
                    { label: '회생법원 전담', sub: lawyer.courtJurisdiction || '', icon: '🏛️' },
                    { label: `수임 ${(lawyer.totalCases || 100)}건+`, sub: '인가 실적', icon: '🏆' },
                  ].map(badge => (
                    <div key={badge.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{badge.label}</div>
                        <div className="text-[12px] text-brand font-bold">{badge.sub}</div>
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
              {/* 후기 안내 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-600 font-medium">이용 후기 {reviewCount}건</p>
                <p className="text-[11px] text-slate-400 mt-1">※ 후기는 실제 상담 이용자의 주관적 의견이며, 개별 사례마다 결과가 다를 수 있습니다.</p>
              </div>

              {/* 후기 목록 */}
              <div className="space-y-3">
                {mockReviews.map(review => (
                  <div key={review.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {review.author.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-700">{review.author}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-brand/5 text-brand text-[11px] font-bold px-2 py-0.5 rounded">{review.tag}</span>
                        <span className="text-[12px] text-slate-300">{review.date}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed pl-10 font-medium">{review.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 서비스 한계 고지 */}
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700 text-left">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              본 플랫폼은 이용자가 전문가 정보를 검색·열람할 수 있도록 지원하는 정보기술 서비스입니다. 
              플랫폼은 특정 전문가를 추천·배정하지 않으며, 법률상담 및 위임계약은 이용자와 해당 전문가 사이에 직접 체결됩니다. 
              전문가의 상담 내용, 업무 수행 결과 또는 사건 결과를 보장하지 않습니다.
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            하단 고정 CTA 바
        ═══════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-5 sm:px-7 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <button className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#1E3A5F] hover:border-[#1E3A5F]/30 transition-colors cursor-pointer">
              <Phone className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#1E3A5F] hover:border-[#1E3A5F]/30 transition-colors cursor-pointer">
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => onConsult(lawyer.id)}
            className="flex-1 sm:flex-none bg-[#1E3A5F] hover:bg-[#163152] text-white font-extrabold py-3.5 px-8 rounded-xl transition-all shadow-md cursor-pointer text-sm sm:text-base flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>이 전문가를 직접 선택하여 상담 요청</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
