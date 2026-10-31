import { describe, expect, it } from 'vitest';
import { splitVatInclusive } from './vat';

describe('부가세 나누기 (AD-8)', () => {
  it('합계 = 공급가 + 부가세', () => {
    expect(splitVatInclusive(330_000)).toEqual({ supply: 300_000, vat: 30_000 });
    expect(splitVatInclusive(412_500)).toEqual({ supply: 375_000, vat: 37_500 });
    const s = splitVatInclusive(123_457);
    expect(s.supply + s.vat).toBe(123_457);
  });
  it('음수·빈 값은 0', () => {
    expect(splitVatInclusive(-5)).toEqual({ supply: 0, vat: 0 });
    expect(splitVatInclusive(NaN)).toEqual({ supply: 0, vat: 0 });
  });
});
