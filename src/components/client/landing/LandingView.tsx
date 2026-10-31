import React from 'react';
import type { ClientQA, MainBanner, NewsArticle, SuccessReview } from '../../../types';
import type { SolutionType } from '../SolutionDetailModal';
import type { RemedyInfo } from '../remedyData';
import HeroSection from './HeroSection';
import ServiceGuideSection, { TrustFactsBar } from './ServiceGuideSection';
import SituationSection from './SituationSection';
import CasesSection from './CasesSection';
import LegalNewsSection from './LegalNewsSection';
import FaqSection from './FaqSection';
import FinalCtaSection from './FinalCtaSection';
import LawyerIntroSection from './LawyerIntroSection';
import type { User } from '../../../types';
// 계산 엔진이 커서 계산기를 켰을 때만 불러온다
const QuickCalcSection = React.lazy(() => import('./QuickCalcSection'));
import type { PublicCalcInput } from '../../../services/repayment/publicCalculator';

/**
 * 고객 사이트 홈(랜딩) — 11개 섹션을 7개로 정리 (docs/mykim_client_ui_upgrade_plan.md 2-1)
 * 1 Hero(오른쪽 슬라이더: 서비스 약속·브랜드 배너·메인 배너 광고) → 2 이용 4단계 → 3 이용 조건 바 → 4 상황별·제도별 정보
 * → 5 상담 사례·후기 → (법률 정보: 관리자 설정 시) → 6 FAQ → 7 마지막 CTA
 * (이전 '프리미엄 광고' 섹션은 DEV 시드만 보였다 → 승인된 광고 소재가 Hero 슬라이더에 나온다)
 */
export interface LandingViewProps {
  qas: ClientQA[];
  reviews: SuccessReview[];
  newsArticles: NewsArticle[];
  showLegalNews: boolean;
  remedies: RemedyInfo[];
  maxLawyerSelections: number;
  onStartCheck: () => void;
  onBrowseLawyers: () => void;
  onSelectRemedy: (remedyId: string) => void;
  onSelectSolution: (type: SolutionType) => void;
  onConsultFromQa: (qa: ClientQA) => void;
  onViewAllQna: () => void;
  onViewAllReviews: () => void;
  onViewAllNews: () => void;
  onOpenArticle: (article: NewsArticle) => void;
  onOpenLawyerProfile: (lawyerId: string) => void;
  onOpenInquiry: () => void;
  /** 통합어드민이 게시한 브랜드 배너 (CT-5) */
  banners?: MainBanner[];
  /** 통합어드민 '기능 표시'에서 계산기를 켰을 때만 홈 빠른 계산기 (1-G) */
  calculatorVisible?: boolean;
  onOpenCalculator?: (seed: Partial<PublicCalcInput>) => void;
  /** 공개 변호사 목록 — 홈 '등록 변호사' 띠 (AD-4) */
  lawyers?: User[];
}

export default function LandingView(props: LandingViewProps) {
  const {
    qas, reviews, newsArticles, showLegalNews, remedies, maxLawyerSelections,
    onStartCheck, onBrowseLawyers, onSelectRemedy, onSelectSolution, onConsultFromQa,
    onViewAllQna, onViewAllReviews, onViewAllNews, onOpenArticle, onOpenLawyerProfile, onOpenInquiry,
    banners = [], calculatorVisible = false, onOpenCalculator, lawyers = [],
  } = props;

  return (
    <div className="text-left">
      <HeroSection onStartCheck={onStartCheck} onBrowseLawyers={onBrowseLawyers} banners={banners} onOpenLawyerProfile={onOpenLawyerProfile} showCalcLink={calculatorVisible && !!onOpenCalculator} />
      <ServiceGuideSection maxLawyerSelections={maxLawyerSelections} onStartCheck={onStartCheck} onBrowseLawyers={onBrowseLawyers} />
      <TrustFactsBar maxLawyerSelections={maxLawyerSelections} />
      <LawyerIntroSection lawyers={lawyers} onOpenLawyerProfile={onOpenLawyerProfile} onBrowseLawyers={onBrowseLawyers} />
      {calculatorVisible && onOpenCalculator && (
        <React.Suspense fallback={<div className="h-96 bg-white border-t border-slate-100" aria-hidden="true" />}>
          <QuickCalcSection onOpenFull={onOpenCalculator} onStartCheck={onStartCheck} />
        </React.Suspense>
      )}
      <SituationSection remedies={remedies} onSelectRemedy={onSelectRemedy} onSelectSolution={onSelectSolution} />
      <CasesSection qas={qas} reviews={reviews} onConsultFromQa={onConsultFromQa} onViewAllQna={onViewAllQna} onViewAllReviews={onViewAllReviews} />
      {showLegalNews && <LegalNewsSection articles={newsArticles} onOpenArticle={onOpenArticle} onViewAll={onViewAllNews} />}
      <FaqSection onOpenInquiry={onOpenInquiry} />
      <FinalCtaSection onStartCheck={onStartCheck} />
    </div>
  );
}
