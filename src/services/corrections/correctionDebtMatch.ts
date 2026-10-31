// 보정 항목 ↔ 부채증명 장부 채권자 줄 찾기 (DC-11). 화면 없이 시험할 수 있게 분리.

const DEBT_HINT = /부채\s*증명|채권자\s*목록|채권\s*(액|금액|자)|산정\s*기준일|대위\s*변제|양도|양수|보증\s*(채무|인)|장래\s*구상|별제권|담보\s*채권|연체\s*이자|지연\s*손해금/;

export function isDebtRelatedCorrection(text: string): boolean {
  return DEBT_HINT.test(String(text || ''));
}

/** 회사 형태 표시·공백·괄호를 빼고 비교한다: '(주)국민카드' = '국민카드' = '주식회사 국민카드' */
export function normalizeCreditorName(name: string): string {
  return String(name || '')
    .replace(/주식회사|유한회사|\(주\)|㈜|\(유\)|\(재\)|재단법인|사단법인/g, '')
    .replace(/[\s()·.,\-]/g, '')
    .toLowerCase();
}

/** 원문에 이름이 나온 장부 줄 (짧은 이름 2자 미만은 잘못 걸리기 쉬워 뺀다) */
export function matchLedgerRows<T extends { creditorName: string }>(text: string, rows: T[]): T[] {
  const hay = normalizeCreditorName(text);
  if (!hay) return [];
  return rows.filter(r => {
    const n = normalizeCreditorName(r.creditorName);
    if (n.length < 2) return false;
    if (hay.includes(n)) return true;
    // '○○은행 ○○지점'처럼 장부 이름이 길면 앞부분(은행·카드·캐피탈 이름)으로도 찾는다
    const head = n.match(/^(.+?(은행|카드|캐피탈|저축은행|보험|생명|화재|대부|신용정보|자산관리|금고|조합|공사|공단))/);
    return !!head && head[1].length >= 3 && hay.includes(head[1]);
  });
}
