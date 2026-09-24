import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
  hideHeader?: boolean;
}

const widths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" };

/** Side sheet; full-width on phones. Same accessibility as Modal. */
export default function Drawer({ open, onClose, title, description, side = "right", width = "md", children, footer, hideHeader }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[rgb(8_12_20/0.45)] backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute top-0 flex h-full w-full flex-col bg-surface shadow-float",
          widths[width],
          side === "right" ? "right-0 animate-slide-in-right sm:rounded-l-card" : "left-0 animate-slide-in-left sm:rounded-r-card",
        )}
      >
        <div className={cn("flex items-start gap-3 border-b border-line/70 px-5 py-4", hideHeader && "sr-only")}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-subtle hover:bg-sunken hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line/70 bg-surface-2/60 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
