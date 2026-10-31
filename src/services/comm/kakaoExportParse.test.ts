import { describe, it, expect } from 'vitest';
import { parseKakaoExport } from './kakaoExportParse';

describe('카카오톡 대화 내보내기 해석 (KT-4)', () => {
  it('PC(윈도) 형식: 날짜 구분 줄 + [이름] [오전/오후 시:분], 여러 줄 메시지', () => {
    const txt = [
      '\uFEFF가상의뢰인 님과 카카오톡 대화',
      '저장한 날짜 : 2026-10-31 19:00:12',
      '',
      '--------------- 2026년 10월 1일 목요일 ---------------',
      '[가상의뢰인] [오전 10:00] 안녕하세요',
      '[가상사무장] [오후 12:05] 서류 목록입니다',
      '1. 주민등록등본',
      '2. 가족관계증명서',
      '[가상의뢰인] [오후 12:05] 네',
      '[가상의뢰인] [오후 12:05] 네',
    ].join('\r\n');
    const r = parseKakaoExport(txt);
    expect(r.format).toBe('pc');
    expect(r.title).toBe('가상의뢰인');
    expect(r.lines).toHaveLength(4);
    expect(r.lines[0]).toEqual({ at: '2026-10-01T01:00:00.000Z', sender: '가상의뢰인', body: '안녕하세요', n: 1 });
    expect(r.lines[1].at).toBe('2026-10-01T03:05:00.000Z');
    expect(r.lines[1].body).toBe('서류 목록입니다\n1. 주민등록등본\n2. 가족관계증명서');
    expect([r.lines[2].n, r.lines[3].n]).toEqual([1, 2]);
    expect(r.senders[0]).toEqual({ name: '가상의뢰인', count: 3 });
    expect(r.unparsed).toBe(0);
  });

  it('안드로이드 형식 + 들어옴 같은 시스템 줄, 오전 12시 = 0시', () => {
    const txt = [
      '가상의뢰인 님과 카카오톡 대화',
      '저장한 날짜 : 2026년 10월 31일 오후 7:00',
      '2026년 10월 1일 목요일',
      '2026년 10월 1일 오전 12:30, 가상의뢰인 : 늦게 죄송해요',
      '2026년 10월 1일 오후 1:00, 가상사무장님이 들어왔습니다.',
      '2026년 10월 1일 오후 1:01, 가상사무장 : 괜찮아요 : 내일 봬요',
    ].join('\n');
    const r = parseKakaoExport(txt);
    expect(r.format).toBe('android');
    expect(r.lines.map(l => [l.at, l.sender, l.body])).toEqual([
      ['2026-09-30T15:30:00.000Z', '가상의뢰인', '늦게 죄송해요'],
      ['2026-10-01T04:01:00.000Z', '가상사무장', '괜찮아요 : 내일 봬요'],
    ]);
    expect(r.systemLines).toBe(2);
  });

  it('아이폰 형식 (2026. 10. 1. 오후 3:05, 이름 : 내용)', () => {
    const r = parseKakaoExport('2026. 10. 1. 오후 3:05, 가상의뢰인 : 사진 보냈어요\n2026. 10. 2. 오전 9:00, 가상사무장 : 확인했어요');
    expect(r.format).toBe('ios');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].at).toBe('2026-10-01T06:05:00.000Z');
  });

  it('맥 CSV 형식', () => {
    const r = parseKakaoExport('Date,User,Message\n2026-10-01 10:00:00,"가상의뢰인","안녕하세요, 질문 있어요"\n2026-10-01 10:02:30,"가상사무장","네"');
    expect(r.format).toBe('mac_csv');
    expect(r.lines[0]).toEqual({ at: '2026-10-01T01:00:00.000Z', sender: '가상의뢰인', body: '안녕하세요, 질문 있어요', n: 1 });
    expect(r.lines[1].at).toBe('2026-10-01T01:02:30.000Z');
  });

  it('영어 표시 PC 형식, 해석 못 하는 줄은 수만 센다', () => {
    const txt = ['--------------- Thursday, October 1, 2026 ---------------', '[Kim] [3:05 PM] hello', 'stray line before?'].join('\n');
    const r = parseKakaoExport('random header\n' + txt);
    expect(r.lines).toEqual([{ at: '2026-10-01T06:05:00.000Z', sender: 'Kim', body: 'hello\nstray line before?', n: 1 }]);
    expect(r.unparsed).toBe(1);
  });
});
