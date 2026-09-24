import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg shadow-raised-sm hover:bg-primary-hover active:shadow-inset-sm",
  secondary: "bg-surface text-ink border border-line/80 shadow-raised-sm hover:-translate-y-px hover:text-primary active:translate-y-0 active:shadow-inset-sm",
  ghost: "text-ink-muted hover:bg-sunken/70 hover:text-ink",
  danger: "bg-danger text-on-danger shadow-raised-sm hover:brightness-110 active:shadow-inset-sm",
  "danger-soft": "border border-danger/30 bg-danger-soft/70 text-danger hover:bg-danger-soft active:shadow-inset-sm",
  accent: "bg-accent text-on-accent shadow-raised-sm hover:brightness-110 active:shadow-inset-sm",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-[15px]",
};

/** Shared by <Button> and link-styled buttons. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold transition-all duration-200 ease-soft",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}
