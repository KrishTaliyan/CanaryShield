import { FilterX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface FilterBarProps {
  children: ReactNode;
  /** Shows "Clear filters" when true. */
  active?: boolean;
  onClear?: () => void;
  summary?: ReactNode;
  className?: string;
}

/** A wrapping row of search and filter controls. */
export default function FilterBar({ children, active, onClear, summary, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {active && onClear && (
        <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-ink-muted hover:bg-sunken/70 hover:text-ink">
          <FilterX size={14} aria-hidden="true" />
          Clear filters
        </button>
      )}
      {summary && <span className="ml-auto text-[13px] text-ink-muted">{summary}</span>}
    </div>
  );
}
