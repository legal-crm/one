import type { ItemOwner, TableType } from './correctionLabels';
import type { LibraryEntry } from './correctionService';

// ============================================================
// 보정권고 원문 → 항목 나누기 (CR-3, 규칙 기반)
// 원문 번호(1. / 2) / 가. / ① …) 기준으로 나누고, 라이브러리 키워드로 분류 초안을 붙인다.
// 분류는 초안일 뿐이고 변호사가 확인하기 전에는 의뢰인에게 나가지 않는다.
// ============================================================

export interface SplitItem {
  label: string;
  text: string;
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const HANGUL_MARKS = '가나다라마바사아자차카타파하';

type Level = 'num' | 'hangul' | 'circled';

function detect(line: string): { level: Level; mark: string; rest: string } | null {
  const t = line.trim();
  let m = /^(\d{1,2})\s*[.)．]\s*(.*)$/.exec(t);
  if (m) return { level: 'num', mark: m[1], rest: m[2] };
  m = /^\(?(\d{1,2})\)\s*(.*)$/.exec(t);
  if (m) return { level: 'num', mark: m[1], rest: m[2] };
  m = new RegExp(`^([${HANGUL_MARKS}])\\s*[.)．]\\s*(.*)$`).exec(t);
  if (m) return { level: 'hangul', mark: m[1], rest: m[2] };
  m = new RegExp(`^\\(([${HANGUL_MARKS}])\\)\\s*(.*)$`).exec(t);
  if (m) return { level: 'hangul', mark: m[1], rest: m[2] };
  const c = t.charAt(0);
  if (CIRCLED.includes(c)) return { level: 'circled', mark: String(CIRCLED.indexOf(c) + 1), rest: t.slice(1).trim() };
  return null;
}

/**
 * 원문 글을 번호 단위 항목으로 나눈다.
 * - 가장 바깥 번호(1, 2, …) 아래에 세부(가, 나 / ①, ②)가 있으면 세부마다 한 항목('3-가')으로 나눈다.
 * - 번호 앞 머리글(사건 표시·인사말)은 버린다. 번호가 하나도 없으면 전체를 한 항목으로.
 */
export function splitCorrectionText(raw: string): SplitItem[] {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  const out: SplitItem[] = [];
  let top: string | null = null;
  let topText = '';
  let topHasChildren = false;
  let cur: SplitItem | null = null;

  const flushTopOnly = () => {
    if (top !== null && !topHasChildren && topText.trim()) out.push({ label: top, text: topText.trim() });
  };

  for (const line of lines) {
    const d = detect(line);
    if (d && d.level === 'num') {
      flushTopOnly();
      if (cur) cur = null;
      top = d.mark;
      topText = d.rest;
      topHasChildren = false;
      continue;
    }
    if (d && top !== null && (d.level === 'hangul' || d.level === 'circled')) {
      topHasChildren = true;
      const mark = d.level === 'hangul' ? d.mark : d.mark;
      cur = { label: `${top}-${mark}`, text: (topText ? `${topText.trim()} ` : '') + d.rest };
      out.push(cur);
      continue;
    }
    const t = line.trim();
    if (!t) continue;
    if (cur) cur.text += `\n${t}`;
    else if (top !== null) topText += `\n${t}`;
  }
  flushTopOnly();
  if (out.length === 0) {
    const all = lines.map(l => l.trim()).filter(Boolean).join('\n');
    return all ? [{ label: '1', text: all }] : [];
  }
  return out.map(i => ({ ...i, text: i.text.trim().slice(0, 6000) }));
}

export interface ItemSuggestion {
  libraryId?: string;
  category?: string;
  owner: ItemOwner;
  clientTitle?: string;
  clientGuide?: string;
  neededDocs: string[];
  tableType?: TableType;
  questions: string[];
  answerText?: string;
}

/** 키워드가 가장 많이 맞는 라이브러리 항목 (같으면 먼저 정의된 것). 없으면 형식 없는 사무소 몫 초안 */
export function suggestFromLibrary(text: string, library: LibraryEntry[]): ItemSuggestion {
  const t = text.replace(/\s+/g, ' ');
  let best: LibraryEntry | null = null;
  let bestScore = 0;
  for (const e of library) {
    const score = e.keywords.reduce((s, k) => (k && t.includes(k) ? s + k.length : s), 0);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  if (!best) return { owner: 'office', neededDocs: [], questions: [] };
  return {
    libraryId: best.id, category: best.category, owner: best.owner, clientTitle: best.clientTitle, clientGuide: best.clientGuide,
    neededDocs: [...best.neededDocs], tableType: best.tableType, questions: [...best.questions], answerText: best.answerTemplate,
  };
}

/** 사진 장수 요구('사진 4장', '내부 4장·외부 2장')를 찾아 합친다 */
export function detectPhotoCount(text: string): number | undefined {
  if (!/사진/.test(text)) return undefined;
  const nums = Array.from(text.matchAll(/(\d{1,2})\s*장/g)).map(m => Number(m[1])).filter(n => n > 0 && n <= 20);
  if (nums.length === 0) return undefined;
  return Math.min(20, nums.reduce((a, b) => a + b, 0));
}
