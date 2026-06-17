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
import SolutionDetailModal, { SolutionType } from './client/SolutionDetailModal';
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
  const [checkedStatuses, setCheckedStatuses] = useState<boolean[]>([false, false, false, false, false]);
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
  const [checkerQ1, setCheckerQ1] = useState<string | null>(null);


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
  const [activeSolutionType, setActiveSolutionType] = useState<SolutionType | null>(null);

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

[3. 채무 구성 및 특이사항]
• 총 채무액: ${formatKoreanCurrency(result.base.debtTotal)} (채권자 수: ${intakeData.debts.length}곳)
  - 세금/체납 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.type === 'tax')?.principal || 0))}
  - 신용카드 채무: ${formatKoreanCurrency((intakeData.debts.find(d => d.creditor.includes('카드'))?.principal || 0))}
• 회생/조정 이력: ${intakeData.prevHistory.exists ? '있음' : '없음'}
• 주의 위험 지표: ${riskFlags.join(', ') || '없음'}

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
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      <div className="w-full max-w-[1024px] min-h-screen mx-auto bg-white dark:bg-slate-900 border-x border-slate-100 dark:border-slate-800 shadow-sm flex flex-col relative">
      
        {/* Dynamic Client Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full transition-all duration-300">
          <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('landing')}>
              <img src={platformConfig.siteLogoUrl || "./logo.png"} alt={platformConfig.siteLogoText || "회생톡 로고"} className="w-9 h-9 rounded-xl object-cover shadow-sm shadow-brand/20 hover:scale-105 transition-transform" />
              <div className="flex flex-col text-left">
                <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-white leading-none">{platformConfig.siteLogoText || "회생톡"}</span>
                <span className="text-[10px] text-brand dark:text-brand-light font-semibold tracking-wide mt-0.5">나의 김변호사</span>
              </div>
            </div>

          <nav className="flex items-center gap-1 lg:gap-1.5">
            <div className="hidden md:flex items-center gap-1 lg:gap-1.5">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'landing' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                홈
              </button>
              <button 
                onClick={() => {
                  setDiagnosisPhase('flow');
                  onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CALCULATE', 'GNB [채무관리 시작] 메뉴 클릭');
                }}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  diagnosisPhase === 'flow' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                채무관리 시작
              </button>
              <button 
                onClick={() => {
                  setRequestType('open');
                  setRequestStep(1);
                  setActiveTab('request');
                  onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CONSULT_REQUEST', 'GNB [무료 전담 배정] 메뉴 클릭');
                }}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'request' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                무료 전담 배정
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`relative whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
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
                onClick={() => setActiveTab('calculator')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'calculator' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                해결전략
              </button>
              <button 
                onClick={() => setActiveTab('lawyers')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'lawyers' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                변호사 찾기
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                  activeTab === 'reviews' 
                    ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                성공사례
              </button>
              {isLoggedIn && (
                <button 
                  onClick={() => setActiveTab('mypage')}
                  className={`whitespace-nowrap px-2.5 lg:px-3 py-1.5 rounded-xl text-xs lg:text-sm transition-all duration-200 border ${
                    activeTab === 'mypage' 
                      ? 'bg-brand/5 border-brand/20 text-brand dark:text-brand-light font-bold shadow-[0_2px_10px_rgba(114,100,255,0.08)]' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white font-semibold'
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
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold leading-none">
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
                className="ml-2 flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-2xl text-xs font-bold transition-all shadow-sm hover:shadow-brand-sm whitespace-nowrap shrink-0"
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
          <div className="space-y-12 animate-fadeIn text-left pb-16">
            
            {/* 1. Hero Section (Platform Pitch & Identity) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-6 pb-4">
              {/* Left Column: Core Value Proposition */}
              <div className="lg:col-span-7 space-y-6 text-left">
                {/* 슬로건 배지 */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 dark:bg-brand/20 dark:border-brand/45">
                  <ShieldCheck className="w-4 h-4 text-brand dark:text-brand-light" />
                  <span className="text-xs text-brand dark:text-brand-light font-bold">빚 걱정, 혼자 하지 마세요 — 김변호사가 대신 해결해드려요</span>
                </div>
                
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                  나한테 맞는 방법,<br />
                  <span className="bg-gradient-to-r from-brand to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">따로 있을 수 있어요</span>
                </h1>
                
                <p className="text-slate-500 dark:text-slate-300 text-sm md:text-base font-medium leading-relaxed max-w-xl">
                  지금 내 상황이 어떤지 먼저 무료로 살펴보고,<br />
                  어떻게 하면 좋을지 김변호사가 함께 찾아드려요.
                </p>

                {/* Trust Metrics / Bullets */}
                <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-medium text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">🔒 내 번호 안 보여요</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center gap-1">💬 이름 없이 상담 OK</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center gap-1">🎁 처음 상담은 무료</span>
                </div>

                {/* Two-Track CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
                  <button
                    onClick={() => {
                      setDiagnosisPhase('flow');
                      onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CALCULATE', '메인 Hero [익명으로 채무관리 시작] 버튼 클릭');
                    }}
                    className="flex-1 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-6 py-4 rounded-2xl shadow-sm hover:shadow-brand-sm transition-all text-center flex items-center justify-center gap-2 group cursor-pointer text-sm md:text-base active:scale-[0.98]"
                  >
                    <span>이름 없이 내 상황 알아보기</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                      onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CONSULT_REQUEST', '메인 Hero [전담 변호사 무료 배정] 버튼 클릭');
                    }}
                    className="flex-1 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-6 py-4 rounded-2xl shadow-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base"
                  >
                    <span>무료로 전문가 연결받기</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Interactive State Checker OR Result Banner */}
              {diagnosisResult ? (
                /* ── 진단 완료 배너 ── */
                <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-700/50 rounded-3xl p-6 shadow-md space-y-4 text-white animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5">
                      ✅ 자가진단 완료
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      diagnosisResult.urgencyLevel === 'immediate' ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                      diagnosisResult.urgencyLevel === 'soon' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                      'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {diagnosisResult.urgencyLevel === 'immediate' ? '🔴 긴급' : diagnosisResult.urgencyLevel === 'soon' ? '🟠 주의' : '🟢 여유'}
                    </span>
                  </div>

                  <div className="text-center space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">예상 탕감 금액</span>
                    <p className="text-2xl font-bold text-indigo-300 tracking-tight">
                      약 {diagnosisResult.estimatedSavingsAmount >= 10000 
                        ? `${Math.floor(diagnosisResult.estimatedSavingsAmount / 10000)}억 ${(diagnosisResult.estimatedSavingsAmount % 10000).toLocaleString()}만원`
                        : `${diagnosisResult.estimatedSavingsAmount.toLocaleString()}만원`
                      }
                    </p>
                    <span className="text-xs text-indigo-400 font-medium">
                      원금의 {Math.round(diagnosisResult.estimatedSavingsRate * 100)}% 면책 · 추천 전략: {diagnosisResult.primaryStrategy.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => setDiagnosisPhase('result')}
                      className="py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      결과 자세히 보기
                    </button>
                    <button
                      onClick={() => {
                        // 개선 2: 진단 결과 → 상담 신청 자동 입력
                        const r = diagnosisResult;
                        const incomeMap: Record<string, number> = { employed: 300, unstable: 180, business: 250, none: 0 };
                        const debtMap: Record<string, number> = { under_1000: 700, '1000_to_5000': 3000, '5000_to_10000': 7500, '10000_to_50000': 25000, over_50000: 60000 };
                        setIncome(incomeMap[r.answers.q3_income] ?? 200);
                        setDebtTotal(debtMap[r.answers.q2_debtScale] ?? 5000);
                        setTitle(`[자가진단 연동] ${r.primaryStrategy.label} 전문 상담 신청`);
                        setContent(`[자가진단 연동 상담 신청]\n\n■ 진단 결과 요약\n- 추천 전략: ${r.primaryStrategy.label} (적합도: ${r.primaryStrategy.confidence === 'high' ? '높음' : r.primaryStrategy.confidence === 'medium' ? '보통' : '참고'})\n- 예상 탕감액: 약 ${r.estimatedSavingsAmount.toLocaleString()}만원 (${Math.round(r.estimatedSavingsRate * 100)}% 면책)\n- 긴급도: ${r.urgencyLevel === 'immediate' ? '🔴 긴급' : r.urgencyLevel === 'soon' ? '🟠 주의' : '🟢 여유'} — ${r.urgencyMessage}\n- 예상 월 변제금: 약 ${r.estimatedMonthlyPayment.toLocaleString()}만원\n\n■ 자가진단 응답 데이터\n- 현재 상태: ${r.answers.q1_status}\n- 총 채무: ${r.answers.q2_debtScale}\n- 소득 형태: ${r.answers.q3_income}\n- 시급 사항: ${r.answers.q4_urgentNeed}\n- 희망 방향: ${r.answers.q5_goal}\n\n상기 진단 결과를 바탕으로, 전담 변호사의 정밀 검토를 요청합니다.`);
                        setRequestType('open');
                        setRequestStep(3);
                        setActiveTab('request');
                        setDiagnosisPhase('idle');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="py-2.5 rounded-xl bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-xs font-bold text-white shadow-sm hover:shadow-brand-sm transition-all cursor-pointer active:scale-[0.98]"
                    >
                      이 결과로 상담 신청 →
                    </button>
                  </div>

                  <button
                    onClick={() => { setDiagnosisResult(null); setCheckedStatuses([false, false, false, false, false]); }}
                    className="w-full text-center text-[10px] text-slate-500 hover:text-slate-300 font-medium pt-1 cursor-pointer transition-colors"
                  >
                    진단 초기화하고 다시 체크하기
                  </button>
                </div>
              ) : (
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    📊 지금 내 상황은 어떤가요?
                  </h4>
                  <span className="text-[10px] text-brand dark:text-brand-light font-bold bg-brand-light dark:bg-brand/10 px-2 py-0.5 rounded">실시간 분석</span>
                </div>
                
                <div className="space-y-3">
                  {/* 그룹 1: 연체 단계 — 하나만 선택 가능 */}
                  <div className="space-y-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block">지금 어떤 상황인가요? (하나만 골라주세요)</span>
                    {[
                      { label: '아직 안 밀렸지만 곧 힘들 것 같아요', color: 'bg-emerald-500', risk: 1 },
                      { label: '이미 밀리고 있고, 독촉 연락이 와요', color: 'bg-amber-500', risk: 2 },
                      { label: '통장이 묶이거나 법원 서류가 왔어요', color: 'bg-rose-500', risk: 3 },
                    ].map((item, idx) => (
                      <label 
                        key={idx} 
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checkedStatuses[idx] 
                            ? 'border-brand/40 bg-brand/5 dark:bg-brand/10 shadow-sm' 
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="delinquency-stage"
                          checked={checkedStatuses[idx]}
                          onChange={() => {
                            setCheckedStatuses(prev => {
                              const next = [...prev];
                              // 0~2번은 상호 배타: 나머지 해제
                              next[0] = false;
                              next[1] = false;
                              next[2] = false;
                              next[idx] = true;
                              return next;
                            });
                          }}
                          className="rounded-full text-brand focus:ring-brand w-4 h-4 border-slate-300 dark:border-slate-700 cursor-pointer" 
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full ${item.color} shrink-0 ${checkedStatuses[idx] ? 'scale-125' : 'opacity-50'} transition-all`}></span>
                          <span className={`text-xs font-medium transition-colors ${checkedStatuses[idx] ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{item.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* 구분선 */}
                  <div className="border-t border-slate-100 dark:border-slate-800"></div>

                  {/* 그룹 2: 추가 상황 — 복수 선택 가능 */}
                  <div className="space-y-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block">이런 것도 해당되나요? (여러 개 선택 가능)</span>
                    {[
                      { label: '세금도 밀리고 있어요 (국세, 지방세, 4대보험)', color: 'bg-purple-500', risk: 3, idx: 3 },
                      { label: '회생이나 파산도 알아보고 싶어요', color: 'bg-brand', risk: 2, idx: 4 }
                    ].map((item) => (
                      <label 
                        key={item.idx} 
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checkedStatuses[item.idx] 
                            ? 'border-brand/40 bg-brand/5 dark:bg-brand/10 shadow-sm' 
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={checkedStatuses[item.idx]}
                          onChange={() => {
                            setCheckedStatuses(prev => {
                              const next = [...prev];
                              next[item.idx] = !next[item.idx];
                              return next;
                            });
                          }}
                          className="rounded text-brand focus:ring-brand w-4 h-4 border-slate-300 dark:border-slate-700 cursor-pointer" 
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full ${item.color} shrink-0 ${checkedStatuses[item.idx] ? 'scale-125' : 'opacity-50'} transition-all`}></span>
                          <span className={`text-xs font-medium transition-colors ${checkedStatuses[item.idx] ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{item.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 추천 관리 방향 — 동적 */}
                {(() => {
                  const selectedCount = checkedStatuses.filter(Boolean).length;
                  const hasSeizure = checkedStatuses[2]; // 추심/압류
                  const hasTax = checkedStatuses[3]; // 세금 체납
                  const hasLegal = checkedStatuses[4]; // 회생/파산
                  const hasOverdue = checkedStatuses[1]; // 연체 중
                  const hasPreOverdue = checkedStatuses[0]; // 연체 전

                  if (selectedCount === 0) {
                    return (
                      <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block">추천 관리 방향</span>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          ☝️ 위 항목을 체크하면 맞춤 분석 결과가 표시됩니다.
                        </p>
                      </div>
                    );
                  }

                  // 위험도 계산
                  const riskLevel = (hasSeizure || hasTax) ? '🔴 긴급' : (hasOverdue || hasLegal) ? '🟠 주의' : '🟡 관심';
                  const riskColor = (hasSeizure || hasTax) ? 'from-rose-500/10 to-red-500/5 border-rose-500/30' : (hasOverdue || hasLegal) ? 'from-amber-500/10 to-orange-500/5 border-amber-500/30' : 'from-emerald-500/10 to-green-500/5 border-emerald-500/30';
                  const riskTextColor = (hasSeizure || hasTax) ? 'text-rose-600 dark:text-rose-400' : (hasOverdue || hasLegal) ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

                  // 추천 방향 결정
                  let recommendation = '';
                  if (hasSeizure && hasTax) {
                    recommendation = '세금 소멸시효 검토 + 긴급 채무자대리 선임 + 개인회생/파산 동시 검토가 필요합니다.';
                  } else if (hasSeizure) {
                    recommendation = '긴급 채무자대리 선임으로 추심 차단 후, 개인회생 골든타임 내 신청이 권장됩니다.';
                  } else if (hasTax) {
                    recommendation = '세금 소멸시효(5/10년) 검토 + 압류금지 소액금융재산 심사 청구가 필요합니다.';
                  } else if (hasLegal) {
                    recommendation = '채무 규모와 소득 대비 변제 가능성을 분석하여 회생/파산 적격 여부를 판단합니다.';
                  } else if (hasOverdue) {
                    recommendation = '연체 장기화 방지를 위해 채무조정(워크아웃) 또는 개인회생 선제 검토가 권장됩니다.';
                  } else if (hasPreOverdue) {
                    recommendation = '연체 전 단계에서 채무 구조조정을 시작하면 신용등급 하락을 최소화할 수 있습니다.';
                  }

                  // 개선 1: 상태체크 → Q1 자동 매핑
                  const computeQ1FromChecks = (): string => {
                    if (hasSeizure) return 'seizure';
                    if (hasTax) return 'collection';
                    if (hasOverdue) return 'severe_delinquency';
                    if (hasLegal) return 'early_delinquency';
                    if (hasPreOverdue) return 'no_delinquency';
                    return 'no_delinquency';
                  };

                  return (
                    <div className={`bg-gradient-to-br ${riskColor} p-4 rounded-2xl border text-left space-y-2.5 animate-fadeIn`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">AI 분석 결과</span>
                        <span className={`text-xs font-bold ${riskTextColor}`}>{riskLevel}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                        {recommendation}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400">선택 항목 {selectedCount}개</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className={`text-[10px] font-semibold ${riskTextColor}`}>
                          {(hasSeizure || hasTax) ? '즉시 변호사 상담 권장' : '전문가 진단 권장'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setDiagnosisPhase('flow');
                          // 상태체크 → Q1 자동 매핑 (checkedStatuses를 initialAnswers로 전달)
                          const q1 = computeQ1FromChecks();
                          setCheckerQ1(q1);
                          onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'CALCULATE', `상태체크 카드에서 진단 시작 (선택: ${selectedCount}개, Q1 자동선택: ${q1})`);
                        }}
                        className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer mt-1"
                      >
                        <span>맞춤 채무관리 진단 시작하기 →</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
              )}
            </div>

            {/* 2. Secondary Search Box (Demoted) */}
            <div className="max-w-3xl mx-auto py-2">
              {/* PC View: Inline search */}
              <div className="hidden md:block bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">직접 검색하기:</span>
                  <div className="relative flex-1 flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                    <Search className="w-4 h-4 text-brand mr-2" />
                    <input
                      type="text"
                      placeholder="압류, 세금체납, 코인빚, 채무대리 등 키워드 또는 변호사 이름 검색"
                      value={homeSearchQuery}
                      onChange={(e) => setHomeSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-450 font-medium"
                    />
                    {homeSearchQuery && (
                      <button onClick={() => setHomeSearchQuery('')} className="text-[10px] text-slate-400 hover:text-slate-650">초기화</button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 pl-16">
                  <span className="font-medium">추천 키워드:</span>
                  <button onClick={() => handleCategoryClick('tax_delinquency')} className="hover:text-brand bg-white dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-semibold transition-colors">#세금체납</button>
                  <button onClick={() => handleCategoryClick('high_interest')} className="hover:text-brand bg-white dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-semibold transition-colors">#채무대리</button>
                  <button onClick={() => handleCategoryClick('investment')} className="hover:text-brand bg-white dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-semibold transition-colors">#코인손실</button>
                  <button onClick={() => handleCategoryClick('seizure')} className="hover:text-brand bg-white dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-semibold transition-colors">#급여압류</button>
                </div>
              </div>

              {/* Mobile View: Collapsible Search */}
              <details className="md:hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
                <summary className="text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer list-none flex items-center justify-between">
                  <span>🔍 궁금한 주제 직접 검색하기</span>
                  <span className="text-[10px]">▼</span>
                </summary>
                <div className="mt-3 space-y-2.5">
                  <div className="relative flex items-center bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                    <Search className="w-4 h-4 text-brand mr-2" />
                    <input
                      type="text"
                      placeholder="압류, 세금체납, 코인빚, 채무대리 등 검색"
                      value={homeSearchQuery}
                      onChange={(e) => setHomeSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-450 font-medium"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 text-[9px]">
                    <button onClick={() => handleCategoryClick('tax_delinquency')} className="bg-white dark:bg-slate-950 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800 font-semibold">#세금체납</button>
                    <button onClick={() => handleCategoryClick('high_interest')} className="bg-white dark:bg-slate-950 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800 font-semibold">#채무대리</button>
                    <button onClick={() => handleCategoryClick('investment')} className="bg-white dark:bg-slate-950 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800 font-semibold">#코인손실</button>
                    <button onClick={() => handleCategoryClick('seizure')} className="bg-white dark:bg-slate-950 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800 font-semibold">#급여압류</button>
                  </div>
                </div>
              </details>
            </div>

            {/* 3. Section 2: 3단계 프로세스 (3-Step Guide) */}
            <div className="space-y-6 pt-4 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                  이렇게 3단계면 끝이에요
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  전화 한 번으로 끝나는 광고가 아니에요. 내 정보를 등록하면 전문가가 계속 챙겨드려요.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    step: 'Step 1',
                    title: '1. 내 상황 체크',
                    desc: '빚이 얼마나 있는지, 독촉이 오는지 — 이름 없이 1분 만에 확인해보세요',
                    icon: '🔍',
                    action: () => setDiagnosisPhase('flow')
                  },
                  {
                    step: 'Step 2',
                    title: '2. 전문가 무료 연결',
                    desc: '경험 많은 전문가 3명이 내 상황을 살펴보고, 어떻게 하면 좋을지 무료로 알려드려요',
                    icon: '👥',
                    action: () => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }
                  },
                  {
                    step: 'Step 3',
                    title: '3. 나만의 관리방',
                    desc: '내 상황에 딱 맞는 방법으로, 전문가와 1:1 채팅으로 처음부터 끝까지 함께해요',
                    icon: '💬',
                    action: () => setActiveTab('chat')
                  }
                ].map((item, idx) => (
                  <div key={idx} onClick={item.action} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-left hover:border-brand/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between min-h-[160px] group hover-lift-sm transition-card">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-brand dark:text-brand-light font-black tracking-wider uppercase">{item.step}</span>
                        <span className="text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
                      </div>
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Section 3: 내 채무관리 대시보드 미리보기 (Dashboard Preview) */}
            <div className="space-y-6 pt-4 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                  내 채무 상태를 한곳에서 관리합니다
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  진단을 마치거나 변호사를 지정하면 나만의 비밀 대시보드 관리방이 실시간 개설됩니다.
                </p>
              </div>

              <div className="max-w-2xl mx-auto bg-gradient-to-br from-[#0f1629] via-[#141d33] to-[#0d1117] text-white rounded-3xl shadow-2xl border border-slate-700/50 text-left relative overflow-hidden">
                {/* 글로우 효과 */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-brand/15 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                
                {/* 상단 타이틀바 — PC 윈도우 느낌 */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]"></span>
                      <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.3)]"></span>
                      <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.3)]"></span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 tracking-wide">내 관리방 — 변호사가 직접 관리해요</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">실시간</span>
                  </div>
                </div>

                {/* 메인 컨텐츠 */}
                <div className="p-5 space-y-4">
                  {/* 상태 카드 3개 — 그리드 */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* 담당 변호사 */}
                    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-3.5 border border-slate-700/40 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-brand/20 flex items-center justify-center">
                          <span className="text-xs">👤</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">담당 변호사</span>
                      </div>
                      <p className="text-xs font-bold text-slate-200">아직 배정 전</p>
                      <span className="inline-block text-[9px] text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20 cursor-pointer hover:bg-brand/20 transition-colors">무료 배정받기 →</span>
                    </div>

                    {/* 위험도 */}
                    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-3.5 border border-rose-500/20 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center">
                          <span className="text-xs">⚠️</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">지금 상황</span>
                      </div>
                      <p className="text-xs font-bold text-rose-400">위험</p>
                      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-amber-500 to-rose-500 h-1.5 rounded-full" style={{width: '78%'}}></div>
                      </div>
                    </div>

                    {/* 추천 전략 */}
                    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-3.5 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-xs">💡</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">변호사 추천</span>
                      </div>
                      <p className="text-xs font-bold text-emerald-400 leading-snug">독촉 차단 + 회생 준비</p>
                    </div>
                  </div>

                  {/* 알림 배너 */}
                  <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-sm">🔔</span>
                    <p className="text-[11px] text-rose-300 font-medium">빚 밀린 지 3일째 — 통장이 묶일 수 있어요. 빠른 대응이 필요해요!</p>
                  </div>

                  {/* 할 일 체크리스트 */}
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">📋 변호사가 알려준 다음 할 일</span>
                      <span className="text-[10px] text-slate-500 font-semibold bg-slate-700/50 px-2 py-0.5 rounded-full">0/3 완료</span>
                    </div>
                    
                    {/* 프로그레스 바 */}
                    <div className="w-full bg-slate-700/50 rounded-full h-1">
                      <div className="bg-gradient-to-r from-brand to-indigo-500 h-1 rounded-full transition-all" style={{width: '0%'}}></div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 bg-rose-500/5 border border-rose-500/15 rounded-xl px-3 py-2.5 group">
                        <div className="w-5 h-5 rounded-md border-2 border-rose-500/40 flex items-center justify-center shrink-0">
                          <span className="text-[9px] text-rose-400 font-black">!</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] text-slate-200 font-medium">최근 독촉 전화나 문자가 왔는지 확인해주세요</p>
                          <span className="text-[9px] text-rose-400 font-semibold">긴급</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-3 py-2.5">
                        <div className="w-5 h-5 rounded-md border-2 border-slate-600 shrink-0"></div>
                        <p className="text-[11px] text-slate-300 font-medium">월급이나 수입 증명 서류 준비해주세요 (최근 1년치)</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-3 py-2.5">
                        <div className="w-5 h-5 rounded-md border-2 border-slate-600 shrink-0"></div>
                        <p className="text-[11px] text-slate-300 font-medium">밀린 세금 있는지, 계좌가 묶인 적 있는지 확인해주세요</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 하단 CTA */}
                <div className="px-5 pb-5">
                  <button 
                    onClick={() => setDiagnosisPhase('flow')}
                    className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-center font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-brand/20 hover:shadow-brand/30 flex items-center justify-center gap-2"
                  >
                    <span>나도 이렇게 관리받고 싶어요</span>
                    <span className="text-white/70">→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Section 4: 상황별 빠른 진단 카드 (Situation-based Cards) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                  <span>상황별 채무관리 방향성 진단</span>
                </h3>
                <span className="text-xs text-slate-400">처한 채무 형태에 따라 전담 변호사가 즉각 진단 및 구제 관리를 시작합니다.</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.values(remedyData).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleCategoryClick(item.id)}
                    className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl hover:border-brand/50 hover:shadow-md transition-all cursor-pointer group text-center space-y-3 hover-lift-sm transition-card ${
                      item.id === 'tax_delinquency' 
                        ? 'border-amber-200 dark:border-amber-900/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 dark:from-amber-950/10 dark:to-yellow-950/10' 
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${
                      item.id === 'tax_delinquency' ? 'bg-amber-100 dark:bg-amber-955 text-amber-600' :
                      item.themeColor === 'red' ? 'bg-red-50 dark:bg-red-950/20 text-red-500' :
                      item.themeColor === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500' :
                      item.themeColor === 'amber' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-500' :
                      item.themeColor === 'purple' ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-500' :
                      item.themeColor === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-550' :
                      item.themeColor === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500' :
                      item.themeColor === 'rose' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500' :
                      'bg-brand-light dark:bg-brand/10 text-brand'
                    }`}>
                      {renderRemedyIcon(item.iconName, 'w-5.5 h-5.5')}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <h5 className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.title}</h5>
                        {item.id === 'tax_delinquency' && (
                          <span className="text-[10px] bg-amber-500 text-white font-semibold px-1.5 py-0.5 rounded">중요</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#7e7e8f] dark:text-slate-400 font-semibold line-clamp-2 leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Section 5: 전담 변호사 무료 관리 범위 (Free Care Scope) */}
            <div className="space-y-6 pt-4 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                  돈 한 푼 안 들어요, 먼저 상황부터 살펴볼게요
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  바로 계약하는 게 아니에요. 지금 내 상황에서 뭘 할 수 있는지, 비용 없이 먼저 알아보는 거예요.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
                {/* Free Column */}
                <div className="bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/20 dark:border-emerald-900/30 rounded-3xl p-6 space-y-4">
                  <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    🎁 이건 전부 무료예요 — 부담 갖지 마세요
                  </h4>
                  <ul className="space-y-2.5 text-xs text-slate-655 dark:text-slate-300 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✔</span>
                      <span>지금 빚이 얼마나 있고, 얼마나 밀렸는지 위험도 체크</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✔</span>
                      <span>나한테 맞는 해결 방법이 뭔지 첫 번째 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✔</span>
                      <span>독촉이 얼마나 심해질지, 통장이나 월급이 묶일 수 있는지 미리 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✔</span>
                      <span>생활비를 얼마까지 지킬 수 있는지, 어떤 서류가 필요한지 안내</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">✔</span>
                      <span>최근 빌린 돈을 어디에 썼는지 보고, 신청이 잘 통과될지 미리 점검</span>
                    </li>
                  </ul>
                </div>

                {/* Paid Column */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    🤝 본격적으로 도움받을 때 드는 비용이에요
                  </h4>
                  <ul className="space-y-2.5 text-xs text-slate-500 dark:text-slate-405 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400">•</span>
                      <span>법원에 회생이나 파산 신청서를 대신 내드려요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400">•</span>
                      <span>카드사·대출회사 독촉, 저희가 직접 막아드려요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400">•</span>
                      <span>법원에서 추가 서류 달라고 하면, 저희가 써서 보내드려요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400">•</span>
                      <span>밀린 세금 때문에 재산이 묶이지 않게 도와드려요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-slate-400">•</span>
                      <span>3~5년 동안 매달 잘 갚아나갈 수 있게 끝까지 챙겨드려요</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 7. Section 6: 해결 경로 비교 (Solutions Comparison) */}
            <div className="space-y-6 pt-4 text-center">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">
                  채무 해결 방법은 하나가 아닙니다
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  나의 연체 기간, 채권 성격, 소득 지속성에 맞게 다섯 가지 경로를 비교 설계합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
                {([
                  {
                    type: 'rehab' as SolutionType,
                    title: '개인회생',
                    sub: '소득이 있고 변제 능력이 있는 자',
                    desc: '법정 생계비를 제외한 가용 소득을 36~60개월간 나누어 갚은 후 남은 원금의 최대 90% 법정 감면'
                  },
                  {
                    type: 'bankruptcy' as SolutionType,
                    title: '개인파산',
                    sub: '상환 능력이 아예 없는 자',
                    desc: '무직, 고령, 질병으로 최저생계비 미만 소득 시 보유한 최소 재산만 청산 후 채무 원금 100% 즉시 탕감'
                  },
                  {
                    type: 'credit' as SolutionType,
                    title: '신용회복',
                    sub: '금융기관 채무 조정 희망자',
                    desc: '신용회복위원회의 협약 기관 채무에 대해 이자 감면 및 상환 기간 최장 10년 연장 (신청 다음 날 독촉 정지)'
                  },
                  {
                    type: 'representation' as SolutionType,
                    title: '채무자대리',
                    sub: '추심 및 대부업 독촉 방어가 우선인 자',
                    desc: '변호사를 대리인으로 선임하여 대부업/사채업자의 전화, 문자, 가택 방문 등 일체의 직접 독촉을 차단'
                  },
                  {
                    type: 'tax' as SolutionType,
                    title: '세금체납 관리',
                    sub: '국세·지방세 압류 해결 필요자',
                    desc: '세금 소멸시효(5/10년) 완성 여부와 압류 금지 소액금융재산 대상 불법 압류 적법성 심사 청구'
                  }
                ]).map((item, idx) => (
                  <div key={idx} onClick={() => setActiveSolutionType(item.type)} className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-sm hover:shadow-md transition-all hover-lift-sm transition-card group">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.title}</h4>
                      <span className="text-[10px] text-brand dark:text-brand-light font-semibold block">{item.sub}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                    <span className="text-[10px] font-bold text-brand/60 dark:text-brand-light/60 group-hover:text-brand dark:group-hover:text-brand-light transition-colors flex items-center gap-1 pt-1">
                      자세히 보기 →
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Section 7: 실제 사례/콘텐츠 (Success reviews & News) */}
            <div className="space-y-4 pt-4 text-left">
              <div className="flex items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-brand" />
                  <span>실제 채무 해결 성공 후기</span>
                  <span className="text-[10px] bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light font-semibold px-2 py-0.5 rounded-md">
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
                  <div key={rev.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 hover-lift-sm transition-card">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {rev.category}
                        </span>
                        <div className="flex text-amber-400 text-xs">★★★★★</div>
                      </div>
                      
                      <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-white leading-snug line-clamp-1">
                        {rev.title}
                      </h4>

                      <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-semibold">
                        <div className="text-slate-400">기존 채무: {rev.originalDebt.toLocaleString()}만원</div>
                        <div className="text-indigo-600 dark:text-indigo-400">조정 후: {rev.remainingDebt === 0 ? "전액 탕감" : `${rev.remainingDebt.toLocaleString()}만원`}</div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                        "{rev.content}"
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-semibold">{rev.author}</span>
                        <div className="flex items-center gap-1.5">
                          <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0" />
                          <span className="font-semibold text-slate-600 dark:text-slate-400">{rev.lawyerName}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReviewClick(rev)}
                        className="w-full text-center py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-1"
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
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
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
                              <span className="bg-brand-light text-brand dark:bg-brand/10 dark:text-blue-400 text-[10px] font-semibold px-2.5 py-0.5 rounded-md">
                                {qa.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {qa.author}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 shrink-0" />
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{qa.lawyerName} 답변</span>
                              </div>
                            </div>
                            <h4 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200 pr-4 leading-snug">
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
                                  <span className="font-bold text-xs text-slate-800 dark:text-white">{qa.lawyerName}</span>
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md">전문가 답변</span>
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
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-brand-light font-bold rounded-2xl text-xs transition-all shadow-md group cursor-pointer active:scale-[0.98]"
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
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden cursor-pointer group"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-950 shrink-0">
                      <img 
                        src={art.imageUrl} 
                        alt={art.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {art.badge && (
                        <span className={`absolute top-3.5 left-3.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-white shadow-sm ${
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
                        <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 pr-2 leading-snug line-clamp-2 min-h-[38px] group-hover:text-brand dark:group-hover:text-brand-light transition-colors text-left">
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
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">By {art.authorName}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-1" />
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
              customColors={{
                primary: '#7264FF',
                secondary: '#1e293b',
                accent: '#5b4cf5',
                headerText: '#ffffff',
                userText: '#ffffff',
                botText: '#f1f5f9'
              }}
            />
          </div>
        )}

        {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
        {activeTab === 'lawyers' && (<LawyersView lawyers={mockLawyers} onSelectLawyer={(lawyerId) => { const l = mockLawyers.find(x => x.id === lawyerId); if(l) setTitle(l.name+' 변호사 전담 매칭'); setSelectedLawyerId(lawyerId); setRequestType('direct'); setActiveTab('request'); }} />)}

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
                  <span className="bg-red-500 text-white font-semibold text-[10px] px-1.5 py-0.5 rounded-sm shrink-0">중요</span>
                )}
                <span className="text-slate-600 dark:text-slate-300 truncate flex-1 group-hover:underline">
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
        <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
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

      {diagnosisPhase === 'flow' && (<DiagnosisFlow onComplete={async (r) => { setDiagnosisResult(r); setDiagnosisPhase('result'); await saveDiagnosisResult(r); }} onBack={() => setDiagnosisPhase('idle')} diagnosisConfig={diagnosisConfig||undefined} initialAnswers={checkerQ1 ? { q1_status: checkerQ1 } : undefined} />)}

      {diagnosisPhase === 'result' && diagnosisResult && (<DiagnosisResultView result={diagnosisResult} onGoHome={() => { setDiagnosisPhase('idle'); }} onStartDetailedDiagnosis={() => { const r = diagnosisResult; const incomeMap: Record<string, number> = { employed: 300, unstable: 180, business: 250, none: 0 }; const debtMap: Record<string, number> = { under_1000: 700, '1000_to_5000': 3000, '5000_to_10000': 7500, '10000_to_50000': 25000, over_50000: 60000 }; setIncome(incomeMap[r.answers.q3_income] ?? 200); setDebtTotal(debtMap[r.answers.q2_debtScale] ?? 5000); setTitle(`[자가진단 연동] ${r.primaryStrategy.label} 전문 상담 신청`); setContent(`[자가진단 연동 상담 신청]\n\n■ 진단 결과 요약\n- 추천 전략: ${r.primaryStrategy.label}\n- 예상 탕감액: 약 ${r.estimatedSavingsAmount.toLocaleString()}만원 (${Math.round(r.estimatedSavingsRate * 100)}% 면책)\n- 긴급도: ${r.urgencyMessage}\n- 예상 월 변제금: 약 ${r.estimatedMonthlyPayment.toLocaleString()}만원\n\n상기 진단 결과를 바탕으로, 전담 변호사의 정밀 검토를 요청합니다.`); setRequestType('open'); setRequestStep(3); setDiagnosisPhase('idle'); setActiveTab('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onViewLawyers={() => { setDiagnosisPhase('idle'); setActiveTab('lawyers'); }} onRetakeDiagnosis={() => { setDiagnosisPhase('idle'); setDiagnosisResult(null); setCheckerQ1(null); setDiagnosisPhase('flow'); }} />)}

      <MobileGNB activeTab={activeTab} onSetActiveTab={setActiveTab} onRequestConsult={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} onStartDiagnosis={() => { setDiagnosisPhase('flow'); }} />

      {activeRemedyCategory && remedyData[activeRemedyCategory] && (<RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} />)}
      {activeSolutionType && (<SolutionDetailModal solutionType={activeSolutionType} onClose={() => setActiveSolutionType(null)} onStartDiagnosis={() => { setActiveSolutionType(null); setDiagnosisPhase('flow'); }} onApplyConsult={(ctaTitle, ctaContent) => { setActiveSolutionType(null); setTitle(ctaTitle); setContent(ctaContent); setRequestType('open'); setRequestStep(3); setActiveTab('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />)}
      {selectedArticle && (<NewsDetailModal article={selectedArticle} lawyers={lawyers} onClose={() => setSelectedArticle(null)} onConsultWithLawyer={(lawyerId, lawyerName, articleTitle) => { setRequestType('direct'); setSelectedLawyerId(lawyerId); setIncome(230); setDebtTotal(6500); setTitle(`[법률칼럼 지정상담] ${lawyerName}`); setContent(`안녕하세요, ${lawyerName} 변호사님이 집필하신 법률 칼럼 [${articleTitle}]을 깊이 감명 깊게 정독하고 상담을 접수합니다.\n\n칼럼에 실린 법률 가이드 내용에 의거하여, 저의 소득과 채무 상황에서 최우선적인 압류 방어 대책 및 개인회생 금지명령 개시 가능성을 1:1로 직접 정밀 진단받고 싶습니다.`); setRequestStep(2); setActiveTab('request'); setSelectedArticle(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />)}

      </div>
    </div>
  );
}
