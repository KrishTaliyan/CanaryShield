import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import Tooltip from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: "raised" | "ghost";
  size?: "sm" | "md";
  tooltip?: boolean;
  badge?: number;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", tooltip = true, badge, className, type = "button", ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      aria-label={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-control text-ink-muted transition-all duration-200 ease-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        variant === "raised"
          ? "border border-line/80 bg-surface shadow-raised-sm hover:-translate-y-px active:translate-y-0 active:shadow-inset-sm"
          : "hover:bg-sunken/70",
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-on-danger ring-2 ring-surface">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});

export default IconButton;
