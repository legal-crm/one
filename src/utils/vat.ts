/** 부가세 포함 금액을 공급가·부가세로 나눈다 (부가세 = 포함 금액의 1/11 반올림, 공급가 = 나머지). 정수 원 */
export function splitVatInclusive(total: number): { supply: number; vat: number } {
  const t = Math.max(0, Math.round(Number(total) || 0));
  const vat = Math.round(t / 11);
  return { supply: t - vat, vat };
}
