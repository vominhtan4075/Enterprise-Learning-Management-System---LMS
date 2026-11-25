'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
  }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'info',
    }: {
      title: string;
      description?: string;
      variant?: ToastVariant;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ title, description, variant: 'success' }),
      error: (title, description) =>
        toast({ title, description, variant: 'error' }),
      warning: (title, description) =>
        toast({ title, description, variant: 'warning' }),
      info: (title, description) =>
        toast({ title, description, variant: 'info' }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
      >
        {items.map((item) => {
          const styles: Record<ToastVariant, string> = {
            success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
            error: 'bg-rose-50 border-rose-200 text-rose-950',
            warning: 'bg-amber-50 border-amber-200 text-amber-950',
            info: 'bg-sky-50 border-sky-200 text-sky-950',
          };
          const icons: Record<ToastVariant, React.ReactNode> = {
            success: (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5"
                strokeWidth={1.75}
              />
            ),
            error: (
              <AlertCircle
                className="h-4 w-4 shrink-0 text-rose-700 mt-0.5"
                strokeWidth={1.75}
              />
            ),
            warning: (
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-amber-700 mt-0.5"
                strokeWidth={1.75}
              />
            ),
            info: (
              <Info
                className="h-4 w-4 shrink-0 text-sky-700 mt-0.5"
                strokeWidth={1.75}
              />
            ),
          };
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm ${styles[item.variant]}`}
            >
              {icons[item.variant]}
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs opacity-85 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 opacity-60 hover:opacity-100"
                aria-label="Đóng thông báo"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
