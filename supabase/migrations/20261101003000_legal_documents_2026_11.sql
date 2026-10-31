-- ============================================================================
-- 약관·처리방침 2026-11-01 개정 (광고·정보 제공 플랫폼으로 재구성, 위탁·국외 이전·민감정보 보강)
--  * 서비스 이용약관·개인정보 처리방침 새 버전: 로그인한 회원에게 다시 동의를 받는다
--  * 변호사회원 이용약관(신규): 변호사 로그인 때 동의 기록 (개인정보 처리 위탁 조항 포함)
--  * 이전 버전 본문은 /legal-archive/ 로 옮겨 계속 볼 수 있게 한다
-- ============================================================================
UPDATE public.legal_documents SET url = '/legal-archive/tos-2026-06-29.html' WHERE kind = 'terms' AND version = 'tos-2026-09-30';
UPDATE public.legal_documents SET url = '/legal-archive/privacy-2026-09-22.html' WHERE kind = 'privacy' AND version = 'privacy-2026-09-30';
UPDATE public.legal_documents SET url = '/privacy.html#third-party' WHERE kind = 'third_party' AND version = 'third-party-2026-09-30';

INSERT INTO public.legal_documents (kind, version, title, url, effective_on, summary, requires_reconsent) VALUES
  ('terms', 'tos-2026-11-01', '서비스 이용약관', '/tos.html', '2026-11-01',
   '마이김변의 성격을 "변호사 광고·정보 제공 플랫폼(중개·알선 안 함)"으로 고쳐 적었어요. 상담 요청 규칙(진행 중 3명, 응답 기한 2영업일), 계산기·정리 화면의 한계, 회사의 책임 범위를 정리했어요.', true),
  ('privacy', 'privacy-2026-11-01', '개인정보 처리방침', '/privacy.html', '2026-11-01',
   '실제로 쓰는 위탁 업체 전체, 국외 이전(Supabase·Vercel·Google·Cloudflare), 변호사 사무소의 위탁으로 처리하는 사건 정보, 통화 녹음, 민감정보(선택) 별도 동의, 항목별 보유 기간과 자동 파기, 방문 분석을 적었어요.', true),
  ('lawyer_terms', 'lawyer-terms-2026-11-01', '변호사회원 이용약관', '/lawyer-terms.html', '2026-11-01',
   '가입 심사, 광고 상품과 환불, 업무 도구, 사건 데이터의 개인정보 처리 위탁(사무소 = 처리자, 마이김변 = 수탁자), 업무폰, 직원 계정을 정했어요.', false)
ON CONFLICT (kind, version) DO NOTHING;
