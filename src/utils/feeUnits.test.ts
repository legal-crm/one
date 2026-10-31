import { describe, expect, it } from 'vitest';
import { feeStoreValue, feeTotalWon } from './feeUnits';

describe('수임료 저장값 (FE-3)', () => {
  it('만 원으로 떨어지면 만원 숫자', () => {
    expect(feeStoreValue(3_300_000)).toBe(330);
    expect(feeTotalWon(feeStoreValue(3_300_000))).toBe(3_300_000);
  });
  it('끝전이 있으면 원 그대로 (반올림 안 함)', () => {
    expect(feeStoreValue(3_305_000)).toBe(3_305_000);
    expect(feeTotalWon(feeStoreValue(3_305_500))).toBe(3_305_500);
  });
  it('0은 0', () => {
    expect(feeStoreValue(0)).toBe(0);
  });
});
