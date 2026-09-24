import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
}

/** Underlined tab list with arrow-key navigation (WAI-ARIA tabs pattern). */
export default function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.value === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      onChange(items[next].value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex min-w-max gap-1 border-b border-line">
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              id={`${idPrefix}-tab-${item.value}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                selected ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {item.icon && <span aria-hidden="true" className={selected ? "text-accent" : ""}>{item.icon}</span>}
              {item.label}
              {item.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TabPanelProps {
  idPrefix: string;
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ idPrefix, value, children, className }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      tabIndex={0}
      className={cn("animate-rise-in focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
