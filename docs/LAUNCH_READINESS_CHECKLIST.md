# 🚀 마이김변(MyKimLaw) 프로덕션 런칭 대비 종합 체크리스트
**Document Version:** 2.1.0 (Final)  
**Upgraded:** 2026-09-20 (전체 코드베이스 3개 리서치 에이전트 병렬 전수 분석 기반 최종 보강)  
**Target Release:** 2026 Production Launch  
**Category:** 종합 런칭 점검표 (고객 사이트 / 변호사 어드민 / 통합 어드민)  

---

## 📌 문서 개요

본 문서는 **마이김변(MyKimLaw) 회생·파산 법률 플랫폼**의 정식 서비스를 성공적으로 런칭하기 위해 코드베이스 전반의 **모든** 구현 기능, 서비스, API, 유틸리티, 비즈니스 워크플로우를 전수 점검할 수 있도록 구성된 실무형 종합 체크리스트입니다.

> **v2.1 변경사항**: 3개의 리서치 에이전트(서비스/API 52개, 클라이언트 32개, 변호사 어드민 150개+)를 통해 전수 분석 완료. v1.0 대비 **50개 이상의 누락 기능/서비스를 보강**, v2.0 대비 Lawyer Admin 16개 도메인 영역 정밀 상세화 반영.

---

# PART 1. 🙋‍♂️ [고객 사이트] Client Platform Checklist

---

### 1-1. 랜딩 페이지 및 신뢰성 브랜딩 UI (`ClientRole.tsx` → `activeTab === 'landing'`)

> **점검 메모 (2026-09-27)**: 실제 서비스 랜딩은 `ClientRole.tsx`에 인라인으로 렌더링됩니다. `src/components/client/LandingPage.tsx`(1,211라인)는 **어디에서도 import되지 않는 미사용 코드**이며, 다크 배경 `text-slate-600` 등 규칙 위반을 포함합니다. 삭제 또는 보관 여부 결정 필요.

- [x] **Hero 뷰포트 및 규율 준수**
  - 데스크톱 2줄 헤드라인(`<br />` 고정), 부제 17어절(20단어 이내, 모바일 숨김) ✅
  - 첫 화면 CTA("내 채무 상황 체크하기") 스크롤 없이 노출, 상단 패딩 `md:py-20` (≤ `pt-24`) ✅
  - CTA `whitespace-nowrap` · `min-h-[44px]` · `rounded-xl` · `active:scale` 적용 ✅ *(수정)*
  - ℹ️ CTA 문구 기준: "내 채무 상황 체크하기" / "익명으로 내 상황 체크하기" (결과·탕감률 단정 표현 사용 금지). 패럴랙스/메시 배경은 현 라이트 테마 Hero에 없음 (미사용 `LandingPage.tsx`에만 존재)
- [ ] **공감 케어 5대 카드 섹션** — ⚠️ 라이브 랜딩에 미구현 (미사용 `LandingPage.tsx`에만 존재)
  - 불법 추심 공포, 급여/통장 압류, 카드 돌려막기, 가족 피해, 고금리 사채 등 심리적 페인포인트 카드 노출
- [ ] **차별점 4열 그리드** — ⚠️ 부분 구현: Hero 우측 "안심 서비스 약속" 4항목(이용료 無, 스텔스 가명, 변호사 직접 지정, SSL/TLS). 제34조 정액 광고·수임료 정찰제·AI 7p 보고서 항목은 없음
  - 100% 익명 스텔스 가명, 변호사법 제34조 정액 광고형 매칭, 수임료 정찰제(최대 6회 무이자 분납), AI 7p 정밀 분석 보고서 무료 제공
- [ ] **전담 변호사 진행 안내 3종** — ⚠️ 랜딩 미구현
  - 선임한 변호사가 사건을 직접 수행, 법원 보정명령 기한 내 대응 절차 안내, 기각·중도 해지 시 환불 기준을 위임계약서에 사전 명시
  - ℹ️ 플랫폼은 환불·결과를 보증하지 않음. 환불 조건은 변호사별 계약(`Stage2ContractRetainerView` 특약)에 따름
  - ✅ `PremiumProposalReportModal`의 하드코딩 "기각 시 100% 환불 보증" 2곳 → "환불 기준 사전 명시"로 교체 *(수정)*
- [x] **4단계 이용안내 (`client/landing/ServiceGuideSection.tsx`)** *(개편)*
  - 익명 채무 체크 → 변호사 선택(최대 3명) → 답변 비교 → 1:1 가명 상담
  - 4개 지그재그 섹션 + 헤더 배너 → **스텝 탭 + 단일 Split 패널**로 통합 (Rule 3.2 해소, 랜딩 길이 대폭 축소)
  - WAI-ARIA Tabs 패턴(←/→/Home/End), 44px 탭 타겟, 탭 전환 시 레이아웃 점프 방지(min-height)
  - 모든 목업에 "화면 예시" 라벨 노출, 가짜 평점(★ 4.9)·사건 수(350건+) 제거, 변호사 답변 목업의 단정 표현 순화
  - 선택 한도를 `LAWYER_MAX_SELECTIONS` 상수로 `LawyersView`와 공유 (기존 목업 "최대 5명"은 실제 한도 3명과 불일치했음)
- [ ] **프리미엄 스폰서 변호사 쇼케이스 캐러셀** — ⚠️ 부분 구현: 랜덤 셔플 1장 슬라이드, AD 표기·유료광고 고지 ✅, CTA 44px/nowrap · 화살표 `aria-label` ✅ *(수정)*. 데이터가 `data.ts` mock `adBanners` 기반이며 500K 티어 필터·경력/유튜브 하이라이트 없음
  - 최고 등급 500K KRW 스폰서 변호사의 경력/성공사례/유튜브 채널 하이라이트
- [x] **소셜 프루프 무한 롤링 후기 (Infinite Marquee)**
  - 2벌 복제 seamless 루프, hover 일시정지 ✅
  - 🐛 별점이 `rev.rating`과 무관하게 항상 5개 표시되던 버그 수정, 스크린리더 라벨 추가 *(수정)*
  - ℹ️ 후기 카드에는 사건 유형 태그만 표시 (탕감률·감면액 등 결과 수치 뱃지는 사용하지 않음)
- [ ] **실시간 정보 섹션 동기화** — ⚠️ 부분 구현
  - ❌ 등록 변호사 프로필 목록 카드 및 지역/전문분야 필터 (`lawyers` 탭에만 존재)
  - ✅ 상담사례(Q&A) 아코디언 — 키보드 접근성(`role="button"`, Enter/Space, `aria-expanded`) 추가 *(수정)*
  - ✅ 법률 칼럼/뉴스 (`platformConfig.showLegalNews` 조건부) / ❌ 공지사항 목록 없음
  - ❌ 회생동행 오픈 배너 없음 (미사용 `LandingPage.tsx`에만 존재)
- [x] **8대 채무 위기 유형별 원클릭 솔루션 모달 (`RemedyModal.tsx`)**
  - ① 카드론·리볼빙, ② 은행·저축은행, ③ 대부업·사채, ④ 연대보증, ⑤ 주식·코인, ⑥ 일용직·프리랜서, ⑦ 급여·통장 압류, ⑧ 세금 체납 — `remedyData` 8종 확인 ✅
  - `handleApplyRemedy` → 프리셋이 진단 폼(Step 2)에 자동 바인딩 ✅
  - 아이콘 그리드 `div` → `button` 전환(키보드 포커스 링), 오해 소지 있던 eyebrow "STEP 1" 문구 교체 *(수정)*
  - ℹ️ `remedyDesc`/`guideDesc` 상세 안내 데이터가 모달에 렌더링되지 않음 (현재 CTA 2개만 표시)
- [ ] **5대 채무조정 솔루션 상세 모달 (`SolutionDetailModal.tsx`)** — ⚠️ 부분 구현
  - ✅ 5종 모달 동작, 요약 + 핵심 3포인트, "판단하지 않음" 고지
  - 🐛 개인회생 채무한도 오기재(무담보 5억/담보 10억) → **무담보 10억/담보 15억**으로 정정 *(수정)*
  - 🐛 진입 카테고리 라벨 맵 키 불일치(`personal_rehabilitation` 등 → 항상 영문 id 표시) → `SOLUTION_LABELS`로 정정 *(수정)*
  - ❌ 제도별 소요 기간·장단점 항목 없음
- [x] **법적 고지사항 및 변호사법 준수 (`Disclaimers.tsx` / `ClientFooter.tsx`)**
  - 변호사법 제34조 준수·광고비 정액제 고지 (푸터) ✅
  - 신용회복위원회(1600-5500), 대한법률구조공단(132) 푸터 상시 노출 + `tel:` 링크 추가 *(수정)*
  - 푸터 고지문 `text-slate-500` → `text-slate-400` (#111827 배경 WCAG AA 대비 확보) *(수정)*
  - FAQ "절대 알려지지 않습니다" 단정 표현 → 법원 송달 가능성 포함한 정확한 안내로 교체 *(수정)*

- [x] **Trust Facts Bar (`TrustFactsBar`)** *(교체)*
  - mock 수치("8,400+ 누적 이용자", "평균 47초") 제거 → 코드로 검증 가능한 사실만 표시: 상담 요청 단계 이용료 0원 / 변호사 최대 3명 동시 요청 / 계약 전 실명 불필요
  - `CompanyView.tsx` 통계("8,400+", "47초", "120+")도 동일 기준으로 교체 *(수정)*

> **보류**: 미사용 `src/components/client/LandingPage.tsx` 삭제/이관 여부는 추후 결정.

---

### 1-2. AI 간편 자가진단 & 상담 인테이크
> **점검 메모 (2026-09-27)**: 실제 진단 퍼널은 `rehab-chatbot-package/components/rehab/AIRehabChatbotV2.tsx`(대화형) + `RehabResultReport.tsx`이며, 계산은 `calculationService.ts`(엔진 A, 챗봇·CRM 공용)와 `rehabEngine.ts`(엔진 B, 인테이크/CRM)가 담당합니다. `client/DiagnosisFlow.tsx`·`DiagnosisResult.tsx`는 **어디에서도 import되지 않는 미사용 코드**입니다.
>
> ⚠️ **기준값 정정**: "1인 133만~4인 343만"은 **2024년** 기준 중위소득 60%입니다. 2026년 인정 생계비는 **1인 1,538,542원 / 2인 2,519,575원 / 3인 3,215,421원 / 4인 3,896,842원** (2026 기준 중위소득 × 60%, 법원 공시 원 단위 절사)이며, 모든 엔진이 `repaymentConstants2026.ts` 테이블 하나를 사용합니다.

- [ ] **스텔스 가명 시스템 (`generateAlias.ts`)** — ⚠️ 부분 구현
  - ✅ 포맷을 스펙대로 "수식어 명사 숫자"(예: "조용한 보름달 73")로 변경. 기존 `파란고래_42`의 밑줄이 변호사 화면 `clientName.split('_')` 실명 분리 로직과 충돌하던 문제 해소 *(수정)*
  - ✅ `Math.random` → `crypto.getRandomValues` (rejection sampling) *(수정)*
  - ✅ 로그인 사용자 가명이 저장되지 않아 새로고침마다 바뀌던 버그 → 최초 발급 시 `user_metadata.alias`에 저장 *(수정)*
  - ✅ 서버 유일성 보장: `014_client_alias_uniqueness.sql` (`client_aliases` UNIQUE + `claim_client_alias` RPC, 공백·대소문자 정규화). 중복 시 자동 재발급, 3회 충돌 후 3자리 조합(약 356만)으로 확장, 마이페이지 직접 변경 시 중복 안내 *(수정)*
  - ❌ 비로그인 방문자는 가명 없이 공용 `client-temp` ID 사용
  - ✅ **DB 레벨 마스킹 (`012_consult_requests_strict_rls.sql`)**: 기본 테이블은 본인(`auth.uid() = client_id`)·관리자만 조회/수정/삭제. 변호사는 관리자 승인된 계정(`lawyer_accounts`)만 `consult_requests_for_lawyers` 뷰로 조회하며, 전자계약 서명 완료(또는 본인 등록 외부 의뢰인) 전까지 연락처는 `010-****-****`, 이름은 가명만 노출. 변호사 쓰기는 `lawyer_patch_consult_request` RPC 화이트리스트로 제한, 의뢰인의 제안서 위조·덮어쓰기는 트리거로 차단 *(수정)*
- [ ] **진단 퍼널 (`AIRehabChatbotV2.tsx`)** — ⚠️ 부분 구현
  - ✅ 주소 → 나이 → 성별 → 소득 형태(급여/영업/프리랜서/겸업/일용직/무직/기초수급) → 소득 → 혼인·자녀 → 주거 → 의료·교육비 → 재산 → 카드·채무 유형별 금액 → 위험요인 → 법적조치 → 이전 절차 → 24개월 특례 → 메모
  - ✅ 단일 선택 자동 이동 (300ms + 타이핑 600ms), 5단계 분석 애니메이션
  - ❌ "최우선 해결 희망 목표" 질문 없음 / 담보대출 채무 유형 없음 / 저축은행·대부업 통합
  - ✅ 결과 메시지 "최대 N% 탕감받을 수 있어요" → "예상 탕감률 약 N% (참고용 추정치)", 압류 "바로 멈출 수 있어요" → 중지·금지명령 신청 안내, "대부분 해결책을 찾으셨어요" 문구 교체 *(수정)*
  - ✅ 무직·기초수급 시 월 200만원 가정 계산임을 명시하고 "하루만 일해도 회생 가능" 오안내 제거 *(수정)*
  - ✅ 세금 체납이 총 채무에서 빠져 있는데 "모두 포함된 금액"으로 안내하던 문구 → 일반 채무/세금 분리 표시 *(수정)*
- [ ] **2026년 기준 생계비 및 소득 계산 엔진** — ⚠️ 부분 구현
  - ✅ 2026 기준 중위소득 60% 테이블 정상 (엔진 A·B 모두)
  - 🐛 소수 가구원(예: 2.5인) 중위소득이 1인 값으로 fallback → 고소득자 판정 오작동 → 선형 보간으로 수정 *(수정)*
  - 🐛 7인 이상 가구가 1인 생계비로 계산 → 중위소득 × 60%로 산출 *(수정)*
  - 🐛 `rehabEngine` 미정의 연도 fallback이 2025 → 2026 *(수정)*
  - ❌ 소득 형태별(영업·일용직) 가용소득 산출 로직 없음 (단일 월소득 입력)
- [ ] **채무 내역 세분화 및 청산가치 반영** — ⚠️ 부분 구현
  - 🐛 `constants.ts`가 법정 고정 금액을 매년 ×1.035 인상 → 2026 서울 소액보증금 1억7080만/5690만, 예금 191만, 보험 155만으로 오산출 → 법정 금액으로 고정 *(수정)*
  - 🐛 채무 구성비가 세금 포함 여부와 무관하게 분모를 잡고 유형별 실제 금액 대신 균등 배분 → 실제 입력 금액 기준으로 수정 *(수정)*
  - ❌ 진단기(엔진 A)·CRM(엔진 B)의 재산 공제(예금 185만·보험 150만) 처리는 아직 법원 엔진과 다름 — 청산가치 산정 통합은 후속 과제
  - ✅ **라이프니츠 현가 단일화**: `rehabLegalCore.ts`에서 월 5/12% 복리 연금현가 공식 하나로 통일 (24개월 22.7939 / 36개월 33.3657 / 60개월 52.9907). 법원 엔진의 기존 선적립 3개월 방식(33.7719)은 폐기 *(수정)*
  - ✅ 조세 우선변제: 변제기간의 1/2 이내 완납 요건을 진단기·CRM·법원 엔진에 동일 적용, 탕감률은 일반채권 기준 *(수정)*
- [ ] **추가생계비 및 24개월 변제 단축 특례** — ⚠️ 부분 구현
  - ✅ 주거비·의료비·교육비·특수교육비 입력 / 양육비는 이혼 분기에서만
  - ✅ 특례 선택지 "심한 장애(1~3급)" → "장애의 정도가 심한 장애인" (2019 장애등급제 폐지 반영) *(수정)*
  - ✅ 24개월 특례(청년 만 30세 미만·수급·장애·한부모·전세사기·고령자, 서울/수원/부산회생법원)를 3개 엔진에 동일 적용 — 청산가치·최저변제액 충족 시에만 24개월 *(수정)*
  - ❌ 청년·다자녀 선택지 없음, 이전 절차 이력자에게는 특례 질문 미노출
- [ ] **진단 결과 리포트 (`RehabResultReport.tsx`)** — ⚠️ 부분 구현
  - ✅ 월 변제금 CountUp, 탕감률 도넛, 상담 시급성 배지, 제도별 적합도 3종(회생/파산/워크아웃), 법률자문 아님 고지
  - 🐛 생계비 fallback 133만원(2024) → 2026 PolicyConfig 연동 *(수정)*
  - ✅ "100% 면책", "정답입니다", "가장 이상적인 조건", "즉시 인용", "전액 면책 🎉" 등 단정 표현 교체, 라벨 "강력 추천/부적합" → "우선 검토/해당 가능성 낮음" *(수정)*
  - ✅ `window.alert` 5곳 → `sonner` toast, 라이트 리포트 안의 다크 카드 3개(대비 위반) → 라이트 카드, 잘못된 클래스 `text-slate-550` 수정 *(수정)*
  - 🐛 통계 탭: "변제율" 분포에 탕감률을 대입해 결과 역전, "억" 단위 파싱 오류, "이상~미만" 구간 파싱 불가, 분포 차트 하이라이트 라벨 불일치 → 모두 수정, 인사이트 문구 중립화 *(수정)*
  - ❌ 적합도 점수(95/92/85 등)는 규칙 기반 고정값 — 정밀 수치로 오인될 소지
  - ❌ 장단점·필수 소명서류 카드, 불법추심 대처·압류방지통장 가이드, 변호사법 제34조 안내 없음
- [ ] **진단 결과 PIN 암호화 공유 (`ReportShareModal.tsx`, `SharedReportViewer.tsx`)** — ⚠️ 부분 구현
  - ✅ AES-256-GCM + PBKDF2(10만 회), 랜덤 salt/IV. PIN은 4자리가 아닌 **6자리**
  - ✅ 공유 데이터에서 이름·주소 제거, 암호문을 `?share=` → `#share=`(서버 로그·Referer 미전송)로 이동(기존 링크 호환), `alert` → toast, 브랜드명 "로이 법률 CRM" → "my김변", 뷰어 다크 배경 대비 수정 *(수정)*
  - ✅ **서버 보관 + 시도 횟수 제한 (`013_shared_reports_pin_attempt_limit.sql`)**: 링크에는 무작위 ID만, 암호문은 서버 보관. PIN은 서버(bcrypt)에서 검증하며 5회 오입력 시 링크 영구 잠금, 7일 자동 만료, 사용자당 하루 20개 생성 한도. 이전 형식 링크는 차단 *(수정)*
- [ ] **진단 통계 분석 서비스 (`diagnosisService.ts`)** — ⚠️ 부분 구현
  - ❌ 어드민에서 저장하는 진단 설정(`diagnosis_config`)을 라이브 챗봇이 읽지 않음 (미사용 `DiagnosisFlow`만 prop 보유)
  - ❌ 주석은 "구간값 전송"인데 실제로는 원시 금액 저장 / 전환 추적 update가 세션 전체 행을 갱신할 수 있음
- [x] **인터랙티브 시뮬레이션 계산기 (`CalculatorView.tsx`)**
  - 월 소득/총 채무/부양가족 수 슬라이더 실시간 조정 ✅
  - 🐛 생계비가 2024년 값(133/221/282/343만)으로 하드코딩 → `PolicyConfig` 2026 값(154/252/322/390만) 연동, 라벨 "보건복지부 고시 최저생계비" → "2026 인정 생계비(기준 중위소득 60%)" *(수정)*
  - 월 변제금·감면 비율 산출, 소득 < 생계비 시 파산 검토 배너 ✅
  - ℹ️ 36개월 단순 계산 (청산가치 미반영) — 사전 체크용임을 화면에 고지 중

> ✅ **엔진 단일화 완료 (2026-09-27)**: 법원 정밀 엔진 산식을 `src/services/repayment/rehabLegalCore.ts`로 추출해 진단기·CRM·법원 엔진이 공유합니다. 교차 검증 5건(저소득·표준·청산가치 과다·청년 24개월·세금 체납) 모두 세 엔진의 기간·월 변제금이 일치했습니다. 예: 서울 1인·소득 140만·채무 3천만 → 60개월 × 월 25,000원 (최저변제액 충족, 생계비 감액 필요 경고). 임의 생계비 조정 규칙(부양가족 축소·소득 70% 재조정)은 제거되었습니다.

---

### 1-3. 변호사 탐색 & 비교
- [x] **3단계 광고 티어링 디렉토리 (`LawyersView.tsx`)**
  - ✅ 상단 광고(top) > 광고·지역(regional/basic) 대형 카드 > 기본등록 컴팩트 카드(10건 페이지네이션)
  - ⛔→✅ **정적 mock 목록 사용 버그**: 디렉토리가 `mockLawyers`를 직접 사용해 관리자 승인·신규 가입·정지가 반영되지 않았음 → 앱 공용 `lawyers` 상태로 교체 *(수정)*
  - ⛔→✅ **비변호사·테스트 계정 공개 노출**: 직원 계정("박진혁 실장", role STAFF)과 테스트 계정이 변호사 목록에 표시됨 → `role === 'LAWYER'`만, 프로덕션에서 `test-lawyer*` 제외, 승인 대기·반려·정지 계정 비노출 *(수정)*
  - ✅ 같은 광고 등급 내 **세션별 무작위 정렬** 실제 적용 (기존엔 "정렬: 무작위" 표기만 있고 고정 순서였음) *(수정)*
  - ✅ 모든 카드에 붙던 **"대한변협 인증" 배지** → 플랫폼이 등록번호를 확인한(`licenseStatus === 'verified'`) 변호사에게만 "등록번호 확인" 표시 *(수정)*
  - ✅ 근거 없는 실시간 상태("상담 가능" 점멸, 온라인 점)와 mock 통계("평균 응답 2시간") 제거 → 검증 가능한 사실(등록 변호사 수·실명 불필요·최대 3명 요청)로 교체 *(수정)*
  - 🐛 광고 카드 "상담하기" 클릭 시 프로필 모달까지 함께 열리던 이벤트 버블링 수정, 44px·nowrap 적용 *(수정)*
  - ✅ 카드 키보드 조작(`role="button"`, Enter/Space), 즐겨찾기 `aria-label`/`aria-pressed`, `alert` → toast *(수정)*
  - ✅ 찜하기 `localStorage` 보관, 다중 선택(최대 3명) 요청, 중간 자가진단 유도 배너
  - ℹ️ 지역 필터는 사무소 소재지 11개 권역 기준 (관할법원 14개 필터 아님 — 비대면 진행이 일반적이라 소재지 기준 유지)
- [x] **변호사 프로필 모달 (`LawyerProfileModal.tsx`)** *(재작성)*
  - ✅ 3대 탭: 변호사홈 / 변호사 정보(소속·관할·경력·자격·확인된 등록번호·학력·상담 비용) / 의뢰인 후기
  - ⛔→✅ **허위 정보 자동 생성 제거**: 모든 변호사에게 동일한 가짜 주소("서초대로 250")·전화번호(02-588-1234)·타 로펌 도메인(hanbitlaw.co.kr)을 채워 넣던 로직 삭제 → 변호사가 등록한 정보만 표시 *(수정)*
  - ⛔→✅ **모든 변호사에게 같은 가짜 후기 5건**과 임의 후기 수(`12 + matchedCount % 20`)를 보여주던 문제 → 해당 변호사의 실제 후기만 표시, 없으면 빈 상태 안내 *(수정)*
  - ✅ 광고규정 위반 소지 기본값 제거: "도산법 전문"·"회생법원 전담"·"수임 100건+ 인가 실적" 배지, "보정명령 48시간 내 대응" 약속 → 취급 분야는 변호사 입력 정보임을 고지 *(수정)*
  - ✅ 카카오맵 길찾기 딥링크·외부 채널(홈페이지/유튜브/블로그)은 **등록된 URL이 있을 때만** 표시 (`rel="nofollow"`)
  - ✅ `role="dialog"`, ESC 닫기, 탭 `aria-selected`, 44px 버튼, 흰 배경 위 텍스트 대비 개선
  - ✅ 변호사 프로필 편집기(`LawyerProfileEditor.tsx`)에 사무소 주소·전화·상담시간·오시는 길·초기 상담 비용 입력란 추가, 편집기 미리보기의 가짜 주소도 제거 *(수정)*

---

### 1-4. 1:1 상담 대화방 & 제안서 (`ChatView.tsx`)
- [ ] **3-Zone UI 아키텍처**
  - Zone A: 채무 현황 카운트업 대시보드 (총 채무, 월 가용소득, 예상 탕감액)
  - Zone B: 3-step 매칭 스테퍼 (상담 신청 → 분석/제안서 수신 → 수임계약) + 복수 제안서 비교
  - Zone C: Web Crypto API 기반 AES-256 종단간 암호화(E2EE) 1:1 보안 메시징
- [ ] **변호사별 1:1 채팅 탭 전환**
- [ ] **1-Click 수임 계약 체결** (confetti 연출 + CRM `updateCrmClientExtension` 동기화)
- [ ] **단일 상담 즉시 자폭 (`purgeConsultationRecord`)** — 개별 대화 영구 파기
- [ ] **제안서 파이프라인 (`ClientProposalTracker.tsx`)**
  - 4단계 트래커: 상담 신청 → 제안서 작성 중 → 제안서 도착 → 추가상담/계약
  - 복수 제안서 스위처 (최대 3인) — 변호사별 탕감률 탭 전환 및 비교 뷰어
- [ ] **제안서 분석 중 대기 카드 (`ProposalAnalyzingCard`)**
  - 10~30분 분석 안내, 펄스 애니메이션, 배정 변호사 정보 및 알림톡 발송 예고
- [ ] **제안서 히어로 카드 (`ProposalHeroCard`)**
  - AI 7p 정밀진단 뱃지, 탕감률/월 변제금/수임료 3대 핵심 수치, 변호사 의견 인용
  - "맞춤 제안서 & 7p 정밀 진단서 전문 열람하기" CTA
  - "1:1 추가 상담하기" vs "이 조건으로 즉시 수임계약 진행하기" 2대 의사결정 액션
- [ ] **7p 정밀 제안서 전문 뷰어 (`PremiumProposalReportModal`)**
- [ ] **A4 정식 법률 소견서 인쇄 (`PrintableLawyerOpinionTemplate.tsx`)**
  - 고유 문서번호(ADV-YYYYMMDD-XXXX), 변호사 직인 날인
  - 4대 핵심 지표(총 채무/월 가용소득/예상 월 변제금/탕감률)
  - 관할법원 인가율 추이, 추가 생계비 인정 방안, 전후 비교표, 5단계 로드맵, 수임료 분납 스케줄

---

### 1-5. 고객 마이페이지 & 서류 작성/제출 허브 (`MyPageView.tsx`)
- [ ] **3대 서브탭 분기**: `companion`(동행 대시보드) / `diagnosis`(진단 결과) / `settings`(설정)

#### 1-5-A. 법원 진술서 D5104 마법사 (`ClientStatementModal.tsx`)
- [ ] **5단계 대법원 표준 진술서 작성 마법사**
  - Step 1: 최종학력 + 직장경력 (`JobHistoryImportModal` 연동)
  - Step 2: 과거 5년/7년 내 면책 이력 및 현재 주거 상태(자가/임차/무상) 소명
  - Step 3: **AI 대화형 음성 인터뷰 (`VoiceInterviewSection`)**
    - Web Speech API 기반 TTS 질문 낭독 (`speechSynthesizer`) 및 음소거 토글
    - 실시간 STT 음성 인식 (`useSpeechRecognition`)
    - 6대 인생 질문: ① 성장 환경, ② 건강/의료비, ③ 첫 채무 계기, ④ 채무 증대 과정, ⑤ 지급불능 순간, ⑥ 갱생 다짐
    - 질문별 추천 단어 칩 원터치 추가
    - 문체 톤 선택: 정중·격식 / 진솔·호소력 / 간결·명확
  - Step 4: Gemini AI 법원 표준 4단 구성 자동생성 (①채무발생원인 ②증대경위 ③지급불능사정 ④반성과다짐) + 법률 안전 검토 경고 배너
  - Step 5: A4 서식 완성 및 변호사 CRM 전자소송 서류철 실시간 전송
- [ ] **직장경력 자동 불러오기 (`JobHistoryImportModal`)**
  - Track A: 카카오/PASS/네이버/토스 간편인증 → 국민연금공단(NPS) 가입이력 1초 스크래핑
  - Track B: 건강보험 자격득실확인서 OCR(Gemini Vision AI) → 표 자동 인식
  - 조회 결과 체크박스 → 진술서 경력 테이블 1-Click 자동 입력
- [ ] **대법원 정식 규격 인쇄 (`PrintableCourtStatementModal`)** — 파산 전용 제564조 면책불허가사유 자가점검표 포함

#### 1-5-B. 재산목록 D5102 기초자료 (`ClientPropertyIntakeModal`)
- [ ] **6대 자산 카테고리 탭**
  - ① 예금 및 보험: 185만원 압류금지 예금 공제, 150만원 보장성 보험 공제, 약관대출 차감 (어카운트인포/내보험다보여 링크)
  - ② 자동차: 중고 시세 평가, 차량 담보대출 잔액 차감 (엔카/보험개발원 링크)
  - ③ 임차보증금: 2026 주택임대차보호법 최우선변제 소액보증금 공제 (서울 5,500만, 과밀 4,800만, 광역 2,800만, 기타 2,500만)
  - ④ 부동산: 공시가격 130% 시세 산정 + 근저당 채무 차감 (KB부동산 링크)
  - ⑤ 사업용 설비 및 채권: 비품, 기계, 외상매출금
  - ⑥ 퇴직금 및 면제재산: 퇴직금 50% 청산가치 반영, 민사집행법 제195조 압류금지 집기
- [ ] 실시간 청산가치(J) 자동 계산, 임시저장, 변호사 CRM 동기화 및 제출
- [ ] **인쇄/PDF 모달 (`PrintablePropertyIntakeModal`)** — 자산 평가 총액/담보 채무/법정 공제/최종 청산가치 총괄 요약

#### 1-5-C. 수입·지출 D5103 (`ClientMonthlyIncomeExpenseModal`)
- [ ] **4대 소득 형태별 맞춤 인터페이스**
  - `BUSINESS` (개인사업자): 1분 초간편 마법사 vs 12개월 엑셀 표 토글, 카드/현금 매출, 10종 인기 경비 칩
  - `FREELANCER` (3.3% 프리랜서): 월 총수수료, 필수 업무경비 → 순소득 산출
  - `DAY_LABORER` (일용직): 월 근무일수 × 일당, 현금 수령 여부
  - `PART_TIME` (아르바이트): 복수 사업장별 시급, 주당 근무시간, 주휴수당
- [ ] **🎙️ 음성 AI 수지표 작성 (`useSpeechRecognition`)**: "카드 400에 현금 100이고 월세 90" → 매출·경비 자동 추출

#### 1-5-D. 통장 거래내역 소명 (`ClientBankAuditModal.tsx`)
- [ ] 30만/50만/100만원 이상 출금거래 소명 기준 설정
- [ ] 원터치 빠른 사유 프리셋 칩 (`AUDIT_PRESET_TEMPLATES`): 생활비, 병원비, 부모님 용돈, 편파변제 등
- [ ] 위험 거래 스마트 경보 (가상자산, 명품, 거액 현금 출금)
- [ ] 은행 엑셀 파일(.xlsx) 업로드 파싱 + 뱅킹 텍스트 붙여넣기 파서
- [ ] 전체/미소명/소명완료 필터 및 진척도 프로그레스 바
- [ ] 변호사 의견 조회, 임시저장, 제출

#### 1-5-E. 채무 인테이크 마법사 (`ClientDebtIntakeWizardModal.tsx`)
- [ ] **7대 실무규칙 강제 적용**
  - ① 4대 시중은행(국민/신한/우리/하나) 대출과 카드 채권 분리
  - ② 농협중앙회 vs 지역 농축협 독립 법인 분리
  - ③ 새마을금고/신협 지점명(단위조합) 필수 입력
  - ④ 지역신용보증재단 관할 재단 선택
  - ⑤ 담보 채무 담보물 종류 지정
  - ⑥ 저축은행 가압류/경매 경보 표출
  - ⑦ 대부업체 양수양도 이력 추적

#### 1-5-F. 공동인증서 안전 금고 (`ClientCertificateSubmissionModal.tsx`)
- [ ] **Zero-Knowledge 4-Step 마법사**
  - Step 1: 인증서 종류 선택 (`npki` 공동인증서 vs `financial` YESKEY 금융인증서)
  - Step 2: 공동인증서 `signCert.der` + `signPri.key` 업로드 & DER 메타 분석 / 금융인증서 알림톡 설정
  - Step 3: AES-256-GCM 비밀번호 종단간 암호화
  - Step 4: 3대 법적 위임 목적 제한 서약 + 전자 자필 서명
  - 종결 시 영구 파기(Shredding), 접근 감사 로그 영구 기록

#### 1-5-G. 기타 서류 허브
- [ ] **2차 필수 공공서류 제출 허브 (`Fast2ndDocHubModal.tsx`)**
- [ ] **1차 서류 실물 등기 허브 (`MobileApplicationDocHubModal.tsx`)**
  - Phase 1: 인감증명서 발급 통수 계산 + 우체국 익일특급 등기 + 송장번호 추적
  - Phase 2: 소득 및 재산 증빙 서류 업로드
- [ ] **숨은 채무·체납·계좌 전수조회 (`DebtDiscoveryModal`)**
  - 카카오/PASS/토스 간편인증 → 4대 기관(신용정보원/금융결제원/국세청/대법원) 전수조회 → 변제계획안 채권자 원클릭 적용
- [ ] **모바일 카메라 스캐너 (`MobileScanner.tsx`)** 촬영/업로드
- [ ] **법원 제출용 워터마크 자동 합성 (`documentWatermark.ts`)**
- [ ] **파일 보안 업로드 (`fileSecurity.ts`)** — 15MB/화이트리스트 MIME 검증

---

### 1-6. 모바일 원격 전자계약 & 서명/도장 (`ClientRemoteSignView.tsx`)
- [ ] **원격 서명 링크 보안 토큰 검증** 및 만료 링크 차단
- [ ] **4대 법적 약관 전문 확인 및 동의** (개인정보/제3자제공/위임계약/전자서명)
- [ ] **포트원(PortOne V2) 공식 본인인증** (카카오페이/PASS/토스/SMS)
- [ ] **계약 중요 조항 직접 확약 타이핑** — 직접 입력 시에만 서명 활성화
- [ ] **터치 서명 캔버스 (`SignatureCanvas.tsx`)** 및 디지털 인감 도장 생성
- [ ] **체결 즉시 법원 제출용 PDF 생성 (`contractPdfService.ts`)**
- [ ] **블록체인 타임스탬프 및 SHA-256 전자지문** 표기
- [ ] **공개 원본 검증기 (`ContractPublicVerifierModal.tsx`)**

---

### 1-7. 사건 진행 동행 대시보드

#### 1-7-A. 동행 허브 및 모드 전환 (`RehabCompanionView.tsx`)
- [ ] **모드 전환**: `rehab`(개인회생동행 3~5년) vs `bankruptcy`(개인파산·면책동행) 자동 분기
- [ ] **3대 서브탭**: `dashboard`(동행 대시보드), `support`(공적 지원센터), `academy`(회복 아카데미)
- [ ] 실시간 CRM 동기화 (`storage` 및 `legal_crm_data_updated` 이벤트 감지)

#### 1-7-B. 개인회생 동행 대시보드 (`CompanionDashboard.tsx`)
- [ ] **사건 헤더**: 대법원 실시간 사건조회, 법원 가상계좌 원터치 복사, 채권자집회 출석 가이드
- [ ] **스마트 경보 배너**
  - 36회차 완납 축하 + 면책신청서(채무자회생법 제624조) 위임 안내
  - 미납 폐지 위험도 진단 (`evaluateOverdueRisk` — 전국 14개 법원별 실무 기준)
- [ ] **상환 진척도 게이지**: 총 변제 예정액, 누적 납부액, 남은 변제액 3열 통계
- [ ] **36~60개월 상환 히트맵 캘린더**: 4색 상태 (🟢법원자료, 🔵증빙첨부, 🟡고객표시, 🔴확인필요)
- [ ] **30일 생계 밸런서**: 월 실수령 - 필수생계비 - 월 변제금 - 고정지출 = 잔여 여유자금 (적자 시 SOS 트리거)
- [ ] **2차 서류 원스톱 허브 연동**: `Fast2ndDocHubModal`, `ClientStatementModal`, `ClientMonthlyIncomeExpenseModal`, `ClientPropertyIntakeModal`

#### 1-7-C. 개인파산·면책 전용 대시보드 (`BankruptcyCompanionDashboard.tsx`)
- [ ] 담당 파산관재인 정보, 다음 주요 기일 D-Day
- [ ] **6단계 파산 절차 타임라인**: 파산신청 → 파산선고/관재인선임 → 제1회 집회/채권조사 → 환가/배당/소명 → 면책심문 → 최종 면책결정
- [ ] 관재인 소명 서류 보관함 (`validateUploadFile` 파일 검증)

#### 1-7-D. 대법원 연동 & 납부 관리
- [ ] **대법원 나의사건 실시간 조회 (`CourtCaseModal`)** — 3대 서브탭: 타임라인, 송달 내역, 납부 내역, D-Day 카운터
- [ ] **회차별 변제금 납부 확인 (`RepaymentPaymentModal`)** — 4단계 근거 (①법원 자료 ②이체확인증 ③고객 확인 ④미납 주의), 영수증 업로드
- [ ] **채권자집회 출석 가이드 (`CreditorMeetingGuideModal`)** — 준비물/절차/불출석 폐지 위험 경고

#### 1-7-E. 변제금 미납 폐지 방어 (`OverdueDefenseGuideModal`)
- [ ] 회차별 폐지 기준 (1-2회 주의, 3회 경고, 4회+ 직권폐지)
- [ ] 법원별 실무 비교 (서울회생법원 유연 vs 수원/부산 3회 vs 지방법원 엄격)
- [ ] **3대 대처방안**: ① 분납·추납 무이자 쪼개기 3대 원칙, ② 변제계획 변경신청, ③ 특별면책(제624조 제2항)
- [ ] **14일 즉시항고 골든타임** (대법원 전자공고 익일부터 14일 불변기간)

#### 1-7-F. 생활위기 SOS (`LifeCrisisModal`)
- [ ] 7대 위기 사유 (소득 감소, 실직/폐업, 중대 질병, 주거비 급증, 가족 돌봄, 자동이체 오류, 기타)
- [ ] 긴급복지지원(최대 183만원), 국민취업지원제도(월 50만원), 변제계획 변경신청 권장

#### 1-7-G. 공적 복지 & 정책금융 큐레이션 (`SupportCenterTab`)
- [ ] 공공데이터포털 실시간 API 연동 (`fetchLiveBenefitsFromApi`)
- [ ] **5대 우선순위 필터**: 🥇무상·긴급복지 → 🥈공적 채무·법률 → 🥉성실상환 정책금융(서민금융진흥원 6회 완납 특례) → 💡생활비·공과금 → 🏠주거·취업·자산
- [ ] 지역별 필터 (전국 공통, 서울/경기, 지방) 및 공식 신청 링크/전화번호

#### 1-7-H. 회복 아카데미 (`RecoveryAcademyTab`)
- [ ] 면책 확정 후 12개월 신용 회복 4단계 로드맵
- [ ] 6대 월간 필수 가이드북 (1, 3, 6, 12, 24, 36개월 차)
- [ ] 36회 완납 고객 전용 대법원 면책신청서 양식 다운로드

#### 1-7-I. 회생동행 간편 등록 (`CaseRegistrationModal`)
- [ ] **3-Step 마법사**
  - Step 1: 진행 방식 (타 사무소/나홀로 전자소송/마이김변 변호사) 및 사건 유형 선택
  - Step 2: 3-Track 사건 연동
    - Track 1 (스마트 OCR): Gemini AI 인가결정문 파싱 (`parseCaseDocumentOcr`)
    - Track 2 (공식 딥링크): 대법원 사이트 사건정보 자동복사
    - Track 3 (API 자동완성): 대법원 전산망 실시간 데이터 (`scourtService.fetchCourtCase`)
  - Step 3: 변제 조건 (월 변제금, 납부일 1~31일, 총 회차 24/36/48/60회, 시작 년월) 및 30일 생계 밸런서 기준값

---

### 1-8. 고객 인앱 알림 & 세션 보안 & 기타 UI
- [ ] **인앱 알림 벨 (`ClientNotification`)** — 읽음/전체읽음, 뱃지 카운트, 초기 안내 시딩
- [ ] **30분 미활동 자동 로그아웃 (`clientSessionSecurity.ts`)** + 다중 탭 세션 만료 전파 (StorageEvent)
- [ ] **새로고침/OAuth 리다이렉트 판별** — 재로그인 방지
- [ ] **비상 데이터 자폭 (`purgeAllClientData` — MySettingsView)** — 상담이력/진단기록/인증서 일체 영구 삭제
- [ ] **OAuth 간편 로그인 (`AuthModal.tsx`)** — Google + Kakao Supabase Auth + 변호사 포털 스위처
- [ ] **모바일 하단 GNB (`MobileGNB.tsx`)** — Safe Area 패딩, 5대 탭, 읽지 않은 메시지 뱃지
- [ ] **문의하기 봇 방지 (`InquiryView.tsx`)** — Cloudflare Turnstile + 첨부파일 2개/5MB + 4자리 비밀번호 익명 조회
- [ ] **Q&A 비밀 상담 모드 (`QnAView.tsx`)** — 14개 세부 카테고리, 다중 변호사 답변, 대표 채택
- [ ] **법률 뉴스룸 (`NewsView.tsx`)** — 5대 카테고리, HOT/NEW 뱃지, 관련 변호사 브릿지 CTA
- [ ] **공지사항 (`NoticesView.tsx`)** — 중요 공지 상단 고정, 브레드크럼
- [ ] **서류 발급 매뉴얼 (`GuideView.tsx`)** — 직장인 22종 vs 자영업자 24종 스위처, 마스킹 수칙, 7대 서류 그룹 카드
- [ ] **B2B 변호사 영입 퍼널 (`UnregisteredLawyerDocViewer.tsx`)** — 의뢰인 공유 토큰 → 5초 간편 등록 → 1-Click 파트너 업그레이드 (confetti)
- [ ] **외부 변호사 서류 공유 (`LawyerDocShareModal.tsx`)** — 7일 유효 보안 토큰 URL, 주민번호 마스킹, 카카오/SMS 공유
- [ ] **회사 소개 (`CompanyView.tsx`)** — 검증 가능한 서비스 사실 지표(이용료 0원·최대 3명·정액 광고비·스텔스 가명), 변호사법 제34조 법적 면책 고지
- [ ] **약관 모달 (`TermsModal.tsx`)** — 이용약관 및 개인정보 처리방침 전문
- [ ] **푸터 (`ClientFooter.tsx`)** — 사업자 등록 정보, 대표자 정보, 통신판매중개자 법적 한계

---

<br/>

# PART 2. ⚖️ [변호사 어드민] Lawyer CRM Checklist

---

### 2-1. 변호사 워크스페이스 쉘 & 대시보드 (`LawyerRole.tsx`)
- [ ] **13개 1차 탭**: 대시보드, 상담채팅, 영업DB, 사건CRM, 업무/일정, 전자계약, 수임료정산, 사건코파일럿, Q&A답변, 광고/결제, 직원관리, 플랫폼문의, 환경설정
- [ ] **멀티 세션 방지 보안 가드** (`useSessionGuard`, `sessionService.registerSession`)
- [ ] **전역 통합 검색 (`GlobalSearchPalette.tsx`)** — `Cmd/Ctrl+K` 핫키, 의뢰인/연락처/사건번호/계약서/메모 퍼지 검색
- [ ] **알림 센터 벨 (`NotificationBell.tsx`)** — 작업 할당/결재/코파일럿 피드백 실시간 알림
- [ ] **나의 할 일 위젯 (`MyTasksWidget.tsx`)** — 마감 임박 작업 대시보드
- [ ] **브라우저 웹 푸시 알림 권한 제어**
- [ ] **팝업 공지사항 (`PopupContainer`)** — 오늘 하루 보지 않기

---

### 2-2. 플로팅 법률 퀵 독 (`LegalQuickDock.tsx`) — 16대 전문 퀵툴
- [ ] **CRM 화면 어디서나 플로팅** — 3단 가시성(normal/minimized/hidden), Alt+Q 토글, 마우스 드래그 좌표 저장
- [ ] **독립 드래그 윈도우 (`FloatingToolWindow`)** — 멀티태스킹 지원
- [ ] **툴 커스터마이저 (`ToolCustomizerModal`)** — 도구 노출/순서 설정
- [ ] **16대 퀵툴 각각 정상 작동 확인**:
  1. `CalculatorTool`: 채권자수별 송달료/인지대 즉시 계산
  2. `RehabPayCalcTool`: 탕감률 및 월변제금 계산기
  3. `LiquidationCalcTool`: 청산가치 충족 여부 점검기
  4. `InterestCompareTool`: 기존 고금리 vs 회생 변제금 절감 비교
  5. `KoreanAgeCalcTool`: 만나이 계산 + 미성년 부양자녀/청년특례(24개월) 판정
  6. `MedianIncomeTool`: 2026년 가구원수별 기준중위소득 및 60% 생계비 조회
  7. `ExtraExpenseTool`: 주거비/의료비/교육비 추가생계비 한도표
  8. `SeizureLimitsTool`: 예금 185만/250만, 급여 압류금지액, 소액임차보증금
  9. `CourtGuidelinesTool`: 전국 14개 법원별 실무준칙 (코인/주식/금지명령 속도)
  10. `LegalArticlesTool`: 도산법 핵심 조문 요약 (제595조/제564조)
  11. `AssetValuationTool`: 공시가 130%, 차량가액 산정 및 조회 사이트
  12. `CreditorSearchTool`: 100대 금융기관/대부업체 법원 송달주소록 검색
  13. `FloatingPinMemoTool`: `Ctrl+V` 클립보드 이미지 핀 고정, 확대/축소
  14. `DocumentChecklistTool`: 직업/주거별 서류 체크리스트 + 카카오 복사
  15. `VirtualAccountTool`: 대법원 가상계좌 복사 + 연체 주의
  16. `QuickMemoTool`: 전화 상담 중 퀵 스크래치패드

---

### 2-3. 사건 CRM 종합 워크스테이션 (`CrmTab.tsx` — 5,537 라인)
- [ ] **16대 사건 단계별 파이프라인 칸반/리스트 뷰**
- [ ] **다중 필터**: 담당자, 사건유형, 유입채널, 법원, 서류미제출, 수임료연체, 보정마감임박
- [ ] **의뢰인 상세 패널 — 16개 서브탭 각각 정상 작동**
  1. `info`: 인적사항, 가족, 소득/재산 프로필
  2. `summary`: 18개 핵심 브리핑 요약문 & AI 통화 요약 비교
  3. `notes`: 카테고리별 상담/사건 메모 타임라인
  4. `timeline`: 단계 변경, 알림톡 발송 등 시스템 감사 로그
  5. `calls`: 녹음 청취, 실시간 통화/문자 이력
  6. `tasks`: 담당자 배정 티켓 및 검토 승인
  7. `fees`: 수임료 분납, 가상계좌, 연체 관리
  8. `contracts`: 전자계약서 체결/감사추적 인증서
  9. `documents`: 5개 카테고리 서류 수집함 + 모바일 스캐너
  10. `debt-certs`: 부채증명서 발급 대행 발주 원장
  11. `statement`: 의뢰인 모바일 진술서 동기화/감수
  12. `repayment`: 변제계획안 튜닝/산출 원장
  13. `bankruptcy`: 개인파산 6대 서브원장
  14. `corrections`: 보정권고 차수 관리/보정서 작성
  15. `court`: 대법원 나의사건검색 실시간 연동
  16. `vault`: 공동/금융인증서 안전 금고
- [ ] **21+ 모달 정상 호출**: NewCase, ImportCases, ExportCases, ExternalClient, BulkMessage, FeeSchedule, FeeAlimtok, FeeNotification, DropOffReason, AssignmentDirective, ContractWizard, ClientSignShare, BatchDocRequest, SpeedDocReview, BatchFilingPackaging, CourtPetitionEdit, CreditorManagement, PropertyValuation, RepaymentPlanEditor, ComprehensiveCorrectionCenter, PostCommencementManagement, CertificateVault, MobileScanner

---

### 2-4. 인테이크 상담 & AI 사건검토 코파일럿

#### 2-4-A. 코파일럿 검토 워크플로우 (`CaseReviewCopilot.tsx`)
- [ ] **`runFactEngine`**: 의뢰인 인입 데이터 정규화
- [ ] **`runReviewRuleEngine`**: 5대 플래그 (검토플래그, 추가질문, 필요서류, 주의사항, 고위험) 자동 검토
- [ ] **2열 워크스페이스**: 좌측 `ClientReferencePanel`(재무팩트/상담메모), 우측 `LawyerProposalDraft`(제안서 편집기)
- [ ] **변호사-직원 승인 워크플로**: 직원 작성 → 컨펌 요청 → 변호사 감수/승인/반려
- [ ] **사실관계 변경 시 기존 승인 자동 무효화 (`invalidateApprovalIfChanged`)**
- [ ] **코파일럿 감사 로그 (`copilotAuditService.ts`)** — 모든 수정/승인/반려 불변 기록
- [ ] **변호사법 제109조 직접 검수 서약 (`LawyerAttestationModal`)**
- [ ] **룰셋 관리 (`CopilotRuleSetManager.tsx`)** — 법원별 실무준칙/위험 플래그 기준 버전 관리, 수석변호사 결재 승인

#### 2-4-B. 6대 시각 분석 위젯 (`copilot/`)
- [ ] `AIRepaymentMatrix`: 3대 시나리오 (보수안 95%, 표준안 82%, 공격적안 58%)
- [ ] `CollateralPledgeSection`: 담보채권/별제권 부족액 안분표
- [ ] `CourtStatsRadar`: 전국 14개 법원별 인가율, 금지명령 속도, 코인/주식 준칙 비교
- [ ] `ExemptAssetBasket`: 민사집행법 제246조 압류금지재산 자동 바스켓
- [ ] `LegalQualificationChart`: 3대 법정 자격 요건 판정 차트 (라이프니츠 계수 반영)
- [ ] `SpecialCreditorRadar`: 편파변제, 최근 3개월 대출(사기죄), 조세 우선채권 레이더

#### 2-4-C. 제안서 작성 및 관리
- [ ] **원클릭 제안서 작성 (`LawyerProposalDraft.tsx`)** + 자동 임시저장 (`useProposalDraft`)
- [ ] **제안서 워크스페이스 (`ProposalWorkspace.tsx`)**
- [ ] **제안서 템플릿/수임료 프리셋/Q&A 스니펫 관리 (`TemplateManageModal`, `useProposalTemplates`)**
- [ ] **상담 스타일 프로필 (`ConsultStyleProfile.tsx`)** — 상담 어조(전문적/공감형/신속형), 전문용어 수준, 법령 출처 표기, 금지 광고 필터링

---

### 2-5. 영업 리드 관리 파이프라인 (`SalesLeadsTab.tsx`)
- [ ] **10대 영업 상태 칸반 보드** (신규인입, 1차부재, 2차부재, 상담예약, 계약진행, 수임완료, 보류, 부적격 등)
- [ ] **KPI 위젯 (`SalesDashboardWidget`)** — 영업 핵심 지표
- [ ] **빠른 처리(Quick Disposition)**: 원클릭 부재/재콜 스케줄러
- [ ] **리드 → 수임 의뢰인 원클릭 전환 (`LeadConversionModal`)** — 브리핑 카드 자동 생성
- [ ] **수수료 정산 룰셋/인센티브 자동 계산 (`leadService.ts`)**
- [ ] **신규 리드 단건 등록 (`NewLeadModal`)** — 칩 선택 기반 고속 입력
- [ ] **대량 엑셀 임포트 (`ImportLeadsModal`)** — 전화번호 중복방지
- [ ] **영업 설정 (`SalesSettingsModal`)** — 파트너사, 인입경로, 부재티어, 텔레그램 웹훅
- [ ] **상태 컬럼 보이기/숨기기 (`StatusVisibilityModal`)**
- [ ] **통화/SMS 통신 이력 (`CaseCallsSmsTab.tsx`)**
  - Web Audio 녹음 플레이어 (`CustomAudioPlayer`) — 재생속도 1x~2x, 타임스탬프
  - 통화 녹음 Google Drive 자동 업로드 및 매칭 (`GoogleDriveSettingsModal`)
  - **AI 통화 녹음 요약 (`CaseDetailAiSummary.tsx`, `aiCallSummaryService.ts`)** — Gemini 멀티모달 5단 구조화 요약 (사건개요/채무원인/가용소득/리스크/추천전략)
  - 텔레그램 단체방 자동 브리핑 전송
  - 통화/문서 내역 소명 증빙 TXT 다운로드

---

### 2-6. 6단계 & 13단계 파이프라인 엔진

#### 2-6-A. 파이프라인 상태 머신
- [ ] **13단계 상태 엔진 (`LegalFlowThirteenStepper.tsx`)** — 역주행 금지 락(Forward-only)
- [ ] **6단계 게이트 뷰 (`WorkflowPipelineStepper.tsx`)** — 기각/폐지 브랜치 분기

#### 2-6-B. Stage 1 — 상담/계약
- [ ] `Stage1ConsultationView`: **4대 사법 자격 진단** (채무한도 담보15억/무담보10억, 2026 생계비, 청산가치 보장, 제595조 기각사유 스크리닝)
- [ ] **스텔스 가명 → 본명 전환 게이트**
- [ ] `Stage1ContractView`: 수임계약 허브

#### 2-6-C. Stage 2 — 수임료/서류
- [ ] `Stage2ContractRetainerView`: **2026 법원 공과금**(인지대 30,000원, 송달료 기본10회분+채권자×8회분, 관재인예납금) 실시간 계산
- [ ] **표준 특약문구(`PRESET_SPECIAL_TERMS`) 주입기**
- [ ] `Stage2DocumentsHubView`: Phase 1(주민/동사무소) → Phase 2(금융/소득) → Phase 3(부채증명 대행) 분할 수집
- [ ] **택배 등기 추적번호 연동** (우체국/CJ/GS25)

#### 2-6-D. Stage 3 — 접수 서류/패키징
- [ ] `Stage3DocumentsHubView`: 미제출 서류 일괄 알림톡 (`BatchDocRequestModal`)
- [ ] `Stage3FilingBundleView`: **8대 대법원 서식 묶음(R01~R10)** + 금지명령(제593조)/중지명령 자동 작성 (`filingAutoDraftEngine`)
- [ ] **고속 캐러셀 서류 심사기 (`SpeedDocReviewModal`)** — 4포인트 검증 체크리스트
- [ ] **자동 초안 검토/승인 (`AutoDraftReviewSplitModal`)**

#### 2-6-E. Stage 4 — 보정 대응
- [ ] `Stage4CorrectionCenterView`: 법원 보정권고 14일 법정 마감 카운트다운
- [ ] `Stage4FilingBundleView`: 보정서 패키징

#### 2-6-F. Stage 5 — 후속 보정
- [ ] `Stage5CorrectionCenterView`: 추가 보정 대응
- [ ] `Stage5PostCareDischargeView`: 사후관리 전환

#### 2-6-G. Stage 6 — 사후관리/면책
- [ ] `Stage6PostCareDischargeView`: 법원 가상계좌 36개월 납입 추적, 채권자집회 출석 알림톡, **36회차 완납 → 제624조 면책신청서 자동 발송**

#### 2-6-H. 파이프라인 보조 컴포넌트
- [ ] **의뢰인 커뮤니케이션 사이드패널 (`ClientCommunicationSidePanel`)** — 4단 슬라이더 (알림톡/통화녹음/Google Drive/Gemini AI 음성 전사)
- [ ] **결정 요약 카드 (`DecisionSummaryCard`)** — SVG 도넛 탕감률/변제율, 가상계좌 복사, 1회차 변제일
- [ ] **알림톡 발송 확인 (`AlimtalkSendConfirmModal`)** — 변수 치환(#{고객명} 등) 및 SMS Failover
- [ ] **알림톡 템플릿 등록 (`AlimtalkTemplateRegisterModal`)** — Popbill 심사 등록

---

### 2-7. 80여 종+ 법원 전자소송 서식 마스터 허브

#### 2-7-A. 서식 레지스트리 & 추천 (`legalDocRegistry.ts`)
- [ ] **100여 종 법원 서식** — CORE/STAY_INJUNCT/SERVICE/CORRECTION/MODIFICATION/RELEASE/APPEAL 7대 카테고리
- [ ] **스마트 서식 추천 (`getSmartRecommendedDocs`)** — 사건 상태 기반 AI 추천
- [ ] **100종 발급 가이드 DB (`MASTER_ISSUANCE_GUIDE_DB`)** — 발급처, URL, 콜센터, 단계, 유효기간, 마스킹
- [ ] **서류 우선순위 비교 (`compareDocItemsPriority`)**
- [ ] **4대 카테고리별 필수 서류 템플릿 (`applicationDocTemplateService`)** — 급여/영업/파산/보정

#### 2-7-B. 법원 서식 위지윅 에디터 & 출력
- [ ] **LawPass 벤치마크 62% A4 캔버스 + 38% 사이드바 에디터 (`CourtDocSuiteViewerModal`)**
- [ ] **11종 법원 공식 서식 HTML 빌더 (`CourtFormHtmlBuilder.ts`)**: 개시신청서, 채권자목록, 재산목록, 수입지출목록, 진술서, 변제계획안, 소송위임장, 금지명령, 중지명령, 표지, 서류체크리스트
- [ ] **Canvas/jsPDF 법원 규격 PDF (`CourtFormPdfGenerator.ts`)**
- [ ] **서류 양식 모아보기/인쇄 (`CourtFormPreviewModal`)**

#### 2-7-C. 개시신청서 & 채권자 관리
- [ ] **전산양식 D5101 개시신청서 4탭 에디터 (`CourtPetitionEditModal`)** — 인적사항, 관할법원/신청이유, 송달영수인, 환급계좌
- [ ] **채권자목록 관리 (`CreditorManagementModal`)** — 200+ 금융기관 주소 자동완성 (`creditorAddressDirectory`), 우선권/별제권/일반채권 분류, CSV 내보내기
- [ ] **부수 신청서 (`AncillaryPetitionsModal`)** — 금지명령(제593조)/중지명령 자동 작성
- [ ] **소송위임장 생성 (`LitigationPowerOfAttorneyModal`)**

#### 2-7-D. 자동 초안 & 패키징
- [ ] **8대 핵심 서식 자동 초안 엔진 (`filingAutoDraftEngine.ts`)** — 위험 플래그 감사 + 변호사 승인 결재
- [ ] **전자소송 일괄 패키징 (`BatchFilingPackagingModal`)** — R01~R14 표준 슬롯 자동 정렬, 인지대/송달료 계산, ZIP/CSV
- [ ] **법원 전자소송 사이드바 (`LawPassCourtFilingSidebar`)**
- [ ] **문서 바인딩 엔진 (`documentTemplateEngine.ts`)** — 플레이스홀더 치환 + AI 초안 프롬프트

---

### 2-8. 변제계획안 & 부채증명서

#### 2-8-A. 변제계획안 엔진 (`RepaymentPlanEditor.tsx`)
- [ ] **대법원 코어 계산 엔진 (`repaymentCalculationEngine.ts`)**
  - 청산가치 보장의 원칙, 가용소득 제공 원칙
  - 우선채권 우선변제 2단계 안분
  - 라이프니츠 현가 계산 (36개월 계수 33.36)
  - 변제율 및 총 변제금 산출
- [ ] **9대 정밀 변제 튜닝 박스 (`RepaymentTuningBox.tsx`)**
  1. 우선권 채권(세금/4대보험) 18회/30회 우선 분할 배당
  2. 별제권(담보) 예상부족액 안분 (실무준칙 제411호)
  3. 압류적립금 1회차 투입 + 변제기간 단축
  4. 재산처분 승수 및 감가상각 튜닝
  5. 원금 100% 초과 시 이자변제 전환 모드
  6. 장래양육비 공제 + 성년도달 스텝업 증액
  7. 서울회생법원 원금 100% 조기완제 준칙
  8. 법원 보정권고 강제 월변제금 오버라이드
  9. (추가 커스텀 튜닝)
- [ ] **담보부채권 부족액 계산기 (`SecuredDebtCalculatorModal`)**
- [ ] **법원 제출 표준 월별 변제예정액표 엑셀 출력 (`repaymentExcelExporter.ts`)**
- [ ] **인쇄 (`PrintableRepaymentPlanModal`)**

#### 2-8-B. 재산목록 D5102 정밀 평가 (`PropertyValuationModal.tsx`)
- [ ] **5개 탭 평가 허브**
  1. `realestate`: 공시가격 130%, KB시세, 인터넷등기소 근저당 차감, 지분 평가
  2. `vehicle`: 자동차등록원부, 엔카/보험개발원 시세, 할부 저당 차감
  3. `deductions`: 2026 소액임차보증금 공제, 예금(185만/250만), 보험해약금(150만), 퇴직금(50%)
  4. `business`: 자영업 사업용 설비, 재고, 외상매출금
  5. `verification`: 총 청산가치 vs 총변제액 비교, 청산가치 보장 위반 실시간 감지
- [ ] **외부 포털 딥링크 (`assetSearchLinks.ts`)** — 정부24, 인터넷등기소, 위택스, 홈택스 등 10대 포털
- [ ] **변제계획안 원클릭 동기화 + R06 슬롯 자동 마운트**

#### 2-8-C. 수입·지출 D5103 에디터 (`IncomeExpenseModal.tsx`)
- [ ] 12개월 평균 영업/급여소득 원장
- [ ] 가족관계증명서 OCR 파싱 (`parseFamilyDocument`)
- [ ] 자영업/프리랜서/일용직 12개월 장부 (`incomeExpenseService.ts`)
- [ ] **인쇄 (`PrintableIncomeExpenseModal`)**

#### 2-8-D. 부채증명서 발급 대행 (`DebtCertificateTab.tsx`)
- [ ] 발급 대행사(원클릭, 윈어드민 등) 엑셀 양식 자동 변환
- [ ] ZIP 일괄 압축 패키징
- [ ] **발급 위임장 PDF 자동 생성 (`debtPowerOfAttorneyGenerator.ts`)**
- [ ] 발급된 부채증명서 분할 뷰어 + 채권자목록 실시간 동기화

---

### 2-9. 보정권고 대응 센터 (`ComprehensiveCorrectionCenter.tsx`)
- [ ] 보정명령 1차~N차 차수별 관리
- [ ] **법정 제출기한(14일) 실시간 카운트다운**
- [ ] **전국 회생법원 다빈도 7대 보정 소명표 원클릭 자동완성**
  1. 금융기관 계좌거래내역 소명표 (50만원 이상 출금처)
  2. 신용카드 사용내역 분류표
  3. 대출금 사용처 소명표
  4. 최근 취업자 급여 적정성 소명서
  5. 배우자 명의 재산 형성 기여도 소명서
  6. 주식/가상자산 손실금 청산가치 반영표
  7. 편파변제 환입 계획서
- [ ] **정식 보정서(Correction Brief) A4/PDF 출력 (`CorrectionBriefModal`)**

---

### 2-10. 전자 계약 시스템 & 도장·사인 센터

#### 2-10-A. 전자계약 종합 센터 (`ContractManagementTab.tsx`)
- [ ] **계약 라이프사이클**: 초안(`draft`) → 발송(`sent`) → 서명(`signed`) → 완료(`completed`) → 취소(`cancelled`)
- [ ] **골든타임 24시간 미서명 경고 배지**
- [ ] **4단계 계약 생성/편집 위저드 (`ContractWizard`)**
- [ ] **계약서 템플릿 서비스 (`contractTemplateService.ts`)**
  - 4대 표준 (개인회생/파산면책/법인회생/채무자대리인)
  - 20종 플레이스홀더 ({{CLIENT_NAME}}, {{TOTAL_FEE}} 등)
  - 변호사 커스텀 템플릿 CRUD
- [ ] **계약 문서 편집 (`ContractDocEditModal`)** — 특약사항 및 형광펜
- [ ] **계약 문서 라이브러리 (`ContractDocLibraryModal`)**
- [ ] **수임료 프리셋 관리 (`feePresetService.ts`)** — 기본형/급여소득자형/영업소득자형
- [ ] **원격 서명 요청 링크 생성 (`ClientSignShareModal`)** — 일회용 보안 서명 링크
- [ ] **서명 리마인더 (`ContractReminderModal`)** — 3대 템플릿(긴급/정중/만료) 알림톡/SMS
- [ ] **감사추적 인증서 (`AuditTrailCertificate`)** — SHA-256 해시체인, 전자서명법 제3조
- [ ] **공개 검증기 (`ContractPublicVerifierModal`)** — 블록체인 앵커 무결성 확인
- [ ] **변호사 확인서 (`LawyerAttestationModal`)**
- [ ] **무결성 해시/타임스탬프 토큰 (`integrityService.ts`)** — Triple Timestamp Token

#### 2-10-B. 인장/도장 스튜디오 (`SealStudioModal.tsx`)
- [ ] **5대 모드**
  1. `personal`: 8대 개인/변호사 프리셋, 한글→한자 자동 변환(`HANJA_MAP`), 4종 인주 색상, 스탬프 그런지 질감
  2. `corporate`: 8대 법인/로펌 프리셋, 외경(로펌명)+내경(대표변호사)+기호(★/●)
  3. `background-remover`: 사진/로고 누끼따기, 레드채널 세그멘테이션, 투명 PNG
  4. `signature`: 펜 굵기/색상/스무딩 자필 서명 캔버스 (`SignatureCanvas.tsx`)
  5. `settings`: 계약서/위임장/신청서 기본 날인 도장 지정
- [ ] **실물 서류 날인 시뮬레이션**
- [ ] **변호사 직인·로고 관리 (`LawyerSealManagerModal.tsx`)** — 인감/로고 업로드, 자동 스탬프

---

### 2-11. 개시결정 후 사후관리 & 폐지방어
- [ ] **사후관리 (`PostCommencementManagementModal`) — 4단계**
  1. 법원 가상계좌 36개월 납입 추적 + 3회 연체 폐지 위험 알림
  2. 채권자집회 이의진술 대비 + 기일 출석 안내 알림톡
  3. 채권조사확정재판 대응 (채권자 이의 방어)
  4. 36개월 완납 → 제624조 면책결정 신청
- [ ] **폐지방어 3대 신청서 (`RepealDefensePetitionModal`)**
  1. 변제계획 변경신청서 (제619조 — 실직/소득감소 하향)
  2. 특별면책 신청서 (제624조 제2항 — 불가항력 질병)
  3. 즉시항고장 (폐지결정 정본 14일 이내 불복)

---

### 2-12. 개인파산 전용 관리 (`BankruptcyManagementTab.tsx`)
- [ ] **6대 독립 파산 서브원장**
  1. `petition`: 파산·면책 동시신청서 (신청취지, 지급불능 소명)
  2. `statement`: 파산 진술서 + 제564조 8대 면책불허가사유 스크리닝 (도박/사기대출/편파변제/재산은닉)
  3. `creditors`: 비면책채권(세금/벌금/양육비) 구분 표기 채권자목록
  4. `assets`: 파산관재인 5대 조사재산 + 최근 2년 처분재산/보증금 반환금 사용처
  5. `living`: 생활상황표 + 조세공과금 체납현황표
  6. `docs`: 파산관재인 14종 필수 서류 허브 + 미제출사유서
- [ ] **대법원 표준 8대 정식 서식 일괄 인쇄/PDF (`PrintableBankruptcyPetitionModal`)**

---

### 2-13. 의뢰인 인증서 안전 금고 (`CertificateVaultCard.tsx` + `CertificateVaultModal.tsx`)
- [ ] **4개 서브탭**
  1. `npki`: 공동인증서(der/key) 보관, AES-256 암호화 비밀번호 복호화 게이트(열람 사유 필수), 30초 클립보드 자동 소거(`copyWithAutoZeroize`), 만료일 D-Day + 갱신 알림톡
  2. `financial`: 금융인증서(YesSign) 2자리 릴레이 인증 코드 발송/원격 승인 대기
  3. `audit`: 사법 감사추적 로그 (열람자/직함/사유/IP/타임스탬프 영구 보존)
  4. `consent`: 전자서명법 위임 동의서 (IP/기기정보/전자서명 서약문)
- [ ] **면책 확정 시 암호학적 영구 파기(Cryptographic Shredding)** + 파기 증명서 발급

---

### 2-14. 고객 서류 동기화 & 알림톡 관제
- [ ] 모바일 서류 작성 요청 (`BatchDocRequestModal`)
- [ ] 의뢰인 서류 제출 상태 모니터링 (Requested → In Progress → Submitted → Approved/Rejected)
- [ ] 고객 모바일 진술서 동기화 (`ClientStatementSyncModal`)
- [ ] **18종 사건 마일스톤별 자동 알림톡 트리거 (`triggerAlimtokOnStatusChange`)**
- [ ] 일괄 문자 발송 (`BulkMessageSendModal`)
- [ ] 실물 등기 송장번호 추적 (`carrierTracking.ts`) — 우체국/CJ대한통운/로젠 URL 자동 생성
- [ ] **서류 양식 에디터 (`DocFormEditorModal`, `ApplicationDocSettingsModal`)**

---

### 2-15. 수임료 분납 관리 & 세금계산서
- [ ] **분납 캘린더 (`FeeSettlementCalendarView.tsx`)** — D-Day 및 연체일수(D+N)
- [ ] **분납 독촉 알림톡 (`FeeAlimtokModal`)**
- [ ] **수임료 분납 스케줄 생성 (`FeeScheduleCreateModal`)**
- [ ] **수임료 알림 설정 (`FeeNotificationSettingsModal`)**
- [ ] **이탈 사유 관리 (`DropOffReasonModal`)**
- [ ] **팝빌 전자세금계산서 (`taxInvoiceService.ts`)**
  - 정발행, 수정세금계산서(마이너스/금액변동), 국세청 전송 상태 확인
  - 뷰어 URL 연동, 이메일 재발송, 엑셀 다운로드
  - **국세청 사업자등록 진위확인 (`ntsService.ts`)** — 과세유형(일반/간이/면세/휴·폐업) 실시간 검증

---

### 2-16. 로펌 팀원 & 캘린더 & 내부 메신저
- [ ] **5대 RBAC 역할 체계 (`StaffManagementTab.tsx`)** — Owner/Lawyer/Consultant/Paralegal/Custom
- [ ] **권한 즉시 철회(세션 무효화)** + 퇴사자 사건 일괄 이관
- [ ] **초대 토큰 보안 발급 (`inviteService.ts`)** — 7일 만료 일회용 초대 링크
- [ ] **배정 지시서 (`AssignmentDirectiveModal`)**
- [ ] **다중 기기 세션 차단 (`DeviceSessionManager.tsx`)**
- [ ] **로펌 캘린더 일정 관리 (`calendarEventService.ts`)**
  - 법원 기일/보정기한/상담 일정, 반복(매일/매주/격주/매월), 알림(10분~1일 전)
  - 직급/공개범위(로펌전체/변호사만/개인)별 접근 제어
- [ ] **작업 일정 & 업무 패키지 (`TasksScheduleTab.tsx`)**
  - 사건 단계별 **7종 표준 업무 패키지 템플릿 (`TASK_PACKAGE_TEMPLATES`)** — 법정 공휴일/주말 보정 기일 계산기
  - 티켓 기반 작업 관리 (`TaskTicketTab.tsx`) — 칸반/리스트, 서브태스크, 마감일 경고
  - **2단계 검토 승인**: 담당자 → 검토요청(`review_requested`) → 변호사 승인/반려 → 완료
- [ ] **로펌 내부 메신저 (`InternalThreadTab.tsx`)**
  - @멘션, 댓글/답글 스레드, 중요 메시지 고정, 공지/사건 협업
  - 역할별 열람 제한
- [ ] **대법원 나의사건 실시간 연동 (`CourtCaseTab.tsx`)**
  - 다중 사건 추적: 본안(개회), 금지명령(개금), 중지명령(개중), 타채
  - 보정명령/결정문 도달 시 CRM/캘린더 자동 이벤트 추출
- [ ] **데이터 백업 (`DataBackupSection.tsx`)** — Owner 전용 전체 DB JSON 암호화 백업 + 엑셀 내보내기
- [ ] **변호사 프로필 에디터 (`LawyerProfileEditor.tsx`)**
- [ ] **변호사 Q&A 답변 (`LawyerQnAAnswerSection.tsx`)**
- [ ] **관리자 문의 (`LawyerInquiryTab.tsx`)**
- [ ] **외부 의뢰인 등록 (`ExternalClientModal`)**
- [ ] **사건 가져오기/내보내기 (`ImportCasesModal`, `ExportCasesModal`)** — xlsx-js-style 안전 파싱 + 3단계 위저드
- [ ] **CRM 설정 (`CrmSettingsModal`)** — 유입 경로, 제휴사, 상태 단계(1차/2차/3차), 텔레그램 알림방

---

<br/>

# PART 3. 🛡️ [통합 어드민] Platform Super Admin Checklist

---

### 3-1. 제로트러스트 보안 & 접근 제어
- [ ] **가짜 어드민 허니팟 트랩 (`HoneypotAdminLogin.tsx`)**
  - IP/User-Agent/시도 계정 로깅 + 2.5초 Tarpit 응답 지연 (`honeypotService.ts`)
- [ ] **시크릿 관리자 경로 (`ADMIN_SECRET_ROLE`)** — `VITE_ADMIN_SECRET_PATH` 환경변수
- [ ] **관리자 OTP 2단계 인증 (`otpService.ts`)**
  - 6자리 OTP 발급 → Gmail SMTP 전송 → 3분 만료 + 5회 재시도 제한
- [ ] **글로벌 세션 모니터 (`GlobalSessionMonitor.tsx`)** — 원클릭 강제 로그아웃
- [ ] **불변 감사 로그 (`auditService.ts`)**
  - 관리자 접속/실패/잠금, 의뢰인 열람, 민감문서 다운로드, 진단 제출 이벤트 영구 기록

---

### 3-2. 플랫폼 총괄 대시보드 (KPI Overview)
- [ ] **전사 비즈니스 핵심 지표** — 유입 수, 진단 완료, 상담 신청, 계약 체결, 총액, 수수료 매출
- [ ] **변호사별 수임 실적 랭킹** — 응답 속도, 수락률, 만족도
- [ ] **전사 활동 감사 로그** (`activityLogService.ts`)
- [ ] **수익 총괄 대시보드 (`BillingOverviewDashboard.tsx`)**
- [ ] **AdminRole 9대 탭**: dashboard, clients, lawyers, billing, contents, settings, members, security, marketing
- [ ] **Billing 7대 서브탭**: overview, active, exited, adorders, taxinvoice, alimtalk, blockchain

---

### 3-3. 의뢰인 & 상담 DB 총괄 관제
- [ ] **전체 인테이크 DB 통합 뷰어** — UTM 파라미터별 접수 현황
- [ ] **장기 미응답 고객 구제 및 강제 재배정**
- [ ] **휴지통 관리** (`softDeleteCrmClient`, `restoreCrmClient`, `cleanupRecycleBin`)
- [ ] **회원 관리 (`memberService.ts`)** — 승인/대기/정지 상태 CRUD

---

### 3-4. 변호사 입점 심사 & 광고 관리
- [ ] **변호사 신규 가입 심사** — 변협 등록번호/신분증/사업자등록증
- [ ] **변호사 상태 제어** (활성/일시정지/탈퇴)
- [ ] **광고 상품 주문/입금 승인 (`adOrderService`)** + 텔레그램 알림 + 리액티브 이벤트 버스

---

### 3-5. 3대 인프라 통합 관제
- [ ] **① 팝빌 전자세금계산서 관제 (`api/invoice.js`)**
  - 정발행, 수정세금계산서, 국세청 전송 상태 코드, 뷰어 URL 연동
- [ ] **② 카카오 알림톡 관제 (`AlimtalkControlCenter.tsx`)**
  - 팝빌 잔여 포인트 실시간 조회
  - 등록 템플릿 심사 상태, 테스트 발송 파이프라인
  - 카톡 미설치자 SMS/LMS Failover 자동 대체
  - Multi-Tier Rate Limiting (Strict) + Cloudflare Turnstile 봇 방어
- [ ] **③ 블록체인 계약 관제 (`BlockchainContractControlCenter.tsx`)**
  - Polygon PoS(메인넷)/Amoy(테스트넷) 앵커링
  - 블록체인 네트워크 설정 (`BlockchainConfigModal.tsx`) — RPC/프라이빗 키/네트워크 전환
  - **서킷 브레이커 동결/해제** (`freezeCircuitBreaker`, `unfreezeCircuitBreaker`)
  - QR 검증 코드 생성

---

### 3-6. 콘텐츠 CMS & 플랫폼 정책
- [ ] **7대 콘텐츠 CMS (`cmsService.ts`)** — 뉴스, FAQ, 후기, 배너, 공지, 고객문의, 변호사문의 (7개 Supabase 테이블)
- [ ] **팝업 배너 관리 (`PopupContainer`)** — 오늘 하루 보지 않기
- [ ] **플랫폼 기준표 (`RehabSettingsPanel.tsx`)** — 최저생계비, 회생위원 기준, 관할 법원
- [ ] **플랫폼 글로벌 설정 (`platformConfigService.ts`)** — 쿨다운/팝업/2026 기준 중위소득 동기화

---

### 3-7. 마케팅 오토파일럿 허브 (`MarketingAutopilotHub.tsx`)
- [ ] **Gemini AI 네이버 블로그 SEO 최적화 글 자동 생성 (`marketingAiService.ts`)**
- [ ] **Pollinations AI 이미지 자동 생성**
- [ ] **20종+ 회생·파산 법률 프리셋 (`DDOK_BLOG_PRESETS_DATA`)** 내장
- [ ] **스마트에디터 맞춤 포맷 출력**

---

<br/>

# PART 4. 🔧 [공통 인프라] 서비스 & 보안 Checklist

---

### 4-1. 서버리스 API 보안 인프라 (`api/_lib/`)
- [ ] **인증 미들웨어 (`auth-middleware.js`)** — Supabase Service Role Bearer 토큰 검증, `X-Request-ID`, 분당 60회 Rate Limit
- [ ] **Strict CORS 화이트리스트 (`cors-helper.js`)** — 와일드카드 배제, `mykim.kr`/`vercel.app` 한정
- [ ] **다단계 Rate Limiter (`rate-limiter.js`)** — STRICT/STANDARD/RELAXED 3-Tier, 1분/10분/30분 슬라이딩 윈도우, 30분 위반자 격리(Jail), 비상 서킷 브레이커
- [ ] **Cloudflare Turnstile 봇 방어 (`turnstile-validator.js`)** — 서버 측 토큰 검증
- [ ] **팝빌 SDK 싱글톤 (`popbill-service.js`)** — 공급자 정보 초기화

---

### 4-2. 서버리스 API 엔드포인트 (11개)
| # | 엔드포인트 | 기능 | 외부 연동 |
|:-:|:---|:---|:---|
| 1 | `api/alimtok.js` | 카카오 알림톡 + SMS/LMS Failover + 잔여 포인트 + 템플릿 조회 | Popbill SDK |
| 2 | `api/benefits.js` | 공적 복지 혜택 조회 (16대 공적제도) + 1시간 캐싱 | 공공데이터포털 |
| 3 | `api/contract.js` | 블록체인 SHA-256 앵커링 + RPC 상태 + 온체인 검증 + 서킷 브레이커 | Polygon/Viem |
| 4 | `api/debt-discovery.js` | 4대 기관 채무/체납/계좌 전수조회 + 간편인증 | CODEF API |
| 5 | `api/generate-statement.js` | Gemini AI 법원 4단 진술서 자동 작성 | Gemini 2.5 Flash |
| 6 | `api/invoice.js` | 전자세금계산서 정발행/수정/뷰어/이메일 + `withAuth` | Popbill SDK |
| 7 | `api/ocr-case.js` | 법원 결정문 멀티모달 OCR (10MB DoS 방어) | Gemini Flash Vision |
| 8 | `api/ocr-family.js` | 주민등록표/가족관계증명서 OCR + 만 나이/부양가족 판별 | Gemini Flash Vision |
| 9 | `api/scourt-proxy.js` | 대법원 나의사건검색 스크래핑 중계 | CODEF B2B |
| 10 | `api/send-email.js` | Gmail SMTP 발송 (OTP/고객 알림) + Strict Rate Limit | Nodemailer |
| 11 | `api/telegram.js` | Telegram Bot + Slack Webhook 듀얼 알림 + SSRF 방어 | Telegram/Slack |

---

### 4-3. 암호화 & 보안 유틸리티
- [ ] **AES-256-GCM 필드 레벨 암호화 (`cryptoField.ts`)** — DB 민감 데이터
- [ ] **AES-256-GCM 인증서 볼트 (`certificateVaultService.ts`)** — 30초 클립보드 자동 삭제, Zeroize
- [ ] **HMAC 서명 세션 토큰 (`secureSession.ts`)** — 위변조 검증
- [ ] **난독화 보안 스토리지 (`secureStorage.ts`)**
- [ ] **분산 트레이싱 (`tracking.ts`)** — `X-Request-ID` HTTP 헤더 주입
- [ ] **기기 탐지 (`deviceDetector.ts`)** — OS/브라우저/기기 유형 판별 + UUID

---

### 4-4. 옴니채널 알림 시스템 (`notificationService.ts`)
- [ ] **텔레그램 봇** — 신규 상담/광고 주문 카드 서식 렌더링
- [ ] **Gmail SMTP** — 관리자 OTP 및 고객 알림 발송
- [ ] **Slack 웹훅** — 듀얼 알림 중계 및 SSRF 방어
- [ ] **브라우저 웹 푸시** — Web Push API
- [ ] **카카오 알림톡/SMS Failover** — 18종 마일스톤별 템플릿 자동 컴파일

---

### 4-5. 커스텀 훅 (7개)
- [ ] `useCopilotPermissions`: AI Copilot 역할 기반 접근 제어
- [ ] `usePageMeta`: 브라우저 `document.title` 동적 변경
- [ ] `usePermissions`: 스태프 역할별 탭/액션 권한 판정
- [ ] `useProposalDraft`: 제안서 초안 디바운스 임시저장/복구
- [ ] `useProposalTemplates`: 의견서 템플릿/수임료 프리셋/Q&A 스니펫 CRUD
- [ ] `useSessionGuard`: 30분 미활동 감시, 다중 탭 원격 로그아웃, 세션 무결성
- [ ] `useSpeechRecognition`: Web Speech API 래퍼, 실시간 STT, 무음 감지

---

### 4-6. 외부 API 연동 총괄표
| 서비스 | 연동 서비스 파일 | API 엔드포인트 | 용도 |
|:---|:---|:---|:---|
| **Google Gemini 2.5 Flash** | `statementAiService`, `aiCallSummaryService`, `marketingAiService` | `generativelanguage.googleapis.com` | 진술서 AI/통화 녹음 요약/블로그 자동 작성 |
| **Gemini Vision** | `api/ocr-case.js`, `api/ocr-family.js`, `companionService` | `generativelanguage.googleapis.com` | 결정문 OCR, 가족관계증명서 OCR |
| **PortOne V2** | `portoneService.ts` | `api.portone.io` | 본인인증 (PASS/카카오/토스/SMS) |
| **Popbill** | `taxInvoiceService`, `alimtokService` | `api/invoice.js`, `api/alimtok.js` | 전자세금계산서, 카카오 알림톡 |
| **CODEF B2B** | `scourtService`, `debtDiscoveryService` | `api/scourt-proxy.js`, `api/debt-discovery.js` | 대법원 사건 조회, 채무 전수조회 |
| **Polygon PoS** | `blockchainAnchorService` | `api/contract.js` | 전자계약 블록체인 앵커링 |
| **공공데이터포털** | `ntsService`, `companionService` | `apis.data.go.kr` | 사업자 진위확인, 공적 복지 조회 |
| **Pollinations AI** | `marketingAiService` | `image.pollinations.ai` | 블로그 이미지 자동 생성 |
| **Telegram Bot API** | `notificationService` | `api.telegram.org` | 실시간 알림 중계 |
| **Google Apps Script** | `communicationService` | `script.google.com` | 통화 녹음 Drive 업로드 |
| **국민연금공단** | `jobHistoryService` | CODEF 스크래핑 | 직장 경력 조회 |

---

<br/>

# PART 5. 🚦 프로덕션 최종 런칭 게이트 (Launch Gate Check)

| 단계 | 점검 영역 | 핵심 검증 항목 | 담당 | 판정 |
|:---:|:---|:---|:---:|:---:|
| **G1** | 데이터베이스 보안 | Supabase RLS 활성화 — 타인 데이터 접근 격리 | 백엔드 | [ ] |
| **G2** | 환경변수 분리 | `VITE_SUPABASE_*`, `VITE_PORTONE_*`, `VITE_ADMIN_SECRET_PATH` 주입 | 데브옵스 | [ ] |
| **G3** | 포트원 실운영 | 테스트 → 라이브 상점 키 전환 | 백엔드 | [ ] |
| **G4** | 팝빌 실운영 | 테스트 → 실운영 LinkID/SecretKey 전환 | 재무/백엔드 | [ ] |
| **G5** | 카카오 비즈메시지 | 발신번호 가입증명원 제출 + 18종 템플릿 검수 승인 | 마케팅 | [ ] |
| **G6** | 텔레그램/이메일 | `api/telegram.js`, `api/send-email.js` 발송 테스트 완료 | 운영 | [ ] |
| **G7** | 빌드 무결성 | `npm run build` TypeScript 컴파일 에러 0건 | 프론트엔드 | [ ] |
| **G8** | SEO 등록 | 네이버 서치어드바이저 + 구글 서치콘솔 `sitemap.xml` 제출 | 마케팅 | [ ] |
| **G9** | Gemini API 키 | `VITE_GEMINI_API_KEY` 프로덕션 키 + 할당량 확인 | 백엔드 | [ ] |
| **G10** | CODEF API | 대법원 스크래핑/채무조회 실운영 인증 키 전환 | 백엔드 | [ ] |
| **G11** | Polygon RPC | 메인넷 RPC URL + 프라이빗 키 환경변수 주입 | 백엔드 | [ ] |
| **G12** | CORS 화이트리스트 | `cors-helper.js`에 프로덕션 도메인(`mykim.kr`) 등록 | 보안 | [ ] |
| **G13** | Rate Limiter | 프로덕션 서킷 브레이커 초기 `unfrozen` 확인 | 보안 | [ ] |
| **G14** | 공공데이터포털 | 국세청 사업자 진위확인 + 행안부 공공서비스 인증 키 | 백엔드 | [ ] |
| **G15** | 정적 페이지 | `about.html`, `check.html`, `faq.html`, `robots.txt`, `sitemap.xml`, `tos.html`, `privacy.html`, `legal.html` | QA | [ ] |
| **G16** | 법률 칼럼 | `articles/` 하위 8개 SEO 칼럼 렌더링 확인 | QA | [ ] |
| **G17** | 캐시/성능 | 서버리스 API 1시간 캐싱(`benefits.js`), 대법원 캐싱(`scourtService`) 정상 동작 | 백엔드 | [ ] |

---

**문서 작성 완료:** 2026-09-20 v2.1 Final  
**전수 분석 규모:** 서비스 52개 + 클라이언트 32개 + 변호사 150개+ + API 11개 + 유틸리티 14개 + 훅 7개  
**작성 주체:** 마이김변 런칭 TF (Launch Readiness Task Force)
