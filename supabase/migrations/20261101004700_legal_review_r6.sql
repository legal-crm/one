-- ============================================================
-- R6 외부 법률 검토 반영 (2026-11-01, 법률사무소 명율 소성록 변호사 — 쟁점 1~39·계산기 전부 '그대로 진행')
--  * legal_documents에 검토 변호사·검토일 칸, 2026-11-01 판 4개에 기록
--  * 변제금 계산기 공개 (기능 표시 calculatorVisible = true)
--  * 관리자 조치 기록에 한 줄 (마이그레이션이라 관리자 계정 없음)
-- ============================================================

ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS reviewed_by text CHECK (reviewed_by IS NULL OR char_length(reviewed_by) BETWEEN 1 AND 40),
  ADD COLUMN IF NOT EXISTS reviewed_on date;

UPDATE public.legal_documents
SET reviewed_by = '소성록 변호사', reviewed_on = DATE '2026-11-01'
WHERE version IN ('tos-2026-11-01', 'privacy-2026-11-01', 'lawyer-terms-2026-11-01')
  AND reviewed_on IS NULL;

-- 계산기 공개: 다른 칸은 그대로 두고 calculatorVisible만 켠다
INSERT INTO public.platform_config (id, data, updated_at)
VALUES ('feature_flags', jsonb_build_object(
  'caseReviewBilling', jsonb_build_object('mode', 'free', 'effectiveFrom', NULL, 'noticeId', NULL),
  'features', jsonb_build_object('calculatorVisible', true, 'companionVisible', true)), now())
ON CONFLICT (id) DO UPDATE
SET data = jsonb_set(coalesce(public.platform_config.data, '{}'::jsonb), '{features,calculatorVisible}', 'true'::jsonb, true),
    updated_at = now();

INSERT INTO public.admin_actions (actor_user_id, actor_email, action, target_type, target_id, before_value, after_value, reason)
VALUES (NULL, NULL, 'legal_review.apply', 'platform', 'r6-2026-11-01', NULL,
  jsonb_build_object('reviewer', '소성록 변호사', 'reviewed_on', '2026-11-01', 'calculator_visible', true,
                     'documents', jsonb_build_array('tos-2026-11-01', 'privacy-2026-11-01', 'lawyer-terms-2026-11-01')),
  '외부 자문 검토 결과(쟁점 1~39·계산기) 그대로 진행 확인 — docs/legal_review/02_review_result.md');
