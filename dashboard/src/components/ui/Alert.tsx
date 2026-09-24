import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const styles: Record<AlertTone, string> = {
  info: "border-info/30 bg-info-soft/70 text-info",
  success: "border-success/30 bg-success-soft/70 text-success",
  warning: "border-warning/35 bg-warning-soft/70 text-warning",
  danger: "border-danger/35 bg-danger-soft/70 text-danger",
};

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert };

interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  icon?: ReactNode;
}

/** Inline message with an icon, a title and optional actions. */
export default function Alert({ tone = "info", title, children, action, onDismiss, className, icon }: AlertProps) {
  const Icon = icons[tone];
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-card border px-4 py-3.5", styles[tone], className)}>
      <span className="mt-0.5 shrink-0" aria-hidden="true">{icon ?? <Icon size={18} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-sm text-ink-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-mr-1 shrink-0 rounded-md p-1 opacity-70 hover:opacity-100">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
