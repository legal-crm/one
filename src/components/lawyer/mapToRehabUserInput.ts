/**
 * consultRequest → RehabUserInput 변환 유틸리티
 * 
 * CaseReviewCopilot과 LawyerRole 양쪽에서 공통으로 사용합니다.
 * 고객 상담 요청 데이터를 회생 계산 엔진에 맞는 형식으로 변환합니다.
 */
import type { RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

/** financialProfile → RehabUserInput 변환 */
export function mapToRehabUserInput(req: any): RehabUserInput {
  const fp = req?.financialProfile || req || {};
  const maritalMap: Record<string, 'single' | 'married' | 'divorced' | 'widowed' | 'other'> = {
    'SINGLE': 'single', 'MARRIED': 'married', 'DIVORCED': 'divorced', 'WIDOWED': 'widowed',
  };
  const empMap: Record<string, 'salary' | 'business' | 'freelancer' | 'none' | 'daily'> = {
    'SALARIED': 'salary', 'BUSINESS': 'business', 'FREELANCER': 'freelancer', 'NONE': 'none', 'DAILY': 'daily',
  };
  return {
    address: fp.residenceRegion || '서울',
    age: fp.age || 40,
    gender: fp.gender || 'male',
    employmentType: empMap[fp.jobType || ''] || 'salary',
    monthlyIncome: (fp.income || 0) * 10000,
    maritalStatus: maritalMap[fp.maritalStatus || ''] || 'single',
    isMarried: fp.maritalStatus === 'MARRIED',
    minorChildren: fp.minorChildren || 0,
    familySize: (fp.dependents || 0) + 1,
    spouseIncome: (fp.spouseIncome || 0) * 10000,
    spouseAssets: (fp.spouseAsset || 0) * 10000,
    housingType: fp.housingType || 'rent',
    rentCost: (fp.rentCost || 0) * 10000,
    deposit: (fp.rentalDeposit || 0) * 10000,
    medicalCost: (fp.medicalCost || 0) * 10000,
    educationCost: (fp.educationCost || 0) * 10000,
    myAssets: (fp.myAssets || fp.assetsTotal || 0) * 10000,
    totalDebt: (fp.debtTotal || 0) * 10000,
    speculativeLoss: (fp.speculativeLoss || 0) * 10000,
    gamblingLoss: (fp.gamblingLoss || 0) * 10000,
    housingContractHolder: fp.housingContractHolder || 'self',
    depositLoan: (fp.depositLoan || 0) * 10000,
    creditCardDebt: ((fp.debtTypes?.cards || 0)) * 10000,
    salaryIncome: (fp.salaryIncome || 0) * 10000,
    businessIncome: (fp.businessIncome || 0) * 10000,
    childSupportReceived: (fp.childSupportReceived || 0) * 10000,
    childSupportPaid: (fp.childSupportPaid || 0) * 10000,
    specialEducationCost: (fp.specialEducationCost || 0) * 10000,
    legalActions: fp.legalActions || [],
    workLocation: fp.workLocation || fp.address || fp.residenceRegion || '서울',
    retirementPay: (fp.retirementPay || 0) * 10000,
    retirementPensionType: fp.retirementPensionType || 'unknown',
    monthlyFixedExpenses: (fp.monthlyFixedExpenses || 0) * 10000,
    clientNotes: fp.clientNotes || (fp.clientNote ? [fp.clientNote] : []),
    clientNote: fp.clientNote || '',
    riskFactor: fp.debtCause === 'INVESTMENT' ? 'investment' : fp.debtCause === 'GAMBLING' ? 'gambling' : 'none',
    name: fp.clientName || req?.clientName || '',
    phone: req?.phone || fp.clientPhone || '',
  };
}
