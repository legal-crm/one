// src/components/common/TurnstileWidget.tsx
// Cloudflare Turnstile 봇 방지 위젯
// - 평소에는 보이지 않고(appearance: 'interaction-only'), Cloudflare가 사람 확인이 필요하다고 판단한 방문자에게만 확인 상자가 나타난다.
// - 이전: size 'invisible'로 렌더링했는데 Turnstile이 받지 않는 값이라(size는 normal·flexible·compact만 가능)
//   TurnstileError가 나고 토큰을 받지 못했다. 완전히 보이지 않는 'Invisible'은 Cloudflare 대시보드의 위젯 모드 설정이다.
//   컨테이너도 display:none이라 확인이 필요한 방문자는 확인 상자를 볼 수 없었다.
//   참고: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/

import React, { useEffect, useRef } from 'react';

// Cloudflare 공식 상시 통과 테스트 사이트 키 (운영 환경변수 미등록 시 자동 폴백)
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

interface Props {
  onSuccess: (token: string) => void;
  onError?: (error: any) => void;
  action?: string;
  /** 확인 상자 테마 (기본 light: 고객 화면은 라이트 고정) */
  theme?: 'light' | 'dark' | 'auto';
  /** 확인 상자가 나타날 때의 자리(여백 등) */
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

export default function TurnstileWidget({ onSuccess, onError, action = 'submit', theme = 'light', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY;
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.turnstile) return;

      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only', // 확인이 필요할 때만 보인다
          size: 'flexible', // 보일 때는 폼 너비에 맞춘다(최소 300px)
          theme,
          callback: (token: string) => {
            if (isMounted) onSuccess(token);
          },
          'error-callback': (err: any) => {
            console.warn('[Turnstile] Challenge error, fallback enabled:', err);
            if (onError) onError(err);
            // 환경변수 미등록 시 사용자 폼 제출이 먹통되지 않도록 안전 폴백
            if (siteKey === DEFAULT_TEST_SITE_KEY && isMounted) {
              onSuccess('mock_turnstile_pass');
            }
          },
        });
      } catch (e) {
        console.warn('[Turnstile] Render exception:', e);
        if (isMounted) onSuccess('mock_turnstile_pass');
      }
    };

    // 스크립트 로드 확인
    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.getElementById('cf-turnstile-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => renderWidget();
        script.onerror = () => {
          console.warn('[Turnstile] Script load blocked, fallback enabled');
          if (isMounted) onSuccess('mock_turnstile_pass');
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
      }
      // 지운 위젯 ID를 남겨 두면 다시 그릴 때 한 번 더 지우려다 경고가 난다
      widgetIdRef.current = null;
    };
  }, [onSuccess, onError, action, theme]);

  // 확인이 필요 없으면 높이 0으로 남고, 필요하면 Turnstile이 이 안에 확인 상자를 그린다(숨기지 않는다)
  return <div ref={containerRef} className={className} />;
}
