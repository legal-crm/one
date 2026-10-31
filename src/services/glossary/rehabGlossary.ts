// ============================================================
// 회생·파산 용어집 (B-5c) — 의뢰인 화면 용어 풀이의 단일 출처
// 제안서·내 사건·계산기 등 의뢰인 화면에서 같은 설명을 쓴다.
// 원칙: 쉬운 말 한두 문장, 결과 단정 없음, 법원 판단 영역은 "법원이 정해요"로 둔다.
// 외부 자문(R6) 전이므로 법률 설명은 "일반적으로" 수준으로만 적는다.
// ============================================================

export interface GlossaryTerm {
  /** 화면에 보이는 용어 */
  term: string;
  /** 쉬운 풀이 (1~2문장) */
  plain: string;
  /** 같은 뜻으로 쓰는 다른 표현 (검색·자동 연결용) */
  aliases?: string[];
}

export const REHAB_GLOSSARY: Record<string, GlossaryTerm> = {
  rehab: {
    term: '개인회생',
    plain: '일정한 소득이 있는 사람이 법원이 인가한 계획에 따라 보통 3년(최대 5년) 동안 갚을 수 있는 만큼 갚고, 나머지 채무는 면책을 받는 절차예요.',
  },
  bankruptcy: {
    term: '개인파산',
    plain: '갚을 능력이 없는 상태(지급불능)를 법원이 확인하고, 남은 재산을 정리해 나누는 절차예요. 면책 신청을 함께 하는 것이 일반적이에요.',
  },
  discharge: {
    term: '면책',
    plain: '남은 채무를 더 갚지 않아도 되도록 법원이 결정하는 것이에요. 세금 등 일부 채무는 면책되지 않을 수 있어요.',
    aliases: ['면책결정'],
  },
  repaymentPlan: {
    term: '변제계획',
    plain: '매달 얼마를, 몇 개월 동안, 어느 채권자에게 나눠 갚을지 정한 계획이에요. 법원이 인가해야 확정돼요.',
    aliases: ['변제계획안'],
  },
  monthlyPayment: {
    term: '월 변제금',
    plain: '변제계획에 따라 매달 회생위원 계좌로 내는 돈이에요. 이 제안서의 금액은 변호사가 지금 자료로 검토한 예상치예요.',
  },
  repaymentPeriod: {
    term: '변제기간',
    plain: '월 변제금을 내는 기간이에요. 원칙은 3년(36개월)이고, 법원 실무준칙의 사유가 있으면 짧아지거나 최대 5년까지 길어질 수 있어요.',
  },
  disposableIncome: {
    term: '가용소득',
    plain: '월 소득에서 법원이 인정하는 생계비를 뺀 금액이에요. 보통 이 금액이 월 변제금의 기준이 돼요.',
  },
  livingCost: {
    term: '인정 생계비',
    plain: '법원이 생활에 필요하다고 보고 남겨 두는 돈이에요. 가구원 수에 따라 기준 중위소득의 60%를 기본으로 해요.',
    aliases: ['생계비'],
  },
  medianIncome: {
    term: '기준 중위소득',
    plain: '보건복지부가 해마다 고시하는 가구원 수별 소득 기준이에요. 생계비를 정할 때 쓰여요.',
  },
  additionalLivingCost: {
    term: '추가 생계비',
    plain: '월세·의료비·교육비처럼 꼭 나가는 비용이 있으면 소명해 기본 생계비에 더해 달라고 신청할 수 있어요. 인정 여부는 법원이 정해요.',
  },
  liquidationValue: {
    term: '청산가치',
    plain: '지금 가진 재산을 모두 정리했다고 가정했을 때 채권자에게 돌아갈 금액이에요. 개인회생에서는 총 변제액이 이 금액보다 적으면 안 돼요.',
  },
  priorityClaim: {
    term: '우선채권',
    plain: '세금·4대보험료처럼 법에서 먼저 갚도록 정한 채권이에요. 원금이 줄지 않고 변제기간 앞쪽에서 먼저 갚는 것이 일반적이에요.',
    aliases: ['우선권 있는 채권'],
  },
  securedClaim: {
    term: '담보채권',
    plain: '집 근저당처럼 담보가 잡힌 채권이에요. 담보로 갚고 남는 부분만 변제계획에 들어가요.',
    aliases: ['별제권'],
  },
  prohibitionOrder: {
    term: '금지명령',
    plain: '신청 뒤 채권자가 새로 압류·추심하지 못하게 해 달라고 법원에 요청하는 것이에요. 인용 여부와 시기는 법원이 정해요.',
  },
  stayOrder: {
    term: '중지명령',
    plain: '이미 진행 중인 압류 같은 강제집행을 멈춰 달라고 법원에 요청하는 것이에요. 인용 여부는 법원이 정해요.',
  },
  commencement: {
    term: '개시결정',
    plain: '법원이 회생 절차를 시작하겠다고 정하는 결정이에요. 이후에는 개별 강제집행이 원칙적으로 멈춰요.',
  },
  confirmation: {
    term: '인가결정',
    plain: '법원이 변제계획을 받아들인다는 결정이에요. 이후 계획대로 갚아 나가요.',
  },
  correction: {
    term: '보정',
    plain: '법원이나 회생위원이 서류나 설명을 더 내라고 요청하는 것이에요. 정해진 기간 안에 대응해야 해요.',
    aliases: ['보정권고', '보정명령'],
  },
  creditorsMeeting: {
    term: '채권자집회',
    plain: '개시결정 뒤 법원에서 변제계획을 설명하고 채권자 의견을 듣는 자리예요. 본인이 출석해요.',
  },
  trustee: {
    term: '회생위원',
    plain: '법원을 도와 소득·재산을 확인하고 변제금을 받아 채권자에게 나눠 주는 사람이에요.',
  },
  bankruptcyTrustee: {
    term: '파산관재인',
    plain: '파산 사건에서 법원이 선임해 재산과 경위를 조사하는 사람이에요. 면담과 자료 요청이 있을 수 있어요.',
    aliases: ['관재인'],
  },
  deposit: {
    term: '예납금',
    plain: '파산관재인 보수 등에 쓰도록 법원이 미리 내라고 하는 돈이에요. 금액은 법원 예납명령으로 정해져요.',
  },
  deliveryFee: {
    term: '송달료',
    plain: '법원이 채권자 등에게 서류를 보내는 데 드는 우편 비용이에요. 채권자 수에 따라 달라져요.',
  },
  stampFee: {
    term: '인지대',
    plain: '법원에 신청서를 낼 때 내는 수수료예요.',
  },
  smallLeaseDeposit: {
    term: '소액임차보증금',
    plain: '주택임대차보호법이 지역별로 보호하는 보증금 일부예요. 이 범위는 청산가치에서 빼고 계산해요.',
  },
  debtCertificate: {
    term: '부채증명서',
    plain: '금융회사가 발급하는, 남은 채무 원금·이자를 적은 서류예요. 채권자목록의 근거가 돼요.',
  },
  baseDate: {
    term: '산정기준일',
    plain: '부채증명서의 금액을 계산한 기준 날짜예요.',
  },
  dischargeDenialGrounds: {
    term: '면책불허가 사유',
    plain: '재산을 숨기거나 거짓 자료를 내는 등 법에서 면책을 허가하지 않을 수 있다고 정한 사정이에요. 해당 여부는 법원이 판단해요.',
  },
};

export type GlossaryKey = keyof typeof REHAB_GLOSSARY;

export function glossaryTerm(key: string): GlossaryTerm | undefined {
  return REHAB_GLOSSARY[key];
}

/** 용어 이름(또는 별칭)으로 찾기 */
export function findGlossaryByName(name: string): GlossaryTerm | undefined {
  const n = name.trim();
  return Object.values(REHAB_GLOSSARY).find(t => t.term === n || (t.aliases || []).includes(n));
}
