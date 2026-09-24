import { Info } from "lucide-react";
import { glossary, type GlossaryTerm } from "../../lib/glossary";
import Tooltip from "./Tooltip";

interface InfoTipProps {
  /** A glossary term, or free text via `text`. */
  term?: GlossaryTerm;
  text?: string;
  label?: string;
}

/** A small (i) that explains a technical term on hover or focus. */
export default function InfoTip({ term, text, label }: InfoTipProps) {
  const content = text ?? (term ? glossary[term] : "");
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label={label ?? `What is ${term ?? "this"}?`}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:text-accent"
      >
        <Info size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
