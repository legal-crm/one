/**
 * 대법원 및 각급 회생법원 표준 개인회생 / 개인파산 진술서 데이터 모델
 */

export type CourtStatementCaseType = 'rehab' | 'bankruptcy';

export interface JobHistoryItem {
  period: string;           // 예: 2020.03 ~ 2023.05
  companyName: string;      // 직장명 또는 상호
  position: string;         // 직위 또는 업종 (예: 대리, 자영업)
  reasonForLeaving: string; // 퇴직 또는 폐업 사유 (예: 회사 경영난 권고사직, 매출 감소 폐업)
}

export interface PastCourtHistory {
  hasPastCase: boolean;                    // 과거 신청 경험 여부
  caseType?: 'rehab' | 'bankruptcy' | 'workout' | 'other';
  caseNumber?: string;                     // 사건번호 (예: 2018개회12345)
  courtOrAgency?: string;                  // 법원명 또는 신용회복위원회 지부
  year?: string;                           // 신청 연도
  resultStatus?: 'discharged' | 'dismissed' | 'revoked' | 'paying'; // 면책, 기각, 폐지, 변제중
  isDischargedElapsed?: boolean;           // 5년(회생)/7년(파산) 경과 여부
}

export interface ResidenceDetail {
  residenceType: 'OWNED' | 'RENT_LEASE' | 'RELATIVE_FREE' | 'NON_RELATIVE_FREE' | 'DORMITORY' | 'OTHER';
  residenceTypeLabel: string;
  deposit: number;                         // 보증금 (원)
  monthlyRent: number;                     // 월세 (원)
  ownerName: string;                       // 주택 소유자
  ownerRelation: string;                   // 소유자와의 관계 (예: 본인, 배우자, 부모, 임대인)
  freeStayReason?: string;                 // 무상거주 사유
  addressSummary?: string;                 // 거주 지역 요약
}

// 8대 면책불허가사유 자가진단 (개인파산 필수)
export interface BankruptcyDisallowanceScreening {
  gamblingOrSpeculation: boolean;          // 1. 도박, 사행행위, 가상자산/주식 과다투기
  fraudulentLoan: boolean;                 // 2. 허위 소득/재직증빙 대출 (신용사기)
  preferentialPayment: boolean;            // 3. 파산 직전 친인척 채무 우선변제
  concealmentOfAssets: boolean;            // 4. 재산 은닉, 명의이전, 헐값처분
  falseCreditorList: boolean;              // 5. 허위 채권자목록 작성 (고의 누락)
  pastDischargeWithinYears: boolean;       // 6. 7년(파산)/5년(회생) 이내 면책 이력
  falseReportToTrustee: boolean;           // 7. 파산관재인에 대한 허위 진술/자료거부
  creditTransactionBeforeFiling: boolean;  // 8. 파산 직전 무리한 신용카드/대출 발생
  notes?: Record<string, string>;          // 소명 메모
}

// 부채 발생 및 채무증대 4단 구조 (진술서의 핵심)
export interface DebtGrowthStory {
  initialCauseKeywords: string[];          // 초기 채무 원인 키워드 (예: ['생활비부족', '사업폐업', '가족의료비'])
  initialCauseDetail: string;              // 1. 채무 발생 초기 경위
  growthProcessDetail: string;             // 2. 채무 증대 및 확대 과정 (돌려막기, 고금리 대출 등)
  insolvencyTriggerDetail: string;         // 3. 지급불능에 이르게 된 결정적 사정 및 시점
  resolutionAndApology: string;            // 4. 현재 생활상황 및 성실한 변제/갱생 다짐
  
  // 고객 입력 원본 및 음성 트랜스크립트
  voiceTranscript?: string;                // 고객이 말로 녹음한 음성 텍스트
  rawCustomerNotes?: string;               // 고객이 입력한 거친 메모/키워드
  
  // 6대 심층 인생 Q&A 인터뷰 답변 (성장환경, 질병, 첫채무, 증대과정, 지급불능, 다짐)
  lifeInterviewAnswers?: {
    upbringing?: string;                   // Q1. 성장 환경 및 가정 배경
    healthAndMedical?: string;             // Q2. 건강 및 질병/간병 사정
    firstDebtCause?: string;               // Q3. 첫 채무 발생 계기
    debtGrowthProcess?: string;            // Q4. 채무 증대 과정
    insolvencyCrisis?: string;             // Q5. 더 이상 갚을 수 없게 된 결정적 순간
    futureResolution?: string;             // Q6. 회생/파산을 통한 재기 다짐
  };

  // Gemini AI 보조 결과물
  aiDraftStatement?: string;               // AI가 생성한 전체 추천 진술서
  aiPolishedAt?: string;                   // AI 생성 일시
  aiToneUsed?: 'formal' | 'emotional' | 'concise'; // 적용된 톤
  aiSafetyCheckFlags?: string[];           // 법적 주의단어 감지 경고 목록
}

export interface CourtStatementData {
  id: string;                              // 고유 ID
  clientId: string;                        // 의뢰인 ID (또는 consultRequestId)
  caseType: CourtStatementCaseType;        // 'rehab' (개인회생) | 'bankruptcy' (개인파산)
  courtName: string;                       // 제출 관할 법원 (예: 서울회생법원)
  
  // 신청인 인적사항
  applicantName: string;
  applicantRrnMasked: string;              // 800101-1******
  applicantPhone: string;
  applicantAddress: string;
  
  // 1. 학력 및 경력
  finalEducation: string;                  // 최종 학력
  jobHistories: JobHistoryItem[];          // 직업 변천사
  
  // 2. 과거 법적 이력
  pastHistory: PastCourtHistory;
  
  // 3. 현재 주거 상황
  residence: ResidenceDetail;
  
  // 4. 채무증대 및 지급불능 경위 (스토리)
  story: DebtGrowthStory;
  
  // 5. 파산 전용 불허가사유 점검 (파산 사건일 경우)
  bankruptcyScreening?: BankruptcyDisallowanceScreening;
  
  // 6. 변호사 감수 및 진행 상태
  status: 'draft' | 'client_completed' | 'lawyer_reviewed' | 'filed_to_court';
  lawyerNotes?: string;                    // 담당 변호사/직원 검토 메모
  lawyerSignatureConfirmed?: boolean;
  
  // 메타데이터
  createdAt: string;
  updatedAt: string;
  deliveredToLawyerAt?: string;            // 변호사 CRM으로 전달된 시점
}

// AI 생성 및 정제 요청 파라미터
export interface GenerateStatementAiPayload {
  caseType: CourtStatementCaseType;
  applicantName?: string;
  rawVoiceOrText: string;                  // 고객의 음성 인식 텍스트 또는 거친 메모
  selectedKeywords?: string[];             // 선택된 원인 키워드
  totalDebtAmount?: number;                // 총 채무액 (만원)
  monthlyIncome?: number;                  // 월 소득 (만원)
  tone?: 'formal' | 'emotional' | 'concise';
  courtName?: string;
  interviewAnswers?: {
    upbringing?: string;                   // Q1. 성장 환경 및 가정 배경
    healthAndMedical?: string;             // Q2. 건강 및 질병/간병 사정
    firstDebtCause?: string;               // Q3. 첫 채무 발생 계기
    debtGrowthProcess?: string;            // Q4. 채무 증대 과정
    insolvencyCrisis?: string;             // Q5. 더 이상 갚을 수 없게 된 결정적 순간
    futureResolution?: string;             // Q6. 회생/파산을 통한 재기 다짐
  };
}

export interface GenerateStatementAiResponse {
  ok: boolean;
  sections: {
    initialCause: string;                  // 1. 채무 발생 원인
    growthProcess: string;                 // 2. 채무 증대 경위
    insolvencyTrigger: string;             // 3. 지급불능 사정
    resolution: string;                    // 4. 성실한 변제/갱생 다짐
  };
  fullFormattedText: string;               // 법원 제출용 통합 완성문
  safetyWarnings: string[];                // 감지된 법적 주의 문구 및 조언
  suggestedKeywords: string[];
}
