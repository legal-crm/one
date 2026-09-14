import { QuickToolMeta } from './types';

export const ALL_QUICK_TOOLS: QuickToolMeta[] = [
  // ── 계산기 & 시뮬레이터군 ──
  {
    id: 'calculator',
    title: '송달료·인지대 계산기',
    subtitle: '채권자수별 실비 즉시 산출',
    category: 'calculator',
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
    title: '탕감률 & 총변제액 계산기',
    subtitle: '원금 대비 탕감률 & 월납입 즉석 브리핑',
    category: 'calculator',
    badge: '추천',
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
    subtitle: '자산합계 vs 총변제액 충족 판정',
    category: 'calculator',
    badge: '필수',
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
    subtitle: '기존 금융이자 부담과 절감액 비교',
    category: 'calculator',
    iconName: 'TrendingDown',
    colorClass: {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      hoverBg: 'group-hover:bg-cyan-500',
      border: 'border-cyan-500/30'
    },
    defaultEnabled: false,
  },

  // ── 법률 실무 기준 & 고시 정보군 ──
  {
    id: 'median',
    title: '2026 기준중위소득표',
    subtitle: '가구별 60% 생계비 & 가용소득',
    category: 'standards',
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
    title: '추가생계비 실무준칙',
    subtitle: '주거비·의료비·교육비 한도',
    category: 'standards',
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
    subtitle: '예금 185만·급여·소액임차보증금',
    category: 'standards',
    badge: '최신',
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
    title: '전국 법원별 실무성향',
    subtitle: '코인·주식 준칙 & 금지명령 기간',
    category: 'standards',
    badge: '실무',
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
    subtitle: '기각사유(§595)·면책불허가(§564)',
    category: 'standards',
    iconName: 'BookOpen',
    colorClass: {
      bg: 'bg-blue-600/20',
      text: 'text-blue-300',
      hoverBg: 'group-hover:bg-blue-600',
      border: 'border-blue-600/30'
    },
    defaultEnabled: false,
  },

  // ── 업무 지원 & 소통 도구군 ──
  {
    id: 'virtualAccount',
    title: '변제금 납입계좌 뷰어',
    subtitle: '법원 가상계좌 복사 & 연체 주의',
    category: 'workflow',
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
    subtitle: '전화 상담 중 플로팅 메모 & 복사',
    category: 'workflow',
    badge: '편리',
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
    subtitle: '의뢰인 서류/진행상황 안내',
    category: 'workflow',
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

export const CATEGORY_LABELS: Record<string, string> = {
  calculator: '계산기 & 시뮬레이터',
  standards: '법률 실무기준 & 고시',
  workflow: '업무 지원 & 소통 도구',
};
