import { LawFirm, Team, User, ConsultRequest, Case, ConsultMessage } from './types';

export const mockLawFirms: LawFirm[] = [
  { id: 'firm-1', name: '법무법인 한빛', region: '서울 서초구' },
  { id: 'firm-2', name: '하늘 법률사무소', region: '경기 수원시' },
  { id: 'firm-3', name: '법무법인 해원', region: '부산 연제구' },
];

export const mockTeams: Team[] = [
  { id: 'team-1', lawFirmId: 'firm-1', name: '개인회생 전담 1팀' },
  { id: 'team-2', lawFirmId: 'firm-1', name: '파산/소생 전략팀' },
  { id: 'team-3', lawFirmId: 'firm-2', name: '수원지방법원 대응팀' },
];

export const mockLawyers: User[] = [
  {
    id: 'lawyer-1',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '김우진 변호사',
    role: 'LAWYER',
    fields: ['개인회생', '개인파산', '신용회복'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
    bio: '대한변호사협회 등록 도산 전문 변호사. 누적 개인회생 인가 800건 돌파. 신속하고 안전한 부정행위 소명 전문.',
    recentActivity: '최근 3일 내 회생/파산 개시 결정 4건 달성',
    matchedCount: 142
  },
  {
    id: 'lawyer-2',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '이소민 변호사',
    role: 'LAWYER',
    fields: ['개인회생', '도산법전문', '보정명령대응'],
    region: '서울/경기',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
    bio: '서울회생법원 보정권고 및 보정명령 즉각 대응 전문. 사행성 부채(주식/코인 투자 실패) 최적 탕감 전략 제시.',
    recentActivity: '주식/코인 손실액 보정 변제율 35%로 인가 완료',
    matchedCount: 98
  },
  {
    id: 'lawyer-3',
    lawFirmId: 'firm-2',
    teamId: 'team-3',
    name: '최덕중 변호사',
    role: 'LAWYER',
    fields: ['개인파산', '법인회생', '고액채무'],
    region: '경기/수원',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
    bio: '수원회생 전문 15년 경력. 복잡하고 까다로운 파산 재산 면제 신청 및 면책 인가 98% 성공률.',
    recentActivity: '최근 대부업 고리채무 전액 탕감 성공',
    matchedCount: 75
  },
  {
    id: 'staff-1',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '박진혁 실장',
    role: 'STAFF',
    fields: ['서류작성', '마이데이터 연동', '부채증명발급'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=256',
    bio: '채무자 서류 전문 상담 실무 경력 12년. 복잡한 채무자 서류 준비 과정을 One-Stop으로 가이드해 드립니다.',
    recentActivity: '당일 긴급 채권자 송달용 압류 금지 신청 2건 완료',
    matchedCount: 0
  }
];

export const initialConsultRequests: ConsultRequest[] = [
  {
    id: 'req-1',
    clientId: 'client-1',
    clientName: '홍길동',
    phone: '010-1234-5678',
    requestType: 'open',
    maxParticipants: 3,
    status: 'requested',
    createdAt: '2026-05-26T01:30:00Z',
    title: '코인 투자 실패와 최근 대출로 인한 돌려막기 한계',
    content: '업비트 선물 거래로 약 4천만 원의 채무가 추가 발생하여, 총 채무가 9천만 원에 달합니다. 월 소득은 230만 원인데 매달 원리금만 270만 원씩 나가고 있어서 돌려막기도 불가한 한계에 도달했습니다. 개인회생을 통해 변제율을 최대한 낮추고 싶은데 가능할까요?',
    financialProfile: {
      clientId: 'client-1',
      income: 230,
      debtTotal: 9000,
      assetsTotal: 1200,
      dependents: 0,
      maritalStatus: 'SINGLE',
      debtTypes: {
        banks: 3000,
        cards: 2000,
        personals: 1000,
        recentLoans: 3000,
        coinCrypto: 4000,
      },
      riskFlags: ['최근 대출 비중 높음 (33% 이상)', '사행성 투자 실패(코인/주식)', '소득 대비 채무 초과'],
    }
  },
  {
    id: 'req-2',
    clientId: 'client-2',
    clientName: '김영희',
    phone: '010-9876-5432',
    requestType: 'direct',
    maxParticipants: 1,
    status: 'responding',
    selectedLawyerId: 'lawyer-2', // Directed to 이소민
    createdAt: '2026-05-25T14:20:00Z',
    title: '자영업 폐업 후 카드론과 생활고 생계비 부족',
    content: '코로나로 인해 오랫동안 운영하던 식당을 저번 달 폐업했습니다. 마이너스 통장과 자영업자 긴급대출 등 총 5,500만 원의 빚이 남았고, 현재는 파트타임으로 요양보호사로 일하며 월 150만 원 남짓 벌며 초등학생 아이 한 명을 부양하고 있습니다. 양육비 제외하면 생계가 너무 힘든데, 개인파산 혹은 개인회생 중 어떤 유리한 제도가 있을까요?',
    financialProfile: {
      clientId: 'client-2',
      income: 150,
      debtTotal: 5500,
      assetsTotal: 400,
      dependents: 1,
      maritalStatus: 'DIVORCED',
      debtTypes: {
        banks: 2500,
        cards: 2000,
        personals: 1000,
        recentLoans: 500,
        coinCrypto: 0,
      },
      riskFlags: ['보건복지부 고시 최저생계비 미달 우려', '자영업자 폐업 부채'],
    }
  },
  {
    id: 'req-3',
    clientId: 'client-3',
    clientName: '이동현',
    phone: '010-3333-4444',
    requestType: 'open',
    maxParticipants: 3,
    status: 'counseling',
    createdAt: '2026-05-24T09:15:00Z',
    title: '연대보증 채무 합산 1억 2천만 원 압류 예고 받았습니다',
    content: '한때 동업하던 지인의 사업자금 대출에 연대보증을 섰는데 지인이 야반도주하여 제게 약 1억 2천만 원의 연체 청구와 급여 압류 예고 통지서가 왔습니다. 성실하게 직장에 다니며 월 420만 원을 벌고 있는데, 직장에 알려지지 않고 살 수 있는 긴급 개인회생 신청을 원합니다.',
    financialProfile: {
      clientId: 'client-3',
      income: 420,
      debtTotal: 12000,
      assetsTotal: 4500,
      dependents: 2,
      maritalStatus: 'MARRIED',
      debtTypes: {
        banks: 8000,
        cards: 2000,
        personals: 2000,
        recentLoans: 0,
        coinCrypto: 0,
      },
      riskFlags: ['보증 채무 독촉 집중', '고액 연체 채무 수위 높음'],
    }
  }
];

export const initialConsultMessages: ConsultMessage[] = [
  {
    id: 'msg-1',
    consultRequestId: 'req-2',
    senderType: 'client',
    senderId: 'client-2',
    senderName: '김영희',
    message: '안녕하세요 이소민 변호사님, 자영업 폐업 후 생활고로 상담 신청 드립니다. 아이가 있고 수입이 부족해서 파산 신청도 가능한지 걱정입니다.',
    createdAt: '2026-05-25T14:35:00Z'
  },
  {
    id: 'msg-2',
    consultRequestId: 'req-2',
    senderType: 'lawyer',
    senderId: 'lawyer-2',
    senderName: '이소민 변호사',
    message: '김영희 요청자님 안녕하십니까. 이소민 변호사입니다. 자녀분을 홀로 부양하시면서 폐업까지 겹쳐서 심적인 부담이 무척 크실 것으로 생각됩니다. 요청자님의 채무 대비 가용 소득을 분석해보면 파산 면책 대상이 되기 매우 적합해 보입니다. 우선 근처의 시중 독촉 전화를 긴급하게 차단할 수 있는 금지명령 접수까지 속전속결로 진행하는 로드맵을 설계해 드리겠습니다.',
    createdAt: '2026-05-25T14:45:00Z'
  },
  {
    id: 'msg-3',
    consultRequestId: 'req-3',
    senderType: 'client',
    senderId: 'client-3',
    senderName: '이동현',
    message: '연대 보증 빚이 제 명의로 완전히 넘어왔습니다. 회사에 월급 압류가 오는 걸 막으려면 금지명령이 언제쯤 나올까요?',
    createdAt: '2026-05-24T10:00:00Z'
  },
  {
    id: 'msg-4',
    consultRequestId: 'req-3',
    senderType: 'lawyer',
    senderId: 'lawyer-1',
    senderName: '김우진 변호사',
    message: '이동현 본 본인 상담 요청에 참여한 김우진 변호사입니다. 통상적으로 개인회생 접수 후 3~7일 이내에 법원의 금지명령이 내려집니다. 금지명령이 채권자에게 송달되는 순간부터 회사 급여 압류는 법률적으로 차단되며, 일체 독촉 전화를 받지 않으셔도 되니 걱정 놓으십시오. 당사로 보증 관계 서류만 신속히 전달해 주시면 오늘 바로 접수 서류 작성을 시작하겠습니다.',
    createdAt: '2026-05-24T10:15:00Z'
  }
];

export const initialCases: Case[] = [
  {
    id: 'case-1',
    clientId: 'client-99',
    clientName: '정우성',
    phone: '010-8888-2222',
    status: 'document',
    assignedLawyerId: 'lawyer-1',
    assignedLawyerName: '김우진 변호사',
    debtTotal: 8500,
    income: 260,
    createdAt: '2026-05-10T12:00:00Z',
    updatedAt: '2026-05-20T14:00:00Z',
    notes: [
      '개인회생 신청 위임장 수령 완료',
      '부채 증명원 발급 대행업체 전달 요청',
      '최근 대출금 사용처에 대한 소명서 자료 취합 중'
    ]
  },
  {
    id: 'case-2',
    clientId: 'client-98',
    clientName: '최은지',
    phone: '010-7777-1111',
    status: 'filing',
    assignedLawyerId: 'lawyer-2',
    assignedLawyerName: '이소민 변호사',
    debtTotal: 4200,
    income: 180,
    createdAt: '2026-04-12T09:00:00Z',
    updatedAt: '2026-05-18T11:00:00Z',
    notes: [
      '서울회생법원 개인회생 신청서 최종 접수 완료',
      '금지명령 인용 송달 완료 - 독촉 전면 금지 상태',
      '1차 보정 권고 수령 (통장 거래 내역 1년 치 제출 요함)'
    ]
  },
  {
    id: 'case-3',
    clientId: 'client-97',
    clientName: '박창호',
    phone: '010-6666-5555',
    status: 'commencement',
    assignedLawyerId: 'lawyer-3',
    assignedLawyerName: '최덕중 변호사',
    debtTotal: 15000,
    income: 310,
    createdAt: '2026-02-15T15:00:00Z',
    updatedAt: '2026-05-22T13:30:00Z',
    notes: [
      '수원회생법원 개시 결정 통과 완료',
      '채권자 집회 출석 날짜 확정 (2026년 7월 15일 예정)',
      '법원 회생위원이 지정한 신한은행 신규 변제금 가상계좌 개설 안내 완료'
    ]
  },
  {
    id: 'case-4',
    clientId: 'client-96',
    clientName: '신미래',
    phone: '010-5555-0000',
    status: 'approval',
    assignedLawyerId: 'lawyer-1',
    assignedLawyerName: '김우진 변호사',
    debtTotal: 6200,
    income: 210,
    createdAt: '2025-09-01T10:00:00Z',
    updatedAt: '2026-05-11T16:00:00Z',
    notes: [
      '개인회생 최종 인가 결정 고시 완료',
      '변제율 48% 확정 (기존 채무 6,200만원 중 약 2,900만원 감면)',
      '매월 81만원씩 36개월간 성실 변제 개시'
    ]
  },
  {
    id: 'case-5',
    clientId: 'client-95',
    clientName: '배정민',
    phone: '010-4444-9999',
    status: 'discharge',
    assignedLawyerId: 'lawyer-2',
    assignedLawyerName: '이소민 변호사',
    debtTotal: 9500,
    income: 250,
    createdAt: '2023-01-10T09:30:00Z',
    updatedAt: '2026-05-26T02:00:00Z',
    notes: [
      '36개월 성실 변제 전액 불입 완료',
      '면책 신정서 대리 제출 및 법원 최종 면책 허가서 송달 완료',
      '한국신용정보원 연대 채무 공공기록 코드 해제 통지 확인',
      '신용 회복 및 경제적 갱생 완료 축하 연락'
    ]
  }
];

export const platformPlans = [
  {
    name: 'Basic',
    price: '월 30만원',
    features: ['팀원 최대 2명', '기본 상담 관리 CRM', '실시간 채팅 통화 기능', '오픈 매칭 최대 5건/월 무료 참여'],
    color: 'border-slate-300 dark:border-slate-800'
  },
  {
    name: 'Pro',
    price: '월 80만원',
    features: ['팀원 최대 10명', '팀 관리 & 인원별 권한 분배', '보정명령 자동 추적 통합', '오픈 매칭 무제한 참여', '사건 관리 통합 칸반 보드'],
    popular: true,
    color: 'border-blue-500 ring-2 ring-blue-500/20'
  },
  {
    name: 'Team / LawFirm Enterprise',
    price: '월 150만원',
    features: ['팀원 무제한', '다중 개별 영업 지부 분리 운영', '팀 KPI 대시보드 및 수임 성과 리포트', '마이데이터 연동 법원 문서 원클릭 자동 파싱', '전담 고객 성공(CS) 매니저 배정'],
    color: 'border-amber-400'
  }
];
