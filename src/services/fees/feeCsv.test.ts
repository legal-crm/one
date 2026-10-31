import { describe, expect, it } from 'vitest';
import { csvCell, maskPersonName, toCsv } from './feeCsv';

describe('feeCsv', () => {
  it('수식으로 읽힐 칸 앞에 따옴표 기호를 붙인다', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+82')).toBe("'+82");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell(300000)).toBe('300000');
  });
  it('쉼표·따옴표·줄바꿈은 감싼다', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsv([['a', 1], ['b', null]])).toBe('a,1\r\nb,');
  });
  it('이름을 가린다', () => {
    expect(maskPersonName('홍길동')).toBe('홍*동');
    expect(maskPersonName('김철')).toBe('김*');
    expect(maskPersonName('남궁민수')).toBe('남**수');
    expect(maskPersonName('')).toBe('');
  });
});
