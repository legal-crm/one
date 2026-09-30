export type ToolCategory = 'calculator' | 'standards' | 'workflow';

export type QuickToolId = 
  | 'calculator'       // 송달료·인지대 계산기
  | 'median'           // 2026 기준중위소득표
  | 'extraExpense'     // 추가생계비 실무준칙
  | 'virtualAccount'   // 변제금 납입계좌 뷰어
  | 'alimtok'          // 모바일 알림톡 전송
  | 'rehabPayCalc'     // 탕감률 & 총변제액 계산기
  | 'liquidationCalc'  // 청산가치 보장 점검기
  | 'courtGuidelines'  // 전국 법원별 실무성향
  | 'seizureLimits'    // 압류금지 채권 & 최우선변제금
  | 'quickMemo'        // 상담 퀵 스크래치패드
  | 'interestCompare'  // 대출이자 vs 회생변제 비교
  | 'legalArticles'    // 도산법 핵심 조문
  | 'assetValuation'   // 토지·주택·차량가액 즉시 조회
  | 'koreanAge'        // 만나이 & 도산 실무 자격 판정기
  | 'creditorSearch'   // 전국 채권자 공식 송달주소록
  | 'docChecklist'     // 필수서류 발급 체크리스트 생성기
  | 'pinMemo'          // 사진 & 텍스트 자유 핀 메모 보드
  | 'deadlineCalc';    // 기한·기일 계산기 (민법 제157·160·161조)

export interface QuickToolMeta {
  id: QuickToolId;
  title: string;
  /** 플로팅 창 탭에 표시할 짧은 이름 */
  shortTitle: string;
  subtitle: string;
  category: ToolCategory;
  badge?: string;
  /** 메뉴 검색용 추가 검색어 */
  keywords?: string[];
  iconName: string;
  colorClass: {
    bg: string;
    text: string;
    hoverBg: string;
    border?: string;
  };
  defaultEnabled: boolean;
  isActionOnly?: boolean; // 창이 아닌 외부 트리거 액션(예: 알림톡 탭 전환)
}

export interface Position {
  x: number;
  y: number;
}
