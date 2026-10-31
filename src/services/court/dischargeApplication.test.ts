import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { buildHwpx, applyEditsToSection } from './hwpxBuilder';
import { dischargeHwpxEdits, dischargeHtml, emptyDischargeForm, validateDischarge, parseCaseNumber } from './dischargeApplication';

const form = () => ({
  ...emptyDischargeForm(new Date(2026, 10, 2)),
  courtName: '수원회생법원', caseNumber: '2023개회 12345', name: '홍길동', address: '경기도 수원시 팔달구 시험로 1',
  phone: '010-1234-5678', bankName: '국민', bankBranch: '수원', accountNumber: '123-45-678901', accountIsOwn: true, repaymentDone: true,
});

describe('면책신청서 (H-0)', () => {
  it('실제 법원 양식의 빈칸을 모두 찾아 채운다', async () => {
    const buf = fs.readFileSync(path.resolve('public/court-forms/hwpx/개인회생 면책신청서.hwpx'));
    const r = await buildHwpx(buf, dischargeHwpxEdits(form(), '9001011234567'));
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    const zip = await JSZip.loadAsync(r.bytes!);
    const xml = await zip.file('Contents/section0.xml')!.async('string');
    expect(xml).toContain('2023개회12345');
    expect(xml).toContain('홍길동');
    expect(xml).toContain('900101-1234567');
    expect(xml).toContain('수원회생법원 귀중');
    expect(xml).toContain('2026. 11. 2.');
    expect(xml).not.toContain('linesegarray');
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
  });

  it('검사: 주민번호·계좌 본인 확인·서명 방법이 없으면 막고, 변제 미확인은 경고만', () => {
    const f = { ...form(), accountIsOwn: false, repaymentDone: false };
    const g = validateDischarge(f, '12', null);
    expect(g.ok).toBe(false);
    expect(g.blocks.map(b => b.field)).toEqual(expect.arrayContaining(['rrn', 'accountIsOwn', 'sign']));
    expect(g.warns.map(w => w.field)).toContain('repaymentDone');
    expect(validateDischarge(form(), '900101-1234567', 'blank').ok).toBe(true);
  });

  it('사건번호 형식과 PDF HTML', () => {
    expect(parseCaseNumber('2024개회 9')).toEqual({ year: '2024', serial: '9' });
    expect(parseCaseNumber('2024하단9')).toBeNull();
    const html = dischargeHtml(form(), '9001011234567', 'data:image/png;base64,AAAA');
    expect(html).toContain('제624조제1항');
    expect(html).toContain('<img src="data:image/png;base64,AAAA"');
    expect(html).not.toContain('<script');
  });

  it('표 칸 채우기·행 늘리기 (cell/rows)', () => {
    const cell = (r: number, c: number, t = '') => `<hp:tc><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:p><hp:run charPrIDRef="1">${t ? `<hp:t>${t}</hp:t>` : ''}</hp:run></hp:p></hp:tc>`;
    const xml = `<hp:tbl rowCnt="3" colCnt="2"><hp:tr>${cell(0, 0, '이름')}${cell(0, 1, '금액')}</hp:tr><hp:tr>${cell(1, 0)}${cell(1, 1)}</hp:tr><hp:tr>${cell(2, 0, '합계')}${cell(2, 1)}</hp:tr></hp:tbl>`;
    const r = applyEditsToSection(xml, [
      { kind: 'rows', table: 0, templateRow: 1, rows: [['가', '1'], ['나', '2'], ['다', '3']] },
      { kind: 'cell', table: 0, row: 4, col: 1, text: '6' },
    ]);
    expect(r.missing).toEqual([]);
    expect(r.xml).toContain('rowCnt="5"');
    expect((r.xml.match(/<hp:tr>/g) || []).length).toBe(5);
    expect(r.xml).toContain('<hp:t>다</hp:t>');
    expect(r.xml).toMatch(/rowAddr="4"\/><hp:p><hp:run charPrIDRef="1"><hp:t>6<\/hp:t>/);
  });
});
