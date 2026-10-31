// ============================================================
// FE-9 거래내역 파일 대조 — 브라우저에서만 읽는다 (원본 파일은 서버로 보내지 않음)
//  입금 줄 → 회차 후보(금액·입금자 이름) 제안 → 사람이 확인한 줄만 record_fee_bank_import
// ============================================================
import * as XLSXRead from 'xlsx';
import { parseCsv, statementToT2Rows } from '../corrections/bankStatementParse';
import type { FeeOverviewRow } from './feeService';

export interface BankDeposit { date: string; amount: number; payer: string; hash: string }
export interface DepositCandidate { caseId: string; label: string; score: number; reason: string }

export async function readStatementTable(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) text = new TextDecoder('euc-kr').decode(buf); // 국내 은행 CSV는 대개 CP949
    return parseCsv(text.replace(/^\uFEFF/, ''));
  }
  const wb = XLSXRead.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSXRead.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][];
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 입금 줄만. 같은 날·같은 금액·같은 입금자가 여러 줄이면 순번으로 지문을 나눈다 (같은 파일을 다시 올려도 같은 지문) */
export async function depositsFromTable(table: unknown[][], officeId: string): Promise<{ deposits: BankDeposit[]; headerFound: boolean }> {
  const r = statementToT2Rows(table, 1, '');
  const seen = new Map<string, number>();
  const out: BankDeposit[] = [];
  for (const row of r.rows) {
    if (row.direction !== '입금') continue;
    const amount = Number(row.amount) || 0;
    const payer = row.counterparty.split(' / ')[0].trim().slice(0, 40);
    const base = `${row.date}|${amount}|${payer}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    out.push({ date: row.date, amount, payer, hash: await sha256Hex(`${officeId}|${base}|${n}`) });
  }
  return { deposits: out, headerFound: r.headerFound };
}

const squash = (s: string) => s.replace(/[\s()·.\-_]/g, '').replace(/(님|씨|고객)$/, '');

/** 후보 점수: 다음 회차 금액과 같으면 3, 남은 금액·기한 지난 금액과 같으면 2, 입금자 이름이 사건 이름과 겹치면 3 */
export function candidatesFor(dep: BankDeposit, rows: FeeOverviewRow[]): DepositCandidate[] {
  const payer = squash(dep.payer);
  const out: DepositCandidate[] = [];
  for (const r of rows) {
    if (r.remainingWon <= 0) continue;
    let score = 0;
    const why: string[] = [];
    if (r.nextDueWon && dep.amount === r.nextDueWon) { score += 3; why.push('다음 회차 금액'); }
    else if (dep.amount === r.overdueWon || dep.amount === r.remainingWon) { score += 2; why.push(dep.amount === r.overdueWon ? '밀린 금액' : '남은 금액'); }
    else if (dep.amount > r.remainingWon) continue;
    const name = squash(r.clientDisplayName || '');
    if (payer && name && name.length >= 2 && (payer.includes(name) || name.includes(payer))) { score += 3; why.push('입금자 이름'); }
    if (score > 0) out.push({ caseId: r.caseId, label: `${r.clientDisplayName || r.caseTitle || '사건'} · 남은 ${r.remainingWon.toLocaleString('ko-KR')}원`, score, reason: why.join('·') });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
