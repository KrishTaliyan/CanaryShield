import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { getChaos, startChaos, stopChaos } from "../api/chaos";
import type { ChaosConfig, ChaosRequest } from "../api/types";
import type { LayoutContext } from "./Layout";

const syncMs = 5000;
const inputClass = "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function formatCountdown(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Injects failures into QuickCart's new payment flow (v2 only) for the demo. */
export default function ChaosPanel() {
  const { notify } = useOutletContext<LayoutContext>();
  const queryClient = useQueryClient();
  const [errorPercent, setErrorPercent] = useState(40);
  const [latencyMs, setLatencyMs] = useState("0");
  const [latencyPercent, setLatencyPercent] = useState(0);
  const [durationSec, setDurationSec] = useState("120");
  const [confirming, setConfirming] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const chaosQuery = useQuery({ queryKey: ["chaos"], queryFn: getChaos, refetchInterval: syncMs });
  const chaos = chaosQuery.data;
  const remaining = chaos?.active && chaos.activeUntil ? Date.parse(chaos.activeUntil) - now : 0;
  const active = Boolean(chaos?.active) && remaining > 0;

  // Tick the countdown; the 5-second sync picks up the expiry from QuickCart.
  useEffect(() => {
    if (!chaos?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [chaos?.active]);

  function saved(config: ChaosConfig, message: string) {
    queryClient.setQueryData(["chaos"], config);
    setNow(Date.now());
    notify(message, config.active ? "info" : "success");
  }

  const start = useMutation({
    mutationFn: (input: ChaosRequest) => startChaos(input),
    onSuccess: (config) => {
      setConfirming(false);
      saved(config, `Chaos started: ${Math.round(config.errorRate * 100)}% of new-flow payments will fail`);
    },
  });
  const stop = useMutation({
    mutationFn: stopChaos,
    onSuccess: (config) => saved(config, "Chaos stopped"),
    onError: (error) => notify(error.message, "error"),
  });

  function compile(): ChaosRequest {
    const latency = Number(latencyMs);
    const duration = Number(durationSec);
    if (!Number.isInteger(latency) || latency < 0 || latency > 5000) {
      throw new Error("Latency must be a whole number of milliseconds from 0 to 5000.");
    }
    if (!Number.isInteger(duration) || duration < 10 || duration > 600) {
      throw new Error("Duration must be a whole number of seconds from 10 to 600.");
    }
    return { errorRate: errorPercent / 100, latencyMs: latency, latencyRate: latencyPercent / 100, durationSec: duration };
  }

  function requestStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      compile();
      setValidationError(null);
      start.reset();
      setConfirming(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Check the chaos settings.");
    }
  }

  const busy = start.isPending || stop.isPending;

  return (
    <section aria-labelledby="chaos-heading" className="border-y border-neutral-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950" id="chaos-heading">Chaos</h2>
          <p className="mt-1 text-sm text-neutral-600">Makes QuickCart&apos;s new payment flow fail. The old flow is never affected.</p>
        </div>
        {chaosQuery.isError ? (
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">QuickCart unreachable</span>
        ) : active ? (
          <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
            Active · ends in <span className="tabular-nums">{formatCountdown(remaining)}</span>
          </span>
        ) : (
          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">Off</span>
        )}
      </div>

      {active && chaos && (
        <p className="mt-3 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-900">
          {Math.round(chaos.errorRate * 100)}% of new-flow payments fail
          {chaos.latencyMs > 0 && chaos.latencyRate > 0 && `, ${Math.round(chaos.latencyRate * 100)}% get +${chaos.latencyMs} ms`}.
        </p>
      )}
      {chaosQuery.isError && (
        <p className="mt-3 text-sm text-red-800" role="alert">{chaosQuery.error.message}</p>
      )}

      <form className="mt-4 space-y-4" onSubmit={requestStart}>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-sm font-medium text-neutral-800" htmlFor="chaos-error-rate">Error rate</label>
            <span className="text-sm font-semibold tabular-nums text-neutral-900">{errorPercent}%</span>
          </div>
          <input
            className="w-full accent-red-600"
            id="chaos-error-rate"
            max={100}
            min={0}
            onChange={(event) => setErrorPercent(Number(event.target.value))}
            step={5}
            type="range"
            value={errorPercent}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="chaos-latency">Extra latency (ms)</label>
            <input className={inputClass} id="chaos-latency" inputMode="numeric" onChange={(event) => setLatencyMs(event.target.value)} value={latencyMs} />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-sm font-medium text-neutral-800" htmlFor="chaos-latency-rate">Latency rate</label>
              <span className="text-sm tabular-nums text-neutral-700">{latencyPercent}%</span>
            </div>
            <input
              className="mt-2 w-full accent-amber-600"
              id="chaos-latency-rate"
              max={100}
              min={0}
              onChange={(event) => setLatencyPercent(Number(event.target.value))}
              step={5}
              type="range"
              value={latencyPercent}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="chaos-duration">Duration (s)</label>
            <input className={inputClass} id="chaos-duration" inputMode="numeric" onChange={(event) => setDurationSec(event.target.value)} value={durationSec} />
          </div>
        </div>

        {(validationError || start.error) && (
          <p className="text-sm text-red-800" role="alert">{validationError ?? start.error?.message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || chaosQuery.isError}
            type="submit"
          >{active ? "Restart chaos" : "Start chaos"}</button>
          <button
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || !active}
            onClick={() => stop.mutate()}
            type="button"
          >{stop.isPending ? "Stopping…" : "Stop"}</button>
        </div>
      </form>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !start.isPending) setConfirming(false);
        }}>
          <section aria-labelledby="chaos-dialog-title" aria-modal="true" className="w-full max-w-md rounded border border-neutral-200 bg-white p-5 shadow-xl" role="alertdialog">
            <h3 className="text-lg font-semibold text-neutral-950" id="chaos-dialog-title">Start chaos?</h3>
            <p className="mt-3 text-sm text-neutral-700">
              {errorPercent}% of payments on the new flow will fail for {durationSec} seconds. Users on the old flow are not affected.
            </p>
            {start.error && <p className="mt-2 text-sm text-red-800" role="alert">{start.error.message}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border border-neutral-300 px-3 py-2 text-sm" disabled={start.isPending} onClick={() => setConfirming(false)} type="button">Cancel</button>
              <button
                autoFocus
                className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={start.isPending}
                onClick={() => start.mutate(compile())}
                type="button"
              >{start.isPending ? "Starting…" : "Start chaos"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
