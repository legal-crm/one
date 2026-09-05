// ============================================================
// [SECURITY] 실시간 세션 가드 훅 (useSessionGuard)
// 강제 원격 로그아웃 감지, BroadcastChannel 동기화, 하트비트 유지
// ============================================================

import { useEffect, useRef } from 'react';
import { checkSessionValidity, touchSessionHeartbeat, getCurrentSessionId } from '../services/sessionService';
import { useDialog } from '../components/common/DialogProvider';

interface UseSessionGuardProps {
  userId?: string;
  isLoggedIn: boolean;
  onForceLogout: (reason: string) => void;
}

export function useSessionGuard({
  userId,
  isLoggedIn,
  onForceLogout,
}: UseSessionGuardProps) {
  const dialog = useDialog();
  const isHandlingLogout = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    // 1. 세션 유효성 즉각 검증 함수
    const verifyCurrentSession = async () => {
      if (isHandlingLogout.current) return;

      const currentId = getCurrentSessionId();
      if (!currentId) return;

      const result = await checkSessionValidity(currentId);
      if (!result.valid && !isHandlingLogout.current) {
        isHandlingLogout.current = true;
        const msg = result.reason || '보안을 위해 다른 기기 또는 관리자에 의해 세션이 강제 종료되었습니다.';
        
        await dialog.alert({
          title: '보안 로그아웃 알림',
          message: msg,
          variant: 'danger',
        });

        onForceLogout(msg);
      }
    };

    // 2. 활동 하트비트 등록 (마우스/키보드 활동 시)
    const handleUserActivity = () => {
      touchSessionHeartbeat();
    };

    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleUserActivity, { passive: true }));

    // 3. 15초 주기 정기 세션 상태 폴링 검증
    const pollTimer = setInterval(verifyCurrentSession, 15_000);

    // 4. BroadcastChannel 수신 (다른 탭에서 원격 로그아웃 즉각 감지)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('legal_crm_session_security_channel');
        channel.onmessage = (event) => {
          const data = event.data;
          const currentId = getCurrentSessionId();

          // 본인 세션 ID가 종료되었거나, 본인 계정 전체가 차단된 경우
          if (
            (data.sessionId && data.sessionId === currentId) ||
            (data.userId && data.userId === userId && !data.sessionId)
          ) {
            if (!isHandlingLogout.current) {
              isHandlingLogout.current = true;
              const reason = data.reason || '다른 기기 또는 관리자에 의해 세션이 종료되었습니다.';
              dialog.alert({
                title: '원격 로그아웃 처리',
                message: reason,
                variant: 'danger',
              }).then(() => {
                onForceLogout(reason);
              });
            }
          }
        };
      }
    } catch {
      // BroadcastChannel 미지원 시 정기 폴링으로 안전하게 동작
    }

    // 마운트 시 초기 1회 검증
    verifyCurrentSession();

    return () => {
      clearInterval(pollTimer);
      events.forEach(e => window.removeEventListener(e, handleUserActivity));
      if (channel) {
        channel.close();
      }
    };
  }, [isLoggedIn, userId, onForceLogout, dialog]);
}
