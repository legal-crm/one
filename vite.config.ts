import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * [SEO] 검색엔진 소유권 확인 메타태그를 빌드 환경변수로 주입
 *  - GOOGLE_SITE_VERIFICATION : 구글 서치 콘솔 HTML 태그 방식의 content 값
 *  - BING_SITE_VERIFICATION   : 빙 웹마스터 msvalidate.01 content 값
 * 값 형식이 맞지 않으면(HTML 주입 방지) 넣지 않는다. index.html의 <!-- seo:site-verification --> 자리에 들어간다.
 */
function seoVerificationMeta(env: Record<string, string>): Plugin {
  const pick = (key: string) => {
    const v = String(env[key] || process.env[key] || '').trim();
    return /^[A-Za-z0-9_-]{8,128}$/.test(v) ? v : '';
  };
  const google = pick('GOOGLE_SITE_VERIFICATION');
  const bing = pick('BING_SITE_VERIFICATION');
  return {
    name: 'seo-verification-meta',
    transformIndexHtml(html) {
      const tags = [
        google && `<meta name="google-site-verification" content="${google}" />`,
        bing && `<meta name="msvalidate.01" content="${bing}" />`,
      ].filter(Boolean).join('\n    ');
      return html.replace('<!-- seo:site-verification -->', tags || '<!-- seo:site-verification (미설정) -->');
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production' || process.env.NODE_ENV === 'production';
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/',
    plugins: [react(), tailwindcss(), seoVerificationMeta(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // [SECURITY] 프로덕션 빌드 보안 설정
    build: {
      sourcemap: false,
      target: 'es2020',
      minify: 'esbuild' as const,
    },
    esbuild: {
      drop: isProd ? (['console', 'debugger'] as const) : [],
    },
  };
});
