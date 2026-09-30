import { QuickToolId, QuickToolMeta } from './types';

export const ALL_QUICK_TOOLS: QuickToolMeta[] = [
  // ── 계산기 & 시뮬레이터군 ──
  {
    id: 'calculator',
    title: '송달료·인지대 계산기',
    shortTitle: '송달료',
    subtitle: '채권자수별 예납 비용 산출',
    category: 'calculator',
    keywords: ['예납', '법원비용', '인지', '송달', '금지명령', '중지명령', '비용'],
    iconName: 'Calculator',
    colorClass: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      hoverBg: 'group-hover:bg-blue-500',
      border: 'border-blue-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'rehabPayCalc',
    title: '변제율·탕감률 계산기',
    shortTitle: '변제율',
    subtitle: '총변제액·현재가치·최저변제액 점검',
    category: 'calculator',
    badge: '추천',
    keywords: ['탕감', '변제금', '라이프니츠', '현재가치', '최저변제액', '24개월', '36개월', '60개월'],
    iconName: 'Percent',
    colorClass: {
      bg: 'bg-indigo-500/20',
      text: 'text-indigo-400',
      hoverBg: 'group-hover:bg-indigo-500',
      border: 'border-indigo-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'liquidationCalc',
    title: '청산가치 보장 점검기',
    shortTitle: '청산가치',
    subtitle: '법정 공제 반영 · 현재가치 비교',
    category: 'calculator',
    badge: '필수',
    keywords: ['재산', '자산', '예금', '보험', '해약환급금', '퇴직금', '보증금', '배우자', '현가'],
    iconName: 'Coins',
    colorClass: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      hoverBg: 'group-hover:bg-emerald-500',
      border: 'border-emerald-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'interestCompare',
    title: '대출이자 vs 회생변제 비교',
    shortTitle: '이자비교',
    subtitle: '현재 상환 부담과 월 변제금 비교',
    category: 'calculator',
    keywords: ['이자', '금리', '상환', '원리금', '절감'],
    iconName: 'TrendingDown',
    colorClass: {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      hoverBg: 'group-hover:bg-cyan-500',
      border: 'border-cyan-500/30'
    },
    defaultEnabled: false,
  },
  {
    id: 'koreanAge',
    title: '만나이 & 부양자격 판정',
    shortTitle: '만나이',
    subtitle: '부양가족·24개월 특례 연령 확인',
    category: 'calculator',
    badge: '도산특례',
    keywords: ['나이', '생년월일', '미성년', '성년', '부양가족', '청년', '고령', '특례'],
    iconName: 'CalendarCheck',
    colorClass: {
      bg: 'bg-rose-500/20',
      text: 'text-rose-400',
      hoverBg: 'group-hover:bg-rose-500',
      border: 'border-rose-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'deadlineCalc',
    title: '기한·기일 계산기',
    shortTitle: '기한',
    subtitle: '송달일 기준 만료일 · 주말·공휴일 연장',
    category: 'calculator',
    badge: '신규',
    keywords: ['보정', '즉시항고', '이의', '마감', '만료일', '공휴일', '디데이', 'D-day', '송달일'],
    iconName: 'CalendarClock',
    colorClass: {
      bg: 'bg-sky-500/20',
      text: 'text-sky-400',
      hoverBg: 'group-hover:bg-sky-500',
      border: 'border-sky-500/30'
    },
    defaultEnabled: true,
  },

  // ── 법률 실무 기준 & 고시 정보군 ──
  {
    id: 'median',
    title: '2026 기준중위소득표',
    shortTitle: '중위소득',
    subtitle: '가구별 인정생계비 & 가용소득',
    category: 'standards',
    keywords: ['생계비', '60%', '가용소득', '가구원', '공동부양', '0.5인'],
    iconName: 'Users',
    colorClass: {
      bg: 'bg-teal-500/20',
      text: 'text-teal-400',
      hoverBg: 'group-hover:bg-teal-500',
      border: 'border-teal-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'extraExpense',
    title: '추가생계비 검토 참고',
    shortTitle: '추가생계비',
    subtitle: '주거비·의료비·교육비 추가 인정 추정',
    category: 'standards',
    keywords: ['주거비', '월세', '의료비', '교육비', '생계비', '소명'],
    iconName: 'Scale',
    colorClass: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      hoverBg: 'group-hover:bg-purple-500',
      border: 'border-purple-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'seizureLimits',
    title: '압류금지 & 최우선변제금',
    shortTitle: '압류금지',
    subtitle: '예금 185만·급여·소액임차보증금',
    category: 'standards',
    badge: '계산',
    keywords: ['압류', '예금', '급여', '월급', '최우선변제', '소액임차', '보증금', '보험'],
    iconName: 'ShieldAlert',
    colorClass: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      hoverBg: 'group-hover:bg-amber-500',
      border: 'border-amber-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'courtGuidelines',
    title: '법원별 실무 참고 (비공식)',
    shortTitle: '법원참고',
    subtitle: '투자손실금 준칙·24개월 특례 운영',
    category: 'standards',
    badge: '실무',
    keywords: ['회생법원', '관할', '코인', '주식', '특례', '전자소송', '사건검색'],
    iconName: 'Landmark',
    colorClass: {
      bg: 'bg-violet-500/20',
      text: 'text-violet-400',
      hoverBg: 'group-hover:bg-violet-500',
      border: 'border-violet-500/30'
    },
    defaultEnabled: false,
  },
  {
    id: 'legalArticles',
    title: '도산법 핵심 조문 요약',
    shortTitle: '조문',
    subtitle: '기각사유·인가요건·비면책채권',
    category: 'standards',
    keywords: ['법조문', '제595조', '제614조', '제564조', '제593조', '제579조', '제625조', '제566조', '면책', '비면책', '채무한도'],
    iconName: 'BookOpen',
    colorClass: {
      bg: 'bg-blue-600/20',
      text: 'text-blue-300',
      hoverBg: 'group-hover:bg-blue-600',
      border: 'border-blue-600/30'
    },
    defaultEnabled: false,
  },
  {
    id: 'assetValuation',
    title: '토지·주택·차량가액 조회',
    shortTitle: '자산가액',
    subtitle: 'KB시세·공시가격·보험개발원 조회 & 환산',
    category: 'standards',
    badge: '조회/산정',
    keywords: ['부동산', '아파트', '토지', '공시지가', '공시가격', '차량', '시세', 'KB'],
    iconName: 'Building2',
    colorClass: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      hoverBg: 'group-hover:bg-emerald-500',
      border: 'border-emerald-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'creditorSearch',
    title: '채권자 송달주소록 검색',
    shortTitle: '채권자',
    subtitle: '주요 금융기관 송달정보 · 목록 담기',
    category: 'standards',
    badge: '서류필수',
    keywords: ['주소', '송달장소', '은행', '카드', '캐피탈', '대부', '채권자목록', '사업자번호'],
    iconName: 'Contact',
    colorClass: {
      bg: 'bg-indigo-600/20',
      text: 'text-indigo-400',
      hoverBg: 'group-hover:bg-indigo-600',
      border: 'border-indigo-600/30'
    },
    defaultEnabled: true,
  },

  // ── 업무 지원 & 소통 도구군 ──
  {
    id: 'pinMemo',
    title: '사진 & 텍스트 핀 메모',
    shortTitle: '핀메모',
    subtitle: 'Ctrl+V 캡처 이미지 띄우기 & 확대',
    category: 'workflow',
    badge: '추천',
    keywords: ['캡처', '이미지', '사진', '붙여넣기', '확대'],
    iconName: 'Pin',
    colorClass: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      hoverBg: 'group-hover:bg-amber-500',
      border: 'border-amber-500/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'docChecklist',
    title: '맞춤 서류 체크리스트',
    shortTitle: '서류',
    subtitle: '상황별 발급 안내 · 수령 체크',
    category: 'workflow',
    badge: '상담필수',
    keywords: ['준비서류', '발급', '등본', '초본', '카톡', '미제출', '체크리스트'],
    iconName: 'CheckSquare',
    colorClass: {
      bg: 'bg-teal-600/20',
      text: 'text-teal-300',
      hoverBg: 'group-hover:bg-teal-600',
      border: 'border-teal-600/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'virtualAccount',
    title: '변제금 납입 안내문',
    shortTitle: '납입안내',
    subtitle: '사건별 가상계좌 안내문 작성',
    category: 'workflow',
    keywords: ['가상계좌', '변제금', '입금', '계좌', '연체', '회생위원'],
    iconName: 'CreditCard',
    colorClass: {
      bg: 'bg-amber-600/20',
      text: 'text-amber-300',
      hoverBg: 'group-hover:bg-amber-600',
      border: 'border-amber-600/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'quickMemo',
    title: '상담 퀵 스크래치패드',
    shortTitle: '메모',
    subtitle: '상담 메모 · 계산 결과 요약 삽입',
    category: 'workflow',
    badge: '편리',
    keywords: ['메모', '요약', '템플릿', '상담기록', '스크래치'],
    iconName: 'FileText',
    colorClass: {
      bg: 'bg-emerald-600/20',
      text: 'text-emerald-300',
      hoverBg: 'group-hover:bg-emerald-600',
      border: 'border-emerald-600/30'
    },
    defaultEnabled: true,
  },
  {
    id: 'alimtok',
    title: '모바일 알림톡 전송',
    shortTitle: '알림톡',
    subtitle: '의뢰인 안내 발송 (CRM으로 이동)',
    category: 'workflow',
    keywords: ['카카오', '문자', '발송', '알림'],
    iconName: 'Send',
    colorClass: {
      bg: 'bg-rose-500/20',
      text: 'text-rose-400',
      hoverBg: 'group-hover:bg-rose-500',
      border: 'border-rose-500/30'
    },
    defaultEnabled: true,
    isActionOnly: true,
  },
];

export const DEFAULT_ENABLED_TOOL_IDS = ALL_QUICK_TOOLS
  .filter(t => t.defaultEnabled)
  .map(t => t.id);

/**
 * 이번 업그레이드 이전부터 있던 도구 (2026-09-30 기준)
 * 저장된 도구 구성이 있는 사용자에게 새로 추가된 기본 도구를 한 번 자동으로 켜 주기 위한 기준 목록.
 */
export const LEGACY_TOOL_IDS: QuickToolId[] = [
  'calculator', 'median', 'extraExpense', 'virtualAccount', 'alimtok', 'rehabPayCalc',
  'liquidationCalc', 'courtGuidelines', 'seizureLimits', 'quickMemo', 'interestCompare',
  'legalArticles', 'assetValuation', 'koreanAge', 'creditorSearch', 'docChecklist', 'pinMemo',
];

export const CATEGORY_LABELS: Record<string, string> = {
  calculator: '계산기 & 시뮬레이터',
  standards: '법률 실무기준 & 고시',
  workflow: '업무 지원 & 소통 도구',
};

/** 메뉴 검색: 제목·짧은 이름·설명·검색어에서 공백을 무시하고 찾는다 */
export function matchesToolQuery(tool: QuickToolMeta, query: string): boolean {
  const q = query.replace(/\s+/g, '').toLowerCase();
  if (!q) return true;
  const haystack = [tool.title, tool.shortTitle, tool.subtitle, tool.badge || '', ...(tool.keywords || [])]
    .join('|')
    .replace(/\s+/g, '')
    .toLowerCase();
  return haystack.includes(q);
}
