# 🤖 개인회생/파산 변제금 진단 챗봇 이식 패키지

이 패키지는 기존 `landing-page-factory` 프로젝트의 핵심 기능인 **개인회생 변제금 진단 챗봇 V2**를 다른 React + TypeScript 프로젝트에 이식하기 쉽게 추출한 독립 패키지입니다.

---

## 📁 패키지 구조

본 패키지(`rehab-chatbot-package`)를 다른 프로젝트의 원하는 소스코드 폴더(예: `src/` 또는 `components/` 등) 아래에 그대로 복사해 붙여넣으시면 됩니다.

```text
rehab-chatbot-package/
├── components/
│   └── rehab/                # 챗봇 UI 컴포넌트 폴더
│       ├── animations/       # 보고서용 애니메이션 컴포넌트
│       ├── templates/        # 챗봇 레이아웃 템플릿 및 렌더러
│       ├── AIRehabChatbot.tsx    # [Legacy] 챗봇 V1
│       ├── AIRehabChatbotV2.tsx  # [핵심] 고도화 챗봇 V2 (대형 스크립트 기반)
│       ├── ProcedureTimeline.tsx # 보고서 하단 진행 절차 타임라인
│       ├── RehabChatButton.tsx   # 플로팅 / 임베디드 전환 버튼
│       ├── RehabResultReport.tsx # 최종 진단 결과 보고서 화면
│       └── StatisticalComparison.tsx # 타 통계 데이터와 비교 차트
├── services/
│   └── calculationService.ts # 2026년 기준 변제금/생계비 계산 공식 엔진
├── config/
│   └── PolicyConfig.ts       # 2026년 가구원수별 최저생계비 및 법원별 정책 설정
└── types.ts                  # 챗봇 설정에 필요한 인터페이스 모음
```

---

## 🛠️ 필수 의존성 라이브러리 설치

챗봇 컴포넌트는 아이콘과 애니메이션 처리를 위해 다음 라이브러리를 사용합니다. **이식 대상 프로젝트**의 터미널에서 다음 명령어를 실행하여 설치해 주세요.

```bash
npm install lucide-react framer-motion
```

* 만약 차트 시각화(`StatisticalComparison.tsx`) 기능이 깨질 경우, 해당 컴포넌트에서 사용하는 `recharts` 라이브러리를 설치하거나 필요에 따라 컴포넌트를 주석 처리하셔도 좋습니다.
  ```bash
  npm install recharts
  ```

---

## 🚀 사용법 및 연동 가이드

### 1. 단순 챗봇 팝업/임베디드 실행

가장 단순하게 챗봇 V2를 띄우고 싶다면 아래와 같이 설정하고 가져와서 사용합니다.

```tsx
import React from 'react';
import AIRehabChatbotV2 from './rehab-chatbot-package/components/rehab/AIRehabChatbotV2';

function App() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <AIRehabChatbotV2 
        isStandalone={true} // 독립 페이지/컴포넌트 형태로 가득 채워 실행
        onComplete={(result, userInput) => {
          console.log('진단 완료 결과:', result);
          console.log('사용자 입력값:', userInput);
          // 💡 여기에 챗봇 완료 시 DB 저장이나 페이지 이동 등의 후속 로직을 작성합니다.
        }}
      />
    </div>
  );
}

export default App;
```

### 2. 저장 로직 연동 (`onComplete` 활용)
원래 프로젝트에서는 로그인 후 Supabase에 자동으로 진단 기록(`leads` 테이블)을 로그로 적재했습니다.
새로운 프로젝트에서 직접 수집된 채무 진단 정보를 다른 DB나 스프레드시트, 혹은 메일 등으로 전송하려면 `onComplete` 콜백을 이용하면 편리합니다.

```tsx
const handleComplete = async (result: RehabCalculationResult, userInput: RehabUserInput) => {
  // 예: 본인 서버 API로 진단 데이터 및 고객 연락처 정보 전송
  await fetch('/api/save-rehab-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: userInput.name,
      customerPhone: userInput.phone,
      totalDebt: userInput.totalDebt,
      calculatedPayment: result.monthlyPayment,
      debtReductionRate: result.debtReductionRate,
    })
  });
  
  // 전송 완료 후 결과 보고서 열람 또는 상담 신청 페이지로 리다이렉트 처리 등
};
```

---

## ⚙️ 2026년 기준 주요 계산 로직 설명

- **지역별 관할 법원 판별**: 사용자가 입력한 주소(`userInput.address`)에서 자동으로 지역명(예: "서울", "수원", "부산" 등)을 추출하여 `config/PolicyConfig.ts`에 정의된 14개 관할 법원의 고유 성향(배우자 재산 반영률, 24개월 단축 특례 여부 등)을 계산에 자동 반영합니다.
- **최저 생계비 및 추가 비용 공제**: 2026년 정부 고시 기준 가구원수별 중위소득 60%를 기준으로 계산하며, 추가 주거비(월세/보증금 공제), 추가 교육비, 추가 의료비 공제 조건이 2026년 서울회생법원 실무 기준에 맞게 공식화되어 있습니다.
