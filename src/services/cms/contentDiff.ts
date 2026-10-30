// 콘텐츠 목록 비교 (서버 반영할 차이 계산). 외부 의존 없음 — 단위 시험 대상

/** 행 비교용 직렬화 (키 순서 차이·undefined 칸 무시) */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).filter(k => obj[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export interface ContentDiff<T> {
  upserts: T[];
  deletes: string[];
}

/** 지난 서버 상태(snapshot: id → 직렬화)와 지금 목록의 차이 */
export function diffContent<T extends { id: string }>(snapshot: Map<string, string>, items: T[]): ContentDiff<T> {
  const upserts: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id) continue;
    seen.add(item.id);
    if (snapshot.get(item.id) !== stableStringify(item)) upserts.push(item);
  }
  const deletes = [...snapshot.keys()].filter(id => !seen.has(id));
  return { upserts, deletes };
}

export function snapshotOf<T extends { id: string }>(items: T[]): Map<string, string> {
  return new Map(items.filter(i => i?.id).map(i => [i.id, stableStringify(i)]));
}
