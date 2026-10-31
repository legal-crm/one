import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  getFavoriteLawyerIds,
  subscribeFavoriteLawyers,
  refreshFavoriteLawyers,
  favoritesLoadedFor,
  setFavoriteLawyer,
} from '../services/lawyers/favoriteLawyerService';

/** 변호사 좋아요 (서버 저장). 로그인 상태가 바뀌면 다시 읽는다. */
export function useFavoriteLawyers(isLoggedIn: boolean, onNeedLogin?: () => void) {
  const [favorites, setFavorites] = useState<Set<string>>(getFavoriteLawyerIds);

  useEffect(() => subscribeFavoriteLawyers(setFavorites), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid: string | null = null;
      if (isLoggedIn && isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id || null;
      }
      if (cancelled || uid === favoritesLoadedFor()) return;
      const res = await refreshFavoriteLawyers(uid);
      if (!cancelled && !res.ok && res.message) toast.error(res.message);
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  const toggleFavorite = useCallback(async (lawyerId: string) => {
    const on = !getFavoriteLawyerIds().has(lawyerId);
    const res = await setFavoriteLawyer(lawyerId, on);
    if (res.ok) return;
    if (res.needsLogin) {
      toast.info(res.message || '로그인하면 좋아요를 저장할 수 있어요.');
      onNeedLogin?.();
      return;
    }
    if (res.message) toast.error(res.message);
  }, [onNeedLogin]);

  return { favorites, toggleFavorite };
}
