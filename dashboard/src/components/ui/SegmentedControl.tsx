import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** A sunken track with a raised thumb on the selected option. */
export default function SegmentedControl<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("well inline-flex max-w-full gap-1 overflow-x-auto p-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-[9px] font-semibold transition-all duration-200 ease-soft",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
              selected ? "bg-surface-2 text-ink shadow-raised-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
