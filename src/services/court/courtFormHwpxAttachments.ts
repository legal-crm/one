// ============================================================
// 신청서 첨부서류 HWPX 채움 (H-1 2묶음 앞부분): D5101 재산목록 · D5103 수입지출목록 · D5105 진술서
//  * 칸 위치는 public/court-forms/hwpx 양식의 원래 표·글 기준 (위치를 못 찾으면 출력 전 검사가 막는다)
//  * 값이 없는 칸은 비워 둔다(지어낸 값 없음). 가족관계 표·과거 면책 이용 표 등은 한글에서 채운다
// ============================================================
import type { CourtFilingMasterData } from '../documents/courtFilingEngine';
import type { HwpxEdit } from './hwpxBuilder';

const won = (n?: number) => (Number.isFinite(n) ? `${Math.round(n as number).toLocaleString('ko-KR')}` : '');
const amt = (n?: number) => (n && n > 0 ? won(n) : '');
const ymdDots = (s?: string) => {
  if (!s) return '';
  const m = s.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : s;
};

// ── D5101 재산목록 (첨부서류 2): 표 0 ──
export function d5101(d: CourtFilingMasterData): HwpxEdit[] {
  const a: any = d.assets || {};
  const banks: any[] = (a.bankAccounts || []).slice(0, 3);
  const ins: any[] = (a.insurance || []).slice(0, 3);
  const bankSum = (a.bankAccounts || []).reduce((t: number, b: any) => t + (b.balance || 0), 0);
  const insSum = (a.insurance || []).reduce((t: number, b: any) => t + (b.refundAmount || 0), 0);
  const v = a.vehicle || {};
  const l = a.leaseDeposit || {};
  const re = a.realEstate || {};
  const sv = a.severancePay || {};
  const total = (a.cash || 0) + bankSum + insSum + (v.estimatedValue || 0) + (l.deposit || 0) + (re.netValue || 0) + (sv.netValue || 0);
  const e: HwpxEdit[] = [
    { kind: 'cell', table: 0, row: 1, col: 1, text: amt(a.cash), label: '현금' },
    { kind: 'cell', table: 0, row: 2, col: 1, text: amt(bankSum), label: '예금 합계' },
    { kind: 'cell', table: 0, row: 5, col: 1, text: amt(insSum), label: '보험 합계' },
    { kind: 'cell', table: 0, row: 8, col: 1, text: amt(v.estimatedValue), label: '자동차 시가' },
    { kind: 'cell', table: 0, row: 8, col: 3, text: v.modelYear ? `${v.modelYear}${v.securedLoan ? ` (담보 ${won(v.securedLoan)}원)` : ''}` : '', label: '자동차 비고' },
    { kind: 'cell', table: 0, row: 9, col: 1, text: amt(l.deposit), label: '임차보증금' },
    { kind: 'cell', table: 0, row: 9, col: 4, text: l.address || '', label: '임차물건' },
    { kind: 'cell', table: 0, row: 10, col: 4, text: l.deposit || l.monthlyRent ? `보증금 ${won(l.deposit || 0)}원, 월세 ${won(l.monthlyRent || 0)}원` : '', label: '보증금 및 월세' },
    { kind: 'cell', table: 0, row: 12, col: 1, text: amt(re.netValue), label: '부동산' },
    { kind: 'cell', table: 0, row: 12, col: 4, text: [re.address, re.area].filter(Boolean).join(', '), label: '부동산 소재지' },
    { kind: 'cell', table: 0, row: 15, col: 4, text: amt(re.marketValue) ? `${amt(re.marketValue)}원` : '', label: '환가예상액' },
    { kind: 'cell', table: 0, row: 16, col: 4, text: amt(re.mortgage) ? `근저당 ${amt(re.mortgage)}원` : '', label: '담보권' },
    { kind: 'cell', table: 0, row: 24, col: 1, text: amt(sv.netValue), label: '예상 퇴직금' },
    { kind: 'cell', table: 0, row: 24, col: 3, text: `근무처: ${sv.company || d.debtor.workplaceName || ''} (압류할 수 없는 퇴직금 ${won(sv.exemptAmount || 0)}원 제외)`, label: '퇴직금 비고' },
    { kind: 'cell', table: 0, row: 26, col: 1, text: total > 0 ? won(total) : '', label: '합계' },
    { kind: 'cell', table: 0, row: 28, col: 1, text: amt(d.repaymentSummary?.liquidationValue), label: '청산가치' },
  ];
  banks.forEach((b, i) => {
    e.push(
      { kind: 'cell', table: 0, row: 2, col: 4 + i, text: `(${i + 1}) ${b.bankName || ''}`, label: `예금 ${i + 1} 금융기관` },
      { kind: 'cell', table: 0, row: 3, col: 4 + i, text: b.accountNumber || '', label: `예금 ${i + 1} 계좌번호` },
      { kind: 'cell', table: 0, row: 4, col: 4 + i, text: amt(b.balance), label: `예금 ${i + 1} 잔고` },
    );
  });
  ins.forEach((b, i) => {
    e.push(
      { kind: 'cell', table: 0, row: 5, col: 4 + i, text: `(${i + 1}) ${b.companyName || ''}`, label: `보험 ${i + 1} 회사` },
      { kind: 'cell', table: 0, row: 6, col: 4 + i, text: b.policyNumber || '', label: `보험 ${i + 1} 증권번호` },
      { kind: 'cell', table: 0, row: 7, col: 4 + i, text: amt(b.refundAmount), label: `보험 ${i + 1} 해약반환금` },
    );
  });
  return e;
}

// ── D5103 수입 및 지출에 관한 목록 (첨부서류 3): 수입 표 · 생계비 문단 · (60% 넘으면) 지출 내역 합계 ──
export function d5103(d: CourtFilingMasterData): HwpxEdit[] {
  const r: any = d.repaymentSummary || {};
  const salary = d.debtor.employmentType !== '영업소득자';
  const monthly = d.ledgerTotals?.monthlyAverageIncome || r.monthlyNetIncome || 0;
  const annual = d.ledgerTotals?.annualNetIncome || (monthly ? monthly * 12 : 0);
  const living = (r.monthlyLivingCost || 0) + (r.additionalLivingCost || 0);
  const median = r.medianIncomeAmount || 0;
  const ratio = median > 0 && living > 0 ? Math.round((living / median) * 1000) / 10 : 0;
  const over = (r.additionalLivingCost || 0) > 0;
  const hs = r.householdSize ? String(r.householdSize) : '';
  const e: HwpxEdit[] = [
    salary
      ? { kind: 'cell', table: 0, row: 0, col: 4, text: d.debtor.workplaceName || '', label: '직장명' }
      : { kind: 'cell', table: 0, row: 0, col: 2, text: d.debtor.workplaceName || '', label: '상호' },
    salary
      ? { kind: 'cell', table: 0, row: 1, col: 4, text: d.debtor.jobTitle || '', label: '직위' }
      : { kind: 'cell', table: 0, row: 1, col: 2, text: d.debtor.jobTitle || '', label: '업종' },
    { kind: 'cell', table: 0, row: 4, col: 0, text: monthly ? (salary ? '급여' : '사업소득') : '', label: '수입 명목' },
    { kind: 'cell', table: 0, row: 4, col: 1, text: monthly ? '월' : '', label: '기간 구분' },
    { kind: 'cell', table: 0, row: 4, col: 2, text: monthly ? won(monthly) : '', label: '월 수입' },
    { kind: 'cell', table: 0, row: 4, col: 3, text: annual ? won(annual) : '', label: '연간 환산' },
    { kind: 'cell', table: 0, row: 4, col: 4, text: monthly ? (r.hasGarnishment ? '유' : '무') : '', label: '압류 유무' },
    { kind: 'cell', table: 0, row: 7, col: 3, text: annual ? won(annual) : '', label: '연 수입' },
    { kind: 'cell', table: 0, row: 7, col: 4, text: `월 평균 수입 ( ${monthly ? won(monthly) : ''} )`, label: '월 평균 수입' },
  ];
  if (living > 0 && median > 0) {
    if (!over) {
      e.push(
        { kind: 'text', label: '60% 이하 표시', find: '□ ', replace: '■ ', occurrence: 0 },
        { kind: 'text', label: '가구원 수', find: ' 보건복지부 공표 (    )인 ', replace: ` 보건복지부 공표 ( ${hs} )인 ` },
        { kind: 'text', label: '중위소득·비율', find: ' (         )원의  약 (    ', replace: ` ( ${won(median)} )원의  약 ( ${ratio} ` },
        { kind: 'text', label: '생계비', find: ')%인 (         )원을 지출할 것으로 예상됩니다.', replace: `)%인 ( ${won(living)} )원을 지출할 것으로 예상됩니다.` },
      );
    } else {
      e.push(
        { kind: 'text', label: '60% 초과 표시', find: '□ ', replace: '■ ', occurrence: 1 },
        { kind: 'text', label: '가구원 수', find: ' 보건복지부 공표 (   )인 ', replace: ` 보건복지부 공표 ( ${hs} )인 ` },
        {
          kind: 'text', label: '중위소득·비율·생계비',
          find: ' (           )원의  약 (     )%인 (         )원을 지출할 것으로 예상됩니다(뒷면 표에 내역과 사유를 상세히 기재하십시오).',
          replace: ` ( ${won(median)} )원의  약 ( ${ratio} )%인 ( ${won(living)} )원을 지출할 것으로 예상됩니다(뒷면 표에 내역과 사유를 상세히 기재하십시오).`,
        },
        { kind: 'cell', table: 2, row: 1, col: 1, text: won(r.monthlyLivingCost || 0), label: '기본 생계비' },
        { kind: 'cell', table: 2, row: 5, col: 1, text: won(living), label: '생계비 계' },
      );
    }
  }
  return e;
}

// ── D5105 진술서 (첨부서류 4) ──
// 양식의 '사정' 줄 (선택지 이름은 statementDebtCauses.ts와 같은 순서)
const CAUSE_LINES: Array<{ find: string; causes: [string, string] }> = [
  { find: '(  ) 생활비 부족               (  ) 병원비 과다 지출', causes: ['생활비 부족', '병원비 과다지출'] },
  { find: '(  ) 교육비 과다 지출                (  ) 음식, 음주, 여행, 도박 또는 취미 활동', causes: ['교육비 과다지출', '음식, 음주, 여흥, 도박 또는 취미활동'] },
  { find: '(  ) 점포 운영의 실패                (  ) 타인 채무의 보증', causes: ['점포 운영의 실패', '타인(친지, 친구 등)의 채무보증'] },
  { find: '(  ) 주식 투자 실패                  (  ) 사기 피해', causes: ['주식 투자 실패', '사기 피해'] },
];
const HOUSING_ROW: Record<string, { row: number; text: string }> = {
  '신청인 소유': { row: 1, text: '■ ㉠ 신청인 소유의 주택' },
  '사택 또는 기숙사': { row: 2, text: '■ ㉡ 사택 또는 기숙사 / ㉢ 임차(전․월세) 주택' },
  '임차(전월세) 주택': { row: 2, text: '㉡ 사택 또는 기숙사 / ■ ㉢ 임차(전․월세) 주택' },
  '친족 소유 무상거주': { row: 3, text: '■ ㉣ 친족 소유 주택에 무상 거주 / ㉤ 친족 외 소유 주택에 무상 거주' },
  '친족 이외 무상거주': { row: 3, text: '㉣ 친족 소유 주택에 무상 거주 / ■ ㉤ 친족 외 소유 주택에 무상 거주' },
  '기타': { row: 4, text: '■ ㉥ 기타( )' },
};

export function d5105(d: CourtFilingMasterData): HwpxEdit[] {
  const st: any = d.statement || {};
  const causes: string[] = Array.isArray(st.debtCauses) ? st.debtCauses : [];
  const mark = (on: boolean) => (on ? '(○)' : '(  )');
  const seized = !!st.hasLitigationOrSeizure || (d.stayCases || []).length > 0;
  const e: HwpxEdit[] = [
    { kind: 'cell', table: 0, row: 1, col: 3, text: d.debtor.workplaceName || '', label: '현 직장명' },
    { kind: 'cell', table: 0, row: 1, col: 5, text: d.debtor.jobTitle || '', label: '현 직위' },
    { kind: 'cell', table: 3, row: 0, col: 0, text: st.detailedReasonEssay || '', label: '구체적 사정' },
    {
      kind: 'text', label: '소송·압류 경험',
      find: '1. 채권자로부터 소송․지급명령․전부명령․압류․가압류 등을 받은 경험(있음, 없음)',
      replace: `1. 채권자로부터 소송․지급명령․전부명령․압류․가압류 등을 받은 경험(${seized ? '■ 있음, □ 없음' : '□ 있음, ■ 없음'})`,
    },
  ];
  if (st.education) e.push({ kind: 'text', label: '최종 학력', find: '             년    월    일                      학교 ( 졸업,  중퇴 )', replace: `             ${st.education}` });
  if (st.maritalHistory) e.push({ kind: 'text', label: '결혼·이혼 경력', find: '             년    월    일             와 (결혼, 이혼) ', replace: `             ${st.maritalHistory} `, occurrence: 0 });
  if (st.housingStartDate) e.push({ kind: 'text', label: '거주 시작', find: '   거주를 시작한 시점   (      년    월    일 )', replace: `   거주를 시작한 시점   ( ${ymdDots(st.housingStartDate)} )` });
  const h = HOUSING_ROW[st.housingType];
  if (h) {
    e.push({ kind: 'cell', table: 1, row: h.row, col: 0, text: h.text, label: '거주 상황' });
    const l: any = d.assets?.leaseDeposit || {};
    if (st.housingType === '임차(전월세) 주택') {
      e.push({ kind: 'cell', table: 1, row: 2, col: 1, text: `임대보증금 ( ${won(l.deposit || 0)} 원) 임대료 (월 ${won(l.monthlyRent || 0)} 원), 연체액 (    원) 임차인 성명 (      )${st.housingDetail ? ` ${st.housingDetail}` : ''}`, label: '임차 내역' });
    } else if (st.housingDetail) {
      e.push({ kind: 'cell', table: 1, row: h.row, col: 1, text: st.housingDetail, label: '거주 상세' });
    }
  }
  (d.stayCases || []).slice(0, 3).forEach((c: any, i: number) => {
    e.push(
      { kind: 'cell', table: 2, row: 1 + i, col: 0, text: c.caseType || '', label: `소송·압류 ${i + 1} 내역` },
      { kind: 'cell', table: 2, row: 1 + i, col: 1, text: c.creditorName || '', label: `소송·압류 ${i + 1} 채권자` },
      { kind: 'cell', table: 2, row: 1 + i, col: 2, text: c.courtName || '', label: `소송·압류 ${i + 1} 법원` },
      { kind: 'cell', table: 2, row: 1 + i, col: 3, text: c.caseNumber || '', label: `소송·압류 ${i + 1} 사건번호` },
    );
  });
  CAUSE_LINES.forEach(({ find, causes: [a, b] }) => {
    const on1 = causes.includes(a);
    const on2 = causes.includes(b);
    if (!on1 && !on2) return;
    const parts = find.split('(  )');
    e.push({ kind: 'text', label: '사정 선택', find, replace: `${parts[0]}${mark(on1)}${parts[1]}${mark(on2)}${parts[2]}` });
  });
  if (causes.includes('기타')) {
    e.push({ kind: 'text', label: '사정 기타', find: '(  ) 기타 (                                                                )', replace: '(○) 기타 (                                                                )' });
  }
  return e;
}
