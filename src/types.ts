export interface Client {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  consentFlag: boolean;
}

export interface FinancialProfile {
  clientId: string;
  income: number;      // Monthly income in ten thousand KRW (만 원)
  debtTotal: number;   // Total debt in ten thousand KRW (만 원)
  assetsTotal: number; // Total assets in ten thousand KRW (만 원)
  dependents: number;  // Number of dependents (명)
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED';
  debtTypes: {
    banks: number;
    cards: number;
    personals: number;
    recentLoans: number; // Recent high-risk loans (최근 대출)
    coinCrypto: number;  // Cod/Coin/Stock losses (코인/주식 손실)
  };
  riskFlags: string[]; // ['최근 1년 이내 대출 과다', '사행성 채무(코인/토토)', '소득 대비 과다 채무']
  
  // New Individual Rehabilitation Fields
  jobType?: 'SALARIED' | 'BUSINESS' | 'DAILY' | 'FREELANCER';
  companyName?: string;
  companyNameMasked?: string;
  employmentDate?: string;
  residenceRegion?: string;
  spouseAsset?: number;
  spouseIncome?: number;
  hasRecentJobChange?: boolean;
  rentalDeposit?: number;
  debtCause?: 'LIVING' | 'BUSINESS' | 'INVESTMENT' | 'GUARANTEE' | 'GAMBLING' | 'OTHER';
  harassmentLevel?: 'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE';
  creditorCount?: number;
  speculativeLoss?: number; // 1년 이내 투자 손실 (만 원 단위)
  gamblingLoss?: number;    // 1년 이내 도박 채무 (만 원 단위)
  legalActions?: string[];
  retirementPensionType?: 'pension' | 'none' | 'unknown';
  retirementPay?: number;   // 예상 퇴직금 (만 원 단위)
  priorityDebt?: number;    // 우선변제채무 (만 원 단위)

  // ── 챗봇 수집 항목 완전 동기화 필드 ──
  age?: number;             // 나이 (24개월 특례 확인용)
  employmentType?: 'salary' | 'business' | 'freelancer' | 'both' | 'none' | 'daily'; // 고용 형태
  minorChildren?: number;   // 미성년 자녀 수
  childSupportReceived?: number; // 양육비 수령액 (이혼 시)
  childSupportPaid?: number;     // 양육비 지급액 (이혼 시)
  rentCost?: number;        // 월세 (만 원)
  depositLoan?: number;     // 보증금 대출 (만 원)
  medicalCost?: number;     // 월 의료비 (만 원)
  educationCost?: number;   // 월 교육비 (만 원)
  specialEducationCost?: number; // 월 특수교육비 (만 원)
  myAssets?: number;        // 본인 재산 총액 (만 원)
  specialCondition?: 'none' | 'basic_recipient' | 'severe_disability' | 'elderly'; // 24개월 특례
  monthlyFixedExpenses?: number; // 월 고정지출 (통신비, 보험료 등)
  address?: string;         // 거주지 주소
  workLocation?: string;    // 근무지/사업장 주소
  clientName?: string;      // 고객명
  clientPhone?: string;     // 연락처
  housingContractHolder?: 'self' | 'spouse' | 'others'; // 주택 계약 명의자
  housingType?: 'rent' | 'jeonse' | 'owned' | 'free'; // 거주 형태
}

export type RequestType = 'direct' | 'open' | 'direct_multi';
export type ConsultStatus = 'requested' | 'responding' | 'counseling' | 'closed';

// ── CRM 업그레이드 타입 ──

// 8단계 진행 파이프라인
export type CrmStatus = 
  | 'requested'    // 📋 상담 신청
  | 'consulting'   // 📞 초기 상담
  | 'contracted'   // 📝 수임 계약
  | 'document'     // 📂 서류 수집
  | 'filed'        // ⚖️ 법원 접수
  | 'commenced'    // 🔍 개시 결정
  | 'repaying'     // 💰 변제 진행
  | 'discharged';  // ✅ 면책/종결

export const CRM_STATUS_CONFIG: Record<CrmStatus, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  requested:   { label: '상담 신청', emoji: '📋', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/20' },
  consulting:  { label: '초기 상담', emoji: '📞', color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10',  borderColor: 'border-yellow-500/20' },
  contracted:  { label: '수임 계약', emoji: '📝', color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  borderColor: 'border-orange-500/20' },
  document:    { label: '서류 수집', emoji: '📂', color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  borderColor: 'border-purple-500/20' },
  filed:       { label: '법원 접수', emoji: '⚖️', color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/20' },
  commenced:   { label: '개시 결정', emoji: '🔍', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/20' },
  repaying:    { label: '변제 진행', emoji: '💰', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  discharged:  { label: '면책/종결', emoji: '✅', color: 'text-slate-500',   bgColor: 'bg-slate-500/10',   borderColor: 'border-slate-500/20' },
};

// 직원 역할 체계
export type StaffRole = 'OWNER' | 'LAWYER' | 'CONSULTANT' | 'STAFF' | 'ACCOUNTING';

export const STAFF_ROLE_CONFIG: Record<StaffRole, { label: string; color: string; bgColor: string; borderColor: string }> = {
  OWNER:       { label: '대표 변호사', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/20' },
  LAWYER:      { label: '담당 변호사', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/20' },
  CONSULTANT:  { label: '상담 직원',   color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  STAFF:       { label: '사무 직원',   color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  borderColor: 'border-purple-500/20' },
  ACCOUNTING:  { label: '경리 직원',   color: 'text-pink-400',    bgColor: 'bg-pink-500/10',    borderColor: 'border-pink-500/20' },
};

// 직원 상태
export type StaffMemberStatus = 'pending' | 'active' | 'suspended' | 'removed';

// 법무법인 직원
export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  assignedCount: number;  // 현재 담당 건수
  createdAt: string;
  permissions: StaffPermissions;
  status: StaffMemberStatus;   // 직원 상태 (승인대기/활성/정지/강퇴)
  invitedBy?: string;          // 초대한 사람 ID
  approvedAt?: string;         // 승인 일시
  removedAt?: string;          // 강퇴 일시
  removalReason?: string;      // 강퇴 사유
  lastActiveAt?: string;       // 마지막 활동 일시
}

export interface StaffPermissions {
  viewAllClients: boolean;     // 전체 고객 조회
  editClientInfo: boolean;     // 고객 정보 수정
  changeStatus: boolean;       // 상태 변경
  assignCases: boolean;        // 사건 배정/이관
  manageStaff: boolean;        // 직원 관리
  writeNotes: boolean;         // 상담 메모 작성
  manageBilling: boolean;      // 수임료 관리
  deleteClients: boolean;      // 고객 삭제
}

export const DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  OWNER:       { viewAllClients: true,  editClientInfo: true,  changeStatus: true,  assignCases: true,  manageStaff: true,  writeNotes: true,  manageBilling: true,  deleteClients: true },
  LAWYER:      { viewAllClients: false, editClientInfo: true,  changeStatus: true,  assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false },
  CONSULTANT:  { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false },
  STAFF:       { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false },
  ACCOUNTING:  { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: false, manageBilling: true,  deleteClients: false },
};

// CRM 활동 로그
export type CrmActivityType = 
  | 'status_change' | 'assigned' | 'transferred' | 'note_added' 
  | 'document_checked' | 'contract_signed' | 'payment_received' | 'created';

export interface CrmActivityLog {
  id: string;
  clientId: string;
  actorId: string;
  actorName: string;
  actorRole: StaffRole;
  type: CrmActivityType;
  description: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

// 직원 관리 활동 로그
export type StaffActivityType = 
  | 'staff_invited' | 'staff_approved' | 'staff_rejected'
  | 'staff_suspended' | 'staff_removed' | 'staff_reactivated'
  | 'case_assigned' | 'case_transferred' | 'case_bulk_transferred'
  | 'permission_changed' | 'role_changed';

export interface StaffActivityLog {
  id: string;
  staffId: string;
  staffName: string;
  actorId: string;
  actorName: string;
  type: StaffActivityType;
  description: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

// CRM 메모 카테고리
export type CrmNoteCategory = 'call' | 'consult' | 'document' | 'court' | 'billing' | 'urgent';

export const CRM_NOTE_CATEGORIES: Record<CrmNoteCategory, { label: string; emoji: string; color: string }> = {
  call:     { label: '통화',   emoji: '📞', color: 'text-blue-400' },
  consult:  { label: '상담',   emoji: '📝', color: 'text-emerald-400' },
  document: { label: '서류',   emoji: '📂', color: 'text-purple-400' },
  court:    { label: '법원',   emoji: '⚖️', color: 'text-amber-400' },
  billing:  { label: '수임료', emoji: '💰', color: 'text-pink-400' },
  urgent:   { label: '긴급',   emoji: '⚠️', color: 'text-red-400' },
};

export interface CrmNote {
  id: string;
  category: CrmNoteCategory;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// 서류 체크리스트
export interface DocumentCheckItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export const DEFAULT_REHAB_DOCUMENTS: Omit<DocumentCheckItem, 'checkedBy' | 'checkedAt'>[] = [
  { id: 'doc-01', label: '주민등록등본', checked: false },
  { id: 'doc-02', label: '주민등록초본', checked: false },
  { id: 'doc-03', label: '가족관계증명서', checked: false },
  { id: 'doc-04', label: '재산세 과세증명', checked: false },
  { id: 'doc-05', label: '소득금액증명원', checked: false },
  { id: 'doc-06', label: '건강보험자격확인서', checked: false },
  { id: 'doc-07', label: '급여명세서 (3개월)', checked: false },
  { id: 'doc-08', label: '재직증명서', checked: false },
  { id: 'doc-09', label: '채무증명원 (전 금융기관)', checked: false },
  { id: 'doc-10', label: '통장사본 (전 계좌)', checked: false },
  { id: 'doc-11', label: '보험가입내역조회서', checked: false },
  { id: 'doc-12', label: '국민연금가입증명', checked: false },
  { id: 'doc-13', label: '임대차계약서', checked: false },
  { id: 'doc-14', label: '자동차등록원부', checked: false },
  { id: 'doc-15', label: '퇴직금산정서류', checked: false },
];

// CRM 확장된 고객 데이터 (ConsultRequest에 추가)
export interface CrmClientExtension {
  crmStatus: CrmStatus;
  assignedLawyerId?: string;
  assignedConsultantId?: string;
  assignedStaffId?: string;
  documents: DocumentCheckItem[];
  notes: CrmNote[];
  activities: CrmActivityLog[];
  contractDate?: string;
  contractAmount?: number;
  lastActivityAt: string;
}


export interface ConsultRequest {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  requestType: RequestType;
  maxParticipants: number;
  status: ConsultStatus;
  selectedLawyerId?: string; // If 'direct' — 채팅이 개시된 변호사 ID
  selectedLawyerIds?: string[]; // 의뢰인이 지정한 변호사 ID 목록 (최대 3명)
  proposals?: ConsultProposal[]; // 변호사들이 제출한 솔루션/비용 제안서 목록
  createdAt: string;
  title: string;
  content: string;
  financialProfile: FinancialProfile;
  phoneConsultationRequested?: boolean;
  safeNumber?: string;
  safeNumberAssignedAt?: string;
  safeNumberExpiresAt?: string;
  // 의뢰인 진입 카테고리 (변호사 측에서만 표시)
  entryCategory?: {
    type: 'debt_type' | 'solution' | 'general';  // 채무유형 / 해결방법 / 일반
    id: string;       // remedyData key 또는 solutionType
    label: string;    // 표시 이름 (예: "카드론·리볼빙 연체", "개인회생")
  };
}

// ── 변호사 솔루션/비용 제안서 ──
export interface ConsultProposal {
  id: string;
  lawyerId: string;
  lawyerName: string;
  lawyerAvatar: string;
  firmName: string;
  feasibility: string;       // 진행 가능성/성공률 의견
  monthlyPayment: number;    // 예상 월 변제금 (만원)
  duration: number;          // 변제 기간 (개월)
  reductionRate: number;     // 예상 탕감률 (%)
  totalReduction: number;    // 총 탕감액 (만원)
  fee: number;               // 수임 비용 (만원)
  installment: string;       // 분납 조건
  remark: string;            // 변호사 솔루션 한줄 의견
  createdAt: string;
}

export interface ConsultParticipant {
  id: string;
  consultRequestId: string;
  lawyerId: string;
  joinedAt: string;
}

export interface ConsultMessage {
  id: string;
  consultRequestId: string;
  senderType: 'client' | 'lawyer';
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface LawFirm {
  id: string;
  name: string;
  region: string;
}

export interface Team {
  id: string;
  lawFirmId: string;
  name: string;
}

export type UserRole = 'LAWYER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  lawFirmId: string;
  teamId: string;
  name: string;
  role: UserRole;
  fields: string[];
  region: string;
  avatar: string;
  bio: string;
  recentActivity: string;
  matchedCount: number;
  password?: string; // Optional password for authentication
  approved?: boolean; // Admin approval status for lawyers
  licenseImageData?: string; // 변호사 등록증 이미지 (Base64 Data URL)
  licenseNumber?: string; // 변호사 등록번호
  licenseStatus?: 'pending' | 'verified' | 'rejected'; // 자격 심사 상태
  avatarData?: string; // 프로필 사진 (Base64 Data URL, 파일 업로드 시)
  // ── 미니홈피 프로필 확장 필드 ──
  catchphrase?: string; // 한줄 캐치프레이즈
  career?: string[]; // 경력 사항
  education?: string; // 학력
  certYear?: string; // 변호사 자격 취득년도
  barAssociation?: string; // 소속 변호사회
  specialties?: string[]; // 상세 전문 분야
  successRate?: number; // 인가 성공률 (%)
  totalCases?: number; // 누적 수임 건수
  avgRepaymentRate?: number; // 평균 변제율 (%)
  courtJurisdiction?: string; // 관할 법원
}

export type CaseStatus = 'document' | 'filing' | 'commencement' | 'approval' | 'discharge';

export interface Case {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  status: CaseStatus;
  assignedLawyerId: string;
  assignedLawyerName: string;
  debtTotal: number;
  income: number;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}

// --- Rehabilitation Consultation Intake & Calculation Types ---

export interface BaseInfo {
  disposable: number;
  living: number;
  debtTotal: number;
  liq: number;
}

export interface ClientSummary {
  name: string;
  age: number;
  monthlyIncome: number;
  dependents: number;
  court: string;
  residence: string;
  caseNumber?: string;
}

export interface CalculationRow {
  m: number;
  monthly: number;
  total: number;
  needCutPct: number;
  mode: string;
}

export interface Top3Item {
  label?: string;
  m: number;
  monthly: number;
  total: number;
  needCutPct: number;
  mode: string;
  limits?: string;
  why?: string;
}

export interface Alert {
  type: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface PreferredPlan {
  m: number;
  monthly: number;
  total: number;
  mode: string;
  why?: string;
}

export interface ComputeResponse {
  caseId: string;
  ownerId: string;
  status: string;
  client: ClientSummary;
  base: BaseInfo;
  allow2435: boolean;
  rows: CalculationRow[];
  top3: Top3Item[];
  preferred: PreferredPlan | null;
  alerts: Alert[];
  contractId?: string;
  rawIntake?: IntakeData | null;
  portalPassword?: string;
}

export interface CallLog {
  CallID: string;
  CaseID: string;
  ownerId?: string;
  ownerName?: string;
  PhoneNumber: string;
  FileName: string;
  Type: 'audio' | 'text' | 'other';
  UploadTime: string;
  TextLink: string;
  AudioLink: string;
  Summary: string;
  Status: 'READY' | 'TO_SUMMARIZE' | 'DONE';
}

export type CaseType = string;
export type AssetOwner = 'self' | 'spouse';
export type AssetType = 
  | 'deposit' 
  | 'realestate' 
  | 'realestate_general'
  | 'vehicle' 
  | 'land' 
  | 'savings' 
  | 'stock' 
  | 'business_vehicle'
  | 'license' 
  | 'insurance'
  | 'severance'
  | 'other'
  | 'business_deposit'
  | 'business_premium'
  | 'business_assets'
  | 'business_receivables';
export type DebtType = 'unsecured' | 'secured' | 'tax';
export type IncomeType = 'worker' | 'worker_no_ins' | 'freelancer' | 'business' | 'unemployed';
export type PayType = 'bank' | 'cash' | 'crypto';

export interface Creditor {
  id: string;
  name: string;
  postalCode: string;
  address: string;
  jurisdictionAddress?: string;
  phone: string;
  fax: string;
}

export interface DebtItem {
  id: string;
  creditor: string;
  principal: number;
  interest: number;
  type: DebtType;
  isGamblingOrLuxury: boolean;
  isRecent: boolean;
  address?: string;
  postalCode?: string;
  phone?: string;
  fax?: string;
  issuanceDate?: string;
}

export interface AssetDetail {
  id: string;
  owner: AssetOwner;
  type: AssetType;
  description: string;
  marketValue: number;
  loanBalance: number;
  hasPledge: boolean;
  isExempt: boolean;
}

export interface BusinessInfo {
  periodMonths: number;
  deposit: number;
  rent: number;
  facilityCost: number;
}

export interface IncomeSource {
  id: string;
  type: IncomeType;
  amount: number;
  tenureYears?: number;
  payType?: PayType;
  businessInfo?: BusinessInfo;
}

export interface SpecialCircumstances {
  singleParent: boolean;
  basicLivelihood: boolean;
  rentFraud: boolean;
  severeDisability: boolean;
}

export interface ExtraLivingCost {
  utilities: number;
  education: number;
  specialEducation: number;
  medical: number;
  other: number;
  highIncomeExtraLimit?: number;
}

export interface PrevHistory {
  exists: boolean;
  caseNumber?: string;
  dischargeYear?: string;
}

export interface FeeLoanInfo {
  useFeeLoan: boolean;
  amount: number;
  term: number;
  contractDate: string;
  firstRepaymentDate: string;
  interestRate: number;
}

export interface ConsultationLog {
  id: string;
  date: string;
  consultantId: string;
  consultantName: string;
  content: string;
}

export interface IntakeData {
  ownerId?: string;
  clientName: string;
  phoneNumber: string;
  birthDate: string;
  consultDate: string;
  applyYear?: number;
  dbVendor: string;
  portalPassword?: string;
  
  prevHistory: PrevHistory;

  caseNumber?: string;
  caseType: CaseType;
  residence: string;
  workplace: string;
  selectedCourt: string;
  
  maritalStatus: 'single' | 'married' | 'divorced' | 'divorced_sending' | 'divorced_receiving';
  spouseIncome?: number;
  childSupportCost?: number; 
  minorChildren: number;
  minorChildrenFullRecognition: boolean;
  
  adultChildrenCount?: number;
  adultChildrenDetails?: { birthDate: string }[];

  otherDependents: number;
  
  incomeSources: IncomeSource[];
  
  monthlyLivingCost: number;
  monthlyRent: number;
  monthlyInsurance: number;
  extraLivingCost: ExtraLivingCost;

  specialCircumstances: SpecialCircumstances;

  assets: AssetDetail[];
  debts: DebtItem[];
  consultationLogs: ConsultationLog[];
  notes?: string;
  speculativeLoss?: number; // 1년 이내 투자 손실 (원 단위)
  gamblingLoss?: number;    // 1년 이내 도박 채무 (원 단위)
  legalActions?: string[];
  retirementPensionType?: 'pension' | 'none' | 'unknown';
  retirementPay?: number;   // 예상 퇴직금 (원 단위)
  
  feeTotal?: number;
  feeInstallments?: number;
  feeStartDate?: string;
  feeLoanInfo?: FeeLoanInfo;
  housingType?: 'rent' | 'jeonse' | 'owned' | 'free'; // 거주 형태
  housingContractHolder?: 'self' | 'spouse' | 'others'; // 계약 명의자
  depositLoan?: number; // 보증금 대출금 (원 단위)
}

export interface MedianIncomeTable {
  values: Record<number, number>; 
  incrementOver7: number;
}

export interface LeibnizTable {
  m24: number;
  m36: number;
  m48: number;
  m60: number;
}

export interface GlobalPolicy {
  pminThreshold: number; 
  pminRateBelow: number; 
  pminRateAbove: number; 
  pminFixedAbove: number; 
  overpaymentWarnRatio: number; 
  insuranceWarnRatio: number; 
  reduceMax36: number; 
  reduceMax60: number; 
  spouseIncomeRatioUnder: number;
  spouseIncomeRatioUnderRate: number;
  spouseIncomeRatioBetween: number;
  spouseIncomeRatioBetweenRate: number;
  spouseIncomeRatioOverRate: number;
}

export interface AiFeatureConfig {
  model: string;
  prompt: string;
}

export interface AiSettings {
  reportGenerator: AiFeatureConfig & {
    defaultTone: 'formal' | 'friendly' | 'analytical';
    defaultLength: 'short' | 'medium' | 'detailed';
  };
  statementGenerator: AiFeatureConfig;
  imageLeadExtractor: AiFeatureConfig;
  callSummarizer: AiFeatureConfig;
}

export type RegionKey = 'Seoul' | 'Overcrowded' | 'Metro' | 'Others';

export interface CourtRegionMapItem {
  keyword: string;
  court: string;
  region: RegionKey;
}

export interface DepositRule {
  limit: number;
  deduct: number;
}

export interface AssetExemptionRules {
  deposit: number;
  insurance: number;
}

export interface EducationCostRules {
  additionalLimit: number;
  includedInMedian: number;
  totalLimit: number;
}

export interface MedicalCostInclusion {
  [householdSize: number]: number;
}

export interface AdultChildDependentCriteria {
  minAge: number;
  maxAge: number;
  incomeLimit: number;
  grossIncomeLimit: number;
}

export interface HousingCostRule {
  additionalLimit: number;
  includedInMedian: number;
  totalLimit: number;
}

export interface YearlyPolicy {
  medianIncome: MedianIncomeTable;
  depositRules: Record<RegionKey, DepositRule>;
  housingCostLimits: Record<RegionKey, Record<number, HousingCostRule>>;
  assetExemptions: AssetExemptionRules;
  educationCost: EducationCostRules;
  specialEducationCost: EducationCostRules;
  medicalCostIncludedInMedian: MedicalCostInclusion;
  highIncomeEarnerMultiplier: number;
  highIncomeRepaymentRateThreshold: number;
  adultChildDependentCriteria: AdultChildDependentCriteria;
}

export interface CourtConfig {
  description: string;
  includeSpouseProperty: boolean;
  includeCryptoStock: boolean;
  allow24Month: boolean;
  allowAdditionalLivingCost: boolean;
  allowOtherLivingCost: boolean;
}

export type PermissionKey = 
  | 'manage_users'
  | 'access_settings'
  | 'view_all_leads'
  | 'assign_leads'
  | 'delete_data'
  | 'export_data'
  | 'manage_contracts'
  | 'manage_fees';

export interface PermissionConfig {
  [role: string]: Record<PermissionKey, boolean>;
}

export interface StatusItem {
  key: string;
  label: string;
  color: string;
}

export interface StatusConfig {
  preContract: StatusItem[];
  postContract: StatusItem[];
}

export interface AppSettings {
  activeVersion: string; 
  leibniz: LeibnizTable;
  policy: GlobalPolicy;
  aiConfig: AiSettings;
  companyLogo?: string;
  dbVendors: string[];
  caseTypes: { key: string; label: string; }[];
  courtRegionMap: CourtRegionMapItem[]; 
  courtConfigs: Record<string, CourtConfig>;
  yearlyPolicies: Record<number, YearlyPolicy>;
  permissions: PermissionConfig;
  statusConfig: StatusConfig;
}

export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  badge: 'HOT' | 'NEW' | 'BEST' | null;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  views: number;
  date: string;
  imageUrl: string;
}

export interface ClientQA {
  id: string;
  category: string;
  question: string;
  author: string;
  answer: string;
  lawyerName: string;
  lawyerAvatar: string;
  badge: string;
}

export interface SuccessReview {
  id: string;
  title: string;
  category: string;
  author: string;
  originalDebt: number;
  remainingDebt: number;
  lawyerId: string;
  lawyerName: string;
  lawyerAvatar: string;
  content: string;
  tags: string[];
}

export interface MainBanner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  image: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  isImportant: boolean;
  views: number;
}

// --- Member & Activity Monitoring Types ---
export type MemberStatus = 'active' | 'suspended' | 'pending' | 'withdrawn' | 'dormant';
export type MemberRole = 'CLIENT' | 'LAWYER' | 'STAFF' | 'ADMIN';

export interface Member {
  id: string;
  email?: string;
  phone?: string;
  alias: string;
  role: MemberRole;
  createdAt: string;
  loginChannel: 'email' | 'google' | 'kakao' | 'naver' | 'sms';
  status: MemberStatus;
  lastActiveAt: string;
}

export interface ActivityLog {
  id: string;
  memberId: string;
  memberName: string;
  role: MemberRole;
  action: 'SIGNUP' | 'LOGIN' | 'CALCULATE' | 'CONSULT_REQUEST' | 'CHAT_SEND' | 'STATUS_CHANGE' | 'ADMIN_ACTION' | 'WITHDRAWAL' | 'QNA_BROWSE';
  details: string;
  ipAddress: string;
  createdAt: string;
}

// --- 1:1 Inquiries & Basic Config Types ---
export interface ClientInquiry {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  content: string;
  createdAt: string;
  replyContent?: string;
  repliedAt?: string;
  status: 'pending' | 'replied';
}

export interface PlatformConfig {
  siteTitle: string;
  siteLogoText: string;
  siteLogoUrl?: string;
  companyAddress: string;
  companyBusinessNumber: string;
  companyRepresentative: string;
  termsOfService: string;
  privacyPolicy: string;
}

// --- Diagnosis (진단) Types ---

export type StrategyType =
  | 'REHABILITATION'   // 개인회생
  | 'BANKRUPTCY'       // 파산·면책
  | 'NEGOTIATION'      // 채무조정/대리인
  | 'FRESH_START'      // 새출발기금
  | 'WAIT_AND_SEE';    // 대기·시간 확보

export type UrgencyLevel = 'immediate' | 'soon' | 'can_wait';

export interface DiagnosisOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface DiagnosisQuestion {
  id: string;
  step: number;
  title: string;
  subtitle?: string;
  options: DiagnosisOption[];
}

export interface DiagnosisAnswers {
  q1_status: string;      // 현재 채무 상태
  q2_debtScale: string;   // 총 채무 규모
  q3_income: string;      // 소득 여부
  q4_urgentNeed: string;  // 가장 급한 문제
  q5_goal: string;        // 원하는 방향
}

export interface StrategyRecommendation {
  type: StrategyType;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  pros: string[];
  cons: string[];
}

export interface DiagnosisResult {
  id: string;
  createdAt: string;
  answers: DiagnosisAnswers;
  primaryStrategy: StrategyRecommendation;
  secondaryStrategy?: StrategyRecommendation;
  allStrategies: StrategyRecommendation[];
  urgencyLevel: UrgencyLevel;
  urgencyMessage: string;
  estimatedSavingsAmount: number;      // 추정 탕감 금액 (만원)
  estimatedSavingsRate: number;        // 추정 탕감률 (0~1)
  estimatedMonthlyPayment: number;     // 추정 월 변제금 (만원)
  estimatedDebtTotal: number;          // 추정 총 채무 (만원)
  actionItems: string[];               // "지금 당장 해야 할 것"
  warnings: string[];                  // 주의사항
  rehabEngineUsed: boolean;            // rehabEngine 실제 사용 여부
  computeResponse?: ComputeResponse;   // rehabEngine 원본 결과 (있을 때)
}

export interface DiagnosisConfig {
  questions: DiagnosisQuestion[];
  isActive: boolean;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

// --- Popup Types ---
export interface PopupItem {
  id: string;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  actionType?: 'link_url' | 'scroll_to_form' | 'open_rehab_chat';
  openInNewWindow: boolean;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
}

export interface PopupStyleConfig {
  width: number;
  top: number;
  left: number;
  isCentered: boolean;
}

export interface PopupConfig {
  usePopup: boolean;
  items: PopupItem[];
  slideEffect?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number; // seconds
  pcStyle: PopupStyleConfig;
  mobileStyle: PopupStyleConfig;
  showDoNotOpenToday: boolean;
  closeButtonColor?: string;
  disableOverlay: boolean;
}

