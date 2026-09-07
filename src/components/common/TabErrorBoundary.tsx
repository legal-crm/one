import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  tabName?: string;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[TabErrorBoundary:${this.props.tabName || 'tab'}] Error caught:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-4xl mx-auto py-12 px-4 text-left">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-lg space-y-5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto sm:mx-0 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {this.props.tabName || '해당 메뉴'}를 불러오는 중 문제가 발생했습니다
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  데이터 연동 중 일시적인 지연이 발생했거나 일시적 오류일 수 있습니다.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 text-left">
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>다시 시도</span>
              </button>
              {this.props.onNavigateHome && (
                <button
                  type="button"
                  onClick={this.props.onNavigateHome}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>홈으로 이동</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
