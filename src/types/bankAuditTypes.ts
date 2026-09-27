/**
 * 개인회생 1차 보정 통장 및 신용카드 거래내역 소명 자동화 데이터 타입 정의
 * 대법원 보정명령 실무준칙 및 회생위원 소명 지침 반영
 */

export type AuditRiskCategory = 
  | 'SAFE_LIVING'         // 필수 생활비 (식료품, 생필품, 마트)
  | 'SAFE_FIXED'          // 고정비/필수비용 (월세, 공과금, 병원비, 학비)
  | 'SAFE_DEBT'           // 기존 채무 변제/대환 (대출이자, 카드대금)
  | 'CAUTION_CASH'        // 불명 현금인출 (ATM, CD기, 창구) -> 청산가치 산입 위험
  | 'CAUTION_TRANSFER'    // 지인/가족 계좌이체 -> 편파변제 또는 차명 의심
  | 'DANGER_SPECULATION'  // 사행성 지출 (주식, 가상화폐/코인, 도박, 토토)
  | 'DANGER_LUXURY'       // 사치성 지출 (유흥주점, 명품, 골프, 피부/성형)
  | 'UNCATEGORIZED';      // 미분류

export type AuditTransactionType = 
  | 'WITHDRAWAL'   // 계좌 출금 및 계좌이체
  | 'DEPOSIT'      // 계좌 입금 (소득 은닉 검증용)
  | 'CARD_PAYMENT' // 신용/체크카드 승인 결제
  | 'ATM_CASH';    // CD/ATM 현금인출

export interface AuditTransactionItem {
  id: string;
  date: string;                     // 거래일자 (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm)
  bankOrCard: string;               // 금융기관명 (예: KB국민은행, 신한카드)
  accountNumberMasked?: string;     // 계좌번호/카드번호 뒷자리 마스킹
  transactionType: AuditTransactionType;
  counterparty: string;             // 적요 / 상대방 / 가맹점명
  amount: number;                   // 출금/결제/입금 금액 (원)
  balance?: number;                 // 거래 후 잔액
  riskCategory: AuditRiskCategory;
  riskBadgeText: string;            // 시각적 뱃지 텍스트 (예: 사행성(코인), 편파변제주의 등)
  riskAdvice?: string;              // 법원 실무 대응 권고사항
  explanation: string;              // 의뢰인/변호사 작성 구체적 사용처 소명
  evidenceType?: string;            // 첨부 증빙자료 (영수증, 진단서, 차용증, 이체증 등)
  isResolved: boolean;              // 소명 작성 완료 여부
  evidenceDocIndex?: string;        // 소갑 제O호증 (예: "소갑 제4호증의 1")
  status?: 'draft' | 'submitted' | 'lawyer_approved'; // 협업 상태
  clientNote?: string;              // 고객 비고/메모
  lawyerReviewNote?: string;        // 변호사 검토 의견
}

export interface AuditPresetTemplate {
  id: string;
  category: AuditRiskCategory;
  name: string;                     // 템플릿명 (예: 식비 및 생필품)
  icon: string;                     // 이모지 아이콘
  templateText: string;             // 표준 소명 문구
  suggestedEvidence: string;        // 추천 증빙
}

export interface AuditSummaryStats {
  totalCount: number;
  totalAmount: number;
  thresholdCount: number;           // 기준금액(30만/50만/100만 등) 초과 건수
  thresholdAmount: number;          // 기준금액 초과 총액
  resolvedCount: number;            // 소명 완료 건수
  unresolvedCount: number;          // 소명 미완료 건수
  resolvedRate: number;             // 소명 완료율 (%)
  dangerCount: number;              // 고위험(사행성/사치) 건수
  cautionCount: number;             // 주의(현금인출/편파변제) 건수
}

/** 100만 원 이상 금융거래 소명표 전체 데이터셋 모델 */
export interface BankStatementAuditData {
  id: string;
  clientId: string;
  clientName: string;
  caseNumber?: string;
  courtName?: string;
  thresholdAmount: number;          // 기준 금액 (기본 1,000,000원)
  items: AuditTransactionItem[];
  stats: AuditSummaryStats;
  status: 'draft' | 'submitted' | 'lawyer_approved';
  clientSubmittedAt?: string;
  lawyerReviewedAt?: string;
  lastUpdatedAt: string;
}

// ═══════════════════════════════════════════════
// 사전 리스크 탐지 (보정 예방 시스템) 타입 정의
// ═══════════════════════════════════════════════

/** 리스크 탐지 항목 유형 */
export type RiskDetectionType =
  | 'LOAN_FLOW'           // 대출금 입금 후 자금 흐름 추적
  | 'LARGE_WITHDRAWAL'    // 대액 출금 (100만원+ 기본)
  | 'FAMILY_TRANSFER'     // 친인척 이체 (편파변제 의심)
  | 'SPECULATION'         // 사행성 지출 (주식·코인·도박)
  | 'LUXURY_SPENDING'     // 사치성 소비 (명품·유흥·골프)
  | 'CASH_ADVANCE'        // 현금서비스·카드론 입금 패턴
  | 'UNEXPLAINED_INCOME'; // 급여 외 정기 입금원

/** 개별 리스크 탐지 결과 */
export interface RiskDetectionItem {
  id: string;
  type: RiskDetectionType;
  level: 'HIGH' | 'MEDIUM';        // 🔴 HIGH / ⚠️ MEDIUM
  title: string;                    // "편파변제 의심 — 소명 필수"
  message: string;                  // 변호사 안내 메시지 상세
  transactions: AuditTransactionItem[];  // 해당 거래 목록
  totalAmount: number;              // 합산 금액
  suggestedAction: string;          // 권장 조치 (소명서 준비 등)
  suggestedEvidence: string;        // 권장 증빙 자료
  /** 대출금 추적 시: 원인이 된 대출 입금 건 */
  sourceLoanTransaction?: AuditTransactionItem;
}

/** 리스크 탐지 리포트 요약 */
export interface RiskReportSummary {
  totalTransactions: number;        // 전체 거래 수
  analyzedPeriod: string;           // 분석 기간 (예: "2025-09 ~ 2026-09")
  flaggedCount: number;             // 플래그된 거래 수
  highRiskCount: number;            // 🔴 높은 위험
  mediumRiskCount: number;          // ⚠️ 중간 위험
  highRiskAmount: number;           // 🔴 합산 금액
  mediumRiskAmount: number;         // ⚠️ 합산 금액
  estimatedCorrectionItems: number; // 예상 보정권고 항목 수
}

/** 전체 리스크 리포트 */
export interface PreFilingRiskReport {
  clientId: string;
  clientName: string;
  generatedAt: string;
  summary: RiskReportSummary;
  risks: RiskDetectionItem[];
  /** 보정 예방 권고 메시지 (변호사 대시보드 표시용) */
  overallAdvice: string;
}
