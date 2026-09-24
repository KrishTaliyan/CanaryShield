import { Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

/** Search field with icon and clear button. */
const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ value, onChange, label, className, placeholder, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className="well h-9 w-full pl-9 pr-8 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/70 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle hover:text-ink"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
