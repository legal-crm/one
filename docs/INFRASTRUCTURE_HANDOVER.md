# 🏗️ 마이김변(MyKimLaw) 외부 인프라 & 연동 구조 인수인계 문서
**Document Version:** 1.0.0  
**작성일:** 2026-09-20  
**목적:** 플랫폼 운영에 필요한 모든 외부 서비스, 계정, 환경변수, API 키를 한눈에 파악하여 인수인계 시 즉시 운영 가능하도록 정리

---

## 📋 목차
1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [GitHub 저장소](#2-github-저장소)
3. [Vercel 배포 인프라](#3-vercel-배포-인프라)
4. [Supabase 데이터베이스 & 인증](#4-supabase-데이터베이스--인증)
5. [Popbill (팝빌) — 알림톡 & 전자세금계산서](#5-popbill-팝빌--알림톡--전자세금계산서)
6. [Google Gemini AI — 진술서·OCR·통화요약·마케팅](#6-google-gemini-ai)
7. [PortOne (포트원) — 본인인증](#7-portone-포트원--본인인증)
8. [CODEF — 대법원 사건조회 & 채무 전수조회](#8-codef--대법원-사건조회--채무-전수조회)
9. [Polygon Blockchain — 전자계약 블록체인 앵커링](#9-polygon-blockchain--전자계약-블록체인-앵커링)
10. [Telegram & Slack — 실시간 알림](#10-telegram--slack--실시간-알림)
11. [Google Drive / Apps Script — 통화 녹음 업로드](#11-google-drive--apps-script)
12. [Cloudflare Turnstile — 봇 방어](#12-cloudflare-turnstile--봇-방어)
13. [Pollinations AI — 이미지 생성](#13-pollinations-ai--이미지-생성)
14. [공공데이터포털 — 국세청 & 복지 API](#14-공공데이터포털--국세청--복지-api)
15. [Gmail SMTP — 이메일 발송](#15-gmail-smtp--이메일-발송)
16. [도메인 & DNS & CORS 보안](#16-도메인--dns--cors-보안)
17. [환경변수 종합 체크리스트](#17-환경변수-종합-체크리스트)
18. [Supabase 테이블 목록 (46개)](#18-supabase-테이블-목록)
19. [npm 패키지 의존성](#19-npm-패키지-의존성)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                    mykim.kr (프로덕션 도메인)                      │
│                    www.mykim.kr → 301 리다이렉트                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐ │
│   │  React SPA  │────▶│ Vercel Edge/CDN  │────▶│ Vercel       │ │
│   │  (Vite 빌드) │     │ (정적 호스팅)      │     │ Serverless   │ │
│   │             │     │                  │     │ Functions    │ │
│   └──────┬──────┘     └──────────────────┘     │ (api/*.js)   │ │
│          │                                      └──────┬──────┘ │
│          │  클라이언트 직접 호출                          │         │
│          │                                      서버 측 호출     │
│          ▼                                              ▼       │
│   ┌─────────────┐   ┌──────────┐   ┌──────────────────────────┐│
│   │  Supabase   │   │ PortOne  │   │ 외부 API 서비스              ││
│   │ ─ DB (46T)  │   │ 본인인증   │   │ ─ Popbill (알림톡/세금계산서)  ││
│   │ ─ Auth      │   │          │   │ ─ Gemini AI (OCR/AI 생성)    ││
│   │ ─ Realtime  │   └──────────┘   │ ─ CODEF (대법원/채무조회)      ││
│   └─────────────┘                  │ ─ Polygon (블록체인 앵커링)    ││
│                                    │ ─ Telegram/Slack (알림)      ││
│   ┌─────────────┐                  │ ─ Gmail SMTP (OTP/이메일)    ││
│   │ Cloudflare  │                  │ ─ 공공데이터포털 (복지/국세청)   ││
│   │ Turnstile   │                  │ ─ Google Drive (녹음 업로드)  ││
│   │ (봇 방어)    │                  │ ─ Pollinations (이미지 생성)  ││
│   └─────────────┘                  └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. GitHub 저장소

| 항목 | 값 |
|:---|:---|
| **원격 저장소** | `https://github.com/legal-crm/one.git` |
| **GitHub 계정/조직** | `legal-crm` (Organization) |
| **기본 브랜치** | `main` |
| **로컬 경로** | `c:\Users\JSH\Downloads\legal-crm---회생파산-상담-플랫폼\` |
| **프레임워크** | React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS 4 |

### 주요 스크립트 (`package.json`)
```bash
npm run dev      # 로컬 개발 서버 (포트 3000, --host=0.0.0.0)
npm run build    # 프로덕션 빌드 (Vite)
npm run preview  # 빌드 결과 미리보기
npm run lint     # TypeScript 타입 검사 (tsc --noEmit)
npm run clean    # dist 및 server.js 삭제
```

### 배포 규칙 (`.agents/AGENTS.md`)
```powershell
# "배포해" 명령 시 GitHub + Vercel 동시 배포
$env:GITHUB_TOKEN = ""; git add . && git commit -m "메시지" && git push
vercel --prod
```
> ⚠️ `$env:GITHUB_TOKEN = "";`를 반드시 앞에 붙여 Antigravity 더미 토큰이 gh CLI 인증을 덮어쓰는 문제를 방지

---

## 3. Vercel 배포 인프라

| 항목 | 값 |
|:---|:---|
| **Vercel Project ID** | `prj_x1dxE2bDb54V9MYSakveihRHNi2t` |
| **Vercel Org ID** | `team_eA4ANWnUgpnoe6CtrZrzcMS2` (조직명: `mykim`) |
| **Project Name** | `legal-crm` |
| **기본 배포 URL** | `https://legal-crm-xi.vercel.app` |
| **프로덕션 도메인** | `https://mykim.kr` |
| **프레임워크 설정** | Vite (`vercel.json`: `"framework": "vite"`) |
| **출력 디렉토리** | `dist` |

### Vercel 서버리스 함수 (11개, `api/` 디렉토리)
| 파일 | 기능 |
|:---|:---|
| `api/alimtok.js` | 카카오 알림톡 + SMS/LMS Failover + 포인트 조회 |
| `api/invoice.js` | 전자세금계산서 발행/수정/조회 |
| `api/contract.js` | 블록체인 계약 앵커링/검증/서킷브레이커 |
| `api/debt-discovery.js` | 4대 기관 숨은 채무 전수조회 |
| `api/scourt-proxy.js` | 대법원 나의사건검색 스크래핑 중계 |
| `api/generate-statement.js` | Gemini AI 법원 진술서 자동 작성 |
| `api/ocr-case.js` | 법원 결정문 Vision OCR |
| `api/ocr-family.js` | 가족관계증명서 Vision OCR |
| `api/send-email.js` | Gmail SMTP 이메일 발송 |
| `api/telegram.js` | Telegram Bot + Slack Webhook 알림 |
| `api/benefits.js` | 공공데이터포털 복지 혜택 조회 |

### 보안 헤더 (`vercel.json`)
- `X-Frame-Options: DENY` — 클릭재킹 방지
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — HSTS
- CSP 정책: Supabase, PortOne, Google, Kakao, Cloudflare 화이트리스트

---

## 4. Supabase 데이터베이스 & 인증

| 항목 | 값 |
|:---|:---|
| **Supabase URL** | `https://xgmmvpmoyywpttuslwkh.supabase.co` |
| **Supabase Anon Key** | `.env` 파일 L2에 설정 (JWT 토큰) |
| **인증 방식** | OAuth (Google/Kakao) + 이메일/비밀번호 |
| **Auth Flow** | `implicit` (기본값, `VITE_SUPABASE_FLOW_TYPE`으로 `pkce` 전환 가능) |
| **세션 저장** | `sessionStorage` (브라우저 종료 시 자동 만료) |
| **테이블 수** | **46개** (아래 18번 항목 참조) |
| **구현 파일** | `src/supabaseClient.ts` |

### Supabase 보안 특이사항
- **sessionStorage 어댑터**: `localStorage` 대신 `sessionStorage` 사용 — 브라우저 종료 시 세션 즉시 만료
- **noOpLock**: 모바일/소셜 로그인 시 `navigator.locks.request()` 영구 대기 방지
- **getAuthHeaders()**: 서버리스 함수 호출 시 Bearer 토큰 자동 주입
- **서버리스 인증**: `api/_lib/auth-middleware.js`에서 `SUPABASE_SERVICE_ROLE_KEY`로 RLS 우회 토큰 검증

---

## 5. Popbill (팝빌) — 알림톡 & 전자세금계산서

| 항목 | 값 |
|:---|:---|
| **서비스** | ① 카카오 알림톡(ATS) + SMS/LMS Failover ② 전자세금계산서 |
| **LinkID** | `MONSTERLAB` |
| **사업자등록번호** | `5213901355` (몬스터랩) |
| **User ID** | `mykim99` |
| **카카오 채널** | `@마이김변` |
| **발신번호** | `01026060357` |
| **담당자 이메일** | `2882@daum.net` |
| **SDK** | `popbill` v1.64.2 (Node.js) |
| **구현 파일** | `api/_lib/popbill-service.js`, `api/alimtok.js`, `api/invoice.js` |

### 팝빌 제공 기능
| 기능 | API 엔드포인트 | 설명 |
|:---|:---|:---|
| 알림톡 발송 | `POST /api/alimtok` | 카카오톡 미수신 시 SMS/LMS 자동 대체 (`altSendType: 'C'`) |
| 잔여 포인트 | `GET /api/alimtok?action=status` | 팝빌 잔여 포인트 및 채널 상태 |
| 템플릿 조회 | `GET /api/alimtok?action=templates` | 승인된 템플릿 목록 |
| 세금계산서 발행 | `POST /api/invoice?action=issue` | 즉시 정발행 |
| 수정세금계산서 | `POST /api/invoice?action=modify` | 취소/환불/감액 |
| 사업자 검증 | `POST /api/invoice?action=check-corp` | 거래처 사업자번호 유효성 |
| PDF 뷰어 | `GET /api/invoice?action=pdf` | 팝빌 웹 뷰어 URL |

### 필요 환경변수
```bash
POPBILL_LINK_ID="MONSTERLAB"
POPBILL_SECRET_KEY="<팝빌 연동 비밀키>"
POPBILL_CORP_NUM="5213901355"
POPBILL_USER_ID="mykim99"
POPBILL_PLUS_FRIEND_ID="@마이김변"
POPBILL_SENDER_PHONE="01026060357"
POPBILL_CONTACT_EMAIL="2882@daum.net"
POPBILL_IS_TEST="false"     # "true"=테스트, "false"=운영
```

---

## 6. Google Gemini AI

| 항목 | 값 |
|:---|:---|
| **SDK** | `@google/genai` v2.4.0 |
| **API 엔드포인트** | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| **인증** | API Key 쿼리스트링 (`?key=...`) |

### 사용 모델 및 용도
| 모델 | 용도 | 구현 파일 |
|:---|:---|:---|
| `gemini-2.5-flash` | 법원 진술서 AI 작성/윤문 | `api/generate-statement.js`, `src/services/statementAiService.ts` |
| `gemini-2.5-flash` | 가족관계증명서/자격득실확인서 OCR | `api/ocr-family.js`, `src/services/jobHistoryService.ts` |
| `gemini-2.5-flash` | 네이버 블로그 SEO 마케팅 칼럼 생성 | `src/services/marketingAiService.ts` |
| `gemini-3.6-flash` | 법원 결정문/접수증 고정밀 Vision OCR | `api/ocr-case.js` |
| `gemini-3.5-transcribe` | 통화 녹음 화자분리 STT + 5단 요약 | `src/services/aiCallSummaryService.ts` |

### 필요 환경변수
```bash
# 서버리스 (Vercel)
GEMINI_API_KEY="<Google AI Studio에서 발급>"

# 프론트엔드 (Vite) — 클라이언트 직접 호출 시
VITE_GEMINI_API_KEY="<동일 키 또는 별도 키>"
```
> 키 미설정 시 스마트 룰베이스 폴백 또는 `localStorage.getItem('lm_geminiApiKey')` 사용자 직접 입력 모드로 전환

---

## 7. PortOne (포트원) — 본인인증

| 항목 | 값 |
|:---|:---|
| **버전** | PortOne V2 |
| **Store ID** | `store-6dc40c8f-40cb-41c8-95be-36ddaf8467d0` |
| **Channel Key** | `channel-key-6d8962ba-a8fd-4b92-aa46-7b0b17c67489` |
| **SDK** | `https://cdn.portone.io/v2/browser-sdk.js` |
| **REST API** | `https://api.portone.io/identity-verifications/{id}` |
| **구현 파일** | `src/services/portoneService.ts` |

### 지원 인증 수단
- PASS 앱 간편인증 (통신 3사)
- SMS 6자리 OTP
- 카카오페이 전자서명
- 토스 전자서명

### 필요 환경변수
```bash
VITE_PORTONE_STORE_ID="store-6dc40c8f-40cb-41c8-95be-36ddaf8467d0"
VITE_PORTONE_CHANNEL_KEY="channel-key-6d8962ba-a8fd-4b92-aa46-7b0b17c67489"
VITE_PORTONE_API_SECRET="<포트원 콘솔에서 발급>"  # 선택
```

---

## 8. CODEF — 대법원 사건조회 & 채무 전수조회

| 항목 | 값 |
|:---|:---|
| **인증** | OAuth2 Client Credentials (Bearer 토큰) |
| **토큰 발급** | `POST https://oauth.codef.io/oauth/token` |
| **운영 API** | `https://api.codef.io/v1/kr/public/ck/...` |
| **테스트 API** | `https://development.codef.io/v1/kr/public/ck/...` |
| **구현 파일** | `api/scourt-proxy.js`, `api/debt-discovery.js` |

### 제공 기능
| 기능 | 설명 |
|:---|:---|
| 대법원 나의사건검색 | 사건 진행, 기일, 송달, 납부 내역 스크래핑 |
| 숨은 채무 전수조회 | 신용정보원, 금융결제원, 국세청, 대법원 4대 기관 |

### 비용 절감 캐싱 전략
- 면책/종결 사건: 7일 캐시
- 인가 후 변제 중: 3일 캐시
- 활성 사건: 24시간 캐시

### 필요 환경변수
```bash
CODEF_CLIENT_ID="<CODEF 클라이언트 ID>"
CODEF_CLIENT_SECRET="<CODEF 클라이언트 시크릿>"
CODEF_ENV="production"   # 또는 "development"
```

---

## 9. Polygon Blockchain — 전자계약 블록체인 앵커링

| 항목 | 값 |
|:---|:---|
| **네트워크** | Polygon PoS Mainnet (Chain 137) / Amoy Testnet (Chain 80002) |
| **스마트 컨트랙트** | `0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1` |
| **메인넷 RPC** | `https://polygon.drpc.org` (기본값) |
| **테스트넷 RPC** | `https://polygon-amoy.drpc.org` (기본값) |
| **라이브러리** | `viem` v2.56.3 |
| **구현 파일** | `api/contract.js`, `src/services/blockchainAnchorService.ts` |

### 작동 방식
1. 전자계약 체결 → SHA-256 해시 생성
2. Relayer 지갑이 가스비(POL) 대납하여 해시를 온체인 트랜잭션 Data 필드에 영구 기록
3. Polygonscan에서 트랜잭션 조회로 무결성 입증 가능

### 안전망
- 릴레이어 키 미등록/가스비 부족 시 → 블록 높이 기반 암호학적 타임스탬프로 무중단 전환
- 서킷 브레이커: 무인가 호출 폭주 시 30분 자동 동결

### 필요 환경변수
```bash
POLYGON_NETWORK="mainnet"          # 또는 "amoy"
POLYGON_MAINNET_RPC="https://polygon.drpc.org"
POLYGON_AMOY_RPC="https://polygon-amoy.drpc.org"
POLYGON_NOTARY_CONTRACT="0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1"
POLYGON_RELAYER_PRIVATE_KEY="<0x 릴레이어 지갑 개인키>"
```

---

## 10. Telegram & Slack — 실시간 알림

| 항목 | 값 |
|:---|:---|
| **Telegram** | Bot API (`api.telegram.org`) |
| **Slack** | Incoming Webhook (`hooks.slack.com`) |
| **구현 파일** | `api/telegram.js`, `src/services/notificationService.ts` |

### 알림 대상 이벤트
- 신규 상담 신청, 전자계약 체결, AI 통화 요약 완료, 광고 주문 등

### 필요 환경변수
```bash
TELEGRAM_ADMIN_BOT_TOKEN="<텔레그램 봇 토큰>"
TELEGRAM_ADMIN_CHAT_ID="<텔레그램 채팅/채널 ID>"
SLACK_ADMIN_WEBHOOK_URL="https://hooks.slack.com/services/<...>"  # 선택
```

---

## 11. Google Drive / Apps Script

| 항목 | 값 |
|:---|:---|
| **목적** | 통화 녹음 파일(MP3/M4A) → 변호사 전용 구글 드라이브 자동 업로드 |
| **GAS Web App URL** | `.env`에 설정 (`VITE_GOOGLE_SCRIPT_URL`) |
| **드라이브 폴더명** | `마이김변_통화녹취` (자동 생성) |
| **구현 파일** | `src/services/communicationService.ts`, `GoogleDriveSettingsModal.tsx` |

### 필요 환경변수
```bash
VITE_GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/<GAS_DEPLOY_ID>/exec"
```

---

## 12. Cloudflare Turnstile — 봇 방어

| 항목 | 값 |
|:---|:---|
| **목적** | CAPTCHA 없는 스마트 봇 방어 (모든 공공 API에 적용) |
| **검증 API** | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` |
| **위젯 스크립트** | `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` |
| **구현 파일** | `api/_lib/turnstile-validator.js`, `src/components/common/TurnstileWidget.tsx` |

### 적용 엔드포인트
`alimtok`, `send-email`, `telegram`, `generate-statement`, `ocr-case`, `ocr-family`, `debt-discovery`, `scourt-proxy`

### 필요 환경변수
```bash
VITE_TURNSTILE_SITE_KEY="<Cloudflare 사이트 키>"    # 프론트엔드
TURNSTILE_SECRET_KEY="<Cloudflare 시크릿 키>"        # 서버리스
```
> 테스트 모드 기본값: Site Key `1x00000000000000000000AA`, Secret `1x0000000000000000000000000000000AA`

---

## 13. Pollinations AI — 이미지 생성

| 항목 | 값 |
|:---|:---|
| **목적** | 마케팅 블로그/카드뉴스용 AI 일러스트 자동 생성 |
| **엔드포인트** | `GET https://image.pollinations.ai/prompt/{prompt}?width=...&model=flux` |
| **인증** | **불필요 (100% 무료 무인증)** |
| **구현 파일** | `src/services/marketingAiService.ts` |

---

## 14. 공공데이터포털 — 국세청 & 복지 API

### ① 국세청 사업자등록 진위확인
| 항목 | 값 |
|:---|:---|
| **엔드포인트** | `POST https://api.odcloud.kr/api/nts-businessman/v1/validate` |
| **구현 파일** | `src/services/ntsService.ts` |
| **환경변수** | `VITE_NTS_SERVICE_KEY` (`.env` L6에 설정됨) |

### ② 행안부 공공서비스 복지 혜택 조회
| 항목 | 값 |
|:---|:---|
| **엔드포인트** | `GET https://apis.data.go.kr/1741000/public_services_info/getServicesInfo` |
| **구현 파일** | `api/benefits.js` |
| **환경변수** | `DATA_GO_KR_API_KEY` |

---

## 15. Gmail SMTP — 이메일 발송

| 항목 | 값 |
|:---|:---|
| **목적** | ① 관리자 2FA OTP 발송 ② 상담/계약 알림 이메일 |
| **모듈** | `nodemailer` (service: `gmail`) |
| **구현 파일** | `api/send-email.js` |

### 필요 환경변수
```bash
GMAIL_SMTP_USER="<발송 Gmail 주소>"
GMAIL_SMTP_APP_PASSWORD="<16자리 구글 앱 비밀번호>"
```
> ⚠️ 일반 Gmail 비밀번호가 아닌, Google 계정 설정 > 보안 > 앱 비밀번호에서 발급한 16자리 전용 비밀번호

---

## 16. 도메인 & DNS & CORS 보안

### 도메인 설정
| 항목 | 값 |
|:---|:---|
| **프로덕션 도메인** | `https://mykim.kr` |
| **www 리다이렉트** | `www.mykim.kr` → `mykim.kr` (301 Permanent) |
| **Vercel 기본 URL** | `https://legal-crm-xi.vercel.app` |
| **대표 이메일** | `support@mykim.kr` |

### CORS 화이트리스트 (`api/_lib/cors-helper.js`)
```javascript
// 엄격한 허용 도메인 (와일드카드 완전 배제)
const ALLOWED_EXACT_ORIGINS = new Set([
  'https://mykim.kr',
  'https://www.mykim.kr',
  'https://legal-crm-xi.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

// Vercel 프리뷰 도메인 동적 허용
/^https:\/\/[a-zA-Z0-9_-]+-mykim\.vercel\.app$/.test(origin)
/^https:\/\/legal-crm[a-zA-Z0-9_-]*\.vercel\.app$/.test(origin)
```

### API 보안 레이어
| 레이어 | 구현 파일 | 설명 |
|:---|:---|:---|
| **Rate Limiter** | `api/_lib/rate-limiter.js` | STRICT/STANDARD/RELAXED 3-Tier, 30분 위반자 격리(Jail) |
| **인증 미들웨어** | `api/_lib/auth-middleware.js` | Supabase Service Role Bearer 토큰 검증, X-Request-ID |
| **Turnstile** | `api/_lib/turnstile-validator.js` | Cloudflare 봇 방어 서버 검증 |

---

## 17. 환경변수 종합 체크리스트

### A. Vercel 서버리스 환경변수 (Vercel Dashboard > Settings > Environment Variables)
```bash
# ─── Supabase ───
SUPABASE_URL="https://xgmmvpmoyywpttuslwkh.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<서비스 롤 키>"

# ─── Popbill (알림톡 + 세금계산서) ───
POPBILL_LINK_ID="MONSTERLAB"
POPBILL_SECRET_KEY="<팝빌 비밀키>"
POPBILL_CORP_NUM="5213901355"
POPBILL_USER_ID="mykim99"
POPBILL_PLUS_FRIEND_ID="@마이김변"
POPBILL_SENDER_PHONE="01026060357"
POPBILL_CONTACT_EMAIL="2882@daum.net"
POPBILL_IS_TEST="false"

# ─── Google Gemini AI ───
GEMINI_API_KEY="<Gemini API 키>"

# ─── CODEF (대법원/채무조회) ───
CODEF_CLIENT_ID="<CODEF 클라이언트 ID>"
CODEF_CLIENT_SECRET="<CODEF 시크릿>"
CODEF_ENV="production"

# ─── Polygon Blockchain ───
POLYGON_NETWORK="mainnet"
POLYGON_MAINNET_RPC="https://polygon.drpc.org"
POLYGON_AMOY_RPC="https://polygon-amoy.drpc.org"
POLYGON_NOTARY_CONTRACT="0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1"
POLYGON_RELAYER_PRIVATE_KEY="<릴레이어 개인키>"

# ─── Telegram & Slack ───
TELEGRAM_ADMIN_BOT_TOKEN="<봇 토큰>"
TELEGRAM_ADMIN_CHAT_ID="<채팅 ID>"
SLACK_ADMIN_WEBHOOK_URL="<Slack 웹훅 URL>"

# ─── Cloudflare Turnstile ───
TURNSTILE_SECRET_KEY="<시크릿 키>"

# ─── 공공데이터포털 ───
DATA_GO_KR_API_KEY="<행안부 API 키>"

# ─── Gmail SMTP ───
GMAIL_SMTP_USER="<Gmail 주소>"
GMAIL_SMTP_APP_PASSWORD="<16자리 앱 비밀번호>"
```

### B. 프론트엔드 `.env` 파일 (Vite 클라이언트)
```bash
# ─── Supabase ───
VITE_SUPABASE_URL="https://xgmmvpmoyywpttuslwkh.supabase.co"
VITE_SUPABASE_ANON_KEY="<Anon Key JWT>"
VITE_SUPABASE_FLOW_TYPE="implicit"

# ─── 사이트 ───
VITE_SITE_URL="https://mykim.kr"
VITE_ADMIN_SECRET_PATH="adm_sec_9k7q"

# ─── 은행 계좌 ───
VITE_BANK_NAME="카카오뱅크"
VITE_BANK_ACCOUNT="3333-35-6862273"
VITE_BANK_HOLDER="진성호(몬스터랩)"

# ─── PortOne ───
VITE_PORTONE_STORE_ID="store-6dc40c8f-40cb-41c8-95be-36ddaf8467d0"
VITE_PORTONE_CHANNEL_KEY="channel-key-6d8962ba-a8fd-4b92-aa46-7b0b17c67489"
VITE_PORTONE_API_SECRET="<포트원 시크릿>"

# ─── 국세청 ───
VITE_NTS_SERVICE_KEY="<NTS 인증키>"

# ─── Gemini AI ───
VITE_GEMINI_API_KEY="<Gemini API 키>"

# ─── Turnstile ───
VITE_TURNSTILE_SITE_KEY="<사이트 키>"

# ─── Google Drive ───
VITE_GOOGLE_SCRIPT_URL="<GAS Web App URL>"

# ─── 세션 암호화 ───
VITE_SESSION_SECRET="<세션 암호화 키>"
```

---

## 18. Supabase 테이블 목록

총 **46개** 테이블이 운영 중입니다.

| # | 테이블명 | 용도 |
|:-:|:---|:---|
| 1 | `activity_logs` | 관리자/변호사 시스템 활동 이력 |
| 2 | `ad_orders` | 변호사 광고 결제 주문 |
| 3 | `alimtok_logs` | 알림톡/SMS 발송·수신 이력 |
| 4 | `audit_logs` | 감사 추적 로그 (접속/변경/보안) |
| 5 | `calendar_events` | 법원 기일, 상담 예약 일정 |
| 6 | `cases` | 개인회생/파산 사건 본체 |
| 7 | `client_inquiries` | 고객센터 1:1 문의 |
| 8 | `client_memos` | 의뢰인 내부 검토 메모 |
| 9 | `client_messages_approved` | 고객 전송 승인 메시지 |
| 10 | `client_qas` | FAQ(Q&A) 콘텐츠 |
| 11 | `communication_logs` | 통화/문자/알림톡 통합 기록 |
| 12 | `consult_messages` | 상담 채팅 메시지 |
| 13 | `consult_requests` | 상담 신청 접수 데이터 |
| 14 | `consult_style_profiles` | 변호사 상담 스타일 AI 프로필 |
| 15 | `copilot_audit_logs` | 코파일럿 검토/승인 감사 로그 |
| 16 | `court_practice_notes` | 법원별 실무준칙 메모 |
| 17 | `crm_clients` | CRM 고객/의뢰인 원장 |
| 18 | `diagnosis_config` | 자가진단 알고리즘 설정 |
| 19 | `diagnosis_results` | 진단 결과 |
| 20 | `diagnosis_stats` | 진단 누적 통계 |
| 21 | `electronic_contracts` | 전자 수임계약서/서명 |
| 22 | `global_rule_templates` | 법률 룰 템플릿 |
| 23 | `in_app_notifications` | 인앱 실시간 알림 |
| 24 | `internal_messages` | 사내 내부 쪽지 |
| 25 | `invite_tokens` | 초대 가입 토큰 |
| 26 | `lawyer_inquiries` | 변호사 제휴 문의 |
| 27 | `lawyer_opinions` | 사건 법률 의견서 |
| 28 | `lawyer_smtp_credentials` | 변호사별 SMTP 자격증명 |
| 29 | `lawyers` | 등록 변호사 프로필 |
| 30 | `main_banners` | 메인 배너/공지 배너 |
| 31 | `matching_config` | 의뢰인-변호사 매칭 정책 |
| 32 | `members` | 회원 기본 계정 |
| 33 | `news_articles` | 법률 뉴스/보도 자료 |
| 34 | `notices` | 플랫폼 공지사항 |
| 35 | `notification_channel_settings` | 알림 채널 라우팅 설정 |
| 36 | `pending_calls` | 예약 전화 상담 대기 |
| 37 | `pending_sms` | 예약 문자 발송 대기 |
| 38 | `platform_config` | 플랫폼 전역 운영 설정 |
| 39 | `popup_config` | 웹 공지 팝업 설정 |
| 40 | `rehab_policy_settings` | 회생 변제율 기준 정책 |
| 41 | `review_rule_sets` | 사건 진단 룰셋 버전 |
| 42 | `sms_templates` | 알림톡/문자 템플릿 |
| 43 | `staff_members` | 로펌 직원/사무장 계정 |
| 44 | `success_reviews` | 성공 후기 |
| 45 | `task_tickets` | 업무 티켓(Kanban) |
| 46 | `user_sessions` | 동시접속 세션 제어 |

---

## 19. npm 패키지 의존성

### 프로덕션 의존성 (21개)
| 패키지 | 버전 | 용도 |
|:---|:---|:---|
| `@google/genai` | ^2.4.0 | Gemini AI SDK |
| `@supabase/supabase-js` | ^2.106.2 | Supabase DB/Auth/Realtime |
| `canvas-confetti` | ^1.9.4 | 계약 체결 축하 애니메이션 |
| `clsx` | ^2.1.1 | 조건부 클래스 유틸 |
| `dompurify` | ^3.4.11 | HTML XSS 정화 |
| `html2canvas` | ^1.4.1 | 문서 이미지 캡처 |
| `jspdf` | ^4.2.1 | 클라이언트 PDF 생성 |
| `jszip` | ^3.10.2 | 서류 ZIP 압축 |
| `lucide-react` | ^0.546.0 | UI 아이콘 |
| `motion` | ^12.23.24 | Framer Motion 애니메이션 |
| `pdf-lib` | ^1.17.1 | PDF 결합/워터마크 |
| `popbill` | ^1.64.2 | 팝빌 세금계산서/알림톡 SDK |
| `qrcode` | ^1.5.4 | QR코드 생성 |
| `react` | ^19.0.1 | React 코어 |
| `react-dom` | ^19.0.1 | React DOM |
| `sonner` | ^2.0.7 | 토스트 알림 |
| `tailwind-merge` | ^3.6.0 | Tailwind 클래스 병합 |
| `viem` | ^2.56.3 | Polygon EVM 블록체인 |
| `xlsx-js-style` | ^1.2.0 | 엑셀 서식 출력 |
| `zod` | ^4.5.4 | 스키마 유효성 검증 |

### 개발 의존성 (14개)
| 패키지 | 버전 |
|:---|:---|
| `@tailwindcss/vite` | ^4.1.14 |
| `@vitejs/plugin-react` | ^5.0.4 |
| `autoprefixer` | ^10.4.21 |
| `dotenv` | ^17.2.3 |
| `esbuild` | ^0.25.0 |
| `tailwindcss` | ^4.1.14 |
| `tsx` | ^4.21.0 |
| `typescript` | ~5.8.2 |
| `vite` | ^6.2.3 |
| 타입 정의 패키지 4개 | `@types/canvas-confetti`, `@types/node`, `@types/qrcode`, `@types/react`, `@types/react-dom`, `@types/jszip` |

---

**문서 작성 완료:** 2026-09-20 v1.0  
**작성 기준:** 코드베이스 전수 분석 (서비스 52개, API 11개, 환경변수 40개+, 테이블 46개)  
**작성 주체:** 마이김변 기술 인수인계 TF
