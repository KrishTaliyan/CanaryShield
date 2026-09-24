import { Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import Popover from "./Popover";

interface MultiSelectProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onChange: (selected: T[]) => void;
  className?: string;
}

/** Filter-chip style multi-select; empty selection means "all". */
export default function MultiSelect<T extends string>({ label, options, selected, onChange, className }: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const summary = selected.length === 0
    ? "All"
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label
      : `${selected.length} selected`;

  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-control border px-3 text-[13px] font-medium transition-all",
          selected.length > 0 ? "border-accent/40 bg-accent-soft text-accent" : "border-line/80 bg-surface text-ink-muted shadow-raised-sm hover:text-ink",
          className,
        )}
      >
        <span className="text-ink-subtle">{label}:</span>
        <span className={selected.length > 0 ? "text-accent" : "text-ink"}>{summary}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom-start" role="presentation" className="min-w-[200px] p-1.5">
        <div role="listbox" aria-multiselectable="true" aria-label={label}>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-sunken/80"
              >
                <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border", checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface")}>
                  {checked && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                </span>
                {option.label}
              </button>
            );
          })}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-control border-t border-line px-3 py-2 text-left text-xs font-medium text-ink-muted hover:text-ink">
              Clear selection
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
