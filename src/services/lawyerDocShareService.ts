/**
 * lawyerDocShareService.ts
 * "개인회생 서류와 모든 준비는 마이김변에서 쉽고 빠르게!"
 * 
 * 의뢰인이 작성한 2차 서류(진술서, 수지표, 재산목록, 채무진단)를
 * 비회원 변호사 및 사무장 휴대폰 번호로 안전하게 공유하고,
 * 2단계 가입 유치(간이 회원가입 -> 정식 파트너 회원 전환)를 처리하는 서비스
 */

import { CourtStatementData } from '../types/statementTypes';
import { IncomeExpenseD5103Data } from '../types/incomeExpenseTypes';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';

export type RecipientRoleType = 'LAWYER' | 'MANAGER';

export interface SharedDocPackageItem {
  hasStatement: boolean;
  statementData?: CourtStatementData | null;
  hasIncomeExpense: boolean;
  incomeExpenseData?: IncomeExpenseD5103Data | null;
  hasProperty: boolean;
  propertySummary?: {
    totalAssetValue: number;
    depositAmount: number;
    vehicleValue: number;
    realEstateValue: number;
  } | null;
  hasDebtSummary: boolean;
  debtSummary?: {
    totalDebt: number;
    monthlyIncome: number;
    courtName: string;
    expectedReductionRate: number;
    monthlyPayment: number;
  } | null;
}

export interface LawyerDocSharePackage {
  token: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  recipientType: RecipientRoleType;
  recipientName: string;
  recipientPhone: string;
  recipientFirmName?: string;
  memo?: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING_VIEW' | 'LIGHT_REGISTERED' | 'FULL_CONVERTED';
  docs: SharedDocPackageItem;
  accessLog?: {
    viewedAt?: string;
    lightRegisteredAt?: string;
    fullConvertedAt?: string;
    ipOrDevice?: string;
  };
}

export interface QuickRegisterPayload {
  token: string;
  name: string;
  role: RecipientRoleType;
  phone: string;
  firmName: string;
}

const STORAGE_KEY_PREFIX = 'mykimbyun_doc_share_';
const INDEX_KEY = 'mykimbyun_doc_share_tokens';

/**
 * 고유 토큰 생성 (lds_랜덤12자리)
 */
function generateShareToken(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 12; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `lds_${rand}`;
}

/**
 * 서류 공유 패키지 생성 및 저장
 */
export function createDocSharePackage(params: {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  recipientType: RecipientRoleType;
  recipientName: string;
  recipientPhone: string;
  recipientFirmName?: string;
  memo?: string;
  docs: SharedDocPackageItem;
}): LawyerDocSharePackage {
  const token = generateShareToken();
  const now = new Date();
  const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 유효

  const cleanPhone = params.recipientPhone.replace(/[^0-9]/g, '');

  const pkg: LawyerDocSharePackage = {
    token,
    clientId: params.clientId,
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    recipientType: params.recipientType,
    recipientName: params.recipientName,
    recipientPhone: cleanPhone,
    recipientFirmName: params.recipientFirmName,
    memo: params.memo,
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    status: 'PENDING_VIEW',
    docs: params.docs,
    accessLog: {}
  };

  try {
    secureSetItem(`${STORAGE_KEY_PREFIX}${token}`, JSON.stringify(pkg));

    // 토큰 인덱스 관리
    const indexRaw = secureGetItem(INDEX_KEY);
    const tokens: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    if (!tokens.includes(token)) {
      tokens.unshift(token);
      secureSetItem(INDEX_KEY, JSON.stringify(tokens.slice(0, 50)));
    }
  } catch (e) {
    console.error('[lawyerDocShareService] Failed to store package', e);
  }

  return pkg;
}

/**
 * 토큰으로 서류 공유 패키지 조회
 */
export function getDocSharePackage(token: string): LawyerDocSharePackage | null {
  if (!token) return null;

  try {
    const raw = secureGetItem(`${STORAGE_KEY_PREFIX}${token}`);
    if (!raw) {
      // Mock Fallback (테스트용)
      if (token.startsWith('lds_demo')) {
        return getMockDemoPackage(token);
      }
      return null;
    }

    const pkg: LawyerDocSharePackage = JSON.parse(raw);
    
    // 만료일 체크
    const expiry = new Date(pkg.expiresAt).getTime();
    if (Date.now() > expiry) {
      console.warn('[lawyerDocShareService] Package has expired', token);
      return null;
    }

    return pkg;
  } catch (e) {
    console.error('[lawyerDocShareService] Failed to load package', e);
    return null;
  }
}

/**
 * 1단계: 변호사·사무장 5초 간이 회원가입 (Lightweight Registration)
 */
export function quickRegisterStaffOrLawyer(payload: QuickRegisterPayload): {
  success: boolean;
  sessionId: string;
  lawyerId: string;
  pkg: LawyerDocSharePackage | null;
} {
  const pkg = getDocSharePackage(payload.token);
  const cleanPhone = payload.phone.replace(/[^0-9]/g, '');
  const lawyerId = `lawyer_guest_${cleanPhone.slice(-4) || 'quick'}_${Date.now().toString().slice(-4)}`;

  // 세션 생성
  sessionStorage.setItem('legal_crm_lawyer_session', lawyerId);
  sessionStorage.setItem('mykimbyun_light_member', JSON.stringify({
    lawyerId,
    name: payload.name,
    role: payload.role,
    phone: cleanPhone,
    firmName: payload.firmName || '서초 법률사무소',
    token: payload.token,
    registeredAt: new Date().toISOString(),
    isLightMember: true
  }));

  if (pkg) {
    pkg.status = 'LIGHT_REGISTERED';
    pkg.recipientName = payload.name;
    pkg.recipientType = payload.role;
    pkg.recipientPhone = cleanPhone;
    pkg.recipientFirmName = payload.firmName || pkg.recipientFirmName;
    pkg.accessLog = {
      ...pkg.accessLog,
      lightRegisteredAt: new Date().toISOString()
    };
    secureSetItem(`${STORAGE_KEY_PREFIX}${payload.token}`, JSON.stringify(pkg));
  }

  return {
    success: true,
    sessionId: lawyerId,
    lawyerId,
    pkg
  };
}

/**
 * 2단계: 정식 파트너 회원 전환 (Full Member Conversion)
 * - 해당 의뢰인의 사건 데이터를 변호사 CRM으로 정식 이관
 */
export function upgradeToFullPartner(params: {
  lawyerId: string;
  name: string;
  role: RecipientRoleType;
  phone: string;
  firmName: string;
  token: string;
}): { success: boolean; caseId: string } {
  const pkg = getDocSharePackage(params.token);
  const now = new Date().toISOString();

  // 간이 회원 -> 정식 파트너로 승격
  const fullMember = {
    lawyerId: params.lawyerId,
    name: params.name,
    role: 'LAWYER',
    phone: params.phone,
    firmName: params.firmName,
    isLightMember: false,
    partnerTier: 'GOLD',
    joinedAt: now
  };
  sessionStorage.setItem('mykimbyun_light_member', JSON.stringify(fullMember));
  sessionStorage.setItem('legal_crm_lawyer_session', params.lawyerId);

  // 해당 의뢰인의 사건을 변호사 CRM case 목록에 등록
  const caseId = `case_${Date.now().toString().slice(-6)}`;
  if (pkg) {
    pkg.status = 'FULL_CONVERTED';
    pkg.accessLog = {
      ...pkg.accessLog,
      fullConvertedAt: now
    };
    secureSetItem(`${STORAGE_KEY_PREFIX}${params.token}`, JSON.stringify(pkg));

    try {
      const existingCasesRaw = secureGetItem('legal_crm_cases') || localStorage.getItem('legal_crm_cases');
      const cases = existingCasesRaw ? JSON.parse(existingCasesRaw) : [];
      
      const newCase = {
        id: caseId,
        clientName: pkg.clientName,
        phone: pkg.clientPhone || pkg.recipientPhone,
        court: pkg.docs.debtSummary?.courtName || '서울회생법원',
        debtTotal: pkg.docs.debtSummary?.totalDebt || 5000,
        monthlyIncome: pkg.docs.debtSummary?.monthlyIncome || 250,
        status: 'contracted',
        stage: '서류취합완료',
        createdAt: now,
        notes: `마이김변 모바일 서류 패키지(진술서·수지표) 접수 건 (토큰: ${params.token})`,
        hasPreDraftedDocs: true,
        statementData: pkg.docs.statementData,
        incomeExpenseData: pkg.docs.incomeExpenseData
      };

      cases.unshift(newCase);
      secureSetItem('legal_crm_cases', JSON.stringify(cases));
      localStorage.setItem('legal_crm_cases', JSON.stringify(cases));
    } catch (e) {
      console.warn('[lawyerDocShareService] Failed to inject case', e);
    }
  }

  return { success: true, caseId };
}

/**
 * 카카오톡 / SMS 공유 텍스트 생성
 */
export function generateShareMessage(pkg: LawyerDocSharePackage, shareUrl: string): {
  smsUrl: string;
  shareTitle: string;
  shareBody: string;
} {
  const roleLabel = pkg.recipientType === 'LAWYER' ? '변호사님' : '사무장님';
  const firmPrefix = pkg.recipientFirmName ? `[${pkg.recipientFirmName}] ` : '';
  const title = `[마이김변] 의뢰인 ${pkg.clientName}님의 개인회생 2차서류(진술서·수지표) 패키지`;

  const body = 
`${firmPrefix}${pkg.recipientName} ${roleLabel}께,

의뢰인 [${pkg.clientName}]님이 마이김변 AI 플랫폼을 통해 작성 완료한 [개인회생 2차 서류 패키지]를 전달드립니다.

대법원 표준 규격으로 사전에 완벽히 정돈되어 있어, 상담 및 전자소송 접수 준비 시간을 80% 이상 단축하실 수 있습니다.

■ 의뢰인: ${pkg.clientName} 님
■ 포함 서류: 법원 진술서(D5104), 12개월 수지표(D5103), 재산상황표, 채무진단서
■ 즉시 열람 및 인쇄 링크:
${shareUrl}

* 마이김변 회원이 아니시더라도 휴대폰 번호로 5초 만에 즉시 서류를 확인하고 A4 인쇄/다운로드하실 수 있습니다.`;

  const smsUrl = `sms:${pkg.recipientPhone}?body=${encodeURIComponent(body)}`;

  return {
    smsUrl,
    shareTitle: title,
    shareBody: body
  };
}

/**
 * 데모용 Mock 패키지 반환 (테스트 환경 지원)
 */
export function getMockDemoPackage(token: string): LawyerDocSharePackage {
  return {
    token,
    clientId: 'client-demo-1',
    clientName: '김가람',
    clientPhone: '010-9876-5432',
    recipientType: 'LAWYER',
    recipientName: '김민준',
    recipientPhone: '010-1234-5678',
    recipientFirmName: '법무법인 한빛',
    memo: '변호사님, 마이김변에서 말로 작성한 진술서와 12개월 수지표 먼저 검토 부탁드립니다.',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    status: 'PENDING_VIEW',
    docs: {
      hasStatement: true,
      statementData: {
        id: 'stmt-demo',
        caseType: 'rehab',
        applicantName: '김가람',
        courtName: '서울회생법원',
        submittedAt: new Date().toISOString(),
        education: '대학교 졸업',
        careers: [
          { period: '2019.03 ~ 2023.11', companyName: '가람 유통', position: '대표', reasonForLeaving: '코로나 매출급감 폐업' },
          { period: '2024.01 ~ 현재', companyName: '쿠팡이츠/배민', position: '배달 라이더', reasonForLeaving: '재직 중' }
        ],
        pastCourtHistory: { hasPastCase: false },
        residence: {
          residenceType: 'RENT_LEASE',
          residenceTypeLabel: '임차 (월세)',
          deposit: 10000000,
          monthlyRent: 550000,
          ownerName: '박임대',
          ownerRelation: '임대인',
          addressSummary: '서울 관악구 신림동'
        },
        story: {
          initialCauseKeywords: ['사업실패', '생활비부족', '카드돌려막기'],
          initialCauseDetail: '2019년 소자본 유통업을 창업하였으나 코로나19 장기화 및 소비 위축으로 인해 2023년 말 누적 적자를 감당하지 못하고 폐업하였습니다.',
          growthProcessDetail: '가게 운영자금과 매장 월세를 감당하기 위해 카드론과 2금융권 신용대출을 이용하였고, 연체 방지를 위한 돌려막기로 인해 원리금이 급증하였습니다.',
          insolvencyTriggerDetail: '폐업 후 배달 대행 라이더로 전환하여 밤낮없이 일하였으나, 매월 갚아야 할 원리금이 340만 원에 달해 월 소득(약 260만 원)을 완전히 초과하여 지급불능에 도달하였습니다.',
          resolutionAndApology: '비록 감당할 수 없는 채무로 큰 고통을 겪고 있으나, 법원에서 변제계획을 인가해 주신다면 한 회차도 거르지 않고 성실히 변제하여 정직한 사회 구성원으로 재기하겠습니다.'
        }
      },
      hasIncomeExpense: true,
      incomeExpenseData: {
        id: 'd5103-demo',
        clientId: 'client-demo-1',
        incomeType: 'BUSINESS',
        detailedIncomeType: 'FREELANCER',
        businessIncome: {
          businessCategory: '기타소득',
          businessName: '배달 플랫폼 용역 (프리랜서)',
          businessRegistrationNo: '미등록 프리랜서(3.3%)',
          annualGrossRevenue: 38400000,
          annualOperatingExpenses: 8640000,
          annualTaxes: 1200000,
          netAnnualBusinessIncome: 28560000,
          monthlyAverageIncome: 2380000,
          evidenceDocuments: ['원천징수영수증', '플랫폼정산내역서', '주거래통장']
        },
        monthlyLedger: {
          incomeType: 'FREELANCER',
          months: [
            { monthLabel: '2025년 03월', incomeCard: 3200000, incomeCash: 0, totalIncome: 3200000, expenseOperating: 720000, expenseRent: 0, expenseUtility: 0, expenseElectricity: 0, totalExpense: 720000, netIncome: 2480000 },
            { monthLabel: '2025년 04월', incomeCard: 3100000, incomeCash: 0, totalIncome: 3100000, expenseOperating: 700000, expenseRent: 0, expenseUtility: 0, expenseElectricity: 0, totalExpense: 700000, netIncome: 2400000 },
            { monthLabel: '2025년 05월', incomeCard: 3300000, incomeCash: 0, totalIncome: 3300000, expenseOperating: 740000, expenseRent: 0, expenseUtility: 0, expenseElectricity: 0, totalExpense: 740000, netIncome: 2560000 }
          ],
          averageMonthlyIncome: 3200000,
          averageMonthlyExpense: 720000,
          averageNetIncome: 2480000
        }
      },
      hasProperty: true,
      propertySummary: {
        totalAssetValue: 13500000,
        depositAmount: 10000000,
        vehicleValue: 2500000,
        realEstateValue: 0
      },
      hasDebtSummary: true,
      debtSummary: {
        totalDebt: 68000000,
        monthlyIncome: 2480000,
        courtName: '서울회생법원',
        expectedReductionRate: 64,
        monthlyPayment: 680000
      }
    }
  };
}
