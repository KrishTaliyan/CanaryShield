import { useState, type FormEvent } from "react";
import type { Flag } from "../api/types";
import type { FlagAction } from "../hooks/useFlag";

interface RolloutRingProps {
  flag: Flag;
  isPending: boolean;
  error: string | null;
  onAction: (action: FlagAction) => Promise<unknown>;
}

const percentages = [5, 10, 25, 50, 100];

export default function RolloutRing({ flag, isPending, error, onAction }: RolloutRingProps) {
  const [dialog, setDialog] = useState<"rollback" | "kill" | null>(null);
  const [reason, setReason] = useState("");
  const canStart = flag.status === "draft" || flag.status === "rolled_back";
  const canAdvance = flag.status === "rolling_out" && flag.rolloutSteps.some((step) => step > flag.rolloutPercentage);
  const canSet = flag.status === "rolling_out" || flag.status === "paused";
  const canPause = flag.status === "rolling_out";
  const canResume = flag.status === "paused";
  const canRollback = flag.status === "rolling_out" || flag.status === "paused" || flag.status === "completed";
  const percentage = Math.min(100, Math.max(0, flag.rolloutPercentage));
  const circumference = 2 * Math.PI * 42;

  function run(action: FlagAction) {
    void onAction(action).catch(() => undefined);
  }

  async function confirmDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog === "rollback") {
      try {
        await onAction({ type: "rollback", reason: reason.trim() });
        setDialog(null);
        setReason("");
      } catch {
        return;
      }
    } else if (dialog === "kill") {
      try {
        await onAction({ type: "kill" });
        setDialog(null);
      } catch {
        return;
      }
    }
  }

  return (
    <section className="border-y border-neutral-200 bg-white p-5 md:p-6" aria-labelledby="rollout-heading">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5">
          <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`${percentage}% rollout`}>
            <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#047857"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percentage / 100)}
                strokeLinecap="round"
                strokeWidth="8"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-neutral-950">{percentage}%</span>
              <span className="text-xs text-neutral-500">rollout</span>
            </div>
          </div>
          <div>
            <h2 id="rollout-heading" className="text-lg font-semibold text-neutral-950">Rollout controls</h2>
            <p className="mt-1 text-sm text-neutral-600">Status: <span className="font-medium text-neutral-900">{flag.status.replace("_", " ")}</span></p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">Set percentage</p>
          <div className="flex flex-wrap gap-2">
            {percentages.map((step) => (
              <button
                key={step}
                aria-pressed={flag.rolloutPercentage === step}
                className={`min-w-14 rounded border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  flag.rolloutPercentage === step
                    ? "border-emerald-800 bg-emerald-800 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                }`}
                disabled={!canSet || isPending}
                onClick={() => run({ type: "set", percentage: step })}
                type="button"
              >
                {step}%
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canStart || isPending}
              onClick={() => run({ type: "rollout", action: "start" })}
              type="button"
            >Start</button>
            <button
              className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canAdvance || isPending}
              onClick={() => run({ type: "rollout", action: "advance" })}
              type="button"
            >Advance</button>
            {canPause || canResume ? (
              <button
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isPending}
                onClick={() => run({ type: "rollout", action: canPause ? "pause" : "resume" })}
                type="button"
              >{canPause ? "Pause" : "Resume"}</button>
            ) : null}
            <button
              className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canRollback || isPending}
              onClick={() => setDialog("rollback")}
              type="button"
            >Rollback</button>
            <button
              className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isPending}
              onClick={() => setDialog("kill")}
              type="button"
            >Kill</button>
          </div>
          {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) setDialog(null);
        }}>
          <section aria-labelledby="rollout-dialog-title" aria-modal="true" className="w-full max-w-md rounded border border-neutral-200 bg-white p-5 shadow-xl" role="alertdialog">
            <h3 id="rollout-dialog-title" className="text-lg font-semibold text-neutral-950">
              {dialog === "rollback" ? "Roll back flag" : "Kill flag"}
            </h3>
            {dialog === "rollback" ? (
              <form className="mt-4" onSubmit={confirmDialog}>
                <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="rollback-reason">Reason</label>
                <textarea
                  autoFocus
                  className="min-h-24 w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                  id="rollback-reason"
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
                {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button className="rounded border border-neutral-300 px-3 py-2 text-sm" disabled={isPending} onClick={() => setDialog(null)} type="button">Cancel</button>
                  <button className="rounded bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isPending || reason.trim().length === 0} type="submit">{isPending ? "Rolling back…" : "Roll back"}</button>
                </div>
              </form>
            ) : (
              <form className="mt-4" onSubmit={confirmDialog}>
                <p className="text-sm text-neutral-700">This turns the flag off and resets its rollout to 0%.</p>
                {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button className="rounded border border-neutral-300 px-3 py-2 text-sm" disabled={isPending} onClick={() => setDialog(null)} type="button">Cancel</button>
                  <button className="rounded bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isPending} type="submit">{isPending ? "Killing…" : "Kill flag"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
