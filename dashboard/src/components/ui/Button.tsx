import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "../../lib/button";
import { cn } from "../../lib/cn";
import Spinner from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/** The standard action button. `loading` disables it and shows a spinner. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, iconRight, fullWidth, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, cn(fullWidth && "w-full", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export default Button;

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

/** A router link that looks like a button. */
export function ButtonLink({ variant = "secondary", size = "md", icon, iconRight, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
