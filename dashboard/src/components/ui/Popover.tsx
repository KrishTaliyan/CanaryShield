import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useFloating, type Placement } from "../../hooks/useFloating";
import { cn } from "../../lib/cn";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: Placement;
  className?: string;
  children: ReactNode;
  role?: string;
  label?: string;
}

/** Floating panel anchored to a trigger; closes on outside click and Escape. */
export default function Popover({ open, onClose, anchorRef, placement = "bottom-start", className, children, role = "dialog", label }: PopoverProps) {
  const floatingRef = useRef<HTMLDivElement>(null);
  const position = useFloating(anchorRef, floatingRef, open, placement);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (floatingRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={floatingRef}
      role={role}
      aria-label={label}
      style={{ position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      className={cn("z-[60] rounded-card border border-line bg-surface-2 shadow-float animate-scale-in", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
