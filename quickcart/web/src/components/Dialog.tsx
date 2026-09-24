import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../lib/useDialog";
import { CloseIcon } from "./Icons";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "center" for a modal, "right" for a side panel. */
  placement?: "center" | "right";
  hideTitle?: boolean;
}

export default function Dialog({ open, onClose, title, children, placement = "center", hideTitle }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(panelRef, open, onClose);
  if (!open) return null;

  const panel = placement === "right"
    ? "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-float animate-slide-in-right sm:rounded-l-card"
    : "relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-card bg-surface shadow-float animate-scale-in sm:rounded-card";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in ${placement === "center" ? "flex items-end justify-center sm:items-center sm:p-4" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={panel}>
        <div className={`flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4 ${hideTitle ? "absolute right-0 top-0 z-10 border-0" : ""}`}>
          <h2 id={titleId} className={hideTitle ? "sr-only" : "text-lg font-semibold text-ink"}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink-muted shadow-raised-sm hover:text-ink">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
