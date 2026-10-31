import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { buildHwpx } from './hwpxBuilder';
import { courtFormEdits, courtFormGuard, FILLED_FORMS, type FilledFormCode } from './courtFormHwpx';

vi.mock('../documents/courtFilingEngine', () => ({ creditorAnnexNumbers: (c: any) => (c.isSecured ? [1] : []) }));

const creditor = (i: number, extra: any = {}) => ({
  id: `c${i}`, creditorNumber: i, displayNumber: String(i), name: `TEST채권자${i}`, principal: 1_000_000 * i, interest: 10_000 * i,
  address: '서울 시험구 시험로 1', creditorPhone: '02-000-0000', claimCause: '대여금', claimContent: `${i}번 채권 내용`, baseDate: '2026-09-30', ...extra,
});

const master = (n: number): any => ({
  debtor: { name: '홍길동', residentAddress: '경기 시험시 1', currentAddress: '경기 시험시 1', serviceAddress: '', serviceRecipient: '', phone: '010-1111-2222', homePhone: '', refundBank: '국민', refundAccount: '123-456', employmentType: '급여소득자', workplaceName: '시험회사' },
  lawyer: { firmName: '시험법률사무소', lawyerName: '김변호', address: '서울 시험구 2', phone: '02-111-2222', fax: '02-111-2223', email: 'test@example.test' },
  court: { courtName: '수원회생법원', caseYear: '2026', caseType: '개회', caseNumber: '1234', applicationDate: '2026-11-02', firstRepaymentDate: '2027-01-25' },
  repaymentSummary: { monthlyNetIncome: 3_000_000, householdSize: 1, monthlyLivingCost: 1_538_543, additionalLivingCost: 0, monthlyDisposableIncome: 1_000_000, repaymentMonths: 36, totalRepaymentAmount: 36_000_000, liquidationValue: 1_000_000, presentValue: 33_000_000, repaymentRatio: 50, isExternalTrustee: false, meetsStatutoryMinimum: true },
  creditors: Array.from({ length: n }, (_, k) => creditor(k + 1, k === 0 ? { isSecured: true } : {})),
  stayCases: [{ creditorName: 'TEST채권자1', courtName: '수원지방법원', caseNumber: '2026타채100' }],
});

const read = (code: FilledFormCode) => fs.readFileSync(path.resolve('public', FILLED_FORMS[code].path.replace(/^\//, '')));

describe('법원 양식 HWPX 채움 (H-1 1묶음)', () => {
  for (const code of Object.keys(FILLED_FORMS) as FilledFormCode[]) {
    it(`${code}: 채울 위치를 모두 찾는다`, async () => {
      const r = await buildHwpx(read(code), courtFormEdits(code, master(3), '9001011234567'));
      expect(r.ok).toBe(true);
      expect(r.missing).toEqual([]);
      const xml = await (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
      expect(xml).toContain(code === 'D5106' ? 'TEST채권자3' : '홍길동');
    });
  }

  it('D5106: 채권자 17명이면 표를 복제해 모두 넣는다', async () => {
    const r = await buildHwpx(read('D5106'), courtFormEdits('D5106', master(17), ''));
    expect(r.missing).toEqual([]);
    const xml = await (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
    expect(xml).toContain('TEST채권자17');
    expect(xml).toContain('17번 채권 내용');
    expect(xml).toContain('■ 부속서류 (1)');
  });

  it('D5110: 채권자 8명이면 변제예정액 표 행을 늘리고 합계 행을 찾는다', async () => {
    const r = await buildHwpx(read('D5110'), courtFormEdits('D5110', master(8), ''));
    expect(r.missing).toEqual([]);
    const xml = await (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
    expect(xml).toContain('TEST채권자8');
    expect(xml).toContain('(G) 36,000,000');
  });

  it('검사: 주민번호 없으면 개시신청서를 막고, 채권자 없으면 목록을 막는다', () => {
    expect(courtFormGuard('D5100', master(1), '').ok).toBe(false);
    expect(courtFormGuard('D5106', master(0), '').ok).toBe(false);
    expect(courtFormGuard('D5106', master(2), '').ok).toBe(true);
    const bad = master(2); bad.repaymentSummary.presentValue = 500_000; bad.repaymentSummary.liquidationValue = 1_000_000;
    expect(courtFormGuard('D5110', bad, '').ok).toBe(false);
  });
});
