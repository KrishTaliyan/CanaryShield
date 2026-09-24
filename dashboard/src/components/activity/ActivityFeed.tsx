import { Bot, User } from "lucide-react";
import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { cn } from "../../lib/cn";
import { actorLabel, eventConfig, percentageChange } from "../../lib/events";
import { formatDateTime, formatRelative } from "../../lib/format";
import Badge from "../ui/Badge";
import Tooltip from "../ui/Tooltip";

const iconTone = {
  neutral: "bg-surface-2 text-ink-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  primary: "bg-primary/10 text-primary",
};

interface ActivityFeedProps {
  events: Event[];
  /** Show which flag each event belongs to (for cross-flag feeds). */
  showFlag?: boolean;
  compact?: boolean;
  className?: string;
}

/** Audit trail of rollout events, newest first; guardian actions stand out. */
export default function ActivityFeed({ events, showFlag, compact, className }: ActivityFeedProps) {
  return (
    <ol className={cn("relative", className)}>
      {events.map((event, index) => {
        const config = eventConfig[event.type] ?? { label: event.type, icon: User, tone: "neutral" as const };
        const Icon = config.icon;
        const guardian = event.actor === "system:guardian";
        const change = percentageChange(event);
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className="absolute left-[17px] top-9 bottom-0 w-px bg-line" aria-hidden="true" />}
            <span className={cn("relative z-[1] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-raised-sm", iconTone[config.tone])} aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className={cn("min-w-0 flex-1 rounded-control px-3 py-2", guardian ? "border border-danger/25 bg-danger-soft/40" : compact ? "" : "bg-surface-2/50")}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-semibold text-ink">
                  {config.label}
                  {change && <span className="ml-2 font-medium tabular text-ink-muted">{change}</span>}
                </p>
                <Tooltip content={formatDateTime(event.createdAt, true)}>
                  <time dateTime={event.createdAt} className="text-xs tabular text-ink-subtle" tabIndex={0}>{formatRelative(event.createdAt)}</time>
                </Tooltip>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                {showFlag && (
                  <Link to={`/flags/${encodeURIComponent(event.flagKey)}`} className="font-mono font-medium text-accent hover:underline">
                    {event.flagKey}
                  </Link>
                )}
                {guardian ? (
                  <Badge tone="danger" icon={<Bot size={12} aria-hidden="true" />}>{actorLabel(event)}</Badge>
                ) : (
                  <span className="inline-flex items-center gap-1"><User size={12} aria-hidden="true" />{actorLabel(event)}</span>
                )}
              </div>
              {event.reason && !compact && <p className="mt-1.5 text-[13px] text-ink-muted">{event.reason}</p>}
              {event.reason && compact && <p className="mt-1 truncate text-xs text-ink-muted" title={event.reason}>{event.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
