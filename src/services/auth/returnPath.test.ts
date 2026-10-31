import { describe, expect, it } from 'vitest';
import { sanitizeReturnPath } from './returnPath';

describe('로그인 뒤 돌아갈 주소 (MY-2)', () => {
  it('같은 사이트 주소만 남긴다', () => {
    expect(sanitizeReturnPath('/my/case')).toBe('/my/case');
    expect(sanitizeReturnPath('/?tab=mypage')).toBe('/?tab=mypage');
    expect(sanitizeReturnPath('//evil.example/x')).toBeNull();
    expect(sanitizeReturnPath('https://evil.example')).toBeNull();
    expect(sanitizeReturnPath('/')).toBeNull();
  });
  it('토큰·로그인 응답 칸과 변호사·관리자 화면은 빼거나 버린다', () => {
    expect(sanitizeReturnPath('/?tab=mypage&caseLink=abc&code=1')).toBe('/?tab=mypage');
    expect(sanitizeReturnPath('/?role=lawyer')).toBeNull();
  });
});
