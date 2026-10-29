-- 006_security_hardening.sql
-- 보안 강화 마이그레이션 (점진적 전환 - Option C)
-- 위험한 anon 권한(전체 허용 등)을 제거하고, authenticated 사용자에게만 접근을 허용합니다.
-- 일부 공개 데이터에 대해서만 anon SELECT 또는 INSERT를 허용합니다.

-- ==========================================
-- Phase 1: Critical Tables
-- ==========================================

-- 1. electronic_contracts
DROP POLICY IF EXISTS "allow_anon_all_electronic_contracts" ON electronic_contracts;
CREATE POLICY "authenticated_all_electronic_contracts" ON electronic_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. calendar_events
DROP POLICY IF EXISTS "allow_anon_all_calendar_events" ON calendar_events;
CREATE POLICY "authenticated_all_calendar_events" ON calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. cases
DROP POLICY IF EXISTS "allow_anon_all_cases" ON cases;
CREATE POLICY "authenticated_all_cases" ON cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. lawyers
DROP POLICY IF EXISTS "allow_anon_all_lawyers" ON lawyers;
-- 공개 프로필 매칭을 위해 anon은 SELECT 허용
CREATE POLICY "anon_select_lawyers" ON lawyers FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_lawyers" ON lawyers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. members
DROP POLICY IF EXISTS "allow_anon_all_members" ON members;
CREATE POLICY "authenticated_all_members" ON members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. activity_logs
DROP POLICY IF EXISTS "allow_anon_all_activity_logs" ON activity_logs;
-- 수정/삭제 불가 (SELECT + INSERT만 허용)
CREATE POLICY "authenticated_select_activity_logs" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_activity_logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 7. staff_activities
DROP POLICY IF EXISTS "allow_anon_all_staff_activities" ON staff_activities;
CREATE POLICY "authenticated_select_staff_activities" ON staff_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_staff_activities" ON staff_activities FOR INSERT TO authenticated WITH CHECK (true);

-- 8. custom_roles
DROP POLICY IF EXISTS "allow_anon_all_custom_roles" ON custom_roles;
CREATE POLICY "authenticated_all_custom_roles" ON custom_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. copilot_cases
DROP POLICY IF EXISTS "allow_anon_all_copilot_cases" ON copilot_cases;
CREATE POLICY "authenticated_all_copilot_cases" ON copilot_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. copilot_rulesets
DROP POLICY IF EXISTS "allow_anon_all_copilot_rulesets" ON copilot_rulesets;
CREATE POLICY "authenticated_all_copilot_rulesets" ON copilot_rulesets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. alimtok_logs
DROP POLICY IF EXISTS "allow_anon_all_alimtok_logs" ON alimtok_logs;
CREATE POLICY "authenticated_select_alimtok_logs" ON alimtok_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_alimtok_logs" ON alimtok_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 12. fee_notification_settings
DROP POLICY IF EXISTS "allow_anon_all_fee_notification_settings" ON fee_notification_settings;
CREATE POLICY "authenticated_all_fee_notification_settings" ON fee_notification_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- Phase 2: CMS Tables
-- ==========================================

-- 1. news_articles
DROP POLICY IF EXISTS "allow_anon_all_news_articles" ON news_articles;
CREATE POLICY "anon_select_news_articles" ON news_articles FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_news_articles" ON news_articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. client_qas
DROP POLICY IF EXISTS "allow_anon_all_client_qas" ON client_qas;
CREATE POLICY "anon_select_client_qas" ON client_qas FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_client_qas" ON client_qas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. success_reviews
DROP POLICY IF EXISTS "allow_anon_all_success_reviews" ON success_reviews;
CREATE POLICY "anon_select_success_reviews" ON success_reviews FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_success_reviews" ON success_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. main_banners
DROP POLICY IF EXISTS "allow_anon_all_main_banners" ON main_banners;
CREATE POLICY "anon_select_main_banners" ON main_banners FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_main_banners" ON main_banners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. notices
DROP POLICY IF EXISTS "allow_anon_all_notices" ON notices;
CREATE POLICY "anon_select_notices" ON notices FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_notices" ON notices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. client_inquiries
DROP POLICY IF EXISTS "allow_anon_all_client_inquiries" ON client_inquiries;
CREATE POLICY "anon_select_client_inquiries" ON client_inquiries FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_client_inquiries" ON client_inquiries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_client_inquiries" ON client_inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. lawyer_inquiries
DROP POLICY IF EXISTS "allow_anon_all_lawyer_inquiries" ON lawyer_inquiries;
CREATE POLICY "anon_select_lawyer_inquiries" ON lawyer_inquiries FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_lawyer_inquiries" ON lawyer_inquiries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_lawyer_inquiries" ON lawyer_inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. platform_config
DROP POLICY IF EXISTS "allow_anon_all_platform_config" ON platform_config;
CREATE POLICY "anon_select_platform_config" ON platform_config FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_platform_config" ON platform_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. popup_config
DROP POLICY IF EXISTS "allow_anon_all_popup_config" ON popup_config;
CREATE POLICY "anon_select_popup_config" ON popup_config FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_popup_config" ON popup_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. matching_config
DROP POLICY IF EXISTS "allow_anon_all_matching_config" ON matching_config;
CREATE POLICY "anon_select_matching_config" ON matching_config FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_matching_config" ON matching_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. rehab_policy_settings
DROP POLICY IF EXISTS "allow_anon_all_rehab_policy_settings" ON rehab_policy_settings;
CREATE POLICY "anon_select_rehab_policy_settings" ON rehab_policy_settings FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_rehab_policy_settings" ON rehab_policy_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. client_memos
DROP POLICY IF EXISTS "allow_anon_all_client_memos" ON client_memos;
CREATE POLICY "authenticated_all_client_memos" ON client_memos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. notification_channel_settings
DROP POLICY IF EXISTS "allow_anon_all_notification_channel_settings" ON notification_channel_settings;
CREATE POLICY "authenticated_all_notification_channel_settings" ON notification_channel_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- 001_security_phase2.sql Updates
-- ==========================================

-- diagnosis_config: anon이 설정을 수정할 수 없도록 정책 제거
DROP POLICY IF EXISTS "anon_modify_config" ON diagnosis_config;
-- active 상태의 설정은 이미 001 스크립트의 public_read_config 정책에서 SELECT 가능하므로 유지됩니다.

-- audit_logs: 모든 역할을 INSERT 전용으로 변경 (UPDATE/DELETE 방지)
DROP POLICY IF EXISTS "anyone_insert_audit" ON audit_logs;
DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_logs;
-- 명시적으로 UPDATE/DELETE 불가함을 코멘트로 기록
CREATE POLICY "all_insert_audit_logs" ON audit_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "authenticated_select_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);


-- ==========================================
-- 002_auth_invite_tokens.sql Updates
-- ==========================================

-- invite_tokens: anon 접근 완전 차단
DROP POLICY IF EXISTS "anon_read_invite_tokens" ON invite_tokens;


-- ==========================================
-- 003_consult_requests.sql Updates
-- ==========================================

-- consult_requests: 기존 anon/public 정책 모두 제거하고 인증된 사용자에게만 부여
-- ⚠️ 원본 정책명은 단수형(consult_request)임에 주의
DROP POLICY IF EXISTS "anon_insert_consult_request" ON consult_requests;
DROP POLICY IF EXISTS "public_select_consult_request" ON consult_requests;
DROP POLICY IF EXISTS "public_update_consult_request" ON consult_requests;
DROP POLICY IF EXISTS "public_delete_consult_request" ON consult_requests;
-- DELETE는 보안을 위해 제외 (INSERT, SELECT, UPDATE만 허용)
CREATE POLICY "authenticated_select_consult_requests" ON consult_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_consult_requests" ON consult_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_consult_requests" ON consult_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- consult_messages: 기존 anon/public 정책 제거 및 UPDATE/DELETE 제한
DROP POLICY IF EXISTS "anon_insert_consult_message" ON consult_messages;
DROP POLICY IF EXISTS "public_select_consult_message" ON consult_messages;
DROP POLICY IF EXISTS "public_update_consult_message" ON consult_messages;
DROP POLICY IF EXISTS "public_delete_consult_message" ON consult_messages;
CREATE POLICY "authenticated_select_consult_messages" ON consult_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_consult_messages" ON consult_messages FOR INSERT TO authenticated WITH CHECK (true);


-- ==========================================
-- 004_copilot_review_system.sql Updates
-- ==========================================

-- TODO: 추후 테넌트(tenant_id) 기반의 격리된 정책(row-level security with auth.uid)으로 강화를 진행해야 합니다. (Gradual Transition)


-- ==========================================
-- 005_internal_communication.sql Updates
-- ==========================================

-- PostgREST와 current_setting('app.tenant_id', true) 호환성 문제로 인해 임시로 정책 변경
-- TODO: 추후 테넌트 및 auth.uid() 기반으로 고도화 필요

DROP POLICY IF EXISTS "messages_tenant_isolation" ON internal_messages;
CREATE POLICY "authenticated_all_internal_messages" ON internal_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tickets_tenant_isolation" ON task_tickets;
CREATE POLICY "authenticated_all_task_tickets" ON task_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_user_isolation" ON in_app_notifications;
CREATE POLICY "authenticated_all_in_app_notifications" ON in_app_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- Additional Security Updates
-- ==========================================

-- 1. 함수 실행 권한을 SECURITY INVOKER로 변경 (보안 강화)
ALTER FUNCTION cleanup_expired_diagnosis() SECURITY INVOKER;

-- 2. diagnosis_stats 뷰에 security_invoker = true 설정 (Postgres 15+ 전용)
CREATE OR REPLACE VIEW diagnosis_stats_view WITH (security_invoker = true) AS 
SELECT * FROM diagnosis_stats;
