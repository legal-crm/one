// ============================================================
// 법원 양식 HWPX 데이터 채움 (H-1 1묶음: D5100·D5106·D5101·D5103·D5105·D5110·D5113·D5114·위임장)
//  * 양식(public/court-forms/hwpx)의 원래 글·표 칸 위치를 기준으로 사건 데이터를 넣는다 (hwpxBuilder)
//  * 채울 위치를 찾지 못하면 CourtDocGuard가 내려받기를 막는다 → 대법원이 양식을 바꾸면 바로 드러난다
//  * 주민등록번호는 사건 데이터에 없다(L8). 출력할 때 받은 값만 넣는다
//  * 값을 모르는 칸은 비워 둔다(지어낸 값 없음). 한글에서 열어 나머지 칸을 확인·보완한다
// ============================================================
import type { CourtFilingMasterData } from '../documents/courtFilingEngine';
import { creditorAnnexNumbers } from '../documents/courtFilingEngine';
import { basisWithDate, dotDate, headerBaseDate } from '../debt/debtLedgerRules';
import type { HwpxEdit } from './hwpxBuilder';
import { buildHwpx, fetchTemplate } from './hwpxBuilder';
import { guard, runGuard, RRN_RE, type GuardIssue } from './courtDocGuard';
import { d5101, d5103, d5105 } from './courtFormHwpxAttachments';

export type FilledFormCode = 'D5100' | 'D5106' | 'D5101' | 'D5103' | 'D5105' | 'D5110' | 'D5113' | 'D5114' | 'POA';

export const FILLED_FORMS: Record<FilledFormCode, { title: string; path: string; order: number }> = {
  D5100: { title: '개인회생절차 개시신청서', path: '/court-forms/hwpx/개인회생절차 개시신청서(2021.4.20.시행)(D5100).hwpx', order: 1 },
  D5106: { title: '개인회생채권자목록', path: '/court-forms/hwpx/개인회생채권자목록(D5106).hwpx', order: 2 },
  D5101: { title: '재산목록', path: '/court-forms/hwpx/재산목록(D5101).hwpx', order: 3 },
  D5103: { title: '수입 및 지출에 관한 목록', path: '/court-forms/hwpx/수입 및 지출에 관한 목록(D5103).hwpx', order: 4 },
  D5105: { title: '진술서', path: '/court-forms/hwpx/진술서(D5105).hwpx', order: 5 },
  D5110: { title: '변제계획안(가용소득만으로 변제)', path: '/court-forms/hwpx/변제계획안(가용소득만으로 변제하는 경우)(D5110) (1).hwpx', order: 6 },
  D5114: { title: '금지명령 신청서', path: '/court-forms/hwpx/금지명령 신청서(D5114).hwpx', order: 8 },
  D5113: { title: '중지명령 신청서', path: '/court-forms/hwpx/중지명령 신청서(D5113).hwpx', order: 9 },
  POA: { title: '위임장', path: '/court-forms/hwpx/위임장.hwpx', order: 10 },
};

const won = (n?: number) => (Number.isFinite(n) ? `${Math.round(n as number).toLocaleString('ko-KR')}` : '');
const wonU = (n?: number) => (Number.isFinite(n) ? `${won(n)}원` : '');
const rrnFmt = (rrn: string) => { const d = rrn.replace(/\D/g, ''); return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : ''; };
const ymdDots = (s?: string) => {
  if (!s) return '';
  const m = s.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : s;
};
const caseNo = (d: CourtFilingMasterData) => {
  const c = d.court;
  return c.caseNumber ? `${c.caseYear || ''}${c.caseType || '개회'}${c.caseNumber}` : '';
};
/** '20    개회        개인회생' 같은 사건 줄: 번호가 없으면 원래 빈칸을 둔다 */
const caseLine = (d: CourtFilingMasterData, orig: string, prefix: string) => {
  const n = caseNo(d);
  return n ? `${prefix}${n}  개인회생` : orig;
};
const court = (d: CourtFilingMasterData) => (d.court.courtName || '').trim();
const today = () => ymdDots(new Date().toISOString().slice(0, 10));
const principal = (c: any): number => c.principal ?? c.currentPrincipal ?? 0;
const interest = (c: any): number => c.interest ?? c.currentInterest ?? 0;

// ── D5100 개시신청서 ──
function d5100(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const r = d.repaymentSummary;
  const salary = d.debtor.employmentType !== '영업소득자';
  const day = d.court.firstRepaymentDate?.match(/(\d{1,2})\.?\s*$/)?.[1];
  return [
    { kind: 'cell', table: 0, row: 0, col: 2, text: d.debtor.name, label: '신청인 성명' },
    { kind: 'cell', table: 0, row: 0, col: 4, text: rrnFmt(rrn), label: '신청인 주민등록번호' },
    { kind: 'cell', table: 0, row: 1, col: 2, text: d.debtor.residentAddress, label: '주민등록상 주소' },
    { kind: 'cell', table: 0, row: 2, col: 2, text: d.debtor.currentAddress, label: '현주소' },
    { kind: 'cell', table: 0, row: 3, col: 2, text: `${d.debtor.serviceRecipient ? `(송달영수인: ${d.debtor.serviceRecipient}) ` : ''}${d.debtor.serviceAddress || ''}`, label: '송달장소' },
    { kind: 'cell', table: 0, row: 4, col: 2, text: d.debtor.homePhone || '', label: '집·직장 전화' },
    { kind: 'cell', table: 0, row: 4, col: 4, text: d.debtor.phone || '', label: '휴대전화' },
    { kind: 'cell', table: 1, row: 0, col: 2, text: [d.lawyer.firmName, d.lawyer.lawyerName ? `변호사 ${d.lawyer.lawyerName}` : ''].filter(Boolean).join(' '), label: '대리인 성명' },
    { kind: 'cell', table: 1, row: 1, col: 2, text: d.lawyer.address || '', label: '대리인 사무실 주소' },
    { kind: 'cell', table: 1, row: 2, col: 2, text: d.lawyer.phone || '', label: '대리인 전화' },
    { kind: 'cell', table: 1, row: 3, col: 2, text: d.lawyer.email || '', label: '대리인 이메일' },
    { kind: 'cell', table: 1, row: 3, col: 4, text: d.lawyer.fax || '', label: '대리인 팩스' },
    { kind: 'text', label: '급여소득자 표시', find: '   □ 신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(',
      replace: `   ${salary ? '■' : '□'} 신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(` },
    { kind: 'text', label: '영업소득자 표시', find: '   □ 신청인은 부동산임대소득․사업소득․농업소득․임업소득 그 밖에 이와 유사한 수입을 장래에 계속적으로 또는 반복하여 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(',
      replace: `   ${salary ? '□' : '■'} 신청인은 부동산임대소득․사업소득․농업소득․임업소득 그 밖에 이와 유사한 수입을 장래에 계속적으로 또는 반복하여 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(` },
    { kind: 'text', label: '변제기간·월 변제액', find: '개월간 월 ', replace: r.repaymentMonths ? ` ${r.repaymentMonths}개월간 월 ${won(r.monthlyDisposableIncome)}` : '개월간 월 ' },
    { kind: 'text', label: '제1회 납입일', find: '    .   .  .', replace: d.court.firstRepaymentDate ? ymdDots(d.court.firstRepaymentDate) : '    .   .  .' },
    { kind: 'text', label: '매월 변제일', find: '을 제1회로 하여, 이후 매월 ', replace: `을 제1회로 하여, 이후 매월 ${day ? `${Number(day)}일` : ''}` },
    { kind: 'text', label: '적립금 반환 계좌', find: '은행 ', replace: d.debtor.refundBank || d.debtor.refundAccount ? `${(d.debtor.refundBank || '').replace(/은행$/, '')}은행 ${d.debtor.refundAccount || ''} ` : '은행 ' },
    { kind: 'text', label: '신청일', find: '20   .    .    .', replace: ymdDots(d.court.applicationDate) || '20   .    .    .' },
    { kind: 'text', label: '신청인 서명', find: '신청인              (서명 또는 날인)', replace: `신청인   ${d.debtor.name}   (서명 또는 날인)` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중', occurrence: 0 },
  ];
}

// ── D5106 채권자목록: 앞 표 4명 + 다음 표 6명, 넘치면 다음 표를 복제 ──
function d5106(d: CourtFilingMasterData): HwpxEdit[] {
  const list = d.creditors || [];
  const secured = list.filter(c => c.isSecured);
  const sumP = list.reduce((s, c) => s + principal(c), 0);
  const sumI = list.reduce((s, c) => s + interest(c), 0);
  const securedSum = secured.reduce((s, c) => s + principal(c) + interest(c), 0);
  const base = headerBaseDate(list);
  const edits: HwpxEdit[] = [
    { kind: 'text', label: '산정기준일', find: '.   .  .', replace: base ? dotDate(base) : (ymdDots(d.court.applicationDate) || '.   .  .') },
    { kind: 'text', label: '목록 작성일', find: '   .   .   .', replace: ymdDots(d.court.applicationDate) || today() },
    { kind: 'cell', table: 0, row: 0, col: 1, text: wonU(sumP + sumI), label: '채권현재액 총합계' },
    { kind: 'cell', table: 0, row: 0, col: 4, text: wonU(securedSum), label: '담보부 합계' },
    { kind: 'cell', table: 0, row: 0, col: 6, text: wonU(Math.max(0, sumP - securedSum)), label: '무담보 합계' },
    { kind: 'cell', table: 0, row: 1, col: 1, text: wonU(sumP), label: '원금 합계' },
    { kind: 'cell', table: 0, row: 2, col: 1, text: wonU(sumI), label: '이자 합계' },
  ];
  const extraTables = Math.max(0, Math.ceil((list.length - 10) / 6));
  if (extraTables) edits.push({ kind: 'cloneTable', table: 2, times: extraTables, label: '채권자 표 추가' });
  list.forEach((c: any, i) => {
    // 표 1: 4명(행 4·8·12·16), 표 2부터: 6명(행 0·4·…·20)
    const table = i < 4 ? 1 : 2 + Math.floor((i - 4) / 6);
    const b = i < 4 ? 4 + i * 4 : ((i - 4) % 6) * 4;
    const annex = creditorAnnexNumbers(c);
    const addr = [`(주소) ${c.address || c.creditorAddress || ''}`, `(전화) ${c.creditorPhone || c.phone || ''}`, `(팩스) ${c.fax || ''}`].join(' ');
    edits.push(
      { kind: 'cell', table, row: b, col: 0, text: String(c.displayNumber || c.creditorNumber || i + 1), label: `채권자 ${i + 1} 번호` },
      { kind: 'cell', table, row: b, col: 1, text: c.name || '', label: `채권자 ${i + 1} 이름` },
      { kind: 'cell', table, row: b, col: 2, text: [c.borrowedDate ? ymdDots(c.borrowedDate) : '', c.claimCause || c.debtCauseDetail || c.debtType || ''].filter(Boolean).join(' '), label: `채권자 ${i + 1} 원인` },
      { kind: 'cell', table, row: b, col: 4, text: addr, label: `채권자 ${i + 1} 주소` },
      { kind: 'cell', table, row: b + 1, col: 2, text: c.claimContent || '', label: `채권자 ${i + 1} 내용` },
      { kind: 'cell', table, row: b + 1, col: 5, text: annex.length ? `■ 부속서류 (${annex.join(', ')})` : '□ 부속서류 (1, 2, 3, 4)', label: `채권자 ${i + 1} 부속서류` },
      { kind: 'cell', table, row: b + 2, col: 2, text: wonU(principal(c)), label: `채권자 ${i + 1} 원금` },
      { kind: 'cell', table, row: b + 2, col: 3, text: c.principalCalculationBasis || basisWithDate(c), label: `채권자 ${i + 1} 원금 근거` },
      { kind: 'cell', table, row: b + 3, col: 2, text: wonU(interest(c)), label: `채권자 ${i + 1} 이자` },
      { kind: 'cell', table, row: b + 3, col: 3, text: c.interestCalculationBasis || basisWithDate(c), label: `채권자 ${i + 1} 이자 근거` },
    );
  });
  return edits;
}

// ── D5110 변제계획안 (가용소득): 제출서 머리·가용소득 표·채권자별 변제예정액 표·청산가치 비교 ──
function d5110(d: CourtFilingMasterData): HwpxEdit[] {
  const r = d.repaymentSummary;
  const list = d.creditors || [];
  const totalP = list.reduce((s, c) => s + principal(c), 0);
  const months = r.repaymentMonths || 0;
  const monthly = r.monthlyDisposableIncome || 0;
  const trusteeMonthly = r.isExternalTrustee ? Math.round(monthly * 0.01) : 0;
  const n = list.length;
  const edits: HwpxEdit[] = [
    { kind: 'text', label: '사건번호', find: '    사    건     20    개회       개인회생', replace: caseLine(d, '    사    건     20    개회       개인회생', '    사    건     ') },
    { kind: 'text', label: '채무자', find: '    채 무 자     ', replace: `    채 무 자     ${d.debtor.name}` },
    { kind: 'text', label: '대리인', find: '    대 리 인     ', replace: `    대 리 인     ${d.lawyer.lawyerName ? `변호사 ${d.lawyer.lawyerName}` : ''}` },
    { kind: 'text', label: '제출일', find: '20    .    .    .  ', replace: ymdDots(d.court.applicationDate) || '20    .    .    .  ' },
    { kind: 'text', label: '채무자 서명', find: '                                   채무자     ', replace: `                                   채무자     ${d.debtor.name}` },
    { kind: 'text', label: '대리인 서명', find: '     대리인 변호사             (서명 또는 날인)', replace: `     대리인 변호사   ${d.lawyer.lawyerName || ''}   (서명 또는 날인)` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
    { kind: 'text', label: '계획안 머리', find: '20    개회       호  채무자:', replace: `${caseNo(d) ? `${caseNo(d)}호` : '20    개회       호'}  채무자: ${d.debtor.name}` },
    { kind: 'text', label: '작성일', find: '.   .   . 작성', replace: `${ymdDots(d.court.applicationDate) || today()} 작성` },
    // 가용소득 표
    { kind: 'cell', table: 1, row: 1, col: 0, text: won(r.monthlyNetIncome), label: '월 평균 수입' },
    { kind: 'cell', table: 1, row: 1, col: 1, text: won((r.monthlyLivingCost || 0) + (r.additionalLivingCost || 0)), label: '월 평균 생계비' },
    { kind: 'cell', table: 1, row: 1, col: 2, text: won(monthly + trusteeMonthly), label: '월 평균 가용소득' },
    { kind: 'cell', table: 1, row: 1, col: 3, text: won(trusteeMonthly), label: '월 회생위원 보수' },
    { kind: 'cell', table: 1, row: 1, col: 4, text: won(monthly), label: '월 실제 가용소득' },
    { kind: 'cell', table: 1, row: 1, col: 5, text: months ? String(months) : '', label: '변제 횟수' },
    { kind: 'cell', table: 1, row: 1, col: 6, text: won(monthly * months), label: '총 실제 가용소득' },
    { kind: 'cell', table: 5, row: 0, col: 1, text: won(monthly + trusteeMonthly), label: '③ 월 평균가용소득' },
    { kind: 'cell', table: 5, row: 0, col: 4, text: won(trusteeMonthly), label: '④ 월 회생위원 보수' },
    { kind: 'cell', table: 6, row: 0, col: 1, text: won(monthly), label: '(A) 월 실제 가용소득' },
    { kind: 'cell', table: 6, row: 0, col: 4, text: months ? `${months}회` : '회', label: '(B) 변제 횟수' },
    { kind: 'cell', table: 6, row: 0, col: 7, text: won(monthly * months), label: '(C) 총 실제 가용소득' },
  ];
  // 채권자별 변제예정액 (표 7: 빈 행 2~6 = 5줄, 넘치면 6행을 늘림)
  const rowsFor = (c: any) => {
    const p = principal(c);
    const share = totalP > 0 ? p / totalP : 0;
    const m = c.monthlyRepayment ?? Math.ceil(monthly * share);
    const undetermined = !!c.isUndetermined || !!c.isSecured;
    return [String(c.displayNumber || c.creditorNumber || ''), c.name || '',
      undetermined ? '' : won(p), undetermined ? won(p) : '',
      undetermined ? '' : won(m), undetermined ? won(m) : '',
      undetermined ? '' : won(m * months), undetermined ? won(m * months) : ''];
  };
  const rowVals = list.map(rowsFor);
  rowVals.slice(0, 4).forEach((vals, i) => vals.forEach((v, col) => edits.push({ kind: 'cell', table: 7, row: 2 + i, col, text: v, label: `변제예정액 ${i + 1}` })));
  if (n > 4) edits.push({ kind: 'rows', table: 7, templateRow: 6, rows: rowVals.slice(4), label: '변제예정액 행 늘리기' });
  const sumRow = 7 + Math.max(0, n - 5);
  const det = list.filter((c: any) => !(c.isUndetermined || c.isSecured));
  const und = list.filter((c: any) => c.isUndetermined || c.isSecured);
  const sumOf = (arr: any[], f: (c: any) => number) => arr.reduce((s, c) => s + f(c), 0);
  const monthlyOf = (c: any) => c.monthlyRepayment ?? Math.ceil(monthly * (totalP > 0 ? principal(c) / totalP : 0));
  edits.push(
    { kind: 'cell', table: 7, row: sumRow, col: 2, text: won(sumOf(det, principal)), label: '합계 확정 원금' },
    { kind: 'cell', table: 7, row: sumRow, col: 3, text: won(sumOf(und, principal)), label: '합계 미확정 원금' },
    { kind: 'cell', table: 7, row: sumRow, col: 4, text: won(sumOf(det, monthlyOf)), label: '합계 확정 월' },
    { kind: 'cell', table: 7, row: sumRow, col: 5, text: won(sumOf(und, monthlyOf)), label: '합계 미확정 월' },
    { kind: 'cell', table: 7, row: sumRow, col: 6, text: won(sumOf(det, c => monthlyOf(c) * months)), label: '합계 확정 총' },
    { kind: 'cell', table: 7, row: sumRow, col: 7, text: won(sumOf(und, c => monthlyOf(c) * months)), label: '합계 미확정 총' },
    { kind: 'cell', table: 7, row: sumRow + 1, col: 2, text: `(G) ${won(totalP)}`, label: '총계 (G)' },
    { kind: 'cell', table: 7, row: sumRow + 1, col: 4, text: `(H) ${won(sumOf(list, monthlyOf))}`, label: '총계 (H)' },
    { kind: 'cell', table: 7, row: sumRow + 1, col: 6, text: `(I) ${won(sumOf(list, c => monthlyOf(c) * months))}`, label: '총계 (I)' },
    { kind: 'text', label: '변제율', find: '원금의 [    ]% 상당액 ', replace: `원금의 [ ${r.repaymentRatio ? r.repaymentRatio.toFixed(2) : '    '} ]% 상당액 ` },
    { kind: 'cell', table: 8, row: 0, col: 1, text: won(r.liquidationValue), label: '(J) 청산가치' },
    { kind: 'cell', table: 8, row: 0, col: 4, text: won(r.totalRepaymentAmount), label: '(K) 총변제예정액' },
    { kind: 'cell', table: 8, row: 1, col: 4, text: won(r.presentValue), label: '(L) 현재가치' },
  );
  return edits;
}

// ── D5113 중지명령 / D5114 금지명령 ──
function stayOrBan(d: CourtFilingMasterData, rrn: string, kind: 'D5113' | 'D5114'): HwpxEdit[] {
  const n = caseNo(d);
  const yearNo = n ? n.replace(/^(\d{4})개회(.+)$/, '$1개회 $2') : '';
  const edits: HwpxEdit[] = [
    { kind: 'text', label: '사건번호', find: '사      건       20    개회        개인회생', replace: caseLine(d, '사      건       20    개회        개인회생', '사      건       ') },
    kind === 'D5114'
      ? { kind: 'text', label: '신청인', find: '신  청  인  성 명:             (주민등록번호        -          )', replace: `신  청  인  성 명: ${d.debtor.name}  (주민등록번호 ${rrnFmt(rrn)})` }
      : { kind: 'text', label: '신청인', find: '신  청  인  성 명:               (주민등록번호        -          )', replace: `신  청  인  성 명: ${d.debtor.name}  (주민등록번호 ${rrnFmt(rrn)})` },
    { kind: 'text', label: '신청인 주소', find: '(채 무 자)       주 소: ', replace: `(채 무 자)       주 소: ${d.debtor.residentAddress || d.debtor.currentAddress}` },
    { kind: 'text', label: '신청일', find: kind === 'D5114' ? '20 .   .    .' : '20  .   .    .', replace: ymdDots(d.court.applicationDate) || (kind === 'D5114' ? '20 .   .    .' : '20  .   .    .') },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
  if (kind === 'D5114') {
    edits.push(
      { kind: 'text', label: '신청취지 사건', find: '  신청인에 대한 이 법원 20  개회 ○○  개인회생사건에 관하여 개인회생절차의 개시신청에 대한 결정이 있을 때까지 다음의 각 절차 또는 행위를 금지한다.',
        replace: `  신청인에 대한 이 법원 ${yearNo || '20  개회 ○○'}  개인회생사건에 관하여 개인회생절차의 개시신청에 대한 결정이 있을 때까지 다음의 각 절차 또는 행위를 금지한다.` },
      { kind: 'text', label: '신청원인 사건', find: '1. 신청인은 귀원 20  개회 ○○  개인회생 사건의 신청 채무자입니다.', replace: `1. 신청인은 귀원 ${yearNo || '20  개회 ○○'}  개인회생 사건의 신청 채무자입니다.` },
      { kind: 'text', label: '급여 회사명', find: '급여를 받는 회사명', replace: d.debtor.workplaceName || '급여를 받는 회사명' },
      { kind: 'text', label: '신청인 서명', find: '                                     신청인(채무자)                    (서명 또는 날인)', replace: `                                     신청인(채무자)   ${d.debtor.name}   (서명 또는 날인)` },
      { kind: 'text', label: '연락처', find: ' 연락 가능한 전화번호:                   ', replace: ` 연락 가능한 전화번호: ${d.debtor.phone || ''}` },
    );
  } else {
    const sc: any = (d.stayCases || [])[0];
    edits.push(
      { kind: 'text', label: '상대방', find: '상  대  방       성 명:                ', replace: `상  대  방       성 명: ${sc?.creditorName || ''}` },
      { kind: 'text', label: '신청취지', find: '  신청인에 대한 이 법원 20   개회 ○○ 개인회생사건에 관하여 개인회생절차의 개시신청에 대한 결정이 있을 때까지 신청인에 대한 ○○법원 20  타채 ○ 호 사건의 압류․추심명령절차를 중지한다는 결정을 구합니다.',
        replace: `  신청인에 대한 이 법원 ${yearNo || '20   개회 ○○'} 개인회생사건에 관하여 개인회생절차의 개시신청에 대한 결정이 있을 때까지 신청인에 대한 ${sc?.courtName || '○○법원'} ${sc?.caseNumber || '20  타채 ○'} 호 사건의 압류․추심명령절차를 중지한다는 결정을 구합니다.` },
      { kind: 'text', label: '신청원인 사건', find: '1. 신청인은 귀원 20   개회 ○○ 개인회생 사건의 신청 채무자입니다.', replace: `1. 신청인은 귀원 ${yearNo || '20   개회 ○○'} 개인회생 사건의 신청 채무자입니다.` },
      { kind: 'text', label: '신청인 서명', find: '신청인(채무자)                  (서명 또는 날인)       ', replace: `신청인(채무자)   ${d.debtor.name}   (서명 또는 날인)` },
      { kind: 'text', label: '연락처', find: ' 연락 가능한 전화번호:                      ', replace: ` 연락 가능한 전화번호: ${d.debtor.phone || ''}` },
    );
  }
  return edits;
}

// ── 위임장 ──
function poa(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const n = caseNo(d);
  return [
    { kind: 'text', label: '수임인 성명', find: '  성        명:', replace: `  성        명: ${d.lawyer.firmName ? `${d.lawyer.firmName} ` : ''}변호사 ${d.lawyer.lawyerName || ''}` },
    { kind: 'text', label: '수임인 주소', find: '  주        소:', replace: `  주        소: ${d.lawyer.address || ''}` },
    { kind: 'text', label: '사건번호', find: ' (20  개회        )               ', replace: n ? ` (${n})               ` : ' (20  개회        )               ' },
    { kind: 'text', label: '신청인', find: '             신청인 (                      ) ', replace: `             신청인 ( ${d.debtor.name} ) ` },
    { kind: 'text', label: '작성일', find: '20  .    .    .', replace: ymdDots(d.court.applicationDate) || today() },
    { kind: 'text', label: '위임인', find: '      위   임   인                      (서명 또는 날인)            ', replace: `      위   임   인   ${d.debtor.name}   (서명 또는 날인)            ` },
    { kind: 'text', label: '위임인 주소', find: '      주        소', replace: `      주        소   ${d.debtor.residentAddress || d.debtor.currentAddress || ''}` },
    { kind: 'text', label: '위임인 주민등록번호', find: '      주민등록번호', replace: `      주민등록번호   ${rrnFmt(rrn)}` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
}

export function courtFormEdits(code: FilledFormCode, d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  switch (code) {
    case 'D5100': return d5100(d, rrn);
    case 'D5106': return d5106(d);
    case 'D5101': return d5101(d);
    case 'D5103': return d5103(d);
    case 'D5105': return d5105(d);
    case 'D5110': return d5110(d);
    case 'D5113': return stayOrBan(d, rrn, 'D5113');
    case 'D5114': return stayOrBan(d, rrn, 'D5114');
    case 'POA': return poa(d, rrn);
  }
}

/** 출력 전 검사 (H-3): 필수 항목·합계·주민번호 형식 */
export function courtFormGuard(code: FilledFormCode, d: CourtFilingMasterData, rrn: string): { blocks: GuardIssue[]; warns: GuardIssue[]; ok: boolean } {
  const needsRrn = code !== 'D5106' && code !== 'D5110' && code !== 'D5101' && code !== 'D5103' && code !== 'D5105';
  const list = d.creditors || [];
  const r = d.repaymentSummary;
  return runGuard([
    guard.required(d.debtor.name, 'name', '채무자 성명'),
    needsRrn ? guard.required(rrn, 'rrn', '주민등록번호') : null,
    needsRrn ? guard.pattern(rrn, RRN_RE, 'rrn', '주민등록번호 13자리를 확인해 주세요.') : null,
    guard.required(court(d), 'court', '관할 법원'),
    code === 'D5100' || code === 'D5113' || code === 'D5114' ? guard.required(d.debtor.residentAddress || d.debtor.currentAddress, 'address', '채무자 주소') : null,
    code === 'D5106' || code === 'D5110' ? (list.length ? null : { level: 'block', message: '채권자목록이 비어 있어요.' }) : null,
    code === 'D5110' && !(r.repaymentMonths > 0) ? { level: 'block', message: '변제계획안(기간·월 변제금)을 먼저 저장해 주세요.' } : null,
    code === 'D5110' && r.liquidationValue > 0 && (r.presentValue ?? 0) > 0 && (r.presentValue ?? 0) < r.liquidationValue
      ? { level: 'block', message: '현재가치가 청산가치보다 적어요. 변제계획을 다시 확인해 주세요.' } : null,
    code === 'D5110' && r.meetsStatutoryMinimum === false ? { level: 'block', message: '최저변제액 기준을 채우지 못해요. 변제계획을 다시 확인해 주세요.' } : null,
    code === 'D5105' && !String((d.statement as any)?.detailedReasonEssay || '').trim() ? { level: 'warn', message: '진술서의 구체적 사정이 비어 있어요. 한글에서 적어 주세요.' } : null,
    code === 'D5103' && !(d.ledgerTotals?.monthlyAverageIncome || d.repaymentSummary.monthlyNetIncome) ? { level: 'warn', message: '월 수입이 비어 있어요. 급여 명세를 넣거나 한글에서 적어 주세요.' } : null,
    code === 'D5103' && (d.repaymentSummary.additionalLivingCost || 0) > 0 ? { level: 'warn', message: '생계비가 60%를 넘어요. 뒷면 지출 내역(주거·의료·교육비)과 사유를 한글에서 채워 주세요.' } : null,
    code === 'D5101' && (d.assets?.bankAccounts || []).length > 3 ? { level: 'warn', message: '예금 계좌가 3개를 넘어요. 나머지는 별지로 붙여 주세요.' } : null,
    code === 'D5113' && !(d.stayCases || []).length ? { level: 'warn', message: '중지할 압류 사건 정보가 없어요. 상대방·사건번호 칸을 한글에서 채워 주세요.' } : null,
    !caseNo(d) && code !== 'D5100' ? { level: 'warn', message: '사건번호가 아직 없어요. 접수 전 서류면 그대로 두고, 접수 뒤 서류면 사건번호를 먼저 등록하세요.' } : null,
  ]);
}

export async function buildFilledCourtForm(code: FilledFormCode, d: CourtFilingMasterData, rrn: string) {
  const g = courtFormGuard(code, d, rrn);
  if (!g.ok) return { ok: false as const, issues: g.blocks, warns: g.warns };
  const tpl = await fetchTemplate(FILLED_FORMS[code].path);
  const r = await buildHwpx(tpl, courtFormEdits(code, d, rrn));
  const miss = guard.missingAnchors(r.missing);
  if (!r.ok || !r.bytes) return { ok: false as const, issues: [{ level: 'block' as const, message: r.error || 'HWPX를 만들지 못했어요.' }], warns: g.warns };
  if (miss) return { ok: false as const, issues: [miss], warns: g.warns };
  return { ok: true as const, bytes: r.bytes, warns: g.warns, fileName: `${FILLED_FORMS[code].order.toString().padStart(2, '0')}_${FILLED_FORMS[code].title.replace(/[\\/:*?"<>|()\s]+/g, '')}.hwpx` };
}
