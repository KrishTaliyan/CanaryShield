import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "article" | "div";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  tone?: "default" | "danger" | "warning" | "success" | "accent";
}

const paddings = { none: "", sm: "p-4", md: "p-5 md:p-6", lg: "p-6 md:p-8" };
const tones = {
  default: "",
  danger: "border-danger/40 bg-danger-soft/40",
  warning: "border-warning/40 bg-warning-soft/40",
  success: "border-success/30",
  accent: "border-accent/30",
};

/** Raised soft surface; the base container for every panel. */
export default function Card({ as: Tag = "section", padding = "md", interactive, tone = "default", className, children, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "surface min-w-0",
        paddings[padding],
        tones[tone],
        interactive && "transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-raised-lg",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
}

export function CardHeader({ title, description, icon, actions, id, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && (
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-accent shadow-raised-sm" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
