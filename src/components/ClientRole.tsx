import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronRight, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X, Home, BookOpen, MessageSquare
} from 'lucide-react';
import { Client, FinancialProfile, ConsultRequest, User as LawyerType, ConsultMessage, IntakeData } from '../types';
import { CustomerIntake } from './CustomerIntake';
import { calculateRehabPlan } from '../rehabEngine';
import { DEFAULT_SETTINGS } from '../constants';
import { formatKoreanCurrency, formatNumber } from '../utils';
import { mockLawyers, initialConsultRequests, initialConsultMessages } from '../data';
import { RequestDisclaimer, ChatDisclaimer } from './Disclaimers';

interface RemedyPreset {
  jobType: 'SALARIED' | 'BUSINESS' | 'DAILY' | 'FREELANCER';
  debtCause: 'LIVING' | 'BUSINESS' | 'INVESTMENT' | 'GUARANTEE' | 'OTHER';
  harassmentLevel: 'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE';
  creditorCount: number;
  debtBanks: number;
  debtCards: number;
  debtPersonals: number;
  recentLoans: number;
  coinCrypto: number;
  debtTotal: number;
  income: number;
  assetsTotal?: number;
  title: string;
  content: string;
}

interface RemedyInfo {
  id: string;
  title: string;
  subtitle: string;
  remedyTitle: string;
  remedyDesc: string;
  guideTitle: string;
  guideDesc: string;
  iconName: string;
  badgeText: string;
  themeColor: string;
  preset: RemedyPreset;
}

const remedyData: Record<string, RemedyInfo> = {
  card_loan: {
    id: 'card_loan',
    title: '신용카드/카드론 연체',
    subtitle: '리볼빙·돌려막기 한계 도달',
    remedyTitle: '이자 100% 면제 및 고금리 채무 개인회생 흡수 탕감',
    remedyDesc: '신용카드 대금, 리볼빙, 카드론은 이자율이 15%~20%에 육박하는 초고금리 채무입니다. 이를 개인회생 채권 목록에 포함시켜 이자 전액을 면제받고, 소득 수준 및 부양가족에 따라 원금의 최대 90%까지 법적으로 감면받을 수 있습니다.',
    guideTitle: '골든타임 절대 금지 행동 지침',
    guideDesc: '연체를 막기 위해 다른 카드로 현금서비스를 받거나 돌려막기를 하는 것은 최근 채무 비율을 높여 법원 심사 시 "최근 채무 과다"로 기각 사유가 되거나 탕감률이 낮아지는 결정적 원인이 됩니다. 돌려막기 한계에 도달한 즉시 모든 카드 결제를 멈추고 신속히 법적 보호 절차를 개시하셔야 합니다.',
    iconName: 'Landmark',
    badgeText: '원금 최대 90% 감면',
    themeColor: 'red',
    preset: {
      jobType: 'SALARIED',
      debtCause: 'LIVING',
      harassmentLevel: 'CALL',
      creditorCount: 4,
      debtBanks: 1500,
      debtCards: 3500,
      debtPersonals: 0,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 5000,
      income: 230,
      title: '신용카드 및 카드론 연체 독촉 위기 해결 상담',
      content: '신용카드 사용액 및 카드론 돌려막기로 인해 채무가 눈덩이처럼 늘어났습니다. 연체가 시작되어 채권 독촉 전화를 받고 있으며, 개인회생을 통해 월 납입금을 조정하고 독촉을 즉시 정지시키고 싶습니다.'
    }
  },
  bank_loan: {
    id: 'bank_loan',
    title: '은행 신용대출 연체',
    subtitle: '기한이익 상실 및 원금상환 압박',
    remedyTitle: '법원 금지명령으로 예금·급여 압류 및 채권 상계 원천 차단',
    remedyDesc: '시중은행 신용대출 연체 발생 시 1~2개월 내 기한이익상실(만기연장 거절 및 원금 전액 일시상환 청구)이 발생합니다. 법원의 금지명령을 즉각 이끌어내어 직장 급여 가압류 및 거래 은행 계좌 동결을 사전에 법적으로 완벽하게 방어합니다.',
    guideTitle: '예금 및 급여 통장 강제 상계 주의보',
    guideDesc: '대출을 보유 중인 시중은행 계좌에 돈이 남아있거나 해당 은행으로 월급이 수령될 경우, 은행은 연체 즉시 별도의 법원 판결 없이도 채무자의 돈을 강제로 상계(강제 인출)할 수 있습니다. 법적 구제 절차를 준비하는 즉시 주거래 은행과 급여 수납 계좌를 대출 채무가 전혀 없는 제3금융권(카카오뱅크, 토스뱅크 혹은 새마을금고 등)으로 가장 먼저 변경하셔야 소중한 생계비를 보존할 수 있습니다.',
    iconName: 'TrendingDown',
    badgeText: '예금/급여 강제압류 차단',
    themeColor: 'indigo',
    preset: {
      jobType: 'SALARIED',
      debtCause: 'LIVING',
      harassmentLevel: 'LETTER',
      creditorCount: 3,
      debtBanks: 5000,
      debtCards: 0,
      debtPersonals: 0,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 5000,
      income: 250,
      title: '시중은행 신용대출 및 마이너스 통장 연체 회생',
      content: '직장인 신용대출 및 마이너스 통장 만기 연장이 불가능하다는 통보를 받아 일시 상환 압박을 받고 있습니다. 월급 수준으로는 상환이 불가능해 개인회생 신청이 가능한지 긴급히 상담받고 싶습니다.'
    }
  },
  high_interest: {
    id: 'high_interest',
    title: '대부업/고금리 사채',
    subtitle: '가혹한 추심 행위 즉시 방어',
    remedyTitle: '변호사 채무자대리인 제도 선임 및 불법 야간추심 형사고소',
    remedyDesc: '대부업 및 사채 채무는 가혹한 추심을 동반하는 경우가 많습니다. 채무자대리인 제도를 발동하여 변호사가 대리인단으로 선임된 즉시, 채권자는 채무자 본인에게 문자, 전화, 직장 및 자택 방문 등 일체의 직접적 추심 행위를 법적으로 할 수 없게 되며 모든 협의는 변호사 사무실로만 단일화됩니다.',
    guideTitle: '불법 고금리(연 20% 초과) 및 불법 추심 방어전략',
    guideDesc: '법정 최고이자율 연 20%를 초과하는 사채 이자는 민법상 무효이므로 원금 상환액으로 갈음할 수 있습니다. 사채업자들의 협박성 폭언, 야간 연락, 부모·형제에게 알리겠다는 등의 채무 유포 협박은 모두 불법추심법 위반으로 강력한 형사고소 사유입니다. 녹취 및 문자 캡처를 변호사 대리인단에게 공유하시면 신속하게 사채 독촉을 전면 무력화하겠습니다.',
    iconName: 'DollarSign',
    badgeText: '채무자대리인 즉시 선임',
    themeColor: 'amber',
    preset: {
      jobType: 'DAILY',
      debtCause: 'LIVING',
      harassmentLevel: 'LETTER',
      creditorCount: 5,
      debtBanks: 0,
      debtCards: 1000,
      debtPersonals: 3000,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 4000,
      income: 200,
      title: '고금리 사채 및 대부업 채무 통합 해결',
      content: '저축은행, 캐피탈 뿐만 아니라 사채 및 등록 대부업체로부터 고금리 대출을 받았습니다. 무리한 채권자들의 상환 독촉 및 일상생활 위협을 겪고 있어 개인회생 금지명령으로 보호받고자 합니다.'
    }
  },
  guarantee: {
    id: 'guarantee',
    title: '연대보증 채무 위기',
    subtitle: '지인 채무 전가 완벽 대처',
    remedyTitle: '보증인 단독 개인회생 신청으로 구상권 청구 및 채무 상속 방어',
    remedyDesc: '주채무자가 면책 신청을 하거나 잠적할 경우, 연대보증인은 주채무자와 상관없이 채무 전액을 갚아야 할 민사상 연대 책무를 집니다. 이때 주채무자의 회복 여부와 상관없이 보증인 본인 명의로 단독 개인회생을 신청하여 주채무가 넘어온 것을 상쇄하고 탕감율을 인정받을 수 있습니다.',
    guideTitle: '주채무자 면책 시의 오해와 대처법',
    guideDesc: '많은 연대보증인들이 "주채무자가 파산했거나 회생했으니 나에게도 독촉이 없겠지"라고 오해하지만, 법원 도산 절차는 주채무자의 책임만을 감면할 뿐 보증인의 변제 책임은 100% 그대로 남습니다. 채권사들은 주채무자의 회생 소식을 들은 즉시 보증인의 부동산이나 급여 가압류를 전방위로 실행합니다. 보증 독촉 통지서를 받은 직후 본인의 단독 회생 골든타임을 확보하셔야 안전합니다.',
    iconName: 'Users',
    badgeText: '보증채무 100% 흡수 조정',
    themeColor: 'purple',
    preset: {
      jobType: 'SALARIED',
      debtCause: 'GUARANTEE',
      harassmentLevel: 'LAWSUIT',
      creditorCount: 3,
      debtBanks: 6000,
      debtCards: 0,
      debtPersonals: 2000,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 8000,
      income: 350,
      title: '연대보증 채무 독촉에 따른 개인회생 대응',
      content: '주채무자의 도산 및 연락 두절로 인해 연대보증인인 저에게 전액 청구 독촉이 들어왔습니다. 급여 가압류 통지서가 날아온 상태이며, 주위 사실 노출 없이 해결 가능한 개인회생을 긴급히 신청하고자 합니다.'
    }
  },
  investment: {
    id: 'investment',
    title: '주식/코인 투자 손실',
    subtitle: '탕감률 극대화 실무준칙 설계',
    remedyTitle: '회생법원 실무준칙 적용으로 투자 손실액 청산가치 제외 특례 개시',
    remedyDesc: '서울/수원/부산회생법원의 핵심 실무준칙(주식 및 가상자산 손실액 청산가치 불산입)을 적극 활용합니다. 투자 실패로 날아간 빚은 재산으로 잡지 않고 오직 보유하고 있는 현재의 잔고만을 청산가치로 산정함으로써, 원금의 최대 90%까지 극적인 법정 탕감률을 달성해 드립니다.',
    guideTitle: '최근 대출금 사용처 집중 소명 기법',
    guideDesc: '투자 채무 회생의 핵심은 대출 후 투자로 이어진 자금의 흐름을 1원 단위까지 투명하게 입증하는 것입니다. 주식 거래원장, 가상자산 거래 내역 등을 일목요연하게 엑셀로 계통 분석하여 법원 보정 권고에 완벽하게 대비합니다. 또한, 이를 개인 소비나 재산 은닉으로 오해하지 않도록 전문 변호인단이 의견서를 강력하게 개진해야 탕감폭이 좁아지지 않습니다.',
    iconName: 'AlertTriangle',
    badgeText: '투자손실 청산가치 제외',
    themeColor: 'orange',
    preset: {
      jobType: 'SALARIED',
      debtCause: 'INVESTMENT',
      harassmentLevel: 'CALL',
      creditorCount: 6,
      debtBanks: 3500,
      debtCards: 0,
      debtPersonals: 0,
      recentLoans: 1500,
      coinCrypto: 4500,
      debtTotal: 9500,
      income: 280,
      title: '주식 및 가상화폐(코인) 투자 실패 채무 탕감',
      content: '비트코인 선물 거래 및 주식 레버리지 투자 실패로 큰 빚을 지게 되었습니다. 최근 대출 비중이 높아 법원의 기각이나 청산가치 반영 비율이 걱정됩니다. 투자 채무 탕감 성공 경험이 많은 변호사의 조력을 구합니다.'
    }
  },
  freelancer: {
    id: 'freelancer',
    title: '일용직/프리랜서 회생',
    subtitle: '불규칙한 월소득 적법 소명',
    remedyTitle: '플랫폼 정산 및 다각적 계좌 입출금 거래 분석을 통한 가용소득 맞춤 입증',
    remedyDesc: '고정 월급제가 아닌 일용직, 특수고용형태, 프리랜서, 배달 라이더 분들도 회생 신청이 100% 가능합니다. 최근 6~12개월간의 소득 증빙 입금 내역, 플랫폼 정산 원장, 노무 확인서 등을 종합적으로 체계화하여 법원이 승인할 수 있는 가장 합리적인 "평균 소득"을 합법 소명하여 변제금을 낮춰 드립니다.',
    guideTitle: '들쑥날쑥한 프리랜서 소득 소명 가이드',
    guideDesc: '세무서에 종합소득세 신고가 누락되었거나 소득이 불규칙하더라도 낙담하실 필요 없습니다. 변호사 사무실의 계좌 거래원장 전수 분석을 통해 매월 수납되는 현금 흐름을 성실히 정립해 드립니다. 변제 의지가 확고하며 반복적 소득이 발생하고 있음만 증명해 내면 법원은 가차 없이 개시 결정을 내려줍니다.',
    iconName: 'Smartphone',
    badgeText: '부정기 소득 적법 소명',
    themeColor: 'emerald',
    preset: {
      jobType: 'FREELANCER',
      debtCause: 'LIVING',
      harassmentLevel: 'CALL',
      creditorCount: 4,
      debtBanks: 2000,
      debtCards: 1500,
      debtPersonals: 0,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 3500,
      income: 180,
      title: '일용직/프리랜서 부정기 소득자의 개인회생',
      content: '프리랜서 및 일용직 노동자로 근무하여 매달 소득이 불규칙합니다. 소득 증빙 서류 준비와 월 가용 소득 산정 기준이 애매해 상담을 원합니다. 개인회생 개시 조건에 맞는 최적의 소득 소명을 진행하고 싶습니다.'
    }
  },
  seizure: {
    id: 'seizure',
    title: '급여/재산 압류 해제',
    subtitle: '압류 중지·해제명령 긴급신청',
    remedyTitle: '개인회생 신청 즉시 법원 중지명령 송달 및 인가 후 가압류 즉시 취소/말소',
    remedyDesc: '이미 급여나 은행 예금 통장이 압류되어 생계 위협에 직면한 경우, 개인회생 접수와 동시에 강력한 법원 중지명령 신청을 병행합니다. 법원의 중지 결정을 도출해 내어 압류 추심을 동결시키고, 이후 회생 계획안 인가 결정을 받아 가압류를 영구적으로 해제·말소시킬 수 있습니다.',
    guideTitle: '압류 진행 시 직장 내 노출 방어 기법',
    guideDesc: '급여 압류가 들어올 경우 직장 급여담당자에게 강제 압류 결정문이 송달되어 심각한 신용 저하 소문이 직장 내 퍼질 수 있습니다. 연체 시작 후 지급명령 결정문이나 소장 수령 즉시 법원 접수를 진행해야 파국을 피할 수 있습니다. 만약 압류가 개시되었다면 법원 중지 결정을 통해 회사 급여담당자가 임금을 채권자에게 양도하지 못하도록 차단하고 압류 적립금을 법원에 예치 처리해야 합니다.',
    iconName: 'ShieldCheck',
    badgeText: '압류금 적립 및 영구해제',
    themeColor: 'rose',
    preset: {
      jobType: 'SALARIED',
      debtCause: 'LIVING',
      harassmentLevel: 'SEIZURE',
      creditorCount: 5,
      debtBanks: 4000,
      debtCards: 2000,
      debtPersonals: 0,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 6000,
      income: 240,
      title: '급여/가압류/통장 압류 해제 및 중지 명령 신청',
      content: '채권자동에 의한 예금 통장 압류 및 직장 급여 가압류 결정문이 송달되었습니다. 당장 가계 생계비 지출이 불가능해, 개인회생 접수와 함께 중지/금지명령을 통해 압류를 해제하고 생업을 유지하고 싶습니다.'
    }
  },
  bankruptcy: {
    id: 'bankruptcy',
    title: '개인파산/면책 신청',
    subtitle: '무직·고령·질병 전액 탕감',
    remedyTitle: '법적 자격 심사 후 빚 100% 일시 탕감 및 신용 정보 기록 전면 면책 청구',
    remedyDesc: '만 60세 이상의 고령자, 중증 장애 혹은 중증 질병으로 근로 활동을 아예 수행할 수 없어 최저생계비 이하로 거주하는 상태라면, 매달 나눠 갚는 개인회생 대신 채무 전액을 일시에 지워버리는 개인파산 및 면책을 청구하는 것이 최고의 솔루션입니다.',
    guideTitle: '개인회생 vs 개인파산 선택 가이드라인',
    guideDesc: '파산 면책은 청산할 보유 재산이 빚보다 적고 장래 소득 발생 능력이 없음이 객관적으로 입증되어야 인용됩니다. 무조건적인 파산 신청은 채무 면책 기각을 불러와 막대한 비용 손실만 낳을 수 있으므로 법적 자격 진단이 절대적으로 우선되어야 합니다. 재산 목록과 과거 사업 폐업 내역서를 정밀 세무 검토하여 단 1원도 갚지 않는 전액 파산 면책 판결을 완성합니다.',
    iconName: 'Scale',
    badgeText: '원금 이자 100% 전액 탕감',
    themeColor: 'indigo',
    preset: {
      jobType: 'DAILY',
      debtCause: 'OTHER',
      harassmentLevel: 'LETTER',
      creditorCount: 3,
      debtBanks: 4000,
      debtCards: 0,
      debtPersonals: 3500,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 7500,
      income: 80,
      assetsTotal: 100,
      title: '고령/폐업 자영업자 개인파산 및 면책 신청',
      content: '질병 및 건강 악화, 혹은 사업 실패로 인해 앞으로 전혀 소득 활동을 할 수 없는 상황입니다. 보유 재산보다 빚이 훨씬 많아 더 이상 생계 및 상환을 지속할 수 없기에 개인파산을 통한 전액 면책을 희망합니다.'
    }
  }
};

const renderRemedyIcon = (iconName: string, className = "w-6 h-6") => {
  switch (iconName) {
    case 'Landmark': return <Landmark className={className} />;
    case 'TrendingDown': return <TrendingDown className={className} />;
    case 'DollarSign': return <DollarSign className={className} />;
    case 'Users': return <Users className={className} />;
    case 'AlertTriangle': return <AlertTriangle className={className} />;
    case 'Smartphone': return <Smartphone className={className} />;
    case 'ShieldCheck': return <ShieldCheck className={className} />;
    case 'Scale': return <Scale className={className} />;
    default: return <Scale className={className} />;
  }
};

interface ClientRoleProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  messages: ConsultMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>>;
  lawyers: LawyerType[];
  onAddMessage: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string) => void;
}

export default function ClientRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  onAddMessage
}: ClientRoleProps) {
  // Sub-navigation for user
  const [activeTab, setActiveTab] = useState<'landing' | 'request' | 'lawyers' | 'chat' | 'calculator' | 'reviews'>('landing');
  
  // Home Landing States
  const [calcIncome, setCalcIncome] = useState<number>(250);
  const [calcDebt, setCalcDebt] = useState<number>(7000);
  const [calcDependents, setCalcDependents] = useState<number>(0);
  const [bannerIndex, setBannerIndex] = useState<number>(0);
  const [openedQaId, setOpenedQaId] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');

  // User Auth & Privacy States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [alertMode, setAlertMode] = useState<'NORMAL' | 'STEALTH' | 'SECRET'>('STEALTH');
  const [senderNameOverride, setSenderNameOverride] = useState<string>('회생톡');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // OTP and Verification Simulation States
  const [authPhone, setAuthPhone] = useState<string>('');
  const [authOtp, setAuthOtp] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(180);
  const [otpError, setOtpError] = useState<string>('');
  const [otpSuccess, setOtpSuccess] = useState<boolean>(false);
  const [authConsent, setAuthConsent] = useState<boolean>(false);

  useEffect(() => {
    let timer: number;
    if (otpSent && otpCountdown > 0 && !otpSuccess) {
      timer = window.setInterval(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    } else if (otpCountdown === 0) {
      setOtpSent(false);
      setOtpError('인증 시간이 만료되었습니다. 다시 시도해 주세요.');
    }
    return () => window.clearInterval(timer);
  }, [otpSent, otpCountdown, otpSuccess]);
  
  // New Request Form State
  const [requestStep, setRequestStep] = useState<number>(1);
  const [requestType, setRequestType] = useState<'direct' | 'open'>('open');
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('');
  const [income, setIncome] = useState<number>(200); // 10k KRW (만 원)
  const [debtTotal, setDebtTotal] = useState<number>(5000);
  const [assetsTotal, setAssetsTotal] = useState<number>(1000);
  const [dependents, setDependents] = useState<number>(0);
  const [maritalStatus, setMaritalStatus] = useState<'SINGLE' | 'MARRIED' | 'DIVORCED'>('SINGLE');
  
  // Detailed Debt Breakdown
  const [debtBanks, setDebtBanks] = useState<number>(3000);
  const [debtCards, setDebtCards] = useState<number>(1500);
  const [debtPersonals, setDebtPersonals] = useState<number>(500);
  const [recentLoans, setRecentLoans] = useState<number>(0);
  const [coinCrypto, setCoinCrypto] = useState<number>(0);

  // New Individual Rehabilitation states
  const [jobType, setJobType] = useState<'SALARIED' | 'BUSINESS' | 'DAILY' | 'FREELANCER'>('SALARIED');
  const [companyName, setCompanyName] = useState<string>('');
  const [employmentDate, setEmploymentDate] = useState<string>('');
  const [residenceRegion, setResidenceRegion] = useState<string>('서울');
  const [spouseAsset, setSpouseAsset] = useState<number>(0);
  const [spouseIncome, setSpouseIncome] = useState<number>(0);
  const [hasRecentJobChange, setHasRecentJobChange] = useState<boolean>(false);
  const [rentalDeposit, setRentalDeposit] = useState<number>(0);
  const [debtCause, setDebtCause] = useState<'LIVING' | 'BUSINESS' | 'INVESTMENT' | 'GUARANTEE' | 'OTHER'>('LIVING');
  const [harassmentLevel, setHarassmentLevel] = useState<'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE'>('CALL');
  const [creditorCount, setCreditorCount] = useState<number>(3);

  // Form final step
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [consentCheck, setConsentCheck] = useState<boolean>(false);
  
  // Filter for Directory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('전체');

  // Currently opened Chat consultation request ID
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [activeRemedyCategory, setActiveRemedyCategory] = useState<string | null>(null);

  // Reviews page state
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState<string>('전체');
  const [reviewSearchQuery, setReviewSearchQuery] = useState<string>('');


  // Banner Carousel Data
  const banners = [
    {
      title: "빚 독촉의 고통, 오늘 끊을 수 있습니다.",
      subtitle: "개인회생 신청 즉시 법원의 금지명령으로 빗발치는 독촉 전화, 추심 방문, 급여 압류가 전면 금지됩니다. 늦기 전에 골든타임을 확보하세요.",
      badge: "신속한 독촉 차단",
      color: "rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)",
      image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200"
    },
    {
      title: "코인·주식 투자 실패도 최대 90% 탕감 가능",
      subtitle: "단순 과장 광고가 아닙니다. 최근 개정된 회생 법원 실무 기준에 맞추어 투자 손실을 최소화하는 개인회생 계획안을 수립합니다.",
      badge: "투자 실패 부채 전문",
      color: "rgba(30, 27, 75, 0.93), rgba(15, 23, 42, 0.88)",
      image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200"
    },
    {
      title: "알선료 수수료 0%! 투명한 도산 전문 변호사 매칭",
      subtitle: "본 플랫폼은 불법 사무장 브로커를 철저히 배제하고 법률적 책임이 보장된 정식 변호사단으로만 투명하게 운영됩니다.",
      badge: "변호사법 제34조 준수",
      color: "rgba(15, 23, 42, 0.95), rgba(23, 37, 84, 0.9)",
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1200"
    }
  ];

  // Banner rotation logic
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);



  // Customized Q&As for Rehabilitation/Bankruptcy (로톡 상담사례 스타일)
  const mockQAs = [
    {
      id: 'qa-1',
      category: '코인/주식 손실',
      question: '코인 투자 실패로 진 빚 8천만 원, 회생 진행 시 탕감이 가능할까요?',
      author: '김*현 (직장인)',
      answer: '주식이나 가상화폐 투자로 인한 손실도 개인회생 신청 대상이 됩니다. 특히 서울회생법원의 경우 실무준칙에 의거하여 투자 손실금 자체를 청산가치에 강제로 반영하지 않도록 유예해주고 있어 변제액을 낮추는 데 매우 유리합니다. 다만 추가 대출 시점이나 최근 채무 비율에 따라 변동 소지가 있으므로 전문 소명서 준비가 관건입니다.',
      lawyerName: '이소민 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      badge: '추천 답변'
    },
    {
      id: 'qa-2',
      category: '급여 압류',
      question: '회사를 다니는 도중 월급 가압류 예정 통지서를 받았습니다. 직장에 소문 안 나고 차단할 수 있나요?',
      author: '박*수 (사무직)',
      answer: '법률 대리인을 통해 개인회생 신청서와 동시에 "금지명령 및 중지명령"을 법원에 접수하면 대개 3~7일 내에 결정문이 발령됩니다. 금지명령이 채권자에게 송달되면 급여 압류 및 독촉 행위가 법적으로 일절 금지됩니다. 직장에 직접 압류 협박 전화가 오는 것도 원천 차단되므로 신속히 개입하셔야 합니다.',
      lawyerName: '김우진 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
      badge: '실시간 답변'
    },
    {
      id: 'qa-3',
      category: '프리랜서 회생',
      question: '배달 대행 프리랜서인데 4대 보험이 안 되어도 개인회생 신청이 가능한가요?',
      author: '이*우 (플랫폼 노동자)',
      answer: '네, 가능합니다. 개인회생은 고용 형태(정규직, 계약직, 일용직, 프리랜서)에 상관없이 정기적이고 확실한 수입(최저생계비 이상)이 있음을 소득 서류로 입증할 수 있다면 신청이 가능합니다. 3.3% 원천징수 영수증이나 입금 계좌 내역, 플랫폼 활동 정산 내역 등을 토대로 평균 소득을 산출하여 개시를 받아낼 수 있습니다.',
      lawyerName: '최덕중 변호사',
      lawyerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
      badge: '전문가 소견'
    }
  ];

  interface ReviewType {
    id: string;
    title: string;
    category: string;
    author: string;
    originalDebt: number;
    remainingDebt: number;
    lawyerId: string;
    lawyerName: string;
    lawyerAvatar: string;
    content: string;
    tags: string[];
  }

  const mockReviews: ReviewType[] = [
    {
      id: 'rev-1',
      title: "코인 선물거래 빚 9천만 원, 변제율 13%로 종결되었습니다",
      category: "코인/주식 손실",
      author: "이*호 님 (30대 직장인)",
      originalDebt: 9200,
      remainingDebt: 1200,
      lawyerId: "lawyer-2",
      lawyerName: "이소민 변호사",
      lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
      content: "무리한 빚투와 돌려막기로 이자만 매달 300만 원 가까이 나갔습니다. 가압류 예고장이 날아와서 피눈물 흘리며 이곳을 찾았습니다. 이소민 변호사님께서 서울회생법원 최근 준칙에 맞춰 가상자산 평가 손실 부분을 집요하게 소명해주신 덕분에, 청산가치에 과도하게 잡히지 않고 변제금 월 33만 원(총 1,200만 원)으로 최종 인가받았습니다. 평생의 은인입니다.",
      tags: ["#코인실패", "#가압류중지", "#변제율13%"]
    },
    {
      id: 'rev-2',
      title: "생활비 신용카드 연체 독촉 하루 만에 차단 성공",
      category: "신용카드 연체",
      author: "김*정 님 (40대 자영업)",
      originalDebt: 4500,
      remainingDebt: 900,
      lawyerId: "lawyer-1",
      lawyerName: "김우진 변호사",
      lawyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256",
      content: "가게 매출이 급락하며 카드 대금 돌려막기를 하다가 결국 연체가 되자, 하루에 10통씩 독촉 전화가 왔습니다. 김우진 변호사님과 상담 후 즉시 개인회생을 접수했고, 법원에서 4일 만에 금지명령이 나와서 독촉이 완전히 끊겼습니다. 원금 80% 탕감에 이자는 전액 면제되어 이제 조금씩 숨통이 트입니다. 저처럼 연체 독촉으로 두려우신 분들은 무조건 바로 변호사 매칭 받으세요.",
      tags: ["#신용카드연체", "#금지명령성공", "#자영업회생"]
    },
    {
      id: 'rev-3',
      title: "아픈 부모님 병원비로 지게 된 사채 빚, 전액 면제(파산) 받았습니다",
      category: "개인파산",
      author: "박*수 님 (50대 무직)",
      originalDebt: 7500,
      remainingDebt: 0,
      lawyerId: "lawyer-3",
      lawyerName: "최덕중 변호사",
      lawyerAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256",
      content: "부모님 긴급 수술비로 사채와 대부업체 대출까지 쓰게 되었습니다. 저 또한 당뇨 합병증으로 근로 능력을 상실하게 되어 빚을 갚을 방법이 없었습니다. 최덕중 변호사님께서 제 처지를 깊이 공감해주시고 꼼꼼하게 파산 면책 요건을 입증해주신 덕분에, 얼마 전 법원으로부터 채무 액수 전액 면제(면책 성공) 판결을 받았습니다. 새로운 삶을 살 수 있게 해 주셔서 진심으로 머리 숙여 감사드립니다.",
      tags: ["#개인파산", "#면책성공", "#채무전액탕감"]
    },
    {
      id: 'rev-4',
      title: "보증 잘못 서서 날아온 급여 압류 딱지, 개인회생으로 해결",
      category: "연대보증 채무",
      author: "최*철 님 (45세 직장인)",
      originalDebt: 8000,
      remainingDebt: 2400,
      lawyerId: "lawyer-1",
      lawyerName: "김우진 변호사",
      lawyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256",
      content: "친척 연대보증을 섰다가 친척이 도망쳐 제 급여가 압류당하기 직전이었습니다. 매달 월급의 절반을 뺏길 위기에서 김우진 변호사님을 통해 긴급 중지명령을 신청하여 압류 집행을 막아냈습니다. 이후 회생 절차를 통해 보증 채무 원금의 70%를 탕감받았고, 36개월간 성실히 납부하는 것으로 계획안이 통과되었습니다. 법률 전문가의 대처 속도가 얼마나 중요한지 뼈저리게 느꼈습니다.",
      tags: ["#연대보증", "#급여압류방어", "#압류중지성공"]
    },
    {
      id: 'rev-5',
      title: "부정기 소득 플랫폼 배달 라이더, 80% 감면 인가",
      category: "프리랜서 회생",
      author: "정*우 님 (20대 배달 프리랜서)",
      originalDebt: 3800,
      remainingDebt: 760,
      lawyerId: "lawyer-2",
      lawyerName: "이소민 변호사",
      lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
      content: "프리랜서 라이더라 매달 수입이 들쑥날쑥해서 개인회생이 될까 조마조마했습니다. 수입 입증 서류를 혼자 준비하기가 너무 막막했는데, 변호사님이 계좌 입출금 내역과 배달 정산 내역을 깔끔하게 정리해 소득을 증명해 주셨습니다. 탕감율 80% 수준으로 원금 760만 원만 나눠 갚게 되었습니다. 소득 증빙이 어려운 프리랜서분들도 겁먹지 마시고 도전하시길 권합니다.",
      tags: ["#프리랜서소득소명", "#라이더회생", "#원금80%감면"]
    }
  ];

  // Routing and pre-filling request form from category grid
  const handleCategoryClick = (category: string) => {
    setActiveRemedyCategory(category);
  };

  const handleApplyRemedy = (categoryId: string) => {
    const item = remedyData[categoryId];
    if (!item) return;

    // Reset specific breakdowns
    setDebtBanks(0);
    setDebtCards(0);
    setDebtPersonals(0);
    setRecentLoans(0);
    setCoinCrypto(0);

    const { preset } = item;
    
    // Set basic preset fields
    setJobType(preset.jobType);
    setDebtCause(preset.debtCause);
    setHarassmentLevel(preset.harassmentLevel);
    setCreditorCount(preset.creditorCount);
    setDebtBanks(preset.debtBanks);
    setDebtCards(preset.debtCards);
    setDebtPersonals(preset.debtPersonals);
    setRecentLoans(preset.recentLoans);
    setCoinCrypto(preset.coinCrypto);
    setDebtTotal(preset.debtTotal);
    setIncome(preset.income);
    
    if (preset.assetsTotal !== undefined) {
      setAssetsTotal(preset.assetsTotal);
    } else {
      setAssetsTotal(1000); // default
    }

    setTitle(preset.title);
    setContent(preset.content);

    // Close remedy modal
    setActiveRemedyCategory(null);

    // Move to next step of request
    setRequestStep(2);
    setActiveTab('request');
  };

  // Pre-fill request form from review card
  const handleReviewClick = (rev: ReviewType) => {
    // Reset specific breakdowns
    setDebtBanks(0);
    setDebtCards(0);
    setDebtPersonals(0);
    setRecentLoans(0);
    setCoinCrypto(0);

    // Map categories to mock parameters
    if (rev.category.includes('코인') || rev.category.includes('주식') || rev.category.includes('투자')) {
      setCoinCrypto(rev.originalDebt);
    } else if (rev.category.includes('카드') || rev.category.includes('연체')) {
      setDebtCards(rev.originalDebt);
    } else if (rev.category.includes('파산')) {
      setDebtPersonals(rev.originalDebt);
    } else {
      setDebtBanks(rev.originalDebt);
    }

    setDebtTotal(rev.originalDebt);
    setIncome(240); // default realistic income
    setAssetsTotal(1000); // default realistic assets
    
    setSelectedLawyerId(rev.lawyerId);
    setRequestType('direct');
    
    setTitle(`[${rev.category} 성공후기 참고] 1:1 맞춤 상담 신청`);
    setContent(`[참고한 성공 후기: ${rev.title} (변호사: ${rev.lawyerName})]\n\n해당 채무 변제/탕감 성공 사례를 읽고 신뢰가 생겨 동일 변호사님께 상담을 신청합니다.\n\n- 기존 채무액: ${rev.originalDebt}만 원\n- 조정 후 채무액: ${rev.remainingDebt === 0 ? '전액 면제' : `${rev.remainingDebt}만 원`}\n\n저 또한 비슷한 사유로 큰 채무 부담을 안고 있습니다. 위 사례처럼 법원 금지명령과 최대 탕감을 이끌어낼 수 있을지 구체적인 가능성을 진단받고 싶습니다.`);
    
    setRequestStep(3);
    setActiveTab('request');
  };

  // Filtered reviews for reviews tab
  const filteredReviews = mockReviews.filter(rev => {
    // Category match
    const categoryMatches = reviewCategoryFilter === '전체' || rev.category === reviewCategoryFilter;
    
    // Search match (title, content, lawyer name, tags)
    if (!reviewSearchQuery) return categoryMatches;
    
    const query = reviewSearchQuery.toLowerCase().trim();
    const searchMatches = 
      rev.title.toLowerCase().includes(query) ||
      rev.content.toLowerCase().includes(query) ||
      rev.lawyerName.toLowerCase().includes(query) ||
      rev.tags.some(t => t.toLowerCase().includes(query));
      
    return categoryMatches && searchMatches;
  });



  // Auto scroll logic for chat window
  useEffect(() => {
    if (requests.length > 0 && !activeChatReqId) {
      setActiveChatReqId(requests[0].id);
    }
  }, [requests, activeChatReqId]);

  // Load random preset MyData profile
  const handleMyDataLoad = () => {
    // Simulated MyData pull
    const presets = [
      { 
        inc: 245, debt: 8200, asset: 1500, bank: 4000, card: 2500, p: 1700, rec: 1500, coin: 3500, dep: 1, m: 'MARRIED' as const,
        job: 'SALARIED' as const, comp: '(주)가나상사', empDate: '2022-04-10', region: '서울', spAsset: 1200, spIncome: 180, recentJob: false, rentDep: 5000, cause: 'INVESTMENT' as const, haras: 'LETTER' as const, creds: 5
      },
      { 
        inc: 180, debt: 4500, asset: 300, bank: 2000, card: 1500, p: 1000, rec: 500, coin: 0, dep: 0, m: 'SINGLE' as const,
        job: 'DAILY' as const, comp: '현대건설인력', empDate: '2024-01-15', region: '경기', spAsset: 0, spIncome: 0, recentJob: true, rentDep: 1500, cause: 'LIVING' as const, haras: 'CALL' as const, creds: 3
      },
      { 
        inc: 350, debt: 15000, asset: 4200, bank: 9000, card: 3000, p: 3000, rec: 4000, coin: 6000, dep: 2, m: 'DIVORCED' as const,
        job: 'BUSINESS' as const, comp: '우진네치킨', empDate: '2020-08-01', region: '부산', spAsset: 0, spIncome: 0, recentJob: false, rentDep: 3000, cause: 'BUSINESS' as const, haras: 'SEIZURE' as const, creds: 8
      }
    ];
    const rand = presets[Math.floor(Math.random() * presets.length)];
    setIncome(rand.inc);
    setDebtTotal(rand.debt);
    setAssetsTotal(rand.asset);
    setDebtBanks(rand.bank);
    setDebtCards(rand.card);
    setDebtPersonals(rand.p);
    setRecentLoans(rand.rec);
    setCoinCrypto(rand.coin);
    setDependents(rand.dep);
    setMaritalStatus(rand.m);
    
    // Set new fields
    setJobType(rand.job);
    setCompanyName(rand.comp);
    setEmploymentDate(rand.empDate);
    setResidenceRegion(rand.region);
    setSpouseAsset(rand.spAsset);
    setSpouseIncome(rand.spIncome);
    setHasRecentJobChange(rand.recentJob);
    setRentalDeposit(rand.rentDep);
    setDebtCause(rand.cause);
    setHarassmentLevel(rand.haras);
    setCreditorCount(rand.creds);
  };

  // Submit Handler
  const handleRequestSubmit = () => {
    if (!title || !content) {
      alert('상담 요청 제목과 내용을 입력 후 제출해 주세요.');
      return;
    }
    if (!consentCheck) {
      alert('변호사법 제34조 준수 및 자율적 선택 조항에 동의하셔야 제출이 가능합니다.');
      return;
    }

    const calculatedTotal = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;
    const finalDebtTotal = calculatedTotal > 0 ? calculatedTotal : debtTotal;

    // Generate calculated risk tags
    const riskFlags: string[] = [];
    if (recentLoans > finalDebtTotal * 0.3) riskFlags.push('최근 대출 비중 초과 (30% 이상)');
    if (coinCrypto > 2000) riskFlags.push('투자/사행성 손실 채무 포함');
    if (finalDebtTotal > income * 24) riskFlags.push('소득 대비 장기 한계 부채');
    if (income < 130 + dependents * 60) riskFlags.push('최저 생계비 임계점 도달');
    if (harassmentLevel === 'SEIZURE') riskFlags.push('독촉 및 가압류 강제집행 개시 (금지명령 시급)');
    if (hasRecentJobChange) riskFlags.push('최근 1년 이내 취업자 (법원 밀착 심사 대상)');
    if (jobType === 'BUSINESS') riskFlags.push('영업소득자 (자영업/프리랜서 장부 소명 필요)');
    if (spouseAsset > 1000) riskFlags.push('배우자 명의 자산 보유 (청산가치 분할 반영)');
    if (creditorCount >= 7) riskFlags.push('다중채무자 (채권기관 7곳 이상)');
 
    const newRequest: ConsultRequest = {
      id: `req-${Date.now()}`,
      clientId: 'client-temp',
      clientName: isLoggedIn ? `${userAlias} (의뢰인)` : '익명 의뢰인',
      phone: '010-4567-8901',
      requestType,
      maxParticipants: requestType === 'open' ? 3 : 1,
      status: 'requested',
      selectedLawyerId: requestType === 'direct' ? selectedLawyerId : undefined,
      createdAt: new Date().toISOString(),
      title,
      content,
      financialProfile: {
        clientId: 'client-temp',
        income,
        debtTotal: finalDebtTotal,
        assetsTotal,
        dependents,
        maritalStatus,
        debtTypes: {
          banks: debtBanks,
          cards: debtCards,
          personals: debtPersonals,
          recentLoans,
          coinCrypto
        },
        riskFlags,
        jobType,
        companyName,
        companyNameMasked: companyName 
          ? companyName.replace(/./g, (c, i) => i > 0 && i < companyName.length - 1 ? '*' : c)
          : (jobType === 'DAILY' || jobType === 'FREELANCER' ? '프리랜서/일용직' : '미기재'),
        employmentDate,
        residenceRegion,
        spouseAsset,
        spouseIncome,
        hasRecentJobChange,
        rentalDeposit,
        debtCause,
        harassmentLevel,
        creditorCount
      }
    };

    setRequests(prev => [newRequest, ...prev]);
    setActiveChatReqId(newRequest.id);
    
    // Auto respond simulation
    setTimeout(() => {
      onAddMessage(
        newRequest.id,
        `반갑습니다. 의뢰인님의 개인회생 상담 요청이 정상 등록되었습니다. ${
          requestType === 'open' 
          ? '참여형 매칭 제도를 통해 변호사단에서 최대 3명이 곧 참여를 결정하게 되며, 순차적으로 메세지를 남길 예정입니다.' 
          : '직접 선택하신 담당 변호사와 즉시 상담채널이 활성화되었습니다.'
        }`,
        'lawyer',
        requestType === 'direct' ? selectedLawyerId : 'lawyer-1',
        requestType === 'direct' ? (lawyers.find(l => l.id === selectedLawyerId)?.name || '담당 변호사') : '김우진 변호사'
      );
    }, 1500);

    // Reset Form
    setRequestStep(1);
    setTitle('');
    setContent('');
    setConsentCheck(false);
    setActiveTab('chat');
  };

  const handleIntakeSubmit = (intakeData: IntakeData) => {
    const result = calculateRehabPlan(intakeData, DEFAULT_SETTINGS);
    
    // Convert Won units to Man-won (10,000 KRW) units
    const incomeManWon = Math.round(result.client.monthlyIncome / 10000);
    const debtManWon = Math.round(result.base.debtTotal / 10000);
    const assetsManWon = Math.round(result.base.liq / 10000);
    
    // Calculate detailed debt types
    let banks = 0;
    let cards = 0;
    let personals = 0;
    let recentLoans = 0;
    let coinCrypto = 0;
    
    intakeData.debts.forEach(d => {
      const amt = Math.round(d.principal / 10000);
      if (d.isRecent) recentLoans += amt;
      if (d.isGamblingOrLuxury) coinCrypto += amt;
      
      if (d.type === 'secured') {
        banks += amt;
      } else if (d.type === 'tax') {
        personals += amt;
      } else {
        cards += amt;
      }
    });
    
    // Generate risk flags based on the rehabEngine simulation
    const riskFlags = [];
    result.alerts.forEach(a => {
      riskFlags.push(a.message);
    });
    if (intakeData.debts.some(d => d.isRecent)) riskFlags.push('최근 대출 비중 높음 (30% 이상)');
    if (intakeData.debts.some(d => d.isGamblingOrLuxury)) riskFlags.push('투자/사행성 손실 채무 포함');
    
    // Construct the new ConsultRequest
    const newRequest = {
      id: `req-${Date.now()}`,
      clientId: 'client-temp',
      clientName: isLoggedIn ? `${userAlias} (의뢰인)` : '익명 의뢰인',
      phone: intakeData.phoneNumber || '010-4567-8901',
      requestType: 'open',
      maxParticipants: 3,
      status: 'requested',
      createdAt: new Date().toISOString(),
      title: `${intakeData.clientName}님의 정밀 개인회생 상담 분석 신청`,
      content: `정밀 자가진단 분석 결과:\n- 월 소득: ${formatKoreanCurrency(result.client.monthlyIncome)}\n- 인정 생계비: ${formatKoreanCurrency(result.base.living)}\n- 예상 월 가용소득: ${formatKoreanCurrency(result.base.disposable)}\n- 예상 월 변제금: ${formatNumber(result.preferred?.monthly || 0)}원 (${result.preferred?.m || 36}개월)\n- 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)}\n- 총 청산가치(자산): ${formatKoreanCurrency(result.base.liq)}\n\n[의뢰인 소명 요지]\n과거 개인회생 이력: ${intakeData.prevHistory.exists ? '있음 (' + intakeData.prevHistory.caseNumber + ')' : '없음'}\n현재 거주 지역: ${intakeData.residence}\n주된 직업 유형: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : '영업 소득자'}`,
      financialProfile: {
        clientId: 'client-temp',
        income: incomeManWon,
        debtTotal: debtManWon,
        assetsTotal: assetsManWon,
        dependents: result.client.dependents,
        maritalStatus: intakeData.maritalStatus === 'single' ? 'SINGLE' : intakeData.maritalStatus === 'married' ? 'MARRIED' : 'DIVORCED',
        debtTypes: {
          banks,
          cards,
          personals,
          recentLoans,
          coinCrypto
        },
        riskFlags,
        jobType: intakeData.incomeSources[0]?.type === 'worker' ? 'SALARIED' : 'BUSINESS',
        companyName: intakeData.workplace || '',
        companyNameMasked: intakeData.workplace ? intakeData.workplace.replace(/./g, (c, i) => i > 0 && i < intakeData.workplace.length - 1 ? '*' : c) : '미기재',
        employmentDate: intakeData.consultDate,
        residenceRegion: intakeData.residence,
        spouseAsset: Math.round((intakeData.spouseIncome || 0) / 10000),
        spouseIncome: Math.round((intakeData.spouseIncome || 0) / 10000),
        hasRecentJobChange: intakeData.debts.some(d => d.isRecent),
        rentalDeposit: Math.round((intakeData.monthlyRent || 0) / 10000),
        debtCause: 'LIVING',
        harassmentLevel: 'CALL',
        creditorCount: intakeData.debts.length
      }
    };
    
    // Save to requests and navigate to active chat
    setRequests(prev => [newRequest, ...prev]);
    setActiveChatReqId(newRequest.id);
    
    // Auto-respond simulation
    setTimeout(() => {
      onAddMessage(
        newRequest.id,
        `반갑습니다. 의뢰인님의 정밀 AI 분석 상담 요청이 정상 등록되었습니다. 예상 월 변제금은 약 ${formatNumber(result.preferred?.monthly || 0)}원(${result.preferred?.m || 36}개월)으로 진단되었습니다. 곧 배정된 회생 전문 변호사가 실시간 대화를 통해 서류 면밀 검토 및 기각 차단 법리 대책을 수립해 드리겠습니다.`,
        'lawyer',
        'lawyer-1',
        '김우진 변호사'
      );
    }, 1500);

    setActiveTab('chat');
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    onAddMessage(activeChatReqId, chatInput.trim(), 'client', 'client-temp', isLoggedIn ? `${userAlias} (본인)` : '의뢰인 (본인)');
    setChatInput('');

    // Simulate lawyer responding back
    setTimeout(() => {
      onAddMessage(
        activeChatReqId,
        '상세 채무 계산 내역을 검토 중입니다. 월 평균 납부 가능한 가용 변제액을 약 40만 원 수준으로 맞춰 법관 보정 대비가 가능한 구조입니다. 법인 통장 거래 내역 및 신분증 사본 준비가 가능하신가요?',
        'lawyer',
        'lawyer-2',
        '이소민 변호사'
      );
    }, 2500);
  };

  // Simulated Auth and Security Handlers
  const handleSocialLogin = (platform: string) => {
    if (!authConsent) {
      alert('필수 개인정보 및 마이데이터 수집 이용 동의를 체크해 주세요.');
      return;
    }
    setTimeout(() => {
      setIsLoggedIn(true);
      const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
      setUserAlias(generatedAlias);
      setShowAuthModal(false);
      setAuthPhone('');
      setAuthOtp('');
      setOtpSent(false);
      setOtpError('');
      alert(`[안내] ${platform} 계정 연동 및 간편 회원가입이 완료되었습니다!\n개인 정보 보호를 위해 의뢰인 식별명은 가명 '${generatedAlias}'으로 자동 생성되었습니다.`);
    }, 400);
  };

  const handleSendOtp = () => {
    if (!authPhone.trim()) {
      setOtpError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (!authConsent) {
      setOtpError('필수 개인정보 수집 이용 동의를 체크해 주세요.');
      return;
    }
    setOtpError('');
    setOtpSent(true);
    setOtpCountdown(180);
    alert('[가상 인증 번호 발송]\n본인인증을 위한 6자리 코드 [777777]이 화면에 임시 발송되었습니다. 입력란에 기입해 주세요.');
  };

  const handleVerifyOtp = () => {
    if (authOtp === '777777') {
      setIsLoggedIn(true);
      const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
      setUserAlias(generatedAlias);
      setShowAuthModal(false);
      setOtpSent(false);
      setOtpError('');
      setAuthPhone('');
      setAuthOtp('');
      alert(`[인증 성공] 안전하게 로그인이 활성화 완료되었습니다!\n배정된 가명: ${generatedAlias}`);
    } else {
      setOtpError('인증번호가 일치하지 않습니다. (가상 테스트용 코드: 777777)');
    }
  };

  const handleRegenAlias = () => {
    const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
    setUserAlias(generatedAlias);
  };

  // Helper values
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  // Formatted calculation
  const totalCalculatedDebt = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;



  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F7] dark:bg-slate-950 text-[#313142] dark:text-slate-100 font-sans">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-white dark:bg-slate-900 border-x border-slate-100 dark:border-slate-800 shadow-sm flex flex-col relative">
      
        {/* Dynamic Client Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 w-full">
          <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('landing')}>
              <img src="./logo.png" alt="회생톡 로고" className="w-9 h-9 rounded-xl object-cover shadow-sm shadow-brand/20" />
              <div className="flex flex-col text-left">
                <span className="font-black text-lg tracking-tight text-[#313142] dark:text-white leading-none">회생톡</span>
                <span className="text-[9px] text-[#7e7e8f] dark:text-slate-500 font-bold tracking-wide mt-0.5">안심 채무 해결 센터</span>
              </div>
            </div>

          <nav className="flex items-center gap-1.5">
            <div className="hidden md:flex items-center gap-1.5">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'landing' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                홈 / 안내
              </button>
              <button 
                onClick={() => setActiveTab('calculator')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'calculator' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                탕감액 계산기
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reviews' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                성공 후기
              </button>
              <button 
                onClick={() => setActiveTab('request')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'request' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                상담 신청
              </button>
              <button 
                onClick={() => setActiveTab('lawyers')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'lawyers' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                변호사 찾기
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'chat' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                내 상담방
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
                </span>
              </button>
            </div>
 
            {/* Auth section */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    👤 <span className="text-brand dark:text-brand-light">{userAlias}</span>님
                  </span>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded font-semibold leading-none">
                    스텔스 보호중
                  </span>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="스텔스 & 보안 설정"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setIsLoggedIn(false);
                    setUserAlias('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="ml-2 flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-[200px] text-xs font-bold transition-all shadow-sm hover:shadow-md"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>로그인 및 회원가입</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* TAB 1: LANDING & INTRO */}
        {activeTab === 'landing' && (
          <div className="space-y-10 animate-fadeIn text-left">
            
            {/* 1. Search Box (Lawtalk Search Bar Style) */}
            <div className="text-center py-6 max-w-3xl mx-auto space-y-6">
              <h2 className="text-2xl md:text-4xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                어떤 채무 고민을 겪고 계신가요?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                대한변협 등록 도산 전문 변호사와 즉시 매칭되는 안심 회생·파산 센터
              </p>
              
              <div className="relative flex items-center bg-white dark:bg-slate-900 border border-brand/60 dark:border-brand/40 rounded-[30px] shadow-md px-5 py-2 focus-within:ring-4 focus-within:ring-brand/15 transition-all">
                <Search className="w-5.5 h-5.5 text-brand mr-2.5 shrink-0" />
                <input
                  type="text"
                  placeholder="의뢰 분야, 키워드 또는 변호사 이름을 검색하세요 (예: 코인, 압류, 김우진)"
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm md:text-base py-2 text-[#313142] dark:text-slate-100 placeholder:text-[#7e7e8f] font-medium"
                />
                {homeSearchQuery && (
                  <button
                    onClick={() => setHomeSearchQuery('')}
                    className="text-xs text-[#7e7e8f] hover:text-[#313142] px-2 font-bold transition-colors"
                  >
                    초기화
                  </button>
                )}
              </div>
              
              {/* Lawtalk Style Metric Bar */}
              <div className="grid grid-cols-3 gap-2 py-3.5 px-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm text-center">
                <div className="space-y-0.5 border-r border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] sm:text-xs text-[#7e7e8f] dark:text-slate-500 font-semibold block">누적 상담 신청</span>
                  <span className="text-sm sm:text-lg font-extrabold text-brand dark:text-brand-light">8,421건</span>
                </div>
                <div className="space-y-0.5 border-r border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold block">의뢰인 만족도</span>
                  <span className="text-sm sm:text-lg font-extrabold text-slate-850 dark:text-slate-100">98.7%</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold block">평균 답변 시간</span>
                  <span className="text-sm sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400">10분 내</span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-400">인기 키워드:</span>
                <button onClick={() => handleCategoryClick('investment')} className="bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-200/50 dark:border-orange-900/30 transition-colors font-semibold">#코인실패</button>
                <button onClick={() => handleCategoryClick('seizure')} className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 px-3 py-1 rounded-full border border-rose-200/50 dark:border-rose-900/30 transition-colors font-semibold">#급여압류</button>
                <button onClick={() => handleCategoryClick('high_interest')} className="bg-amber-50 hover:bg-amber-100 text-amber-750 dark:bg-amber-950/20 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/30 transition-colors font-semibold">#대부업채무</button>
                <button onClick={() => handleCategoryClick('bankruptcy')} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-900/30 transition-colors font-semibold">#고령파산</button>
              </div>
            </div>

            {/* 2. Hero Section: Sliding Banner & Quick Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Banner Slider */}
              <div 
                style={{ 
                  backgroundImage: `linear-gradient(to bottom right, ${banners[bannerIndex].color}), url(${banners[bannerIndex].image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                className="lg:col-span-8 text-white p-6 md:p-10 rounded-3xl shadow-lg border border-slate-800/40 flex flex-col justify-between relative overflow-hidden transition-all duration-700 ease-in-out min-h-[250px]"
              >
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand/10 rounded-full blur-3xl"></div>
                
                <div className="space-y-3.5 z-10 text-left">
                  <span className="bg-brand/90 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-brand-light/20">
                    {banners[bannerIndex].badge}
                  </span>
                  <h1 className="text-lg md:text-3xl font-black tracking-tight leading-snug">
                    {banners[bannerIndex].title}
                  </h1>
                  <p className="text-slate-300 text-[11px] md:text-sm max-w-xl leading-relaxed hidden sm:block">
                    {banners[bannerIndex].subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-6 z-10">
                  <div className="flex gap-1.5">
                    {banners.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setBannerIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === bannerIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                    }}
                    className="text-xs text-white hover:text-brand-light font-semibold flex items-center gap-1 group"
                  >
                    <span>신청 바로가기</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Quick Actions (Right Column) */}
              <div className="lg:col-span-4 grid grid-cols-1 gap-3.5">
                
                {/* 탕감액 계산기 */}
                <button
                  onClick={() => setActiveTab('calculator')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group w-full text-left"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] text-brand dark:text-brand-light font-bold uppercase tracking-wider">자가진단</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">내 빚 탕감액 계산기</h4>
                    <p className="text-[11px] text-slate-500">소득, 채무만 입력하면 예상 변제금 계산</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-light dark:bg-brand/10 text-brand dark:text-brand-light flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Activity className="w-5 h-5" />
                  </div>
                </button>

                {/* 1:1 지정 변호사 */}
                <button
                  onClick={() => setActiveTab('lawyers')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group"
                >
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">변호사 프로필</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">1:1 지정 변호사 상담</h4>
                    <p className="text-[11px] text-slate-500">최근 법원별 성공 수임 사례 직접 확인</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <User className="w-5 h-5" />
                  </div>
                </button>

                {/* 3인 다중매칭 */}
                <button
                  onClick={() => {
                    setRequestType('open');
                    setRequestStep(1);
                    setActiveTab('request');
                  }}
                  className="bg-gradient-to-r from-brand to-indigo-600 text-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group"
                >
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-brand-light font-bold uppercase tracking-wider">신속하고 편리하게</span>
                    <h4 className="font-extrabold text-sm">참여형 3인 무료 매칭</h4>
                    <p className="text-[11px] text-brand-light/90">최대 3인의 변호사 의견 동시에 진단</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Users className="w-5 h-5" />
                  </div>
                </button>

              </div>
            </div>

            {/* 3. Category Grid (Customized for Rehabilitation/Bankruptcy) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                  <span>채무 상황별 자격 진단 & 상담</span>
                </h3>
                <span className="text-xs text-[#7e7e8f]">채무 유형을 선택하시면 변호사가 즉각 검토 가능한 상태가 구성됩니다</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* 1. 신용카드 */}
                <div
                  onClick={() => handleCategoryClick('card_loan')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">신용카드/카드론 연체</h5>
                    <p className="text-[10px] text-[#7e7e8f]">리볼빙·돌려막기 한계 도달</p>
                  </div>
                </div>

                {/* 2. 은행 대출 */}
                <div
                  onClick={() => handleCategoryClick('bank_loan')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-brand-light dark:bg-brand/10 text-brand flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">은행 신용대출 연체</h5>
                    <p className="text-[10px] text-[#7e7e8f]">기한이익 상실 및 원금상환</p>
                  </div>
                </div>

                {/* 3. 대부업 */}
                <div
                  onClick={() => handleCategoryClick('high_interest')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">대부업/고금리 사채</h5>
                    <p className="text-[10px] text-[#7e7e8f]">가혹한 추심 행위 즉시 방어</p>
                  </div>
                </div>

                {/* 4. 연대보증 */}
                <div
                  onClick={() => handleCategoryClick('guarantee')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">연대보증 채무 위기</h5>
                    <p className="text-[10px] text-[#7e7e8f]">지인 채무 전가 완벽 대처</p>
                  </div>
                </div>

                {/* 5. 주식 코인 */}
                <div
                  onClick={() => handleCategoryClick('investment')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">주식/코인 투자 손실</h5>
                    <p className="text-[10px] text-[#7e7e8f]">탕감률 극대화 실무준칙 설계</p>
                  </div>
                </div>

                {/* 6. 일용직/프리랜서 */}
                <div
                  onClick={() => handleCategoryClick('freelancer')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">일용직/프리랜서 회생</h5>
                    <p className="text-[10px] text-[#7e7e8f]">불규칙한 월소득 적법 소명</p>
                  </div>
                </div>

                {/* 7. 급여 압류 */}
                <div
                  onClick={() => handleCategoryClick('seizure')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">급여/재산 압류 해제</h5>
                    <p className="text-[10px] text-[#7e7e8f]">압류 중지·해제명령 긴급신청</p>
                  </div>
                </div>

                {/* 8. 개인파산 */}
                <div
                  onClick={() => handleCategoryClick('bankruptcy')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl hover:border-brand hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-505 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">개인파산/면책 신청</h5>
                    <p className="text-[10px] text-[#7e7e8f]">무직·고령·질병 전액 탕감</p>
                  </div>
                </div>

              </div>
            </div>



            {/* 4. Active Lawyers Grid Section (Lawtalk Style) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand" />
                  <span>이 시간 활동 중인 도산 전문 변호사</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </h3>
                <span className="text-xs text-[#7e7e8f]">원하시는 변호사를 지정하거나 맞춤형 상담 예약을 진행할 수 있습니다</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {lawyers
                  .filter(l => l.role === 'LAWYER')
                  .map(l => {
                    const rating = l.id === 'lawyer-1' ? '4.9' : l.id === 'lawyer-2' ? '4.8' : '4.9';
                    const reviewsCount = l.id === 'lawyer-1' ? '184' : l.id === 'lawyer-2' ? '129' : '94';
                    
                    return (
                      <div key={l.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden">
                        <div className="p-5 space-y-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img 
                                src={l.avatar} 
                                alt={l.name}
                                className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-850"
                              />
                              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-extrabold text-sm text-slate-850 dark:text-white">{l.name}</h4>
                                <span className="text-[9px] bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light font-extrabold px-1.5 py-0.2 rounded-md">도산 전문</span>
                              </div>
                              <span className="text-[10px] text-[#7e7e8f] font-medium block">법무법인 한빛 · 서울/인천/수원 대응</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] font-bold text-[#7e7e8f] bg-slate-50 dark:bg-slate-950/50 p-2 rounded-xl">
                            <span className="text-amber-500 font-bold">★ {rating}</span>
                            <span className="text-slate-300">|</span>
                            <span>후기 {reviewsCount}건</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-brand">매칭 {l.matchedCount}건</span>
                          </div>

                          <p className="text-[11px] text-[#484760] dark:text-slate-400 leading-relaxed line-clamp-2 text-left">
                            "{l.bio}"
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {l.fields.map(f => (
                              <span key={f} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-semibold">
                                #{f}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 p-3 grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                          <button
                            onClick={() => {
                              setRequestType('direct');
                              setSelectedLawyerId(l.id);
                              setIncome(230);
                              setDebtTotal(6500);
                              setTitle(`[15분 전화상담 예약] ${l.name}`);
                              setContent(`[전화상담 신청] ${l.name} 변호사님과의 15분 긴급 전화 매칭 상담을 요청합니다. 신용카드 연체 독촉 중단 및 최저생계비 보정을 위한 법률 소명 가이드를 구합니다.`);
                              setRequestStep(3);
                              setActiveTab('request');
                            }}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-300 dark:hover:bg-slate-800 py-2 rounded-[200px] transition-all"
                          >
                            📞 전화상담 (2만원)
                          </button>
                          <button
                            onClick={() => {
                              setRequestType('direct');
                              setSelectedLawyerId(l.id);
                              setIncome(230);
                              setDebtTotal(6500);
                              setTitle(`[1:1 대면/지정상담] ${l.name} 변호`);
                              setContent(`[1:1 서류검토 상담] ${l.name} 변호사님과의 정밀 서류 검토 및 1:1 회생 성공 가용자금 계획안 수립을 신청합니다.`);
                              setRequestStep(2);
                              setActiveTab('request');
                            }}
                            className="bg-brand hover:bg-brand-hover text-white py-2 rounded-[200px] transition-all shadow-sm"
                          >
                            ✍️ 1:1 상담 예약
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Real Success Reviews Section */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                  <span>실제 채무 해결 성공 후기</span>
                  <span className="text-[10px] bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light font-extrabold px-2 py-0.5 rounded-md">
                    리얼 자필 사연
                  </span>
                </h3>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-xs text-brand dark:text-brand-light font-bold hover:underline shrink-0"
                >
                  후기 더 보기 →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {mockReviews.slice(0, 3).map(rev => (
                  <div key={rev.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md">
                          {rev.category}
                        </span>
                        <div className="flex text-amber-400 text-xs">★★★★★</div>
                      </div>
                      
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-850 dark:text-white leading-snug line-clamp-1">
                        {rev.title}
                      </h4>

                      <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/80 flex items-center justify-between text-[10px] font-bold">
                        <div className="text-slate-400">기존 채무: {rev.originalDebt.toLocaleString()}만원</div>
                        <div className="text-indigo-600 dark:text-indigo-450">조정 후: {rev.remainingDebt === 0 ? "전액 탕감" : `${rev.remainingDebt.toLocaleString()}만원`}</div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-405 leading-relaxed line-clamp-3">
                        "{rev.content}"
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-semibold">{rev.author}</span>
                        <div className="flex items-center gap-1.5">
                          <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" />
                          <span className="font-bold text-slate-650 dark:text-slate-400">{rev.lawyerName}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReviewClick(rev)}
                        className="w-full text-center py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400 text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                      >
                        <span>⚖️ 동일 사건 상담 신청</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Live Q&A Case Studies (Lawtalk Style) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-brand" />
                  <span>실시간 고민 해결 상담사례</span>
                </h3>
                <span className="text-xs text-slate-400">도산 전문 변호사들이 직접 해결한 최근 고민 사례들입니다</span>
              </div>

              <div className="space-y-3.5">
                {mockQAs
                  .filter(qa => {
                    if (!homeSearchQuery) return true;
                    const query = homeSearchQuery.toLowerCase();
                    return qa.question.toLowerCase().includes(query) || qa.category.toLowerCase().includes(query) || qa.answer.toLowerCase().includes(query);
                  })
                  .map(qa => {
                    const isOpen = openedQaId === qa.id;
                    return (
                      <div
                        key={qa.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm"
                      >
                        {/* Header */}
                        <div
                          onClick={() => setOpenedQaId(isOpen ? null : qa.id)}
                          className="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-start justify-between gap-4"
                        >
                          <div className="space-y-2 text-left">
                            <div className="flex items-center gap-2.5">
                              <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-blue-450 text-[9px] font-extrabold px-2.5 py-0.5 rounded-md">
                                {qa.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {qa.author}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-105 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-650 dark:text-slate-400">{qa.lawyerName} 답변</span>
                              </div>
                            </div>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-850 dark:text-slate-200 pr-4 leading-snug">
                              Q. {qa.question}
                            </h4>
                          </div>
                          
                          <span className="text-xs font-bold text-brand shrink-0 select-none pt-1">
                            {isOpen ? '닫기 ▲' : '답변보기 ▼'}
                          </span>
                        </div>

                        {/* Answer Details */}
                        {isOpen && (
                          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-4 bg-slate-50/50 dark:bg-slate-950/20 text-left space-y-4 animate-slideDown">
                            <div className="flex items-start gap-3">
                              <img
                                src={qa.lawyerAvatar}
                                alt={qa.lawyerName}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0"
                              />
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-slate-850 dark:text-white">{qa.lawyerName}</span>
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold px-2 py-0.5 rounded-md">전문가 답변</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal pt-1.5 whitespace-pre-wrap text-left">
                                  {qa.answer}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => {
                                  // Pre-fill question context
                                  setTitle(`${qa.category} 관련 법률 상담 신청`);
                                  setContent(`고민 사례 질문:\nQ. ${qa.question}\n\n위의 Q&A 고민 사례를 확인하고 저에게 동일하게 적용될 수 있는 법리적 가능성을 상담받고 싶습니다. 변호사님의 정밀 가이드가 필요합니다.`);
                                  setRequestStep(3); // Go directly to submit step
                                  setActiveTab('request');
                                }}
                                className="bg-brand hover:bg-brand text-white font-bold px-4 py-2 rounded-xl text-[10px] transition-colors"
                              >
                                이 변호사에게 유사건 즉시 상담 신청
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Babitalk-style App Promotion Banner */}
            <div className="pt-8 w-full">
              <div className="cursor-pointer w-full flex justify-end items-center pl-6 pr-4 py-6 md:py-8 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-3xl border border-brand/10">
                <div className="grow shrink basis-0 justify-between items-center gap-2.5 flex">
                  <div className="grow shrink basis-0 flex-col justify-center items-start gap-2 inline-flex">
                    <div className="text-[#313142] dark:text-white font-extrabold leading-[1.4] text-base md:text-xl">
                      더 쉽고 빠른 채무 해결<br/>회생톡 앱에서 확인하기
                    </div>
                    <div className="text-brand font-bold leading-relaxed text-xs md:text-sm">
                      <span className="hidden md:block">QR코드를 스캔하여 바로 앱을 다운로드 받으세요</span>
                      <span className="md:hidden block">구글 플레이 / 앱스토어에서 다운받기</span>
                    </div>
                  </div>
                  
                  {/* QR code and app store badges */}
                  <div className="hidden md:flex justify-center items-center bg-white dark:bg-slate-800 rounded-2xl p-2 w-[90px] h-[90px] shadow-sm shrink-0">
                    <img alt="qr" className="object-contain w-full h-full" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://web.babitalk.com/" />
                  </div>
                  
                  <div className="md:hidden flex flex-col gap-1.5">
                    <div className="px-3 py-1.5 bg-[#313142] dark:bg-slate-800 text-white rounded-lg text-[10px] font-extrabold text-center">App Store</div>
                    <div className="px-3 py-1.5 bg-[#313142] dark:bg-slate-800 text-white rounded-lg text-[10px] font-extrabold text-center">Google Play</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Babitalk-style Footer */}
            <div className="flex flex-col w-full pt-10 pb-6 justify-start items-start gap-6 border-t border-slate-100 dark:border-slate-850 mt-10">
              <div className="self-stretch flex-col justify-start items-start gap-2.5 flex">
                <div className="flex items-center gap-2">
                  <img src="./logo.png" alt="회생톡 로고" className="w-6 h-6 rounded-md object-cover opacity-70" />
                  <span className="font-extrabold text-sm text-[#484760] dark:text-slate-400">주식회사 회생톡</span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row w-full justify-between items-start gap-4 text-xs text-[#7e7e8f] dark:text-slate-500">
                <div className="flex-1 flex-col justify-start items-start gap-2 inline-flex">
                  <div className="self-stretch justify-start items-center gap-1.5 flex flex-wrap font-semibold text-[#484760] dark:text-slate-400">
                    <span>주식회사 회생톡</span>
                    <span className="text-slate-200">|</span>
                    <span>대표이사 안심인</span>
                    <span className="text-slate-200">|</span>
                    <span>개인정보 관리책임자 안심인</span>
                  </div>
                  <p className="leading-relaxed">
                    사업자등록번호 120-00-00000<br/>
                    통신판매업신고번호 제 2026-서울강남-0000호
                  </p>
                  <p className="leading-relaxed">
                    서울특별시 서초구 강남대로 363 강남타워 11층<br/>
                    이메일 help@rebirthtalk.com
                  </p>
                </div>
                <div className="flex-1 flex-col justify-start items-start md:items-end gap-2 inline-flex">
                  <div className="self-stretch justify-start md:justify-end items-center gap-1.5 flex flex-wrap font-semibold text-[#484760] dark:text-slate-400 underline">
                    <span className="cursor-pointer hover:text-[#313142]">서비스 이용약관</span>
                    <span className="text-slate-200">|</span>
                    <span className="cursor-pointer hover:text-[#313142]">개인정보 처리방침</span>
                    <span className="text-slate-200">|</span>
                    <span className="cursor-pointer hover:text-[#313142]">법적 고지사항</span>
                  </div>
                  <p className="leading-relaxed text-left md:text-right">
                    회생톡은 채무 해결 매칭 플랫폼으로서 통신판매의 당사자가 아니며,<br/>
                    제휴 법률사무소가 제공하는 법률 서비스에 대해 어떠한 법적 책임도 지지 않습니다.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}



        {/* TAB: 탕감액 계산기 */}
        {activeTab === 'calculator' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn text-left">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-lg border border-slate-800 p-4 sm:p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-brand-light font-bold uppercase tracking-widest flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    실시간 자가진단 계산기
                  </span>
                  <h3 className="text-lg md:text-xl font-extrabold">나의 예상 개인회생 탕감액 조회</h3>
                </div>
                <p className="text-xs text-slate-400 leading-normal max-w-sm">
                  소득과 채무, 부양가족 수에 따른 최저생계비를 대입하여 법원에서 인정받을 수 있는 최적의 예상 탕감액과 변제율을 가계산합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* Sliders */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Income Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">월 평균 세후 실수령 소득</span>
                      <span className="font-bold text-brand-light text-sm">{calcIncome}만 원</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="800"
                      step="10"
                      value={calcIncome}
                      onChange={(e) => setCalcIncome(Number(e.target.value))}
                      className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand py-1"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>100만 원</span>
                      <span>450만 원</span>
                      <span>800만 원</span>
                    </div>
                  </div>

                  {/* Debt Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">총 채무액 (대출, 카드론, 주식/코인 손실 등)</span>
                      <span className="font-bold text-amber-400 text-sm">
                        {calcDebt >= 10000 ? `${(calcDebt / 10000).toFixed(2)}억 원` : ''} ({calcDebt.toLocaleString()}만 원)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="30000"
                      step="500"
                      value={calcDebt}
                      onChange={(e) => setCalcDebt(Number(e.target.value))}
                      className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 py-1"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>1,000만 원</span>
                      <span>1.5억 원</span>
                      <span>3억 원</span>
                    </div>
                  </div>

                  {/* Dependents Select */}
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-300 font-medium mb-1">부양 가족 수 (본인 제외)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCalcDependents(num)}
                          className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                            calcDependents === num
                            ? 'bg-brand border-brand text-white shadow-md'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {num === 0 ? '0명 (1인 가구)' : `${num}명 (${num+1}인 가구)`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculation Results */}
                <div className="lg:col-span-5 bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  {(() => {
                    const minLivingCost = calcDependents === 0 ? 133 : calcDependents === 1 ? 221 : calcDependents === 2 ? 282 : 343;
                    const monthlyRepayment = Math.max(0, calcIncome - minLivingCost);
                    const totalRepayment = Math.min(calcDebt, monthlyRepayment * 36);
                    const totalReduction = Math.max(0, calcDebt - totalRepayment);
                    const reductionRate = calcDebt > 0 ? Math.round((totalReduction / calcDebt) * 100) : 0;
                    
                    const isBankruptcyApplicable = monthlyRepayment <= 0;

                    return (
                      <>
                        <div className="space-y-3 text-left">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block border-b border-slate-800 pb-1.5">
                            🔍 1차 자격 진단 리포트
                          </span>
                          
                          <div className="space-y-2 text-xs text-slate-300">
                            <div className="flex justify-between">
                              <span>보건복지부 고시 최저생계비:</span>
                              <strong className="text-white">{minLivingCost}만 원</strong>
                            </div>
                            
                            {isBankruptcyApplicable ? (
                              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-[11px] text-red-300 font-semibold leading-normal">
                                ⚠️ 월 소득이 법정 최저생계비보다 적습니다. 이 경우 변제금 납부 대신 채무 전액을 탕감받는 **개인파산 면책 신청**이 가장 유리합니다!
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between">
                                  <span>예상 월 가용 변제금 (36개월):</span>
                                  <strong className="text-brand-light">{monthlyRepayment.toLocaleString()}만 원 / 월</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>예상 총 변제액:</span>
                                  <strong className="text-white">{Math.round(totalRepayment).toLocaleString()}만 원</strong>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {!isBankruptcyApplicable && (
                          <div className="bg-brand/10 border border-brand/20 p-4 rounded-xl text-center space-y-1">
                            <span className="text-[10px] text-brand-light uppercase tracking-widest font-bold">법적 탕감 비율</span>
                            <div className="text-2xl font-extrabold text-brand-light">
                              약 {reductionRate}% 탕감 예정
                            </div>
                            <p className="text-xs text-slate-400">
                              (총 채무 중 약 <strong className="text-white">{Math.round(totalReduction).toLocaleString()}만 원</strong> 감면)
                            </p>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setIncome(calcIncome);
                              setDebtTotal(calcDebt);
                              setDependents(calcDependents);
                              // Pre-fill fields based on calculation
                              setTitle(`탕감액 계산기 연동 상담 신청`);
                              setContent(`탕감액 계산기 실행 결과:\n- 월 세후 소득: ${calcIncome}만 원\n- 총 부채액: ${calcDebt}만 원\n- 부양가족 수: ${calcDependents}명 (${calcDependents + 1}인 가구)\n\n상기 수치 데이터를 기반으로 법정 개시가 안전하게 가능한 구조인지, 추가적인 탕감율 극대화 전략에 대한 도산 전문 변호사의 상담을 신청합니다.`);
                              setRequestStep(3); // Go to final submit step
                              setActiveTab('request');
                            }}
                            className="w-full bg-brand hover:bg-brand text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-4 h-4" />
                            <span>이 계산 결과로 바로 상담 신청하기</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Banner Notice linking to lawyer matching importance */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl text-xs space-y-2.5">
              <h4 className="font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>탕감액 계산기 이용 시 유의사항 (변호사 전문 소명의 중요성)</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                위 계산기는 보건복지부 기준 최저생계비를 대입한 <strong>가계산(가상 결과)</strong>입니다. 
                실제 법원 접수 시에는 채무 형성 경로(최근 대출 비율, 사행성 투자 손실 유무) 및 의뢰인의 개별 소득 형태, 재산 가치(청산가치)에 따라 법원이 인정해주는 생계비의 보정 폭이 매우 크게 달라집니다.
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                따라서, 계산 결과를 토대로 반드시 **도산 전문 변호사와의 1:1 상담 및 매칭**을 진행하여 적법하게 생계비를 극대화하고 변제금을 최소화하는 전략적 계획서를 수립하셔야 합니다.
              </p>
              <div className="pt-1.5 flex justify-end">
                <button 
                  onClick={() => {
                    setIncome(calcIncome);
                    setDebtTotal(calcDebt);
                    setDependents(calcDependents);
                    setRequestType('open');
                    setRequestStep(1);
                    setActiveTab('request');
                  }}
                  className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl transition-all"
                >
                  내 조건으로 전문 변호사 매칭받기 &rarr;
                </button>
              </div>
            </div>
          </div>
        )}


        {/* TAB: SUCCESS TESTIMONIALS/REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="space-y-8 animate-fadeIn text-left">
            {/* Page Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
              
              <div className="max-w-2xl relative z-10 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-200 text-xs font-extrabold rounded-full border border-indigo-500/30">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>실시간 채무 감면 성공 사례</span>
                </span>
                
                <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-tight">
                  회생톡 회생파산 성공후기
                </h1>
                
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                  가압류/독촉의 위기에서 벗어나 성공적으로 빚 탕감을 마친 분들의 생생한 후기입니다. 
                  동일 채무 분야의 변호사에게 1:1 상담을 신청하여 직접 기적을 만들어보세요.
                </p>
                
                {/* Micro statistics banner */}
                <div className="grid grid-cols-3 gap-3 md:gap-5 pt-4 border-t border-slate-700/50">
                  <div className="space-y-1">
                    <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">누적 탕감액</span>
                    <span className="block text-sm md:text-lg font-bold text-amber-400">84억 5,000만원+</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">인가면책 성공률</span>
                    <span className="block text-sm md:text-lg font-bold text-indigo-400">98.7%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] md:text-xs text-slate-400 font-semibold">평균 감면율</span>
                    <span className="block text-sm md:text-lg font-bold text-emerald-400">최대 78%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                
                {/* Search Bar */}
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="검색어 입력 (예: 코인, 독촉, 이소민...)"
                    value={reviewSearchQuery}
                    onChange={(e) => setReviewSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-brand"
                  />
                  {reviewSearchQuery && (
                    <button
                      onClick={() => setReviewSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Counter */}
                <span className="text-xs text-slate-400 font-semibold self-end md:self-center">
                  검색 결과: <strong className="text-brand dark:text-brand-light">{filteredReviews.length}</strong>건
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                {['전체', '코인/주식 손실', '신용카드 연체', '개인파산', '연대보증 채무', '프리랜서 회생'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setReviewCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                      reviewCategoryFilter === cat
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Reviews List Grid */}
            {filteredReviews.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-2xl text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">일치하는 성공 후기가 없습니다.</h4>
                <p className="text-xs text-slate-500">다른 검색어를 입력하시거나 카테고리 필터를 변경해 주세요.</p>
                <button
                  onClick={() => {
                    setReviewCategoryFilter('전체');
                    setReviewSearchQuery('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReviews.map(rev => {
                  // Calculate debt savings
                  const saved = rev.originalDebt - rev.remainingDebt;
                  const reductionRate = Math.round((saved / rev.originalDebt) * 100);

                  return (
                    <div
                      key={rev.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-lg transition-all p-5 flex flex-col justify-between space-y-5 group"
                    >
                      <div className="space-y-4">
                        {/* Badges & Rating */}
                        <div className="flex items-center justify-between">
                          <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
                            {rev.category}
                          </span>
                          <div className="flex text-amber-400 text-xs">★★★★★</div>
                        </div>

                        {/* Title */}
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-850 dark:text-white leading-snug group-hover:text-brand dark:group-hover:text-brand-light transition-colors line-clamp-2">
                          "{rev.title}"
                        </h3>

                        {/* Before / After Debt Box */}
                        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-950/40 dark:to-slate-950/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/80 space-y-2 text-xs font-bold">
                          <div className="flex justify-between items-center text-slate-500">
                            <span>기존 채무액</span>
                            <span className="line-through">{rev.originalDebt.toLocaleString()}만원</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-850 dark:text-white">
                            <span>조정 후 채무</span>
                            <span className="text-indigo-600 dark:text-indigo-450">
                              {rev.remainingDebt === 0 ? "전액 탕감 (0원)" : `${rev.remainingDebt.toLocaleString()}만원`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px]">
                            <span className="text-emerald-600 dark:text-emerald-450">총 감면 혜택</span>
                            <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 px-2 py-0.5 rounded font-extrabold">
                              {reductionRate}% 감면 (-{saved.toLocaleString()}만원)
                            </span>
                          </div>
                        </div>

                        {/* Content text */}
                        <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-normal line-clamp-3 md:line-clamp-none">
                          {rev.content}
                        </p>

                        {/* Tags list */}
                        <div className="flex flex-wrap gap-1">
                          {rev.tags.map(t => (
                            <button
                              key={t}
                              onClick={() => setReviewSearchQuery(t)}
                              className="text-[10px] text-slate-500 dark:text-slate-450 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-md hover:text-brand-hover dark:hover:text-brand-light transition-colors font-medium"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Footer & CTA */}
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        {/* Author & Lawyer */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">{rev.author}</span>
                          <div className="flex items-center gap-2">
                            <img
                              src={rev.lawyerAvatar}
                              alt={rev.lawyerName}
                              className="w-5.5 h-5.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100"
                            />
                            <div>
                              <span className="block font-bold text-slate-700 dark:text-slate-350 text-[11px] leading-none">
                                {rev.lawyerName}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold">도산 전담 변호사</span>
                            </div>
                          </div>
                        </div>

                        {/* CTA button */}
                        <button
                          onClick={() => handleReviewClick(rev)}
                          className="w-full text-center py-2.5 bg-brand hover:bg-brand dark:bg-blue-650 dark:hover:bg-brand text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
                        >
                          <HeartHandshake className="w-3.5 h-3.5" />
                          <span>이 변호사에게 동일 사건 상담 신청</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* TAB 2: HIGH-FIDELITY CUSTOMER INTAKE SCREEN */}
        {activeTab === 'request' && (
          <div className="animate-fadeIn">
            <CustomerIntake onSubmit={handleIntakeSubmit} />
          </div>
        )}

        {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
        {activeTab === 'lawyers' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="특정 변호사 명칭 또는 전문 키워드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">지역 필터:</span>
                <select 
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1"
                >
                  <option value="전체">전국 대응</option>
                  <option value="서울">서울</option>
                  <option value="서울/경기">서울/경기</option>
                  <option value="경기/수원">경기/수원</option>
                </select>
              </div>
            </div>

            {/* Grid of Lawyers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lawyers
                .filter(l => {
                  const queryLower = searchQuery.toLowerCase();
                  const matchesSearch = l.name.toLowerCase().includes(queryLower) || l.fields.some(f => f.toLowerCase().includes(queryLower)) || l.bio.toLowerCase().includes(queryLower);
                  const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
                  return matchesSearch && matchesRegion;
                })
                .map(l => (
                  <div key={l.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-4">
                    <img 
                      src={l.avatar} 
                      alt={l.name}
                      className="w-20 h-20 rounded-full object-cover bg-slate-100 dark:bg-slate-800 self-start sm:self-center"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{l.name}</h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{l.region} 법원 지원</span>
                        </div>
                        <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light text-[10px] font-semibold px-2 py-0.5 rounded">
                          수임 75건 이상
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">{l.bio}</p>

                      <div className="flex flex-wrap gap-1">
                        {l.fields.map(f => (
                          <span key={f} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded">
                            #{f}
                          </span>
                        ))}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{l.recentActivity}</span>
                        </span>

                        <button 
                          onClick={() => {
                            setRequestType('direct');
                            setSelectedLawyerId(l.id);
                            setRequestStep(1);
                            setActiveTab('request');
                          }}
                          className="bg-brand hover:bg-brand text-white font-semibold px-3 py-1.5 rounded-lg transition-colors text-[11px]"
                        >
                          상담 신청하기
                        </button>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ACTIVE COUNSELING/CHAT WORKSPACE */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 min-h-[500px] h-[calc(100vh-14rem)] lg:h-[650px] animate-fadeIn">
            
            {/* LEFT RAIL: ACTIVE REQUESTS */}
            <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">생성된 나의 상담 요청방</h3>
                <p className="text-slate-500 text-xs mt-0.5">상담 종류 및 매칭 여부를 확인할 수 있습니다.</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800_90 h-[400px]">
                {requests.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-slate-500 text-xs">작성 완료된 상담 요청 건이 현재 존재하지 않습니다.</p>
                    <button 
                      onClick={() => setActiveTab('request')}
                      className="text-xs text-brand hover:underline font-bold"
                    >
                      지금 첫 상담 무료 신청하기 &rarr;
                    </button>
                  </div>
                ) : (
                  requests.map(r => {
                    const isSelected = r.id === activeChatReqId;
                    const styleLabel = r.requestType === 'direct' ? '1:1 전담지정' : '3인 오픈참여';
                    
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => setActiveChatReqId(r.id)}
                        className={`p-4 cursor-pointer transition-colors text-left space-y-1.5 ${
                          isSelected ? 'bg-brand/10 border-l-4 border-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                            r.requestType === 'direct' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light'
                          }`}>
                            {styleLabel}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">{r.title}</h4>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>총 부채 {r.financialProfile.debtTotal.toLocaleString()}만 원</span>
                          <span className={`font-semibold ${
                            r.status === 'requested' ? 'text-amber-600' : r.status === 'responding' ? 'text-brand' : 'text-emerald-600'
                          }`}>
                            {r.status === 'requested' ? '요청 대기' : r.status === 'responding' ? '변호사 응답중' : '활발한 상담중'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CHAT BOARD & RIGHT WINDOW */}
            {currentRequest ? (
              <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-slate-900">
                {/* Header of Chat */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-brand dark:text-brand-light uppercase tracking-widest block">ACTIVE PREVIEW</span>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{currentRequest.title}</h3>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>상담 방 개방일: {new Date(currentRequest.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40">
                  <ChatDisclaimer />
                </div>

                {/* Messages feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[350px]">
                  {/* Embedded Client Profile details summary for Lawyers to see, and client to review */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] text-brand dark:text-brand-light">
                      📝 자가진단 분석 요약표 (변호사 열람 서류)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <div>• 월실수령액: <strong className="text-slate-800 dark:text-slate-200">{currentRequest.financialProfile.income}만 원</strong></div>
                      <div>• 총 채무: <strong className="text-slate-800 dark:text-slate-100">{currentRequest.financialProfile.debtTotal.toLocaleString()}만 원</strong></div>
                      <div>• 부양가족: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.dependents}명</strong></div>
                      <div>• 결혼: <strong className="text-slate-850 dark:text-slate-200">{currentRequest.financialProfile.maritalStatus === 'SINGLE' ? '미혼' : '기혼'}</strong></div>
                    </div>
                    {currentRequest.financialProfile.riskFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                        {currentRequest.financialProfile.riskFlags.map(rf => (
                          <span key={rf} className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[9px] px-1.5 py-0.5 rounded leading-none">
                            🚨 {rf}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {activeChatMessages.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      상담이 이제 막 생성되었습니다. 대화를 시작해 보세요.
                    </div>
                  ) : (
                    activeChatMessages.map(m => {
                      const isMe = m.senderType === 'client';
                      return (
                        <div 
                          key={m.id} 
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-350">{m.senderName}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          <div className={`p-3 rounded-xl max-w-md text-xs leading-relaxed ${
                            isMe 
                            ? 'bg-brand text-white rounded-tr-none' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="담당 변호사에게 메세지 전송..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChat();
                    }}
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-brand"
                  />
                  <button 
                    onClick={handleSendChat}
                    className="bg-brand hover:bg-brand text-white p-2 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 flex flex-col items-center justify-center p-8 text-center space-y-3 h-full bg-white dark:bg-slate-900">
                <Users className="w-12 h-12 text-slate-300" />
                <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">활성화된 상담 채널이 없습니다</h3>
                <p className="text-slate-500 text-xs max-w-sm">
                  새 상담을 접수하거나 왼쪽 레일에서 진행 중인 대화방을 선택해 자율 매칭 상황을 모니터링할 수 있습니다.
                </p>
                <button 
                  onClick={() => setActiveTab('request')}
                  className="bg-brand hover:bg-brand text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  상담 신청하기
                </button>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Subtle Bottom legal status line */}
      <footer className="bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center py-4 text-[10px] text-slate-500 space-y-1">
        <p>© 2026 개인회생·파산 법률 상담 요청 기반 Legal CRM SaaS 플랫폼. All rights reserved.</p>
        <p>본 플랫폼은 변호사법 제34조에 의거 변호사 알선료, 수수료 수취를 금지하는 공공 가이드라인 구조를 채택해 운영 중입니다.</p>
      </footer>

      {/* Auth Modal (로그인 / 회원가입) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-5 relative overflow-hidden text-left animate-slideUp sm:animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  의뢰인 스텔스 보안
                </span>
                <h3 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">로그인 및 회원가입</h3>
                <p className="text-xs text-slate-500 mt-1">
                  채무 사실 노출을 막기 위해 가명 닉네임과 가명 발신자 알림 시스템이 자동으로 활성화됩니다.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAuthModal(false);
                  setOtpSent(false);
                  setOtpError('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Social Logins */}
            <div className="space-y-2.5 pt-2">
              <button 
                onClick={() => handleSocialLogin('Google')}
                className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span>
                <span>Google로 간편 로그인</span>
              </button>

              <button 
                onClick={() => handleSocialLogin('카카오')}
                className="w-full bg-[#FEE500] hover:bg-[#FEE500]/95 text-[#191919] font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-extrabold text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full">K</span>
                <span>카카오로 간편 로그인</span>
              </button>

              <button 
                onClick={() => handleSocialLogin('네이버')}
                className="w-full bg-[#03C75A] hover:bg-[#03C75A]/95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
              >
                <span className="w-4 h-4 flex items-center justify-center font-black text-xs bg-white text-[#03C75A] rounded-full">N</span>
                <span>네이버로 간편 로그인</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold">또는 휴대폰 인증번호 로그인</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            {/* Phone Login Form */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">휴대폰 번호</label>
                <div className="flex gap-2">
                  <input 
                    type="tel"
                    placeholder="010-1234-5678"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    disabled={otpSent}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand disabled:opacity-50"
                  />
                  <button 
                    onClick={handleSendOtp}
                    disabled={otpSent}
                    className="bg-brand hover:bg-brand-hover text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  >
                    {otpSent ? '발송 완료' : '인증번호 발송'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2 animate-slideDown">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">인증번호 6자리</label>
                    <span className="text-[11px] text-red-500 font-bold">
                      {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="인증번호 6자리 입력 (777777)"
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value)}
                      maxLength={6}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand"
                    />
                    <button 
                      onClick={handleVerifyOtp}
                      className="bg-brand hover:bg-brand text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0"
                    >
                      인증 및 로그인
                    </button>
                  </div>
                </div>
              )}

              {otpError && <p className="text-xs text-red-500 font-semibold">{otpError}</p>}
            </div>

            {/* Terms Consent */}
            <div className="flex items-start gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input 
                type="checkbox" 
                id="authConsent" 
                checked={authConsent}
                onChange={(e) => setAuthConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-brand focus:ring-brand w-4 h-4 shrink-0"
              />
              <label htmlFor="authConsent" className="text-[11px] text-slate-600 dark:text-slate-400 select-none cursor-pointer leading-normal">
                <strong>(필수)</strong> 개인정보 제3자 제공 및 신용정보원 마이데이터 대출/연체 정보 조회 동의서에 동의합니다.
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (스텔스 & 보안 설정) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden text-left animate-slideUp sm:animate-fadeIn">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  스텔스 설정
                </span>
                <h3 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">보안 및 스텔스 설정</h3>
                <p className="text-xs text-slate-500 mt-1">
                  휴대폰 화면 노출을 완전 차단하고, 법률 용어가 들어간 메세지를 일반 안내로 우회합니다.
                </p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-1">
              {/* Alias generation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">의뢰인 가명 설정 (변호사 노출명)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={userAlias}
                    onChange={(e) => setUserAlias(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand"
                  />
                  <button 
                    onClick={handleRegenAlias}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 rounded-xl text-xs transition-colors shrink-0 border border-slate-200 dark:border-slate-700"
                  >
                    가명 재발급
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  * 실명이 아닌 법적 효력이 무관한 임의의 식별 닉네임을 생성하여 플랫폼 내 모든 노출을 가명화합니다.
                </p>
              </div>

              {/* Sender Name Override */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">카카오 알림톡/SMS 발신자 표기명 변경</label>
                <input 
                  type="text" 
                  value={senderNameOverride}
                  onChange={(e) => setSenderNameOverride(e.target.value)}
                  placeholder="예: 회생톡, 오피스원"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['회생톡', '오피스원', '가족생활건강', 'L-CRM'].map(name => (
                    <button
                      key={name}
                      onClick={() => setSenderNameOverride(name)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                        senderNameOverride === name 
                        ? 'bg-brand-light text-brand border-brand/20 dark:bg-brand/10 dark:text-brand-light dark:border-blue-900' 
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Mode (Stealth Level) */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">스텔스 알림 보안 레벨</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'STEALTH', 'SECRET'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAlertMode(mode)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        alertMode === mode
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'NORMAL' ? '일반 모드' : mode === 'STEALTH' ? '스텔스 모드' : '비밀 모드'}
                    </button>
                  ))}
                </div>

                {/* Dynamic Screen Notification Preview */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl text-left space-y-2">
                  <span className="text-[10px] text-slate-400 block border-b border-slate-200 dark:border-slate-800 pb-1 font-semibold uppercase tracking-wider">
                    🔔 모바일 수신 화면 미리보기
                  </span>
                  
                  <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 max-w-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 text-xs font-bold">
                      {alertMode === 'NORMAL' ? 'L' : senderNameOverride.slice(0, 1)}
                    </div>
                    <div className="space-y-0.5 text-left flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <strong className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {alertMode === 'NORMAL' ? '개인회생CRM' : senderNameOverride}
                        </strong>
                        <span className="text-[9px] text-slate-400">방금 전</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed truncate">
                        {alertMode === 'NORMAL' && '이소민 변호사가 대화방에 입장해 답변을 남겼습니다.'}
                        {alertMode === 'STEALTH' && '요청하신 서비스의 신규 메세지가 도착했습니다. 본인 확인 후 열람 가능합니다.'}
                        {alertMode === 'SECRET' && '안내드립니다. 본인 지정 우편물 발송 안내 메세지입니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 rounded-2xl text-xs transition-colors shadow-md"
              >
                설정 저장 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom GNB (Global Navigation Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-around py-2.5 pb-safe-bottom shadow-lg">
        {/* 홈 */}
        <button
          onClick={() => setActiveTab('landing')}
          className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors ${
            activeTab === 'landing' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">홈</span>
        </button>

        {/* 계산기 */}
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors ${
            activeTab === 'calculator' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">탕감 계산기</span>
        </button>

        {/* 성공후기 */}
        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
            activeTab === 'reviews' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">성공 후기</span>
        </button>

        {/* 상담신청 */}
        <button
          onClick={() => {
            setRequestType('open');
            setRequestStep(1);
            setActiveTab('request');
          }}
          className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors ${
            activeTab === 'request' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">상담 신청</span>
        </button>

        {/* 내상담 */}
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
            activeTab === 'chat' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">내 상담방</span>
          <span className="absolute top-1.5 right-4.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
          </span>
        </button>
      </nav>

      {/* 8대 채무 맞춤 솔루션 모달 (Remedy Modal) */}
      {activeRemedyCategory && remedyData[activeRemedyCategory] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header with theme color background */}
            <div className="relative p-6 md:p-8 text-left border-b border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setActiveRemedyCategory(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  activeRemedyCategory === 'card_loan' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                  activeRemedyCategory === 'bank_loan' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20' :
                  activeRemedyCategory === 'high_interest' ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/20' :
                  activeRemedyCategory === 'guarantee' ? 'bg-purple-50 text-purple-500 dark:bg-purple-950/20' :
                  activeRemedyCategory === 'investment' ? 'bg-orange-50 text-orange-500 dark:bg-orange-950/20' :
                  activeRemedyCategory === 'freelancer' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' :
                  activeRemedyCategory === 'seizure' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                  'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20'
                }`}>
                  {renderRemedyIcon(remedyData[activeRemedyCategory].iconName, "w-6 h-6")}
                </div>
                <div className="space-y-0.5">
                  <span className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light">
                    {remedyData[activeRemedyCategory].badgeText}
                  </span>
                  <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {remedyData[activeRemedyCategory].title} 맞춤 법리 솔루션
                  </h4>
                </div>
              </div>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto text-left">
              
              {/* Section 1: 법리적 대표 해결책 */}
              <div className="bg-slate-50 dark:bg-slate-950/30 p-5 md:p-6 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-3">
                <h5 className="font-extrabold text-sm text-brand dark:text-brand-light flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  <span>법률상 대표적 해법 (Remedy)</span>
                </h5>
                <div className="space-y-2">
                  <h6 className="font-bold text-sm text-slate-805 dark:text-slate-200">
                    "{remedyData[activeRemedyCategory].remedyTitle}"
                  </h6>
                  <p className="text-xs text-[#7e7e8f] dark:text-slate-400 leading-relaxed font-medium">
                    {remedyData[activeRemedyCategory].remedyDesc}
                  </p>
                </div>
              </div>

              {/* Section 2: 변호사 조언 (골든타임 가이드) */}
              <div className="bg-rose-50/40 dark:bg-rose-950/10 p-5 md:p-6 rounded-2xl border border-rose-100/50 dark:border-rose-900/10 space-y-3">
                <h5 className="font-extrabold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>🚨 변호사의 골든타임 행동 지침</span>
                </h5>
                <div className="space-y-2">
                  <h6 className="font-bold text-sm text-slate-850 dark:text-slate-200">
                    {remedyData[activeRemedyCategory].guideTitle}
                  </h6>
                  <p className="text-xs text-[#7e7e8f] dark:text-slate-400 leading-relaxed font-medium">
                    {remedyData[activeRemedyCategory].guideDesc}
                  </p>
                </div>
              </div>

              {/* Live matching stats badge */}
              <div className="flex items-center justify-between text-[11px] font-bold text-[#7e7e8f] bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  실시간 도산 전문 변호사 매칭 대기 중
                </span>
                <span className="text-brand">안심 100% 비공개 보장</span>
              </div>
            </div>

            {/* Footer with CTA Button */}
            <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button 
                onClick={() => setActiveRemedyCategory(null)}
                className="px-5 py-3 rounded-2xl text-xs font-extrabold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                닫기
              </button>
              <button 
                onClick={() => handleApplyRemedy(activeRemedyCategory)}
                className="flex-1 sm:flex-none px-7 py-3 bg-brand text-white rounded-2xl text-xs font-extrabold shadow-lg shadow-brand/20 hover:shadow-xl hover:bg-brand-dark transition-all duration-300 transform active:scale-[0.98] animate-pulse hover:animate-none flex items-center justify-center gap-2"
              >
                <span>이 솔루션으로 1:1 진단 및 상담 신청하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}
