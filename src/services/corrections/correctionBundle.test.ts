import { describe, expect, it, vi } from 'vitest';

vi.mock('../files/caseFileService', () => ({ getCaseFileUrl: vi.fn() }));
vi.mock('./correctionService', () => ({ loadCaseFilesByIds: vi.fn() }));

import { planCorrectionBundle } from './correctionBundle';

const order: any = { round: 2, briefFileId: 'b1', revisedDocs: [{ kind: 'plan', label: '변제계획안', fileId: 'p1' }, { kind: 'creditors', label: '채권자목록', unchanged: true }] };
const item = (id: string, seq: number, extra: any = {}): any => ({ id, seq, label: String(seq), owner: 'client', status: 'confirmed', fileIds: [], ...extra });

describe('planCorrectionBundle', () => {
  it('보정서 → 수정본 → 항목 순 소명자료, 같은 파일은 한 번', () => {
    const items = [item('i2', 2, { fileIds: ['f3'] }), item('i1', 1, { fileIds: ['f1', 'f2'] })];
    const exhibits: any[] = [{ id: 'e1', number: 1, title: '보험 자료', itemId: 'i1', fileId: 'f1' }];
    const { entries, warnings } = planCorrectionBundle(order, items, exhibits, { b1: '요약보정서.pdf', p1: 'plan.pdf', f1: '보험.pdf', f2: '해약.jpg', f3: '통장.pdf' });
    expect(entries.map(e => e.zipName)).toEqual([
      '보정2_00_보정서.pdf', '보정2_01_수정_변제계획안.pdf', '보정2_1_소갑1_보험_자료.pdf', '보정2_1_소갑1_해약.jpg', '보정2_2_통장.pdf',
    ]);
    expect(warnings).toEqual([]);
  });

  it('보정서가 없거나 확인 전 항목은 경고', () => {
    const { warnings } = planCorrectionBundle({ ...order, briefFileId: undefined }, [item('i1', 1, { status: 'submitted' })], [], {});
    expect(warnings.length).toBe(2);
  });
});
