import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type ProgressTone = "accent" | "success" | "warning" | "danger" | "primary" | "neutral";

const bar: Record<ProgressTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  primary: "bg-primary",
  neutral: "bg-ink-subtle",
};

const stroke: Record<ProgressTone, string> = {
  accent: "rgb(var(--accent))",
  success: "rgb(var(--success))",
  warning: "rgb(var(--warning))",
  danger: "rgb(var(--danger))",
  primary: "rgb(var(--primary))",
  neutral: "rgb(var(--text-subtle))",
};

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: "xs" | "sm" | "md" | "lg";
  label: string;
  /** Tick marks along the track, e.g. rollout steps. */
  markers?: number[];
  showMarkerLabels?: boolean;
  className?: string;
}

const heights = { xs: "h-1.5", sm: "h-2", md: "h-3", lg: "h-4" };

/** Sunken track with a filled bar; width animates on change. */
export function ProgressBar({ value, max = 100, tone = "accent", size = "sm", label, markers, showMarkerLabels, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn("relative w-full overflow-hidden rounded-full bg-sunken shadow-inset-sm", heights[size])}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-soft", bar[tone])} style={{ width: `${pct}%` }} />
        {markers?.map((marker) => (
          <span
            key={marker}
            aria-hidden="true"
            className={cn("absolute top-0 h-full w-px", marker <= value ? "bg-surface/70" : "bg-line-strong/70")}
            style={{ left: `${(marker / max) * 100}%` }}
          />
        ))}
      </div>
      {markers && showMarkerLabels && (
        <div className="relative mt-1.5 h-4 text-[11px] tabular text-ink-subtle" aria-hidden="true">
          {[0, ...markers].map((marker) => (
            <span
              key={marker}
              className={cn("absolute -translate-x-1/2", marker <= value && "font-semibold text-ink-muted")}
              style={{ left: `${(marker / max) * 100}%` }}
            >
              {marker}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  tone?: ProgressTone;
  label: string;
  children?: ReactNode;
  className?: string;
}

/** Circular progress (used for rollout % and the health score). */
export function ProgressRing({ value, max = 100, size = 120, thickness = 10, tone = "accent", label, children, className }: ProgressRingProps) {
  const radius = (size - thickness) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <span className="absolute inset-0 rounded-full bg-surface shadow-raised-sm" aria-hidden="true" />
      <span className="absolute rounded-full bg-sunken shadow-inset-sm" style={{ inset: thickness / 2 + 4 }} aria-hidden="true" />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" style={{ stroke: "rgb(var(--sunken))" }} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ stroke: stroke[tone], transition: "stroke-dashoffset 700ms var(--ease-soft), stroke 300ms" }}
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
