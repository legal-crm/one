import React from 'react';
import type { ClientQA, NewsArticle, SuccessReview } from '../../../types';
import type { SolutionType } from '../SolutionDetailModal';
import type { RemedyInfo } from '../remedyData';
import HeroSection from './HeroSection';
import ServiceGuideSection, { TrustFactsBar } from './ServiceGuideSection';
import SituationSection from './SituationSection';
import ShowcaseAdSection from './ShowcaseAdSection';
import CasesSection from './CasesSection';
import LegalNewsSection from './LegalNewsSection';
import FaqSection from './FaqSection';
import FinalCtaSection from './FinalCtaSection';

/**
 * 고객 사이트 홈(랜딩) — 11개 섹션을 7개로 정리 (docs/mykim_client_ui_upgrade_plan.md 2-1)
 * 1 Hero → 2 이용 4단계 → 3 이용 조건 바 → 4 상황별·제도별 정보 → (DEV 광고) → 5 상담 사례·후기
 * → (법률 정보: 관리자 설정 시) → 6 FAQ → 7 마지막 CTA
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
}

export default function LandingView(props: LandingViewProps) {
  const {
    qas, reviews, newsArticles, showLegalNews, remedies, maxLawyerSelections,
    onStartCheck, onBrowseLawyers, onSelectRemedy, onSelectSolution, onConsultFromQa,
    onViewAllQna, onViewAllReviews, onViewAllNews, onOpenArticle, onOpenLawyerProfile, onOpenInquiry,
  } = props;

  return (
    <div className="text-left">
      <HeroSection onStartCheck={onStartCheck} onBrowseLawyers={onBrowseLawyers} />
      <ServiceGuideSection maxLawyerSelections={maxLawyerSelections} onStartCheck={onStartCheck} onBrowseLawyers={onBrowseLawyers} />
      <TrustFactsBar maxLawyerSelections={maxLawyerSelections} />
      <SituationSection remedies={remedies} onSelectRemedy={onSelectRemedy} onSelectSolution={onSelectSolution} />
      <ShowcaseAdSection onOpenLawyerProfile={onOpenLawyerProfile} />
      <CasesSection qas={qas} reviews={reviews} onConsultFromQa={onConsultFromQa} onViewAllQna={onViewAllQna} onViewAllReviews={onViewAllReviews} />
      {showLegalNews && <LegalNewsSection articles={newsArticles} onOpenArticle={onOpenArticle} onViewAll={onViewAllNews} />}
      <FaqSection onOpenInquiry={onOpenInquiry} />
      <FinalCtaSection onStartCheck={onStartCheck} />
    </div>
  );
}
