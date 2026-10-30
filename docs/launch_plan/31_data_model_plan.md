# 31. 데이터 모델 통합 기획 (코딩 착수 전 기준)

- **작성일:** 2026-10-30 · **상위 문서:** `docs/launch_master_plan.md`, `docs/launch_prep_work_plan.md`
- **근거:** 운영 DB 실제 구조(`30_db_baseline_audit.md`, 기준 마이그레이션 `supabase/migrations/20261029000000_baseline.sql`), 트랙별 기획서 07·11·14~29의 테이블 설계, 29 연동 점검표의 연동 원칙 7개
- **목적:** 트랙마다 따로 적은 새 테이블을 **하나의 규칙**으로 묶어요. 사무소 키·사건 키·세 주체 RLS·쓰기 함수·파일 저장·예약 작업·마이그레이션 순서를 여기서 정하고, 각 트랙 기획서의 테이블 설계는 이 규칙에 맞춰 구현해요.
- **결정 (10-30):** DM-Q1·Q2 추천안대로(사무소 테이블 신설·사무소 ID는 대표 변호사 ID / 정기 작업은 `pg_cron`+`pg_net`). DM-Q3 사용자 확인: 실제로 쓰던 기록 없음 → 브라우저 데이터는 옮기지 않고 새로 시작(13장).

---

## 1. 지금 운영 DB (2026-10-29 확인)

| 항목 | 사실 |
|:---|:---|
| 구조 | public 테이블 47 + 뷰 1, 함수 50, RLS 정책 117, 트리거 14. 모든 테이블 RLS 켜짐 |
| 데이터 | **업무 데이터가 거의 없어요.** `consult_requests` 9건(시험)·`consult_messages` 33·`lawyers` 4·`lawyer_accounts` 2·`client_aliases` 5·`user_sessions` 21·`audit_logs` 738. `crm_clients`·`electronic_contracts`·`staff_members`·`ad_orders` 등 나머지는 0건 |
| 사무소 개념 | `tenant_id`(text) 칸이 일부 테이블(일정·할 일·메신저·알림·알림톡 기록·커스텀 역할)에만 있음. 값은 '대표 변호사 ID'·`lawyers.law_firm_id`·`staff_members.invited_by`가 섞여 있고, `current_tenant_ids()`·`tenant_role()`(020)이 이 셋을 합쳐 판정 |
| 사건 | 따로 없음. `crm_clients.client_id` = 상담 요청 ID, 서식·재산·수납이 jsonb 덩어리. 의뢰인 RLS(011)는 `auth.uid() = client_id`라 키가 맞지 않음(29 기획서) |
| 쓰지 않는 테이블 | `cases`(0건, `caseService.ts`가 있지만 import 0), `copilot_cases`·`copilot_rulesets`·`custom_roles`·`client_memos`·`notification_channel_settings`·`staff_activities`·`activity_logs`(코드 참조 0) |
| 파일 저장소 | Storage 버킷 0개. 파일은 base64로 jsonb·브라우저에 들어 있음 |
| 실시간 | `supabase_realtime` 발행에 public 테이블 0개 → 구독 코드가 이벤트를 못 받음(30 기획서 4-2) |
| 예약 작업 | `pg_cron`·`pg_net` 설치 안 됨(무료 요금제에서 설치 가능, 시험 DB로 확인). Vercel Hobby 크론은 **하루 1회만** 가능([Vercel 문서](https://vercel.com/docs/cron-jobs/usage-and-pricing)) |

**결론:** 운영 DB에 옮길 업무 데이터가 없어요. 그래서 기존 구조를 고쳐 쓰기보다 **새 규칙으로 테이블을 만들고, 쓰지 않는 테이블은 지우는** 쪽이 단순하고 안전해요. 시험 데이터 9건은 A-1(운영 시험 데이터 0) 때 지워요.

---

## 2. 공통 규칙 (모든 새 테이블)

1. **키:** 새 테이블 `id uuid primary key default gen_random_uuid()`. 기존 text ID 테이블(`consult_requests`·`lawyers` 등)은 그대로 두고, 새 테이블에서 참조할 때는 text 그대로 받아요.
2. **사무소 키:** 사무소 데이터는 모두 `office_id text not null references offices(id)`. 사건 하위 데이터는 `case_id uuid`도 함께 넣어요(조회·RLS를 빠르게, 트리거로 두 값이 맞는지 확인).
3. **공통 칸:** `created_at timestamptz default now()`, `created_by uuid`(auth 사용자), `updated_at`, `updated_by`. 지울 수 있는 데이터는 `deleted_at`(휴지통), 보관 기한이 있는 데이터는 `purge_after date`.
4. **금액:** 원 단위 정수 `bigint`. 만원 단위·문자열 금액 저장 금지(FE·AD의 단위 오류 재발 방지). 세금은 공급가·부가세·합계를 각각 저장.
5. **날짜:** 시각은 `timestamptz`, 법원 기일·납입일처럼 날짜만 있는 값은 `date`. 화면 표시는 한국 시간.
6. **상태:** `text` + `check` 제약(허용 값 목록). 상태를 바꾸는 쓰기는 서버 함수만(4장).
7. **추가만 하는 기록:** 타임라인(`case_events`)·납부(`fee_payments`)·감사 기록·기기 이벤트는 UPDATE/DELETE 정책 없음. 고칠 때는 '취소 기록'을 새로 추가해요.
8. **버전:** 설정·기준표·약관·콘텐츠 게시본은 `version int` + 게시 후 수정 불가(새 버전 작성). 동시 편집 데이터(서식 작성 jsonb)는 `version`으로 충돌을 확인해요(CM-10).
9. **개인정보 최소화:** 주민등록번호 저장 칸을 만들지 않아요(L8). 전화번호 중복 확인은 원문 대신 지문(`phone_hash`, 사무소별 솔트 HMAC)으로. 실명·연락처는 공개 동의 뒤에만 사무소 테이블에 들어가요.
10. **이름:** 테이블 복수형 snake_case, 서버 함수는 동사로 시작(`create_case`, `record_case_milestone`), 관리자 전용 함수는 `admin_` 접두어.

---

## 3. 사무소: `offices` · `office_members` (RB-1)

지금은 '대표 변호사 ID'가 사실상 사무소 ID예요. 이 값을 그대로 쓰되, 판정을 테이블 하나로 모아요(DM-Q1).

| 테이블 | 칸 |
|:---|:---|
| `offices` | `id text`(= 대표 변호사 ID, 기존 `tenant_id` 값과 같게), 사무소명·대표·사업자 정보 참조(ST 사무소 정보 하나), 상태(운영/정지), 2단계 인증 정책 |
| `office_members` | `office_id`, `user_id uuid`(auth), `lawyer_id text`(승인된 변호사면), `role`(owner·lawyer·consultant·clerk·accounting·custom), `custom_role_id`, `status`(invited·active·suspended·left), 초대·수락·정지 시각 |
| `office_custom_roles` | RB-10 커스텀 역할(기존 `custom_roles` 대체) |

- **판정 함수:** `office_role(office_id)` → 역할 또는 null. `has_office_permission(office_id, permission, case_id default null)` → 역할 권한표(`officePermissions.ts`와 같은 목록을 DB 표 `office_permission_grants`로도 둠) + '담당 사건만' 범위면 배정 확인.
- **기존 함수 정리:** `current_tenant_ids()`·`tenant_role()`·`is_tenant_member()`는 `office_members`를 읽도록 바꾼 뒤, 새 코드가 모두 옮겨 가면 지워요.
- **직원 계정:** 초대 수락은 `office_members` 행만 만들고 `lawyer_accounts`(변호사 가입)는 만들지 않아요(RB-2). 행이 없으면 권한 없음(지금의 '대표 간주' 기본값 삭제).

---

## 4. 사람·사건 뼈대 (CM-1)

```
offices ─┬─ office_members
         ├─ office_clients ──┬─ cases ──┬─ case_events (추가만)
         │   (사람)          │          ├─ 트랙별 하위 테이블 (case_id + office_id)
         │                   │          └─ case_plan_payments
         │                   └─ client_link_invites (의뢰인 계정 연결)
         └─ sales_leads → convert_sales_lead_to_case → create_case
consult_requests (플랫폼 상담 요청) ── 상담 시작·연락처 공개 → create_case
```

| 테이블 | 핵심 칸 |
|:---|:---|
| `office_clients` | `office_id`, 표시 이름(공개 전 스텔스 가명), 실명·연락처(공개 뒤), `phone_hash`, **`client_user_id uuid`**(마이김변 회원이면 연결, 의뢰인 RLS 기준), 만든 경로 |
| `cases` | `office_id`, `office_client_id`, 사건 유형(회생/파산), 세부 단계(CM-2 단계표), 담당 변호사·담당 직원, 출처(`consult_request_id` / `sales_lead_id` / 직접 / 가져오기), 사건번호·법원, 종결 사유·결정일, `purge_after`, `version`, 시험 표시(`is_test`) |
| `case_events` | `case_id`, 종류, 요약, 연결 ID, `client_visible bool`, 누가·언제 |
| `client_link_invites` | 상담 요청이 없는 사건(영업 DB·직접 등록)의 의뢰인을 회원 계정에 연결하는 1회용 초대(토큰은 해시만 저장, 만료, 사용 시각). 알림톡 링크 → 로그인 → 연결 |

- **기존 `cases` 테이블**(0건·미사용)은 지우고 이 구조로 새로 만들어요.
- **`crm_clients`**: 운영 0건이라 옮길 데이터가 없어요. 서식 작성 jsonb(진술서·재산·수지)는 당분간 `case_form_drafts(case_id, form_key, data jsonb, version)`로 옮겨 부분 저장해요. 모든 화면이 옮겨 가면 `crm_clients`를 지워요.
- **상담 요청과 사건:** `consult_requests`는 플랫폼 상담 기록으로 남고(의뢰인 ↔ 최대 3명 변호사), 사무소가 상담을 시작하면 `create_case`가 그 사무소의 `office_clients`·`cases`를 만들어요. 상담 요청 RLS는 '선택된 변호사의 사무소 구성원'으로 넓혀요(RB-1, 012 대체).

---

## 5. 세 주체 RLS 템플릿

모든 사무소 데이터 테이블은 아래 세 갈래만 써요. 관리자 정책은 만들지 않아요(제로날리지, 제26조).

```sql
-- ① 사무소 구성원: 읽기만 정책으로, 쓰기는 서버 함수
create policy office_read on public.<table> for select to authenticated
  using (public.has_office_permission(office_id, '<area>.read', case_id));

-- ② 의뢰인 본인: 사건의 공개 항목만
create policy client_read on public.<table> for select to authenticated
  using (client_visible and exists (
    select 1 from public.cases c join public.office_clients oc on oc.id = c.office_client_id
    where c.id = <table>.case_id and oc.client_user_id = auth.uid() and c.deleted_at is null));

-- ③ 쓰기: insert/update/delete 정책 없음 → security definer 함수만
--    (함수 안에서 has_office_permission 확인 + 기록 + 버전 확인)
```

- **단순 메모·초안처럼 규칙 없는 쓰기**는 ①과 같은 조건의 insert/update 정책을 허용해요(함수를 만들 이유가 없는 경우만, 테이블 설계 때 표시).
- **관리자 화면 숫자**는 `admin_` 함수가 집계만 돌려줘요(이름·전화·본문 없음, OP-1). 신고·스팸 검토 때의 원문 열람은 사유를 남기는 별도 함수.
- **익명(anon):** 공개 콘텐츠 뷰·변호사 공개 프로필 뷰·광고 노출 뷰만 읽기. 테이블 직접 권한 없음(`lawyers` 익명 `USING(true)` 정리, LD).
- **시험 방법:** 마이그레이션마다 시험 DB에서 세 계정(사무소 A 직원, 사무소 B 대표, 의뢰인)과 관리자 계정으로 읽기·쓰기를 확인(X-2 연동 시험의 RLS 항목).

---

## 6. 쓰기 함수 (규칙이 있는 값)

| 함수 | 트랙 | 하는 일 |
|:---|:---|:---|
| `create_case` | CM-1 | 상담 요청·영업 DB·직접·가져오기 → 의뢰인·사건 생성, 같은 번호 지문 확인 |
| `record_case_milestone` | CM-3 | 잠금 확인 → 세부 단계 → 타임라인 → 후속 일 |
| `convert_sales_lead_to_case` | SL-9 | 리드 이관 → `create_case` |
| `create_fee_agreement_from_contract` · `fee_recalculate` | FE | 계약서 → 약정·회차, 납부 반영 |
| `create_ad_order` | AD | 공급가·VAT·합계·구좌 예약·사업자 정보 복사 |
| 상담 요청 한도·자리 반환 | LD-1 | 의뢰인 1명당 진행 중 3명, 응답 기한 2영업일 |
| `office_work_queue` | HM-3 | 업무함 계산(저장 안 함) |
| 기준표 게시 | LS | 초안 → 게시(수정 불가) |
| 동의 기록 | CT | 약관 버전별 동의 |

모든 쓰기 함수는 `security definer`, `set search_path = public`, 첫 줄에서 권한 확인, 실패는 오류로 돌려줘요(조용한 대체 없음). 화면은 오류를 그대로 보여 줘요(연동 원칙 4).

---

## 7. 트랙별 새 테이블 지도

| 묶음 | 테이블 (기획서) | 범위 |
|:---|:---|:---|
| 사무소·권한 | `offices`·`office_members`·`office_custom_roles`·`office_permission_grants`·`office_audit_logs`·`proposal_reviews`·`work_queue_overrides` (16) | 사무소 |
| 사건 뼈대 | `office_clients`·`cases`·`case_events`·`client_link_invites`·`case_form_drafts`·`case_plan_payments` (20) | 사무소 + 의뢰인 공개분 |
| 서류·보정 | `case_exhibits`·`correction_orders`·`correction_items`·`correction_item_library`·`bank_audit_rows` (14), `client_form_requests`·`client_form_submissions` (07) | 사건 |
| 부채증명 | `debt_certificates`·`debt_certificate_files`·`debt_agency_orders` (26) | 사건 |
| 사건 검토 | `case_reviews` (19) | 사건(의뢰인 안 보임) |
| 수임료 | `fee_agreements`·`fee_installments`·`fee_payments`·`fee_allocations`·`fee_schedule_changes`·`fee_refunds`·`fee_office_settings` (18) | 사건 + 의뢰인 공개분 |
| 소통·업무폰 | `client_contacts`·`communication_logs`·`call_recordings`·`call_transcripts`·`evidence_access_logs`·`office_devices`·`device_tokens`·`device_events`·`device_commands`·`device_pairing_codes`·`device_app_releases` (11·24) | 사무소(관리자 제외) |
| 영업 DB | `sales_leads`·`sales_lead_events`·`sales_lead_sources`·`sales_intake_logs`·`sales_ad_costs`·`sales_settings`·`sales_suppression`·`sales_vendors`·`sales_vendor_replacements`·`sales_vendor_billings` (15) | 사무소 |
| 설정·알림 | `office_settings`·`user_preferences`·`notification_deliveries` (21), 기존 `in_app_notifications` 유지 | 사무소·개인 |
| 계산 기준 | `calc_standard_sets`·`calc_standard_items`·`court_practice_profiles`·`office_court_overrides` (27) | 플랫폼(읽기 공개) + 사무소 |
| 광고·결제 | `ad_products`·`ad_promotions`·`ad_creatives`·`active_ad_placements`(뷰)·`ad_daily_stats`·`office_billing_profiles`, 기존 `ad_orders` 고침 (17) | 사무소 + 관리자 |
| 콘텐츠·약관 | 기존 CMS 7개 칸 구조 고침, `legal_documents`·`user_consents`·`platform_settings` (23) | 플랫폼 |
| 운영 | `admin_actions`·`admin_notes`·`consult_reports`·`lawyer_review_events`·`platform_daily_metrics`·`privacy_requests`·`privacy_purge_log` (22) | 관리자 |
| 변호사 찾기 | `client_favorite_lawyers` (13) | 의뢰인 본인 |
| 추가 기능 | `creditor_registry`·`creditor_registry_suggestions`·`creditor_dispatches`·`legal_guides`·`consult_slots`·`consult_bookings`·`import_jobs` (25) | 플랫폼·사무소 |
| 마케팅 | `marketing_articles`·`marketing_assets`·`marketing_keywords`·`marketing_metrics_daily` (04), 기존 마케팅 2개 유지 | 관리자 |

이 표에 없는 테이블을 새로 만들 때는 이 문서와 29 점검표에 한 줄씩 추가해요(원본 표·RLS 범위·시험 번호).

---

## 8. 기존 47개 테이블 처리

| 처리 | 테이블 |
|:---|:---|
| **유지** | `consult_requests`(RLS를 사무소 기준으로), `consult_messages`, `consult_requests_for_lawyers`(뷰), `lawyers`·`lawyer_private_profiles`·`lawyer_accounts`·`lawyer_profile_tombstones`, `client_aliases`, `shared_reports`(변호사 보고서만), `audit_logs`(익명 INSERT 차단), `user_sessions`(UPDATE 트리거, OP), `in_app_notifications`, `task_tickets`·`calendar_events`·`internal_messages`(`tenant_id` → `office_id`), `invite_tokens`, `marketing_*` 2개 |
| **칸 구조 고침** | `ad_orders`(정수 금액·상태 흐름), CMS 7개(`news_articles`·`client_qas`·`success_reviews`·`main_banners`·`notices`·`client_inquiries`·`lawyer_inquiries`, `{id,data}` → 칸 구조), `electronic_contracts`(`office_id`·`case_id` 추가), `alimtok_logs`(→ `notification_deliveries`로 합칠지 ST에서 결정), `staff_members`(→ `office_members`로 옮긴 뒤 삭제) |
| **대체 후 삭제** | `crm_clients` → 4장 사건 구조, `platform_config`·`popup_config`·`matching_config` → `platform_settings`, `rehab_policy_settings` → `calc_standard_*`, `fee_notification_settings` → `fee_office_settings`, `custom_roles` → `office_custom_roles`, `members` → `account_status`(OP), `diagnosis_*` 3개 → 챗봇 서버 저장 방식 정할 때(I 트랙) |
| **바로 삭제** (코드 참조 0 또는 미사용) | `cases`(옛), `copilot_cases`, `copilot_rulesets`, `client_memos`, `notification_channel_settings`, `staff_activities`, `activity_logs`, `doc_share_packages`(미가입 변호사 서류 공유는 출시 범위 제외 — 서비스 코드는 비활성 보존 결정이라 테이블은 보존, 삭제는 사용자 확인 후) |

`doc_share_packages`는 10-24 결정('비활성화 상태로 보존')에 따라 지우지 않아요. 바로 삭제 묶음도 마이그레이션 전에 한 번 더 코드 검색으로 참조 0을 확인해요.

---

## 9. 파일 저장소 (Supabase Storage)

| 버킷 | 공개 | 경로 | 내용 |
|:---|:---:|:---|:---|
| `case-files` | 비공개 | `{office_id}/{case_id}/{종류}/{uuid}` | 의뢰인 서류·부채증명서·보정 자료·서식 출력본 |
| `recordings` | 비공개 | `{office_id}/{case_id 또는 lead_id}/{uuid}` | 통화 녹음(CL), 기기 SHA-256 함께 저장 |
| `office-private` | 비공개 | `{office_id}/…` | 직인·도장 이미지, 사업자 서류 |
| `inquiry-attachments` | 비공개 | `{user_id}/{inquiry_id}/…` | 1:1 문의 첨부 |
| `lawyer-public` | 공개 | `{lawyer_id}/…` | 승인된 변호사 프로필 사진 |
| `site-media` | 공개 | `{종류}/…` | 칼럼·배너 이미지 |

- `storage.objects` RLS는 경로 첫 칸(`office_id`)으로 `has_office_permission` 확인, 의뢰인은 자기 사건의 공개 파일만 서버 함수가 만든 짧은 서명 URL로 열어요.
- 파일 원본은 바꾸지 않고, 지문(SHA-256)을 메타 테이블에 저장해요(서버 전자지문, 블록체인 표현 대체).
- 무료 요금제 저장 용량 1GB → 녹음·스캔이 늘면 Pro 전환 시점의 근거가 돼요(마스터 기획서 인프라 비용).

---

## 10. 예약 작업

| 작업 | 위치 | 주기 |
|:---|:---|:---|
| 보관 기한 파기(미연결 1년·종결 5년·리드 1년)·휴지통 30일 | `pg_cron` (DB 안) | 매일 03:00 |
| 광고 상태(시작·만료)·구좌 예약 자동 취소 | `pg_cron` | 매시 |
| 수임료 회차 상태·응답 기한 2영업일 확인 | `pg_cron` | 매시 |
| 알림톡·문자 예약 발송, 3시간 뒤 자동 대체, 아침 요약 08:30 | `pg_cron` + `pg_net` → `/api/notify`(서버 비밀 키 확인) | 5분 |
| 법원 사건 감지(CODEF) | `pg_cron` + `pg_net` → `/api/codef` | 매일 1회 |
| 마케팅 일일 생성 | 지금처럼 Vercel 크론 | 매일 |

Vercel Hobby 크론은 하루 1회만 돼서 예약 발송에 쓸 수 없어요. 그래서 DB 예약 작업으로 모아요(DM-Q2). 외부 호출은 `pg_net`이 서버 API를 부르고, API는 공유 비밀 값(환경변수)으로 호출자를 확인해요.

---

## 11. 브라우저 저장 → 서버 (S 트랙)

- **원칙:** 업무 데이터는 서버가 원본, 브라우저는 화면 설정·임시 캐시·작성 중 초안만(project-context 6-1).
- **옮길 데이터 없음 (DM-Q3 사용자 확인 10-30):** 운영 DB에도(1장), 브라우저에도(영업 DB·직원 설정·수임료 알림 설정·광고 사업자 정보·제안서 컨펌 대기 등) 실제로 쓰던 기록이 없어요. 이관·가져오기 기능은 만들지 않고 새 구조로 시작해요. (영업 DB의 엑셀 리드 가져오기는 SL 기능으로 별도 유지)
- **전환 방식:** 화면마다 새 서비스가 서버만 읽고 쓰게 바꾸고, 옛 localStorage 키는 첫 실행 때 지워요(키 목록은 S 트랙 작업 때 코드 검색으로 확정). 서버 실패 시 오류 카드·다시 시도.
- **완료 기준:** 업무 데이터 localStorage 키 검색 0건(허용 목록: 화면 설정·초안 자동저장·로그인 세션).

---

## 12. 마이그레이션 순서

모든 파일은 `supabase/migrations/YYYYMMDDHHMMSS_이름.sql`. 순서마다 **시험 DB 실행 → 운영과 대조 → 사용자 확인 → 운영 실행**(30 기획서 4-1).

| 묶음 | 내용 | 기획서 |
|:---|:---:|:---|
| 0 ✅ | 기준 파일 + 030 | 30 |
| 1 | `offices`·`office_members`·권한 함수, 기존 tenant 함수 교체, 쓰지 않는 테이블 삭제 | RB-1, 8장 |
| 2 | 사건 뼈대(`office_clients`·`cases`·`case_events`·`client_link_invites`·`case_form_drafts`), `create_case`·`record_case_milestone`, 상담 요청·계약 RLS 사무소 기준 | CM-1·CM-3 |
| 3 | Storage 버킷·정책, 파일 메타 공통 칸 | 9장 |
| 4 | 플랫폼 설정·콘텐츠 칸 구조·약관 버전·동의 | CT-1 |
| 5 | 계산 기준표 | LS-1 |
| 6 | 사무소 설정·개인 설정·알림 발송 기록, `pg_cron`·`pg_net` | ST-8, 10장 |
| 7 | 관리자 운영 함수·기록 | OP-1 |
| 8~ | 트랙별: 수임료(FE) → 서류·보정·작성 요청(DP·CR·H-14) → 부채증명(DC) → 광고(AD) → 영업 DB(SL) → 소통·업무폰(CL·AP) → 나머지 | 각 기획서 |
| 끝 | 대체된 옛 테이블 삭제(`crm_clients`·`staff_members`·`*_config` 등), 실시간 발행 테이블 추가 | 8장 |

- 한 묶음 = 한 파일이 원칙이지만, 하나가 500줄을 넘으면 나눠요.
- 운영 실행 전 그날 백업(`pg_dump`)을 받아요. 테이블을 지우는 묶음은 지울 테이블의 행 수를 먼저 확인해요.

---

## 13. 질문

**10-30 결정:** DM-Q1·Q2 추천안대로, DM-Q3 '실제로 쓰던 기록 없음' → 옮기지 않고 새로 시작.

| 번호 | 질문 | 추천 | 이유 |
|:---|:---|:---|:---|
| DM-Q1 ✅ | 사무소를 테이블로 만들까요? | **만들어요**(`offices`·`office_members`). 사무소 ID 값은 지금처럼 대표 변호사 ID | 지금은 대표 ID·`law_firm_id`·초대한 사람 ID 세 곳을 합쳐 판정해서 틀리기 쉬워요. 값은 그대로라 기존 칸을 고칠 필요가 없어요 |
| DM-Q2 ✅ | 예약 발송·파기 같은 정기 작업을 어디서 돌릴까요? | **Supabase `pg_cron` + `pg_net`** (무료 요금제에서 가능) | Vercel 무료 요금제 크론은 하루 1회라 예약 발송(09~20시·3시간 뒤 대체)을 못 해요 |
| DM-Q3 ✅ (사용자) | 브라우저에만 저장된 지금 데이터(영업 DB 등)를 서버로 옮길까요? | **옮기지 않고 새로 시작**. 실제로 쓰던 데이터가 있으면 영업 DB만 엑셀 내보내기 → 새 화면 가져오기 | 운영 DB 업무 데이터는 0건이고, 지금까지는 시험 사용이었어요. 사용자 확인(10-30): 실제로 쓰던 기록 없음 → 엑셀 이관도 하지 않음 |
