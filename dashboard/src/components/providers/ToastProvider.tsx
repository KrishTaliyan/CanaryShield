import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ToastContext, type ToastOptions, type ToastTone } from "../../lib/contexts";

interface ToastItem extends ToastOptions {
  id: number;
}

const icons: Record<ToastTone, typeof Info> = { success: CheckCircle2, error: OctagonAlert, warning: AlertTriangle, info: Info };
const accents: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};
const bars: Record<ToastTone, string> = {
  success: "bg-success",
  error: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

/** Non-intrusive notifications in the bottom-right corner. */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const item = { ...options, tone: options.tone ?? "success", id };
    setToasts((current) => [...current.slice(-3), item]);
    const timer = window.setTimeout(() => dismiss(id), item.tone === "error" ? 8000 : 5000);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5">
        {toasts.map((item) => {
          const tone = item.tone ?? "success";
          const Icon = icons[tone];
          return (
            <div
              key={item.id}
              role={tone === "error" ? "alert" : "status"}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border border-line bg-surface-2 py-3.5 pl-5 pr-3 shadow-float animate-rise-in"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", bars[tone])} aria-hidden="true" />
              <Icon size={18} className={cn("mt-0.5 shrink-0", accents[tone])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.description && <div className="mt-0.5 break-words text-[13px] text-ink-muted">{item.description}</div>}
                {item.action && (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="mt-2 text-[13px] font-semibold text-accent hover:underline"
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)} className="shrink-0 rounded-md p-1 text-ink-subtle hover:text-ink">
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
