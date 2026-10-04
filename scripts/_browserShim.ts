/**
 * Node 실행용 브라우저 저장소 shim (scripts 전용)
 * 앱 서비스 모듈은 localStorage/sessionStorage를 사용하므로, Node에서 스크립트를 돌릴 때
 * 다른 import보다 먼저 이 파일을 import해 메모리 기반 저장소를 주입한다.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

const g = globalThis as any;
if (typeof g.localStorage === 'undefined') g.localStorage = new MemoryStorage();
if (typeof g.sessionStorage === 'undefined') g.sessionStorage = new MemoryStorage();

export {};
