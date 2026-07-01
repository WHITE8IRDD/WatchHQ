import React, { Component } from 'react';

interface State {
  hasError: boolean;
  message?: string;
  stack?: string;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message, stack: error.stack };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught:', error.message, info.componentStack);
    try {
      localStorage.setItem('watchhq_lastError', JSON.stringify({ message: error.message, stack: error.stack, componentStack: info.componentStack, time: new Date().toISOString() }));
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-textPrimary gap-4 px-8">
          <div className="w-16 h-16 rounded-full bg-state-error/10 flex items-center justify-center mb-2">
            <span className="text-state-error text-3xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-textSecondary text-sm text-center max-w-md">{this.state.message || 'An unexpected error occurred'}</p>
          {this.state.stack && (
            <details className="text-xs text-textSecondary max-w-lg max-h-40 overflow-auto bg-black/30 rounded-lg p-3">
              <summary className="cursor-pointer hover:text-white">Stack trace</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.stack}</pre>
            </details>
          )}
          <div className="flex gap-3 mt-2">
            <button onClick={() => window.location.reload()} className="px-5 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-colors">Reload</button>
            <button onClick={() => { localStorage.removeItem('watchhq_lastError'); this.setState({ hasError: false, message: undefined, stack: undefined }); }} className="px-5 py-2 border border-border rounded-xl text-sm text-white hover:bg-white/5 transition-colors">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
