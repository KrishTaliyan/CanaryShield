import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export default function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-ink-muted shadow-raised-sm",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
