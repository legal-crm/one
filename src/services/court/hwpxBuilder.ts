// ============================================================
// HWPX 빌더 (H-2) — 법원 원본 양식(HWPX)에 값을 채운다. 브라우저에서만 만들고 서버로 보내지 않는다.
//  * 대법원 양식에는 {{자리표시자}}도 쓸 수 있는 누름틀도 거의 없어서, 두 방식으로 채운다
//    - text: 양식에 원래 있는 글 한 덩어리(<hp:t>)를 찾아 새 글로 바꾼다 (빈칸이 공백으로 된 1장짜리 양식)
//    - cell: n번째 표의 (행, 열) 칸 첫 글에 값을 넣는다 (표 양식)
//    - rows: 표의 견본 행을 데이터 수만큼 복제한다 (채권자·재산 목록)
//  * 찾지 못한 위치는 결과의 missing에 남겨 출력 전 검사(CourtDocGuard)가 막는다 — 양식이 바뀌면 바로 드러난다
//  * 조판 캐시(linesegarray)는 지워 한글이 열 때 다시 줄을 나누게 한다
// ============================================================
import JSZip from 'jszip';

export type HwpxEdit =
  | { kind: 'text'; find: string; replace: string; /** 같은 글이 여러 번이면 몇 번째(0부터), 없으면 전부 */ occurrence?: number; label?: string }
  | { kind: 'cell'; table: number; row: number; col: number; text: string; label?: string }
  | { kind: 'rows'; table: number; templateRow: number; rows: string[][]; label?: string }
  /** n번째 표가 든 문단을 times번 복제해 바로 뒤에 넣는다 (채권자가 양식 칸보다 많을 때). 복제한 표는 n+1, n+2… 번째 표가 된다 */
  | { kind: 'cloneTable'; table: number; times: number; label?: string };

export interface HwpxBuildResult {
  ok: boolean;
  blob: Blob | null;
  bytes: Uint8Array | null;
  applied: number;
  /** 찾지 못한 위치 (label 또는 찾을 글) */
  missing: string[];
  error?: string;
}

export function escapeXml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const unescapeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** <hp:t>…</hp:t> 안의 글자(태그 제외) */
function plainOf(inner: string): string {
  return unescapeXml(inner.replace(/<hp:fwSpace\/>/g, ' ').replace(/<[^>]+>/g, ''));
}

/** text 편집: 원래 글이 같은 <hp:t>의 내용을 바꾼다 */
export function replaceTextRun(xml: string, find: string, replace: string, occurrence?: number): { xml: string; count: number } {
  let idx = -1;
  let count = 0;
  const out = xml.replace(/<hp:t(\s[^>]*)?>([\s\S]*?)<\/hp:t>/g, (whole, attrs = '', inner) => {
    if (plainOf(inner) !== find) return whole;
    idx += 1;
    if (occurrence !== undefined && idx !== occurrence) return whole;
    count += 1;
    // 앞쪽 탭(<hp:tab/>)은 남겨 줄 맞춤을 지킨다
    const lead = (inner.match(/^(?:<hp:tab\b[^>]*\/>)+/) || [''])[0];
    return `<hp:t${attrs}>${lead}${escapeXml(replace)}</hp:t>`;
  });
  return { xml: out, count };
}

/** n번째 표(<hp:tbl>)의 시작·끝 위치 (중첩 표는 바깥 표 안에 포함된다) */
function findTable(xml: string, n: number): { start: number; end: number } | null {
  const re = /<hp:tbl\b|<\/hp:tbl>/g;
  let depth = 0;
  let k = -1;
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:tbl>') {
      depth -= 1;
      if (depth === 0 && start >= 0) return { start, end: m.index + m[0].length };
    } else {
      if (depth === 0) { k += 1; if (k === n) start = m.index; }
      depth += 1;
    }
  }
  return null;
}

function setCellInTable(tbl: string, row: number, col: number, text: string): { tbl: string; ok: boolean } {
  const cellRe = /<hp:tc\b[\s\S]*?<\/hp:tc>/g;
  let ok = false;
  const out = tbl.replace(cellRe, (cell) => {
    if (ok) return cell;
    const addr = cell.match(/<hp:cellAddr colAddr="(\d+)" rowAddr="(\d+)"/);
    if (!addr || Number(addr[1]) !== col || Number(addr[2]) !== row) return cell;
    ok = true;
    // 첫 글이 있으면 그 글을, 없으면 첫 run 안에 글을 넣는다
    if (/<hp:t(\s[^>]*)?>[\s\S]*?<\/hp:t>/.test(cell)) {
      let first = true;
      return cell.replace(/<hp:t(\s[^>]*)?>([\s\S]*?)<\/hp:t>/g, (w, attrs = '') => {
        if (!first) return `<hp:t${attrs}></hp:t>`;
        first = false;
        return `<hp:t${attrs}>${escapeXml(text)}</hp:t>`;
      });
    }
    if (/<hp:run\b[^>]*\/>/.test(cell)) {
      return cell.replace(/<hp:run\b([^>]*)\/>/, (_w, attrs) => `<hp:run${attrs}><hp:t>${escapeXml(text)}</hp:t></hp:run>`);
    }
    return cell.replace(/(<hp:run\b[^>]*>)/, `$1<hp:t>${escapeXml(text)}</hp:t>`);
  });
  return { tbl: out, ok };
}

/** 표의 견본 행(templateRow)을 rows 수만큼 복제해 칸마다 값을 넣고, 아래 행 번호를 민다 */
function expandRows(tbl: string, templateRow: number, rows: string[][]): { tbl: string; ok: boolean } {
  const trRe = /<hp:tr\b[\s\S]*?<\/hp:tr>/g;
  const trs = [...tbl.matchAll(trRe)];
  const target = trs.find(t => {
    const a = t[0].match(/<hp:cellAddr colAddr="\d+" rowAddr="(\d+)"/);
    return a && Number(a[1]) === templateRow;
  });
  if (!target || target.index === undefined) return { tbl, ok: false };
  const extra = Math.max(0, rows.length - 1);
  const bump = (s: string, by: number, from: number) =>
    s.replace(/(<hp:cellAddr colAddr="\d+" rowAddr=")(\d+)(")/g, (w, a, r, b) => (Number(r) > from ? `${a}${Number(r) + by}${b}` : w));
  const rowXml = (vals: string[], rowIndex: number) => {
    let colIdx = 0;
    let xml = target[0].replace(/<hp:tc\b[\s\S]*?<\/hp:tc>/g, (cell) => {
      const v = vals[colIdx++] ?? '';
      const { tbl: filled } = setCellInTable(`<x>${cell}</x>`, templateRow, Number(cell.match(/colAddr="(\d+)"/)?.[1] ?? 0), v);
      return filled.slice(3, -4);
    });
    xml = xml.replace(/(<hp:cellAddr colAddr="\d+" rowAddr=")(\d+)(")/g, `$1${rowIndex}$3`);
    return xml;
  };
  const before = tbl.slice(0, target.index);
  const after = bump(tbl.slice(target.index + target[0].length), extra, templateRow);
  const block = (rows.length ? rows : [[]]).map((vals, i) => rowXml(vals, templateRow + i)).join('');
  let out = before + block + after;
  out = out.replace(/(<hp:tbl\b[^>]*rowCnt=")(\d+)(")/, (_w, a, n, b) => `${a}${Number(n) + extra}${b}`);
  return { tbl: out, ok: true };
}

/** 표를 감싼 바깥 문단(<hp:p>…</hp:p>)의 범위 */
function enclosingParagraph(xml: string, tableStart: number): { start: number; end: number } | null {
  // 표 앞쪽에서 아직 닫히지 않은 가장 가까운 <hp:p
  const re = /<hp:p\b|<\/hp:p>/g;
  const stack: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && m.index < tableStart) {
    if (m[0] === '</hp:p>') stack.pop(); else stack.push(m.index);
  }
  if (!stack.length) return null;
  const start = stack[stack.length - 1];
  re.lastIndex = start;
  let depth = 0;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:p>') { depth -= 1; if (depth === 0) return { start, end: m.index + m[0].length }; }
    else depth += 1;
  }
  return null;
}

let cloneSeq = 0;
function cloneTableParagraph(xml: string, table: number, times: number): { xml: string; ok: boolean } {
  const loc = findTable(xml, table);
  if (!loc) return { xml, ok: false };
  const p = enclosingParagraph(xml, loc.start);
  if (!p) return { xml, ok: false };
  const para = xml.slice(p.start, p.end);
  const copies = Array.from({ length: Math.max(0, times) }, () =>
    // 개체 id는 겹치지 않게 새로 (한글이 같은 id를 가진 표를 하나로 보지 않도록)
    para.replace(/(<hp:tbl\b[^>]*\bid=")(\d+)(")/g, (_w, a, id, b) => `${a}${(Number(id) + 100000 + (cloneSeq += 1)) % 2147483647}${b}`),
  ).join('');
  return { xml: xml.slice(0, p.end) + copies + xml.slice(p.end), ok: true };
}

export function applyEditsToSection(xml: string, edits: HwpxEdit[]): { xml: string; applied: number; missing: string[] } {
  let applied = 0;
  const missing: string[] = [];
  for (const e of edits) {
    if (e.kind === 'cloneTable') {
      if (e.times <= 0) continue;
      const r = cloneTableParagraph(xml, e.table, e.times);
      if (!r.ok) missing.push(e.label || `표 ${e.table + 1} 복제`);
      else { xml = r.xml; applied += 1; }
      continue;
    }
    if (e.kind === 'text') {
      const r = replaceTextRun(xml, e.find, e.replace, e.occurrence);
      if (r.count === 0) missing.push(e.label || e.find.trim());
      xml = r.xml;
      applied += r.count;
      continue;
    }
    const loc = findTable(xml, e.table);
    if (!loc) { missing.push(e.label || `표 ${e.table + 1}`); continue; }
    const tbl = xml.slice(loc.start, loc.end);
    const r = e.kind === 'cell' ? setCellInTable(tbl, e.row, e.col, e.text) : expandRows(tbl, (e as any).templateRow, (e as any).rows);
    if (!r.ok) { missing.push(e.label || `표 ${e.table + 1} (${e.kind === 'cell' ? `${e.row},${e.col}` : `행 ${e.templateRow}`})`); continue; }
    xml = xml.slice(0, loc.start) + r.tbl + xml.slice(loc.end);
    applied += 1;
  }
  xml = xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
  return { xml, applied, missing };
}

/** 양식 파일(ArrayBuffer)에 편집을 적용해 새 HWPX를 만든다. 편집은 section0에 적용 (sectionIndex로 바꿀 수 있음) */
export async function buildHwpx(template: ArrayBuffer | Uint8Array, edits: HwpxEdit[], sectionIndex = 0): Promise<HwpxBuildResult> {
  try {
    const zip = await JSZip.loadAsync(template);
    const path = `Contents/section${sectionIndex}.xml`;
    const f = zip.file(path);
    if (!f) return { ok: false, blob: null, bytes: null, applied: 0, missing: [], error: 'HWPX 양식에서 본문(section)을 찾지 못했어요.' };
    const { xml, applied, missing } = applyEditsToSection(await f.async('string'), edits);
    zip.file(path, xml);
    // 미리 보기 글(PrvText)은 빈 양식 글이라 지운다 (탐색기 미리 보기에 빈 양식이 보이지 않게)
    if (zip.file('Preview/PrvText.txt')) zip.remove('Preview/PrvText.txt');
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/hwp+zip' });
    const blob = typeof Blob !== 'undefined' ? new Blob([bytes], { type: 'application/hwp+zip' }) : null;
    return { ok: true, blob, bytes, applied, missing };
  } catch (err) {
    return { ok: false, blob: null, bytes: null, applied: 0, missing: [], error: `HWPX를 만들지 못했어요. (${String(err)})` };
  }
}

export async function fetchTemplate(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`양식 파일을 찾지 못했어요: ${path}`);
  return res.arrayBuffer();
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
