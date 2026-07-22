import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronLeft, ChevronRight, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X, Home, BookOpen, MessageSquare, MapPin, Check, Edit2,
  Star, Sparkles
} from 'lucide-react';
import { Client, FinancialProfile, ConsultRequest, User as LawyerType, ConsultMessage, IntakeData, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, PlatformConfig, ClientInquiry, AppSettings, PopupConfig } from '../types';
import { CustomerIntake } from './CustomerIntake';
import { calculateRehabPlan } from '../rehabEngine';
const AIRehabChatbotV2 = React.lazy(() => import('../rehab-chatbot-package/components/rehab/AIRehabChatbotV2'));
import { RehabUserInput, RehabCalculationResult, calculateRepayment } from '../rehab-chatbot-package/services/calculationService';
import { IncomeSource, AssetDetail, DebtItem, PrevHistory, SpecialCircumstances, ExtraLivingCost, ConsultationLog } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { fetchSettings } from '../services/settingsService';
import { formatKoreanCurrency, formatNumber } from '../utils';
import { mockLawyers, initialConsultRequests, initialConsultMessages, adBanners } from '../data';
import { RequestDisclaimer, ChatDisclaimer } from './Disclaimers';
import { supabase } from '../supabaseClient';
import PopupContainer from './popup/PopupContainer';

const ReviewsView = React.lazy(() => import('./client/ReviewsView'));
const CalculatorView = React.lazy(() => import('./client/CalculatorView'));
const QnAView = React.lazy(() => import('./client/QnAView'));
const ChatView = React.lazy(() => import('./client/ChatView'));
const NewsView = React.lazy(() => import('./client/NewsView'));
const NoticesView = React.lazy(() => import('./client/NoticesView'));
const LawyersView = React.lazy(() => import('./client/LawyersView'));
const AuthModal = React.lazy(() => import('./client/AuthModal'));
const MyPageView = React.lazy(() => import('./client/MyPageView'));
const MySettingsView = React.lazy(() => import('./client/MySettingsView'));
const InquiryView = React.lazy(() => import('./client/InquiryView'));

import ClientFooter from './client/ClientFooter';
const TermsModal = React.lazy(() => import('./client/TermsModal'));
import MobileGNB from './client/MobileGNB';
const RemedyModal = React.lazy(() => import('./client/RemedyModal'));
const NewsDetailModal = React.lazy(() => import('./client/NewsDetailModal'));
const LawyerProfileModal = React.lazy(() => import('./client/LawyerProfileModal'));

import type { SolutionType } from './client/SolutionDetailModal';
const SolutionDetailModal = React.lazy(() => import('./client/SolutionDetailModal'));


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
    title: '카드론·리볼빙 연체',
    subtitle: '관리 방향: 신용회복 / 회생 / 대리 대응 확인',
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
    title: '은행·저축은행 연체',
    subtitle: '관리 방향: 신용회복 / 금지명령 가능성 검토',
    remedyTitle: '법원 금지명령으로 예금·급여 압류 및 채권 상계 원천 차단',
    remedyDesc: '시중은행 및 저축은행 신용대출 연체 발생 시 1~2개월 내 기한이익상실(만기연장 거절 및 원금 전액 일시상환 청구)이 발생합니다. 법원의 금지명령을 즉각 이끌어내어 직장 급여 가압류 및 거래 은행 계좌 동결을 사전에 법적으로 완벽하게 방어합니다.',
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
    title: '대부업·사채 독촉',
    subtitle: '관리 방향: 채무자대리인 즉시 선임 및 추심 차단',
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
    subtitle: '관리 방향: 보증채무 흡수 조정 및 단독 회생',
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
    title: '주식·코인 손실',
    subtitle: '관리 방향: 회생 실무준칙 적용 청산가치 불산입',
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
    title: '일용직·프리랜서 채무',
    subtitle: '관리 방향: 플랫폼 정산 내역 및 부정기 소득 소명',
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
    title: '급여·통장 압류',
    subtitle: '관리 방향: 압류 중지명령 신청 및 인가 후 취소',
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
    title: '개인회생/파산 검토',
    subtitle: '관리 방향: 무직·고령·질병 면책 전액 탕감 자격 판정',
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
  },
  tax_delinquency: {
    id: 'tax_delinquency',
    title: '세금 체납',
    subtitle: '관리 방향: 압류 적법성 분석 & 소멸시효 권리 구제',
    remedyTitle: '국세·지방세 압류 적법성 검토 및 소멸시효 완료 권리 구제',
    remedyDesc: '세금 체납은 국세기본법 및 지방세징수법상 징수권 소멸시효(5억 원 미만 5년, 5억 원 이상 10년)가 적용됩니다. 다만 압류나 독촉 등으로 시효가 중단될 수 있습니다. 특히 압류금지 소액금융재산(잔액 185만 원 이하의 소액 예금)만 존재함에도 은행 계좌를 압류하여 소멸시효를 부당하게 중단시킨 이력이 있다면, 압류해제 및 시효 완성을 주장하여 체납 세금 채무를 영구 면제받을 수 있습니다.',
    guideTitle: '체납세금 소멸시효 및 압류 적법성 관리 대응책',
    guideDesc: '세금 체납은 개인회생 신청 시 일반 신용채무와 달리 "우선권 있는 채권"으로 처리되어 변제기간 내 전액 납부를 요구하거나 기각을 내리며, 파산 시에도 "비면책 채권"에 해당하여 면책이 안 됩니다. 따라서 국세/지방세 해결의 실무 핵심은 징수행위의 적법성과 소멸시효가 실제로 중단되었는지 여부를 분석하는 것입니다. 전담 법률 대리인을 통해 국세청 유권해석에 기반한 계좌 압류 해제 및 소멸시효 권리 구제 절차를 밟아야 해결할 수 있습니다.',
    iconName: 'Scale',
    badgeText: '세금 소멸시효/압류 검토',
    themeColor: 'amber',
    preset: {
      jobType: 'FREELANCER',
      debtCause: 'BUSINESS',
      harassmentLevel: 'LETTER',
      creditorCount: 1,
      debtBanks: 0,
      debtCards: 0,
      debtPersonals: 0,
      recentLoans: 0,
      coinCrypto: 0,
      debtTotal: 3000,
      income: 180,
      assetsTotal: 50,
      title: '국세/지방세 체납 세금 소멸시효 만료 및 계좌 압류 해제 신청',
      content: '과거 개인 사업장의 경영 악화로 인해 폐업하면서 부가가치세 및 종합소득세 체납액 3,000만 원을 해결하지 못했습니다. 현재 세무서로부터 예금 계좌 압류가 설정되어 있는 상태인데, 압류금지 소액재산 기준 저촉 여부 및 징수권 소멸시효를 검토하여 면제 관리를 받고자 변호사 조력을 구합니다.'
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

const mapProfileToIntakeData = (profile: FinancialProfile): IntakeData => {
  const incomeSources: IncomeSource[] = [{
    id: `inc-salary-${Date.now()}`,
    type: profile.jobType === 'SALARIED' ? 'worker' :
          profile.jobType === 'BUSINESS' ? 'business' :
          profile.jobType === 'DAILY' ? 'worker_no_ins' :
          profile.jobType === 'FREELANCER' ? 'freelancer' : 'worker',
    amount: (profile.income || 0) * 10000,
    tenureYears: 1,
    payType: 'bank'
  }];

  const assets: AssetDetail[] = [];
  const rentalDepositWon = (profile.rentalDeposit || 0) * 10000;
  const spouseAssetWon = (profile.spouseAsset || 0) * 10000;
  const retirementPayWon = (profile.retirementPay || 0) * 10000;
  const otherAssetsWon = Math.max(0, (profile.assetsTotal || 0) - (profile.rentalDeposit || 0) - (profile.spouseAsset || 0) - (profile.retirementPay || 0)) * 10000;

  if (otherAssetsWon > 0) {
    assets.push({
      id: `asset-my-${Date.now()}`,
      owner: 'self',
      type: 'other',
      description: '본인 보유 자산',
      marketValue: otherAssetsWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }
  if (spouseAssetWon > 0) {
    assets.push({
      id: `asset-spouse-${Date.now()}`,
      owner: 'spouse',
      type: 'other',
      description: '배우자 보유 자산',
      marketValue: spouseAssetWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }
  if (retirementPayWon > 0) {
    assets.push({
      id: `asset-severance-${Date.now()}`,
      owner: 'self',
      type: 'severance',
      description: profile.retirementPensionType === 'pension' ? '퇴직연금 (가입)' : '예상 퇴직금',
      marketValue: retirementPayWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: profile.retirementPensionType === 'pension'
    });
  }
  if (rentalDepositWon > 0) {
    assets.push({
      id: `asset-deposit-${Date.now()}`,
      owner: 'self',
      type: 'deposit',
      description: '보증금',
      marketValue: rentalDepositWon,
      loanBalance: 0,
      hasPledge: false,
      isExempt: false
    });
  }

  const debts: DebtItem[] = [];
  const banksWon = (profile.debtTypes?.banks || 0) * 10000;
  const cardsWon = (profile.debtTypes?.cards || 0) * 10000;
  const personalsWon = (profile.debtTypes?.personals || 0) * 10000;
  const priorityDebtWon = (profile.priorityDebt || 0) * 10000;

  if (banksWon > 0) {
    debts.push({
      id: `debt-banks-${Date.now()}`,
      creditor: '은행 대출',
      principal: banksWon,
      interest: 0,
      type: 'secured',
      isRecent: profile.hasRecentJobChange || false,
      isGamblingOrLuxury: false
    });
  }
  if (cardsWon > 0) {
    debts.push({
      id: `debt-cards-${Date.now()}`,
      creditor: '카드 대금',
      principal: cardsWon,
      interest: 0,
      type: 'unsecured',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }
  if (personalsWon > 0) {
    debts.push({
      id: `debt-personals-${Date.now()}`,
      creditor: '대부/기타 채무',
      principal: personalsWon,
      interest: 0,
      type: 'unsecured',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }
  if (priorityDebtWon > 0) {
    debts.push({
      id: `debt-priority-${Date.now()}`,
      creditor: '국세/지방세 체납 세금',
      principal: priorityDebtWon,
      interest: 0,
      type: 'tax',
      isRecent: false,
      isGamblingOrLuxury: false
    });
  }

  return {
    clientName: profile.companyNameMasked || '의뢰인',
    phoneNumber: '010-4567-8901',
    birthDate: '1991-01-01',
    consultDate: new Date().toISOString().split('T')[0],
    dbVendor: '',
    caseType: 'rehab',
    applyYear: 2026,
    residence: profile.residenceRegion || '서울',
    workplace: '',
    selectedCourt: profile.residenceRegion === '서울' ? '서울회생법원' :
                   profile.residenceRegion === '부산' ? '부산회생법원' :
                   profile.residenceRegion === '수원' ? '수원회생법원' : '서울회생법원',
    maritalStatus: profile.maritalStatus === 'SINGLE' ? 'single' : profile.maritalStatus === 'MARRIED' ? 'married' : 'divorced',
    minorChildren: profile.dependents || 0,
    minorChildrenFullRecognition: false,
    otherDependents: 0,
    incomeSources,
    monthlyLivingCost: 0,
    monthlyRent: 0,
    monthlyInsurance: 0,
    extraLivingCost: {
      utilities: 0,
      education: 0,
      specialEducation: 0,
      medical: 0,
      other: 0
    },
    specialCircumstances: {
      singleParent: false,
      basicLivelihood: false,
      rentFraud: false,
      severeDisability: false
    },
    assets,
    debts,
    prevHistory: {
      exists: false
    },
    consultationLogs: [],
    speculativeLoss: (profile.speculativeLoss || 0) * 10000,
    gamblingLoss: (profile.gamblingLoss || 0) * 10000,
    legalActions: profile.legalActions || [],
    retirementPensionType: profile.retirementPensionType || 'unknown',
    retirementPay: (profile.retirementPay || 0) * 10000
  };
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
  matchingCooldownHours: number;
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  onLogActivity: (memberId: string, memberName: string, role: MemberRole, action: ActivityLog['action'], details: string) => void;
  platformConfig: PlatformConfig;
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  popupConfig?: PopupConfig;
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
  matchingCooldownHours,
  members,
  setMembers,
  onLogActivity,
  platformConfig,
  inquiries,
  setInquiries,
  popupConfig
}: ClientRoleProps) {
  // Sub-navigation for user
  // Sub-navigation for user
  const [activeTab, setActiveTab] = useState<'landing' | 'request' | 'lawyers' | 'chat' | 'calculator' | 'reviews' | 'qna' | 'mypage' | 'news' | 'notices' | 'inquiry'>(() => {
    if (typeof window === 'undefined') return 'landing';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const validTabs = ['landing', 'request', 'lawyers', 'chat', 'calculator', 'reviews', 'qna', 'mypage', 'news', 'notices', 'inquiry'];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam as any;
    }
    return 'landing';
  });
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  const isPopStateRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 첫 진입 시 초기 브라우저 히스토리 상태 강제 세팅
    // OAuth 콜백(#access_token= 또는 ?code=)이면 Supabase가 처리할 수 있도록 URL을 건드리지 않는다
    if (!window.history.state) {
      const hash = window.location.hash;
      const search = window.location.search;
      const isOAuthCallback = hash.includes('access_token') || hash.includes('error') || search.includes('code=');
      if (!isOAuthCallback) {
        const params = new URLSearchParams(search);
        const tabParam = params.get('tab') || 'landing';
        window.history.replaceState({ tab: tabParam }, '', search || '?tab=landing');
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam) {
          setActiveTab(tabParam as any);
        } else {
          setActiveTab('landing');
        }
      }
      setTimeout(() => {
        isPopStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 뒤로 가기/앞으로 가기 이벤트에 의한 탭 변경 시 pushState 중복 호출 방지
    if (isPopStateRef.current) return;

    // OAuth 콜백 토큰 정보가 URL에 포함되어 있는 경우, pushState가 주소를 덮어써서 
    // Supabase 인증 처리를 방해하지 않도록 스킵합니다.
    const hash = window.location.hash;
    const search = window.location.search;
    const isOAuthCallback = hash.includes('access_token') || hash.includes('error') || search.includes('code=');
    if (isOAuthCallback) return;

    const currentState = window.history.state;
    if (!currentState || currentState.tab !== activeTab) {
      const params = new URLSearchParams(search);
      params.set('tab', activeTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ tab: activeTab }, '', newUrl);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 모바일 GNB 숨김 로직 ──
  const [isGnbHidden, setIsGnbHidden] = useState(false);
  // 챗봇(request) 탭에서는 항상 GNB 숨김
  const isChatbotActive = activeTab === 'request';

  // ── 변호사 프로필 보기 상태 ──
  const [selectedProfileLawyer, setSelectedProfileLawyer] = useState<LawyerType | null>(null);

  const handleOpenLawyerProfile = (lawyerId: string) => {
    const found = lawyers.find(l => l.id === lawyerId);
    if (found) {
      setSelectedProfileLawyer(found);
    } else {
      const mockFound = mockLawyers.find(l => l.id === lawyerId);
      if (mockFound) {
        setSelectedProfileLawyer(mockFound);
      } else {
        setActiveTab('lawyers');
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let focusTimeout: ReturnType<typeof setTimeout>;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        clearTimeout(focusTimeout);
        setIsGnbHidden(true);
      }
    };

    const handleFocusOut = () => {
      focusTimeout = setTimeout(() => {
        setIsGnbHidden(false);
      }, 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      clearTimeout(focusTimeout);
    };
  }, []);

  // ── 모바일 키보드 대응: visualViewport API ──
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      const vh = window.visualViewport!.height;
      document.documentElement.style.setProperty('--chatbot-vh', `${vh}px`);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const [pendingChatbotData, setPendingChatbotData] = useState<{ res: RehabCalculationResult; input: RehabUserInput } | null>(null);

  const handleUpdateFinancialProfile = (updatedProfile: FinancialProfile) => {
    if (!activeRequest) return;

    const intakeData = mapProfileToIntakeData(updatedProfile);
    const result = calculateRehabPlan(intakeData, effectiveSettings);

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

    const riskFlags: string[] = [];
    result.alerts.forEach(a => {
      riskFlags.push(a.message);
    });
    if (intakeData.debts.some(d => d.isRecent)) riskFlags.push('최근 대출 비중 높음 (30% 이상)');
    if (intakeData.debts.some(d => d.isGamblingOrLuxury)) riskFlags.push('투자/사행성 손실 채무 포함');
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      riskFlags.push(`1년 이내 주식/코인 투자 손실: ${formatKoreanCurrency(intakeData.speculativeLoss)}`);
    }
    if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      riskFlags.push(`1년 이내 도박 채무: ${formatKoreanCurrency(intakeData.gamblingLoss)}`);
    }

    let specialNoteLine = '';
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 주식/코인 투자 손실액 ${formatKoreanCurrency(intakeData.speculativeLoss)}`;
    } else if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 도박으로 인한 채무액 ${formatKoreanCurrency(intakeData.gamblingLoss)}`;
    }

    const legalActionLabels: Record<string, string> = {
      collection_call: '독촉 전화/문자',
      court_order: '지급명령/소장 수령',
      seizure: '급여/계좌 압류',
      property_seizure: '부동산 가압류',
      credit_drop: '신용등급 하락 통보',
      none: '해당 없음'
    };
    const activeActions = (intakeData.legalActions || [])
      .filter(x => x !== 'none')
      .map(x => legalActionLabels[x] || x);
    const legalActionsStr = activeActions.length > 0 ? activeActions.join(', ') : '해당 없음';

    const updatedContent = `==================================
📋 의뢰인 종합 사전 자가진단 리포트 (수정됨)
==================================

[1. 가계 및 부양가족 현황]
• 거주지역 / 관할법원: ${intakeData.residence} / ${intakeData.selectedCourt}
• 혼인 상태: ${intakeData.maritalStatus === 'single' ? '미혼' : intakeData.maritalStatus === 'married' ? '기혼' : intakeData.maritalStatus === 'divorced' ? '이혼' : '기타'}
• 부양가족 구성: 미성년 자녀 ${intakeData.minorChildren}명 / 기타 부양가족 ${intakeData.otherDependents}명 (가구원 수: ${intakeData.minorChildren + intakeData.otherDependents + 1}인 가구)

[2. 소득 및 자산 현황]
• 직업 분류: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : intakeData.incomeSources[0]?.type === 'business' ? '자영업/개인사업자' : intakeData.incomeSources[0]?.type === 'freelancer' ? '프리랜서' : '무직'}
• 월 평균 실수령액: ${formatKoreanCurrency(result.client.monthlyIncome)}
• 인정 생계비: ${formatKoreanCurrency(result.base.living)}
• 가용 소득 (예상 월납입금): ${formatKoreanCurrency(result.base.disposable)}
• 총 자산가치 (청산가치): ${formatKoreanCurrency(result.base.liq)}
  - 임대보증금: ${formatKoreanCurrency((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0))}
  - 배우자 자산: ${formatKoreanCurrency((intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0))}
  - 예상 퇴직금: ${intakeData.retirementPay ? formatKoreanCurrency(intakeData.retirementPay) : '없음'}${
      intakeData.retirementPensionType === 'pension' ? ' (퇴직연금 가입 - 0% 반영)' :
      intakeData.retirementPensionType === 'none' ? ' (퇴직연금 미가입 - 50% 반영)' :
      intakeData.retirementPensionType === 'unknown' ? ' (퇴직연금 종류 모름 - 50% 반영)' : ''
    }

[3. 채무 구성 및 특이사항]
• 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)} (채권자 수: ${intakeData.debts.length}곳)
  - 세금/체납 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.type === 'tax')?.principal || 0))}
  - 신용카드 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.creditor.includes('카드'))?.principal || 0))}
• 회생/조정 이력: ${intakeData.prevHistory?.exists ? '있음' : '없음'}
• 주의 위험 지표: ${riskFlags.join(', ') || '없음'}${specialNoteLine}${
      intakeData.retirementPensionType === 'unknown' ? '\n• ⚠️ [확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : ''
    }
• 현재 법적 조치: ${legalActionsStr}

----------------------------------
💡 변호사 실무 검토 요지:
- 가용 소득 상환 능력 검토 완료.
- 자산 청산가치 충족 여부 사전 확인.
==================================`;

    setRequests(prev => prev.map(req => {
      if (req.id === activeRequest.id) {
        return {
          ...req,
          content: updatedContent,
          financialProfile: {
            ...updatedProfile,
            riskFlags
          }
        };
      }
      return req;
    }));

    const clientName = isLoggedIn ? userAlias : '익명 의뢰인';
    const clientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      clientId,
      clientName,
      'CLIENT',
      'CALCULATE',
      `마이페이지 진단 데이터 수정 (총 채무: ${formatKoreanCurrency(result.base.debtTotal)}, 예상 월 변제금: ${formatNumber(result.preferred?.monthly || 0)}원)`
    );
  };

  // Terms and Privacy popup states
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [termsModalType, setTermsModalType] = useState<'tos' | 'privacy'>('tos');

  // 관리자 환경설정 로드 (localStorage → AppSettings)
  const [effectiveSettings, setEffectiveSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    fetchSettings().then(s => setEffectiveSettings(s)).catch(() => {});
  }, []);

  // Client 1:1 Inquiry state
  const [inquiryTitle, setInquiryTitle] = useState<string>('');
  const [inquiryContent, setInquiryContent] = useState<string>('');

  // 변호사 선택 모드 (챗봇 완료 후 LawyersView를 선택 모드로 전환)
  const [lawyerSelectionMode, setLawyerSelectionMode] = useState(false);
  const [pendingNewRequest, setPendingNewRequest] = useState<any>(null);

  const checkCooldown = (): boolean => {
    if (matchingCooldownHours === 0) return true;

    const clientRequests = requests.filter(r => r.clientId === 'client-temp');
    if (clientRequests.length === 0) return true;

    const sorted = [...clientRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestRequest = sorted[0];

    const latestTime = new Date(latestRequest.createdAt).getTime();
    const currentTime = Date.now();
    const diffMs = currentTime - latestTime;
    const cooldownMs = matchingCooldownHours * 60 * 60 * 1000;

    if (diffMs < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - diffMs) / (60 * 60 * 1000));
      alert(`${remainingHours}시간 후 상담 요청 가능합니다.`);
      return false;
    }

    return true;
  };

  // 의뢰인이 변호사 선택 완료 시 호출
  const handleConfirmLawyerSelection = (lawyerIds: string[]) => {
    if (!pendingNewRequest) return;
    const finalRequest = {
      ...pendingNewRequest,
      requestType: 'direct_multi' as const,
      selectedLawyerIds: lawyerIds,
      proposals: [],
      maxParticipants: lawyerIds.length,
    };
    setRequests(prev => [finalRequest, ...prev]);
    setActiveChatReqId(finalRequest.id);
    setLawyerSelectionMode(false);
    setPendingNewRequest(null);

    const finalClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '익명 의뢰인',
      'CLIENT',
      'CONSULT_REQUEST',
      `${lawyerIds.length}명의 변호사에게 상담 요청 발송`
    );

    setTimeout(() => {
      onAddMessage(
        finalRequest.id,
        `상담 요청이 선택하신 ${lawyerIds.length}명의 변호사에게 전달되었습니다. 변호사가 고객님의 채무 현황을 검토한 뒤 솔루션 및 비용 제안서를 보내드립니다. 제안서를 확인하신 후 1:1 상담을 시작하실 수 있습니다.`,
        'lawyer',
        'system',
        '시스템 안내'
      );
    }, 1000);

    setActiveTab('chat');
  };
  
  // Home Landing States
  const [calcIncome, setCalcIncome] = useState<number>(250);
  const [calcDebt, setCalcDebt] = useState<number>(7000);
  const [calcDependents, setCalcDependents] = useState<number>(0);
  const [bannerIndex, setBannerIndex] = useState<number>(0);
  const [openedQaId, setOpenedQaId] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');

  // 프리미엄 변호사 쇼케이스 광고 (메인 배너 광고 상품)
  const [showcasePage, setShowcasePage] = useState(0);
  const [showcaseHovered, setShowcaseHovered] = useState(false);
  const [shuffledShowcaseAds] = useState(() => [...adBanners].filter(b => b.isActive !== false).sort(() => Math.random() - 0.5));

  useEffect(() => {
    if (showcaseHovered || shuffledShowcaseAds.length === 0) return;
    const cardsPerPage = 3;
    const totalPages = Math.ceil(shuffledShowcaseAds.length / cardsPerPage);
    if (totalPages <= 1) return;
    const timer = setInterval(() => {
      setShowcasePage(prev => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(timer);
  }, [showcaseHovered, shuffledShowcaseAds.length]);

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
  const [senderNameOverride, setSenderNameOverride] = useState<string>('my김변');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Email and Real Auth States




  // Helper: Record client login/signup activity
  const recordClientLogin = (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => {
    let targetId = localStorage.getItem('legal_crm_client_id');
    if (!targetId) {
      targetId = `client-${Date.now()}`;
      localStorage.setItem('legal_crm_client_id', targetId);
    }
    
    // 익명(client-temp) 상태에서 진행했던 진단/상담 요청이 있다면 로그인한 계정(targetId)으로 이전 바인딩
    setRequests(prev => prev.map(r => r.clientId === 'client-temp' ? { ...r, clientId: targetId!, clientName: alias } : r));
    
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
    // OAuth 플래그 확인 (AuthModal에서 리다이렉트 전에 설정)
    const pendingOAuth = localStorage.getItem('pending_oauth_login');
    const isPendingOAuth = !!pendingOAuth;

    // 세션 감지 시 처리 함수
    const handleSession = (session: any, _source: string) => {
      if (!session?.user) return;
      setIsLoggedIn(true);
      const metaAlias = session.user.user_metadata?.alias || ("새출발_" + Math.floor(100 + Math.random() * 900));
      setUserAlias(metaAlias);
      recordClientLogin(metaAlias, session.user.email || 'user@system', 'email');
      
      // OAuth 리다이렉트 직후이면 chat 탭으로 이동
      if (isPendingOAuth) {
        localStorage.removeItem('pending_oauth_login');
        setActiveTab('chat');
      }
    };

    // 1) getSession 즉시 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session, 'getSession');
    }).catch(_err => { /* silent */ });

    // 2) 지연 재시도 (Supabase _initialize 완료 대기)
    const retry1 = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) handleSession(session, '1초 재시도');
      });
    }, 1000);

    const retry2 = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) handleSession(session, '3초 재시도');
        else if (isPendingOAuth) {
          localStorage.removeItem('pending_oauth_login');
        }
      });
    }, 3000);

    // 3) 실시간 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        handleSession(session, `onAuthStateChange(${event})`);
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setUserAlias('');
      }
    });

    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
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
  const [activeSolutionType, setActiveSolutionType] = useState<SolutionType | null>(null);
  const [entryCategory, setEntryCategory] = useState<{ type: 'debt_type' | 'solution' | 'general'; id: string; label: string } | null>(null);

  // Reviews page state
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState<string>('전체');
  const [reviewSearchQuery, setReviewSearchQuery] = useState<string>('');
  const [reviewPage, setReviewPage] = useState<number>(1);

  const currentClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
  const clientRequests = React.useMemo(() => {
    return requests.filter(r => 
      r.clientId === currentClientId || 
      (!isLoggedIn && r.clientId === 'client-temp') || 
      (isLoggedIn && userAlias && r.clientName === userAlias)
    );
  }, [requests, currentClientId, isLoggedIn, userAlias]);

  const activeRequest = clientRequests.find(r => r.clientId === 'client-temp') || clientRequests[0];

  const activeResult = React.useMemo(() => {
    if (!activeRequest || !activeRequest.financialProfile) return undefined;
    const profile = activeRequest.financialProfile;
    const userInput: RehabUserInput = {
      address: profile.residenceRegion || '서울',
      workLocation: undefined,
      age: 35,
      employmentType: profile.jobType === 'SALARIED' ? 'salary' :
                      profile.jobType === 'BUSINESS' ? 'business' :
                      profile.jobType === 'DAILY' ? 'daily' :
                      profile.jobType === 'FREELANCER' ? 'freelancer' : 'salary',
      monthlyIncome: (profile.income || 0) * 10000,
      familySize: (profile.dependents || 0) + 1,
      spouseAssets: (profile.spouseAsset || 0) * 10000,
      rentCost: (profile.rentCost || 0) * 10000,
      deposit: (profile.rentalDeposit || 0) * 10000,
      depositLoan: (profile.depositLoan || 0) * 10000,
      housingType: profile.housingType,
      housingContractHolder: profile.housingContractHolder,
      myAssets: Math.max(0, (profile.assetsTotal || 0) - (profile.rentalDeposit || 0) - (profile.spouseAsset || 0) - (profile.retirementPay || 0)) * 10000,
      totalDebt: (profile.debtTotal || 0) * 10000,
      priorityDebt: (profile.priorityDebt || 0) * 10000,
      speculativeLoss: (profile.speculativeLoss || 0) * 10000,
      gamblingLoss: (profile.gamblingLoss || 0) * 10000,
      retirementPensionType: profile.retirementPensionType || 'unknown',
      retirementPay: (profile.retirementPay || 0) * 10000,
      isMarried: profile.maritalStatus === 'MARRIED',
      maritalStatus: profile.maritalStatus === 'SINGLE' ? 'single' : profile.maritalStatus === 'MARRIED' ? 'married' : 'divorced',
      minorChildren: profile.dependents || 0,
      legalActions: profile.legalActions || []
    };
    try {
      return calculateRepayment(userInput);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, [activeRequest]);



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

    // 진입 카테고리 설정 (채무유형)
    setEntryCategory({ type: 'debt_type', id: categoryId, label: item.title });

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




  // Auto select active chat request for current client
  useEffect(() => {
    if (clientRequests.length > 0 && (!activeChatReqId || !clientRequests.some(r => r.id === activeChatReqId))) {
      setActiveChatReqId(clientRequests[0].id);
    }
  }, [clientRequests, activeChatReqId]);

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
    if (!checkCooldown()) return;
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
    if (input.employmentType === 'daily') {
      incomeSources.push({
        id: `inc-daily-${Date.now()}`,
        type: 'worker_no_ins',
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

    if (input.retirementPay && input.retirementPay > 0) {
      assets.push({
        id: `asset-severance-${Date.now()}`,
        owner: 'self',
        type: 'severance',
        description: input.retirementPensionType === 'pension' 
          ? '퇴직연금 (가입)' 
          : input.retirementPensionType === 'none' 
          ? '예상 퇴직금 (연금 미가입 - 50% 반영)' 
          : '예상 퇴직금 (연금 모름 - 50% 반영)',
        marketValue: input.retirementPay,
        loanBalance: 0,
        hasPledge: false,
        isExempt: input.retirementPensionType === 'pension'
      });
    }

    if (input.deposit && input.deposit > 0) {
      assets.push({
        id: `asset-deposit-${Date.now()}`,
        owner: input.housingContractHolder === 'spouse' ? 'spouse' : 'self',
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
      specialEducation: input.specialEducationCost || 0,
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
      speculativeLoss: input.speculativeLoss,
      gamblingLoss: input.gamblingLoss,
      legalActions: input.legalActions,
      retirementPensionType: input.retirementPensionType,
      retirementPay: input.retirementPay,
      notes: [
        input.retirementPensionType === 'unknown' ? '[확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : '',
        input.clientNote || ''
      ].filter(Boolean).join('\n') || undefined,
      clientNotes: input.clientNotes || (input.clientNote ? [input.clientNote] : []),
      housingType: input.housingType,
      housingContractHolder: input.housingContractHolder,
      depositLoan: input.depositLoan,
      consultationLogs
    };
  };

  const handleIntakeSubmit = (intakeData: IntakeData) => {
    if (!checkCooldown()) return;
    const result = calculateRehabPlan(intakeData, effectiveSettings);
    
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
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      riskFlags.push(`1년 이내 주식/코인 투자 손실: ${formatKoreanCurrency(intakeData.speculativeLoss)}`);
    }
    if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      riskFlags.push(`1년 이내 도박 채무: ${formatKoreanCurrency(intakeData.gamblingLoss)}`);
    }
    
    let specialNoteLine = '';
    if (intakeData.speculativeLoss && intakeData.speculativeLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 주식/코인 투자 손실액 ${formatKoreanCurrency(intakeData.speculativeLoss)}`;
    } else if (intakeData.gamblingLoss && intakeData.gamblingLoss > 0) {
      specialNoteLine = `\n• 특이사항: 1년 이내 도박으로 인한 채무액 ${formatKoreanCurrency(intakeData.gamblingLoss)}`;
    }

    const legalActionLabels: Record<string, string> = {
      collection_call: '독촉 전화/문자',
      court_order: '지급명령/소장 수령',
      seizure: '급여/계좌 압류',
      property_seizure: '부동산 가압류',
      credit_drop: '신용등급 하락 통보',
      none: '해당 없음'
    };
    const activeActions = (intakeData.legalActions || [])
      .filter(x => x !== 'none')
      .map(x => legalActionLabels[x] || x);
    const legalActionsStr = activeActions.length > 0 ? activeActions.join(', ') : '해당 없음';

    let harassmentLevel: 'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE' = 'CALL';
    if (intakeData.legalActions) {
      if (intakeData.legalActions.includes('seizure') || intakeData.legalActions.includes('property_seizure')) {
        harassmentLevel = 'SEIZURE';
      } else if (intakeData.legalActions.includes('court_order')) {
        harassmentLevel = 'LAWSUIT';
      } else if (intakeData.legalActions.includes('credit_drop')) {
        harassmentLevel = 'LETTER';
      }
    }

    // Construct the new ConsultRequest (pending - not yet saved)
    const newRequest = {
      id: `req-${Date.now()}`,
      clientId: 'client-temp',
      clientName: isLoggedIn ? `${userAlias} (의뢰인)` : '익명 의뢰인',
      phone: intakeData.phoneNumber || '010-4567-8901',
      requestType: 'direct_multi' as const,
      maxParticipants: 3,
      status: 'requested' as const,
      createdAt: new Date().toISOString(),
      title: `${intakeData.clientName}님의 정밀 개인회생 상담 분석 신청`,
      content: `==================================
📋 의뢰인 종합 사전 자가진단 리포트
==================================

[1. 가계 및 부양가족 현황]
• 거주지역 / 관할법원: ${intakeData.residence} / ${intakeData.selectedCourt}
• 혼인 상태: ${intakeData.maritalStatus === 'single' ? '미혼' : intakeData.maritalStatus === 'married' ? '기혼' : intakeData.maritalStatus === 'divorced' ? '이혼' : '기타'}
• 부양가족 구성: 미성년 자녀 ${intakeData.minorChildren}명 / 기타 부양가족 ${intakeData.otherDependents}명 (가구원 수: ${intakeData.minorChildren + intakeData.otherDependents + 1}인 가구)

[2. 소득 및 자산 현황]
• 직업 분류: ${intakeData.incomeSources[0]?.type === 'worker' ? '급여 소득자' : intakeData.incomeSources[0]?.type === 'business' ? '자영업/개인사업자' : intakeData.incomeSources[0]?.type === 'freelancer' ? '프리랜서' : '무직'}
• 월 평균 실수령액: ${formatKoreanCurrency(result.client.monthlyIncome)}
• 인정 생계비: ${formatKoreanCurrency(result.base.living)}
• 가용 소득 (예상 월납입금): ${formatKoreanCurrency(result.base.disposable)}
• 총 자산가치 (청산가치): ${formatKoreanCurrency(result.base.liq)}
  - 임대보증금: ${formatKoreanCurrency((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0))}
  - 배우자 자산: ${formatKoreanCurrency((intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0))}
  - 예상 퇴직금: ${intakeData.retirementPay ? formatKoreanCurrency(intakeData.retirementPay) : '없음'}${
      intakeData.retirementPensionType === 'pension' ? ' (퇴직연금 가입 - 0% 반영)' :
      intakeData.retirementPensionType === 'none' ? ' (퇴직연금 미가입 - 50% 반영)' :
      intakeData.retirementPensionType === 'unknown' ? ' (퇴직연금 종류 모름 - 50% 반영)' : ''
    }

[3. 채무 구성 및 특이사항]
• 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)} (채권자 수: ${intakeData.debts.length}곳)
  - 세금/체납 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.type === 'tax')?.principal || 0))}
  - 신용카드 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.creditor.includes('카드'))?.principal || 0))}
• 회생/조정 이력: ${intakeData.prevHistory.exists ? '있음' : '없음'}
• 주의 위험 지표: ${riskFlags.join(', ') || '없음'}${specialNoteLine}${
    intakeData.retirementPensionType === 'unknown' ? '\n• ⚠️ [확인 필요] 예상 퇴직금 조회 및 퇴직연금 가입 여부 확인 요망 (챗봇 모름 선택)' : ''
  }
• 현재 법적 조치: ${legalActionsStr}
${(intakeData.clientNotes && intakeData.clientNotes.length > 0) ? `
[4. 의뢰인 전달 메모]
• ${intakeData.clientNotes.join('\n• ')}` : (intakeData.notes ? `
[4. 의뢰인 전달 메모]
• ${intakeData.notes}` : '')}

----------------------------------
💡 변호사 실무 검토 요지:
- 가용 소득 상환 능력 검토 완료.
- 자산 청산가치 충족 여부 사전 확인.
==================================`,
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
          coinCrypto: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : (intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : coinCrypto)
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
        rentalDeposit: Math.round((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0) / 10000),
        rentCost: Math.round((intakeData.monthlyRent || 0) / 10000),
        depositLoan: Math.round((intakeData.depositLoan || 0) / 10000),
        housingType: intakeData.housingType,
        housingContractHolder: intakeData.housingContractHolder,
        debtCause: intakeData.speculativeLoss ? 'INVESTMENT' : (intakeData.gamblingLoss ? 'GAMBLING' : 'LIVING'),
        harassmentLevel,
        creditorCount: intakeData.debts.length,
        speculativeLoss: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : undefined,
        gamblingLoss: intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : undefined,
        legalActions: intakeData.legalActions,
        retirementPensionType: intakeData.retirementPensionType,
        retirementPay: intakeData.retirementPay ? Math.round(intakeData.retirementPay / 10000) : undefined,
        clientNote: intakeData.notes || undefined,
        clientNotes: intakeData.clientNotes || (intakeData.notes ? [intakeData.notes] : [])
      },
      entryCategory: entryCategory || { type: 'general', id: 'direct', label: '일반 상담' },
    };
    
    // 진단 완료 즉시 requests에 저장 (내 관리방에서 채무 현황 확인 가능)
    // 변호사 선택 시 기존 request를 업데이트
    setRequests(prev => {
      const existingIdx = prev.findIndex(r => r.id === newRequest.id || (r.clientId === 'client-temp' && r.status === 'requested'));
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newRequest;
        return updated;
      }
      return [newRequest, ...prev];
    });
    setPendingNewRequest(newRequest);

    // Log calculation activity
    const finalClientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
    onLogActivity(
      finalClientId,
      isLoggedIn ? userAlias : '익명 의뢰인',
      'CLIENT',
      'CALCULATE',
      `정밀 자가진단 실행 (총 채무: ${formatKoreanCurrency(result.base.debtTotal)}, 예상 월 변제금: ${formatNumber(result.preferred?.monthly || 0)}원)`
    );

    // 변호사 선택 모드로 전환
    setLawyerSelectionMode(true);
    setActiveTab('lawyers');
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
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-white dark:bg-slate-900 border-x border-slate-100 dark:border-slate-800 shadow-sm flex flex-col relative">
      
        {/* Dynamic Client Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full transition-all duration-300">
          <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0 min-w-0" onClick={() => setActiveTab('landing')}>
              <img src="./mykim_logo.png" alt="my김변 로고" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-sm shadow-brand/20 hover:scale-105 transition-transform shrink-0" />
              <div className="flex flex-col items-start leading-tight shrink-0 whitespace-nowrap">
                <span className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1 font-brand tracking-tight">
                  my김변
                </span>
                <span className={`text-[11px] lg:text-[12px] text-slate-500 dark:text-slate-500 font-medium whitespace-nowrap ${isLoggedIn ? 'hidden xl:block' : 'hidden sm:block'}`}>
                  나의 채무관리 변호사
                </span>
              </div>
            </div>

          <nav className="flex items-center gap-1 lg:gap-1.5 shrink-0">
            <div className="hidden md:flex items-center gap-0.5 lg:gap-1">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`whitespace-nowrap px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'landing' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                홈
              </button>
              <button 
                onClick={() => {
                  setRequestType('open');
                  setRequestStep(1);
                  setActiveTab('request');
                  onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CONSULT_REQUEST', 'GNB [내 상황 체크하기] 메뉴 클릭');
                }}
                className={`whitespace-nowrap px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'request' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                내 상황 체크하기
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`relative whitespace-nowrap px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'chat' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                내 관리방
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                </span>
              </button>

              <button 
                onClick={() => setActiveTab('lawyers')}
                className={`whitespace-nowrap px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'lawyers' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                전담 변호사 찾기
              </button>
              <button 
                onClick={() => {
                  setActiveTab('qna');
                  onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'QNA_BROWSE', 'GNB [고민상담 Q&A] 메뉴 클릭');
                }}
                className={`whitespace-nowrap px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'qna' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                고민상담 Q&A
              </button>
            </div>
 
            {/* Auth section */}
            {isLoggedIn ? (
              <div className="flex items-center gap-1.5 lg:gap-2 ml-1 pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <div 
                  onClick={() => { setActiveTab('mypage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex flex-col items-end hidden xl:flex whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-all"
                  title="마이페이지로 이동"
                >
                  <span className="text-[12px] lg:text-[13px] font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                    👤 <span className="text-brand dark:text-brand-light whitespace-nowrap">{userAlias}</span>님
                  </span>
                  <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold leading-none">
                    스텔스 보호중
                  </span>
                </div>
                <button 
                  onClick={() => { setActiveTab('mypage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`whitespace-nowrap flex items-center gap-1 px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-bold transition-all shrink-0 cursor-pointer border ${
                    activeTab === 'mypage'
                      ? 'bg-brand/10 border-brand/30 text-brand dark:text-brand-light font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent'
                  }`}
                  title="마이페이지"
                >
                  <User className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">마이페이지</span>
                </button>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsLoggedIn(false);
                    setUserAlias('');
                    
                    // 개인정보 보호를 위해 브라우저 로컬 저장소 완전 초기화
                    localStorage.removeItem('legal_crm_client_id');
                    localStorage.removeItem('legal_crm_requests');
                    localStorage.removeItem('legal_crm_messages');
                    localStorage.removeItem('legal_crm_inquiries');
                    localStorage.removeItem('legal_crm_client_alias');
                    
                    // 메모리 상태 초기화
                    setRequests([]);
                    setMessages([]);
                    setInquiries([]);
                    
                    alert('안전하게 로그아웃되었으며, 이 브라우저의 개인 체크 및 상담 기록이 완전히 초기화되었습니다.');
                  }}
                  className="whitespace-nowrap flex items-center gap-1 px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs lg:text-sm font-bold transition-all shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="ml-2 flex items-center gap-1.5 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-2xl text-sm font-bold transition-all shadow-sm hover:shadow-brand-sm whitespace-nowrap shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>로그인 및 회원가입</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${isChatbotActive ? '' : 'pb-[70px] md:pb-0'}`}>

        {/* TAB 1: LANDING & INTRO */}
        {activeTab === 'landing' && (
          <div className="animate-fadeIn text-left">

            {/* ── Sector 1: Hero ─────────────────────────────── */}
            <section className="w-full py-12 md:py-20 bg-mesh-glow border-b border-slate-200/60 dark:border-slate-800/80 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* 1. Hero Section (Platform Pitch & Identity) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Core Value Proposition */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 dark:bg-brand/20 border border-brand/20 dark:border-brand/40 text-brand dark:text-brand-light text-xs font-extrabold tracking-wide uppercase shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                  </span>
                  <span>100% 비밀보호 · 1분 안심 진단 시스템</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                  채무 독촉 차단부터,<br />
                  <span className="text-gradient-brand">나의 전담 변호사가 다 관리해 드려요</span>
                </h1>
                
                <p className="text-slate-600 dark:text-slate-300 text-base md:text-lg font-medium leading-relaxed max-w-xl">
                  이름 없이 1분 만에 내 탕감율과 예상 변제금을 확인하고,<br />
                  신뢰할 수 있는 1:1 전담 변호사와 바로 연결해 보세요.
                </p>

                {/* Unified CTA Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 w-full max-w-md">
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                      onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CONSULT_REQUEST', '메인 Hero [1분 채무관리 체크 시작하기] 버튼 클릭');
                    }}
                    className="w-full sm:w-auto flex-1 bg-gradient-to-r from-brand via-indigo-600 to-indigo-700 hover:from-brand-hover hover:to-indigo-800 text-white font-extrabold px-7 py-4 rounded-2xl shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2.5 group cursor-pointer text-base"
                  >
                    <span>1분 채무 진단 시작하기</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => setActiveTab('lawyers')}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all text-center shrink-0 cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    전담 변호사 목록
                  </button>
                </div>
              </div>

              {/* Right Column: 핵심 약속 & 프로세스 안내 */}
              <div className="lg:col-span-5 glass-card glass-card-interactive rounded-3xl p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3.5">
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-xl">🛡️</span> my김변 안심 서비스 약속
                  </h4>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    스텔스 보증
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: '💬', title: '초기 진단 무료 진행', desc: '채무 진단 및 탕감 비율 산출은 일체 비용 없이 무료로 제공됩니다.' },
                    { icon: '🔒', title: '100% 익명성 보장', desc: '실명, 주민번호 노출 없이 스텔스 가명으로 안전하게 상담 가능합니다.' },
                    { icon: '⚖️', title: '1:1 전담 변호사 직접 지정', desc: '의뢰인이 직접 신뢰하는 변호사를 선택하여 전담 상담방을 개설합니다.' },
                    { icon: '🛡️', title: '종단간 상담 데이터 암호화', desc: '모든 상담 데이터는 최고 등급 암호화 처리되며 외부 유출이 차단됩니다.' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all">
                      <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white block">{item.title}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium block mt-0.5">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 2: 3단계 프로세스 ────────────────────── */}
            <section className="w-full py-12 md:py-16 bg-white dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 3. Section 2: 3단계 프로세스 (3-Step Guide) */}
            <div className="space-y-8 text-center">
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-brand uppercase tracking-widest bg-brand/10 dark:bg-brand/20 px-3 py-1 rounded-full border border-brand/20">SIMPLE & FAST</span>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  단 3단계로 시작하는 신속 채무 클리닝
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    step: 'STEP 01',
                    title: '1분 셀프 채무 진단',
                    desc: '채무 규모와 수입 상태를 입력하면 예상 탕감율과 월 변제금이 즉시 산출됩니다.',
                    icon: '🔍',
                    badge: '무료 진행'
                  },
                  {
                    step: 'STEP 02',
                    title: '전담 변호사 매칭 선택',
                    desc: '원하는 전문 변호사를 직접 선택하여 익명으로 채무 솔루션을 요청합니다.',
                    icon: '👥',
                    badge: '최대 3명'
                  },
                  {
                    step: 'STEP 03',
                    title: '프라이빗 전담 관리방',
                    desc: '독촉 차단 금지명령부터 맞춤 변제안까지 1:1 전담 비밀 공간에서 케어받으세요.',
                    icon: '🔒',
                    badge: '100% 비밀'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="glass-card glass-card-interactive p-6 rounded-3xl text-left hover:border-brand/40 transition-all duration-300 flex flex-col justify-between min-h-[190px] group relative overflow-hidden">
                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-brand dark:text-brand-light tracking-wider uppercase bg-brand/10 px-2.5 py-1 rounded-lg">{item.step}</span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{item.badge}</span>
                      </div>
                      <div className="flex items-center gap-2.5 pt-1">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{item.title}</h4>
                      </div>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 3: 대시보드 미리보기 ──────────────────── */}
            <section className="w-full py-10 md:py-14 bg-gradient-to-b from-indigo-50/50 to-slate-50/80 dark:from-slate-900 dark:to-slate-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 4. Section 3: 내 채무관리 대시보드 미리보기 (Dashboard Preview) */}
            <div className="space-y-6 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  내 채무 상태를 한곳에서 관리합니다
                </h3>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                  진단을 마치거나 변호사를 지정하면 나만의 비밀 대시보드 관리방이 실시간 개설됩니다.
                </p>
              </div>

              {/* 모니터 프레임 */}
              <div className="max-w-3xl mx-auto">
                {/* 모니터 상단 베젤 */}
                <div className="bg-[#1a1a2e] rounded-t-2xl px-4 py-2 flex items-center justify-between border-x border-t border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  </div>
                  <div className="flex-1 max-w-xs mx-auto bg-slate-800/80 rounded-lg px-3 py-1 flex items-center justify-center gap-1.5">
                    <span className="text-[11px] leading-none">🔒</span>
                    <span className="text-[11px] text-slate-500 font-medium truncate leading-none">legal-rehab.co.kr/my-room</span>
                  </div>
                  <div className="w-16"></div>
                </div>

                {/* 모니터 화면 */}
                <div className="bg-[#f8fafc] dark:bg-[#0f172a] border-x border-b border-slate-700/60 rounded-b-lg overflow-hidden">
                  <div className="grid grid-cols-12 min-h-[340px]">
                    
                    {/* 좌측 사이드바 - 채무관리방 목록 */}
                    <div className="col-span-4 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-black text-brand uppercase tracking-widest">나의 채무관리방</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="px-2 py-1.5">
                          <div className="bg-brand/5 border border-brand/20 rounded-xl px-2.5 py-2 mb-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-900 dark:text-slate-200 truncate">카드빚 + 대출 과다</span>
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-bold">상담중</span>
                              <span className="text-[10px] text-slate-500">김우진 변호사</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-2.5 py-2 opacity-60">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate block">코인 투자 실패 상담</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">완료됨 · 이소민 변호사</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-2.5 py-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="bg-brand/5 rounded-xl px-2 py-1.5 text-center">
                          <span className="text-[10px] font-bold text-brand">+ 새 상담 신청</span>
                        </div>
                      </div>
                    </div>

                    {/* 우측 채팅 영역 */}
                    <div className="col-span-8 flex flex-col bg-white dark:bg-slate-900">
                      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-brand uppercase tracking-widest block">ACTIVE</span>
                          <span className="text-[12px] font-bold text-slate-900 dark:text-slate-200">카드빚 + 대출 과다 채무조정</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-lg font-bold border border-indigo-100 dark:border-indigo-900">📞 전화상담</span>
                          <span className="text-[10px] bg-brand text-white px-2 py-1 rounded-lg font-bold">📄 리포트 수정</span>
                        </div>
                      </div>
                      <div className="flex-1 px-3 py-3 space-y-2.5 overflow-hidden bg-slate-50/30 dark:bg-slate-950/10">
                        <div className="flex flex-col items-start space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold px-0.5">
                            <span className="text-slate-700 dark:text-slate-300">김우진 변호사</span>
                            <span>오전 10:14</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none px-3 py-2 max-w-[85%] shadow-sm">
                            <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">안녕하세요, 김우진 변호사입니다. 제출해 주신 자료를 검토한 결과를 말씀드리겠습니다.</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start space-y-0.5">
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none px-3 py-2 max-w-[85%] shadow-sm">
                            <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">재산이 다소 많아 개인회생은 어렵지만, 워크아웃 신청은 충분히 가능합니다. 이자 감면과 상환기간 조정으로 부담을 줄일 수 있어요.</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold px-0.5">
                            <span className="text-slate-700 dark:text-slate-300">나 (의뢰인)</span>
                            <span>오후 01:32</span>
                          </div>
                          <div className="bg-brand text-white rounded-2xl rounded-tr-none px-3 py-2 max-w-[70%] shadow-sm">
                            <p className="text-[11px] leading-relaxed font-medium">워크아웃이요? 자세히 알려주세요!</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                          <span className="text-[11px] text-slate-500">담당 변호사에게 메시지 보내기...</span>
                        </div>
                        <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shrink-0">
                          <span className="text-white text-[12px]">▶</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 모니터 스탠드 */}
                <div className="flex justify-center">
                  <div className="w-20 h-5 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 rounded-b-lg"></div>
                </div>
                <div className="flex justify-center -mt-0.5">
                  <div className="w-36 h-2 bg-gradient-to-b from-slate-400 to-slate-300 dark:from-slate-800 dark:to-slate-700 rounded-b-xl"></div>
                </div>
              </div>

              {/* 하단 CTA */}
              <div className="max-w-2xl mx-auto pt-4">
                <button 
                  onClick={() => {
                    setRequestType('open');
                    setRequestStep(1);
                    setActiveTab('request');
                  }}
                  className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-center font-bold py-3.5 rounded-2xl text-sm transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-brand/20 hover:shadow-brand/30 flex items-center justify-center gap-2"
                >
                  <span>나도 이렇게 관리받고 싶어요</span>
                  <span className="text-white/70">→</span>
                </button>
              </div>
            </div>
                {/* 글로우 효과 */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-brand/15 rounded-full blur-3xl"></div>
            </div>
            </section>

            {/* ── Sector 4: 상황별 채무관리 방향성 진단 (인디고 틴트 차별화) ────────── */}
            <section className="w-full py-14 md:py-20 bg-gradient-to-b from-indigo-50/70 via-white to-violet-50/40 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/30 relative overflow-hidden">
              {/* 배경 장식 */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-200/30 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-200/20 rounded-full blur-[90px] -ml-20 -mb-20 pointer-events-none" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* 섹션 헤더 */}
                <div className="text-center space-y-3 mb-10">
                  <div className="inline-flex items-center gap-2 bg-brand/[0.08] border border-brand/15 text-brand dark:text-brand-light text-xs font-bold px-4 py-1.5 rounded-full">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>상황별 채무관리 방향 체크</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                    나의 채무 유형을 선택해 주세요
                  </h3>
                  <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                    해당되는 상황을 클릭하면 즉시 관리 방향과 해결 전략을 안내합니다
                  </p>
                </div>

                {/* 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-3.5">
                  {Object.values(remedyData).map((item, idx) => {
                    const colorStyles = {
                      red:     { bar: 'border-l-red-400',     iconBg: 'bg-red-50 dark:bg-red-950/30',       iconText: 'text-red-500',     hoverBorder: 'hover:border-red-200 dark:hover:border-red-800/40',     countText: 'text-red-400' },
                      indigo:  { bar: 'border-l-indigo-400',  iconBg: 'bg-indigo-50 dark:bg-indigo-950/30',  iconText: 'text-indigo-500',  hoverBorder: 'hover:border-indigo-200 dark:hover:border-indigo-800/40',  countText: 'text-indigo-400' },
                      amber:   { bar: 'border-l-amber-400',   iconBg: 'bg-amber-50 dark:bg-amber-950/30',   iconText: 'text-amber-500',   hoverBorder: 'hover:border-amber-200 dark:hover:border-amber-800/40',   countText: 'text-amber-500' },
                      purple:  { bar: 'border-l-purple-400',  iconBg: 'bg-purple-50 dark:bg-purple-950/30',  iconText: 'text-purple-500',  hoverBorder: 'hover:border-purple-200 dark:hover:border-purple-800/40',  countText: 'text-purple-400' },
                      orange:  { bar: 'border-l-orange-400',  iconBg: 'bg-orange-50 dark:bg-orange-950/30',  iconText: 'text-orange-500',  hoverBorder: 'hover:border-orange-200 dark:hover:border-orange-800/40',  countText: 'text-orange-400' },
                      emerald: { bar: 'border-l-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-950/30', iconText: 'text-emerald-500', hoverBorder: 'hover:border-emerald-200 dark:hover:border-emerald-800/40', countText: 'text-emerald-400' },
                      rose:    { bar: 'border-l-rose-400',    iconBg: 'bg-rose-50 dark:bg-rose-950/30',     iconText: 'text-rose-500',    hoverBorder: 'hover:border-rose-200 dark:hover:border-rose-800/40',     countText: 'text-rose-400' },
                    };
                    const cs = colorStyles[item.themeColor as keyof typeof colorStyles] || { bar: 'border-l-brand', iconBg: 'bg-brand-light dark:bg-brand/10', iconText: 'text-brand', hoverBorder: 'hover:border-brand/30', countText: 'text-brand' };
                    const caseCounts = [127, 89, 156, 73, 94, 61, 112, 143, 48];
                    const caseCount = caseCounts[idx] || 80;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleCategoryClick(item.id)}
                        className={`group bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg shadow-sm ${cs.hoverBorder} border-l-[3px] ${cs.bar}`}
                      >
                        <div className="flex items-center gap-3.5 p-4 sm:p-[18px]">
                          {/* 아이콘 */}
                          <div className={`w-10 h-10 rounded-lg ${cs.iconBg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${cs.iconText}`}>
                            {renderRemedyIcon(item.iconName, 'w-[18px] h-[18px]')}
                          </div>

                          {/* 텍스트 */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <h5 className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">{item.title}</h5>
                              {item.id === 'tax_delinquency' && (
                                <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded shrink-0">중요</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 leading-relaxed">
                              {item.subtitle}
                            </p>
                            <span className={`text-[11px] font-semibold ${cs.countText}`}>
                              상담사례 {caseCount}건+
                            </span>
                          </div>

                          {/* 화살표 */}
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 하단 안내 */}
                <div className="text-center pt-8">
                  <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                    ✦ 상황을 선택하면 변호사 검토 요청까지 <span className="text-brand font-bold">3분</span>이면 완료됩니다
                  </p>
                </div>
              </div>
            </section>

            {/* ── Sector 5: 무료 관리 범위 (아이콘 스포트라이트 차별화) ─── */}
            <section className="w-full py-14 md:py-20 bg-white dark:bg-slate-900">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* 헤더 */}
                <div className="text-center space-y-3 mb-12">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    전부 무료
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                    돈 한 푼 안 들어요,<br className="sm:hidden" /> 먼저 상황부터 살펴볼게요
                  </h3>
                  <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                    바로 계약하는 게 아니에요. 지금 내 상황에서 뭘 할 수 있는지, 비용 없이 먼저 알아보는 거예요.
                  </p>
                </div>

                {/* 벤토 그리드: 상단 2개 대형 + 하단 3개 */}
                <div className="space-y-3 md:space-y-4">
                  {/* 상단 2개 — 대형 카드 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {[
                      { emoji: '🔍', title: '채무 위험도 분석', desc: '지금 빚이 얼마나 있고, 얼마나 밀렸는지 위험도 체크', accent: 'from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/15 dark:to-violet-500/15' },
                      { emoji: '🧭', title: '최적 해결 방법 탐색', desc: '나한테 맞는 해결 방법이 뭔지 첫 번째 확인', accent: 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/15 dark:to-teal-500/15' },
                    ].map((item, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-800/30 p-6 md:p-8 transition-all duration-300 hover:shadow-md">
                        {/* 배경 이모지 장식 */}
                        <div className="absolute -right-4 -bottom-4 text-[80px] md:text-[100px] leading-none opacity-[0.06] dark:opacity-[0.04] select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
                          {item.emoji}
                        </div>
                        <div className="relative z-10 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.accent} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            {item.emoji}
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <h5 className="font-bold text-base text-slate-900 dark:text-white">{item.title}</h5>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 하단 3개 — 컴팩트 카드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    {[
                      { emoji: '🛡️', title: '압류 위험 사전 점검', desc: '통장이나 월급이 묶일 수 있는지 미리 확인', accent: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/15 dark:to-orange-500/15' },
                      { emoji: '💰', title: '생활비 보호 설계', desc: '생활비를 얼마까지 지킬 수 있는지 안내', accent: 'from-rose-500/10 to-pink-500/10 dark:from-rose-500/15 dark:to-pink-500/15' },
                      { emoji: '📋', title: '신청 적격 사전 심사', desc: '신청이 잘 통과될지 미리 점검', accent: 'from-sky-500/10 to-cyan-500/10 dark:from-sky-500/15 dark:to-cyan-500/15' },
                    ].map((item, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 md:p-6 transition-all duration-300 hover:shadow-md text-center sm:text-left">
                        {/* 배경 이모지 장식 */}
                        <div className="absolute -right-2 -bottom-2 text-[60px] leading-none opacity-[0.05] dark:opacity-[0.03] select-none pointer-events-none group-hover:scale-110 transition-transform duration-500">
                          {item.emoji}
                        </div>
                        <div className="relative z-10 flex flex-col items-center sm:items-start gap-3">
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.accent} flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            {item.emoji}
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 하단 CTA */}
                <div className="text-center pt-10">
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                    }}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold px-8 py-3.5 rounded-2xl text-sm transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    <span>무료 사전 체크 시작하기</span>
                    <span className="text-white/60 dark:text-slate-400">→</span>
                  </button>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-3">
                    ✦ 비용은 전혀 없어요. 부담 없이 내 상황부터 확인해 보세요
                  </p>
                </div>
              </div>
            </section>

            {/* ── Sector 5.5: 프리미엄 변호사 쇼케이스 광고 (메인 배너 광고 · 월 50만원) ── */}
            {shuffledShowcaseAds.length > 0 && (() => {
              const cardsPerPage = 3;
              const totalPages = Math.ceil(shuffledShowcaseAds.length / cardsPerPage);
              const currentCards = shuffledShowcaseAds.slice(
                showcasePage * cardsPerPage,
                showcasePage * cardsPerPage + cardsPerPage
              );

              return (
                <section
                  className="w-full py-14 md:py-20 relative overflow-hidden"
                  onMouseEnter={() => setShowcaseHovered(true)}
                  onMouseLeave={() => setShowcaseHovered(false)}
                >
                  {/* Premium gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-50/80 via-orange-50/40 to-white dark:from-amber-950/20 dark:via-slate-950 dark:to-slate-900 pointer-events-none" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent dark:via-amber-500/20" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent dark:via-amber-500/10" />

                  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center space-y-3 mb-10">
                      <div className="flex items-center justify-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/25 shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wider">PREMIUM</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 select-none" title="변호사가 직접 등록한 유료 노출 광고입니다">
                          AD 광고 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700 text-[9px] text-slate-400 font-bold">ⓘ</span>
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        검증된{' '}
                        <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">전문 변호사</span>
                        가 함께합니다
                      </h3>
                      <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto">
                        회생·파산 분야에서 풍부한 경험을 갖춘 전담 변호사를 만나보세요.
                      </p>
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
                      {currentCards.map((banner) => (
                        <div
                          key={`showcase-${showcasePage}-${banner.id}`}
                          onClick={() => handleOpenLawyerProfile(banner.lawyerId)}
                          className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 animate-fadeIn"
                        >
                          {/* Top accent gradient strip */}
                          <div className={`h-1.5 w-full bg-gradient-to-r ${banner.gradient}`} />

                          <div className="p-5 md:p-6">
                            {/* AD label + stars */}
                            <div className="flex items-center justify-between mb-4">
                              <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/30">
                                광고
                              </span>
                              <div className="flex gap-0.5">
                                {[...Array(5)].map((_, s) => (
                                  <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                ))}
                              </div>
                            </div>

                            {/* Avatar */}
                            <div className="flex justify-center mb-4">
                              <div className="relative">
                                <img
                                  src={banner.lawyerAvatar}
                                  alt={banner.lawyerName}
                                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 group-hover:border-amber-300 dark:group-hover:border-amber-500/40 shadow-lg transition-colors duration-300"
                                />
                                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                                  <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="text-center space-y-1.5">
                              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                {banner.lawyerName}
                              </h4>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-snug">
                                {banner.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{banner.subtitle}</p>
                              <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 italic">"{banner.tagline}"</p>
                            </div>

                            {/* CTA */}
                            <button onClick={(e) => { e.stopPropagation(); handleOpenLawyerProfile(banner.lawyerId); }} className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]">
                              프로필 보기 →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Page indicators */}
                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 mb-5">
                        {Array.from({ length: totalPages }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setShowcasePage(idx)}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              idx === showcasePage
                                ? 'bg-amber-500 w-6'
                                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 w-2'
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Disclaimer */}
                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-lg mx-auto">
                      <span className="text-amber-500/80">⚠</span>{' '}
                      본 영역은 변호사가 직접 등록한 유료 광고이며, 같은 등급 내{' '}
                      <strong className="text-slate-500 dark:text-slate-400">랜덤 셔플 정렬</strong>로 운영됩니다.
                    </p>
                  </div>
                </section>
              );
            })()}

            {/* ── Sector 6: 해결 경로 비교 ─────────────────── */}
            <section className="w-full py-10 md:py-14 bg-indigo-50/30 dark:bg-indigo-950/10 border-y border-indigo-100/50 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 7. Section 6: 해결 경로 비교 (Solutions Comparison) */}
            <div className="space-y-6 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  채무 해결 방법은 하나가 아닙니다
                </h3>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                  나의 연체 기간, 채권 성격, 소득 지속성에 맞게 다섯 가지 경로를 비교 설계합니다.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-5 text-left">
                {([
                  {
                    type: 'rehab' as SolutionType,
                    icon: '⚖️',
                    title: '개인회생',
                    badge: '원금 최대 90% 감면',
                    badgeColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300',
                    accentColor: 'from-indigo-200 to-violet-200',
                    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
                    borderColor: 'border-indigo-200 dark:border-indigo-800/40',
                    sub: '소득이 있고 일정 금액을 갚을 수 있는 분',
                    desc: '생활비를 빼고 남은 소득으로 3~5년간 나누어 갚으면, 남은 원금의 최대 90%까지 합법적으로 감면받을 수 있습니다.'
                  },
                  {
                    type: 'bankruptcy' as SolutionType,
                    icon: '🔓',
                    title: '개인파산',
                    badge: '채무 전액 면책',
                    badgeColor: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
                    accentColor: 'from-rose-200 to-pink-200',
                    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
                    borderColor: 'border-rose-200 dark:border-rose-800/40',
                    sub: '소득이 없거나 채무 상환이 불가능한 분',
                    desc: '질병, 고령 등으로 소득 활동이 어렵고 재산이 거의 없는 경우, 법원 심사를 거쳐 채무 원금 전체를 한 번에 지워드립니다.'
                  },
                  {
                    type: 'credit' as SolutionType,
                    icon: '🏦',
                    title: '신용회복',
                    badge: '이자 감면 + 분할 상환',
                    badgeColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
                    accentColor: 'from-emerald-200 to-teal-200',
                    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
                    borderColor: 'border-emerald-200 dark:border-emerald-800/40',
                    sub: '은행 및 카드사 빚을 조율하고 싶으신 분',
                    desc: '신용회복위원회를 통해 대출 이자를 전액 또는 일부 줄이고, 갚아 나가는 기간을 최대 10년까지 나누어 부담을 덜어드립니다.'
                  },
                  {
                    type: 'representation' as SolutionType,
                    icon: '🛡️',
                    title: '채무자대리',
                    badge: '독촉 즉시 차단',
                    badgeColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
                    accentColor: 'from-amber-200 to-orange-200',
                    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
                    borderColor: 'border-amber-200 dark:border-amber-800/40',
                    sub: '대부업이나 사채 독촉에 시달리고 계신 분',
                    desc: '변호사를 대리인으로 선임하여 전화, 문자, 집 방문 등 대부업체나 사채업자의 모든 직접 독촉을 즉시 끊어냅니다.'
                  },
                  {
                    type: 'tax' as SolutionType,
                    icon: '📊',
                    title: '세금체납 관리',
                    badge: '압류 해제 + 시효 분석',
                    badgeColor: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300',
                    accentColor: 'from-violet-200 to-purple-200',
                    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
                    borderColor: 'border-violet-200 dark:border-violet-800/40',
                    sub: '밀린 세금과 통장/재산 압류로 힘드신 분',
                    desc: '체납된 세금의 유효 기간(소멸시효)이 만료되었는지 확인하고, 최저 생계비 이하 재산의 부당한 압류를 풀어 일상 복귀를 도와드립니다.'
                  }
                ]).map((item, idx) => (
                  <div key={idx} onClick={() => setActiveSolutionType(item.type)} className={`cursor-pointer bg-white dark:bg-slate-900 border ${item.borderColor} rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-lg transition-all hover-lift-sm transition-card group overflow-hidden w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]`}>
                    {/* Accent top strip */}
                    <div className={`h-1 w-full bg-gradient-to-r ${item.accentColor}`} />
                    <div className="p-5 md:p-6 flex flex-col justify-between flex-1 space-y-4">
                      <div className="space-y-3">
                        {/* Icon + Title row */}
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            <span className="drop-shadow-sm">{item.icon}</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-base text-slate-900 dark:text-white">{item.title}</h4>
                            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.badge}</span>
                          </div>
                        </div>
                        {/* Target audience */}
                        <p className="text-sm text-brand dark:text-brand-light font-semibold">{item.sub}</p>
                        {/* Description */}
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                      <span className="text-[13px] font-bold text-brand/50 dark:text-brand-light/50 group-hover:text-brand dark:group-hover:text-brand-light transition-colors flex items-center gap-1.5 pt-1">
                        자세히 보기
                        <span className="transition-transform group-hover:translate-x-1">→</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 7: 성공 후기 ─────────────────────── */}
            <section className="w-full py-10 md:py-14 bg-slate-50 dark:bg-slate-900/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 8. Section 7: 실제 사례/콘텐츠 (Success reviews & News) */}
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                  <span>실제 채무 해결 성공 후기</span>
                </h3>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-sm text-brand dark:text-brand-light font-bold hover:underline shrink-0"
                >
                  후기 더 보기 →
                </button>
              </div>

              {(() => {
                const visibleCards = windowWidth >= 1024 ? 3 : windowWidth >= 640 ? 2 : 1;
                const maxIdx = Math.max(0, Math.min(reviews.length, 5) - visibleCards);
                const safeActiveIdx = Math.min(activeReviewIdx, maxIdx);
                const translatePercentage = safeActiveIdx * (100 / visibleCards);

                return (
                  <div className="relative max-w-6xl mx-auto px-4 md:px-12">
                    {/* Carousel Container */}
                    <div className="overflow-hidden py-4">
                      <div 
                        className="flex transition-transform duration-500 ease-in-out -mx-2.5"
                        style={{ transform: `translateX(-${translatePercentage}%)` }}
                      >
                        {reviews.slice(0, Math.min(reviews.length, 5)).map(rev => (
                          <div key={rev.id} className="w-full sm:w-1/2 lg:w-1/3 shrink-0 px-2.5">
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 hover-lift-sm transition-card h-full">
                              <div className="space-y-3 text-left">
                                <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white leading-snug line-clamp-1">
                                  {rev.title}
                                </h4>

                                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                                  "{rev.content}"
                                </p>
                              </div>

                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                <div className="flex items-center justify-between text-[12px]">
                                  <span className="text-slate-500 font-semibold">{rev.author}</span>
                                  <div className="flex items-center gap-1.5">
                                    <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" />
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">{rev.lawyerName}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Left/Right Floating Navigation Buttons */}
                    {maxIdx > 0 && (
                      <>
                        <button
                          onClick={() => setActiveReviewIdx(prev => (prev === 0 ? maxIdx : prev - 1))}
                          className="absolute -left-4 sm:-left-6 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 transition-colors z-10 p-2 cursor-pointer"
                          aria-label="Previous review"
                        >
                          <ChevronLeft className="w-8 h-8 md:w-10 md:h-10 stroke-[1.2]" />
                        </button>
                        <button
                          onClick={() => setActiveReviewIdx(prev => (prev === maxIdx ? 0 : prev + 1))}
                          className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 transition-colors z-10 p-2 cursor-pointer"
                          aria-label="Next review"
                        >
                          <ChevronRight className="w-8 h-8 md:w-10 md:h-10 stroke-[1.2]" />
                        </button>
                      </>
                    )}

                    {/* Pagination Dots */}
                    {maxIdx > 0 && (
                      <div className="flex justify-center gap-1.5 mt-4">
                        {Array.from({ length: maxIdx + 1 }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveReviewIdx(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              safeActiveIdx === idx 
                                ? 'bg-brand w-4' 
                                : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                            }`}
                            aria-label={`Go to slide ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            </div>
            </section>

            {/* ── Sector 8: 고민 해결 상담사례 ─────────────── */}
            <section className="w-full py-10 md:py-14 bg-white dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 5. Live Q&A Case Studies (Lawtalk Style) */}
            <div className="space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-brand" />
                  <span>실시간 고민 해결 상담사례</span>
                </h3>
                <span className="text-sm text-slate-500">도산 전문 변호사들이 직접 해결한 최근 고민 사례들입니다</span>
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
                              <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-blue-400 text-[12px] font-semibold px-2.5 py-0.5 rounded-md">
                                {qa.category}
                              </span>
                              <span className="text-[12px] text-slate-500 font-semibold">
                                {qa.author}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 shrink-0" />
                                <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">{qa.lawyerName} 답변</span>
                              </div>
                            </div>
                            <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-200 pr-4 leading-snug">
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
                                  <span className="font-bold text-sm text-slate-900 dark:text-white">{qa.lawyerName}</span>
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-semibold px-2 py-0.5 rounded-md">전문가 답변</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal pt-1.5 whitespace-pre-wrap text-left">
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
                                className="bg-brand hover:bg-brand text-white font-bold px-4 py-2 rounded-xl text-[12px] transition-colors"
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
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-brand-light font-bold rounded-2xl text-sm transition-all shadow-md group cursor-pointer active:scale-[0.98]"
                >
                  <span>⚖️ 실시간 고민 해결 상담사례 전체보기 (더보기)</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 9: 법률 정보 ─────────────────────── */}
            <section className="w-full py-10 md:py-14 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 6. Legal News & Tips Section */}
            <div className="space-y-4 text-left animate-fadeIn">
              <div 
                onClick={() => {
                  setActiveTab('news');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-between gap-1 text-left cursor-pointer group"
              >
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand" />
                  <span>알아두면 좋을 법률 정보</span>
                  <ChevronRight className="w-4 h-4 text-[#7e7e8f] transition-transform group-hover:translate-x-1" />
                </h3>
                <span className="text-sm text-brand dark:text-brand-light font-bold hover:underline shrink-0">
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden cursor-pointer group"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-950 shrink-0">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {art.badge && (
                        <span className={`absolute top-3.5 left-3.5 text-[12px] font-semibold px-2.5 py-0.5 rounded-full text-white shadow-sm ${
                          art.badge === 'HOT' ? 'bg-orange-500' :
                          art.badge === 'NEW' ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}>
                          {art.badge}
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-bold">
                          <span>{art.category}</span>
                          <span>•</span>
                          <span>조회 {art.views}</span>
                        </div>
                        <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-200 pr-2 leading-snug line-clamp-2 min-h-[38px] group-hover:text-brand dark:group-hover:text-brand-light transition-colors text-left">
                          {art.title}
                        </h4>
                        <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 text-left">
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
                          <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">By {art.authorName}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            </div>
            </section>

          </div>
        )}
 
 

 
 
        {activeTab !== 'landing' && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${activeTab === 'request' ? 'py-0 px-0 md:py-6 md:px-4' : 'py-6'}`}>
          <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-fadeIn">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-brand rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500 font-bold">페이지를 로딩하고 있습니다...</p>
            </div>
          }>
            {/* TAB: 탕감액 계산기 */}
            {activeTab === 'calculator' && (<CalculatorView onNavigateToRequest={(data) => { setIncome(data.income); setDebtTotal(data.debtTotal); setDependents(data.dependents); if(data.title) setTitle(data.title); if(data.content) setContent(data.content); if(data.requestType) setRequestType(data.requestType); setRequestStep(data.step); setActiveTab('request'); }} />)}


            {/* TAB: SUCCESS TESTIMONIALS/REVIEWS */}
            {activeTab === 'reviews' && (<ReviewsView reviews={reviews} onReviewClick={handleReviewClick} />)}

            {/* TAB: CLIENT 1:1 INQUIRY BOARD */}
            {activeTab === 'inquiry' && (<InquiryView inquiries={inquiries} setInquiries={setInquiries} isLoggedIn={isLoggedIn} userAlias={userAlias} onShowAuthModal={() => setShowAuthModal(true)} inquiryTitle={inquiryTitle} setInquiryTitle={setInquiryTitle} inquiryContent={inquiryContent} setInquiryContent={setInquiryContent} onLogActivity={onLogActivity} />)}

            {/* TAB: MYPAGE (채무 진단 대시보드 + 개인 설정) */}
            {activeTab === 'mypage' && (
              <div className="space-y-6">
                {/* 채무 진단 대시보드 */}
                {activeRequest?.financialProfile ? (
                  <MyPageView
                    userAlias={userAlias}
                    setUserAlias={setUserAlias}
                    isEditingAlias={isEditingAlias}
                    setIsEditingAlias={setIsEditingAlias}
                    tempAlias={tempAlias}
                    setTempAlias={setTempAlias}
                    activeRequest={activeRequest}
                    activeResult={activeResult}
                    onUpdateFinancialProfile={handleUpdateFinancialProfile}
                    onStartDiagnosis={() => setActiveTab('request')}
                    requests={clientRequests}
                    onNavigateToChat={() => setActiveTab('chat')}
                    isCompact={false}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-brand/10 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-brand" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">아직 진단 내역이 없습니다</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      "1분 채무 진단 시작하기"를 통해 나의 채무 현황을 분석해 보세요.
                    </p>
                    <button
                      onClick={() => setActiveTab('request')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all"
                    >
                      채무 진단 시작하기
                    </button>
                  </div>
                )}

                {/* 계정 설정 */}
                <MySettingsView
                  isLoggedIn={isLoggedIn}
                  userAlias={userAlias}
                  setUserAlias={setUserAlias}
                  isEditingAlias={isEditingAlias}
                  setIsEditingAlias={setIsEditingAlias}
                  tempAlias={tempAlias}
                  setTempAlias={setTempAlias}
                  inquiries={inquiries}
                  onNavigateToTab={setActiveTab}
                  onShowAuthModal={() => setShowAuthModal(true)}
                  onLogout={async () => {
                    await supabase.auth.signOut();
                    setIsLoggedIn(false);
                    setUserAlias('');
                    
                    localStorage.removeItem('legal_crm_client_id');
                    localStorage.removeItem('legal_crm_requests');
                    localStorage.removeItem('legal_crm_messages');
                    localStorage.removeItem('legal_crm_inquiries');
                    localStorage.removeItem('legal_crm_client_alias');
                    
                    setRequests([]);
                    setMessages([]);
                    setInquiries([]);
                    
                    alert('안전하게 로그아웃되었으며, 이 브라우저의 개인 체크 및 상담 기록이 완전히 초기화되었습니다.');
                    setActiveTab('landing');
                  }}
                />
              </div>
            )}

            {/* TAB: LEGAL NEWS & TIPS BOARD */}
            {activeTab === 'news' && (<NewsView newsArticles={newsArticles} onSelectArticle={(art) => setSelectedArticle(art)} onUpdateViews={(id) => setNewsArticles(prev => prev.map(x => x.id === id ? {...x, views: x.views+1} : x))} />)}


            {/* TAB: LIVE Q&A CASE STUDIES */}
            {activeTab === 'qna' && (<QnAView qas={qas} onConsultRequest={(t,c) => { setTitle(t); setContent(c); setRequestStep(3); setActiveTab('request'); }} />)}

            {/* TAB 1-B: NOTICES TAB */}
            {activeTab === 'notices' && (<NoticesView notices={notices} selectedNoticeId={selectedNoticeId} onSetSelectedNoticeId={setSelectedNoticeId} onGoHome={() => setActiveTab('landing')} />)}


            {/* TAB 2: HIGH-FIDELITY CUSTOMER INTAKE SCREEN */}
            {activeTab === 'request' && (
              <div className="animate-fadeIn w-full max-w-4xl mx-auto h-[var(--chatbot-vh,100dvh)] md:h-[600px] bg-slate-900 border-0 md:border md:border-slate-800 rounded-none md:rounded-3xl overflow-hidden relative shadow-2xl">
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
                  themeMode="light"
                  characterName="김변"
                  customColors={{
                    primary: '#7264FF',
                    secondary: '#f8f7ff',
                    accent: '#5b4cf5',
                    headerText: '#ffffff',
                    userText: '#ffffff',
                    botText: '#334155'
                  }}
                  isLoggedIn={isLoggedIn}
                  onShowAuthModal={() => setShowAuthModal(true)}
                />
              </div>
            )}

            {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
            {activeTab === 'lawyers' && (<LawyersView lawyers={mockLawyers} onSelectLawyer={(lawyerId) => { const l = mockLawyers.find(x => x.id === lawyerId); if(l) setTitle(l.name+' 변호사 전담 매칭'); setSelectedLawyerId(lawyerId); setRequestType('direct'); setActiveTab('request'); }} selectionMode={lawyerSelectionMode} maxSelections={3} onConfirmSelection={(ids) => { handleConfirmLawyerSelection(ids); }} />)}

            {activeTab === 'chat' && (
              <ChatView 
                requests={clientRequests} 
                messages={messages} 
                activeChatReqId={activeChatReqId} 
                chatInput={chatInput} 
                phoneConsultNum={phoneConsultNum} 
                useSafeNumber050={useSafeNumber050} 
                isLoggedIn={isLoggedIn} 
                userAlias={userAlias} 
                debtBanks={debtBanks} 
                debtCards={debtCards} 
                debtPersonals={debtPersonals} 
                onSetActiveChatReqId={setActiveChatReqId} 
                onSetChatInput={setChatInput} 
                onSetPhoneConsultNum={setPhoneConsultNum} 
                onSetUseSafeNumber050={setUseSafeNumber050} 
                onSetActiveTab={setActiveTab} 
                onSetRequests={setRequests} 
                onSendChat={handleSendChat} 
                onAddMessage={onAddMessage} 
                activeRequest={activeRequest}
                activeResult={activeResult}
                onUpdateFinancialProfile={handleUpdateFinancialProfile}
                setUserAlias={setUserAlias}
                isEditingAlias={isEditingAlias}
                setIsEditingAlias={setIsEditingAlias}
                tempAlias={tempAlias}
                setTempAlias={setTempAlias}
              />
            )}
          </React.Suspense>
        </div>
        )}

      </main>

      {/* Subtle Bottom legal status line */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 md:p-8 text-slate-600 space-y-6 text-left">
        {/* Notice Section */}
        <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-250 flex items-center gap-1.5">
              <span>📋</span> 공지사항
            </h4>
            <button 
              onClick={() => {
                setActiveTab('notices');
                setSelectedNoticeId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[12px] text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 font-bold transition-colors cursor-pointer"
            >
              전체보기 &rarr;
            </button>
          </div>
          <div className="space-y-2 text-[13px]">
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
                  <span className="bg-red-500 text-white font-semibold text-[12px] px-1.5 py-0.5 rounded-sm shrink-0">중요</span>
                )}
                <span className="text-slate-600 dark:text-slate-300 truncate flex-1 group-hover:underline">
                  {notice.title}
                </span>
                <span className="text-[12px] text-slate-500 font-mono shrink-0">{notice.date}</span>
              </div>
            ))}
            {notices.length === 0 && (
              <p className="text-[12px] text-slate-450 py-1">등록된 공지사항이 없습니다.</p>
            )}
          </div>
        </div>

        {/* Policy & Legal disclaimer */}
        <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-500">
          <p className="font-bold text-slate-600 dark:text-slate-400">my김변(마이김변) 정책 설명 및 법적 고지</p>
          <p>
            (주)my김변컴퍼니는 대한민국 법률시장의 정보비대칭과 불법 법조브로커를 해소하여 투명하고 공정한 법률시장을 만들기 위해 my김변(마이김변) 서비스를 제공하고 있습니다. my김변(마이김변)은 의뢰인회원의 법률상담 내용 및 상담 여부, 법률사건 내용 및 수임 여부, 변호사회원의 선택 등에 대해 일절 관여하지 않아 변호사법 및 기타 관련규정을 준수하고 있으며, 변호사회원이 의뢰인회원에게 제공하는 서비스의 내용과 질에 대해 어떠한 법적책임도 부담하지 않습니다. 또한 회원간의 예약 및 결제정보의 중개서비스 또는 통신판매중개 시스템을 제공할 뿐, 통신판매의 당사자가 아닙니다.
          </p>
          <p>
            모든 법률상담은 각 변호사회원이 직접 수행하며, 모든 변호사회원은 각 소속 법률사무소, 로펌에서 독립적으로 법률업무를 수행합니다. 그리고 my김변에 가입한 변호사들 상호간에는 어떠한 조직적인 관계가 없음을 밝힙니다. my김변에 표시된 변호사회원의 정보는 해당 변호사가 직접 제공한 것이며 무단으로 복제, 편집, 전시, 전송, 배포, 판매, 방송, 공연 등에 이용할 수 없습니다.
          </p>
        </div>
      </div>

      {!isChatbotActive && (
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
      )}

      {showTermsModal && (
        <React.Suspense fallback={null}>
          <TermsModal termsModalType={termsModalType} platformConfig={platformConfig} onClose={() => setShowTermsModal(false)} />
        </React.Suspense>
      )}

      {/* Auth Modal (로그인 / 회원가입) */}
      {showAuthModal && (
        <React.Suspense fallback={null}>
          <AuthModal 
            onClose={() => setShowAuthModal(false)} 
            onLoginSuccess={(alias,ep,ch) => { 
              setIsLoggedIn(true); 
              setUserAlias(alias); 
              setShowAuthModal(false); 
              recordClientLogin(alias,ep,ch); 
              setActiveTab('chat');
            }} 
          />
        </React.Suspense>
      )}

      <MobileGNB activeTab={activeTab} onSetActiveTab={setActiveTab} onRequestConsult={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} onStartDiagnosis={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CONSULT_REQUEST', 'GNB [내 상황 체크하기] 메뉴 클릭'); }} onNavigateToLawyers={() => { setActiveTab('lawyers'); }} onNavigateToQna={() => { setActiveTab('qna'); onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'QNA_BROWSE', 'GNB [고민상담 Q&A] 메뉴 클릭'); }} isHidden={isChatbotActive || isGnbHidden} />

      {activeRemedyCategory && remedyData[activeRemedyCategory] && (
        <React.Suspense fallback={null}>
          <RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} />
        </React.Suspense>
      )}
      {activeSolutionType && (
        <React.Suspense fallback={null}>
          <SolutionDetailModal solutionType={activeSolutionType} onClose={() => setActiveSolutionType(null)} onStartDiagnosis={() => { const solutionLabels: Record<string, string> = { personal_rehabilitation: '개인회생', personal_bankruptcy: '개인파산', credit_recovery: '신용회복', workout: '워크아웃' }; setEntryCategory({ type: 'solution', id: activeSolutionType, label: solutionLabels[activeSolutionType] || activeSolutionType }); setActiveSolutionType(null); setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} onApplyConsult={(ctaTitle, ctaContent) => { const solutionLabels: Record<string, string> = { personal_rehabilitation: '개인회생', personal_bankruptcy: '개인파산', credit_recovery: '신용회복', workout: '워크아웃' }; setEntryCategory({ type: 'solution', id: activeSolutionType, label: solutionLabels[activeSolutionType] || activeSolutionType }); setActiveSolutionType(null); setTitle(ctaTitle); setContent(ctaContent); setRequestType('open'); setRequestStep(3); setActiveTab('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </React.Suspense>
      )}
      {selectedArticle && (
        <React.Suspense fallback={null}>
          <NewsDetailModal article={selectedArticle} lawyers={lawyers} onClose={() => setSelectedArticle(null)} onConsultWithLawyer={(lawyerId, lawyerName, articleTitle) => { setRequestType('direct'); setSelectedLawyerId(lawyerId); setIncome(230); setDebtTotal(6500); setTitle(`[법률칼럼 지정상담] ${lawyerName}`); setContent(`안녕하세요, ${lawyerName} 변호사님이 집필하신 법률 칼럼 [${articleTitle}]을 깊이 감명 깊게 정독하고 상담을 접수합니다.\n\n칼럼에 실린 법률 가이드 내용에 의거하여, 저의 소득과 채무 상황에서 최우선적인 압류 방어 대책 및 개인회생 금지명령 개시 가능성을 1:1로 직접 정밀 진단받고 싶습니다.`); setRequestStep(2); setActiveTab('request'); setSelectedArticle(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </React.Suspense>
      )}

      {selectedProfileLawyer && (
        <React.Suspense fallback={null}>
          <LawyerProfileModal
            lawyer={selectedProfileLawyer}
            onClose={() => setSelectedProfileLawyer(null)}
            onConsult={(lawyerId) => {
              const l = mockLawyers.find(x => x.id === lawyerId) || lawyers.find(x => x.id === lawyerId);
              if (l) {
                setTitle(l.name + ' 변호사 전담 매칭');
              }
              setSelectedLawyerId(lawyerId);
              setRequestType('direct');
              setSelectedProfileLawyer(null);
              setRequestStep(1);
              setActiveTab('request');
            }}
          />
        </React.Suspense>
      )}

      {/* Popup Container */}
      {popupConfig && (
        <PopupContainer
          config={popupConfig}
          landingId="legal-crm-main"
          onScrollToForm={() => {
            setRequestType('open');
            setRequestStep(1);
            setActiveTab('request');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenChat={() => {
            setActiveTab('request');
            setRequestType('open');
            setRequestStep(1);
          }}
        />
      )}

      </div>
    </div>
  );
}
