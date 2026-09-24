import { useId, type CSSProperties, type ReactNode } from "react";

interface SliderProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  tone?: "accent" | "danger" | "warning";
  hint?: ReactNode;
  disabled?: boolean;
  marks?: number[];
}

const toneVar = { accent: "var(--accent)", danger: "var(--danger)", warning: "var(--warning)" };

/** Range input with a visible value and optional tick marks. */
export default function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format = String, tone = "accent", hint, disabled, marks }: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <output htmlFor={id} className="text-sm font-semibold tabular text-ink">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range"
        style={{ "--fill": `${fill}%`, "--range-color": toneVar[tone] } as CSSProperties}
      />
      {marks && (
        <div className="mt-1.5 flex justify-between text-[11px] tabular text-ink-subtle" aria-hidden="true">
          {marks.map((mark) => <span key={mark}>{format(mark)}</span>)}
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
