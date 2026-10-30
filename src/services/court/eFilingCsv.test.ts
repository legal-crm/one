import { describe, expect, it } from 'vitest';
import { REHAB_CSV_HEADERS, buildBankruptcyCreditorCsv, buildRehabCreditorCsv, normalizeCourtPhone, personTypeLabel, splitRoadAddress } from './eFilingCsv';
import { encodeCp949 } from '../../utils/cp949';

const base: any = { allocationRatio: 0, monthlyRepayment: 0, totalRepayment: 0, repaymentRate: 0, isSecured: false, isUnconfirmed: false, isPriority: false, interest: 0 };

describe('eFilingCsv', () => {
  it('회생 13열: 금액·원인 없이 당사자 정보만, 보증인은 구분번호 행', () => {
    const r = buildRehabCreditorCsv([
      { ...base, id: 'a', creditorNumber: 1, name: 'TEST은행', principal: 10_000_000, address: '서울 중구 세종대로 110, 3층', zipCode: '04524', phone: '1588-1234' },
      { ...base, id: 'b', creditorNumber: 2, displayNumber: '1-1', name: 'TEST보증재단', principal: 0, address: '', isGuarantorClaim: true },
    ]);
    const lines = r.text.trim().split('\r\n');
    expect(lines[0]).toBe(REHAB_CSV_HEADERS.join(','));
    expect(lines[1]).toBe('F,채권자,1,,TEST은행,법인,서울 중구 세종대로 110,3층,04524,,02-1588-1234,,');
    expect(lines[2].startsWith('F,보증인(대위변제자),1,1,TEST보증재단,')).toBe(true);
    expect(lines[1]).not.toContain('10000000');
    expect(r.warnings.some(w => w.includes('1-1번') && w.includes('우편번호'))).toBe(true);
  });

  it('파산 18열: 발생원인 번호·필수 칸 경고', () => {
    const r = buildBankruptcyCreditorCsv([{ ...base, id: 'a', creditorNumber: 1, name: 'TEST카드', principal: 3_000_000, interest: 120_000, debtCauseDetail: '신용카드 이용대금', borrowedDate: '2023-04-03', initialPrincipal: 3_500_000, debtUsage: '생활비', zipCode: '01234', address: '서울 TEST로 1' }]);
    const row = r.text.trim().split('\r\n')[1].split(',');
    expect(row.length).toBe(18);
    expect(row.slice(12)).toEqual(['2023.04.03.', '②', '3500000', '생활비', '3000000', '120000']);
    expect(r.warnings).toEqual([]);
  });

  it('도우미', () => {
    expect(splitRoadAddress('경기 남양주시 진접읍 해밀예당1로189번길 3, 2102동 301호')).toEqual(['경기 남양주시 진접읍 해밀예당1로189번길 3', '2102동 301호']);
    expect(normalizeCourtPhone('1577-0000')).toBe('02-1577-0000');
    expect(personTypeLabel({ name: '남양주세무서' } as any)).toBe('국가');
    expect(personTypeLabel({ name: '홍길동' } as any)).toBe('');
    expect(Array.from(encodeCp949('F,국민').bytes)).toEqual([0x46, 0x2c, 0xb1, 0xb9, 0xb9, 0xce]);
  });
});
