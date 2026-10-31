// ============================================================
// PC 카톡 묶음 발송 표 (KT-8 1단계)
// 사무소가 쓰는 엑셀 카톡 발송 양식(8~37행, B 구분 · C 채팅방 이름 · D 보낼 메시지 · E 텍스트값 · F 발송결과)에
// 그대로 붙여 넣을 수 있게 칸을 맞춰 내보내고, 발송결과(1/0)가 채워진 표를 다시 읽는다.
// 양식의 코드는 가져오지 않는다(칸 구조만 맞춤). 결과 1은 '창을 찾고 엔터를 눌렀다'는 뜻이라 '보냄(PC 묶음)'으로만 기록한다.
// ============================================================

export interface PcBatchItem { taskId: string; kakaoName: string; body: string }

export const PC_BATCH_FIRST_ROW = 8;
export const PC_BATCH_MAX_ROWS = 30;
export const PC_BATCH_HEADER = ['구분', '채팅방 이름', '보낼 메시지', '텍스트값', '발송결과'];

/** 카톡에 붙여 넣을 글: 그림 문자(이모지)는 엑셀 양식에서 '?'로 깨지므로 뺀다 */
export function toKakaoPlainText(text: string): string {
  return (text || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^[ \t]+/gm, (m) => m)
    .trim();
}

/** 표(1행부터) — A열은 비우고 B~F를 양식과 같은 위치(8행~)에 둔다. 마지막 G열은 마이김변 확인용 번호 */
export function buildPcBatchTable(items: PcBatchItem[]): string[][] {
  const rows: string[][] = [];
  rows.push(['', '마이김변 카톡 묶음 발송 목록 — B8:E37을 엑셀 카톡 발송 양식의 같은 칸에 붙여 넣어 주세요']);
  rows.push(['', '받는 사람은 사건에 등록한 의뢰인 카톡 이름이 다른 사건과 겹치지 않는 경우만 들어 있어요.']);
  rows.push(['', '발송 뒤 발송결과(F열)가 채워진 파일을 마이김변 \'결과 올리기\'에 올리면 1인 줄만 보낸 것으로 기록돼요.']);
  rows.push([]);
  rows.push([]);
  rows.push([]);
  rows.push(['', ...PC_BATCH_HEADER, '마이김변 번호']);
  for (const it of items.slice(0, PC_BATCH_MAX_ROWS)) {
    rows.push(['', '채팅', it.kakaoName, toKakaoPlainText(it.body), '', '', it.taskId]);
  }
  return rows;
}

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

export interface PcBatchResultRead { sent: string[]; failed: number; unmatched: number; rows: number }

/**
 * 결과 표 읽기: 머리글('채팅방 이름'·'보낼 메시지'·'발송결과')을 찾아 칸을 맞춘다. 머리글이 없으면 양식 위치(B~F, 8행~)로 본다.
 * 마이김변 번호 칸이 있으면 그 번호로, 없으면 (카톡 이름 + 메시지)로 지금 목록과 맞춘다.
 */
export function readPcBatchResults(table: unknown[][], current: PcBatchItem[]): PcBatchResultRead {
  let hi = -1;
  let cName = 2; let cMsg = 3; let cRes = 5; let cId = -1;
  for (let i = 0; i < Math.min(table.length, 40); i++) {
    const r = (table[i] || []).map(norm);
    const n = r.findIndex(c => c === '채팅방 이름' || c === '채팅방이름');
    const m = r.findIndex(c => c === '보낼 메시지' || c === '보낼메시지');
    const s = r.findIndex(c => c === '발송결과' || c === '발송 결과');
    if (n >= 0 && m >= 0 && s >= 0) { hi = i; cName = n; cMsg = m; cRes = s; cId = r.findIndex(c => c === '마이김변 번호'); break; }
  }
  const start = hi >= 0 ? hi + 1 : PC_BATCH_FIRST_ROW - 1;
  const byId = new Map(current.map(c => [c.taskId, c]));
  const byText = new Map(current.map(c => [`${norm(c.kakaoName)}|${norm(toKakaoPlainText(c.body))}`, c]));
  const sent = new Set<string>();
  let failed = 0; let unmatched = 0; let rows = 0;
  for (const r of table.slice(start, start + 200)) {
    if (!r) continue;
    const name = norm(r[cName]);
    const msg = norm(r[cMsg]);
    if (!name && !msg) continue;
    rows += 1;
    const res = norm(r[cRes]);
    const hit = (cId >= 0 && byId.get(norm(r[cId]))) || byText.get(`${name}|${msg}`);
    if (!hit) { unmatched += 1; continue; }
    if (res === '1') sent.add(hit.taskId); else failed += 1;
  }
  return { sent: Array.from(sent), failed, unmatched, rows };
}
