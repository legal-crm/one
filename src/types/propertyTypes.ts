/**
 * 대법원 공식 [전산양식 D5102] 개인회생 재산목록 및
 * 신우법무사 기준 11대 자산 평가 가치 산정 데이터 타입 정의
 */
import { RegionType } from '../services/repayment/repaymentConstants2026';

// ── 1. 부동산 항목 (아파트/오피스텔, 빌라, 주택, 토지, 상가) ──
export type RealEstateType = 
  | 'apartment_officetel' // 아파트·오피스텔 (KB시세 일반가)
  | 'villa_multi'          // 연립·다세대(빌라) (공동주택공시가격 × 130%)
  | 'detached_house'       // 단독·다가구 (개별단독주택가격 × 130%)
  | 'land'                 // 토지 (개별공시지가 × 130%)
  | 'commercial';          // 상가 (실거래가 / 감정가)

export type RealEstateValuationMethod = 
  | 'kb_general'           // KB부동산 시세 일반평균가
  | 'public_price_130'     // 공시가격 × 130%
  | 'actual_trade'         // 국토부 실거래가
  | 'appraisal';           // 감정평가 또는 경매낙찰가율

export interface RealEstateItem {
  id: string;
  type: RealEstateType;
  address: string;                         // 소재지
  detailAddress?: string;                  // 동·호수 등
  areaSquareMeter?: number;                // 전용/대지면적 (㎡)
  valuationMethod: RealEstateValuationMethod; // 평가 방법
  officialPublicPrice?: number;            // 국토부 공시가격 (원)
  marketValue: number;                     // 산정 시세 / 평가액 (공시가격 130% 등)
  mortgageBalance: number;                 // 담보대출 잔액 (근저당 피담보채무)
  maxClaimAmount?: number;                 // 근저당 채권최고액
  liquidationValue: number;                // 청산가치 = max(0, 시가 - 담보대출)
  ownerType: 'self' | 'spouse' | 'joint';  // 소유 관계
  shareRatio: number;                      // 지분 비율 (0.0 ~ 1.0, 단독 1.0)
  note?: string;                           // 특이사항 (선순위 세입자 보증금 등)
}

// ── 2. 자동차 및 이륜차 ──
export type VehicleType = 'car' | 'motorcycle';

export interface VehicleItem {
  id: string;
  type: VehicleType;
  modelName: string;                       // 차종/모델명 (예: 아반떼 CN7)
  plateNumber: string;                     // 차량번호 (예: 12가 3456)
  year: number;                            // 연식 (예: 2022)
  valuationMethod: 'kidi' | 'used_avg' | 'passo'; // 보험개발원, 엔카평균, 파쏘
  marketValue: number;                     // 중고시세 또는 기준가액
  loanBalance: number;                     // 자동차 담보대출 (캐피탈 할부금 등)
  liquidationValue: number;                // 청산가치 = max(0, 시가 - 담보)
  ownerType: 'self' | 'spouse';
  note?: string;                           // 생계용 필수차량 여부 등
}

// ── 3. 임차보증금 반환채권 ──
export interface LeaseDepositItem {
  id: string;
  address: string;                         // 임차 주택/상가 주소
  depositAmount: number;                   // 계약서상 임차보증금
  unpaidRent: number;                      // 연체 차임 및 관리비
  pledgeLoanAmount: number;                // 질권설정 또는 양도담보 전세대출금
  region: RegionType;                      // 주임법 적용 지역
  statutoryExemption: number;              // 2026 소액임차보증금 최우선변제액
  liquidationValue: number;                // 청산가치 = max(0, 보증금 - 연체차임 - 질권대출 - 소액보증금)
  leaseType: 'housing' | 'commercial';     // 주거용 vs 상업용
  hasFixedDate: boolean;                   // 확정일자 유무
  note?: string;
}

// ── 4. 보험 해약환급금 ──
export interface InsuranceItem {
  id: string;
  companyName: string;                     // 보험사명 (예: 삼성생명)
  policyName: string;                      // 보험상품명
  policyNumber?: string;                   // 증권번호
  isSecurityInsurance: boolean;            // 보장성 보험 여부 (true시 150만원 공제)
  surrenderValue: number;                  // 예상 해약환급금 전액
  policyLoanBalance: number;               // 약관대출 잔액
  statutoryDeduction: number;              // 법정 압류금지 공제액 (최대 150만 원)
  liquidationValue: number;                // 청산가치 = max(0, 환급금 - 대출 - 공제액)
  note?: string;
}

// ── 5. 예상퇴직금 ──
export interface SeveranceItem {
  id: string;
  workplaceName: string;                   // 재직 직장명
  isRetirementPension: boolean;            // 퇴직연금(DB/DC/IRP) 여부 (true시 0원)
  expectedAmount: number;                  // 예상 퇴직금 총액
  statutoryDeduction: number;              // 법정 공제액 (연금 100%, 일반 50%)
  liquidationValue: number;                // 청산가치 = 일반: 50%, 연금: 0원
  note?: string;
}

// ── 6. 금융자산 (예금, 주식, 가상화폐, 기타 동산) ──
export type FinancialAssetCategory = 'deposit' | 'stock' | 'crypto' | 'cash' | 'receivable' | 'other';

export interface FinancialAssetItem {
  id: string;
  category: FinancialAssetCategory;
  institutionName: string;                 // 은행/증권사/거래소명
  description: string;                     // 계좌번호 또는 종목명
  marketValue: number;                     // 잔액 또는 평가액
  statutoryDeduction: number;              // 예금 250만원 한도 등 공제
  liquidationValue: number;                // 청산가치
  isLossExcluded?: boolean;                // 과거 주식/코인 손실금 청산가치 배제 특례 여부
  note?: string;
}

// ── 7. 사업용 설비, 대여금 채권, 외상매출금 채권 (리걸플로 7-4 그림 7-12) ──
export type BusinessAssetType = 'equipment' | 'loan_receivable' | 'sales_receivable';

export interface BusinessAssetItem {
  id: string;
  type: BusinessAssetType;
  name: string;                            // 설비명(기계/비품) 또는 채무자명/거래처명
  description?: string;                    // 품목 규격 또는 채권 발생 원인
  bookValue: number;                       // 취득가액 또는 장부상 채권액 (원)
  marketValue: number;                     // 감가상각 잔존가치 또는 실제 회수가능액 (원)
  encumbrance: number;                     // 양도담보/질권 등 담보설정액 (원)
  liquidationValue: number;                // 청산가치 = max(0, marketValue - encumbrance)
  recoveryStatus: 'normal' | 'doubtful' | 'uncollectible'; // 정상, 회수우려, 회수불능
  note?: string;                           // 소명 서류 (차용증, 세금계산서, 장부 등)
}

// ── 8. 채무자회생법 제383조 제2항 면제재산 신청 항목 (리걸플로 7-4 그림 7-13) ──
export type ExemptPropertyType = 'living_expense_383_2' | 'housing_deposit_383_1' | 'other';

export interface ExemptPropertyItem {
  id: string;
  type: ExemptPropertyType;
  appliedAmount: number;                   // 의뢰인 면제 신청 희망액 (최대 11,100,000원)
  approvedAmount?: number;                 // 변호사 검토 인정액
  description: string;                     // 신청 사유 (예: 6개월간 최저생계비 보호)
  note?: string;
}

// ── 9. 대법원 공식 [전산양식 D5102] 마스터 데이터 모델 ──
export interface PropertyListD5102Data {
  id: string;
  clientId: string;
  clientName: string;
  baseDate: string;                        // 작성 기준일 (YYYY-MM-DD)
  
  // 자산 범주별 목록
  realEstates: RealEstateItem[];           // 6. 부동산 (토지/건물)
  vehicles: VehicleItem[];                 // 4. 자동차 및 이륜차
  leaseDeposits: LeaseDepositItem[];       // 5. 임차보증금
  insurances: InsuranceItem[];             // 3. 보험 해약환급금
  severances: SeveranceItem[];             // 9. 퇴직금
  financialAssets: FinancialAssetItem[];   // 1. 현금, 2. 예금, 10. 주식/가상자산 등
  businessAssets?: BusinessAssetItem[];    // 7. 사업용 설비, 8. 대여금/매출채권
  exemptProperties?: ExemptPropertyItem[]; // 면제재산 (법 제383조 제2항)
  
  // 총괄 집계
  totalMarketValue: number;                // 자산 총 시가/평가액
  totalEncumbrance: number;                // 총 담보 채무 (근저당, 할부, 약관대출, 질권)
  totalStatutoryDeduction: number;         // 총 법정 공제액 (압류금지, 소액보증금, 퇴직금 50%, 면제재산)
  totalLiquidationValue: number;           // 최종 총 청산가치 (J)
  
  // 상태 및 의뢰인 제출 상태
  isCompleted: boolean;
  clientIntakeStatus?: 'draft' | 'submitted_to_lawyer' | 'reviewed_by_lawyer';
  clientSubmittedAt?: string;
  updatedAt: string;
  reviewedBy?: string;
}
