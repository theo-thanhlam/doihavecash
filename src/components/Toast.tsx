"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Tone = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; tone: Tone; message: string };
type ToastApi = Record<Tone, (message: string) => void>;

const toneClass: Record<Tone, string> = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
  warning: "alert-warning",
};

const DISMISS_MS = 4000;
const ToastContext = createContext<ToastApi | null>(null);

/** Wrap the app once (root layout). Then call useToast().success("Saved") anywhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (tone: Tone, message: string) => {
      const id = Date.now() + Math.random();
      setItems((all) => [...all, { id, tone, message }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => show("success", m),
      error: (m) => show("error", m),
      info: (m) => show("info", m),
      warning: (m) => show("warning", m),
    }),
    [show],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        className="toast toast-end toast-bottom z-50"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div key={t.id} className={`alert ${toneClass[t.tone]}`}>
            <span>{t.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
