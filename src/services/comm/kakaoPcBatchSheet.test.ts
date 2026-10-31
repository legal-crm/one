import { describe, it, expect } from 'vitest';
import { buildPcBatchTable, readPcBatchResults, toKakaoPlainText, PC_BATCH_FIRST_ROW } from './kakaoPcBatchSheet';

const items = [
  { taskId: 't1', kakaoName: '가상의뢰인', body: '📌 서류를 보내 주세요\n▶ 확인: 주소' },
  { taskId: 't2', kakaoName: '가상이씨', body: '접수했어요' },
];

describe('PC 카톡 묶음 발송 표 (KT-8)', () => {
  it('이모지는 빼고 양식 칸(B8~)에 맞춘다', () => {
    expect(toKakaoPlainText('📌 서류 ✨ 안내')).toBe('서류  안내');
    const t = buildPcBatchTable(items);
    expect(t[PC_BATCH_FIRST_ROW - 2].slice(1, 6)).toEqual(['구분', '채팅방 이름', '보낼 메시지', '텍스트값', '발송결과']);
    expect(t[PC_BATCH_FIRST_ROW - 1]).toEqual(['', '채팅', '가상의뢰인', '서류를 보내 주세요\n▶ 확인: 주소', '', '', 't1']);
  });

  it('우리 표에 결과를 채워 올리면 번호로 맞춘다', () => {
    const t = buildPcBatchTable(items);
    t[PC_BATCH_FIRST_ROW - 1][5] = '1';
    t[PC_BATCH_FIRST_ROW][5] = '0';
    expect(readPcBatchResults(t, items)).toEqual({ sent: ['t1'], failed: 1, unmatched: 0, rows: 2 });
  });

  it('엑셀 양식(머리글 없음·B~F만)에서는 이름+메시지로 맞추고, 목록에 없는 줄은 따로 센다', () => {
    const t: unknown[][] = Array.from({ length: 7 }, () => []);
    t.push(['', '채팅', '가상이씨', '접수했어요', '', 1]);
    t.push(['', '채팅', '모르는사람', '다른 글', '', 1]);
    expect(readPcBatchResults(t, items)).toEqual({ sent: ['t2'], failed: 0, unmatched: 1, rows: 2 });
  });
});
