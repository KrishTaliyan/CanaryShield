import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useMocks } from "../api/client";
import type { Incident } from "../api/types";
import { useEventStream, useStreamConnected } from "../hooks/useEventStream";

const navigation = [
  { label: "Flags", href: "/" },
  { label: "Create flag", href: "/flags/new" },
  { label: "Incidents", href: "/incidents" },
  { label: "Playground", href: "/playground" },
];

const toastDurationMs = 4500;

export type ToastTone = "success" | "error" | "info";

/** Context that pages rendered in the layout's Outlet receive. */
export interface LayoutContext {
  notify: (message: string, tone?: ToastTone) => void;
}

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const toastStyles: Record<ToastTone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  error: "border-red-300 bg-red-50 text-red-900",
  info: "border-neutral-300 bg-white text-neutral-900",
};

function LiveIndicator() {
  const connected = useStreamConnected();
  if (useMocks) {
    return <span className="text-xs text-neutral-500">Mock data</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600" title={connected ? "Receiving live updates" : "Reconnecting; refreshing every 5 seconds"}>
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600" : "bg-amber-500"}`} aria-hidden="true" />
      {connected ? "Live" : "Polling"}
    </span>
  );
}

export default function Layout() {
  const location = useLocation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);
  const timers = useRef(new Set<number>());

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextToastId.current++;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, toastDurationMs);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEventStream({
    onIncident: (incident: Incident) => {
      if (incident.status === "open") {
        notify(`Guardian rolled back ${incident.flagKey}: ${incident.reason}`, "error");
      }
    },
  });

  const context: LayoutContext = { notify };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 md:flex">
      <aside className="border-b border-neutral-200 bg-white md:min-h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-neutral-200 px-5">
          <Link to="/" className="text-base font-semibold text-neutral-900">FlagGuard</Link>
          <LiveIndicator />
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          {navigation.map((item) => {
            const active = item.href === "/"
              ? location.pathname === "/" || (location.pathname.startsWith("/flags/") && location.pathname !== "/flags/new")
              : location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded px-3 py-2 text-sm font-medium ${
                  active ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet context={context} />
      </div>

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm shadow-lg ${toastStyles[toast.tone]}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span className="min-w-0 break-words">{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="shrink-0 rounded px-1 text-base leading-none opacity-60 hover:opacity-100"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              type="button"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
