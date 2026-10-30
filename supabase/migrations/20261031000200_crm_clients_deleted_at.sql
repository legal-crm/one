-- S-1 후속: 사건 휴지통(deleted_at) 칸
-- 앱의 휴지통 이동·복구·30일 정리가 없는 칸(deleted_at)을 써서 늘 실패하던 문제
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS crm_clients_deleted_idx ON public.crm_clients (office_id, deleted_at) WHERE deleted_at IS NOT NULL;
