import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { loadMyAccountStatus } from '../services/admin/adminOpsService';

/**
 * 정지된 계정이면 로그인을 끝내고 사유를 알린다 (OP-10).
 * 서버는 정지 계정의 상담·사건 표 접근을 막고 세션을 지우지만, 이미 열린 화면은 여기서 정리한다.
 * 로그인할 때·화면으로 돌아올 때 확인한다.
 */
export function useAccountStatusGuard(enabled: boolean) {
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user || cancelled) return;
      const s = await loadMyAccountStatus();
      if (cancelled || !s || s.status !== 'suspended') return;
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        const until = s.until ? ` (${new Date(s.until).toLocaleDateString('ko-KR')}까지)` : '';
        toast.error(`이용이 정지된 계정이에요${until}. 사유: ${s.reason || '운영 정책 위반'} · 문의는 고객센터로 해 주세요.`, { duration: 15000 });
      }
      await supabase.auth.signOut().catch(() => {});
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { notifiedRef.current = false; void check(); }
    });
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
