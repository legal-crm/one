// ============================================================
// 카카오톡 '대화 내보내기' 글 파일 해석 (KT-4)
// 형식(카카오톡 버전·기기마다 다름):
//  - PC(윈도):  '--------------- 2026년 10월 1일 목요일 ---------------' + '[홍길동] [오전 10:00] 내용'
//  - 안드로이드: '2026년 10월 1일 오전 10:00, 홍길동 : 내용'
//  - 아이폰:     '2026. 10. 1. 오전 10:00, 홍길동 : 내용'
//  - 맥(CSV):    'Date,User,Message' + '2026-10-01 10:00:00,"홍길동","내용"'
//  - 영어 표시:  '[Hong] [10:00 AM] text', '--------------- Thursday, October 1, 2026 ---------------'
// 여러 줄 메시지는 이어 붙이고, 해석 못 한 줄은 수만 센다(원본 파일이 기준이라 그대로 보관됨).
// 시각은 한국 시간으로 보고 UTC ISO로 바꾼다. 같은 시각·같은 사람·같은 내용은 파일 안 순번(n)으로 구분한다.
// ============================================================
import { parseCsv } from '../corrections/bankStatementParse';

export interface KakaoLine { at: string; sender: string; body: string; n: number }
export interface KakaoParseResult {
  format: 'pc' | 'android' | 'ios' | 'mac_csv' | 'unknown';
  title: string;
  lines: KakaoLine[];
  senders: Array<{ name: string; count: number }>;
  unparsed: number;
  systemLines: number;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function to24(ampm: string | undefined, h: number): number {
  if (!ampm) return h;
  const pm = /오후|pm/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

function kstIso(y: number, mo: number, d: number, h: number, mi: number, s = 0): string | null {
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  const t = new Date(`${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:${p(s)}+09:00`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

// 머리·구분 줄
const RE_TITLE = /^(.+?)\s*님과 카카오톡 대화$/;
const RE_TITLE_EN = /^Talk_.*|^Chat with (.+)$/i;
const RE_SAVED = /^(저장한 날짜|Date Saved)\s*:/i;
// PC 날짜 구분 줄
const RE_PC_DATE = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*?-{3,}\s*$/;
const RE_PC_DATE_EN = /^-{3,}\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*-{3,}\s*$/;
// PC 메시지
const RE_PC_MSG = /^\[([^\]]{1,60})\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s?(.*)$/;
const RE_PC_MSG_EN = /^\[([^\]]{1,60})\]\s*\[(\d{1,2}):(\d{2})\s*(AM|PM)\]\s?(.*)$/i;
// 모바일(안드로이드 '년 월 일' / 아이폰 '. . .') 메시지
const RE_MOBILE_MSG = /^(\d{4})(?:년|\.)\s*(\d{1,2})(?:월|\.)\s*(\d{1,2})(?:일|\.)?\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s:\s?(.*)$/;
const RE_MOBILE_SYS = /^(\d{4})(?:년|\.)\s*(\d{1,2})(?:월|\.)\s*(\d{1,2})(?:일|\.)?\s*(오전|오후)\s*(\d{1,2}):(\d{2})(,.*)?$/;
const RE_MOBILE_DATE = /^(\d{4})(?:년|\.)\s*(\d{1,2})(?:월|\.)\s*(\d{1,2})(?:일|\.)?\s*(?:[가-힣]요일)?$/;

export function parseKakaoExport(raw: string): KakaoParseResult {
  const text = (raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const out: Array<Omit<KakaoLine, 'n'>> = [];
  let unparsed = 0;
  let systemLines = 0;
  let title = '';
  let format: KakaoParseResult['format'] = 'unknown';

  const firstLine = text.split('\n', 1)[0].trim();
  if (/^"?Date"?,"?User"?,"?Message"?$/i.test(firstLine)) {
    format = 'mac_csv';
    const rows = parseCsv(text).slice(1);
    for (const r of rows) {
      if (!r || r.length < 3 || r.every(c => !String(c).trim())) continue;
      const m = String(r[0]).match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const at = m ? kstIso(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
      const sender = String(r[1] || '').trim();
      const body = r.slice(2).join(',').trim();
      if (!at || !sender) { unparsed += 1; continue; }
      out.push({ at, sender: sender.slice(0, 60), body: body.slice(0, 2000) });
    }
  } else {
    let curDate: { y: number; m: number; d: number } | null = null;
    let last: Omit<KakaoLine, 'n'> | null = null;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t) { if (last) last.body += '\n'; continue; }
      if (i < 3) {
        const tm = t.match(RE_TITLE) || t.match(RE_TITLE_EN);
        if (tm) { title = (tm[1] || '').trim(); continue; }
        if (RE_SAVED.test(t)) continue;
      }
      let m = t.match(RE_PC_DATE);
      if (m) { curDate = { y: +m[1], m: +m[2], d: +m[3] }; last = null; format = 'pc'; continue; }
      m = t.match(RE_PC_DATE_EN);
      if (m && MONTHS[m[1].toLowerCase()]) { curDate = { y: +m[3], m: MONTHS[m[1].toLowerCase()], d: +m[2] }; last = null; format = 'pc'; continue; }
      m = t.match(RE_PC_MSG);
      if (m && curDate) {
        const at = kstIso(curDate.y, curDate.m, curDate.d, to24(m[2], +m[3]), +m[4]);
        if (at) { last = { at, sender: m[1].trim(), body: m[5] }; out.push(last); format = 'pc'; continue; }
      }
      m = t.match(RE_PC_MSG_EN);
      if (m && curDate) {
        const at = kstIso(curDate.y, curDate.m, curDate.d, to24(m[4], +m[2]), +m[3]);
        if (at) { last = { at, sender: m[1].trim(), body: m[5] }; out.push(last); format = 'pc'; continue; }
      }
      m = t.match(RE_MOBILE_MSG);
      if (m) {
        const at = kstIso(+m[1], +m[2], +m[3], to24(m[4], +m[5]), +m[6]);
        if (at) {
          last = { at, sender: m[7].trim().slice(0, 60), body: m[8] };
          out.push(last);
          if (format === 'unknown') format = /년/.test(t.slice(0, 6)) ? 'android' : 'ios';
          continue;
        }
      }
      if (RE_MOBILE_SYS.test(t) || RE_MOBILE_DATE.test(t)) { systemLines += 1; last = null; continue; }
      if (last) { last.body += (last.body ? '\n' : '') + line.replace(/\s+$/, ''); continue; }
      unparsed += 1;
    }
  }

  // 정리: 앞뒤 공백·빈 내용 제거, 내용 2000자 제한, 같은 줄 순번
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  const result: KakaoLine[] = [];
  for (const l of out) {
    const body = l.body.replace(/\n+$/, '').trim().slice(0, 2000);
    if (!body) continue;
    const key = `${l.at}|${l.sender}|${body}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    counts.set(l.sender, (counts.get(l.sender) || 0) + 1);
    result.push({ at: l.at, sender: l.sender, body, n });
  }
  const senders = Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { format, title, lines: result, senders, unparsed, systemLines };
}
