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
  thresholdCount: number;           // 기준금액(30만/50만 등) 초과 건수
  thresholdAmount: number;          // 기준금액 초과 총액
  resolvedCount: number;            // 소명 완료 건수
  unresolvedCount: number;          // 소명 미완료 건수
  resolvedRate: number;             // 소명 완료율 (%)
  dangerCount: number;              // 고위험(사행성/사치) 건수
  cautionCount: number;             // 주의(현금인출/편파변제) 건수
}
