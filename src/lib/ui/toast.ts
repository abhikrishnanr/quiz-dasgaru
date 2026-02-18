export type ToastLevel = 'info' | 'error' | 'success' | 'warning';

export type ToastPayload = {
  title: string;
  message?: string;
  level?: ToastLevel;
};

const TOAST_EVENT_NAME = 'quiz-toast';

export const toastEventName = TOAST_EVENT_NAME;

export function emitToast(payload: ToastPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}
