// ============================================================
// 개인회생·파산 법원 예납비용 (송달료·인지대) 공용 산식
// 퀵독 비용 계산기와 전자계약 법원비용 산정이 같은 식을 쓰도록 단일화.
// ⚠️ 송달 회차는 법원 예납 안내의 일반적인 기준이며, 관할 법원·재판부에 따라 달라질 수 있음.
// ============================================================

/** 송달료 1회분 (원) — 법원 공지 기준, 변경 시 이 값만 수정 */
export const DELIVERY_UNIT_FEE_KRW = 5200;

/** 개인회생 신청 인지대 (원) */
export const REHAB_STAMP_FEE_KRW = 30000;
/** 금지명령·중지명령 신청 인지대 (각, 원) */
export const INJUNCTION_STAMP_FEE_KRW = 2000;
/** 개인파산(1,000) + 면책(1,000) 신청 인지대 (원) */
export const BANKRUPTCY_STAMP_FEE_KRW = 2000;
/** 전자소송 인지 감액률 */
export const ELECTRONIC_STAMP_DISCOUNT = 0.1;

export interface CourtFeeInput {
  caseType: 'rehab' | 'bankruptcy';
  creditorCount: number;
  /** 금지명령 동시 신청 (회생) */
  withProhibition?: boolean;
  /** 중지명령 동시 신청 (회생) */
  withStay?: boolean;
  /** 전자소송 접수 (인지대 10% 감액) */
  electronic?: boolean;
  deliveryUnitFee?: number;
}

export interface CourtFeeResult {
  deliveryRounds: number;
  deliveryFee: number;
  stampFee: number;
  total: number;
}

export function calcCourtFees(input: CourtFeeInput): CourtFeeResult {
  const c = Math.max(1, Math.floor(Number(input.creditorCount) || 1));
  const unit = input.deliveryUnitFee ?? DELIVERY_UNIT_FEE_KRW;
  let deliveryRounds: number;
  let stampFee: number;

  if (input.caseType === 'rehab') {
    // 회생: 기본 10회 + 채권자수 × 8회 (+ 금지·중지명령 각 채권자수 × 2회)
    deliveryRounds = 10 + c * 8;
    if (input.withProhibition) deliveryRounds += c * 2;
    if (input.withStay) deliveryRounds += c * 2;
    stampFee = REHAB_STAMP_FEE_KRW;
    if (input.withProhibition) stampFee += INJUNCTION_STAMP_FEE_KRW;
    if (input.withStay) stampFee += INJUNCTION_STAMP_FEE_KRW;
  } else {
    // 파산·면책: 기본 8회 + 채권자수 × 6회
    deliveryRounds = 8 + c * 6;
    stampFee = BANKRUPTCY_STAMP_FEE_KRW;
  }

  if (input.electronic) {
    stampFee = Math.floor(stampFee * (1 - ELECTRONIC_STAMP_DISCOUNT));
  }

  const deliveryFee = deliveryRounds * unit;
  return { deliveryRounds, deliveryFee, stampFee, total: deliveryFee + stampFee };
}
