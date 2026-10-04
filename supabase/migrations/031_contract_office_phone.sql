-- ============================================================
-- 031: 원격 서명 화면 '사무소 전화' 버튼 — 사무소 대표번호 컬럼
-- ------------------------------------------------------------
-- 의뢰인이 원격 서명 링크를 열었을 때 사무소 전화 버튼을 표시하려면
-- 계약에 사무소 대표번호가 저장되어 있어야 한다.
-- (앱은 컬럼이 없을 때 확장 컬럼을 제외하고 재시도하므로 적용 순서에 제약 없음)
-- ============================================================

-- 1. 컬럼 추가
ALTER TABLE electronic_contracts ADD COLUMN IF NOT EXISTS law_firm_phone TEXT;

-- 2. 기존 계약에 변호사 프로필의 사무소 대표번호 일괄 채우기
--    lawyers.data JSONB 안에 officePhone 키로 저장되어 있다.
UPDATE electronic_contracts ec
SET    law_firm_phone = (l.data ->> 'officePhone')
FROM   lawyers l
WHERE  ec.assigned_lawyer_id = l.id
  AND  ec.law_firm_phone IS NULL
  AND  l.data ->> 'officePhone' IS NOT NULL
  AND  length(trim(l.data ->> 'officePhone')) > 0;
