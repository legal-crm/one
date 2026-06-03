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
  debtCause?: 'LIVING' | 'BUSINESS' | 'INVESTMENT' | 'GUARANTEE' | 'OTHER';
  harassmentLevel?: 'CALL' | 'LETTER' | 'LAWSUIT' | 'SEIZURE';
  creditorCount?: number;
}

export type RequestType = 'direct' | 'open';
export type ConsultStatus = 'requested' | 'responding' | 'counseling' | 'closed';

export interface ConsultRequest {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  requestType: RequestType;
  maxParticipants: number;
  status: ConsultStatus;
  selectedLawyerId?: string; // If 'direct'
  createdAt: string;
  title: string;
  content: string;
  financialProfile: FinancialProfile;
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
  
  feeTotal?: number;
  feeInstallments?: number;
  feeStartDate?: string;
  feeLoanInfo?: FeeLoanInfo;
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


