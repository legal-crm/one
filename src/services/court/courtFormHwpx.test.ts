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
  stayCases: [{ creditorName: 'TEST채권자1', courtName: '수원지방법원', caseNumber: '2026타채100', caseType: '채권압류및추심' }],
  assets: {
    cash: 100_000, bankAccounts: [{ bankName: 'TEST은행', accountNumber: '111-222', balance: 500_000 }], bankDeduction: 0,
    insurance: [{ companyName: 'TEST생명', policyNumber: 'P-1', refundAmount: 300_000 }], insuranceDeduction: 0,
    vehicle: { modelYear: '', estimatedValue: 0, securedLoan: 0, netValue: 0 },
    leaseDeposit: { address: '경기 시험시 1', deposit: 10_000_000, monthlyRent: 400_000, exemptDeposit: 0, netValue: 0 },
    realEstate: { address: '', area: '', marketValue: 0, mortgage: 0, netValue: 0 },
    severancePay: { company: '', amount: 0, exemptAmount: 0, netValue: 0 },
  },
  ledgerTotals: { annualTotalIncome: 0, annualTotalDeductions: 0, annualNetIncome: 36_000_000, monthlyAverageIncome: 3_000_000 },
  statement: { education: '2005. 2. TEST고등학교 졸업', maritalHistory: '', housingType: '임차(전월세) 주택', housingDetail: '', housingStartDate: '2022-03-01', hasLitigationOrSeizure: true, debtCauses: ['생활비 부족', '사기 피해'], detailedReasonEssay: 'TEST 사유 첫 줄\n둘째 줄' },
});
const expectText: Partial<Record<FilledFormCode, string>> = { D5106: 'TEST채권자3', D5101: 'TEST은행', D5103: '시험회사', D5105: 'TEST 사유 첫 줄' };

const read = (code: FilledFormCode) => fs.readFileSync(path.resolve('public', FILLED_FORMS[code].path.replace(/^\//, '')));

describe('법원 양식 HWPX 채움 (H-1 1묶음)', () => {
  for (const code of Object.keys(FILLED_FORMS) as FilledFormCode[]) {
    it(`${code}: 채울 위치를 모두 찾는다`, async () => {
      const r = await buildHwpx(read(code), courtFormEdits(code, master(3), '9001011234567'));
      expect(r.ok).toBe(true);
      expect(r.missing).toEqual([]);
      const xml = await (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
      expect(xml).toContain(expectText[code] || '홍길동');
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

describe('첨부서류 채움 (D5101·D5103·D5105)', () => {
  const xmlOf = async (code: FilledFormCode, m: any) => {
    const r = await buildHwpx(read(code), courtFormEdits(code, m, ''));
    expect(r.missing).toEqual([]);
    return (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
  };
  it('D5101: 예금·보험·임차보증금·합계', async () => {
    const xml = await xmlOf('D5101', master(1));
    expect(xml).toContain('(1) TEST은행');
    expect(xml).toContain('TEST생명');
    expect(xml).toContain('보증금 10,000,000원, 월세 400,000원');
    expect(xml).toContain('10,900,000');
  });
  it('D5103: 60% 이하면 첫 문단에 가구원 수·생계비', async () => {
    const m = master(1); m.repaymentSummary.medianIncomeAmount = 2_564_238;
    const xml = await xmlOf('D5103', m);
    expect(xml).toContain('보건복지부 공표 ( 1 )인');
    expect(xml).toContain('( 1,538,543 )원을 지출할 것으로');
    expect(xml).toContain('3,000,000');
  });
  it('D5105: 사정 선택·줄바꿈·압류 표', async () => {
    const xml = await xmlOf('D5105', master(1));
    expect(xml).toContain('(○) 생활비 부족');
    expect(xml).toContain('(○) 사기 피해');
    expect(xml).toContain('TEST 사유 첫 줄<hp:lineBreak/>둘째 줄');
    expect(xml).toContain('2026타채100');
    expect(xml).toContain('■ 있음');
  });
});

describe('회생 부속·면책·파산 서식 채움 (H-1 2·3묶음)', () => {
  const xmlOf = async (code: FilledFormCode, m: any, rrn = '9001011234567') => {
    const r = await buildHwpx(read(code), courtFormEdits(code, m, rrn));
    expect(r.missing).toEqual([]);
    return (await JSZip.loadAsync(r.bytes!)).file('Contents/section0.xml')!.async('string');
  };
  it('D5108: 계산에 쓴 압류금지 공제만 표에', async () => {
    const m = master(1); m.assets.bankDeduction = 2_500_000; m.assets.severancePay = { company: 'TEST회사', amount: 4_000_000, exemptAmount: 2_000_000, netValue: 2_000_000 };
    const xml = await xmlOf('D5108', m, '');
    expect(xml).toContain('예금채권 중 압류금지 부분');
    expect(xml).toContain('2,500,000원');
    expect(xml).toContain('퇴직금 중 2분의 1 (TEST회사)');
    expect(xml).not.toContain('보장성 보험');
  });
  it('D5109: 면제할 임차보증금이 있으면 1번 항목 표시·금액', async () => {
    const m = master(1); m.assets.leaseDeposit.exemptDeposit = 5_500_000;
    const xml = await xmlOf('D5109', m, '');
    expect(xml).toContain('■ 1. 주거용건물 임차보증금반환청구권');
    expect(xml).toContain('금 5,500,000 원');
    expect(xml).toContain('( 10,000,000원)');
  });
  it('면책신청서·파산 신청서: 주민번호·환급계좌·법원', async () => {
    const dis = await xmlOf('DISCH', master(1));
    expect(dis).toContain('(주민등록번호 900101-1234567)');
    expect(dis).toContain('국민은행');
    expect(dis).toContain('수원회생법원 귀중');
    const bk = await xmlOf('BKP', master(1));
    expect(bk).toContain('(주민등록번호 : 900101-1234567)');
    expect(bk).toContain('휴대전화(010-1111-2222)');
  });
  it('검사: 면책신청서는 사건번호가 있어야, 파산 신청서는 주민번호가 있어야', () => {
    const m = master(1); m.court.caseNumber = '';
    expect(courtFormGuard('DISCH', m, '9001011234567').ok).toBe(false);
    expect(courtFormGuard('BKP', master(1), '').ok).toBe(false);
    expect(courtFormGuard('SVC', master(1), '').ok).toBe(true);
  });
  it('D5116 소득진술서: 표 칸·월평균 소득·법원, 영업 개시일은 비움', async () => {
    const m = master(1); m.debtor.employmentType = '영업소득자'; m.debtor.jobTitle = 'TEST 음식점업'; m.debtor.workplaceAddress = '경기 시험시 2';
    const xml = await xmlOf('D5116', m);
    expect(xml).toContain('시험회사');
    expect(xml).toContain('TEST 음식점업');
    expect(xml).toContain('900101-1234567');
    expect(xml).toContain('월평균 ( 3,000,000 )원의');
    expect(xml).toContain('본인은      년    월   일부터');
    expect(courtFormGuard('D5116', m, '').ok).toBe(false);
    expect(courtFormGuard('D5116', master(1), '9001011234567').warns.some(w => /D5115/.test(w.message))).toBe(true);
  });
  it('D5122 변제계획 변경안 제출서: 사건·채무자·대리인, 사건번호 없으면 막음', async () => {
    const xml = await xmlOf('D5122', master(1), '');
    expect(xml).toContain('2026개회1234  개인회생');
    expect(xml).toContain('변호사   김변호');
    expect(xml).toContain('수원회생법원 귀중');
    const m = master(1); m.court.caseNumber = '';
    expect(courtFormGuard('D5122', m, '').ok).toBe(false);
    expect(courtFormGuard('D5122', master(1), '').warns.some(w => /예시 문장/.test(w.message))).toBe(true);
  });
});
