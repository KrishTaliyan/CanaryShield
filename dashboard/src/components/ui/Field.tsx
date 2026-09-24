import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

const control = "well w-full px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-accent/70 disabled:cursor-not-allowed disabled:opacity-60";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
  labelAside?: ReactNode;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, required, children, className, labelAside }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const described = error || hint ? hintId : undefined;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
        {labelAside}
      </div>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={hintId} className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-ink-muted")} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-[88px] resize-y py-2", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
    </div>
  );
});
