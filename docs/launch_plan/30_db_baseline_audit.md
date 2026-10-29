# 30. 운영 DB 백업·실제 구조 점검 (2026-10-29)

- **목적:** 구현 착수 전 운영 DB를 백업하고, 저장소의 마이그레이션 파일과 운영 DB의 실제 구조를 비교해 'GitHub ↔ Supabase 연동'의 기준선(baseline)을 정해요.
- **운영 프로젝트:** Supabase Free 요금제, Postgres 17.6, 서울(ap-northeast-2), DB 크기 약 34MB. 대시보드에 "Grace period is over"(무료 한도 초과, 한도를 다 쓰면 요청 거부) 경고가 떠 있음.
- **백업 위치:** `D:\mykim_backup\2026-10-29`(저장소 밖, 개인정보 포함 → GitHub·채팅에 올리지 않음). 보관: 비밀번호 압축(AES-256) + 외부 저장 장치 사본 권장.

## 1. 받은 백업

| 파일 | 내용 | 확인 |
|:---|:---|:---|
| `mykim_full.dump` (약 3.7MB) | 전체 DB(`pg_dump -Fc`, auth·storage·realtime 등 포함), 복원용 | `pg_restore --list` 항목 905개 |
| `schema_public.sql` (약 178KB) | `public` 구조만(테이블·뷰·함수·정책·트리거) | 아래 2장 |
| `data_json/*.json` + `data_summary.json` | 테이블별 데이터(관리자 키 읽기), 48개(뷰 1 포함)·817행 | 오류 0 |
| `openapi_public.json` | 공개 API 테이블·칸 목록 | - |
| Storage | 버킷 0개 | 받을 파일 없음 |

- 도구: PostgreSQL 17.11 클라이언트(`C:\Program Files\PostgreSQL\17\bin`), 접속은 Shared pooler(세션 5432), 비밀번호는 사용자가 `%APPDATA%\postgresql\pgpass.conf`에 직접 저장(채팅·문서에 없음).
- 데이터 양: 감사 기록 738, 상담 메시지 33, 세션 21, 상담 요청 9, 가명 5, 변호사 4·변호사 비공개 프로필 4·계정 2, 그 밖 대부분 0행(사건·계약·수임료·CMS·광고 0). 거의 시험 데이터예요.

## 2. 운영 DB 실제 구조 (`public`)

- 테이블 47 + 뷰 1(`consult_requests_for_lawyers`), 함수 50, 정책 117, 트리거 14, RLS 켜진 테이블 47(전부).

## 3. 마이그레이션 파일 대조

| 파일 | 운영 반영 | 메모 |
|:---|:---:|:---|
| 001~003, 005, 007~009, 011~029, 031 | ✅ | 테이블·함수 모두 있음. 초기 파일의 정책 이름이 없는 것은 뒤 파일(006·012·021·026 등)이 지우고 다시 만든 결과 |
| 004 `copilot_review_system` | ❌ | 14개 테이블(`case_reviews` 등) 없음. 'AI 사건 분석'은 CV 트랙으로 새로 설계했으니 이 파일은 적용하지 않고 보관 |
| 006 `security_hardening` | ✅(대체됨) | 정책 52개는 뒤 파일로 모두 바뀜 |
| 010 `lawyer_smtp_credentials` | ❌ | 테이블 없음(지금 Gmail 비밀번호는 브라우저 세션 저장). ST-7·ST-8 서버 발송 설계로 대체 |
| **030 `consult_messages_target_lawyer`** | ❌ → ✅ 10-29 적용(4-1) | **`consult_messages.target_lawyer_id` 칸이 운영에 없음.** 코드(`consultService.ts` 494~553)는 칸이 없으면 빼고 저장하는 대체 동작이 있어 지금 오류는 안 나지만, 여러 변호사와 비교 상담할 때 메시지가 어느 변호사에게 간 것인지 서버에 남지 않아요 → 착수 첫 마이그레이션 묶음에서 적용·확인 필요(X-05) |
| `20260916_leadmaster_app_sync` | ❌ | `communication_logs` 등 4개 없음. CL-0 결정대로 파일 삭제 |
| `DEPLOY_012_TO_026_MASTER`·`phase1`·`phase2` | 묶음 | 내용은 012~026·초기 테이블과 같음. 자동 실행 대상에서 빼고 보관 |

## 4. GitHub ↔ Supabase 연동 기준선 (다음 작업)

1. `schema_public.sql`을 바탕으로 **기준 마이그레이션 1개**(`supabase/migrations/<타임스탬프>_baseline.sql`)를 만들어요. 운영 구조 그대로(004·010·LeadMaster 제외, 030은 기준선 뒤 첫 마이그레이션으로).
2. 옛 파일 001~031·묶음 파일은 `supabase/migrations_archive/`로 옮겨요(이력 보관).
3. 운영 DB 마이그레이션 기록에 기준선을 '이미 적용됨'으로 표시(`supabase migration repair --status applied <타임스탬프>`). 이렇게 해야 연동 뒤 옛 파일이 다시 실행되지 않아요.
4. `config.toml` 정리, 시험용 `seed.sql`(가짜 데이터만).
5. GitHub 연동은 '운영 자동 반영' 끈 채로 시작. 브랜치(시험 DB)는 Pro 요금제가 필요해서, **무료 요금제 동안은 시험용 무료 프로젝트를 하나 더 만들어**(무료 2개까지) 거기서 마이그레이션을 먼저 실행하는 방식으로 대신해요.

### 4-1. 진행 결과 (10-29, 저장소에만 반영·미커밋)

- 1·2·4번 완료.
  - `supabase/migrations/20261029000000_baseline.sql`: 운영 덤프(권한 포함) 그대로. 개수 확인: 테이블 47·뷰 1·함수 50·정책 117·트리거 14·RLS 47.
    - 덤프에서 뺀 줄: `\restrict` 2줄, `CREATE SCHEMA public`, 스키마 주석, `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` 12줄(postgres 계정으로 실행 불가).
    - 앞에 확장 3개(`pgcrypto`·`uuid-ossp`·`pg_stat_statements`, `extensions` 스키마)를 넣고, 끝에 `RESET ALL`을 넣었어요(덤프의 search_path 비우기가 다음 파일에 남지 않게).
  - `supabase/migrations/20261029000100_consult_messages_target_lawyer.sql`: 옛 030에서 `BEGIN`/`COMMIT`만 뺀 것(CLI가 파일마다 트랜잭션을 걸어요).
  - 옛 파일 38개는 `supabase/migrations_archive/`로 옮기고 `README.md`에 처리 표를 붙였어요. `supabase/seed.sql`은 규칙 주석만 있어요(가짜 데이터는 X 시험 시나리오 때 채움).
  - `config.toml`은 이미 `major_version = 17`·`sql_paths = ["./seed.sql"]`이라 고치지 않았어요.
  - 변환 스크립트: `D:\mykim_backup\2026-10-29\build_baseline.mjs`(저장소 밖).
- **시험 DB 검증 통과 (10-29).** 시험용 무료 프로젝트 `mykim-test`(ref `gzvaz…`, 서울, Postgres 17.11)에 Supabase CLI 2.122.0 `db push --db-url`로 기준 파일 → 030을 실행했어요. 마이그레이션 기록 2건이 남았어요.
  - 비교 방법: 운영·시험 DB에서 칸(형식·기본값·NOT NULL)·RLS·제약·인덱스·함수 본문·정책·트리거·뷰·테이블/함수/스키마 권한·기본 권한을 한 줄씩 뽑아 대조(1,151줄 vs 1,153줄).
  - 차이: 030의 칸 1개·인덱스 1개(예정된 것), 마케팅 CHECK 제약 4개의 표기 방식(허용 값은 같음 — PostgreSQL이 다시 읽으며 쓴 형태 차이). 함수 50개는 본문 안 줄바꿈 문자(CR)만 달라서 CR을 빼고 비교하면 모두 같아요.
  - 첫 실행에서 찾아 고친 문제: 새 프로젝트의 public 기본 권한 때문에 운영에서 회수한 권한이 시험 DB에 생겼어요(관리자 함수 22개에 anon 실행 권한, 테이블·뷰 6개에 anon 전체 권한). 기준 파일 앞에서 기본 권한을 잠시 끄고 끝에서 다시 켜도록 바꾼 뒤 다시 실행해 권한이 운영과 같아졌어요.
  - 로컬 시험 DB는 못 써요(이 PC의 PostgreSQL은 클라이언트만, `share/` 없음). CLI는 `%TEMP%\supabase_cli\supabase.exe`(npx는 설치 중 멈춤).
  - 시험 DB 초기화 스크립트 `D:\mykim_backup\2026-10-29\reset_test_public.sql`은 시험 DB 전용이에요.
- **운영 반영 완료 (10-29, 사용자 확인 후).**
  - 3번: `migration repair --status applied 20261029000000` → 운영에 `supabase_migrations.schema_migrations`가 생기고 기준 1줄 기록(테이블·데이터 변경 없음).
  - 030: `db push`로 `20261029000100` 적용 → `consult_messages.target_lawyer_id` 칸·`idx_consult_messages_request_target` 인덱스 생김, 기존 메시지 33건은 모두 NULL(030 이전 메시지와 같은 뜻). PostgREST 스키마 새로 읽기(`NOTIFY pgrst`) 포함.
  - 반영 뒤 운영·시험 DB 대조 1,153줄 대 1,153줄, 차이는 CHECK 제약 4개 표기뿐.
  - 이제 운영 마이그레이션 기록 = 저장소 `supabase/migrations/` 2개. 다음 변경부터는 새 파일 추가 → 시험 DB `db push` → 대조 → 운영 `db push` 순서로 해요.
- 주의: `supabase/.temp`가 운영 프로젝트(`xgmmv…`)에 연결돼 있어요. 3번(repair) 전에 `npx supabase db push`를 실행하면 기준 파일이 운영에 실행돼요. 이미 있는 객체라 첫 줄에서 실패하고 트랜잭션이 되돌려져 피해는 없지만, repair 전에는 실행하지 않아요.

### 4-2. 새로 확인한 사실: Realtime 구독이 동작하지 않음 (10-29)

- 운영 `supabase_realtime` 발행(publication)에 public 테이블이 **하나도 없어요**(`pg_publication_tables` = Realtime 내부 `messages_*` 6개뿐).
- 그래서 `App.tsx` 500~507(`consult_requests`·`consult_messages` 변경 구독)과 `communicationService.ts` 572(`comm-logs`)는 이벤트를 받지 못하고, 화면 갱신은 폴링에만 기대고 있어요.
- 처리: 기준 파일은 운영 그대로 두고(발행 설정 넣지 않음), 알림 서버화 묶음(29 기획서 X-1 '변경 전달')에서 필요한 테이블만 `ALTER PUBLICATION supabase_realtime ADD TABLE …`로 넣어요. RLS가 걸린 테이블은 구독자 권한으로 걸러져요.

## 5. 무료 요금제로 버티기 (사용자 결정 10-29: 당장 비용 없음, 무료로 진행)

- 한도 초과 항목은 대시보드 **Organization → Usage**에서 확인 필요(데이터 34MB라 저장 용량보다 데이터 전송량·요청 수 초과 가능성이 큼).
- 10-25 커밋 `6abe123`(탭을 안 볼 때 폴링 멈춤·Egress 최적화)은 GitHub·운영에 아직 안 올라감 → "배포해" 지시 때 반영. 반영 전 `vite build` 확인.
- 출시 전 Pro 전환 결정(마스터 기획서)은 유지하고, 그 전까지는 무료 2개 프로젝트(운영·시험)로 진행.
