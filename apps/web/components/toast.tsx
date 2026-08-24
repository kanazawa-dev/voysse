"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_DISMISS_MS = 4500;
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const push = (type: ToastType, message: string) => {
      if (!message) return;
      const id = (counter += 1);
      // A successful action clears any lingering (unclosed) error toasts.
      setToasts((current) => [...(type === "success" ? current.filter((t) => t.type !== "error") : current), { id, type, message }]);
      // Success/info float and auto-dismiss; errors stay until closed.
      if (type !== "error") setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), AUTO_DISMISS_MS);
    };
    return {
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
      dismiss,
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
            <span className="toast-icon">
              {toast.type === "success" ? <CheckCircle2 size={18} /> : toast.type === "error" ? <AlertCircle size={18} /> : <Info size={18} />}
            </span>
            <span className="toast-message">{toast.message}</span>
            {toast.type === "error" && (
              <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Close">
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
