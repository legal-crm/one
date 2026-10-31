import { describe, expect, it } from 'vitest';
import { smallLeaseRegionFor } from './smallLeaseRegion';
import { COURT_REGION_MAP_DATA } from '../../constants';

describe('소액임차 지역 (주임법 시행령 제10조, LS-9)', () => {
  it('서울·과밀억제권역·특례 4곳', () => {
    expect(smallLeaseRegionFor('서울특별시 강남구').region).toBe('Seoul');
    expect(smallLeaseRegionFor('경기도 수원시 영통구').region).toBe('Overcrowded');
    expect(smallLeaseRegionFor('경기도 화성시 동탄').region).toBe('Overcrowded');
    expect(smallLeaseRegionFor('세종특별자치시 한누리대로').region).toBe('Overcrowded');
    expect(smallLeaseRegionFor('경기도 용인시 수지구').region).toBe('Overcrowded');
    expect(smallLeaseRegionFor('경기도 김포시').region).toBe('Overcrowded');
  });
  it('광역시·안산·광주·파주·이천·평택, 광역시 군 지역 제외', () => {
    expect(smallLeaseRegionFor('부산광역시 해운대구').region).toBe('Metro');
    expect(smallLeaseRegionFor('부산광역시 기장군').region).toBe('Others');
    expect(smallLeaseRegionFor('대구광역시 달성군').region).toBe('Others');
    expect(smallLeaseRegionFor('경기도 광주시 오포읍').region).toBe('Metro');
    expect(smallLeaseRegionFor('광주광역시 북구').region).toBe('Metro');
    expect(smallLeaseRegionFor('경기도 평택시').region).toBe('Metro');
  });
  it('일부 동만 과밀억제권역인 곳', () => {
    expect(smallLeaseRegionFor('경기도 남양주시 진접읍').region).toBe('Others');
    expect(smallLeaseRegionFor('경기도 남양주시 호평동').region).toBe('Overcrowded');
    expect(smallLeaseRegionFor('경기도 남양주시').needsCheck).toBe(true);
    expect(smallLeaseRegionFor('인천광역시 강화군').region).toBe('Others');
  });
  it('기본 지역 표에 없어진 행정구역이 없다', () => {
    const names = COURT_REGION_MAP_DATA.map(i => i.keyword);
    for (const old of ['청원군', '연기군', '당진군', '여주군', '동탄시']) expect(names).not.toContain(old);
    expect(COURT_REGION_MAP_DATA.find(i => i.keyword === '화성시')?.smallLeaseRegion).toBe('Overcrowded');
  });
});
