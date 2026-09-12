import { IntakeChannel } from '../types';

export type LeadStatus = 
  | 'new'           // 🆕 신규 DB (미접촉)
  | 'no_answer_1'   // 📞 부재중 1차
  | 'no_answer_2'   // 📞 부재중 2차
  | 'no_answer_3'   // 📞 부재중 3차 이상
  | 'callback'      // ⏰ 재통화 예약
  | 'in_progress'   // 💬 1차 상담 통화 중 / 검토
  | 'converted'     // ⭐️ 고객 전환 완료 (CRM 고객관리로 이전됨)
  | 'rejected'      // 🚫 거절 / 단순변심
  | 'ineligible'    // ❌ 자격 미달 (채무 1천만 미만 등)
  | 'wrong_number'; // ⚠️ 결번 / 오류 번호

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  new:          { label: '신규 DB',       emoji: '🆕', color: 'text-blue-600',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
  no_answer_1:  { label: '부재중 1차',     emoji: '📞', color: 'text-amber-600',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200' },
  no_answer_2:  { label: '부재중 2차',     emoji: '📞', color: 'text-orange-600', bgColor: 'bg-orange-50',  borderColor: 'border-orange-200' },
  no_answer_3:  { label: '부재중 3차이상',  emoji: '📵', color: 'text-rose-600',   bgColor: 'bg-rose-50',    borderColor: 'border-rose-200' },
  callback:     { label: '재통화 예약',    emoji: '⏰', color: 'text-purple-600', bgColor: 'bg-purple-50',  borderColor: 'border-purple-200' },
  in_progress:  { label: '1차 상담중',     emoji: '💬', color: 'text-indigo-600', bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-200' },
  converted:    { label: '고객 이전완료',   emoji: '⭐️', color: 'text-emerald-700',bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300' },
  rejected:     { label: '거절/단순변심',   emoji: '🚫', color: 'text-slate-500',  bgColor: 'bg-slate-100',  borderColor: 'border-slate-300' },
  ineligible:   { label: '자격 미달',     emoji: '❌', color: 'text-red-500',    bgColor: 'bg-red-50',     borderColor: 'border-red-200' },
  wrong_number: { label: '결번/오류',     emoji: '⚠️', color: 'text-zinc-500',   bgColor: 'bg-zinc-100',   borderColor: 'border-zinc-300' },
};

export type ReminderType = '통화' | '출장미팅' | '방문미팅' | '입금' | '기타' | '문자';

export interface ReminderItem {
  id: string;
  datetime: string; // "YYYY-MM-DD HH:mm"
  type: ReminderType;
  content?: string;
  isCompleted?: boolean;
  resultStatus?: '완료' | '미연결' | '재예약' | '부재중' | '취소' | '확인';
  resultNote?: string;
  createdAt?: string;
}

export interface CallLog {
  id: string;
  leadId: string;
  calledAt: string;
  callerId: string;
  callerName: string;
  result: 'connected' | 'no_answer' | 'busy' | 'rejected' | 'wrong_number' | 'callback';
  durationSeconds?: number;
  memo?: string;
  callbackScheduledAt?: string;
}

export interface AssetItem {
  id: string;
  owner: '본인' | '배우자' | '배우자 공동명의';
  type: string; // '자가', '자동차', '부동산' 등
  amount: number; // 만원
  loanAmount: number; // 만원
  desc: string;
}

export interface CreditLoanItem {
  id: string;
  desc: string;
  amount: number; // 만원
}

export interface LeadMemoItem {
  id: string;
  content: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
}

export interface LeadStatusLog {
  logId: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  memo?: string;
}

export interface SalesLead {
  id: string;                         // lead-xxx
  customerName: string;               // 고객명
  phone: string;                      // 연락처
  status: LeadStatus;                 // 1차 상태
  secondaryStatus?: string;           // 2차 세부 상태
  tertiaryStatus?: string;            // 3차 세부 상태
  birth: string;                      // 출생년도 ("1985")
  gender: '남' | '여';
  region: string;                     // 거주지역
  inboundPath?: string;               // 유입경로 (DB구매, 제휴랜딩, 네이버광고 등)
  partnerId?: string;                 // 제휴처 ID
  preInfo?: string;                   // 웹 리드 사전 정보
  batchName?: string;                 // DB 업로드 배치명 (예: "2026-09 다음타겟DB 500건")
  caseType?: '개인회생' | '개인파산' | '새출발' | '신용회복' | '미정';

  // 소득 및 직업
  jobTypes: string[];                 // 직업군 ('급여소득', '영업소득', '직장인', '개인사업자' 등)
  insurance4: '가입' | '미가입';
  maritalStatus: '미혼' | '기혼' | '이혼';
  childrenCount?: number;             // 미성년 자녀수
  incomeNet: number;                  // 월 실수령액 (만원)
  loanMonthlyPay: number;             // 월 대출 상환액 (만원)

  // 주거 및 자산
  housingType: '자가' | '전세' | '월세' | '무상거주';
  housingDetail?: string;             // 아파트, 빌라 등
  deposit: number;                    // 보증금 (만원)
  rent: number;                       // 월세 (만원)
  depositLoanAmount?: number;         // 보증금 대출 (만원)
  rentContractor?: '본인' | '배우자';
  ownHousePrice?: number;             // 자가 시세
  ownHouseLoan?: number;              // 담보 대출액
  ownHouseOwner?: '본인' | '배우자' | '배우자 공동명의';
  freeHousingOwner?: string;
  assets: AssetItem[];
  creditLoans?: CreditLoanItem[];     // 신용대출 목록

  // 채무 및 대출
  debtTotal: number;                  // 총 채무액 (만원)
  incomeDetails?: { salary?: number; business?: number; freelance?: number };
  creditCardUse?: '사용' | '미사용';    // 신용카드 사용 여부
  creditCardAmount?: number;          // 신용카드 사용금액 (만원)
  collateralLoanDesc?: string;        // 담보대출 상세
  historyType?: string;               // 과거 회생/파산/회복 유형
  historyMemo?: string;               // 과거 이력 상세 메모
  historyDetail?: string;             // 과거 회생/파산/신복위 이력
  specialMemo: string;                // 특이사항 메모
  memos?: LeadMemoItem[];             // 누적 상담 메모 이력
  statusLogs?: LeadStatusLog[];       // 상태 전이 로그

  // 콜 및 리마인더
  callCount: number;                  // 총 통화 시도 횟수
  lastCallAt?: string;                // 최근 통화 일시
  reminders: ReminderItem[];          // 리마인더 목록
  callLogs: CallLog[];                // 통화 상세 이력

  // 담당 및 이전
  assigneeId?: string;
  assigneeName?: string;
  convertedClientId?: string;         // 이전된 CRM ConsultRequest ID
  convertedAt?: string;
  convertedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// [마스터 설정 관리 타입]
export interface CommissionRule {
  minFee: number;
  maxFee: number;
  commission: number;
  fullPayoutThreshold: number;
  priority: number;
  active: boolean;
}

export interface Partner {
  id: string;
  name: string;
  rules?: CommissionRule[];
  memo?: string;
  createdAt?: string;
}

export interface MissedCallIntervalTier {
  id: string;
  label: string;
  minutes: number;
  color: string;
}

export interface TelegramRoomTarget {
  id: string;
  name: string;
  webhookUrl: string;
  active?: boolean;
}

export interface CustomerBriefingData {
  customerName: string;
  phone: string;
  birthYear: string;
  gender: string;
  region: string;
  job: string;
  insurance4: string;
  maritalStatus: string;
  childrenCount: string;
  income: string;
  loanMonthlyPay: string;
  housingType: string;
  depositRent: string;
  assets: string;
  creditLoan: string;
  collateralLoan: string;
  creditCardUse: string;
  history: string;
  specialMemo: string;
  isAiSource?: boolean;
}
