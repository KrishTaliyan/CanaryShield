import type { Health, HealthStatus } from "../api/types";
import { useFlagHealth } from "../hooks/useFlag";

const styles: Record<HealthStatus, string> = {
  HEALTHY: "bg-emerald-100 text-emerald-900",
  WARNING: "bg-amber-100 text-amber-900",
  BREACHED: "bg-red-600 text-white",
  INSUFFICIENT_DATA: "bg-sky-100 text-sky-900",
  NOT_MONITORED: "bg-neutral-100 text-neutral-600",
};

const labels: Record<HealthStatus, string> = {
  HEALTHY: "Healthy",
  WARNING: "Warning",
  BREACHED: "Breached",
  INSUFFICIENT_DATA: "Insufficient data",
  NOT_MONITORED: "Not monitored",
};

function percent(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function Details({ health }: { health: Health }) {
  if (health.status === "NOT_MONITORED") {
    return <p>The guardian is not watching this flag.</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
      <dt className="text-neutral-400">Canary errors</dt><dd className="text-right tabular-nums">{percent(health.canaryErrorRate)}</dd>
      <dt className="text-neutral-400">Baseline errors</dt><dd className="text-right tabular-nums">{percent(health.baselineErrorRate)}</dd>
      <dt className="text-neutral-400">Threshold</dt><dd className="text-right tabular-nums">{percent(health.threshold)}</dd>
      <dt className="text-neutral-400">Samples</dt><dd className="text-right tabular-nums">{health.samples}</dd>
      <dt className="text-neutral-400">Breaches</dt><dd className="text-right tabular-nums">{health.breachCount}</dd>
      {health.checkedAt && (
        <>
          <dt className="text-neutral-400">Checked</dt>
          <dd className="text-right tabular-nums">{new Date(health.checkedAt).toLocaleTimeString("en-IN")}</dd>
        </>
      )}
    </dl>
  );
}

interface HealthBadgeProps {
  flagKey: string;
  /** Status to show until the first health response arrives. */
  fallbackStatus: HealthStatus;
}

/** Health status coloured by severity, with the guardian's numbers in a tooltip. */
export default function HealthBadge({ flagKey, fallbackStatus }: HealthBadgeProps) {
  const healthQuery = useFlagHealth(flagKey);
  const health = healthQuery.data;
  const status = health?.status ?? fallbackStatus;

  return (
    <span className="group relative inline-flex">
      <span
        aria-label={`Health: ${labels[status]}`}
        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${styles[status]}`}
        tabIndex={0}
      >
        {status === "BREACHED" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}
        {labels[status]}
      </span>
      {health && (
        <span
          className="invisible absolute left-0 top-full z-30 mt-1.5 w-56 rounded bg-neutral-900 p-3 text-xs text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          role="tooltip"
        >
          <Details health={health} />
        </span>
      )}
    </span>
  );
}
