import React, { useState, useEffect, useMemo } from 'react';
import {
  Key, Calendar as CalendarIcon, BarChart3, Edit3, AlertTriangle,
  RefreshCcw, Image as ImageIcon, Video, Target,
  Copy, CheckCheck, ShieldCheck, Sparkles, Download, Loader2, UploadCloud, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { DDOK_BLOG_PRESETS_DATA, generateBlogContentWithGemini, testMarketingAiConnection, BlogContentData } from '../../services/marketingAiService';
import { MARKETING_DISCLAIMER_SHORT, type ChannelCompliance } from '../../services/marketingAutopilotService';
// @ts-ignore — 순수 JS 모듈 (서버·브라우저 공용 규칙 검사기)
import { scanCompliance } from '../../../api/_lib/marketing-compliance.js';
import DailyAutopilotPanel from './marketing/DailyAutopilotPanel';
import { AutopilotCalendar, AutopilotAnalytics, AutopilotKeyStatus } from './marketing/AutopilotInsights';

/** 서버와 같은 규칙으로 화면에서 바로 검사한다 (법률 검토를 대신하지 않는다) */
const scanCopy = scanCompliance as unknown as (text: string, opts?: { skipDisclaimerCheck?: boolean }) => ChannelCompliance;

// --- 채널별 예시 원고 (직접 작성한 견본, AI 생성 아님) ---
// 문구 원칙: 매칭·배정·추천·견적 비교·결과 약속·근거 없는 수치·가짜 후기 없음. 기능은 사실만 쓴다.
interface CueItem { time: string; action: string; script: string }
interface SlideItem { page: number; headline: string; subtext: string; visualDesc: string }
interface TiktokScene { time: string; label: string; script: string; action: string; color: string }

const CHANNEL_FULL_CONTENTS: {
  shorts: { title: string; cueSheet: CueItem[]; hashtags: string[] };
  cardnews: { caption: string; slides: SlideItem[] };
  threads: { fullBody: string; firstComment: string };
  facebook: { fullBody: string; firstComment: string };
  tiktok: { overlay: string; caption: string; scenes: TiktokScene[] };
} = {
  shorts: {
    title: '빚 상담, 번호부터 남기기 망설여질 때 (35초 예시 대본)',
    cueSheet: [
      { time: '00~03초', action: '상담 신청서 번호 칸에서 멈추는 손 (인사말 없이 시작)', script: '빚 상담 알아보다가 번호 칸에서 멈춘 적 있나요?' },
      { time: '04~15초', action: '신청서 화면과 물음표 아이콘, 차분한 배경', script: '내 연락처가 누구에게 가는지 모르면 망설여지는 게 당연해요.' },
      { time: '16~27초', action: '스텔스 가명 화면 → 변호사 프로필 카드 중 직접 고르기', script: '마이김변에서는 스텔스 가명으로 채무·소득 정보를 정리하고, 변호사 프로필을 보고 최대 3명을 직접 골라 상담을 요청해요. 010 번호는 내가 허락하기 전까지 변호사에게 보이지 않아요.' },
      { time: '28~35초', action: '고정 댓글 안내 후 첫 장면 질문으로 이어지는 마무리', script: '이용 방법은 고정 댓글에 있어요. 인가와 면책은 법원이 사건별로 판단해요. 번호 칸에서 멈췄다면,' },
    ],
    hashtags: ['#개인회생', '#개인파산', '#신용회복', '#스텔스가명', '#마이김변'],
  },
  cardnews: {
    caption: `빚 상담을 알아보다가 번호 칸에서 멈춘 적 있나요?

상담을 시작하기 전에 확인하면 좋은 것 3가지를 정리했어요.
연락처를 받는 곳, 스텔스 가명, 변호사를 직접 고르는 방법이에요.

마이김변에서는 스텔스 가명으로 채무·소득 정보를 정리하고,
변호사 프로필을 보고 최대 3명까지 직접 골라 상담을 요청해요.
010 번호는 내가 허락하기 전까지 변호사에게 보이지 않아요.

📌 나중에 다시 보려면 [저장]을 눌러 두세요.
같은 고민을 하는 사람이 있다면 조용히 [공유]해 주세요.

※ ${MARKETING_DISCLAIMER_SHORT}

#개인회생 #개인파산 #신용회복 #스텔스가명 #마이김변`,
    slides: [
      { page: 1, headline: '빚 상담, 시작 전에 확인할 3가지', subtext: '번호를 남기기 전에, 변호사를 고르기 전에 (옆으로 넘겨 보기 ➔)', visualDesc: '차분한 남색 배경에 큰 제목만 둔 표지' },
      { page: 2, headline: '매달 이자만 갚고 있나요?', subtext: '원금이 줄지 않는다면 법이 정한 채무 정리 절차를 알아볼 때예요', visualDesc: '달력과 영수증 아이콘을 단순하게 배치' },
      { page: 3, headline: '상담을 망설이는 이유', subtext: '연락처가 어디로 가는지 몰라서, 주변에 알려질까 봐', visualDesc: '물음표 아이콘과 여백이 많은 구성' },
      { page: 4, headline: '확인 1. 연락처를 받는 곳', subtext: '법률사무소인지, 제3자 제공 동의가 있는지 먼저 읽어 보세요', visualDesc: '체크리스트 아이콘' },
      { page: 5, headline: '확인 2. 스텔스 가명', subtext: '가명으로 상담을 요청하고, 010 번호는 내가 허락할 때만 변호사에게 보여요', visualDesc: '자물쇠 모양 아이콘과 가명 표시 예시' },
      { page: 6, headline: '확인 3. 변호사는 내가 직접', subtext: '프로필을 보고 최대 3명까지 골라 상담을 요청해요. 마이김변이 변호사를 대신 정하거나 골라 드리지 않아요', visualDesc: '얼굴 없는 프로필 카드 3장' },
      { page: 7, headline: '상담 전에 내 상황 정리', subtext: "'내 상황 체크하기'(약 3분)로 채무·소득을 정리해요. 결과 수치를 알려 주지는 않아요", visualDesc: '휴대폰 화면 속 단순한 입력 칸' },
      { page: 8, headline: '결과는 법원이 판단해요', subtext: '인가와 면책은 법원이 사건별로 판단해요. 결과를 약속하는 광고는 조심하세요', visualDesc: '저울 모양 아이콘' },
      { page: 9, headline: '같은 고민을 하는 사람이 있다면', subtext: '이 글을 조용히 공유해 주세요', visualDesc: '공유 아이콘과 따뜻한 색 포인트' },
      { page: 10, headline: '프로필 링크에서 시작하기', subtext: '나중에 다시 보려면 [저장]을 눌러 두세요', visualDesc: '저장 버튼 위치 안내' },
    ],
  },
  threads: {
    fullBody: `[1/4]
오늘도 이자 날짜를 먼저 떠올렸나요?

법이 정한 채무 정리 절차가 있는 건 알지만,
상담 신청서에 번호를 남기는 순간부터 망설여지는 분이 많아요.

[2/4]
상담 신청 전에 이것부터 확인해 보세요.

신청서를 받는 곳이 법률사무소인지,
개인정보 안내에 '제3자 제공' 항목이 있는지,
선택 동의를 빼고도 신청할 수 있는지요.

[3/4]
마이김변은 스텔스 가명으로 상담을 시작해요.

채무·소득 정보는 '내 상황 체크하기'(약 3분)로 정리하고,
변호사 프로필을 보고 최대 3명까지 직접 골라 상담을 요청해요.
010 번호는 내가 허락하기 전까지 변호사에게 보이지 않아요.

[4/4]
혼자 오래 버티지 않아도 괜찮아요.
인가와 면책은 법원이 사건별로 판단하니, 결과를 약속하는 말보다 절차를 차분히 확인하세요.

📌 이용 방법은 첫 번째 댓글에 남겨 둘게요.
여러분은 상담을 알아볼 때 무엇이 가장 망설여졌나요?

※ ${MARKETING_DISCLAIMER_SHORT}`,
    firstComment: "스텔스 가명으로 내 상황 정리하고 변호사 직접 고르기 ➔ https://mykim.kr",
  },
  facebook: {
    fullBody: `가게 문을 열 때마다 대출 상환일이 먼저 떠오르시나요?

열심히 일해도 이자 부담이 줄지 않으면 마음이 무거워집니다.
"신청하면 주변에 알려지지 않을까?", "상담 신청하면 연락처가 여기저기 퍼지지 않을까?"
이런 걱정 때문에 알아보기를 미루는 분이 많습니다.

마이김변은 이렇게 이용합니다.
1. '내 상황 체크하기'(약 3분)에서 스텔스 가명으로 채무·소득 정보를 정리합니다. 이 단계에서 월 변제금이나 감면율을 알려 드리지는 않습니다.
2. 변호사 프로필을 보고 상담받고 싶은 변호사를 최대 3명까지 직접 골라 상담을 요청합니다. 마이김변이 변호사를 대신 정하거나 골라 드리지 않습니다.
3. 010 번호는 내가 공개를 허락하기 전까지 변호사에게 보이지 않습니다.

인가와 면책은 법원이 사건별로 판단합니다. 절차와 비용은 상담하는 사무소에 직접 확인하세요.
주변에 같은 고민을 하는 분이 있다면 조용히 이 글을 전해 주세요.

👉 이용 방법 링크는 첫 번째 댓글에 남겨 두었습니다.

※ ${MARKETING_DISCLAIMER_SHORT}`,
    firstComment: '👉 마이김변 이용 방법 (스텔스 가명 · 변호사 직접 선택): https://mykim.kr',
  },
  tiktok: {
    overlay: '빚 상담, 번호 남기기 전에 잠깐만요',
    caption: '#개인회생 #개인파산 #신용회복 #스텔스가명 #마이김변',
    scenes: [
      { time: '00~03초', label: '첫 화면 자막', script: '빚 상담, 번호 남기기 전에 잠깐만요', action: '화면 중앙 큰 자막 + 번호 입력 칸', color: 'from-cyan-900/80' },
      { time: '04~11초', label: '확인할 점', script: '신청서를 받는 곳이 어디인지, 제3자 제공 동의가 있는지 먼저 확인하세요.', action: '신청서 확대 컷', color: 'from-slate-800/80' },
      { time: '12~18초', label: '기능 사실', script: '마이김변은 스텔스 가명으로 상담을 요청하고, 변호사는 최대 3명까지 직접 골라요.', action: '스텔스 가명 화면 + 얼굴 없는 프로필 카드', color: 'from-emerald-900/80' },
      { time: '19~22초', label: '마무리', script: "프로필 링크에서 '내 상황 체크하기'를 확인해 보세요.", action: '프로필 링크 가리키기', color: 'from-purple-900/80' },
    ],
  },
};

// --- MAIN COMPONENT ---
export default function MarketingAutopilotHub() {
  const [activeTab, setActiveTab] = useState('오늘의 오토파일럿');
  const [studioChannel] = useState('blog');
  const [activeBlogContent, setActiveBlogContent] = useState<BlogContentData>(DDOK_BLOG_PRESETS_DATA[0]);
  // 캘린더에서 고른 날짜의 캠페인을 오토파일럿 탭에서 연다 (null = 오늘)
  const [openDate, setOpenDate] = useState<string | null>(null);

  const tabs = [
    { id: '오늘의 오토파일럿', icon: RefreshCcw },
    { id: 'AI 키·연동 상태', icon: Key },
    { id: '프리셋 스튜디오', icon: Edit3 },
    { id: '365일 캘린더', icon: CalendarIcon },
    { id: '운영 현황', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">마케팅 오토파일럿 허브</h1>
          <p className="text-slate-400 text-sm">매일 뉴스 → 요일 테마 → 6채널 초안 생성 → 광고 규정 검사 → 관리자 승인 → 게시. 승인 전에는 어떤 채널에도 게시하지 않습니다.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2 scrollbar-hide border-b border-[#1E293B]/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === '오늘의 오토파일럿') setOpenDate(null); }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition-all whitespace-nowrap min-h-[44px] press-scale ${
              activeTab === tab.id
                ? 'bg-white/10 text-white font-bold border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.id}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-fadeIn">
        {activeTab === '오늘의 오토파일럿' && <DailyAutopilotPanel loadDate={openDate} />}
        {activeTab === 'AI 키·연동 상태' && (
          <div className="space-y-6">
            <AutopilotKeyStatus />
            <TabKeyManagement />
          </div>
        )}
        {activeTab === '프리셋 스튜디오' && (
          <TabContentStudio
            initialTab={studioChannel}
            activeBlogContent={activeBlogContent}
            setActiveBlogContent={setActiveBlogContent}
          />
        )}
        {activeTab === '365일 캘린더' && (
          <AutopilotCalendar onOpenDate={(d) => { setOpenDate(d); setActiveTab('오늘의 오토파일럿'); }} />
        )}
        {activeTab === '운영 현황' && <AutopilotAnalytics />}
      </div>
    </div>
  );
}

// --- TAB 2: AI 키 관리 ---
function TabKeyManagement() {
  // [PART 3-7] AI 키는 서버 환경변수(GEMINI_API_KEY)에만 둔다.
  // 이전: 관리자가 입력한 키를 localStorage에 평문 저장하고 브라우저에서 URL 쿼리(?key=)로 Google에 직접 전송했으며,
  //       실제로 없는 계정 5개('AIzaSyD...xQ9A' 등)와 가짜 사용률·'rate-limited' 상태를 표시했다.
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    // 과거 버전이 저장한 평문 키 제거
    try {
      localStorage.removeItem('marketing_gemini_api_key');
      localStorage.removeItem('gemini_api_key');
    } catch { /* ignore */ }
  }, []);

  const handleTest = async () => {
    setIsTesting(true);
    setResult(null);
    const res = await testMarketingAiConnection();
    setResult(res);
    setIsTesting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111622] rounded-2xl border border-indigo-500/30 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-indigo-400" aria-hidden="true" />
            AI 생성 연결 (서버 키)
          </h2>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            칼럼 생성은 서버(/api/generate-statement)가 환경변수 <code className="font-mono text-indigo-300">GEMINI_API_KEY</code>로 호출합니다.
            키는 브라우저에 저장하거나 입력하지 않습니다. 관리자(2단계 인증) 세션에서만 사용할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting}
          className="min-h-[44px] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer active:scale-[0.98]"
        >
          {isTesting ? '확인 중…' : '서버 연결 확인'}
        </button>
        {result && (
          <p role="status" className={`text-sm ${result.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{result.message}</p>
        )}
        <p className="text-xs text-slate-400">
          AI 생성이 실패하면 오류를 그대로 알려 드리고, 화면의 원고는 바꾸지 않습니다. 생성된 글은 게시 전에 규칙 검사 결과와 사실관계를 사람이 확인해야 합니다.
        </p>
      </div>
    </div>
  );
}

// --- 채널별 작성 가이드 ---
const CHANNEL_OPTIMIZATION_GUIDES: Record<string, {
  name: string;
  badge: string;
  tone: string;
  algorithmTrick: string;
  ctaDevice: string;
  tags: string[];
}> = {
  blog: {
    name: '네이버 블로그',
    badge: '3문장 요약 + 소제목 구조',
    tone: '차분한 정보 전달 (해요체)',
    algorithmTrick: '서두에 3문장 요약을 두고, 소제목마다 이미지 1컷을 배치해 읽기 쉽게 구성합니다.',
    ctaDevice: "글 끝 안내 배너 ('내 상황 체크하기' · 변호사 직접 선택)",
    tags: ['3문장 요약', '소제목 구조', '본문 이미지 4컷', '하단 고지문']
  },
  shorts: {
    name: '유튜브 쇼츠',
    badge: '첫 3초 질문 + 반복 구조',
    tone: '짧고 차분한 문장 (인사말 생략)',
    algorithmTrick: '마지막 문장이 첫 질문으로 이어지게 써서, 다시 볼 때 자연스럽게 이어지도록 합니다.',
    ctaDevice: '고정 댓글에 이용 방법 안내',
    tags: ['첫 3초 질문', '35초 안팎', '화면 자막', '고정 댓글']
  },
  card: {
    name: '인스타그램 카드뉴스',
    badge: '10장 캐러셀 · 1장 1메시지',
    tone: '공감 → 확인할 점 → 기능 사실',
    algorithmTrick: '한 장에 한 가지 메시지만 두고, 마지막 장에서 저장·공유를 안내합니다.',
    ctaDevice: '프로필 링크 + 마지막 장 저장 안내',
    tags: ['1장: 표지', '2~3장: 공감', '4~8장: 1장 1메시지', '10장: 저장 안내']
  },
  threads: {
    name: '스레드 (Threads)',
    badge: '4단 타래 · 첫 댓글 링크',
    tone: '담백한 1인칭 해요체',
    algorithmTrick: '1~2줄 단위로 줄을 바꾸고, 본문에는 링크를 넣지 않고 첫 댓글에 둡니다.',
    ctaDevice: '첫 번째 댓글 링크 + 질문형 마무리',
    tags: ['해요체', '1~2줄 줄바꿈', '본문 링크 없음(첫 댓글)', '질문형 마무리']
  },
  fb: {
    name: '페이스북',
    badge: '장문 피드 · 첫 댓글 링크',
    tone: '현실적인 고민에 공감하는 차분한 문장',
    algorithmTrick: '본문에는 링크를 넣지 않고 첫 댓글에 링크를 둡니다.',
    ctaDevice: '첫 번째 댓글 링크',
    tags: ['공감형 장문', '첫 댓글 링크', '기능 사실만 안내', '조용한 공유 안내']
  },
  tiktok: {
    name: '틱톡 (TikTok)',
    badge: '첫 화면 자막 · 짧은 템포',
    tone: '빠르지만 과장 없는 문장',
    algorithmTrick: '소리 없이 보는 사람도 알 수 있게 첫 화면에 큰 자막을 두고, 캡션 첫 줄에 검색어를 둡니다.',
    ctaDevice: '프로필 링크 안내',
    tags: ['첫 화면 큰 자막', '15~22초', '무음 시청 대응', '검색어 캡션']
  }
};

const STUDIO_THEMES = [
  { value: '서류 준비 안내', label: '월 = 서류 준비 안내' },
  { value: '스텔스 가명·개인정보 보호', label: '화 = 스텔스 가명·개인정보 보호' },
  { value: '변호사 직접 선택', label: '수 = 변호사 직접 선택' },
  { value: '제도 일반 정보', label: '목 = 제도 일반 정보' },
  { value: '비대면 이용 방법', label: '금 = 비대면 이용 방법' },
  { value: '인가 후 변제 관리', label: '토 = 인가 후 변제 관리 (회생동행)' },
  { value: '주말에 내 상황 정리하기', label: '일 = 주말에 내 상황 정리하기' },
];

/** 규칙 검사 결과 (걸린 표현 목록) */
function ComplianceFlags({ text, skipDisclaimerCheck = false, serverCompliance }: {
  text: string;
  skipDisclaimerCheck?: boolean;
  serverCompliance?: ChannelCompliance;
}) {
  const result = useMemo(() => scanCopy(text, { skipDisclaimerCheck }), [text, skipDisclaimerCheck]);
  const issues = result.issues;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const serverHigh = serverCompliance ? serverCompliance.issues.filter(i => i.severity === 'high').length : 0;
  return (
    <div
      className={`rounded-xl border p-3 text-xs space-y-2 ${issues.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        {issues.length ? <AlertTriangle size={14} className="text-amber-300 shrink-0" /> : <ShieldCheck size={14} className="text-emerald-300 shrink-0" />}
        <span className={`font-bold ${issues.length ? 'text-amber-200' : 'text-emerald-200'}`}>
          {issues.length ? `규칙 검사: 확인할 표현 ${issues.length}건 (수정 필요 ${highCount}건)` : '규칙 검사: 걸린 표현 없음'}
        </span>
        <span className="text-slate-400">규칙 기반 1차 검사이며 법률 검토를 대신하지 않습니다.</span>
      </div>
      {serverCompliance && (
        <p className="text-slate-300">
          AI 생성 직후 서버 검사: {serverCompliance.issues.length}건 (수정 필요 {serverHigh}건). 아래 목록은 지금 화면의 글을 다시 검사한 결과입니다.
        </p>
      )}
      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.slice(0, 10).map((issue, idx) => (
            <li key={`${issue.ruleId}-${idx}`} className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-300">
              <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${issue.severity === 'high' ? 'bg-rose-500/20 text-rose-200' : issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-700 text-slate-300'}`}>
                {issue.severity === 'high' ? '수정 필요' : issue.severity === 'medium' ? '수정 권고' : '참고'}
              </span>
              <span className="font-semibold text-white">{issue.label}</span>
              {issue.match && <span className="font-mono text-amber-100">"{issue.match}"</span>}
              <span className="text-slate-400">{issue.hint}</span>
            </li>
          ))}
          {issues.length > 10 && <li className="text-slate-400">외 {issues.length - 10}건</li>}
        </ul>
      )}
    </div>
  );
}

/** 화면 요소를 PNG Blob으로 (그라데이션 배경만 쓰므로 외부 이미지 변환이 필요 없다) */
async function renderElementToBlob(el: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
  if (!blob) throw new Error('이미지 변환에 실패했습니다.');
  return blob;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- TAB 3: 프리셋 스튜디오 ---
function TabContentStudio({
  initialTab = 'blog',
  activeBlogContent,
  setActiveBlogContent
}: {
  initialTab?: string;
  activeBlogContent: BlogContentData;
  setActiveBlogContent: (b: BlogContentData) => void;
}) {
  const [topic, setTopic] = useState(activeBlogContent.topic);
  const [theme, setTheme] = useState(activeBlogContent.theme);
  const [genTab, setGenTab] = useState(initialTab);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [exportingStudioId, setExportingStudioId] = useState<string | null>(null);
  const [isExportingStudioZip, setIsExportingStudioZip] = useState(false);
  // 채널별 예시 원고 편집본 (복사·규칙 검사에 그대로 쓴다)
  const [shortsTitle, setShortsTitle] = useState(CHANNEL_FULL_CONTENTS.shorts.title);
  const [threadsText, setThreadsText] = useState(CHANNEL_FULL_CONTENTS.threads.fullBody);
  const [fbText, setFbText] = useState(CHANNEL_FULL_CONTENTS.facebook.fullBody);
  const [tiktokOverlay, setTiktokOverlay] = useState(CHANNEL_FULL_CONTENTS.tiktok.overlay);
  const [tiktokCaption, setTiktokCaption] = useState(CHANNEL_FULL_CONTENTS.tiktok.caption);

  useEffect(() => {
    if (initialTab) {
      setGenTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    setTopic(activeBlogContent.topic);
    setTheme(activeBlogContent.theme);
  }, [activeBlogContent.topic, activeBlogContent.theme]);

  const isPreset = activeBlogContent.source === 'preset';
  const cueSheet = CHANNEL_FULL_CONTENTS.shorts.cueSheet;
  const slides = CHANNEL_FULL_CONTENTS.cardnews.slides;
  const tiktokScenes = CHANNEL_FULL_CONTENTS.tiktok.scenes;

  const handleSelectPreset = (p: BlogContentData) => {
    setTopic(p.topic);
    setTheme(p.theme);
    setActiveBlogContent(p);
    toast.success(`'${p.label}' 예시 원고(직접 작성한 견본)를 불러왔습니다.`);
  };

  const handleGenerateBlog = async () => {
    if (!topic.trim()) {
      toast.error('주제를 입력해 주세요.');
      return;
    }
    setIsGenerating(true);
    const toastId = toast.loading(`'${topic.slice(0, 18)}…' 블로그 칼럼 초안을 AI로 만드는 중입니다…`);
    try {
      const generated = await generateBlogContentWithGemini(topic, theme);
      setActiveBlogContent(generated);
      const highCount = generated.compliance?.issues.filter(i => i.severity === 'high').length ?? 0;
      toast.success(
        `AI 초안을 만들었습니다${generated.model ? ` (${generated.model})` : ''}.`,
        {
          id: toastId,
          description: highCount
            ? `규칙 검사에서 수정이 필요한 표현 ${highCount}건이 나왔습니다. 아래 목록을 확인하세요.`
            : '게시 전에 아래 규칙 검사 결과와 사실관계를 확인하세요.',
        },
      );
    } catch (err) {
      // 실패를 숨기지 않는다: 예시 원고로 바꾸지 않고 오류를 그대로 알린다
      toast.error(err instanceof Error && err.message ? err.message : 'AI 생성에 실패했습니다.', {
        id: toastId,
        description: '화면의 원고는 바뀌지 않았습니다.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 단일 요소 고해상도 PNG 다운로드 (3x scale)
  const downloadStudioElementAsPng = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      toast.error('다운로드할 이미지 요소를 찾을 수 없습니다.');
      return;
    }
    setExportingStudioId(elementId);
    try {
      triggerDownload(await renderElementToBlob(el), filename);
      toast.success(`${filename} 이미지를 내려받았습니다.`);
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setExportingStudioId(null);
    }
  };

  /** 여러 요소를 PNG로 묶어 ZIP 다운로드 */
  const downloadElementsAsZip = async (items: { elementId: string; filename: string }[], zipName: string, label: string) => {
    if (items.length === 0) return;
    setIsExportingStudioZip(true);
    const toastId = toast.loading(`${label}을 고해상도 PNG로 렌더링하고 있습니다…`);
    try {
      const zip = new JSZip();
      for (const item of items) {
        const el = document.getElementById(item.elementId);
        if (el) zip.file(item.filename, await renderElementToBlob(el));
      }
      triggerDownload(await zip.generateAsync({ type: 'blob' }), zipName);
      toast.success(`${label} 압축 파일을 내려받았습니다.`, { id: toastId });
    } catch (err) {
      console.error('Failed to export zip:', err);
      toast.error('일괄 다운로드 중 오류가 발생했습니다.', { id: toastId });
    } finally {
      setIsExportingStudioZip(false);
    }
  };

  const blogImageFile = (order: number, tag: string) => `[마이김변]_블로그_이미지_${order}_${tag.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`;

  /** 지금 탭의 원고 평문 (복사·규칙 검사용) */
  const currentText = useMemo(() => {
    switch (genTab) {
      case 'blog':
        return `${activeBlogContent.title}\n\n${activeBlogContent.answerFirst.join('\n')}\n\n${activeBlogContent.fullBody}\n\n${activeBlogContent.blogImages.map(b => `${b.previewTitle} ${b.previewSub}`).join('\n')}\n\n${activeBlogContent.hashtags.join(' ')}`;
      case 'shorts':
        return `${shortsTitle}\n\n${cueSheet.map(c => `[${c.time}] ${c.script}`).join('\n')}\n\n${CHANNEL_FULL_CONTENTS.shorts.hashtags.join(' ')}`;
      case 'card':
        return `${slides.map(s => `${s.page}장. ${s.headline}\n${s.subtext}`).join('\n\n')}\n\n${CHANNEL_FULL_CONTENTS.cardnews.caption}`;
      case 'threads':
        return `${threadsText}\n\n[첫 댓글] ${CHANNEL_FULL_CONTENTS.threads.firstComment}`;
      case 'fb':
        return `${fbText}\n\n[첫 댓글] ${CHANNEL_FULL_CONTENTS.facebook.firstComment}`;
      case 'tiktok':
        return `${tiktokOverlay}\n\n${tiktokScenes.map(s => `[${s.time}] ${s.script}`).join('\n')}\n\n${tiktokCaption}`;
      default:
        return '';
    }
  }, [genTab, activeBlogContent, shortsTitle, cueSheet, slides, threadsText, fbText, tiktokOverlay, tiktokScenes, tiktokCaption]);

  // 대본·카드뉴스 장면은 고지문을 따로 붙이지 않으므로 고지문 누락 검사는 뺀다 (캡션에는 고지문이 있다)
  const skipDisclaimer = genTab === 'shorts' || genTab === 'tiktok';

  const currentGuide = CHANNEL_OPTIMIZATION_GUIDES[genTab] || CHANNEL_OPTIMIZATION_GUIDES.blog;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Panel - Inputs & Bridge Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">수동 생성 설정</h3>
              <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-medium whitespace-nowrap">
                예시 원고 {DDOK_BLOG_PRESETS_DATA.length}종
              </span>
            </div>

            {/* 예시 원고 버튼 */}
            <div className="mb-4">
              <span className="block text-xs font-semibold text-slate-400 mb-2">예시 원고 불러오기 (직접 작성한 견본, AI 생성 아님)</span>
              <div className="flex flex-wrap gap-1.5">
                {DDOK_BLOG_PRESETS_DATA.map((p) => (
                  <button
                    key={p.presetKey}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2.5 py-1 min-h-[44px] md:min-h-[32px] rounded-lg text-xs border transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      activeBlogContent.presetKey === p.presetKey
                        ? 'bg-indigo-600 text-white font-bold border-indigo-500 shadow-sm'
                        : 'bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-white border-slate-700/80'
                    }`}
                  >
                    #{p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="studio-topic" className="block text-sm text-slate-400 mb-1.5">주제 / 뉴스 사실</label>
                <textarea
                  id="studio-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="studio-theme" className="block text-sm text-slate-400 mb-1.5">강조 테마 (요일별)</label>
                <select
                  id="studio-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none text-sm"
                >
                  {!STUDIO_THEMES.some(t => t.value === theme) && theme && <option value={theme}>{theme}</option>}
                  {STUDIO_THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={16} /> 3단계 글 구성
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">1</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-400 block mb-1">사실 (뉴스·제도)</span>
                  <p className="text-sm text-slate-300">{topic.length > 40 ? `${topic.slice(0, 40)}…` : topic}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">2</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-400 block mb-1">고민 (상담을 망설이는 이유)</span>
                  <p className="text-sm text-slate-300">연락처가 어디로 가는지, 주변에 알려질지 걱정돼 알아보기를 미룸</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">3</div>
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex-1">
                  <span className="text-xs text-indigo-300 block mb-1">기능 사실로 연결</span>
                  <p className="text-sm text-indigo-100">스텔스 가명으로 내 상황을 정리하고, 변호사 프로필을 보고 최대 3명을 직접 골라 상담 요청</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateBlog}
              disabled={isGenerating}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px] cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin text-white" /> : <UploadCloud size={18} />}
              {isGenerating ? '블로그 칼럼 생성 중…' : '블로그 칼럼 AI 초안 만들기'}
            </button>
            <p className="text-[11px] text-slate-400 mt-2">실패하면 오류를 알려 드리고, 지금 보이는 원고는 그대로 둡니다.</p>
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="lg:col-span-2 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm flex flex-col h-full min-h-[650px]">

          {/* Channel Selector Tabs */}
          <div className="flex overflow-x-auto space-x-2 mb-4 pb-2 scrollbar-hide border-b border-slate-800">
            {[
              { id: 'blog', label: '블로그' },
              { id: 'shorts', label: '쇼츠 스크립트' },
              { id: 'card', label: '카드뉴스' },
              { id: 'threads', label: '스레드' },
              { id: 'fb', label: '페이스북' },
              { id: 'tiktok', label: '틱톡' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setGenTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap min-h-[44px] transition-colors cursor-pointer ${
                  genTab === t.id ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 원고 종류 안내 */}
          {genTab === 'blog' ? (
            <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${isPreset ? 'border-slate-700 bg-slate-800/40 text-slate-300' : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100'}`}>
              {isPreset
                ? '지금 보이는 블로그 원고는 예시 원고(직접 작성한 견본)입니다. AI가 만든 글이 아닙니다.'
                : `지금 보이는 블로그 원고는 AI 초안${activeBlogContent.model ? ` (${activeBlogContent.model})` : ''}입니다. 게시 전에 사람이 사실관계와 표현을 확인하세요.`}
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
              이 채널 원고는 예시 원고(직접 작성한 견본)입니다. AI가 만든 글이 아닙니다.
            </div>
          )}

          {/* Channel Guide Banner */}
          <div className="mb-4 bg-[#0B0F19] rounded-xl border border-indigo-500/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                <span className="text-sm font-bold text-white">{currentGuide.name}</span>
                <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-medium">
                  {currentGuide.badge}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                문체: <span className="text-slate-300 font-medium">{currentGuide.tone}</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-2 leading-relaxed bg-[#111622] p-2.5 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold mr-1">구성 방법:</span>
              {currentGuide.algorithmTrick}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {currentGuide.tags.map((tag, idx) => (
                  <span key={idx} className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60">
                    ✓ {tag}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Target size={12} /> {currentGuide.ctaDevice}
              </span>
            </div>
          </div>

          {/* Channel-Specific Editor Views */}
          <div className="flex-1 flex flex-col space-y-4">

            {/* 1. Blog Editor */}
            {genTab === 'blog' && (
              <div className="flex-1 flex flex-col space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label htmlFor="studio-blog-title" className="text-xs font-semibold text-slate-400">제목 (검색 키워드 포함)</label>
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium whitespace-nowrap ${isPreset ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'}`}>
                      {isPreset ? `예시 원고(직접 작성한 견본) · #${activeBlogContent.label}` : `AI 초안${activeBlogContent.model ? ` · ${activeBlogContent.model}` : ''}`}
                    </span>
                  </div>
                  <input
                    id="studio-blog-title"
                    type="text"
                    value={activeBlogContent.title}
                    onChange={(e) => setActiveBlogContent({ ...activeBlogContent, title: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Answer-First Box */}
                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                    <Sparkles size={14} /> 서두 3문장 요약 (Answer-First)
                  </div>
                  <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
                    {activeBlogContent.answerFirst.length > 0
                      ? activeBlogContent.answerFirst.map((ans, idx) => <p key={idx}>{ans}</p>)
                      : <p className="text-slate-400">요약 문장이 없습니다. 본문 첫머리에 3문장 요약을 직접 넣어 주세요.</p>}
                  </div>
                </div>

                {/* 4컷 본문 삽입 이미지 세트 */}
                <div className="space-y-3 bg-[#0B0F19] p-4 rounded-xl border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ImageIcon size={15} className="text-indigo-400" />
                        네이버 블로그 본문 삽입용 4컷 이미지 (그라데이션 배경)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        그라데이션 배경 위에 한글 문구를 얹은 이미지입니다. 외부 이미지 서비스는 쓰지 않습니다. 개별 PNG 또는 4컷 ZIP으로 내려받을 수 있습니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadElementsAsZip(
                        activeBlogContent.blogImages.map(b => ({ elementId: `studio-blog-visual-${b.id}`, filename: blogImageFile(b.order, b.tag) })),
                        `[마이김변]_블로그_4컷_${activeBlogContent.label || '맞춤'}.zip`,
                        '블로그 4컷 이미지',
                      )}
                      disabled={isExportingStudioZip || activeBlogContent.blogImages.length === 0}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[44px] md:min-h-[36px] whitespace-nowrap disabled:opacity-60 active:scale-[0.98]"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '4컷 압축 중…' : '4컷 일괄 다운로드 (ZIP)'}
                    </button>
                  </div>

                  {activeBlogContent.blogImages.length === 0 && (
                    <p className="text-xs text-slate-400 bg-[#111622] rounded-xl border border-slate-800 p-3">
                      이 원고에는 이미지 기획이 없습니다. 다른 예시 원고를 불러오거나 AI 초안을 다시 만들어 보세요.
                    </p>
                  )}

                  {/* 4 Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {activeBlogContent.blogImages.map((bImg) => (
                      <div key={bImg.id} className="bg-[#111622] rounded-xl border border-slate-800 p-3 flex flex-col justify-between space-y-2.5">

                        {/* Visual Card (html2canvas로 PNG 렌더링) */}
                        <div
                          id={`studio-blog-visual-${bImg.id}`}
                          className={`w-full aspect-[4/3] rounded-lg p-4 flex flex-col justify-between border border-slate-700/60 shadow-inner relative overflow-hidden bg-gradient-to-br ${bImg.previewGradient}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                          <div className="flex justify-between items-start z-10 gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-black/60 text-indigo-300 text-[10px] font-bold border border-white/10">
                              {bImg.tag}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[9px] font-medium border border-emerald-500/30">
                              {bImg.insertPosition}
                            </span>
                          </div>
                          <div className="z-10 my-auto space-y-1">
                            <h6 className="text-sm sm:text-base font-extrabold text-white leading-tight drop-shadow-lg whitespace-pre-line">
                              {bImg.previewTitle}
                            </h6>
                            <p className="text-[11px] text-slate-100 line-clamp-2 drop-shadow-md font-medium">
                              {bImg.previewSub}
                            </p>
                          </div>
                          <div className="z-10 pt-1.5 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-200">
                            <span className="text-emerald-400 font-bold drop-shadow-sm">마이김변</span>
                            <span className="drop-shadow-sm">스텔스 가명 · 010 번호 비공개</span>
                          </div>
                        </div>

                        {/* Role & Prompt info */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-300">#{bImg.order}. {bImg.title}</span>
                          </div>
                          <div className="bg-[#0B0F19] rounded-lg p-2 border border-slate-800 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-slate-400 truncate flex-1" title="직접 이미지를 만들 때 참고할 프롬프트">{bImg.prompt}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(bImg.prompt);
                                setCopiedPromptId(bImg.id);
                                toast.success('참고 프롬프트를 복사했습니다.');
                                setTimeout(() => setCopiedPromptId(null), 2000);
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap min-h-[32px]"
                            >
                              {copiedPromptId === bImg.id ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              {copiedPromptId === bImg.id ? '복사됨' : '복사'}
                            </button>
                          </div>
                        </div>

                        {/* PNG 다운로드 */}
                        <button
                          type="button"
                          onClick={() => downloadStudioElementAsPng(`studio-blog-visual-${bImg.id}`, blogImageFile(bImg.order, bImg.tag))}
                          disabled={exportingStudioId === `studio-blog-visual-${bImg.id}`}
                          className="w-full py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] md:min-h-[34px] whitespace-nowrap active:scale-[0.98]"
                        >
                          {exportingStudioId === `studio-blog-visual-${bImg.id}` ? (
                            <Loader2 size={12} className="animate-spin text-indigo-400" />
                          ) : (
                            <Download size={12} />
                          )}
                          {exportingStudioId === `studio-blog-visual-${bImg.id}` ? '렌더링 중…' : '고해상도 PNG 다운로드'}
                        </button>

                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Body Column */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="studio-blog-body" className="text-xs font-semibold text-slate-400">본문 칼럼</label>
                    <span className="text-[11px] text-slate-400">
                      공백 포함 {activeBlogContent.fullBody.length}자
                    </span>
                  </div>
                  <textarea
                    id="studio-blog-body"
                    className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                    value={activeBlogContent.fullBody}
                    onChange={(e) => setActiveBlogContent({ ...activeBlogContent, fullBody: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">해시태그: {activeBlogContent.hashtags.join(' ')}</p>
                </div>
              </div>
            )}

            {/* 2. YouTube Shorts Editor — 장면별 비주얼 프리뷰 & PNG 내보내기 */}
            {genTab === 'shorts' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div>
                  <label htmlFor="studio-shorts-title" className="block text-xs font-semibold text-slate-400 mb-1">영상 제목</label>
                  <input
                    id="studio-shorts-title"
                    type="text"
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 text-sm"
                    value={shortsTitle}
                    onChange={(e) => setShortsTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Video size={14} className="text-red-400" />
                      쇼츠 장면별 미리보기 & CapCut용 PNG
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadElementsAsZip(
                        cueSheet.map((c, i) => ({ elementId: `shorts-scene-${i}`, filename: `[마이김변]_쇼츠_장면${i + 1}_${c.time.replace(/[~]/g, '-')}.png` })),
                        '[마이김변]_쇼츠_4장면.zip',
                        '쇼츠 4장면',
                      )}
                      disabled={isExportingStudioZip}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[44px] md:min-h-[34px] whitespace-nowrap disabled:opacity-60 active:scale-[0.98]"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '렌더링 중…' : '4장면 ZIP 다운로드'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    각 장면을 9:16 세로 PNG(그라데이션 배경)로 내보낸 뒤 CapCut에서 불러와 자막과 전환 효과를 더하세요.
                  </p>
                </div>

                {/* 4장면 비주얼 카드 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {cueSheet.map((cue, idx) => {
                    const sceneLabels = ['첫 질문', '공감', '기능 사실', '마무리'];
                    const sceneColors = ['from-red-900/80', 'from-blue-900/80', 'from-emerald-900/80', 'from-purple-900/80'];
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        <div
                          id={`shorts-scene-${idx}`}
                          className="w-full aspect-[9/16] rounded-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex flex-col justify-between p-3 border border-slate-700/60"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-t ${sceneColors[idx % sceneColors.length]} via-black/40 to-transparent`}></div>

                          <div className="flex justify-between items-start z-10">
                            <span className="px-2 py-0.5 rounded-lg bg-red-600/80 text-white text-[9px] font-bold border border-red-400/30">
                              {sceneLabels[idx % sceneLabels.length]}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-lg bg-black/60 text-slate-300 text-[8px] font-mono">
                              {cue.time}
                            </span>
                          </div>

                          <div className="z-10 text-[8px] text-slate-300/80 bg-black/40 rounded-lg px-2 py-1 border border-white/5">
                            🎬 {cue.action.length > 40 ? cue.action.slice(0, 40) + '…' : cue.action}
                          </div>

                          <div className="z-10 flex-1 flex items-center justify-center px-1">
                            <p className="text-white text-[11px] sm:text-xs font-extrabold text-center leading-snug drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                              "{cue.script.length > 60 ? cue.script.slice(0, 60) + '…' : cue.script}"
                            </p>
                          </div>

                          <div className="z-10 flex justify-between items-center text-[8px] text-slate-300 border-t border-white/10 pt-1">
                            <span className="text-emerald-400 font-bold drop-shadow-sm">마이김변</span>
                            <span className="drop-shadow-sm">YT Shorts</span>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(cue.script);
                              toast.success(`장면 ${idx + 1} 나레이션을 복사했습니다.`);
                            }}
                            className="flex-1 py-1 min-h-[44px] md:min-h-[30px] bg-[#0B0F19] hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800 whitespace-nowrap"
                          >
                            <Copy size={10} />
                            자막 복사
                          </button>
                          <button
                            type="button"
                            aria-label={`장면 ${idx + 1} PNG 다운로드`}
                            onClick={() => downloadStudioElementAsPng(`shorts-scene-${idx}`, `[마이김변]_쇼츠_장면${idx + 1}.png`)}
                            className="py-1 px-2 min-h-[44px] md:min-h-[30px] bg-[#0B0F19] hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                          >
                            {exportingStudioId === `shorts-scene-${idx}` ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CapCut 제작 순서 */}
                <div className="bg-gradient-to-r from-[#0B0F19] to-[#111827] rounded-xl p-3 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    CapCut 제작 순서
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { step: '①', title: '이미지 가져오기', desc: '4장면 ZIP 다운로드 → CapCut에서 열기' },
                      { step: '②', title: '타임라인 배치', desc: '장면별 초수에 맞춰 이미지 배치' },
                      { step: '③', title: '자막 추가', desc: '자막 복사 → CapCut 텍스트에 붙여넣기' },
                      { step: '④', title: '내보내기', desc: '1080x1920 MP4 내보내기 → 업로드' },
                    ].map((item) => (
                      <div key={item.step} className="bg-black/30 rounded-lg p-2 border border-slate-800">
                        <span className="text-amber-400 font-bold text-xs">{item.step}</span>
                        <span className="text-white text-[11px] font-bold ml-1">{item.title}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-xs">
                  <span className="font-bold text-rose-300 block mb-0.5">반복 구조</span>
                  <span className="text-slate-300 text-[11px]">마지막 문장("번호 칸에서 멈췄다면,")이 첫 질문("빚 상담 알아보다가 번호 칸에서 멈춘 적 있나요?")으로 이어지도록 썼습니다.</span>
                </div>
              </div>
            )}

            {/* 3. Instagram Card News Editor */}
            {genTab === 'card' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">10장 캐러셀 슬라이드 선택</span>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 whitespace-nowrap">
                    1장 1메시지
                  </span>
                </div>

                <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                  {slides.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSlide(idx)}
                      className={`px-3 py-1.5 min-h-[44px] md:min-h-[32px] rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedSlide === idx
                          ? 'bg-amber-600 text-white font-bold shadow-sm'
                          : 'bg-[#0B0F19] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {s.page}장 {idx === 0 ? '(표지)' : idx === slides.length - 1 ? '(마무리)' : ''}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  <div className="flex flex-col space-y-2">
                    <div
                      id="studio-active-card-slide"
                      className="w-full aspect-square rounded-2xl p-5 bg-gradient-to-br from-[#0B1120] via-[#1E1B4B] to-[#0B0F19] border border-amber-500/30 flex flex-col justify-between relative overflow-hidden shadow-xl"
                    >
                      <div className="flex justify-between items-center z-10">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span className="text-[10px] font-bold text-amber-300 tracking-wider">마이김변 카드뉴스</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold border border-white/10">
                          {selectedSlide + 1} / {slides.length}
                        </span>
                      </div>

                      <div className="z-10 my-auto space-y-2 text-center sm:text-left">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                          {selectedSlide === 0 ? '표지' : selectedSlide <= 2 ? '공감' : selectedSlide === slides.length - 1 ? '시작하기' : '확인할 점'}
                        </span>
                        <h4 className="text-base sm:text-lg font-extrabold text-white leading-snug drop-shadow-md whitespace-pre-line">
                          {slides[selectedSlide]?.headline}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-medium drop-shadow-sm">
                          {slides[selectedSlide]?.subtext}
                        </p>
                      </div>

                      <div className="z-10 pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <ShieldCheck size={12} /> 스텔스 가명
                        </span>
                        <span className="text-amber-300 font-medium">
                          {selectedSlide === slides.length - 1 ? '프로필 링크에서 확인' : '옆으로 넘기기 ➔'}
                        </span>
                      </div>

                      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-600/15 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute -left-10 -top-10 w-32 h-32 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadStudioElementAsPng('studio-active-card-slide', `[마이김변]_카드뉴스_${(selectedSlide + 1).toString().padStart(2, '0')}장.png`)}
                      disabled={exportingStudioId === 'studio-active-card-slide'}
                      className="w-full py-2 bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] whitespace-nowrap active:scale-[0.98]"
                    >
                      {exportingStudioId === 'studio-active-card-slide' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      현재 슬라이드 PNG 다운로드
                    </button>
                  </div>

                  <div className="bg-[#0B0F19] rounded-xl border border-slate-700 p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div>
                        <span className="block text-[11px] text-slate-400 mb-1 font-semibold">
                          헤드라인 (슬라이드 {selectedSlide + 1} / {slides.length})
                        </span>
                        <p className="w-full bg-[#111622] border border-slate-700 rounded-lg px-3 py-2 text-white font-medium text-xs">
                          {slides[selectedSlide]?.headline}
                        </p>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400 mb-1 font-semibold">본문 문구</span>
                        <p className="w-full bg-[#111622] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-xs min-h-[5rem]">
                          {slides[selectedSlide]?.subtext}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1 font-semibold">디자인 메모</span>
                      <p className="text-[11px] text-slate-400 bg-[#111622] p-2.5 rounded-lg border border-slate-800">
                        {slides[selectedSlide]?.visualDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-1 font-semibold">게시글 캡션</span>
                  <p className="text-xs text-slate-300 bg-[#0B0F19] p-3 rounded-xl border border-slate-800 whitespace-pre-line leading-relaxed">
                    {CHANNEL_FULL_CONTENTS.cardnews.caption}
                  </p>
                </div>
              </div>
            )}

            {/* 4. Threads Editor */}
            {genTab === 'threads' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="studio-threads" className="text-xs font-semibold text-slate-400">
                    스레드 4단 타래 본문 (해요체)
                  </label>
                  <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 whitespace-nowrap">
                    1~2줄 줄바꿈
                  </span>
                </div>

                <textarea
                  id="studio-threads"
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                  value={threadsText}
                  onChange={(e) => setThreadsText(e.target.value)}
                />

                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3">
                  <span className="text-xs font-bold text-indigo-300 block mb-1">
                    첫 번째 댓글 (링크는 본문 대신 여기에)
                  </span>
                  <p className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    {CHANNEL_FULL_CONTENTS.threads.firstComment}
                  </p>
                </div>
              </div>
            )}

            {/* 5. Facebook Editor */}
            {genTab === 'fb' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="studio-fb" className="text-xs font-semibold text-slate-400">
                    페이스북 장문 피드
                  </label>
                  <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20 whitespace-nowrap">
                    본문 링크 없음 → 첫 댓글 링크
                  </span>
                </div>

                <textarea
                  id="studio-fb"
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                  value={fbText}
                  onChange={(e) => setFbText(e.target.value)}
                />

                <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-3">
                  <span className="text-xs font-bold text-blue-300 block mb-1">
                    첫 번째 댓글
                  </span>
                  <p className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    {CHANNEL_FULL_CONTENTS.facebook.firstComment}
                  </p>
                </div>
              </div>
            )}

            {/* 6. TikTok Editor — 장면별 비주얼 프리뷰 & PNG 내보내기 */}
            {genTab === 'tiktok' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="studio-tiktok-overlay" className="block text-xs font-semibold text-cyan-400 mb-1">
                      첫 화면 큰 자막 (소리 없이 보는 사람용)
                    </label>
                    <input
                      id="studio-tiktok-overlay"
                      type="text"
                      className="w-full bg-[#0B0F19] border border-cyan-500/50 rounded-xl px-4 py-2 text-white font-bold focus:outline-none text-sm"
                      value={tiktokOverlay}
                      onChange={(e) => setTiktokOverlay(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="studio-tiktok-caption" className="block text-xs font-semibold text-slate-400 mb-1">
                      캡션 첫 줄 검색어
                    </label>
                    <input
                      id="studio-tiktok-caption"
                      type="text"
                      className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2 text-slate-300 focus:outline-none text-sm"
                      value={tiktokCaption}
                      onChange={(e) => setTiktokCaption(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Video size={14} className="text-cyan-400" />
                      틱톡 장면별 미리보기 & CapCut용 PNG
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadElementsAsZip(
                        tiktokScenes.map((_, i) => ({ elementId: `tiktok-scene-${i}`, filename: `[마이김변]_틱톡_장면${i + 1}.png` })),
                        '[마이김변]_틱톡_4장면.zip',
                        '틱톡 4장면',
                      )}
                      disabled={isExportingStudioZip}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[44px] md:min-h-[34px] whitespace-nowrap disabled:opacity-60 active:scale-[0.98]"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '렌더링 중…' : '4장면 ZIP 다운로드'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {tiktokScenes.map((scene, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <div
                        id={`tiktok-scene-${idx}`}
                        className="w-full aspect-[9/16] rounded-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-950 flex flex-col justify-between p-3 border border-cyan-500/20"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-t ${scene.color} via-black/40 to-transparent`}></div>
                        <div className="flex justify-between items-start z-10">
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-600/80 text-white text-[9px] font-bold border border-cyan-400/30">{scene.label}</span>
                          <span className="px-1.5 py-0.5 rounded-lg bg-black/60 text-slate-300 text-[8px] font-mono">{scene.time}</span>
                        </div>
                        <div className="z-10 text-[8px] text-slate-300/80 bg-black/40 rounded-lg px-2 py-1 border border-white/5">
                          🎬 {scene.action.length > 35 ? scene.action.slice(0, 35) + '…' : scene.action}
                        </div>
                        <div className="z-10 flex-1 flex items-center justify-center px-1">
                          <p className="text-white text-[11px] sm:text-xs font-extrabold text-center leading-snug drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                            "{idx === 0 ? tiktokOverlay : scene.script.length > 50 ? scene.script.slice(0, 50) + '…' : scene.script}"
                          </p>
                        </div>
                        <div className="z-10 flex justify-between items-center text-[8px] text-slate-300 border-t border-white/10 pt-1">
                          <span className="text-cyan-400 font-bold drop-shadow-sm">마이김변</span>
                          <span className="drop-shadow-sm">TikTok</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(idx === 0 ? tiktokOverlay : scene.script); toast.success(`장면 ${idx + 1} 자막을 복사했습니다.`); }}
                          className="flex-1 py-1 min-h-[44px] md:min-h-[30px] bg-[#0B0F19] hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800 whitespace-nowrap"
                        >
                          <Copy size={10} /> 자막 복사
                        </button>
                        <button
                          type="button"
                          aria-label={`장면 ${idx + 1} PNG 다운로드`}
                          onClick={() => downloadStudioElementAsPng(`tiktok-scene-${idx}`, `[마이김변]_틱톡_장면${idx + 1}.png`)}
                          className="py-1 px-2 min-h-[44px] md:min-h-[30px] bg-[#0B0F19] hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                        >
                          {exportingStudioId === `tiktok-scene-${idx}` ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-[#0B0F19] to-[#0B1520] rounded-xl p-3 border border-cyan-500/20 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-400" />
                    CapCut 제작 순서
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { step: '①', title: 'PNG 가져오기', desc: '4장면 ZIP → CapCut에서 열기' },
                      { step: '②', title: '타임라인 배치', desc: '초수별 배치 (3+8+7+4=22초)' },
                      { step: '③', title: '자막 붙이기', desc: '자막 복사 → 텍스트에 붙여넣기' },
                      { step: '④', title: '틱톡 업로드', desc: '1080x1920 내보내기 → 업로드' },
                    ].map((item) => (
                      <div key={item.step} className="bg-black/30 rounded-lg p-2 border border-slate-800">
                        <span className="text-cyan-400 font-bold text-xs">{item.step}</span>
                        <span className="text-white text-[11px] font-bold ml-1">{item.title}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 규칙 검사 결과 (지금 탭의 글) */}
            <ComplianceFlags
              text={currentText}
              skipDisclaimerCheck={skipDisclaimer}
              serverCompliance={genTab === 'blog' && !isPreset ? activeBlogContent.compliance : undefined}
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(currentText);
                toast.success(`${currentGuide.name} 원고를 클립보드에 복사했습니다.`);
              }}
              className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs hover:bg-slate-700 min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              <Copy size={14} /> 원고 복사
            </button>

            {/* 저장·승인·게시 기록은 '오늘의 오토파일럿' 탭에서 한다. */}
            <p className="text-xs text-slate-400">이 화면의 원고는 저장·게시되지 않습니다. 저장·승인·게시는 "오늘의 오토파일럿" 탭에서 하세요.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
