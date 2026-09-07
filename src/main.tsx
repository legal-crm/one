import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import RootErrorBoundary from './components/common/RootErrorBoundary';

// [Vite 청크 동적 임포트 실패 자동 새로고침]
// Vercel 재배포 등으로 이전 청크 해시가 만료된 경우 1회 자동 새로고침
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected. Reloading page for new assets...', event);
  const reloadKey = 'legal_crm_chunk_reload_attempt';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 15000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
