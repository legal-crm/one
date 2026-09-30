# [기획서] 마이김변 추가 기능 작업 기획서

> **문서 버전**: v1.2
> **작성일**: 2026-09-29 (v1.1·v1.2 같은 날 개정)
> **근거**: 의뢰인·변호사·관리자 코드와 `docs/LAUNCH_READINESS_CHECKLIST.md` 대조 분석 (코드 읽기 기준, 운영 DB·배포 환경 동작은 미확인)
> **행 번호**: 작성 시점 기준 대략의 위치(±5행)

---

## 0. 운영 원칙: 수익 구조

모든 기능은 아래 원칙을 전제로 설계한다.

| 구분 | 돈의 흐름 | 플랫폼 역할 |
|:---|:---|:---|
| 광고비 | 변호사 → 플랫폼 | 수납, 세금계산서 발행. **플랫폼의 유일한 수익** |
| 수임료 | 의뢰인 → 변호사(사무소) | 금액·일정·납부 상태 표시와 안내만 한다. 돈을 받거나 보관·정산하지 않는다 |

- 플랫폼 계좌·PG·가상계좌·에스크로로 수임료를 받지 않는다.
- 수임료 금액, 수임 건수, 사건 결과와 연동된 수수료를 받지 않는다 (변호사법 제34조, `ClientFooter.tsx` 고지와 동일).
- 수임료 영수증·현금영수증·계산서의 발행 주체는 사무소다.
- 광고비는 정액 상품(`src/data.ts` `adProducts`)으로만 판매한다.

### 원칙과 맞지 않는 현재 코드: 삭제 확정 (2026-09-29)

CRM 구독료를 받지 않으므로 요금제 화면과 추정 구독료 표시를 **삭제한다**. 매칭 건수에 따른 금액 표시는 알선 대가로 오해받을 수 있어 남겨 두지 않는다. 관리자 매출 화면은 광고비 실적만 표시한다.

| 파일 | 삭제 대상 |
|:---|:---|
| `src/data.ts` | `platformPlans` 상수 (1522행 부근) |
| `src/components/LawyerRole.tsx` | 빌링 `status` 탭의 "SaaS CRM 요금제" 카드 3종과 "요금제 도입 문의" 버튼 (4914행 부근), 대시보드 요금제 카드 (3412행 부근), `platformPlans` import |
| `src/components/AdminRole.tsx` | `activeMRR`·`lostMRR`·`estimateMRR` 계산 (810~830행 부근), 과금 `active`("구독료 추정 명세")·`exited` 서브탭과 탭 버튼, 변호사 심사 상세의 "요금제" 안내 박스 (2379행 부근), `platformPlans` import |
| `src/components/admin/BillingOverviewDashboard.tsx` | "구독료 (추정)" 카드 (296행 부근), `activeMRR`·`lostMRR` props, 상단 설명 문구의 구독료 언급 (217행) |
| `src/components/admin/PlatformDashboard.tsx` | "예상 구독료 (추정)" 카드 (341행 부근), `estimateMRR` prop, 헤더 주석의 구독료 언급 |

**완료 기준**: `platformPlans`·`MRR`·"구독료"·"요금제" 검색 결과가 0건(광고 상품 관련 제외)이고, 관리자 과금 화면의 매출은 광고 주문 입금 기록만으로 계산된다.

> ✅ **완료 (2026-09-29)**
> - 위 파일에서 요금제 카드·추정 구독료 계산·`active`/`exited` 서브탭·요금제 안내 박스를 삭제했다. 남은 검색 결과는 삭제 이력 주석, 프리랜서 경비 항목(구독료), 팝빌 요금제 안내뿐이다.
> - 빈자리는 실제 광고 주문 데이터로 채웠다: 변호사 대시보드 "입금 대기·30일 내 만료", 관리자 매출 "활성 광고 월 환산", 관리자 대시보드 "노출 중 광고".
> - 같은 화면에 있던 가짜 값도 지웠다: "다음 결제 예정일: 2026년 07월 25일 (월 800,000 원)", "SaaS 구독 80만", "Active · 정상 운영 중" 배지.
> - 메뉴 이름: "요금제 / 빌링" → "광고 / 빌링", 서브탭 "구독 현황" → "광고 현황".
> - 검증: `tsc` 오류 229건으로 기준선과 같음(신규 0건), `vite build` 통과.

---

## 1. 선행 조건 (출시 차단 항목)

새 기능이 아니라 아래 기능들의 전제다. 상세는 `LAUNCH_READINESS_CHECKLIST.md` PART 5.

- **G1** 마이그레이션 021~026 실행과 남은 전체 허용 정책 정리
- **G3** `PORTONE_API_SECRET` 운영 등록 (전자계약 본인인증)
- **G5** 알림톡 템플릿 검수 승인과 `ALIMTOK_TEMPLATE_CODES` 설정. 카카오로 나가는 모든 자동 안내의 전제
- **Turnstile 키** 운영 등록 (비로그인 문의·OCR·알림)

---

## 2. 기능 목록 요약

| # | 기능 | 영역 | 난이도 | 선행 |
|:---:|:---|:---|:---:|:---|
| 1 | 서버 예약 발송 엔진 | 공통 | 중 | G5 (카카오 발송 시) |
| 2 | 의뢰인 알림 서버화 + 웹 푸시(PWA) | 의뢰인 | 중 | 없음 |
| 3 | 회생 동행·납부 기록 서버 동기화 | 의뢰인 | 중 | 없음 |
| 4 | **수임료 직접 납부 지원 (플랫폼 비경유)** | 의뢰인·변호사 | 하~중 | A: 없음 / B: 1번 |
| 5 | 필수 서류 체크리스트 + 미제출 자동 안내 | 의뢰인·변호사 | 하~중 | 1번 |
| 6 | 비공개 만족도 수집 | 플랫폼 | 하 | 없음 |
| 7 | 신고·분쟁 접수 | 플랫폼 | 중 | 없음 |
| 8 | 보정명령 OCR → 기한·일정 자동 등록 | 변호사 | 중 | 1번 |
| 9 | CRM 다중 필터·저장된 보기·일괄 작업 | 변호사 | 중 | 없음 |
| 10 | 변제 이행 모니터링 (Stage 6) | 변호사 | 중 | 3번 |
| 11 | 사무소 경영 리포트 | 변호사 | 중 | 없음 |
| 12 | 광고 상품 자동화 + 성과 리포트 | 플랫폼 | 중 | 1번 |
| 13 | 퍼널 분석·오류 모니터링 | 플랫폼 | 하 | 없음 |

---

## 3. 기능별 상세

### 1. 서버 예약 발송 엔진

**근거**
- 수임료 D-3·D-day·D+1·D+3 발송 규칙이 `alimtokService.ts` 188~224행에 정의돼 있지만 실행하는 코드가 없다. 설정 화면도 "자동 발송 규칙 사용 (준비 중)"이다 (`FeeNotificationSettingsModal.tsx` 64행).
- 캘린더 리마인더는 저장만 된다 (`calendarEventService.ts` `REMINDER_DELIVERY_SUPPORTED = false`).
- `vercel.json` cron은 마케팅 초안 생성 1개뿐이다. Vercel Hobby는 cron을 **하루 1회**만 허용하므로 시간 단위 발송은 Vercel cron으로 만들 수 없다 (6장).
- 광고 주문을 `expired`로 바꾸는 코드가 없다 (DB CHECK 제약에만 존재).

**내용** (6장 배치 원칙 적용, Vercel 함수 추가 없음)
- **스케줄**: Supabase Cron(`pg_cron`)으로 매시간 실행한다.
- **대상 선정**: SQL 함수가 수임료 납부 안내, 보정 기한(D-7/D-3/D-1), 캘린더 리마인더 대상을 골라 `notification_queue` 테이블에 넣는다.
- **발송**: `pg_net`이 통합 함수(`api/popbill.js` 카카오, `api/notify.js` 푸시·이메일)를 `CRON_SECRET`으로 호출해 큐를 처리한다.
- **DB만 바꾸는 작업**(광고 `active` → `expired` 전환 등)은 SQL로 끝낸다.
- 발송 이력(큐 상태)으로 같은 대상·같은 규칙 중복 발송을 막는다.

**완료 기준**: 설정한 규칙대로 발송되고, 같은 회차에 같은 안내가 두 번 나가지 않는다.

---

### 2. 의뢰인 알림 서버화 + 웹 푸시(PWA)

**근거**
- `clientNotificationService.ts`는 localStorage 전용이다. 변호사 화면 10여 곳이 `addClientNotification`을 호출하지만, 알림은 변호사 브라우저에 저장되고 의뢰인에게 가지 않는다.
- 서비스 워커·매니페스트가 없다. 상담 동기화는 5초 폴링(`App.tsx`)이라 탭을 닫으면 답변 도착을 알 수 없다.

**내용**
- `client_notifications` 테이블 (RLS: 수신자 본인만 조회, 담당 변호사·직원만 생성).
- 서비스 워커 + Web Push 구독. 연락처를 공개하기 전의 익명 의뢰인에게도 알릴 수 있는 채널이다. 푸시 발송(VAPID 비밀키)은 통합 함수 `api/notify.js?channel=push`에서 처리하고, `client_notifications` INSERT 시 `pg_net`으로 호출한다.
- 상담·메시지 동기화를 Supabase Realtime으로 전환하고, 탭이 숨겨지면 폴링을 멈춘다. Supabase 무료 한도(egress) 관리에도 필요하다 (6장).

**완료 기준**: 변호사가 보낸 알림이 의뢰인의 다른 기기에서도 보이고, 탭을 닫은 상태에서 푸시가 도착한다.

---

### 3. 회생 동행·납부 기록 서버 동기화

**근거**
- 동행 사건, 회차별 변제금 납부, 영수증(base64)이 모두 localStorage에 있다 (`companionService.ts`).
- 의뢰인 화면은 CRM 데이터를 `getCrmClientSync`(`crmService.ts` 51행)로 로컬에서만 읽는다. 011 RLS상 의뢰인은 본인 `crm_clients` 행을 조회할 수 있으므로 서버 조회로 바꿀 수 있다.

**내용**
- 동행 사건·회차 테이블, 영수증은 Supabase Storage.
- 의뢰인 로그인 시 본인 `crm_clients` 행을 서버에서 조회해 사건번호·가상계좌·분납표를 표시한다.

**완료 기준**: 새 기기에서 로그인해도 사건 정보와 납부 기록이 그대로 보이고, 담당 변호사가 의뢰인의 변제금 납부 기록을 볼 수 있다.

---

### 4. 수임료 직접 납부 지원 (의뢰인 → 변호사, 플랫폼 비경유)

> 운영 원칙(0장)에 따라 플랫폼은 수임료를 받지 않는다. 이 기능은 의뢰인이 **사무소 계좌·사무소 결제 수단으로 직접** 납부하도록 정보를 정확히 보여주고, 납부 확인을 편하게 만드는 것이 목적이다.

#### 배경
- 수임 계약서에는 이미 사무소 입금계좌(`feeAccount`)가 들어간다 (`ContractWizard.tsx` 94행). 원격 서명 화면에도 표시된다 (`ClientRemoteSignView.tsx` 643행).
- 그런데 마이페이지는 계좌를 계약서가 아니라 사무소 알림 설정(`loadFeeNotificationSettings`, localStorage)에서 읽는다 (`MyPageView.tsx` 120행). 이 설정은 사무소 브라우저에만 있어서 의뢰인 화면에서는 보통 비어 있다 (3161행 주석).
- 마이페이지의 계약서도 `loadContractsLocal()`, 즉 이 기기의 localStorage에서 찾는다 (161행). 다른 기기에서는 계약 정보가 없다.
- 의뢰인이 입금 사실을 알릴 방법이 없다. 변호사는 통장을 보고 `FeeSettlementTab`에서 회차마다 수동으로 입금 처리한다 (`handleMarkAsPaid`).
- **보안 문제**: 011 RLS의 `anti_bola_modify_crm_clients`는 의뢰인 본인(`auth.uid() = client_id`)에게 자기 `crm_clients` 행 전체의 수정을 허용한다. 의뢰인 브라우저가 `fee_schedule`·`total_paid`·`crm_status`를 직접 바꿀 수 있는 구조다. 입금 신고 기능보다 먼저 막아야 한다.

#### 범위에서 제외
- 플랫폼 PG·가상계좌·에스크로를 통한 수임료 수납, 대납, 정산
- 플랫폼 명의의 수임료 영수증 발행
- 수임료와 연동된 플랫폼 수수료

#### Phase A: 납부 정보 정확히 보여주기 + 입금 신고 (선행 없음)

**A1. 계약서 기준 입금계좌 표시**
- 마이페이지 계좌 출처를 `clientContract.feeAccount`로 바꾼다. 사무소 알림 설정의 계좌는 새 계약서를 만들 때 기본값으로만 쓴다. 계좌 정보의 기준은 서명된 계약서 하나로 둔다.
- 의뢰인 로그인 시 본인 계약서를 서버(`electronic_contracts`)에서 조회한다. 의뢰인 본인 조회 RLS가 있는지 확인 필요 (008 기준).
- 계좌 옆에 "계약서에 적힌 계좌" 표시와 "다른 계좌 안내를 받으면 사무소에 먼저 확인" 문구를 둔다.
- 같은 화면의 가짜 기본값 '법무법인 로앤 담당변호사'(3083행)를 없앤다.

**A2. 의뢰인 "입금했어요" 신고**
- 회차별 버튼으로 입금일, 금액, 입금자명, 이체 확인증(선택)을 입력한다.
- 신고해도 회차가 '납부 완료'로 바뀌지 않는다. `clientReport`만 기록하고 화면에는 "사무소 확인 대기"로 표시한다.
- 변호사 `FeeSettlementTab`에 "입금 확인 요청" 필터와 배지를 추가한다. 변호사가 확인하면 기존 `handleMarkAsPaid` 흐름으로 `paid` 처리되고, 반려하면 사유를 남긴다.
- 확인·반려 결과는 의뢰인에게 알린다 (2번 완료 전에는 상담 채팅의 시스템 메시지).

**A3. 의뢰인 쓰기 권한 제한 (보안, A2와 함께 배포)**
- `crm_clients`에서 의뢰인이 바꿀 수 있는 컬럼을 트리거로 제한한다. 수임료(`fee_schedule`, `total_fee`, `total_paid`, `contract_amount`), 진행 상태(`crm_status`), 담당자 컬럼은 변호사·직원만 수정할 수 있게 한다.
- 입금 신고는 전용 RPC `client_report_fee_payment(p_client_id, p_installment_id, p_paid_date, p_amount, p_depositor, p_proof_file_id)`로만 받는다. RPC는 본인 행, 존재하는 회차, 미납 상태만 허용한다.
- 의뢰인 쪽 기존 저장 경로(`submitClientDocument` 등)는 `saveCrmClient`로 행 전체를 upsert한다. 트리거 적용 후에도 서류 제출이 동작하는지 확인하고, 필요하면 서류 제출도 RPC로 옮긴다.

#### Phase B: 납부 안내 자동화 (1번 엔진 필요)
- 기존 규칙(D-3 10:00, D-day 09:30, D+1 11:00, D+3 14:00)을 서버에서 실행한다.
- 발송 명의는 사무소, 안내 계좌는 계약서 `feeAccount`. 계좌가 없으면 발송하지 않는 현재 규칙(`alimtokService.ts` 287행)을 유지한다.
- 템플릿 `MYKIM_ATS_12`~`14` 검수 승인이 필요하다 (G5).
- 의뢰인이 입금 신고한 회차는 연체 안내에서 뺀다.

#### Phase C (선택): 사무소 결제 링크 연결
- 사무소가 자기 PG·간편결제에서 발급한 결제 링크를 회차별로 등록하면, 의뢰인 화면에 "사무소 결제 페이지로 이동" 버튼을 보여준다. 결제는 사무소 가맹점에서 일어나고 플랫폼은 링크만 보여준다.
- 사칭 방지: https만 허용, 등록 가능한 결제 도메인 허용 목록, 링크를 바꾸면 의뢰인에게 알림.
- 결제 결과 자동 반영(웹훅)은 플랫폼이 사무소 PG 비밀키를 보관해야 하므로 보류한다. 필요해지면 `010_lawyer_smtp_credentials`처럼 암호화 보관 방식으로 따로 설계한다.
- 현금영수증·계산서는 사무소 명의로 발행한다. 플랫폼이 발행을 돕는다면 팝빌 연동회원(사무소 사업자번호) 방식을 검토한다.

#### 데이터 변경

```ts
// src/types.ts: FeeInstallment 추가 필드
clientReport?: {
  reportedAt: string;       // 신고 시각 (ISO)
  paidDate: string;         // 의뢰인이 입력한 입금일 (YYYY-MM-DD)
  amount: number;           // 원 단위
  depositorName?: string;
  proofFileId?: string;     // uploaded_files의 파일 ID
  status: 'pending_review' | 'confirmed' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
};
paymentLinkUrl?: string;    // Phase C
```

기존 `status`('pending' | 'paid' | 'overdue')는 그대로 둔다. 연체 판정과 정산 집계 코드를 바꾸지 않기 위해서다.

#### 변경 파일 (예상)

| 파일 | 변경 |
|:---|:---|
| `src/components/client/MyPageView.tsx` | 계좌 출처 변경, 입금 신고 UI, 가짜 기본값 제거 |
| `src/services/contractService.ts` | 의뢰인 본인 계약서 서버 조회 |
| `src/services/crmService.ts` | 입금 신고 RPC 호출 함수 |
| `src/types.ts` | `FeeInstallment.clientReport`, `paymentLinkUrl` |
| `src/components/lawyer/FeeSettlementTab.tsx` | "입금 확인 요청" 필터·배지, 확인·반려 처리 |
| `src/services/alimtokService.ts`, `FeeNotificationSettingsModal.tsx` | 계좌 설정을 "새 계약서 기본값"으로 명시 |
| `supabase/migrations/030_fee_payment_report.sql` (신규) | 의뢰인 컬럼 수정 제한 트리거, `client_report_fee_payment` RPC |

Supabase RPC로 처리하므로 Vercel 함수는 늘지 않는다.

#### 완료 기준
- 다른 기기에서 로그인한 의뢰인도 계약서에 적힌 계좌와 분납표를 볼 수 있다.
- 의뢰인이 입금 신고를 해도 회차 상태는 바뀌지 않고, 변호사가 확인해야 `paid`가 된다.
- 의뢰인 세션으로 `crm_clients.fee_schedule`을 직접 update하면 거부된다.
- 수임료가 플랫폼 계좌·PG로 들어오는 경로가 코드에 없다.

---

### 5. 필수 서류 체크리스트 + 미제출 자동 안내

**근거**
- 서류 완료 게이트가 "업로드 파일 3개 이상"이다 (`pipelineGates.ts` 46행).
- `documentRequests`·`submitClientDocument`는 있지만 미제출 서류를 다시 안내하는 기능이 없다.
- 1차 서류 허브(`MobileApplicationDocHubModal`)는 의뢰인 진입점이 없다.

**내용**
- 사건 유형별 필수 서류 목록 기준 진행률을 의뢰인·변호사 화면에 표시한다.
- 미제출 항목을 일정 간격으로 자동 안내한다 (1번 엔진).
- 게이트를 "필수 서류 제출·검토 완료" 기준으로 바꾼다.

---

### 6. 비공개 만족도 수집

**근거**: 후기는 관리자가 등록하는 CMS 콘텐츠뿐이다. `PlatformDashboard.tsx` 주석에도 "만족도는 수집 기능 없음"으로 적혀 있다.

**내용**
- 제안서 수신, 계약 체결, 면책 시점에 짧은 설문.
- 결과는 관리자 품질 지표(응답 속도·응답률과 함께)로만 쓴다.
- 공개 후기·평점은 변호사 광고 규정상 제한될 수 있어 별도 법무 검토 후 결정한다.

---

### 7. 신고·분쟁 접수

**근거**: 일반 1:1 문의(`api/inquiry.js`)만 있다. 변호사·브로커 신고, 과다 청구 이의 같은 흐름이 없다.

**내용**
- 상담 건에 연결된 신고 접수, 관리자 처리 상태 관리.
- 같은 변호사에 대한 반복 신고 시 디렉토리 노출을 보류하고 관리자에게 알린다.

---

### 8. 보정명령 OCR → 기한·일정 자동 등록

**근거**
- 법원 문서 OCR(`api/ocr-case.js`)은 있지만 보정센터와 `crmExt.correctionOrders`가 연결돼 있지 않다.
- Stage 5에 송달일 필드가 없어 "송달일 + 14일" 같은 기한을 자동 계산하지 못한다. 즉시항고 기한에 공휴일이 반영되지 않는다 (체크리스트 2-6, 2-11).

**내용**
- 보정명령 PDF 업로드 → 송달일·기한·보정사항 추출 → 보정 건, 캘린더 일정, 리마인더를 함께 만든다.
- 추출값은 변호사가 확인한 뒤 저장한다. 공휴일 테이블 반영.
- OCR은 통합 함수 `api/ocr.js`에 `kind=correction` 라우트로 추가한다 (6-2).

---

### 9. CRM 다중 필터·저장된 보기·일괄 작업

**근거**
- 사건유형·법원·서류 미제출·수임료 연체·보정 마감 필터가 없다 (체크리스트 2-3 ❌).
- 수임료 일괄 알림톡은 "일괄 발송은 지원하지 않습니다" 안내만 나온다 (`FeeSettlementTab.tsx` `handleBulkAlimtok`).

**내용**: 조건 조합 필터 저장, 선택 건에 대한 일괄 알림·담당자 변경·상태 변경.

---

### 10. 변제 이행 모니터링 (Stage 6)

**근거**
- Stage 6에 36회차 추적, 연속 미납 경보, 면책(제624조) 안내가 없다 (체크리스트 2-6).
- 동행 대시보드의 미납 판정(`getEffectiveRoundStatus`)은 화면을 열 때만 계산된다.

**내용**
- 3번 동기화 데이터로 미납 회차를 자동 감지해 담당 변호사에게 알린다.
- 생활위기 SOS를 변제계획 변경 신청 초안과 연결한다.

---

### 11. 사무소 경영 리포트

**근거**
- 대시보드가 서버 대신 `localStorage('legal_crm_data')`를 직접 읽는다 (`LawyerRole.tsx` 3641행 부근).
- 수임 전환율이 개시·변제·면책 단계 건을 빼고 계산된다 (2988행 부근).
- 월별 수임·수금, 단계별 체류 기간, 담당자별 처리량 리포트가 없다.

**내용**
- 서버 데이터(`loadCrmData`) 기준으로 월별 수임·수금, 유입 채널별 전환, 단계별 병목, 담당자별 처리량.
- 전환율 산식 수정은 먼저 따로 반영할 수 있는 작은 작업이다.
- 영업 리드가 평문 localStorage에만 저장되는 문제(`leadService.ts` 206행)는 출시 전 필수 수정이다. 서버로 옮기면서 리드 → 상담 → 수임 퍼널을 함께 만든다.

---

### 12. 광고 상품 자동화 + 성과 리포트

> 광고비는 플랫폼의 유일한 수익이므로, 플랫폼 결제 연동 대상은 광고비뿐이다.

**근거**
- 광고비는 계좌이체 후 관리자가 통장을 보고 수동으로 대조한다 (`AdminRole.tsx` 입금 확인 모달).
- 만료 처리가 없고, 광고 노출·클릭 집계가 없다.

**내용**
- 광고비 카드 결제(포트원) 또는 가상계좌 자동 입금 확인. 세금계산서는 기존 팝빌 발행 흐름 재사용.
- 포트원 결제 결과 웹훅은 포트원 서버 검증 로직이 이미 있는 `api/contract.js`에 `action=portone-webhook`으로 추가한다 (함수 추가 없음).
- 만료 7일 전 갱신 안내, 만료일 자동 `expired` 전환 (1번 엔진, SQL만으로 처리).
- 변호사용 리포트: 노출, 프로필 조회, 상담 요청 수.
- 가격은 정액을 유지한다. 노출·클릭·상담 건수에 따른 과금은 하지 않는다.

---

### 13. 퍼널 분석·오류 모니터링

**근거**
- Sentry·GA 등 분석·오류 추적 도구가 없다. 대시보드에 방문자 수가 "분석 도구 미연동"으로 표기된다.
- 테스트 프레임워크가 없고, CI(`.github/workflows/deploy.yml`)는 운영(Vercel)이 아닌 GitHub Pages로 배포한다.

**내용**
- 개인정보 없이 이벤트만 수집하는 분석: 진단 시작 → 진단 완료 → 변호사 선택 → 제안 수신 → 계약.
- 개인정보를 가린 오류 추적. CI에 `tsc`와 빌드 검사 추가.
- 브라우저에서 외부 서비스로 직접 보내므로 서버 함수가 필요 없다. 각 서비스의 무료 플랜 한도 안에서 쓴다.

---

## 4. 진행 순서

| 단계 | 항목 | 이유 |
|:---:|:---|:---|
| 1 | 출시 차단 항목, 0장 삭제 작업, **4-A (A1~A3)**, 11번 전환율 산식, **6-2 함수 통합 (12 → 8)** | 작고 바로 할 수 있음. A3는 보안 문제. 함수 통합으로 새 기능을 둘 여유 확보 |
| 2 | **6-4 Supabase 한도 대응** (파일 Storage 분리, 필요한 컬럼만 조회), 1, 2, 3 | 무료 한도 안에서 운영하기 위한 전제이자 나머지 기능의 전제 |
| 3 | 4-B, 5, 8, 10 | 1~3번 위에서 동작하는 자동화 |
| 4 | 9, 11, 12, 13, 6, 7 | 운영 효율·수익·품질 |
| 결정 | **6-5 호스팅 방안 (A/B/C)** | 광고 매출이 생기는 정식 출시 전에 결정 |
| 선택 | 4-C | 사무소 수요 확인 후 |

---

## 5. 구현 제약

- **서버 인프라 무료 유지**: 6장 방안을 따른다. 새 기능 때문에 Vercel 함수를 늘리지 않는다.
- **알림톡**: 승인된 템플릿 코드는 1개뿐이다. 자동 안내 기능은 템플릿 승인 일정에 맞춰 연다.
- **법무 검토 필요**: 공개 후기·평점(6번).
- **문구**: 새 화면 문구는 `.agents/AGENTS.md` Rule 4(과장·단정 표현 금지)를 따른다.

---

## 6. 무료 인프라 유지 방안

> 2026-09-29 각 서비스 공식 문서 기준(출처는 6-6). 무료 한도는 바뀔 수 있으므로 적용 시점에 다시 확인한다.

### 6-1. 현재 무료 플랜 제약

| 서비스 | 무료 한도 | 마이김변 영향 |
|:---|:---|:---|
| Vercel Hobby | 프레임워크 없이 `api/`를 쓰면 배포당 함수 12개. cron은 하루 1회만(더 잦은 식은 배포 실패). 함수 최대 300초. 월 호출 100만 회, Active CPU 4시간 | `api/`가 12개로 한도에 도달. 시간 단위 예약 발송을 Vercel cron으로 만들 수 없음 |
| Vercel Hobby 약관 | 비상업·개인 용도로 한정 | 6-5 참고 |
| Supabase Free | DB 500MB, 파일 1GB, egress 월 5GB, Edge Functions 월 50만 회(요청당 CPU 2초, 최대 150초), 7일 비활성 시 일시정지. Cron(`pg_cron`)·`pg_net` 사용 가능 | 지금 구조로는 DB·egress 한도가 먼저 찬다 (6-4) |
| Cloudflare Workers Free | 하루 10만 요청, 요청당 CPU 10ms, cron 트리거 계정당 5개 | OCR·PDF처럼 CPU를 쓰는 API에는 맞지 않음 |

### 6-2. 1단계: Vercel Hobby 안에서 함수 통합 (12개 → 8개)

> ✅ **완료 (2026-09-29)**
> - `api/` 함수 파일 8개: `benefits`, `codef`, `contract`, `generate-statement`, `inquiry`, `notify`, `ocr`, `popbill`.
> - 통합 전 핸들러 8개는 `api/_lib/routes/`로 옮겼다(`git mv`, 코드 변경은 import 경로뿐). `_lib` 아래 파일은 함수로 세지 않는다.
> - 라우터 `api/_lib/route-dispatch.js`: 쿼리 파라미터 → 원래 경로 순으로 라우트를 정하고, 핸들러에는 통합 전 경로를 넘긴다. rate limit 키(ip + 경로)와 invoice·alimtok의 액션 판별이 API별로 그대로 유지된다.
> - `telegram`의 CORS import를 `cors-helper.js`로 바꿔 알림 함수 번들에서 팝빌 SDK를 뺐다.
> - 검증: 라우팅 스모크 테스트 16건 통과. 이 중 8건은 통합 함수 8개 경로가 실제 핸들러까지 도달해 각자의 인증 오류(401·403)로 응답하는지 확인했다. `node --check` 전 파일 통과, `tsc` 신규 오류 0건, `vite build` 통과.
> - ✅ 운영 확인 (2026-09-29, 커밋 `e1643b3`, https://mykim.kr): 옮긴 URL 8개가 모두 원래 핸들러의 인증 오류(401·403)로 응답했고, 잘못된 라우트는 라우터 404로 응답했다. 그대로 둔 4개(`benefits`·`contract`·`generate-statement`·`inquiry`)도 정상 응답했다. 인증이 필요한 실제 기능(발송·OCR·조회)은 로그인한 상태로 한 번씩 써 보는 확인이 남았다.
> - ⚠️ 기존 문제(통합과 무관): `send-email`이 `nodemailer`를 동적으로 import하지만 `package.json`에 없어 이메일 발송이 런타임에 실패한다.

의존성이 같은 파일끼리 합친다. 기존 URL은 `vercel.json` rewrites로 유지해 **클라이언트 코드는 바꾸지 않는다**.

| 통합 함수 | 합칠 파일 | 공통점 | 기존 URL 유지 (rewrites) |
|:---|:---|:---|:---|
| `api/popbill.js` | `alimtok.js`, `invoice.js` | 팝빌 SDK (`_lib/popbill-service.js`) | `/api/alimtok` → `/api/popbill?service=kakao`, `/api/invoice/:action*` → `/api/popbill?service=invoice&action=:action*` |
| `api/ocr.js` | `ocr-case.js`, `ocr-family.js` | Gemini Vision, 같은 인증·Turnstile·rate limit | `/api/ocr-case` → `/api/ocr?kind=case`, `/api/ocr-family` → `/api/ocr?kind=family` (본문에서 이미 `mode`를 쓰므로 라우트 파라미터는 `kind`) |
| `api/notify.js` | `telegram.js`, `send-email.js` | 관리자·사무소 알림 발송 (이후 웹 푸시 추가) | `/api/telegram` → `/api/notify?channel=telegram`, `/api/send-email` → `/api/notify?channel=email` |
| `api/codef.js` | `scourt-proxy.js`, `debt-discovery.js` | CODEF 토큰 캐시 | `/api/scourt-proxy` → `/api/codef?product=scourt`, `/api/debt-discovery` → `/api/codef?product=debt` |

그대로 두는 파일: `benefits.js`, `contract.js`, `generate-statement.js`, `inquiry.js`. 합계 8개, 여유 4개.

주의
- `telegram.js`는 CORS 헬퍼를 `popbill-service.js`에서 가져와서 팝빌 SDK까지 번들에 들어간다. 통합하면서 `_lib/cors-helper.js`로 바꾼다.
- `debt-discovery.js`는 실연동이 없어 항상 시연 데이터를 돌려준다. 출시 범위에서 빼기로 하면 통합하지 말고 삭제한다 (여유 5개).
- rewrites는 위에서부터 적용되므로 구체적인 경로를 기존 `/api/(.*)` 규칙보다 위에 둔다. 배포 후 기존 12개 경로를 각각 호출해 응답을 확인한다.
- 모든 API를 함수 1개(catch-all 라우터)로 합치는 방법도 있지만, 모든 경로가 번들 크기·콜드스타트·`maxDuration` 설정을 함께 쓰게 되므로 권하지 않는다.

### 6-3. 새 서버 기능 배치 원칙 (Vercel 함수를 늘리지 않는다)

| 필요한 처리 | 배치 위치 | 해당 기능 |
|:---|:---|:---|
| 예약 실행 | Supabase Cron(`pg_cron`) 매시간. Vercel cron(하루 1회)은 기존 마케팅 작업만 유지 | 1, 5, 8, 10, 12 |
| DB 상태 변경 | SQL 함수·트리거·RPC (광고 만료, 입금 신고, 신고 접수, 권한 제한 등) | 4-A, 6, 7, 12 |
| 카카오·문자 발송 | `pg_net` → `api/popbill.js` (`CRON_SECRET` 검증) | 1, 4-B, 5 |
| 웹 푸시·이메일·텔레그램 | `pg_net` → `api/notify.js` | 1, 2 |
| OCR | `api/ocr.js`에 `kind` 라우트 추가 | 8 |
| 광고비 결제 결과 | `api/contract.js?action=portone-webhook` | 12 |
| 실시간 갱신 | Supabase Realtime | 2 |
| 조회·집계 | SQL view·RPC | 9, 11 |
| 분석·오류 추적 | 브라우저에서 외부 서비스로 직접 전송 | 13 |

매시간 cron이 Vercel 함수를 호출해도 월 720회라 호출 한도(월 100만 회)에 영향이 거의 없다.

### 6-4. Supabase 무료 한도 안에서 운영하기 (필수 작업)

지금 구조로는 기능을 늘리기 전에 DB 용량과 전송량(egress) 한도가 먼저 찬다.

| 문제 | 근거 | 조치 |
|:---|:---|:---|
| 서류 파일 본문이 DB에 들어감 | `DocumentFile.dataUrl`(base64)이 `crm_clients.uploaded_files`(jsonb)에 저장된다. 파일당 최대 15MB(`fileSecurity.ts`) | 파일은 Storage 비공개 버킷으로 옮기고 DB에는 경로만 둔다. 열람은 서명 URL |
| 전체 행·전체 컬럼 조회 | `loadCrmData`가 `crm_clients`를 `select('*')`로 읽어 파일 본문까지 매번 내려받는다 | 목록은 필요한 컬럼만 조회하고, 파일은 열 때만 내려받는다 |
| 5초 폴링 | `App.tsx`가 열린 탭마다 상담·메시지를 5초마다 조회한다. 탭 하나가 8시간 열려 있으면 하루 5,760회 | Realtime 전환(2번), 숨은 탭에서는 폴링 중지 |
| 영수증 base64 | 동행 영수증이 base64로 저장된다 (`companionService.ts`) | 3번 서버 동기화 때 DB가 아닌 Storage에 저장 |
| 파일 저장소 1GB | 의뢰인 서류가 쌓이면 오래 버티기 어렵다 | 사용량 모니터링. 한도에 가까워지면 egress 과금이 없는 외부 저장소(Cloudflare R2 등, 무료 구간은 도입 시 확인)로 옮길지 결정 |

### 6-5. 상업 이용 제한 (결정 필요)

Vercel 공식 문서는 Hobby 플랜을 **비상업·개인 용도로만** 쓸 수 있다고 명시한다. 마이김변은 변호사에게 광고비를 받는 법인 서비스라 이 조건에 맞지 않을 가능성이 높다. 계정이 제한되면 사이트와 API가 함께 멈춘다. 함수 개수와 별개인 문제다.

| 방안 | 내용 | 비용 | 작업량·위험 |
|:---|:---|:---:|:---|
| A. Vercel Hobby 유지 | 6-2~6-4만 적용 | 0원 | 작음. 약관 위험은 그대로 남음 |
| B. 무료 조합으로 이전 | 정적 사이트 → Cloudflare Pages (`vercel.json`의 헤더·리다이렉트·rewrites를 `_headers`·`_redirects`로 이전. 헤더 규칙 100개, 리다이렉트 2,100개, 파일 2만 개·파일당 25MiB 한도). API 8개 → Supabase Edge Functions(Deno). cron → `pg_cron` | 0원 | 중~상. 팝빌 Node SDK의 Deno 호환 확인 필요. 인프라 대부분이 Supabase 한 곳에 몰림. 각 서비스 무료 플랜의 상업 이용 조건은 이전 전 약관으로 확인 |
| C. 유료 전환 (참고) | Vercel Pro | 개발자 1인 월 $20 | 작음 |

- Cloudflare Pages Functions(Workers 무료)로 API를 옮기는 방법은 요청당 CPU 10ms 제한 때문에 OCR·PDF·서명 검증 API에 맞지 않아 B에서 제외했다.
- **권장**: 지금은 A로 6-2~6-4를 진행한다. 6-2에서 합친 함수 구조는 B로 옮길 때도 그대로 쓸 수 있다. 광고 매출이 생기는 정식 출시 전에 B와 C 중 하나를 정한다.

### 6-6. 출처 (2026-09-29 확인)

- [Vercel Functions 런타임: Hobby 함수 12개 한도](https://vercel.com/docs/functions/runtimes)
- [Vercel Cron 사용량·요금: Hobby는 하루 1회](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Hobby 플랜: 포함 사용량, 비상업·개인 용도 한정](https://vercel.com/docs/plans/hobby)
- [Supabase Edge Function 호출 한도: Free 월 50만 회](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)
- [Supabase Edge Function CPU 한도](https://supabase.com/docs/guides/troubleshooting/edge-function-cpu-limits)
- [Supabase 함수 예약 실행 (`pg_cron` + `pg_net`)](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase 무료 프로젝트 일시정지](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Cloudflare Pages 한도](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)
- Supabase DB 500MB·파일 1GB·egress 5GB는 공식 가격 페이지에서 직접 확인하지 못해 제3자 요약([makerkit](https://makerkit.dev/blog/saas/supabase-pricing), [jetadmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)) 기준이다. 적용 전 [Supabase 가격 페이지](https://supabase.com/pricing)에서 다시 확인한다.

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|:---:|:---:|:---|
| v1.0 | 2026-09-29 | 최초 작성. 4번을 운영 원칙(플랫폼은 광고비만 받고, 수임료는 의뢰인이 변호사에게 직접 납부)에 맞춰 "수임료 온라인 결제·분납"에서 "수임료 직접 납부 지원 (플랫폼 비경유)"으로 재설계. 난이도 상 → 하~중. 원칙과 맞지 않는 요금제·추정 구독료 화면을 정리 대상으로 추가 |
| v1.1 | 2026-09-29 | 0장: 요금제·추정 구독료 화면 **삭제 확정**, 파일별 삭제 범위와 완료 기준 명시. 6장 신설: 무료 인프라 유지 방안(함수 통합 12 → 8, 새 기능 배치 원칙, Supabase 무료 한도 대응, Hobby 상업 이용 제한과 호스팅 방안 A/B/C). 1·2·8·12·13번과 진행 순서·구현 제약을 6장 기준으로 수정 |
| v1.2 | 2026-09-29 | 0장 삭제 작업과 6-2 함수 통합 **구현 완료** 기록. OCR 라우트 파라미터를 `mode` → `kind`로 정정. `send-email`의 `nodemailer` 누락 발견 기록 |
