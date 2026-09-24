import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { Tone } from "./Badge";

export interface TimelineItem {
  id: string | number;
  title: ReactNode;
  time?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  highlight?: boolean;
}

const dotTone: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  primary: "bg-primary/10 text-primary",
};

/** Vertical timeline with icon nodes; highlighted items get a tinted card. */
export default function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {index < items.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-line" aria-hidden="true" />}
          <span
            className={cn(
              "relative z-[1] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line/70 shadow-raised-sm",
              dotTone[item.tone ?? "neutral"],
            )}
            aria-hidden="true"
          >
            {item.icon}
          </span>
          <div className={cn("min-w-0 flex-1 pt-1", item.highlight && "-mt-0.5 rounded-control border border-danger/25 bg-danger-soft/40 px-3 py-2")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              {item.time && <span className="text-xs tabular text-ink-subtle">{item.time}</span>}
            </div>
            {item.meta && <div className="mt-0.5 text-xs text-ink-muted">{item.meta}</div>}
            {item.description && <div className="mt-1 text-sm text-ink-muted">{item.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
