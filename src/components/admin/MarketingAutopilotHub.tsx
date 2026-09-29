import React, { useState, useEffect } from 'react';
import { 
  Key, Calendar as CalendarIcon, BarChart3, Edit3, Settings, AlertTriangle, 
  CheckCircle, Clock, ChevronRight, RefreshCcw, Search, ExternalLink, 
  Layout, Eye, ArrowRight, Play, FileText, Image as ImageIcon, MessageCircle, 
  Video, Facebook, Share2, Plus, ArrowUpRight, TrendingUp, Users, Target,
  Check, X, MoreVertical, Smartphone, UploadCloud, Layers, Copy, CheckCheck, ShieldCheck, Sparkles, Download, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { DDOK_BLOG_PRESETS_DATA, generateBlogContentWithGemini, testMarketingAiConnection, BlogContentData, BlogImageItem, injectPollinationsUrls, ImageSourceType, generatePollinationsUrl } from '../../services/marketingAiService';
import DailyAutopilotPanel from './marketing/DailyAutopilotPanel';
import { AutopilotCalendar, AutopilotAnalytics, AutopilotKeyStatus } from './marketing/AutopilotInsights';

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
  blogImages?: {
    id: string;
    order: number;
    title: string;
    role: string;
    insertPosition: string;
    prompt: string;
    previewGradient: string;
    previewTitle: string;
    previewSub: string;
    tag: string;
  }[];
}> = {
  blog: {
    title: "[100% 익명] 빚 독촉으로 밤잠 설치는 분들 필독 — 010 번호 유출 없이 다중 견적 받는 법",
    badge: "네이버 블로그 2,500자 SEO 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (대표 썸네일 1컷 + 본문 인포그래픽 3컷 탑재)",
    summary: "최근 기준금리 동결에도 불구하고 늘어난 이자 부담에 시달리는 분들을 위해, 번호 유출 없이 변호사를 직접 고르고 30분 만에 서류를 완성하는 마이김변 3단 솔루션을 심층 분석합니다.",
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(기준금리 동결과 채무자의 현실 — 010 번호 비공개 개인회생 가이드)

■ 서론: 금리 동결 속, 채무자들의 시름은 왜 더 깊어질까요?
최근 한국은행의 기준금리 동결 발표가 있었지만, 실제 채무자분들이 체감하는 금융 환경은 여전히 가혹합니다. 연체이자 부담과 금융권의 추심 압박 속에서 '개인회생이나 파산을 알아보고 싶어도', 포털에 전화번호를 남겼다가 하루 수십 통의 대출 영업 전화에 시달릴까 두려워 망설이시는 분들이 너무나 많습니다.

■ 1. 사설 DB 수집의 덫: 내 번호가 팔리고 있다?
많은 분들이 인터넷 광고를 보고 상담 신청을 했다가 "변호사는 만나보지도 못하고 무분별한 영업 전화만 쏟아졌다"고 호소하십니다. 사설 브로커나 대행사들이 수집한 DB는 허수(Junk Leads)가 많고, 개인정보가 무방비로 유출될 위험이 큽니다.

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(사설 DB 수집 vs 마이김변 스텔스 가명 비교 도표)

■ 2. 마이김변의 혁신 1: 010 번호 비공개 '스텔스 가명' 시스템
마이김변(my김변)은 의뢰인의 실제 전화번호(010)를 변호사 사무실에조차 노출하지 않고 견적과 상담을 받아볼 수 있는 '스텔스 가명' 보호 기술을 적용했습니다.
- 번호 비공개 상담: 내가 원할 때만, 안전한 인앱 안심 채팅으로 소통
- 변호사 직접 탐색: 법조 경력, 이용 후기, 주요 업무 분야를 투명하게 직접 확인 후 복수 지정
- 고객 주도형 선택: 플랫폼이 변호사를 배정하지 않고, 의뢰인이 정보를 확인한 뒤 직접 고릅니다

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(스마트폰으로 30분 만에 끝내는 AI 음성 진술서 & 서류 원스톱 패키징)

■ 3. 마이김변의 혁신 2: 40종 서류 지옥 탈출! 'AI 음성 진술서 & Fast 2nd DocHub'
개인회생 준비에서 가장 고통스러운 단계가 바로 40종에 달하는 관공서 서류와 복잡한 진술서 작성입니다.
- 스마트폰에 대고 말만 하면 법원 표준 양식에 맞춘 진술서 초안 자동 완성
- 수입지출목록과 재산목록까지 30분 만에 패키징하여 담당 변호사에게 1초 전송

■ 결론 및 안내: 더 이상 혼자 속앓이하지 마세요
회생과 파산은 성실하지만 불운한 채무자를 구제하기 위한 헌법상의 제도입니다. 혼자 끙끙 앓다 기회를 놓치지 마시고, 지금 마이김변에서 010 번호 유출 없이 내 안심 가명으로 변호사 리스트를 확인하고 무료 안심 견적을 받아보세요.

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(010 번호 비공개 안심 가명 상담 신청 바로가기 — 마이김변 공식 배너)

※ 본 콘텐츠는 리걸테크 플랫폼 마이김변의 기술적 편의성을 안내하는 정보성 칼럼이며, 개별 법률 상담 및 소송 대리는 의뢰인이 선택한 독립된 법률사무소가 수행합니다.`,
    blogImages: [
      {
        id: "blog-img-1",
        order: 1,
        title: "대표 썸네일: 기준금리 동결과 채무자의 현실",
        role: "검색 결과 클릭률(CTR) 극대화 대표 썸네일 (1:1 정방형)",
        insertPosition: "본문 최상단 (서론 전)",
        prompt: "A cinematic, moody Korean financial desk with calculator, gavel, interest rate chart, dramatic atmospheric lighting, photorealistic, 8k resolution, elegant dark navy tone",
        previewGradient: "from-blue-950 via-slate-900 to-indigo-950",
        previewTitle: "기준금리 동결 속 빚 독촉 해결법",
        previewSub: "010 번호 노출 없이 변호사 직접 고르는 개인회생",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "blog-img-2",
        order: 2,
        title: "인포그래픽: 사설 DB 영업 vs 마이김변 스텔스 가명",
        role: "문제점 환기 및 010 번호 비공개 기술 신뢰도 제공",
        insertPosition: "2번 섹션 (스텔스 가명 시스템 설명 상단)",
        prompt: "A clean modern vector comparison infographic: left side showing red spam phone calls and leaked numbers, right side showing a glowing cyan security lock shield protecting user identity, dark tech style",
        previewGradient: "from-slate-900 via-rose-950/40 to-emerald-950/40",
        previewTitle: "사설 DB vs 마이김변 비교",
        previewSub: "010 번호 비공개 · 변호사 직접 선택",
        tag: "비교 인포그래픽"
      },
      {
        id: "blog-img-3",
        order: 3,
        title: "기능 화면: 말로 쓰는 AI 음성 진술서 & 서류 30분 패키징",
        role: "40종 서류 지옥 탈출 솔루션의 시각적 입증",
        insertPosition: "3번 섹션 (AI 음성 진술서 설명 하단)",
        prompt: "A sleek modern smartphone floating mockup displaying a Korean legal document app with audio waveform recording and green checkmarks for completed documents, photorealistic 3D render",
        previewGradient: "from-indigo-950 via-slate-900 to-purple-950",
        previewTitle: "말로 쓰는 AI 음성 진술서",
        previewSub: "동사무소 40종 서류 지옥? 스마트폰 30분 원스톱 완성",
        tag: "앱 UI 목업"
      },
      {
        id: "blog-img-4",
        order: 4,
        title: "CTA 배너: 010 번호 노출 없는 안심 가명 상담 바로가기",
        role: "블로그 독자를 플랫폼 유입 및 변호사 상담 신청으로 전환",
        insertPosition: "본문 최하단 (결론 및 면책 공지 직전)",
        prompt: "A high-conversion horizontal banner with glowing emerald CTA button '안심 가명 상담 신청', sleek dark background with golden shield badge, professional fintech look",
        previewGradient: "from-emerald-950 via-slate-900 to-indigo-950",
        previewTitle: "내게 맞는 도산 사건 경험 변호사 찾기",
        previewSub: "010 번호 노출 없이 변호사 프로필 확인 후 안심 상담받으세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생", "#개인파산", "#채무조정", "#스텔스가명", "#마이김변", "#빚독촉탈출", "#비대면법률"],
    specs: [
      { label: "글자 수", value: "2,540자 (공백 포함)" },
      { label: "삽입 이미지", value: "총 4컷 (대표 썸네일 1 + 본문 인포그래픽 3)" },
      { label: "권장 폰트", value: "나눔고딕 15pt / 행간 180%" },
      { label: "포함 요소", value: "H2/H3 소제목 3단 구조, FAQ 3종, 법적 면책 고지문" }
    ]
  },
  shorts: {
    title: "이자 갚다 지쳤다면 딱 3초만 집중 (심리스 무한 루프 35초)",
    badge: "유튜브 쇼츠 / 9:16 세로 숏폼 (E-A-Q-R 후킹)",
    format: "세로 1080x1920 MP4 비디오 (키네틱 자막 + 심리스 무한 루프 연출)",
    summary: "인사말('안녕하세요')을 배제하고 첫 3초 E-A-Q-R 훅으로 이탈을 막은 뒤, 영상의 마지막 문장이 첫 문장으로 이어지는 심리스 루프(Seamless Loop)로 반복 시청을 유도합니다.",
    fullBody: `[00~03초: E-A-Q-R 3초 훅 (인사말 없이 즉시 시작)]
(화면 연출: 화면 가득 부재중 전화 알림이 쏟아지는 긴박한 줌인 효과, 인사말 배제)
성우 나레이션: "매달 이자 내고 통장 잔고 0원 찍히나요? 딱 30초만 집중하세요."

[04~15초: 공감 & 딜레마 폭로]
(화면 연출: 포털 검색창에 번호 적으려다 멈칫하는 실루엣 + 쏟아지는 스팸 알림)
성우 나레이션: "회생 상담 한번 받아보려 해도, 번호 남겼다가 사방에서 영업 전화가 쏟아질까 봐 겁나시죠?"

[16~27초: 솔루션 (마이김변 스텔스 가명)]
(화면 연출: 마이김변 앱에서 '스텔스 가명' 켜지며 실시간 변호사 프로필 3명 터치)
성우 나레이션: "이제 010 번호 숨기고 시작하세요! 마이김변에서는 내 번호 비공개로 여러 변호사에게 동시에 안심 견적을 받아볼 수 있습니다."

[28~35초: 심리스 루프(Seamless Loop) & 고정 댓글 CTA]
(화면 연출: 고정 댓글 화살표 펄스 애니메이션 후, 첫 장면의 질문으로 자연스럽게 이어지는 문장 아웃트로)
성우 나레이션: "고정 댓글에서 010 번호 없이 가명으로 견적 받는 법을 확인하세요. 매달 돌아오는 이자 독촉에서 벗어나는 첫걸음은 바로,"
➔ (영상 첫 문장 "매달 이자 내고 통장 잔고 0원 찍히나요? 딱 30초만 집중하세요."로 끊김 없이 무한 루프 연결)`,
    cueSheet: [
      { time: "00~03초", action: "부재중 전화 알림 모션 + 줌인 (인사말 없음)", script: "매달 이자 내고 통장 잔고 0원 찍히나요? 딱 30초만 집중하세요." },
      { time: "04~15초", action: "포털 번호 입력 망설이는 인물 + 스팸 경고음", script: "회생 상담 한번 받아보려 해도, 번호 남겼다가 사방에서 영업 전화가 쏟아질까 봐 겁나시죠?" },
      { time: "16~27초", action: "마이김변 스텔스 가명 쉴드 UI + 변호사 3명 터치", script: "이제 010 번호 숨기고 시작하세요! 마이김변에서는 내 번호 비공개로 여러 변호사에게 동시에 안심 견적을 받아볼 수 있습니다." },
      { time: "28~35초", action: "고정 댓글 강조 + 루프 브릿지 문장으로 첫 장면 연결", script: "고정 댓글에서 010 번호 없이 가명으로 견적 받는 법을 확인하세요. 매달 돌아오는 이자 독촉에서 벗어나는 첫걸음은 바로," }
    ],
    visualPrompt: "Cinematic vertical 9:16 shot, modern dark neon Korean legal office, stressed person looking at smartphone with glowing shield UI, 8k resolution, dramatic lighting",
    hashtags: ["#개인회생", "#빚독촉", "#스텔스보증", "#유튜브쇼츠", "#마이김변", "#채무탕감"],
    specs: [
      { label: "영상 길이", value: "35초 (완독률 최적화)" },
      { label: "후킹 구조", value: "HF-3 / E-A-Q-R 첫 3초 예측 붕괴 (인사말 절대 금지)" },
      { label: "알고리즘 공략", value: "심리스 루프 (Seamless Loop) 설계로 반복 시청 유도" },
      { label: "전환 장치", value: "영상 내 고정 댓글(Pinned Comment) 링크 유도" }
    ]
  },
  cardnews: {
    title: "빚 5천만원 넘어가면 꼭 확인해 볼 3가지 (10장 황금 캐러셀)",
    badge: "인스타그램 카드뉴스 (10장 캐러셀)",
    format: "1080x1080 정방형 PNG 캐러셀 (1슬라이드 1메시지 + 저장/공유 유도)",
    summary: "인스타그램 최신 알고리즘 가중치(저장/공유)를 정조준한 10장 황금 캐러셀입니다. 열린 고리(Open Loop) 기법으로 스와이프 완독률을 극대화합니다.",
    fullBody: `[인스타그램 본문 캡션]
매달 돌아오는 이자 갚느라 숨이 턱 끝까지 차오르셨나요? 😢

원금은 그대로인데 이자만 나가고 있다면,
지금 당장 '채무 구조'를 바꾸셔야 할 때입니다.

하지만 인터넷에 번호 남겼다가
사방에서 대출 영업 전화 쏟아질까 봐 망설여지셨죠?

010 번호 단 1자리도 넘기지 않고,
안심 가명으로 전문 변호사 3명의 견적을 직접 비교하는 법을 정리했습니다.

📌 나중에 다시 확인하려면 지금 오른쪽 아래 [저장]을 눌러두세요!
주변에 혼자 빚 고민으로 힘들어하는 친구가 있다면 조용히 [공유]해 주세요. 🛡️

#마이김변 #개인회생 #개인파산 #신용회복 #빚탈출 #스텔스보증 #비대면법률`,
    slides: [
      { page: 1, headline: "빚 5,000만원 넘어가면 꼭 확인해 볼 3가지", subtext: "원금은 그대로고 이자만 나가고 있다면 필독 (옆으로 넘겨보기 ➔)", visualDesc: "어두운 밤 계산기와 영수증을 바라보는 고대비 타이포그래피 표지" },
      { page: 2, headline: "혹시 매달 '이자만' 갚고 계신가요?", subtext: "월급 받아서 대출 이자 내면 남는 돈 0원... 더 이상 버티기 어렵다면", visualDesc: "스마트폰 계좌 잔액 0원과 늘어나는 이자 그래프" },
      { page: 3, headline: "법적 구제 제도가 있지만 망설여지는 이유", subtext: "'인터넷에 상담 글 올렸더니 하루 종일 대출 스팸 전화가 와요'", visualDesc: "화면 위로 쏟아지는 붉은색 스팸 알림 아이콘들" },
      { page: 4, headline: "사설 브로커의 번호 장사 vs 안전한 해결책", subtext: "내 소중한 010 개인정보가 불법 유통되는 구조를 피해야 합니다", visualDesc: "사설 DB 유출 경로와 경고 그래픽" },
      { page: 5, headline: "첫 번째: 010 번호 비공개 '스텔스 가명'", subtext: "내 진짜 번호는 가리고, 안심 가명으로만 안전하게 상담 진행", visualDesc: "마이김변 보안 쉴드(Shield)와 가명 생성 인터페이스" },
      { page: 6, headline: "두 번째: 변호사 직접 탐색 & 복수 안심 견적", subtext: "경력과 이용 후기를 직접 확인하고 마음에 드는 변호사를 직접 선택", visualDesc: "도산 사건 경험 변호사 프로필 카드 3개 비교 화면" },
      { page: 7, headline: "세 번째: 40종 서류, 말로 쓰는 AI 음성 진술서", subtext: "동사무소 서류 지옥 탈출! 스마트폰으로 말만 하면 30분 패키징 완성", visualDesc: "음성 파형이 법원 표준 진술서로 자동 변환되는 UI" },
      { page: 8, headline: "핵심 요약: 번호 없이 시작하는 안심 회생", subtext: "혼자 앓지 말고 합법적 제도의 보호를 안전하게 받으세요", visualDesc: "3단계 체크리스트 정리 그래픽" },
      { page: 9, headline: "💡 주변에 이런 고민을 하는 동료가 있다면?", subtext: "주변 소문 걱정 없이 조용히 도움받을 수 있도록 이 글을 공유해 주세요", visualDesc: "공유(Share) 아이콘과 온기 있는 일러스트" },
      { page: 10, headline: "지금 프로필 링크에서 안심 가명으로 확인", subtext: "나중에 다시 보려면 꼭 [저장] 누르고 프로필 링크(@mykimbyun)를 확인하세요!", visualDesc: "저장(Save) 버튼 하이라이트와 프로필 링크 안내" }
    ],
    hashtags: ["#마이김변", "#개인회생", "#개인파산", "#신용회복", "#빚탈출", "#스텔스보증"],
    specs: [
      { label: "슬라이드 수", value: "10장 황금 캐러셀 (완독률·저장률 최적화)" },
      { label: "콘텐츠 구조", value: "표지 훅 ➔ 통증 공감 ➔ 3대 솔루션 ➔ 반전 팁 ➔ 저장·공유 CTA" },
      { label: "디자인 기준", value: "1:1 Square (1080x1080), 30pt 이상 폰트, WCAG AA 고대비" }
    ]
  },
  threads: {
    title: "스레드 바이럴 타래: 빚 독촉으로 밤잠 설칠 때 010 번호 없이 살아남는 법 (반말 독백체)",
    badge: "스레드 4단 바이럴 타래 (Threads)",
    format: "담백한 1인칭 반말 독백체 (1~2줄 줄바꿈 + 첫 댓글 링크 유도)",
    summary: "스레드 알고리즘 맞춤: 친구에게 털어놓듯 편안한 반말 구어체, 1~2줄 단위 줄바꿈 여백, 첫 댓글 링크 유도로 도달률 페널티를 완벽 회피합니다.",
    fullBody: `[1/4]
오늘도 이자 낼 생각에 한숨부터 쉬었지?

법적 구제제도 있는 건 아는데,
회사나 가족한테 알려질까 봐 혹은 사방에서 광고 전화 쏟아질까 봐
검색창만 켰다 껐다 반복하는 사람 진짜 많더라.

혼자 끙끙 앓다 보면 밤새 잠도 안 오는 거, 나도 다 알아.

[2/4]
근데 진짜 조심해야 하는 게 뭔지 알아?

사설 상담소나 포털에 '상담 신청'이라고 번호 한 번 남기잖아?
그 DB가 브로커들한테 넘어가서 하루 종일 대출 광고 전화에 시달리게 됨.

정작 내가 신뢰할 수 있는 변호사는 얼굴도 못 보고,
수임료나 조건도 제대로 비교 못 하고 덤터기 쓰는 경우도 수두룩해.

[3/4]
그래서 마이김변이 '010 번호 비공개' 스텔스 가명 시스템을 만든 거래.

내 진짜 번호는 단 1글자도 넘기지 않고,
변호사들 프로필이랑 이용 후기 직접 확인한 다음
마음에 드는 변호사 여러 명한테 동시에 안심 견적을 받아볼 수 있음.

진짜 010 번호 없이 가명으로만 소통하니까 번호를 먼저 알리지 않아도 돼.

[4/4]
더 이상 혼자 속으로 앓으면서 버티지 마.
회생/파산은 성실하게 살다 넘어진 사람들이 다시 일어서라고 법이 만들어둔 정당한 권리야.

📌 010 번호 노출 없이 안심 가명으로 변호사 견적 받는 법은 '첫 번째 댓글'에 남겨둘게!
너희는 빚 갚으면서 제일 힘들었던 순간이 언제였어? 댓글로 편하게 털어놔줘.`,
    hashtags: ["#개인회생", "#개인파산", "#채무조정", "#스레드", "#마이김변", "#스텔스보증"],
    specs: [
      { label: "타래 구성", value: "총 4단 연결 타래" },
      { label: "문체", value: "친구 대화형 반말 독백체 (~했어, ~알아, ~하더라)" },
      { label: "가독성", value: "1~2줄 단위 여백 줄바꿈 (모바일 완독률 최적화)" },
      { label: "CTA 장치", value: "본문 링크 배제 ➔ 첫 번째 댓글(First Comment) 링크 유도" }
    ]
  },
  facebook: {
    title: "🚨 기준금리 동결에도 웃지 못하는 자영업자·가장 여러분 🚨 (첫 댓글 링크 기법)",
    badge: "페이스북 4060 타겟 장문 피드 (도달률 최적화)",
    format: "장문 스토리텔링 피드 + 첫 댓글(First Comment) 링크 연동",
    summary: "페이스북 알고리즘의 외부 링크 도달률 페널티를 완벽히 회피하기 위해 본문 내 링크를 배제하고 첫 댓글로 안내하며, 4060 가장의 현실적인 고통에 깊이 공감합니다.",
    fullBody: `🚨 기준금리 동결 소식에도 웃지 못하는 자영업자·가장 여러분 🚨

매달 나가는 원리금 상환액에 가게 문을 열 때마다 가슴이 철렁 내려앉으시나요?
열심히 일해온 죄밖에 없는데, 늘어난 대출 이자에 잠 못 이루는 밤이 길어지고 계실 겁니다.

"법원에 회생 신청하면 주변에 다 소문나는 건 아닐까?"
"상담받으려다 대출 영업 사원들에게 번호 털리는 건 아닐까?"

가장으로서 짊어진 무게, 더 이상 혼자 속으로 삼키지 마십시오.
리걸테크 플랫폼 [마이김변]은 소상공인과 가장 여러분의 비밀을 철저히 지켜드립니다.

🔒 마이김변 3대 안심 약속:
1. 010 번호 비공개 — '스텔스 가명'으로 신분 철저 보호 (번호 비공개 상담)
2. 검증된 도산 사건 경험 변호사 직접 탐색 & 투명한 다중 견적
3. 복잡한 40종 서류, 스마트폰으로 말만 하면 30분 만에 원스톱 패키징

더 이상 혼자 속앓이하며 버티지 마시고, 합법적인 제도의 보호를 받으십시오.
주변에 비슷한 고민으로 밤잠 설치는 동료나 가족이 있다면 조용히 이 글을 전해주세요.

👉 안심 가명 상담 신청 링크는 '첫 번째 댓글'에 남겨두었습니다.
(페이스북 정책상 본문 링크 시 도달률이 제한되어 첫 댓글에 기재합니다)

※ 마이김변은 법률문서 작성 보조 및 변호사 선택을 지원하는 합법 리걸테크 플랫폼입니다.`,
    hashtags: ["#개인회생", "#개인파산", "#자영업자지원", "#소상공인대출", "#채무탕감", "#마이김변"],
    specs: [
      { label: "타겟 연령", value: "40대~60대 자영업자 및 가장" },
      { label: "도달률 최적화", value: "본문 외부 링크 배제 ➔ 첫 댓글 링크 기법 적용" },
      { label: "인게이지먼트", value: "가족/동료 비밀 보장 강조 및 조용한 공유 유도" }
    ]
  },
  tiktok: {
    title: "빚독촉 전화, 합법적으로 대응하는 법 (첫 0.3초 텍스트 오버레이 22초)",
    badge: "틱톡 15~22초 초스피드 스낵 비디오",
    format: "세로 1080x1920 초단기 숏폼 대본 (0.3초 텍스트 오버레이 + 1.2배속)",
    summary: "틱톡 무음 시청자 60%를 겨냥한 첫 0.3초 중앙 텍스트 오버레이와 22초 초고속 스낵 템포, 캡션 첫 줄 키워드 SEO를 적용했습니다.",
    fullBody: `[00~03초: 첫 0.3초 텍스트 오버레이 후킹]
(화면 연출: 영상 시작 0.3초 만에 화면 중앙 상단에 볼드 텍스트 팝업! 모르는 02, 070 부재중 전화 알림)
[화면 중앙 볼드 자막]: "아직도 빚 상담에 010 번호 남기나요? 절대 금지 ❌"
나레이션(1.2배속): "빚 독촉 전화 받기 무서워서 모르는 번호 다 씹는 사람 손? 🙋‍♂️"

[04~11초: 팩트 폭격 & 문제점]
(화면 연출: 빠른 컷 전환과 경고 효과음)
[자막]: "상담 신청에 번호 적었다가 광고 전화가 쏟아짐"
나레이션(1.2배속): "인터넷에 상담 신청한다고 번호 남기면 사방에서 광고 전화 오는 거 다들 아시죠?"

[12~18초: 마이김변 꿀팁]
(화면 연출: 마이김변 앱에서 '스텔스 가명' 토글 켜지며 변호사 견적 도착 화면)
[자막]: "010 번호 1도 없이 가명으로 변호사 견적 비교!"
나레이션(1.2배속): "이제 번호 숨기고 상담받으세요. 마이김변에서는 010 번호 대신 가명으로 전문 변호사 3명 견적이 싹 들어옵니다!"

[19~22초: 초고속 엔딩 CTA]
(화면 연출: 프로필 링크 손가락 가리키기 + 앱 다운로드 UI)
[자막]: "프로필 링크에서 010 번호 없이 안심 견적 받기 ➔"
나레이션(1.2배속): "프로필 링크에서 내 번호 안 밝히고 변호사 견적 바로 받아보세요!"`,
    visualPrompt: "Fast-paced TikTok vertical style, youthful aesthetic, smartphone closeups showing anonymous toggle switch turning green, vibrant lighting",
    hashtags: ["#개인회생", "#꿀팁", "#정보공유", "#빚탈출", "#스텔스보증", "#틱톡추천", "#마이김변"],
    specs: [
      { label: "영상 길이", value: "22초 (초단기 스낵 숏폼)" },
      { label: "무음 시청 대응", value: "0.3초 중앙 상단 볼드 텍스트 오버레이 필수" },
      { label: "SEO 캡션", value: "#개인회생 #빚탕감 #스텔스가명 #마이김변 #신용회복" }
    ]
  }
};

// --- MAIN COMPONENT ---
export default function MarketingAutopilotHub() {
  const [activeTab, setActiveTab] = useState('오늘의 오토파일럿');
  const [studioChannel, setStudioChannel] = useState('blog');
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

// --- TAB 2: Gemini 키 관리 ---
function TabKeyManagement() {
  // [PART 3-7] Gemini 키는 서버 환경변수(GEMINI_API_KEY)에만 둔다.
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
          키가 없거나 실패하면 저장된 프리셋 칼럼을 보여줍니다. 생성된 글은 게시 전에 변호사 광고 규정(결과 보장·근거 없는 수치 금지) 검토가 필요합니다.
        </p>
      </div>
    </div>
  );
}

// --- 똑생(ddok.life) 벤치마킹 8대 핵심 주제 프리셋 참조 ---
const DDOK_BLOG_PRESETS = DDOK_BLOG_PRESETS_DATA;


// --- 채널별 최적화 가이드 & 알고리즘 공략 데이터 ---
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
    badge: 'D.I.A.+ & 스마트블록 최적화',
    tone: '신뢰감 있는 전문가 칼럼 (합법 실무준칙 인용)',
    algorithmTrick: '서두 3문장 이내 Answer-First 요약 박스 + 3문단 주기 시각 인포그래픽 배치로 체류시간 3분 이상 확보',
    ctaDevice: '본문 중간/하단 010 번호 없는 스텔스 안심 가명 상담 배너',
    tags: ['Answer-First 3문장', 'H2/H3 구조화', '체류시간 1,500~2,500자', '오리지널 도표 3컷+']
  },
  shorts: {
    name: '유튜브 쇼츠',
    badge: 'E-A-Q-R 3초 훅 & 심리스 루프',
    tone: '긴박하고 직관적인 어조 ("안녕하세요" 인사말 절대 금지)',
    algorithmTrick: '끝 문장이 첫 문장으로 이어지는 심리스 루프(Seamless Loop) 대본으로 반복 시청 유도',
    ctaDevice: '영상 내 고정 댓글(Pinned Comment)로 안심 가명 상담 링크 안내',
    tags: ['0초 즉시 후킹 (인사말 금지)', '35초 완독률', '화면 중앙 키네틱 자막', '심리스 무한 루프']
  },
  card: {
    name: '인스타그램 카드뉴스',
    badge: '10장 황금 캐러셀 & 저장/공유 극대화',
    tone: '통증 공감 ➔ 명확한 1슬라이드 1메시지 ➔ 솔루션',
    algorithmTrick: '알고리즘 가중치가 가장 높은 저장(Save)과 친구 공유(Share)를 마지막 2개 슬라이드에서 강력 유도',
    ctaDevice: '프로필 링크(@mykimbyun) + 마지막 장 [저장] 안내 뱃지',
    tags: ['1장: 표지 훅', '2장: 통증 공감', '3~7장: 1장 1메시지', '10장: [저장] 유도 CTA']
  },
  threads: {
    name: '스레드 (Threads)',
    badge: '친구 대화형 반말 독백체 & 첫 댓글 링크',
    tone: '솔직하고 담백한 반말 구어체 ("~했어", "~인 거 있지?", "~하더라")',
    algorithmTrick: '모바일 스크롤에 맞춘 1~2줄 단위 여백 줄바꿈 + 본문 링크 배제로 도달률 페널티 회피',
    ctaDevice: '첫 번째 댓글(First Comment) 링크 유도 + 질문형 댓글 유도',
    tags: ['친구 대화 반말체', '1~2줄 여백 줄바꿈', '본문 링크 금지(첫 댓글)', '질문형 댓글 유도']
  },
  fb: {
    name: '페이스북',
    badge: '3050 가장·자영업자 공감 스토리',
    tone: '현실적 고통에 깊이 공감하는 진정성 있는 가장의 시선',
    algorithmTrick: '외부 링크 도달률 페널티 회피를 위해 본문 링크 배제 ➔ "신청 링크는 첫 댓글 확인" 기법 적용',
    ctaDevice: '첫 번째 댓글 링크 + 동료/가족 비밀 보장 강조',
    tags: ['3050 가장 공감', '본문 링크 배제 (첫 댓글)', '가족 비밀 보장', '조용한 공유(Share) 유도']
  },
  tiktok: {
    name: '틱톡 (TikTok)',
    badge: '첫 0.3초 텍스트 오버레이 & 초고속 스낵',
    tone: '1.2배속 빠른 템포 + 직관적인 사이다 톤앤매너',
    algorithmTrick: '60% 무음 시청자를 위한 0.3초 중앙 상단 볼드 텍스트 팝업 + 캡션 첫 줄 키워드 SEO',
    ctaDevice: '프로필 링크 손가락 제스처 + 초고속 엔딩',
    tags: ['0.3초 중앙 볼드 자막', '15~22초 1.2배속', '무음 시청 60% 대응', '검색 키워드 캡션']
  }
};

// --- TAB 3: 콘텐츠 스튜디오 ---
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
  // 이미지 소스 토글: 'pollinations' (AI 배경 생성) | 'gradient' (CSS 그라데이션 폴백)
  const [imageSource, setImageSource] = useState<ImageSourceType>('pollinations');
  // AI 배경 이미지 로딩 상태 추적 (이미지 ID → loaded/error)
  const [bgImageStatus, setBgImageStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  useEffect(() => {
    if (initialTab) {
      setGenTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    setTopic(activeBlogContent.topic);
    setTheme(activeBlogContent.theme);
    // 이전: [activeBlogContent] 의존 → 이미지 URL 주입 등 내부 갱신 때마다 입력 중인 주제가 초기화됨
  }, [activeBlogContent.topic, activeBlogContent.theme]);

  // Pollinations AI 배경 모드일 때 자동으로 URL 주입
  useEffect(() => {
    if (imageSource === 'pollinations' && activeBlogContent.blogImages.length > 0) {
      const hasUrls = activeBlogContent.blogImages.every(img => img.backgroundImageUrl);
      if (!hasUrls) {
        const injected = injectPollinationsUrls(activeBlogContent.blogImages);
        setActiveBlogContent({ ...activeBlogContent, blogImages: injected });
        // 로딩 상태 초기화
        const initStatus: Record<string, 'loading'> = {};
        injected.forEach(img => { initStatus[img.id] = 'loading'; });
        setBgImageStatus(initStatus);
      }
    }
  }, [imageSource, activeBlogContent.presetKey]);

  const handleImageSourceChange = (source: ImageSourceType) => {
    setImageSource(source);
    setBgImageStatus({});
    if (source === 'pollinations') {
      const injected = injectPollinationsUrls(activeBlogContent.blogImages);
      setActiveBlogContent({ ...activeBlogContent, blogImages: injected });
      const initStatus: Record<string, 'loading'> = {};
      injected.forEach(img => { initStatus[img.id] = 'loading'; });
      setBgImageStatus(initStatus);
      toast.success('AI 배경 이미지를 생성합니다. 이미지당 5~15초 소요됩니다.');
    } else {
      // 그라데이션 모드로 전환 — URL 제거
      const cleaned = activeBlogContent.blogImages.map(img => ({
        ...img,
        backgroundImageUrl: undefined,
        imageSource: 'gradient' as ImageSourceType,
      }));
      setActiveBlogContent({ ...activeBlogContent, blogImages: cleaned });
      toast.success('CSS 그라데이션 모드로 전환되었습니다.');
    }
  };

  const handleSelectPreset = (p: typeof DDOK_BLOG_PRESETS_DATA[0]) => {
    setTopic(p.topic);
    setTheme(p.theme);
    // Pollinations 모드면 URL 주입
    if (imageSource === 'pollinations') {
      const injected = injectPollinationsUrls(p.blogImages);
      setActiveBlogContent({ ...p, blogImages: injected });
      const initStatus: Record<string, 'loading'> = {};
      injected.forEach(img => { initStatus[img.id] = 'loading'; });
      setBgImageStatus(initStatus);
    } else {
      setActiveBlogContent(p);
    }
    toast.success(`'${p.label}' 주제의 블로그 4컷 이미지와 칼럼이 즉시 로드되었습니다.`);
  };

  const handleGenerateAllChannels = async () => {
    setIsGenerating(true);
    const toastId = toast.loading(`'${topic.slice(0, 18)}...' 블로그 칼럼과 이미지 4컷을 생성 중입니다...`);
    try {
      const generated = await generateBlogContentWithGemini(topic, theme);
      // Pollinations 모드면 생성된 콘텐츠에도 AI 배경 URL 주입
      if (imageSource === 'pollinations' && generated.blogImages.length > 0) {
        const injected = injectPollinationsUrls(generated.blogImages);
        setActiveBlogContent({ ...generated, blogImages: injected });
        const initStatus: Record<string, 'loading'> = {};
        injected.forEach(img => { initStatus[img.id] = 'loading'; });
        setBgImageStatus(initStatus);
      } else {
        setActiveBlogContent(generated);
      }
      // 서비스는 실패 시 예외 대신 프리셋을 돌려주므로 실제 생성 여부를 구분해 알린다
      if (generated.presetKey === 'custom-gemini') {
        toast.success(`'${topic.slice(0, 15)}...' 블로그 칼럼 초안을 만들었습니다. 게시 전 광고 규정을 확인하세요.`, { id: toastId });
      } else {
        toast.warning('AI 생성에 실패해 주제와 가장 가까운 저장 프리셋을 보여줍니다. 서버 키·2단계 인증을 확인하세요.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('생성 중 오류가 발생했습니다. 프리셋 모드로 복구합니다.', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * html2canvas CORS 해결: 외부 이미지(Pollinations 등)를 인라인 data URL로 변환
   * canvas.toBlob()의 SecurityError를 방지합니다.
   */
  const convertExternalImagesToDataUrls = async (container: HTMLElement): Promise<() => void> => {
    const imgs = container.querySelectorAll('img[src^="https://image.pollinations.ai"]');
    const originals: { img: HTMLImageElement; src: string }[] = [];

    for (const imgEl of Array.from(imgs) as HTMLImageElement[]) {
      if (!imgEl.complete || imgEl.naturalWidth === 0) continue;
      try {
        const response = await fetch(imgEl.src);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        originals.push({ img: imgEl, src: imgEl.src });
        imgEl.src = dataUrl;
      } catch {
        // CORS fetch 실패 시 원본 유지 — html2canvas의 allowTaint:true가 폴백
        console.warn('CORS proxy failed for image, using allowTaint fallback');
      }
    }

    // 복원 함수 반환
    return () => {
      originals.forEach(({ img, src }) => { img.src = src; });
    };
  };

  // 단일 요소 고해상도 PNG 다운로드 (3x scale - 한글 깨짐 0%)
  const downloadStudioElementAsPng = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      toast.error('다운로드할 이미지 요소를 찾을 수 없습니다.');
      return;
    }
    setExportingStudioId(elementId);
    try {
      // 외부 이미지를 data URL로 변환하여 CORS 문제 해결
      const restoreImages = await convertExternalImagesToDataUrls(el);
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        allowTaint: true,
      });
      restoreImages(); // 원본 URL 복원
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error('Blob 생성 실패');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${filename} 이미지가 다운로드되었습니다.`);
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setExportingStudioId(null);
    }
  };

  // 네이버 블로그 이미지 4컷 일괄 압축팩(ZIP) 다운로드
  const downloadAllStudioBlogImagesAsZip = async () => {
    if (!activeBlogContent.blogImages || activeBlogContent.blogImages.length === 0) return;
    setIsExportingStudioZip(true);
    const toastId = toast.loading('블로그 4컷 이미지를 고해상도로 렌더링 및 압축 중입니다...');
    try {
      const zip = new JSZip();
      for (const bImg of activeBlogContent.blogImages) {
        const el = document.getElementById(`studio-blog-visual-${bImg.id}`);
        if (el) {
          // 외부 이미지를 data URL로 변환
          const restoreImages = await convertExternalImagesToDataUrls(el);
          const canvas = await html2canvas(el, {
            scale: 3,
            useCORS: true,
            logging: false,
            backgroundColor: null,
            allowTaint: true,
          });
          restoreImages();
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
          if (blob) {
            zip.file(`[마이김변]_블로그_이미지_${bImg.order}_${bImg.tag.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`, blob);
          }
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.download = `[마이김변]_블로그_4컷_압축팩_${activeBlogContent.label || '맞춤'}.zip`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('블로그 4컷 이미지 압축팩이 성공적으로 다운로드되었습니다.', { id: toastId });
    } catch (err) {
      console.error('Failed to export zip:', err);
      toast.error('일괄 다운로드 중 오류가 발생했습니다.', { id: toastId });
    } finally {
      setIsExportingStudioZip(false);
    }
  };

  const currentGuide = CHANNEL_OPTIMIZATION_GUIDES[genTab] || CHANNEL_OPTIMIZATION_GUIDES.blog;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Inputs & Bridge Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">수동 생성 설정</h3>
              <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 font-medium">
                똑생 벤치마킹 탑재
              </span>
            </div>

            {/* 똑생 스타일 인기 주제 프리셋 버튼들 */}
            <div className="mb-4">
              <span className="block text-xs font-semibold text-slate-400 mb-2">🔥 인기 주제 퀵 프리셋 (클릭 시 4컷 이미지 즉시 반영)</span>
              <div className="flex flex-wrap gap-1.5">
                {DDOK_BLOG_PRESETS_DATA.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
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
                <label className="block text-sm text-slate-400 mb-1.5">타겟 주제 / 뉴스 팩트</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">강조 테마 (요일별 추천)</label>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none text-sm"
                >
                  <option value="서류혁신">월 = 서류혁신 (간편 서류 발급)</option>
                  <option value="안심탐색">화 = 안심탐색 (보안 상담)</option>
                  <option value="전문가보증">수 = 전문가보증 (안전 검토)</option>
                  <option value="높은호환성">목 = 높은호환성 (모든 기기 지원)</option>
                  <option value="비대면기술">금 = 비대면기술 (100% 비대면)</option>
                  <option value="면책완주">토 = 면책완주 (끝까지 동행)</option>
                  <option value="주말안심상담">일 = 주말안심상담 (주말 안심 상담)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={16} /> 3-Step 연결 브릿지 설계
            </h3>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">1</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Fact (뉴스)</span>
                  <p className="text-sm text-slate-300">{topic.slice(0, 40)}...</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">2</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Dilemma (채무자 딜레마)</span>
                  <p className="text-sm text-slate-300">사설 브로커 스팸이나 가족/직장 소문 두려움으로 해결을 망설임</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">3</div>
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex-1">
                  <span className="text-xs text-indigo-400 block mb-1">Solution (플랫폼 브릿지)</span>
                  <p className="text-sm text-indigo-100">'010 번호 없는 스텔스 가명'과 30분 서류 패키징으로 안전하게 상담 가능함 어필</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerateAllChannels}
              disabled={isGenerating}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px] cursor-pointer"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin text-white" /> : <UploadCloud size={18} />}
              {isGenerating ? '블로그 칼럼 생성 중...' : '블로그 칼럼 AI 생성'}
            </button>
          </div>
        </div>

        {/* Right Panel - Editor with Optimization Intelligence */}
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
                onClick={() => setGenTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap min-h-[44px] transition-colors cursor-pointer ${
                  genTab === t.id ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Dynamic Channel Optimization Intelligence Banner */}
          <div className="mb-4 bg-[#0B0F19] rounded-xl border border-indigo-500/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                <span className="text-sm font-bold text-white">{currentGuide.name}</span>
                <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                  {currentGuide.badge}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                🗣️ <span className="text-slate-300 font-medium">{currentGuide.tone}</span>
              </span>
            </div>
            
            <p className="text-xs text-slate-300 mb-2 leading-relaxed bg-[#111622] p-2.5 rounded-lg border border-slate-800">
              <span className="text-indigo-400 font-bold mr-1">알고리즘 공략:</span>
              {currentGuide.algorithmTrick}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {currentGuide.tags.map((tag, idx) => (
                  <span key={idx} className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    ✓ {tag}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Target size={12} /> {currentGuide.ctaDevice}
              </span>
            </div>
          </div>

          {/* Channel-Specific Interactive Editor Views */}
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* 1. Blog Editor */}
            {genTab === 'blog' && (
              <div className="flex-1 flex flex-col space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400">제목 (스마트블록 검색 키워드 최적화)</label>
                    <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                      {activeBlogContent.label ? `#${activeBlogContent.label} 프리셋` : 'AI 맞춤 생성'}
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={activeBlogContent.title}
                    onChange={(e) => setActiveBlogContent({ ...activeBlogContent, title: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Answer-First Box */}
                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Sparkles size={14} /> Answer-First 3문장 핵심 요약 (방문자 5초 이탈 방지)
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium">체류시간 3분+ 견인</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
                    {activeBlogContent.answerFirst.map((ans, idx) => (
                      <p key={idx}>{ans}</p>
                    ))}
                  </div>
                </div>

                {/* 4컷 본문 삽입 이미지 세트 실시간 프리뷰 & 다운로드 섹션 */}
                <div className="space-y-3 bg-[#0B0F19] p-4 rounded-xl border border-slate-800">
                  {/* 이미지 소스 토글 */}
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">이미지 소스:</span>
                    <button
                      onClick={() => handleImageSourceChange('pollinations')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[34px] whitespace-nowrap ${
                        imageSource === 'pollinations'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles size={13} />
                      🎨 AI 배경 (Pollinations)
                    </button>
                    <button
                      onClick={() => handleImageSourceChange('gradient')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[34px] whitespace-nowrap ${
                        imageSource === 'gradient'
                          ? 'bg-slate-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Layers size={13} />
                      🎯 그라데이션
                    </button>
                    {imageSource === 'pollinations' && (
                      <span className="text-[10px] text-emerald-400 ml-1">✨ FLUX 모델 기반 무료 AI 배경 자동 생성 (5~15초)</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ImageIcon size={15} className="text-indigo-400" />
                        네이버 블로그 본문 삽입용 4컷 이미지 세트 (D.I.A.+ & 100% 한글 벡터 선명도)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {imageSource === 'pollinations'
                          ? 'AI가 생성한 배경 위에 한글 텍스트를 합성합니다. 로딩 실패 시 자동으로 그라데이션 폴백됩니다.'
                          : '주제 맞춤 생성된 4컷 이미지입니다. 개별 PNG 또는 4컷 일괄 ZIP으로 즉시 다운로드할 수 있습니다.'}
                      </p>
                    </div>
                    <button
                      onClick={downloadAllStudioBlogImagesAsZip}
                      disabled={isExportingStudioZip}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[36px]"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '4컷 압축 중...' : '4컷 일괄 다운로드 (ZIP)'}
                    </button>
                  </div>

                  {/* 4 Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {activeBlogContent.blogImages.map((bImg) => (
                      <div key={bImg.id} className="bg-[#111622] rounded-xl border border-slate-800 p-3 flex flex-col justify-between space-y-2.5">
                        
                        {/* Visual Card (Rendered for html2canvas — AI 배경 + 한글 오버레이 합성) */}
                        <div 
                          id={`studio-blog-visual-${bImg.id}`}
                          className={`w-full aspect-[4/3] rounded-lg p-4 flex flex-col justify-between border border-slate-700/60 shadow-inner relative overflow-hidden ${
                            !(imageSource === 'pollinations' && bImg.backgroundImageUrl && bgImageStatus[bImg.id] !== 'error')
                              ? `bg-gradient-to-br ${bImg.previewGradient}`
                              : 'bg-slate-900'
                          }`}
                        >
                          {/* AI 배경 이미지 (Pollinations 모드) */}
                          {imageSource === 'pollinations' && bImg.backgroundImageUrl && bgImageStatus[bImg.id] !== 'error' && (
                            <>
                              <img
                                src={bImg.backgroundImageUrl}
                                alt=""
                                crossOrigin="anonymous"
                                className="absolute inset-0 w-full h-full object-cover"
                                onLoad={() => setBgImageStatus(prev => ({ ...prev, [bImg.id]: 'loaded' }))}
                                onError={() => {
                                  setBgImageStatus(prev => ({ ...prev, [bImg.id]: 'error' }));
                                  toast.error(`이미지 ${bImg.order}번 AI 배경 생성 실패 — 그라데이션 폴백`, { duration: 2000 });
                                }}
                              />
                              {/* 로딩 스켈레톤 */}
                              {bgImageStatus[bImg.id] === 'loading' && (
                                <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center z-20">
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                                    <span className="text-[10px] text-slate-400 font-medium">AI 배경 생성 중...</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {/* 다크 오버레이 — AI 배경 위 텍스트 가독성 보장 */}
                          <div className={`absolute inset-0 ${
                            imageSource === 'pollinations' && bImg.backgroundImageUrl && bgImageStatus[bImg.id] === 'loaded'
                              ? 'bg-gradient-to-t from-black/80 via-black/50 to-black/30'
                              : 'bg-gradient-to-t from-black/60 via-transparent to-transparent'
                          }`}></div>
                          <div className="flex justify-between items-start z-10">
                            <span className="px-2 py-0.5 rounded-md bg-black/60 text-indigo-300 text-[10px] font-bold border border-white/10">
                              {bImg.tag}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-medium border border-emerald-500/30">
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
                            <span className="text-emerald-400 font-bold drop-shadow-sm">마이김변 안심 리걸테크</span>
                            <span className="drop-shadow-sm">010 번호 비공개</span>
                          </div>
                        </div>

                        {/* Role & Prompt info */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-300">#{bImg.order}. {bImg.title}</span>
                          </div>
                          <div className="bg-[#0B0F19] rounded-lg p-2 border border-slate-800 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-slate-400 truncate flex-1">{bImg.prompt}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(bImg.prompt);
                                setCopiedPromptId(bImg.id);
                                toast.success('프롬프트가 복사되었습니다.');
                                setTimeout(() => setCopiedPromptId(null), 2000);
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedPromptId === bImg.id ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              {copiedPromptId === bImg.id ? '복사됨' : '복사'}
                            </button>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {/* AI 배경 재생성 버튼 (Pollinations 모드에서만 표시) */}
                          {imageSource === 'pollinations' && bImg.backgroundImageUrl && (
                            <button
                              onClick={() => {
                                // 새 랜덤 시드로 다른 배경 이미지 생성
                                const newSeed = Math.floor(Math.random() * 100000);
                                const currentUrl = new URL(bImg.backgroundImageUrl!);
                                currentUrl.searchParams.set('seed', String(newSeed));
                                const updatedImages = activeBlogContent.blogImages.map(img =>
                                  img.id === bImg.id ? { ...img, backgroundImageUrl: currentUrl.toString() } : img
                                );
                                setActiveBlogContent({ ...activeBlogContent, blogImages: updatedImages });
                                setBgImageStatus(prev => ({ ...prev, [bImg.id]: 'loading' }));
                                toast.success(`이미지 ${bImg.order}번 새 AI 배경을 생성합니다.`);
                              }}
                              className="py-1.5 px-3 bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[34px] whitespace-nowrap"
                            >
                              <RefreshCcw size={12} />
                              재생성
                            </button>
                          )}
                          {/* PNG 다운로드 */}
                          <button
                            onClick={() => downloadStudioElementAsPng(`studio-blog-visual-${bImg.id}`, `[마이김변]_블로그_${bImg.order}_${bImg.tag.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`)}
                            disabled={exportingStudioId === `studio-blog-visual-${bImg.id}`}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[34px]"
                          >
                            {exportingStudioId === `studio-blog-visual-${bImg.id}` ? (
                              <Loader2 size={12} className="animate-spin text-indigo-400" />
                            ) : (
                              <Download size={12} />
                            )}
                            {exportingStudioId === `studio-blog-visual-${bImg.id}` ? '렌더링 중...' : '고해상도 PNG 다운로드'}
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Body Column */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400">본문 칼럼 (D.I.A.+ 고품질 2,500자)</label>
                    <span className="text-[11px] text-slate-400">
                      공백 포함 {activeBlogContent.fullBody.length}자
                    </span>
                  </div>
                  <textarea 
                    className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                    value={activeBlogContent.fullBody}
                    onChange={(e) => setActiveBlogContent({ ...activeBlogContent, fullBody: e.target.value })}
                  />
                </div>
              </div>
            )}


            {/* 2. YouTube Shorts Editor — 장면별 비주얼 프리뷰 & PNG 내보내기 */}
            {genTab === 'shorts' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">영상 타이틀</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 text-sm"
                    defaultValue={CHANNEL_FULL_CONTENTS.shorts.title}
                  />
                </div>

                {/* 장면별 9:16 비주얼 프리뷰 카드 + PNG 내보내기 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Video size={14} className="text-red-400" />
                      쇼츠 장면별 비주얼 프리뷰 & CapCut 에셋 내보내기
                    </span>
                    <button
                      onClick={async () => {
                        const cueSheetData = CHANNEL_FULL_CONTENTS.shorts.cueSheet || [];
                        if (cueSheetData.length === 0) return;
                        setIsExportingStudioZip(true);
                        const toastId = toast.loading('쇼츠 4장면을 고해상도 PNG로 렌더링 중...');
                        try {
                          const zip = new JSZip();
                          for (let i = 0; i < cueSheetData.length; i++) {
                            const el = document.getElementById(`shorts-scene-${i}`);
                            if (el) {
                              const restoreImages = await convertExternalImagesToDataUrls(el);
                              const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null, allowTaint: true });
                              restoreImages();
                              const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
                              if (blob) zip.file(`[마이김변]_쇼츠_장면${i + 1}_${cueSheetData[i].time.replace(/[~]/g, '-')}.png`, blob);
                            }
                          }
                          const zipBlob = await zip.generateAsync({ type: 'blob' });
                          const url = URL.createObjectURL(zipBlob);
                          const link = document.createElement('a');
                          link.download = `[마이김변]_쇼츠_4장면_에셋팩.zip`;
                          link.href = url;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          toast.success('쇼츠 4장면 에셋팩이 다운로드되었습니다!', { id: toastId });
                        } catch (err) {
                          console.error(err);
                          toast.error('에셋팩 다운로드 중 오류가 발생했습니다.', { id: toastId });
                        } finally {
                          setIsExportingStudioZip(false);
                        }
                      }}
                      disabled={isExportingStudioZip}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[34px] whitespace-nowrap"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '렌더링 중...' : '4장면 ZIP 다운로드'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    각 장면을 9:16 세로 비율 PNG로 내보낸 후, CapCut에서 불러와 자막과 트랜지션을 추가하세요.
                  </p>
                </div>

                {/* 4장면 비주얼 카드 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(CHANNEL_FULL_CONTENTS.shorts.cueSheet || []).map((cue, idx) => {
                    const scenePrompts = [
                      'dark dramatic close-up of smartphone screen showing 30 missed calls notifications, red alert glow, cinematic tension, no text, no watermark',
                      'silhouette of worried person at computer portal search screen with spam notification bubbles floating, moody blue lighting, no text, no watermark',
                      'futuristic privacy shield UI hologram glowing green around smartphone, 3 lawyer profile cards floating, dark professional background, no text, no watermark',
                      'glowing pinned comment icon with pulsing arrow animation, seamless loop visual bridge, dark gradient background with subtle light trails, no text, no watermark'
                    ];
                    const bgUrl = generatePollinationsUrl(scenePrompts[idx] || scenePrompts[0], { width: 608, height: 1080, seed: 7700 + idx, nologo: true });
                    const sceneLabels = ['🎬 후킹', '😰 공감', '🛡️ 솔루션', '🔄 CTA 루프'];
                    const sceneColors = ['from-red-900/80', 'from-blue-900/80', 'from-emerald-900/80', 'from-purple-900/80'];
                    
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        {/* 9:16 비주얼 카드 */}
                        <div
                          id={`shorts-scene-${idx}`}
                          className="w-full aspect-[9/16] rounded-xl relative overflow-hidden bg-slate-900 flex flex-col justify-between p-3 border border-slate-700/60"
                        >
                          <img
                            src={bgUrl}
                            alt=""
                            crossOrigin="anonymous"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className={`absolute inset-0 bg-gradient-to-t ${sceneColors[idx]} via-black/60 to-black/40`}></div>
                          
                          {/* 상단 뱃지 */}
                          <div className="flex justify-between items-start z-10">
                            <span className="px-2 py-0.5 rounded-lg bg-red-600/80 text-white text-[9px] font-bold border border-red-400/30">
                              {sceneLabels[idx]}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-slate-300 text-[8px] font-mono">
                              {cue.time}
                            </span>
                          </div>

                          {/* 연출 지시 */}
                          <div className="z-10 text-[8px] text-slate-300/80 bg-black/40 rounded-lg px-2 py-1 border border-white/5">
                            🎬 {cue.action.length > 40 ? cue.action.slice(0, 40) + '...' : cue.action}
                          </div>

                          {/* 메인 자막 텍스트 — 키네틱 스타일 */}
                          <div className="z-10 flex-1 flex items-center justify-center px-1">
                            <p className="text-white text-[11px] sm:text-xs font-extrabold text-center leading-snug drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                              "{cue.script.length > 60 ? cue.script.slice(0, 60) + '...' : cue.script}"
                            </p>
                          </div>

                          {/* 하단 브랜드 */}
                          <div className="z-10 flex justify-between items-center text-[8px] text-slate-300 border-t border-white/10 pt-1">
                            <span className="text-emerald-400 font-bold drop-shadow-sm">마이김변</span>
                            <span className="drop-shadow-sm">YT Shorts</span>
                          </div>
                        </div>

                        {/* 장면 액션 버튼 */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cue.script);
                              toast.success(`장면 ${idx + 1} 나레이션 복사됨`);
                            }}
                            className="flex-1 py-1 bg-[#0B0F19] hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                          >
                            <Copy size={10} />
                            자막 복사
                          </button>
                          <button
                            onClick={async () => {
                              const el = document.getElementById(`shorts-scene-${idx}`);
                              if (!el) return;
                              setExportingStudioId(`shorts-scene-${idx}`);
                              try {
                                const restoreImages = await convertExternalImagesToDataUrls(el);
                                const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null, allowTaint: true });
                                restoreImages();
                                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
                                if (!blob) throw new Error('Blob fail');
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.download = `[마이김변]_쇼츠_장면${idx + 1}.png`;
                                link.href = url;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                toast.success(`장면 ${idx + 1} PNG 다운로드 완료`);
                              } catch { toast.error('다운로드 실패'); }
                              finally { setExportingStudioId(null); }
                            }}
                            className="py-1 px-2 bg-[#0B0F19] hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                          >
                            {exportingStudioId === `shorts-scene-${idx}` ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CapCut 워크플로우 가이드 */}
                <div className="bg-gradient-to-r from-[#0B0F19] to-[#111827] rounded-xl p-3 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    CapCut 5분 제작 워크플로우
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { step: '①', title: '에셋 가져오기', desc: '4장면 ZIP 다운로드 → CapCut에서 열기' },
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

                {/* Seamless Loop & Pinned Comment Guide */}
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-rose-300 block mb-0.5">🔄 심리스 무한 루프 연결:</span>
                    <span className="text-slate-300 text-[11px]">영상 마지막 문장 ➔ 첫 문장("매달 이자 내고 통장 잔고 0원 찍히나요?")으로 100%+ 완독 유도</span>
                  </div>
                  <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 whitespace-nowrap font-bold">
                    루프 연결됨
                  </span>
                </div>
              </div>
            )}

            {/* 3. Instagram Card News Editor */}
            {genTab === 'card' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">📑 10장 황금 캐러셀 슬라이드 선택</span>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    1슬라이드 1메시지 원칙
                  </span>
                </div>

                {/* Slide Switcher */}
                <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                  {(CHANNEL_FULL_CONTENTS.cardnews.slides || []).map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlide(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedSlide === idx 
                          ? 'bg-amber-600 text-white font-bold shadow-sm' 
                          : 'bg-[#0B0F19] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {s.page}장 {idx === 0 ? '(표지)' : idx === 9 ? '(CTA)' : ''}
                    </button>
                  ))}
                </div>

                {/* Active Slide Details & Live 1:1 Preview */}
                {CHANNEL_FULL_CONTENTS.cardnews.slides && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {/* Left: 1:1 Card Preview (Captured by html2canvas) */}
                    <div className="flex flex-col space-y-2">
                      <div 
                        id="studio-active-card-slide"
                        className="w-full aspect-square rounded-2xl p-5 bg-gradient-to-br from-[#0B1120] via-[#1E1B4B] to-[#0B0F19] border border-amber-500/30 flex flex-col justify-between relative overflow-hidden shadow-xl"
                      >
                        <div className="flex justify-between items-center z-10">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-amber-300 tracking-wider">마이김변 인스타 캐러셀</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold backdrop-blur-sm border border-white/10">
                            {selectedSlide + 1} / 10
                          </span>
                        </div>

                        <div className="z-10 my-auto space-y-2 text-center sm:text-left">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                            {selectedSlide === 0 ? '🔥 핵심 쟁점' : selectedSlide === 1 ? '⚠️ 현실 통증' : selectedSlide === 9 ? '🛡️ 안심 신청' : '💡 솔루션'}
                          </span>
                          <h4 className="text-base sm:text-lg font-extrabold text-white leading-snug drop-shadow-md whitespace-pre-line">
                            {CHANNEL_FULL_CONTENTS.cardnews.slides[selectedSlide]?.headline}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-medium drop-shadow-sm">
                            {CHANNEL_FULL_CONTENTS.cardnews.slides[selectedSlide]?.subtext}
                          </p>
                        </div>

                        <div className="z-10 pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck size={12} /> 010 번호 비공개
                          </span>
                          <span className="text-amber-300 font-medium">
                            {selectedSlide === 9 ? '📌 프로필 링크에서 확인' : '옆으로 넘기기 ➔'}
                          </span>
                        </div>

                        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-600/15 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -left-10 -top-10 w-32 h-32 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
                      </div>

                      <button
                        onClick={async () => {
                          const el = document.getElementById('studio-active-card-slide');
                          if (!el) return;
                          const toastId = toast.loading(`${selectedSlide + 1}장 고해상도 PNG 렌더링 중...`);
                          try {
                            const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null, allowTaint: true });
                            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
                            if (!blob) throw new Error('Blob 생성 실패');
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.download = `[마이김변]_카드뉴스_${(selectedSlide + 1).toString().padStart(2, '0')}장.png`;
                            link.href = url;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            toast.success(`${selectedSlide + 1}장 고해상도 PNG가 다운로드되었습니다.`, { id: toastId });
                          } catch (err) {
                            console.error(err);
                            toast.error('다운로드 중 오류가 발생했습니다.', { id: toastId });
                          }
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px]"
                      >
                        <Download size={13} />
                        현재 슬라이드 PNG 즉시 다운로드
                      </button>
                    </div>

                    {/* Right: Editable Details */}
                    <div className="bg-[#0B0F19] rounded-xl border border-slate-700 p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                            헤드라인 (슬라이드 {selectedSlide + 1} / 10)
                          </label>
                          <input 
                            type="text" 
                            value={CHANNEL_FULL_CONTENTS.cardnews.slides[selectedSlide]?.headline}
                            readOnly
                            className="w-full bg-[#111622] border border-slate-700 rounded-lg px-3 py-2 text-white font-medium text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-semibold">서브 텍스트 & 전달 메시지</label>
                          <textarea 
                            value={CHANNEL_FULL_CONTENTS.cardnews.slides[selectedSlide]?.subtext}
                            readOnly
                            className="w-full bg-[#111622] border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-xs focus:outline-none resize-none h-20"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">비주얼 연출 프롬프트</label>
                        <p className="text-[11px] text-slate-400 bg-[#111622] p-2.5 rounded-lg border border-slate-800">
                          {CHANNEL_FULL_CONTENTS.cardnews.slides[selectedSlide]?.visualDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Threads Editor */}
            {genTab === 'threads' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">
                    💬 스레드 4단 타래 본문 (친구 대화형 반말체)
                  </label>
                  <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    1~2줄 여백 줄바꿈 적용
                  </span>
                </div>

                <textarea 
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                  defaultValue={CHANNEL_FULL_CONTENTS.threads.fullBody}
                />

                {/* First Comment Trick Field */}
                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3">
                  <span className="text-xs font-bold text-indigo-300 block mb-1">
                    📌 첫 번째 댓글(First Comment) 링크 유도 (도달률 페널티 회피)
                  </span>
                  <input 
                    type="text"
                    readOnly
                    value="010 번호 유출 없는 안심 가명 변호사 견적 비교 ➔ https://mykim.kr (번호 비공개 상담)"
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* 5. Facebook Editor */}
            {genTab === 'fb' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">
                    👥 페이스북 장문 피드 (3050 가장·자영업자 공감 스토리)
                  </label>
                  <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    본문 링크 배제 ➔ 첫 댓글 링크
                  </span>
                </div>

                <textarea 
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none text-sm leading-relaxed min-h-[220px]"
                  defaultValue={CHANNEL_FULL_CONTENTS.facebook.fullBody}
                />

                <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-3">
                  <span className="text-xs font-bold text-blue-300 block mb-1">
                    💬 첫 번째 댓글 자동 등록 (알고리즘 페널티 방지)
                  </span>
                  <input 
                    type="text"
                    readOnly
                    value="👉 010 번호 노출 없는 안심 가명 변호사 상담 신청: https://mykim.kr (가족/직장 비공개 진행)"
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* 6. TikTok Editor — 장면별 비주얼 프리뷰 & PNG 내보내기 */}
            {genTab === 'tiktok' && (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-400 mb-1">
                      ⚡ 첫 0.3초 화면 중앙 볼드 자막 (무음 시청 60% 대응)
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-[#0B0F19] border border-cyan-500/50 rounded-xl px-4 py-2 text-white font-bold focus:outline-none text-sm"
                      defaultValue="아직도 빚 상담에 010 번호 남기나요? 절대 금지 ❌"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      🔍 캡션 첫 줄 키워드 SEO (검색 최적화)
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2 text-slate-300 focus:outline-none text-sm"
                      defaultValue="#개인회생 #빚탕감 #스텔스가명 #마이김변 #신용회복"
                    />
                  </div>
                </div>

                {/* 틱톡 장면별 비주얼 프리뷰 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Video size={14} className="text-cyan-400" />
                      틱톡 장면별 비주얼 프리뷰 & CapCut 에셋 내보내기
                    </span>
                    <button
                      onClick={async () => {
                        setIsExportingStudioZip(true);
                        const toastId = toast.loading('틱톡 4장면을 고해상도 PNG로 렌더링 중...');
                        try {
                          const zip = new JSZip();
                          for (let i = 0; i < 4; i++) {
                            const el = document.getElementById(`tiktok-scene-${i}`);
                            if (el) {
                              const restoreImages = await convertExternalImagesToDataUrls(el);
                              const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null, allowTaint: true });
                              restoreImages();
                              const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
                              if (blob) zip.file(`[마이김변]_틱톡_장면${i + 1}.png`, blob);
                            }
                          }
                          const zipBlob = await zip.generateAsync({ type: 'blob' });
                          const url = URL.createObjectURL(zipBlob);
                          const link = document.createElement('a');
                          link.download = `[마이김변]_틱톡_4장면_에셋팩.zip`;
                          link.href = url;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          toast.success('틱톡 4장면 에셋팩이 다운로드되었습니다!', { id: toastId });
                        } catch (err) {
                          console.error(err);
                          toast.error('에셋팩 다운로드 중 오류가 발생했습니다.', { id: toastId });
                        } finally {
                          setIsExportingStudioZip(false);
                        }
                      }}
                      disabled={isExportingStudioZip}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer min-h-[34px] whitespace-nowrap"
                    >
                      {isExportingStudioZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {isExportingStudioZip ? '렌더링 중...' : '4장면 ZIP 다운로드'}
                    </button>
                  </div>
                </div>

                {/* 틱톡 4장면 비주얼 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { time: '00~03초', label: '⚡ 0.3초 훅', script: '아직도 빚 상담에 010 번호 남기나요? 절대 금지 ❌', action: '중앙 볼드 텍스트 팝업 + 빨간 X 모션', prompt: 'dramatic red X mark over phone number input field, dark moody smartphone screen, urgent warning vibe, no text, no watermark', color: 'from-cyan-900/80' },
                    { time: '04~11초', label: '😱 충격', script: '한 번 남긴 번호로 20곳 넘게 영업전화가 옵니다. 상담 한번 받으려다 스팸 지옥에 빠지는 거죠.', action: '전화기 스팸 알림 쏟아지는 모션 1.2배속', prompt: 'smartphone screen overwhelmed with spam call notifications flooding in, dark dramatic lighting, anxiety inducing visual, no text, no watermark', color: 'from-rose-900/80' },
                    { time: '12~18초', label: '🛡️ 해결', script: '마이김변은 010 번호 대신 가명으로 변호사 3명에게 동시 견적을 받습니다. 번호 비공개.', action: '스텔스 가명 쉴드 ON + 변호사 프로필 3장', prompt: 'futuristic green privacy shield protecting smartphone, three professional lawyer cards floating nearby, clean dark UI aesthetic, no text, no watermark', color: 'from-emerald-900/80' },
                    { time: '19~22초', label: '👆 CTA', script: '프로필 링크에서 지금 바로 확인하세요!', action: '프로필 링크 손가락 제스처 + 초고속 엔딩', prompt: 'finger tapping glowing profile link button on phone screen, sparkle effect, fast dynamic energy, dark background, no text, no watermark', color: 'from-purple-900/80' },
                  ].map((scene, idx) => {
                    const bgUrl = generatePollinationsUrl(scene.prompt, { width: 608, height: 1080, seed: 8800 + idx, nologo: true });
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        <div
                          id={`tiktok-scene-${idx}`}
                          className="w-full aspect-[9/16] rounded-xl relative overflow-hidden bg-slate-900 flex flex-col justify-between p-3 border border-cyan-500/20"
                        >
                          <img src={bgUrl} alt="" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <div className={`absolute inset-0 bg-gradient-to-t ${scene.color} via-black/60 to-black/40`}></div>
                          <div className="flex justify-between items-start z-10">
                            <span className="px-2 py-0.5 rounded-lg bg-cyan-600/80 text-white text-[9px] font-bold border border-cyan-400/30">{scene.label}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-slate-300 text-[8px] font-mono">{scene.time}</span>
                          </div>
                          <div className="z-10 text-[8px] text-slate-300/80 bg-black/40 rounded-lg px-2 py-1 border border-white/5">
                            🎬 {scene.action.length > 35 ? scene.action.slice(0, 35) + '...' : scene.action}
                          </div>
                          <div className="z-10 flex-1 flex items-center justify-center px-1">
                            <p className="text-white text-[11px] sm:text-xs font-extrabold text-center leading-snug drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                              "{scene.script.length > 50 ? scene.script.slice(0, 50) + '...' : scene.script}"
                            </p>
                          </div>
                          <div className="z-10 flex justify-between items-center text-[8px] text-slate-300 border-t border-white/10 pt-1">
                            <span className="text-cyan-400 font-bold drop-shadow-sm">마이김변</span>
                            <span className="drop-shadow-sm">TikTok</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { navigator.clipboard.writeText(scene.script); toast.success(`장면 ${idx + 1} 자막 복사됨`); }}
                            className="flex-1 py-1 bg-[#0B0F19] hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                          >
                            <Copy size={10} /> 자막 복사
                          </button>
                          <button
                            onClick={async () => {
                              const el = document.getElementById(`tiktok-scene-${idx}`);
                              if (!el) return;
                              setExportingStudioId(`tiktok-scene-${idx}`);
                              try {
                                const restoreImages = await convertExternalImagesToDataUrls(el);
                                const canvas = await html2canvas(el, { scale: 3, useCORS: true, logging: false, backgroundColor: null, allowTaint: true });
                                restoreImages();
                                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
                                if (!blob) throw new Error('fail');
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.download = `[마이김변]_틱톡_장면${idx + 1}.png`;
                                link.href = url;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                toast.success(`장면 ${idx + 1} PNG 다운로드 완료`);
                              } catch { toast.error('다운로드 실패'); }
                              finally { setExportingStudioId(null); }
                            }}
                            className="py-1 px-2 bg-[#0B0F19] hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-800"
                          >
                            {exportingStudioId === `tiktok-scene-${idx}` ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CapCut 가이드 */}
                <div className="bg-gradient-to-r from-[#0B0F19] to-[#0B1520] rounded-xl p-3 border border-cyan-500/20 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-400" />
                    CapCut 5분 제작 워크플로우 (1.2배속 적용)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { step: '①', title: 'PNG 가져오기', desc: '4장면 ZIP → CapCut에서 열기' },
                      { step: '②', title: '타임라인 배치', desc: '초수별 배치 (3+8+7+4=22초)' },
                      { step: '③', title: '자막+1.2배속', desc: '자막 붙여넣기 + 재생속도 1.2x' },
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

          </div>
          
          {/* Action Buttons */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button 
              onClick={() => {
                const text = genTab === 'blog' ? CHANNEL_FULL_CONTENTS.blog.fullBody
                  : genTab === 'shorts' ? CHANNEL_FULL_CONTENTS.shorts.fullBody
                  : genTab === 'threads' ? CHANNEL_FULL_CONTENTS.threads.fullBody
                  : genTab === 'fb' ? CHANNEL_FULL_CONTENTS.facebook.fullBody
                  : genTab === 'tiktok' ? CHANNEL_FULL_CONTENTS.tiktok.fullBody
                  : '카드뉴스 10장 캐러셀';
                navigator.clipboard?.writeText(text);
                toast.success(`${currentGuide.name} 최적화 콘텐츠가 클립보드에 복사되었습니다.`);
              }}
              className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs hover:bg-slate-700 min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy size={14} /> 최적화 원문 복사
            </button>

            {/* 이전: 아무 동작 없이 '임시 저장 완료'·'배포 예약됨' 토스트만 띄우던 버튼 → 제거.
                저장·승인·게시 기록은 '오늘의 오토파일럿' 탭에서 한다. */}
            <p className="text-xs text-slate-400">프리셋 샘플은 저장·게시되지 않습니다. 저장·승인·게시는 "오늘의 오토파일럿" 탭에서 하세요.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

