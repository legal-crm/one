# 옛 마이그레이션 보관 (2026-10-29)

이 폴더의 파일은 **실행하지 않는다.** 기록 보관용이다.

운영 DB 구조는 `supabase/migrations/20261029000000_baseline.sql` 하나에 담았다
(운영 DB `pg_dump` 결과 그대로). 새 변경은 `supabase/migrations/`에
`YYYYMMDDHHMMSS_이름.sql` 형식으로만 추가한다.

| 파일 | 운영 반영 | 처리 |
|---|---|---|
| 001~003, 005, 007~009, 011~029, 031 | 반영됨 | 기준 파일에 포함 |
| 006_security_hardening | 일부 내용이 이후 파일로 대체됨 | 기준 파일 기준 |
| 004_copilot_review_system | 반영 안 됨 | 쓰지 않음 (CV 트랙이 대체) |
| 010_lawyer_smtp_credentials | 반영 안 됨 | 쓰지 않음 (ST 트랙이 대체) |
| 030_consult_messages_target_lawyer | 반영 안 됨 | `20261029000100_consult_messages_target_lawyer.sql`로 옮김 |
| 20260916_leadmaster_app_sync | 반영 안 됨 | 쓰지 않음 (LeadMaster 연동 금지, CL-0) |
| DEPLOY_012_TO_026_MASTER, phase1_*, phase2_* | 묶음 파일 | 쓰지 않음 |

대조 근거: `docs/launch_plan/30_db_baseline_audit.md`.
