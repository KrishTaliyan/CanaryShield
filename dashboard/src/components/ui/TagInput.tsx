import { X } from "lucide-react";
import { useId, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { parseUserIds } from "../../lib/targeting";

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  tone?: "accent" | "danger";
  /** Values that are also in another list, shown with a warning. */
  conflicts?: string[];
}

/** Chips input for IDs: type and press Enter or comma, or paste a list. */
export default function TagInput({ label, values, onChange, placeholder, hint, tone = "accent", conflicts = [] }: TagInputProps) {
  const id = useId();
  const [text, setText] = useState("");

  function add(raw: string) {
    const next = parseUserIds(raw).filter((value) => !values.includes(value));
    if (next.length > 0) onChange([...values, ...new Set(next)]);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (!text.trim()) return;
      event.preventDefault();
      add(text);
    } else if (event.key === "Backspace" && !text && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (/[\s,]/.test(pasted.trim())) {
      event.preventDefault();
      add(`${text} ${pasted}`);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-ink">
        {label}
        <span className="text-xs font-normal tabular text-ink-subtle">{values.length} user{values.length === 1 ? "" : "s"}</span>
      </label>
      <div
        className="well flex min-h-[88px] flex-wrap content-start gap-1.5 p-2 focus-within:border-accent"
        onClick={() => document.getElementById(id)?.focus()}
      >
        {values.map((value) => {
          const conflict = conflicts.includes(value);
          return (
            <span
              key={value}
              title={conflict ? "Also in the other list. Exclude wins." : undefined}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-lg border py-0.5 pl-2 pr-1 font-mono text-[12.5px]",
                conflict
                  ? "border-warning/40 bg-warning-soft text-warning"
                  : tone === "danger"
                    ? "border-danger/25 bg-danger-soft/70 text-danger"
                    : "border-accent/25 bg-accent-soft text-accent",
              )}
            >
              <span className="truncate">{value}</span>
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(values.filter((item) => item !== value));
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-md opacity-70 hover:bg-surface/60 hover:opacity-100"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => text.trim() && add(text)}
          placeholder={values.length === 0 ? placeholder : "Add another…"}
          autoComplete="off"
          spellCheck={false}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 font-mono text-[13px] text-ink outline-none placeholder:font-sans placeholder:text-ink-subtle"
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
