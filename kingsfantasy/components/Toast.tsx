import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);

    // Auto-remove após duração (padrão: 5s)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const config = {
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: 'fa-circle-check',
      iconColor: 'text-emerald-400',
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]'
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'fa-circle-xmark',
      iconColor: 'text-red-400',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]'
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      icon: 'fa-triangle-exclamation',
      iconColor: 'text-amber-400',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'fa-circle-info',
      iconColor: 'text-blue-400',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.2)]'
    }
  };

  const style = config[toast.type] || config.info; // Fallback para 'info' se tipo inválido

  return (
    <div 
      className={`glass-card rounded-2xl p-5 border ${style.border} ${style.bg} ${style.glow} animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-2xl`}
    >
      <div className="flex items-start gap-4">
        {/* Ícone */}
        <div className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center shrink-0`}>
          <i className={`fa-solid ${style.icon} ${style.iconColor} text-lg`}></i>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm mb-1">{toast.title}</h3>
          {toast.message && (
            <p className="text-xs text-gray-400 leading-relaxed">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`mt-3 text-xs font-bold uppercase tracking-widest ${style.iconColor} hover:underline`}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Botão de fechar */}
        <button
          onClick={() => onRemove(toast.id)}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shrink-0"
        >
          <i className="fa-solid fa-xmark text-gray-500 text-sm"></i>
        </button>
      </div>
    </div>
  );
};
