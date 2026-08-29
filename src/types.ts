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
  gender?: 'male' | 'female'; // 성별
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
  housingType?: 'rent' | 'jeonse' | 'owned' | 'free' | 'dormitory'; // 거주 형태
  clientNote?: string;     // 의뢰인 추가 메모/특이사항 (변호사에게만 표시)
  clientNotes?: string[];   // 의뢰인 전달 사항 다중 메모 리스트
}

export type RequestType = 'direct' | 'open' | 'direct_multi';
export type ConsultStatus = 'requested' | 'responding' | 'comparing' | 'counseling' | 'closed' | 'cancelled';

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
  | 'discharged'   // ✅ 면책/종결
  | 'cancelled';   // 🚫 의뢰인 취소

export const CRM_STATUS_CONFIG: Record<CrmStatus, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  requested:   { label: '상담 신청', emoji: '📋', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/20' },
  consulting:  { label: '초기 상담', emoji: '📞', color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10',  borderColor: 'border-yellow-500/20' },
  contracted:  { label: '수임 계약', emoji: '📝', color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  borderColor: 'border-orange-500/20' },
  document:    { label: '서류 수집', emoji: '📂', color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  borderColor: 'border-purple-500/20' },
  filed:       { label: '법원 접수', emoji: '⚖️', color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/20' },
  commenced:   { label: '개시 결정', emoji: '🔍', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/20' },
  repaying:    { label: '변제 진행', emoji: '💰', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  discharged:  { label: '면책/종결', emoji: '✅', color: 'text-slate-500',   bgColor: 'bg-slate-500/10',   borderColor: 'border-slate-500/20' },
  cancelled:   { label: '의뢰인 취소', emoji: '🚫', color: 'text-red-500',    bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/20' },
};

// ── 이탈 사유 (Drop-off Reason) ──

export const DROP_OFF_REASONS = [
  '비용 부담',
  '타 사무소 선택',
  '연락 두절',
  '자격 미달 (면책불허가 사유)',
  '본인 의사 취소',
  '시기 미정',
  '기타',
] as const;

export type DropOffReason = typeof DROP_OFF_REASONS[number];

// ── 사건 유형 (Case Type) ──

export const CASE_TYPES = ['개인회생', '파산', '새출발기금', '신용회복'] as const;
export type CaseType = typeof CASE_TYPES[number];

// ── 직업 유형 ──

export const JOB_TYPES = ['직장인', '개인사업자', '법인사업자', '프리랜서', '무직'] as const;

// ── 주거 형태 ──

export const HOUSING_TYPES = ['자가', '전세', '월세', '무상거주'] as const;
export const HOUSING_DETAILS = ['아파트', '빌라', '단독주택', '오피스텔', '기타'] as const;

// ── 자산 유형 ──

export const ASSET_TYPES = ['자동차', '부동산', '토지', '예금/적금', '주식/가상화폐', '보험', '기타'] as const;
export const ASSET_OWNERS = ['본인', '배우자', '배우자 공동명의'] as const;

// ── 유입 채널 (Intake Channel) ──

export type IntakeChannel =
  | 'mykim'       // 마이김변 플랫폼
  | 'naver_ad'    // 네이버 검색광고
  | 'blog'        // 블로그/콘텐츠
  | 'youtube'     // 유튜브
  | 'lawtalk'     // 로톡
  | 'referral'    // 지인 소개
  | 'phone'       // 전화 문의
  | 'visit'       // 방문 상담
  | 'repeat'      // 기존 의뢰인 재의뢰
  | 'other';      // 기타

export const INTAKE_CHANNEL_CONFIG: Record<IntakeChannel, { label: string; emoji: string; color: string; bgColor: string }> = {
  mykim:     { label: '마이김변',     emoji: '🏠', color: 'text-brand',       bgColor: 'bg-brand/10' },
  naver_ad:  { label: '네이버 광고',  emoji: '🔍', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  blog:      { label: '블로그',       emoji: '📝', color: 'text-sky-500',     bgColor: 'bg-sky-500/10' },
  youtube:   { label: '유튜브',       emoji: '▶️', color: 'text-red-500',     bgColor: 'bg-red-500/10' },
  lawtalk:   { label: '로톡',         emoji: '⚖️', color: 'text-indigo-500',  bgColor: 'bg-indigo-500/10' },
  referral:  { label: '지인 소개',    emoji: '🤝', color: 'text-amber-500',   bgColor: 'bg-amber-500/10' },
  phone:     { label: '전화 문의',    emoji: '📞', color: 'text-teal-500',    bgColor: 'bg-teal-500/10' },
  visit:     { label: '방문 상담',    emoji: '🚶', color: 'text-purple-500',  bgColor: 'bg-purple-500/10' },
  repeat:    { label: '재의뢰',       emoji: '🔄', color: 'text-orange-500',  bgColor: 'bg-orange-500/10' },
  other:     { label: '기타',         emoji: '📌', color: 'text-slate-500',   bgColor: 'bg-slate-500/10' },
};

// ── 수임료 분납 관리 ──

export interface FeeInstallment {
  id: string;
  round: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  memo?: string;
}

// ── 카카오 알림톡 마일스톤 ──

export type AlimtokMilestone =
  | 'consult_booked'      // 상담 접수
  | 'contract_signed'     // 수임계약 체결
  | 'document_request'    // 서류 제출 요청
  | 'court_filed'         // 법원 접수 완료
  | 'injunction_granted'  // 금지명령 결정
  | 'correction_order'    // 보정명령 안내
  | 'commenced'           // 개시결정
  | 'hearing_notice'      // 채권자집회 안내
  | 'discharged';         // 면책 완료

export const ALIMTOK_MILESTONE_CONFIG: Record<AlimtokMilestone, { label: string; emoji: string; template: string }> = {
  consult_booked:     { label: '상담 접수',     emoji: '📋', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 상담 요청이 접수되었습니다.\n\n📌 접수 일시: {{date}}\n📌 다음 단계: 담당 변호사가 확인 후 연락드리겠습니다.\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  contract_signed:    { label: '수임계약 체결', emoji: '📝', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 수임계약이 체결되었습니다.\n\n📌 다음 단계: 필요 서류를 안내해 드리겠습니다.\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  document_request:   { label: '서류 요청',     emoji: '📂', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님, 아래 서류 제출을 부탁드립니다.\n\n{{documentList}}\n\n📌 제출 기한: {{deadline}}\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  court_filed:        { label: '법원 접수',     emoji: '⚖️', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 {{caseType}} 사건이 법원에 접수되었습니다.\n\n📌 사건번호: {{caseNumber}}\n📌 다음 단계: 금지명령 결정 대기 (약 1~2주)\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  injunction_granted: { label: '금지명령 결정', emoji: '🛡️', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 금지명령이 결정되었습니다.\n\n📌 효력: 채권자의 추심행위가 중단됩니다.\n📌 주의: 독촉 연락이 오면 즉시 알려주세요.\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  correction_order:   { label: '보정명령',     emoji: '📮', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 사건에 보정명령이 내려졌습니다.\n\n📌 보정 내용: {{correctionDetail}}\n📌 제출 기한: {{deadline}}\n📌 담당 변호사가 보정서 작성 중입니다.\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  commenced:          { label: '개시결정',     emoji: '✨', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 개인회생이 개시 결정되었습니다.\n\n📌 월 변제금: {{monthlyPayment}}원\n📌 변제 기간: {{duration}}개월\n📌 다음 단계: 채권자집회 참석 안내 예정\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  hearing_notice:     { label: '채권자집회',   emoji: '🏛️', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님의 채권자집회가 예정되어 있습니다.\n\n📌 일시: {{hearingDate}}\n📌 장소: {{courtName}}\n📌 참석 필수 여부: {{attendanceRequired}}\n\n▶ 진행상황 확인: {{trackingUrl}}' },
  discharged:         { label: '면책 완료',    emoji: '🎉', template: '{{firmName}} ({{lawyerName}} 변호사)\n\n{{clientName}}님, 축하합니다!\n\n📌 {{caseType}} 면책이 확정되었습니다.\n📌 면책된 채무: 약 {{dischargedAmount}}\n\n그동안 수고 많으셨습니다. 궁금하신 점은 언제든 연락 주세요.' },
};

export const STATUS_TO_MILESTONE: Partial<Record<CrmStatus, AlimtokMilestone>> = {
  consulting:  'consult_booked',
  contracted:  'contract_signed',
  document:    'document_request',
  filed:       'court_filed',
  commenced:   'commenced',
  discharged:  'discharged',
};

// ── 보정명령 D-Day 관리 ──

export interface CorrectionOrder {
  id: string;
  title: string;
  issuedDate: string;
  deadline: string;
  submittedDate?: string;
  status: 'pending' | 'submitted' | 'extended' | 'overdue';
  detail?: string;
  templateType?: string;
}

// ── 문서 관리 시스템 (DMS) ──

export interface DocumentFile {
  id: string;
  name: string;
  category: 'debt_cert' | 'income' | 'asset' | 'bank_statement' | 'id_doc' | 'court_filing' | 'correction' | 'other';
  uploadedAt: string;
  uploadedBy: string;
  fileSize?: number;
  mimeType?: string;
  dataUrl?: string;
  notes?: string;
}

export const DOC_CATEGORY_CONFIG: Record<DocumentFile['category'], { label: string; emoji: string }> = {
  debt_cert:      { label: '부채증명서',     emoji: '📄' },
  income:         { label: '소득증빙',       emoji: '💰' },
  asset:          { label: '재산증빙',       emoji: '🏠' },
  bank_statement: { label: '통장거래내역',   emoji: '🏦' },
  id_doc:         { label: '신분증/등본',    emoji: '🪪' },
  court_filing:   { label: '법원제출서류',   emoji: '⚖️' },
  correction:     { label: '보정서류',       emoji: '📮' },
  other:          { label: '기타',           emoji: '📎' },
};

// ── 대법원 전자소송 연동 ──

export interface CourtCaseLink {
  caseNumber: string;
  courtName: string;
  caseType: '개인회생' | '개인파산' | '면책' | '기타';
  filedDate?: string;
  lastSyncedAt?: string;
  events: CourtEvent[];
}

export interface CourtEvent {
  id: string;
  date: string;
  type: 'filing' | 'injunction' | 'correction' | 'hearing' | 'decision' | 'discharge' | 'other';
  title: string;
  detail?: string;
  dDay?: number;
}

// ── 외부 캘린더 연동 ──

export interface CalendarSyncConfig {
  googleCalendar?: { enabled: boolean; calendarId: string; syncToken?: string };
  outlookCalendar?: { enabled: boolean; calendarId: string };
  appleCalendar?: { enabled: boolean; icsUrl: string };
}

// ── 알림톡 발송 이력 ──

export interface AlimtokLog {
  id: string;
  milestone: AlimtokMilestone;
  clientName: string;
  phone: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  errorMessage?: string;
}

export type StaffRole = 'OWNER' | 'LAWYER' | 'CONSULTANT' | 'STAFF' | 'ACCOUNTING' | string;

// 커스텀 역할 인터페이스
export interface CustomStaffRole {
  id: string;           // 역할 키 (예: 'INTERN')
  label: string;        // 표시 이름 (예: '인턴')
  color: string;        // 텍스트 컬러 클래스
  bgColor: string;      // 배경 컬러 클래스
  borderColor: string;  // 테두리 컬러 클래스
  basePermissions: StaffPermissions; // 기본 권한
  createdAt: string;
}

// 기본 역할 설정
const BUILTIN_ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  OWNER:       { label: '대표 변호사', color: 'text-amber-900',   bgColor: 'bg-amber-50',   borderColor: 'border-amber-200' },
  LAWYER:      { label: '담당 변호사', color: 'text-[#1E3A5F]',   bgColor: 'bg-slate-100',  borderColor: 'border-slate-300' },
  CONSULTANT:  { label: '상담 직원',   color: 'text-emerald-800', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  STAFF:       { label: '사무 직원',   color: 'text-purple-900',  bgColor: 'bg-purple-50',  borderColor: 'border-purple-200' },
  ACCOUNTING:  { label: '경리 직원',   color: 'text-rose-900',    bgColor: 'bg-rose-50',    borderColor: 'border-rose-200' },
};

// 런타임 커스텀 역할 레지스트리
const _customRoles: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {};

export function registerCustomRole(role: CustomStaffRole) {
  _customRoles[role.id] = { label: role.label, color: role.color, bgColor: role.bgColor, borderColor: role.borderColor };
  // localStorage 동기화
  const saved = loadCustomRoles();
  if (!saved.find(r => r.id === role.id)) {
    saved.push(role);
    localStorage.setItem('staff_custom_roles', JSON.stringify(saved));
  }
}

export function loadCustomRoles(): CustomStaffRole[] {
  try {
    return JSON.parse(localStorage.getItem('staff_custom_roles') || '[]');
  } catch { return []; }
}

export function deleteCustomRole(roleId: string) {
  delete _customRoles[roleId];
  const saved = loadCustomRoles().filter(r => r.id !== roleId);
  localStorage.setItem('staff_custom_roles', JSON.stringify(saved));
}

// 초기화: localStorage에서 커스텀 역할 로드
try {
  loadCustomRoles().forEach(r => {
    _customRoles[r.id] = { label: r.label, color: r.color, bgColor: r.bgColor, borderColor: r.borderColor };
  });
} catch {}

// 통합 역할 설정 조회 (빌트인 + 커스텀)
export const STAFF_ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = new Proxy(
  {} as Record<string, { label: string; color: string; bgColor: string; borderColor: string }>,
  {
    get(_, key: string) {
      return BUILTIN_ROLE_CONFIG[key] || _customRoles[key] || { label: key, color: 'text-slate-400', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/20' };
    },
    has(_, key: string) {
      return key in BUILTIN_ROLE_CONFIG || key in _customRoles;
    },
    ownKeys() {
      return [...Object.keys(BUILTIN_ROLE_CONFIG), ...Object.keys(_customRoles)];
    },
    getOwnPropertyDescriptor(_, key: string) {
      if (key in BUILTIN_ROLE_CONFIG || key in _customRoles) {
        return { configurable: true, enumerable: true, value: BUILTIN_ROLE_CONFIG[key] || _customRoles[key] };
      }
      return undefined;
    }
  }
);

// 직원 상태
export type StaffMemberStatus = 'pending' | 'active' | 'suspended' | 'removed';

// 초대 토큰
export interface InviteToken {
  token: string;
  role: StaffRole;
  email?: string;              // 지정된 이메일 (선택)
  expiresAt: string;           // 만료 시각 (ISO)
  createdBy: string;           // 생성한 관리자 ID
  createdAt: string;
  usedBy?: string;             // 사용한 직원 ID
  usedAt?: string;             // 사용 시각
  isUsed: boolean;
}

// 인증 제공자 타입
export type AuthProvider = 'email' | 'google';

// 법무법인 직원
export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  assignedCount: number;       // 현재 담당 건수
  createdAt: string;
  permissions: StaffPermissions;
  status: StaffMemberStatus;   // 직원 상태 (승인대기/활성/정지/강퇴)
  invitedBy?: string;          // 초대한 사람 ID
  approvedAt?: string;         // 승인 일시
  removedAt?: string;          // 강퇴 일시
  removalReason?: string;      // 강퇴 사유
  lastActiveAt?: string;       // 마지막 활동 일시
  // ── 인증 관련 필드 (Phase 1) ──
  authEmail?: string;          // 인증용 이메일 (로그인 ID)
  authProvider?: AuthProvider; // 인증 방식 (email / google)
  supabaseUserId?: string;     // Supabase Auth user.id
  linkedUserId?: string;       // 기존 User(변호사) 체계 연결 ID
  inviteToken?: string;        // 초대 시 사용된 토큰
  passwordLastChanged?: string;// 비밀번호 최종 변경 일시
  // ── 담당 변호사 지정 (제안서 컨펌 워크플로우) ──
  supervisingLawyerId?: string;  // 감독/담당 변호사 ID (제안서 컨펌 대상)
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
  manageCalendar: boolean;     // 전체 공유 일정 관리
}

const BUILTIN_DEFAULT_PERMISSIONS: Record<string, StaffPermissions> = {
  OWNER:       { viewAllClients: true,  editClientInfo: true,  changeStatus: true,  assignCases: true,  manageStaff: true,  writeNotes: true,  manageBilling: true,  deleteClients: true,  manageCalendar: true },
  LAWYER:      { viewAllClients: false, editClientInfo: true,  changeStatus: true,  assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false, manageCalendar: false },
  CONSULTANT:  { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false, manageCalendar: false },
  STAFF:       { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: true,  manageBilling: false, deleteClients: false, manageCalendar: false },
  ACCOUNTING:  { viewAllClients: false, editClientInfo: false, changeStatus: false, assignCases: false, manageStaff: false, writeNotes: false, manageBilling: true,  deleteClients: false, manageCalendar: false },
};

export const DEFAULT_PERMISSIONS: Record<string, StaffPermissions> = new Proxy(
  {} as Record<string, StaffPermissions>,
  {
    get(_, key: string) {
      if (BUILTIN_DEFAULT_PERMISSIONS[key]) return BUILTIN_DEFAULT_PERMISSIONS[key];
      const custom = loadCustomRoles().find(r => r.id === key);
      if (custom) return custom.basePermissions;
      return BUILTIN_DEFAULT_PERMISSIONS['STAFF']; // fallback
    }
  }
);

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
export type CrmNoteCategory = 'call' | 'consult' | 'document' | 'court' | 'billing' | 'urgent' | 'assignment';

export const CRM_NOTE_CATEGORIES: Record<CrmNoteCategory, { label: string; emoji: string; color: string }> = {
  call:       { label: '통화',     emoji: '📞', color: 'text-blue-400' },
  consult:    { label: '상담',     emoji: '📝', color: 'text-emerald-400' },
  document:   { label: '서류',     emoji: '📂', color: 'text-purple-400' },
  court:      { label: '법원',     emoji: '⚖️', color: 'text-amber-400' },
  billing:    { label: '수임료',   emoji: '💰', color: 'text-pink-400' },
  urgent:     { label: '긴급',     emoji: '⚠️', color: 'text-red-400' },
  assignment: { label: '배정 지시', emoji: '📋', color: 'text-indigo-400' },
};

export interface CrmNote {
  id: string;
  category: CrmNoteCategory;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  outcome?: ConsultOutcome;
  reminder?: NoteReminder;
}

export type ConsultOutcome = 'positive' | 'neutral' | 'negative' | 'contracted' | 'cancelled';

export const OUTCOME_CONFIG: Record<ConsultOutcome, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  positive:   { label: '\uAE0D\uC815\uC801', emoji: '\u2705', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-l-emerald-400' },
  neutral:    { label: '\uBCF4\uB958',     emoji: '\u2796', color: 'text-amber-600',   bgColor: 'bg-amber-50',   borderColor: 'border-l-amber-400' },
  negative:   { label: '\uBD80\uC815\uC801', emoji: '\u274C', color: 'text-red-600',     bgColor: 'bg-red-50',     borderColor: 'border-l-red-400' },
  contracted: { label: '\uC218\uC784 \uD655\uC815', emoji: '\uD83E\uDD1D', color: 'text-brand',      bgColor: 'bg-brand/5',    borderColor: 'border-l-brand' },
  cancelled:  { label: '\uC758\uB8B0\uC778 \uCDE8\uC18C', emoji: '\uD83D\uDEAB', color: 'text-slate-500',  bgColor: 'bg-slate-50',   borderColor: 'border-l-slate-400' },
};

export interface NoteReminder {
  date: string;
  time?: string;
  action: string;
  memo?: string;
  completed: boolean;
  completedAt?: string;
  calendarEventId?: string;
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

// ── 배정 지시 (Assignment Directive) ──
export type DirectivePriority = 'urgent' | 'high' | 'normal' | 'low';

export const DIRECTIVE_PRIORITY_CONFIG: Record<DirectivePriority, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  urgent: { label: '긴급',  emoji: '🔴', color: 'text-rose-700',   bgColor: 'bg-rose-50',   borderColor: 'border-rose-300' },
  high:   { label: '높음',  emoji: '🟡', color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-300' },
  normal: { label: '보통',  emoji: '🔵', color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
  low:    { label: '낮음',  emoji: '⚪', color: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
};

export interface AssignmentDirective {
  id: string;
  clientId: string;                    // 고객 ID
  assigneeId: string;                  // 배정받은 사람 ID
  assigneeName: string;                // 배정받은 사람 이름
  assigneeRole: StaffRole;             // 배정받은 사람 역할
  assignedById: string;                // 배정한 사람 ID
  assignedByName: string;              // 배정한 사람 이름
  assignedByRole: StaffRole;           // 배정한 사람 역할
  memo?: string;                       // 지시사항 텍스트
  priority: DirectivePriority;         // 우선순위
  deadline?: string;                   // 회신 기한 (ISO)
  createdAt: string;                   // 생성 시각
  acknowledgedAt?: string;             // 배정받은 사람이 확인한 시각
  acknowledgedById?: string;           // 확인한 사람 ID
}

// CRM 확장된 고객 데이터 (ConsultRequest에 추가)
export interface CrmClientExtension {
  crmStatus: CrmStatus;
  assigneeId?: string;               // 통합 담당자 ID (변호사/사무장/직원 무관)
  // ── 하위 호환 (마이그레이션 후 제거 예정) ──
  assignedLawyerId?: string;
  assignedConsultantId?: string;
  assignedStaffId?: string;
  documents: DocumentCheckItem[];
  notes: CrmNote[];
  activities: CrmActivityLog[];
  contractDate?: string;
  contractAmount?: number;
  lastActivityAt: string;
  // ── 다채널 CRM 확장 ──
  intakeChannel?: IntakeChannel;
  intakeChannelDetail?: string;
  isExternalClient?: boolean;
  // ── 수임료 분납 ──
  totalFee?: number;
  totalPaid?: number;
  feeSchedule?: FeeInstallment[];
  // ── 문서 관리 ──
  uploadedFiles?: DocumentFile[];
  // ── 보정명령 ──
  correctionOrders?: CorrectionOrder[];
  // ── 대법원 연동 ──
  courtCase?: CourtCaseLink;
  // ── 알림톡 이력 ──
  alimtokLogs?: AlimtokLog[];
  // ── 변제금 납부 모니터링 ──
  repaymentSchedule?: RepaymentEntry[];
  // ── 케이스 관리 확장 (LeadMaster 이식) ──
  isStarred?: boolean;           // 즐겨찾기
  deletedAt?: string;            // 소프트 삭제 일시 (ISO)
  dropOffReason?: DropOffReason; // 이탈 사유 카테고리
  dropOffDetail?: string;        // 이탈 사유 상세
  caseType?: CaseType;           // 사건 유형
  region?: string;               // 거주 지역
  preInfo?: string;              // 사전 수집 정보
  // ── 배정 지시 이력 ──
  assignmentDirectives?: AssignmentDirective[];
}

export interface RepaymentEntry {
  id: string;
  round: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'missed';
}

// ── 전담 변호사 선임 ──
export interface LawyerAppointment {
  id: string;
  clientId: string;
  clientName: string;
  lawyerId: string;
  lawyerName: string;
  lawyerAvatar: string;
  lawyerRegion?: string;
  status: 'active' | 'cancelled';
  appointedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelDetail?: string;
  consultRequestId: string;
}

export const APPOINTMENT_CANCEL_REASONS = [
  '다른 변호사님과 상담해보고 싶어요',
  '응답이 너무 느려요',
  '상담 내용이 만족스럽지 않아요',
  '비용이 부담되어요',
  '더 이상 법률 도움이 필요없어요',
  '기타',
] as const;


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
  acceptedLawyerIds?: string[];   // 제안서 수락 → 상담 활성화된 변호사 목록
  rejectionNotified?: boolean;    // 미매칭 알림 발송 완료 여부
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
  // ── 제안서 컨펌 워크플로우 (변호사법 준수) ──
  approvalStatus?: 'approved' | 'pending' | 'rejected';  // 기본값 'approved' (변호사 직접 작성)
  createdByStaffId?: string;     // 직원이 작성한 경우 직원 ID
  createdByStaffName?: string;   // 직원명
  approvedByLawyerId?: string;   // 승인한 변호사 ID
  approvedByLawyerName?: string; // 승인한 변호사명
  approvedAt?: string;           // 승인 일시
  rejectionReason?: string;      // 반려 사유
  proposalData?: any;            // 원본 ProposalData (검토용 전체 데이터)
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
  firmName?: string; // 소속 법률사무소/법인 명칭 (직접 설정 가능)
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
  adTier?: 'top' | 'regional' | 'basic' | null; // 광고 등급
  adRegion?: string; // 지역 상단 노출 구매 지역
  // ── 공식 채널 링크 ──
  websiteUrl?: string; // 공식 홈페이지 URL
  youtubeUrl?: string; // 유튜브 채널 URL
  blogUrl?: string; // 네이버 블로그 URL
  // ── AI 유료 기능 (어드민 활성화) ──
  aiCaseAnalysisEnabled?: boolean;       // AI 사건 분석 활성화 여부 (어드민 제어)
  aiCaseAnalysisActivatedAt?: string;    // 활성화 일시
  aiCaseAnalysisDeactivatedAt?: string;  // 비활성화 일시
  aiCaseAnalysisNote?: string;           // 어드민 메모 (계약 조건, 기간 등)
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

// ─── 계산 과정 상세 분석 (보고서용) ───
export interface BreakdownDependents {
  minorChildren: number;
  recognizedMinorChildren: number;
  spouseAsDependant: number;
  adultChildren: number;
  otherDependents: number;
  totalDependents: number;
  spouseIncomeRatio: number;
  childRecognitionRate: number;
  householdSize: number;
  rules: string[];
}

export interface BreakdownHousing {
  actualExpense: number;
  includedInMedian: number;
  additionalLimit: number;
  recognized: number;
  region: string;
  householdSizeUsed: number;
  rules: string[];
}

export interface BreakdownEducation {
  actualExpense: number;
  limitPerChild: number;
  childCount: number;
  recognized: number;
  rules: string[];
}

export interface BreakdownMedical {
  actualExpense: number;
  includedInMedian: number;
  recognized: number;
  rules: string[];
}

export interface BreakdownOtherLiving {
  actualExpense: number;
  recognized: number;
  eligible: boolean;
  eligibilityReason: string;
  rules: string[];
}

export interface BreakdownLivingCost {
  baseMedianIncome: number;
  basicLivingCost: number;
  householdSize: number;
  housing: BreakdownHousing;
  education: BreakdownEducation;
  specialEducation: BreakdownEducation;
  medical: BreakdownMedical;
  otherLiving: BreakdownOtherLiving;
  totalAdditional: number;
  totalLivingCost: number;
  rules: string[];
}

export interface BreakdownRepayment {
  disposableIncome: number;
  minTotalByDebtScale: number;
  minRepaymentRule: string;
  generalMinMonthly: number;
  liquidationValue: number;
  liquidationGuaranteeMonthly36: number;
  rules: string[];
}

export interface BreakdownLiquidation {
  items: { label: string; amount: number; rule: string }[];
  totalBeforeExemption: number;
  exemptions: { label: string; amount: number }[];
  spouseAssetContribution: number;
  spouseAssetRule: string;
  retirementPayContribution: number;
  retirementPayRule: string;
  totalLiquidationValue: number;
  rules: string[];
}

export interface CalculationBreakdown {
  dependents: BreakdownDependents;
  livingCost: BreakdownLivingCost;
  repayment: BreakdownRepayment;
  liquidation: BreakdownLiquidation;
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
  breakdown?: CalculationBreakdown;
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
  gender?: 'male' | 'female'; // 성별
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
  clientNotes?: string[];
  speculativeLoss?: number; // 1년 이내 투자 손실 (원 단위)
  gamblingLoss?: number;    // 1년 이내 도박 채무 (원 단위)
  legalActions?: string[];
  retirementPensionType?: 'pension' | 'none' | 'unknown';
  retirementPay?: number;   // 예상 퇴직금 (원 단위)
  
  feeTotal?: number;
  feeInstallments?: number;
  feeStartDate?: string;
  feeLoanInfo?: FeeLoanInfo;
  housingType?: 'rent' | 'jeonse' | 'owned' | 'free' | 'dormitory'; // 거주 형태
  housingContractHolder?: 'self' | 'spouse' | 'others'; // 계약 명의자
  depositLoan?: number; // 보증금 대출금 (원 단위)
  age?: number;
  specialCondition?: 'none' | 'basic_recipient' | 'severe_disability' | 'elderly' | 'single_parent' | 'rent_fraud';
  monthlyFixedExpenses?: number;
  spouseAsset?: number;
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

export interface QAAnswer {
  lawyerName: string;
  lawyerAvatar: string;
  answer: string;
  badge?: string;
  createdAt?: string;
  lawyerId?: string;
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
  additionalAnswers?: QAAnswer[];
  isSecret?: boolean;
  authorId?: string;
  createdAt?: string;
  content?: string;
  status?: 'waiting' | 'answered';
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

export interface AdBanner {
  id: string;
  lawyerId: string;
  lawyerName: string;
  lawyerAvatar: string;
  title: string;
  subtitle: string;
  tagline: string;
  gradient: string;
  isActive: boolean;
}

export interface AdOrder {
  id: string;
  lawyerId: string;
  lawyerName: string;
  productId: string;
  productName: string;
  contractMonths: number;
  monthlyPrice: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'active' | 'expired' | 'cancelled';
  requestedAt: string;
  paidAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  depositorName?: string;
  bankNote?: string;
  region?: string;
  // 세금계산서 관련
  taxInvoice?: {
    itemKey: string;
    ntsConfirmNum: string;
    issuedAt: string;
    supplyCost: number;
    tax: number;
    totalAmount: number;
    status: 'issued' | 'sent_nts' | 'failed';
  };
  // 변호사 사업자 정보
  buyerCorpNum?: string;
  buyerCorpName?: string;
  buyerCEOName?: string;
  buyerEmail?: string;
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
  action: 'SIGNUP' | 'LOGIN' | 'CALCULATE' | 'CONSULT_REQUEST' | 'CHAT_SEND' | 'STATUS_CHANGE' | 'ADMIN_ACTION' | 'WITHDRAWAL' | 'QNA_BROWSE' | 'SETTINGS';
  details: string;
  ipAddress: string;
  createdAt: string;
}

// --- 1:1 Inquiries & Basic Config Types ---
export type ClientInquiryCategory = 
  | 'site_usage'
  | 'account'
  | 'diagnosis'
  | 'lawyer_matching'
  | 'other';

export type LawyerInquiryCategory = 
  | 'platform_usage'
  | 'feature_request'
  | 'billing_contract'
  | 'ad_marketing'
  | 'other';

export interface InquiryAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
}

export interface ClientInquiry {
  id: string;
  clientId: string;
  clientName: string;
  category?: ClientInquiryCategory;
  contactInfo?: string;
  title: string;
  content: string;
  attachments?: InquiryAttachment[];
  source?: 'inquiry_page' | 'popup_modal';
  tempPassword?: string;  // for non-logged-in users to check inquiry status
  createdAt: string;
  replyContent?: string;
  repliedAt?: string;
  status: 'pending' | 'replied';
}

export interface LawyerInquiry {
  id: string;
  lawyerId: string;
  lawyerName: string;
  category: LawyerInquiryCategory;
  title: string;
  content: string;
  attachments: InquiryAttachment[];
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
  showDiagnosisReport: boolean;
  showLegalNews: boolean;
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
export type PopupTargetAudience = 'all' | 'client' | 'lawyer';

export interface PopupItem {
  id: string;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  actionType?: 'link_url' | 'scroll_to_form' | 'open_rehab_chat';
  openInNewWindow: boolean;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  targetAudience?: PopupTargetAudience; // 'all' (default) | 'client' | 'lawyer'
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



// ═══════════════════════════════════════════════════════
// 알림 시스템 (Notification System)
// ═══════════════════════════════════════════════════════

export type NotificationChannelType = 'telegram' | 'email' | 'browser_push' | 'sms' | 'kakao';
export type NotificationChannelStatus = 'connected' | 'disconnected' | 'coming_soon';

export interface NotificationChannel {
  type: NotificationChannelType;
  enabled: boolean;
  status: NotificationChannelStatus;
  config: Record<string, string>;
}

export interface NotificationLog {
  id: string;
  channel: NotificationChannelType;
  type: 'new_consult' | 'remind' | 'escalation' | 'test';
  sentAt: string;
  status: 'sent' | 'failed';
  detail: string;
  errorMessage?: string;
}

export interface NotificationSettings {
  telegram: {
    botToken: string;
    chatId: string;
    connected: boolean;
  };
  email: {
    senderGmail: string;
    senderAppPassword: string;
    recipientEmails: string[];
    enabled: boolean;
  };
  browserPush: {
    enabled: boolean;
    permission: string;
  };
  sms: {
    enabled: false;
    status: 'coming_soon';
  };
  kakao: {
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'coming_soon';
    firmName: string;
    lawyerName: string;
    autoTrigger: boolean;
    enabledMilestones: AlimtokMilestone[];
  };
}

// ═══════════════════════════════════════════════
// 전자 계약 (E-Contract) 시스템
// ═══════════════════════════════════════════════

export type ContractStatus = 'drafting' | 'pending_sign' | 'client_review' | 'signing' | 'completed' | 'cancelled';

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; emoji: string; color: string; bgColor: string }> = {
  drafting: { label: '작성중', emoji: '✏️', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  pending_sign: { label: '서명대기', emoji: '⏳', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  client_review: { label: '고객확인', emoji: '👁️', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  signing: { label: '서명진행', emoji: '✍️', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  completed: { label: '서명완료', emoji: '✅', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  cancelled: { label: '취소', emoji: '❌', color: 'text-slate-500', bgColor: 'bg-slate-100' },
};

export type ContractDocType = 'main_contract' | 'privacy_consent' | 'third_party_consent' | 'power_of_attorney' | 'installment_agreement' | 'procedure_consent' | 'id_confirmation' | 'spouse_consent' | 'custom';

export const CONTRACT_DOC_TYPES: Record<ContractDocType, { label: string; emoji: string; signatureRequired: 'client' | 'lawyer' | 'both'; description: string; required: boolean }> = {
  main_contract: { label: '위임 계약서', emoji: '📄', signatureRequired: 'both', description: '개인회생/파산 사건 수임 계약 본문', required: true },
  privacy_consent: { label: '개인정보 수집·이용 동의서', emoji: '🔒', signatureRequired: 'client', description: '개인정보보호법 필수 동의', required: true },
  third_party_consent: { label: '제3자 정보제공 동의서', emoji: '📋', signatureRequired: 'client', description: '법원/채권자 등 제3자 제공 동의', required: true },
  power_of_attorney: { label: '위임장', emoji: '📜', signatureRequired: 'client', description: '법원 제출용 대리인 위임장', required: true },
  installment_agreement: { label: '수임료 분할납부 약정서', emoji: '💰', signatureRequired: 'both', description: '분납 조건/연체 시 조항', required: false },
  procedure_consent: { label: '사건 진행 동의서', emoji: '📝', signatureRequired: 'client', description: '절차/기간/결과에 대한 이해 확인', required: true },
  id_confirmation: { label: '신분증 사본 제출 확인서', emoji: '🪪', signatureRequired: 'client', description: '본인확인 서류 수령 증빙', required: false },
  spouse_consent: { label: '배우자 동의서', emoji: '👫', signatureRequired: 'client', description: '기혼 의뢰인, 재산 관련 동의', required: false },
  custom: { label: '기타 문서', emoji: '📎', signatureRequired: 'both', description: '사무소별 자체 약정', required: false },
};

export interface ContractDocument {
  id: string;
  type: ContractDocType;
  title: string;
  content: string;
  signatureRequired: 'client' | 'lawyer' | 'both';
  clientSignature?: string;
  lawyerSignature?: string;
  clientSignedAt?: string;
  lawyerSignedAt?: string;
  order: number;
  included: boolean;
}

export interface ElectronicContract {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress?: string;
  lawyerName: string;
  lawFirmName: string;
  assignedLawyerId?: string;
  totalFee: number;
  courtCosts: { creditorCount: number; deliveryFee: number; stampFee: number; miscFee: number };
  feeSchedule: FeeInstallment[];
  documents: ContractDocument[];
  status: ContractStatus;
  contractDate: string;
  identityVerification?: { method: string; verifiedAt: string; ci?: string; deviceInfo: string; ipAddress: string };
  auditTrail: Array<{ action: string; timestamp: string; actor: 'lawyer' | 'client' | 'system'; ip?: string; userAgent?: string; documentHash?: string }>;
  createdAt: string;
  updatedAt: string;
}
