import { describe, expect, it } from 'vitest';
// @ts-ignore 서버 함수 모듈 (JS)
import { buildStatementMasker } from '../../api/_lib/statement-masking.js';

describe('진술서 AI 비식별화 (P-2)', () => {
  it('이름·회사는 역할 표시로, 주민번호·전화·계좌·이메일은 종류 표시로', () => {
    const m = buildStatementMasker({ applicantName: '홍길동', terms: ['김영희', '한빛물산', '국민카드'] });
    const out = m.mask('홍길동은 한빛물산에서 일했고 아내 김영희가 국민카드를 썼다. 010-1234-5678, 900101-1234567, 123-456-789012, a@b.com');
    expect(out).not.toMatch(/홍길동|김영희|한빛물산|국민카드|010-1234|900101|123-456|a@b\.com/);
    expect(out).toContain('«신청인»');
    expect(out).toContain('«주민번호»');
    expect(out).toContain('«전화번호»');
    expect(out).toContain('«계좌번호»');
    expect(out).toContain('«이메일»');
  });

  it('답을 받으면 이름을 되돌리고 신청인은 "신청인"으로', () => {
    const m = buildStatementMasker({ applicantName: '홍길동', terms: ['김영희'] });
    const masked = m.mask('홍길동의 배우자 김영희');
    expect(m.unmask(`${masked}가 병원비를 냈다`)).toBe('신청인의 배우자 김영희가 병원비를 냈다');
    expect(m.unmaskDeep({ a: [masked] })).toEqual({ a: ['신청인의 배우자 김영희'] });
  });

  it('긴 이름을 먼저 바꾼다', () => {
    const m = buildStatementMasker({ terms: ['김철', '김철수'] });
    const out = m.mask('김철수와 김철');
    expect(m.unmask(out)).toBe('김철수와 김철');
  });
});
