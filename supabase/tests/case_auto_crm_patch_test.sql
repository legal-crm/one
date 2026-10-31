-- 계약 체결 → 사건 자동, 사건 관리 데이터 부분 저장, 중요 공지 종 알림 시험 (시험 DB 전용, ROLLBACK)
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test_owner_ce1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'test_owner_ce2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'test_client_ce3@example.test', 'authenticated', 'authenticated');
INSERT INTO lawyers (id, name) VALUES ('test-lawyer-ce1', 'TEST_CE1'), ('test-lawyer-ce2', 'TEST_CE2');
INSERT INTO lawyer_accounts (auth_user_id, lawyer_id, auth_email, approved) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'test-lawyer-ce1', 'ce1', true),
  ('00000000-0000-4000-8000-0000000000e2', 'test-lawyer-ce2', 'ce2', true);
INSERT INTO consult_requests (id, client_id, client_name, status, selected_lawyer_id)
VALUES ('test-req-ce', '00000000-0000-4000-8000-0000000000e3', 'TEST가명', 'requested', 'test-lawyer-ce1');

-- 1. 체결 → 사건 생성(서류 준비 단계·의뢰인 연결·타임라인), 다시 체결 표시해도 사건 하나
INSERT INTO electronic_contracts (id, client_id, consult_request_id, client_name, lawyer_name, law_firm_name, assigned_lawyer_id, status, documents, audit_trail)
VALUES ('EC-TEST-CE1', 'test-req-ce', 'test-req-ce', 'TEST', 'TEST', 'TEST', 'test-lawyer-ce1', 'pending_sign', '[]'::jsonb, '[]'::jsonb);
UPDATE electronic_contracts SET status = 'completed' WHERE id = 'EC-TEST-CE1';
DO $$ DECLARE c cases; BEGIN
  SELECT * INTO c FROM cases WHERE consult_request_id = 'test-req-ce';
  IF c.id IS NULL OR c.stage <> 'documents' OR c.office_id <> 'test-lawyer-ce1' THEN RAISE EXCEPTION 'FAIL auto case %', c; END IF;
  IF (SELECT client_user_id FROM office_clients WHERE id = c.office_client_id) IS DISTINCT FROM '00000000-0000-4000-8000-0000000000e3'::uuid THEN
    RAISE EXCEPTION 'FAIL client link';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM case_events WHERE case_id = c.id AND kind = 'milestone.contract_signed' AND client_visible) THEN
    RAISE EXCEPTION 'FAIL milestone event';
  END IF;
  IF (SELECT case_id FROM electronic_contracts WHERE id = 'EC-TEST-CE1') IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'FAIL contract case_id'; END IF;
  UPDATE electronic_contracts SET status = 'pending_sign' WHERE id = 'EC-TEST-CE1';
  UPDATE electronic_contracts SET status = 'completed' WHERE id = 'EC-TEST-CE1';
  IF (SELECT count(*) FROM cases WHERE consult_request_id = 'test-req-ce') <> 1 THEN RAISE EXCEPTION 'FAIL duplicate case'; END IF;
  RAISE NOTICE 'PASS completed contract creates one case at documents stage';
END $$;

-- 2. 이미 뒤 단계인 사건은 그대로
DO $$ BEGIN
  UPDATE cases SET stage = 'filed' WHERE consult_request_id = 'test-req-ce';
  PERFORM ensure_case_for_contract('EC-TEST-CE1');
  IF (SELECT stage FROM cases WHERE consult_request_id = 'test-req-ce') <> 'filed' THEN RAISE EXCEPTION 'FAIL stage went back'; END IF;
  RAISE NOTICE 'PASS later stage kept';
END $$;

-- 3. 부분 저장: 서로 다른 키·메모 추가가 덮어쓰이지 않음
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r crm_clients; BEGIN
  r := crm_client_patch('test-req-ce', 'test-lawyer-ce1', '{"crmStatus":"contracted","courtName":"A"}'::jsonb,
        '{"notes":{"upsert":[{"id":"n1","content":"첫 메모"}],"remove":[]}}'::jsonb, ARRAY[]::text[]);
  IF r.crm_status <> 'contracted' OR r.extension_data ->> 'courtName' <> 'A' OR jsonb_array_length(r.notes) <> 1 THEN RAISE EXCEPTION 'FAIL first patch %', r; END IF;
  -- 다른 사람이 메모를 더하고 다른 칸을 바꿈 (이전 행 전체 저장이면 첫 메모·courtName이 사라졌다)
  r := crm_client_patch('test-req-ce', 'test-lawyer-ce1', '{"assigneeId":"x"}'::jsonb,
        '{"notes":{"upsert":[{"id":"n2","content":"둘째 메모"}],"remove":[]}}'::jsonb, ARRAY[]::text[]);
  IF jsonb_array_length(r.notes) <> 2 OR r.extension_data ->> 'courtName' <> 'A' OR r.crm_status <> 'contracted' THEN RAISE EXCEPTION 'FAIL merge %', r; END IF;
  -- 지운 메모는 되살아나지 않음, 같은 id는 바꿈
  r := crm_client_patch('test-req-ce', 'test-lawyer-ce1', '{}'::jsonb,
        '{"notes":{"upsert":[{"id":"n2","content":"고친 메모"}],"remove":["n1"]}}'::jsonb, ARRAY['courtName']);
  IF jsonb_array_length(r.notes) <> 1 OR r.notes -> 0 ->> 'content' <> '고친 메모' OR r.extension_data ? 'courtName' THEN RAISE EXCEPTION 'FAIL remove %', r; END IF;
  IF r.version < 3 THEN RAISE EXCEPTION 'FAIL version'; END IF;
  RAISE NOTICE 'PASS partial patch keeps other changes';
END $$;
RESET ROLE;

-- 4. 다른 사무소는 부분 저장 불가
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM crm_client_patch('test-req-ce', 'test-lawyer-ce2', '{"crmStatus":"cancelled"}'::jsonb, '{}'::jsonb, ARRAY[]::text[]);
    RAISE EXCEPTION 'FAIL other office patched';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS other office blocked';
END $$;
RESET ROLE;

-- 5. 중요 공지 → 사무소 구성원 종 알림 (한 번만)
INSERT INTO notices (id, data, status) VALUES ('test-notice-1', '{"title":"점검","isImportant":true}'::jsonb, 'published');
UPDATE notices SET data = data || '{"content":"x"}'::jsonb WHERE id = 'test-notice-1';
DO $$ BEGIN
  IF (SELECT count(*) FROM user_notifications WHERE recipient_user_id = '00000000-0000-4000-8000-0000000000e1' AND link_id = 'test-notice-1') <> 1 THEN
    RAISE EXCEPTION 'FAIL notice bell';
  END IF;
  IF (SELECT max(count) FROM user_notifications WHERE link_id = 'test-notice-1') <> 1 THEN RAISE EXCEPTION 'FAIL notice repeated'; END IF;
  RAISE NOTICE 'PASS important notice rings office bell once';
END $$;
ROLLBACK;
