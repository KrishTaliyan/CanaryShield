import { MinusIcon, PlusIcon } from "./Icons";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: "sm" | "md";
  max?: number;
}

/** − / + control; going below 1 removes the item. */
export default function QuantityStepper({ value, onChange, label, size = "md", max = 20 }: QuantityStepperProps) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="well inline-flex items-center gap-1 p-1" role="group" aria-label={`${label} quantity`}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)} className={`${box} inline-flex items-center justify-center rounded-[9px] text-ink transition-colors hover:bg-surface-2`}>
        <MinusIcon size={16} />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular text-ink" aria-live="polite">{value}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} disabled={value >= max} className={`${box} inline-flex items-center justify-center rounded-[9px] text-ink transition-colors hover:bg-surface-2 disabled:opacity-40`}>
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
