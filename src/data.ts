import { LawFirm, Team, User, ConsultRequest, Case, ConsultMessage, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, ClientInquiry, PlatformConfig } from './types';



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
  },
  {
    id: 'lawyer-4',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '박성현 변호사',
    role: 'LAWYER',
    fields: ['개인회생', '도산법전문', '서울회생법원'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256',
    bio: '도산법 전문 12년 경력. 서울회생법원 맞춤 특화 소명서 개진을 통해 변제율 30% 이하 최다 기각 방어 인용 기록.',
    recentActivity: '최근 7일 내 채무 변제율 23% 인가 완료',
    matchedCount: 110
  },
  {
    id: 'lawyer-5',
    lawFirmId: 'firm-1',
    teamId: 'team-2',
    name: '한지민 변호사',
    role: 'LAWYER',
    fields: ['여성회생', '가사회생', '전세사기피해'],
    region: '서울/경기',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256',
    bio: '여성 의뢰인 비밀 보장 맞춤 케어 전문가. 가족 몰래 진행하는 가사 회생, 전세사기 피해자 신속 긴급 구제 소송 대리.',
    recentActivity: '전세사기 피해 임차인 전액 탕감 면책 완료',
    matchedCount: 88
  },
  {
    id: 'lawyer-6',
    lawFirmId: 'firm-2',
    teamId: 'team-3',
    name: '정민우 변호사',
    role: 'LAWYER',
    fields: ['개인파산', '수원회생', '최근대출회생'],
    region: '경기/수원',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256',
    bio: '수원 및 인천회생 전문 대응. 최근 대출 비중이 50%가 넘는 까다로운 기각 위기 사건 100% 개시 결정 인용 기록 보유.',
    recentActivity: '수원지법 연체 10일 차 급여 가압류 즉시 차단',
    matchedCount: 94
  },
  {
    id: 'lawyer-7',
    lawFirmId: 'firm-1',
    teamId: 'team-2',
    name: '오윤아 변호사',
    role: 'LAWYER',
    fields: ['자영업자회생', '상가권리금회생', '고액부채'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    bio: '상가 자영업 폐업 및 권리금 손실 회생 전문. 상가 임대차 계약 분쟁과 결합된 복잡한 사업 채무 해결 경험 다수.',
    recentActivity: '음식점 폐업 부채 2억 5천만 원 면책 성공',
    matchedCount: 64
  },
  {
    id: 'lawyer-8',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '윤성호 변호사',
    role: 'LAWYER',
    fields: ['전문직회생', '의사약사회생', '고액채무'],
    region: '서울/경기',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
    bio: '고액 채무(3억 이상) 및 전문직 회생 전문. 의사, 약사, 세무사 면허를 보존하며 부채 90% 이상을 감면해 드립니다.',
    recentActivity: '개원의 고액 사업 자금 부채 8억 개인회생 개시',
    matchedCount: 52
  },
  {
    id: 'lawyer-9',
    lawFirmId: 'firm-2',
    teamId: 'team-3',
    name: '권다인 변호사',
    role: 'LAWYER',
    fields: ['주식코인회생', '청산가치반응', '보정명령대응'],
    region: '경기/수원',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
    bio: '주식/코인/선물옵션 투자 실패로 인한 과도한 채무 탕감 전문. 청산가치 강제 반영 보정에 대한 강력한 의견서 제출 전략.',
    recentActivity: '비트코인 투자 빚 1억 2천 변제율 28% 인가',
    matchedCount: 82
  },
  {
    id: 'lawyer-10',
    lawFirmId: 'firm-1',
    teamId: 'team-2',
    name: '서준호 변호사',
    role: 'LAWYER',
    fields: ['개인파산', '기초수급자파산', '고령자파산'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=256',
    bio: '개인파산 및 면책 신청 대리인 전문. 고령자, 장기 투병 환자, 기초생활수급자의 전액 채무 면제 최적 가이드 지원.',
    recentActivity: '70대 고령 기초생활수급자 채무 7천 전액 파산 면책',
    matchedCount: 71
  },
  {
    id: 'lawyer-11',
    lawFirmId: 'firm-1',
    teamId: 'team-1',
    name: '강지영 변호사',
    role: 'LAWYER',
    fields: ['프리랜서회생', '배달라이더회생', '1인자영업'],
    region: '서울/경기',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256',
    bio: '프리랜서 및 플랫폼 노동자, 1인 자영업자 간이회생 전문. 투명하고 정당한 실소득 산정을 통해 공제 생계비 보정폭 극대화.',
    recentActivity: '배달 라이더 소득 입증을 통한 최적 변제안 통과',
    matchedCount: 68
  },
  {
    id: 'lawyer-12',
    lawFirmId: 'firm-2',
    teamId: 'team-3',
    name: '임태오 변호사',
    role: 'LAWYER',
    fields: ['보정속결대응', '중지명령신청', '압류해제'],
    region: '경기/수원',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256',
    bio: '보정명령 즉각 기동단장. 법원의 복잡한 소명 지시를 3일 이내에 완벽히 처리하며 금지명령 즉시 송달 및 채권추심 차단.',
    recentActivity: '보정명령 통보 48시간 내 완벽 보정서 제출 완료',
    matchedCount: 78
  },
  {
    id: 'lawyer-13',
    lawFirmId: 'firm-1',
    teamId: 'team-2',
    name: '조현아 변호사',
    role: 'LAWYER',
    fields: ['신용회복비교', '연체전채무조정', '상담가이드'],
    region: '서울',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=256',
    bio: '신용조회 및 채권추심 긴급 차단 대응. 신용회복위원회의 채무조정 제도와 개인회생을 비교 분석하여 1:1 맞춤 진단 제공.',
    recentActivity: '연체 발생 하루 전 개인회생 긴급 접수 완료',
    matchedCount: 59
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
    color: 'border-[#1F2937]/80'
  },
  {
    name: 'Pro',
    price: '월 80만원',
    features: ['팀원 최대 10명', '팀 관리 & 인원별 권한 분배', '보정명령 자동 추적 통합', '오픈 매칭 무제한 참여', '사건 관리 통합 칸반 보드'],
    popular: true,
    color: 'border-brand ring-2 ring-brand/20'
  },
  {
    name: 'Team / LawFirm Enterprise',
    price: '월 150만원',
    features: ['팀원 무제한', '다중 개별 영업 지부 분리 운영', '팀 KPI 대시보드 및 수임 성과 리포트', '마이데이터 연동 법원 문서 원클릭 자동 파싱', '전담 고객 성공(CS) 매니저 배정'],
    color: 'border-indigo-500/50'
  }
];

export const mockNewsArticles: NewsArticle[] = [
  {
    id: 'news-1',
    title: '주식/코인 손실 빚 8,000만 원, 개인회생 전 먼저 확인해야 할 3가지',
    excerpt: '서울회생법원 실무준칙 개정으로 투자 손실을 청산가치에서 제외하는 구체적 방법과 입증 가이드를 공개합니다.',
    content: `최근 가상화폐(비트코인, 알트코인 등) 및 해외선물 레버리지, 국내외 주식 투자 실패로 감당할 수 없는 채무를 지게 된 2030 직장인과 청년들의 상담 신청이 폭증하고 있습니다.

과거에는 주식이나 코인으로 날린 돈도 모두 채무자의 "청산가치(보유 재산)"로 산정되어, 결국 그 날린 원금만큼을 고스란히 3~5년 동안 매달 다 갚아 나가야 했습니다. 사실상 개인회생 탕감 혜택을 전혀 받지 못하고 기각이나 변제금 폭탄을 맞이하게 되는 구조였습니다.

하지만 서울회생법원, 수원회생법원, 부산회생법원 등 주요 법원의 실무준칙이 개정되면서 도산 절차에 큰 혁신이 생겼습니다.

핵심은 **'가상자산 및 주식 투자의 평가손실액은 청산가치(보유 재산)에 반영하지 않는다'**는 원칙입니다.

예를 들어, 8,000만 원의 신용대출을 받아 코인에 전액 투자했다가 폭락하여 현재 잔고가 500만 원만 남은 경우:
- **과거**: 평가손실 7,500만 원도 재산으로 분류되어 최소 7,500만 원 이상(변제율 약 94%)을 변제해야 했음.
- **현재**: 보유한 잔고 500만 원만 청산가치로 인정되며, 월 소득에 따라 원금의 최대 80~90%까지 법적으로 감면받을 수 있음.

그러나 이러한 특혜를 누리기 위해서는 법원의 엄격한 심사 보정권고를 넘어서야 합니다. 법원은 대출을 실행한 직후 바로 투자했는지(최근 채무), 자금을 어딘가로 은닉하거나 타인 명의로 빼돌렸는지를 강하게 의심합니다.

변제금을 효과적으로 깎기 위한 핵심 소명 전략은 다음과 같습니다:
1. **투명한 거래원장 분석표 제출**: 거래소(업비트, 빗썸, 바이낸스 등)의 입출금 거래 내역과 주식 원장을 1원 단위까지 엑셀 파일로 시각화하여 제출해야 합니다.
2. **사행성 재발 근절 확약서**: 재차 위험 투자를 실행하지 않겠다는 다짐과 계좌 폐쇄 증빙을 통해 재판부의 선처와 양형을 이끌어내야 합니다.
3. **생계비 공제의 정밀성**: 소득 수준에 맞춘 가용소득을 정확하게 배정하여 법원이 개시 결정을 빠르게 내릴 수 있도록 완벽한 소명 의견서를 제출해야 합니다.

주식이나 코인 빚으로 극단적인 고통을 겪고 계시다면, 주저하지 말고 도산 전문 법률 대리인의 도움을 받아 골든타임을 확보해 새출발을 시작하십시오.`,
    category: '개인회생',
    badge: 'HOT',
    authorId: 'lawyer-2',
    authorName: '이소민 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
    views: 1542,
    date: '2026-05-28',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-2',
    title: '연체 독촉 전화가 하루 10통, 채무자대리와 회생 중 무엇이 먼저일까?',
    excerpt: '대부업체와 사채업자의 극심한 빚 독촉에 고통받고 있다면, 변호사를 채무자대리인으로 선임하여 즉시 전화를 차단하는 합법적 절차를 안내합니다.',
    content: `신용카드 대금이나 시중은행 대출, 대부업 채무가 단 며칠이라도 연체되면 채권추심원들로부터 빗발치는 독촉 전화와 문자가 시작됩니다. 하루에도 대여섯 번씩 울리는 독촉 전화와 직장으로 찾아오겠다는 협박성 문자는 일상생활과 정신 건강을 완전히 파괴합니다.

연체 독촉으로부터 당장 오늘이라도 해방될 수 있는 가장 빠르고 완벽한 합법적 제도가 바로 **'변호사 채무자대리인 제도'**입니다.

### 채무자대리인 제도란?
채권의 공정한 추심에 관한 법률(채심법) 제8조의2에 의거하여, 채무자가 변호사를 대리인으로 선임하고 이를 채권추심자에게 서면 통지한 경우, **채권자는 채무자 본인에게 직접 연락(유선 전화, 문자, 이메일, 우편물 발송 등)을 취하거나 직장 및 자택으로 방문할 수 없습니다.**

모든 독촉 및 변제 협의는 선임된 변호사 대리인 사무실로만 단일화되어 진행되어야 합니다. 이를 위반하고 채무자에게 1회라도 직접 접촉을 시도할 경우, 해당 추심 업체에는 최대 2,000만 원 이하의 과태료가 부과되는 중범죄에 해당합니다.

### 어떤 채무에 적용되나요?
- **대부업체(등록 대부업체 포함) 및 미등록 사채 채무**: 변호사 대리인단이 즉시 선임서를 발송하여 추심을 차단합니다.
- **제1, 2금융권 카드사 및 시중은행**: 개인회생 접수 시 동시에 접수하는 법원의 **'금지명령'**을 통해 평균 3~5일 내에 전면 독촉이 금지됩니다.

### 대처 가이드라인
1. **선임 통보 후 유선 대응 차단**: 변호사가 선임되었다는 통지서가 채권자 측에 송달된 이후부터는 어تقد 전화도 직접 받으실 필요가 없으며, "선임된 변호사 대리인과 얘기하라"고 한마디만 하신 뒤 끊으시면 됩니다.
2. **증거 수집**: 만약 선임 통지 이후에도 독촉을 강행하거나 부모님, 배우자 등 가족에게 채무 사실을 폭로하겠다고 위협하는 경우, 유선 통화 녹취나 문자 화면을 캡처해 두시면 불법 추심 혐의로 형사 고소하여 강력히 대응할 수 있습니다.

혼자서 채권추심팀의 억압적인 전화를 견뎌내려 하지 마십시오. 변호사 대리인단을 앞세워 평온한 일상을 회복하시고, 그와 동시에 개인회생을 준비하여 채무의 근본적인 원인을 탕감 처리하시는 것이 현명합니다.`,
    category: '금지명령/추심',
    badge: 'NEW',
    authorId: 'lawyer-1',
    authorName: '김우진 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
    views: 987,
    date: '2026-06-01',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-3',
    title: '세금 체납 3년차, 소멸시효보다 먼저 확인해야 할 압류 이력',
    excerpt: '국세 및 지방세 체납이 지속되고 있다면, 5년 또는 10년의 징수권 소멸시효가 작동하기 전 과세관청이 가한 압류 이력의 적법성을 먼저 점검해야 합니다.',
    content: `국세, 지방세, 건강보험료 등 공과금과 세금 체납이 누적되면 급여, 예금, 부동산 등에 대한 과세관청의 강력한 압류가 집행됩니다. 많은 체납자가 "5년(혹은 5억 이상은 10년)만 버티면 소멸시효로 세금이 없어지겠지"라고 기대하지만, 현실은 그렇지 않습니다.

소멸시효가 완성되기 전에 과세당국이 단 한 건이라도 압류를 진행하면 그 즉시 시효 진행은 중단(정지)되고, 압류가 해제될 때까지 시효는 다시 흐르지 않기 때문입니다.

따라서 세금 체납 해결을 위해 시효 완성만을 무작정 기다리는 것은 매우 위험하며, 다음과 같은 압류 이력을 먼저 정밀 추적해 법률적 타당성을 확인해야 합니다.

### 1. 형식적/부적법 압류의 실체 파악
세무서나 지자체에서 압류를 집행했으나, 실제로 가치가 전혀 없는 소액 예금 계좌나 무가치한 압류물을 대상으로 한 경우, 국세기본법상 '체납처분의 중지/해제' 사유에 해당할 수 있습니다. 
만약 압류 자체가 무효이거나 해제되어야 마땅한 사안임에도 방치되어 있었다면, 변호사를 통해 즉시 압류 해제를 청구하고 시효를 정상적으로 재개시킬 수 있습니다.

### 2. 세금 체납도 해결 가능한 회생/파산 연계
국세와 지방세는 개인회생 절차에서 "우선권 있는 개인회생채권"으로 분류됩니다. 
즉, 세금을 일반 채무와 함께 포함시켜 최장 3년(혹은 5년)의 기간 동안 분할하여 전액 변제하는 계획안을 제출하고, 일반 신용대출 등은 대폭 감면받음으로써 세금 독촉과 일반 채무 압박을 동시에 종식할 수 있습니다.

### 3. 과세전적부심사 및 권리구제 절차
체납이 발생한 원인 세금 부과 자체가 억울하거나 하자가 있는 처분이었다면, 부과 처분의 취소 소송이나 권리구제 청구를 병행해야 합니다.

세금 체납은 시간이 해결해주지 않습니다. 징수권 소멸시효의 정밀 분석과 과세처분의 하자를 파악하는 전담 채무 변호사의 조력을 통해 실질적인 세금 면제 및 해결 전략을 도출하십시오.`,
    category: '세금체납',
    badge: 'BEST',
    authorId: 'lawyer-11',
    authorName: '강지영 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256',
    views: 2105,
    date: '2026-05-25',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-4',
    title: "가족 모르게 진행하는 '비밀 개인회생' 가능한가? 직장·배우자 노출 차단법",
    excerpt: "주변인이나 직장 동료에게 빚 독촉 및 회생 신청 사실이 알려질까 두려우신가요? 대리인의 비밀 송달처 설정과 법원 통지서 안심 관리 시스템을 소개합니다.",
    content: `채무 연체 및 독촉 상황에 놓였을 때 가장 많은 분들이 두려워하는 것은 바로 **"가족이나 회사 직장에 빚 사실이 노출되는 것"**입니다. 실제로 법원 통지서가 집으로 발송되어 배우자가 알게 되거나, 직장에 급여 가압류 결정문이 전달되면서 부끄러운 소문이 도는 비극이 일어나기도 합니다.

결론부터 말씀드리면, **경험이 풍부한 전문 법률 대리인을 선임할 경우 직장 및 가족 모르게 100% 비밀을 유지하며 개인회생 인가까지 마치는 것이 가능합니다.**

비밀 보장을 위해 변호사단이 가동하는 3대 안심 방어막은 다음과 같습니다.

### 1. 법원 송달수령인 지정 (우편물 전면 대리 차단)
개인회생 신청서 접수 시, 모든 법원 우편물(보정 권고, 개시 결정문, 채권자 이의신청서 등)의 송달 주소를 채무자의 자택이나 직장이 아닌 **'변호사 사무실'**로 지정 신청합니다. 이렇게 하면 대법원 도산 재판부에서 발송하는 어떠한 우편물도 본인 집으로 직접 배달되지 않고 변호사 사무소에서 대리 수령하여 안전하게 전자 보관 처리합니다.

### 2. 신속한 금지명령 접수를 통한 급여 가압류 원천 봉쇄
직장 급여 담당자나 사장님이 본인의 빚 상황을 알게 되는 가장 흔한 경로는 채권자가 직장에 급여 가압류를 걸어 통지서가 발송될 때입니다. 연체가 임박한 시점 혹은 연체 직후에 즉시 법원 접수를 진행하여 3~5일 이내에 **'금지명령'**을 도출하면, 채권자는 회사에 어떠한 가압류나 급여 인출 압박도 가할 수 없게 되므로 직장 노출을 완벽하게 차단할 수 있습니다.

### 3. 배우자 서류 제출 최소화 및 마스킹 소명
과거에는 배우자의 모든 금융 거래 내역과 재산 소명서를 까다롭게 요구하여 배우자 몰래 진행하기가 어려웠으나, 최근에는 배우자의 기여도가 얽히지 않은 고유 채무의 경우 배우자 명의 제출 서류를 전략적으로 최소화하고 필요시 대리인이 세무서 발급분 등 간접 루트를 가이드하여 배우자 모르게 서류 준비를 속결할 수 있습니다.

채무 사실이 주변에 알려져 인생이 무너질까 걱정되어 골든타임을 허비하지 마십시오. 의뢰인의 철저한 비밀 유지와 신분 보호를 최우선 가치로 여기는 도산 전문 변호사 매칭을 통해 조용히, 그리고 완벽하게 새 출발을 완성해 가십시오.`,
    category: '개인회생',
    badge: null,
    authorId: 'lawyer-5',
    authorName: '한지민 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256',
    views: 1204,
    date: '2026-05-30',
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-5',
    title: '개인회생 vs 개인파산, 나에게 맞는 채무조정 제도는 무엇일까? 자격 비교',
    excerpt: '지속적인 소득 유무, 고령 또는 중증 질병 여부, 부채의 원인에 따라 전액 탕감 파산면책과 분납 회생 계획안 중 최고의 선택을 제안합니다.',
    content: `채무 독촉 위기에 직면한 많은 분들이 법적 도산 제도를 알아볼 때 "개인회생을 신청해야 할지, 아니면 개인파산을 청구해야 할지" 큰 혼란을 겪습니다. 두 제도는 빚을 합법적으로 탕감받는다는 점은 같지만, 신청 자격 요건과 절차, 결과 면에서 180도 완전히 다릅니다.

본인의 소득 구조와 상황에 맞춰 어떠한 제도를 전략적으로 선택해야 하는지 일목요연하게 비교 분석해 드립니다.

### 1. 개인회생 (3~5년 분납 후 잔여 채무 탕감)
소득이 있는 직장인, 프리랜서, 자영업자가 법정 생계비를 제외한 '가용 소득'을 매월 성실히 36~60개월 동안 나누어 갚은 뒤 남은 빚은 전부 탕감받는 제도입니다.

- **신청 자격**: 반복적이고 확실한 수입(알바, 일용직 포함 최저생계비 이상)이 있어야 함.
- **최대 한도**: 무담보 10억 원 이하, 담보부 15억 원 이하 (총 부채 25억 한도).
- **장점**: 직장 면허 유지(의사, 공무원 등 자격 보존 가능), 본인 명의 재산(집, 차 등)을 청산하지 않고 보유하면서 진행 가능.
- **채무 원인**: 주식, 코인, 사행성 도박 빚도 제한 없이 신청 가능.

### 2. 개인파산 및 면책 (일시에 모든 채무 100% 탕감)
현재 보유한 재산을 전량 환가하여 채권단에게 배당한 뒤, 갚지 못한 나머지 빚 전액(100%)을 단 한 번의 법원 선고로 전부 면제받는 제도입니다.

- **신청 자격**: 고령(만 60세 이상), 중증 질병 또는 중복 장애 등으로 장래 근로 활동을 아예 수행할 수 없어 수입이 최저생계비 미달이거나 무직이어야 함.
- **최대 한도**: 채무 액수 제한 없음.
- **장점**: 3년간 다달이 변제할 의무 없이, 면책 결정 한 번으로 원금과 이자가 즉시 100% 전액 탕감됨.
- **주의점**: 면책 전까지 공무원 임용 제한 등 일부 자격 불이익이 발생할 수 있으며, 사행성 투기나 재산 은닉 사실이 밝혀지면 '면책 불허가' 처분을 받을 수 있음.

### 나에게 맞는 제도를 진단하는 핵심 기준
- **소득이 매달 발생하며 보유 재산을 지키고 싶다면?** ➡️ **개인회생**
- **근로활동 능력이 완전히 소실되었고 갚을 돈이 아예 없다면?** ➡️ **개인파산**

자신에게 맞지 않는 무리한 제도를 단독으로 선택해 접수할 경우, 법원의 엄격한 기각 명령으로 인해 기동 비용과 소중한 시간을 모두 날리게 될 수 있습니다. 선제적으로 정밀 소득·자산 분석을 변호인단과 거친 뒤, 가장 안전하고 유리한 트랙으로 신청을 개시하십시오.`,
    category: '개인파산',
    badge: null,
    authorId: 'lawyer-10',
    authorName: '서준호 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=256',
    views: 843,
    date: '2026-05-15',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-6',
    title: "급여 압류 예정 통지서를 받았을 때 즉시 신청해야 하는 '압류중지명령' 대처법",
    excerpt: "예금이나 직장 급여 압류가 개시되면 생계비 마련도 불가능해집니다. 회생 신청서와 동시에 긴급 중지명령을 청구하여 임금을 보존하는 법리를 다룹니다.",
    content: `채권사들로부터 법원의 지급명령 결정문이 도달한 뒤에도 빚 상환이 안 되면, 채권단은 채무자의 **거래은행 예금 압류** 혹은 **직장 급여 가압류/압류** 강제집행을 신청합니다.

급여 압류가 실제로 집행되면 본인 실수령 월급의 절반에 해당하는 금액(민사집행법상 최저 185만 원 공제 가능 한도 적용)을 회사가 채권자에게 직접 넘겨주게 되며, 직장에 빚쟁이라는 명백한 낙인이 찍히게 됩니다.

압류 예고 통지서를 받으셨거나 이미 압류가 진행된 상황이라면, 단 1초도 지체하지 말고 법원에 **'압류 중지 및 금지명령'**을 신청해야 합니다.

### 압류 중지명령의 기동 메커니즘
개인회생 신청서와 함께 '중지/금지명령 신청서'를 즉시 동시 접수합니다.
1. **금지명령 (추가 압류 방지)**: 아직 압류되지 않은 남은 급여 및 자산에 대해 향후 추가적인 압류나 독촉을 전면 차단합니다.
2. **중지명령 (진행 중인 압류 정지)**: 이미 진행 중인 압류 및 경매 집행을 더 이상 실행하지 못하도록 법적으로 강제 정지시킵니다.

### 이미 급여 압류가 완료되어 통장에서 돈이 빠져나가고 있다면?
많은 분들이 "압류가 끝났으니 회생이 안 되겠지"라고 낙담하지만 그렇지 않습니다.
회생 신청과 중지명령이 결정되면, 회사의 급여 담당자는 압류 금액을 채권자에게 임의로 송금해 줄 수 없으며, 해당 돈은 법적 보호를 받으며 회사 내에 **'압류 적립금'**으로 쌓이게 됩니다.

이후 개인회생 최종 **'인가 결정'**이 떨어지면, 변호사가 해당 적립금에 대한 압류 해제 신청서를 제출하여 그동안 차곡차곡 쌓여 있던 수백~수천만 원의 압류 적립금을 채무자가 한꺼번에 온전히 돌려받아 생활비로 사용하거나 1차 변제금 일시불 대환으로 포섭할 수 있습니다.

강제집행이 들어왔을 때는 시간 싸움이 전부입니다. 대리인이 하루라도 빨리 접수번호를 이끌어내어 법원의 중지 송달문을 채권단과 회사 급여부서에 도착시켜야 파국을 차단할 수 있습니다. 신속히 기동하십시오.`,
    category: '금지명령/추심',
    badge: 'HOT',
    authorId: 'lawyer-12',
    authorName: '임태오 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256',
    views: 1421,
    date: '2026-05-22',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-7',
    title: '폐업 자영업자 신규 자영업자 개인회생 소득 증빙과 보정 지연 방지책',
    excerpt: '식당, 도소매 등 사업자 카드 매출과 상가 보증금 권리금을 청산가치에 반영할 때 법원이 가장 집요하게 요구하는 보정 권고 핵심 문서를 파헤칩니다.',
    content: `자영업자 및 소상공인분들은 고정적인 월급이 나오는 일반 직장인들에 비해 개인회생 심사 과정이 배 이상 복잡하고 지연되는 경우가 많습니다.

그 이유는 개인사업자의 경우 매출 구조가 불규칙하며, 월세, 재료비, 인건비 등 필요 경비를 제하는 기준이 모호하여 법원 회생위원들이 소득 수입을 불신하고 재산 은닉 및 누락을 강도 높게 검토하기 때문입니다.

자영업자 개인회생 신청 시, 법원의 까다로운 보정 명령을 한 번에 통과하여 절차 지연을 완벽하게 방지하는 실무 대응 팁을 드립니다.

### 1. 객관적 매출 입증 자료의 선제적 정립
개인사업자는 국세청 부가가치세 확정신고서, 세무사 날인 재무제표 뿐만 아니라, 실시간 배달 플랫폼(배민, 요기요, 쿠팡이츠 등) 정산 원장, 카드 단말기 매출 내역서(여신금융협회 발급), 통장 입금 기록을 계통 분석하여 제출해야 소득 불신을 불식할 수 있습니다.

### 2. 정당한 '필요경비' 인정 전략
법원 회생위원은 "번 돈이 300만 원인데, 경비가 200만 원이라 실수령 소득은 100만 원뿐입니다"라는 주장을 절대 쉽게 수용하지 않습니다. 
- 상가 임대료 월세 송금 내역
- 원자재 매입 계산서 및 영수증
- 아르바이트 직원 급여 이체 기록 및 4대보험 원장
이 세 가지 필수 경비의 거래 흐름을 1원 단위까지 증명 서류로 결합해야 변제금을 결정하는 '순소득 가치'를 정당하게 보호받을 수 있습니다.

### 3. 상가 임차보증금 및 권리금의 청산가치 조율
현재 운영 중인 상가의 보증금은 원칙적으로 재산(청산가치)에 포함되나, 민사집행법상 지역별 최우선변제 소액보증금 범위에 한해 재산 면제 신청을 하여 차감받아야 변제 의무금 총액을 효과적으로 낮출 수 있습니다.

자영업자 도산은 일반 소득자 회생보다 훨씬 정밀한 세무 지식과 법원 회생위원실과의 전략적인 변론 조율이 필수적입니다. 자영업 폐업 전후의 위기 상황에 처한 소상공인분들은 자영업 맞춤 도산 가이드 수립을 위해 반드시 전문 대리인의 밀착 소명을 이용하십시오.`,
    category: '변제금/생계비',
    badge: null,
    authorId: 'lawyer-7',
    authorName: '오윤아 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    views: 631,
    date: '2026-05-19',
    imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'news-8',
    title: '의사·약사·한의사 전문직 회생, 자격 면허를 안전하게 유지하는 법적 요건',
    excerpt: '고액 채무가 발생하더라도 개인회생을 통하면 의사 면허 등 전문직 자격 상실 없이 병원을 계속 운영하면서 빚만 합리적으로 갚을 수 있습니다.',
    content: `의사, 약사, 한의사, 치과의사, 변호사, 회계사 등 전문직 라이선스를 보유한 분들은 고소득 군에 속하지만, 병원 개원 자금 대출, 고가 의료 장비 리스료, 혹은 최근의 개원가 불황 및 투자 실패로 인해 수억~수십억 원에 달하는 고액 부채로 파탄 지경에 이르는 경우가 꽤 많습니다.

이때 가장 큰 두려움은 **"내가 빚 독촉으로 파산하거나 개인회생을 신청하면 의사 면허가 박탈되거나 전문직 자격이 취소되지 않을까?"** 하는 점입니다.

명확한 법률적 사실관계를 알려드립니다.

### 개인파산 vs 개인회생 시의 자격 면허 변화
- **개인파산 및 면책 신청 (위험)**: 법률적으로 파산 선고를 받게 되면 의료법, 약사법, 변호사법 등 각 전문직 개별법에 명시된 **'자격 박탈 및 면허 취소 결격 사유'**에 직접 해당되어 면허가 상실됩니다. 경제적 갱생을 위해 파산을 신청했다가 직업 자체를 잃는 파국을 맞이할 수 있어 극도로 주의해야 합니다.
- **개인회생 신청 (안전)**: **개인회생은 면허 자격 취소나 결격 사유에 절대 해당하지 않습니다.** 법에 근거하여 회생 절차가 개시되더라도 병원이나 약국을 정상적으로 계속 영위할 수 있고, 공무원 신분이나 한의사 자격도 100% 온전히 유지됩니다.

### 전문직 개인회생 신청 시의 핵심 성공 요건
1. **고액 채무 한도 확인**: 개인회생은 무담보 채무 10억 원, 담보 채무 15억 원(총합 25억) 이하일 때만 신청이 가능합니다. 병원 리스 장비나 대출 잔액이 이 한도를 초과할 경우, 일반 회생 절차(법인회생 또는 간이회생 트랙)로 선제 전환 설계해야 합니다.
2. **소득 및 매출의 세무 검토**: 병원 급여 소득 및 비급여 카드/현금 영수증 매출을 토대로 미래 소득을 성실 입증하고, 간호사 급여나 임대료 등 필요 경비를 전략적으로 보정하여 월 변제 액수를 가장 현실적인 수준으로 타협해 내는 능력이 인가의 성패를 좌우합니다.

면허 상실의 공포 때문에 채권 사후 조치를 늦추고 고금리 사채로 돌려막으며 빚을 더 키우는 것은 최악의 선택입니다. 전문직 도산 매뉴얼과 법리에 정통한 전담 변호인단의 정밀 케어를 받아 면허를 안전하게 보존하고 경제적 자유를 빠르게 쟁취하십시오.`,
    category: '개인회생',
    badge: null,
    authorId: 'lawyer-8',
    authorName: '윤성호 변호사',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
    views: 412,
    date: '2026-05-10',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600'
  }
];

export const initialBanners: MainBanner[] = [
  {
    id: 'banner-1',
    title: "빚 독촉의 고통, 오늘 끊을 수 있습니다.",
    subtitle: "개인회생 신청 즉시 법원의 금지명령으로 빗발치는 독촉 전화, 추심 방문, 급여 압류가 전면 금지됩니다. 늦기 전에 골든타임을 확보하세요.",
    badge: "신속한 독촉 차단",
    color: "rgba(15, 23, 42, 0.93), rgba(30, 27, 75, 0.88)",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: 'banner-2',
    title: "코인·주식 투자 실패도 최대 90% 탕감 가능",
    subtitle: "단순 과장 광고가 아닙니다. 최근 개정된 회생 법원 실무 기준에 맞추어 투자 손실을 최소화하는 개인회생 계획안을 수립합니다.",
    badge: "투자 실패 부채 전문",
    color: "rgba(30, 27, 75, 0.93), rgba(15, 23, 42, 0.88)",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: 'banner-3',
    title: "알선료 수수료 0%! 투명한 도산 전문 변호사 매칭",
    subtitle: "본 플랫폼은 불법 사무장 브로커를 철저히 배제하고 법률적 책임이 보장된 정식 변호사단으로만 투명하게 운영됩니다.",
    badge: "변호사법 제34조 준수",
    color: "rgba(15, 23, 42, 0.95), rgba(23, 37, 84, 0.9)",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1200"
  }
];

export const initialQAs: ClientQA[] = [
  {
    id: 'qa-1',
    category: '코인/주식 손실',
    question: '코인 투자 실패로 진 빚 8천만 원, 회생 진행 시 탕감이 가능할까요?',
    author: '김*현 (직장인)',
    answer: '주식이나 가상화폐 투자로 인한 손실도 개인회생 신청 대상이 됩니다. 특히 서울회생법원의 경우 실무준칙에 의거하여 투자 손실금 자체를 청산가치에 강제로 반영하지 않도록 유예해주고 있어 변제액을 낮추는 데 매우 유리합니다. 다만 추가 대출 시점이나 최근 채무 비율에 따라 변동 소지가 있으므로 전문 소명서 준비가 관건입니다.',
    lawyerName: '이소민 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
    badge: '추천 답변'
  },
  {
    id: 'qa-2',
    category: '급여 압류',
    question: '회사를 다니는 도중 월급 가압류 예정 통지서를 받았습니다. 직장에 소문 안 나고 차단할 수 있나요?',
    author: '박*수 (사무직)',
    answer: '법률 대리인을 통해 개인회생 신청서와 동시에 "금지명령 및 중지명령"을 법원에 접수하면 대개 3~7일 내에 결정문이 발령됩니다. 금지명령이 채권자에게 송달되면 급여 압류 및 독촉 행위가 법적으로 일절 금지됩니다. 직장에 직접 압류 협박 전화가 오는 것도 원천 차단되므로 신속히 개입하셔야 합니다.',
    lawyerName: '김우진 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
    badge: '실시간 답변'
  },
  {
    id: 'qa-3',
    category: '프리랜서 회생',
    question: '배달 대행 프리랜서인데 4대 보험이 안 되어도 개인회생 신청이 가능한가요?',
    author: '이*우 (플랫폼 노동자)',
    answer: '네, 가능합니다. 개인회생은 고용 형태(정규직, 계약직, 일용직, 프리랜서)에 상관없이 정기적이고 확실한 수입(최저생계비 이상)이 있음을 소득 서류로 입증할 수 있다면 신청이 가능합니다. 3.3% 원천징수 영수증이나 입금 계좌 내역, 플랫폼 활동 정산 내역 등을 토대로 평균 소득을 산출하여 개시를 받아낼 수 있습니다.',
    lawyerName: '최덕중 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
    badge: '전문가 소견'
  },
  {
    id: 'qa-4',
    category: '배우자 재산',
    question: '배우자 명의의 아파트가 있으면 제 개인회생 진행 시 청산가치에 전액 반영되나요?',
    author: '최*민 (자영업)',
    answer: '과거에는 배우자 명의의 재산 형성에 본인의 기여 유무와 관계없이 무조건 50%를 신청인의 자산 청산가치로 가산하게 하였으나, 최근 서울/수원 등 도산전문법원의 실무준칙에 의거하여 배우자의 고유재산(특유재산)임이 입증되거나 신청인이 대금을 보탠 내역이 명백하지 않은 경우에는 청산가치 합산에서 전면 배제되는 것이 원칙입니다. 명확한 기여도 분석과 서면 소명이 관건입니다.',
    lawyerName: '한지민 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256',
    badge: '실시간 답변'
  },
  {
    id: 'qa-5',
    category: '전세사기 피해',
    question: '빌라 전세사기를 당해 1억 5천만 원의 전세대출금을 갚을 수 없습니다. 신용유의자 등록을 막을 수 있나요?',
    author: '장*영 (무직자)',
    answer: '네, 정부의 전세사기 피해자 특별법 지원 대상으로 결정되시면 독촉 연체 이자가 유예되며, 개인회생 시 최단 24개월 변제안 등 파격적인 특례를 누릴 수 있습니다. 선임 즉시 독촉 전화 차단 및 법원의 금지명령을 신청하여 신용유의자 등록과 가압류 절차를 실시간 완벽히 차단하고, 반환 불가능한 보증금 대출을 안전하게 탕감 대상으로 포섭할 수 있습니다.',
    lawyerName: '오윤아 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    badge: '긴급 지원'
  },
  {
    id: 'qa-6',
    category: '최근 대출 회생',
    question: '최근 6개월 이내에 빌린 대출 비중이 전체 채무의 70%가 넘습니다. 회생 기각 사유가 되나요?',
    author: '윤*현 (프리랜서)',
    answer: '단순히 최근 대출이 많다고 기각되진 않으나, 법원은 대출 자금의 고의적인 은닉이나 불성실 신청을 강하게 의심합니다. 따라서 대출금 수령 시점부터의 계좌 흐름을 1원 단위까지 추적 분석하여 기존 채무 대환(대동소이 돌려막기), 긴급 치료비, 소상공인 사업장 임대료 등 불가피하게 사용했음을 정밀 서류로 완벽 소명해야 기각을 원천 방어하고 정상 인가를 도출할 수 있습니다.',
    lawyerName: '박성현 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256',
    badge: '핵심 답변'
  },
  {
    id: 'qa-7',
    category: '자영업자 회생',
    question: '식당 운영 중 코로나 시기 대출과 월세 연체로 3억 원의 빚이 생겼습니다. 폐업하지 않고 회생이 되나요?',
    author: '김*호 (식당 운영)',
    answer: '네, 영업을 계속 정상 영위하면서 빚만 나누어 갚는 자영업자 특화 영업소득자 개인회생 제도가 있습니다. 카드 단말기 매출, 현금영수증 발행 내역, 부가세 납부원장 등을 과학적으로 정리하여 미래 기대 매출을 입증하고, 월세 및 임직원 급여 등 필수 경영 경비를 제외한 실소득을 기준으로 3~5년간 성실 분납하는 변제 솔루션이 가동됩니다.',
    lawyerName: '정민우 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256',
    badge: '영업 특화'
  },
  {
    id: 'qa-8',
    category: '전문직 면허보존',
    question: '개원 중인 한의사인데 병원 자금난으로 신용대출 5억 원을 졌습니다. 한의사 면허가 취소되나요?',
    author: '이*민 (한의사)',
    answer: '전혀 염려하지 않으셔도 됩니다. 개인회생은 법률적으로 채무자 파산 면책 신청과 달리 의사, 약사, 변호사 등 전문직 자격 면허나 공무원 품위 유지 신분에 아무런 불이익을 주지 않습니다. 병원을 정상적으로 운영하시면서 발생하는 전문직 소득을 기반으로 법정 공제 생계비를 정밀 산정하여 채무의 최대 90% 이상 탕감 혜택을 온전히 보존받으실 수 있습니다.',
    lawyerName: '윤성호 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
    badge: '추천 소견'
  },
  {
    id: 'qa-9',
    category: '추심 차단',
    question: '카드사 연체 3일째인데 직장으로 독촉 전화가 계속 와서 힘듭니다. 당장 전화를 막을 수 없나요?',
    author: '송*현 (사무직)',
    answer: '네, 연체가 시작되자마자 대리인을 선임해 법원에 신청 서류를 긴급 접수하고 "금지명령 결정"을 도출하면, 접수일 기준 대개 3일 내외에 결정문이 발송되어 각 금융사 채권팀의 유선 추심과 가택 방문 시도가 일절 법률상 불가능해집니다. 접수 이전에도 대리인 선임 완료 사실을 채권단에 정식 통보하여 무분별한 직장 전화 연락을 사전에 차단 조치하고 있습니다.',
    lawyerName: '조현아 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=256',
    badge: '긴급 구제'
  },
  {
    id: 'qa-10',
    category: '개인파산 면책',
    question: '심한 당뇨 합병증으로 직장을 그만두고 치료 중입니다. 채무 5천만 원인데 파산이 나을까요?',
    author: '황*진 (일시 무직)',
    answer: '현재 심각한 건강 상태로 인해 장기적인 근로 능력을 사실상 상실하였거나, 부양가족 생계비 미달로 채무 변제가 불가능한 한계 상황이시라면 개인회생보다는 "개인파산 및 면책 신청" 절차가 백배 유리합니다. 병원의 정밀 진단서, 장기 입원 통원비 내역서 및 근로 무능력 입증 서류를 탄탄히 구비해 채무 원금 전액(100%)을 면제받는 면책 결정으로 단번에 이끌어 드립니다.',
    lawyerName: '서준호 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=256',
    badge: '파산 전문'
  },
  {
    id: 'qa-11',
    category: '일용직 소득증빙',
    question: '현금으로 일당을 수령하는 건설 일용 노동자입니다. 급여 통장이 없어도 신청이 될까요?',
    author: '정*태 (일용 노동)',
    answer: '통장 수령이 아니시더라도 실소득을 소명할 수 있는 다각적인 증빙 자료(현장 근무 내역 일지, 소장 혹은 업체 명의의 임금 지급 확인서, 현금 입금 후 본인 주거래 은행 계좌에 즉시 예치한 자금 기록 사본 등)를 제출하면, 실무 재판부로부터 완벽하게 소득 가치로 인정받아 회생 개시 절차를 정상 완결할 수 있으니 부담 없이 도전하셔도 좋습니다.',
    lawyerName: '강지영 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256',
    badge: '소득 소명'
  },
  {
    id: 'qa-12',
    category: '보정권고 지연',
    question: '개인회생 신청 후 3개월째 보정 권고만 계속 나오면서 지연되고 있어요. 해결 방법이 있나요?',
    author: '임*서 (계약직)',
    answer: '보정명령서에서 요구하는 자금 계좌의 사용 실태 분석표 및 소유 자산 처분 가치의 재산 누락 소명을 정확하게 작성하지 못했기 때문에 회생위원실에서 계속 보완 보정을 지시하는 상태입니다. 당사의 법률 보정 즉각 속결 전담팀이 개입하여 지적 사항을 100% 보완한 정밀 소명 의견서와 소명 내역표를 재작성해 3일 내 제출하면 바로 다음 단계인 개시 통보를 빠르게 유도할 수 있습니다.',
    lawyerName: '임태오 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256',
    badge: '보정 속결'
  },
  {
    id: 'qa-13',
    category: '해외선물/주식',
    question: '해외 선물 레버리지 및 신용 융자 투자 실패 빚 1억 원도 탕감받을 수 있나요?',
    author: '오*우 (회사원)',
    answer: '네, 선물 거래 청산 빚이나 고금리 주식 레버리지 손실 채무도 원칙상 탕감 대상 법적 채무에 전액 포함됩니다. 다만 일반적인 생활고 채무에 비해 투자 실행 목적과 경위를 아주 꼼꼼하게 따지기 때문에, 향후 투자 재발 근절 확약 연명서, 금융 계좌 폐쇄 증명서 등을 전략적으로 배치하여 보정 권고 과정에서 판사/회생위원에 대한 양형 소명을 극대화하여 탕감 변제율을 최저로 조정해 드립니다.',
    lawyerName: '권다인 변호사',
    lawyerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
    badge: '실시간 답변'
  }
];

export const initialReviews: SuccessReview[] = [
  {
    id: 'rev-1',
    title: "코인 선물거래 빚 9천만 원, 변제율 13%로 종결되었습니다",
    category: "코인/주식 손실",
    author: "이*호 님 (30대 직장인)",
    originalDebt: 9200,
    remainingDebt: 1200,
    lawyerId: "lawyer-2",
    lawyerName: "이소민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
    content: "무리한 빚투와 돌려막기로 이자만 매달 300만 원 가까이 나갔습니다. 가압류 예고장이 날아와서 피눈물 흘리며 이곳을 찾았습니다. 이소민 변호사님께서 서울회생법원 최근 준칙에 맞춰 가상자산 평가 손실 부분을 집요하게 소명해주신 덕분에, 청산가치에 과도하게 잡히지 않고 변제금 월 33만 원(총 1,200만 원)으로 최종 인가받았습니다. 평생의 은인입니다.",
    tags: ["#코인실패", "#가압류중지", "#변제율13%"]
  },
  {
    id: 'rev-2',
    title: "생활비 신용카드 연체 독촉 하루 만에 차단 성공",
    category: "신용카드 연체",
    author: "김*정 님 (40대 자영업)",
    originalDebt: 4500,
    remainingDebt: 900,
    lawyerId: "lawyer-1",
    lawyerName: "김우진 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256",
    content: "가게 매출이 급락하며 카드 대금 돌려막기를 하다가 결국 연체가 되자, 하루에 10통씩 독촉 전화가 왔습니다. 김우진 변호사님과 상담 후 즉시 개인회생을 접수했고, 법원에서 4일 만에 금지명령이 나와서 독촉이 완전히 끊겼습니다. 원금 80% 탕감에 이자는 전액 면제되어 이제 조금씩 숨통이 트입니다. 저처럼 연체 독촉으로 두려우신 분들은 무조건 바로 변호사 매칭 받으세요.",
    tags: ["#신용카드연체", "#금지명령성공", "#자영업회생"]
  },
  {
    id: 'rev-3',
    title: "아픈 부모님 병원비로 지게 된 사채 빚, 전액 면제(파산) 받았습니다",
    category: "개인파산",
    author: "박*수 님 (50대 무직)",
    originalDebt: 7500,
    remainingDebt: 0,
    lawyerId: "lawyer-3",
    lawyerName: "최덕중 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256",
    content: "부모님 긴급 수술비로 사채와 대부업체 대출까지 쓰게 되었습니다. 저 또한 당뇨 합병증으로 근로 능력을 상실하게 되어 빚을 갚을 방법이 없었습니다. 최덕중 변호사님께서 제 처지를 깊이 공감해주시고 꼼꼼하게 파산 면책 요건을 입증해주신 덕분에, 얼마 전 법원으로부터 채무 액수 전액 면제(면책 성공) 판결을 받았습니다. 새로운 삶을 살 수 있게 해 주셔서 진심으로 머리 숙여 감사드립니다.",
    tags: ["#개인파산", "#면책성공", "#채무전액탕감"]
  },
  {
    id: 'rev-4',
    title: "보증 잘못 서서 날아온 급여 압류 딱지, 개인회생으로 해결",
    category: "연대보증 채무",
    author: "최*철 님 (45세 직장인)",
    originalDebt: 8000,
    remainingDebt: 2400,
    lawyerId: "lawyer-1",
    lawyerName: "김우진 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256",
    content: "친척 연대보증을 섰다가 친척이 도망쳐 제 급여가 압류당하기 직전이었습니다. 매달 월급의 절반을 뺏길 위기에서 김우진 변호사님을 통해 긴급 중지명령을 신청하여 압류 집행을 막아냈습니다. 이후 회생 절차를 통해 보증 채무 원금의 70%를 탕감받았고, 36개월간 성실히 납부하는 것으로 계획안이 통과되었습니다. 법률 전문가의 대처 속도가 얼마나 중요한지 뼈저리게 느꼈습니다.",
    tags: ["#연대보증", "#급여압류방어", "#압류중지성공"]
  },
  {
    id: 'rev-5',
    title: "부정기 소득 플랫폼 배달 라이더, 80% 감면 인가",
    category: "프리랜서 회생",
    author: "정*우 님 (20대 배달 프리랜서)",
    originalDebt: 3800,
    remainingDebt: 760,
    lawyerId: "lawyer-2",
    lawyerName: "이소민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
    content: "프리랜서 라이더라 매달 수입이 들쑥날쑥해서 개인회생이 될까 조마조마했습니다. 수입 입증 서류를 혼자 준비하기가 너무 막막했는데, 변호사님이 계좌 입출금 내역과 배달 정산 내역을 깔끔하게 정리해 소득을 증명해 주셨습니다. 탕감율 80% 수준으로 원금 760만 원만 나눠 갚게 되었습니다. 소득 증빙이 어려운 프리랜서분들도 겁먹지 마시고 도전하시길 권합니다.",
    tags: ["#프리랜서소득소명", "#라이더회생", "#원금80%감면"]
  },
  {
    id: 'rev-6',
    title: "해외주식 마진콜 빚 1억 5천만 원, 변제율 25% 인가 결정!",
    category: "코인/주식 손실",
    author: "정*훈 님 (30대 직장인)",
    originalDebt: 15000,
    remainingDebt: 3750,
    lawyerId: "lawyer-9",
    lawyerName: "권다인 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256",
    content: "해외 주식 마진콜과 신용 융자 실패로 1억 5천만 원의 빚을 졌습니다. 권다인 변호사님께서 청산가치 강제 반영 보정에 대해 강력한 반박 의견서를 제출해 주셔서 변제율 25% 수준인 월 104만 원으로 인가 결정을 받았습니다. 생명의 은인이십니다.",
    tags: ["#마진콜회생", "#변제율25%", "#권다인변호사"]
  },
  {
    id: 'rev-7',
    title: "비트코인 레버리지 실패 채무 1억 2천, 수원지법 28% 변제 결정",
    category: "코인/주식 손실",
    author: "송*민 님 (30대 연구원)",
    originalDebt: 12000,
    remainingDebt: 3360,
    lawyerId: "lawyer-9",
    lawyerName: "권다인 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256",
    content: "무리한 비트코인 투자 실패로 최근 대출 비중이 높아 수원지방법원에서 기각 위기였습니다. 권다인 변호사님의 정교한 보정 명령 즉각 대응 전략으로 수원지방법원에서 이례적으로 원금 72% 감면이라는 최선의 결과를 이끌어 냈습니다.",
    tags: ["#수원회생", "#비트코인투자실패", "#청산가치소명"]
  },
  {
    id: 'rev-8',
    title: "코인 선물 빚 돌려막기 8천만 원, 서울회생법원 변제율 18% 인가",
    category: "코인/주식 손실",
    author: "강*진 님 (20대 IT 프리랜서)",
    originalDebt: 8000,
    remainingDebt: 1440,
    lawyerId: "lawyer-2",
    lawyerName: "이소민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
    content: "코인 선물 거래로 8천만 원 채무를 지고 돌려막기 중이었습니다. 이소민 변호사님이 서울회생법원의 가상자산 평가손실 보정 준칙을 철저하게 활용하여 변제율 18%인 총 1,440만 원 납부 조건으로 최종 개시 결정을 받았습니다.",
    tags: ["#서울회생준칙", "#코인선물", "#변제율18%"]
  },
  {
    id: 'rev-9',
    title: "신용카드 돌려막기 연체 직전, 긴급 회생 신청으로 압류 방어",
    category: "신용카드 연체",
    author: "한*영 님 (40대 주부)",
    originalDebt: 5200,
    remainingDebt: 1300,
    lawyerId: "lawyer-5",
    lawyerName: "한지민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256",
    content: "가족 생활비를 신용카드로 충당하다 연체가 시작되어 채무 추심 연락이 쏟아지기 직전이었습니다. 한지민 변호사님께서 가족들 모르게 진행할 수 있도록 서류를 세심하게 챙겨 주셨고, 신청 3일 만에 금지명령을 받아 안전하게 방어했습니다.",
    tags: ["#가족모르게회생", "#여성비밀보장", "#신용카드연체"]
  },
  {
    id: 'rev-10',
    title: "카드론 및 연체 채무 6천만 원, 한달 만에 개시결정",
    category: "신용카드 연체",
    author: "민*우 님 (30대 영업직)",
    originalDebt: 6000,
    remainingDebt: 1500,
    lawyerId: "lawyer-12",
    lawyerName: "임태오 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256",
    content: "카드론 돌려막기와 카드 연체 독촉으로 정상적인 일상생활이 불가능했습니다. 보정기동단 임태오 변호사님이 사건 수임 즉시 법원에 금지명령을 송달시키고 48시간 내 완벽 보정서 제출을 진행해 한 달 만에 완벽한 개시 결정을 받았습니다.",
    tags: ["#카드론대환", "#보정속결대응", "#추심차단"]
  },
  {
    id: 'rev-11',
    title: "다중 카드 연체 및 대출 독촉, 신속하게 원금 70% 탕감받았습니다",
    category: "신용카드 연체",
    author: "윤*자 님 (50대 자영업자)",
    originalDebt: 7200,
    remainingDebt: 2160,
    lawyerId: "lawyer-1",
    lawyerName: "김우진 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256",
    content: "식당을 운영하며 밀린 카드 대금 독촉으로 매일 밤을 지새웠습니다. 김우진 변호사님께서 도산 전문 노하우를 발휘하여 영업 소득에서 공제받을 수 있는 최대 생계비를 인정받아 주셔서, 최종적으로 원금의 70%를 감면받는 결정을 받아내셨습니다.",
    tags: ["#자영업자카드연체", "#원금70%감면", "#도산법전문"]
  },
  {
    id: 'rev-12',
    title: "70대 기초생활수급자 부모님 채무 7천만 원 전액 면책 성공",
    category: "개인파산",
    author: "서*진 님 (자녀 대리 신청)",
    originalDebt: 7000,
    remainingDebt: 0,
    lawyerId: "lawyer-10",
    lawyerName: "서준호 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=256",
    content: "부모님이 오래전 지게 된 빚이 7천만 원까지 불어나 자녀인 저에게까지 독촉 연락이 오고 있었습니다. 서준호 변호사님께서 고령이자 기초생활수급자이신 부모님의 상황을 법원에 완벽히 입증하여 파산 신청 4개월 만에 100% 면책 결정을 받아 주셨습니다.",
    tags: ["#고령자파산", "#기초생활수급자", "#채무면제100%"]
  },
  {
    id: 'rev-13',
    title: "상가 폐업 후 남은 채무 2억 5천만 원 파산 면책 인용",
    category: "개인파산",
    author: "임*호 님 (50대 전직 자영업)",
    originalDebt: 25000,
    remainingDebt: 0,
    lawyerId: "lawyer-7",
    lawyerName: "오윤아 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
    content: "수년간 해오던 대형 프랜차이즈 식당을 폐업한 후 남은 임대차 분쟁과 2억 5천만 원의 거액 채무로 파산 지경에 이르렀습니다. 오윤아 변호사님이 상가 권리금 분쟁과 사업 소득 구조를 정교하게 풀어서 파산 재산 면제 신청을 성공시켰고, 채무 전액을 면책받았습니다.",
    tags: ["#상가폐업파산", "#면책성공", "#오윤아변호사"]
  },
  {
    id: 'rev-14',
    title: "장기 투병으로 생긴 대부업 사채 빚 9천만 원 파산 성공",
    category: "개인파산",
    author: "정*희 님 (40대 무직)",
    originalDebt: 9000,
    remainingDebt: 0,
    lawyerId: "lawyer-3",
    lawyerName: "최덕중 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256",
    content: "장기 투병으로 병원비와 생활비를 대부업 사채로 해결하다 보니 더 이상 갚을 수 없는 지경에 이르렀습니다. 최덕중 변호사님이 면책 불허가 사유가 전혀 없음을 정교하게 소명해주시고 적극 변론해주신 결과, 채무액 9천만 원 전액을 일시 면책받는 쾌거를 얻었습니다.",
    tags: ["#투병중개인파산", "#사채전액탕감", "#수원파산전문"]
  },
  {
    id: 'rev-15',
    title: "동업 사기로 인한 2억 원의 보증 채무, 개인회생으로 80% 감면",
    category: "연대보증 채무",
    author: "박*호 님 (40대 회사원)",
    originalDebt: 20000,
    remainingDebt: 4000,
    lawyerId: "lawyer-8",
    lawyerName: "윤성호 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
    content: "믿었던 동업자 친구에게 연대보증을 섰다가 친구가 야반도주하여 제가 2억 원의 보증 채무를 떠안게 되었습니다. 윤성호 변호사님께서 고액 채무 구조임에도 불구하고 의뢰인의 생계 사정을 참작하도록 법원을 집요하게 설득하여 원금 80%를 감면받는 기적을 보았습니다.",
    tags: ["#연대보증채무", "#동업사기피해", "#원금80%감면"]
  },
  {
    id: 'rev-16',
    title: "가족 연대보증 채무 1억 3천, 월 40만 원 변제로 기적적 구제",
    category: "연대보증 채무",
    author: "신*아 님 (30대 교사)",
    originalDebt: 13000,
    remainingDebt: 1440,
    lawyerId: "lawyer-5",
    lawyerName: "한지민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256",
    content: "가족의 사업 자금 조달에 연대보증을 섰다가 채무 이행 독촉장을 받았습니다. 직장에 알려질까 봐 숨이 막혔는데 한지민 변호사님께서 직장 비밀 보장을 최우선으로 하여 신속하게 회생을 진행해 주셨고, 월 40만 원의 낮은 변제금으로 최종 통과시켜 주셨습니다.",
    tags: ["#교사회생비밀", "#가족보증해결", "#한지민변호사"]
  },
  {
    id: 'rev-17',
    title: "법인 대표이사 연대보증 채무 3억 원, 개인회생으로 재기 성공",
    category: "연대보증 채무",
    author: "고*원 님 (40대 대표)",
    originalDebt: 30000,
    remainingDebt: 6000,
    lawyerId: "lawyer-4",
    lawyerName: "박성현 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256",
    content: "법인 운영 중 대표이사 연대보증으로 3억 원의 채무를 떠안아 폐업 위기에 있었습니다. 서울회생법원에 특화된 박성현 변호사님의 밀착 변론과 맞춤형 소명으로, 변제율 20%로 인가를 받아 사업체 라이센스를 유지하며 무사히 재기할 수 있는 기반을 다졌습니다.",
    tags: ["#대표이사연대보증", "#서울회생법원", "#재기성공"]
  },
  {
    id: 'rev-18',
    title: "3년 차 IT 개발 프리랜서, 불규칙 소득 소명하여 변제율 30% 완료",
    category: "프리랜서 회생",
    author: "최*우 님 (30대 개발자)",
    originalDebt: 9500,
    remainingDebt: 2850,
    lawyerId: "lawyer-11",
    lawyerName: "강지영 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256",
    content: "프리랜서 개발자라 프로젝트 계약 기간에 따라 소득 편차가 너무 컸습니다. 강지영 변호사님께서 통장 입금 내역과 원천징수 영수증을 분석하여 법원이 납득할 수 있는 평균 실소득을 산정해 주셨고, 불필요한 청산가치 반영 없이 변제율 30%로 깔끔히 종결되었습니다.",
    tags: ["#IT개발자회생", "#프리랜서평균소득", "#강지영변호사"]
  },
  {
    id: 'rev-19',
    title: "학원 강사 프리랜서, 탕감율 75%로 신속하게 인가 결정",
    category: "프리랜서 회생",
    author: "김*진 님 (30대 학원강사)",
    originalDebt: 6400,
    remainingDebt: 1600,
    lawyerId: "lawyer-11",
    lawyerName: "강지영 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256",
    content: "학원에서 비율제로 수당을 받는 강사라 소득 증명이 까다로웠습니다. 강지영 변호사님의 도움으로 필요한 프리랜서 위촉 계약서 및 해촉 증명 등 복잡한 소명 서류들을 완벽히 대리 준비해주셔서, 탕감율 75% 수준의 원금 분할 납부로 신속 통과되었습니다.",
    tags: ["#학원강사회생", "#프리랜서서류대리", "#원금75%탕감"]
  },
  {
    id: 'rev-20',
    title: "유튜브 크리에이터 및 프리랜서 소득 소명, 기각 위기 극복",
    category: "프리랜서 회생",
    author: "이*찬 님 (20대 유튜버)",
    originalDebt: 5800,
    remainingDebt: 1450,
    lawyerId: "lawyer-2",
    lawyerName: "이소민 변호사",
    lawyerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256",
    content: "유튜브 채널 운영 소득 and 간이 영수증 프리랜서 일당 수입을 합산 소명하는 과정에서 보정권고가 나와 기각 위기였습니다. 이소민 변호사님이 크리에이터의 계좌 입출금 흐름과 경비를 논리적으로 입증해 주신 덕분에 원금 75% 탕감으로 기적적으로 기각을 모면했습니다.",
    tags: ["#유튜버회생", "#크리에이터소득소명", "#이소민변호사"]
  }
];

export const initialNotices: Notice[] = [
  {
    id: 'notice-1',
    title: '[안내] my김변 2026년 6월 고객센터 휴무일 안내',
    content: `안녕하세요. my김변 안심 채무 해결 센터입니다.\n\n2026년 6월 고객센터 휴무 일정을 다음과 같이 안내해 드립니다.\n\n■ 휴무 안내\n- 휴무 기간: 2026년 6월 15일 (월) ~ 6월 16일 (화)\n- 대상 업무: 유선 전화 상담, 실시간 챗봇 상담 및 고객 지원 메일 응대\n\n■ 추가 사항\n휴무 기간 동안에도 탕감액 계산기 및 1:1 상담 신청은 정상적으로 운영됩니다. 남겨주신 문의 사항은 6월 17일(수) 오전 9시부터 순차적으로 신속하게 답변해 드리겠습니다.\n\n안심하고 신뢰할 수 있는 서비스를 제공하기 위해 항상 노력하겠습니다.\n감사합니다.`,
    date: '2026-06-03',
    isImportant: true,
    views: 142
  },
  {
    id: 'notice-2',
    title: '[안내] my김변 이용약관, 개인정보처리방침, 법적고지 개정(26년 6월 27일 적용) 사전 안내',
    content: `안녕하세요. my김변팀입니다.\n\nmy김변 서비스를 이용해 주시는 회원 여러분께 깊은 감사를 드리며, 이용약관, 개인정보처리방침 및 법적고지 개정 예정 사안에 대해 아래와 같이 사전 안내해 드립니다.\n\n■ 개정 목적\n- 채무 상담 보호 시스템 개선 및 안심번호 기능 고도화에 따른 약관 정비\n- 개인정보 수집 및 제3자 제공 프로세스의 투명성 확보\n\n■ 주요 개정 내용\n1. 이용약관 제12조 (안심번호 사용 및 개인정보 보안 설정 권한)\n2. 개인정보처리방침 제5조 (신용정보원 마이데이터 대출/연체 정보 조회에 대한 보관 기한)\n3. 법적고지 개정 (변호사법 제34조에 의거한 플랫폼 비알선료 구조 강화 방침 명문화)\n\n■ 적용 일자\n- 개정된 약관은 2026년 6월 27일부터 효력이 발생합니다.\n\n본 개정 내용에 대해 이의 또는 문의가 있으신 경우 고객센터로 연락 주시기 바랍니다.\n감사합니다.`,
    date: '2026-05-28',
    isImportant: true,
    views: 289
  },
  {
    id: 'notice-3',
    title: '[안내] my김변 20분 영상상담 서비스 종료 안내',
    content: `안녕하세요, my김변 안심 채무 해결 센터입니다.\n\n그동안 많은 회원님들이 애용해 주셨던 '20분 영상상담' 서비스가 운영 정책 변경으로 인해 2026년 6월 30일부로 종료될 예정입니다.\n\n■ 서비스 종료 안내\n- 종료 일자: 2026년 6월 30일 (화) 24:00\n- 종료 서비스: 20분 실시간 영상 통화 상담 서비스\n\n■ 추가 사항\n영상 상담 서비스는 종료되지만, 의뢰인 비밀 보장과 독촉 전면 차단을 위한 1:1 채팅 비밀 상담 및 050 안심전화 상담 서비스는 더욱 확대되어 정상적으로 제공됩니다. 한층 고도화된 안심 전화상담 시스템을 통해 변호사 매칭 및 수임 분석 서비스를 원활히 이용하실 수 있도록 지원하겠습니다.\n\n더 나은 서비스로 보답하는 my김변이 되겠습니다.\n감사합니다.`,
    date: '2026-05-20',
    isImportant: false,
    views: 95
  }
];

export const initialMembers: Member[] = [
  {
    id: 'lawyer-1',
    email: 'kimwj@rehablaw.com',
    phone: '010-1111-2222',
    alias: '김우진 변호사',
    role: 'LAWYER',
    createdAt: '2025-01-10T09:00:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-04T09:30:00Z',
  },
  {
    id: 'lawyer-2',
    email: 'leesm@rehablaw.com',
    phone: '010-2222-3333',
    alias: '이소민 변호사',
    role: 'LAWYER',
    createdAt: '2025-03-15T10:00:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-04T09:45:00Z',
  },
  {
    id: 'lawyer-3',
    email: 'choi@rehablaw.com',
    phone: '010-3333-4444',
    alias: '최덕중 변호사',
    role: 'LAWYER',
    createdAt: '2025-06-20T11:00:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-03T18:00:00Z',
  },
  {
    id: 'staff-1',
    email: 'park@rehablaw.com',
    phone: '010-4444-5555',
    alias: '박진혁 실장',
    role: 'STAFF',
    createdAt: '2025-08-01T09:30:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-04T08:15:00Z',
  },
  {
    id: 'lawyer-4',
    email: 'parks@rehablaw.com',
    phone: '010-5555-6666',
    alias: '박성현 변호사',
    role: 'LAWYER',
    createdAt: '2025-10-12T14:00:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-04T09:10:00Z',
  },
  {
    id: 'lawyer-5',
    email: 'han@rehablaw.com',
    phone: '010-6666-7777',
    alias: '한지민 변호사',
    role: 'LAWYER',
    createdAt: '2025-12-05T09:00:00Z',
    loginChannel: 'email',
    status: 'active',
    lastActiveAt: '2026-06-04T09:50:00Z',
  },
  {
    id: 'lawyer-ex-1',
    email: 'kangs@rehablaw.com',
    phone: '010-8765-4321',
    alias: '강성훈 변호사 (정지)',
    role: 'LAWYER',
    createdAt: '2025-02-20T10:00:00Z',
    loginChannel: 'email',
    status: 'suspended',
    lastActiveAt: '2026-05-15T18:00:00Z',
  },
  {
    id: 'lawyer-ex-2',
    email: 'hwang@rehablaw.com',
    phone: '010-4321-8765',
    alias: '황다은 변호사 (탈퇴)',
    role: 'LAWYER',
    createdAt: '2025-04-10T11:00:00Z',
    loginChannel: 'email',
    status: 'withdrawn',
    lastActiveAt: '2026-05-20T17:00:00Z',
  },
  {
    id: 'client-1',
    email: 'hong@gmail.com',
    phone: '010-1234-5678',
    alias: '새출발_385',
    role: 'CLIENT',
    createdAt: '2026-05-26T01:30:00Z',
    loginChannel: 'sms',
    status: 'active',
    lastActiveAt: '2026-06-04T09:20:00Z',
  },
  {
    id: 'client-2',
    email: 'younghee@naver.com',
    phone: '010-9876-5432',
    alias: '새출발_742',
    role: 'CLIENT',
    createdAt: '2026-05-25T14:20:00Z',
    loginChannel: 'kakao',
    status: 'active',
    lastActiveAt: '2026-06-04T08:50:00Z',
  },
  {
    id: 'client-3',
    email: 'donghyun@daum.net',
    phone: '010-3333-4444',
    alias: '새출발_109',
    role: 'CLIENT',
    createdAt: '2026-05-24T09:15:00Z',
    loginChannel: 'naver',
    status: 'active',
    lastActiveAt: '2026-06-03T17:30:00Z',
  },
  {
    id: 'client-4',
    email: 'stealth_runner@gmail.com',
    phone: '010-8912-3456',
    alias: '새출발_590',
    role: 'CLIENT',
    createdAt: '2026-06-04T08:05:00Z',
    loginChannel: 'google',
    status: 'active',
    lastActiveAt: '2026-06-04T08:55:00Z',
  },
  {
    id: 'client-5',
    email: 'rehab_hope@naver.com',
    phone: '010-5678-1234',
    alias: '새출발_821',
    role: 'CLIENT',
    createdAt: '2026-06-02T13:45:00Z',
    loginChannel: 'sms',
    status: 'suspended',
    lastActiveAt: '2026-06-03T11:20:00Z',
  },
  {
    id: 'client-today-1',
    email: 'kakao_today@naver.com',
    phone: '010-9999-8888',
    alias: '새출발_999',
    role: 'CLIENT',
    createdAt: '2026-06-04T09:00:00Z',
    loginChannel: 'kakao',
    status: 'active',
    lastActiveAt: '2026-06-04T09:30:00Z',
  },
  {
    id: 'client-today-2',
    email: 'naver_today@naver.com',
    phone: '010-7777-6666',
    alias: '새출발_777',
    role: 'CLIENT',
    createdAt: '2026-06-04T09:10:00Z',
    loginChannel: 'naver',
    status: 'active',
    lastActiveAt: '2026-06-04T09:40:00Z',
  },
  {
    id: 'client-withdrawn-1',
    alias: '(탈퇴한 회원)',
    role: 'CLIENT',
    createdAt: '2026-05-10T10:00:00Z',
    loginChannel: 'naver',
    status: 'withdrawn',
    lastActiveAt: '2026-05-20T11:00:00Z',
  },
  {
    id: 'client-withdrawn-2',
    alias: '(탈퇴한 회원)',
    role: 'CLIENT',
    createdAt: '2026-05-15T15:00:00Z',
    loginChannel: 'google',
    status: 'withdrawn',
    lastActiveAt: '2026-05-22T14:30:00Z',
  },
  {
    id: 'client-dormant-1',
    alias: '휴면회원_202',
    role: 'CLIENT',
    createdAt: '2025-04-01T09:00:00Z',
    loginChannel: 'sms',
    status: 'dormant',
    email: 'dormant_user@naver.com',
    phone: '010-8888-7777',
    lastActiveAt: '2025-06-03T18:00:00Z',
  }
];

export const initialActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    memberId: 'client-1',
    memberName: '새출발_385',
    role: 'CLIENT',
    action: 'CHAT_SEND',
    details: '김우진 변호사와 1:1 대화: "최근 대출 비중에 대한 소명 방법을 문의드립니다."',
    ipAddress: '221.149.12.98',
    createdAt: '2026-06-04T09:20:00Z',
  },
  {
    id: 'log-2',
    memberId: 'lawyer-1',
    memberName: '김우진 변호사',
    role: 'LAWYER',
    action: 'CHAT_SEND',
    details: '의뢰인 새출발_385 채팅 답변 작성 완료',
    ipAddress: '121.138.45.12',
    createdAt: '2026-06-04T09:18:00Z',
  },
  {
    id: 'log-3',
    memberId: 'client-4',
    memberName: '새출발_590',
    role: 'CLIENT',
    action: 'CALCULATE',
    details: '자가진단 실행: "총 채무액 5,500만원, 월 소득 180만원 -> 예상 변제율 30%"',
    ipAddress: '114.200.75.104',
    createdAt: '2026-06-04T08:55:00Z',
  },
  {
    id: 'log-4',
    memberId: 'client-4',
    memberName: '새출발_590',
    role: 'CLIENT',
    action: 'LOGIN',
    details: '구글 OAuth 계정 안전 로그인 성공',
    ipAddress: '114.200.75.104',
    createdAt: '2026-06-04T08:52:00Z',
  },
  {
    id: 'log-5',
    memberId: 'lawyer-2',
    memberName: '이소민 변호사',
    role: 'LAWYER',
    action: 'STATUS_CHANGE',
    details: '최은지 의뢰인의 개인회생 사건 단계를 [신청서 보정/제출]로 업데이트 완료',
    ipAddress: '121.138.45.31',
    createdAt: '2026-06-04T08:40:00Z',
  },
  {
    id: 'log-6',
    memberId: 'client-2',
    memberName: '새출발_742',
    role: 'CLIENT',
    action: 'CHAT_SEND',
    details: '이소민 변호사와 1:1 대화: "아이 학원비도 생계비로 공제 가능할까요?"',
    ipAddress: '210.123.88.9',
    createdAt: '2026-06-04T08:30:00Z',
  },
  {
    id: 'log-7',
    memberId: 'client-1',
    memberName: '새출발_385',
    role: 'CLIENT',
    action: 'LOGIN',
    details: 'SMS 안심 OTP 휴대폰 로그인 성공',
    ipAddress: '221.149.12.98',
    createdAt: '2026-06-04T08:15:00Z',
  },
  {
    id: 'log-8',
    memberId: 'staff-1',
    memberName: '박진혁 실장',
    role: 'STAFF',
    action: 'LOGIN',
    details: '로펌 통합 어드민 스태프 계정 로그인 성공',
    ipAddress: '121.138.45.88',
    createdAt: '2026-06-04T08:10:00Z',
  },
  {
    id: 'log-9',
    memberId: 'client-4',
    memberName: '새출발_590',
    role: 'CLIENT',
    action: 'SIGNUP',
    details: '구글 간편 회원가입 완료 (스텔스 가명 배정: 새출발_590)',
    ipAddress: '114.200.75.104',
    createdAt: '2026-06-04T08:05:00Z',
  },
  {
    id: 'log-10',
    memberId: 'admin',
    memberName: '최고관리자',
    role: 'ADMIN',
    action: 'ADMIN_ACTION',
    details: '법무법인 한빛 김우진 변호사의 활동 자격을 정식 승인함',
    ipAddress: '192.168.0.1',
    createdAt: '2026-06-03T16:00:00Z',
  },
  {
    id: 'log-11',
    memberId: 'client-today-1',
    memberName: '새출발_999',
    role: 'CLIENT',
    action: 'SIGNUP',
    details: '카카오 간편 가입 완료 (스텔스 가명 배정: 새출발_999)',
    ipAddress: '125.132.22.41',
    createdAt: '2026-06-04T09:00:00Z',
  },
  {
    id: 'log-12',
    memberId: 'client-today-1',
    memberName: '새출발_999',
    role: 'CLIENT',
    action: 'CALCULATE',
    details: '자가진단 실행: "총 채무액 4,200만원, 월 소득 210만원 -> 예상 변제율 35%"',
    ipAddress: '125.132.22.41',
    createdAt: '2026-06-04T09:05:00Z',
  },
  {
    id: 'log-13',
    memberId: 'client-today-1',
    memberName: '새출발_999',
    role: 'CLIENT',
    action: 'CONSULT_REQUEST',
    details: '자가진단 후 변제율 35%로 간편 안심 상담 신청 완료',
    ipAddress: '125.132.22.41',
    createdAt: '2026-06-04T09:12:00Z',
  },
  {
    id: 'log-14',
    memberId: 'client-today-2',
    memberName: '새출발_777',
    role: 'CLIENT',
    action: 'SIGNUP',
    details: '네이버 간편 가입 완료 (스텔스 가명 배정: 새출발_777)',
    ipAddress: '211.234.56.78',
    createdAt: '2026-06-04T09:10:00Z',
  },
  {
    id: 'log-15',
    memberId: 'client-today-2',
    memberName: '새출발_777',
    role: 'CLIENT',
    action: 'CALCULATE',
    details: '자가진단 실행: "총 채무액 7,000만원, 월 소득 250만원 -> 예상 변제율 25%"',
    ipAddress: '211.234.56.78',
    createdAt: '2026-06-04T09:15:00Z',
  },
  {
    id: 'log-16',
    memberId: 'client-withdrawn-1',
    memberName: '(탈퇴한 회원)',
    role: 'CLIENT',
    action: 'WITHDRAWAL',
    details: '회원 계정 영구 탈퇴 처리 완료 (이메일 및 연락처 등 모든 개인 식별 정보 파기)',
    ipAddress: '223.38.19.45',
    createdAt: '2026-05-20T11:00:00Z',
  }
];

export const initialInquiries: ClientInquiry[] = [
  {
    id: 'inquiry-1',
    clientId: 'client-1',
    clientName: '새출발_385',
    title: '개인회생 변제금 산정 기준 문의',
    content: '추가 생계비로 부양가족 1명을 인정받으려면 어떤 서류를 준비해야 하나요? 현재 따로 사는 고령의 부모님이 계십니다.',
    createdAt: '2026-06-02T10:00:00Z',
    status: 'replied',
    replyContent: '고령의 부모님을 부양가족으로 인정받기 위해서는 기본증명서, 가족관계증명서와 함께 부모님의 소득 및 재산이 없음을 증명하는 지방세 세목별 과세증명서, 그리고 정기적인 생활비 송금 이력 등을 제출하셔야 합니다.',
    repliedAt: '2026-06-02T15:00:00Z'
  },
  {
    id: 'inquiry-2',
    clientId: 'client-4',
    clientName: '새출발_590',
    title: '채무 독촉전화 금지명령 관련 질문',
    content: '개인회생 신청을 하면 채권추심 독촉전화가 언제쯤 금지되는 건가요? 하루에 수십 번씩 전화가 와서 일상생활이 불가능합니다.',
    createdAt: '2026-06-03T11:00:00Z',
    status: 'pending'
  }
];

export const initialPlatformConfig: PlatformConfig = {
  siteTitle: 'my김변 - 나의 김변호사가 내 빚, 대신 관리해드려요',
  siteLogoText: 'my김변',
  siteLogoUrl: './mykim_logo.png',
  companyAddress: '서울특별시 서초구 서초대로 123 서초빌딩 5층 (주)my김변컴퍼니',
  companyBusinessNumber: '521-39-01355',
  companyRepresentative: '진성호',
  termsOfService: '제 1 조 (목적)\n본 약관은 (주)my김변컴퍼니(이하 "회사")가 운영하는 my김변 서비스(https://mykim.kr)의 이용에 관한 조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.\n\n제 2 조 (용어의 정의)\n1. "서비스"란 회사가 제공하는 채무 자가진단(AI 분석), 변호사 매칭 중개, 가명 상담 중개 및 관련 법률 정보 콘텐츠 제반 서비스를 의미합니다.\n2. "회원"이란 본 약관에 동의하고 이용계약을 체결한 자를 말합니다.\n3. "의뢰인회원"이란 채무 해결을 위해 서비스를 이용하는 회원을 말합니다.\n4. "변호사회원"이란 대한변호사협회에 등록된 변호사로서 서비스에 가입한 회원을 말합니다.\n\n제 3 조 (약관의 효력 및 변경)\n1. 회사는 본 약관의 내용을 서비스 화면에 게시합니다.\n2. 약관 변경 시 적용일 7일(회원에게 불리한 변경의 경우 30일) 전부터 공지합니다.\n3. 변경된 약관에 동의하지 않는 회원은 이용계약을 해지할 수 있습니다.\n\n제 4 조 (이용계약의 체결)\n이용계약은 회원이 약관에 동의하고 소셜 로그인(구글, 카카오 등)을 통해 가입 신청을 하고 회사가 이를 승낙함으로써 체결됩니다.\n\n제 5 조 (서비스의 제공)\n회사는 다음 각 호의 서비스를 제공합니다.\n1. 채무 자가진단 서비스 (AI 기반 분석)\n2. 변호사 매칭 중개 서비스\n3. 가명 상담 중개 서비스\n4. 법률 정보 콘텐츠 제공\n\n제 6 조 (회사의 면책)\n1. 회사는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 통신판매중개자로서, 통신판매의 당사자가 아닙니다.\n2. 회사는 변호사회원이 의뢰인회원에게 제공하는 법률 서비스의 내용, 질, 결과에 대해 어떠한 법적 책임도 부담하지 않습니다.\n3. AI 자가진단 결과는 참고 목적의 정보 제공일 뿐, 법률 자문에 해당하지 않습니다.\n4. 회사는 의뢰인회원의 법률상담 내용, 상담 여부, 법률사건 내용, 수임 여부, 변호사회원의 선택 등에 대해 일절 관여하지 않습니다.\n\n※ 전체 이용약관은 서비스 하단의 「서비스 이용약관」 링크에서 확인하실 수 있습니다.',
  privacyPolicy: '(주)my김변컴퍼니(이하 "회사")는 개인정보보호법 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.\n\n1. 수집하는 개인정보 항목\n• 회원가입 시: 가명(별칭), 이메일 주소, 휴대폰 번호\n• 서비스 이용 시: 채무 내역(채권자명, 채무액, 연체기간 등), 소득 정보, 재산 정보, 가족관계 정보, 상담 내용\n• 자동 수집: 접속 IP, 접속 기기 정보, 방문 일시, 서비스 이용 기록, 쿠키\n• 수집 방법: 소셜 로그인(구글, 카카오), 서비스 이용 과정에서 직접 입력, 자동 수집\n\n2. 개인정보의 처리 목적\n• 회원 관리: 본인 확인, 가입의사 확인, 문의사항 처리\n• 서비스 제공: 채무 자가진단 분석, 변호사 매칭 중개, 가명 상담 중개\n• 서비스 개선: 통계 분석, 서비스 품질 향상\n• 법적 의무 이행: 관련 법령에 따른 의무 준수\n\n3. 개인정보의 보유 및 이용기간\n• 회원정보: 회원 탈퇴 시까지\n• 상담기록: 상담 종료 후 3년 (변호사법 관련)\n• 전자상거래 기록: 5년 (전자상거래법)\n• 접속기록: 3개월 (통신비밀보호법)\n\n4. 개인정보 보호책임자\n• 성명: 진성호 (대표이사)\n• 이메일: help@rebirthtalk.com\n\n※ 전체 개인정보 처리방침은 서비스 하단의 「개인정보 처리방침」 링크에서 확인하실 수 있습니다.'
};


