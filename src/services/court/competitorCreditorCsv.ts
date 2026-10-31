// ============================================================
// 다른 프로그램 채권자 CSV 읽기 (NF-10)
// 디던비·로패스·전자소송 형식(회생 13열 당사자형 CP949 / 파산 18열 UTF-8 BOM)을 머리글 이름으로 읽는다.
// 열 순서가 달라도 머리글로 찾고, 모르는 열은 버린다. 주민등록번호 형식이 보이면 그 칸은 버린다(L8).
// ============================================================

export interface ImportedCreditorRow {
  name: string;
  address: string;
  zipCode: string;
  phone: string;
  fax: string;
  /** 원 단위 (없으면 undefined) */
  principal?: number;
  interest?: number;
  cause?: string;
  borrowedOn?: string;
  personType?: string;
}

export interface CreditorCsvParse {
  rows: ImportedCreditorRow[];
  format: 'rehab13' | 'bankruptcy18' | 'other';
  encoding: 'utf-8' | 'euc-kr';
  warnings: string[];
}

/** 바이트 → 글자 (BOM이 있거나 UTF-8로 깨지지 않으면 UTF-8, 아니면 EUC-KR/CP949) */
export function decodeCsvBytes(buf: ArrayBuffer): { text: string; encoding: 'utf-8' | 'euc-kr' } {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(u8.subarray(3)), encoding: 'utf-8' };
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(u8);
  if (!utf.includes('\uFFFD')) return { text: utf, encoding: 'utf-8' };
  return { text: new TextDecoder('euc-kr').decode(u8), encoding: 'euc-kr' };
}

/** 따옴표를 처리하는 CSV 나누기 */
export function splitCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(c => c.trim() !== ''));
}

const RRN = /\d{6}\s*-?\s*[1-8]\d{6}/;
const toWon = (s: string): number | undefined => {
  const d = String(s || '').replace(/[^0-9.-]/g, '');
  if (!d) return undefined;
  const n = Math.round(Number(d));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseCreditorCsvText(text: string, encoding: 'utf-8' | 'euc-kr' = 'utf-8'): CreditorCsvParse {
  const warnings: string[] = [];
  const table = splitCsv(text);
  const headerIdx = table.findIndex(r => r.some(c => c.replace(/\s/g, '') === '채권자명'));
  if (headerIdx < 0) return { rows: [], format: 'other', encoding, warnings: ['머리글에 \'채권자명\' 열이 없어요. 전자소송·디던비·로패스에서 내려받은 채권자 CSV인지 확인해 주세요.'] };
  const head = table[headerIdx].map(h => h.replace(/\s/g, ''));
  const col = (...names: RegExp[]) => head.findIndex(h => names.some(n => n.test(h)));
  const c = {
    name: col(/^채권자명$/),
    addr1: col(/^도로명주소1/, /^주소$/, /^주소1/),
    addr2: col(/^도로명주소2/, /^상세주소/, /^주소2/),
    zip: col(/^우편번호/),
    mobile: col(/^휴대전화/),
    phone: col(/^전화번호/),
    fax: col(/^팩스/),
    person: col(/^인격구분/),
    principal: col(/^잔존원금/, /^원금/, /^채권현재액\(원금\)/),
    interest: col(/^잔존이자/, /^이자/),
    cause: col(/^발생원인/, /^채권의원인/),
    date: col(/^차용또는구입일자/, /^차용일/, /^대출일/),
  };
  const format: CreditorCsvParse['format'] = head.length >= 18 && c.cause >= 0 ? 'bankruptcy18' : head.length === 13 ? 'rehab13' : 'other';
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const rows: ImportedCreditorRow[] = [];
  let droppedRrn = 0;
  table.slice(headerIdx + 1).forEach((r, k) => {
    const clean = (v: string) => { if (RRN.test(v)) { droppedRrn++; return ''; } return v; };
    const name = clean(get(r, c.name));
    if (!name) { if (r.some(x => x.trim())) warnings.push(`${k + 1}번째 줄: 채권자명이 없어 건너뛰었어요.`); return; }
    rows.push({
      name: name.slice(0, 120),
      address: clean([get(r, c.addr1), get(r, c.addr2)].filter(Boolean).join(', ')).slice(0, 200),
      zipCode: get(r, c.zip).replace(/[^0-9]/g, '').slice(0, 5),
      phone: clean(get(r, c.mobile) || get(r, c.phone)).slice(0, 30),
      fax: clean(get(r, c.fax)).slice(0, 30),
      principal: toWon(get(r, c.principal)),
      interest: toWon(get(r, c.interest)),
      cause: clean(get(r, c.cause)).slice(0, 60) || undefined,
      borrowedOn: get(r, c.date) || undefined,
      personType: get(r, c.person) || undefined,
    });
  });
  if (droppedRrn > 0) warnings.push(`주민등록번호 형식이 있는 칸 ${droppedRrn}개는 가져오지 않았어요.`);
  if (rows.length === 0) warnings.push('가져올 채권자 줄이 없어요.');
  return { rows, format, encoding, warnings };
}

export async function parseCreditorCsvFile(file: File): Promise<CreditorCsvParse> {
  if (file.size > 2 * 1024 * 1024) return { rows: [], format: 'other', encoding: 'utf-8', warnings: ['파일이 너무 커요(2MB 넘음).'] };
  const { text, encoding } = decodeCsvBytes(await file.arrayBuffer());
  return parseCreditorCsvText(text, encoding);
}
