import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[RootErrorBoundary] Caught uncaught error:', error, errorInfo);

    // [청크 로드 실패 자동 감지 및 1회 새로고침]
    // Vite 재배포 후 구버전 해시 청크 404가 발생하면 자동으로 페이지 새로고침
    const isChunkError = 
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('error loading dynamically imported module');

    if (isChunkError) {
      const reloadKey = 'legal_crm_chunk_reload_attempt';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();

      // 무한 새로고침 루프 방지 (최근 15초 이내 새로고침 이력이 없을 때만 1회 실행)
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        console.warn('[RootErrorBoundary] Dynamic import chunk error detected. Auto-reloading page...');
        window.location.reload();
        return;
      }
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname;
  };

  private handleHardReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans text-left">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  화면을 불러오는 중 일시적인 오류가 발생했습니다
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  최신 업데이트가 반영되었거나 일시적 네트워크 지연일 수 있습니다.
                </p>
              </div>
            </div>

            {/* 에러 상세 (개발 및 디버깅 참고용 간략 출력) */}
            {this.state.error && (
              <div className="bg-slate-100 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-mono text-red-600 dark:text-red-400 break-all line-clamp-3">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                <ShieldAlert className="w-4 h-4" />
                <span>안심 안내</span>
              </div>
              <p>
                작성 중이던 상담 정보나 가명 보호 데이터는 안전하게 보존되어 있습니다. 아래 새로고침 버튼을 누르면 정상적으로 복구됩니다.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleHardReload}
                className="flex-1 py-3.5 px-4 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>페이지 새로고침</span>
              </button>
              <button
                onClick={this.handleReset}
                className="py-3.5 px-5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Home className="w-4 h-4" />
                <span>처음으로 이동</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
