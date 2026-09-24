import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "primary";

const soft: Record<Tone, string> = {
  neutral: "border-line bg-sunken/80 text-ink-muted",
  accent: "border-accent/25 bg-accent-soft text-accent",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
  info: "border-info/25 bg-info-soft text-info",
  primary: "border-primary/25 bg-primary/10 text-primary",
};

const solid: Record<Tone, string> = {
  neutral: "border-transparent bg-ink-muted text-bg",
  accent: "border-transparent bg-accent text-on-accent",
  success: "border-transparent bg-success text-on-success",
  warning: "border-transparent bg-warning text-bg",
  danger: "border-transparent bg-danger text-on-danger",
  info: "border-transparent bg-info text-bg",
  primary: "border-transparent bg-primary text-primary-fg",
};

const dots: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
};

interface BadgeProps {
  tone?: Tone;
  variant?: "soft" | "solid";
  dot?: boolean;
  pulse?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Compact status label. Always carries text, never color alone. */
export default function Badge({ tone = "neutral", variant = "soft", dot, pulse, icon, size = "sm", className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2.5 py-0.5 text-[12px]" : "px-3 py-1 text-[13px]",
        variant === "soft" ? soft[tone] : solid[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
          {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", variant === "solid" ? "bg-current" : dots[tone])} />}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", variant === "solid" ? "bg-current" : dots[tone])} />
        </span>
      )}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
