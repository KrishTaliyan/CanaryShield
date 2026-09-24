import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import InfoTip from "./InfoTip";
import { EmptyState, ErrorState } from "./States";

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
  /** Small colored square instead of a line (areas, bars). */
  swatch?: boolean;
}

interface ChartContainerProps {
  title: string;
  subtitle?: ReactNode;
  explanation?: string;
  legend?: LegendItem[];
  actions?: ReactNode;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

/** Card for a chart: title, context, legend and every data state. */
export default function ChartContainer({
  title,
  subtitle,
  explanation,
  legend,
  actions,
  height = 260,
  loading,
  error,
  onRetry,
  empty,
  emptyMessage,
  children,
  className,
  footer,
}: ChartContainerProps) {
  return (
    <figure className={cn("surface flex min-w-0 flex-col p-4 md:p-5", className)}>
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
            {explanation && <InfoTip text={explanation} label={`About ${title}`} />}
          </div>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
        </div>
        {actions}
      </figcaption>
      {legend && legend.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label={`${title} legend`}>
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
              {item.swatch ? (
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
              ) : (
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="1" y1="4" x2="21" y2="4" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={item.dashed ? "4 3" : undefined} />
                </svg>
              )}
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div style={{ height }} className="relative min-w-0">
        {loading ? (
          <div className="skeleton h-full w-full rounded-control" aria-busy="true" aria-label={`Loading ${title}`} />
        ) : error ? (
          <ErrorState compact title="Chart unavailable" message={error} onRetry={onRetry} className="h-full py-0" />
        ) : empty ? (
          <EmptyState compact title="No data in this range" description={emptyMessage} className="h-full py-0" />
        ) : (
          children
        )}
      </div>
      {footer && <div className="mt-3 border-t border-line/70 pt-3 text-[12.5px] text-ink-muted">{footer}</div>}
    </figure>
  );
}
