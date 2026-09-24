import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import Badge, { type Tone } from "./Badge";
import InfoTip from "./InfoTip";
import Skeleton from "./Skeleton";

export interface Trend {
  direction: "up" | "down" | "flat";
  text: string;
  /** Whether this direction is good news (colors the trend). */
  good?: boolean;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  status?: { tone: Tone; label: string };
  trend?: Trend;
  context?: ReactNode;
  explanation?: string;
  href?: string;
  loading?: boolean;
  className?: string;
}

/** A KPI tile: label, number, status, trend and one line of context. */
export default function MetricCard({ label, value, unit, icon, status, trend, context, explanation, href, loading, className }: MetricCardProps) {
  const TrendIcon = trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : Minus;
  const trendColor = trend?.good === undefined || trend.direction === "flat" ? "text-ink-muted" : trend.good ? "text-success" : "text-danger";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
          {explanation && <InfoTip text={explanation} label={`About ${label}`} />}
        </div>
        {icon && <span className="shrink-0 text-ink-subtle" aria-hidden="true">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 flex items-baseline gap-1 text-[28px] font-semibold leading-none tracking-tight tabular text-ink">
          {value}
          {unit && <span className="text-sm font-medium text-ink-muted">{unit}</span>}
        </p>
      )}
      <div className="mt-3 flex min-h-[22px] flex-wrap items-center gap-2">
        {status && <Badge tone={status.tone} dot>{status.label}</Badge>}
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular", trendColor)}>
            <TrendIcon size={14} aria-hidden="true" />
            {trend.text}
          </span>
        )}
      </div>
      {context && <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{context}</p>}
    </>
  );

  const classes = cn("surface block p-4 md:p-5", href && "transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-raised-lg", className);
  return href ? <Link to={href} className={classes}>{body}</Link> : <div className={classes}>{body}</div>;
}
