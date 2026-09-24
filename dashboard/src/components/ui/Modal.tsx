import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevents closing (Escape, backdrop, ×) while an action runs. */
  busy?: boolean;
  role?: "dialog" | "alertdialog";
}

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Accessible modal dialog with focus trap, rendered in a portal. */
export default function Modal({ open, onClose, title, description, icon, children, footer, size = "md", busy, role = "dialog" }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, busy ? undefined : onClose);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(8_12_20/0.45)] p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-float animate-scale-in sm:rounded-card",
          sizes[size],
        )}
      >
        <div className="flex items-start gap-3 border-b border-line/70 px-5 py-4 md:px-6">
          {icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-subtle hover:bg-sunken hover:text-ink disabled:opacity-40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 bg-surface-2/60 px-5 py-4 md:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
