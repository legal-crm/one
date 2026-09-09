/**
 * 대법원 전자소송 표준 [개인회생채권 변제예정액표] 엑셀(.xlsx) 생성 서비스
 * - 대법원/서울회생법원 전산양식 D5110/D5111 부속서류 규격
 * - (D) 개인회생채권액 (확정/미확정 분리)
 * - (E) 월 변제예정(유보)액 (확정/미확정 분리)
 * - (F) 총 변제예정(유보)액 (확정/미확정 분리)
 * - 합계 및 (G), (H), (I) 총계 셀 완벽 구현
 * - 우선권 채권 2단계 분할배분 명세 및 청산가치 검증 포함
 */

import XLSX from 'xlsx-js-style';
import type { RepaymentPlanData } from './repaymentTypes';

export function exportCourtRepaymentScheduleExcel(plan: RepaymentPlanData): void {
  const wb = XLSX.utils.book_new();

  // ── 스타일 정의 ──
  const titleStyle = {
    font: { name: '맑은 고딕', sz: 16, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const sectionHeaderStyle = {
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const metaLabelStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const metaValueStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const metaCurrencyStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0원',
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const thStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E293B' } }, // Slate 800
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '0F172A' } },
      bottom: { style: 'thin', color: { rgb: '0F172A' } },
      left: { style: 'thin', color: { rgb: '64748B' } },
      right: { style: 'thin', color: { rgb: '64748B' } },
    },
  };

  const thSubStyle = {
    font: { name: '맑은 고딕', sz: 8.5, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } }, // Slate 200
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { rgb: '0F172A' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const tdCenterStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const tdLeftStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const tdCurrencyStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const sumRowStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'medium', color: { rgb: '0F172A' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const grandTotalStyle = {
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '1E3A8A' } },
    fill: { fgColor: { rgb: 'E0E7FF' } }, // Indigo 100
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
      left: { style: 'thin', color: { rgb: '93C5FD' } },
      right: { style: 'thin', color: { rgb: '93C5FD' } },
    },
  };

  const wsData: any[][] = [];

  // Row 0: Title
  wsData.push(['개인회생채권 변제예정액표']);
  wsData.push([]); // Row 1 blank

  // 1. 기초사항
  wsData.push(['1. 기초사항', '', '', '', '', '', '', '', '']);
  wsData.push([
    '신청인(채무자)', plan.clientName, '', 
    '관할법원', plan.courtName, '', 
    '양식구분', plan.formType === 'D5111' ? 'D5111 (재산처분 병행)' : 'D5110 (가용소득 전용)', '', ''
  ]);
  wsData.push([
    '월 가용소득(A)', plan.monthlyRepaymentTotal, '', 
    '변제횟수(B)', `${plan.months}회`, '', 
    '총 변제예정액', plan.totalRepaymentAmount, '', ''
  ]);
  wsData.push([
    '변제기간', `${plan.startYearMonth} ~ ${plan.endYearMonth}`, '', 
    '매월 변제기일', `매월 ${plan.paymentDayOfMonth}일`, '', 
    '원금 변제율', `${plan.totalRepaymentRate}%`, '', ''
  ]);
  wsData.push([]); // Row 6 blank

  // 2. 채권자별 안분표 (법원 표준 전산 서식: 확정 / 미확정 분리)
  wsData.push(['2. 채권자별 월 변제예정(유보)액 및 총 변제예정(유보)액 안분표', '', '', '', '', '', '', '', '']);

  // 2단 헤더 Row 8 (메인 분류)
  wsData.push([
    '채권번호',
    '채권자명',
    '(D) 개인회생채권액 (원금)', '',
    '(E) 월 변제예정(유보)액', '',
    '(F) 총 변제예정(유보)액', '',
    '비고 (구분)',
  ]);

  // 2단 헤더 Row 9 (세부 항목)
  wsData.push([
    '',
    '',
    '확정채권액',
    '미확정채권액',
    '확정채권 변제액',
    '미확정 변제유보액',
    '확정채권 총액',
    '미확정 총유보액',
    '',
  ]);

  const unsecuredCreditors = plan.creditors.filter((c) => !c.isSecured);

  let sumConfirmedP = 0;
  let sumUnconfirmedP = 0;
  let sumConfirmedM = 0;
  let sumUnconfirmedM = 0;
  let sumConfirmedT = 0;
  let sumUnconfirmedT = 0;

  unsecuredCreditors.forEach((c) => {
    const isUnconfirmed = !!c.isUnconfirmed || !!c.isUnconfirmedReserve;
    const confirmedP = isUnconfirmed ? 0 : c.principal;
    const unconfirmedP = isUnconfirmed ? c.principal : 0;
    const confirmedM = isUnconfirmed ? 0 : c.monthlyRepayment;
    const unconfirmedM = isUnconfirmed ? c.monthlyRepayment : 0;
    const confirmedT = isUnconfirmed ? 0 : c.totalRepayment;
    const unconfirmedT = isUnconfirmed ? c.totalRepayment : 0;

    sumConfirmedP += confirmedP;
    sumUnconfirmedP += unconfirmedP;
    sumConfirmedM += confirmedM;
    sumUnconfirmedM += unconfirmedM;
    sumConfirmedT += confirmedT;
    sumUnconfirmedT += unconfirmedT;

    const note = c.isPriority
      ? '우선권채권 (1단계완제)'
      : c.isUnconfirmedReserve
      ? '미확정 (공탁유보)'
      : c.securedShortageInfo
      ? '별제권 예정부족액'
      : c.isManuallyAdjusted
      ? '수동조정'
      : '일반회생채권';

    wsData.push([
      c.creditorNumber,
      c.name,
      confirmedP,
      unconfirmedP,
      confirmedM,
      unconfirmedM,
      confirmedT,
      unconfirmedT,
      note,
    ]);
  });

  // 합계 행
  wsData.push([
    '합계',
    `${unsecuredCreditors.length}개 채권자`,
    sumConfirmedP,
    sumUnconfirmedP,
    sumConfirmedM,
    sumUnconfirmedM,
    sumConfirmedT,
    sumUnconfirmedT,
    '',
  ]);

  // 총계 행 (G, H, I)
  const grandTotalP = sumConfirmedP + sumUnconfirmedP;
  const grandTotalM = sumConfirmedM + sumUnconfirmedM;
  const grandTotalT = sumConfirmedT + sumUnconfirmedT;

  wsData.push([
    '총계',
    '',
    `(G) ${grandTotalP.toLocaleString()}원`,
    '',
    `(H) ${grandTotalM.toLocaleString()}원`,
    '',
    `(I) ${grandTotalT.toLocaleString()}원`,
    '',
    `변제율 ${plan.totalRepaymentRate}%`,
  ]);

  wsData.push([]); // Blank

  // 우선권 2단계 배분 상세 (2단계 모드인 경우)
  if (plan.isTwoStageRepayment) {
    wsData.push([
      `[특칙] 우선권 채권 2단계 순차 배분 명세 (1단계 1~${plan.stage1Months}회차 완제 / 2단계 ${plan.stage1Months + 1}~${plan.months}회차 일반재배분)`,
      '', '', '', '', '', '', '', ''
    ]);
    wsData.push([
      '채권번호', '채권자명', '구분', '1단계 월변제액', '2단계 월변제액', '총 변제예정액', '원금변제율', '비고', ''
    ]);

    unsecuredCreditors.forEach((c) => {
      wsData.push([
        c.creditorNumber,
        c.name,
        c.isPriority ? '우선권(세금/보험)' : '일반회생채권',
        c.stage1MonthlyRepayment || (c.isPriority ? c.monthlyRepayment : 0),
        c.stage2MonthlyRepayment || (c.isPriority ? 0 : c.monthlyRepayment),
        c.totalRepayment,
        c.principal > 0 ? (c.totalRepayment / c.principal) : 0,
        c.isPriority ? '1단계 전액완제' : '2단계 전액재배분',
        ''
      ]);
    });
    wsData.push([]); // Blank
  }

  // 3. 청산가치 및 법정 원칙 검증
  wsData.push(['3. 청산가치 보장 및 최저변제액 원칙 검증표', '', '', '', '', '', '', '', '']);
  wsData.push([
    '(J) 청산가치 총액', plan.totalLiquidationValue, '', 
    '(L) 라이프니쯔 현재가치', plan.presentValue, '', 
    '청산가치 보장 원칙', plan.satisfiesLiquidationGuarantee ? '충족 (L ≥ J 통과)' : '미달 (위반)', '', ''
  ]);
  wsData.push([
    '법정 최저변제액', plan.minimumRepaymentThreshold, '', 
    '최저변제 충족 여부', plan.satisfiesMinimumRepayment ? '충족 (통과)' : '미달', '', 
    '라이프니쯔 현가 계수', `${plan.leibnizFactor} (연 5% 복리할인)`, '', ''
  ]);

  if (plan.totalUnconfirmedReserve && plan.totalUnconfirmedReserve > 0) {
    wsData.push([
      '미확정 공탁 유보금', plan.totalUnconfirmedReserve, '',
      '공탁 유보 사유', '채권액 미확정 또는 별제권 행사 미료 채권 유보금', '',
      '확정 실지급 월액', plan.monthlyRepaymentTotal - Math.round(plan.totalUnconfirmedReserve / plan.months), '', ''
    ]);
  }

  if (plan.formType === 'D5111') {
    wsData.push([
      '재산처분 투입금액', plan.requiredDisposalAmount, '', 
      '처분 기한', plan.disposalTargetDeadline || '인가일로부터 1년 이내', '', 
      '처분 대상', '보유 부동산 / 자동차 등 매각 투입', '', ''
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 셀 병합 규칙
  ws['!merges'] = [
    // Title
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    // Section 1 header
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    // Metadata merges
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
    { s: { r: 3, c: 7 }, e: { r: 3, c: 8 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
    { s: { r: 4, c: 7 }, e: { r: 4, c: 8 } },
    { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },
    { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
    { s: { r: 5, c: 7 }, e: { r: 5, c: 8 } },
    // Section 2 header
    { s: { r: 7, c: 0 }, e: { r: 7, c: 8 } },
    
    // 2-level table header merges:
    // 채권번호 rowspan 2
    { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
    // 채권자명 rowspan 2
    { s: { r: 8, c: 1 }, e: { r: 9, c: 1 } },
    // (D) 개인회생채권액 colspan 2
    { s: { r: 8, c: 2 }, e: { r: 8, c: 3 } },
    // (E) 월 변제예정(유보)액 colspan 2
    { s: { r: 8, c: 4 }, e: { r: 8, c: 5 } },
    // (F) 총 변제예정(유보)액 colspan 2
    { s: { r: 8, c: 6 }, e: { r: 8, c: 7 } },
    // 비고 rowspan 2
    { s: { r: 8, c: 8 }, e: { r: 9, c: 8 } },

    // 총계 Row merges:
    // 총계 (cols 0~1)
    { s: { r: 10 + unsecuredCreditors.length + 1, c: 0 }, e: { r: 10 + unsecuredCreditors.length + 1, c: 1 } },
    // (G) cols 2~3
    { s: { r: 10 + unsecuredCreditors.length + 1, c: 2 }, e: { r: 10 + unsecuredCreditors.length + 1, c: 3 } },
    // (H) cols 4~5
    { s: { r: 10 + unsecuredCreditors.length + 1, c: 4 }, e: { r: 10 + unsecuredCreditors.length + 1, c: 5 } },
    // (I) cols 6~7
    { s: { r: 10 + unsecuredCreditors.length + 1, c: 6 }, e: { r: 10 + unsecuredCreditors.length + 1, c: 7 } },
  ];

  // 스타일 적용
  if (ws['A1']) ws['A1'].s = titleStyle;
  if (ws['A3']) ws['A3'].s = sectionHeaderStyle;
  if (ws['A8']) ws['A8'].s = sectionHeaderStyle;

  // Metadata Styling (Rows 3, 4, 5)
  [3, 4, 5].forEach((r) => {
    ['A', 'D', 'G'].forEach((col) => {
      const cell = ws[`${col}${r + 1}`];
      if (cell) cell.s = metaLabelStyle;
    });
    ['B', 'E', 'H'].forEach((col) => {
      const cell = ws[`${col}${r + 1}`];
      if (cell) {
        cell.s = (col === 'B' && r === 4) || (col === 'H' && r === 4)
          ? metaCurrencyStyle
          : metaValueStyle;
      }
    });
  });

  // Table Headers Level 1 (Row index 8)
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 8, c });
    if (ws[cellRef]) ws[cellRef].s = thStyle;
  }
  // Table Headers Level 2 (Row index 9)
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 9, c });
    if (ws[cellRef]) ws[cellRef].s = thSubStyle;
  }

  // Table Rows (Row index 10 to 10 + count)
  const startRow = 10;
  const endRow = startRow + unsecuredCreditors.length;

  for (let r = startRow; r < endRow; r++) {
    for (let c = 0; c < 9; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        if (c === 0 || c === 8) {
          ws[cellRef].s = tdCenterStyle;
        } else if (c === 1) {
          ws[cellRef].s = tdLeftStyle;
        } else {
          ws[cellRef].s = tdCurrencyStyle;
        }
      }
    }
  }

  // 합계 행 (endRow)
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: endRow, c });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        ...sumRowStyle,
        alignment: c === 0 || c === 1 ? { horizontal: 'center', vertical: 'center' } : { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
      };
    }
  }

  // 총계 행 (endRow + 1)
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: endRow + 1, c });
    if (ws[cellRef]) {
      ws[cellRef].s = grandTotalStyle;
    }
  }

  // 열 너비
  ws['!cols'] = [
    { wch: 8 },  // 채권번호
    { wch: 22 }, // 채권자명
    { wch: 15 }, // 확정채권액
    { wch: 15 }, // 미확정채권액
    { wch: 16 }, // 확정 변제액
    { wch: 16 }, // 미확정 유보액
    { wch: 16 }, // 확정채권 총액
    { wch: 16 }, // 미확정 총유보액
    { wch: 18 }, // 비고
  ];

  XLSX.utils.book_append_sheet(wb, ws, '변제예정액표(법원서식)');

  const safeClient = plan.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `[전자소송]_개인회생_변제예정액표_${safeClient}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
