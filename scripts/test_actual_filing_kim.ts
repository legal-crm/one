/**
 * test_actual_filing_kim.ts
 * 개인회생 8대 전산서식 자동작성 엔진(filingAutoDraftEngine) 정합성 검증 러너
 *
 * ⚠️ 개인정보 보호: 이 파일의 의뢰인·변호사·직장·계좌·연락처는 모두 가상 데이터입니다.
 *    (금액·채권자 수·서류 구성 등 계산 검증에 필요한 수치 구조만 유지)
 *    실제 의뢰인 정보를 저장소에 커밋하지 마세요.
 *
 * 실행: npx -y vite-node scripts/test_actual_filing_kim.ts
 *   (앱 모듈이 import.meta.env를 쓰므로 tsx가 아닌 vite-node로 실행)
 */

import './_browserShim'; // 반드시 첫 import — 앱 서비스가 localStorage/sessionStorage를 사용
import { generateAll8AutoDrafts, approveDraftForm, type AutoDraftSuiteState } from '../src/services/documents/filingAutoDraftEngine';
import { detectCourtJurisdiction, COURT_SERVICE_FEE_UNIT } from '../src/services/documents/courtFilingEngine';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../src/types';
import type {
  RepaymentCreditor,
  RepaymentPlanData,
  IncomeAndExpenseInput,
  CalculatedLivingExpense,
} from '../src/services/repayment/repaymentTypes';

// =========================================================================
// 1. 테스트 픽스처 (가상 의뢰인)
// =========================================================================

/** 채권자 1건 생성 헬퍼 — 안분 결과 필드는 엔진이 계산하므로 0으로 초기화 */
function creditor(
  no: number,
  name: string,
  principal: number,
  interest: number,
  debtCauseDetail: string,
  secured?: { securedValue: number },
): RepaymentCreditor {
  return {
    id: `c${no}`,
    creditorNumber: no,
    name,
    principal,
    interest,
    isSecured: !!secured,
    securedValue: secured?.securedValue,
    isUnconfirmed: false,
    isPriority: false,
    allocationRatio: 0,
    monthlyRepayment: 0,
    totalRepayment: 0,
    repaymentRate: 0,
    debtCauseDetail,
  };
}

const CREDITORS: RepaymentCreditor[] = [
  creditor(1, '가나캐피탈(주)', 24663825, 334482, '신용대출(자동차담보 별제권부)', { securedValue: 8050000 }),
  creditor(2, '(주)가나카드', 998638, 10977, '신용카드미납금'),
  creditor(3, '다라카드(주)', 974826, 1518, '신용카드미납금'),
  creditor(4, '마바카드(주)', 1396010, 0, '신용카드미납금'),
  creditor(5, '사아카드(주)', 921700, 0, '신용카드미납금'),
  creditor(6, '자차카드(주)', 995634, 0, '신용카드미납금'),
  creditor(7, '(주)카타저축은행', 26842400, 0, '신용대출'),
  creditor(8, '파하카드(주)', 504900, 0, '신용카드미납금'),
  creditor(9, '파하카드(주)', 490665, 0, '신용카드미납금'),
  creditor(10, '(주)거너저축은행', 9833334, 0, '서민금융 보증부 대출'),
];

const INCOME_EXPENSE: IncomeAndExpenseInput = {
  incomeType: 'salary',
  monthlyNetIncome: 2400000,
  householdSize: 1,
  region: 'OTHERS',
  actualHousingExpense: 0,
  actualMedicalExpense: 0,
  numberOfChildren: 0,
  educationExpensePerChild: 0,
  otherApprovedExpense: 0,
  trusteeType: 'INTERNAL',
};

const CALCULATED_LIVING: CalculatedLivingExpense = {
  baseLivingExpense: 1435208, // 2025년 기준 1인 가구 중위소득 60%
  additionalHousingDeduction: 0,
  additionalMedicalDeduction: 0,
  additionalEducationDeduction: 0,
  otherApprovedExpense: 0,
  totalAdditionalExpense: 0,
  finalTotalLivingExpense: 1435208,
  rawDisposableIncome: 964792,
  trusteeFee: 0,
  actualDisposableIncome: 964792,
};

const UPLOADED_FILE_SPECS: Array<[string, DocumentFile['category']]> = [
  ['주민등록등본.pdf', 'id_doc'],
  ['주민등록초본(주소이력포함).pdf', 'id_doc'],
  ['가족관계증명서(상세).pdf', 'id_doc'],
  ['혼인관계증명서(상세).pdf', 'id_doc'],
  ['지방세세목별과세증명서(전국5년).pdf', 'asset'],
  ['통장사본.pdf', 'bank_statement'],
  ['계좌통합조회내역서.pdf', 'bank_statement'],
  ['보험_해약환급금증명서3건.pdf', 'asset'],
  ['자동차등록원부(갑_을).pdf', 'asset'],
  ['차량시세표.pdf', 'asset'],
  ['재직증명서.pdf', 'income'],
  ['근로소득원천징수영수증.pdf', 'income'],
  ['급여통장거래내역서(최근1년).pdf', 'bank_statement'],
  ['무상거주사실확인서.pdf', 'asset'],
  ['건강보험자격득실확인서.pdf', 'income'],
  ['연금산정용가입내역확인서.pdf', 'income'],
  ['부채증명서_10개금융기관_일체.pdf', 'debt_cert'],
];

const UPLOADED_FILES: DocumentFile[] = UPLOADED_FILE_SPECS.map(([name, category], i) => ({
  id: `f${i + 1}`,
  name,
  category,
  uploadedAt: '2025-10-22T09:00:00.000Z',
  uploadedBy: 'client',
}));

/**
 * ConsultRequest / RepaymentPlanData는 필수 필드가 매우 많아(재무 프로필, 라이프니쯔 계수 등)
 * 엔진(generateAll8AutoDrafts)이 실제로 읽는 필드만 채운 부분 픽스처로 구성한다.
 * 내부 항목(채권자·수입지출·생계비·서류)은 위에서 정확한 타입으로 검사된다.
 */
const KIM_SOURCE_CLIENT = {
  id: 'CASE_TEST_20251105',
  clientId: 'client-test-0001',
  clientName: '홍길동',
  phone: '010-0000-0000',
  court: '의정부지방법원',
  createdAt: '2025-10-22',
  status: 'document',
  title: '개인회생 접수 검증용 가상 사건',
  content: '경기 북부 거주, 제조업 급여소득자. 1·2차 서류 일체 수합 완료.',
} as Partial<ConsultRequest> as ConsultRequest;

const REPAYMENT_PLAN = {
  clientName: '홍길동',
  courtName: '의정부지방법원',
  totalPrincipal: 67621932,
  totalInterest: 704787,
  totalDebt: 68326719,
  totalLiquidationValue: 0, // 청산가치 0원 (법정공제 100% 적용)
  months: 36,
  monthlyRepaymentTotal: 964792,
  totalRepaymentAmount: 34732512,
  totalRepaymentRate: 58,
  incomeExpense: INCOME_EXPENSE,
  calculatedLiving: CALCULATED_LIVING,
  creditors: CREDITORS,
} as Partial<RepaymentPlanData> as RepaymentPlanData;

const KIM_CRM_EXTENSION = {
  crmStatus: 'document',
  courtCase: {
    courtName: '의정부지방법원',
    caseNumber: '2025개회(접수대기)',
    caseType: '개인회생',
  },
  petitionInfo: {
    lawyerName: '김변호 변호사',
    refundBank: '예시은행 000-0000-0000-00 (홍길동)',
    incomeType: 'salary',
  },
  repaymentPlan: REPAYMENT_PLAN,
  uploadedFiles: UPLOADED_FILES,
} as Partial<CrmClientExtension> as CrmClientExtension;

// =========================================================================
// 2. 정답표 (Ground Truth) — 계산 검증용 수치
// =========================================================================
const ACTUAL_COURT_GROUND_TRUTH = {
  caseInfo: {
    courtName: '의정부지방법원',
    applicantName: '홍길동',
    lawyerName: '김변호 변호사',
    stampFee: 32000, // 인지 32,000원 (금지명령 2,000원 포함)
    deliveryFee: 495000, // 55,000 + (5,500 X 10채권자 X 8회) = 495,000원
    refundAccount: '예시은행 000-0000-0000-00',
  },
  creditors: {
    count: 10,
    totalPrincipal: 67621932,
    totalInterest: 704787,
    totalSum: 68326719,
    securedAmount: 8050000, // 별제권 행사 예상액 (차량 환가액 70%)
    unsecuredSum: 60276719,
  },
  property: {
    depositAmount: 1214397,
    depositLiquidation: 0, // 185만원 공제
    insuranceAmount: 908884,
    insuranceLiquidation: 0, // 150만원 공제
    vehicleValuation: 11500000,
    vehicleDebt: 24663825,
    vehicleLiquidation: 0, // 담보초과
    leaseholdDeposit: 0, // 무상거주
    realEstate: 0,
    severancePay: 0,
    totalLiquidationValue: 0, // 총 청산가치 0원
  },
  incomeExpense: {
    monthlyNetIncome: 2400000,
    annualIncome: 28800000,
    familyCount: 1,
    livingExpense: 1435208, // 1인 기준 60%
    availableIncome: 964792,
  },
  repaymentPlan: {
    months: 36,
    monthlyRepayment: 964792,
    totalRepayment: 34732512,
    repaymentRate: 58, // 58%
    liquidationGuaranteed: true, // 34,732,512원 > 0원
  },
};

// =========================================================================
// 3. 테스트 실행 및 1:1 대조 검증
// =========================================================================
console.log('================================================================================');
console.log('🏛️ 개인회생 8대 전산서식 자동작성 로직 정밀 검증 (가상 사건)');
console.log('================================================================================\n');

// 1) 관할법원 자동 판정 로직 검증
// 의정부지방법원은 강릉·대전·청주 특례 권역이 아니므로 전국 공통(NATIONWIDE) 기준이어야 한다.
const EXPECTED_JURISDICTION = 'NATIONWIDE';
const detectedJurisdiction = detectCourtJurisdiction(KIM_SOURCE_CLIENT.court || '');
console.log(`[검증 1] 관할법원 판정:`);
console.log(`  - 접수 법원: ${ACTUAL_COURT_GROUND_TRUTH.caseInfo.courtName}`);
console.log(`  - 시스템 감지 법원 권역: ${detectedJurisdiction} (기대값: ${EXPECTED_JURISDICTION})`);
console.log(`  - 판정 일치 여부: ${detectedJurisdiction === EXPECTED_JURISDICTION ? '✅ 일치' : '❌ 불일치'}\n`);

// 2) 송달료 및 인지대 계산 로직 검증
const expectedDeliveryFee = 55000 + (COURT_SERVICE_FEE_UNIT * 10 * 8);
console.log(`[검증 2] 법원 접수 비용 산출:`);
console.log(`  - 계산 송달료: ${expectedDeliveryFee.toLocaleString()}원`);
console.log(`  - 실제 접수증 송달료: ${ACTUAL_COURT_GROUND_TRUTH.caseInfo.deliveryFee.toLocaleString()}원`);
console.log(`  - 비용 일치 여부: ${expectedDeliveryFee === ACTUAL_COURT_GROUND_TRUTH.caseInfo.deliveryFee ? '✅ 100% 일치' : '❌ 불일치'}\n`);

// 3) 8대 전산서식 AI 자동 초안 엔진 실행
console.log(`[검증 3] 8대 필수 전산서식 AI 1차 자동 초안 엔진 실행...`);
const draftSuite: AutoDraftSuiteState = generateAll8AutoDrafts(KIM_SOURCE_CLIENT, KIM_CRM_EXTENSION, null);

console.log(`  - 생성된 서식 개수: ${Object.keys(draftSuite.forms).length}개`);
console.log(`  - 옵션 A 검토 대기 상태: ${draftSuite.totalCount - draftSuite.approvedCount}건 검토 대기\n`);

// 4) 8대 서식별 실측 데이터 1:1 대조
const checks: { formCode: string; name: string; target: string; calcVal: any; actualVal: any; match: boolean }[] = [];
function check(formCode: string, name: string, target: string, calcVal: any, actualVal: any) {
  checks.push({ formCode, name, target, calcVal, actualVal, match: calcVal === actualVal });
}

const r01 = draftSuite.forms['R01'];
check('R01', '개시신청서 본안', '신청인 성명', r01.draftPayload.clientName, ACTUAL_COURT_GROUND_TRUTH.caseInfo.applicantName);
check('R01', '개시신청서 본안', '총 채무 원금', r01.draftPayload.totalPrincipal, ACTUAL_COURT_GROUND_TRUTH.creditors.totalPrincipal);

const r02 = draftSuite.forms['R02'];
check('R02', '채권자목록 (CSV)', '채권자 수', r02.draftPayload.creditors.length, ACTUAL_COURT_GROUND_TRUTH.creditors.count);

const r06 = draftSuite.forms['R06'];
check('R06', '재산목록 (D5102)', '예금 압류금지 공제', r06.draftPayload.depositExemption, 1850000);
check('R06', '재산목록 (D5102)', '최종 청산가치 합계', r06.draftPayload.totalLiquidationValue, ACTUAL_COURT_GROUND_TRUTH.property.totalLiquidationValue);

const r08 = draftSuite.forms['R08'];
check('R08', '수입지출목록 (D5103)', '월 순소득', r08.draftPayload.monthlyNetIncome, ACTUAL_COURT_GROUND_TRUTH.incomeExpense.monthlyNetIncome);
check('R08', '수입지출목록 (D5103)', '1인가구 법정생계비', r08.draftPayload.livingExpense, ACTUAL_COURT_GROUND_TRUTH.incomeExpense.livingExpense);

const r04 = draftSuite.forms['R04'];
check('R04', '변제계획안 (D5110)', '변제기간 (개월)', r04.draftPayload.months, ACTUAL_COURT_GROUND_TRUTH.repaymentPlan.months);
check('R04', '변제계획안 (D5110)', '월 변제액 (가용소득)', r04.draftPayload.monthlyRepaymentTotal, ACTUAL_COURT_GROUND_TRUTH.repaymentPlan.monthlyRepayment);
check('R04', '변제계획안 (D5110)', '총 변제예정액', r04.draftPayload.totalRepayment, ACTUAL_COURT_GROUND_TRUTH.repaymentPlan.totalRepayment);
check('R04', '변제계획안 (D5110)', '총 변제율 (%)', r04.draftPayload.repaymentRate, ACTUAL_COURT_GROUND_TRUTH.repaymentPlan.repaymentRate);
check('R04', '변제계획안 (D5110)', '청산가치 보장의 원칙 충족', r04.draftPayload.isLiquidationGuaranteed, ACTUAL_COURT_GROUND_TRUTH.repaymentPlan.liquidationGuaranteed);

// R03: 소송위임장 (이전: match: true 고정값 → 실제 비교)
const r03 = draftSuite.forms['R03'];
check('R03', '소송위임장', '수임 변호사', r03.draftPayload.lawyerName, ACTUAL_COURT_GROUND_TRUTH.caseInfo.lawyerName);

const r07 = draftSuite.forms['R07'];
check('R07', '첨부서류 일체', '수합 편철 파일 수', r07.draftPayload.bundledFileCount, UPLOADED_FILES.length);

// 결과 출력
console.log('--------------------------------------------------------------------------------');
console.log(`📋 서식별 세부 전산 필드 일치도 검증 결과 (${checks.length}개 핵심 지표)`);
console.log('--------------------------------------------------------------------------------');
checks.forEach((c) => {
  const status = c.match ? '✅ MATCH' : '❌ MISMATCH';
  const displayCalc = typeof c.calcVal === 'number' ? c.calcVal.toLocaleString() : String(c.calcVal);
  const displayActual = typeof c.actualVal === 'number' ? c.actualVal.toLocaleString() : String(c.actualVal);
  console.log(`[${c.formCode}] ${c.name} - ${c.target.padEnd(22, ' ')} : ${status}`);
  console.log(`      ↳ 자동작성값: ${displayCalc} | 정답값: ${displayActual}`);
});

const matchCount = checks.filter(c => c.match).length;
const totalChecks = checks.length;
const matchRate = Math.round((matchCount / totalChecks) * 100);

console.log('\n================================================================================');
console.log(`🎯 최종 검증 결과: ${totalChecks}개 핵심 지표 중 ${matchCount}개 일치 (정합성 ${matchRate}%)`);
console.log('================================================================================\n');

// 5) 옵션 A 변호사 검토·승인 워크플로우 테스트
console.log('[검증 4] 옵션 A 변호사 검토 승인 워크플로우 시뮬레이션:');
console.log(`  - 초기 상태 allReviewed: ${draftSuite.allReviewed ? '완료' : '검토 대기 (잠금 작동)'}`);

const REVIEWER = ACTUAL_COURT_GROUND_TRUTH.caseInfo.lawyerName;
const updated1 = approveDraftForm(KIM_SOURCE_CLIENT.id, 'R01', REVIEWER);
console.log(`  - [R01] 개시신청서 변호사 승인 처리 ➔ 현재 승인 건수: ${updated1?.approvedCount}/8`);

const updated2 = approveDraftForm(KIM_SOURCE_CLIENT.id, 'R02', REVIEWER);
console.log(`  - [R02] 채권자목록 변호사 승인 처리 ➔ 현재 승인 건수: ${updated2?.approvedCount}/8`);

console.log(`  - 부분 승인 시 전자소송 접수 가능 여부: ${updated2?.allReviewed ? '접수 가능' : '🔒 접수 차단 (정상 작동)'}`);

// 불일치가 있으면 CI 등에서 실패로 인식되도록 종료 코드 설정
if (matchCount !== totalChecks) process.exitCode = 1;
