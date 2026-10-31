/**
 * 마케팅 오토파일럿 허브 - 네이버 블로그 칼럼 + 본문 이미지 4컷 (프리셋 스튜디오)
 *
 * - 예시 원고(DDOK_BLOG_PRESETS_DATA): 운영자가 직접 작성한 견본이다. AI 생성물이 아니다.
 * - AI 생성(generateBlogContentWithGemini): 서버(/api/generate-statement mode=marketing)가 환경변수 키로 호출한다.
 *   실패하면 예외를 던진다 (예시 원고로 몰래 바꾸지 않는다).
 * - 이미지 배경은 CSS 그라데이션만 쓴다 (외부 무료 이미지 서비스는 상업 이용이 보장되지 않아 삭제, M0).
 *
 * 문구 원칙 (변호사법 제34조·제109조, 변호사 광고 규정):
 * - 플랫폼은 변호사를 매칭·배정·추천하지 않는다. 의뢰인이 최대 3명을 직접 골라 상담을 요청한다.
 * - 결과(탕감·감면율·인가)를 약속하지 않는다. 인가·면책은 법원이 사건별로 판단한다.
 * - 근거 없는 수치·후기·사례를 쓰지 않는다. 사례가 필요하면 '예시'로 표시한다.
 */

import { getAuthHeaders } from '../supabaseClient';
import { MARKETING_DISCLAIMER, type ChannelCompliance } from './marketingAutopilotService';

export interface BlogImageItem {
  id: string;
  order: number;
  title: string;
  role: string;
  insertPosition: string;
  /** 직접 이미지를 만들 때 참고할 영문 프롬프트 (복사용) */
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
  /** 'preset' = 직접 작성한 예시 원고, 'ai' = 서버 AI가 만든 초안 */
  source: 'preset' | 'ai';
  /** AI 초안일 때 서버가 알려 준 모델 이름 (응답에 있을 때만) */
  model?: string;
  /** AI 초안일 때 서버가 돌려준 규칙 검사 결과 */
  compliance?: ChannelCompliance;
}

// ─── 예시 원고 공통 부품 ───

const BASE_HASHTAGS = ['#개인회생', '#개인파산', '#신용회복', '#스텔스가명', '#마이김변'];

const PRESET_SPECS: { label: string; value: string }[] = [
  { label: '원고 종류', value: '예시 원고 (직접 작성한 견본, AI 생성 아님)' },
  { label: '삽입 이미지', value: '4컷 (그라데이션 배경 + 한글 문구)' },
  { label: '게시 전 확인', value: '법원 실무·기준 금액은 게시 시점 기준으로 다시 확인' },
];

/** 모든 예시 원고 끝에 붙는 플랫폼 안내 (사실만) */
const PLATFORM_SECTION = `■ 마이김변에서 할 수 있는 일
- '내 상황 체크하기'(약 3분)에서 스텔스 가명으로 채무·소득 정보를 정리해요. 이 단계에서 월 변제금이나 감면율을 알려 드리지는 않아요. 판단은 변호사가 합니다.
- 변호사 프로필을 보고 상담받고 싶은 변호사를 최대 3명까지 직접 골라 상담을 요청해요. 마이김변이 변호사를 대신 정하거나 골라 드리지 않아요.
- 010 번호는 내가 공개를 허락하기 전까지 변호사에게 보이지 않아요.`;

const DISCLAIMER_LINE = `※ ${MARKETING_DISCLAIMER}`;

const TAGS = ['대표 썸네일 (1080x1080)', '설명 도표', '이용 화면 예시', '안내 배너'];
const ROLES = ['검색 결과에 보이는 대표 이미지', '본문 내용을 한눈에 정리하는 도표', '마이김변 이용 순서를 보여 주는 화면 예시', '글 끝 안내 배너'];
const POSITIONS = ['본문 최상단 (서론 전)', '1번 섹션 아래', '2번 섹션 아래', '본문 끝 (안내문 직전)'];

/** [제목, 미리보기 제목, 미리보기 부제, 참고 프롬프트] 4개로 이미지 4컷을 만든다 */
function makeImages(prefix: string, gradients: [string, string, string, string], cards: [string, string, string, string][]): BlogImageItem[] {
  return cards.slice(0, 4).map(([title, previewTitle, previewSub, prompt], idx) => ({
    id: `${prefix}-img-${idx + 1}`,
    order: idx + 1,
    title,
    role: ROLES[idx],
    insertPosition: POSITIONS[idx],
    prompt,
    previewGradient: gradients[idx],
    previewTitle,
    previewSub,
    tag: TAGS[idx],
  }));
}

const CTA_CARD: [string, string, string, string] = [
  '안내 배너: 내 상황 체크하기와 변호사 직접 선택',
  '내 상황부터 정리해 보세요',
  '스텔스 가명으로 정리하고, 변호사는 최대 3명까지 직접 골라요',
  'Calm horizontal banner, soft navy and emerald gradient, simple shield outline icon, plenty of empty space, no text, no people',
];

// --- 예시 원고 8종 (직접 작성한 견본) ---
export const DDOK_BLOG_PRESETS_DATA: BlogContentData[] = [
  {
    presetKey: 'card-credit',
    label: '카드/신용',
    topic: '개인회생을 신청하면 신용카드는 어떻게 되나요? 카드 이용과 신용 회복 정리',
    theme: '제도 일반 정보',
    title: '개인회생을 신청하면 신용카드는 어떻게 되나요? 카드 이용과 신용 회복 정리',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '개인회생을 신청할 때 신용카드 이용이 어떻게 바뀌는지, 체크카드와 통장은 어떻게 쓰는지, 면책 뒤 신용 회복은 어떤 순서인지 일반 정보로 정리했어요.',
    answerFirst: [
      '1. 개인회생을 신청하면 카드사 약관과 채권자 조치에 따라 신용카드 이용이 대부분 멈춰요. 이미 연체 중이면 신청 전부터 정지된 경우도 많아요.',
      '2. 체크카드와 입출금 통장은 잔액 범위 안에서 쓸 수 있는 경우가 많지만, 빚이 있는 은행의 계좌는 상계·압류 문제를 미리 확인해야 해요.',
      '3. 신용 회복 시점과 방법은 면책 결정 뒤 금융기관·신용정보 기준에 따라 달라요. 내 사건 기준은 상담하는 변호사에게 확인하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
"개인회생을 신청하면 당장 카드를 못 쓰게 되나요?" 신청을 앞두고 가장 많이 나오는 질문이에요. 이 글은 신용카드와 일상 금융 거래가 어떻게 바뀌는지 일반적인 흐름을 정리한 정보성 글입니다. 사람마다 채무 구성과 연체 상황이 달라서, 실제 내 경우는 상담하는 변호사에게 확인하는 것이 가장 정확해요.

■ 1. 신용카드는 언제 멈추나요?
- 개인회생을 신청하면 채권자인 카드사가 신청 사실을 알게 되고, 약관에 따라 카드 이용과 한도가 정리되는 경우가 대부분이에요.
- 이미 연체가 있다면 신청 전부터 카드가 정지돼 있는 경우도 많아요.
- 후불 교통카드 기능도 함께 멈출 수 있으니 선불 교통카드나 체크카드 교통 기능을 미리 준비해 두면 좋아요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 체크카드와 통장은 쓸 수 있나요?
- 잔액 범위 안에서 결제되는 체크카드는 계속 쓰는 경우가 많아요.
- 다만 빚이 남아 있는 은행의 통장은 그 은행이 예금과 대출을 상계하거나 압류가 들어올 수 있어요. 급여 통장을 어느 은행으로 둘지는 신청 전에 변호사와 상의하세요.
- 가족 명의 카드는 가족 본인의 계약이라 내 신청만으로 바로 정지되지는 않지만, 내가 그 카드 대금의 보증을 섰거나 내 명의 카드를 가족이 쓰는 경우는 달라질 수 있어요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 3. 면책 뒤 신용은 어떻게 회복되나요?
- 변제계획에 따라 변제를 마치고 법원의 면책 결정을 받으면, 남은 채무에 대한 책임이 면제돼요. 인가와 면책은 법원이 사건별로 판단해요.
- 관련 기록이 정리되는 시점과 방법은 신용정보 기준에 따라 달라요. 기록이 정리된 뒤에는 체크카드 사용, 공과금 성실 납부처럼 작은 금융 이력을 꾸준히 쌓는 것이 도움이 돼요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('card', [
      'from-blue-950 via-slate-900 to-indigo-950',
      'from-slate-900 via-indigo-950/60 to-slate-950',
      'from-indigo-950 via-slate-900 to-cyan-950',
      'from-indigo-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 개인회생과 신용카드', '개인회생 신청 후 신용카드는?', '카드 이용·체크카드·신용 회복 일반 정보', 'Calm desk scene with a plain debit card and a notebook, soft daylight, muted navy tones, no text, no logos'],
      ['설명 도표: 신청 전후 카드·통장 이용 변화', '신청 전후, 무엇이 달라지나요', '신용카드 · 체크카드 · 급여 통장 확인 포인트', 'Minimal flat infographic layout with three simple columns and icons, navy and slate palette, no text'],
      ['이용 화면 예시: 내 상황 체크하기', '스텔스 가명으로 정리하기', '채무·소득 정보 정리 (결과 수치는 보여 주지 않아요)', 'Simple smartphone mockup with an abstract form screen, dark mode, soft glow, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#신용카드'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'rent-loan',
    label: '전세·담보대출',
    topic: '전세대출이나 주택담보대출이 있으면 개인회생을 할 수 있나요?',
    theme: '제도 일반 정보',
    title: '전세대출·주택담보대출이 있을 때 개인회생, 무엇을 먼저 확인할까요?',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '주택담보대출(별제권)과 전세보증금·전세대출이 개인회생에서 어떻게 다뤄지는지, 신청 전에 무엇을 확인해야 하는지 일반 정보로 정리했어요.',
    answerFirst: [
      '1. 주택담보대출은 담보권자가 회생 절차와 별도로 담보권을 행사할 수 있는 별제권 채권이에요. 집을 지킬 수 있는지는 담보 대출 상환 여부와 사건 내용에 따라 달라요.',
      '2. 전세보증금은 내 재산으로 재산목록에 올라가요. 일부는 면제재산 신청을 검토할 수 있어요.',
      '3. 전세대출의 질권 설정·채권양도 여부에 따라 만기 때 보증금 처리가 달라지니 대출 계약서를 먼저 확인하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
"개인회생을 신청하면 지금 사는 집에서 나가야 하나요?" 주거 문제는 신청을 망설이게 하는 큰 이유예요. 이 글은 주택담보대출과 전세대출이 개인회생에서 어떻게 다뤄지는지 일반적인 내용을 정리한 글입니다. 실제 처리는 대출 계약 내용과 법원 판단에 따라 달라요.

■ 1. 주택담보대출: 별제권이란?
- 집을 담보로 잡은 대출은 '별제권' 채권이에요. 담보권자는 회생 절차와 별도로 경매 등 담보권을 행사할 수 있어요.
- 담보 대출을 계속 갚을 수 있는지, 담보로 다 갚지 못하는 금액이 얼마나 되는지에 따라 변제계획이 달라져요.
- 집을 지킬 수 있는지는 담보권자와 법원의 판단, 상환 여력에 따라 사건마다 달라요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 전세보증금과 전세대출
- 전세보증금은 돌려받을 내 재산이라 재산목록에 올라가고, 청산가치 계산에 영향을 줄 수 있어요.
- 주택임대차보호법상 우선해서 돌려받을 수 있는 범위 안에서는 면제재산 신청을 검토할 수 있어요.
- 전세대출에 질권 설정이나 채권양도 통지가 돼 있으면 만기 때 보증금이 은행으로 바로 갈 수 있어요. 대출 계약서와 통지서를 먼저 확인하세요.
- 보증서 대출은 만기 연장 심사에서 신청 사실이 영향을 줄 수 있어요. 만기 일정은 신청 전에 변호사와 상의하세요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 3. 집주인에게 연락이 가나요?
- 집주인이 채권자가 아니라면 법원이 집주인에게 신청 사실을 따로 알리지는 않는 것이 일반적이에요.
- 다만 보증금을 둘러싼 질권·양도 관계가 있으면 은행과 집주인 사이에 확인 연락이 오갈 수 있어요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('rent', [
      'from-emerald-950 via-slate-900 to-teal-950',
      'from-slate-900 via-teal-950/50 to-slate-950',
      'from-teal-950 via-slate-900 to-sky-950',
      'from-teal-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 전세·담보대출과 개인회생', '전세·담보대출이 있을 때 개인회생', '별제권 · 전세보증금 · 확인할 서류', 'Warm quiet apartment living room, house keys on a wooden table, soft evening light, no text, no people'],
      ['설명 도표: 담보대출과 일반 채무의 차이', '담보대출과 일반 채무, 무엇이 다른가요', '별제권 채권은 회생 절차와 별도로 처리돼요', 'Minimal flowchart shapes with two branches, teal and slate palette, flat vector, no text'],
      ['이용 화면 예시: 재산·채무 정리', '전세보증금도 함께 정리해요', '스텔스 가명으로 재산·채무를 기록하기', 'Simple smartphone mockup with abstract list rows, dark mode, teal accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#전세보증금'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'stealth-privacy',
    label: '스텔스가명',
    topic: '상담 신청할 때 내 번호가 어디로 가는지 걱정된다면: 스텔스 가명 이용법',
    theme: '스텔스 가명·개인정보 보호',
    title: '상담 신청할 때 내 번호가 걱정된다면: 마이김변 스텔스 가명 이용법',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '상담 신청서에 연락처를 남기기 전에 확인할 점과, 마이김변의 스텔스 가명이 연락처를 어떻게 다루는지 기능 사실 그대로 정리했어요.',
    answerFirst: [
      '1. 상담 신청서에 연락처를 남기기 전에, 그 연락처를 누가 받고 어떤 목적으로 쓰는지 개인정보 처리 안내를 먼저 확인하세요.',
      '2. 마이김변에서는 스텔스 가명으로 상담을 시작하고, 010 번호는 내가 공개를 허락하기 전까지 변호사에게 보이지 않아요.',
      '3. 상담받을 변호사는 프로필을 보고 최대 3명까지 내가 직접 골라요. 마이김변이 변호사를 대신 정하거나 골라 드리지 않아요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
빚 문제로 상담을 알아볼 때 "번호를 남기면 여기저기서 전화가 오지 않을까" 걱정하는 분이 많아요. 이 글은 상담 신청 전에 확인할 개인정보 항목과, 마이김변의 스텔스 가명이 연락처를 어떻게 다루는지 정리한 글입니다.

■ 1. 연락처를 남기기 전에 확인할 것
- 신청서를 받는 곳이 법률사무소인지, 광고 대행 업체인지 확인하세요.
- 개인정보 처리 안내에서 '제3자 제공' 항목이 있는지, 누구에게 무엇을 주는지 읽어 보세요.
- 동의는 항목별로 나뉘어 있는지, 선택 항목을 빼고도 신청할 수 있는지 확인하세요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 스텔스 가명은 이렇게 동작해요
- 로그인하면 실명 대신 쓸 스텔스 가명이 정해지고, 상담 요청과 대화는 가명으로 진행돼요(100% 익명).
- 변호사는 내가 동의한 정리 자료만 볼 수 있어요.
- 010 번호와 실명은 내가 공개를 허락한 뒤에만 변호사에게 보여요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 3. 변호사는 내가 직접 골라요
- 변호사 프로필(사무소, 지역, 소개)을 보고 상담받고 싶은 변호사를 최대 3명까지 직접 골라 상담을 요청해요.
- 마이김변의 수익은 변호사의 정액 광고비뿐이고, 상담 건당 과금이나 연락처 판매가 없어요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('stealth', [
      'from-purple-950 via-slate-900 to-indigo-950',
      'from-slate-900 via-purple-950/50 to-slate-950',
      'from-purple-950 via-slate-900 to-blue-950',
      'from-purple-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 스텔스 가명 이용법', '내 번호가 걱정된다면', '스텔스 가명으로 시작하는 상담 요청', 'Soft abstract padlock shape over a dark purple gradient, gentle glow, minimal, no text'],
      ['설명 도표: 상담 신청 전 개인정보 확인 항목', '연락처 남기기 전 확인할 3가지', '받는 곳 · 제3자 제공 · 동의 항목', 'Minimal checklist layout with three rows, purple and slate palette, flat vector, no text'],
      ['이용 화면 예시: 번호 공개 허락', '번호 공개는 내가 정해요', '허락하기 전까지 010 번호는 변호사에게 보이지 않아요', 'Simple smartphone mockup with an abstract toggle switch, dark mode, purple accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#개인정보보호'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'doc-innovation',
    label: '서류준비',
    topic: '개인회생 서류는 왜 이렇게 많을까요? 종류별로 무엇을 확인하는지 정리',
    theme: '서류 준비 안내',
    title: '개인회생 서류, 종류별로 무엇을 확인하는 걸까요?',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '개인회생 신청에 필요한 서류가 왜 많은지, 신분·소득·재산·채무 서류가 각각 무엇을 확인하는지 일반 정보로 정리했어요.',
    answerFirst: [
      '1. 법원은 소득·재산·채무를 서류로 확인해 변제계획을 심사해요. 그래서 서류 종류가 많아요.',
      '2. 서류는 크게 신분·가족, 소득, 재산, 채무 네 묶음으로 나뉘어요.',
      '3. 필요한 서류와 발급 시기는 사건과 관할 법원에 따라 달라요. 상담한 사무소의 안내 목록을 기준으로 준비하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
개인회생을 준비하다 보면 서류 목록을 보고 놀라는 분이 많아요. 서류가 많은 이유는 법원이 신청인의 소득·재산·채무를 서류로 확인해 변제계획이 적정한지 심사하기 때문이에요. 이 글은 서류 묶음별로 무엇을 확인하는지 정리한 정보성 글입니다.

■ 1. 신분·가족 서류
- 주민등록등본·초본, 가족관계증명서 등으로 주소 이력과 부양가족을 확인해요.
- 부양가족 수는 생계비 계산에 영향을 줄 수 있어요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 소득 서류
- 급여소득자는 원천징수영수증·급여명세서, 사업자는 소득 신고 자료 등으로 매달 들어오는 소득을 확인해요.
- 고용 형태보다 계속해서 반복적으로 들어오는 소득인지가 중요해요.

■ 3. 재산 서류
- 예금 잔액, 보험 해약환급금, 자동차, 부동산, 임차보증금 등을 확인해요.
- 재산은 청산가치 계산에 쓰여요.

■ 4. 채무 서류
- 금융기관별 부채증명서로 채권자와 채무 금액, 기준일을 확인해요.
- 부채증명서는 기관마다 발급 방법과 기간이 달라서 일정에 여유를 두는 것이 좋아요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 준비 순서 팁
먼저 '내 상황 체크하기'로 채무·소득 정보를 정리해 두면, 변호사와 상담할 때 무엇을 더 준비해야 할지 이야기하기 쉬워져요. 실제 서류 목록과 발급 시기는 상담한 사무소의 안내를 기준으로 하세요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('doc', [
      'from-cyan-950 via-slate-900 to-blue-950',
      'from-slate-900 via-cyan-950/50 to-slate-950',
      'from-cyan-950 via-slate-900 to-indigo-950',
      'from-cyan-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 개인회생 서류 묶음 정리', '개인회생 서류, 왜 많을까요?', '신분·가족 · 소득 · 재산 · 채무 네 묶음', 'Neatly stacked document folders on a clean desk, soft daylight, cyan and slate tones, no text'],
      ['설명 도표: 서류 네 묶음과 확인하는 내용', '서류 네 묶음, 무엇을 확인하나요', '소득은 변제계획, 재산은 청산가치 확인에 쓰여요', 'Minimal four-quadrant diagram with simple icons, cyan palette, flat vector, no text'],
      ['이용 화면 예시: 내 상황 체크하기', '상담 전에 내 상황 정리', '정리한 내용은 내가 동의한 변호사만 봐요', 'Simple smartphone mockup with abstract checklist screen, dark mode, cyan accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#회생서류'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'unpaid-payment',
    label: '변제금미납',
    topic: '개인회생 변제금을 내지 못했을 때 알아 둘 절차: 변경·특별면책·폐지',
    theme: '인가 후 변제 관리',
    title: '개인회생 변제금을 내지 못하게 됐을 때 알아 둘 절차',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '인가 뒤 실직·질병 등으로 변제금을 내기 어려워졌을 때 법이 정한 절차(변제계획 변경, 특별면책)와 미납이 이어질 때의 폐지 위험을 일반 정보로 정리했어요.',
    answerFirst: [
      '1. 인가된 변제계획을 지키지 못하는 상태가 이어지면 법원이 절차를 폐지할 수 있어요. 처리 기준은 법원과 사건마다 달라요.',
      '2. 소득이 줄었다면 변제계획 변경을, 책임 없는 사유로 변제를 이어 갈 수 없다면 요건에 따라 특별면책을 검토할 수 있어요.',
      '3. 미납이 생길 것 같으면 미루지 말고 담당 변호사에게 먼저 알리세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
인가를 받고 성실히 변제하다가도 실직이나 질병으로 변제금을 내기 어려워질 수 있어요. 이 글은 그럴 때 법이 정한 절차를 일반적으로 정리한 글입니다. 실제로 어떤 절차가 맞는지는 사건 기록과 법원 판단에 따라 달라요.

■ 1. 미납이 이어지면 어떻게 되나요?
- 채무자가 인가된 변제계획을 지키지 못하는 상태가 이어지면, 법원은 절차를 폐지할 수 있어요.
- 법원은 보통 미납 사유와 앞으로의 납부 계획을 소명할 기회를 줘요. 법원에서 오는 서류는 기한을 꼭 확인하세요.
- 몇 번 미납하면 폐지되는지는 정해진 숫자로 말하기 어렵고, 법원과 사건마다 달라요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 법이 정한 대응 절차
1) 변제계획 변경: 소득이 줄었거나 사정이 바뀌었다면, 남은 기간의 변제계획을 바꿔 달라고 신청할 수 있어요.
2) 특별면책: 채무자에게 책임이 없는 사유로 변제를 끝낼 수 없고, 법이 정한 요건(이미 변제한 금액이 청산가치 이상인지 등)을 갖추면 면책을 신청할 수 있어요.
3) 폐지 결정 이후: 결정에 대한 불복 절차와 기한, 다시 신청할지는 결정문 내용을 보고 담당 변호사와 상의하세요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 3. 미리 할 수 있는 일
- 납부일을 놓치지 않도록 알림을 받아 두세요. 마이김변 '회생동행'은 인가 뒤 매달 변제금 납부일을 알려 드려요.
- 소득이 바뀌면 바로 담당 변호사에게 알리세요. 일찍 알릴수록 선택할 수 있는 절차가 많아요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('unpaid', [
      'from-rose-950 via-slate-900 to-amber-950',
      'from-slate-900 via-rose-950/40 to-slate-950',
      'from-rose-950 via-slate-900 to-indigo-950',
      'from-rose-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 변제금 미납 때 알아 둘 절차', '변제금을 내기 어려워졌다면', '변제계획 변경 · 특별면책 · 폐지 일반 정보', 'Calm calendar on a desk with a soft lamp, muted rose and amber tones, no text'],
      ['설명 도표: 상황별로 검토하는 절차', '상황에 따라 검토하는 절차', '소득 감소 → 변경 / 책임 없는 사유 → 특별면책', 'Minimal decision tree with three simple boxes, rose and slate palette, flat vector, no text'],
      ['이용 화면 예시: 회생동행 납부일 알림', '매달 납부일을 알려 드려요', '회생동행: 인가 뒤 변제금 납부일 알림', 'Simple smartphone mockup with an abstract calendar reminder, dark mode, rose accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#회생동행'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'crypto-stock',
    label: '코인/주식',
    topic: '주식·코인 투자 손실이 있을 때 개인회생, 법원은 어떻게 볼까요?',
    theme: '제도 일반 정보',
    title: '주식·코인 투자 손실이 있을 때 개인회생, 법원 실무준칙은 어떻게 정하고 있나요?',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '투자 손실이 청산가치에 어떻게 반영되는지에 관한 회생법원 실무준칙의 내용과, 신청 전에 주의할 거래(특정 채권자에게 먼저 갚기 등)를 일반 정보로 정리했어요.',
    answerFirst: [
      '1. 여러 회생법원의 실무준칙은 주식·가상자산 투자로 잃은 돈을 원칙적으로 청산가치에 더하지 않도록 정하고 있어요. 법원마다 예외와 적용이 다를 수 있어요.',
      '2. 투자 손실이 있어도 개인회생 신청 자체가 막히는 것은 아니에요. 인가와 면책은 법원이 사건별로 판단해요.',
      '3. 신청 직전에 특정 채권자에게만 먼저 갚거나 재산을 옮기면 문제가 될 수 있어요. 거래 내역은 변호사와 함께 확인하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
주식이나 가상자산 투자로 손실을 보고 빚이 남은 분들이 "투자 빚도 개인회생이 되나요?"라고 많이 물어요. 이 글은 회생법원 실무준칙이 투자 손실을 어떻게 다루는지 일반적으로 정리한 글입니다.

■ 1. 투자 손실금과 청산가치
- 청산가치는 '지금 파산한다면 채권자에게 나눠 줄 수 있는 재산의 가치'예요. 변제 총액은 원칙적으로 청산가치보다 적으면 안 돼요.
- 서울회생법원 등 여러 회생법원의 실무준칙은 주식·가상자산 투자로 잃은 돈을 원칙적으로 청산가치에 더하지 않는다고 정하고 있어요.
- 다만 법원에 따라 자금 출처나 손실 경위를 함께 보는 경우가 있어요. 관할 법원의 기준은 상담하는 변호사에게 확인하세요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 남아 있는 투자 자산은?
- 지금 남아 있는 주식·가상자산은 내 재산이라 재산목록에 올라가요.
- 신청 전후로 큰 금액을 사고팔면 그 경위를 설명해야 할 수 있어요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 3. 신청 전에 주의할 거래
- 신청 직전에 특정 채권자(가족·지인 포함)에게만 먼저 갚으면 '편파변제'로 문제가 될 수 있어요.
- 재산을 다른 사람 명의로 옮기는 일도 피하세요.
- 최근 거래 내역은 상담 때 변호사와 함께 확인하는 것이 좋아요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('crypto', [
      'from-amber-950 via-slate-900 to-slate-950',
      'from-slate-900 via-amber-950/40 to-slate-950',
      'from-amber-950 via-slate-900 to-blue-950',
      'from-amber-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 투자 손실과 개인회생', '투자 손실이 있을 때 개인회생', '회생법원 실무준칙 일반 정보', 'Abstract soft line chart in the background with a simple balance scale silhouette, muted amber tones, no text'],
      ['설명 도표: 청산가치에 들어가는 것과 안 들어가는 것', '청산가치, 무엇이 들어가나요', '남아 있는 자산은 포함 · 잃은 돈은 원칙적으로 제외', 'Minimal two-column comparison layout, amber and slate palette, flat vector, no text'],
      ['이용 화면 예시: 채무·재산 정리', '투자 내역도 함께 정리해요', '스텔스 가명으로 채무·재산 기록하기', 'Simple smartphone mockup with abstract list rows, dark mode, amber accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#투자손실'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'disadvantage-overcome',
    label: '단점·주의점',
    topic: '개인회생을 시작하기 전에 알아 둘 불편한 점과 준비 방법',
    theme: '변호사 직접 선택',
    title: '개인회생을 시작하기 전에 알아 둘 불편한 점과 준비 방법',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '개인회생 기간에 감수해야 하는 불편(신용 거래 제한, 긴 변제 기간, 서류 준비 등)과 미리 준비할 수 있는 방법을 숨김없이 정리했어요.',
    answerFirst: [
      '1. 변제 기간에는 신용카드와 새 대출을 쓰기 어려워요. 체크카드 위주로 생활을 정리해 두면 좋아요.',
      '2. 변제 기간은 보통 3년이고 사건에 따라 달라요. 그 기간 동안 매달 정해진 변제금을 내야 해요.',
      '3. 직장·가족에게 알려질지 걱정된다면 송달 장소와 급여 압류 여부를 상담 때 먼저 확인하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
개인회생은 법이 정한 채무 정리 절차이지만, 일정 기간 감수해야 하는 불편도 있어요. 좋은 점만 듣고 시작하면 중간에 힘들어질 수 있어서, 불편한 점과 준비 방법을 함께 정리했어요.

■ 1. 신용 거래 제한
- 변제 기간에는 신용카드와 새 신용대출을 쓰기 어려워요.
- 준비: 체크카드와 선불 교통카드로 생활비 흐름을 미리 바꿔 두세요.

■ 2. 긴 변제 기간
- 변제 기간은 보통 3년이고, 사건에 따라 달라질 수 있어요. 그 기간 동안 매달 변제금을 성실히 내야 해요.
- 준비: 생활비 항목을 미리 정리하고, 납부일 알림을 받아 두세요. 인가 뒤에는 '회생동행'이 매달 납부일을 알려 드려요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 3. 서류 준비
- 소득·재산·채무를 확인하는 서류가 많고, 부채증명서는 발급에 시간이 걸리기도 해요.
- 준비: '내 상황 체크하기'로 채무·소득 정보를 먼저 정리해 두면 상담 때 필요한 서류를 이야기하기 쉬워요.

■ 4. 직업과 자격
- 개인회생은 개인파산과 달리 법령상 자격 제한 사유가 아닌 경우가 많지만, 직장 규정이나 개별 법령은 따로 확인이 필요해요.

■ 5. 주변에 알려질지에 대한 걱정
- 법원 서류는 신청서에 적은 송달 장소로 가요. 대리인이 있으면 대리인 사무소로 받는 경우가 많아요.
- 이미 급여 압류가 들어와 있다면 회사가 알고 있을 수 있어요. 이런 사정은 상담 때 먼저 말씀해 주세요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 변호사는 직접 비교해 보고 고르세요
변호사 프로필을 보고 상담받고 싶은 변호사를 최대 3명까지 직접 골라 상담을 요청할 수 있어요. 수임 조건과 진행 방식은 상담하면서 각 사무소에 직접 확인하세요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('dis', [
      'from-slate-900 via-indigo-950 to-slate-900',
      'from-slate-900 via-indigo-950/40 to-slate-950',
      'from-indigo-950 via-slate-900 to-purple-950',
      'from-indigo-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 개인회생 전에 알아 둘 불편한 점', '시작 전에 알아 둘 불편한 점', '신용 거래 · 변제 기간 · 서류 · 자격 · 송달', 'Calm notebook with a simple checklist and a pen, soft daylight, indigo tones, no text'],
      ['설명 도표: 불편한 점과 준비 방법', '불편한 점, 이렇게 준비해요', '체크카드 · 납부일 알림 · 미리 정리하기', 'Minimal two-column table shapes with simple icons, indigo palette, flat vector, no text'],
      ['이용 화면 예시: 변호사 프로필 보기', '변호사는 내가 직접 골라요', '프로필을 보고 최대 3명까지 상담 요청', 'Simple smartphone mockup with abstract profile cards, dark mode, indigo accent, no text, no faces'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#개인회생준비'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
  {
    presetKey: 'eligibility-check',
    label: '소득·생계비',
    topic: '개인회생 변제금은 어떻게 정해질까요? 소득과 생계비의 관계',
    theme: '주말에 내 상황 정리하기',
    title: '개인회생 변제금은 어떻게 정해질까요? 소득·생계비·청산가치의 관계',
    badge: '네이버 블로그 정보성 칼럼 + 이미지 4컷 (예시 원고)',
    format: '네이버 블로그 스마트에디터용 (대표 썸네일 1컷 + 본문 이미지 3컷)',
    summary: '개인회생 변제금이 소득, 생계비, 청산가치로 어떻게 정해지는지 원리를 정리하고, 직접 숫자를 넣어 볼 수 있는 제도 이해용 계산기를 안내해요.',
    answerFirst: [
      '1. 월 변제금은 기본적으로 매달 소득에서 법원이 인정하는 생계비를 뺀 금액을 기준으로 정해져요.',
      '2. 생계비는 보건복지부가 고시하는 기준 중위소득의 일정 비율을 바탕으로 법원이 정하고, 가구원 수와 법원 실무에 따라 달라져요.',
      '3. 아르바이트·프리랜서 소득도 계속해서 반복적으로 들어온다면 소득으로 볼 수 있어요. 내 경우는 변호사에게 확인하세요.',
    ],
    fullBody: `[📷 이미지 1: 대표 썸네일 삽입 위치]

■ 들어가며
"내 소득으로 개인회생을 할 수 있을까?" 궁금할 때 먼저 알아 두면 좋은 것이 변제금이 정해지는 원리예요. 이 글은 일반적인 계산 원리를 정리한 글이고, 실제 변제금은 사건 자료를 본 변호사와 법원 판단에 따라 정해져요.

■ 1. 기본 원리: 소득 − 생계비
- 매달 들어오는 소득에서 법원이 인정하는 생계비를 뺀 금액(가용소득)이 월 변제금의 기준이에요.
- 생계비는 보건복지부가 매년 고시하는 기준 중위소득의 일정 비율을 바탕으로 정해지고, 가구원 수와 법원 실무, 추가 생계비 인정 여부에 따라 달라져요.

[📷 이미지 2: 설명 도표 삽입 위치]

■ 2. 청산가치도 함께 봐요
- 변제 총액은 원칙적으로 청산가치(지금 파산하면 나눠 줄 재산의 가치)보다 적으면 안 돼요.
- 그래서 소득이 같아도 재산 상황에 따라 변제금이 달라질 수 있어요.

■ 3. 고용 형태보다 중요한 것
- 아르바이트, 프리랜서, 일용직 소득도 계속해서 반복적으로 들어온다면 소득으로 볼 수 있어요.
- 통장 입금 내역, 소득 확인 자료 등으로 소득을 보여 줘야 해요.
- 채무 금액에는 법이 정한 한도(담보·무담보 채무별 상한)가 있어요.

[📷 이미지 3: 이용 화면 예시 삽입 위치]

■ 직접 숫자를 넣어 보고 싶다면
마이김변의 '제도 이해용 계산기'는 변제금이 어떤 요소로 정해지는지 넓은 범위로 보여 주는 학습용 도구예요. 결과는 저장되거나 변호사에게 보내지지 않아요. 실제 변제금은 변호사가 사건 자료를 보고 검토해요.

${PLATFORM_SECTION}

[📷 이미지 4: 안내 배너 삽입 위치]

${DISCLAIMER_LINE}`,
    blogImages: makeImages('elig', [
      'from-teal-950 via-slate-900 to-emerald-950',
      'from-slate-900 via-teal-950/40 to-slate-950',
      'from-teal-950 via-slate-900 to-sky-950',
      'from-teal-950 via-slate-900 to-emerald-950',
    ], [
      ['대표 썸네일: 변제금이 정해지는 원리', '변제금은 어떻게 정해질까요', '소득 · 생계비 · 청산가치의 관계', 'Simple calculator and notebook on a calm desk, soft teal tones, no text'],
      ['설명 도표: 소득에서 생계비를 빼는 원리', '소득 − 생계비 = 가용소득', '변제 총액은 청산가치보다 적으면 안 돼요', 'Minimal bar diagram with two blocks, teal and slate palette, flat vector, no text'],
      ['이용 화면 예시: 제도 이해용 계산기', '제도 이해용 계산기', '넓은 범위로 보여 주는 학습용 도구 (저장·전송 안 함)', 'Simple smartphone mockup with abstract slider controls, dark mode, teal accent, no text'],
      CTA_CARD,
    ]),
    hashtags: [...BASE_HASHTAGS, '#생계비'],
    specs: PRESET_SPECS,
    source: 'preset',
  },
];

/** AI 생성 실패 (화면에 그대로 보여 줄 수 있는 문장) */
export class MarketingAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketingAiError';
  }
}

const AI_GRADIENTS = [
  'from-blue-950 via-slate-900 to-indigo-950',
  'from-slate-900 via-indigo-950/50 to-slate-950',
  'from-indigo-950 via-slate-900 to-cyan-950',
  'from-indigo-950 via-slate-900 to-emerald-950',
];

/**
 * 서버 AI로 주제에 맞는 블로그 칼럼 초안 + 이미지 4컷 기획을 만든다.
 * 실패하면 MarketingAiError를 던진다 (예시 원고로 대체하지 않는다).
 */
export async function generateBlogContentWithGemini(
  topic: string,
  theme: string,
): Promise<BlogContentData> {
  let res: Response;
  try {
    res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'marketing', topic, theme }),
    });
  } catch {
    throw new MarketingAiError('서버에 연결하지 못했습니다. 네트워크 상태를 확인하세요.');
  }
  const json = await res.json().catch(() => null);
  if (!json?.ok || !json.content || typeof json.content !== 'object') {
    if (res.status === 401 || res.status === 403) {
      throw new MarketingAiError('관리자 2단계 인증 세션에서만 AI 생성을 쓸 수 있습니다. 다시 로그인해 주세요.');
    }
    throw new MarketingAiError(typeof json?.error === 'string' && json.error ? json.error : `AI 생성에 실패했습니다 (서버 응답 ${res.status}).`);
  }
  const parsed = json.content;
  const fullBody = typeof parsed.fullBody === 'string' ? parsed.fullBody : '';
  if (!fullBody.trim()) throw new MarketingAiError('AI가 본문을 만들지 못했습니다. 다시 시도해 주세요.');
  const model = typeof json.model === 'string' && json.model ? json.model : undefined;
  const compliance: ChannelCompliance | undefined =
    json.compliance && Array.isArray(json.compliance.issues) ? json.compliance : undefined;

  return {
    presetKey: 'custom-ai',
    label: 'AI 초안',
    topic,
    theme,
    title: typeof parsed.title === 'string' && parsed.title ? parsed.title : topic,
    badge: '네이버 블로그 정보성 칼럼 (AI 초안)',
    format: '네이버 블로그 스마트에디터용 (이미지 4컷 기획 포함)',
    summary: typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : `${topic}에 대한 정보성 칼럼 초안입니다.`,
    answerFirst: Array.isArray(parsed.answerFirst) ? parsed.answerFirst.filter((s: unknown) => typeof s === 'string').slice(0, 3) : [],
    fullBody,
    blogImages: (Array.isArray(parsed.blogImages) ? parsed.blogImages : []).slice(0, 4).map((img: any, idx: number) => ({
      id: `gen-img-${idx + 1}`,
      order: idx + 1,
      title: img?.title || `이미지 ${idx + 1}`,
      role: img?.role || ROLES[idx] || '본문 이미지',
      insertPosition: img?.insertPosition || POSITIONS[idx] || '본문 삽입',
      prompt: img?.prompt || 'Calm professional scene, soft lighting, no text',
      previewGradient: AI_GRADIENTS[idx] || AI_GRADIENTS[0],
      previewTitle: img?.previewTitle || topic,
      previewSub: img?.previewSub || '',
      tag: img?.tag || TAGS[idx] || '본문 이미지',
    })),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((s: unknown) => typeof s === 'string').slice(0, 10) : [...BASE_HASHTAGS],
    specs: [
      { label: '생성', value: model ? `AI 초안 (${model})` : 'AI 초안 (서버 호출)' },
      { label: '삽입 이미지', value: '4컷 기획 (그라데이션 배경 + 한글 문구)' },
      { label: '게시 전 확인', value: '아래 규칙 검사 결과와 사실관계를 사람이 확인한 뒤 게시' },
    ],
    source: 'ai',
    model,
    compliance,
  };
}

/** 관리자: 서버 AI 연결 확인 (키 존재·권한) */
export async function testMarketingAiConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'marketing-ping' }),
    });
    const json = await res.json().catch(() => null);
    if (json?.ok) return { ok: true, message: '서버 AI 키가 설정되어 있습니다.' };
    return { ok: false, message: json?.error || `서버 응답 오류 (${res.status})` };
  } catch {
    return { ok: false, message: '서버에 연결하지 못했습니다.' };
  }
}
