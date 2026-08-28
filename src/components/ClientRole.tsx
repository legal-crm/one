import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, Users, Scale, FileText, ChevronLeft, ChevronRight, ChevronDown, CheckCircle, 
  User, RefreshCw, Smartphone, ShieldCheck, Landmark, AlertTriangle, Send, Eye,
  Search, ArrowRight, DollarSign, TrendingDown, HelpCircle, Activity, HeartHandshake,
  Settings, LogOut, Lock, X, Home, BookOpen, MessageSquare, MapPin, Check, Edit2,
  Star, Sparkles, BarChart3, Shield, ShieldAlert, Calculator, ClipboardCheck, Compass, Zap, Heart, Bell
} from 'lucide-react';
import { Client, FinancialProfile, ConsultRequest, User as LawyerType, ConsultMessage, IntakeData, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, PlatformConfig, ClientInquiry, AppSettings, PopupConfig } from '../types';
import { CustomerIntake } from './CustomerIntake';
import { migrateAnonymousRequests } from '../services/consultService';
import { calculateRehabPlan } from '../rehabEngine';
import { generateAlias } from '../utils/generateAlias';
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
import { loadClientNotifications, markAsRead, markAllAsRead, seedInitialNotifications, getUnreadCount } from '../services/clientNotificationService';
import type { ClientNotification } from '../services/clientNotificationService';

const ReviewsView = React.lazy(() => import('./client/ReviewsView'));
const CalculatorView = React.lazy(() => import('./client/CalculatorView'));
const QnAView = React.lazy(() => import('./client/QnAView'));
const ChatView = React.lazy(() => import('./client/ChatView'));
const NewsView = React.lazy(() => import('./client/NewsView'));
const NoticesView = React.lazy(() => import('./client/NoticesView'));
const CompanyView = React.lazy(() => import('./client/CompanyView'));
const GuideView = React.lazy(() => import('./client/GuideView'));
const LawyersView = React.lazy(() => import('./client/LawyersView'));
const AuthModal = React.lazy(() => import('./client/AuthModal'));
const MyPageView = React.lazy(() => import('./client/MyPageView'));
const MySettingsView = React.lazy(() => import('./client/MySettingsView'));
const InquiryView = React.lazy(() => import('./client/InquiryView'));
const InquiryPopupModal = React.lazy(() => import('./client/InquiryPopupModal'));

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
    subtitle: '확인할 내용: 연체 현황 · 이자 부담 · 이용 가능한 일반 제도',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '카드론·리볼빙 채무와 관련하여 일반적으로 확인되는 제도에는 신용회복위원회의 채무조정 제도(신속채무조정, 개인워크아웃)와 법원의 개인회생·파산 절차 등이 있습니다. 각 제도의 이용 가능 여부와 법률적 효과는 소득, 재산, 부양가족, 채무 발생 경위 및 최근 금융거래 등에 따라 달라질 수 있습니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '카드론 리볼빙 이용내역과 현재 잔액, 연체 시작일과 채권자 연락내역, 최근 대출 및 카드 이용내역, 월 소득과 고정지출, 보유재산과 전체 채무 현황을 정리해 주세요. 구체적인 행동 판단이 필요한 경우 신용회복위원회(1600-5500) 등 공적 상담기관에 확인하시기 바랍니다.',
    iconName: 'Landmark',
    badgeText: '채무조정 제도 일반정보',
    themeColor: 'red',
    preset: { jobType: 'SALARIED', debtCause: 'LIVING', harassmentLevel: 'CALL', creditorCount: 4, debtBanks: 1500, debtCards: 3500, debtPersonals: 0, recentLoans: 0, coinCrypto: 0, debtTotal: 5000, income: 230, title: '카드론 리볼빙 연체 관련 상담 문의', content: '카드론 리볼빙 연체 상황에서 이용 가능한 채무조정 제도에 대해 상담을 받고 싶습니다.' }
  },
  bank_loan: {
    id: 'bank_loan',
    title: '은행·저축은행 연체',
    subtitle: '확인할 내용: 연체 단계 · 채권추심 상태 · 채무조정 제도',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '은행 저축은행 채무 연체와 관련하여 신용회복위원회의 채무조정, 법원의 개인회생 파산 절차 등을 확인할 수 있습니다. 연체 시 기한이익상실, 가압류 등이 발생할 수 있으며, 대응 방법은 개인 상황에 따라 다릅니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '연체 중인 대출 목록과 잔액, 기한이익상실 통보 여부, 채권추심 연락 내역, 월 소득과 고정지출, 보유 재산 현황을 정리해 주세요. 구체적인 금융거래 변경 여부는 공적 상담기관 또는 전문가에게 확인하시기 바랍니다.',
    iconName: 'TrendingDown',
    badgeText: '연체 대응 일반정보',
    themeColor: 'indigo',
    preset: { jobType: 'SALARIED', debtCause: 'LIVING', harassmentLevel: 'LETTER', creditorCount: 3, debtBanks: 5000, debtCards: 0, debtPersonals: 0, recentLoans: 0, coinCrypto: 0, debtTotal: 5000, income: 250, title: '은행 저축은행 연체 관련 상담 문의', content: '은행 저축은행 대출 연체 상황에서 이용 가능한 채무조정 제도에 대해 상담을 받고 싶습니다.' }
  },
  high_interest: {
    id: 'high_interest',
    title: '대부업·사채 독촉',
    subtitle: '확인할 내용: 추심 연락 기록 · 불법추심 신고 방법 · 상담기관',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '대부업 사채 관련 채무에서 과도한 추심을 받는 경우, 채무자대리인 제도, 채무조정 제도, 개인회생 파산 절차 등을 확인할 수 있습니다. 불법추심(야간추심, 폭언, 제3자 통보 등)이 있는 경우 금융감독원이나 경찰에 신고할 수 있습니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '대부업체/사채업자 연락 기록(문자, 녹취), 대출 계약서와 이자율 확인, 현재 채무 잔액과 상환 내역, 불법추심 증거자료, 월 소득과 고정지출을 정리해 주세요. 불법추심 신고: 금융감독원(1332) 또는 경찰(112)',
    iconName: 'DollarSign',
    badgeText: '불법추심 대응 일반정보',
    themeColor: 'amber',
    preset: { jobType: 'DAILY', debtCause: 'LIVING', harassmentLevel: 'LETTER', creditorCount: 5, debtBanks: 0, debtCards: 1000, debtPersonals: 3000, recentLoans: 0, coinCrypto: 0, debtTotal: 4000, income: 200, title: '대부업 사채 독촉 관련 상담 문의', content: '대부업 사채 채무 독촉 상황에서 이용 가능한 제도에 대해 상담을 받고 싶습니다.' }
  },
  guarantee: {
    id: 'guarantee',
    title: '연대보증 채무 위기',
    subtitle: '확인할 내용: 보증 범위 · 주채무 변제 여부 · 관련 서류',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '연대보증인에게 청구가 온 경우, 보증 범위 확인, 채무조정 제도, 개인회생 파산 절차 등을 확인할 수 있습니다. 보증인의 법적 책임 범위와 대응 방법은 보증 계약 내용, 주채무 상태 등에 따라 달라집니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '보증 계약서 및 보증 범위, 주채무자의 현재 상태(파산 회생 여부), 채권자로부터 받은 청구서 독촉장, 본인의 채무 및 재산 현황, 월 소득과 고정지출을 정리해 주세요.',
    iconName: 'Users',
    badgeText: '연대보증 관련 일반정보',
    themeColor: 'purple',
    preset: { jobType: 'SALARIED', debtCause: 'GUARANTEE', harassmentLevel: 'LAWSUIT', creditorCount: 3, debtBanks: 6000, debtCards: 0, debtPersonals: 2000, recentLoans: 0, coinCrypto: 0, debtTotal: 8000, income: 350, title: '연대보증 채무 관련 상담 문의', content: '연대보증 채무로 인해 채권자로부터 청구를 받고 있어 관련 제도에 대해 상담을 받고 싶습니다.' }
  },
  investment: {
    id: 'investment',
    title: '주식·코인 손실',
    subtitle: '확인할 내용: 채무 발생 경위 · 보유재산 · 거래자료 준비',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '투자(주식 코인 등)로 인한 채무의 경우에도 채무조정 제도, 개인회생 파산 절차 등을 확인할 수 있습니다. 투자 손실로 발생한 채무의 처리 방법은 채무 발생 경위, 최근 대출 비율, 보유재산 등에 따라 달라집니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '주식 코인 거래 내역서, 대출 후 자금 사용처 증빙, 현재 보유 잔고 및 재산 현황, 전체 채무 목록과 잔액, 월 소득과 고정지출을 정리해 주세요.',
    iconName: 'AlertTriangle',
    badgeText: '투자채무 관련 일반정보',
    themeColor: 'orange',
    preset: { jobType: 'SALARIED', debtCause: 'INVESTMENT', harassmentLevel: 'CALL', creditorCount: 6, debtBanks: 3500, debtCards: 0, debtPersonals: 0, recentLoans: 1500, coinCrypto: 4500, debtTotal: 9500, income: 280, title: '주식 코인 투자 손실 채무 관련 상담 문의', content: '투자 손실로 발생한 채무 상황에서 이용 가능한 제도에 대해 상담을 받고 싶습니다.' }
  },
  freelancer: {
    id: 'freelancer',
    title: '일용직·프리랜서 채무',
    subtitle: '확인할 내용: 소득 증빙 방법 · 세금 신고 여부 · 채무 현황',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '일용직 프리랜서 등 부정기 소득자도 채무조정 제도, 개인회생 파산 절차 등을 이용할 수 있습니다. 소득 증빙 방법과 절차 이용 가능 여부는 소득의 규칙성, 세금 신고 이력, 채무 규모 등에 따라 달라집니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '최근 6~12개월 통장 입출금 내역, 플랫폼 정산 내역서, 종합소득세 신고 내역(있는 경우), 근로계약서 또는 용역계약서, 전체 채무 목록과 잔액, 월 고정지출 내역을 정리해 주세요.',
    iconName: 'Smartphone',
    badgeText: '부정기 소득자 일반정보',
    themeColor: 'emerald',
    preset: { jobType: 'FREELANCER', debtCause: 'LIVING', harassmentLevel: 'CALL', creditorCount: 4, debtBanks: 2000, debtCards: 1500, debtPersonals: 0, recentLoans: 0, coinCrypto: 0, debtTotal: 3500, income: 180, title: '일용직 프리랜서 채무 관련 상담 문의', content: '부정기 소득자로서 채무 상황에서 이용 가능한 제도에 대해 상담을 받고 싶습니다.' }
  },
  seizure: {
    id: 'seizure',
    title: '급여·통장 압류',
    subtitle: '확인할 내용: 압류 대상 · 결정문 확인 · 법률검토가 필요한 사항',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '급여 예금이 압류된 경우, 개인회생 파산 절차, 압류 금지 범위 확인, 채무조정 제도 등을 확인할 수 있습니다. 압류에 대한 대응 방법은 압류 종류, 채권의 성격, 진행 상태 등에 따라 달라집니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '압류 결정문 또는 지급명령 결정문, 압류된 계좌 급여 정보, 채권자 목록과 채무 잔액, 월 소득과 고정지출, 부양가족 현황을 정리해 주세요. 긴급 상담: 대한법률구조공단(132) 또는 신용회복위원회(1600-5500)',
    iconName: 'ShieldCheck',
    badgeText: '압류 대응 일반정보',
    themeColor: 'rose',
    preset: { jobType: 'SALARIED', debtCause: 'LIVING', harassmentLevel: 'SEIZURE', creditorCount: 5, debtBanks: 4000, debtCards: 2000, debtPersonals: 0, recentLoans: 0, coinCrypto: 0, debtTotal: 6000, income: 240, title: '급여 통장 압류 관련 상담 문의', content: '급여 또는 예금 압류 상황에서 이용 가능한 제도에 대해 상담을 받고 싶습니다.' }
  },
  tax_delinquency: {
    id: 'tax_delinquency',
    title: '세금 체납',
    subtitle: '확인할 내용: 체납 세목 · 고지·독촉 내역 · 압류 진행 상태',
    remedyTitle: '관련 제도 알아보기',
    remedyDesc: '세금 체납의 경우 납부유예, 분할납부, 징수권 소멸시효 등을 확인할 수 있습니다. 세금 채무는 일반 채무와 처리 방식이 다르며, 대응 방법은 체납 세목, 금액, 압류 여부 등에 따라 달라집니다. 위 목록은 추천 순서가 아닙니다.',
    guideTitle: '상담 전 준비사항',
    guideDesc: '체납 세목과 금액(국세 지방세 구분), 고지서 독촉장 수령 내역, 압류 통지서(있는 경우), 사업자등록 이력과 폐업 시기, 기타 채무 현황을 정리해 주세요. 상담: 국세청(126), 대한법률구조공단(132)',
    iconName: 'Scale',
    badgeText: '세금 체납 일반정보',
    themeColor: 'slate',
    preset: { jobType: 'FREELANCER', debtCause: 'BUSINESS', harassmentLevel: 'LETTER', creditorCount: 1, debtBanks: 0, debtCards: 0, debtPersonals: 0, recentLoans: 0, coinCrypto: 0, debtTotal: 3000, income: 180, assetsTotal: 50, title: '세금 체납 관련 상담 문의', content: '세금 체납 상황에서 이용 가능한 제도에 대해 상담을 받고 싶습니다.' }
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
  const [activeTab, setActiveTab] = useState<'landing' | 'request' | 'lawyers' | 'chat' | 'calculator' | 'reviews' | 'qna' | 'mypage' | 'news' | 'notices' | 'inquiry' | 'guide'>(() => {
    if (typeof window === 'undefined') return 'landing';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const validTabs = ['landing', 'request', 'lawyers', 'chat', 'calculator', 'reviews', 'qna', 'mypage', 'news', 'notices', 'inquiry', 'guide'];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam as any;
    }
    return 'landing';
  });
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [clientNotifications, setClientNotifications] = useState<ClientNotification[]>(() => { seedInitialNotifications(); return loadClientNotifications(); });
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  const notifRef = useRef<HTMLDivElement>(null);
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [faqOpenId, setFaqOpenId] = useState<number | null>(null);
  const [faqExpanded, setFaqExpanded] = useState(false);
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

  // 알림 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
    const finalClientId = localStorage.getItem('legal_crm_client_id') || currentClientId || 'client-temp';
    const targetReqId = pendingNewRequest?.id || activeChatReqId;

    // 기존 활성 상담 요청이 있는지 확인 (사용자 본인의 요청만 정확히 매칭)
    const existingRequest = requests.find(r => 
      r.id === targetReqId || (!r.id.startsWith('req-mock-') && r.clientId === finalClientId && (r.status === 'requested' || r.status === 'responding'))
    );

    if (existingRequest) {
      // 기존 요청에 변호사 병합 및 direct_multi 설정
      const existingIds = existingRequest.selectedLawyerIds || [];
      const mergedIds = [...new Set([...existingIds, ...lawyerIds])].slice(0, 3); // 최대 3명
      const newlyAdded = lawyerIds.filter(id => !existingIds.includes(id));

      setRequests(prev => prev.map(r => 
        r.id === existingRequest.id
          ? { ...r, selectedLawyerIds: mergedIds, requestType: 'direct_multi' as const, maxParticipants: mergedIds.length }
          : r
      ));
      setActiveChatReqId(existingRequest.id);
      setLawyerSelectionMode(false);
      setPendingNewRequest(null);

      if (newlyAdded.length > 0) {
        const newNames = newlyAdded.map(id => mockLawyers.find(x => x.id === id)?.name).filter(Boolean);
        onAddMessage(
          existingRequest.id,
          `${newNames.join(', ')} 변호사님에게 상담 요청이 전달되었습니다. 변호사님의 검토 후 제안서가 도착할 예정입니다.`,
          'lawyer', 'system', '시스템 안내'
        );
      }

      setActiveTab('chat');
      return;
    }

    // 새 요청 생성
    if (!pendingNewRequest) return;
    const finalRequest = {
      ...pendingNewRequest,
      requestType: 'direct_multi' as const,
      selectedLawyerIds: lawyerIds.slice(0, 3),
      proposals: [],
      maxParticipants: Math.min(lawyerIds.length, 3),
    };
    setRequests(prev => {
      const filtered = prev.filter(r => r.id !== finalRequest.id);
      return [finalRequest, ...filtered];
    });
    setActiveChatReqId(finalRequest.id);
    setLawyerSelectionMode(false);
    setPendingNewRequest(null);

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
  const [showInquiryPopup, setShowInquiryPopup] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showLogoutSuccessModal, setShowLogoutSuccessModal] = useState<boolean>(false);
  const [showResetDiagnosisModal, setShowResetDiagnosisModal] = useState<boolean>(false);
  const [chatModalTrigger, setChatModalTrigger] = useState<'fav' | 'no_fav' | null>(null);
  const [pendingDiagnosisAfterLogin, setPendingDiagnosisAfterLogin] = useState<boolean>(false);

  // 채무 상황 체크 시작 클릭 처리 (로그인 불필요 → 기존 데이터가 있을 경우 커스텀 팝업)
  const handleStartDiagnosisClick = () => {
    // 로그인 여부와 관계없이 바로 채무 입력 플로우 시작
    const hasData = isLoggedIn && requests.length > 0 && requests.some(r => r.financialProfile);
    if (hasData) {
      setShowResetDiagnosisModal(true);
    } else {
      forceStartNewDiagnosis();
    }
  };

  const forceStartNewDiagnosis = () => {
    setPendingChatbotData(null);
    setRequestType('open');
    setRequestStep(1);
    setActiveTab('request');
  };

  // Email and Real Auth States




  // Helper: Record client login/signup activity
  const recordClientLogin = async (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => {
    // Supabase user ID를 우선 사용 (도메인 간 일관성 보장)
    let targetId = localStorage.getItem('legal_crm_client_id');
    
    // Try to get Supabase user ID
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        targetId = data.session.user.id;
        localStorage.setItem('legal_crm_client_id', targetId);
      }
    } catch {}
    
    if (!targetId) {
      targetId = `client-${Date.now()}`;
      localStorage.setItem('legal_crm_client_id', targetId);
    }
    
    // 익명(client-temp) 상태에서 진행했던 진단/상담 요청을 로그인한 계정으로 이전
    setRequests(prev => prev.map(r => r.clientId === 'client-temp' ? { ...r, clientId: targetId!, clientName: alias } : r));
    
    // Supabase DB에서도 마이그레이션
    migrateAnonymousRequests(targetId!, alias).catch(() => {});
    
    setMembers(prev => {
      const exists = prev.find(m => m.id === targetId || m.alias === alias);
      if (exists) {
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
      // Supabase user ID를 client ID로 사용
      if (session.user.id) {
        localStorage.setItem('legal_crm_client_id', session.user.id);
      }
      setIsLoggedIn(true);
      const metaAlias = session.user.user_metadata?.alias || generateAlias();
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
  const [initialQnACategory, setInitialQnACategory] = useState<string | null>(null);
  const [chatbotAnnouncement, setChatbotAnnouncement] = useState<string | null>(null);
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
      r.clientId === 'client-temp' ||
      (isLoggedIn && userAlias && (r.clientName === userAlias || r.clientName === `${userAlias} (의뢰인)`))
    );
  }, [requests, currentClientId, isLoggedIn, userAlias]);

  // 페이지 새로고침 시 활성 상담이 있으면 자동으로 채팅 탭 복원
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current || clientRequests.length === 0) return;
    // 활성 상담(counseling/responding) 또는 selectedLawyerIds가 있는 요청 찾기
    const activeConsult = clientRequests.find(r => 
      r.status === 'counseling' || r.status === 'responding'
    ) || clientRequests.find(r => 
      r.selectedLawyerIds && r.selectedLawyerIds.length > 0
    );
    if (activeConsult) {
      hasRestoredRef.current = true;
      setActiveChatReqId(activeConsult.id);
      // URL 파라미터로 특정 탭이 지정되지 않은 경우에만 자동 이동
      const params = new URLSearchParams(window.location.search);
      if (!params.get('tab')) {
        setActiveTab('chat');
      }
    }
  }, [clientRequests]);

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

    // 챗봇 상단 안내 메시지 설정
    setChatbotAnnouncement('정확한 상담을 위해서 채무 내용을 정리해야 합니다.\n실명과 전화번호는 노출되지 않습니다.');

    // Move to next step of request
    setRequestStep(2);
    setActiveTab('request');
  };

  // 비슷한 사례 보기 → QnA 탭으로 이동 (카테고리 필터 적용)
  const handleViewSimilarCases = (categoryId: string) => {
    const qnaCategoryMap: Record<string, string> = {
      card_loan: '추심 차단',
      bank_loan: '최근 대출 회생',
      high_interest: '추심 차단',
      guarantee: '개인파산 면책',
      investment: '코인/주식 손실',
      freelancer: '프리랜서 회생',
      seizure: '급여 압류',
      tax_delinquency: '전체',
    };
    setInitialQnACategory(qnaCategoryMap[categoryId] || '전체');
    setActiveRemedyCategory(null);
    setActiveTab('qna');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pre-fill request form from review card
  const handleReviewClick = (rev: SuccessReview) => {
    // 후기 클릭 시 해당 변호사의 프로필 모달을 엽니다 (로톡 스타일)
    handleOpenLawyerProfile(rev.lawyerId);
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
      clientId: isLoggedIn ? (localStorage.getItem('legal_crm_client_id') || 'client-temp') : 'client-temp',
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
        clientId: isLoggedIn ? (localStorage.getItem('legal_crm_client_id') || 'client-temp') : 'client-temp',
        clientName: isLoggedIn ? `${userAlias} (의뢰인)` : '익명 의뢰인',
        age: 38,
        gender: 'male',
        income,
        debtTotal: finalDebtTotal,
        assetsTotal,
        dependents,
        minorChildren: dependents,
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
        creditorCount,
        monthlyFixedExpenses: 45,
        clientNotes: content ? [content] : [],
        clientNote: content || undefined,
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
          ? '상담 요청을 확인한 변호사단에서 최대 3명이 곧 참여를 결정하게 되며, 순차적으로 메세지를 남길 예정입니다.' 
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

  const mapChatbotDataToIntakeData = (
    result: RehabCalculationResult,
    input: RehabUserInput
  ): IntakeData => {
    const age = input.age || 35;
    const birthYear = 2026 - age;
    const birthDate = `${birthYear}-01-01`;
    const gender = input.gender;

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
      singleParent: input.specialCondition === 'single_parent',
      basicLivelihood: input.specialCondition === 'basic_recipient',
      rentFraud: input.specialCondition === 'rent_fraud',
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
      gender,
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
      age: input.age || (birthYear ? 2026 - birthYear : 35),
      specialCondition: input.specialCondition || (input.age && input.age >= 65 ? 'elderly' : (input.specialCondition as any) || 'none'),
      monthlyFixedExpenses: input.monthlyFixedExpenses || ((input.rentCost || 0) + (input.medicalCost || 0) + (input.educationCost || 0) + (input.specialEducationCost || 0)),
      spouseAsset: input.spouseAssets || 0,
      consultationLogs
    };
  };

  const handleIntakeSubmit = (intakeData: IntakeData, navigateToLawyers: boolean = true) => {
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
      clientId: isLoggedIn ? (localStorage.getItem('legal_crm_client_id') || currentClientId || 'client-temp') : 'client-temp',
      clientName: isLoggedIn ? userAlias : '익명 의뢰인',
      phone: intakeData.phoneNumber || '010-4567-8901',
      requestType: 'open' as const,
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
        clientId: isLoggedIn ? (localStorage.getItem('legal_crm_client_id') || currentClientId || 'client-temp') : 'client-temp',
        clientName: isLoggedIn ? userAlias : (intakeData.clientName || '익명 의뢰인'),
        age: intakeData.age || (intakeData.birthDate ? (2026 - parseInt(intakeData.birthDate.split('-')[0])) : 35),
        gender: intakeData.gender || 'male',
        income: incomeManWon,
        debtTotal: debtManWon,
        assetsTotal: assetsManWon,
        dependents: result.client.dependents,
        minorChildren: intakeData.minorChildren || 0,
        maritalStatus: intakeData.maritalStatus === 'single' ? 'SINGLE' : intakeData.maritalStatus === 'married' ? 'MARRIED' : 'DIVORCED',
        debtTypes: {
          banks,
          cards,
          personals,
          recentLoans,
          coinCrypto: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : (intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : coinCrypto)
        },
        riskFlags,
        jobType: intakeData.incomeSources[0]?.type === 'worker' ? 'SALARIED' : 
                 intakeData.incomeSources[0]?.type === 'business' ? 'BUSINESS' : 
                 intakeData.incomeSources[0]?.type === 'daily' || intakeData.incomeSources[0]?.type === 'worker_no_ins' ? 'DAILY' : 'FREELANCER',
        companyName: intakeData.workplace || '',
        companyNameMasked: intakeData.workplace ? intakeData.workplace.replace(/./g, (c, i) => i > 0 && i < intakeData.workplace.length - 1 ? '*' : c) : '미기재',
        employmentDate: intakeData.consultDate,
        residenceRegion: intakeData.residence,
        workLocation: intakeData.workplace || '',
        address: intakeData.residence || '',
        spouseAsset: Math.round((intakeData.spouseAsset || (intakeData.assets.find(a => a.owner === 'spouse')?.marketValue || 0)) / 10000),
        spouseIncome: Math.round((intakeData.spouseIncome || 0) / 10000),
        hasRecentJobChange: intakeData.debts.some(d => d.isRecent),
        rentalDeposit: Math.round((intakeData.assets.find(a => a.type === 'deposit')?.marketValue || 0) / 10000),
        rentCost: Math.round((intakeData.monthlyRent || 0) / 10000),
        depositLoan: Math.round((intakeData.depositLoan || 0) / 10000),
        housingType: intakeData.housingType,
        housingContractHolder: intakeData.housingContractHolder,
        debtCause: intakeData.speculativeLoss ? 'INVESTMENT' : (intakeData.gamblingLoss ? 'GAMBLING' : 'LIVING'),
        harassmentLevel,
        creditorCount: intakeData.debts.length || 3,
        priorityDebt: Math.round((intakeData.debts.find(d => d.type === 'tax')?.principal || 0) / 10000),
        speculativeLoss: intakeData.speculativeLoss ? Math.round(intakeData.speculativeLoss / 10000) : undefined,
        gamblingLoss: intakeData.gamblingLoss ? Math.round(intakeData.gamblingLoss / 10000) : undefined,
        legalActions: intakeData.legalActions,
        retirementPensionType: intakeData.retirementPensionType,
        retirementPay: intakeData.retirementPay ? Math.round(intakeData.retirementPay / 10000) : undefined,
        specialCondition: (intakeData.specialCondition as any) || (intakeData.specialCircumstances?.basicLivelihood ? 'basic_recipient' : intakeData.specialCircumstances?.severeDisability ? 'severe_disability' : intakeData.specialCircumstances?.singleParent ? 'single_parent' : intakeData.specialCircumstances?.rentFraud ? 'rent_fraud' : 'none'),
        monthlyFixedExpenses: Math.round((intakeData.monthlyFixedExpenses || (intakeData.monthlyRent + (intakeData.extraLivingCost?.medical || 0) + (intakeData.extraLivingCost?.education || 0) + (intakeData.extraLivingCost?.specialEducation || 0))) / 10000),
        clientNote: intakeData.notes || undefined,
        clientNotes: intakeData.clientNotes || (intakeData.notes ? [intakeData.notes] : []),
      },
      entryCategory: entryCategory || { type: 'general', id: 'direct', label: '일반 상담' },
    };
    
    // 진단 완료 즉시 requests에 저장
    setRequests(prev => [newRequest, ...prev]);
    setPendingNewRequest(newRequest);

    // 보고서 팝업의 "내 전담 변호사 선택하기" 버튼이 즐겨찾기 확인 → 팝업 방식으로 동작하도록
    // 자동 변호사 탭 이동 및 선택 모드 활성화를 하지 않음
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

  // Real Supabase and Fallback Auth Handlers

  const handleRegenAlias = () => {
    const generatedAlias = generateAlias();
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full min-h-screen mx-auto flex flex-col relative bg-white dark:bg-slate-900">
      
        {/* Dynamic Client Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full transition-all duration-300">
          <div className="max-w-[1240px] w-full mx-auto px-4 md:px-6 h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0 min-w-0" onClick={() => setActiveTab('landing')}>
              <img src="./mykim_logo.png" alt="my김변 로고" className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover shadow-sm shadow-brand/20 hover:scale-105 transition-transform shrink-0" />
              <div className="flex flex-col items-start leading-tight shrink-0 whitespace-nowrap">
                <span className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-slate-100 flex items-center gap-1 font-brand tracking-tight">
                  my김변
                </span>
                <span className={`text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap ${isLoggedIn ? 'hidden xl:block' : 'hidden sm:block'}`}>
                  나의 채무관리 변호사
                </span>
              </div>
            </div>

          <nav className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1 lg:gap-1.5">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`whitespace-nowrap px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[15px] lg:text-base transition-all duration-200 border ${
                  activeTab === 'landing' 
                    ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/25 text-[#1E3A5F] font-bold shadow-[0_2px_10px_rgba(30,58,95,0.08)]' 
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                홈
              </button>
              <button 
                onClick={handleStartDiagnosisClick}
                className={`whitespace-nowrap px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[15px] lg:text-base transition-all duration-200 border ${
                  activeTab === 'request' 
                    ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/25 text-[#1E3A5F] font-bold shadow-[0_2px_10px_rgba(30,58,95,0.08)]' 
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                내 상황 체크하기
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`relative whitespace-nowrap px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[15px] lg:text-base transition-all duration-200 border ${
                  activeTab === 'chat' 
                    ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/25 text-[#1E3A5F] font-bold shadow-[0_2px_10px_rgba(30,58,95,0.08)]' 
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                내 관리방
                <span className="absolute 0 -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1E3A5F] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1E3A5F]"></span>
                </span>
              </button>

              <button 
                onClick={() => setActiveTab('lawyers')}
                className={`whitespace-nowrap px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[15px] lg:text-base transition-all duration-200 border ${
                  activeTab === 'lawyers' 
                    ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/25 text-[#1E3A5F] font-bold shadow-[0_2px_10px_rgba(30,58,95,0.08)]' 
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                변호사 찾기
              </button>
              <button 
                onClick={() => {
                  setActiveTab('qna');
                }}
                className={`whitespace-nowrap px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[15px] lg:text-base transition-all duration-200 border ${
                  activeTab === 'qna' 
                    ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/25 text-[#1E3A5F] font-bold shadow-[0_2px_10px_rgba(30,58,95,0.08)]' 
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                고민상담 Q&A
              </button>
            </div>
 
            {/* Auth section */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2 lg:gap-2.5 ml-1 pl-2.5 border-l border-slate-200 dark:border-slate-800 shrink-0">
                <div 
                  onClick={() => { setActiveTab('mypage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex flex-col items-end hidden xl:flex whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-all"
                  title="마이페이지로 이동"
                >
                  <span className="text-sm lg:text-[15px] font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                    👤 <span className="text-[#1E3A5F] whitespace-nowrap">{userAlias}</span>님
                  </span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold leading-none">
                    스텔스 보호중
                  </span>
                </div>
                {/* 🔔 알림 벨 */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => {
                      setShowNotifDropdown(!showNotifDropdown);
                      if (!showNotifDropdown) {
                        setClientNotifications(loadClientNotifications());
                      }
                    }}
                    className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    title="알림"
                  >
                    <Bell className="w-5 h-5 text-slate-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-[999] overflow-hidden animate-fadeIn">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <span className="text-sm font-black text-slate-800">🔔 알림</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => { markAllAsRead(); setClientNotifications(loadClientNotifications()); setUnreadCount(0); }}
                            className="text-[11px] text-brand font-bold hover:underline cursor-pointer"
                          >
                            모두 읽음 처리
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {clientNotifications.length === 0 ? (
                          <div className="py-8 text-center">
                            <Bell className="w-6 h-6 text-slate-300 mx-auto" />
                            <p className="text-xs text-slate-400 mt-2">새로운 알림이 없습니다</p>
                          </div>
                        ) : clientNotifications.slice(0, 10).map(n => (
                          <button
                            key={n.id}
                            onClick={() => {
                              if (!n.isRead) {
                                markAsRead(n.id);
                                setUnreadCount(prev => Math.max(0, prev - 1));
                              }
                              if (n.linkTab) setActiveTab(n.linkTab as any);
                              setShowNotifDropdown(false);
                              setClientNotifications(loadClientNotifications());
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${!n.isRead ? 'bg-brand/5' : ''}`}
                          >
                            <span className="text-lg shrink-0 mt-0.5">{n.emoji || '🔔'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-xs font-bold truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                                {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.body}</p>
                              <p className="text-[10px] text-slate-300 mt-1">
                                {(() => {
                                  const diff = Date.now() - new Date(n.createdAt).getTime();
                                  if (diff < 60000) return '방금 전';
                                  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
                                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
                                  return `${Math.floor(diff / 86400000)}일 전`;
                                })()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-slate-100 px-4 py-2.5">
                        <button
                          onClick={() => { setActiveTab('mypage'); setShowNotifDropdown(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="text-xs text-brand font-bold hover:underline cursor-pointer w-full text-center"
                        >
                          마이페이지에서 전체 알림 보기 →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => { setActiveTab('mypage'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-sm lg:text-base font-bold transition-all shrink-0 cursor-pointer border ${
                    activeTab === 'mypage'
                      ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/30 text-[#1E3A5F] font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-transparent'
                  }`}
                  title="마이페이지"
                >
                  <User className="w-4 h-4 lg:w-4.5 lg:h-4.5" />
                  <span className="hidden sm:inline">마이페이지</span>
                </button>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsLoggedIn(false);
                    setUserAlias('');
                    
                    localStorage.removeItem('legal_crm_client_id');
                    localStorage.removeItem('legal_crm_inquiries');
                    localStorage.removeItem('legal_crm_client_alias');
                    localStorage.removeItem('lawyer_favorites');
                    localStorage.removeItem('legal_crm_appointed_lawyer_id');
                    localStorage.removeItem('legal_crm_requests');
                    localStorage.removeItem('legal_crm_messages');
                    
                    // 로컬 상태만 초기화
                    setRequests([]);
                    setMessages([]);
                    setInquiries([]);
                    
                    setShowLogoutSuccessModal(true);
                  }}
                  className="whitespace-nowrap flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm lg:text-base font-bold transition-all shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 lg:w-4.5 lg:h-4.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="ml-2 flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] text-white rounded-xl text-base font-bold transition-all shadow-sm hover:shadow-md active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>로그인 및 회원가입</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Privacy Assurance Strip Banner */}
      <div className="w-full bg-[#1A3C4D] text-white text-center py-3 px-4 relative z-30">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-white/90 shrink-0" />
          <p className="text-sm sm:text-base font-bold tracking-tight">
            상담정보는 가명 처리되니, 안심하고 의뢰하세요.
          </p>
        </div>
        <p className="hidden md:block text-xs sm:text-sm text-white/60 mt-0.5 font-medium">
          상담정보는 변호사님이 사건 내용을 파악하고 답변을 하기 위한 목적으로 사용됩니다.
        </p>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${isChatbotActive ? '' : 'pb-[70px] md:pb-0'}`}>

        {/* TAB 1: LANDING & INTRO */}
        {activeTab === 'landing' && (
          <div className="animate-fadeIn text-left">

            {/* ── Sector 1: Hero ─────────────────────────────── */}
            <section className="w-full py-12 md:py-20 bg-[#F8FAFC] border-b border-slate-200 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* 1. Hero Section (Platform Pitch & Identity) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Core Value Proposition */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="text-sm text-slate-500 font-medium">
                  ✓ 1분 간편 확인 · ✓ 100% 익명 · ✓ SSL 암호화
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight text-[#0f172a]">
                  내 채무를 먼저 정리하고,<br />
                  상담할 변호사는 직접 선택하세요
                </h1>
                
                <p className="hidden md:block text-slate-600 text-base md:text-lg font-medium leading-relaxed max-w-xl">
                  이름 없이 1분 만에 내 채무 상황을 간편하게 정리하고,<br />
                  신뢰할 수 있는 변호사 정보를 직접 비교해 보세요.
                </p>

                {/* Unified CTA Button */}
                <div className="pt-3">
                  <button
                    onClick={() => {
                      setRequestType('open');
                      setRequestStep(1);
                      setActiveTab('request');
                    }}
                    className="w-full sm:w-auto bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold px-7 py-4 rounded-lg transition-all text-center flex items-center justify-center gap-2 group cursor-pointer text-base"
                  >
                    <span>내 채무 상황 체크하기</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Right Column: 핵심 약속 & 프로세스 안내 */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#1E3A5F]" /> my김변 안심 서비스 약속
                  </h4>
                  <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-2.5 py-1 rounded-md border border-[#10B981]/20">
                    스텔스 보증
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: <MessageSquare className="w-5 h-5 text-[#3B82F6]" />, title: '부담 없는 초기 상담 절차', desc: '채무 현황 AI 정리 및 변호사 매칭까지의 과정에서 플랫폼 이용료가 발생하지 않습니다.' },
                    { icon: <Lock className="w-5 h-5 text-[#10B981]" />, title: '100% 익명성 보장', desc: '실명, 주민번호 노출 없이 스텔스 가명으로 안전하게 상담 가능합니다.' },
                    { icon: <Users className="w-5 h-5 text-[#1E3A5F]" />, title: '1:1 전담 변호사 직접 지정', desc: '의뢰인이 직접 신뢰하는 변호사를 선택하여 전담 상담방을 개설합니다.' },
                    { icon: <ShieldCheck className="w-5 h-5 text-slate-500" />, title: 'SSL/TLS 암호화 통신 보호', desc: '모든 상담 데이터는 SSL/TLS 암호화 전송 및 서버 암호화 저장으로 안전하게 보호됩니다.' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 bg-[#F8FAFC] hover:bg-white hover:border-slate-200 transition-all">
                      <span className="shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">{item.title}</span>
                        <span className="text-xs text-slate-500 leading-relaxed font-medium block mt-0.5">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 2: my김변 이용안내 (Large Visual Guide) ─────────────────── */}

            {/* 이용안내 헤더 배너 */}
            <section className="w-full bg-[#0D9488] py-5">
              <div className="max-w-5xl mx-auto px-4 text-center">
                <p className="text-white font-extrabold text-lg md:text-xl tracking-tight">✔ my김변 이용안내</p>
                <p className="text-white/80 text-sm font-medium mt-1">채무 정리부터 변호사 상담까지, 단 4단계로 완료됩니다</p>
              </div>
            </section>

            {/* STEP 1: 1분 익명 채무 체크 */}
            <section className="w-full py-16 md:py-24 bg-white border-b border-slate-100">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* 좌측: 텍스트 */}
                  <div className="space-y-5 text-left">
                    <div className="w-12 h-12 rounded-full bg-[#0D9488] text-white flex items-center justify-center font-extrabold text-lg shadow-lg">01</div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-snug">이름 없이 1분이면<br />충분합니다</h3>
                    <p className="hidden md:block text-base sm:text-lg text-slate-600 leading-relaxed font-medium">주민번호, 실명 없이 채무 규모와 부가 정보를 입력하면 채무 전문 변호사에게 상담을 요청할 수 있습니다.</p>
                    <div className="flex flex-wrap gap-3 text-sm sm:text-base">
                      <span className="flex items-center gap-1.5 text-[#0D9488] font-bold"><ShieldCheck className="w-4.5 h-4.5" />실명 불필요</span>
                      <span className="flex items-center gap-1.5 text-[#0D9488] font-bold"><Zap className="w-4.5 h-4.5" />1분 소요</span>
                    </div>
                    <button
                      onClick={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }}
                      className="inline-flex items-center gap-2 px-7 py-4 bg-[#0D9488] hover:bg-[#0B8276] text-white font-bold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-md"
                    >
                      지금 바로 체크하기 →
                    </button>
                  </div>
                  {/* 우측: 스마트폰 목업 (잘린 화면 스타일) */}
                  <div className="flex justify-center">
                    <div className="w-[300px] sm:w-[340px] rounded-b-3xl rounded-t-xl border-x-[6px] border-b-[6px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                      <div className="bg-[#F8FAFC] p-3.5 space-y-3">
                        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 bg-[#7264FF] rounded-lg flex items-center justify-center text-white text-xs font-bold">김</div>
                            <span className="text-xs sm:text-sm font-bold text-slate-700">my김변 AI</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">안녕하세요! 채무 현황을 정리해 드리겠습니다. 현재 총 채무 금액은 얼마인가요?</p>
                        </div>
                        <div className="flex justify-end">
                          <div className="bg-[#1E3A5F] rounded-xl rounded-br-md px-3.5 py-2.5 max-w-[75%]">
                            <p className="text-xs sm:text-sm text-white font-medium">5,000만원 정도입니다</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">확인했습니다. 월 소득은 얼마인가요? (세후 기준)</p>
                        </div>
                        <div className="flex justify-end">
                          <div className="bg-[#1E3A5F] rounded-xl rounded-br-md px-3.5 py-2.5 max-w-[75%]">
                            <p className="text-xs sm:text-sm text-white font-medium">230만원입니다</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">부양가족은 몇 명인가요?</p>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-400">입력해 주세요...</div>
                          <div className="w-8 h-8 bg-[#7264FF] rounded-lg flex items-center justify-center shrink-0"><ArrowRight className="w-4 h-4 text-white" /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* STEP 2: 다수 변호사 선택 & 한번에 상담 요청 */}
            <section className="w-full py-16 md:py-24 bg-[#F8FAFC] border-b border-slate-100">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* 좌측: 변호사 선택 목업 (lg에서 좌측) */}
                  <div className="order-2 lg:order-1 flex justify-center">
                    <div className="w-full max-w-[380px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="bg-[#1E3A5F] px-5 py-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><Users className="w-4.5 h-4.5 text-white" /></div>
                        <div>
                          <p className="text-white font-bold text-base">변호사 선택하기</p>
                          <p className="text-white/70 text-xs">원하는 변호사를 골라 한번에 요청</p>
                        </div>
                      </div>
                      <div className="p-4 space-y-2.5">
                        {/* <!-- mock --> */}
                        {[
                          { name: '김도현', specialty: '개인회생 전문', cases: '회생 350건+', checked: true, color: 'bg-[#1E3A5F]' },
                          { name: '박서연', specialty: '파산·면책 전문', cases: '파산 280건+', checked: true, color: 'bg-[#0D9488]' },
                          { name: '이정훈', specialty: '채무조정 전문', cases: '조정 200건+', checked: false, color: 'bg-[#3B82F6]' },
                          { name: '최민지', specialty: '개인회생 전문', cases: '회생 310건+', checked: true, color: 'bg-[#7C3AED]' },
                        ].map((lawyer, idx) => (
                          <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-default ${lawyer.checked ? 'border-[#1E3A5F]/30 bg-[#EEF4FA]' : 'border-slate-200 bg-white'}`}>
                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${lawyer.checked ? 'border-[#1E3A5F] bg-[#1E3A5F]' : 'border-slate-300'}`}>
                              {lawyer.checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className={`w-9 h-9 ${lawyer.color} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>{lawyer.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-base text-slate-900">{lawyer.name} 변호사</p>
                              <p className="text-xs text-slate-500 font-medium">{lawyer.specialty} · {lawyer.cases}</p>
                            </div>
                            <span className="text-xs font-bold text-amber-500 shrink-0">★ 4.9</span>
                          </div>
                        ))}
                        <div className="pt-2">
                          <div className="flex items-center justify-between px-1 pb-2">
                            <span className="text-sm font-bold text-[#1E3A5F]"><CheckCircle className="w-4 h-4 inline mr-1" />3명 선택됨</span>
                            <span className="text-xs text-slate-400">최대 5명까지 선택 가능</span>
                          </div>
                          <div className="bg-[#1E3A5F] text-white text-center py-3.5 rounded-xl text-base font-bold cursor-default flex items-center justify-center gap-2">
                            <Send className="w-4.5 h-4.5" />선택한 변호사에게 한번에 요청
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* 우측: 텍스트 (lg에서 우측) */}
                  <div className="order-1 lg:order-2 space-y-5 text-left">
                    <div className="w-12 h-12 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center font-extrabold text-lg shadow-lg">02</div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-snug">나에게 맞는 변호사를 골라<br />한번에 상담을 요청하세요</h3>
                    <p className="hidden md:block text-base sm:text-lg text-slate-600 leading-relaxed font-medium">분야별 전문 변호사 목록에서 원하는 변호사를 여러 명 선택하고, 한 번의 요청으로 동시에 상담을 받아보세요. 각 변호사의 답변을 비교한 뒤 가장 맞는 변호사를 선택할 수 있습니다.</p>
                    <div className="flex flex-wrap gap-3 text-sm sm:text-base">
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><Users className="w-4.5 h-4.5" />다수 변호사 동시 선택</span>
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><Send className="w-4.5 h-4.5" />한번에 상담 요청</span>
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><ClipboardCheck className="w-4.5 h-4.5" />답변 비교 후 선택</span>
                    </div>
                    <button
                      onClick={() => { setActiveTab('lawyers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="inline-flex items-center gap-2 px-7 py-4 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-md"
                    >
                      변호사 둘러보기 →
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* STEP 3: 전문 변호사 비교 & 선택 */}
            <section className="w-full py-16 md:py-24 bg-white border-b border-slate-100">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* 좌측: 텍스트 */}
                  <div className="space-y-5 text-left">
                    <div className="w-12 h-12 rounded-full bg-[#0D9488] text-white flex items-center justify-center font-extrabold text-lg shadow-lg">03</div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-snug">여러 변호사의 답변을<br />직접 비교하세요</h3>
                    <p className="hidden md:block text-base sm:text-lg text-slate-600 leading-relaxed font-medium">채무 상황을 등록하면 여러 전문 변호사가 직접 상담 답변을 남깁니다. 각 답변을 비교하고 가장 신뢰가 가는 변호사를 선택하세요.</p>
                    <div className="flex flex-wrap gap-3 text-sm sm:text-base">
                      <span className="flex items-center gap-1.5 text-[#0D9488] font-bold"><Users className="w-4.5 h-4.5" />여러 변호사 답변 비교</span>
                      <span className="flex items-center gap-1.5 text-[#0D9488] font-bold"><Star className="w-4.5 h-4.5" />실제 의뢰인 후기</span>
                      <span className="flex items-center gap-1.5 text-[#0D9488] font-bold"><Heart className="w-4.5 h-4.5" />강요 없는 자율 선택</span>
                    </div>
                    <button
                      onClick={() => { setActiveTab('lawyers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="inline-flex items-center gap-2 px-7 py-4 bg-[#0D9488] hover:bg-[#0B8276] text-white font-bold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-md"
                    >
                      변호사 프로필 둘러보기 →
                    </button>
                  </div>
                  {/* 우측: 변호사 상담 답변 목업 */}
                  <div className="flex justify-center">
                    <div className="w-full max-w-[390px] space-y-3">
                      <div className="bg-[#EEF4FA] rounded-xl px-4 py-3 text-center">
                        <p className="text-sm font-bold text-[#1E3A5F]">📋 내 사건에 도착한 변호사 답변 <span className="text-[#0D9488]">3건</span></p>
                      </div>
                      {[
                        { name: '김도현', specialty: '개인회생 전문', answer: '회생 신청이 적합합니다. 현재 소득 대비 채무 비율을 보면 월 38만원 수준의 변제 계획이 가능합니다.', time: '15분 전', color: 'bg-[#1E3A5F]' },
                        { name: '박서연', specialty: '파산·면책 전문', answer: '파산도 고려해 보실 수 있습니다. 면책 가능성이 높으며, 상세 상담 시 구체적 절차를 안내드리겠습니다.', time: '32분 전', color: 'bg-[#0D9488]' },
                        { name: '이정훈', specialty: '채무조정 전문', answer: '채무 구조를 보면 회생이 유리합니다. 금지명령을 통해 추심도 즉시 중단할 수 있습니다.', time: '1시간 전', color: 'bg-[#3B82F6]' },
                      ].map((lawyer, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-default">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${lawyer.color} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>{lawyer.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-base text-slate-900">{lawyer.name} 변호사</p>
                              <p className="text-xs text-slate-500 font-medium">{lawyer.specialty} · {lawyer.time}</p>
                            </div>
                            <span className="text-xs font-bold text-amber-500">★ 4.9</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3.5">{lawyer.answer}</p>
                          <div className="flex gap-2">
                            <button className="flex-1 text-xs font-bold text-[#1E3A5F] bg-[#EEF4FA] py-2.5 rounded-lg cursor-default whitespace-nowrap">프로필 보기</button>
                            <button className="flex-1 text-xs font-bold text-white bg-[#1E3A5F] py-2.5 rounded-lg cursor-default whitespace-nowrap">상담 시작</button>
                          </div>
                        </div>
                      ))}
                      {/* <!-- mock --> */}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* STEP 4: 1:1 프라이빗 상담방 */}
            <section className="w-full py-16 md:py-24 bg-[#F8FAFC] border-b border-slate-200">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* 좌측: 채팅 목업 (lg에서 좌측) */}
                  <div className="order-2 lg:order-1 flex justify-center">
                    <div className="w-[300px] sm:w-[340px] rounded-b-3xl rounded-t-xl border-x-[6px] border-b-[6px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                      <div className="bg-white flex flex-col">
                        {/* 채팅 헤더 */}
                        <div className="bg-[#1E3A5F] px-4 py-3.5 flex items-center gap-3">
                          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">김</div>
                          <div>
                            <p className="text-white text-sm font-bold">김도현 변호사</p>
                            <p className="text-white/70 text-xs">프라이빗 상담방</p>
                          </div>
                          <div className="ml-auto flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs text-emerald-400 font-bold">스텔스 보호중</span>
                          </div>
                        </div>
                        {/* 채팅 내용 */}
                        <div className="flex-1 p-4 space-y-3.5 bg-[#F1F5F9]">
                          <div className="flex gap-2.5">
                            <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm">김</div>
                            <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] shadow-sm">
                              <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">안녕하세요, 채무 현황 확인했습니다. 회생 신청이 가능하며 예상 변제액은 월 38만원입니다.</p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="bg-[#1E3A5F] rounded-2xl rounded-br-md px-4 py-3 max-w-[75%] shadow-sm">
                              <p className="text-sm sm:text-base text-white leading-relaxed font-normal">감사합니다. 신청 절차와 필요 서류가 궁금합니다.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm">김</div>
                            <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] shadow-sm">
                              <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">네, 서류 목록을 정리해서 안내드리겠습니다. 궁금한 점은 언제든 편하게 질문해 주세요.</p>
                            </div>
                          </div>
                        </div>
                        {/* 입력 영역 */}
                        <div className="px-3 py-2.5 bg-white border-t border-slate-200 flex gap-2">
                          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-400">메시지 입력...</div>
                          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center shrink-0"><ArrowRight className="w-4 h-4 text-white" /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* 우측: 텍스트 (lg에서 우측) */}
                  <div className="order-1 lg:order-2 space-y-5 text-left">
                    <div className="w-12 h-12 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center font-extrabold text-lg shadow-lg">04</div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-snug">가명으로 안전하게<br />1:1 상담을 진행하세요</h3>
                    <p className="hidden md:block text-base sm:text-lg text-slate-600 leading-relaxed font-medium">선택한 변호사와 스텔스 가명으로 보호된 프라이빗 채팅방에서 상담합니다. 실명이나 연락처 노출 없이 안전합니다.</p>
                    <div className="flex flex-wrap gap-3 text-sm sm:text-base">
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><Lock className="w-4.5 h-4.5" />스텔스 가명 보호</span>
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><ShieldCheck className="w-4.5 h-4.5" />SSL/TLS 암호화</span>
                      <span className="flex items-center gap-1.5 text-[#1E3A5F] font-bold"><MessageSquare className="w-4.5 h-4.5" />실시간 + 비실시간</span>
                    </div>
                    <button
                      onClick={() => { setActiveTab('request'); setRequestType('open'); setRequestStep(1); }}
                      className="inline-flex items-center gap-2 px-7 py-4 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-md"
                    >
                      지금 시작하기 →
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Trust Stats Bar (풀위드) ─────────────── */}
            <section className="w-full bg-[#0F2440] border-b border-[#1E3A5F]/30">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">8,400+</p>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">누적 이용자 수</p>
                  </div>
                  <div className="space-y-1 border-x border-slate-700/50">
                    <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">47<span className="text-base font-bold text-slate-400">초</span></p>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">평균 체크 소요시간</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">100<span className="text-base font-bold text-slate-400">%</span></p>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">철저한 익명 상담 보장</p>
                  </div>
                </div>
                {/* <!-- mock: 위 수치는 서비스 예시 데이터입니다 --> */}
              </div>
            </section>



            {/* ── Sector 4: 상황별 채무관리 (로앤굿 스타일 아이콘 메뉴) ────────── */}
            <section className="w-full py-12 md:py-20 bg-white">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* 섹션 헤더 */}
                <div className="text-center space-y-2.5 md:space-y-3 mb-10 md:mb-14">
                  <div className="inline-flex items-center gap-2 bg-[#EEF4FA] border border-[#1E3A5F]/10 text-[#1E3A5F] text-xs font-bold px-4 py-1.5 rounded-full">
                    <HeartHandshake className="w-4 h-4" />
                    <span>STEP 1 · 관심 있는 채무 상황 알아보기</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-tight">
                    관심 있는 채무 상황을 선택해 주세요
                  </h3>
                  <p className="text-base sm:text-lg text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
                    각 상황에서 일반적으로 확인할 사항과 관련 제도의 <strong className="text-slate-700">기본 정보</strong>를 살펴볼 수 있습니다
                  </p>
                </div>

                {/* 아이콘 메뉴 그리드 */}
                <div className="grid grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-10">
                  {Object.values(remedyData).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleCategoryClick(item.id)}
                      className="flex flex-col items-center gap-2.5 md:gap-3 cursor-pointer group"
                    >
                      <div className="w-14 h-14 md:w-[76px] md:h-[76px] rounded-full bg-[#F1F5F9] group-hover:bg-[#E2E8F0] flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
                        {renderRemedyIcon(item.iconName, 'w-6 h-6 md:w-8 md:h-8 text-[#475569] stroke-[1.5]')}
                      </div>
                      <span className="text-sm md:text-base font-bold text-[#334155] group-hover:text-[#0f172a] text-center leading-tight transition-colors">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 하단 안내 */}
                <div className="text-center pt-8 md:pt-10">
                  <p className="text-base text-slate-600 font-medium">
                    ✦ 상황을 선택하면 변호사 검토 요청까지 <span className="text-[#3B82F6] font-bold">3분</span>이면 완료됩니다
                  </p>
                </div>
              </div>
            </section>

            {/* ── Sector 5.5: 프리미엄 변호사 쇼케이스 광고 ── */}
            {shuffledShowcaseAds.length > 0 && (() => {
              const totalPages = shuffledShowcaseAds.length;
              const banner = shuffledShowcaseAds[showcasePage % totalPages];

              return (
                <section
                  className="w-full py-4 md:py-8 bg-[#F8FAFC] border-y border-slate-200"
                  onMouseEnter={() => setShowcaseHovered(true)}
                  onMouseLeave={() => setShowcaseHovered(false)}
                >
                  <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative bg-[#2B3E50] rounded-2xl overflow-hidden shadow-xl flex flex-row items-stretch h-[150px] md:h-[230px]">
                      
                      {/* Left: Text Info & CTA */}
                      <div className="flex-1 p-4 md:p-7 lg:p-8 flex flex-col justify-center relative z-20 min-w-0">
                        <div className="mb-1 md:mb-2">
                          <span className="inline-block bg-white/10 text-white/90 text-xs font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider mb-1 md:mb-2">
                            프리미엄 광고
                          </span>
                          <h3 className="text-base md:text-2xl font-bold text-white mb-0.5 md:mb-1 leading-tight truncate">
                            {banner.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-sm md:text-xl font-black text-white">{banner.lawyerName}</span>
                            <span className="text-xs md:text-base text-slate-300 font-medium truncate">{banner.subtitle}</span>
                          </div>
                        </div>
                        
                        <p className="hidden md:block text-base text-slate-300/90 font-light italic mb-4 border-l-3 border-amber-500 pl-3 break-keep">
                          "{banner.tagline}"
                        </p>
                        
                        <div>
                          <button
                            onClick={() => handleOpenLawyerProfile(banner.lawyerId)}
                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-base transition-all shadow-md hover:shadow-lg cursor-pointer"
                          >
                            <span>프로필 보기 →</span>
                          </button>
                        </div>
                      </div>

                      {/* Right: Avatar */}
                      <div className="relative w-[130px] md:w-[210px] lg:w-[250px] overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-l from-[#2B3E50]/20 via-[#2B3E50]/50 to-transparent z-10" />
                        <img
                          src={banner.lawyerAvatar}
                          alt={banner.lawyerName}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      
                      {/* Navigation Overlays */}
                      <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 flex items-center gap-2 md:gap-3 z-20">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setShowcasePage((prev) => (prev === 0 ? totalPages - 1 : prev - 1))}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors cursor-pointer backdrop-blur-sm border border-white/10"
                          >
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                          <button
                            onClick={() => setShowcasePage((prev) => (prev + 1) % totalPages)}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors cursor-pointer backdrop-blur-sm border border-white/10"
                          >
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                        </div>
                        <div className="bg-black/40 px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium text-white/90 backdrop-blur-sm border border-white/10">
                          {showcasePage + 1} / {totalPages}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 flex items-center justify-center gap-2">
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">AD</span>
                      <p className="text-xs text-slate-500">
                        본 영역은 변호사가 직접 등록한 유료 광고이며, 랜덤 셔플 정렬로 운영됩니다.
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* ── Sector 6: 채무조정 방법 ─────────────────── */}
            <section className="w-full py-8 md:py-14 bg-white border-b border-slate-200">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-6 text-center">
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                채무조정 방법 알아보기
              </h3>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                {([
                  { type: 'rehab' as SolutionType, icon: '⚖️', title: '개인회생' },
                  { type: 'bankruptcy' as SolutionType, icon: '🔓', title: '개인파산' },
                  { type: 'credit' as SolutionType, icon: '🏦', title: '신용회복' },
                  { type: 'representation' as SolutionType, icon: '🛡️', title: '채무자대리' },
                  { type: 'tax' as SolutionType, icon: '📊', title: '세금체납' },
                ]).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSolutionType(item.type)}
                    className="flex flex-col items-center gap-2.5 py-4 md:py-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer active:scale-[0.97] group"
                  >
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center text-2xl md:text-3xl shadow-sm group-hover:scale-110 transition-transform duration-200">
                      {item.icon}
                    </div>
                    <span className="text-sm md:text-base font-bold text-slate-700">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>

            </div>
            </section>

            {/* ── Sector 7: 성공 후기 ─────────────────────── */}
            <section className="w-full py-10 md:py-14 bg-[#F8FAFC] border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-xl text-[#0f172a] flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-[#1E3A5F]" />
                  <span>실제 이용 후기</span>
                </h3>
                <button
                  onClick={() => { setActiveTab('reviews'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="text-sm sm:text-base text-[#3B82F6] font-bold hover:underline shrink-0"
                >
                  후기 더 보기 →
                </button>
              </div>

              {(() => {
                const reviewItems = reviews.slice(0, Math.min(reviews.length, 8));
                if (reviewItems.length === 0) return null;

                return (
                  <div className="relative max-w-6xl mx-auto">
                    <style dangerouslySetInnerHTML={{ __html: `
                      @keyframes reviewFlow {
                        0% { transform: translate3d(0, 0, 0); }
                        100% { transform: translate3d(-50%, 0, 0); }
                      }
                    `}} />
                    <div
                      className="overflow-hidden py-4"
                      style={{
                        maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: '1.25rem',
                          width: 'max-content',
                          animation: 'reviewFlow 30s linear infinite',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = 'paused'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = 'running'; }}
                      >
                        {/* 2벌 복제로 seamless loop */}
                        {[0, 1].map((setIdx) =>
                          reviewItems.map((rev) => (
                            <div key={`${setIdx}-${rev.id}`} className="w-[330px] sm:w-[370px] shrink-0">
                              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 h-full">
                                <div className="space-y-3 text-left">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                                    <span className="text-xs font-bold bg-[#EEF4FA] text-[#1E3A5F] px-2.5 py-0.5 rounded-md ml-2">{rev.tags?.[0] || '개인회생'}</span>
                                  </div>
                                  <h4 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                                    {rev.title}
                                  </h4>
                                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                                    "{rev.content}"
                                  </p>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 font-semibold">{rev.author}</span>
                                    <div className="flex items-center gap-1.5">
                                      <img src={rev.lawyerAvatar} alt={rev.lawyerName} className="w-5 h-5 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0" />
                                      <span className="font-semibold text-slate-700">{rev.lawyerName}</span>
                                    </div>
                                  </div>
                                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />이용 인증</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
            </section>

            {/* ── Sector 8: 고민 해결 상담사례 ─────────────── */}
            <section className="w-full py-10 md:py-14 bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                <h3 className="font-bold text-xl text-[#0f172a] flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#1E3A5F]" />
                  <span>실시간 고민 해결 상담사례</span>
                </h3>
                <span className="text-sm sm:text-base text-slate-500">도산 전문 변호사들이 직접 해결한 최근 고민 사례들입니다</span>
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
                              <span className="bg-[#EEF4FA] text-[#1E3A5F] text-xs font-semibold px-2.5 py-0.5 rounded-md">
                                {qa.category}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold">
                                {qa.author}
                              </span>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <img src={qa.lawyerAvatar} alt={qa.lawyerName} className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{qa.lawyerName} 답변</span>
                              </div>
                            </div>
                            <h4 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 pr-4 leading-snug">
                              Q. {qa.question}
                            </h4>
                          </div>
                          
                          <span className="text-xs font-bold text-[#3B82F6] shrink-0 select-none pt-1">
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
                                className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-105 shrink-0"
                              />
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-base text-slate-900 dark:text-white">{qa.lawyerName}</span>
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-md">변호사 답변</span>
                                </div>
                                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-normal pt-1.5 whitespace-pre-wrap text-left">
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
                                className="bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
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
                  className="inline-flex items-center gap-2 px-7 py-4 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl text-sm sm:text-base transition-all shadow-sm group cursor-pointer active:scale-[0.98]"
                >
                  <span>⚖️ 실시간 고민 해결 상담사례 전체보기 (더보기)</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>

            </div>
            </section>

            {/* ── 서비스 FAQ ─────────────── */}
            <section className="w-full py-14 md:py-20 bg-[#0F172A]">
              <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <div className="text-center space-y-3 mb-10">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    자주 묻는 질문
                  </h3>
                  <p className="text-sm md:text-base text-slate-400 font-medium">
                    서비스 이용에 대해 궁금한 점을 확인하세요
                  </p>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const faqItems = [
                      { q: '플랫폼 이용에 비용이 발생하나요?', a: '채무 현황 AI 정리부터 변호사 상담 요청까지 플랫폼 이용료는 발생하지 않습니다. 정식 선임 시 비용은 각 변호사가 개별 안내합니다.' },
                      { q: '제 개인정보가 노출되지 않나요?', a: '스텔스 가명 시스템을 통해 실명이나 연락처 없이 상담이 진행됩니다. 변호사에게도 가명만 공개되며, 모든 데이터는 SSL/TLS 암호화로 보호됩니다.' },
                      { q: '상담을 받으면 반드시 변호사를 선임해야 하나요?', a: '아닙니다. 상담 후 선임 여부는 전적으로 의뢰인의 자유입니다. 마음에 드는 변호사가 없을 경우 진행하지 않으셔도 불이익이 전혀 없습니다.' },
                      { q: '어떤 변호사들이 등록되어 있나요?', a: '회생·파산 분야에서 실무 경험이 풍부한 전문 변호사만 등록되어 있으며, 프로필에서 경력, 전문 분야, 실제 의뢰인 후기를 직접 확인할 수 있습니다.' },
                      { q: '상담은 어떤 방식으로 진행되나요?', a: '1:1 프라이빗 상담방에서 텍스트 채팅으로 진행됩니다. 실시간 또는 비실시간 모두 가능하며, 변호사가 직접 답변합니다.' },
                      { q: '회생/파산 외에 다른 채무 해결 방법도 안내받을 수 있나요?', a: '네, 채무 상황 체크 결과에 따라 개인회생, 개인파산, 신용회복, 채무조정 등 다양한 방안을 비교해 드립니다. 가장 유리한 방법을 변호사가 안내합니다.' },
                      { q: '개인회생과 개인파산의 차이는 무엇인가요?', a: '개인회생은 일정 소득이 있는 경우 채무의 일부를 3~5년간 변제하고 나머지를 면제받는 제도입니다. 개인파산은 변제 능력이 없는 경우 모든 채무를 면책받는 제도입니다. 소득 유무와 채무 규모에 따라 적합한 방안이 달라집니다.' },
                      { q: '채무 체크 결과는 얼마나 정확한가요?', a: '법원 공개 기준과 실제 판례 데이터를 기반으로 분석하므로 참고 지표로 활용하기에 충분합니다. 다만, 정확한 법적 판단은 전문 변호사와의 상담을 통해 확인하시는 것을 권장합니다.' },
                      { q: '변호사 상담 비용은 얼마인가요?', a: '플랫폼 내 상담 요청 및 제안서 수신 과정에서 의뢰인에게 별도 플랫폼 이용료는 없습니다. 정식 선임 시 발생하는 비용은 각 변호사가 개별 안내하며, 사전에 투명하게 비용을 확인한 뒤 결정하실 수 있습니다.' },
                      { q: '이미 다른 곳에서 상담을 받은 적이 있는데, 다시 이용해도 되나요?', a: '물론입니다. 기존 상담 내역과 관계없이 새롭게 채무 상황을 체크하고, 다른 변호사의 의견을 비교해 보실 수 있습니다.' },
                      { q: '채무가 소액이어도 이용할 수 있나요?', a: '네, 채무 금액에 상관없이 이용 가능합니다. 소액 채무의 경우에도 채무조정, 신용회복 등 적합한 해결 방안을 안내해 드립니다.' },
                      { q: '상담 내용이 가족이나 직장에 알려질 수 있나요?', a: '절대 알려지지 않습니다. 모든 상담은 스텔스 가명과 암호화된 채널을 통해 진행되며, 제3자에게 정보가 전달되는 일은 없습니다.' },
                      { q: '서비스 이용 시간에 제한이 있나요?', a: '채무 상황 체크는 24시간 언제든 이용 가능합니다. 변호사 상담의 경우 비실시간 메시지를 남기시면 업무 시간 내에 답변을 받으실 수 있습니다.' },
                      { q: '회원 탈퇴 후 데이터는 어떻게 처리되나요?', a: '회원 탈퇴 시 개인정보 및 상담 기록은 관련 법령에 따른 보관 기간 경과 후 완전히 삭제됩니다. 탈퇴는 마이페이지에서 간편하게 진행할 수 있습니다.' },
                    ];
                    const visibleItems = faqExpanded ? faqItems : faqItems.slice(0, 6);
                    return visibleItems.map((item, idx) => {
                      const isOpen = faqOpenId === idx;
                      return (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
                          <button
                            onClick={() => setFaqOpenId(isOpen ? null : idx)}
                            className="w-full px-5 py-4 md:py-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-white/5 transition-colors"
                          >
                            <span className="font-bold text-base md:text-lg text-white">{item.q}</span>
                            <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-5 text-sm md:text-base text-slate-300 leading-relaxed animate-slideDown border-t border-white/10 pt-4">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                {!faqExpanded && (
                  <div className="mt-6 text-center">
                    <a
                      href="/faq"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all cursor-pointer active:scale-[0.98] border border-white/10"
                    >
                      더보기
                    </a>
                  </div>
                )}
                <div className="mt-10 bg-white/5 border border-white/10 rounded-xl p-6 text-center space-y-3">
                  <p className="text-sm md:text-base text-slate-400 font-medium">원하시는 답변을 찾지 못하셨나요?</p>
                  <button
                    onClick={() => setShowInquiryPopup(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/20 text-white hover:bg-white/10 font-bold rounded-xl text-sm transition-all whitespace-nowrap cursor-pointer active:scale-[0.98]"
                  >
                    <HelpCircle className="w-4 h-4" />
                    1:1 고객 문의하기
                  </button>
                </div>
              </div>
            </section>

            {/* ── Sector 9: 법률 정보 (어드민에서 노출 설정) ─────────────────────── */}
            {platformConfig.showLegalNews && (
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
                  <BookOpen className="w-5 h-5 text-[#1E3A5F]" />
                  <span>알아두면 좋을 법률 정보</span>
                  <ChevronRight className="w-4 h-4 text-[#7e7e8f] transition-transform group-hover:translate-x-1" />
                </h3>
                <span className="text-sm text-[#3B82F6] font-bold hover:underline shrink-0">
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
                        <span className={`absolute top-3.5 left-3.5 text-xs font-bold px-2.5 py-0.5 rounded-full text-white shadow-sm ${
                          art.badge === 'HOT' ? 'bg-[#0D9488]' :
                          art.badge === 'NEW' ? 'bg-[#1E3A5F]' : 'bg-[#0F766E]'
                        }`}>
                          {art.badge}
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                          <span>{art.category}</span>
                          <span>•</span>
                          <span>조회 {art.views}</span>
                        </div>
                        <h4 className="font-bold text-base text-slate-900 pr-2 leading-snug line-clamp-2 min-h-[38px] group-hover:text-[#3B82F6] transition-colors text-left">
                          {art.title}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 text-left">
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
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">By {art.authorName}</span>
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
            )}

            {/* ── Final CTA Banner (풀위드) ─────────────── */}
            <section className="w-full bg-gradient-to-r from-[#0F2440] via-[#1E3A5F] to-[#0F2440] py-12 md:py-16">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
                <div className="w-14 h-14 mx-auto bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug">
                  기록이나 노출 걱정 없이,<br />안전하게 내 채무 상황부터 진단해 보세요
                </h3>
                <button
                  onClick={() => {
                    setRequestType('open');
                    setRequestStep(1);
                    setActiveTab('request');
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-100 text-[#0F2440] font-extrabold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-lg"
                >
                  🔍 익명으로 내 상황 체크하기
                </button>
              </div>
            </section>
          </div>

        )}
 
 

 
 
        {activeTab !== 'landing' && (
        <div className={`w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${activeTab === 'request' ? 'py-0 px-0 md:py-6 md:px-4' : 'py-6'}`}>
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
                    <div className="w-16 h-16 mx-auto bg-[#EEF4FA] rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-[#1E3A5F]" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">아직 확인 내역이 없습니다</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      "내 채무 상황 체크하기"를 통해 나의 채무 현황을 확인해 보세요.
                    </p>
                    <button
                      onClick={() => setActiveTab('request')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-lg transition-all"
                    >
                      채무 상황 체크하기
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
                    localStorage.removeItem('legal_crm_inquiries');
                    localStorage.removeItem('legal_crm_client_alias');
                    localStorage.removeItem('lawyer_favorites');
                    localStorage.removeItem('legal_crm_appointed_lawyer_id');
                    localStorage.removeItem('legal_crm_requests');
                    localStorage.removeItem('legal_crm_messages');
                    
                    // 로컬 상태만 초기화 (Supabase 데이터는 보존 - 다시 로그인하면 복원됨)
                    setRequests([]);
                    setMessages([]);
                    setInquiries([]);
                    
                    setShowLogoutSuccessModal(true);
                    setActiveTab('landing');
                  }}
                />
              </div>
            )}

            {/* TAB: 내 관리방 (3-Zone: 채무대시보드 + 변호사선택 + 채팅) */}
            {activeTab === 'chat' && (
              !isLoggedIn ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">내 관리방</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
                    채무 상황 확인을 먼저 진행하시면 나의 채무 현황, 변호사 선택, 1:1 상담을 한 곳에서 관리할 수 있습니다.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowAuthModal(true)} className="px-6 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-lg text-sm transition-all cursor-pointer">로그인 / 회원가입</button>
                    <button onClick={handleStartDiagnosisClick} className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-sm transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">내 상황 체크하기</button>
                  </div>
                </div>
              ) : (
                <ChatView 
                  requests={clientRequests} messages={messages} activeChatReqId={activeChatReqId} chatInput={chatInput}
                  phoneConsultNum={phoneConsultNum} useSafeNumber050={useSafeNumber050} isLoggedIn={isLoggedIn} userAlias={userAlias}
                  debtBanks={debtBanks} debtCards={debtCards} debtPersonals={debtPersonals}
                  onSetActiveChatReqId={setActiveChatReqId} onSetChatInput={setChatInput} onSetPhoneConsultNum={setPhoneConsultNum}
                  onSetUseSafeNumber050={setUseSafeNumber050} onSetActiveTab={setActiveTab} onSetRequests={setRequests}
                  onSendChat={handleSendChat} onAddMessage={onAddMessage}
                  activeRequest={activeRequest} activeResult={activeResult} onUpdateFinancialProfile={handleUpdateFinancialProfile}
                  setUserAlias={setUserAlias} isEditingAlias={isEditingAlias} setIsEditingAlias={setIsEditingAlias}
                  tempAlias={tempAlias} setTempAlias={setTempAlias}
                  lawyers={mockLawyers}
                  initialModalTrigger={chatModalTrigger}
                  onClearModalTrigger={() => setChatModalTrigger(null)}
                  showDiagnosisReport={platformConfig.showDiagnosisReport}
                />
              )
            )}

            {/* TAB: LEGAL NEWS & TIPS BOARD */}
            {activeTab === 'news' && (<NewsView newsArticles={newsArticles} onSelectArticle={(art) => setSelectedArticle(art)} onUpdateViews={(id) => setNewsArticles(prev => prev.map(x => x.id === id ? {...x, views: x.views+1} : x))} />)}


            {/* TAB: LIVE Q&A CASE STUDIES */}
            {activeTab === 'qna' && (<QnAView qas={qas} setQas={setQas} onConsultRequest={(t,c) => { setTitle(t); setContent(c); setRequestStep(3); setActiveTab('request'); }} initialCategory={initialQnACategory || undefined} />)}

            {/* TAB 1-B: NOTICES TAB */}
            {activeTab === 'notices' && (<NoticesView notices={notices} selectedNoticeId={selectedNoticeId} onSetSelectedNoticeId={setSelectedNoticeId} onGoHome={() => setActiveTab('landing')} />)}

            {/* TAB: COMPANY INTRO */}
            {activeTab === 'company' && (<React.Suspense fallback={null}><CompanyView onNavigate={(tab) => { setActiveTab(tab as any); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></React.Suspense>)}

            {/* TAB: USAGE GUIDE */}
            {activeTab === 'guide' && (<React.Suspense fallback={null}><GuideView onNavigate={(tab) => { setActiveTab(tab as any); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></React.Suspense>)}


            {/* TAB 2: HIGH-FIDELITY CUSTOMER INTAKE SCREEN */}
            {activeTab === 'request' && (
              <div className="animate-fadeIn w-full max-w-4xl mx-auto h-[var(--chatbot-vh,100dvh)] md:h-[600px] bg-slate-900 border-0 md:border md:border-slate-800 rounded-none md:rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">
                {/* 채무정보 정리 목적 고지 */}
                <div className="px-4 py-2.5 bg-blue-950/40 border-b border-blue-800/30 shrink-0">
                  <p className="text-xs sm:text-sm text-blue-300 font-medium leading-relaxed">
                    ℹ️ 본 기능은 채무·소득·지출 정보를 정리하는 도구이며, 법률 자문을 제공하지 않습니다. 법률적 판단은 전문가 상담이 필요합니다.
                  </p>
                </div>
                {/* 동적 안내 메시지 (RemedyModal에서 진입 시) */}
                {chatbotAnnouncement && (
                  <div className="px-4 py-3 bg-emerald-950/40 border-b border-emerald-800/30 shrink-0 flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-xs sm:text-sm text-emerald-300 font-bold leading-relaxed whitespace-pre-line flex-1">
                      {chatbotAnnouncement}
                    </p>
                    <button onClick={() => setChatbotAnnouncement(null)} className="text-emerald-500 hover:text-emerald-300 shrink-0 p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                <AIRehabChatbotV2
                  isOpen={true}
                  disablePortal={true}
                  showDiagnosisReport={platformConfig.showDiagnosisReport}
                  onClose={() => {
                    if (pendingChatbotData) {
                      const mappedData = mapChatbotDataToIntakeData(pendingChatbotData.res, pendingChatbotData.input);
                      setPendingChatbotData(null);
                      handleIntakeSubmit(mappedData, false);
                    }
                    setActiveTab('landing');
                  }}
                  onComplete={(res, input) => {
                    setPendingChatbotData({ res, input });
                    // 진단 완결 즉시 requests 및 localStorage에 자동 저장 (내 관리방 채무 현황 연동)
                    const mappedData = mapChatbotDataToIntakeData(res, input);
                    handleIntakeSubmit(mappedData, false);
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
                  onConsultation={() => {
                    // 좋아요 변호사 확인 (무료 상담 변호사 수임하기 플로우)
                    const FAVORITES_KEY = 'lawyer_favorites';
                    let favIds: string[] = [];
                    try { favIds = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { /* ignore */ }
                    if (favIds.length > 0) {
                      setChatModalTrigger('fav');
                    } else {
                      setChatModalTrigger('no_fav');
                    }
                    setActiveTab('chat');
                  }}
                />
                </div>
              </div>
            )}

            {/* TAB 3: LAWYER BROWSER (DIRECTORY OF LAWYERS) */}
            {activeTab === 'lawyers' && (<LawyersView lawyers={mockLawyers} onSelectLawyer={(lawyerId) => { const l = mockLawyers.find(x => x.id === lawyerId); if(l) setTitle(l.name+' 변호사 전담 상담 요청'); setSelectedLawyerId(lawyerId); setRequestType('direct'); setActiveTab('request'); }} selectionMode={lawyerSelectionMode} maxSelections={3} onConfirmSelection={(ids) => { handleConfirmLawyerSelection(ids); }} hasCompletedCheck={!!activeResult} onStartCheck={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} />)}



          </React.Suspense>
        </div>
        )}

      </main>




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
            onClose={() => { setShowAuthModal(false); setPendingDiagnosisAfterLogin(false); }} 
            onLoginSuccess={(alias,ep,ch) => { 
              setIsLoggedIn(true); 
              setUserAlias(alias); 
              setShowAuthModal(false); 
              recordClientLogin(alias,ep,ch); 
              // 진단 목적으로 로그인했으면 진단 페이지로 이동, 아니면 내 관리방으로
              if (pendingDiagnosisAfterLogin) {
                setPendingDiagnosisAfterLogin(false);
                // 로그인 후 기존 진단 데이터 체크
                const hasData = requests.length > 0 && requests.some(r => r.financialProfile);
                if (hasData) {
                  setShowResetDiagnosisModal(true);
                } else {
                  forceStartNewDiagnosis();
                }
              } else {
                setActiveTab('chat');
              }
            }} 
          />
        </React.Suspense>
      )}

      <MobileGNB activeTab={activeTab} onSetActiveTab={setActiveTab} onRequestConsult={handleStartDiagnosisClick} onStartDiagnosis={handleStartDiagnosisClick} onNavigateToLawyers={() => { setActiveTab('lawyers'); }} onNavigateToQna={() => { setActiveTab('qna'); onLogActivity('client-temp', '익명 의뢰인', 'CLIENT', 'QNA_BROWSE', 'GNB [고민상담 Q&A] 메뉴 클릭'); }} isHidden={isChatbotActive || isGnbHidden} />

      {activeRemedyCategory && remedyData[activeRemedyCategory] && (
        <React.Suspense fallback={null}>
          <RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} onViewCases={handleViewSimilarCases} />
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
                setTitle(l.name + ' 변호사 전담 상담 요청');
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
          viewerRole="client"
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

      {/* 1:1 고객 문의 팝업 모달 */}
      {showInquiryPopup && (
        <React.Suspense fallback={null}>
          <InquiryPopupModal
            isOpen={showInquiryPopup}
            onClose={() => setShowInquiryPopup(false)}
            inquiries={inquiries}
            setInquiries={setInquiries}
            isLoggedIn={isLoggedIn}
            userAlias={userAlias}
            onNavigateToQnA={() => { setActiveTab('qna'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onNavigateToLawyers={() => { setActiveTab('lawyers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </React.Suspense>
      )}

      {/* 기존 확인 데이터 존재 시 재확인 커스텀 모달 */}
      {showResetDiagnosisModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            style={{ animation: 'slideUp 0.3s ease-out forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 그라데이션 헤더 */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-white font-extrabold text-base">기존 확인 정보가 있습니다</h3>
            </div>

            {/* 본문 */}
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                이미 입력된 내 상황 체크 정보가 있습니다.<br />
                <strong className="text-slate-900 dark:text-white">새로 진행하시겠습니까?</strong>
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-left">
                <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5 leading-relaxed font-semibold">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>새로 진행하면 기존에 입력한 채무 및 자산 확인 데이터가 모두 초기화되어 삭제됩니다.</span>
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetDiagnosisModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetDiagnosisModal(false);
                  forceStartNewDiagnosis();
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                새로 체크 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로그아웃 완료 커스텀 모달 */}
      {showLogoutSuccessModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            style={{ animation: 'slideUp 0.3s ease-out forwards' }}
          >
            {/* 상단 그라데이션 헤더 */}
            <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-white font-extrabold text-base">안전하게 로그아웃되었습니다</h3>
            </div>

            {/* 본문 */}
            <div className="p-5 text-center space-y-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 text-left space-y-1.5">
                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>개인 체크 및 상담 기록이 완전히 초기화되었습니다</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>브라우저에 저장된 모든 데이터가 안전하게 삭제되었습니다</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>다른 사람이 이 기기를 사용해도 안전합니다</span>
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowLogoutSuccessModal(false)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
