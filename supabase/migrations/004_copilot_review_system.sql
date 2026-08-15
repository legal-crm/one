-- ============================================================
-- 사건검토 코파일럿 DB 마이그레이션
-- 13개 테이블 생성 + RLS + 인덱스
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. 글로벌 규칙 템플릿 (플랫폼 관리자 전용)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS global_rule_templates (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT DEFAULT '',
  rules          JSONB NOT NULL DEFAULT '[]'::jsonb,
  version        INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE global_rule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_templates_select_all"
  ON global_rule_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "global_templates_manage_admin"
  ON global_rule_templates FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 2. 사무실별 검토 기준 세트
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_rule_sets (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '',
  version               INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED')),
  effective_from        DATE,
  review_due_at         DATE,
  created_by            TEXT NOT NULL,
  approved_by_lawyer_id TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_rule_sets_tenant ON review_rule_sets (tenant_id);
CREATE INDEX idx_review_rule_sets_status ON review_rule_sets (tenant_id, status);

ALTER TABLE review_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rule_sets_tenant_isolation"
  ON review_rule_sets FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 3. 개별 검토 규칙
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_rules (
  id                    BIGSERIAL PRIMARY KEY,
  rule_set_id           BIGINT NOT NULL REFERENCES review_rule_sets(id) ON DELETE CASCADE,
  category              TEXT NOT NULL DEFAULT 'GENERAL',
  title                 TEXT NOT NULL,
  description           TEXT DEFAULT '',
  conditions            JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_type           TEXT NOT NULL DEFAULT 'REVIEW_FLAG'
                        CHECK (output_type IN ('REVIEW_FLAG', 'ADDITIONAL_QUESTION', 'REQUIRED_DOCUMENT', 'CAUTION', 'HIGH_RISK')),
  output_message        TEXT NOT NULL DEFAULT '',
  source_type           TEXT NOT NULL DEFAULT 'FIRM_EXPERIENCE'
                        CHECK (source_type IN ('OFFICIAL', 'PUBLISHED', 'FIRM_EXPERIENCE', 'UNVERIFIED')),
  source_reference      TEXT DEFAULT '',
  effective_from        DATE,
  review_due_at         DATE,
  approved_by_lawyer_id TEXT,
  approved_at           TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
  expiry_status         TEXT NOT NULL DEFAULT 'CURRENT'
                        CHECK (expiry_status IN ('CURRENT', 'REVIEW_DUE', 'EXPIRED', 'SUPERSEDED')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_rules_rule_set ON review_rules (rule_set_id);

-- ──────────────────────────────────────────────
-- 4. 관할법원 실무 참고사항
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS court_practice_notes (
  id                             BIGSERIAL PRIMARY KEY,
  tenant_id                      TEXT NOT NULL,
  court_name                     TEXT NOT NULL,
  verified_date                  DATE,
  source_type                    TEXT NOT NULL DEFAULT 'FIRM_EXPERIENCE'
                                 CHECK (source_type IN ('OFFICIAL', 'PUBLISHED', 'FIRM_EXPERIENCE', 'UNVERIFIED')),
  source_reference               TEXT DEFAULT '',
  general_correction_requirements TEXT DEFAULT '',
  document_notes                 TEXT DEFAULT '',
  recent_changes                 TEXT DEFAULT '',
  firm_experience_memo           TEXT DEFAULT '',
  conditions                     JSONB DEFAULT '[]'::jsonb,
  approved_by_lawyer_id          TEXT,
  approved_at                    TIMESTAMPTZ,
  review_due_at                  DATE,
  expiry_status                  TEXT NOT NULL DEFAULT 'CURRENT'
                                 CHECK (expiry_status IN ('CURRENT', 'REVIEW_DUE', 'EXPIRED', 'SUPERSEDED')),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_court_practice_notes_tenant ON court_practice_notes (tenant_id);
CREATE INDEX idx_court_practice_notes_court  ON court_practice_notes (tenant_id, court_name);

ALTER TABLE court_practice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "court_notes_tenant_isolation"
  ON court_practice_notes FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 5. 사건 검토 (메인 엔티티)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_reviews (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  consult_request_id    TEXT,
  client_id             TEXT,
  status                TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN (
                          'DRAFT', 'STAFF_REVIEWED', 'LAWYER_REVIEW_REQUIRED',
                          'MORE_INFO_REQUIRED', 'LAWYER_APPROVED', 'LAWYER_REJECTED',
                          'APPROVAL_EXPIRED', 'SENT_TO_CLIENT', 'WITHDRAWN'
                        )),
  review_grade          TEXT NOT NULL DEFAULT 'NORMAL_REVIEW'
                        CHECK (review_grade IN ('NORMAL_REVIEW', 'ENHANCED_REVIEW', 'SECOND_REVIEW')),
  created_by            TEXT NOT NULL,
  assigned_lawyer_id    TEXT,
  fact_snapshot_version  INTEGER DEFAULT 0,
  rule_set_version      INTEGER,
  rule_set_id           BIGINT REFERENCES review_rule_sets(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_reviews_tenant    ON case_reviews (tenant_id);
CREATE INDEX idx_case_reviews_status    ON case_reviews (tenant_id, status);
CREATE INDEX idx_case_reviews_consult   ON case_reviews (consult_request_id);
CREATE INDEX idx_case_reviews_lawyer    ON case_reviews (assigned_lawyer_id);

ALTER TABLE case_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_reviews_tenant_isolation"
  ON case_reviews FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 6. 사실 스냅샷
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_review_fact_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  case_review_id   BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL DEFAULT 1,
  snapshot_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
  compute_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fact_snapshots_review ON case_review_fact_snapshots (case_review_id);

ALTER TABLE case_review_fact_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fact_snapshots_via_review"
  ON case_review_fact_snapshots FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 7. 검토 플래그
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_review_flags (
  id                   BIGSERIAL PRIMARY KEY,
  case_review_id       BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  rule_id              BIGINT REFERENCES review_rules(id),
  flag_type            TEXT NOT NULL DEFAULT 'INFO'
                       CHECK (flag_type IN ('INFO', 'CAUTION', 'ADDITIONAL_CHECK', 'HIGH_RISK')),
  message              TEXT NOT NULL DEFAULT '',
  used_input_values    JSONB DEFAULT '{}'::jsonb,
  applied_rule_name    TEXT,
  applied_rule_version INTEGER,
  source_type          TEXT CHECK (source_type IN ('OFFICIAL', 'PUBLISHED', 'FIRM_EXPERIENCE', 'UNVERIFIED')),
  source_reference     TEXT,
  judgment_status      TEXT NOT NULL DEFAULT 'REQUIRES_LAWYER_REVIEW',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_flags_review ON case_review_flags (case_review_id);
CREATE INDEX idx_review_flags_type   ON case_review_flags (case_review_id, flag_type);

ALTER TABLE case_review_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_flags_via_review"
  ON case_review_flags FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 8. 사무직원 검토
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_reviews (
  id                  BIGSERIAL PRIMARY KEY,
  case_review_id      BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  staff_id            TEXT NOT NULL,
  staff_name          TEXT,
  missing_info_checked BOOLEAN NOT NULL DEFAULT FALSE,
  fact_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT DEFAULT '',
  additional_notes    TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_reviews_review ON staff_reviews (case_review_id);

ALTER TABLE staff_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_reviews_via_review"
  ON staff_reviews FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 9. 변호사 검토 의견
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_opinions (
  id                       BIGSERIAL PRIMARY KEY,
  case_review_id           BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  lawyer_id                TEXT NOT NULL,
  lawyer_name              TEXT,
  procedure_opinion        TEXT,
  legal_issues             TEXT,
  consultation_conclusion  TEXT,
  client_guidance          TEXT,
  next_steps               JSONB DEFAULT '[]'::jsonb,
  additional_notes         TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lawyer_opinions_review ON lawyer_opinions (case_review_id);

ALTER TABLE lawyer_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lawyer_opinions_via_review"
  ON lawyer_opinions FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 10. 변호사 승인
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_approvals (
  id                    BIGSERIAL PRIMARY KEY,
  case_review_id        BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  lawyer_id             TEXT NOT NULL,
  lawyer_name           TEXT,
  approved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_hash         TEXT NOT NULL,
  fact_snapshot_version INTEGER NOT NULL,
  rule_set_version      INTEGER NOT NULL,
  checklist             JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_valid              BOOLEAN NOT NULL DEFAULT TRUE,
  invalidated_at        TIMESTAMPTZ,
  invalidation_reason   TEXT
);

CREATE INDEX idx_lawyer_approvals_review ON lawyer_approvals (case_review_id);
CREATE INDEX idx_lawyer_approvals_valid  ON lawyer_approvals (case_review_id, is_valid);

ALTER TABLE lawyer_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lawyer_approvals_via_review"
  ON lawyer_approvals FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 11. 승인된 고객 메시지
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages_approved (
  id               BIGSERIAL PRIMARY KEY,
  case_review_id   BIGINT NOT NULL REFERENCES case_reviews(id) ON DELETE CASCADE,
  approval_id      BIGINT NOT NULL REFERENCES lawyer_approvals(id),
  lawyer_id        TEXT NOT NULL,
  lawyer_name      TEXT NOT NULL,
  message_content  JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at          TIMESTAMPTZ,
  withdrawn_at     TIMESTAMPTZ,
  withdraw_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_messages_review ON client_messages_approved (case_review_id);

ALTER TABLE client_messages_approved ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_messages_via_review"
  ON client_messages_approved FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 12. 코파일럿 감사 로그 (append-only)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copilot_audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_audit_tenant   ON copilot_audit_logs (tenant_id);
CREATE INDEX idx_copilot_audit_action   ON copilot_audit_logs (tenant_id, action);
CREATE INDEX idx_copilot_audit_actor    ON copilot_audit_logs (actor_id);
CREATE INDEX idx_copilot_audit_target   ON copilot_audit_logs (target_type, target_id);

ALTER TABLE copilot_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_insert_any"
  ON copilot_audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "audit_logs_select_authenticated"
  ON copilot_audit_logs FOR SELECT
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 13. 규칙 템플릿 업데이트 제안
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_template_updates (
  id            BIGSERIAL PRIMARY KEY,
  template_id   BIGINT NOT NULL REFERENCES global_rule_templates(id),
  tenant_id     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  changelog     TEXT,
  proposed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_by  TEXT,
  responded_at  TIMESTAMPTZ
);

CREATE INDEX idx_template_updates_tenant ON rule_template_updates (tenant_id);
CREATE INDEX idx_template_updates_status ON rule_template_updates (tenant_id, status);

ALTER TABLE rule_template_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_updates_tenant_isolation"
  ON rule_template_updates FOR ALL
  TO authenticated USING (true);

-- ──────────────────────────────────────────────
-- 상담 스타일 프로필 (테넌트별)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consult_style_profiles (
  id                     BIGSERIAL PRIMARY KEY,
  tenant_id              TEXT NOT NULL UNIQUE,
  explanation_length     TEXT NOT NULL DEFAULT 'normal'
                         CHECK (explanation_length IN ('brief', 'normal', 'detailed')),
  terminology_level      TEXT NOT NULL DEFAULT 'easy'
                         CHECK (terminology_level IN ('easy', 'moderate', 'professional')),
  required_cautions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_consult_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  prohibited_expressions JSONB NOT NULL DEFAULT '[]'::jsonb,
  official_link_style    TEXT NOT NULL DEFAULT 'inline'
                         CHECK (official_link_style IN ('inline', 'footnote', 'appendix')),
  updated_by             TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consult_style_tenant ON consult_style_profiles (tenant_id);

ALTER TABLE consult_style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consult_style_tenant_isolation"
  ON consult_style_profiles FOR ALL
  TO authenticated USING (true);
