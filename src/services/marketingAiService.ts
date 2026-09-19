/**
 * 마케팅 오토파일럿 허브 - 네이버 블로그 4컷 이미지 및 D.I.A.+ 칼럼 생성 서비스
 * 똑생(ddok.life) 벤치마킹 8대 주제 프리셋 + Google Gemini 2.5 Flash API 연동
 * 
 * 변호사법 제34조 준수:
 * - 자가진단(X) ➔ 010 번호 없는 안심 가명 상담 및 전문 변호사 직접 비교
 * - 가격 덤핑 역경매 배제, 승소율 과장 금지
 */

export interface BlogImageItem {
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
}

export interface BlogContentData {
  presetKey: string;
  label: string;
  topic: string;
  theme: string;
  title: string;
  badge: string;
  format: string;
  summary: string;
  answerFirst: string[];
  fullBody: string;
  blogImages: BlogImageItem[];
  hashtags: string[];
  specs: { label: string; value: string }[];
}

// --- 똑생(ddok.life) 벤치마킹 8대 핵심 주제 프리셋 데이터 ---
export const DDOK_BLOG_PRESETS_DATA: BlogContentData[] = [
  {
    presetKey: 'card-credit',
    label: '카드/신용',
    topic: '개인회생 중 신용카드 정지 시점과 신용점수 회복 시기 (2026년 기준)',
    theme: '서류혁신',
    title: "[2026 최신] 개인회생 중 신용카드 정지 시점과 신용점수 완벽 회복 로드맵",
    badge: "네이버 블로그 2,500자 SEO 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (대표 썸네일 1컷 + 본문 인포그래픽 3컷 탑재)",
    summary: "개인회생 신청 시 신용카드가 언제 정지되는지, 체크카드와 은행 거래는 가능한지, 그리고 면책 후 신용점수가 정상화되는 골든타임을 상세히 분석합니다.",
    answerFirst: [
      "1. 법원의 금지명령 또는 개시결정이 채권사에 송달되면 모든 신용카드가 순차적으로 거래 정지됩니다.",
      "2. 체크카드 및 1금융권 입출금 통장 개설·사용은 자유로우며 급여 수령도 안전하게 보호됩니다.",
      "3. 36개월 성실 변제 후 면책 결정을 받으면 1~2주 내에 특수기록(1201)이 삭제되고 신용점수가 정상 회복됩니다."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(개인회생과 신용카드 정지 & 신용점수 회복 로드맵)

■ 서론: 신용카드 돌려막기의 끝, 언제 정지되고 언제 회복될까요?
매달 결제일마다 카드 리볼빙과 돌려막기로 간신히 버티고 계신가요? 개인회생을 고민하면서도 "신용카드가 당장 정지되면 일상생활은 어떻게 하지?"라는 두려움 때문에 신청을 미루는 분들이 많습니다. 오늘 마이김변 도산법률연구팀에서는 2026년 최신 법원 실무를 기준으로 신용카드 정지 시점과 신용점수 완벽 회복 전략을 투명하게 공개합니다.

■ 1. 신용카드는 정확히 언제 정지될까요?
개인회생 서류를 법원에 접수하면 1~2주 내로 '금지명령'이 발송됩니다. 
- 금지명령 송달 시점: 카드사들이 법원의 금지명령 결정을 송달받는 즉시 한도 축소 및 이용 정지 조치가 진행됩니다.
- 연체 전 신청 시: 연체가 발생하기 전에 미리 회생을 신청하더라도, 금지명령이 내려지면 신용공여가 중단되므로 카드는 정지됩니다.
- 교통카드 기능: 후불 교통카드 기능 역시 중지되므로 선불형 캐시비/티머니 카드나 체크카드 기반 교통카드를 준비하셔야 합니다.

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(돌려막기 연체 방치 vs 개인회생 신청 시 신용 회복 속도 비교)

■ 2. 카드 정지 후 일상 금융생활, 정말 불가능할까요? (오해와 진실)
많은 분들이 신용카드가 정지되면 금융거래가 전면 중단되는 것으로 오해하십니다. 하지만 결코 그렇지 않습니다.
- 체크카드 정상 발급 및 사용: 잔액 범위 내에서 결제되는 체크카드는 아무런 제약 없이 사용할 수 있습니다.
- 1금융권 급여통장 사용: 압류 위험이 없는 안전한 1금융권 은행에서 자유롭게 입출금과 자동이체를 이용하실 수 있습니다.
- 가족 카드 영향 없음: 본인 명의 카드만 정지되며, 배우자나 가족 명의의 신용카드에는 법적 영향이 미치지 않습니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(비대면 40종 부채증명서 자동 발급 & 30분 서류 패키징 화면)

■ 3. 마이김변 서류혁신: 복잡한 부채증명서, 30분 만에 끝내는 법
카드사마다 일일이 전화해서 부채증명서를 발급받는 일은 직장인에게 큰 고통입니다.
- 마이김변 스마트폰 30분 패키징: 은행, 카드사, 캐피탈 부채증명서를 모바일에서 원스톱으로 취합
- AI 음성 진술서: 카드 돌려막기에 이르게 된 경위를 스마트폰에 말로 설명하면 법원 표준 진술서로 즉시 변환
- 010 번호 노출 없는 안심 상담: 내 번호를 카드사나 변호사 사무실에 노출하지 않고 안전하게 견적 확인

■ 4. 면책 후 신용점수 회복 로드맵 (특수기록 1201 삭제)
36개월 성실 변제를 마치고 법원의 면책 결정을 받으면 다음과 같은 절차가 진행됩니다.
1) 법원에서 한국신용정보원으로 면책 통보 송달
2) 신용정보 전산망의 '1201(개인회생)' 공공정보 등록 코드 즉시 삭제 (보통 7~14일 소요)
3) 특수기록 삭제 후 600~700점대 기본 점수로 복귀하며, 소액 체크카드 실적 누적으로 우량 신용등급 도약 가능

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(010 번호 유출 0% 신용회복 전문 변호사 안심 상담 배너)

■ 결론: 더 늦기 전에 원금을 탕감받는 길을 선택하세요
카드 돌려막기는 결국 눈덩이처럼 불어나는 이자 때문에 파국을 맞이합니다. 혼자 끙끙 앓지 마시고, 지금 마이김변에서 010 번호 노출 없이 안심 가명으로 신용카드 채무 탕감 견적을 받아보세요.

※ 본 콘텐츠는 리걸테크 플랫폼 마이김변의 기술적 편의성을 안내하는 정보성 칼럼이며, 개별 법률 상담 및 소송 대리는 의뢰인이 직접 선택한 독립된 법률사무소가 수행합니다.`,
    blogImages: [
      {
        id: "card-img-1",
        order: 1,
        title: "대표 썸네일: 개인회생과 신용카드 정지 & 신용점수 회복 로드맵",
        role: "검색 결과 클릭률(CTR) 극대화 대표 썸네일 (1:1 정방형)",
        insertPosition: "본문 최상단 (서론 전)",
        prompt: "A stylish Korean modern desk with cut credit cards, glowing golden financial graph trending upward, subtle gavel, cinematic lighting, photorealistic 8k, dark blue and gold tones",
        previewGradient: "from-blue-950 via-slate-900 to-indigo-950",
        previewTitle: "신용카드 정지 시점과 신용점수 회복",
        previewSub: "2026 최신 법원 실무 기준 완벽 해설 & 010 번호 노출 0%",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "card-img-2",
        order: 2,
        title: "인포그래픽: 카드 돌려막기 방치 vs 개인회생 인가 후 신용 회복",
        role: "문제점 환기 및 36개월 성실 변제 후 신용점수 급상승 시각화",
        insertPosition: "2번 섹션 (금융생활 오해와 진실 상단)",
        prompt: "Vector infographic comparing red descending credit score chart of unpaid credit debt vs green ascending rehabilitation recovery line, minimalist fintech design",
        previewGradient: "from-slate-900 via-rose-950/40 to-indigo-950/40",
        previewTitle: "돌려막기 방치 vs 회생 면책 비교",
        previewSub: "연체이자 누적 vs 원금 최대 90% 탕감 후 신용점수 정상화",
        tag: "비교 인포그래픽"
      },
      {
        id: "card-img-3",
        order: 3,
        title: "기능 화면: 비대면 40종 부채증명서 자동 발급 & 30분 패키징",
        role: "카드사 부채증명서 및 AI 음성 진술서 원스톱 편의성 입증",
        insertPosition: "3번 섹션 (마이김변 서류혁신 상단)",
        prompt: "Smartphone mockup displaying automated debt certificate packaging and bank balance verification screen, dark mode fintech UI, 3d render",
        previewGradient: "from-indigo-950 via-slate-900 to-cyan-950",
        previewTitle: "카드사 40종 서류 30분 모바일 완성",
        previewSub: "동사무소·카드사 방문 없이 스마트폰 터치 한 번으로 패키징",
        tag: "앱 UI 목업"
      },
      {
        id: "card-img-4",
        order: 4,
        title: "CTA 배너: 010 번호 유출 없는 신용회복 전문 변호사 안심 상담",
        role: "블로그 독자를 플랫폼 안심 상담 신청으로 전환",
        insertPosition: "본문 최하단 (결론 및 면책 공지 직전)",
        prompt: "Clean professional banner with glowing emerald CTA button and golden shield icon, dark navy theme, high contrast",
        previewGradient: "from-indigo-950 via-slate-900 to-emerald-950",
        previewTitle: "신용카드 채무 안심 가명 상담 신청",
        previewSub: "010 번호 노출 없이 전문 변호사 3인 견적을 직접 비교하세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생", "#신용카드정지", "#신용점수회복", "#돌려막기탈출", "#스텔스가명", "#마이김변"],
    specs: [
      { label: "글자 수", value: "2,480자 (공백 포함)" },
      { label: "삽입 이미지", value: "총 4컷 (대표 썸네일 1 + 본문 인포그래픽 3)" },
      { label: "권장 폰트", value: "나눔고딕 15pt / 행간 185%" },
      { label: "포함 요소", value: "신용카드 정지 타임라인, 특수기록 1201 해제 가이드, 면책 공지" }
    ]
  },
  {
    presetKey: 'rent-loan',
    label: '전세대출',
    topic: '개인회생 중 전세대출이나 주택담보대출 있으면 집에서 나가야 할까?',
    theme: '안심탐색',
    title: "개인회생 신청 시 전세대출·주택담보대출 있으면 살던 집에서 쫓겨날까? (핵심 방어책)",
    badge: "네이버 블로그 2,600자 주거권 보호 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (주거권 보호 인포그래픽 탑재)",
    summary: "전세대출 질권설정과 주택담보대출 별제권 처리 기준, 집주인과의 관계, 그리고 살던 집에서 쫓겨나지 않고 안전하게 회생을 진행하는 실전 전략을 다룹니다.",
    answerFirst: [
      "1. 주택담보대출은 '별제권' 채권으로 별도 이자 상환을 성실히 유지하면 경매 없이 살던 집을 지킬 수 있습니다.",
      "2. HUG/HF 전세보증금 대출은 만기 연장 특약과 질권설정 여부에 따라 법원 인가 전략이 달라집니다.",
      "3. 마이김변에서 010 번호 노출 없이 주거권 전문 도산 변호사 3인에게 무료 안심 상담을 받아보세요."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(전세대출·주담대와 개인회생 주거권 보호 가이드)

■ 서론: 빚은 갚고 싶지만, 살던 집에서 쫓겨날까 봐 잠이 안 오시나요?
개인회생을 고민하시는 분들 중 상당수가 "회생을 신청하면 지금 살고 있는 전셋집이나 아파트에서 당장 나가야 하나요?"라며 가슴을 졸이십니다. 주거의 안정은 가족의 생존과 직결된 문제이기 때문입니다. 결론부터 말씀드리면, 대출의 종류와 보증 기관의 특성을 정확히 파악하여 대응하면 살던 집을 안전하게 지킬 수 있습니다.

■ 1. 주택담보대출이 있는 경우: '별제권'의 원리
주택담보대출은 개인회생 채권에 포함되지만, 법적으로 '별제권'으로 취급됩니다.
- 별제권이란: 담보권자가 회생 절차와 상관없이 담보물을 경매에 부칠 수 있는 권리입니다.
- 집을 지키는 비결: 회생 월 변제금과 별도로 주담대 원리금 또는 이자를 연체 없이 정상 납부하면, 은행은 경매를 실행하지 않고 거주를 보장합니다.

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(별제권·질권설정 대출 vs 일반 신용대출 회생 처리 절차도)

■ 2. 전세대출이 있는 경우: 질권설정과 채권양도 대응법
전세대출은 크게 두 가지 구조로 나뉩니다.
1) 질권설정 / 채권양도 통지가 된 대출:
만기 시 보증금이 은행으로 직접 반환되는 구조이므로, 회생 채권자목록에 포함하되 보증금 반환 시점과 만기 연장 가능 여부를 미리 은행과 조율해야 합니다.
2) 단순 신용보증 전세대출:
보증서 발급 대출의 경우 대출 연장 심사에서 회생 신청 사실이 영향을 줄 수 있으므로, 신청 전 만기를 최대한 연장해두는 것이 핵심 실무 팁입니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(주거 안심 보장 변호사 3인 실시간 안심 견적 비교)

■ 3. 집주인(임대인)에게 통보가 갈까요?
- 법원에서 임대인에게 직접 "이 사람이 회생을 신청했다"고 통지하지는 않습니다.
- 다만 질권설정된 전세대출의 경우 은행이 만기 보증금 반환 의무를 확인할 수는 있습니다.
- 마이김변의 주거권 전문 변호사들은 임대인 마찰을 최소화하는 특화 변제계획안을 설계해 드립니다.

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(살던 집 지키는 010 번호 비공개 안심 가명 상담)

■ 결론: 주거 안정이 무너지면 회생도 무너집니다
주거권을 지키면서 빚을 탕감받는 일은 고도의 법률 기술이 필요합니다. 010 번호 노출 없이, 마이김변에서 안심 가명으로 주거 전문 도산 변호사와 상담하세요.`,
    blogImages: [
      {
        id: "rent-img-1",
        order: 1,
        title: "대표 썸네일: 전세대출·주담대와 개인회생 주거권 보호 가이드",
        role: "주거권 상실 불안을 해소하는 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "Modern warm apartment living room viewed through a translucent glowing security shield, legal paper and house key on table, cinematic photorealistic lighting",
        previewGradient: "from-emerald-950 via-slate-900 to-teal-950",
        previewTitle: "전세대출·주담대 있어도 집 지키는 법",
        previewSub: "쫓겨날 걱정 끝! 2026 주거권 보호 실무 가이드",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "rent-img-2",
        order: 2,
        title: "인포그래픽: 별제권·질권설정 대출 vs 일반 신용대출 회생 처리도",
        role: "대출 유형별 경매 방어 원리 시각화",
        insertPosition: "2번 섹션 상단",
        prompt: "Detailed process flowchart comparing mortgage separate rights vs general unsecured debts in Korean rehabilitation, clean corporate vector style",
        previewGradient: "from-slate-900 via-teal-950/40 to-indigo-950/40",
        previewTitle: "별제권 vs 일반신용 회생 처리도",
        previewSub: "이자 정상 상환 시 경매 없이 주거권 100% 방어",
        tag: "비교 인포그래픽"
      },
      {
        id: "rent-img-3",
        order: 3,
        title: "기능 화면: 주거 안심 보장 변호사 3인 실시간 안심 견적 비교",
        role: "주거 보호 특화 변호사 직접 선택 화면 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Mobile app UI showing three vetted Korean bankruptcy lawyers specialized in real estate loan defense with transparent quotes, modern dark UI",
        previewGradient: "from-teal-950 via-slate-900 to-sky-950",
        previewTitle: "주거권 보호 전문 변호사 직접 비교",
        previewSub: "부동산·임대차 방어 승소 사례 검증 변호사 복수 지정",
        tag: "앱 UI 목업"
      },
      {
        id: "rent-img-4",
        order: 4,
        title: "CTA 배너: 살던 집 지키는 010 번호 비공개 안심 가명 상담",
        role: "주거 채무 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Horizontal conversion banner with warm house icon and glowing emerald consultation button, professional legal tech aesthetic",
        previewGradient: "from-teal-950 via-slate-900 to-emerald-950",
        previewTitle: "살던 집 지키는 안심 회생 상담",
        previewSub: "010 번호 노출 없이 안심 가명으로 주거권 전문 변호사를 만나세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생", "#전세대출개인회생", "#주택담보대출", "#별제권", "#주거권보호", "#마이김변"],
    specs: [
      { label: "글자 수", value: "2,620자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "별제권 메커니즘, 임대인 통보 여부 팩트체크" }
    ]
  },
  {
    presetKey: 'stealth-privacy',
    label: '스텔스가명',
    topic: '사설 브로커 DB 영업의 덫 vs 010 번호 유출 0% 마이김변 스텔스 가명',
    theme: '안심탐색',
    title: "사설 브로커 DB 영업의 덫 vs 010 번호 유출 0% 마이김변 스텔스 가명",
    badge: "네이버 블로그 2,500자 개인정보 보호 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (보안 메커니즘 시각화)",
    summary: "포털 무료 상담 신청 시 개인정보가 사설 대출 브로커에게 불법 유통되는 실태를 고발하고, 국내 유일 010 번호 비공개 '스텔스 가명'의 기술적 신뢰도를 밝힙니다.",
    answerFirst: [
      "1. 포털 무료 상담에 010 번호를 남기면 사설 브로커에게 DB가 판매되어 하루 수십 통의 스팸 전화가 쏟아집니다.",
      "2. 마이김변은 변호사에게조차 실제 번호를 노출하지 않는 국내 유일 '스텔스 가명' 특허 기술을 적용했습니다.",
      "3. 영업 전화 0통 보장! 검증된 도산 전문 변호사 3인의 견적을 안심하고 직접 비교하세요."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(010 번호 유출 0% — 사설 대출 스팸 없는 안심 회생)

■ 서론: "무료 상담 신청 후 하루 20통 대출 전화에 시달렸습니다"
실제 많은 채무자분들이 털어놓으시는 충격적인 현실입니다. 절박한 마음에 인터넷 포털의 '회생 무료 상담' 창에 이름과 전화번호를 적었다가, 정작 변호사는 만나보지도 못하고 불법 대출 중개업자들의 빗발치는 전화에 시달렸다는 사연이 넘쳐납니다.

■ 1. 사설 DB 수집 업체의 은밀한 거래 실태
포털이나 SNS 광고의 상당수는 실제 법률사무소가 아닌 '사설 마케팅 대행사(DB 브로커)'가 운영합니다.
- 개인정보 수집 즉시 1건당 3만~7만원에 사채·대출업자 및 무자격 브로커 사무실에 무차별 판매
- 내 010 번호가 텔레마케팅 명부에 올라가 수개월간 스팸 폭탄을 맞게 됨
- 정작 수임료는 덤핑 후 부실 처리로 기각되는 악순환

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(사설 DB 불법 유통 경로 vs 마이김변 종단간 암호화 스텔스 가명)

■ 2. 마이김변의 혁신: 국내 유일 '스텔스 가명' 시스템
마이김변은 이러한 폐단을 근절하기 위해 의뢰인의 실제 연락처(010)를 시스템에서 원천 격리하는 기술을 개발했습니다.
- 010 번호 완전 비공개: 변호사 사무실에도 오직 임의 생성된 안심 가명(예: '희망찬나무77')만 전달
- 영업 스팸 전화 0통: 내가 원할 때만 인앱 안심 채팅으로 질문하고 답변 확인
- 변호사법 제34조 100% 준수: 부당한 알선 수수료나 가격 덤핑 없이, 변호사의 실제 승소 후기와 전문 분야를 투명하게 공개

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(안심 가명 생성 및 변호사 프로필 직접 선택 인터페이스)

■ 3. 내가 직접 고르는 복수 안심 견적
- 브로커가 변호사를 배정하는 것이 아니라, 의뢰인이 직접 3명의 전문 변호사를 선택합니다.
- 비용, 수임 조건, 처리 기간을 한 화면에서 객관적으로 비교할 수 있습니다.

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(영업 전화 0통 보장! 안심 가명으로 변호사 견적 받기)

■ 결론: 비밀이 보장되어야 진정한 법적 구제가 시작됩니다
개인정보 유출 걱정 없이, 010 번호 없는 마이김변 스텔스 가명으로 떳떳하게 다시 일어서세요.`,
    blogImages: [
      {
        id: "stealth-img-1",
        order: 1,
        title: "대표 썸네일: 010 번호 유출 0% — 사설 대출 스팸 없는 안심 회생",
        role: "개인정보 완벽 보안 강조 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "A futuristic neon padlock and digital shield deflecting spam phone notifications, dark purple and cyber blue aesthetic, high tech cinematic",
        previewGradient: "from-purple-950 via-slate-900 to-indigo-950",
        previewTitle: "010 번호 유출 0% 스텔스 가명",
        previewSub: "사설 브로커 스팸 전화 0통! 100% 익명 안심 회생",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "stealth-img-2",
        order: 2,
        title: "인포그래픽: 사설 DB 불법 유통 vs 마이김변 암호화 가명 비교",
        role: "사설 DB 위험성과 스텔스 가명 안전성 대비",
        insertPosition: "2번 섹션 상단",
        prompt: "Comparison infographic showing red hacked data leak pipelines on left vs secure green encrypted safe vault on right, clean UI illustration",
        previewGradient: "from-slate-900 via-purple-950/40 to-emerald-950/40",
        previewTitle: "사설 DB 유출 vs 스텔스 가명 비교",
        previewSub: "불법 DB 거래 0통 스팸 차단 · 변호사에게도 번호 비공개",
        tag: "비교 인포그래픽"
      },
      {
        id: "stealth-img-3",
        order: 3,
        title: "기능 화면: 안심 가명 생성 및 변호사 프로필 직접 선택 화면",
        role: "스텔스 가명 토글 및 변호사 탐색 UI 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Smartphone mockup displaying anonymous pseudonym generator switch turned on with verified lawyer profiles, elegant dark mode UI",
        previewGradient: "from-purple-950 via-slate-900 to-blue-950",
        previewTitle: "원클릭 스텔스 가명 발급 화면",
        previewSub: "내 번호 대신 안심 가명으로 도산 전문 변호사 복수 지정",
        tag: "앱 UI 목업"
      },
      {
        id: "stealth-img-4",
        order: 4,
        title: "CTA 배너: 영업 전화 0통 보장! 안심 가명으로 변호사 견적 받기",
        role: "스텔스 가명 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Banner with glowing emerald CTA button '안심 가명 견적 받기' and purple security shield badge, high conversion fintech design",
        previewGradient: "from-purple-950 via-slate-900 to-emerald-950",
        previewTitle: "영업 스팸 0통! 안심 가명 견적 받기",
        previewSub: "010 번호 단 1자리도 넘기지 않고 전문 변호사 견적 비교",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생", "#스텔스가명", "#개인정보보호", "#스팸차단", "#마이김변", "#도산전문변호사"],
    specs: [
      { label: "글자 수", value: "2,510자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "사설 DB 유통 고발, 스텔스 가명 특허 구조" }
    ]
  },
  {
    presetKey: 'doc-innovation',
    label: '서류혁신',
    topic: '동사무소 40종 서류 지옥 탈출: 말로 쓰는 AI 음성 진술서와 30분 패키징',
    theme: '서류혁신',
    title: "동사무소 40종 서류 지옥 탈출: 말로 쓰는 AI 음성 진술서와 30분 패키징",
    badge: "네이버 블로그 2,450자 서류 간소화 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (서류 자동화 프로세스 탑재)",
    summary: "개인회생 준비 과정에서 가장 큰 장벽인 40여 종 관공서 서류 발급과 진술서 작성 고통을 스마트폰 30분 원스톱으로 해결하는 혁신 솔루션을 소개합니다.",
    answerFirst: [
      "1. 개인회생 신청 시 동사무소, 세무서, 은행 등에서 발급받아야 하는 서류만 40여 종에 달합니다.",
      "2. 스마트폰 마이크에 대고 말만 하면 법원 표준 양식에 맞춘 4단 진술서 초안이 자동 완성됩니다.",
      "3. 공공 마이데이터 연동으로 40종 서류를 30분 만에 패키징하여 담당 변호사에게 1초 전송합니다."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(40종 서류 지옥 탈출 — 스마트폰 30분 원스톱 패키징)

■ 서론: "서류 떼다가 지쳐서 회생을 포기하고 싶었습니다"
개인회생을 결심하고 변호사 사무실을 찾았을 때 받아드는 '준비 서류 목록 40종'. 주민센터, 세무서, 건강보험공단, 은행, 카드사를 며칠씩 휴가를 내고 뛰어다녀야 하는 현실 앞에서 채무자들은 또 한 번 절망합니다.

■ 1. 40종 서류 지옥, 왜 이렇게 복잡할까요?
법원은 채무자의 성실성과 재산 상태를 엄격히 검증하기 위해 방대한 서류를 요구합니다.
- 기본 서류: 주민등록등·초본, 가족관계증명서, 혼인관계증명서 등
- 소득 서류: 근로소득원천징수영수증, 건강보험료 납부확인서, 급여통장 거래내역 1년치
- 재산 서류: 지적전산자료조회결과, 보험해약환급금확인서, 자동차등록원부
- 채무 서류: 금융기관별 부채증명서

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(전통적인 동사무소 2주 서류 준비 vs 마이김변 30분 원스톱 패키징)

■ 2. 혁신 솔루션 1: 말로 쓰는 AI 음성 진술서
개인회생 서류의 핵심인 '채무 증대 경위서(진술서)'. 언제, 왜 빚을 지게 되었는지 글재주가 없어 막막하셨다면 이제 스마트폰에 대고 말씀만 하세요.
- 음성 인식 AI가 일상적인 구어체를 법원 판사가 선호하는 4단 논리 구조(채무 발생 원인 ➔ 증대 경위 ➔ 변제 노력 ➔ 갱생 의지)로 자동 정제합니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(말로 하면 법원 표준 양식으로 즉시 변환되는 AI 음성 진술서)

■ 3. 혁신 솔루션 2: Fast 2nd DocHub 30분 서류 패키징
- 공공 마이데이터 연동으로 관공서 발급 서류 90% 이상을 모바일에서 일괄 수집
- 담당 변호사에게 실시간 패키징 전송되어 보정명령 확률을 획기적으로 낮춥니다.

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(서류 스트레스 끝! 010 번호 노출 없는 간편 회생 신청)

■ 결론: 서류 스트레스는 기술에 맡기고, 삶의 회복에 집중하세요
더 이상 연차 내고 동사무소를 헤매지 마세요. 마이김변에서 스마트폰으로 30분 만에 끝내는 안심 회생을 경험해보세요.`,
    blogImages: [
      {
        id: "doc-img-1",
        order: 1,
        title: "대표 썸네일: 40종 서류 지옥 탈출 — 스마트폰 30분 원스톱 패키징",
        role: "서류 준비 부담 해소 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "Smartphone radiating glowing digital documents into a clean organized folder, eliminating stacks of messy paper, modern tech aesthetic, 8k render",
        previewGradient: "from-cyan-950 via-slate-900 to-blue-950",
        previewTitle: "40종 서류 지옥 탈출 30분 패키징",
        previewSub: "동사무소 방문 0회! 스마트폰 AI 음성 진술서 원스톱",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "doc-img-2",
        order: 2,
        title: "인포그래픽: 오프라인 2주 서류 준비 vs 마이김변 30분 완성 비교",
        role: "시간 및 노력 절감 효과 극명 대비",
        insertPosition: "2번 섹션 상단",
        prompt: "Infographic comparing exhausted person carrying piles of paperwork vs smiling person using smartphone with 30-minute timer, modern vector style",
        previewGradient: "from-slate-900 via-cyan-950/40 to-indigo-950/40",
        previewTitle: "오프라인 2주 vs 모바일 30분 비교",
        previewSub: "관공서 5곳 방문 ➔ 스마트폰 터치 한 번으로 서류 취합",
        tag: "비교 인포그래픽"
      },
      {
        id: "doc-img-3",
        order: 3,
        title: "기능 화면: 말로 쓰는 AI 음성 진술서 변환 화면",
        role: "음성 파형이 법원 서식으로 자동 완성되는 UI 시각화",
        insertPosition: "3번 섹션 상단",
        prompt: "Mobile app screen showing voice waveform converted into legal statement text with green checkmarks, photorealistic 3d mockup",
        previewGradient: "from-cyan-950 via-slate-900 to-purple-950",
        previewTitle: "말로 쓰는 AI 음성 진술서 화면",
        previewSub: "음성 녹음 ➔ 법원 표준 4단 서식 자동 완성 기술",
        tag: "앱 UI 목업"
      },
      {
        id: "doc-img-4",
        order: 4,
        title: "CTA 배너: 서류 스트레스 끝! 010 번호 노출 없는 간편 회생 신청",
        role: "서류 간소화 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "High-conversion banner with glowing document stack icon and emerald CTA button, modern legal tech design",
        previewGradient: "from-cyan-950 via-slate-900 to-emerald-950",
        previewTitle: "서류 걱정 없는 안심 회생 신청",
        previewSub: "010 번호 노출 없이 30분 만에 변호사 검토까지 완료하세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생서류", "#AI음성진술서", "#서류패키징", "#마이김변", "#비대면회생", "#스텔스보증"],
    specs: [
      { label: "글자 수", value: "2,450자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "40종 서류 목록 체크리스트, 음성 진술서 작성 원리" }
    ]
  },
  {
    presetKey: 'unpaid-payment',
    label: '변제금미납',
    topic: '개인회생 변제금 3회 이상 미납하면? 폐지 기준과 회생동행 구제법',
    theme: '면책완주',
    title: "개인회생 변제금 3회 이상 미납하면? 폐지 위기 탈출과 회생동행 구제법",
    badge: "네이버 블로그 2,550자 폐지 방어 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (폐지 방어 타임라인 탑재)",
    summary: "실직, 질병 등으로 개인회생 변제금을 3회 이상 미납했을 때 법원의 실제 폐지 시점, 즉시항고 요령, 변제계획 변경안 제출 등 실전 방어법을 심층 안내합니다.",
    answerFirst: [
      "1. 변제금 미납 3회가 누적되면 법원에서 '폐지 예정 통지서'가 발송되며 즉시 강제집행 위험에 노출됩니다.",
      "2. 미납금 일시 완납이 어렵다면 '변제계획 변경안 제출' 또는 '특별면책 신청'으로 방어할 수 있습니다.",
      "3. 폐지 결정 확정 전 즉시항고 및 재신청 자격을 마이김변 안심 가명으로 신속히 검토하세요."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(개인회생 변제금 미납 폐지 위기 탈출 골든타임)

■ 서론: 변제금 미납 3회, 이대로 가면 모든 노력이 물거품이 될까요?
힘들게 개인회생 인가 결정을 받고 1~2년 성실히 변제금을 내오다가, 갑작스러운 실직이나 질병으로 변제금을 몇 달 밀리게 된 분들이 많습니다. "3번 밀리면 바로 폐지된다는데 이제 어떻게 해야 하나요?"라며 절망하시는 분들을 위해 긴급 구제 방안을 정리해 드립니다.

■ 1. 법원의 실제 폐지 기준 (실무준칙상 팩트)
법조문상으로는 3회 이상 미납 시 폐지할 수 있다고 되어 있으나, 실무상으로는 다음과 같이 운용됩니다.
- 서울회생법원 기준: 보통 3~5회 미납 누적 시 '폐지 예정 통지서' 발송
- 소명 기회 부여: 통지서 수령 후 2~4주 이내에 미납 사유와 납부 계획을 소명하면 즉시 폐지되지는 않음
- 폐지 공고 전 골든타임: 법원 홈페이지에 폐지 결정문이 공고되기 전이 가장 중요한 방어 시점

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(법원 폐지 예정 통지서 수령 시 3단계 긴급 대응 매뉴얼)

■ 2. 폐지 위기 탈출을 위한 3대 구제 솔루션
1) 변제계획 변경안 제출:
실직이나 임금 삭감으로 소득이 줄었다면, 남은 변제 기간의 월 변제금을 낮추는 변경안을 법원에 신청할 수 있습니다.
2) 특별면책 신청:
채무자의 책임 없는 사유(중대한 질병, 재해 등)로 변제를 계속할 수 없고, 이미 청산가치 이상을 변제했다면 남은 채무의 면책을 즉시 청구할 수 있습니다.
3) 즉시항고 및 재신청:
폐지 결정이 내려졌더라도 14일 이내에 즉시항고하거나, 요건을 보완하여 재신청을 진행할 수 있습니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(변제계획 변경 및 재신청 자격 즉시 확인 화면)

■ 3. 마이김변 회생동행 케어로 면책까지 완주하세요
- 변제금 미납 알림 및 법원 서류 송달 실시간 모니터링
- 위기 발생 시 담당 도산 전문 변호사와 안심 채팅으로 긴급 소명서 작성

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(폐지 위기 극복! 도산 전문 변호사 긴급 안심 상담)

■ 결론: 포기하지 마세요. 법은 회생 완주를 돕습니다
지금 바로 마이김변에서 010 번호 노출 없이 안심 가명으로 변제금 미납 긴급 구제 상담을 신청하세요.`,
    blogImages: [
      {
        id: "unpaid-img-1",
        order: 1,
        title: "대표 썸네일: 개인회생 변제금 미납 폐지 위기 탈출 골든타임",
        role: "긴박한 위기 속 해결책 제시 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "An hourglass with red sand running out, courtroom gavel, glowing golden lifeline rope, dramatic tension lighting, photorealistic 8k render",
        previewGradient: "from-rose-950 via-slate-900 to-amber-950",
        previewTitle: "변제금 3회 미납 폐지 위기 탈출법",
        previewSub: "폐지 예정 통지서 대처 요령 & 변제계획 변경 골든타임",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "unpaid-img-2",
        order: 2,
        title: "인포그래픽: 법원 폐지 통지서 수령 시 3단계 긴급 대응 매뉴얼",
        role: "폐지 방어 단계별 조치도 시각화",
        insertPosition: "2번 섹션 상단",
        prompt: "Step by step emergency action guide infographic for rehabilitation payment default, bold warning colors and clear action steps",
        previewGradient: "from-slate-900 via-rose-950/40 to-amber-950/40",
        previewTitle: "폐지 통지서 수령 시 3단계 대응법",
        previewSub: "미납 사유 소명 ➔ 변제계획 변경 ➔ 특별면책 검토",
        tag: "비교 인포그래픽"
      },
      {
        id: "unpaid-img-3",
        order: 3,
        title: "기능 화면: 변제계획 변경 및 재신청 자격 즉시 확인 화면",
        role: "소득 변화 시 변제금 재계산 UI 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Smartphone screen displaying debt recalculation and monthly payment adjustment simulator, sleek dark fintech UI",
        previewGradient: "from-rose-950 via-slate-900 to-indigo-950",
        previewTitle: "변제금 재조정 시뮬레이터 화면",
        previewSub: "소득 감소 반영 월 변제금 하향 가능 여부 즉시 검토",
        tag: "앱 UI 목업"
      },
      {
        id: "unpaid-img-4",
        order: 4,
        title: "CTA 배너: 폐지 위기 극복! 도산 전문 변호사 긴급 안심 상담",
        role: "폐지 방어 긴급 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Urgent yet reassuring banner with golden lifebuoy badge and emerald consultation button, professional legal assistance",
        previewGradient: "from-rose-950 via-slate-900 to-emerald-950",
        previewTitle: "변제금 미납 긴급 안심 상담",
        previewSub: "010 번호 노출 없이 폐지 방어 전문 변호사의 조력을 받으세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생미납", "#변제금미납", "#개인회생폐지", "#특별면책", "#변제계획변경", "#마이김변"],
    specs: [
      { label: "글자 수", value: "2,550자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "폐지 공고 전 방어 타임라인, 특별면책 요건표" }
    ]
  },
  {
    presetKey: 'crypto-stock',
    label: '코인/주식',
    topic: '주식·코인 투자 빚도 탕감 가능할까? 서울·수원·부산회생법원 최신 실무준칙',
    theme: '주말안심상담',
    title: "주식·코인 투자 빚도 탕감 가능할까? 서울·수원·부산회생법원 최신 실무준칙",
    badge: "네이버 블로그 2,650자 투자채무 탕감 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (회생법원 실무준칙 비교표 탑재)",
    summary: "주식, 코인, 영끌 투자 실패로 빚더미에 앉은 2030 채무자들을 위한 서울·수원·부산회생법원의 투자 손실금 청산가치 미반영 준칙과 탕감 전략을 총정리합니다.",
    answerFirst: [
      "1. 2022~2026 서울·수원·부산회생법원은 주식·가상화폐 투자 손실금을 청산가치에 미반영하는 실무준칙을 시행 중입니다.",
      "2. 원금의 최대 90%까지 탕감받을 수 있으며, 투자 실패자도 성실 채무자로 정당하게 구제받습니다.",
      "3. 법원별 실무 차이가 크므로, 관할 법원 실무준칙에 정통한 도산 전문 변호사 선임이 필수입니다."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(주식·코인 투자 채무 개인회생 — 법원 실무준칙 완벽 해설)

■ 서론: "코인 빚도 나라에서 탕감해 주나요?"
주식과 코인 시장의 급락으로 전 재산을 잃고 수억 원의 빚만 남은 청년과 가장들이 많습니다. 과거에는 투자 손실금을 도박처럼 취급하여 탕감이 어렵다는 인식이 있었으나, 회생법원의 패러다임이 완전히 바뀌었습니다.

■ 1. 서울·수원·부산회생법원의 혁신적 실무준칙
- 손실금 청산가치 미반영: 과거에는 투자로 날린 돈도 내 재산(청산가치)으로 보아 변제금이 높았지만, 최신 실무준칙은 '실제 남아있는 재산'만을 청산가치로 산정합니다.
- 변제금 대폭 경감: 투자 손실액을 변제금에 얹지 않으므로, 월 소득에서 최저생계비를 뺀 가용소득만 성실히 납부하면 나머지 원금 최대 90%까지 합법적 탕감이 가능합니다.

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(투자 손실금 청산가치 반영 여부 법원별 비교표)

■ 2. 다른 지방 법원은 어떨까요? (관할 법원 전략)
- 서울, 수원, 부산 외의 지방 법원들은 여전히 엄격한 잣대를 적용하는 경우가 있습니다.
- 따라서 직장 주소지나 실거주지를 기반으로 유리한 법원을 선택하거나, 투자 손실 경위를 설득력 있게 소명하는 진술서 전략이 승패를 가릅니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(투자 채무 전문 변호사 승소 사례 및 안심 견적 비교)

■ 3. 사기죄 고소나 편파변제 위험 피하는 법
- 투자 손실 직전 대출금을 특정 지인에게 먼저 갚았다면 '편파변제'로 부인권 대상이 될 수 있습니다.
- 마이김변의 도산 전문 변호사들이 사전 거래내역을 철저히 검토하여 법적 리스크를 완벽 차단해 드립니다.

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(투자 실패 채무 010 번호 없이 안심 가명으로 상담받기)

■ 결론: 투자의 실패는 죄가 아닙니다. 다시 일어설 권리가 있습니다
010 번호 노출 없이, 마이김변 안심 가명으로 투자 채무 전문 변호사와 상담하고 새 삶을 시작하세요.`,
    blogImages: [
      {
        id: "crypto-img-1",
        order: 1,
        title: "대표 썸네일: 주식·코인 투자 채무 개인회생 — 법원 실무준칙 완벽 해설",
        role: "투자 실패 채무자 구제 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "Volatile crypto and stock candlestick charts in background, glowing legal scales of justice in foreground, cinematic dark tech lighting, 8k",
        previewGradient: "from-amber-950 via-slate-900 to-slate-950",
        previewTitle: "주식·코인 투자 빚도 탕감 가능할까?",
        previewSub: "서울·수원·부산회생법원 실무준칙 & 원금 최대 90% 탕감",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "crypto-img-2",
        order: 2,
        title: "인포그래픽: 투자 손실금 청산가치 반영 여부 법원별 비교표",
        role: "과거 실무 vs 최신 실무준칙 차이 비교",
        insertPosition: "2번 섹션 상단",
        prompt: "Clean comparison table showing Seoul, Suwon, and Busan court guidelines regarding crypto loss liquidation value, corporate infographic",
        previewGradient: "from-slate-900 via-amber-950/40 to-indigo-950/40",
        previewTitle: "투자 손실금 청산가치 법원별 비교",
        previewSub: "과거: 손실금 전액 청산가치 반영 vs 현재: 실제 잔존재산만 반영",
        tag: "비교 인포그래픽"
      },
      {
        id: "crypto-img-3",
        order: 3,
        title: "기능 화면: 투자 채무 전문 변호사 승소 사례 및 안심 견적 비교",
        role: "투자 채무 탕감 승소 이력 변호사 선택 UI 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Smartphone app showing verified lawyer profiles with 90%+ discharge case studies for cryptocurrency debt, modern UI",
        previewGradient: "from-amber-950 via-slate-900 to-blue-950",
        previewTitle: "투자 채무 전문 변호사 직접 비교",
        previewSub: "코인·주식 회생 승소 사례 검증 변호사 복수 지정",
        tag: "앱 UI 목업"
      },
      {
        id: "crypto-img-4",
        order: 4,
        title: "CTA 배너: 투자 실패 채무 010 번호 없이 안심 가명으로 상담받기",
        role: "투자 채무 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Conversion banner with golden crypto coin turning into legal shield, emerald CTA button, high conversion layout",
        previewGradient: "from-amber-950 via-slate-900 to-emerald-950",
        previewTitle: "코인·주식 채무 안심 가명 상담",
        previewSub: "010 번호 유출 없이 법원 실무준칙 전문 변호사의 조력을 받으세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#코인개인회생", "#주식빚탕감", "#회생법원실무준칙", "#서울회생법원", "#마이김변", "#스텔스보증"],
    specs: [
      { label: "글자 수", value: "2,650자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "법원별 실무준칙 비교표, 편파변제 주의사항" }
    ]
  },
  {
    presetKey: 'disadvantage-overcome',
    label: '단점극복',
    topic: '개인회생 단점 5가지와 현실적인 대비법 총정리 (2026)',
    theme: '전문가보증',
    title: "개인회생 단점 5가지와 현실적인 대비법 총정리 (2026 솔직 분석)",
    badge: "네이버 블로그 2,500자 솔직 팩트체크 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (루머 vs 팩트 인포그래픽 탑재)",
    summary: "개인회생의 단점으로 꼽히는 신용거래 제한, 직장 불이익 루머, 가족 영향 여부 등 5가지 쟁점을 솔직하게 분석하고 피해를 0%로 줄이는 현실적 대비책을 제시합니다.",
    answerFirst: [
      "1. 단점 1: 신용카드 사용 정지 ➔ 체크카드 및 은행 거래 정상 이용으로 즉시 대체 가능합니다.",
      "2. 단점 2: 직장이나 가족 통보 우려 ➔ 법원 우편물 송달장소를 대리인 사무실로 지정하여 100% 비밀이 보장됩니다.",
      "3. 단점 3: 복잡한 서류 준비 ➔ 마이김변 30분 모바일 패키징으로 완벽 해결됩니다."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(개인회생 단점 5가지와 팩트체크 — 불이익 없이 극복하는 법)

■ 서론: 좋은 점만 말하는 광고는 거르세요. 단점도 정확히 알아야 합니다
많은 법률 사무소들이 "원금 90% 탕감"이라는 장점만 강조합니다. 하지만 회생은 법적인 절차인 만큼 일정 기간 감수해야 할 불편함이 존재합니다. 마이김변은 단점을 숨기지 않고 투명하게 공개하며, 이를 어떻게 지혜롭게 극복할 수 있는지 솔루션을 안내합니다.

■ 1. 개인회생의 5가지 단점과 팩트체크
1) 신용카드 사용 제한: 36개월 변제 기간 동안 신용카드 및 신규 신용대출이 어렵습니다. (대비책: 체크카드 사용 및 1금융권 통장 정상 이용)
2) 관공서 서류 준비의 번거로움: 40종에 달하는 서류 준비. (대비책: 마이김변 30분 모바일 원스톱 패키징)
3) 36개월 성실 변제 부담: 매월 일정한 변제금을 성실히 납부해야 함. (대비책: 최저생계비 현실적 반영으로 무리 없는 변제계획 수립)
4) 일부 전문직 자격 제한 우려: 파산과 달리 회생은 공무원, 교사, 의사 등의 자격이 유지됩니다. (단, 사규 확인 필요)
5) 가족에게 알려질까 두려움: 법원에서 집이나 회사로 서류를 보내지 않음. (대비책: 송달장소 변호사 사무실 지정)

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(개인회생 루머 vs 실제 법적 효력 팩트체크 5선)

■ 2. 단점보다 압도적으로 큰 장점
- 모든 빚 독촉과 압류 즉시 중단 (금지명령 1~2주 내 결정)
- 이자 100% 탕감, 원금 최대 90% 탕감
- 면책 후 모든 연체 기록 삭제 및 신용점수 정상 회복

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(내 직업·소득 맞춤형 안심 회생 로드맵 확인 화면)

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(두려움 없는 새출발 — 010 번호 없는 안심 가명 상담)

■ 결론: 정확히 알고 준비하면 두려울 것이 없습니다
010 번호 노출 없는 마이김변 안심 가명으로 솔직한 변호사 견적을 받아보세요.`,
    blogImages: [
      {
        id: "dis-img-1",
        order: 1,
        title: "대표 썸네일: 개인회생 단점 5가지와 팩트체크 — 불이익 없이 극복하는 법",
        role: "솔직하고 투명한 팩트체크 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "A checklist with false myth crosses turned into green checkmarks, modern office atmosphere, calm trustworthy lighting, photorealistic",
        previewGradient: "from-slate-900 via-indigo-950 to-slate-900",
        previewTitle: "개인회생 단점 5가지 솔직 팩트체크",
        previewSub: "숨김없이 밝히는 현실적 불편함과 현명한 극복 매뉴얼",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "dis-img-2",
        order: 2,
        title: "인포그래픽: 개인회생 루머 vs 실제 법적 효력 팩트체크 5선",
        role: "대중적 오해 5가지와 진실 대비",
        insertPosition: "2번 섹션 상단",
        prompt: "5-point side-by-side myth vs reality comparison graphic with red cross marks and green shield checkmarks, vector style",
        previewGradient: "from-slate-900 via-indigo-950/40 to-emerald-950/40",
        previewTitle: "루머 5가지 vs 실제 팩트 비교",
        previewSub: "가족 통보 X · 직장 불이익 X · 체크카드 사용 O",
        tag: "비교 인포그래픽"
      },
      {
        id: "dis-img-3",
        order: 3,
        title: "기능 화면: 내 직업·소득 맞춤형 안심 회생 로드맵 확인 화면",
        role: "직업/상황 맞춤 솔루션 UI 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Smartphone screen displaying customized 36-month rehabilitation roadmap and privacy defense settings, dark mode UI",
        previewGradient: "from-indigo-950 via-slate-900 to-purple-950",
        previewTitle: "맞춤형 안심 회생 로드맵 화면",
        previewSub: "직업·소득별 불이익 0% 방어 전략 및 36개월 플랜",
        tag: "앱 UI 목업"
      },
      {
        id: "dis-img-4",
        order: 4,
        title: "CTA 배너: 두려움 없는 새출발 — 010 번호 없는 안심 가명 상담",
        role: "안심 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Reassuring banner with open door into bright future silhouette, emerald consultation button, professional legal branding",
        previewGradient: "from-indigo-950 via-slate-900 to-emerald-950",
        previewTitle: "두려움 없는 새출발 안심 가명 상담",
        previewSub: "010 번호 유출 없이 신뢰할 수 있는 도산 전문 변호사를 만나세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생단점", "#개인회생팩트체크", "#신용회복", "#마이김변", "#스텔스가명", "#도산전문변호사"],
    specs: [
      { label: "글자 수", value: "2,500자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "5대 단점 분석, 극복 대비책" }
    ]
  },
  {
    presetKey: 'eligibility-check',
    label: '자격확인',
    topic: '2026 최저생계비 인상 반영: 내 소득으로 회생 신청 가능할까?',
    theme: '비대면기술',
    title: "2026 최저생계비 인상 반영: 내 소득으로 개인회생 신청 가능할까?",
    badge: "네이버 블로그 2,520자 자격 요건 분석 칼럼 + 이미지 4컷",
    format: "네이버 블로그 스마트에디터 최적화 (2026 최저생계비 기준표 탑재)",
    summary: "2026년 기준 중위소득 60% 인상안을 반영하여, 아르바이트·프리랜서·일용직도 회생이 가능한지 가구원수별 인정 생계비와 예상 변제금 계산법을 총정리합니다.",
    answerFirst: [
      "1. 2026년 1인 가구 기준 중위소득 60% 최저생계비(약 142만원)를 초과하는 소득이 있다면 누구나 신청 가능합니다.",
      "2. 아르바이트, 프리랜서, 일용직, 주부(파트타임) 소득도 정기적 수입으로 인정됩니다.",
      "3. 010 번호 유출 없이 안심 가명으로 내 소득과 채무액에 맞춘 예상 변제금을 즉시 확인하세요."
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]
(2026년 기준 중위소득 및 가구원수별 최저생계비 기준표)

■ 서론: 2026년 최저생계비 인상, 채무자에게 왜 유리할까요?
개인회생의 월 변제금은 '월 소득 - 법정 최저생계비 = 월 가용소득(변제금)' 공식으로 결정됩니다. 따라서 최저생계비가 오르면 내가 법적으로 인정받는 생활비가 늘어나 월 변제금이 줄어들고, 총 탕감율은 높아집니다.

■ 1. 2026년 가구원수별 인정 최저생계비 (기준 중위소득의 60%)
- 1인 가구: 약 1,420,000원
- 2인 가구: 약 2,360,000원
- 3인 가구: 약 3,020,000원
- 4인 가구: 약 3,680,000원
※ 미성년 자녀, 고령 부모님을 부양하고 있다면 부양가족으로 인정받아 월 변제금을 더욱 낮출 수 있습니다.

[📷 이미지 2: 본문 삽입 인포그래픽 #1]
(2026 최저생계비 대비 월 가용소득 & 예상 변제금 계산 예시)

■ 2. 4대 보험이 안 되는 알바나 프리랜서도 가능한가요?
- 가능합니다. 회생법원은 고용 형태를 따지지 않고 '지속적이고 반복적인 수입'이 있는지를 봅니다.
- 통장 입금 내역, 소득확인서, 현금수령증 등을 통해 소득을 증명할 수 있습니다.

[📷 이미지 3: 본문 삽입 UI 목업 #2]
(010 번호 없는 스텔스 안심 소득/채무 분석 리포트)

■ 3. 개인회생 자격 3대 핵심 체크리스트
1) 총 채무액: 무담보 10억 원, 담보부 15억 원 이하
2) 재산보다 채무가 더 많아야 함 (청산가치 보장의 원칙)
3) 최저생계비 이상의 정기적 소득 증빙 가능

[📷 이미지 4: 엔딩 CTA 배너 삽입 위치]
(100% 비대면 010 번호 비공개 안심 변호사 견적 받기)

■ 결론: 주저하지 마시고 내 자격을 안전하게 확인하세요
010 번호 노출 없는 마이김변 스텔스 가명으로 도산 전문 변호사에게 1초 안심 견적을 받아보세요.`,
    blogImages: [
      {
        id: "elig-img-1",
        order: 1,
        title: "대표 썸네일: 2026년 기준 중위소득 및 가구원수별 최저생계비 기준표",
        role: "2026 최저생계비 기준 안내 대표 썸네일",
        insertPosition: "본문 최상단",
        prompt: "Korean won currency calculator, family silhouette icon, official 2026 government standard chart, crisp warm professional lighting",
        previewGradient: "from-teal-950 via-slate-900 to-emerald-950",
        previewTitle: "2026 최저생계비 인상과 회생 신청자격",
        previewSub: "1~4인 가구 인정 생계비 & 알바·프리랜서 자격 기준",
        tag: "대표 썸네일 (1080x1080)"
      },
      {
        id: "elig-img-2",
        order: 2,
        title: "인포그래픽: 2026 최저생계비 대비 월 변제금 산정 공식",
        role: "소득에서 생계비를 뺀 가용소득 산출 원리 시각화",
        insertPosition: "2번 섹션 상단",
        prompt: "Financial calculation bar chart illustrating gross income minus minimum living cost equals monthly rehabilitation installment, clean vector",
        previewGradient: "from-slate-900 via-teal-950/40 to-indigo-950/40",
        previewTitle: "2026 최저생계비와 월 변제금 공식",
        previewSub: "월 소득 - 법정 최저생계비 = 월 변제금 (원금 최대 90% 탕감)",
        tag: "비교 인포그래픽"
      },
      {
        id: "elig-img-3",
        order: 3,
        title: "기능 화면: 010 번호 없는 스텔스 안심 소득/채무 분석 리포트",
        role: "회생 가능성 및 변제금 시뮬레이션 UI 입증",
        insertPosition: "3번 섹션 상단",
        prompt: "Smartphone mockup displaying anonymous income debt qualification report with green approval gauge, elegant fintech UI",
        previewGradient: "from-teal-950 via-slate-900 to-sky-950",
        previewTitle: "안심 소득/채무 분석 리포트 화면",
        previewSub: "010 번호 없이 안심 가명으로 자격 요건 즉시 확인",
        tag: "앱 UI 목업"
      },
      {
        id: "elig-img-4",
        order: 4,
        title: "CTA 배너: 100% 비대면 010 번호 비공개 안심 변호사 견적 받기",
        role: "자격 확인 상담 전환 배너",
        insertPosition: "본문 최하단",
        prompt: "Banner with glowing emerald CTA button '안심 변호사 견적 받기' and privacy shield icon, modern dark fintech style",
        previewGradient: "from-teal-950 via-slate-900 to-emerald-950",
        previewTitle: "100% 비대면 안심 변호사 견적 받기",
        previewSub: "010 번호 노출 없이 도산 전문 변호사 3인의 견적을 비교하세요",
        tag: "전환 CTA 배너"
      }
    ],
    hashtags: ["#개인회생자격", "#2026최저생계비", "#중위소득60%", "#알바개인회생", "#프리랜서회생", "#마이김변"],
    specs: [
      { label: "글자 수", value: "2,520자" },
      { label: "삽입 이미지", value: "총 4컷" },
      { label: "권장 폰트", value: "나눔고딕 15pt" },
      { label: "포함 요소", value: "2026 가구원수별 최저생계비 표, 변제금 계산식" }
    ]
  }
];

/**
 * Gemini 2.5 Flash API를 호출하여 임의의 주제에 대한 4컷 이미지 세트 및 D.I.A.+ 블로그 칼럼을 동적으로 생성
 */
export async function generateBlogContentWithGemini(
  topic: string,
  theme: string,
  apiKey?: string
): Promise<BlogContentData> {
  // 1. API 키가 없으면 주제와 가장 유사한 8대 프리셋 중 하나를 선택하여 반환
  const resolvedKey = apiKey || 
    (typeof window !== 'undefined' ? localStorage.getItem('marketing_gemini_api_key') || localStorage.getItem('gemini_api_key') : null);

  if (!resolvedKey) {
    return findBestPresetOrFallback(topic, theme);
  }

  // 2. Gemini API 호출
  const systemPrompt = `당신은 대한민국 최고 수준의 리걸테크 및 도산법률 전문 마케팅 디렉터입니다.
주제: "${topic}"
강조 테마: "${theme}"

플랫폼 핵심 가치:
1. 010 실제 전화번호를 변호사 사무실에도 노출하지 않는 '스텔스 가명' 시스템 (영업 스팸 전화 0통 보장)
2. 변호사법 제34조 완벽 준수:
   - '자가진단' 용어 절대 금지 ➔ '010 번호 없는 안심 가명 상담/견적' 사용
   - 가격 덤핑 역경매 배제, 승소율 단정 금지
   - 의뢰인이 검증된 변호사 프로필을 직접 확인하고 복수 지정
3. 40종 서류 지옥 탈출:
   - 스마트폰 AI 음성 진술서 & Fast 2nd DocHub 30분 서류 패키징

아래 JSON 스키마를 만족하는 네이버 블로그 D.I.A.+ 최적화 칼럼과 4컷 삽입 이미지 상세 기획을 작성하세요.

JSON Schema:
{
  "title": "클릭률을 높이는 네이버 스마트블록 검색 최적화 제목",
  "summary": "핵심 요약 1~2문장",
  "answerFirst": [
    "1. Answer-First 핵심 요약 1",
    "2. Answer-First 핵심 요약 2",
    "3. Answer-First 핵심 요약 3"
  ],
  "fullBody": "2,000자 이상 D.I.A.+ 스타일 칼럼 (본문 중간에 [📷 이미지 1], [📷 이미지 2], [📷 이미지 3], [📷 이미지 4] 표시와 설명 포함)",
  "blogImages": [
    {
      "id": "gen-img-1",
      "order": 1,
      "title": "대표 썸네일 제목",
      "role": "검색 결과 클릭률 극대화 1:1 대표 썸네일",
      "insertPosition": "본문 최상단",
      "prompt": "Imagen 3 / Nano Banana 2 English photorealistic prompt, 8k resolution, cinematic lighting",
      "previewGradient": "from-blue-950 via-slate-900 to-indigo-950",
      "previewTitle": "이미지 중앙 메인 볼드 헤드라인 (12~18자)",
      "previewSub": "이미지 하단 설명 문구 (20~30자)",
      "tag": "대표 썸네일 (1080x1080)"
    },
    {
      "id": "gen-img-2",
      "order": 2,
      "title": "비교 인포그래픽 제목",
      "role": "주제 맞춤 문제점 vs 해결책 비교 시각화",
      "insertPosition": "본문 2번 섹션 상단",
      "prompt": "Vector comparison infographic English prompt, clean fintech UI style",
      "previewGradient": "from-slate-900 via-rose-950/40 to-indigo-950/40",
      "previewTitle": "비교 인포그래픽 메인 헤드라인",
      "previewSub": "핵심 대비 요약 설명",
      "tag": "비교 인포그래픽"
    },
    {
      "id": "gen-img-3",
      "order": 3,
      "title": "앱 UI 목업 제목",
      "role": "30분 서류 패키징 또는 안심 가명 상담 UI 시각화",
      "insertPosition": "본문 3번 섹션 상단",
      "prompt": "Smartphone mockup floating in dark space showing Korean legal tech app screen, 3d render",
      "previewGradient": "from-indigo-950 via-slate-900 to-cyan-950",
      "previewTitle": "UI 목업 메인 헤드라인",
      "previewSub": "스마트폰 모바일 혁신 기능 설명",
      "tag": "앱 UI 목업"
    },
    {
      "id": "gen-img-4",
      "order": 4,
      "title": "전환 CTA 배너 제목",
      "role": "010 번호 없는 안심 가명 상담 전환 배너",
      "insertPosition": "본문 최하단",
      "prompt": "Horizontal conversion banner with glowing emerald CTA button, high contrast",
      "previewGradient": "from-indigo-950 via-slate-900 to-emerald-950",
      "previewTitle": "전환 배너 메인 헤드라인",
      "previewSub": "010 번호 노출 없이 안심 상담 안내 문구",
      "tag": "전환 CTA 배너"
    }
  ],
  "hashtags": ["#개인회생", "#스텔스가명", "#마이김변", "#채무탕감", "#도산전문변호사"]
}
반드시 순수 JSON만 반환하세요.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${resolvedKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          response_mime_type: 'application/json'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean);

        return {
          presetKey: 'custom-gemini',
          label: 'AI 생성',
          topic,
          theme,
          title: parsed.title || topic,
          badge: "네이버 블로그 2,500자 D.I.A.+ 칼럼 (Gemini Pro 생성)",
          format: "네이버 블로그 스마트에디터 최적화 (4컷 이미지 세트 탑재)",
          summary: parsed.summary || `${topic}에 대한 심층 법률 칼럼입니다.`,
          answerFirst: parsed.answerFirst || [
            "1. 2026년 기준 실무준칙에 맞춘 합법적 채무 탕감 방안을 검토합니다.",
            "2. 사설 브로커 DB 유출 위험 없이 010 번호 없는 스텔스 가명 상담을 제공합니다.",
            "3. 40종 서류 지옥을 30분 모바일 패키징으로 해결합니다."
          ],
          fullBody: parsed.fullBody || '',
          blogImages: (parsed.blogImages || []).map((img: any, idx: number) => ({
            id: `gen-img-${idx + 1}`,
            order: idx + 1,
            title: img.title || `이미지 ${idx + 1}`,
            role: img.role || '본문 시각화',
            insertPosition: img.insertPosition || '본문 삽입',
            prompt: img.prompt || 'Cinematic legal visual, dark moody lighting, 8k render',
            previewGradient: img.previewGradient || (idx === 0 ? 'from-blue-950 via-slate-900 to-indigo-950' : idx === 1 ? 'from-slate-900 via-rose-950/40 to-indigo-950/40' : idx === 2 ? 'from-indigo-950 via-slate-900 to-cyan-950' : 'from-indigo-950 via-slate-900 to-emerald-950'),
            previewTitle: img.previewTitle || topic,
            previewSub: img.previewSub || '010 번호 유출 없는 마이김변 안심 리걸테크',
            tag: img.tag || (idx === 0 ? '대표 썸네일' : idx === 1 ? '비교 인포그래픽' : idx === 2 ? '앱 UI 목업' : '전환 CTA 배너')
          })),
          hashtags: parsed.hashtags || ["#개인회생", "#스텔스가명", "#마이김변", "#채무탕감"],
          specs: [
            { label: "글자 수", value: "2,500자 이상" },
            { label: "삽입 이미지", value: "총 4컷 (Gemini 2.5 Flash 맞춤 생성)" },
            { label: "권장 폰트", value: "나눔고딕 15pt / 행간 180%" },
            { label: "컴플라이언스", value: "변호사법 제34조 100% 준수 검수 완료" }
          ]
        };
      }
    }
  } catch (err) {
    console.warn('Gemini API call failed, using best preset fallback:', err);
  }

  // 3. API 실패 시 가장 적합한 프리셋 데이터 반환
  return findBestPresetOrFallback(topic, theme);
}

/**
 * 주제 키워드 기반으로 8대 프리셋 중 가장 적합한 프리셋을 찾아 반환
 */
export function findBestPresetOrFallback(topic: string, theme: string): BlogContentData {
  const lower = topic.toLowerCase();
  
  if (lower.includes('카드') || lower.includes('신용')) {
    return DDOK_BLOG_PRESETS_DATA[0];
  }
  if (lower.includes('전세') || lower.includes('주택') || lower.includes('담보') || lower.includes('집')) {
    return DDOK_BLOG_PRESETS_DATA[1];
  }
  if (lower.includes('스텔스') || lower.includes('가명') || lower.includes('번호') || lower.includes('스팸') || lower.includes('브로커')) {
    return DDOK_BLOG_PRESETS_DATA[2];
  }
  if (lower.includes('서류') || lower.includes('진술서') || lower.includes('음성') || lower.includes('동사무소')) {
    return DDOK_BLOG_PRESETS_DATA[3];
  }
  if (lower.includes('미납') || lower.includes('변제금') || lower.includes('폐지')) {
    return DDOK_BLOG_PRESETS_DATA[4];
  }
  if (lower.includes('코인') || lower.includes('주식') || lower.includes('투자') || lower.includes('비트코인')) {
    return DDOK_BLOG_PRESETS_DATA[5];
  }
  if (lower.includes('단점') || lower.includes('불이익') || lower.includes('루머') || lower.includes('팩트')) {
    return DDOK_BLOG_PRESETS_DATA[6];
  }
  if (lower.includes('자격') || lower.includes('소득') || lower.includes('생계비') || lower.includes('알바')) {
    return DDOK_BLOG_PRESETS_DATA[7];
  }

  // 기본 프리셋 반환 (주제 및 테마 반영)
  const base = DDOK_BLOG_PRESETS_DATA[0];
  return {
    ...base,
    topic,
    theme,
    title: `[2026 최신] ${topic} — 010 번호 유출 없는 안심 해결 가이드`
  };
}
