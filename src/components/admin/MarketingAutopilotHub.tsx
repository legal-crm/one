import React, { useState, useEffect } from 'react';
import { 
  Key, Calendar as CalendarIcon, BarChart3, Edit3, Settings, AlertTriangle, 
  CheckCircle, Clock, ChevronRight, RefreshCcw, Search, ExternalLink, 
  Layout, Eye, ArrowRight, Play, FileText, Image as ImageIcon, MessageCircle, 
  Video, Facebook, Share2, Plus, ArrowUpRight, TrendingUp, Users, Target,
  Check, X, MoreVertical, Smartphone, UploadCloud, Layers, Copy, CheckCheck, ShieldCheck, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

// --- 6대 채널별 전문 콘텐츠 데이터 ---
const CHANNEL_FULL_CONTENTS: Record<string, {
  title: string;
  badge: string;
  format: string;
  summary: string;
  fullBody: string;
  hashtags: string[];
  specs: { label: string; value: string }[];
  visualPrompt?: string;
  cueSheet?: { time: string; action: string; script: string }[];
  slides?: { page: number; headline: string; subtext: string; visualDesc: string }[];
}> = {
  blog: {
    title: "[100% 익명] 빚 독촉으로 밤잠 설치는 분들 필독 — 010 번호 유출 없이 다중 견적 받는 법",
    badge: "네이버 블로그 2,500자 SEO 칼럼",
    format: "네이버 블로그 스마트에디터 최적화 (H2/H3 구조 & FAQ 탑재)",
    summary: "최근 기준금리 동결에도 불구하고 늘어난 이자 부담에 시달리는 분들을 위해, 번호 유출 없이 변호사를 직접 고르고 30분 만에 서류를 완성하는 마이김변 3단 솔루션을 심층 분석합니다.",
    fullBody: `■ 서론: 금리 동결 속, 채무자들의 시름은 왜 더 깊어질까요?
최근 한국은행의 기준금리 동결 발표가 있었지만, 실제 채무자분들이 체감하는 금융 환경은 여전히 가혹합니다. 연체이자 부담과 금융권의 추심 압박 속에서 '개인회생이나 파산을 알아보고 싶어도', 포털에 전화번호를 남겼다가 하루 수십 통의 대출 영업 전화에 시달릴까 두려워 망설이시는 분들이 너무나 많습니다.

■ 1. 사설 DB 수집의 덫: 내 번호가 팔리고 있다?
많은 분들이 인터넷 광고를 보고 상담 신청을 했다가 "변호사는 만나보지도 못하고 무분별한 영업 전화만 쏟아졌다"고 호소하십니다. 사설 브로커나 대행사들이 수집한 DB는 허수(Junk Leads)가 많고, 개인정보가 무방비로 유출될 위험이 큽니다.

■ 2. 마이김변의 혁신 1: 010 번호 유출 0% '스텔스 가명' 시스템
마이김변(my김변)은 국내 최초로 의뢰인의 실제 전화번호(010)를 변호사 사무실에조차 노출하지 않고 견적과 상담을 받아볼 수 있는 '스텔스 가명' 보호 기술을 적용했습니다.
- 영업 전화 0통 보장: 내가 원할 때만, 안전한 인앱 안심 채팅으로 소통
- 변호사 직접 탐색: 법조 경력, 승소 후기, 전문 분야를 투명하게 직접 확인 후 복수 지정
- 역경매가 아닌 '고객 주도형 다중 안심 상담': 변호사법 제34조를 완벽히 준수하며 가격 덤핑 없이 정당한 실력으로 승부

■ 3. 마이김변의 혁신 2: 40종 서류 지옥 탈출! 'AI 음성 진술서 & Fast 2nd DocHub'
개인회생 준비에서 가장 고통스러운 단계가 바로 40종에 달하는 관공서 서류와 복잡한 진술서 작성입니다.
- 스마트폰에 대고 말만 하면 법원 표준 양식에 맞춘 진술서 초안 자동 완성
- 수입지출목록과 재산목록까지 30분 만에 패키징하여 담당 변호사에게 1초 전송

■ 결론 및 안내: 더 이상 혼자 속앓이하지 마세요
회생과 파산은 성실하지만 불운한 채무자를 구제하기 위한 헌법상의 제도입니다. 혼자 끙끙 앓다 기회를 놓치지 마시고, 지금 마이김변에서 30초 익명 자가진단으로 탕감 가능성을 먼저 확인해보세요.

※ 본 콘텐츠는 리걸테크 플랫폼 마이김변의 기술적 편의성을 안내하는 정보성 칼럼이며, 개별 법률 상담 및 소송 대리는 의뢰인이 선택한 독립된 법률사무소가 수행합니다.`,
    hashtags: ["#개인회생", "#개인파산", "#채무조정", "#스텔스가명", "#마이김변", "#빚독촉탈출", "#비대면법률"],
    specs: [
      { label: "글자 수", value: "2,540자 (공백 포함)" },
      { label: "권장 폰트", value: "나눔고딕 15pt / 행간 180%" },
      { label: "포함 요소", value: "H2/H3 소제목 3단 구조, FAQ 3종, 법적 면책 고지문" }
    ]
  },
  shorts: {
    title: "아직도 빚 때문에 전화기 꺼두시나요? (35초 컷)",
    badge: "유튜브 쇼츠 / 9:16 세로 숏폼",
    format: "세로 1080x1920 MP4 비디오 (키네틱 자막 + AI 음성 연출)",
    summary: "독촉 전화에 시달리는 채무자에게 번호 유출 없는 스텔스 가명 상담과 변호사 다중 견적 방법을 35초 만에 전달하는 고효율 숏폼 대본입니다.",
    fullBody: `[00~05초: 훅(Hook)]
(화면 연출: 화면 가득 부재중 전화 30통 알림이 울리는 긴박한 모션 그래픽)
성우 나레이션: "아직도 빚 독촉 전화 받기 무서워서 전화기 비행기 모드로 해두셨나요?"

[06~17초: 공감 & 딜레마]
(화면 연출: 한숨 쉬며 포털에 번호 입력하려다 멈칫하는 실루엣)
성우 나레이션: "회생 상담 한번 받아보려 해도, 번호 남겼다가 사방에서 영업 전화 쏟아질까 봐 겁나시죠?"

[18~28초: 솔루션(마이김변)]
(화면 연출: 스마트폰 마이김변 앱에서 '스텔스 가명' 켜지며 변호사 3명 프로필 터치)
성우 나레이션: "이제 010 번호 숨기고 시작하세요! 마이김변에서는 내 번호 유출 0%로 전문 변호사 3명에게 동시에 안심 견적을 받아볼 수 있습니다."

[29~35초: CTA]
(화면 연출: 고정 댓글 링크 화살표 강조 & 30초 익명 진단 뱃지)
성우 나레이션: "고정 댓글 링크에서 30초 만에 내 탕감 가능성을 100% 무료로 확인하세요!"`,
    cueSheet: [
      { time: "00~05초", action: "부재중 전화 30통 폭탄 모션 + 경고음 효과음", script: "아직도 빚 독촉 전화 받기 무서워서 전화기 비행기 모드로 해두셨나요?" },
      { time: "06~17초", action: "포털 번호 입력 망설이는 인물 줌인 (Ken Burns)", script: "회생 상담 한번 받아보려 해도, 번호 남겼다가 사방에서 영업 전화 쏟아질까 봐 겁나시죠?" },
      { time: "18~28초", action: "마이김변 스텔스 가명 쉴드 UI + 변호사 다중 선택", script: "이제 010 번호 숨기고 시작하세요! 마이김변에서는 내 번호 유출 0%로 전문 변호사 3명에게 동시에 안심 견적을 받아볼 수 있습니다." },
      { time: "29~35초", action: "고정 댓글 화살표 펄스 애니메이션 + 로고 아웃트로", script: "고정 댓글 링크에서 30초 만에 내 탕감 가능성을 100% 무료로 확인하세요!" }
    ],
    visualPrompt: "Cinematic vertical 9:16 shot, modern dark neon Korean legal office, stressed person looking at smartphone with glowing shield UI, 8k resolution, dramatic lighting",
    hashtags: ["#개인회생", "#빚독촉", "#스텔스보증", "#유튜브쇼츠", "#마이김변", "#채무탕감"],
    specs: [
      { label: "영상 길이", value: "35초" },
      { label: "해상도", value: "1080 x 1920 (9:16 Vertical)" },
      { label: "권장 BGM", value: "긴장감 넘치다 희망적으로 전환되는 로우파이 비트" }
    ]
  },
  cardnews: {
    title: "이자 갚다 지친 당신을 위한 솔루션 — 번호 노출 없이 끝내는 개인회생",
    badge: "인스타그램 카드뉴스 (6장 슬라이드)",
    format: "1080x1080 정방형 PNG 캐러셀 앨범",
    summary: "인스타그램 피드용 6장 카드뉴스로, 고통스러운 현실 공감부터 스텔스 가명과 30분 서류 패키징까지 한눈에 이해할 수 있도록 디자인되었습니다.",
    fullBody: `[인스타그램 본문 캡션]
매달 돌아오는 이자 갚느라 숨이 턱 끝까지 차오르셨나요? 😢

법적인 구제 제도가 있다는 건 알지만...
"상담 신청했다가 회사나 가족에게 알려지면 어쩌지?"
"하루 종일 대출 영업 전화 쏟아지는 거 아냐?"

더 이상 혼자 앓지 마세요.
마이김변의 혁신적인 3대 기술이 여러분을 지켜드립니다. 🛡️

1️⃣ 010 번호 유출 0%! 스텔스 가명 시스템
2️⃣ 내가 직접 고르는 투명한 전문 변호사 다중 견적
3️⃣ 말로 하면 30분 만에 끝나는 AI 서류 패키징

지금 프로필 링크(@mykimbyun)에서 30초 무료 익명 자가진단을 시작하세요! ✨

#마이김변 #개인회생 #개인파산 #신용회복 #빚탈출 #스텔스보증 #비대면법률 #카드뉴스`,
    slides: [
      { page: 1, headline: "이자 갚다 지친 당신을 위한 솔루션", subtext: "번호 유출 0%! 변호사 직접 고르고 30분 만에 끝내는 법", visualDesc: "어두운 밤 서류와 영수증을 보며 고뇌하는 채무자의 감성적 일러스트" },
      { page: 2, headline: "상담 신청하기 망설여지는 진짜 이유", subtext: "포털에 번호 남기면 사방에서 쏟아지는 대출 영업 전화의 공포", visualDesc: "스마트폰 화면 위로 쏟아지는 붉은색 알림 아이콘들" },
      { page: 3, headline: "010 번호 유출 0%, '스텔스 가명'", subtext: "내 진짜 번호는 어디에도 노출되지 않습니다. 오직 안전한 가명으로 상담 진행", visualDesc: "마이김변의 보안 쉴드(Shield) 그래픽과 비공개 보호 뱃지" },
      { page: 4, headline: "내가 직접 보고 선택하는 전문 변호사", subtext: "경력, 전문분야, 솔직 후기 확인 후 마음에 드는 변호사 3명에게 동시 견적", visualDesc: "신뢰감 있는 변호사 프로필 카드 3개가 나란히 배치된 UI 목업" },
      { page: 5, headline: "40종 서류 지옥? 말로 쓰는 AI 진술서", subtext: "동사무소 뛰어다닐 필요 없이 스마트폰으로 30분 만에 서류 패키지 완성", visualDesc: "마이크 아이콘에서 텍스트로 자동 변환되는 실시간 음성 인식 그래픽" },
      { page: 6, headline: "지금 30초 만에 익명으로 확인하세요", subtext: "프로필 링크 클릭 ➔ 100% 무료 자가진단 ➔ 탕감 가능성 즉시 조회", visualDesc: "마이김변 앱 다운로드/시작하기 버튼과 깔끔한 로고 엔딩" }
    ],
    hashtags: ["#마이김변", "#개인회생", "#개인파산", "#신용회복", "#빚탈출", "#스텔스보증", "#카드뉴스"],
    specs: [
      { label: "카드 수", value: "6장 슬라이드" },
      { label: "해상도", value: "1080 x 1080 (1:1 Square)" },
      { label: "합성 기술", value: "Imagen 3 배경 + html2canvas 타이포그래피" }
    ]
  },
  threads: {
    title: "스레드 4단 연속 타래: 빚 독촉으로 밤잠 설치던 분들이 마이김변을 찾는 이유",
    badge: "스레드 4단 인사이트 타래 (Threads)",
    format: "담백한 1인칭 독백체 텍스트 타래 (Threads Thread)",
    summary: "스레드 플랫폼 특유의 담백하고 진솔한 독백체로 법률 업계의 DB 유출 현실을 꼬집고, 마이김변의 스텔스 가명 기술 필요성을 설득합니다.",
    fullBody: `[1/4]
오늘도 이자 낼 생각에 한숨부터 쉬셨나요?
법적 구제제도가 있는 건 알지만, 회사나 가족한테 알려질까 봐 혹은 사방에서 영업 전화 쏟아질까 봐 검색창만 켰다 껐다 반복하는 분들 정말 많습니다. 혼자 끙끙 앓다 보면 밤새 잠도 안 오죠.

[2/4]
실제로 사설 상담소나 포털에 번호 한 번 남기면 그 DB가 여기저기 넘어가서 하루 종일 광고 전화에 시달리게 됩니다. 정작 내가 신뢰할 수 있는 변호사는 얼굴도 못 보고, 수임료나 조건도 제대로 비교하기 어렵습니다.

[3/4]
그래서 마이김변은 '010 번호 유출 0%' 스텔스 가명 시스템을 만들었습니다.
내 진짜 번호는 단 1글자도 넘기지 않고, 검증된 도산 전문 변호사들의 프로필과 후기를 직접 확인한 뒤 마음에 드는 변호사 여러 명에게 동시에 안심 견적을 받아볼 수 있습니다.

[4/4]
더 이상 혼자 숨죽여 버티지 마세요.
회생/파산은 성실하게 살다 넘어진 분들이 다시 일어서라고 법이 만들어둔 안전망입니다.
프로필 링크에서 익명으로 30초 자가진단부터 받아보세요. 아무에게도 알려지지 않습니다.`,
    hashtags: ["#개인회생", "#개인파산", "#채무조정", "#스레드", "#마이김변", "#스텔스보증"],
    specs: [
      { label: "타래 구성", value: "총 4단 연결 타래" },
      { label: "문체", value: "담백하고 진솔한 1인칭 독백체" },
      { label: "추천 발행 시각", value: "퇴근길 17:30 (피로도와 고민이 극대화되는 골든타임)" }
    ]
  },
  facebook: {
    title: "🚨 기준금리 동결에도 웃지 못하는 자영업자·가장 여러분 🚨",
    badge: "페이스북 4060 타겟 장문 피드",
    format: "페이스북 긴 글 피드 + 카드뉴스 앨범 연동",
    summary: "4060 자영업자와 가장들의 현실적인 채무 상환 고통에 깊이 공감하고, 가족과 주변에 폐 끼치지 않고 비밀리에 해결할 수 있는 방안을 제시합니다.",
    fullBody: `🚨 기준금리 동결 소식에도 웃지 못하는 자영업자·가장 여러분 🚨

매달 나가는 원리금 상환액에 가게 문을 열 때마다 가슴이 철렁 내려앉으시나요?
열심히 일해온 죄밖에 없는데, 늘어난 대출 이자에 잠 못 이루는 밤이 길어지고 계실 겁니다.

"법원에 회생 신청하면 주변에 다 소문나는 건 아닐까?"
"상담받으려다 영업 사원들에게 시달리는 건 아닐까?"

걱정하지 마십시오.
국내 유일의 리걸테크 플랫폼 [마이김변]은 소상공인과 가장 여러분의 비밀을 철저히 지켜드립니다.

🔒 마이김변 3대 안심 약속:
1. 010 번호 유출 0% — '스텔스 가명'으로 신분 철저 보호
2. 검증된 도산 전문 변호사 직접 탐색 & 투명한 다중 견적
3. 복잡한 40종 서류, 스마트폰으로 말만 하면 30분 만에 원스톱 패키징

더 이상 혼자 속앓이하며 버티지 마시고, 합법적인 제도의 보호를 받으십시오.
지금 아래 링크를 클릭하시면 100% 익명으로 30초 만에 무료 자가진단을 받아보실 수 있습니다.

👉 무료 익명 자가진단 바로가기: https://mykimbyun.com/diagnosis

※ 마이김변은 법률문서 작성 보조 및 변호사 선택을 지원하는 합법 리걸테크 플랫폼입니다.`,
    hashtags: ["#개인회생", "#개인파산", "#자영업자지원", "#소상공인대출", "#채무탕감", "#마이김변"],
    specs: [
      { label: "타겟 연령", value: "40대~60대 자영업자 및 가장" },
      { label: "강조 포인트", value: "가족/주변인 비밀 보장, 신뢰감, 합법성" }
    ]
  },
  tiktok: {
    title: "빚독촉 피하는 합법적 꿀팁 방출! (내 이름 안 밝히고 변호사 상담받는 법)",
    badge: "틱톡 15~25초 스낵 비디오",
    format: "세로 1080x1920 초단기 숏폼 대본 (빠른 템포 + 텍스트 오버레이)",
    summary: "틱톡 특유의 빠른 템포와 직관적인 언어로, 번호 노출 없이 가명으로 회생 가능성을 확인하는 꿀팁을 전수합니다.",
    fullBody: `[00~03초: 후킹]
(화면 연출: 모르는 02, 070 번호로 전화 계속 오는 화면 캡처)
자막/음성: "빚 독촉 전화 받기 무서워서 모르는 번호 다 씹는 사람 손? 🙋‍♂️"

[04~11초: 문제점 폭로]
(화면 연출: 팩트 폭격 제스처)
자막/음성: "인터넷에 무료 상담이라고 번호 남기면 사방에서 광고 전화 100통 오는 거 다들 아시죠?"

[12~20초: 마이김변 꿀팁]
(화면 연출: 마이김변 앱에서 '스텔스 모드' 켜지는 시각 효과)
자막/음성: "이제 번호까지 숨기고 상담받으세요. 마이김변에서는 내 010 번호 대신 가명으로 전문 변호사 3명한테 견적이 싹 들어옵니다!"

[21~25초: 엔딩 & CTA]
(화면 연출: 프로필 링크 손가락으로 가리키기)
자막/음성: "내가 빚 탕감받을 수 있는지 프로필 링크에서 30초 만에 공짜로 확인해봐요!"`,
    visualPrompt: "Fast-paced TikTok vertical style, youthful aesthetic, smartphone closeups showing anonymous toggle switch turning green, vibrant lighting",
    hashtags: ["#개인회생", "#꿀팁", "#정보공유", "#빚탈출", "#스텔스보증", "#틱톡추천", "#마이김변"],
    specs: [
      { label: "영상 길이", value: "25초" },
      { label: "템포", value: "1.2배속 빠른 나레이션" },
      { label: "타겟", value: "2030 청년 채무자 및 직장인" }
    ]
  }
};

// --- MAIN COMPONENT ---
export default function MarketingAutopilotHub() {
  const [activeTab, setActiveTab] = useState('오늘의 오토파일럿');
  const [studioChannel, setStudioChannel] = useState('blog');

  const handleSwitchToStudio = (channelId: string) => {
    const map: Record<string, string> = {
      blog: 'blog',
      shorts: 'shorts',
      cardnews: 'card',
      threads: 'threads',
      facebook: 'fb',
      tiktok: 'tiktok'
    };
    setStudioChannel(map[channelId] || 'blog');
    setActiveTab('콘텐츠 스튜디오');
  };

  const tabs = [
    { id: '오늘의 오토파일럿', icon: RefreshCcw },
    { id: 'Gemini 키 관리', icon: Key },
    { id: '콘텐츠 스튜디오', icon: Edit3 },
    { id: '365일 캘린더', icon: CalendarIcon },
    { id: '성과 분석', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">마케팅 오토파일럿 허브</h1>
          <p className="text-slate-400 text-sm">법률 플랫폼 통합 마케팅 자동화 및 채널 관리 (100% 익명 보장, 스텔스 가명 기술 적용)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2 scrollbar-hide border-b border-[#1E293B]/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === '오늘의 오토파일럿' && <TabTodayAutopilot onSwitchToStudio={handleSwitchToStudio} />}
        {activeTab === 'Gemini 키 관리' && <TabKeyManagement />}
        {activeTab === '콘텐츠 스튜디오' && <TabContentStudio initialTab={studioChannel} />}
        {activeTab === '365일 캘린더' && <TabCalendar />}
        {activeTab === '성과 분석' && <TabAnalytics />}
      </div>
    </div>
  );
}

// --- TAB 1: 오늘의 오토파일럿 ---
function TabTodayAutopilot({ onSwitchToStudio }: { onSwitchToStudio: (channelId: string) => void }) {
  const [autoMode, setAutoMode] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string; time: string; status: string; icon: any; color: string } | null>(null);

  const channels = [
    { id: 'blog', name: '네이버 블로그', time: '10:00', status: 'completed', icon: FileText, color: 'text-emerald-400' },
    { id: 'shorts', name: '유튜브 쇼츠', time: '12:30', status: 'publishing', icon: Video, color: 'text-red-400' },
    { id: 'cardnews', name: '인스타 카드뉴스', time: '14:00', status: 'pending', icon: ImageIcon, color: 'text-pink-400' },
    { id: 'threads', name: '스레드 단상', time: '17:30', status: 'pending', icon: MessageCircle, color: 'text-white' },
    { id: 'facebook', name: '페이스북 페이지', time: '18:40', status: 'pending', icon: Facebook, color: 'text-blue-400' },
    { id: 'tiktok', name: '틱톡 스낵', time: '20:30', status: 'pending', icon: Smartphone, color: 'text-cyan-400' },
  ];

  const handleApproveAll = () => {
    toast.success('오늘의 6채널 배포가 일괄 승인되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 flex flex-col lg:flex-row gap-6 shadow-md">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-sm font-medium border border-indigo-500/30">
              오늘의 테마
            </span>
            <span className="text-white font-bold text-lg">수요일 = 전문가보증 (스텔스 보증)</span>
          </div>
          <h2 className="text-xl font-bold text-white">오늘의 자동 선정 뉴스: "기준금리 동결, 서민 이자 부담은 여전..."</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            [연결 앵글] 금리 동결에도 실질적인 채무 부담을 느끼는 소상공인/직장인들을 타겟으로, 
            플랫폼의 '스텔스 가명' 기술을 통해 완전 비대면으로 안전하게 파산/회생 가능성을 진단받을 수 있음을 강조.
          </p>
        </div>
        
        <div className="lg:w-64 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-[#1E293B]/60 pt-6 lg:pt-0 lg:pl-6">
          <div className="mb-2 flex justify-between items-center text-sm">
            <span className="text-slate-400">컴플라이언스 점수</span>
            <span className="text-emerald-400 font-bold">98 / 100</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98%' }}></div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-300">완전자동 무검수 모드</span>
            <button 
              onClick={() => setAutoMode(!autoMode)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${autoMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          
          <button 
            onClick={handleApproveAll}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px] cursor-pointer"
          >
            <CheckCircle size={18} />
            6채널 일괄 승인
          </button>
        </div>
      </div>

      {/* Golden Time Timeline */}
      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm overflow-x-auto">
        <h3 className="text-lg font-bold text-white mb-6">골든타임 배포 스케줄</h3>
        <div className="flex items-center min-w-[700px] pb-4">
          {channels.map((ch, idx) => (
            <React.Fragment key={ch.id}>
              <div className="flex flex-col items-center relative z-10 w-24">
                <div className="text-xs text-slate-400 mb-2">{ch.time}</div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-[#0B0F19] shadow-sm
                  ${ch.status === 'completed' ? 'border-emerald-500 text-emerald-500' : 
                    ch.status === 'publishing' ? 'border-indigo-500 text-indigo-500 animate-pulse' : 
                    'border-slate-700 text-slate-500'}`}
                >
                  {ch.status === 'completed' ? <Check size={20} /> : <ch.icon size={20} />}
                </div>
                <div className="text-xs text-slate-300 mt-2 font-medium">{ch.name}</div>
              </div>
              {idx < channels.length - 1 && (
                <div className="flex-1 h-[2px] bg-slate-800 -mx-4 z-0 mt-[-10px]">
                  <div className={`h-full ${ch.status === 'completed' ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Channel Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((ch) => (
          <div key={ch.id} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${ch.color}`}>
                  <ch.icon size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">{ch.name}</h4>
                  <p className="text-xs text-slate-400">발행 예정: {ch.time}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg border ${
                ch.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                ch.status === 'publishing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {ch.status === 'completed' ? '완료' : ch.status === 'publishing' ? '진행중' : '대기중'}
              </span>
            </div>
            
            <div className="bg-[#0B0F19] rounded-xl p-4 text-sm text-slate-300 h-32 overflow-hidden relative">
              <div className="line-clamp-4">
                {ch.id === 'blog' && "[100% 익명] 빚 독촉으로 밤잠 설치는 분들 필독. 최근 금리 동결에도 불구하고 자영업자들의 시름은 깊어지고 있습니다. 하지만 마이김변의 스텔스 기술을 통해 개인정보 노출 없이 안전하게..."}
                {ch.id === 'shorts' && "(후킹) 아직도 빚 때문에 전화기 꺼두시나요? (본론) 내 이름 숨기고 회생 가능성 알아보는 법. 지금 바로 확인하세요. #개인회생 #스텔스보증"}
                {ch.id === 'cardnews' && "[카드 1] 이자 갚다 지친 당신을 위한 솔루션\n[카드 2] 마이김변 100% 익명 진단\n[카드 3] 변호사 직접 검토, 철저한 비밀 보장"}
                {ch.id === 'threads' && "오늘도 이자 낼 생각에 한숨 쉬셨나요? 법적 구제제도가 있어도 낙인찍힐까봐 망설이는 분들을 위해, 완벽한 익명성을 보장하는 플랫폼이 나왔습니다. 고민만 하지 말고 진단받아보세요."}
                {ch.id === 'facebook' && "🚨 금리 동결 소식에도 웃지 못하는 소상공인 여러분! 🚨 더 이상 혼자 앓지 마세요. 스텔스 가명 기술로 내 신분을 철저히 숨기고, 무료로 회생/파산 가능성을 진단받을 수 있습니다."}
                {ch.id === 'tiktok' && "빚독촉 피하는 꿀팁 방출! 내 이름 안 밝히고 변호사한테 회생 파산 진단받는 법. 마이김변 스텔스 모드 키면 끝. 링크에서 바로 확인해봐요!"}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0B0F19] to-transparent"></div>
            </div>
            
            <button 
              onClick={() => setSelectedChannel(ch)}
              className="w-full mt-4 text-sm text-indigo-400 hover:text-indigo-300 font-medium py-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
            >
              콘텐츠 전문 보기 <ChevronRight size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Content Detail Modal */}
      {selectedChannel && (
        <ContentDetailModal 
          channel={selectedChannel} 
          onClose={() => setSelectedChannel(null)}
          onEditInStudio={() => {
            const chId = selectedChannel.id;
            setSelectedChannel(null);
            onSwitchToStudio(chId);
          }}
        />
      )}
    </div>
  );
}

// --- MODAL: 콘텐츠 전문 보기 팝업 ---
function ContentDetailModal({ 
  channel, 
  onClose,
  onEditInStudio 
}: { 
  channel: { id: string; name: string; time: string; status: string; icon: any; color: string };
  onClose: () => void;
  onEditInStudio: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'text' | 'visual' | 'cue'>('text');
  const content = CHANNEL_FULL_CONTENTS[channel.id] || CHANNEL_FULL_CONTENTS.blog;
  const Icon = channel.icon;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${content.title}\n\n${content.fullBody}\n\n${content.hashtags.join(' ')}`);
    setCopied(true);
    toast.success('콘텐츠 전문 및 태그가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#111622] rounded-3xl border border-[#1E293B] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1E293B]/80 flex items-center justify-between bg-[#151B28]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${channel.color}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{channel.name} 콘텐츠 전문</h3>
                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 font-medium">
                  {content.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">발행 예정 시각: {channel.time} · {content.format}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? '복사됨' : '전체 복사'}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub Navigation (특화 탭) */}
        <div className="px-6 pt-3 pb-2 border-b border-[#1E293B]/60 flex gap-2 bg-[#0E131F]">
          <button
            onClick={() => setActiveSubTab('text')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            본문 전문 (텍스트)
          </button>
          {content.cueSheet && (
            <button
              onClick={() => setActiveSubTab('cue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'cue' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              영상 연출 큐시트 (Timecode)
            </button>
          )}
          {content.slides && (
            <button
              onClick={() => setActiveSubTab('visual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'visual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              카드뉴스 슬라이드 구성 (6장)
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200">
          
          {/* Main Title Banner */}
          <div className="bg-[#0B0F19] rounded-2xl p-4 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Title / Headline</span>
            <h4 className="text-base sm:text-lg font-bold text-white leading-snug">{content.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{content.summary}</p>
          </div>

          {/* Tab 1: Text Body */}
          {activeSubTab === 'text' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-400" />
                  원문 텍스트 (줄바꿈 및 마크다운 서식 포함)
                </span>
                <span className="text-xs text-emerald-400 font-medium">검수 통과 (변호사법 준수 100%)</span>
              </div>
              <div className="bg-[#0B0F19] rounded-2xl p-5 border border-slate-800 text-sm font-normal text-slate-300 leading-relaxed whitespace-pre-wrap font-sans select-text">
                {content.fullBody}
              </div>
            </div>
          )}

          {/* Tab 2: Cue Sheet for Video */}
          {activeSubTab === 'cue' && content.cueSheet && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Video size={14} className="text-indigo-400" />
                타임스탬프별 연출 지시 & 자막 큐시트
              </span>
              <div className="space-y-2.5">
                {content.cueSheet.map((cue, idx) => (
                  <div key={idx} className="bg-[#0B0F19] rounded-xl p-3.5 border border-slate-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold shrink-0">
                      {cue.time}
                    </span>
                    <div className="flex-1 text-xs text-slate-400">
                      <span className="text-slate-200 font-semibold block mb-0.5">🎬 {cue.action}</span>
                      <span className="text-amber-300/90 font-medium">🗣️ "{cue.script}"</span>
                    </div>
                  </div>
                ))}
              </div>
              {content.visualPrompt && (
                <div className="bg-[#0B0F19] rounded-xl p-3.5 border border-slate-800 mt-4">
                  <span className="text-[11px] font-bold text-pink-400 block mb-1">🎨 Imagen 3 시네마틱 프롬프트</span>
                  <code className="text-xs font-mono text-slate-300 block">{content.visualPrompt}</code>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Slides for Card News */}
          {activeSubTab === 'visual' && content.slides && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-indigo-400" />
                장별 슬라이드 헤드라인 & 시각 요소
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {content.slides.map((slide) => (
                  <div key={slide.page} className="bg-[#0B0F19] rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center text-xs font-bold">
                          {slide.page}
                        </span>
                        <span className="text-[10px] text-slate-500">1080 x 1080</span>
                      </div>
                      <h5 className="font-bold text-white text-sm mb-1">{slide.headline}</h5>
                      <p className="text-xs text-slate-400">{slide.subtext}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-indigo-400/80">
                      🖼️ {slide.visualDesc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specs & Hashtags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0B0F19] rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">제작 규격 & 메타데이터</span>
              <div className="space-y-1 text-xs">
                {content.specs.map((sp, i) => (
                  <div key={i} className="flex justify-between text-slate-300">
                    <span className="text-slate-500">{sp.label}</span>
                    <span className="font-medium text-slate-200">{sp.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0B0F19] rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">최적화 해시태그</span>
              <div className="flex flex-wrap gap-1.5">
                {content.hashtags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Legal Compliance Notice */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-emerald-400 block mb-0.5">변호사법 및 플랫폼 가이드라인 검증 완료</span>
              본 콘텐츠는 특정 법률사무소의 유인·알선 문구를 일절 배제하고, 마이김변의 '스텔스 가명', '30분 서류 패키징' 등 순수 기술적 편의성만 객관적으로 안내하도록 자동 검수되었습니다.
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#1E293B]/80 bg-[#151B28] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles size={14} className="text-amber-400" />
            <span>Gemini Pro 클러스터 자동 생성 완료 자산</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onEditInStudio}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <Edit3 size={14} />
              콘텐츠 스튜디오에서 편집
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors press-scale cursor-pointer min-h-[44px] shadow-sm"
            >
              <Copy size={14} />
              클립보드 전체 복사
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- TAB 2: Gemini 키 관리 ---
function TabKeyManagement() {
  const [showModal, setShowModal] = useState(false);

  const keys = [
    { id: 1, role: '뉴스분석관 & 검수관', name: 'Account #1', key: 'AIzaSyD...xQ9A', status: 'active', usage: 45, icon: Search },
    { id: 2, role: '블로그 전문 작가', name: 'Account #2', key: 'AIzaSyA...m2P1', status: 'active', usage: 82, icon: FileText },
    { id: 3, role: '숏폼 스크립트 디렉터', name: 'Account #3', key: 'AIzaSyM...k8L0', status: 'rate-limited', usage: 98, icon: Video },
    { id: 4, role: '소셜 스토리텔러', name: 'Account #4', key: 'AIzaSyC...v4N2', status: 'active', usage: 30, icon: MessageCircle },
    { id: 5, role: '비주얼 프롬프트 아티스트', name: 'Account #5', key: 'AIzaSyP...t5X3', status: 'active', usage: 15, icon: ImageIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111622] p-6 rounded-2xl border border-[#1E293B]/60 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-indigo-400" />
            Gemini Pro 멀티-계정 풀 (5-Keys)
          </h2>
          <p className="text-sm text-slate-400 mt-1">API 요금 한도 도달 시 자동으로 다음 키로 페일오버(Failover) 됩니다.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm text-slate-300">오토 페일오버 작동 중</span>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors press-scale flex items-center gap-2 min-h-[44px]"
          >
            <Plus size={16} /> API Key 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {keys.map(k => (
          <div key={k.id} className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
            {k.status === 'rate-limited' && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
            )}
            {k.status === 'active' && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
            )}
            
            <div className="flex justify-between items-start mb-4 mt-1">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                <k.icon size={20} />
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-lg border ${
                k.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {k.status === 'active' ? 'ACTIVE' : 'RATE LIMIT'}
              </span>
            </div>
            
            <h3 className="font-bold text-white text-sm mb-1">{k.role}</h3>
            <p className="text-xs text-slate-400 mb-4">{k.name}</p>
            
            <div className="bg-[#0B0F19] rounded-lg p-2.5 mb-4 border border-slate-800 flex justify-between items-center group/key cursor-pointer">
              <span className="text-xs font-mono text-slate-300">{k.key}</span>
              <Eye size={14} className="text-slate-500 group-hover/key:text-white transition-colors" />
            </div>
            
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">일일 토큰 사용량</span>
                <span className={k.usage > 90 ? 'text-amber-400' : 'text-slate-300'}>{k.usage}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${k.usage > 90 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                  style={{ width: `${k.usage}%` }}
                ></div>
              </div>
            </div>
            
            <button className="w-full py-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors min-h-[44px]">
              연결 테스트
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] rounded-3xl border border-[#1E293B] p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">새 Gemini API Key 등록</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">계정 별칭</label>
                <input type="text" className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" placeholder="예: Account #6" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">할당 역할</label>
                <select className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                  <option>백업용 예비 풀</option>
                  <option>뉴스분석관</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">API Key</label>
                <input type="password" className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" placeholder="AIzaSy..." />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 min-h-[44px]">취소</button>
              <button 
                onClick={() => {
                  toast.success('API Key가 성공적으로 등록되었습니다.');
                  setShowModal(false);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 min-h-[44px]"
              >
                저장 및 테스트
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB 3: 콘텐츠 스튜디오 ---
function TabContentStudio({ initialTab = 'blog' }: { initialTab?: string }) {
  const [topic, setTopic] = useState('가계부채 폭증과 2030 영끌족의 파산 위기');
  const [theme, setTheme] = useState('비대면기술');
  const [genTab, setGenTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setGenTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Inputs & Bridge Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-white mb-4">수동 생성 설정</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">타겟 주제 / 뉴스 팩트</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">강조 테마 (요일별 추천)</label>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none"
                >
                  <option value="서류혁신">월 = 서류혁신 (간편 서류 발급)</option>
                  <option value="안심탐색">화 = 안심탐색 (보안 상담)</option>
                  <option value="전문가보증">수 = 전문가보증 (안전 검토)</option>
                  <option value="높은호환성">목 = 높은호환성 (모든 기기 지원)</option>
                  <option value="비대면기술">금 = 비대면기술 (100% 비대면)</option>
                  <option value="면책완주">토 = 면책완주 (끝까지 동행)</option>
                  <option value="주간자가진단">일 = 주간자가진단 (주말 빠른 진단)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={16} /> 3-Step 연결 브릿지 설계
            </h3>
            
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/50 before:via-slate-700 before:to-slate-800 hidden md:block">
              {/* Stepper hidden on very small screens for simplicity, rendered sequentially instead */}
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">1</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Fact (뉴스)</span>
                  <p className="text-sm text-slate-300">2030세대 영끌족, 금리 인상 여파로 가계부채 한계 봉착</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">2</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Dilemma (채무자 딜레마)</span>
                  <p className="text-sm text-slate-300">파산/회생을 알아보고 싶지만, 직장 불이익이나 주변 시선이 두려움</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">3</div>
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex-1">
                  <span className="text-xs text-indigo-400 block mb-1">Solution (플랫폼 브릿지)</span>
                  <p className="text-sm text-indigo-100">'스텔스 가명' 기술로 철저히 신분을 숨기고 완전 비대면으로 진단 가능함 어필</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => toast.success('6개 채널 콘텐츠 생성을 시작합니다.')}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
            >
              <UploadCloud size={18} />
              원클릭 6채널 콘텐츠 생성
            </button>
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="lg:col-span-2 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm flex flex-col h-full min-h-[600px]">
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
                onClick={() => setGenTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap min-h-[44px] transition-colors ${
                  genTab === t.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            {genTab === 'blog' && (
              <>
                <input 
                  type="text" 
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-t-xl px-4 py-3 text-white font-medium focus:outline-none border-b-0"
                  defaultValue="[100% 익명] 2030 영끌족, 빚 독촉 피하고 비대면으로 파산/회생 알아보는 법"
                />
                <textarea 
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-b-xl px-4 py-4 text-slate-300 focus:outline-none resize-none leading-relaxed"
                  defaultValue={`안녕하세요, 최근 금리 인상 여파로 2030세대 영끌족의 고민이 깊어지고 있습니다.\n\n매달 돌아오는 이자 상환일에 가슴 졸이며, 혹시나 직장에 알려질까 전전긍긍하시는 분들이 많습니다. 법적인 구제 제도가 있다는 것은 알지만, 주변의 시선과 낙인 효과가 두려워 상담조차 받지 못하는 것이 현실입니다.\n\n하지만 걱정하지 마세요.\n마이김변 플랫폼에서는 '스텔스 가명' 기술을 도입하여 100% 완전 익명으로 회생/파산 가능성을 진단받을 수 있습니다. 내 진짜 이름이나 연락처를 노출하지 않고도, 전문 변호사의 검토를 받을 수 있는 비대면 기술입니다.\n\n더 이상 혼자 앓지 마시고, 안전한 플랫폼에서 첫 걸음을 떼보세요.`}
                />
              </>
            )}
            {genTab === 'card' && (
              <div className="flex-1 flex items-center justify-center bg-[#0B0F19] border border-slate-700 rounded-xl relative overflow-hidden">
                <div className="text-center">
                  <ImageIcon size={48} className="text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">카드뉴스 이미지 렌더링 프리뷰 영역</p>
                  <button className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm min-h-[44px]">프롬프트 재생성</button>
                </div>
              </div>
            )}
            {(genTab !== 'blog' && genTab !== 'card') && (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                선택한 채널의 에디터가 표시됩니다.
              </div>
            )}
          </div>
          
          <div className="mt-4 flex justify-end gap-3">
            <button className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 min-h-[44px]">임시저장</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 min-h-[44px] shadow-sm flex items-center gap-2">
              <Share2 size={16} /> 즉시 배포하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- TAB 4: 365일 캘린더 ---
function TabCalendar() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dates = Array.from({ length: 35 }, (_, i) => i - 2); // Simple mock for calendar grid
  
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">이번 달 총 발행</div>
          <div className="text-2xl font-bold text-white">124<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">성공률</div>
          <div className="text-2xl font-bold text-emerald-400">99.2<span className="text-sm font-normal text-slate-500 ml-1">%</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">예약된 콘텐츠</div>
          <div className="text-2xl font-bold text-indigo-400">42<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">에러 알림</div>
          <div className="text-2xl font-bold text-slate-300">0<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
      </div>

      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm">
        {/* Month Nav */}
        <div className="flex items-center justify-between mb-6">
          <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <h3 className="text-xl font-bold text-white">2026년 9월</h3>
          <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
          {days.map(d => (
            <div key={d} className="bg-[#111622] py-3 text-center text-xs font-medium text-slate-400">
              {d}
            </div>
          ))}
          {dates.map((d, i) => {
            const isCurrentMonth = d > 0 && d <= 30;
            const isToday = d === 19;
            return (
              <div 
                key={i} 
                className={`bg-[#0B0F19] min-h-[100px] p-2 hover:bg-[#111622] transition-colors cursor-pointer group ${!isCurrentMonth ? 'opacity-30' : ''}`}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2 
                  ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400 group-hover:text-white'}`}
                >
                  {d > 0 ? (d > 30 ? d - 30 : d) : 31 + d}
                </div>
                
                {isCurrentMonth && (d % 3 !== 0) && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {/* Mock status dots */}
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-indigo-500' : 'bg-slate-600'}`} title="블로그"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-amber-500' : 'bg-slate-600'}`} title="쇼츠"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-slate-600' : 'bg-slate-600'}`} title="카드뉴스"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="스레드"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="페이스북"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="틱톡"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 flex gap-4 text-xs text-slate-400 justify-end">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> 발행 완료</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 예약됨</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> 진행중</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-600"></div> 미정</div>
        </div>
      </div>
    </div>
  );
}

// --- TAB 5: 성과 분석 ---
function TabAnalytics() {
  const channelStats = [
    { name: '네이버 블로그', total: 342, growth: '+12%', icon: FileText, color: 'text-emerald-400' },
    { name: '유튜브 쇼츠', total: 128, growth: '+24%', icon: Video, color: 'text-red-400' },
    { name: '인스타 카드뉴스', total: 256, growth: '+8%', icon: ImageIcon, color: 'text-pink-400' },
    { name: '스레드', total: 184, growth: '+45%', icon: MessageCircle, color: 'text-white' },
    { name: '페이스북', total: 420, growth: '+2%', icon: Facebook, color: 'text-blue-400' },
    { name: '틱톡', total: 95, growth: '+88%', icon: Smartphone, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {channelStats.map((stat, i) => (
          <div key={i} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm flex flex-col justify-between h-32 hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start">
              <stat.icon size={20} className={stat.color} />
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">{stat.growth}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-0.5">{stat.total}</div>
              <div className="text-xs text-slate-400">{stat.name} 누적 발행</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white">월간 발행 및 트래픽 유입 추이</h3>
            <select className="bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
              <option>최근 6개월</option>
              <option>최근 1년</option>
            </select>
          </div>
          <div className="flex-1 flex items-center justify-center border border-dashed border-slate-700/50 rounded-xl bg-[#0B0F19]/50">
            <div className="text-center text-slate-500">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">차트 렌더링 영역 (Recharts 등 활용)</p>
            </div>
          </div>
        </div>

        {/* Top Content */}
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm">
          <h3 className="font-bold text-white mb-4">이번 주 Top 성과 콘텐츠</h3>
          <div className="space-y-4">
            {[
              { title: '"이자 갚다 지쳤다면 필수 시청"', type: '유튜브 쇼츠', views: '12.4k', conversions: 42 },
              { title: '2030 영끌족 파산 진단 가이드', type: '네이버 블로그', views: '8.2k', conversions: 28 },
              { title: '스텔스 가명으로 알아보는 내 빚', type: '틱톡', views: '24k', conversions: 19 },
              { title: '법원 서류, 비대면으로 끝내는 법', type: '인스타 카드뉴스', views: '5.1k', conversions: 15 },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-[#0B0F19] rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{item.type}</span>
                  <span className="text-xs font-bold text-emerald-400">{item.conversions}건 전환</span>
                </div>
                <div className="text-sm font-medium text-slate-200 line-clamp-1">{item.title}</div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Eye size={12} /> {item.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
