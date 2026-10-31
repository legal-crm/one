import { describe, expect, it } from 'vitest';
import { SUBMISSION_GROUPS, defaultBankruptcySubmissionList, unobtainableText, upgradeSubmissionList } from './bankruptcySubmissionList';

describe('개인파산 자료제출목록 10분류', () => {
  it('10개 분류를 모두 쓰고 번호가 이어진다', () => {
    const list = defaultBankruptcySubmissionList();
    expect(new Set(list.map(d => d.groupNo))).toEqual(new Set(SUBMISSION_GROUPS.map(g => g.no)));
    expect(list.map(d => d.itemNumber)).toEqual(list.map((_, i) => i + 1));
    expect(list.every(d => d.status === 'PREPARING')).toBe(true);
  });

  it('예전 목록의 제출 상태를 이어 받는다', () => {
    const old = [{ id: 'bd-1', itemNumber: 1, category: '인적서류', title: '가족관계증명서 (상세)', detailDescription: '', isMandatory: true, status: 'SUBMITTED' as const }];
    const up = upgradeSubmissionList(old);
    expect(up.find(d => d.title.startsWith('가족관계'))?.status).toBe('SUBMITTED');
    expect(up.every(d => typeof d.groupNo === 'number')).toBe(true);
  });

  it('미제출 사유 = 종류 + 직접 쓴 이유', () => {
    expect(unobtainableText({ unobtainableKind: 'not_applicable', unobtainableReason: '' })).toBe('해당사항 없음');
    expect(unobtainableText({ unobtainableKind: 'refused', unobtainableReason: '전 배우자가 발급 협조 거부' })).toBe('협조 거부: 전 배우자가 발급 협조 거부');
  });
});
