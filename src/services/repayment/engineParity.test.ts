import { describe, expect, it } from 'vitest';
import { buildRepaymentPlan, estimateRehabPlan } from './repaymentCalculationEngine';
import type { RepaymentAsset, RepaymentCreditor } from './repaymentTypes';
import { calculateRepayment, type RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { DEFAULT_POLICY_CONFIG_2026 } from '../../rehab-chatbot-package/config/PolicyConfig';
import { calculateRehabPlan } from '../../rehabEngine';
import { DEFAULT_SETTINGS } from '../../constants';
import { computeQuickDisposable } from '../../components/lawyer/quickdock/quickCalc';
import type { IntakeData } from '../../types';

/**
 * B-3 완료 기준: 같은 입력이면 의뢰인 저장(rehabEngine)·변호사 제안서/챗봇(calculationService)·
 * 법원 서식(buildRepaymentPlan)·퀵툴(quickCalc)이 같은 생계비·청산가치·기간·월 변제금을 낸다.
 */

interface Scenario {
  name: string;
  householdSize: number;
  minorChildren: number;
  monthlyIncome: number;
  rent: number;
  medical: number;
  education: number;
  leaseDeposit: number;
  generalDebt: number;
  priorityDebt: number;
}

const SCENARIOS: Scenario[] = [
  { name: '1인 서울 월세', householdSize: 1, minorChildren: 0, monthlyIncome: 3_000_000, rent: 500_000, medical: 0, education: 0, leaseDeposit: 0, generalDebt: 50_000_000, priorityDebt: 0 },
  { name: '3인 서울 보증금·교육비·의료비 (60개월 연장)', householdSize: 3, minorChildren: 2, monthlyIncome: 4_500_000, rent: 800_000, medical: 200_000, education: 300_000, leaseDeposit: 100_000_000, generalDebt: 80_000_000, priorityDebt: 0 },
  { name: '1인 세금 체납 우선채권', householdSize: 1, minorChildren: 0, monthlyIncome: 2_500_000, rent: 0, medical: 0, education: 0, leaseDeposit: 0, generalDebt: 40_000_000, priorityDebt: 10_000_000 },
  { name: '1인 원금 조기 완제', householdSize: 1, minorChildren: 0, monthlyIncome: 4_000_000, rent: 0, medical: 0, education: 0, leaseDeposit: 0, generalDebt: 20_000_000, priorityDebt: 0 },
];

function chatbotInput(s: Scenario): RehabUserInput {
  return {
    address: '서울특별시 강남구',
    monthlyIncome: s.monthlyIncome,
    isMarried: false,
    minorChildren: s.minorChildren,
    familySize: s.householdSize,
    spouseAssets: 0,
    rentCost: s.rent,
    deposit: s.leaseDeposit,
    depositLoan: 0,
    housingContractHolder: 'self',
    medicalCost: s.medical,
    educationCost: s.education,
    myAssets: 0,
    totalDebt: s.generalDebt,
    priorityDebt: s.priorityDebt,
  };
}

function intake(s: Scenario): IntakeData {
  return {
    clientName: '시험', phoneNumber: '', birthDate: '1980-01-01',
    consultDate: '2026-07-25', dbVendor: '', caseType: 'individual_rehab',
    residence: '서울특별시 강남구', workplace: '', selectedCourt: '서울회생법원',
    maritalStatus: 'single', minorChildren: s.minorChildren, minorChildrenFullRecognition: false,
    otherDependents: 0,
    prevHistory: { exists: false },
    incomeSources: [{ id: 'i1', type: 'worker', amount: s.monthlyIncome }],
    debts: [
      { id: 'd1', creditor: 'A', principal: s.generalDebt, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ...(s.priorityDebt > 0 ? [{ id: 'd2', creditor: 'T', principal: s.priorityDebt, interest: 0, type: 'tax' as const, isGamblingOrLuxury: false, isRecent: false }] : []),
    ],
    assets: s.leaseDeposit > 0
      ? [{ id: 'a1', type: 'deposit', owner: 'self', marketValue: s.leaseDeposit, hasPledge: false, loanBalance: 0, isExempt: false } as any]
      : [],
    monthlyLivingCost: 0, monthlyRent: s.rent, monthlyInsurance: 0,
    extraLivingCost: { utilities: 0, education: s.education, specialEducation: 0, medical: s.medical, other: 0 },
    specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
    consultationLogs: [],
    applyYear: 2026,
  } as IntakeData;
}

function planAssets(s: Scenario): RepaymentAsset[] {
  return s.leaseDeposit > 0
    ? [{ id: 'a1', name: '임차보증금', category: 'HOUSING_DEPOSIT', marketValue: s.leaseDeposit, encumbrance: 0, statutoryDeduction: 0, liquidationValue: 0 }]
    : [];
}

function planCreditors(s: Scenario): RepaymentCreditor[] {
  const base = { interest: 0, isSecured: false, monthlyRepayment: 0, totalRepayment: 0, allocationRatio: 0, repaymentRate: 0 } as any;
  return [
    { ...base, id: 'c1', name: 'A', principal: s.generalDebt, isPriority: false },
    ...(s.priorityDebt > 0 ? [{ ...base, id: 'c2', name: 'T', principal: s.priorityDebt, isPriority: true }] : []),
  ];
}

describe('계산 엔진 4곳 같은 결과 (B-3)', () => {
  for (const s of SCENARIOS) {
    it(s.name, () => {
      const perChild = s.minorChildren > 0 ? s.education / s.minorChildren : 0;
      const est = estimateRehabPlan({
        year: 2026, householdSize: s.householdSize, region: 'SEOUL', monthlyIncome: s.monthlyIncome,
        housingExpense: s.rent, medicalExpense: s.medical, children: s.minorChildren, educationPerChild: perChild,
        assets: planAssets(s), generalDebt: s.generalDebt, priorityDebt: s.priorityDebt,
      });

      const chat = calculateRepayment(chatbotInput(s), DEFAULT_POLICY_CONFIG_2026);
      expect(chat.recognizedLivingCost).toBe(est.recognizedLivingCost);
      expect(chat.liquidationValue).toBe(est.liquidationValue);
      expect(chat.repaymentMonths).toBe(est.plan.months);
      expect(chat.monthlyPayment).toBe(est.plan.monthlyPayment);

      const client = calculateRehabPlan(intake(s), DEFAULT_SETTINGS);
      expect(client.base.living).toBe(est.recognizedLivingCost);
      expect(client.base.liq).toBe(est.liquidationValue);
      expect(client.preferred?.m).toBe(est.plan.months);
      expect(client.preferred?.monthly).toBe(est.plan.monthlyPayment);
      expect(client.preferred?.total).toBe(est.plan.totalRepayment);

      const plan = buildRepaymentPlan({
        clientId: 't', clientName: 't', submissionDate: '2026-07-25', startYearMonth: '2026-10',
        incomeExpense: {
          incomeType: 'salary', monthlyNetIncome: s.monthlyIncome, householdSize: s.householdSize, region: 'SEOUL',
          actualHousingExpense: s.rent, actualMedicalExpense: s.medical, numberOfChildren: s.minorChildren,
          educationExpensePerChild: perChild, otherApprovedExpense: 0, trusteeType: 'INTERNAL', medianIncomeYear: 2026,
        } as any,
        assets: planAssets(s),
        creditors: planCreditors(s),
      });
      expect(plan.calculatedLiving.finalTotalLivingExpense).toBe(est.recognizedLivingCost);
      expect(plan.totalLiquidationValue).toBe(est.liquidationValue);
      expect(plan.months).toBe(est.plan.months);
      expect(plan.monthlyRepaymentTotal).toBe(est.plan.monthlyPayment);
      expect(plan.totalRepaymentAmount).toBe(est.plan.totalRepayment);

      if (s.rent === 0 && s.medical === 0 && s.education === 0) {
        const quick = computeQuickDisposable({ householdSize: s.householdSize, monthlyIncome: s.monthlyIncome, extraLivingCost: 0, region: 'SEOUL', year: 2026 });
        expect(quick.totalLivingExpense).toBe(est.recognizedLivingCost);
        expect(quick.disposable).toBe(est.plan.disposableIncome);
      }
    });
  }

  it('주거비 한도는 가구원수별 (3인 서울 = 1,253,955원)', () => {
    const est = estimateRehabPlan({
      year: 2026, householdSize: 3, region: 'SEOUL', monthlyIncome: 6_000_000,
      housingExpense: 3_000_000, assets: [], generalDebt: 50_000_000,
    });
    expect(est.living.additionalHousingDeduction).toBe(1_253_955);
  });

  it('교육비는 (지출 − 89,627원)을 1인당 20만 원 안에서', () => {
    const est = estimateRehabPlan({
      year: 2026, householdSize: 3, region: 'SEOUL', monthlyIncome: 6_000_000,
      children: 2, educationPerChild: 400_000, assets: [], generalDebt: 50_000_000,
    });
    expect(est.living.additionalEducationDeduction).toBe(400_000);
    const small = estimateRehabPlan({
      year: 2026, householdSize: 3, region: 'SEOUL', monthlyIncome: 6_000_000,
      children: 2, educationPerChild: 150_000, assets: [], generalDebt: 50_000_000,
    });
    expect(small.living.additionalEducationDeduction).toBe((150_000 - 89_627) * 2);
  });

  it('2027년에도 추가 생계비가 0원이 되지 않는다 (새 의결 전까지 2026 의결 적용)', () => {
    const est = estimateRehabPlan({
      year: 2027, householdSize: 1, region: 'SEOUL', monthlyIncome: 3_000_000,
      housingExpense: 500_000, medicalExpense: 100_000, assets: [], generalDebt: 50_000_000,
    });
    expect(est.living.baseLivingExpense).toBe(1_641_625);
    expect(est.living.additionalHousingDeduction).toBe(500_000 - 273_861);
    expect(est.living.additionalMedicalDeduction).toBe(100_000 - 64_619);
  });
});
