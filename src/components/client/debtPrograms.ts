// ============================================================
// 채무 관련 제도 일반 안내 (NF-1, 25 기획서 4장) — 홈 '제도별로 보기'·제도 상세 창·정리 확인 화면이 같이 쓴다.
// 판단 없이 일반 정보·공식 연락처·확인일만. "위 목록은 추천 순서가 아닙니다". 외부 자문(R6) 전이라 "일반적으로" 수준.
// 수치·기준은 원문을 확인한 것만 적고(확인일), 모르면 '공식 안내에서 확인'으로 둔다.
// ============================================================

export type SolutionType =
  | 'rehab' | 'bankruptcy' | 'credit' | 'representation' | 'tax'
  | 'direct_adjust' | 'new_leap' | 'legal_aid' | 'living_account';

export interface DebtProgram {
  title: string;
  summary: string;
  keyPoints: string[];
  links: Array<{ label: string; url?: string; phone?: string }>;
  /** 마지막으로 원문·공식 안내와 대조한 날 */
  checkedOn: string;
  ctaTitle: string;
  ctaContent: string;
}

const CHECKED = '2026-10-29';

export const DEBT_PROGRAMS: Record<SolutionType, DebtProgram> = {
  rehab: {
    title: '개인회생',
    summary: '일정한 소득이 있는 분이 법원에 신청해, 인가된 변제계획대로 보통 3년(최대 5년) 갚고 나머지 채무를 면책받는 절차예요.',
    keyPoints: ['무담보 10억 원·담보 15억 원 이하 채무가 대상이에요 (채무자회생법 제579조).', '매달 정해진 금액을 갚고, 다 갚으면 법원이 면책을 정해요.', '재산을 유지하면서 진행할 수 있지만, 재산 가치만큼은 갚아야 해요.'],
    links: [{ label: '대법원 전자소송', url: 'https://ecfs.scourt.go.kr' }, { label: '대한법률구조공단', phone: '132', url: 'https://www.klac.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '개인회생 관련 상담 문의',
    ctaContent: '개인회생 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  bankruptcy: {
    title: '개인파산',
    summary: '갚을 능력이 없는 상태를 법원이 확인하고 재산을 정리한 뒤, 면책 결정으로 남은 채무를 갚지 않아도 되게 하는 절차예요.',
    keyPoints: ['소득이 없거나 생계비보다 적은 경우 검토해요.', '면책 결정이 확정되면 남은 채무 책임이 면제돼요.', '세금·벌금 등 일부 채무는 면책되지 않아요.'],
    links: [{ label: '대법원 전자소송', url: 'https://ecfs.scourt.go.kr' }, { label: '대한법률구조공단', phone: '132', url: 'https://www.klac.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '개인파산 관련 상담 문의',
    ctaContent: '개인파산 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  credit: {
    title: '신용회복위원회 채무조정',
    summary: '신용회복위원회에 신청해 은행·카드사 등 협약 금융회사 채무의 이자 감면·상환 기간 조정을 받는 제도예요. 법원 절차가 아니에요.',
    keyPoints: ['신청이 접수되면 협약 금융회사의 추심이 멈추는 것이 일반적이에요.', '사채 등 협약에 들지 않은 채무는 대상이 아니에요.', '조정안대로 갚지 못하면 효력을 잃을 수 있어요.'],
    links: [{ label: '신용회복위원회', phone: '1600-5500', url: 'https://www.ccrs.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '신용회복 관련 상담 문의',
    ctaContent: '신용회복 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  direct_adjust: {
    title: '금융회사에 직접 채무조정 요청',
    summary: '개인채무자보호법(2024년 10월 시행)에 따라 연체된 대출을 금융회사에 직접 채무조정해 달라고 요청할 수 있어요.',
    keyPoints: ['일정 금액 이하의 연체 대출이 대상이에요. 금액 기준은 금융회사나 금융감독원에서 확인해 주세요.', '금융회사는 정해진 기간 안에 결과를 알려야 해요.', '요청 중에는 추심이 제한될 수 있어요.'],
    links: [{ label: '금융감독원', phone: '1332', url: 'https://www.fss.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '채무조정 요청 관련 상담 문의',
    ctaContent: '금융회사 채무조정 요청 제도를 확인한 후 상담을 문의합니다.',
  },
  new_leap: {
    title: '새도약기금',
    summary: '오랫동안 연체된 채권을 정부가 만든 기금이 사들여 정리하는 제도예요. 내 채권이 대상인지는 공식 안내로 확인해요.',
    keyPoints: ['대상 채권과 확인 방법은 공식 발표·안내에 따라요.', '대상이 아니어도 회생·파산·신용회복 같은 다른 제도를 검토할 수 있어요.'],
    links: [{ label: '금융위원회', url: 'https://www.fsc.go.kr' }, { label: '서민금융진흥원', phone: '1397', url: 'https://www.kinfa.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '새도약기금 관련 상담 문의',
    ctaContent: '새도약기금 관련 정보를 확인한 후 상담을 문의합니다.',
  },
  representation: {
    title: '채무자대리인',
    summary: '변호사를 대리인으로 선임해 채권자에게 알리면, 채권자가 채무자에게 직접 연락하는 추심이 제한돼요(법에서 정한 예외가 있어요).',
    keyPoints: ['과도한 추심 연락에 대응할 때 검토해요.', '불법 추심은 신고하거나 법적으로 대응할 수 있어요.', '채무 자체를 줄이려면 별도 절차가 필요해요.'],
    links: [{ label: '대한법률구조공단', phone: '132', url: 'https://www.klac.or.kr' }, { label: '금융감독원 불법사금융 신고', phone: '1332', url: 'https://www.fss.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '채무자대리 관련 상담 문의',
    ctaContent: '채무자대리인 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  tax: {
    title: '세금 체납',
    summary: '체납 세금은 납부 유예·분할 납부·징수권 소멸시효 등을 확인할 수 있어요. 세금은 회생·파산으로 면책되지 않아 따로 대응해요.',
    keyPoints: ['국세·지방세에 따라 신청처가 달라요.', '압류가 있으면 해제 요건을 확인해요.', '납기 연장·분할 납부를 신청할 수 있어요.'],
    links: [{ label: '국세청', phone: '126', url: 'https://www.nts.go.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '세금 체납 관련 상담 문의',
    ctaContent: '세금 체납 관련 정보를 확인한 후 상담을 문의합니다.',
  },
  legal_aid: {
    title: '소송구조·법률구조',
    summary: '비용을 내기 어려운 분은 대한법률구조공단의 법률구조를 받거나, 법원에 소송구조(비용 납부 유예 등)를 신청할 수 있어요.',
    keyPoints: ['소득·재산 기준이 있어요.', '회생·파산 신청 비용에 쓸 수 있는지는 법원·공단이 정해요.'],
    links: [{ label: '대한법률구조공단', phone: '132', url: 'https://www.klac.or.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '법률구조 관련 상담 문의',
    ctaContent: '소송구조·법률구조 제도를 확인한 후 상담을 문의합니다.',
  },
  living_account: {
    title: '생계비계좌',
    summary: '2026년 2월부터 압류할 수 없는 생계비 전용 계좌를 한 사람당 1개 만들 수 있어요. 이 계좌의 일정 금액(250만 원)까지는 압류되지 않아요.',
    keyPoints: ['민사집행법 제246조의2·시행령에 근거해요.', '만드는 방법과 대상 금융회사는 거래 은행에서 확인해요.', '이미 압류된 돈을 돌려받는 절차는 따로 있어요(압류금지채권 범위 변경 신청 등).'],
    links: [{ label: '국가법령정보센터', url: 'https://www.law.go.kr' }],
    checkedOn: CHECKED,
    ctaTitle: '압류 관련 상담 문의',
    ctaContent: '생계비계좌·압류 관련 정보를 확인한 후 상담을 문의합니다.',
  },
};

/** 홈·정리 확인 화면에 보여 주는 순서 (추천 순서 아님) */
export const DEBT_PROGRAM_ORDER: SolutionType[] = ['rehab', 'bankruptcy', 'credit', 'direct_adjust', 'new_leap', 'representation', 'tax', 'legal_aid', 'living_account'];
