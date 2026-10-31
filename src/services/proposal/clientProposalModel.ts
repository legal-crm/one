// ============================================================
// 변호사 검토 제안서 — 의뢰인 화면 모델 (B-5c·B-5d)
// - 발송 때 저장하는 스냅샷(입력값 요약·확정값·기준 연도·유효기간)
// - 실비 표(송달료·인지대·예납금, B-3·BK-6 기준표), 준비 서류, 진행 순서, 질문과 답
// 원칙: 결과 단정 없음, 감면율·감면액 없음(RP-Q1), 근거 없는 수치 없음, 법원 판단은 "법원이 정해요".
// ============================================================

import { calcCourtFees, bankruptcyDepositDefault, DELIVERY_UNIT_FEE_KRW } from '../court/courtFees';
import { activeCalcStandardVersion } from '../repayment/calcStandardRegistry';

export type ProposalProcedure = 'rehab' | 'bankruptcy';

export const DEFAULT_PROPOSAL_VALID_DAYS = 30;

/** 계산에 쓴 의뢰인 정보 요약 (원 단위, 의뢰인이 낸 정리 자료 기준) */
export interface ProposalInputSummary {
  familySize?: number;
  minorChildren?: number;
  monthlyIncomeWon?: number;
  employmentType?: string;
  housingType?: string;
  depositWon?: number;
  rentWon?: number;
  totalDebtWon?: number;
  priorityDebtWon?: number;
  creditorCount?: number;
  court?: string;
}

/** 발송 때 제안서에 함께 저장하는 값 (B-5d: 입력값 요약·확정값·기준 연도) */
export interface ProposalSnapshot {
  v: 1;
  procedure: ProposalProcedure;
  standardYear: number;
  /** 게시 기준표 버전 (없으면 코드 기본값) */
  standardVersion: number | null;
  validDays: number;
  issuedAt: string;
  expiresAt: string;
  input: ProposalInputSummary;
  /** 변호사 확정값 — 의뢰인 화면은 이 값만 보여 준다 (회생만) */
  confirmed?: {
    monthlyPaymentWon: number;
    months: number;
    totalRepaymentWon: number;
    /** 변호사가 계산값을 고쳤는지 */
    edited: boolean;
    calcMonthlyPaymentWon?: number;
    calcMonths?: number;
  };
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function summarizeProposalInput(input: any, court?: string): ProposalInputSummary {
  const i = input || {};
  const out: ProposalInputSummary = {
    familySize: num(i.familySize),
    minorChildren: Number.isFinite(Number(i.minorChildren)) ? Math.max(0, Math.floor(Number(i.minorChildren))) : undefined,
    monthlyIncomeWon: num(i.monthlyIncome),
    employmentType: typeof i.employmentType === 'string' ? i.employmentType : undefined,
    housingType: typeof i.housingType === 'string' ? i.housingType : undefined,
    depositWon: num(i.deposit ?? i.rentalDeposit),
    rentWon: num(i.rentCost ?? i.monthlyRent),
    totalDebtWon: num(i.totalDebt),
    priorityDebtWon: num(i.priorityDebt),
    creditorCount: num(i.creditorCount),
    court: (court || '').trim() || undefined,
  };
  for (const k of Object.keys(out) as Array<keyof ProposalInputSummary>) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function buildProposalSnapshot(args: {
  procedure: ProposalProcedure;
  validDays?: number;
  issuedAt?: string;
  userInput?: any;
  court?: string;
  monthlyPaymentWon?: number;
  months?: number;
  calcMonthlyPaymentWon?: number;
  calcMonths?: number;
  standardYear?: number;
}): ProposalSnapshot {
  const issuedAt = args.issuedAt || new Date().toISOString();
  const validDays = Math.max(1, Math.min(180, Math.floor(args.validDays || DEFAULT_PROPOSAL_VALID_DAYS)));
  const snap: ProposalSnapshot = {
    v: 1,
    procedure: args.procedure,
    standardYear: args.standardYear || new Date(issuedAt).getFullYear(),
    standardVersion: activeCalcStandardVersion(),
    validDays,
    issuedAt,
    expiresAt: addDaysIso(issuedAt, validDays),
    input: summarizeProposalInput(args.userInput, args.court),
  };
  if (args.procedure === 'rehab' && (args.monthlyPaymentWon || 0) > 0 && (args.months || 0) > 0) {
    const m = Math.round(args.monthlyPaymentWon!);
    const mo = Math.round(args.months!);
    snap.confirmed = {
      monthlyPaymentWon: m,
      months: mo,
      totalRepaymentWon: m * mo,
      edited: (args.calcMonthlyPaymentWon !== undefined && Math.round(args.calcMonthlyPaymentWon) !== m)
        || (args.calcMonths !== undefined && Math.round(args.calcMonths) !== mo),
      ...(args.calcMonthlyPaymentWon !== undefined ? { calcMonthlyPaymentWon: Math.round(args.calcMonthlyPaymentWon) } : {}),
      ...(args.calcMonths !== undefined ? { calcMonths: Math.round(args.calcMonths) } : {}),
    };
  }
  return snap;
}

// ── 유효기간 ──
export function proposalValidity(issuedAt: string | undefined, validDays?: number, expiresAt?: string, now: Date = new Date()) {
  const days = Math.max(1, Math.floor(validDays || DEFAULT_PROPOSAL_VALID_DAYS));
  const exp = expiresAt || (issuedAt ? addDaysIso(issuedAt, days) : '');
  const expDate = exp ? new Date(exp) : null;
  if (!expDate || Number.isNaN(expDate.getTime())) return { validDays: days, expiresAt: '', daysLeft: null as number | null, expired: false };
  const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / 86400000);
  return { validDays: days, expiresAt: exp, daysLeft, expired: daysLeft < 0 };
}

export function formatKoDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// ── 실비 표 ──
export interface CostRow {
  label: string;
  /** 원 단위. null = 금액을 아직 정할 수 없음 (note에 이유) */
  amountWon: number | null;
  note: string;
  termKey?: string;
}

/** 법원에 내는 실비 (수임료와 별도). 채권자 수를 모르면 송달료는 계산 방식만 보여 준다 */
export function proposalCostRows(args: { procedure: ProposalProcedure; courtName?: string; creditorCount?: number; withProhibition?: boolean }): CostRow[] {
  const c = args.creditorCount && args.creditorCount > 0 ? Math.floor(args.creditorCount) : 0;
  const rows: CostRow[] = [];
  if (args.procedure === 'rehab') {
    const withProhibition = args.withProhibition !== false;
    const fees = c > 0 ? calcCourtFees({ caseType: 'rehab', creditorCount: c, withProhibition }) : null;
    rows.push({
      label: '인지대',
      amountWon: fees ? fees.stampFee : (30000 + (withProhibition ? 2000 : 0)),
      note: withProhibition ? '개인회생 신청 30,000원 + 금지명령 신청 2,000원 (전자소송은 10% 감액)' : '개인회생 신청 30,000원 (전자소송은 10% 감액)',
      termKey: 'stampFee',
    });
    rows.push({
      label: '송달료',
      amountWon: fees ? fees.deliveryFee : null,
      note: fees
        ? `채권자 ${c}곳 기준 ${fees.deliveryRounds}회분 × ${DELIVERY_UNIT_FEE_KRW.toLocaleString('ko-KR')}원`
        : `(10 + 채권자 수 × 8)회분 × ${DELIVERY_UNIT_FEE_KRW.toLocaleString('ko-KR')}원${withProhibition ? ', 금지명령은 채권자 수 × 2회분 추가' : ''} — 채권자 수가 정해지면 계산돼요`,
      termKey: 'deliveryFee',
    });
    rows.push({
      label: '회생위원 보수',
      amountWon: null,
      note: '외부 회생위원이 선임되면 법원이 정한 보수를 내요(인가 전 보수, 인가 후에는 변제금에서 일정 비율). 선임 여부와 금액은 법원이 정해요.',
      termKey: 'trustee',
    });
  } else {
    const fees = c > 0 ? calcCourtFees({ caseType: 'bankruptcy', creditorCount: c }) : null;
    const dep = bankruptcyDepositDefault(args.courtName);
    rows.push({ label: '인지대', amountWon: fees ? fees.stampFee : 2000, note: '파산 신청 1,000원 + 면책 신청 1,000원', termKey: 'stampFee' });
    rows.push({
      label: '송달료',
      amountWon: fees ? fees.deliveryFee : null,
      note: fees
        ? `채권자 ${c}곳 기준 ${fees.deliveryRounds}회분 × ${DELIVERY_UNIT_FEE_KRW.toLocaleString('ko-KR')}원`
        : `파산 (10 + 채권자 수 × 4)회분 + 면책 (10 + 채권자 수 × 3)회분 × ${DELIVERY_UNIT_FEE_KRW.toLocaleString('ko-KR')}원 — 채권자 수가 정해지면 계산돼요`,
      termKey: 'deliveryFee',
    });
    rows.push({
      label: '예납금',
      amountWon: dep.amountWon,
      note: dep.amountWon ? `${dep.note}. 파산관재인이 선임될 때 내며, 법원 예납명령 금액이 기준이에요.` : '파산관재인이 선임되면 법원 예납명령으로 금액이 정해져요.',
      termKey: 'deposit',
    });
  }
  return rows;
}

// ── 진행 순서 ──
export interface TimelineStep { title: string; detail: string; termKey?: string }

export function proposalTimeline(procedure: ProposalProcedure, months?: number): TimelineStep[] {
  if (procedure === 'bankruptcy') {
    return [
      { title: '서류 준비', detail: '소득·재산·채무 자료를 모아 신청서와 진술서를 작성해요.' },
      { title: '파산·면책 신청', detail: '법원에 파산과 면책을 함께 신청해요.' },
      { title: '파산선고', detail: '법원이 지급불능 여부를 심리해 정해요. 필요하면 파산관재인을 선임하고 예납금을 내라고 해요.', termKey: 'bankruptcyTrustee' },
      { title: '관재인 조사·채권자집회', detail: '관재인 면담과 자료 제출이 있을 수 있어요. 재산이 있으면 정리해 채권자에게 나눠요.', termKey: 'creditorsMeeting' },
      { title: '면책 결정', detail: '법원이 면책 여부를 정해요. 결정이 확정되면 남은 채무를 갚지 않아도 돼요(일부 채무 제외).', termKey: 'discharge' },
    ];
  }
  return [
    { title: '서류 준비', detail: '소득·재산·채무 자료를 모아 신청서와 변제계획안을 작성해요.' },
    { title: '신청·금지명령', detail: '법원에 개인회생을 신청하면서 금지명령을 함께 신청할 수 있어요. 인용 여부와 시기는 법원이 정해요.', termKey: 'prohibitionOrder' },
    { title: '보정 대응', detail: '법원이나 회생위원이 추가 자료를 요청하면 기한 안에 내요.', termKey: 'correction' },
    { title: '개시결정', detail: '법원이 절차를 시작해요. 이때부터 변제금을 내기 시작하는 것이 일반적이에요.', termKey: 'commencement' },
    { title: '채권자집회·인가결정', detail: '집회에 출석한 뒤 법원이 변제계획 인가 여부를 정해요.', termKey: 'confirmation' },
    { title: months && months > 0 ? `${months}개월 변제` : '변제 수행', detail: '계획대로 매달 변제금을 내요.', termKey: 'repaymentPeriod' },
    { title: '면책', detail: '변제를 마치면 법원이 면책을 결정해요.', termKey: 'discharge' },
  ];
}

// ── 준비 서류 (대표 목록 — 정확한 목록은 계약 뒤 사무소가 '내 사건'에서 요청) ──
export function proposalPrepDocs(procedure: ProposalProcedure, s: ProposalInputSummary): string[] {
  const docs = ['신분증', '주민등록등본·초본', '가족관계증명서', '금융회사별 부채증명서(사무소 안내에 따라)'];
  const emp = s.employmentType || '';
  if (emp === 'salary' || emp === 'both') docs.push('최근 급여명세서·원천징수영수증');
  if (emp === 'business' || emp === 'both') docs.push('사업자등록증·부가가치세 과세표준증명·종합소득세 신고서');
  if (emp === 'freelancer' || emp === 'daily') docs.push('소득금액증명·입금 내역');
  if (s.housingType === 'rent' || s.housingType === 'jeonse') docs.push('임대차계약서');
  if (s.housingType === 'owned') docs.push('부동산 등기사항증명서·시세 자료');
  if (s.housingType === 'free') docs.push('무상거주확인서');
  docs.push('최근 1년 통장 거래내역');
  if (procedure === 'bankruptcy') docs.push('지급불능에 이른 경위를 적은 진술서(작성 도움 가능)');
  return docs;
}

// ── 질문과 답 (상황별, 중립 문구) ──
export interface ProposalFaq { q: string; a: string; tag?: string }

export function proposalFaqs(procedure: ProposalProcedure, input: any): ProposalFaq[] {
  const i = input || {};
  const list: ProposalFaq[] = [];
  if (procedure === 'bankruptcy') {
    list.push({ q: '파산하면 모든 채무가 없어지나요?', a: '면책 결정이 확정되면 남은 채무를 갚지 않아도 되는 것이 원칙이에요. 다만 세금, 벌금, 고의로 생긴 손해배상 등 일부 채무는 면책되지 않을 수 있어요. 해당 여부는 담당 변호사와 확인해 주세요.' });
    list.push({ q: '파산관재인은 꼭 선임되나요?', a: '법원이 사건 사정을 보고 정해요. 선임되면 예납금을 내고, 관재인 면담·자료 요청에 응해야 해요.' });
    list.push({ q: '면책이 안 될 수도 있나요?', a: '재산을 숨기거나 거짓 자료를 내는 등 법에서 정한 사유가 있으면 법원이 면책을 허가하지 않을 수 있어요. 사실대로 자료를 내는 것이 중요해요.' });
    return list;
  }
  const housing = i.housingType;
  if (housing === 'owned') {
    list.push({ tag: '자가 주택', q: '살고 있는 집은 어떻게 되나요?', a: '담보대출이 있는 집은 대출을 계속 갚으면서 유지하는 방안을 검토할 수 있어요. 다만 집의 순자산(시세 − 대출)은 청산가치에 들어가, 총 변제액이 그보다 많아야 해요. 사건마다 달라 담당 변호사와 확인해 주세요.' });
  }
  if (housing === 'rent' || housing === 'jeonse' || Number(i.deposit) > 0) {
    list.push({ tag: '임차 보증금', q: '보증금은 어떻게 반영되나요?', a: '지역별 소액임차보증금 보호 범위는 청산가치에서 빼고, 넘는 부분만 재산으로 반영하는 것이 일반적이에요. 정확한 범위는 주소와 계약일을 보고 변호사가 확인해요.' });
  }
  if (i.isMarried || i.maritalStatus === 'married') {
    list.push({ tag: '배우자', q: '배우자에게 영향이 있나요?', a: '개인회생은 본인 명의 채무를 다루는 절차예요. 배우자 명의 재산은 회생법원 실무준칙상 원칙적으로 반영하지 않지만, 명의신탁 등 사정이 있으면 법원이 자료를 요청할 수 있어요.' });
  }
  if (Number(i.speculativeLoss) > 0 || Number(i.gamblingLoss) > 0 || i.riskFactor === 'investment' || i.riskFactor === 'gambling') {
    list.push({ tag: '투자 손실', q: '투자 손실로 생긴 채무도 신청할 수 있나요?', a: '채무가 생긴 원인만으로 신청이 막히지는 않아요. 회생법원 실무준칙은 투자 손실금을 청산가치에 더하지 않는 것을 원칙으로 하지만, 최근 대출과 사용처는 법원이 자세히 물을 수 있어 거래 내역을 준비해야 해요.' });
  }
  if (['business', 'freelancer', 'daily'].includes(i.employmentType)) {
    list.push({ tag: '사업·프리랜서', q: '소득이 매달 다르면 어떻게 정하나요?', a: '최근 소득 자료(부가가치세·종합소득세 신고, 입금 내역)로 월평균 소득을 정리해 법원에 소명해요. 사업은 신청 뒤에도 계속할 수 있는 것이 일반적이에요.' });
  }
  if (Number(i.priorityDebt) > 0) {
    list.push({ tag: '세금·보험료', q: '세금이나 4대보험료 체납도 줄어드나요?', a: '세금·4대보험료는 우선채권이라 원금이 줄지 않아요. 변제기간 앞쪽에서 먼저 나눠 갚도록 계획을 짜는 것이 일반적이에요.' });
  }
  list.push({ q: '월 변제금은 바뀔 수 있나요?', a: '이 제안서의 금액은 지금 받은 자료로 변호사가 검토한 예상치예요. 서류 확인, 법원 보정, 소득 변화에 따라 달라질 수 있고 최종 금액은 법원이 인가해요.' });
  list.push({ q: '회사에 알려지나요?', a: '대리인이 있으면 법원 우편은 보통 사무소로 가요. 다만 급여 압류가 있거나 재직·급여 자료를 회사에서 받아야 하면 회사가 알 수 있어, 발급 방법을 변호사와 미리 상의해 주세요.' });
  return list;
}

/** 리포트에서 보여 줄 용어 목록 */
export function proposalGlossaryKeys(procedure: ProposalProcedure): string[] {
  return procedure === 'bankruptcy'
    ? ['bankruptcy', 'discharge', 'bankruptcyTrustee', 'deposit', 'creditorsMeeting', 'dischargeDenialGrounds', 'deliveryFee', 'stampFee', 'debtCertificate']
    : ['rehab', 'repaymentPlan', 'monthlyPayment', 'repaymentPeriod', 'disposableIncome', 'livingCost', 'medianIncome', 'additionalLivingCost', 'liquidationValue', 'priorityClaim', 'securedClaim', 'prohibitionOrder', 'stayOrder', 'commencement', 'confirmation', 'correction', 'creditorsMeeting', 'trustee', 'deliveryFee', 'stampFee', 'smallLeaseDeposit', 'discharge'];
}

export const EMPLOYMENT_LABEL: Record<string, string> = {
  salary: '급여', business: '사업', freelancer: '프리랜서', both: '급여+사업', daily: '일용', none: '소득 없음', basic_recipient: '기초생활수급',
};
export const HOUSING_LABEL: Record<string, string> = {
  rent: '월세', jeonse: '전세', owned: '자가', free: '무상 거주', dormitory: '기숙사',
};
