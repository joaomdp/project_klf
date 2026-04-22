import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary]', error, info);
    const w = window as any;
    if (w.Sentry?.captureException) {
      w.Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#0F0F14] text-white">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <i className="fa-solid fa-triangle-exclamation text-red-400 text-3xl"></i>
          </div>
          <div className="space-y-2">
            <h1 className="font-orbitron font-black text-2xl uppercase tracking-tight">Algo deu errado</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Encontramos um erro inesperado. Tente recarregar a página. Se o problema continuar, entre em contato.
            </p>
          </div>
          {this.state.error?.message && (
            <pre className="text-[10px] text-gray-500 bg-black/40 border border-white/5 rounded-xl p-3 overflow-x-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-gradient-to-r from-[#3b82f6] to-[#8B5CF6] rounded-xl text-sm font-black uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Recarregar
            </button>
            <button
              onClick={this.handleHome}
              className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Início
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
