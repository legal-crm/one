import { describe, expect, it } from 'vitest';
import { diffContent, snapshotOf, stableStringify } from './contentDiff';

describe('stableStringify', () => {
  it('키 순서가 달라도 같은 문자열', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(stableStringify({ b: { d: [1, 2], c: 2 }, a: 1 }));
  });
  it('undefined 칸은 무시', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe('diffContent', () => {
  const base = [{ id: 'a', t: 1 }, { id: 'b', t: 2 }];
  it('바뀐 것·새 것만 upsert, 빠진 것은 delete', () => {
    const snap = snapshotOf(base);
    const d = diffContent(snap, [{ id: 'a', t: 1 }, { id: 'b', t: 3 }, { id: 'c', t: 4 }]);
    expect(d.upserts.map(x => x.id)).toEqual(['b', 'c']);
    expect(d.deletes).toEqual([]);
    const d2 = diffContent(snap, [{ id: 'b', t: 2 }]);
    expect(d2.upserts).toEqual([]);
    expect(d2.deletes).toEqual(['a']);
  });
  it('변화 없으면 빈 차이', () => {
    const d = diffContent(snapshotOf(base), [...base]);
    expect(d.upserts.length + d.deletes.length).toBe(0);
  });
});
