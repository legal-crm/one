// CP949(확장 완성형) 인코더 — 전자소송 채권자 CSV는 CP949여야 한다 (H-9)
// 브라우저 TextDecoder('euc-kr')는 WHATWG 표준상 windows-949(CP949)로 해석하므로,
// 두 바이트 코드 전부를 한 번 풀어 '글자 → 바이트' 표를 만들어 쓴다 (처음 한 번만, 약 2만 4천 칸).
let table: Map<string, number> | null = null;

function buildTable(): Map<string, number> {
  const dec = new TextDecoder('euc-kr', { fatal: false });
  const m = new Map<string, number>();
  const buf = new Uint8Array(2);
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x41; trail <= 0xfe; trail++) {
      if ((trail > 0x5a && trail < 0x61) || (trail > 0x7a && trail < 0x81)) continue;
      buf[0] = lead; buf[1] = trail;
      const ch = dec.decode(buf);
      if (ch.length === 1 && ch !== '\uFFFD' && !m.has(ch)) m.set(ch, (lead << 8) | trail);
    }
  }
  return m;
}

/** 글자를 CP949 바이트로. 바꿀 수 없는 글자는 '?'로 두고 목록으로 돌려준다 */
export function encodeCp949(text: string): { bytes: Uint8Array; unmappable: string[] } {
  if (!table) table = buildTable();
  const out: number[] = [];
  const bad = new Set<string>();
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) { out.push(code); continue; }
    const v = table.get(ch);
    if (v === undefined) { out.push(0x3f); bad.add(ch); continue; }
    out.push(v >> 8, v & 0xff);
  }
  return { bytes: new Uint8Array(out), unmappable: Array.from(bad) };
}
