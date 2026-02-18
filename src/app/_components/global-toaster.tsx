'use client';

import { toastEventName, type ToastPayload } from '@/src/lib/ui/toast';
import { useEffect, useState } from 'react';

type ToastItem = ToastPayload & { id: number };

const TOAST_TTL_MS = 4_000;

export function GlobalToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let toastId = 0;

    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastPayload>;
      const payload = customEvent.detail;
      if (!payload?.title) {
        return;
      }

      toastId += 1;
      const nextId = toastId;

      setToasts((prev) => [...prev, { ...payload, id: nextId }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== nextId));
      }, TOAST_TTL_MS);
    };

    window.addEventListener(toastEventName, onToast);
    return () => window.removeEventListener(toastEventName, onToast);
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const palette = toast.level === 'error'
          ? 'border-rose-300 bg-rose-50 text-rose-900'
          : 'border-slate-200 bg-white text-slate-900';

        return (
          <article
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg ${palette}`}
            role="status"
            aria-live="polite"
          >
            <h3 className="text-sm font-semibold">{toast.title}</h3>
            {toast.message && <p className="mt-1 text-sm">{toast.message}</p>}
          </article>
        );
      })}
    </div>
  );
}
