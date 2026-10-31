import { describe, expect, it } from 'vitest';
// 빌드 스크립트(ESM .mjs)를 시험에서 직접 읽는다
import { applyCompanyInfo } from '../../../scripts/company-info-build.mjs';
import { DEFAULT_COMPANY_INFO, companyInfoProblems, normalizeCompanyInfo } from '../../../api/_lib/company-info.js';

const FOOTER = `<footer>
            <p class="text-base font-bold text-slate-200">몬스터랩</p>
            <p>
              상호: 몬스터랩
              <span>|</span>
              대표: 진성호
              <span>|</span>
              사업자등록번호: 521-39-01355
              <span>|</span>
              개인정보 보호책임자: 진성호(대표)
            </p>
            <p>
              사업장 주소지: 경기도 남양주시 진접읍
              <span>|</span>
              고객문의: support@mykim.kr
            </p>
</footer>
<main>대표: 본문은 그대로</main>
<table><tr><td class="a">대표</td><td class="b">진성호</td></tr></table>
<script type="application/ld+json">{"founder": { "@type": "Person", "name": "진성호" }, "contactPoint": { "@type": "ContactPoint", "email": "support@mykim.kr" }}</script>`;

describe('회사 정보 한 곳 (CT-12)', () => {
  it('푸터·표·JSON-LD만 바꾸고 본문은 그대로', () => {
    const info = normalizeCompanyInfo({ ...DEFAULT_COMPANY_INFO, ceo: '홍길동', address: '서울 어딘가 1', email: 'hello@mykim.kr', privacyOfficer: '홍길동(대표)' });
    const out = applyCompanyInfo(FOOTER, info);
    expect(out).toContain('대표: 홍길동\n');
    expect(out).toContain('사업장 주소지: 서울 어딘가 1\n');
    expect(out).toContain('고객문의: hello@mykim.kr\n');
    expect(out).toContain('개인정보 보호책임자: 홍길동(대표)\n');
    expect(out).toContain('<main>대표: 본문은 그대로</main>');
    expect(out).toContain('<td class="b">홍길동</td>');
    expect(out).toContain('"name": "홍길동"');
    expect(out).toContain('"email": "hello@mykim.kr"');
    expect(applyCompanyInfo(out, info)).toBe(out);
  });
  it('금지 표기·형식 오류는 기본값으로, 저장 전 확인 문장', () => {
    const n = normalizeCompanyInfo({ legalName: '주식회사 몬스터랩', businessNumber: '1234' });
    expect(n.legalName).toBe('몬스터랩');
    expect(n.businessNumber).toBe('521-39-01355');
    const p = companyInfoProblems({ ...DEFAULT_COMPANY_INFO, ceo: '대표이사 진성호', businessNumber: '52139' });
    expect(p.some((x: string) => x.includes('대표'))).toBe(true);
    expect(p.some((x: string) => x.includes('사업자등록번호'))).toBe(true);
  });
});
