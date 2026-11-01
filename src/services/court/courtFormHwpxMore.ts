// ============================================================
// 법원 양식 HWPX 채움 2·3묶음 (H-1): 회생 부속 신청서 · 파산·면책
//  * SVC   송달장소 및 송달영수인 신고서
//  * D5108 개인회생재단에 속하지 않는 재산목록 제출서 (압류금지 재산: 예금·보장성 보험·퇴직금 공제분)
//  * D5109 면제재산 결정신청서 (주거용 임차보증금)
//  * DISCH 개인회생 면책신청서 (변제 완료 뒤)
//  * BKP   파산 및 면책 신청서 (서울회생법원 실무준칙 제407호 별지 제1호)
//  위치는 public/court-forms/hwpx 양식의 원래 글 덩어리 기준 — 못 찾으면 출력 전 검사가 막는다.
//  값을 모르는 칸은 원래 빈칸을 그대로 둔다(지어낸 값 없음). 면책신청서 날짜는 접수할 때 적도록 비운다.
// ============================================================
import type { CourtFilingMasterData } from '../documents/courtFilingEngine';
import type { HwpxEdit } from './hwpxBuilder';

const won = (n?: number) => (Number.isFinite(n) ? `${Math.round(n as number).toLocaleString('ko-KR')}` : '');
const rrnFmt = (rrn: string) => { const d = rrn.replace(/\D/g, ''); return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : ''; };
const ymdDots = (s?: string) => {
  if (!s) return '';
  const m = s.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : s;
};
const court = (d: CourtFilingMasterData) => (d.court.courtName || '').trim();
const caseNo = (d: CourtFilingMasterData) => {
  const c = d.court;
  return c.caseNumber ? `${c.caseYear || ''}${c.caseType || '개회'}${c.caseNumber}` : '';
};
const keep = (value: string, orig: string) => (value ? value : orig);

// ── 송달장소 및 송달영수인 신고서 ──
export function svc(d: CourtFilingMasterData): HwpxEdit[] {
  const n = caseNo(d);
  return [
    { kind: 'text', label: '사건', find: '사   건    ○○○', replace: n ? `사   건    ${n} 개인회생` : '사   건    ○○○' },
    { kind: 'text', label: '신청인', find: '신 청 인   ○○○', replace: `신 청 인   ${d.debtor.name}` },
    { kind: 'text', label: '송달장소', find: '    송달장소 : ', replace: `    송달장소 : ${d.debtor.serviceAddress || d.debtor.currentAddress || ''}` },
    { kind: 'text', label: '송달영수인', find: '    송달영수인 : ', replace: `    송달영수인 : ${d.debtor.serviceRecipient || ''}` },
    { kind: 'text', label: '작성일', find: '                           20○○.   ○.   ○.', replace: keep(d.court.applicationDate ? `                           ${ymdDots(d.court.applicationDate)}` : '', '                           20○○.   ○.   ○.') },
    { kind: 'text', label: '신청인 서명', find: '위  신청인   ○   ○   ○  (서명 또는 날인)', replace: `위  신청인   ${d.debtor.name}  (서명 또는 날인)` },
    { kind: 'text', label: '관할 법원', find: '○○법원 ○○지원     귀중', replace: court(d) ? `${court(d)}     귀중` : '○○법원 ○○지원     귀중' },
  ];
}

/** D5108 표에 넣을 압류금지 재산 (계산 엔진이 공제한 금액만, 0원이면 넣지 않음) */
export function exemptAssetRows(d: CourtFilingMasterData): string[][] {
  const a: any = d.assets || {};
  const rows: Array<[string, string, number, string, string]> = [];
  if ((a.bankDeduction || 0) > 0) rows.push(['예금채권 중 압류금지 부분', '', a.bankDeduction, '민사집행법 제246조 제1항 제8호, 같은 법 시행령 제7조', '예금 잔액 증명서']);
  if ((a.insuranceDeduction || 0) > 0) rows.push(['보장성 보험 해약환급금 중 압류금지 부분', '', a.insuranceDeduction, '민사집행법 제246조 제1항 제7호, 같은 법 시행령 제6조', '해약환급금 예상액 확인서']);
  const sv = a.severancePay || {};
  if ((sv.exemptAmount || 0) > 0) rows.push([`퇴직금 중 2분의 1${sv.company ? ` (${sv.company})` : ''}`, '', sv.exemptAmount, '민사집행법 제246조 제1항 제5호', '퇴직금 예상액 확인서']);
  return rows.map((r, i) => [String(i + 1), r[0], r[1], `${won(r[2])}원`, r[3], r[4]]);
}

// ── D5108 개인회생재단에 속하지 않는 재산목록 제출서 ──
export function d5108(d: CourtFilingMasterData): HwpxEdit[] {
  const n = caseNo(d);
  const e: HwpxEdit[] = [
    { kind: 'text', label: '사건', find: '사         건    20   개회        개인회생', replace: n ? `사         건    ${n}  개인회생` : '사         건    20   개회        개인회생' },
    { kind: 'text', label: '신청인', find: '신청인(채무자)   ', replace: `신청인(채무자)   ${d.debtor.name}` },
    { kind: 'text', label: '작성일', find: '20  .    .     .', replace: ymdDots(d.court.applicationDate) || '20  .    .     .' },
    { kind: 'text', label: '신청인 서명', find: '신청인(채무자)          ', replace: `신청인(채무자)   ${d.debtor.name}   ` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
  exemptAssetRows(d).slice(0, 3).forEach((row, i) => {
    row.forEach((text, col) => e.push({ kind: 'cell', table: 0, row: i + 1, col, text, label: `압류금지 재산 ${i + 1}행` }));
  });
  return e;
}

// ── D5109 면제재산 결정신청서 (주거용 임차보증금) ──
export function d5109(d: CourtFilingMasterData): HwpxEdit[] {
  const n = caseNo(d);
  const l: any = (d.assets as any)?.leaseDeposit || {};
  const exempt = (l.exemptDeposit || 0) > 0;
  const e: HwpxEdit[] = [
    { kind: 'text', label: '사건', find: '사         건    20   개회        개인회생', replace: n ? `사         건    ${n}  개인회생` : '사         건    20   개회        개인회생' },
    { kind: 'text', label: '신청인', find: '신청인(채무자)   ', replace: `신청인(채무자)   ${d.debtor.name}` },
    { kind: 'text', label: '작성일', find: '20  .    .     .', replace: ymdDots(d.court.applicationDate) || '20  .    .     .' },
    { kind: 'text', label: '신청인 서명', find: '신청인(채무자)                 (서명 또는 날인)', replace: `신청인(채무자)   ${d.debtor.name}   (서명 또는 날인)` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
  if (exempt) {
    e.push(
      { kind: 'text', label: '임차보증금 신청 표시', find: ' □ 1. 주거용건물 임차보증금반환청구권에 대한 면제재산결정 신청 ', replace: ' ■ 1. 주거용건물 임차보증금반환청구권에 대한 면제재산결정 신청 ' },
      { kind: 'text', label: '면제재산 금액', find: '금                 원', replace: `금 ${won(l.exemptDeposit)} 원` },
    );
    if (l.address) e.push({ kind: 'text', label: '임차목적물 소재지', find: ' ③임차목적물의 소재지(                              )', replace: ` ③임차목적물의 소재지( ${l.address} )` });
    if ((l.deposit || 0) > 0) e.push({ kind: 'text', label: '임차보증금', find: ' ④임차보증금     (                                원)', replace: ` ④임차보증금     ( ${won(l.deposit)}원)` });
  }
  return e;
}

// ── 개인회생 면책신청서 ──
export function discharge(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const n = caseNo(d);
  const bank = (d.debtor.refundBank || '').replace(/은행$/, '');
  return [
    { kind: 'text', label: '사건', find: '사         건     20    개회        개인회생', replace: n ? `사         건     ${n}  개인회생` : '사         건     20    개회        개인회생' },
    { kind: 'text', label: '신청인 성명', find: '신청인(채무자)     성    명:           (주민등록번호         -         )', replace: `신청인(채무자)     성    명: ${d.debtor.name}  (주민등록번호 ${rrnFmt(rrn)})` },
    { kind: 'text', label: '주소', find: '                  주    소:', replace: `                  주    소: ${d.debtor.residentAddress || d.debtor.currentAddress || ''}` },
    { kind: 'text', label: '전화번호', find: '                  전화번호:', replace: `                  전화번호: ${d.debtor.phone || ''}` },
    { kind: 'text', label: '환급계좌', find: '                  환급계좌:      은행    지점(계좌번호:              ) ',
      replace: bank || d.debtor.refundAccount ? `                  환급계좌: ${bank ? `${bank}은행` : '      은행'}    지점(계좌번호: ${d.debtor.refundAccount || ''}) ` : '                  환급계좌:      은행    지점(계좌번호:              ) ' },
    { kind: 'text', label: '신청인 서명', find: ' 신청인(채무자)              (서명 또는 날인)', replace: ` 신청인(채무자)   ${d.debtor.name}   (서명 또는 날인)` },
    { kind: 'text', label: '연락처', find: '               연락 가능한 전화번호:             ', replace: `               연락 가능한 전화번호: ${d.debtor.phone || ''}` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
}

// ── 파산 및 면책 신청서 (별지 제1호) ──
export function bankruptcyPetition(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const debtor = d.debtor;
  const resident = debtor.residentAddress || debtor.currentAddress || '';
  const other = debtor.currentAddress && debtor.currentAddress !== debtor.residentAddress ? debtor.currentAddress : '';
  return [
    { kind: 'text', label: '신청인 성명', find: '           ', replace: `  ${debtor.name}  `, occurrence: 0 },
    { kind: 'text', label: '주민등록번호', find: '(주민등록번호 :         -            )', replace: `(주민등록번호 : ${rrnFmt(rrn)})` },
    { kind: 'text', label: '주소', find: '주  소 :                              ', replace: `주  소 : ${resident}  ` },
    { kind: 'text', label: '거소', find: '  거  소 :', replace: `  거  소 : ${other}` },
    { kind: 'text', label: '송달장소', find: '송달장소 :               ', replace: `송달장소 : ${debtor.serviceAddress || ''}  ` },
    { kind: 'text', label: '송달영수인', find: '   송달영수인 :               ', replace: `   송달영수인 : ${debtor.serviceRecipient || ''}  ` },
    { kind: 'text', label: '연락처', find: '  연락처 : 휴대전화(            ),집전화(             ),e-mail(               ) ',
      replace: `  연락처 : 휴대전화(${debtor.phone || '            '}),집전화(${debtor.homePhone || '             '}),e-mail(               ) ` },
    { kind: 'text', label: '문자 알림 휴대전화', find: ' :', replace: ` : ${debtor.phone || ''}` },
    { kind: 'text', label: '문자 알림 신청인', find: '신청인  채무자                     (날인 또는 서명)', replace: `신청인  채무자   ${debtor.name}   (날인 또는 서명)` },
    { kind: 'text', label: '신청일', find: '                      20   .      .      .', replace: d.court.applicationDate ? `                      ${ymdDots(d.court.applicationDate)}` : '                      20   .      .      .' },
    { kind: 'text', label: '신청인 서명', find: '                   신 청 인             ', replace: `                   신 청 인   ${debtor.name}   ` },
    { kind: 'text', label: '관할 법원', find: '◯◯회생(지방)법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '◯◯회생(지방)법원 귀중' },
  ];
}

// ── D5116 소득진술서(영업소득자용) ──
// 상호·업종·영업장 소재지·월평균 소득은 사건 자료(직장 칸·수입) 값, 주요 판매 품목·영업 개시일은 비워 둔다(모르는 값)
export function d5116(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const debtor = d.debtor;
  const monthly = d.repaymentSummary?.monthlyNetIncome || 0;
  const e: HwpxEdit[] = [
    { kind: 'cell', table: 0, row: 0, col: 1, text: debtor.name, label: '성명' },
    { kind: 'cell', table: 0, row: 0, col: 3, text: rrnFmt(rrn), label: '주민등록번호' },
    { kind: 'cell', table: 0, row: 1, col: 1, text: debtor.residentAddress || debtor.currentAddress || '', label: '주소' },
    { kind: 'cell', table: 0, row: 1, col: 3, text: debtor.phone || '', label: '전화번호' },
    { kind: 'cell', table: 0, row: 2, col: 1, text: debtor.workplaceName || '', label: '상호명' },
    { kind: 'cell', table: 0, row: 2, col: 3, text: debtor.jobTitle || '', label: '업종' },
    { kind: 'cell', table: 0, row: 4, col: 1, text: debtor.workplaceAddress || '', label: '영업장 소재지' },
    { kind: 'text', label: '작성일', find: '20  .   .   .', replace: ymdDots(d.court.applicationDate) || '20  .   .   .' },
    { kind: 'text', label: '신청인 서명', find: ' 신청인           ', replace: ` 신청인   ${debtor.name}   ` },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
  if (monthly > 0) {
    e.push({ kind: 'text', label: '월평균 사업소득', find: '본인은      년    월   일부터 월평균 (          )원의 ', replace: `본인은      년    월   일부터 월평균 ( ${won(monthly)} )원의 ` });
  }
  return e;
}

// ── D5122 변제계획 변경안 제출서 (인가 뒤) ──
// 본문 두 문단은 양식의 예시 사유(급여 삭감)라 그대로 두고, 변호사가 실제 사유로 고친다(출력 전 경고)
export function d5122(d: CourtFilingMasterData): HwpxEdit[] {
  const n = caseNo(d);
  const lawyer = (d.lawyer?.lawyerName || '').replace(/\s*변호사$/, '');
  return [
    { kind: 'text', label: '사건', find: '사    건      20  개회      개인회생', replace: n ? `사    건      ${n}  개인회생` : '사    건      20  개회      개인회생' },
    { kind: 'text', label: '채무자', find: '채 무 자     ', replace: `채 무 자     ${d.debtor.name}` },
    { kind: 'text', label: '대리인', find: '변호사               ', replace: lawyer ? `변호사   ${lawyer}   ` : '변호사               ' },
    { kind: 'text', label: '채무자 서명', find: '                 채무자         ', replace: `                 채무자   ${d.debtor.name}   ` },
    { kind: 'text', label: '대리인 서명', find: '                 대리인 변호사                (서명 또는 날인)', replace: lawyer ? `                 대리인 변호사   ${lawyer}   (서명 또는 날인)` : '                 대리인 변호사                (서명 또는 날인)' },
    { kind: 'text', label: '관할 법원', find: '법원 귀중', replace: court(d) ? `${court(d)} 귀중` : '법원 귀중' },
  ];
}

// ── 면책신청서 (파산 따로 신청한 뒤 면책만 신청할 때, 서울회생법원 실무준칙 별지 제10호) ──
// 파산 및 면책 동시 신청(BKP)을 했다면 내지 않는다. 파산선고 사건번호(하단)가 사건 정보에 있으면 신청 이유에 넣고,
// 선고일·면책 사건번호(하면)는 사건 자료에 없어 원래 빈칸을 둔다(출력 전 경고)
export function bankruptcyDischargeOnly(d: CourtFilingMasterData, rrn: string): HwpxEdit[] {
  const debtor = d.debtor;
  const n = caseNo(d);
  const bkNo = /하단/.test(n) ? n : '';
  const resident = debtor.residentAddress || debtor.currentAddress || '';
  const other = debtor.currentAddress && debtor.currentAddress !== debtor.residentAddress ? debtor.currentAddress : '';
  const reasonOrig = ' 신청인은 귀원 20○○하단○○○호 파산선고 사건에서 20○○. ○. ○. 파산선고결정을 받고 면책결정을 받기 위하여 이 사건 신청에 이르렀습니다.';
  return [
    { kind: 'text', label: '신청인 성명', find: '        ', replace: `  ${debtor.name}  `, occurrence: 0 },
    { kind: 'text', label: '주민등록번호', find: '(주민등록번호 :         -          )', replace: `(주민등록번호 : ${rrnFmt(rrn)})` },
    { kind: 'text', label: '주소', find: '주  소 :                                    ', replace: `주  소 : ${resident}  ` },
    { kind: 'text', label: '거소', find: '  거  소 :                                                        ', replace: `  거  소 : ${other}  ` },
    { kind: 'text', label: '송달장소', find: '송달장소 :                          ', replace: `송달장소 : ${debtor.serviceAddress || ''}  ` },
    { kind: 'text', label: '송달영수인', find: '   송달영수인 :            ', replace: `   송달영수인 : ${debtor.serviceRecipient || ''}  ` },
    { kind: 'text', label: '연락처', find: '연락처 : 휴대전화(                ), 집전화(                 ), e-mail(                )',
      replace: `연락처 : 휴대전화(${debtor.phone || '                '}), 집전화(${debtor.homePhone || '                 '}), e-mail(                )` },
    { kind: 'text', label: '신청 이유', find: reasonOrig, replace: bkNo ? reasonOrig.replace('20○○하단○○○호', `${bkNo}호`) : reasonOrig },
    { kind: 'text', label: '문자 알림 휴대전화', find: ' :', replace: ` : ${debtor.phone || ''}` },
    { kind: 'text', label: '문자 알림 신청인', find: '신청인  채무자                       (날인 또는 서명)', replace: `신청인  채무자   ${debtor.name}   (날인 또는 서명)` },
    { kind: 'text', label: '신청인 서명', find: '                신 청 인            ', replace: `                신 청 인   ${debtor.name}   ` },
    { kind: 'text', label: '관할 법원', find: '◯◯회생(지방)법원     귀중', replace: court(d) ? `${court(d)}     귀중` : '◯◯회생(지방)법원     귀중' },
    { kind: 'text', label: '진술서 법원', find: '◯◯지방법원    귀중', replace: court(d) ? `${court(d)}    귀중` : '◯◯지방법원    귀중' },
    { kind: 'text', label: '진술서 신청인', find: '                                           신청인(채무자)              (인)  ', replace: `                                           신청인(채무자)   ${debtor.name}   (인)  ` },
  ];
}
