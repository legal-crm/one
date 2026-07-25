/**
 * 내 상황 체크하기 시스템 점검 — 20개 테스트 케이스 실행 스크립트
 * 
 * 실행: npx tsx src/test-scenarios.ts
 * 
 * rehabEngine (calculateRehabPlan) + diagnosisEngine (runDiagnosis) 를 
 * 20개의 다양한 변수 조합으로 호출하고, 결과를 구조화된 형태로 출력합니다.
 */

import { calculateRehabPlan } from './rehabEngine';
import { runDiagnosis } from './engines/diagnosisEngine';
import { DEFAULT_SETTINGS } from './constants';
import type { IntakeData, DiagnosisAnswers } from './types';

// ============================================================
// 테스트 시나리오 정의
// ============================================================

interface TestScenario {
  id: number;
  name: string;
  intake: IntakeData;
  diagnosis: DiagnosisAnswers;
}

const scenarios: TestScenario[] = [
  // ── #1: 서울 직장인 기본형 ──
  {
    id: 1,
    name: '서울 직장인 기본형',
    intake: {
      clientName: '테스트1', phoneNumber: '', birthDate: '1990-03-15',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '강남구', workplace: '서울시 서초구', selectedCourt: '서울회생법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2500000 }],
      debts: [
        { id: 'd-1', creditor: '국민은행', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '신한카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #2: 남양주 저소득 고채무 ──
  {
    id: 2,
    name: '남양주 저소득 고채무',
    intake: {
      clientName: '테스트2', phoneNumber: '', birthDate: '1985-07-22',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '남양주시', workplace: '', selectedCourt: '의정부지방법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'freelancer', amount: 2000000 }],
      debts: [
        { id: 'd-1', creditor: '하나은행', principal: 30000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '우리카드', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '저축은행', principal: 35000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: true },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 350000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'severe_delinquency', q2_debtScale: '5000_to_10000', q3_income: 'unstable', q4_urgentNeed: 'overwhelmed', q5_goal: 'fast_resolution' },
  },

  // ── #3: 성남 기혼 맞벌이 ──
  {
    id: 3,
    name: '성남 기혼 맞벌이',
    intake: {
      clientName: '테스트3', phoneNumber: '', birthDate: '1988-11-03',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '성남시', workplace: '서울시 강남구', selectedCourt: '수원회생법원',
      maritalStatus: 'married', spouseIncome: 2000000, minorChildren: 2, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 3500000 }],
      debts: [
        { id: 'd-1', creditor: 'KB국민은행', principal: 30000000, interest: 0, type: 'secured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '삼성카드', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'spouse', type: 'savings', description: '배우자 적금', marketValue: 10000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 150000,
      extraLivingCost: { utilities: 100000, education: 200000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'no_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'unsure', q5_goal: 'reduce_burden' },
  },

  // ── #4: 의정부 자영업자 ──
  {
    id: 4,
    name: '의정부 자영업자',
    intake: {
      clientName: '테스트4', phoneNumber: '', birthDate: '1978-02-28',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '의정부시', workplace: '의정부시', selectedCourt: '의정부지방법원',
      maritalStatus: 'married', spouseIncome: 0, minorChildren: 1, minorChildrenFullRecognition: true,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'business', amount: 3000000 }],
      debts: [
        { id: 'd-1', creditor: '기업은행', principal: 25000000, interest: 0, type: 'secured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '현대카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'vehicle', description: '업무용 차량', marketValue: 8000000, loanBalance: 3000000, hasPledge: true, isExempt: false },
        { id: 'a-2', owner: 'self', type: 'stock', description: '주식', marketValue: 5000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 500000, monthlyInsurance: 100000,
      extraLivingCost: { utilities: 80000, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'business', q4_urgentNeed: 'harassment', q5_goal: 'reduce_burden' },
  },

  // ── #5: 부천 압류 진행중 ──
  {
    id: 5,
    name: '부천 압류 진행중',
    intake: {
      clientName: '테스트5', phoneNumber: '', birthDate: '1982-09-10',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '부천시', workplace: '서울시 영등포구', selectedCourt: '인천지방법원',
      maritalStatus: 'married', spouseIncome: 1500000, minorChildren: 1, minorChildrenFullRecognition: false,
      otherDependents: 1,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2800000 }],
      debts: [
        { id: 'd-1', creditor: '국세청', principal: 15000000, interest: 0, type: 'tax', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '신한은행', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: 'KB캐피탈', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: true },
      ],
      assets: [
        { id: 'a-1', owner: 'spouse', type: 'savings', description: '배우자 저축', marketValue: 5000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 600000, monthlyInsurance: 80000,
      extraLivingCost: { utilities: 60000, education: 150000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
      legalActions: ['seizure', 'collection_call'],
    },
    diagnosis: { q1_status: 'seizure', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'seizure_wage', q5_goal: 'fast_resolution' },
  },

  // ── #6: 대구 코인 투자 실패 ──
  {
    id: 6,
    name: '대구 코인 투자 실패',
    intake: {
      clientName: '테스트6', phoneNumber: '', birthDate: '1993-05-20',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '대구광역시', workplace: '대구광역시 수성구', selectedCourt: '대구회생법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2500000 }],
      debts: [
        { id: 'd-1', creditor: '업비트 마진', principal: 30000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: true, isRecent: true },
        { id: 'd-2', creditor: 'KB국민카드', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '카카오뱅크', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: true },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'stock', description: '잔여 코인 자산', marketValue: 3000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      speculativeLoss: 30000000,
      monthlyLivingCost: 0, monthlyRent: 400000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'severe_delinquency', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'fast_resolution' },
  },

  // ── #7: 춘천 한부모 가정 ──
  {
    id: 7,
    name: '춘천 한부모 가정',
    intake: {
      clientName: '테스트7', phoneNumber: '', birthDate: '1987-12-01',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '춘천시', workplace: '춘천시', selectedCourt: '춘천지방법원',
      maritalStatus: 'divorced', minorChildren: 1, minorChildrenFullRecognition: true,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2200000 }],
      debts: [
        { id: 'd-1', creditor: '농협', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '롯데카드', principal: 10000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 300000, monthlyInsurance: 50000,
      extraLivingCost: { utilities: 50000, education: 100000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: true, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'harassment', q5_goal: 'reduce_burden' },
  },

  // ── #8: 용인 고소득 저채무 ──
  {
    id: 8,
    name: '용인 고소득 저채무',
    intake: {
      clientName: '테스트8', phoneNumber: '', birthDate: '1980-06-15',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '용인시 수지구', workplace: '서울시 강남구', selectedCourt: '수원회생법원',
      maritalStatus: 'married', spouseIncome: 3000000, minorChildren: 1, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 4000000 }],
      debts: [
        { id: 'd-1', creditor: 'KB국민은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'savings', description: '적금', marketValue: 20000000, loanBalance: 0, hasPledge: false, isExempt: false },
        { id: 'a-2', owner: 'self', type: 'insurance', description: '보험 해약환급금', marketValue: 15000000, loanBalance: 0, hasPledge: false, isExempt: false },
        { id: 'a-3', owner: 'self', type: 'vehicle', description: '승용차', marketValue: 15000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 200000,
      extraLivingCost: { utilities: 120000, education: 300000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'no_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'unsure', q5_goal: 'need_guidance' },
  },

  // ── #9: 전주 도박 채무 ──
  {
    id: 9,
    name: '전주 도박 채무',
    intake: {
      clientName: '테스트9', phoneNumber: '', birthDate: '1991-04-08',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '전주시', workplace: '전주시', selectedCourt: '전주지방법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2300000 }],
      debts: [
        { id: 'd-1', creditor: '대부업체A', principal: 30000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: true, isRecent: true },
        { id: 'd-2', creditor: '대부업체B', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: true, isRecent: false },
        { id: 'd-3', creditor: '신한카드', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      gamblingLoss: 20000000,
      monthlyLivingCost: 0, monthlyRent: 300000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'collection', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'harassment', q5_goal: 'fast_resolution' },
  },

  // ── #10: 인천 전세보증금 보유 ──
  {
    id: 10,
    name: '인천 전세보증금 보유',
    intake: {
      clientName: '테스트10', phoneNumber: '', birthDate: '1986-01-25',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '인천광역시', workplace: '서울시 구로구', selectedCourt: '인천지방법원',
      maritalStatus: 'married', spouseIncome: 1800000, minorChildren: 2, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 3000000 }],
      debts: [
        { id: 'd-1', creditor: '우리은행', principal: 30000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: 'BC카드', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'deposit', description: '전세보증금', marketValue: 200000000, loanBalance: 150000000, hasPledge: true, isExempt: false },
      ],
      housingType: 'jeonse',
      depositLoan: 150000000,
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 100000,
      extraLivingCost: { utilities: 80000, education: 200000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #11: 광주 기초수급자 ──
  {
    id: 11,
    name: '광주 기초수급자',
    intake: {
      clientName: '테스트11', phoneNumber: '', birthDate: '1970-08-30',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '광주광역시', workplace: '', selectedCourt: '광주회생법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'unemployed', amount: 2000000 }],
      debts: [
        { id: 'd-1', creditor: '신한은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '국세청', principal: 10000000, interest: 0, type: 'tax', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 200000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 50000, education: 0, specialEducation: 0, medical: 100000, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: true, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'severe_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'none', q4_urgentNeed: 'overwhelmed', q5_goal: 'fast_resolution' },
  },

  // ── #12: 천안 세금체납 위주 ──
  {
    id: 12,
    name: '천안 세금체납 위주',
    intake: {
      clientName: '테스트12', phoneNumber: '', birthDate: '1975-10-12',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '천안시', workplace: '천안시', selectedCourt: '대전회생법원',
      maritalStatus: 'married', spouseIncome: 1000000, minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 1,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'business', amount: 3500000 }],
      debts: [
        { id: 'd-1', creditor: '국세청', principal: 30000000, interest: 0, type: 'tax', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '지방세', principal: 5000000, interest: 0, type: 'tax', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '기업은행', principal: 10000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'vehicle', description: '영업용 차량', marketValue: 5000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 80000,
      extraLivingCost: { utilities: 60000, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'severe_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'business', q4_urgentNeed: 'tax', q5_goal: 'reduce_burden' },
  },

  // ── #13: 고양 연체 초기 ──
  {
    id: 13,
    name: '고양 연체 초기',
    intake: {
      clientName: '테스트13', phoneNumber: '', birthDate: '1995-02-14',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '고양시', workplace: '서울시 마포구', selectedCourt: '의정부지방법원',
      maritalStatus: 'married', spouseIncome: 2500000, minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2800000 }],
      debts: [
        { id: 'd-1', creditor: 'KB국민은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '현대카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'spouse', type: 'savings', description: '배우자 예금', marketValue: 8000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 100000,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'no_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'unsure', q5_goal: 'buy_time' },
  },

  // ── #14: 부산 다중 채무 ──
  {
    id: 14,
    name: '부산 다중 채무',
    intake: {
      clientName: '테스트14', phoneNumber: '', birthDate: '1984-08-19',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '부산광역시', workplace: '부산광역시', selectedCourt: '부산회생법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 3200000 }],
      debts: [
        { id: 'd-1', creditor: '신한은행', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '우리은행', principal: 10000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '하나카드', principal: 10000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-4', creditor: 'KB캐피탈', principal: 8000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-5', creditor: '롯데카드', principal: 7000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-6', creditor: '삼성카드', principal: 7000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: true },
        { id: 'd-7', creditor: 'NH캐피탈', principal: 10000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-8', creditor: '저축은행', principal: 8000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 450000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'collection', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'harassment', q5_goal: 'fast_resolution' },
  },

  // ── #15: 강릉 부양가족 多 ──
  {
    id: 15,
    name: '강릉 부양가족 多',
    intake: {
      clientName: '테스트15', phoneNumber: '', birthDate: '1979-11-27',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '강릉시', workplace: '강릉시', selectedCourt: '춘천지방법원 강릉지원',
      maritalStatus: 'married', spouseIncome: 800000, minorChildren: 3, minorChildrenFullRecognition: false,
      otherDependents: 2,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2500000 }],
      debts: [
        { id: 'd-1', creditor: '농협', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '신한카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'insurance', description: '보장성 보험', marketValue: 5000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 150000,
      extraLivingCost: { utilities: 100000, education: 300000, specialEducation: 0, medical: 50000, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #16: 제주 이혼 후 양육비 ──
  {
    id: 16,
    name: '제주 이혼 후 양육비',
    intake: {
      clientName: '테스트16', phoneNumber: '', birthDate: '1989-03-05',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '제주시', workplace: '제주시', selectedCourt: '제주지방법원',
      maritalStatus: 'divorced_sending', childSupportCost: 500000,
      minorChildren: 1, minorChildrenFullRecognition: true,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2700000 }],
      debts: [
        { id: 'd-1', creditor: '우리은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '현대카드', principal: 18000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [],
      monthlyLivingCost: 0, monthlyRent: 400000, monthlyInsurance: 50000,
      extraLivingCost: { utilities: 40000, education: 100000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #17: 수원 퇴직금 보유 ──
  {
    id: 17,
    name: '수원 퇴직금 보유',
    intake: {
      clientName: '테스트17', phoneNumber: '', birthDate: '1976-07-10',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '수원시', workplace: '서울시 영등포구', selectedCourt: '수원회생법원',
      maritalStatus: 'married', spouseIncome: 1500000, minorChildren: 1, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 3800000 }],
      debts: [
        { id: 'd-1', creditor: '국민은행', principal: 35000000, interest: 0, type: 'secured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: '삼성카드', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'severance', description: '예상 퇴직금', marketValue: 20000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      retirementPensionType: 'none',
      retirementPay: 20000000,
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 150000,
      extraLivingCost: { utilities: 100000, education: 150000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '5000_to_10000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #18: 울산 최소 채무 ──
  {
    id: 18,
    name: '울산 최소 채무',
    intake: {
      clientName: '테스트18', phoneNumber: '', birthDate: '1992-09-18',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '울산광역시', workplace: '울산광역시', selectedCourt: '울산지방법원',
      maritalStatus: 'single', minorChildren: 0, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 2100000 }],
      debts: [
        { id: 'd-1', creditor: '하나은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'savings', description: '예금', marketValue: 3000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 350000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'no_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'unsure', q5_goal: 'need_guidance' },
  },

  // ── #19: 창원 중간형 ──
  {
    id: 19,
    name: '창원 중간형',
    intake: {
      clientName: '테스트19', phoneNumber: '', birthDate: '1983-04-22',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '창원시', workplace: '창원시', selectedCourt: '창원지방법원',
      maritalStatus: 'married', spouseIncome: 1200000, minorChildren: 1, minorChildrenFullRecognition: false,
      otherDependents: 0,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker', amount: 3300000 }],
      debts: [
        { id: 'd-1', creditor: '우리은행', principal: 20000000, interest: 0, type: 'secured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-2', creditor: 'BC카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '카카오뱅크', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'self', type: 'insurance', description: '종신보험 해약환급금', marketValue: 8000000, loanBalance: 0, hasPledge: false, isExempt: false },
        { id: 'a-2', owner: 'spouse', type: 'savings', description: '배우자 예금', marketValue: 6000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      monthlyLivingCost: 0, monthlyRent: 0, monthlyInsurance: 120000,
      extraLivingCost: { utilities: 80000, education: 100000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'early_delinquency', q2_debtScale: '1000_to_5000', q3_income: 'employed', q4_urgentNeed: 'overwhelmed', q5_goal: 'reduce_burden' },
  },

  // ── #20: 파주 복합 위기 ──
  {
    id: 20,
    name: '파주 복합 위기',
    intake: {
      clientName: '테스트20', phoneNumber: '', birthDate: '1981-06-30',
      consultDate: '2026-07-25', dbVendor: '테스트', caseType: 'individual_rehab',
      residence: '파주시', workplace: '파주시', selectedCourt: '의정부지방법원',
      maritalStatus: 'married', spouseIncome: 500000, minorChildren: 2, minorChildrenFullRecognition: false,
      otherDependents: 1,
      prevHistory: { exists: false },
      incomeSources: [{ id: 'inc-1', type: 'worker_no_ins', amount: 2400000 }],
      debts: [
        { id: 'd-1', creditor: '대부업체', principal: 25000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: true, isRecent: true },
        { id: 'd-2', creditor: '신한은행', principal: 20000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-3', creditor: '국세청', principal: 10000000, interest: 0, type: 'tax', isGamblingOrLuxury: false, isRecent: false },
        { id: 'd-4', creditor: 'KB캐피탈', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: true },
        { id: 'd-5', creditor: '롯데카드', principal: 15000000, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false },
      ],
      assets: [
        { id: 'a-1', owner: 'spouse', type: 'savings', description: '배우자 예금', marketValue: 3000000, loanBalance: 0, hasPledge: false, isExempt: false },
      ],
      gamblingLoss: 15000000,
      speculativeLoss: 10000000,
      legalActions: ['seizure', 'court_order', 'collection_call'],
      monthlyLivingCost: 0, monthlyRent: 500000, monthlyInsurance: 0,
      extraLivingCost: { utilities: 80000, education: 150000, specialEducation: 0, medical: 0, other: 0 },
      specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
      consultationLogs: [],
    },
    diagnosis: { q1_status: 'seizure', q2_debtScale: '5000_to_10000', q3_income: 'unstable', q4_urgentNeed: 'seizure_wage', q5_goal: 'fast_resolution' },
  },
];

// ============================================================
// 실행 및 결과 출력
// ============================================================

function formatMoney(amount: number): string {
  if (amount === 0) return '0원';
  if (amount >= 100000000) {
    const eok = Math.floor(amount / 100000000);
    const man = Math.round((amount % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

console.log('='.repeat(120));
console.log('  내 상황 체크하기 시스템 점검 — 20개 테스트 케이스 결과');
console.log('='.repeat(120));
console.log('');

const results: any[] = [];

for (const scenario of scenarios) {
  console.log(`${'━'.repeat(120)}`);
  console.log(`  📋 케이스 #${scenario.id}: ${scenario.name}`);
  console.log(`${'━'.repeat(120)}`);

  // ── 1. 정밀 계산 (rehabEngine) ──
  let rehabResult: any;
  let rehabError = '';
  try {
    rehabResult = calculateRehabPlan(scenario.intake, DEFAULT_SETTINGS);
  } catch (e: any) {
    rehabError = e.message || String(e);
  }

  // ── 2. 간이 진단 (diagnosisEngine) ──
  let diagResult: any;
  let diagError = '';
  try {
    diagResult = runDiagnosis(scenario.diagnosis, DEFAULT_SETTINGS);
  } catch (e: any) {
    diagError = e.message || String(e);
  }

  // ── 법원 설정 확인 ──
  const courtConfig = DEFAULT_SETTINGS.courtConfigs[scenario.intake.selectedCourt];

  // ── 입력 요약 ──
  console.log('');
  console.log('  [입력 요약]');
  console.log(`    거주지: ${scenario.intake.residence} → 관할법원: ${scenario.intake.selectedCourt}`);
  console.log(`    소득: ${formatMoney(scenario.intake.incomeSources[0]?.amount || 0)} (${scenario.intake.incomeSources[0]?.type})`);
  console.log(`    총 채무: ${formatMoney(scenario.intake.debts.reduce((s, d) => s + d.principal, 0))} (채권자 ${scenario.intake.debts.length}곳)`);
  console.log(`    혼인: ${scenario.intake.maritalStatus} | 미성년자녀: ${scenario.intake.minorChildren}명 | 기타부양: ${scenario.intake.otherDependents}명`);
  if (scenario.intake.assets.length > 0) {
    console.log(`    자산: ${scenario.intake.assets.map(a => `${a.description}(${formatMoney(a.marketValue)})`).join(', ')}`);
  }
  if (scenario.intake.speculativeLoss) console.log(`    ⚠️ 투기 손실: ${formatMoney(scenario.intake.speculativeLoss)}`);
  if (scenario.intake.gamblingLoss) console.log(`    ⚠️ 도박 손실: ${formatMoney(scenario.intake.gamblingLoss)}`);
  if (scenario.intake.legalActions?.length) console.log(`    ⚠️ 법적 조치: ${scenario.intake.legalActions.join(', ')}`);

  // ── 법원 설정 ──
  console.log('');
  console.log('  [법원 설정]');
  if (courtConfig) {
    console.log(`    배우자재산 반영: ${courtConfig.includeSpouseProperty ? '✅ 포함(50%)' : '❌ 미반영'}`);
    console.log(`    코인/주식 청산가치: ${courtConfig.includeCryptoStock ? '✅ 포함' : '❌ 제외'}`);
    console.log(`    24개월 특례: ${courtConfig.allow24Month ? '✅ 가능' : '❌ 불가'}`);
  } else {
    console.log(`    ❗ 법원 설정 없음 (${scenario.intake.selectedCourt})`);
  }

  // ── 정밀 계산 결과 ──
  console.log('');
  console.log('  [정밀계산 결과 (rehabEngine)]');
  if (rehabError) {
    console.log(`    ❌ 오류: ${rehabError}`);
  } else if (rehabResult) {
    console.log(`    월 소득: ${formatMoney(rehabResult.client.monthlyIncome)} | 부양가족: ${rehabResult.client.dependents}명`);
    console.log(`    인정 생계비: ${formatMoney(rehabResult.base.living)}`);
    console.log(`    가용소득(월): ${formatMoney(rehabResult.base.disposable)}`);
    console.log(`    총 채무: ${formatMoney(rehabResult.base.debtTotal)}`);
    console.log(`    청산가치: ${formatMoney(rehabResult.base.liq)}`);
    console.log(`    24개월 특례 적용: ${rehabResult.allow2435 ? '✅' : '❌'}`);
    console.log('');
    console.log('    변제 시뮬레이션:');
    for (const row of rehabResult.rows) {
      console.log(`      ${row.m}개월: 월 ${formatMoney(row.monthly)} → 총 ${formatMoney(row.total)} | ${row.mode} (생계비 감액 ${pct(row.needCutPct)})`);
    }
    if (rehabResult.preferred) {
      console.log(`    ✅ 추천 플랜: ${rehabResult.preferred.m}개월 | 월 ${formatMoney(rehabResult.preferred.monthly)} | ${rehabResult.preferred.why}`);
    } else {
      console.log('    ⚠️ 추천 플랜 없음');
    }
    if (rehabResult.alerts.length > 0) {
      console.log('    ⚠️ 경고:');
      for (const alert of rehabResult.alerts) {
        console.log(`      [${alert.severity.toUpperCase()}] ${alert.message}`);
      }
    }
  }

  // ── 간이 진단 결과 ──
  console.log('');
  console.log('  [간이진단 결과 (diagnosisEngine)]');
  if (diagError) {
    console.log(`    ❌ 오류: ${diagError}`);
  } else if (diagResult) {
    console.log(`    1차 전략: ${diagResult.primaryStrategy.label} (${diagResult.primaryStrategy.type}, 신뢰도: ${diagResult.primaryStrategy.confidence})`);
    if (diagResult.secondaryStrategy) {
      console.log(`    2차 전략: ${diagResult.secondaryStrategy.label} (${diagResult.secondaryStrategy.type}, 신뢰도: ${diagResult.secondaryStrategy.confidence})`);
    }
    console.log(`    긴급도: ${diagResult.urgencyLevel} — ${diagResult.urgencyMessage}`);
    console.log(`    예상 채무: ${formatMoney(diagResult.estimatedDebtTotal)} | 탕감율: ${pct(diagResult.estimatedSavingsRate)} | 월 변제금: ${formatMoney(diagResult.estimatedMonthlyPayment)}`);
    console.log(`    rehabEngine 사용: ${diagResult.rehabEngineUsed ? '✅' : '❌'}`);
    if (diagResult.actionItems.length > 0) {
      console.log('    행동 가이드:');
      for (const item of diagResult.actionItems) {
        console.log(`      • ${item}`);
      }
    }
    if (diagResult.warnings.length > 0) {
      console.log('    경고:');
      for (const w of diagResult.warnings) {
        console.log(`      ⚠️ ${w}`);
      }
    }
  }

  console.log('');

  // 결과 수집
  results.push({
    id: scenario.id,
    name: scenario.name,
    residence: scenario.intake.residence,
    court: scenario.intake.selectedCourt,
    income: scenario.intake.incomeSources[0]?.amount || 0,
    debtTotal: scenario.intake.debts.reduce((s: number, d: any) => s + d.principal, 0),
    rehabResult,
    rehabError,
    diagResult,
    diagError,
    courtConfig,
  });
}

// ── 요약 테이블 ──
console.log('');
console.log('='.repeat(120));
console.log('  📊 전체 결과 요약 테이블');
console.log('='.repeat(120));
console.log('');
console.log(
  '#'.padStart(3) + ' | ' +
  '시나리오'.padEnd(22) + ' | ' +
  '거주지'.padEnd(14) + ' | ' +
  '법원'.padEnd(20) + ' | ' +
  '소득'.padStart(8) + ' | ' +
  '채무'.padStart(10) + ' | ' +
  '가용소득'.padStart(8) + ' | ' +
  '생계비'.padStart(8) + ' | ' +
  '청산가치'.padStart(10) + ' | ' +
  '추천'.padStart(5) + ' | ' +
  '1차전략'.padEnd(12) + ' | ' +
  '긴급도'
);
console.log('-'.repeat(160));

for (const r of results) {
  const rr = r.rehabResult;
  const dr = r.diagResult;
  console.log(
    String(r.id).padStart(3) + ' | ' +
    r.name.padEnd(22) + ' | ' +
    r.residence.padEnd(14) + ' | ' +
    r.court.padEnd(20) + ' | ' +
    formatMoney(r.income).padStart(8) + ' | ' +
    formatMoney(r.debtTotal).padStart(10) + ' | ' +
    (rr ? formatMoney(rr.base.disposable) : 'ERR').padStart(8) + ' | ' +
    (rr ? formatMoney(rr.base.living) : 'ERR').padStart(8) + ' | ' +
    (rr ? formatMoney(rr.base.liq) : 'ERR').padStart(10) + ' | ' +
    (rr?.preferred ? `${rr.preferred.m}개월` : '없음').padStart(5) + ' | ' +
    (dr ? dr.primaryStrategy.label : 'ERR').padEnd(12) + ' | ' +
    (dr ? dr.urgencyLevel : 'ERR')
  );
}

console.log('');
console.log('='.repeat(120));
console.log('  ✅ 20개 테스트 케이스 실행 완료');
console.log('='.repeat(120));
