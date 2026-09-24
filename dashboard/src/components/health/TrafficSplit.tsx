import { formatRps } from "../../lib/format";

interface TrafficSplitProps {
  /** Requests per second on the new version, or null without data. */
  canaryRps: number | null;
  baselineRps: number | null;
  /** The configured rollout percentage, for comparison. */
  rolloutPercentage?: number;
  size?: number;
}

/** Donut of the measured traffic split between canary and baseline. */
export default function TrafficSplit({ canaryRps, baselineRps, rolloutPercentage, size = 132 }: TrafficSplitProps) {
  const total = (canaryRps ?? 0) + (baselineRps ?? 0);
  const share = total > 0 ? (canaryRps ?? 0) / total : null;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={share === null ? "No traffic measured" : `${Math.round(share * 100)}% of measured traffic on the canary`}
        className="-rotate-90"
      >
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="12" style={{ stroke: share === null ? "rgb(var(--sunken))" : "rgb(var(--baseline) / 0.55)" }} />
        {share !== null && share > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeDasharray={`${circumference * share} ${circumference}`}
            style={{ stroke: "rgb(var(--canary))", transition: "stroke-dasharray 700ms var(--ease-soft)" }}
          />
        )}
        <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" className="fill-ink text-[15px] font-semibold tabular">
          {share === null ? "—" : `${Math.round(share * 100)}%`}
        </text>
      </svg>
      <dl className="min-w-0 space-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-canary" aria-hidden="true" />
          <dt className="text-ink-muted">Canary</dt>
          <dd className="ml-auto pl-3 font-semibold tabular text-ink">{formatRps(canaryRps)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-baseline/60" aria-hidden="true" />
          <dt className="text-ink-muted">Baseline</dt>
          <dd className="ml-auto pl-3 font-semibold tabular text-ink">{formatRps(baselineRps)}</dd>
        </div>
        {rolloutPercentage !== undefined && (
          <div className="flex items-center gap-2 border-t border-line/70 pt-2">
            <dt className="text-ink-muted">Configured rollout</dt>
            <dd className="ml-auto pl-3 font-semibold tabular text-ink">{rolloutPercentage}%</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
