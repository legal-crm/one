// ============================================================
// 통장 거래내역 표 → T2 '큰 금액 입출금 사용처' 줄 (CR-11)
// 은행 인터넷뱅킹에서 내려받은 엑셀·CSV 표를 읽어 기준 금액 이상인 입출금만 고른다.
// 외부 AI를 쓰지 않는다. 머리글(거래일·출금·입금·적요·상대)을 찾아 칸을 맞춘다.
// 사용처·받은 이유 칸은 비워 둔다 — 의뢰인이 채운다. 사무소가 확인한 뒤 의뢰인에게 요청한다.
// ============================================================

export interface T2Row { account: string; date: string; direction: '입금' | '출금'; amount: string; counterparty: string; use: string; proof: string }

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').trim();

const HEAD = {
  date: [/거래일(자|시)?/, /^일자$/, /거래일시/, /^날짜$/],
  out: [/출금(액|금액)?/, /찾으신(금액)?/, /지급(액|금액)?/],
  in: [/입금(액|금액)?/, /맡기신(금액)?/],
  amount: [/^거래금액$/, /^금액$/],
  kind: [/^구분$/, /입출금구분/, /거래구분/],
  memo: [/적요/, /거래내용/, /기재내용/, /^내용$/, /메모/],
  party: [/상대(방|계좌예금주명|예금주)?/, /받는분/, /보낸분/, /의뢰인/, /거래처/],
};

function findCol(header: string[], pats: RegExp[], skip: number[] = []): number {
  for (let i = 0; i < header.length; i++) {
    if (skip.includes(i)) continue;
    if (pats.some(p => p.test(header[i]))) return i;
  }
  return -1;
}

export function parseAmount(v: unknown): number {
  const s = String(v ?? '').replace(/[,\s원]/g, '');
  if (!s || s === '-') return 0;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.round(Math.abs(n)) : 0;
}

export function parseDate(v: unknown): string {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // 엑셀 날짜 일련번호
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = String(v ?? '').match(/(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

/**
 * @param table 표(첫 몇 줄 안에 머리글이 있어야 함)
 * @param threshold 기준 금액(원) 이상만
 * @param account 계좌 표시(은행·끝 4자리)
 */
export function statementToT2Rows(table: unknown[][], threshold: number, account: string): { rows: T2Row[]; headerFound: boolean; scanned: number } {
  let hi = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const h = (table[i] || []).map(norm);
    const hasDate = findCol(h, HEAD.date) >= 0;
    const hasMoney = findCol(h, HEAD.out) >= 0 || findCol(h, HEAD.in) >= 0 || findCol(h, HEAD.amount) >= 0;
    if (hasDate && hasMoney) { hi = i; header = h; break; }
  }
  if (hi < 0) return { rows: [], headerFound: false, scanned: 0 };
  const cDate = findCol(header, HEAD.date);
  const cOut = findCol(header, HEAD.out);
  const cIn = findCol(header, HEAD.in, [cOut]);
  const cAmt = cOut < 0 && cIn < 0 ? findCol(header, HEAD.amount) : -1;
  const cKind = findCol(header, HEAD.kind);
  const cMemo = findCol(header, HEAD.memo);
  const cParty = findCol(header, HEAD.party, [cMemo]);

  const rows: T2Row[] = [];
  let scanned = 0;
  for (const r of table.slice(hi + 1)) {
    if (!r || r.length === 0) continue;
    const date = parseDate(r[cDate]);
    if (!date) continue;
    scanned += 1;
    const party = [cParty >= 0 ? String(r[cParty] ?? '').trim() : '', cMemo >= 0 ? String(r[cMemo] ?? '').trim() : ''].filter(Boolean);
    const push = (direction: '입금' | '출금', amount: number) => {
      if (amount >= threshold) rows.push({ account, date, direction, amount: String(amount), counterparty: Array.from(new Set(party)).join(' / ').slice(0, 80), use: '', proof: '' });
    };
    if (cAmt >= 0) {
      const k = cKind >= 0 ? String(r[cKind] ?? '') : '';
      push(/입금|맡기/.test(k) ? '입금' : '출금', parseAmount(r[cAmt]));
    } else {
      if (cOut >= 0) push('출금', parseAmount(r[cOut]));
      if (cIn >= 0) push('입금', parseAmount(r[cIn]));
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows: rows.slice(0, 300), headerFound: true, scanned };
}

/** CSV 글 → 표 (따옴표 처리) */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}
