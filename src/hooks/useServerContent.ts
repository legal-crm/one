// ============================================================
// 서버 콘텐츠 상태 훅 (CT-1)
// - 시작할 때·로그인 상태가 바뀔 때 서버에서 읽는다 (브라우저 사본 없음)
// - canWrite(관리자 화면)이면 목록이 바뀔 때 차이만 서버에 반영, 실패하면 알리고 서버 값으로 되돌린다
// - 서버가 설정되지 않은 로컬 개발에서만 devFallback(시드)을 쓴다
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  applyContentDiff,
  diffContent,
  fetchConfig,
  fetchContent,
  saveConfig,
  snapshotOf,
  stableStringify,
  type ConfigTable,
  type ContentTable,
} from '../services/cms/contentService';

const RELOAD_EVENTS = new Set(['SIGNED_IN', 'SIGNED_OUT', 'MFA_CHALLENGE_VERIFIED', 'USER_UPDATED']);

function useAuthReloadKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (RELOAD_EVENTS.has(event)) setKey(k => k + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return key;
}

export interface ServerContentMeta {
  loaded: boolean;
  error: string | null;
  reload: () => void;
}

export function useServerCollection<T extends { id: string }>(opts: {
  table: ContentTable;
  label: string;
  canWrite: boolean;
  devFallback?: T[];
}): [T[], React.Dispatch<React.SetStateAction<T[]>>, ServerContentMeta] {
  const { table, label, canWrite } = opts;
  const useLocal = !isSupabaseConfigured;
  const [items, setItems] = useState<T[]>(() => (useLocal && import.meta.env.DEV ? (opts.devFallback || []) : []));
  const [loaded, setLoaded] = useState(useLocal);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef<Map<string, string>>(new Map());
  const readyRef = useRef(false);
  const savingRef = useRef(false);
  const [manualKey, setManualKey] = useState(0);
  const authKey = useAuthReloadKey();

  useEffect(() => {
    if (useLocal) return;
    let cancelled = false;
    readyRef.current = false;
    (async () => {
      const res = await fetchContent<T>(table);
      if (cancelled) return;
      if (res.ok === false) {
        setError(res.message);
        setLoaded(true);
        return;
      }
      snapshotRef.current = snapshotOf(res.data);
      setItems(res.data);
      setError(null);
      setLoaded(true);
      // setItems 반영 뒤에 쓰기 감시를 켠다
      setTimeout(() => { if (!cancelled) readyRef.current = true; }, 0);
    })();
    return () => { cancelled = true; };
  }, [table, useLocal, authKey, manualKey]);

  useEffect(() => {
    if (useLocal || !canWrite || !readyRef.current || savingRef.current) return;
    const diff = diffContent(snapshotRef.current, items);
    if (diff.upserts.length === 0 && diff.deletes.length === 0) return;
    savingRef.current = true;
    const nextSnapshot = snapshotOf(items);
    applyContentDiff(table, diff).then(res => {
      savingRef.current = false;
      if (res.ok === false) {
        toast.error(`${label} 저장 실패: ${res.message}`, { description: '서버의 마지막 저장 상태로 되돌립니다.' });
        setManualKey(k => k + 1);
        return;
      }
      snapshotRef.current = nextSnapshot;
      // 저장 중에 더 바뀐 내용이 있으면 다시 감시가 돌도록 같은 목록을 한 번 더 넣는다
      setItems(prev => (prev === items ? prev : [...prev]));
    });
  }, [items, canWrite, table, label, useLocal]);

  const reload = useCallback(() => setManualKey(k => k + 1), []);
  return [items, setItems, { loaded, error, reload }];
}

export function useServerConfig<T>(opts: {
  table: ConfigTable;
  label: string;
  canWrite: boolean;
  defaults: T;
  /** 서버 값에 기본값을 겹칠 때 쓰는 함수 (기본: 얕은 병합) */
  merge?: (defaults: T, server: any) => T;
}): [T, React.Dispatch<React.SetStateAction<T>>, ServerContentMeta] {
  const { table, label, canWrite, defaults } = opts;
  const useLocal = !isSupabaseConfigured;
  const mergeFn = opts.merge || ((d: T, s: any) => (s && typeof s === 'object' && !Array.isArray(s) ? { ...(d as any), ...s } : (s ?? d)) as T);
  const [value, setValue] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(useLocal);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef<string>(stableStringify(defaults));
  const readyRef = useRef(false);
  const [manualKey, setManualKey] = useState(0);
  const authKey = useAuthReloadKey();
  const defaultsRef = useRef(defaults);
  const mergeRef = useRef(mergeFn);
  mergeRef.current = mergeFn;

  useEffect(() => {
    if (useLocal) return;
    let cancelled = false;
    readyRef.current = false;
    (async () => {
      const res = await fetchConfig<any>(table);
      if (cancelled) return;
      if (res.ok === false) {
        setError(res.message);
        setLoaded(true);
        return;
      }
      const next = mergeRef.current(defaultsRef.current, res.data);
      snapshotRef.current = stableStringify(next);
      setValue(next);
      setError(null);
      setLoaded(true);
      setTimeout(() => { if (!cancelled) readyRef.current = true; }, 0);
    })();
    return () => { cancelled = true; };
  }, [table, useLocal, authKey, manualKey]);

  useEffect(() => {
    if (useLocal || !canWrite || !readyRef.current) return;
    const s = stableStringify(value);
    if (s === snapshotRef.current) return;
    // 입력칸에서 글자마다 저장하지 않도록 잠깐 모았다가 저장
    const timer = setTimeout(() => {
      saveConfig(table, value).then(res => {
        if (res.ok === false) {
          toast.error(`${label} 저장 실패: ${res.message}`, { description: '서버의 마지막 저장 상태로 되돌립니다.' });
          setManualKey(k => k + 1);
          return;
        }
        snapshotRef.current = s;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [value, canWrite, table, label, useLocal]);

  const reload = useCallback(() => setManualKey(k => k + 1), []);
  return [value, setValue, { loaded, error, reload }];
}
