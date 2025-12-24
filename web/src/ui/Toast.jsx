import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from './cn';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, ...t }]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[92vw] flex-col gap-2 outline-none" />
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            open
            duration={t.durationMs ?? 3500}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            className={cn(
              'rounded-xl border border-black/10 bg-white p-3 shadow-sm',
              t.variant === 'error' && 'border-red-600/30',
            )}
          >
            <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>
            {t.description ? (
              <ToastPrimitive.Description className="mt-1 text-sm text-black/70">
                {t.description}
              </ToastPrimitive.Description>
            ) : null}
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
