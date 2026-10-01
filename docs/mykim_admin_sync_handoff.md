# 변호사 어드민 ↔ 고객 페이지 동기화 작업 — 이어하기 메모

저장 시점: 2026-09-30 · 브랜치 `main` (origin/main = 86aeecb) · **커밋·푸시·배포 안 함**

## 현재 상태 한 줄

고객 페이지 개편(b7ed0c6, 이미 운영 배포됨 — 상담 채팅·퀵툴 포함)으로 어긋난 어드민 쪽을 고치는 중. 작업 트리에만 반영되어 있고, `npx tsc --noEmit` 오류 수는 기준선과 같음(229 → 229, 새 오류 0). `npm run build`는 아직 안 돌림.

- 계획서: `docs/mykim_lawyer_admin_ui_upgrade_plan.md` (결정 9 "나중에 함께 배포"·퀵툴 A는 채팅·퀵툴이 이미 배포되어 의미 없어짐 → 문서 갱신 필요)
- 백업: `.tmp-admin-work/admin-sync-wip.patch`(추적 파일 diff), `.tmp-admin-work/new-files/`(새 파일 4개 사본), `tsc-before.txt`(기준선)
- 건드리지 말 것: `scripts/kakao-ads/*` (다른 창 작업, 미커밋)

## 끝난 작업

| 영역 | 내용 | 주요 파일 |
|---|---|---|
| 공용 판정 | 신규 요청·제안 가능·대화 열림 판정 한곳으로 | `lawyer/requestScope.ts`(신규) |
| 메시지 대상 | `target_lawyer_id` 저장/조회 (칼럼 없으면 빼고 재시도) + 마이그레이션 파일(미적용) | `services/consultMessageSchema.ts`(신규), `consultService.ts`, `supabase/migrations/030_…sql`(신규) |
| 채팅 필터 | 고객 전용 안내 숨김, 전화상담·전담 선임 규칙, `chatOpen`/`hasMyProposal` | `chat/chatSelectors.ts` |
| 제안서 발송 | 자동 수락 제거(의뢰인 '상담 시작'이 대화를 엶), 발송 차단 사유, 비교표 요약 저장, 막히면 초안 유지(false 반환) | `LawyerRole.tsx`, `ProposalWorkspace.tsx`, `LawyerProposalDraft.tsx`, `CaseReviewCopilot.tsx` |
| 채팅 UI | 대화 열리기 전 작성창 잠금+안내, 목록 '의뢰인 확인 대기' 칩, 보내는 중·전송 실패·다시 보내기, 사건 있으면 '사건 열기', 메모 저장 결과 3단계(saved/local/failed) | `chat/*`, `chat/rail/MemoTab.tsx`, `App.tsx`(lawyer 전송 상태 추적) |
| 전송 가드 | `handleSendChat`도 대화 열림 확인 | `LawyerRole.tsx` |
| CRM | 딥링크, 13단계↔상태 동기화(`journeyStage.ts` 신규), 신규 리드 = `isNewRequestForLawyer`, 서류 승인·반려·요청 결과 확인, 시뮬레이션 버튼 DEV 전용 | `CrmTab.tsx`, `crmService.ts`, `pipeline/*` |
| 파이프라인 | Stage1 내 제안서만 사용·계약 이후 상태 전체, Stage4 없는 상태값 수정 | `Stage1ConsultationView.tsx`, `Stage4FilingBundleView.tsx` |
| 개시 후 관리 | CRM 사본(납부 기록 없음)은 미납 0 + 안내 | `postcare/PostCommencementManagementModal.tsx` |
| 회생동행 동기화 | 빈 CRM 값으로 사건번호·계좌·월 변제금 덮어쓰지 않음, 외부/나홀로 사건 출처 유지 | `companionService.ts` |
| 고객 마이페이지 | 취소 상태에 '면책 확정' 문구 뜨던 문제, 기각·파산 단계 문구 | `client/mypage/CaseProgressCard.tsx` |
| 용어 | discharged = '면책 결정'(고객 화면과 통일), 요청 유형 이름 통일 | `constants/consultStatus.ts` |
| 계약 | 계약관리 탭 금액 원 환산(`feeTotalWon`), 'signed'도 체결 완료, '변호사 서명 대기' 표시·재촉 제외, 서명 공유 모달 금액, 원격 서명 검증창 본인 이름 표시 | `ContractManagementTab.tsx`, `ClientSignShareModal.tsx`, `ClientRemoteSignView.tsx` |
| 퀵툴 | Esc 최소화, 드래그 후 클릭 오작동, 모바일 GNB 위 위치 등 | `quickdock/*`, `LegalQuickDock.tsx` |

## 남은 작업 (순서대로)

1. **`crmService.syncContractToCrm` 재작성** — 중단된 지점. 아직 원본 그대로(832행 근처).
   - 순수 함수 `buildContractSyncPatch(clientId, ext, contract, actor)` 추가, `syncContractToCrm`은 `loadCrmDataResult()`로 서버 최신값 기준(읽기 실패+로컬 사본 없음이면 저장 안 함), 저장한 ext 또는 null 반환
   - 분납표: id/회차로 기존 항목과 맞춰 납부 상태·납부일·연기 정보·알림 이력 유지
   - 활동 로그: 같은 계약의 마지막 기록 상태와 다를 때만 추가, 금액은 `feeTotalWon(...).toLocaleString()원`
   - 상태 승격: `client_review` 포함, 현재 상태가 requested/consulting일 때만 'contracted' (지금은 completed면 filed 이후도 contracted로 되돌림)
   - 승격 시 `thirteenStageAfterStatusChange`로 13단계도 맞춤
   - 잘못된 주석 "(만원 단위 변환)" 수정
2. **CRM 안 호출부는 패치 한 번으로 저장** — `ClientContractSubTab.handleWizardSave`, `Stage2ContractRetainerView`(725·752행): `syncContractToCrm` 뒤 오래된 state로 `onUpdateCrmExt`가 덮어쓰는 문제 → `onUpdateCrmExt(buildContractSyncPatch(...))` 한 번으로. Stage2는 `saveContract` await·결과 확인도.
3. **금액 단위** — `ClientContractSubTab`(초기 수임료를 만원으로 정규화, 235·353행 표시 원 환산), `ContractWizard`(분납액 원 + `amountUnit:'won'`), `ContractConversionModal`(원 + 'won'), `Stage2`(기본값 `feeAmountWon`/`feeTotalWon`).
4. **고객 `client/mypage/ContractCard.tsx`** — completed/signed·signedAt을 서명 완료로.
5. **Turnstile** — `api/_lib/turnstile-validator.js`: 시크릿 키가 없을 때만 통과 허용, 키가 있으면 운영에서 mock/빈 토큰 거부.
6. **검증** — tsc 기준선 비교(아래 명령), `npm run build`, `.tmp-admin-work/verify-chat-filter.ts` 실행, 가능하면 퍼피티어 스모크.
7. **계획서 갱신** — 고객 동기화 조사·수정 절, 채팅·퀵툴 이미 배포 사실, DB 승인 필요 항목.
8. `.tmp-admin-work/` 삭제(백업 확인 후).

## 사용자 승인이 필요한 것 (DB·보안)

- 마이그레이션 030(`consult_messages.target_lawyer_id`) 적용 — 코드는 칼럼이 없어도 동작
- `crm_clients` RLS(011): `auth.uid() = client_id`인데 client_id는 요청 ID라 의뢰인이 자기 CRM 행을 못 읽음 → 마이페이지는 sessionStorage만 읽는 상태. RPC/정책 필요
- 동의 기록이 user_metadata에만 있음 → 동의 로그 테이블
- 회생동행 데이터가 localStorage에만 있음 → 서버 저장
- 연락처 공개 판정(`phoneConsultationRequested` 등)이 요청 단위라 비교 상담 중 다른 변호사에게도 적용될 수 있음 — 화면 판정만 해당, 실제 번호는 서버 `contact_visible` 기준

## 정해 둔 규칙

- 한국어 주석·문구, 기존 스타일 유지. "이전: …" 형식으로 바뀐 이유 기록
- '배포해' 전에는 커밋·푸시·배포 안 함. '배포해' = GitHub push(`$env:GITHUB_TOKEN = "";` 접두) + Vercel 운영 배포
- 결정 10: 수락 변호사 2명 이상일 때 대상 없는 의뢰인 메시지 숨김은 `getTargetLawyerColumnState()==='present'`일 때만

## tsc 비교 명령

```powershell
npx tsc --noEmit > .tmp-admin-work/tsc-now.txt 2>&1
$norm = { param($p) Get-Content $p | Where-Object { $_ -match 'error TS' } | ForEach-Object { $_ -replace '\(\d+,\d+\)', '' } }
$before = & $norm '.tmp-admin-work/tsc-before.txt'; $now = & $norm '.tmp-admin-work/tsc-now.txt'
"before=$($before.Count) now=$($now.Count)"; Compare-Object $before $now | Where-Object SideIndicator -eq '=>'
```

## 다시 시작할 때 붙여 넣을 문장

> `docs/mykim_admin_sync_handoff.md`를 읽고 '남은 작업' 1번(syncContractToCrm 재작성)부터 이어서 진행해줘. 커밋·배포는 하지 말고, 끝나면 tsc 기준선 비교와 npm run build로 확인해줘.
