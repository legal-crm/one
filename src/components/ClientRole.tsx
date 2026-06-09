import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronRight, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X, Home, BookOpen, MessageSquare, MapPin, Check, Edit2
} from 'lucide-react';
import { Client, FinancialProfile, ConsultRequest, User as LawyerType, ConsultMessage, IntakeData, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, PlatformConfig, ClientInquiry } from '../types';
import { CustomerIntake } from './CustomerIntake';
import { calculateRehabPlan } from '../rehabEngine';
import AIRehabChatbotV2 from '../rehab-chatbot-package/components/rehab/AIRehabChatbotV2';
import { RehabUserInput, RehabCalculationResult } from '../rehab-chatbot-package/services/calculationService';
import { IncomeSource, AssetDetail, DebtItem, PrevHistory, SpecialCircumstances, ExtraLivingCost, ConsultationLog } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { formatKoreanCurrency, formatNumber } from '../utils';
import { mockLawyers, initialConsultRequests, initialConsultMessages } from '../data';
import { RequestDisclaimer, ChatDisclaimer } from './Disclaimers';
import { supabase } from '../supabaseClient';
import ReviewsView from './client/ReviewsView';
import CalculatorView from './client/CalculatorView';
import QnAView from './client/QnAView';
import ChatView from './client/ChatView';
import NewsView from './client/NewsView';
import NoticesView from './client/NoticesView';
import LawyersView from './client/LawyersView';
import AuthModal from './client/AuthModal';
import MyPageView from './client/MyPageView';
import InquiryView from './client/InquiryView';
import DiagnosisFlow from './client/DiagnosisFlow';
import DiagnosisResultView from './client/DiagnosisResult';
import ClientFooter from './client/ClientFooter';
import TermsModal from './client/TermsModal';
import MobileGNB from './client/MobileGNB';
import RemedyModal from './client/RemedyModal';
import NewsDetailModal from './client/NewsDetailModal';
import { loadDiagnosisConfig, saveDiagnosisResult } from '../services/diagnosisService';
import { DiagnosisResult as DiagnosisResultType, DiagnosisConfig } from '../types';

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
    guideDesc: '급여 압류가 들어올 경우 직장 급여담당자에게 강제 압류 결정문이 송달되어 심각한 신용 저하 소문이 직장 내 퍼질 수 있습니다. 연체 시작 후 지급명령 결정문이나 소장 수령 즉시 법원 접수를 진행해야 파국을 피할 수 있습니다. 만약 압류가 개시되었다면 법원 중지 결정을 통해 회사 급여담당자가 임금을 채권자에게 양도하지 못하도록 차단하고 압류 적립금(법원 공탁금)을 예치 처리해야 합니다.',
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
  newsArticles: NewsArticle[];
  setNewsArticles: React.Dispatch<React.SetStateAction<NewsArticle[]>>;
  qas: ClientQA[];
  setQas: React.Dispatch<React.SetStateAction<ClientQA[]>>;
  reviews: SuccessReview[];
  setReviews: React.Dispatch<React.SetStateAction<SuccessReview[]>>;
  banners: MainBanner[];
  setBanners: React.Dispatch<React.SetStateAction<MainBanner[]>>;
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  matchingPolicy: 'daily' | 'weekly' | 'unlimited';
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  onLogActivity: (memberId: string, memberName: string, role: MemberRole, action: ActivityLog['action'], details: string) => void;
  platformConfig: PlatformConfig;
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
}

export default function ClientRole({
  requests,
  setRequests,
  messages,
  setMessages,
  lawyers,
  onAddMessage,
  newsArticles,
  setNewsArticles,
  qas,
  setQas,
  reviews,
  setReviews,
  banners,
  setBanners,
  notices,
  setNotices,
  matchingPolicy,
  members,
  setMembers,
  onLogActivity,
  platformConfig,
  inquiries,
  setInquiries
}: ClientRoleProps) {
  // Sub-navigation for user
  const [activeTab, setActiveTab] = useState<'landing' | 'request' | 'lawyers' | 'chat' | 'calculator' | 'reviews' | 'qna' | 'mypage' | 'news' | 'notices' | 'inquiry'>('landing');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [pendingChatbotData, setPendingChatbotData] = useState<{ res: RehabCalculationResult; input: RehabUserInput } | null>(null);

  // Terms and Privacy popup states
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [termsModalType, setTermsModalType] = useState<'tos' | 'privacy'>('tos');

  // Client 1:1 Inquiry state
  const [inquiryTitle, setInquiryTitle] = useState<string>('');
  const [inquiryContent, setInquiryContent] = useState<string>('');

  const checkMatchingLimit = (): boolean => {
    if (matchingPolicy === 'unlimited') return true;

    const clientRequests = requests.filter(r => r.clientId === 'client-temp');
    if (clientRequests.length === 0) return true;

    const sorted = [...clientRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestRequest = sorted[0];

    const latestTime = new Date(latestRequest.createdAt).getTime();
    const currentTime = Date.now();
    const diffMs = currentTime - latestTime;

    if (matchingPolicy === 'daily') {
      if (diffMs < 24 * 60 * 60 * 1000) {
        const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - diffMs) / (60 * 60 * 1000));
        alert(`[매칭 제한 정책 안내]\n현재 플랫폼 정책(매일 최대 3인 매칭)에 따라 새로운 상담 신청을 하실 수 없습니다.\n마지막 신청으로부터 24시간이 경과해야 합니다. (남은 시간: 약 ${remainingHours}시간)`);
        return false;
      }
    } else if (matchingPolicy === 'weekly') {
      if (diffMs < 7 * 24 * 60 * 60 * 1000) {
        const remainingDays = Math.ceil((7 * 24 * 60 * 60 * 1000 - diffMs) / (24 * 60 * 60 * 1000));
        alert(`[매칭 제한 정책 안내]\n현재 플랫폼 정책(매주 최대 3인 매칭)에 따라 새로운 상담 신청을 하실 수 없습니다.\n마지막 신청으로부터 7일이 경과해야 합니다. (남은 시간: 약 ${remainingDays}일)`);
        return false;
      }
    }

    return true;
  };
  
  // Home Landing States
  const [calcIncome, setCalcIncome] = useState<number>(250);
  const [calcDebt, setCalcDebt] = useState<number>(7000);
  const [calcDependents, setCalcDependents] = useState<number>(0);
  const [bannerIndex, setBannerIndex] = useState<number>(0);
  const [openedQaId, setOpenedQaId] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');
  const [qnaSearchQuery, setQnaSearchQuery] = useState<string>('');
  const [qnaCategoryFilter, setQnaCategoryFilter] = useState<string>('전체');
  const [qnaPage, setQnaPage] = useState<number>(1);

  // News States
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<string>('전체');
  const [newsPage, setNewsPage] = useState<number>(1);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);


  // User Auth & Privacy States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [isEditingAlias, setIsEditingAlias] = useState<boolean>(false);
  const [tempAlias, setTempAlias] = useState<string>('');
  const [alertMode, setAlertMode] = useState<'NORMAL' | 'STEALTH' | 'SECRET'>('STEALTH');
  const [senderNameOverride, setSenderNameOverride] = useState<string>('회생톡');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Email and Real Auth States

  // Diagnosis States
  const [diagnosisPhase, setDiagnosisPhase] = useState<'idle' | 'flow' | 'result'>('idle');
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResultType | null>(null);
  const [diagnosisConfig, setDiagnosisConfig] = useState<DiagnosisConfig | null>(null);


  // Helper: Record client login/signup activity
  const recordClientLogin = (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => {
    let targetId = localStorage.getItem('legal_crm_client_id');
    if (!targetId) {
      targetId = `client-${Date.now()}`;
      localStorage.setItem('legal_crm_client_id', targetId);
    }
    
    setMembers(prev => {
      const exists = prev.find(m => m.id === targetId || m.alias === alias);
      if (exists) {
        onLogActivity(exists.id, exists.alias, 'CLIENT', 'LOGIN', `${channel.toUpperCase()} 계정 안전 로그인 성공`);
        return prev.map(m => m.id === exists.id ? { ...m, lastActiveAt: new Date().toISOString(), loginChannel: channel } : m);
      } else {
        const newMember: Member = {
          id: targetId!,
          alias: alias,
          email: emailOrPhone.includes('@') ? emailOrPhone : undefined,
          phone: !emailOrPhone.includes('@') ? emailOrPhone : undefined,
          role: 'CLIENT',
          createdAt: new Date().toISOString(),
          loginChannel: channel,
          status: 'active',
          lastActiveAt: new Date().toISOString()
        };
        onLogActivity(newMember.id, newMember.alias, 'CLIENT', 'SIGNUP', `${channel.toUpperCase()} 간편 회원가입 완료 (스텔스 가명: ${alias})`);
        onLogActivity(newMember.id, newMember.alias, 'CLIENT', 'LOGIN', `${channel.toUpperCase()} 첫 로그인 성공`);
        return [...prev, newMember];
      }
    });
  };

  // Load Diagnosis Config
  useEffect(() => { loadDiagnosisConfig().then(c => { if(c) setDiagnosisConfig(c); }); }, []);

  // Suspended, Withdrawn, or Dormant check hook
  useEffect(() => {
    if (isLoggedIn && userAlias) {
      const currentMember = members.find(m => m.alias === userAlias);
      if (currentMember) {
        if (currentMember.status === 'suspended' || currentMember.status === 'withdrawn') {
          const msg = currentMember.status === 'withdrawn'
            ? '탈퇴 완료된 계정입니다. 해당 계정 정보를 더 이상 이용할 수 없습니다.'
            : '이 계정은 운영정책 위반 또는 스팸으로 인해 일시 정지 처리되었습니다. 고객센터에 문의하십시오.';
          alert(msg);
          setIsLoggedIn(false);
          setUserAlias('');
          localStorage.removeItem('legal_crm_client_alias');
        } else if (currentMember.status === 'dormant') {
          if (confirm('휴면 처리된 계정입니다. 휴면을 해제하고 정상 활성화하시겠습니까?')) {
            setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, status: 'active', lastActiveAt: new Date().toISOString() } : m));
            onLogActivity(
              currentMember.id,
              currentMember.alias,
              'CLIENT',
              'LOGIN',
              `휴면 계정 본인 확인 및 수동 휴면 해제 성공`
            );
          } else {
            setIsLoggedIn(false);
            setUserAlias('');
            localStorage.removeItem('legal_crm_client_alias');
          }
        }
      }
    }
  }, [isLoggedIn, userAlias, members]);

  // Debounced effect to log calculator parameter adjustments
  useEffect(() => {
    if (activeTab !== 'calculator') return;
    const timer = setTimeout(() => {
      const minLivingCost = calcDependents === 0 ? 133 : calcDependents === 1 ? 221 : calcDependents === 2 ? 282 : 343;
      const monthlyRepayment = Math.max(0, calcIncome - minLivingCost);
      const totalRepayment = Math.min(calcDebt, monthlyRepayment * 36);
      const totalReduction = Math.max(0, calcDebt - totalRepayment);
      const reductionRate = calcDebt > 0 ? Math.round((totalReduction / calcDebt) * 100) : 0;
      
      const clientName = isLoggedIn ? userAlias : '익명 의뢰인';
      const clientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
      onLogActivity(
        clientId,
        clientName,
        'CLIENT',
        'CALCULATE',
        `자가진단 실행: 월 소득 ${calcIncome}만원, 채무 ${calcDebt}만원, 부양가족 ${calcDependents}명 -> 예상 탕감액: ${totalReduction.toLocaleString()}만원 (탕감률 ${reductionRate}%)`
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [calcIncome, calcDebt, calcDependents, activeTab]);

  // OTP and Verification Simulation States



  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        const metaAlias = session.user.user_metadata?.alias;
        if (metaAlias) {
          setUserAlias(metaAlias);
        } else {
          const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
          setUserAlias(generatedAlias);
          supabase.auth.updateUser({
            data: { alias: generatedAlias }
          });
        }
      }
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        const metaAlias = session.user.user_metadata?.alias;
        if (metaAlias) {
          setUserAlias(metaAlias);
        } else {
          const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
          setUserAlias(generatedAlias);
          supabase.auth.updateUser({
            data: { alias: generatedAlias }
          });
        }
      } else {
        setIsLoggedIn(false);
        setUserAlias('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
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
  const [lawyerPage, setLawyerPage] = useState<number>(1);

  useEffect(() => {
    setLawyerPage(1);
  }, [searchQuery, selectedRegion]);

  // Currently opened Chat consultation request ID
  const [activeChatReqId, setActiveChatReqId] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [phoneConsultNum, setPhoneConsultNum] = useState<string>('');
  const [useSafeNumber050, setUseSafeNumber050] = useState<boolean>(true);
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const [activeRemedyCategory, setActiveRemedyCategory] = useState<string | null>(null);

  // Reviews page state
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState<string>('전체');
  const [reviewSearchQuery, setReviewSearchQuery] = useState<string>('');
  const [reviewPage, setReviewPage] = useState<number>(1);



  // Banner rotation logic
  useEffect(() => {
    if (!banners || banners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [banners]);



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
  const handleReviewClick = (rev: SuccessReview) => {
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
  const filteredReviews = reviews.filter(rev => {
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

  // Slicing reviews for pagination (9 items per page)
  const itemsPerPage = 9;
  const totalReviewPages = Math.ceil(filteredReviews.length / itemsPerPage);
  const activeReviewPage = Math.min(reviewPage, Math.max(1, totalReviewPages));
  const paginatedReviews = filteredReviews.slice(
    (activeReviewPage - 1) * itemsPerPage,
    activeReviewPage * itemsPerPage
  );

  // Slicing Q&A for pagination (10 items per page)
  const filteredQAs = qas.filter(qa => {
    // Category Filter
    if (qnaCategoryFilter !== '전체' && qa.category !== qnaCategoryFilter) return false;
    
    // Text Search Query
    if (!qnaSearchQuery) return true;
    const query = qnaSearchQuery.toLowerCase();
    return qa.question.toLowerCase().includes(query) || 
           qa.category.toLowerCase().includes(query) || 
           qa.answer.toLowerCase().includes(query) || 
           qa.lawyerName.toLowerCase().includes(query);
  });

  const qnaItemsPerPage = 10;
  const totalQnaPages = Math.ceil(filteredQAs.length / qnaItemsPerPage);
  const activeQnaPage = Math.min(qnaPage, Math.max(1, totalQnaPages));
  const paginatedQAs = filteredQAs.slice(
    (activeQnaPage - 1) * qnaItemsPerPage,
    activeQnaPage * qnaItemsPerPage
  );




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
    if (!checkMatchingLimit()) return;
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

    // Log consult request activity
    const finalClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '익명 의뢰인',
      'CLIENT',
      'CONSULT_REQUEST',
      `상담 신청 제출: "${title}" (채무 규모: ${finalDebtTotal.toLocaleString()}만원)`
    );

    // Reset Form
    setRequestStep(1);
    setTitle('');
    setContent('');
    setConsentCheck(false);
    setActiveTab('chat');
  };

  const mapChatbotDataToIntakeData = (
    result: RehabCalculationResult,
    input: RehabUserInput
  ): IntakeData => {
    const age = input.age || 35;
    const birthYear = 2026 - age;
    const birthDate = `${birthYear}-01-01`;

    let maritalStatus: IntakeData['maritalStatus'] = 'single';
    if (input.maritalStatus === 'married') {
      maritalStatus = 'married';
    } else if (input.maritalStatus === 'divorced') {
      if (input.childSupportReceived && input.childSupportReceived > 0) {
        maritalStatus = 'divorced_receiving';
      } else if (input.childSupportPaid && input.childSupportPaid > 0) {
        maritalStatus = 'divorced_sending';
      } else {
        maritalStatus = 'divorced';
      }
    }

    const incomeSources: IncomeSource[] = [];
    const monthlyIncome = input.monthlyIncome || 0;
    if (input.employmentType === 'salary' || input.employmentType === 'both') {
      incomeSources.push({
        id: `inc-salary-${Date.now()}`,
        type: 'worker',
        amount: input.salaryIncome || monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'business' || input.employmentType === 'both') {
      incomeSources.push({
        id: `inc-business-${Date.now()}`,
        type: 'business',
        amount: input.businessIncome || monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'freelancer') {
      incomeSources.push({
        id: `inc-freelancer-${Date.now()}`,
        type: 'freelancer',
        amount: monthlyIncome,
        tenureYears: 1,
        payType: 'bank'
      });
    }
    if (input.employmentType === 'none' || incomeSources.length === 0) {
      incomeSources.push({
        id: `inc-none-${Date.now()}`,
        type: 'unemployed',
        amount: monthlyIncome,
        tenureYears: 0,
        payType: 'bank'
      });
    }

    const assets: AssetDetail[] = [];
    if (input.myAssets && input.myAssets > 0) {
      assets.push({
        id: `asset-my-${Date.now()}`,
        owner: 'self',
        type: 'other',
        description: '본인 보유 자산',
        marketValue: input.myAssets,
        loanBalance: 0,
        hasPledge: false,
        isExempt: false
      });
    }

    if (input.spouseAssets && input.spouseAssets > 0) {
      assets.push({
        id: `asset-spouse-${Date.now()}`,
        owner: 'spouse',
        type: 'other',
        description: '배우자 보유 자산',
        marketValue: input.spouseAssets,
        loanBalance: 0,
        hasPledge: false,
        isExempt: false
      });
    }

    if (input.deposit && input.deposit > 0) {
      assets.push({
        id: `asset-deposit-${Date.now()}`,
        owner: 'self',
        type: 'deposit',
        description: input.housingType === 'jeonse' ? '전세 보증금' : '월세 보증금',
        marketValue: input.deposit,
        loanBalance: input.depositLoan || 0,
        hasPledge: !!(input.depositLoan && input.depositLoan > 0),
        isExempt: false
      });
    }

    const debts: DebtItem[] = [];
    const totalDebt = input.totalDebt || 0;
    const creditCardDebt = input.creditCardDebt || 0;
    const priorityDebt = input.priorityDebt || 0;
    const unsecuredDebt = Math.max(0, totalDebt - creditCardDebt - priorityDebt);

    if (creditCardDebt > 0) {
      debts.push({
        id: `debt-card-${Date.now()}`,
        creditor: '신용카드/카드론 채무',
        principal: creditCardDebt,
        interest: 0,
        type: 'unsecured',
        isGamblingOrLuxury: input.riskFactor === 'gambling' || input.riskFactor === 'investment',
        isRecent: input.riskFactor === 'recent_loan'
      });
    }

    if (priorityDebt > 0) {
      debts.push({
        id: `debt-tax-${Date.now()}`,
        creditor: '세금/국세 체납 채무',
        principal: priorityDebt,
        interest: 0,
        type: 'tax',
        isGamblingOrLuxury: false,
        isRecent: false
      });
    }

    if (unsecuredDebt > 0 || debts.length === 0) {
      debts.push({
        id: `debt-unsecured-${Date.now()}`,
        creditor: '신용대출 및 기타채무',
        principal: unsecuredDebt > 0 ? unsecuredDebt : totalDebt,
        interest: 0,
        type: 'unsecured',
        isGamblingOrLuxury: input.riskFactor === 'gambling' || input.riskFactor === 'investment',
        isRecent: input.riskFactor === 'recent_loan'
      });
    }

    const prevHistory: PrevHistory = {
      exists: false
    };

    const specialCircumstances: SpecialCircumstances = {
      singleParent: false,
      basicLivelihood: input.specialCondition === 'basic_recipient',
      rentFraud: false,
      severeDisability: input.specialCondition === 'severe_disability'
    };

    const extraLivingCost: ExtraLivingCost = {
      utilities: 0,
      education: input.educationCost || 0,
      specialEducation: input.hasSpecialEducation ? (input.educationCost || 0) : 0,
      medical: input.medicalCost || 0,
      other: 0,
      highIncomeExtraLimit: 0
    };

    const consultationLogs: ConsultationLog[] = [
      {
        id: `chat-log-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        consultantId: 'client',
        consultantName: input.name || '의뢰인',
        content: `챗봇 자가진단 실행완료.\n주요 조언:\n${result.aiAdvice ? result.aiAdvice.join('\n') : ''}`
      }
    ];

    const minorChildren = input.minorChildren || 0;
    const familySize = input.familySize || 1;

    return {
      clientName: input.name || '익명 의뢰인',
      phoneNumber: input.phone || '010-0000-0000',
      birthDate,
      consultDate: new Date().toISOString().split('T')[0],
      applyYear: 2026,
      dbVendor: '온라인광고',
      caseType: 'individual_rehab',
      residence: input.address || '',
      workplace: input.workLocation || '',
      selectedCourt: result.courtName || '서울회생법원',
      prevHistory,
      maritalStatus,
      spouseIncome: input.spouseIncome || 0,
      childSupportCost: input.childSupportPaid || 0,
      minorChildren,
      minorChildrenFullRecognition: false,
      otherDependents: Math.max(0, familySize - 1 - minorChildren),
      incomeSources,
      monthlyLivingCost: result.baseLivingCost || 0,
      monthlyRent: input.rentCost || 0,
      monthlyInsurance: 0,
      extraLivingCost,
      specialCircumstances,
      assets,
      debts,
      consultationLogs
    };
  };

  const handleIntakeSubmit = (intakeData: IntakeData) => {
    if (!checkMatchingLimit()) return;
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
      content: `정밀 자가진단 분석 결과:\n- 월 소득: ${formatKoreanCurrency(result.client.monthlyIncome)}\n- 인정 생계비: ${formatKoreanCurrency(result.base.living)}\n- 예상 월 가용소득: ${formatKoreanCurrency(result.base.disposable)}\n- 예상 월 변제금: ${formatNumber(result.preferred?.monthly || 0)}원 (${result.preferred?.m || 36}개월)\n- 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)}\n- 총 청산가치(자산): ${formatKoreanCurrency(result.base.liq)}\n\n[의뢰인 소명 요지]\n과거 개인회생 이력: ${intakeData.prevHistory.exists ? '있음 (' + intakeData.prevHistory.caseNumber + ')' : '없음'}\n현재 거주 지역: ${intakeData.residence}\n주된 직업 유형: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : '영업 소득자'}\n\n[의뢰인 요청 및 특이사항]\n${intakeData.consultationLogs[0]?.content || '없음'}`,
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

    // Log calculation and request activity
    const finalClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '익명 의뢰인',
      'CLIENT',
      'CALCULATE',
      `정밀 자가진단 실행 (총 채무: ${formatKoreanCurrency(result.base.debtTotal)}, 예상 월 변제금: ${formatNumber(result.preferred?.monthly || 0)}원)`
    );
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '익명 의뢰인',
      'CLIENT',
      'CONSULT_REQUEST',
      `정밀 개인회생 상담 신청 제출: "${intakeData.clientName}님의 정밀 분석 신청"`
    );
    
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
    
    const finalClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '의뢰인',
      'CLIENT',
      'CHAT_SEND',
      `채팅 메시지 전송: "${chatInput.trim().substring(0, 30)}${chatInput.trim().length > 30 ? '...' : ''}"`
    );

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

  // Real Supabase and Fallback Auth Handlers

  const handleRegenAlias = () => {
    const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
    setUserAlias(generatedAlias);
  };

  // Helper values
  const currentRequest = requests.find(r => r.id === activeChatReqId);
  const activeChatMessages = messages.filter(m => m.consultRequestId === activeChatReqId);

  // Auto scroll to bottom of chat feed when new messages arrive or when channel updates
  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [activeChatMessages]);

  // Formatted calculation
  const totalCalculatedDebt = debtBanks + debtCards + debtPersonals + recentLoans + coinCrypto;



  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F7] dark:bg-slate-950 text-[#313142] dark:text-slate-100 font-sans">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-white dark:bg-slate-900 border-x border-slate-100 dark:border-slate-800 shadow-sm flex flex-col relative">
      
        {/* Dynamic Client Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 w-full">
          <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('landing')}>
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt={platformConfig.siteLogoText || "회생톡 로고"} className="w-9 h-9 rounded-xl object-cover shadow-sm shadow-brand/20" />
              <div className="flex flex-col text-left">
                <span className="font-black text-lg tracking-tight text-[#313142] dark:text-white leading-none">{platformConfig.siteLogoText || "회생톡"}</span>
                <span className="text-[9px] text-[#7e7e8f] dark:text-slate-500 font-bold tracking-wide mt-0.5">안심 채무 해결 센터</span>
              </div>
            </div>

          <nav className="flex items-center gap-1 lg:gap-1.5">
            <div className="hidden md:flex items-center gap-1 lg:gap-1.5">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'landing' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                홈
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'reviews' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                성공 후기
              </button>
              <button 
                onClick={() => setActiveTab('qna')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'qna' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                상담 사례
              </button>

              <button 
                onClick={() => setActiveTab('request')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'request' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                상담 신청
              </button>
              <button 
                onClick={() => setActiveTab('lawyers')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'lawyers' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                변호사 찾기
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`relative whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                  activeTab === 'chat' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                내 상담방
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
                </span>
              </button>
              {isLoggedIn && (
                <button 
                  onClick={() => setActiveTab('mypage')}
                  className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-all ${
                    activeTab === 'mypage' ? 'bg-brand-light dark:bg-brand/10 text-brand font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  마이페이지
                </button>
              )}
            </div>
 
            {/* Auth section */}
            {isLoggedIn ? (
              <div className="flex items-center gap-1.5 lg:gap-2.5 ml-1 lg:ml-2 pl-2 lg:pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-end hidden lg:flex whitespace-nowrap shrink-0">
                  <span className="text-[10px] lg:text-[11px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    👤 <span className="text-brand dark:text-brand-light whitespace-nowrap">{userAlias}</span>님
                  </span>
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded font-semibold leading-none">
                    스텔스 보호중
                  </span>
                </div>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsLoggedIn(false);
                    setUserAlias('');
                  }}
                  className="whitespace-nowrap flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="ml-2 flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-[200px] text-xs font-bold transition-all shadow-sm hover:shadow-md whitespace-nowrap shrink-0"
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
                
                {/* 간이 자가진단 */}
                <button
                  onClick={() => setDiagnosisPhase('flow')}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-5 rounded-3xl shadow-lg hover:shadow-xl transition-all flex items-center justify-between group w-full text-left"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">🧪 AI 간이 진단</span>
                    <h4 className="font-extrabold text-sm text-white">1분 무료 채무 자가진단</h4>
                    <p className="text-[11px] text-indigo-200/70">5문항 답변 → AI가 최적 전략 즉시 분석</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Activity className="w-5 h-5" />
                  </div>
                </button>

                {/* 탕감액 계산기 */}
                <button
                  onClick={() => setActiveTab('calculator')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group w-full text-left"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] text-brand dark:text-brand-light font-bold uppercase tracking-wider">정밀 계산</span>
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

              {/* Region Selector Pills */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="text-xs text-slate-500 font-bold dark:text-slate-400 mr-2 flex items-center gap-1.5 shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  지역별 변호사 찾기:
                </span>
                {[
                  { value: '전체', label: '전체 🌍' },
                  { value: '서울', label: '서울 법원 🏛️' },
                  { value: '서울/경기', label: '서울/경기 🚇' },
                  { value: '경기/수원', label: '수원/경기 ⚖️' }
                ].map(regionOption => {
                  const isSelected = selectedRegion === regionOption.value;
                  return (
                    <button
                      key={regionOption.value}
                      type="button"
                      onClick={() => setSelectedRegion(regionOption.value)}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 border ${
                        isSelected
                          ? 'bg-brand text-white border-brand shadow-sm shadow-brand/20 scale-105'
                          : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-55 dark:hover:bg-slate-850'
                      }`}
                    >
                      {regionOption.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(() => {
                  const filtered = lawyers.filter(l => {
                    const isLawyer = l.role === 'LAWYER';
                    const matchesRegion = selectedRegion === '전체' || l.region.includes(selectedRegion);
                    return isLawyer && matchesRegion;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-1 md:col-span-3 py-12 text-center text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-2">
                        <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 opacity-55 animate-pulse" />
                        <p className="text-sm">선택하신 지역에 배정된 도산 전문 변호사가 없습니다.</p>
                        <p className="text-xs font-semibold text-[#7e7e8f] font-normal">전체 지역 탭을 이용해 전국 대응 변호사를 확인해 보세요.</p>
                      </div>
                    );
                  }

                  const limited = filtered.slice(0, 6);

                  return limited.map(l => {
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
                  })
                })()}
              </div>

              {/* View More Lawyers Button */}
              <div className="pt-4 text-center">
                <button 
                  onClick={() => {
                    setActiveTab('lawyers');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-brand-light font-extrabold rounded-xl text-xs transition-all shadow-md group cursor-pointer"
                >
                  <span>👥 도산 전문 변호사 전체보기 (더보기)</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
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
                {reviews.slice(0, 3).map(rev => (
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
                {qas
                  .filter(qa => {
                    if (!homeSearchQuery) return true;
                    const query = homeSearchQuery.toLowerCase();
                    return qa.question.toLowerCase().includes(query) || qa.category.toLowerCase().includes(query) || qa.answer.toLowerCase().includes(query);
                  })
                  .slice(0, 3)
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
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-105 shrink-0"
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

              {/* View More Button */}
              <div className="pt-4 text-center">
                <button 
                  onClick={() => {
                    setActiveTab('qna');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-brand-light font-extrabold rounded-xl text-xs transition-all shadow-md group cursor-pointer"
                >
                  <span>⚖️ 실시간 고민 해결 상담사례 전체보기 (더보기)</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>

            {/* 6. Legal News & Tips Section */}
            <div className="space-y-4 pt-4 text-left animate-fadeIn">
              <div 
                onClick={() => {
                  setActiveTab('news');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-between gap-1 text-left cursor-pointer group"
              >
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand" />
                  <span>알아두면 좋을 법률 정보</span>
                  <ChevronRight className="w-4 h-4 text-[#7e7e8f] transition-transform group-hover:translate-x-1" />
                </h3>
                <span className="text-xs text-brand dark:text-brand-light font-bold hover:underline shrink-0">
                  더 많은 정보 보기 →
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {newsArticles.slice(0, 3).map(art => (
                  <div 
                    key={art.id} 
                    onClick={() => {
                      setSelectedArticle(art);
                      // Increment view count locally
                      setNewsArticles(prev => prev.map(a => a.id === art.id ? { ...a, views: a.views + 1 } : a));
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden cursor-pointer group"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-950 shrink-0">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {art.badge && (
                        <span className={`absolute top-3.5 left-3.5 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full text-white shadow-sm ${
                          art.badge === 'HOT' ? 'bg-orange-500' :
                          art.badge === 'NEW' ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}>
                          {art.badge}
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                          <span>{art.category}</span>
                          <span>•</span>
                          <span>조회 {art.views}</span>
                        </div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-850 dark:text-slate-200 pr-2 leading-snug line-clamp-2 min-h-[38px] group-hover:text-brand dark:group-hover:text-brand-light transition-colors text-left">
                          {art.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 text-left">
                          {art.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
                        <div className="flex items-center gap-2">
                          <img 
                            src={art.authorAvatar} 
                            alt={art.authorName} 
                            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" 
                          />
                          <span className="text-[10px] font-extrabold text-[#484760] dark:text-slate-400">By {art.authorName}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-350 dark:text-slate-655 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
 
 
        {/* TAB: 마이페이지 (실시간 채무 주도형 스마트 대시보드) */}
        {activeTab === 'mypage' && (<MyPageView userAlias={userAlias} setUserAlias={setUserAlias} isEditingAlias={isEditingAlias} setIsEditingAlias={setIsEditingAlias} tempAlias={tempAlias} setTempAlias={setTempAlias} income={income} setIncome={setIncome} dependents={dependents} setDependents={setDependents} debtBanks={debtBanks} setDebtBanks={setDebtBanks} debtCards={debtCards} setDebtCards={setDebtCards} debtPersonals={debtPersonals} setDebtPersonals={setDebtPersonals} requests={requests} onNavigateToChat={(reqId) => { if(reqId) setActiveChatReqId(reqId); setActiveTab('chat'); }} />)}
 
 
        {/* TAB: 탕감액 계산기 */}
        {activeTab === 'calculator' && (<CalculatorView onNavigateToRequest={(data) => { setIncome(data.income); setDebtTotal(data.debtTotal); setDependents(data.dependents); if(data.title) setTitle(data.title); if(data.content) setContent(data.content); if(data.requestType) setRequestType(data.requestType); setRequestStep(data.step); setActiveTab('request'); }} />)}


        {/* TAB: SUCCESS TESTIMONIALS/REVIEWS */}
        {activeTab === 'reviews' && (<ReviewsView reviews={reviews} onReviewClick={handleReviewClick} />)}

        {/* TAB: CLIENT 1:1 INQUIRY BOARD */}
        {activeTab === 'inquiry' && (<InquiryView inquiries={inquiries} setInquiries={setInquiries} isLoggedIn={isLoggedIn} userAlias={userAlias} onShowAuthModal={() => setShowAuthModal(true)} inquiryTitle={inquiryTitle} setInquiryTitle={setInquiryTitle} inquiryContent={inquiryContent} setInquiryContent={setInquiryContent} onLogActivity={onLogActivity} />)}

        {/* TAB: LEGAL NEWS & TIPS BOARD */}
        {activeTab === 'news' && (<NewsView newsArticles={newsArticles} onSelectArticle={(art) => setSelectedArticle(art)} onUpdateViews={(id) => setNewsArticles(prev => prev.map(x => x.id === id ? {...x, views: x.views+1} : x))} />)}


        {/* TAB: LIVE Q&A CASE STUDIES */}
        {activeTab === 'qna' && (<QnAView qas={qas} onConsultRequest={(t,c) => { setTitle(t); setContent(c); setRequestStep(3); setActiveTab('request'); }} />)}

        {/* TAB 1-B: NOTICES TAB */}
        {activeTab === 'notices' && (<NoticesView notices={notices} selectedNoticeId={selectedNoticeId} onSetSelectedNoticeId={setSelectedNoticeId} onGoHome={() => setActiveTab('landing')} />)}


        {/* TAB 2: HIGH-FIDELITY CUSTOMER INTAKE SCREEN */}
        {activeTab === 'request' && (
          <div className="animate-fadeIn w-full max-w-4xl mx-auto h-[600px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl">
            <AIRehabChatbotV2
              isOpen={true}
              disablePortal={true}
              onClose={() => {
                if (pendingChatbotData) {
                  const mappedData = mapChatbotDataToIntakeData(pendingChatbotData.res, pendingChatbotData.input);
                  setPendingChatbotData(null); // Reset pending state
                  handleIntakeSubmit(mappedData);
                } else {
                  setActiveTab('landing');
                }
              }}
              onComplete={(res, input) => {
                setPendingChatbotData({ res, input });
              }}
              templateId="gradient"
              themeMode="dark"
              characterName="로이"
            />
          </div>
        )}

        {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
        {activeTab === 'lawyers' && (<LawyersView lawyers={mockLawyers} onSelectLawyer={(lawyerId) => { const l = mockLawyers.find(x => x.id === lawyerId); if(l) setTitle(l.name+' 변호사 상담 신청'); setSelectedLawyerId(lawyerId); setRequestType('direct'); setActiveTab('request'); }} />)}

        {/* TAB 4: ACTIVE COUNSELING/CHAT WORKSPACE */}
        {activeTab === 'chat' && (<ChatView requests={requests} messages={messages} activeChatReqId={activeChatReqId} chatInput={chatInput} phoneConsultNum={phoneConsultNum} useSafeNumber050={useSafeNumber050} isLoggedIn={isLoggedIn} userAlias={userAlias} debtBanks={debtBanks} debtCards={debtCards} debtPersonals={debtPersonals} onSetActiveChatReqId={setActiveChatReqId} onSetChatInput={setChatInput} onSetPhoneConsultNum={setPhoneConsultNum} onSetUseSafeNumber050={setUseSafeNumber050} onSetActiveTab={setActiveTab} onSetRequests={setRequests} onSendChat={handleSendChat} onAddMessage={onAddMessage} />)}

      </main>

      {/* Subtle Bottom legal status line */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 md:p-8 text-slate-500 space-y-6 text-left">
        {/* Notice Section */}
        <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-250 flex items-center gap-1.5">
              <span>📋</span> 공지사항
            </h4>
            <button 
              onClick={() => {
                setActiveTab('notices');
                setSelectedNoticeId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[10px] text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 font-bold transition-colors cursor-pointer"
            >
              전체보기 &rarr;
            </button>
          </div>
          <div className="space-y-2 text-[11px]">
            {notices.slice(0, 3).map(notice => (
              <div 
                key={notice.id} 
                onClick={() => {
                  setActiveTab('notices');
                  setSelectedNoticeId(notice.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 cursor-pointer hover:text-brand dark:hover:text-brand-light group transition-colors"
              >
                {notice.isImportant && (
                  <span className="bg-red-500 text-white font-extrabold text-[8px] px-1 rounded-sm shrink-0">중요</span>
                )}
                <span className="text-slate-650 dark:text-slate-350 truncate flex-1 group-hover:underline">
                  {notice.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">{notice.date}</span>
              </div>
            ))}
            {notices.length === 0 && (
              <p className="text-[10px] text-slate-450 py-1">등록된 공지사항이 없습니다.</p>
            )}
          </div>
        </div>

        {/* Policy & Legal disclaimer */}
        <div className="space-y-2.5 text-[10px] leading-relaxed text-slate-450 dark:text-slate-500">
          <p className="font-bold text-slate-600 dark:text-slate-400">회생톡 정책 설명 및 법적 고지</p>
          <p>
            (주)회생톡컴퍼니는 대한민국 법률시장의 정보비대칭과 불법 법조브로커를 해소하여 투명하고 공정한 법률시장을 만들기 위해 회생톡 서비스를 제공하고 있습니다. 회생톡은 의뢰인회원의 법률상담 내용 및 상담 여부, 법률사건 내용 및 수임 여부, 변호사회원의 선택 등에 대해 일절 관여하지 않아 변호사법 및 기타 관련규정을 준수하고 있으며, 변호사회원이 의뢰인회원에게 제공하는 서비스의 내용과 질에 대해 어떠한 법적책임도 부담하지 않습니다. 또한 회원간의 예약 및 결제정보의 중개서비스 또는 통신판매중개 시스템을 제공할 뿐, 통신판매의 당사자가 아닙니다.
          </p>
          <p>
            모든 법률상담은 각 변호사회원이 직접 수행하며, 모든 변호사회원은 각 소속 법률사무소, 로펌에서 독립적으로 법률업무를 수행합니다. 그리고 회생톡에 가입한 변호사들 상호간에는 어떠한 조직적인 관계가 없음을 밝힙니다. 회생톡에 표시된 변호사회원의 정보는 해당 변호사가 직접 제공한 것이며 무단으로 복제, 편집, 전시, 전송, 배포, 판매, 방송, 공연 등에 이용할 수 없습니다.
          </p>
        </div>
      </div>

      <ClientFooter 
        platformConfig={platformConfig} 
        onShowTerms={(type) => { setTermsModalType(type); setShowTermsModal(true); }} 
        onNavigate={(tab) => { 
          setActiveTab(tab as any); 
          if (tab === 'notices') {
            setSelectedNoticeId(null);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' }); 
        }}
      />

      {showTermsModal && (<TermsModal termsModalType={termsModalType} platformConfig={platformConfig} onClose={() => setShowTermsModal(false)} />)}

      {/* Auth Modal (로그인 / 회원가입) */}
      {showAuthModal && (<AuthModal onClose={() => setShowAuthModal(false)} onLoginSuccess={(alias,ep,ch) => { setIsLoggedIn(true); setUserAlias(alias); setShowAuthModal(false); recordClientLogin(alias,ep,ch); }} />)}

      {diagnosisPhase === 'flow' && (<DiagnosisFlow onComplete={async (r) => { setDiagnosisResult(r); setDiagnosisPhase('result'); await saveDiagnosisResult(r); }} onBack={() => setDiagnosisPhase('idle')} diagnosisConfig={diagnosisConfig||undefined} />)}

      {diagnosisPhase === 'result' && diagnosisResult && (<DiagnosisResultView result={diagnosisResult} onGoHome={() => { setDiagnosisPhase('idle'); setDiagnosisResult(null); }} onStartDetailedDiagnosis={() => { setDiagnosisPhase('idle'); setActiveTab('calculator'); }} onViewLawyers={() => { setDiagnosisPhase('idle'); setActiveTab('lawyers'); }} onRetakeDiagnosis={() => { setDiagnosisPhase('idle'); setDiagnosisResult(null); setDiagnosisPhase('flow'); }} />)}

      <MobileGNB activeTab={activeTab} onSetActiveTab={setActiveTab} onRequestConsult={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} />

      {activeRemedyCategory && remedyData[activeRemedyCategory] && (<RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} />)}
      {selectedArticle && (<NewsDetailModal article={selectedArticle} lawyers={lawyers} onClose={() => setSelectedArticle(null)} onConsultWithLawyer={(lawyerId, lawyerName, articleTitle) => { setRequestType('direct'); setSelectedLawyerId(lawyerId); setIncome(230); setDebtTotal(6500); setTitle(`[법률칼럼 지정상담] ${lawyerName}`); setContent(`안녕하세요, ${lawyerName} 변호사님이 집필하신 법률 칼럼 [${articleTitle}]을 깊이 감명 깊게 정독하고 상담을 접수합니다.\n\n칼럼에 실린 법률 가이드 내용에 의거하여, 저의 소득과 채무 상황에서 최우선적인 압류 방어 대책 및 개인회생 금지명령 개시 가능성을 1:1로 직접 정밀 진단받고 싶습니다.`); setRequestStep(2); setActiveTab('request'); setSelectedArticle(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />)}

      </div>
    </div>
  );
}
