import { cloneElement, isValidElement, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFloating, type Placement } from "../../hooks/useFloating";
import { cn } from "../../lib/cn";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: Placement;
  className?: string;
  /** Classes for the wrapper around the trigger (e.g. "w-full"). */
  wrapperClassName?: string;
}

/**
 * Hover/focus tooltip rendered in a portal so no container can clip it.
 * The trigger gets aria-describedby while the tooltip is shown.
 */
export default function Tooltip({ content, children, placement = "top", className, wrapperClassName }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const position = useFloating(anchorRef, floatingRef, open, placement);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 180);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  const trigger = isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children, { "aria-describedby": open ? id : undefined })
    : children;

  return (
    <span
      ref={anchorRef}
      className={cn("inline-flex max-w-full", wrapperClassName)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
    >
      {trigger}
      {open && content && createPortal(
        <div
          ref={floatingRef}
          id={id}
          role="tooltip"
          style={{ position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          className={cn(
            "pointer-events-none z-[70] max-w-xs rounded-lg bg-ink px-3 py-2 text-[12.5px] leading-snug text-bg shadow-float animate-fade-in",
            className,
          )}
        >
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}
