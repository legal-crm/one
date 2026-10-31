import { describe, expect, it } from 'vitest';
import { parseCreditorCsvText, splitCsv, decodeCsvBytes } from './competitorCreditorCsv';
import { REHAB_CSV_HEADERS, BANKRUPTCY_CSV_HEADERS } from './eFilingCsv';

describe('competitorCreditorCsv', () => {
  it('따옴표 안 쉼표·줄바꿈', () => {
    expect(splitCsv('a,"b,c","d""e"\r\n1,2,3\n')).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']]);
  });

  it('회생 13열 당사자형', () => {
    const csv = [REHAB_CSV_HEADERS.join(','), 'F,채권자,1,,주식회사 국민은행,법인,서울특별시 영등포구 의사당대로 141,여의도영업부,07331,,02-1588-9999,02-000-0000,'].join('\r\n');
    const r = parseCreditorCsvText(csv);
    expect(r.format).toBe('rehab13');
    expect(r.rows[0]).toMatchObject({ name: '주식회사 국민은행', zipCode: '07331', fax: '02-000-0000', personType: '법인' });
    expect(r.rows[0].address).toBe('서울특별시 영등포구 의사당대로 141, 여의도영업부');
    expect(r.rows[0].principal).toBeUndefined();
  });

  it('파산 18열: 원금·이자·발생원인, 주민번호 칸 버림', () => {
    const csv = [BANKRUPTCY_CSV_HEADERS.join(','), 'F,1,,홍길동,,서울 중구 세종대로 110,,04524,010-1234-5678,,,,2023-03-01,①,5000000,생활비,"3,200,000",410000', 'F,2,,900101-1234567,,,,,,,,,,,,,,'].join('\n');
    const r = parseCreditorCsvText(csv);
    expect(r.format).toBe('bankruptcy18');
    expect(r.rows[0]).toMatchObject({ name: '홍길동', principal: 3200000, interest: 410000, cause: '①', borrowedOn: '2023-03-01' });
    expect(r.rows.length).toBe(1);
    expect(r.warnings.join(' ')).toContain('주민등록번호');
  });

  it('머리글 없으면 안내', () => {
    expect(parseCreditorCsvText('a,b\n1,2').warnings[0]).toContain('채권자명');
  });

  it('UTF-8 BOM 판별', () => {
    const enc = new TextEncoder().encode('\uFEFF채권자명\n국민은행');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('채권자명\n국민은행')]);
    expect(decodeCsvBytes(bom.buffer).encoding).toBe('utf-8');
    expect(decodeCsvBytes(enc.buffer).text).toContain('채권자명');
  });
});
