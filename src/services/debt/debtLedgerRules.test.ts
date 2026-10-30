import { describe, expect, it } from 'vitest';
import {
  applyCertificateToCreditors, basisText, bigDifference, checkSum, claimCauseText, claimContentText, duplicateWarnings,
  headerBaseDate, interestPart, ledgerComplete, reviewFlags, type DebtCertificate,
} from './debtLedgerRules';

const cert = (over: Partial<DebtCertificate> = {}): DebtCertificate => ({
  id: 'c1', seq: 1, creditorName: 'TEST은행', source: 'client', method: 'agency', status: 'verified', docType: '부채증명서',
  values: { baseDate: '2026-09-30', principal: 10_000_000, interest: 300_000, lateInterest: 50_000, total: 10_350_000, lateRate: 15, loanDate: '2023-04-03', initialAmount: 12_000_000 },
  category: 'general', attrs: { guarantee: 'no', futureIndemnity: 'no', secured: 'no' }, fileIds: [], version: 1, ...over,
});

describe('debtLedgerRules', () => {
  it('이자 칸 = 합계 − 원금, 검산', () => {
    expect(interestPart(cert().values)).toBe(350_000);
    expect(checkSum(cert().values)?.ok).toBe(true);
    expect(checkSum({ ...cert().values, total: 10_400_000 })?.diff).toBe(50_000);
  });

  it('표준 문장: 산정근거·채권의 원인·채권의 내용', () => {
    expect(basisText(cert())).toBe('부채증명서 참조 (산정기준일 : 2026.09.30.)');
    expect(basisText(cert({ status: 'unavailable', altProof: 'loan_note' }))).toBe('차용증 참조 (산정기준일 : 2026.09.30.)');
    expect(claimCauseText(cert())).toBe('2023. 4. 3.자 대출거래약정에 따른 최초 대출금 12,000,000원');
    expect(claimContentText(cert())).toBe('10,350,000원 및 이중 원금 10,000,000원에 대한 2026. 10. 1.부터 완제일까지 연 15%의 연체이율에 의한 금원');
    expect(claimContentText(cert({ values: { baseDate: '2026-12-31', principal: 5_000_000, normalRate: 9 } })))
      .toBe('원금 5,000,000원 및 이에 대한 2027. 1. 1.부터 완제일까지 연 9%의 약정이율에 의한 금원');
  });

  it('반영은 해당 칸만 바꾸고 사람이 넣은 칸은 둔다', () => {
    const existing: any[] = [{ id: 'k1', creditorNumber: 1, name: 'TEST은행', principal: 9_000_000, interest: 0, address: '서울 TEST', annexDocType: 'ANNEX_2_DISPUTED', memo: 'TEST 메모', certificateId: 'c1', claimContent: '직접 쓴 문장', claimContentManual: true, isSecured: false, isUnconfirmed: false, isPriority: false, allocationRatio: 0, monthlyRepayment: 0, totalRepayment: 0, repaymentRate: 0 }];
    const r = applyCertificateToCreditors(existing, cert(), () => 'new');
    expect(r.creditorId).toBe('k1');
    expect(r.creditors[0]).toMatchObject({ principal: 10_000_000, interest: 350_000, baseDate: '2026-09-30', address: '서울 TEST', annexDocType: 'ANNEX_2_DISPUTED', memo: 'TEST 메모', claimContent: '직접 쓴 문장' });
    expect(r.changes.find(c => c.field === 'principal')).toMatchObject({ before: 9_000_000, after: 10_000_000 });
    const added = applyCertificateToCreditors([], cert({ id: 'c2' }), () => 'new');
    expect(added.creditors[0]).toMatchObject({ id: 'new', name: 'TEST은행', principal: 10_000_000, certificateId: 'c2' });
  });

  it('완료 판정·차이 경고·이중 등록', () => {
    expect(ledgerComplete([])).toBe(false);
    expect(ledgerComplete([{ status: 'applied' }, { status: 'unavailable', altProof: 'judgment' }])).toBe(true);
    expect(ledgerComplete([{ status: 'unavailable' }])).toBe(false);
    expect(bigDifference(10_000_000, 11_000_000)).toBe(true);
    expect(bigDifference(10_000_000, 10_500_000)).toBe(false);
    expect(bigDifference(1_000_000, 1_250_000)).toBe(true);
    expect(reviewFlags({ ...cert(), status: 'received', claimedPrincipal: 5_000_000 })).toEqual(['검수 필요', '진술액과 차이 큼']);
    const dup = duplicateWarnings([cert({ values: { assigned: { yes: true, to: 'TEST자산' } } }), cert({ creditorName: 'TEST자산' })]);
    expect(dup.length).toBe(1);
    expect(headerBaseDate([{ baseDate: '2026-09-01' }, { baseDate: '2026-09-30' }, {}])).toBe('2026-09-30');
  });
});
