type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg shadow-raised-sm hover:bg-brand-hover active:shadow-inset",
  secondary: "border border-line bg-surface text-ink shadow-raised-sm hover:-translate-y-px hover:text-brand active:translate-y-0 active:shadow-inset",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-[13px]",
  md: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-[15px]",
};

/** Class names for buttons and button-styled links. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold transition-all duration-200 ease-soft disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  ].join(" ");
}
