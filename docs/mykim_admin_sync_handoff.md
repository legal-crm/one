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
| 계약 동기화 | syncContractToCrm 재작성(buildContractSyncPatch 순수 함수 분리, 분납표 상태 보존 매칭, 상태 승격 방어, 원 단위 표기) | `services/crmService.ts` |
| 금액 단위 통일 | ClientContractSubTab 초기 수임료 만원 정규화 및 표시 원 환산, ContractWizard 분납 스케줄 amountUnit: 'won', ContractConversionModal 원 단위 환산, Stage2 기본값 feeAmountWon/feeTotalWon 호환 | `ClientContractSubTab.tsx`, `ContractWizard.tsx`, `ContractConversionModal.tsx`, `Stage2ContractRetainerView.tsx` |
| 고객 마이페이지 | ContractCard.tsx completed/signed/signedAt 모두 서명 완료로 판정 | `client/mypage/ContractCard.tsx` |
| Turnstile | api/_lib/turnstile-validator.js 시크릿 키 구성 시 mock/빈 토큰 엄격 거부 | `api/_lib/turnstile-validator.js` |
| **Phase 0-1** | 파이프라인 단계 판정 단일화 (`getJourneyState()`, 6단계 동적 산출 연동) | `pipelineGates.ts`, `CrmTab.tsx` |
| **Phase 0-2** | 상태 변경 경로 정리 (13단계 바 `onSelectStage` 및 번개 버튼에 게이트 검사 & `dialog.confirm` 적용) | `CrmTab.tsx` |
| **Phase 0-3** | 4·5·6단계 파이프라인 입력 누락 해소 (사건번호/법원/접수일 등록, 개시결정 폼 및 `commenced` 자동 승격, 면책/기각 처리) | `Stage4FilingBundleView.tsx`, `Stage5CorrectionCenterView.tsx`, `Stage6PostCareDischargeView.tsx` |
| **Phase 0-4** | 서류 상태 서버 저장 (localStorage 단독 탈피 -> `crmExt.stage3DocsState` 양방향 서버 저장 및 송장번호 연동) | `Stage3DocumentsHubView.tsx` |
| **Phase 0-5** | 의뢰인 표시 규칙 단일화 (`clientDisplay.ts` 신규 생성 및 적용: 이름/전화번호 마스킹 및 실명 단일화) | `clientDisplay.ts`, `LawyerRole.tsx`, `leadService.ts`, `LawyerChatWorkspace.tsx` |
| **Phase 0-6** | 안내 문구 및 버튼 정돈 (Gate 개발용어 제거, 수임계약 체결됨 안내 교체, 가짜 빨간 점 및 가짜 질문 제거) | `Stage1ConsultationView.tsx`, `Stage2ContractRetainerView.tsx`, `Stage3DocumentsHubView.tsx`, `Stage4FilingBundleView.tsx`, `Stage5CorrectionCenterView.tsx`, `ClientCommunicationSidePanel.tsx` |
| **Phase 0-7** | CRM 가짜 기본값 제거 (사건유형 추정 제거, 담당자 미정 '미배정', 관할법원 미지정 '미입력', 팩트 매트릭스 동적 바인딩) | `CrmTab.tsx` |
| **Phase 0-8** | 이동 함수 및 딥링크 단일화 (`openCase`, `openRequest`, `openThread` 통합, 알림벨 직행, 컨텍스트 초기화) | `LawyerRole.tsx`, `NotificationBell.tsx`, `ContractManagementTab.tsx`, `CrmTab.tsx` |
| **Phase 0-9** | 네이티브 대화상자 전면 교체 & 토스트 한국어화 (모든 window.confirm/prompt -> `useDialog`, 통화결과 한국어 매핑) | `SalesLeadsTab.tsx`, `CaseDetailAiSummary.tsx`, `FeeSettlementTab.tsx`, `LawPassCourtFilingSidebar.tsx`, `ApplicationDocSettingsModal.tsx`, `CreditorManagementModal.tsx`, `LawyerRole.tsx` |
| **Phase 0-10** | 계약 저장 1회화 & 납부 기록 보존 (`ContractWizard` 중복 저장 방지 `isSaving` 가드, 기납부 완료 회차 매칭 보존, CRM totalPaid 연동) | `ContractWizard.tsx`, `services/crmService.ts` |
| **Phase 0-11** | 고객관리 저장 충돌 방지 (`loadCrmDataResult` 서버 실패 시 빈 객체 `{}` 덮어쓰기 방지, 배열 안전 병합) | `services/crmService.ts` |
| **Phase 0-12** | 법원 비용 기본 조합 통일 (`courtFees.ts`, `contractService.ts`, `Stage2` 전자소송 10% 감액 및 금지명령 기본 조합 일치) | `services/contractService.ts`, `ContractWizard.tsx`, `ClientContractSubTab.tsx`, `ContractConversionModal.tsx` |
| **Phase 1-1** | CSS 토큰 & 어드민 스케일 체계 (.admin-scale 12px 하한, z-index 계층 변수, --dock-safe-area 정의) | `src/index.css` |
| **Phase 1-2** | 사이드바 메뉴 설정 배열화 (5대 그룹, 배지 2종 규칙, 권한 일관성 검사, 딥 네이비 톤) | `LawyerRole.tsx` |
| **Phase 1-3** | 헤더 영역 정돈 (역할 라벨 한글화, 모바일 검색 노출, 딥 네이비 단일 시맨틱) | `LawyerRole.tsx` |
| **Phase 1-4** | 모바일 하단 탭 & 메뉴 시트 (5대 탭, admin-scale 적용) | `LawyerRole.tsx` |
| **Phase 1-5** | 어드민 공통 부품 1차 구축 (`AdminPageHeader`, `ViewTabs`, `FilterBar`, `DataTable`, `StatusChip`, `MetricTile`, `ConfirmSheet`, `IconButton`, `AdminMoney`) | `src/components/ui/index.ts`, `src/components/ui/admin/*` |
| **Phase 1-6** | URL 상태 동기화 및 뒤로가기 복원 (`useAdminUrlSync`: `tab`, `caseId`, `stage` 양방향 URL 동기화 및 뒤로가기/새로고침 유지) | `src/hooks/useAdminUrlSync.ts`, `LawyerRole.tsx` |
| **Phase 1-7** | 용어 사전 1차 (Command Center -> 오늘의 업무 현황, Contract Operations -> 계약 현황, Fee Settlement Hub -> 수임료 수납, 골든타임 -> 서명 지연) | `LawyerRole.tsx`, `ContractManagementTab.tsx`, `FeeSettlementTab.tsx`, `ContractReminderModal.tsx` |
| **Phase 1-8** | 퀵툴 화면 톤 개선 (라이트 메뉴·창, 기본 접힘 'minimized' 모드 시작, 12px 하한, 무한 pulse 제거, `--dock-safe-area` 연동) | `LegalQuickDock.tsx`, `FloatingToolWindow.tsx` |
| **검증 완료** | TypeScript 에러 수: **229개 → 190개 (39개 감소)**, 신규 에러 0건, `npm run build` **15.81초 성공** | 전 영역 |

## 다음 작업 (Phase 2: 수임 여정 연결)

1. **Phase 2-1: 사건 워크스페이스 골격 구축**
   - 라이트 헤더(단일 주 버튼 `다음: ...`), `JourneyRail` (6단계 여정), `StageHeader`, `SectionTabs`, `ContextPanel` (의뢰인·소통·메모 3개 탭 통합)
2. **Phase 2-2: 서브탭 16개 재배치 & 13단계 바 타임라인화**
   - 파이프라인/서브탭 2중 모드 제거, 13단계 바는 4~6단계 세부 절차 읽기 전용 타임라인으로 정돈
3. **Phase 2-3: 단계 완료 시트(ConfirmSheet) 및 자동 준비 연동**
4. **Phase 2-4 ~ 2-5: 1단계(상담·제안) 및 2단계(수임계약 단일화)**

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
