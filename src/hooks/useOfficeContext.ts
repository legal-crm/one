// ============================================================
// 내 사무소·역할·권한 (서버 판정, RB-1·RB-2)
// - my_office_context RPC 결과만 쓴다. 기록이 없으면 '대표'로 간주하지 않는다.
// - 60초마다 다시 확인해 정지·탈퇴·권한 변경을 반영한다(화면 잠금은 호출하는 쪽이 status로 판단).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMyOfficeContexts, touchOfficeMember, type OfficeContext } from '../services/office/officeService';

export type OfficeContextStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

export interface UseOfficeContextResult {
  status: OfficeContextStatus;
  /** 지금 고른 사무소 (대표 사무소가 먼저) */
  office: OfficeContext | null;
  offices: OfficeContext[];
  error: string | null;
  reload: () => Promise<void>;
  selectOffice: (officeId: string) => void;
}

const SELECTED_KEY = 'mykim_selected_office';

export function useOfficeContext(enabled: boolean): UseOfficeContextResult {
  const [status, setStatus] = useState<OfficeContextStatus>('idle');
  const [offices, setOffices] = useState<OfficeContext[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const loadedOnce = useRef(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    if (!loadedOnce.current) setStatus('loading');
    const res = await loadMyOfficeContexts();
    if (!res.ok) {
      // 첫 로딩 실패만 오류 화면. 이후 주기 확인 실패는 마지막 결과 유지(네트워크 순간 끊김으로 잠그지 않음)
      setError(res.message);
      if (!loadedOnce.current) setStatus('error');
      return;
    }
    loadedOnce.current = true;
    setError(null);
    setOffices(res.data);
    setStatus(res.data.length > 0 ? 'ready' : 'none');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      loadedOnce.current = false;
      setStatus('idle');
      setOffices([]);
      return;
    }
    void reload();
    void touchOfficeMember();
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void reload();
      void touchOfficeMember();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  const selectOffice = useCallback((officeId: string) => {
    setSelectedId(officeId);
    try { sessionStorage.setItem(SELECTED_KEY, officeId); } catch { /* 화면 설정 저장 실패는 무시 */ }
  }, []);

  const office = offices.find(o => o.officeId === selectedId) || offices[0] || null;
  return { status, office, offices, error, reload, selectOffice };
}
