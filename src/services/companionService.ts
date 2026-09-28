import { 
  RehabCompanionCase, 
  RepaymentRoundItem, 
  LifeCrisisReport, 
  SupportProgram, 
  BankruptcyCompanionCase,
  RepaymentVerificationStatus,
  CompanionSourceType,
  CaseStageType,
  SupportCategoryType,
  CaseOcrParseResult
} from '../types';
import { CourtRepealThreshold } from '../types/courtPetitionTypes';
import { getAuthHeaders } from '../supabaseClient';

const COMPANION_STORAGE_KEY = 'mykim_rehab_companion_case';
const CRISIS_STORAGE_KEY = 'mykim_life_crisis_reports';
const BANKRUPTCY_STORAGE_KEY = 'mykim_bankruptcy_companion_case';

// 데모 시연용으로 과거에 자동 저장되던 가짜 사건 ID — 실제 사용자 데이터로 보이지 않도록 로드 시 폐기
const DEMO_REHAB_CASE_IDS = new Set(['case-demo-2026-001']);
const DEMO_BANKRUPTCY_CASE_IDS = new Set(['bankrupt-demo-001']);

const PAID_STATUSES: RepaymentVerificationStatus[] = ['court_confirmed', 'receipt_uploaded', 'self_marked'];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 화면·위험도 판정용 실제 상태
 * - 납부일이 지났는데 납부 기록이 없으면 '확인 필요(미납 의심)'로 본다 (저장값은 바꾸지 않음)
 */
export function getEffectiveRoundStatus(item: RepaymentRoundItem, today: string = todayYmd()): RepaymentVerificationStatus {
  if (item.status === 'pending' && item.dueDate && item.dueDate < today) return 'overdue_check_needed';
  return item.status;
}

/**
 * 36~60개월 변제 스케줄 생성
 * - 사용자가 "이미 납부한 회차 수"를 입력한 경우 그 회차들은 '고객 표시(self_marked)'로만 기록한다.
 *   (기존: 1~13회차를 무조건 '법원 확인', 14회차에 가짜 이체확인증 파일명, 15회차 이후는 입력해도 미반영)
 */
export function generateRepaymentSchedules(
  startYearMonth: string, // 'YYYY-MM'
  totalRounds: number,
  monthlyAmount: number,
  repaymentDay: number,
  initialCompletedRounds: number = 0
): RepaymentRoundItem[] {
  const [startYear, startMonth] = (startYearMonth || '').split('-').map(Number);
  if (!startYear || !startMonth || !totalRounds || totalRounds < 1) return [];
  const day = Math.min(28, Math.max(1, repaymentDay || 1)); // 29~31일 지정 시 짧은 달 날짜 오류 방지
  const items: RepaymentRoundItem[] = [];

  for (let i = 1; i <= totalRounds; i++) {
    const monthIndex = startMonth - 1 + (i - 1);
    const y = startYear + Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selfDeclared = i <= initialCompletedRounds;
    items.push({
      round: i,
      dueDate,
      scheduledAmount: monthlyAmount,
      actualPaidAmount: selfDeclared ? monthlyAmount : undefined,
      paidDate: undefined,
      status: selfDeclared ? 'self_marked' : 'pending',
    });
  }
  return items;
}

function readCase<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function scopedKey(base: string, clientId?: string) {
  return clientId ? `${base}_${clientId}` : base;
}

/** 저장된 회생동행 사건 (없으면 null — 데모 사건을 사용자 사건처럼 보여주지 않는다) */
export function loadRehabCompanionCase(clientId?: string): RehabCompanionCase | null {
  const keys = clientId ? [scopedKey(COMPANION_STORAGE_KEY, clientId), COMPANION_STORAGE_KEY] : [COMPANION_STORAGE_KEY];
  for (const key of keys) {
    const parsed = readCase<RehabCompanionCase>(key);
    if (!parsed) continue;
    if (DEMO_REHAB_CASE_IDS.has(parsed.id)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      continue;
    }
    // 다른 의뢰인에게 연결된 전역 사본은 사용하지 않음
    if (key === COMPANION_STORAGE_KEY && clientId && parsed.clientId && parsed.clientId !== clientId) continue;
    return {
      ...parsed,
      cashflow: {
        monthlyIncome: 0, essentialLivingCost: 0, repaymentAmount: parsed.monthlyRepaymentAmount || 0, otherFixedExpenses: 0,
        ...(parsed.cashflow || {}),
      },
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  }
  return null;
}

/** @deprecated loadRehabCompanionCase(clientId) 사용 */
export function loadRehabCompanionCaseForClient(clientId?: string): RehabCompanionCase | null {
  return loadRehabCompanionCase(clientId);
}

// 회생동행 사건 저장 (의뢰인 ID가 있으면 의뢰인별 키에 저장 — 조회 키와 저장 키를 일치시킴)
export function saveRehabCompanionCase(caseData: RehabCompanionCase, clientId?: string): void {
  const cid = clientId || caseData.clientId;
  try {
    const serialized = JSON.stringify({ ...caseData, clientId: cid, updatedAt: new Date().toISOString() });
    localStorage.setItem(scopedKey(COMPANION_STORAGE_KEY, cid), serialized);
  } catch (err) {
    console.error('Error saving companion case:', err);
  }
}

/**
 * 변호사 CRM 등록 데이터(사건번호, 개시결정 요약, 가상계좌 등)를 의뢰인 동행 대시보드로 동기화
 * - 의뢰인이 기록한 회차별 납부 상태·영수증·생계 밸런서 값은 보존한다 (기존: 이벤트마다 스케줄을 새로 만들어 납부 기록이 지워짐)
 * - 값이 없는 항목은 임의 금액(월 변제금 50만, 소득 250만 등)으로 채우지 않는다
 */
export function syncCompanionWithCrmCase(
  clientId: string,
  crmExt: any,
  clientName: string = '의뢰인'
): RehabCompanionCase {
  const existing = loadRehabCompanionCase(clientId);
  const ds = crmExt.decisionSummary || {};
  const courtName = crmExt.courtCase?.courtName || ds.courtName || existing?.courtName || '';
  const realCaseNumber = crmExt.courtCase?.caseNumber || ds.caseNumber || '';
  const caseNumberMasked = realCaseNumber
    ? (realCaseNumber.length > 6 ? `${realCaseNumber.slice(0, -4)}****` : realCaseNumber)
    : '접수 준비중';
  const monthlyRepayment = Number(ds.monthlyPayment || crmExt.repaymentPlan?.monthlyPayment || 0);
  const courtAccount = ds.courtVirtualAccount || crmExt.courtCase?.courtVirtualAccount || '';
  const totalRounds = Number(ds.totalRounds || crmExt.repaymentPlan?.totalRounds || 0);

  let startYearMonth = '';
  let repaymentDay = 0;
  if (ds.firstPaymentDate) {
    startYearMonth = String(ds.firstPaymentDate).slice(0, 7);
    const d = parseInt(String(ds.firstPaymentDate).split('-')[2], 10);
    if (!isNaN(d)) repaymentDay = d;
  }

  const stage = crmExt.thirteenStage || crmExt.crmStatus;
  let companionStage: CaseStageType = 'submitted';
  if (stage === 'confirmation' || stage === 'repaying') companionStage = 'approved';
  else if (stage === 'commencement' || stage === 'commenced' || stage === 'prohibition_order') companionStage = 'started';

  // 조건이 같으면 기존 스케줄(납부 기록 포함) 유지, 조건이 바뀌면 새로 만들되 회차별 납부 기록은 옮겨 담는다
  const fresh = startYearMonth && totalRounds && monthlyRepayment
    ? generateRepaymentSchedules(startYearMonth, totalRounds, monthlyRepayment, repaymentDay || 1, 0)
    : [];
  const prevByRound = new Map((existing?.schedules || []).map(s => [s.round, s]));
  const schedules = fresh.length > 0
    ? fresh.map(s => {
        const prev = prevByRound.get(s.round);
        return prev && prev.status !== 'pending'
          ? { ...s, status: prev.status, actualPaidAmount: prev.actualPaidAmount, paidDate: prev.paidDate, receiptName: prev.receiptName, receiptDataUrl: prev.receiptDataUrl, memo: prev.memo }
          : s;
      })
    : (existing?.schedules || []);
  const completedRounds = schedules.filter(s => PAID_STATUSES.includes(s.status)).length;

  const assignedLawyerName = ds.assignedLawyerName || crmExt.assignedLawyerName || existing?.assignedLawyerName || '';

  const syncedCase: RehabCompanionCase = {
    id: existing?.id || `case-crm-${clientId}`,
    clientId,
    alias: clientName,
    sourceType: 'mykim_lawyer',
    caseType: 'individual_rehab',
    caseStage: companionStage,
    courtName,
    caseNumber: realCaseNumber,
    caseNumberMasked,
    monthlyRepaymentAmount: monthlyRepayment,
    repaymentDay: repaymentDay || existing?.repaymentDay || 0,
    totalRounds: totalRounds || schedules.length,
    completedRounds,
    startRepaymentDate: startYearMonth || existing?.startRepaymentDate || '',
    courtVirtualAccount: courtAccount,
    assignedLawyerName,
    cashflow: {
      monthlyIncome: existing?.cashflow?.monthlyIncome || Number(ds.monthlyIncome || 0),
      essentialLivingCost: existing?.cashflow?.essentialLivingCost || Number(ds.essentialLivingCost || 0),
      repaymentAmount: monthlyRepayment,
      otherFixedExpenses: existing?.cashflow?.otherFixedExpenses || 0,
    },
    schedules,
    documents: existing?.documents || [],
    notificationLevel: existing?.notificationLevel || 'basic',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveRehabCompanionCase(syncedCase, clientId);
  return syncedCase;
}

// 신규 사건 등록 (타 사무소 / 나홀로 / 마이김변) — 입력하지 않은 값을 임의 금액으로 채우지 않는다
export function registerNewCompanionCase(params: {
  alias: string;
  clientId?: string;
  sourceType: CompanionSourceType;
  externalOfficeName?: string;
  caseType: 'individual_rehab' | 'bankruptcy';
  caseStage?: CaseStageType;
  courtName: string;
  caseNumber: string;
  monthlyRepaymentAmount: number;
  repaymentDay: number;
  totalRounds: number;
  completedRounds: number;
  startRepaymentDate: string;
  courtVirtualAccount?: string;
  monthlyIncome?: number;
  essentialLivingCost?: number;
  otherFixedExpenses?: number;
}): RehabCompanionCase {
  const maskedNumber = params.caseNumber.length > 6
    ? `${params.caseNumber.slice(0, -4)}****`
    : params.caseNumber;

  const schedules = generateRepaymentSchedules(
    params.startRepaymentDate,
    params.totalRounds,
    params.monthlyRepaymentAmount,
    params.repaymentDay,
    params.completedRounds || 0
  );

  const newCase: RehabCompanionCase = {
    id: `case-${Date.now()}`,
    clientId: params.clientId,
    alias: params.alias || '회원',
    sourceType: params.sourceType,
    externalOfficeName: params.externalOfficeName,
    caseType: 'individual_rehab',
    caseStage: params.caseStage || (params.completedRounds > 0 ? 'approved' : 'submitted'),
    courtName: params.courtName,
    caseNumber: params.caseNumber,
    caseNumberMasked: maskedNumber,
    monthlyRepaymentAmount: params.monthlyRepaymentAmount,
    repaymentDay: params.repaymentDay,
    totalRounds: params.totalRounds,
    completedRounds: schedules.filter(s => PAID_STATUSES.includes(s.status)).length,
    startRepaymentDate: params.startRepaymentDate,
    courtVirtualAccount: params.courtVirtualAccount,
    cashflow: {
      monthlyIncome: params.monthlyIncome || 0,
      essentialLivingCost: params.essentialLivingCost || 0,
      repaymentAmount: params.monthlyRepaymentAmount,
      otherFixedExpenses: params.otherFixedExpenses || 0,
    },
    schedules,
    documents: [],
    notificationLevel: 'basic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveRehabCompanionCase(newCase, params.clientId);
  return newCase;
}

/** 파산 사건 등록 — 절차 단계만 만들고 날짜·관재인은 비워 둔다 (사용자·사무소가 입력) */
export function registerNewBankruptcyCase(params: {
  alias: string;
  clientId?: string;
  sourceType: CompanionSourceType;
  externalOfficeName?: string;
  courtName: string;
  caseNumber: string;
  caseStage?: CaseStageType;
}): BankruptcyCompanionCase {
  const stageIndex = params.caseStage === 'approved' || params.caseStage === 'started' ? 1 : 0;
  const stages = [
    ['파산 및 면책 신청서 접수', '법원에 파산·면책 신청서를 접수하는 단계'],
    ['파산선고 및 파산관재인 선임', '법원의 파산선고와 파산관재인 선임'],
    ['채권자집회 및 채권조사', '채권자집회 출석 및 관재인 조사'],
    ['재산 환가·배당 및 소명', '관재인의 재산 조사·환가와 추가 소명'],
    ['면책 심문', '면책불허가 사유 유무 심리'],
    ['면책 결정', '면책 결정 및 확정'],
  ];
  const newCase: BankruptcyCompanionCase = {
    id: `bk-${Date.now()}`,
    alias: params.alias || '회원',
    sourceType: params.sourceType,
    externalOfficeName: params.externalOfficeName,
    courtName: params.courtName,
    caseNumber: params.caseNumber,
    caseNumberMasked: params.caseNumber.length > 6 ? `${params.caseNumber.slice(0, -4)}****` : params.caseNumber,
    timelines: stages.map(([name, desc], i) => ({
      id: `t-${i + 1}`,
      stageName: name,
      description: desc,
      status: i < stageIndex ? 'completed' : i === stageIndex ? 'in_progress' : 'pending',
    })),
    documents: [],
    notificationLevel: 'basic',
    createdAt: new Date().toISOString(),
  };
  saveBankruptcyCase(newCase, params.clientId);
  return newCase;
}

// 회차별 납부 상태 업데이트 & 영수증 등록
export function updateRepaymentRound(
  round: number,
  status: RepaymentVerificationStatus,
  receipt?: { name: string; dataUrl: string },
  memo?: string,
  clientId?: string
): RehabCompanionCase | null {
  const currentCase = loadRehabCompanionCase(clientId);
  if (!currentCase) return null;
  const isPaid = PAID_STATUSES.includes(status);

  const updatedSchedules = currentCase.schedules.map(item => {
    if (item.round !== round) return item;
    return {
      ...item,
      status,
      actualPaidAmount: isPaid ? item.scheduledAmount : undefined,
      paidDate: isPaid ? (item.paidDate || todayYmd()) : undefined,
      receiptName: receipt ? receipt.name : item.receiptName,
      receiptDataUrl: receipt ? receipt.dataUrl : item.receiptDataUrl,
      memo: memo !== undefined ? memo : item.memo,
    };
  });

  const updatedCase: RehabCompanionCase = {
    ...currentCase,
    schedules: updatedSchedules,
    completedRounds: updatedSchedules.filter(s => PAID_STATUSES.includes(s.status)).length,
    updatedAt: new Date().toISOString(),
  };

  saveRehabCompanionCase(updatedCase, clientId || currentCase.clientId);
  return updatedCase;
}

// 생활위기 SOS 기록 (이 기기에 저장 — 담당 변호사 전달은 호출부에서 CRM 동기화 결과로 안내)
export function submitLifeCrisisReport(report: Omit<LifeCrisisReport, 'id' | 'createdAt' | 'status'>): LifeCrisisReport {
  const newReport: LifeCrisisReport = {
    ...report,
    id: `crisis-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'submitted',
  };

  try {
    const existing = loadLifeCrisisReports();
    localStorage.setItem(CRISIS_STORAGE_KEY, JSON.stringify([newReport, ...existing]));
  } catch (err) {
    console.error('Error saving crisis report:', err);
  }

  return newReport;
}

export function loadLifeCrisisReports(): LifeCrisisReport[] {
  try {
    const raw = localStorage.getItem(CRISIS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading crisis reports:', err);
  }
  return [];
}

// ═══════════════════════════════════════════════
// 대법원 나의 사건검색 딥링크 생성기 (공식 연계 가이드)
// ═══════════════════════════════════════════════

export interface CourtSearchLinkInfo {
  mobileUrl: string;
  webUrl: string;
  copySummaryText: string;
  courtName: string;
  caseNumber: string;
  tips: string[];
}

export function getCourtSearchDeepLink(courtName: string, caseNumber: string): CourtSearchLinkInfo {
  const cleanNumber = (caseNumber || '').trim();
  const cleanCourt = (courtName || '서울회생법원').trim();

  return {
    mobileUrl: 'https://m.scourt.go.kr',
    webUrl: 'https://www.scourt.go.kr/portal/information/events/search/search.jsp',
    copySummaryText: `${cleanCourt} ${cleanNumber}`,
    courtName: cleanCourt,
    caseNumber: cleanNumber,
    tips: [
      '대법원 대국민서비스 공식 사이트에서 실시간 사건 진행 내역(송달, 기일 등)을 조회할 수 있습니다.',
      '사건번호와 성명, 화면에 표시되는 자동입력 방지문자(숫자 6자리)를 입력하시면 즉시 열람 가능합니다.',
      '확인된 변제계획 변경이나 기일 변동사항은 마이김변 캘린더에 간편하게 동기화해 두세요.'
    ]
  };
}

// ═══════════════════════════════════════════════
// 스마트 법원 문서 OCR 파서 (실제 AI Vision 백엔드 /api/ocr-case 연동)
// ═══════════════════════════════════════════════

export async function parseCaseDocumentOcr(file: File): Promise<CaseOcrParseResult> {
  const fileName = file.name;

  try {
    // 파일을 Base64 Data URL로 변환
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 백엔드 AI OCR 서버리스 엔드포인트 호출 (/api/ocr-case)
    const authHeaders = await getAuthHeaders();
    const apiRes = await fetch('/api/ocr-case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        fileName
      })
    });

    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.ok && json.result) {
        return json.result;
      }
    }
  } catch (err) {
    console.warn('[Real OCR Backend Call Failed, using local heuristic]', err);
  }

  // AI 판독 실패·미설정: 파일 이름으로 사건 정보를 지어내지 않고 실패로 안내 (기존: 파일명에 '인가'가 있으면 가짜 사건번호·가상계좌 반환)
  return {
    isValidCourtDoc: false,
    recognitionStatus: 'unreadable',
    failureReason: '서류를 자동으로 읽지 못했습니다.',
    guidance: '사건번호와 변제 조건을 직접 입력해 주세요.',
    confidenceScore: 0,
    detectedDocType: 'unknown',
    extractedHighlights: []
  };
}

// ═══════════════════════════════════════════════
// 공공데이터 실시간 연동 헬퍼 (/api/benefits)
// ═══════════════════════════════════════════════

export async function fetchLiveBenefitsFromApi(
  stage: string = 'approved',
  category: string = 'all',
  region: string = 'all',
  completedRounds: number = 0
): Promise<{ programs: SupportProgram[]; isLiveApi: boolean; message?: string }> {
  try {
    const query = new URLSearchParams({
      stage,
      category,
      region,
      completedRounds: String(completedRounds)
    });

    const res = await fetch(`/api/benefits?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.isLiveApi && Array.isArray(data.programs) && data.programs.length > 0) {
        return { programs: data.programs, isLiveApi: true };
      }
    }
  } catch (err) {
    console.warn('[Live Benefits Fetch Failed, Using Curated Base]', err);
  }

  return { programs: OFFICIAL_SUPPORT_PROGRAMS, isLiveApi: false };
}

// ═══════════════════════════════════════════════
// 변제금 미납 & 폐지 위험도 진단
// ═══════════════════════════════════════════════

export interface OverdueRiskEvaluation {
  overdueCount: number;
  unpaidRoundNumbers: number[];
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger_repeal_risk';
  message: string;
  recommendedAction: string;
  courtThreshold: CourtRepealThreshold;
  stageInfo: {
    stageNumber: 1 | 2 | 3;
    stageName: string;
    description: string;
    actionTip: string;
  };
}

/**
 * 법원별 미납 폐지 실무 기준 조회
 * - 서울회생법원: 실무상 4~5회 연체 시까지 유예/독촉 기회 부여 (유연)
 * - 수원/부산회생법원: 3회 이상 연체 시 폐지 착수 (보통)
 * - 기타 지방법원: 3회 연체 즉시 엄격 직권 폐지 심리 (엄격)
 */
export function getCourtRepealStandard(courtName: string = ''): CourtRepealThreshold {
  const norm = (courtName || '').trim();
  if (norm.includes('서울')) {
    return {
      courtName: '서울회생법원',
      cautionRounds: 2,
      warningRounds: 3,
      repealRiskRounds: 4,
      leniencyLevel: 'HIGH_FLEXIBLE',
      description: '참고용 일반 경향: 서울회생법원은 연체 초기에 독촉·소명 기회를 주는 경우가 많습니다. 실제 처리는 재판부와 사정에 따라 다릅니다.',
      goldenTimeNotice: '폐지결정에 불복하려면 즉시항고 기간(공고가 있으면 공고일부터 14일) 안에 제기해야 합니다. 인용 여부는 법원이 판단합니다.'
    };
  }
  if (norm.includes('수원') || norm.includes('부산')) {
    const name = norm.includes('수원') ? '수원회생법원' : '부산회생법원';
    return {
      courtName: name,
      cautionRounds: 2,
      warningRounds: 3,
      repealRiskRounds: 3,
      leniencyLevel: 'MODERATE',
      description: `참고용 일반 경향: ${name}은 3회 안팎 연체 시 폐지 절차를 검토하는 경우가 있습니다. 실제 처리는 재판부와 사정에 따라 다릅니다.`,
      goldenTimeNotice: '폐지결정에 불복하려면 즉시항고 기간(공고가 있으면 공고일부터 14일) 안에 제기해야 합니다. 인용 여부는 법원이 판단합니다.'
    };
  }
  return {
    courtName: norm || '지방법원',
    cautionRounds: 1,
    warningRounds: 2,
    repealRiskRounds: 3,
    leniencyLevel: 'STRICT',
    description: '참고용 일반 경향: 지방법원은 연체 누적에 비교적 엄격한 경우가 있습니다. 실제 처리는 재판부와 사정에 따라 다릅니다.',
    goldenTimeNotice: '폐지결정에 불복하려면 즉시항고 기간(공고가 있으면 공고일부터 14일) 안에 제기해야 합니다. 인용 여부는 법원이 판단합니다.'
  };
}

export function evaluateOverdueRisk(caseData: RehabCompanionCase): OverdueRiskEvaluation {
  // 저장된 '확인 필요' + 납부일이 지났는데 납부 기록이 없는 회차 (기존: 수동 지정한 경우만 집계 → 경보가 사실상 뜨지 않음)
  const overdueRounds = (caseData.schedules || []).filter(s => getEffectiveRoundStatus(s) === 'overdue_check_needed');
  const count = overdueRounds.length;
  const roundNumbers = overdueRounds.map(r => r.round);
  const threshold = getCourtRepealStandard(caseData.courtName);

  if (count >= 4 || (count >= 3 && threshold.leniencyLevel === 'STRICT')) {
    return {
      overdueCount: count,
      unpaidRoundNumbers: roundNumbers,
      riskLevel: 'danger_repeal_risk',
      courtThreshold: threshold,
      stageInfo: {
        stageNumber: 3,
        stageName: '폐지 위험 (기준 도달)',
        description: `법원의 개인회생 직권 폐지 결정 위험 임계치(${threshold.courtName} 기준 ${threshold.repealRiskRounds}회)를 초과했습니다.`,
        actionTip: '미납금 즉시 분납 또는 긴급 변제계획 변경신청·특별면책 검토가 시급합니다.'
      },
      message: `🚨 변제금 ${count}회차 미납: ${threshold.courtName} 직권 폐지 결정 위험이 최고조에 달했습니다.`,
      recommendedAction: '즉시 담당 변호사와 상의해 미납금 납부, 변제계획 변경신청, 요건이 되면 면책 신청(법 제624조 제2항) 가능 여부를 검토하세요.'
    };
  } else if (count >= 3) {
    return {
      overdueCount: count,
      unpaidRoundNumbers: roundNumbers,
      riskLevel: 'warning',
      courtThreshold: threshold,
      stageInfo: {
        stageNumber: 2,
        stageName: '경고 (3회)',
        description: '법원의 개인회생 폐지 예고 통지서가 발송되는 위험 단계입니다.',
        actionTip: '가능한 범위에서 가상계좌로 분할 입금하거나 급여감소 등 사정변경 소명을 준비하세요.'
      },
      message: `⚠️ 변제금 3회차 미납 경고: ${threshold.courtName} 폐지예고 통지서 발송 단계입니다.`,
      recommendedAction: '가능한 금액부터 가상계좌로 입금하고, 소득이 줄었다면 담당 변호사와 변제계획 변경신청을 검토하세요. (분납 가능 여부는 법원·회생위원 안내에 따릅니다)'
    };
  } else if (count >= 1) {
    return {
      overdueCount: count,
      unpaidRoundNumbers: roundNumbers,
      riskLevel: 'caution',
      courtThreshold: threshold,
      stageInfo: {
        stageNumber: 1,
        stageName: '주의 (1~2회)',
        description: '납부일이 지났는데 납부 기록이 없는 회차가 있습니다.',
        actionTip: '이미 납부했다면 이체확인증을 등록해 기록을 정리해 주세요.'
      },
      message: `⚡ 납부 확인이 안 된 회차 ${count}건: 실제로 냈다면 영수증을 등록하고, 못 냈다면 누적되기 전에 담당 변호사와 상의하세요.`,
      recommendedAction: '법원 가상계좌로 분할 납부하시거나 이번 달 생활위기 SOS를 통해 사전 납부대책을 수립하세요.'
    };
  }

  return {
    overdueCount: 0,
    unpaidRoundNumbers: [],
    riskLevel: 'safe',
    courtThreshold: threshold,
    stageInfo: {
      stageNumber: 1,
      stageName: '안전 (0회)',
      description: '정상 성실 변제 수행 중',
      actionTip: '매월 지정일 자동이체 유지 및 대법원 나의사건검색 대조를 권장합니다.'
    },
    message: '🟢 납부일이 지난 미기록 회차가 없습니다.',
    recommendedAction: '정기적인 납부일 확인과 영수증 등록을 유지해 주세요.'
  };
}

// ═══════════════════════════════════════════════
// 공적 복지·채무지원·성실상환 금융 데이터 (5대 카테고리 16개 제도)
// ═══════════════════════════════════════════════

export const OFFICIAL_SUPPORT_PROGRAMS: SupportProgram[] = [
  // ── 1순위: 무상·긴급 복지 지원 ──
  {
    id: 'welfare-1',
    priority: 1,
    category: 'welfare_emergency',
    badge: '정부 긴급복지',
    title: '보건복지부 긴급복지지원제도 (생계·의료·주거)',
    subtitle: '갑작스러운 실직, 질병, 휴·폐업 등으로 생계유지가 곤란한 가구 대상 무상 지원',
    organization: '보건복지부 / 관할 시·군·구청',
    eligibility: '기준 중위소득 75% 이하 & 금융재산 600만 원(주거 800만 원) 이하',
    benefit: '가구원 수별 생계지원금, 의료·주거 지원 (지원 금액·기간은 매년 보건복지부 고시로 정해짐 — 129 문의)',
    contactNumber: '보건복지상담센터 129',
    officialUrl: 'https://www.bokjiro.go.kr',
    targetStages: ['preparing', 'submitted', 'correction', 'started', 'approved'],
    criteriaTags: ['생계위기', '실직', '의료비'],
    safetyNotice: '긴급복지지원법에 따른 지자체 현장조사 후 지급 여부가 결정됩니다.'
  },
  {
    id: 'welfare-2',
    priority: 1,
    category: 'welfare_emergency',
    badge: '구직소득 보장',
    title: '고용노동부 국민취업지원제도 (I유형)',
    subtitle: '취업지원 서비스와 함께 구직기간 중 안정적인 생계소득 지원',
    organization: '고용노동부 고용복지플러스센터',
    eligibility: '15~69세 구직자 중 가구 중위소득 60% 이하 & 재산 4억 원 이하',
    benefit: '구직촉진수당 (월 지급액·기간은 해당 연도 기준 — 고용노동부 1350 문의)',
    contactNumber: '고용노동부 고객상담센터 1350',
    officialUrl: 'https://www.kua.go.kr',
    targetStages: ['preparing', 'submitted', 'started', 'approved', 'completed'],
    criteriaTags: ['구직자', '소득안정', '취업지원']
  },
  {
    id: 'welfare-3',
    priority: 1,
    category: 'welfare_emergency',
    badge: '지자체 긴급생계',
    title: '지자체형 긴급복지 지원사업 (서울형 / 경기형)',
    subtitle: '국가 긴급복지 요건에 아쉽게 미달한 위기가구를 위한 지자체 자체 무상 생계비',
    organization: '서울특별시 / 경기도 등 지자체 주민센터',
    eligibility: '기준 중위소득 85%~100% 이하 (지자체별 상이) 및 위기상황 발생 가구',
    benefit: '가구원수별 긴급 생계비 및 난방비 30~100만 원 내외 1회~3회 지원',
    contactNumber: '관할 주민센터 또는 다산콜 120',
    officialUrl: 'https://www.bokjiro.go.kr',
    targetStages: ['preparing', 'submitted', 'correction', 'approved'],
    region: '서울/경기',
    criteriaTags: ['지역특화', '소득감소']
  },

  // ── 2순위: 공적 채무·신용 지원 ──
  {
    id: 'credit-1',
    priority: 2,
    category: 'public_debt_credit',
    badge: '공적 채무상담',
    title: '신용회복위원회 채무조정 & 복합지원 연계',
    subtitle: '개인회생 변제수행 중 위기상황 발생 시 채무상담 및 복지·고용 복합 연계',
    organization: '신용회복위원회',
    eligibility: '채무 문제로 어려움을 겪는 금융소비자 누구나',
    benefit: '전문 신용상담원 1:1 맞춤 상담, 일자리 연계, 복지제도 원스톱 연결',
    contactNumber: '신용회복위원회 1600-5500',
    officialUrl: 'https://www.ccrs.or.kr',
    targetStages: ['preparing', 'submitted', 'correction', 'started', 'approved']
  },
  {
    id: 'credit-2',
    priority: 2,
    category: 'public_debt_credit',
    badge: '무료 법률구조',
    title: '대한법률구조공단 개인회생·파산 법률구조',
    subtitle: '경제적으로 어렵거나 법을 몰라 법적 보호를 받지 못하는 국민 대상 법률지원',
    organization: '대한법률구조공단',
    eligibility: '기준 중위소득 125% 이하 국민, 기초생활수급자, 차상위계층 등',
    benefit: '무료 법률상담 및 소송대리, 변제계획 변경 등 법률구조 지원',
    contactNumber: '국번없이 132',
    officialUrl: 'https://www.klac.or.kr',
    targetStages: ['preparing', 'correction', 'started', 'approved']
  },
  {
    id: 'credit-3',
    priority: 2,
    category: 'public_debt_credit',
    badge: '불법추심 차단',
    title: '금융감독원 불법사금융 피해신고 & 채무자대리인 무료지원',
    subtitle: '고금리 불법사금융, 불법 채권추심으로부터 채무자를 무료 변호사가 보호',
    organization: '금융감독원 / 대한법률구조공단',
    eligibility: '미등록 대부업자 또는 불법추심 피해를 입은 채무자',
    benefit: '무료 변호사를 채무자대리인으로 선임하여 추심 전면 차단 및 손해배상 소송 지원',
    contactNumber: '금융감독원 1332',
    officialUrl: 'https://www.fss.or.kr',
    targetStages: ['preparing', 'submitted', 'correction']
  },
  {
    id: 'credit-4',
    priority: 2,
    category: 'public_debt_credit',
    badge: '압류 방어 계좌',
    title: '행복지킴이통장 (압류방지 전용통장 제도)',
    subtitle: '기초생활수급비, 긴급복지급여, 아동수당 등이 법적으로 원천 압류되지 않는 전용 계좌',
    organization: '시중은행 16개사 / 우체국 / 상호금융',
    eligibility: '기초생활수급자, 기초연금, 긴급복지 수급자 등 법정 급여 수급권자',
    benefit: '법원 압류명령 대상에서 법률상 원천 제외, 생계비 185만 원 이하 법정 보호',
    contactNumber: '각 거래은행 고객센터',
    officialUrl: 'https://www.bokjiro.go.kr',
    targetStages: ['preparing', 'submitted', 'correction', 'started', 'approved']
  },

  // ── 3순위: 성실상환자 정책금융 ──
  {
    id: 'loan-1',
    priority: 3,
    category: 'diligent_repayment_loan',
    badge: '성실상환 특례대출',
    title: '서민금융진흥원 개인회생 성실상환자 소액대출 (공식 제도)',
    subtitle: '법원 개인회생 변제계획을 인가받아 일정 기간 이상 미납 없이 성실히 납부한 분을 위한 공적 상품',
    organization: '서민금융진흥원 (KINFA)',
    eligibility: '개인회생 인가 후 6개월 이상 성실하게 변제금을 납부 중이거나 최근 3년 이내 완제한 분',
    benefit: '연 2~4%대 저금리, 생활안정자금/의료비/학자금 등 최대 700만 원 (심사 거쳐 결정)',
    contactNumber: '서민금융콜센터 1397',
    officialUrl: 'https://www.kinfa.or.kr',
    targetStages: ['approved', 'completed'],
    minCompletedRounds: 6,
    criteriaTags: ['성실납부6회이상', '저금리공적대출'],
    safetyNotice: '공개된 공적 기준에 따른 안내이며, 서민금융진흥원 자체 심사 결과에 따라 지원 여부가 최종 결정됩니다.'
  },
  {
    id: 'loan-2',
    priority: 3,
    category: 'diligent_repayment_loan',
    badge: '공적 소액금융',
    title: '신용회복위원회 소액금융지원 (성실상환자)',
    subtitle: '채무조정 확정 후 성실 상환 중인 분 대상 긴급 생활안정자금',
    organization: '신용회복위원회',
    eligibility: '신복위 채무조정 6개월 이상 상환자 또는 법원 개인회생 18~24개월 이상 성실납부자',
    benefit: '연 2.0~3.5% 저금리 소액대출, 최장 5년 분할상환',
    contactNumber: '신용회복위원회 1600-5500',
    officialUrl: 'https://www.ccrs.or.kr',
    targetStages: ['approved'],
    minCompletedRounds: 18,
    criteriaTags: ['성실납부18회이상', '긴급생계']
  },
  {
    id: 'loan-3',
    priority: 3,
    category: 'diligent_repayment_loan',
    badge: '근로자 생활안정',
    title: '근로복지공단 근로자 생활안정자금 융자',
    subtitle: '저소득 취약근로자 및 특수형태근로종사자를 위한 무담보 초저금리 생활자금 대출',
    organization: '근로복지공단',
    eligibility: '월평균 소득 315만 원 이하 근로자 (3개월 이상 재직)',
    benefit: '연 1.5% 초저금리, 의료비·혼례비·장례비 등 종목별 1,000~2,000만 원 한도',
    contactNumber: '근로복지공단 1588-0075',
    officialUrl: 'https://www.comwel.or.kr',
    targetStages: ['approved', 'completed'],
    criteriaTags: ['직장인', '재직자', '초저금리']
  },

  // ── 4순위: 생활비·공과금 감면 ──
  {
    id: 'cost-1',
    priority: 4,
    category: 'cost_reduction',
    badge: '전기요금 복지할인',
    title: '한국전력공사 취약계층 전기요금 감면',
    subtitle: '기초생활수급자, 차상위계층 및 대가족/출산가구 대상 매월 전기요금 정액 감면',
    organization: '한국전력공사 (한전)',
    eligibility: '기초생활수급자, 차상위계층, 장애인, 3자녀 이상 가구',
    benefit: '주거용 전기요금 월 최대 16,000원~20,000원 감면 (하절기 추가 할인)',
    contactNumber: '한전 고객센터 123',
    officialUrl: 'https://cyber.kepco.co.kr',
    targetStages: ['submitted', 'started', 'approved', 'completed'],
    criteriaTags: ['고정비절감', '공과금']
  },
  {
    id: 'cost-2',
    priority: 4,
    category: 'cost_reduction',
    badge: '통신비 복지감면',
    title: '이동통신 3사 취약계층 통신요금 감면 제도',
    subtitle: 'SKT, KT, LGU+ 이동전화 기본료 및 통화료 감면으로 통신비 부담 경감',
    organization: '과학기술정보통신부 / 통신 3사',
    eligibility: '생계·의료·주거·교육급여 수급자 및 차상위계층, 기초연금수급자',
    benefit: '기본료 최대 26,000원 감면 및 통화료 50% 할인 (월 최대 33,500원 감면)',
    contactNumber: '통신사 전용 감면센터 1523 또는 114',
    officialUrl: 'https://www.bokjiro.go.kr',
    targetStages: ['submitted', 'started', 'approved', 'completed'],
    criteriaTags: ['통신비', '고정비절감']
  },
  {
    id: 'cost-3',
    priority: 4,
    category: 'cost_reduction',
    badge: '교통비 환급',
    title: 'K-패스 (전국 대중교통비 환급 지원)',
    subtitle: '월 15회 이상 대중교통 이용 시 지출액의 일정 비율을 다음 달 현금 환급',
    organization: '국토교통부 / 한국교통안전공단',
    eligibility: '만 19세 이상 전국 대중교통 이용 국민 누구나',
    benefit: '일반 20%, 청년(만19~34세) 30%, 저소득층 최대 53% 환급 (월 최대 21.6만 원)',
    contactNumber: 'K-패스 고객센터 031-427-4415',
    officialUrl: 'https://korea-pass.kr',
    targetStages: ['preparing', 'submitted', 'started', 'approved', 'completed'],
    criteriaTags: ['청년', '교통비환급']
  },

  // ── 5순위: 주거·취업 및 자산형성 ──
  {
    id: 'housing-1',
    priority: 5,
    category: 'housing_job',
    badge: 'LH 긴급주거',
    title: 'LH 긴급주거지원 & 마이홈 주거안정 프로그램',
    subtitle: '경매, 퇴거위기, 임대료 체납 위기 가구에 대한 임시거처 및 매입임대 연계',
    organization: '한국토지주택공사(LH) / 마이홈',
    eligibility: '긴급복지지원 수급자 중 주거지원이 필요한 위기가구',
    benefit: 'LH 매입·전세임대주택 긴급 입주 지원 및 주거안정 보증금 연계',
    contactNumber: '마이홈 콜센터 1600-1004',
    officialUrl: 'https://www.myhome.go.kr',
    targetStages: ['preparing', 'submitted', 'started', 'approved'],
    criteriaTags: ['임대주택', '주거안정']
  },
  {
    id: 'job-1',
    priority: 5,
    category: 'housing_job',
    badge: '국비 직업훈련',
    title: '고용24 국민내일배움카드 국비지원 직업훈련',
    subtitle: '직업능력 개발 훈련비 지원으로 소득 향상 및 안정적인 일자리 전환 지원',
    organization: '고용노동부 / 직업능력심사평가원',
    eligibility: '대한민국 국민 누구나 (공무원, 사립학교 교직원 등 제외)',
    benefit: '1인당 300~500만 원 훈련비 국비 지원 (훈련비의 45~85% 국비 지원, 취약계층 100%)',
    contactNumber: '고용노동부 1350',
    officialUrl: 'https://www.work24.go.kr',
    targetStages: ['approved', 'completed'],
    criteriaTags: ['자기계발', '소득회복', '직업훈련']
  },
  {
    id: 'asset-1',
    priority: 5,
    category: 'housing_job',
    badge: '자산형성 매칭',
    title: '보건복지부 희망저축계좌 (정부지원 자산형성)',
    subtitle: '일하는 저소득 가구가 매월 10만 원 저축 시 정부가 근로소득장려금 매칭 지원',
    organization: '보건복지부 / 자활복지개발원',
    eligibility: '소득인정액이 기준 중위소득 50% 이하인 일하는 주거·교육급여 가구 및 차상위계층',
    benefit: '3년간 매월 10만 원 저축 시 정부가 월 10~30만 원 매칭 지원 (최대 1,440만 원 수령)',
    contactNumber: '자산형성콜센터 1522-3690',
    officialUrl: 'https://www.hope.welfareinfo.or.kr',
    targetStages: ['approved', 'completed'],
    criteriaTags: ['목돈마련', '자산형성']
  }
];

// ═══════════════════════════════════════════════
// 시기별·조건별 다이나믹 혜택 추천 엔진
// ═══════════════════════════════════════════════

export function getRecommendedBenefits(
  caseData: RehabCompanionCase,
  selectedCategory: string = 'all',
  selectedRegion: string = 'all'
): { programs: SupportProgram[]; stageMatchedCount: number } {
  const currentStage: CaseStageType = caseData.caseStage || 
    (caseData.completedRounds > 0 ? 'approved' : 'submitted');
  const completed = caseData.completedRounds || 0;

  const filtered = OFFICIAL_SUPPORT_PROGRAMS.filter(prog => {
    // 카테고리 필터
    if (selectedCategory !== 'all' && prog.category !== selectedCategory) {
      return false;
    }
    // 지역 필터
    if (selectedRegion !== 'all' && prog.region && prog.region !== '전국' && !prog.region.includes(selectedRegion)) {
      return false;
    }
    return true;
  });

  // 점수 계산: 단계 적합도(Stage) + 성실납부 회차(Rounds) + 우선순위(Priority)
  const scored = filtered.map(prog => {
    let score = 0;
    const isStageMatched = prog.targetStages ? prog.targetStages.includes(currentStage) : true;
    const isRoundMatched = prog.minCompletedRounds !== undefined ? completed >= prog.minCompletedRounds : true;

    if (isStageMatched) score += 30;
    if (isRoundMatched && prog.minCompletedRounds !== undefined) score += 25;
    
    // 우선순위 점수
    score += (6 - prog.priority) * 5;

    return {
      program: prog,
      score,
      isStageMatched: isStageMatched && isRoundMatched
    };
  });

  // 점수 내림차순 정렬
  scored.sort((a, b) => b.score - a.score);

  return {
    programs: scored.map(s => s.program),
    stageMatchedCount: scored.filter(s => s.isStageMatched).length
  };
}

// 파산동행 사건 불러오기 (없으면 null — 데모 사건을 사용자 사건처럼 보여주지 않는다)
export function loadBankruptcyCase(clientId?: string): BankruptcyCompanionCase | null {
  const keys = clientId ? [`${BANKRUPTCY_STORAGE_KEY}_${clientId}`, BANKRUPTCY_STORAGE_KEY] : [BANKRUPTCY_STORAGE_KEY];
  for (const key of keys) {
    const parsed = readCase<BankruptcyCompanionCase>(key);
    if (!parsed) continue;
    if (DEMO_BANKRUPTCY_CASE_IDS.has(parsed.id)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      continue;
    }
    return {
      ...parsed,
      timelines: Array.isArray(parsed.timelines) ? parsed.timelines : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  }
  return null;
}

/** 기존 사건에 병합 저장 — 사건이 없고 완전한 데이터(id)도 아니면 저장하지 않는다 (부분 값으로 가짜 사건이 생기지 않도록) */
export function saveBankruptcyCase(data: Partial<BankruptcyCompanionCase>, clientId?: string): void {
  try {
    const current = loadBankruptcyCase(clientId);
    if (!current && !data.id) return;
    const key = clientId ? `${BANKRUPTCY_STORAGE_KEY}_${clientId}` : BANKRUPTCY_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify({ ...(current || {}), ...data }));
  } catch (err) {
    console.error('Error saving bankruptcy case:', err);
  }
}
