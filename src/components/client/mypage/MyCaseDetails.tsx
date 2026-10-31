import type { MyPageModel } from './useMyPageModel';
import { buildMyCaseData } from './myCaseData';
import FinancialBlueprintCard from './FinancialBlueprintCard';
import CaseProgressCard from './CaseProgressCard';
import DocumentSubmissionCard from './DocumentSubmissionCard';
import ContractCard from './ContractCard';
import CertificateVaultCard from './CertificateVaultCard';
import CaseActivityTimeline from './CaseActivityTimeline';

/**
 * 마이페이지 내 사건 탭 상세 (재정 요약 · 사건 진행 · 서류 제출 · 계약·수임료 · 인증서 금고)
 * 이전: MyPageView JSX 안의 즉시 실행 함수(약 1,250줄)
 */
export default function MyCaseDetails({ vm }: { vm: MyPageModel }) {
  // 사무소가 공유한 진행 상태·서류 요청은 useMyPageModel이 서버(client_case_view)에서 받아 온다 (MY-10)
  const cd = buildMyCaseData(vm);
  return (
    <div className="space-y-8">
      {/* ── Pillar 1: 나의 가계 재정 & 채무 진단서 원안 (My Financial Blueprint) ── */}
      <FinancialBlueprintCard vm={vm} />

      {/* ── Pillar 2: 내 사건 진행상황 & 법원 제출 필수 서류함 (Document Vault) ── */}
      <div className="space-y-6">
        {/* 1. 사건 진행상황 트래커 (13단계 파이프라인 & 5대 실무 안심 허브) */}
        <CaseProgressCard vm={vm} cd={cd} />

        {/* 2. 필수 서류 제출 */}
        <DocumentSubmissionCard vm={vm} cd={cd} />

        {/* v2.0: 3. 사건 활동 타임라인 */}
        <CaseActivityTimeline vm={vm} />
      </div>

      {/* ── Pillar 3: 정식 수임계약서 및 수임료 보관함 (Contract & Fee Vault) ── */}
      <div className="space-y-6">
        {/* 공인 전자계약서 카드 */}
        <ContractCard vm={vm} />

        {/* 수임료 납부 현황은 위 '사무소가 기록한 진행 상황' 사건 카드에서 서버 기록으로 보여 준다 (이전: 이 기기 사본) */}

        {/* 🔐 의뢰인 공동인증서·금융인증서 안전 금고 (Zero-Knowledge E2EE) */}
        <CertificateVaultCard vm={vm} />
      </div>
    </div>
  );
}
