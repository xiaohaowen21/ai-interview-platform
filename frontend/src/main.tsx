import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n/I18nContext'
import './index.css'

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || '前端运行异常',
    }
  }

  componentDidCatch(error: Error) {
    console.error('Frontend render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
          <div className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-red-600">页面加载失败</h1>
            <p className="mt-3 break-all text-sm text-slate-700">{this.state.message}</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

(function initTheme() {
  try {
    const stored = window.localStorage.getItem('theme')
    const prefersDark =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
    const isDark = stored === 'dark' || (!stored && prefersDark)
    if (isDark) {
      document.documentElement.classList.add('dark')
    }
  } catch (error) {
    console.warn('Theme initialization skipped:', error)
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
