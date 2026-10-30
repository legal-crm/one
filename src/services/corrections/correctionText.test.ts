import { describe, expect, it } from 'vitest';
import { detectPhotoCount, splitCorrectionText, suggestFromLibrary } from './correctionText';
import { buildCorrectionBrief } from './correctionBrief';
import type { CorrectionItem, CorrectionOrder, LibraryEntry } from './correctionService';

const LIB: LibraryEntry[] = [
  { id: 'lib-insurance', category: '보험', title: '보험', clientTitle: '보험 자료', neededDocs: ['해약환급금'], tableType: 'T3', questions: [], owner: 'client', keywords: ['보험', '해약환급금'] },
  { id: 'lib-immigration', category: '출입국', title: '출입국', clientTitle: '출입국 사실증명', neededDocs: [], questions: [], owner: 'client', keywords: ['출입국'] },
];

describe('splitCorrectionText', () => {
  it('번호·세부 번호로 나누고 머리글은 버린다', () => {
    const text = [
      '사건 2026개회0000 개인회생',
      '아래 사항을 보정하시기 바랍니다.',
      '1. 보험 가입 내역을 제출할 것',
      '2. 다음 자료를 제출할 것',
      '가. 출입국에 관한 사실증명',
      '나. 100만 원 이상 입출금 내역',
      '   (사용처 기재)',
      '3) 사업장 사진 내부 4장, 외부 2장',
    ].join('\n');
    const items = splitCorrectionText(text);
    expect(items.map(i => i.label)).toEqual(['1', '2-가', '2-나', '3']);
    expect(items[2].text).toContain('사용처 기재');
    expect(items[1].text.startsWith('다음 자료를 제출할 것')).toBe(true);
  });

  it('번호가 없으면 한 항목', () => {
    expect(splitCorrectionText('생계비가 일치하지 않습니다.')).toEqual([{ label: '1', text: '생계비가 일치하지 않습니다.' }]);
  });

  it('동그라미 번호', () => {
    const items = splitCorrectionText('1. 소득 자료\n① 원천징수영수증\n② 급여명세서');
    expect(items.map(i => i.label)).toEqual(['1-1', '1-2']);
  });
});

describe('suggestFromLibrary / detectPhotoCount', () => {
  it('키워드가 맞는 항목을 고른다', () => {
    expect(suggestFromLibrary('보험 해약환급금 증명서', LIB).libraryId).toBe('lib-insurance');
    expect(suggestFromLibrary('생계비 일치', LIB).owner).toBe('office');
  });
  it('사진 장수를 합친다', () => {
    expect(detectPhotoCount('사업장 사진 내부 4장, 외부 2장')).toBe(6);
    expect(detectPhotoCount('보험 2장')).toBeUndefined();
  });
});

describe('buildCorrectionBrief', () => {
  const order = { id: 'o', round: 1, kind: 'recommendation', servedOn: '2026-10-02', brief: {} } as unknown as CorrectionOrder;
  const base = { orderId: 'o', owner: 'client', neededDocs: [], questions: [], clientAnswers: {}, fileIds: [], tableRows: [], exhibitNumbers: [] };
  it('별지·소명자료 번호를 끼워 넣고 빈 문안을 경고한다', () => {
    const items = [
      { ...base, id: 'a', seq: 1, label: '1', status: 'confirmed', tableType: 'T3', answerText: '내역은 별지 ○ 기재와 같으며 소갑 제○호증을 제출합니다.',
        tableRows: [{ company: 'TEST생명', refund: '1200000' }, {}], exhibitNumbers: [3] },
      { ...base, id: 'b', seq: 2, label: '2', status: 'cannot_submit', cannotReason: 'delayed', expectedOn: '2026-10-20' },
    ] as unknown as CorrectionItem[];
    const m = buildCorrectionBrief(order, items, [{ id: 'e', number: 3, title: '해약환급금 증명서' }], {});
    expect(m.sections[0].answer).toBe('내역은 별지 1 기재와 같으며 소갑 제3호증을 제출합니다.');
    expect(m.annexes[0].rows).toHaveLength(1);
    expect(m.annexes[0].rows[0]).toContain('1,200,000');
    expect(m.sections[1].missingReason).toContain('발급이 늦어져요');
    expect(m.warnings.some(w => w.includes('2번 항목 답변 문안'))).toBe(true);
    expect(m.attachments).toEqual(['소갑 제3호증 해약환급금 증명서']);
  });
});

import { ocrItemsToDrafts } from './correctionText';

describe('ocrItemsToDrafts', () => {
  it('본문 키워드가 먼저, 없으면 읽기 분류로 라이브러리 연결, 빈 항목은 버림', () => {
    const lib: any[] = [
      { id: 'lib-insurance', category: '보험', title: '보험', clientTitle: '보험 자료', neededDocs: ['해약환급금 증명서'], questions: [], owner: 'client', keywords: ['해약환급금'] },
      { id: 'lib-loan-use', category: '채무 증대 경위', title: '대출금', clientTitle: '대출금 사용처', neededDocs: [], questions: [], owner: 'client', keywords: ['사용처 소명'] },
    ];
    const d = ocrItemsToDrafts([
      { itemNumber: '가', instruction: '보험 해약환급금 자료를 제출할 것', category: 'OTHER' },
      { itemNumber: 2, instruction: '최근 대출의 용도를 밝힐 것', category: 'LOAN' },
      { itemNumber: 3, instruction: '  ', category: 'DOCUMENT' },
      { itemNumber: null, instruction: '회생위원과 면담할 것', category: 'OTHER', requiredEvidence: '면담 일정' },
    ], lib, 2);
    expect(d.map(x => [x.seq, x.label, x.libraryId, x.owner])).toEqual([
      [3, '가', 'lib-insurance', 'client'], [4, '2', 'lib-loan-use', 'client'], [5, '5', undefined, 'office'],
    ]);
    expect(d[2].neededDocs).toEqual(['면담 일정']);
  });
});
