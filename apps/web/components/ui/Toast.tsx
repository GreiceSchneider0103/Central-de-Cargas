'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'warning' | 'error';
type ToastItem = { id: number; type: ToastType; message: string };

type ToastApi = {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICON: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const TONE_CLASSES: Record<ToastType, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  error: 'bg-rose-50 text-rose-800 border-rose-200',
};

const ICON_CLASSES: Record<ToastType, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-rose-500',
};

const DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), DURATION_MS);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (message) => push('success', message),
    warning: (message) => push('warning', message),
    error: (message) => push('error', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
            {items.map((t) => {
              const Icon = ICON[t.type];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border p-3 text-sm shadow-popover',
                    TONE_CLASSES[t.type],
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', ICON_CLASSES[t.type])} />
                  <p className="flex-1">{t.message}</p>
                  <button aria-label="Fechar" onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}
