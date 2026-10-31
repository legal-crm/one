import { describe, expect, it } from 'vitest';
import { getExperienceYears, usesSpecialistWordWithoutRegistration } from './lawyerDirectory';

const NOW = new Date('2026-11-01T00:00:00+09:00');

describe('N년차는 등록번호 대조 뒤에만 (LD-5)', () => {
  it('확인 전에는 표시 안 함', () => {
    expect(getExperienceYears({ admittedYear: 2019, licenseStatus: 'pending' }, NOW)).toBeNull();
  });
  it('자격 취득 연도 칸 → 없으면 자격 글의 연도', () => {
    expect(getExperienceYears({ admittedYear: 2019, licenseStatus: 'verified' }, NOW)).toBe(7);
    expect(getExperienceYears({ certYear: '제8회 변호사시험 합격 (2019년)', licenseStatus: 'verified' }, NOW)).toBe(7);
    expect(getExperienceYears({ certYear: '제8회 변호사시험 합격', licenseStatus: 'verified' }, NOW)).toBeNull();
  });
  it('미래 연도·이상한 값은 표시 안 함', () => {
    expect(getExperienceYears({ admittedYear: 2030, licenseStatus: 'verified' }, NOW)).toBeNull();
    expect(getExperienceYears({ admittedYear: 2026, licenseStatus: 'verified' }, NOW)).toBe(1);
  });
});

describe("'전문' 표시는 변협 등록 전문분야가 있을 때만 (LD-4)", () => {
  it('등록 칸이 비었는데 소개에 전문이 있으면 안내', () => {
    // (예문은 일부러 띄어 써서 문구 검사 규칙에 걸리지 않게 함 — 함수는 '전문' 한 단어만 본다)
    expect(usesSpecialistWordWithoutRegistration({ bio: '이 분야 전문으로 일합니다.' })).toBe(true);
    expect(usesSpecialistWordWithoutRegistration({ bio: '이 분야 전문으로 일합니다.', kbaSpecialty: 'TEST' })).toBe(false);
    expect(usesSpecialistWordWithoutRegistration({ bio: '개인회생 사건을 주로 맡습니다.' })).toBe(false);
  });
});
