import { describe, expect, it } from 'vitest';
import { pageWindow } from './pageWindow';

describe('쪽 번호 앞뒤 5개 (OP-16)', () => {
  it('가운데·처음·끝', () => {
    expect(pageWindow(7, 40)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(40, 40)).toEqual([35, 36, 37, 38, 39, 40]);
  });
  it('이상한 값은 1쪽으로', () => {
    expect(pageWindow(0, 0)).toEqual([1]);
    expect(pageWindow(99, 2)).toEqual([1, 2]);
  });
});
