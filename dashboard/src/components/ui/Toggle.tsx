import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** On/off switch (role="switch"). */
export default function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 ease-soft disabled:opacity-50",
          checked ? "border-accent/40 bg-accent" : "border-line bg-sunken shadow-inset-sm",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-surface-2 shadow-raised-sm transition-transform duration-200 ease-soft",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
