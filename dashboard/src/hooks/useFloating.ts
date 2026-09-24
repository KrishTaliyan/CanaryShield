import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export type Placement = "bottom-start" | "bottom-end" | "top" | "bottom" | "right";

interface Position {
  top: number;
  left: number;
  placement: Placement;
}

const gap = 8;

/**
 * Fixed-position coordinates for a floating element next to its anchor,
 * flipping above when there is no room below. Rendering floating elements
 * in a portal with fixed positioning keeps scrollable tables from clipping them.
 */
export function useFloating(anchorRef: RefObject<HTMLElement | null>, floatingRef: RefObject<HTMLElement | null>, open: boolean, placement: Placement) {
  const [position, setPosition] = useState<Position | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;
    let resolved = placement;
    if (placement === "right") {
      top = a.top + a.height / 2 - f.height / 2;
      left = a.right + gap;
    } else if (placement === "top") {
      top = a.top - f.height - gap;
      left = a.left + a.width / 2 - f.width / 2;
      if (top < 8) {
        top = a.bottom + gap;
        resolved = "bottom";
      }
    } else {
      top = a.bottom + gap;
      left = placement === "bottom-end" ? a.right - f.width : placement === "bottom" ? a.left + a.width / 2 - f.width / 2 : a.left;
      if (top + f.height > vh - 8 && a.top - f.height - gap > 8) {
        top = a.top - f.height - gap;
      }
    }
    left = Math.max(8, Math.min(left, vw - f.width - 8));
    top = Math.max(8, Math.min(top, vh - f.height - 8));
    setPosition({ top, left, placement: resolved });
  }, [anchorRef, floatingRef, placement]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return position;
}
