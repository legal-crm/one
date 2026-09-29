import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { User } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  fetchLawyersFromDb,
  pushLawyerProfiles,
  lawyerFingerprint,
  pickPrivateLawyerFields,
} from '../services/lawyerService';
import { readAdminMarker } from '../utils/adminPortal';

// ============================================================
// 변호사 프로필 ↔ Supabase lawyers 동기화 (기기 간 공유)
// - 읽기: 앱 시작, 로그인/로그아웃/MFA 완료, 역할 전환, 탭 복귀(30초 간격) 시 DB에서 다시 불러와 병합
// - 쓰기: 관리자(MFA 세션) → 변경된 모든 실제 프로필 / 변호사 → 본인 프로필만 / 그 외 → 쓰지 않음
//   실제 허용 범위는 RLS(018)·트리거(028)가 서버에서 다시 판정한다.
// - 서버가 기준: 저장되지 않은 로컬 수정이 없는 행은 DB 값으로 교체
// ============================================================

type AppRole = 'client' | 'lawyer' | 'admin' | 'honeypot';
type Actor = { kind: 'admin' } | { kind: 'lawyer'; id: string };

const PUSH_DEBOUNCE_MS = 800;
const FOCUS_REFRESH_MIN_MS = 30_000;
const LAWYER_SESSION_KEY = 'legal_crm_lawyer_session';

interface Options {
  lawyers: User[];
  setLawyers: React.Dispatch<React.SetStateAction<User[]>>;
  currentRole: AppRole;
  /** 시연용 샘플 변호사 ID — DB에 없는 샘플은 관리자 화면에서도 업로드하지 않는다 */
  seedIds: ReadonlySet<string>;
}

async function resolveActor(role: AppRole): Promise<Actor | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  if (role === 'admin') {
    const marker = readAdminMarker();
    return marker && !marker.dev ? { kind: 'admin' } : null;
  }
  if (role === 'lawyer') {
    // 서버 매핑 확인 후 LawyerRole이 기록하는 본인 lawyer_id (RLS가 본인 행만 쓰기 허용)
    const id = sessionStorage.getItem(LAWYER_SESSION_KEY);
    return id ? { kind: 'lawyer', id } : null;
  }
  return null;
}

export function useLawyerProfileSync({ lawyers, setLawyers, currentRole, seedIds }: Options) {
  const lawyersRef = useRef(lawyers);
  lawyersRef.current = lawyers;
  const roleRef = useRef(currentRole);
  roleRef.current = currentRole;

  /** id → 마지막으로 확인한 서버 상태 지문 */
  const syncedRef = useRef(new Map<string, string>());
  /** DB에 행이 있는 ID */
  const remoteIdsRef = useRef(new Set<string>());
  /** 비공개 프로필 조회 성공 여부 (실패 시 비공개 행 덮어쓰기 금지) */
  const privateLoadedRef = useRef(false);
  /** 저장 실패한 지문 — 같은 내용으로 무한 재시도하지 않음 (다시 불러오면 초기화) */
  const failedRef = useRef(new Map<string, string>());
  const readyRef = useRef(false);
  const pushingRef = useRef(false);
  const pushAgainRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const lastFetchRef = useRef(0);
  const [syncTick, setSyncTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const seq = ++fetchSeqRef.current;
    lastFetchRef.current = Date.now();
    const res = await fetchLawyersFromDb();
    if (seq !== fetchSeqRef.current) return; // 더 최근 요청이 있음
    if (res.ok === false) return;

    const prevSynced = new Map(syncedRef.current);
    const remoteById = new Map(res.lawyers.map(l => [l.id, l]));
    remoteIdsRef.current = new Set(remoteById.keys());
    privateLoadedRef.current = res.privateLoaded;
    failedRef.current.clear();

    setLawyers(prev => {
      const localById = new Map(prev.map(l => [l.id, l]));
      // 서버 상태 지문: 비공개 조회 자체가 실패했으면 서버 비공개 값을 알 수 없으므로
      // 이 기기의 비공개 값과 같다고 간주 (비공개 차이만으로 재저장하지 않음)
      for (const r of res.lawyers) {
        const local = localById.get(r.id);
        const serverView = res.privateLoaded || !local ? r : ({ ...r, ...pickPrivateLawyerFields(local) } as User);
        syncedRef.current.set(r.id, lawyerFingerprint(serverView));
      }

      const next = prev.map(local => {
        const remote = remoteById.get(local.id);
        if (!remote) return local; // 아직 DB에 없는 프로필 (권한 있는 사용자가 올림)
        const lastSynced = prevSynced.get(local.id);
        if (lastSynced !== undefined && lawyerFingerprint(local) !== lastSynced) {
          return local; // 아직 저장되지 않은 로컬 수정 유지
        }
        // 비공개 정보를 받지 못한 행(권한 없음·행 없음)은 이 기기에 있던 비공개 값을 유지
        return res.privateIds.has(local.id) ? remote : ({ ...remote, ...pickPrivateLawyerFields(local) } as User);
      });
      for (const r of res.lawyers) if (!localById.has(r.id)) next.push(r);
      return next;
    });

    readyRef.current = true;
    setSyncTick(t => t + 1);
  }, [setLawyers]);

  const flush = useCallback(async () => {
    if (!isSupabaseConfigured || !readyRef.current) return;
    if (pushingRef.current) { pushAgainRef.current = true; return; }
    pushingRef.current = true;
    try {
      const actor = await resolveActor(roleRef.current);
      if (!actor) return;

      const candidates = lawyersRef.current.filter(l => {
        if (!l?.id) return false;
        if (actor.kind === 'lawyer' && l.id !== actor.id) return false;
        if (actor.kind === 'admin' && seedIds.has(l.id) && !remoteIdsRef.current.has(l.id)) return false;
        const fp = lawyerFingerprint(l);
        return syncedRef.current.get(l.id) !== fp && failedRef.current.get(l.id) !== fp;
      });
      if (candidates.length === 0) return;

      const fps = new Map(candidates.map(l => [l.id, lawyerFingerprint(l)]));
      const res = await pushLawyerProfiles(candidates, remoteIdsRef.current, { includePrivate: privateLoadedRef.current });
      for (const id of res.saved) {
        syncedRef.current.set(id, fps.get(id)!);
        remoteIdsRef.current.add(id);
        failedRef.current.delete(id);
      }
      for (const f of res.failed) failedRef.current.set(f.id, fps.get(f.id)!);
      // 다른 기기에서 이미 만든 프로필 → 서버 값을 받아와 병합
      if (res.conflicted.length > 0) void refresh();
      // 승인 상태 등 서버 트리거가 바꾼 값 반영
      else if (res.saved.length > 0) setTimeout(() => { void refresh(); }, 1500);
    } finally {
      pushingRef.current = false;
      if (pushAgainRef.current) {
        pushAgainRef.current = false;
        setTimeout(() => { void flush(); }, 0);
      }
    }
  }, [refresh, seedIds]);

  // 최초 로드 + 역할 전환 시 다시 불러오기
  useEffect(() => {
    void refresh();
  }, [refresh, currentRole]);

  // 로그인·로그아웃·MFA 완료 시 권한 범위가 바뀌므로 다시 불러오기
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED' || event === 'USER_UPDATED') {
        clearTimeout(timer);
        timer = setTimeout(() => { void refresh(); }, 300);
      }
    });
    return () => { clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [refresh]);

  // 다른 기기에서 바꾼 내용 반영: 탭으로 돌아올 때
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > FOCUS_REFRESH_MIN_MS) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // 로컬 변경 → DB 저장 (디바운스)
  useEffect(() => {
    if (!readyRef.current) return;
    const timer = setTimeout(() => { void flush(); }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [lawyers, syncTick, currentRole, flush]);
}
