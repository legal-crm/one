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

  // AI 통화 요약 및 녹취 & 실시간 통화/문자 동기화
  aiSummary?: string;                 // AI 통화 요약 및 대화록 원문
  recordings?: RecordingItem[];       // 통화 녹음 파일 목록
  communicationLogs?: CommunicationLog[]; // 스마트폰/시스템 통화 및 문자 내역

  // 계약 및 정산 (수임료/정산 탭)
  contractAt?: string;                // 계약완료일 (정산기준, YYYY-MM-DD)
  installmentMonths?: string;         // 분납 개월 ("완납", "1개월", "2개월"...)
  useCapital?: boolean;               // 캐피탈 사용 여부
  contractFee?: number;               // 총 수임료 (만원)
  depositHistory?: Array<{ date: string; amount: number }>; // 입금 내역 (1차, 2차...)
  deposit1Amount?: number;
  deposit1Date?: string;
  deposit2Amount?: number;
  deposit2Date?: string;

  // 담당 및 이전
  assigneeId?: string;
  assigneeName?: string;
  convertedClientId?: string;         // 이전된 CRM ConsultRequest ID
  convertedAt?: string;
  convertedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 통화 녹음 & 실시간 통화/문자 동기화 Types
// ============================================

export interface RecordingItem {
  id: string;
  filename: string;
  uploadDate: string; // ISO
  url: string; // Google Drive url, Blob URL, or Remote URL
  mimeType: string;
  duration?: number; // seconds
  aiSummary?: string; // 이 회차 녹음의 AI 요약본
  transcriptLines?: any[]; // 이 회차 녹음의 파싱된 화자분리 대화록 라인
  driveFileId?: string; // 구글 드라이브 파일 ID
  accountEmail?: string; // 업로드된 구글 계정 이메일
}

export type CommunicationType = 'CALL_IN' | 'CALL_OUT' | 'CALL_MISSED' | 'SMS_IN' | 'SMS_OUT';

export interface CommunicationLog {
  id: string;
  phoneNumber: string;
  type: CommunicationType;
  duration?: number;      // 통화 시간 (초)
  content?: string;       // 문자 내용
  timestamp: string;      // 발생 일시 (ISO)
  createdAt: string;
  lineInfo?: string;      // '기본' | '투넘버'
  recordingUrl?: string;  // 구글 드라이브 녹취 파일 재생 URL (통화 건별 즉시 재생)
  recordingFilename?: string; // 연결된 녹취 파일명
}

export interface GoogleDriveConfig {
  googleAccountEmail?: string; // 통화 업로드용 구글 계정 이메일 (카카오 로그인 시 별도 입력 가능)
  gasWebAppUrl?: string;       // Google Apps Script Web App 엔드포인트 URL
  folderName?: string;         // 구글 드라이브 보관 폴더명
  autoUpload?: boolean;        // 녹음 선택 시 구글 드라이브 자동 업로드
}

export const AVAILABLE_AI_MODELS = [
  { id: 'gemini-3.5-transcribe', label: 'Gemini 3.5 Transcribe (화자분리 전사+정밀요약 추천)', description: '최신 음성인식 특화. 화자분리(상담원/고객), 타임스탬프, 잡음제거, 전문용어 보정.' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (차세대 추천)', description: '최신 3.5세대 고속 멀티모달. 음성 변환 및 요약에 가장 안정적.' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (초고속 경량)', description: '최신 3.1세대 경량 프리뷰. 대량 처리용 초고속 모델.' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (프리뷰)', description: '3세대 표준 프리뷰.' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (2026.10 종료 예정)', description: '이전 세대 모델. 2026년 10월 서비스 종료 예정.' },
];

export const REHABILITATION_DOMAIN_KEYWORDS = [
  // ── 1. 기본 핵심 용어 ──
  '개인회생', '파산면책', '금지명령', '중지명령', '개시결정', '변제계획안', '변제인가', '면책결정',
  '별제권', '우선변제권', '일반우선채권', '후순위채권', '채권자집회', '보정권고', '보정명령',
  '총 채무액', '원금', '이자', '변제율', '변제기간', '월 변제금', '가용소득', '청산가치',
  '최저생계비', '기준중위소득', '부양가족', '배우자 재산', '임대차보증금', '최우선변제금', '압류', '가압류',
  '독촉', '추심', '신용회복위원회', '워크아웃', '프리워크아웃', '새출발기금', '대부업체', '저축은행',
  '카드론', '현금서비스', '마이너스통장', '담보대출', '신용대출', '햇살론', '사채', '일수',

  // ── [신규 추가 50개] 2. 독촉·추심 및 강제집행 (의뢰인 핵심 고통) ──
  '통장압류', '급여압류', '유체동산압류', '빨간딱지', '지급명령', '이행권고결정',
  '채권추심원', '자택방문', '직장방문', '채무불이행자명부', '신용불량', '연체일수',
  '기한이익상실', '가처분', '경매개시결정',

  // ── [신규 추가 50개] 3. 채무 발생 원인 (상담 필수 소명 항목) ──
  '최근채무', '최근대출', '돌려막기', '주식투자', '코인투자', '가상화폐', '도박채무',
  '스포츠토토', '바카라', '보이스피싱', '투자사기', '리딩방', '사업부도', '폐업',
  '생활비부족', '병원비채무', '명의대여', '보증채무',

  // ── [신규 추가 50개] 4. 소득·직업 증빙 (회생 자격 요건) ──
  '급여명세서', '통장거래내역', '원천징수영수증', '소득금액증명원', '4대보험미가입',
  '일용직현금수령', '프리랜서3.3프로', '재직증명서', '알바소득', '배달라이더',

  // ── [신규 추가 50개] 5. 법원 절차·서류 및 파산관재인 (실무 진행) ──
  '부채증명서', '채권자목록', '계좌소명', '외부회생위원', '면담기일', '송달료',
  '수임료분납', '파산관재인', '관재인면담', '면책불허가사유', '재산은닉'
];

export interface SmsTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingSms {
  id: string;
  phoneNumber: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  createdAt: string;
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
  summaryTemplate?: string;
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
