// src/components/common/TurnstileWidget.tsx
// Cloudflare Turnstile (보이지 않는 무인증 Invisible 모드) 컴포넌트

import React, { useEffect, useRef } from 'react';

// Cloudflare 공식 상시 통과 테스트 사이트 키 (운영 환경변수 미등록 시 자동 폴백)
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

interface Props {
  onSuccess: (token: string) => void;
  onError?: (error: any) => void;
  action?: string;
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

export default function TurnstileWidget({ onSuccess, onError, action = 'submit' }: Props) {
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
          size: 'invisible', // 🚀 보이지 않는 모드 (화면 노출 0px, UX 방해 제로)
          action,
          callback: (token: string) => {
            if (isMounted) onSuccess(token);
          },
          'error-callback': (err: any) => {
            console.warn('[Turnstile Invisible] Challenge error, fallback enabled:', err);
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
    };
  }, [onSuccess, onError, action]);

  // 보이지 않는 모드이므로 0 크기로 숨김 렌더링
  return <div ref={containerRef} style={{ display: 'none' }} aria-hidden="true" />;
}
