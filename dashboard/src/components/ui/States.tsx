import { CloudOff, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import Button from "./Button";
import Spinner from "./Spinner";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Friendly "nothing here yet" with the next step. */
export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-card bg-surface-2 text-ink-subtle shadow-raised-sm" aria-hidden="true">
        {icon ?? <Inbox size={22} />}
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

/** Something failed: say what, and offer a retry. */
export function ErrorState({ title = "Something went wrong", message, onRetry, retrying, compact, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-card bg-danger-soft text-danger" aria-hidden="true">
        <CloudOff size={22} />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <Button className="mt-5" size="sm" icon={<RotateCw size={14} />} loading={retrying} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Centered spinner with a label, for short waits. */
export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2.5 py-12 text-sm text-ink-muted", className)}>
      <Spinner size={18} />
      {label}
    </div>
  );
}
