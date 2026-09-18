// ============================================================
// 수임계약서 수임료 표기 및 실무 간략 박스형 조항 생성 유틸리티
// ============================================================

/**
 * 숫자를 한국어 법률 금액 표기("사백팔십사만", "삼백만", "일백오십만" 등)로 변환
 * @param amount 원화 금액 (예: 4840000)
 */
export function numberToKoreanAmount(amount: number): string {
  if (!amount || amount <= 0) return '영';

  const units = ['', '만', '억', '조'];
  const smallUnits = ['', '십', '백', '천'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  let result = '';
  let unitIndex = 0;
  let tempAmount = Math.floor(Math.abs(amount));

  while (tempAmount > 0) {
    const chunk = tempAmount % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let tempChunk = chunk;
      for (let i = 0; i < 4; i++) {
        const digit = tempChunk % 10;
        if (digit > 0) {
          const digitWord = digits[digit];
          chunkStr = digitWord + smallUnits[i] + chunkStr;
        }
        tempChunk = Math.floor(tempChunk / 10);
      }
      result = chunkStr + units[unitIndex] + (result ? ' ' + result : '');
    }
    tempAmount = Math.floor(tempAmount / 10000);
    unitIndex++;
  }

  return result.trim() || '영';
}

export interface CustomInstallmentItem {
  round: number;
  amount: number;
  dueDate: string;
  label?: string;
}

export interface SimpleFeeClauseOptions {
  totalFeeWon: number;
  vatIncluded: boolean;
  hasDeposit: boolean;
  depositWon: number;
  retainerWon: number;
  installmentMode: 'equal' | 'custom';
  equalMonthlyFeeWon: number;
  installmentCount: number;
  customInstallments: CustomInstallmentItem[];
  paymentDayType?: 'last_day' | 'fixed_10th' | 'fixed_25th' | 'custom';
  paymentDayText?: string;
  articleNumber?: number; // 기본 제 5 조
}

/**
 * 첨부파일 실제 변호사 사무실 수임계약서 기반 실무 간략 박스형 수임료 조항 생성
 */
export function buildSimpleFeeClause(options: SimpleFeeClauseOptions): string {
  const {
    totalFeeWon,
    vatIncluded,
    hasDeposit,
    depositWon,
    retainerWon,
    installmentMode,
    equalMonthlyFeeWon,
    installmentCount,
    customInstallments,
    paymentDayText = '매달 말일',
    articleNumber = 5,
  } = options;

  const koreanTotal = numberToKoreanAmount(totalFeeWon);
  const vatText = vatIncluded ? '부가가치세 포함' : '부가가치세 별도';

  // 분납 납부 안내 텍스트 구성
  let scheduleText = '';
  if (hasDeposit && depositWon > 0) {
    // 계약금 + 착수금 + 분납 구조
    if (installmentMode === 'custom' && customInstallments.length > 0) {
      const breakdown = customInstallments
        .map(item => `${item.round}회 ${item.amount.toLocaleString()}원`)
        .join(', ');
      scheduleText = `계약금 ${depositWon.toLocaleString()}원은 계약 시 납부, 착수금 ${retainerWon.toLocaleString()}원은 사건 착수 시 납부하며, 잔금은 ${paymentDayText} 납부하기로 하고 착수금 입금 다음달부터 ${customInstallments.length}회 분납하기로 한다.\n    [잔금 분납 내역: ${breakdown}]`;
    } else {
      scheduleText = `계약금 ${depositWon.toLocaleString()}원(계약 시), 착수금 ${retainerWon.toLocaleString()}원(착수 시) 납부 후 잔금은 ${paymentDayText} 납부하기로 하며 착수금 입금 다음달부터 ${installmentCount}회 분납(회당 ${equalMonthlyFeeWon.toLocaleString()}원)하기로 한다.`;
    }
  } else {
    // 착수금 + 분납 구조 (첨부 실제 양식 기본)
    if (installmentMode === 'custom' && customInstallments.length > 0) {
      const breakdown = customInstallments
        .map(item => `${item.round}회 ${item.amount.toLocaleString()}원`)
        .join(', ');
      scheduleText = `착수금 ${retainerWon.toLocaleString()}원은 계약 시 납부하고, 잔여 수임료는 ${paymentDayText} 납부하기로 하며 착수금 입금 다음달부터 ${customInstallments.length}회 분납하기로 한다.\n    [분납 내역: ${breakdown}]`;
    } else {
      scheduleText = `수임료는 ${paymentDayText} 납부하기로 하며 착수금 입금 다음달부터 ${installmentCount}회 분납하기로 한다. (착수금: ${retainerWon.toLocaleString()}원, 월 분납금: ${equalMonthlyFeeWon.toLocaleString()}원 × ${installmentCount}회)`;
    }
  }

  return `제 ${articleNumber} 조 (수임료)
① 갑은 을에게 수임료로 총 금 ${koreanTotal} 원(${vatText})[일금 ${totalFeeWon.toLocaleString()}원]을 지급한다.
┌────────────────────────────────────────────────────────┐
│ - ${scheduleText}
│ - 수임료 2회 미납 시 수임인은 사건을 폐지할 수 있으며 미납된 수임료는 폐지 당월
│   일시금으로 납부하도록 한다.
│ - 향후 인가까지 추가비용 없음. 단, 아래 사항 발생 시 추가 비용 위임인이 납부함
│   *외부회생위원 선임 시 / 위임인 과실로 사건 기각 시 항고비용 / 법원접수 후 부채추가 시
└────────────────────────────────────────────────────────┘
② 제1항의 수임료는 을이 위임사무에 관한 연구, 조사, 접견, 서면작성을 하는 등 위임사무에 착수한 후, 을에게 책임 없는 사유로 인한 당사자의 소의 부제기(형사사건의 경우 고소의 부제기 포함), 소의 취하, 상소의 부제기 또는 취하, 청구의 포기, 인낙, 재판상 화해, 재판외 화해, 조정, 소송물의 양도, 당사자의 사망 등의 경우에는 갑이 그 반환을 청구하지 못한다.
③ 을이 위임사무를 착수하기 이전이라도 을에게 책임 없는 사유로 인한 갑의 일방적인 위임계약의 해지, 또는 제8조에 의한 위임계약의 해지 등의 사유가 발생한 경우에는 이로 인하여 을이 입거나 입게 되는 손해 혹은 손실에 해당하는 금액을 공제한 나머지 금액을 반환하기로 한다.
④ 갑과 을이 합의로 위임계약을 해지 또는 을이 부득이한 사유로 위임계약을 해지하는 경우에는, 당시까지 변호사 및 전문보조인력들이 갑을 위하여 일한 일체의 시간(수임을 위하여 상담하거나 연구한 시간 포함)에 을이 정하고 있는 시간당 보수율을 곱하여 산출된 금액을 착수보수에서 공제하고 잔액이 있을 경우 이를 반환한다.`;
}

/**
 * 실무 간략형 전체 사건위임계약서 본문 생성 (첨부 계약서 기반)
 */
export function buildSimpleMainContractDocument(params: {
  clientName: string;
  clientPhone: string;
  clientAddress?: string;
  lawyerName: string;
  lawFirmName: string;
  feeClauseText: string;
  specialTermsText?: string;
  contractDate?: string;
}): string {
  const {
    clientName,
    clientPhone,
    clientAddress = '',
    lawyerName,
    lawFirmName,
    feeClauseText,
    specialTermsText = '',
    contractDate = new Date().toISOString().split('T')[0],
  } = params;

  return `개인회생·파산 사건 위임 계약서 (실무 간략형)

위임인 (갑): ${clientName} (연락처: ${clientPhone}${clientAddress ? `, 주소: ${clientAddress}` : ''})
수임인 (을): ${lawFirmName} 담당변호사 ${lawyerName}

위임인(이하 '갑')과 수임인(이하 '을')은 개인회생(또는 파산·면책) 사건의 위임에 관하여 다음과 같이 합의하고 본 계약을 체결한다.

제 1 조 (위임 사무의 범위)
갑은 을에게 채무자 회생 및 파산에 관한 법률에 따른 개인회생(또는 개인파산·면책) 신청 및 그에 부수되는 보정권고 대응, 채권자집회 출석 지원 등 일체의 법률 사무를 위임한다.

제 2 조 (수임인의 의무)
을은 변호사로서 법률에 정한 권리와 의무에 입각하여, 위임의 내용에 따라 선량한 관리자의 주의를 다하여 위임사무를 처리한다.

제 3 조 (자료제공 등)
을이 위임사무를 처리하는데 필요하다고 인정하여 요구한 자료 또는 조회한 사항에 대하여 갑은 지체 없이 이에 응하여야 한다.

제 4 조 (법원 실비 정산)
인지대, 송달료, 부채증명서 발급 수수료 등 법원에 납부하는 공과금성 법원 실비는 수임료와 별도로 갑이 부담한다.

${feeClauseText}

제 6 조 (비밀유지 및 개인정보보호)
을은 본 위임 사무를 수행하는 과정에서 취득한 갑의 개인정보 및 채무내역을 제3자에게 누설하지 아니한다.
${specialTermsText ? `\n════════════════════════════════════════════════\n[특약사항 (당사자 합의 특약)]\n${specialTermsText}\n════════════════════════════════════════════════` : ''}
본 계약의 성립을 증명하기 위하여 당사자는 전자서명법 제3조에 따라 전자서명을 날인하여 체결한다.

체결일자: ${contractDate}`;
}
