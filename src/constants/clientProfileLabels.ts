/**
 * 의뢰인 재무 프로필(FinancialProfile) 코드값 → 화면 라벨
 *
 * - 긴 라벨(*_LABELS): 제안서 워크스페이스 `ClientReferencePanel`에서 쓰던 맵을 그대로 옮겼다.
 * - 짧은 라벨(*_SHORT_LABELS): 좁은 패널(상담 채팅 가계 진단 분석서 등)용.
 * - 값이 없거나 모르는 값이면 추정하지 않고 fallback(기본 '미기재')을 돌려준다.
 *   (이전 채팅 화면: 직업 미기재·무직 → '프리랜서', 사별·미기재 → '이혼'으로 표시)
 */

// ── 긴 라벨 (ClientReferencePanel에서 이전) ──

export const JOB_TYPE_LABELS: Record<string, string> = {
  SALARIED: '직장인 (4대보험 가입)',
  salary: '직장인 (4대보험 가입)',
  BUSINESS: '개인사업자 / 자영업',
  business: '개인사업자 / 자영업',
  DAILY: '일용직 / 계약직',
  daily: '일용직 / 계약직',
  FREELANCER: '프리랜서 / 특수고용',
  freelancer: '프리랜서 / 특수고용',
  worker_no_ins: '4대보험 미가입 근로자',
  unemployed: '무직 / 구직 중',
  none: '무직 / 구직 중',
  both: '근로 및 사업 병행',
  basic_recipient: '기초생활수급자'
};

export const MARITAL_LABELS: Record<string, string> = {
  SINGLE: '미혼 (1인 가구)',
  single: '미혼 (1인 가구)',
  MARRIED: '기혼 (배우자 동거)',
  married: '기혼 (배우자 동거)',
  DIVORCED: '이혼 / 한부모',
  divorced: '이혼 / 한부모',
  WIDOWED: '사별',
  widowed: '사별',
  other: '기타'
};

export const HOUSING_LABELS: Record<string, string> = {
  rent: '월세 (임차 거주)',
  jeonse: '전세 (임차 거주)',
  owned: '자가 (본인/배우자 소유)',
  free: '무상 거주 (가족/친척 집)',
  dormitory: '기숙사 / 고시원'
};

export const DEBT_CAUSE_LABELS: Record<string, string> = {
  LIVING: '생계비 / 생활고 부족',
  living: '생계비 / 생활고 부족',
  BUSINESS: '사업 실패 / 매출 부진',
  business: '사업 실패 / 매출 부진',
  INVESTMENT: '주식 / 코인 투자 손실',
  investment: '주식 / 코인 투자 손실',
  GUARANTEE: '타인 보증 채무',
  guarantee: '타인 보증 채무',
  GAMBLING: '도박 / 사행성 채무',
  gambling: '도박 / 사행성 채무',
  FRAUD: '사기 피해 (보이스피싱/전세사기)',
  OTHER: '기타 사유'
};

export const HARASSMENT_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  CALL: { label: '전화 / 문자 독촉', color: 'bg-amber-50 text-amber-800 border-amber-200', desc: '채권사 수시 전화·문자 독촉' },
  LETTER: { label: '독촉장 / 자택 방문', color: 'bg-orange-50 text-orange-800 border-orange-200', desc: '우편 독촉장 및 방문 통보' },
  LAWSUIT: { label: '지급명령 / 법원 소송', color: 'bg-rose-50 text-rose-800 border-rose-200', desc: '법원 소송 및 지급명령 접수됨' },
  SEIZURE: { label: '통장 / 급여 압류 진행', color: 'bg-red-100 text-red-900 border-red-300 font-bold', desc: '계좌 압류 또는 유체동산 압류 상태' }
};

export const SPECIAL_COND_LABELS: Record<string, string> = {
  basic_recipient: '기초생활수급자 (취약계층 특례)',
  severe_disability: '중증 장애인 (취약계층 특례)',
  elderly: '65세 이상 고령자 (취약계층 특례)',
  single_parent: '한부모가족 (취약계층 특례)',
  rent_fraud: '전세사기 피해자 (특별법 지원)'
};

// ── 짧은 라벨 (좁은 패널용) ──

export const JOB_TYPE_SHORT_LABELS: Record<string, string> = {
  SALARIED: '급여소득',
  SALARY: '급여소득',
  BUSINESS: '영업소득',
  DAILY: '일용직',
  FREELANCER: '프리랜서',
  BOTH: '급여·영업 겸업',
  WORKER_NO_INS: '4대보험 미가입 근로',
  NONE: '무직',
  UNEMPLOYED: '무직',
  BASIC_RECIPIENT: '기초생활수급',
};

export const MARITAL_SHORT_LABELS: Record<string, string> = {
  SINGLE: '미혼',
  MARRIED: '기혼',
  DIVORCED: '이혼',
  DIVORCED_RECEIVING: '이혼 (양육비 수령)',
  DIVORCED_SENDING: '이혼 (양육비 지급)',
  WIDOWED: '사별',
  OTHER: '기타',
};

export const HOUSING_SHORT_LABELS: Record<string, string> = {
  RENT: '월세',
  JEONSE: '전세',
  OWNED: '자가',
  FREE: '무상 거주',
  DORMITORY: '기숙사·고시원',
};

export const HOUSING_HOLDER_LABELS: Record<string, string> = {
  SELF: '본인 명의',
  SPOUSE: '배우자 명의',
  OTHERS: '타인 명의',
};

export const DEBT_CAUSE_SHORT_LABELS: Record<string, string> = {
  LIVING: '생활비 부족',
  BUSINESS: '사업 실패·운영자금',
  INVESTMENT: '투자 손실 (주식·가상자산)',
  GUARANTEE: '보증 채무',
  GAMBLING: '도박 채무',
  FRAUD: '사기 피해',
  OTHER: '기타',
};

export const HARASSMENT_SHORT_LABELS: Record<string, string> = {
  CALL: '독촉 전화·문자',
  LETTER: '독촉장·방문',
  LAWSUIT: '소송·지급명령',
  SEIZURE: '급여·통장 압류',
  NONE: '추심 없음',
};

export const SPECIAL_COND_SHORT_LABELS: Record<string, string> = {
  BASIC_RECIPIENT: '기초수급',
  SEVERE_DISABILITY: '중증장애',
  ELDERLY: '고령자',
  SINGLE_PARENT: '한부모',
  RENT_FRAUD: '전세사기',
};

export const LEGAL_ACTION_LABELS: Record<string, string> = {
  COLLECTION_CALL: '독촉 전화',
  COURT_ORDER: '소장 수령',
  SEIZURE: '급여 압류',
  PROPERTY_SEIZURE: '부동산 압류',
  CREDIT_DROP: '신용 하락',
};

/** 개별 채무(debts[].type) 구분 — 알 수 없는 값은 신용 채무로 본다 (기존 화면과 동일) */
export const DEBT_ITEM_TYPE_LABELS: Record<string, string> = {
  TAX: '체납',
  SECURED: '담보',
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: '남성',
  FEMALE: '여성',
};

/**
 * 코드값 → 라벨. 대소문자 구분 없이 찾고, 없으면 fallback.
 * 짧은 라벨 맵은 대문자 키로 정의되어 있다.
 */
export function lookupLabel(
  map: Record<string, string>,
  key: string | null | undefined,
  fallback = '미기재'
): string {
  if (key === null || key === undefined) return fallback;
  const raw = String(key).trim();
  if (!raw) return fallback;
  return map[raw] ?? map[raw.toUpperCase()] ?? map[raw.toLowerCase()] ?? fallback;
}

/** 추심 단계의 위험 정도: 소송·압류 = 법적 위험, 독촉 = 확인 필요 */
export function harassmentSeverity(level: string | null | undefined): 'risk' | 'caution' | 'none' | 'unknown' {
  const k = String(level || '').toUpperCase();
  if (k === 'LAWSUIT' || k === 'SEIZURE') return 'risk';
  if (k === 'CALL' || k === 'LETTER') return 'caution';
  if (k === 'NONE') return 'none';
  return 'unknown';
}
