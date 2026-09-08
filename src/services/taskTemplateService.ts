// ============================================================
// 회생·파산 특화 업무 템플릿 및 불변기한 계산 서비스
// ============================================================

import type { TaskPriority } from '../types/communication';

export interface TaskTemplateItem {
  title: string;
  description: string;
  priority: TaskPriority;
  offsetDays: number; // 기준일로부터 며칠 후 마감인지
  requiresApproval: boolean;
  subtasks: string[];
}

export interface TaskPackageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'rehab' | 'bankruptcy' | 'court' | 'consult';
  badge: string;
  color: string;
  tasks: TaskTemplateItem[];
}

/** 대한민국 법정 공휴일 (월-일 기준) */
export const STATUTORY_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

/**
 * 민법 제161조에 따른 법원 불변기한 계산 함수
 * - 기간의 말일이 토요일 또는 공휴일에 해당하는 때에는 기간은 그 익일로 만료한다.
 */
export function calculateCourtDeadline(startDateStr: string, days: number): string {
  const date = new Date(startDateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return startDateStr;

  // 기준일 + days
  date.setDate(date.getDate() + days);

  // 만료일이 토(6), 일(0) 또는 공휴일이면 평일이 될 때까지 하루씩 연장
  while (true) {
    const dayOfWeek = date.getDay();
    const mmdd = String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const isHoliday = !!STATUTORY_HOLIDAYS[mmdd];

    if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
      date.setDate(date.getDate() + 1);
    } else {
      break;
    }
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 회생·파산 4대 표준 템플릿 패키지 목록 */
export const TASK_PACKAGE_TEMPLATES: TaskPackageTemplate[] = [
  {
    id: 'rehab_standard_onboarding',
    name: '개인회생 착수 표준 패키지',
    description: '사건 수임 직후 부채증명원 발급부터 전자소송 접수까지 필수 5단계 일괄 등록',
    category: 'rehab',
    badge: '개인회생 필수',
    color: 'border-blue-200 bg-blue-50/50 text-blue-700',
    tasks: [
      {
        title: '부채증명서 발급 대행 신청 및 금융사 목록 대조',
        description: '의뢰인 신용조회서 바탕으로 모든 채권금융기관 부채증명원 발급 위임장 접수 및 발급 현황 점검',
        priority: 'HIGH',
        offsetDays: 3,
        requiresApproval: false,
        subtasks: ['신용조회서 상 금융사 목록 대조', '위임장 및 인감증명서 수합', '발급대행 접수 및 진행현황 등록']
      },
      {
        title: '기본 공적서류 수합 및 미비서류 안내',
        description: '주민등록등초본, 가족관계증명서, 세목별과세증명서, 건강보험자격득실확인서 수합',
        priority: 'NORMAL',
        offsetDays: 5,
        requiresApproval: false,
        subtasks: ['주민센터 서류 수합', '국세청/건보공단 서류 확인', '의뢰인에게 미비 서류 안내 카톡 발송']
      },
      {
        title: '재산목록 및 수지표(소득/생계비) 초안 작성',
        description: '부동산/차량 시세표 및 최근 1년 계좌거래내역 바탕으로 청산가치 및 가용소득 산출',
        priority: 'HIGH',
        offsetDays: 7,
        requiresApproval: false,
        subtasks: ['부동산/임차보증금 청산가치 계산', '차량 시세 및 보험해약환급금 확인', '월 평균 가용소득 및 변제예정액 산출']
      },
      {
        title: '개인회생 개시신청서 및 진술서 변호사 최종 검토',
        description: '채권자목록 누락 여부, 변제율, 채무증대경위서의 법리적 타당성 최종 컨펌',
        priority: 'URGENT',
        offsetDays: 10,
        requiresApproval: true,
        subtasks: ['채무증대경위서 첨삭 및 보완', '변제계획안 적법성 검토', '변호사 최종 승인 서명']
      },
      {
        title: '관할법원 전자소송 접수 및 금지명령 신청',
        description: '전자소송 포털을 통한 본안 접수, 송달료/인지대 납부 및 의뢰인에게 사건번호 안내',
        priority: 'URGENT',
        offsetDays: 12,
        requiresApproval: false,
        subtasks: ['전자소송 문서 업로드', '인지/송달료 전자납부', '의뢰인에게 사건번호 및 금지명령 안내문 발송']
      }
    ]
  },
  {
    id: 'rehab_court_correction',
    name: '법원 보정권고/명령 긴급 대응 패키지',
    description: '법원 보정명령 송달 시 불변기한(7일/14일) 내 완결을 위한 초긴급 워크플로우',
    category: 'court',
    badge: '불변기한 긴급',
    color: 'border-red-200 bg-red-50/50 text-red-700',
    tasks: [
      {
        title: '보정권고/명령 요구사항 정밀 분석 및 쟁점 분류',
        description: '최근 대출금 사용처 소명, 계좌내역 1년치, 재산가치 재평가 등 판사 요구사항 도출',
        priority: 'URGENT',
        offsetDays: 1,
        requiresApproval: false,
        subtasks: ['보정명령서 다운로드 및 보정사항 요약', '소명 필요 금액 및 거래내역 발췌', '의뢰인 유선 상담 일정 조율']
      },
      {
        title: '의뢰인 추가 소명자료 및 금융자료 수합',
        description: '의뢰인에게 구체적 사용처 영수증, 계약서, 통장사본 요청 및 1차 검증',
        priority: 'HIGH',
        offsetDays: 3,
        requiresApproval: false,
        subtasks: ['소명자료 체크리스트 발송', '수합된 금융거래내역 정리표 작성', '누락된 영수증 대체진술서 준비']
      },
      {
        title: '보정서 및 수정 변제계획안 초안 작성',
        description: '법원 양식에 맞추어 항목별 답변서 작성 및 변제율 변동 시 수정안 반영',
        priority: 'HIGH',
        offsetDays: 5,
        requiresApproval: false,
        subtasks: ['보정서 본문 작성', '입증서류 번호 매기기 및 별지 정리', '수정 변제계획안 계산']
      },
      {
        title: '담당 변호사 보정서 최종 검토 및 승인(컨펌)',
        description: '기각 사유 해당 여부, 청산가치 보장의 원칙 위배 여부 정밀 법률 검토',
        priority: 'URGENT',
        offsetDays: 6,
        requiresApproval: true,
        subtasks: ['법리적 소명 완결성 검토', '변호사 의견 반영 수정', '최종 제출 승인']
      },
      {
        title: '법원 전자소송 보정서 제출 및 접수증 확인',
        description: '불변기한 만료 전 전자소송 접수 및 관할 재판부 송달 확인',
        priority: 'URGENT',
        offsetDays: 7,
        requiresApproval: false,
        subtasks: ['전자소송 보정서 제출', '접수증 출력 및 보관', '의뢰인에게 제출 완료 알림톡 발송']
      }
    ]
  },
  {
    id: 'rehab_creditor_meeting',
    name: '채권자집회 및 인가결정 대응 패키지',
    description: '개시결정 이후 채권자집회 출석 지도 및 최종 변제인가 대비 4단계 점검',
    category: 'rehab',
    badge: '집회/인가',
    color: 'border-amber-200 bg-amber-50/50 text-amber-700',
    tasks: [
      {
        title: '채권자 이의신청서 접수 유무 확인 및 채권액 점검',
        description: '대법원 나의사건검색을 통해 채권자들의 이의신청 여부 확인 및 대응',
        priority: 'NORMAL',
        offsetDays: 7,
        requiresApproval: false,
        subtasks: ['나의사건검색 사건진행내역 조회', '채권자 이의신청서 열람', '필요 시 채권자목록 수정 준비']
      },
      {
        title: '의뢰인 회생위원 전용계좌 변제금 적립 현황 확인',
        description: '채권자집회 전까지 월 변제금이 1회 이상 성실히 적립되었는지 납부영수증 확인',
        priority: 'HIGH',
        offsetDays: 14,
        requiresApproval: false,
        subtasks: ['가상계좌 입금증 수합', '미납 시 긴급 납부 독려 유선 안내']
      },
      {
        title: '의뢰인 채권자집회 출석 안내 및 유의사항 교육',
        description: '집회 장소(법원 호수), 신분증 지참, 복장, 복기 질의응답 사전 안내',
        priority: 'HIGH',
        offsetDays: 21,
        requiresApproval: false,
        subtasks: ['집회 일시/법정 약도 카톡 발송', '출석 유의사항 가이드 전달', '불출석 시 기각 위험 고지']
      },
      {
        title: '채권자집회 종결 및 변제계획 인가결정 공고 확인',
        description: '집회 결과 확인 후 법원 인가결정 공고 모니터링 및 성공보수 정산',
        priority: 'NORMAL',
        offsetDays: 35,
        requiresApproval: true,
        subtasks: ['인가결정문 출력 및 의뢰인 송부', '신용정보원 면책/인가 등록 안내', '성공보수 청구 및 종결 처리']
      }
    ]
  },
  {
    id: 'bankruptcy_all_in_one',
    name: '개인파산 및 면책 동시신청 올인원 패키지',
    description: '파산관재인 보고서 대비 환가재산 및 면책불허가사유 점검 4단계',
    category: 'bankruptcy',
    badge: '개인파산',
    color: 'border-purple-200 bg-purple-50/50 text-purple-700',
    tasks: [
      {
        title: '파산 원인 및 면책불허가 사유 사전 스크리닝',
        description: '지급불능 상태 증명(고령, 중증질환, 최저생계비 미달) 및 도박/사치 채무 검토',
        priority: 'URGENT',
        offsetDays: 3,
        requiresApproval: true,
        subtasks: ['소득활동 불가 입증자료(진단서/수급자증명서) 확인', '과거 5년 내 처분재산 조사', '변호사 적격성 심사']
      },
      {
        title: '파산관재인 대비 14대 필수 금융/재산 서류 수합',
        description: '10년치 세목별과세증명서, 지적전산자료조회결과서, 전입세대열람원 등 수합',
        priority: 'HIGH',
        offsetDays: 7,
        requiresApproval: false,
        subtasks: ['14대 서류 체크리스트 점검', '누락 서류 보완 발급 지도', '재산가액 평가서 작성']
      },
      {
        title: '파산 및 면책 신청서 작성 및 파산관재인 예납금 준비',
        description: '신청서 작성 완료 및 관할법원 관재인 선임비용(30~50만원) 예납 안내',
        priority: 'HIGH',
        offsetDays: 10,
        requiresApproval: false,
        subtasks: ['파산신청서 및 진술서 작성', '관재인 예납금 납부고지서 발부', '의뢰인 예납금 납부 확인']
      },
      {
        title: '파산신청서 전자소송 접수 및 심문기일 캘린더 등록',
        description: '법원 접수 완료 및 파산관재인 면담 일정 대비 안내문 발송',
        priority: 'URGENT',
        offsetDays: 12,
        requiresApproval: true,
        subtasks: ['전자소송 접수', '사건번호 CRM 등록', '캘린더에 관재인 면담 일정 등록']
      }
    ]
  }
];
