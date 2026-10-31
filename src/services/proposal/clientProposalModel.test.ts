import { describe, expect, it } from 'vitest';
import {
  buildProposalSnapshot, proposalCostRows, proposalFaqs, proposalValidity, summarizeProposalInput, proposalGlossaryKeys,
} from './clientProposalModel';
import { REHAB_GLOSSARY } from '../glossary/rehabGlossary';

describe('clientProposalModel', () => {
  it('스냅샷: 확정값·수정 여부·유효기간', () => {
    const s = buildProposalSnapshot({
      procedure: 'rehab', issuedAt: '2026-11-01T00:00:00.000Z', validDays: 30,
      userInput: { familySize: 3, monthlyIncome: 3200000, totalDebt: 80000000, creditorCount: 7, foo: 'x' },
      court: '수원회생법원', monthlyPaymentWon: 450000, months: 36, calcMonthlyPaymentWon: 480000, calcMonths: 36,
    });
    expect(s.confirmed).toMatchObject({ monthlyPaymentWon: 450000, months: 36, totalRepaymentWon: 16200000, edited: true });
    expect(s.expiresAt.slice(0, 10)).toBe('2026-12-01');
    expect(s.input).toEqual({ familySize: 3, monthlyIncomeWon: 3200000, totalDebtWon: 80000000, creditorCount: 7, court: '수원회생법원' });
  });

  it('파산 스냅샷에는 확정 변제금이 없다', () => {
    const s = buildProposalSnapshot({ procedure: 'bankruptcy', monthlyPaymentWon: 300000, months: 36 });
    expect(s.confirmed).toBeUndefined();
  });

  it('실비 표: 회생 송달료는 채권자 수로 계산, 파산 서울 예납금 40만', () => {
    const rehab = proposalCostRows({ procedure: 'rehab', creditorCount: 5 });
    expect(rehab.find(r => r.label === '송달료')?.amountWon).toBe((10 + 5 * 8 + 5 * 2) * 5640);
    expect(rehab.find(r => r.label === '인지대')?.amountWon).toBe(32000);
    const unknown = proposalCostRows({ procedure: 'rehab' });
    expect(unknown.find(r => r.label === '송달료')?.amountWon).toBeNull();
    const bk = proposalCostRows({ procedure: 'bankruptcy', courtName: '서울회생법원', creditorCount: 4 });
    expect(bk.find(r => r.label === '예납금')?.amountWon).toBe(400000);
    expect(bk.find(r => r.label === '송달료')?.amountWon).toBe(((10 + 16) + (10 + 12)) * 5640);
    expect(proposalCostRows({ procedure: 'bankruptcy', courtName: '대구회생법원' }).find(r => r.label === '예납금')?.amountWon).toBeNull();
  });

  it('유효기간 지남 판단', () => {
    const v = proposalValidity('2026-10-01T00:00:00.000Z', 30, undefined, new Date('2026-11-05T00:00:00.000Z'));
    expect(v.expired).toBe(true);
    const w = proposalValidity('2026-11-01T00:00:00.000Z', 30, undefined, new Date('2026-11-05T00:00:00.000Z'));
    expect(w.expired).toBe(false);
    expect(w.daysLeft).toBe(26);
  });

  it('질문과 답에 금지·단정 표현이 없다', () => {
    const all = [
      ...proposalFaqs('rehab', { housingType: 'owned', deposit: 1, isMarried: true, speculativeLoss: 1, employmentType: 'business', priorityDebt: 1 }),
      ...proposalFaqs('bankruptcy', {}),
    ].map(f => f.q + f.a).join('\n');
    for (const bad of ['탕감', '100%', '전혀 아닙니다', '기각 없이', '획기적', '아무런 영향', '전담', '추천']) {
      expect(all).not.toContain(bad);
    }
  });

  it('용어집 18개 이상, 리포트 용어는 모두 용어집에 있다', () => {
    expect(Object.keys(REHAB_GLOSSARY).length).toBeGreaterThanOrEqual(18);
    for (const k of [...proposalGlossaryKeys('rehab'), ...proposalGlossaryKeys('bankruptcy')]) {
      expect(REHAB_GLOSSARY[k], k).toBeTruthy();
    }
  });

  it('입력 요약은 빈 값을 버린다', () => {
    expect(summarizeProposalInput({ familySize: 0, monthlyIncome: '', minorChildren: 0 })).toEqual({ minorChildren: 0 });
  });
});
