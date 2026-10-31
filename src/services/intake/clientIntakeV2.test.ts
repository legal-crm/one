import { describe, it, expect } from 'vitest';
import { buildIntakeV2, intakeInputFromProfile, formatIntakeValue, INTAKE_FIELDS } from './clientIntakeV2';

describe('의뢰인 정리 자료 v2 (I-4)', () => {
  const input = { familySize: 3, minorChildren: 1, maritalStatus: 'married', employmentType: 'salary', monthlyIncome: 3_200_000, totalDebt: 80_000_000, housingType: 'rent', deposit: 10_000_000, rentCost: 700_000, retirementPensionType: 'unknown', legalActions: ['seizure'], name: 'TEST이름', phone: '010-1234-5678' };

  it('답한 그대로 원 단위, 이름·전화 없음, 모르는 칸은 확인 필요', () => {
    const v = buildIntakeV2(input as any);
    expect(v.version).toBe(2);
    expect(v.answers.monthlyIncome).toBe(3_200_000);
    expect(JSON.stringify(v)).not.toContain('TEST이름');
    expect(JSON.stringify(v)).not.toContain('010-1234-5678');
    expect(v.needCheck).toContain('배우자 월 소득');
    expect(v.needCheck).toContain('퇴직연금 가입 여부');
    expect(v.changedKeys).toBeUndefined();
  });

  it('고치면 바뀐 칸을 남긴다', () => {
    const first = buildIntakeV2(input as any);
    const second = buildIntakeV2({ ...input, monthlyIncome: 2_900_000 } as any, undefined, first);
    expect(second.changedKeys).toEqual(['monthlyIncome']);
  });

  it('내 사건 화면(만 원 단위)에서 고친 값도 원 단위로', () => {
    const v = buildIntakeV2(intakeInputFromProfile({ income: 300, debtTotal: 5000, dependents: 1, maritalStatus: 'SINGLE', rentalDeposit: 1000 }));
    expect(v.answers.monthlyIncome).toBe(3_000_000);
    expect(v.answers.familySize).toBe(2);
    expect(v.answers.deposit).toBe(10_000_000);
    const f = INTAKE_FIELDS.find(x => x.key === 'legalActions')!;
    expect(formatIntakeValue(f, ['seizure', 'court_order'])).toBe('급여·계좌 압류, 지급명령·소장');
  });
});
