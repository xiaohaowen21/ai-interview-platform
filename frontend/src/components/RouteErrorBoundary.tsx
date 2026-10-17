import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface RouteErrorBoundaryProps {
  /** 路由变化时传入新的 key，切换页面即可自动清除错误状态 */
  resetKey: string;
  homePath: string;
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * 页面级错误边界：某个页面渲染出错时只替换内容区，侧边栏和导航保持可用。
 */
export default class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page render error:', error, info.componentStack);
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div role="alert" className="mx-auto mt-10 max-w-xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/60 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">这个页面出了点问题</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              可以重试一次，或先回到首页继续使用其他功能。
            </p>
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer select-none">错误详情</summary>
              <p className="mt-2 break-all font-mono">{error.message || String(error)}</p>
            </details>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </button>
              <a
                href={this.props.homePath}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Home className="h-4 w-4" />
                回到首页
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
