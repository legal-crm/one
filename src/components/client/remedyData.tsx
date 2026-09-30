import React from 'react';
import {
  AlertTriangle, CalendarCheck, DollarSign, FileCheck2, HeartHandshake, Landmark, Receipt, Scale, ShieldCheck,
  Smartphone, TrendingDown, UserCheck, Users,
} from 'lucide-react';
import type { SolutionType } from './SolutionDetailModal';

/**
 * 랜딩 '상황별 채무 정보'와 RemedyModal이 함께 쓰는 상황별 일반 정보.
 * (ClientRole.tsx에서 분리. preset 값은 구버전 입력 폼용이며 현재 챗봇에는 전달되지 않는다.)
 */

// SolutionDetailModal의 SolutionType 키와 1:1 매칭되는 진입 카테고리 라벨
export const SOLUTION_LABELS: Record<SolutionType, string> = {
  rehab: '개인회생',
  bankruptcy: '개인파산',
  credit: '신용회복',
  representation: '채무자대리',
  tax: '세금체납',
};

/** 랜딩 '제도별로 보기' 목록 (SolutionDetailModal로 연결) */
export const SOLUTION_ITEMS: { type: SolutionType; icon: React.ElementType }[] = [
  { type: 'rehab', icon: CalendarCheck },
  { type: 'bankruptcy', icon: FileCheck2 },
  { type: 'credit', icon: HeartHandshake },
  { type: 'representation', icon: UserCheck },
  { type: 'tax', icon: Receipt },
];

export interface RemedyPreset {
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

export interface RemedyInfo {
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

export const remedyData: Record<string, RemedyInfo> = {
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

export const renderRemedyIcon = (iconName: string, className = "w-6 h-6") => {
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
