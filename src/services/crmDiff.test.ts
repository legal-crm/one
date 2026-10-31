import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));
import { diffCrmShape } from './crmService';

describe('사건 데이터 부분 저장 (CM-10)', () => {
  it('바뀐 키만 보낸다', () => {
    const d = diffCrmShape({ crmStatus: 'contracted', courtName: 'A' }, { crmStatus: 'document', courtName: 'A' });
    expect(d.set).toEqual({ crmStatus: 'document' });
    expect(d.lists).toEqual({});
    expect(d.empty).toBe(false);
  });

  it('메모 목록은 바뀐 항목과 지운 id만', () => {
    const base = { notes: [{ id: 'n1', content: 'a' }, { id: 'n2', content: 'b' }] };
    const next = { notes: [{ id: 'n2', content: 'b2' }, { id: 'n3', content: 'c' }] };
    const d = diffCrmShape(base, next);
    expect(d.lists.notes.upsert).toEqual([{ id: 'n2', content: 'b2' }, { id: 'n3', content: 'c' }]);
    expect(d.lists.notes.remove).toEqual(['n1']);
  });

  it('키 순서가 달라도 같은 값이면 보내지 않는다', () => {
    const d = diffCrmShape({ courtCase: { a: 1, b: 2 } }, { courtCase: { b: 2, a: 1 } });
    expect(d.empty).toBe(true);
  });

  it('사라진 키는 지운다', () => {
    const d = diffCrmShape({ courtName: 'A', crmStatus: 'x' }, { crmStatus: 'x' });
    expect(d.unset).toEqual(['courtName']);
  });

  it('기준 사본이 없으면 목록은 합치기로 보낸다', () => {
    const d = diffCrmShape(undefined, { notes: [{ id: 'n1' }], crmStatus: 'requested' });
    expect(d.lists.notes).toEqual({ upsert: [{ id: 'n1' }], remove: [] });
    expect(d.set).toEqual({ crmStatus: 'requested' });
  });
});
