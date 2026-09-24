import { useEffect, useRef, type RefObject } from "react";

const focusable = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While active: moves focus into the container, keeps Tab inside it, calls
 * onEscape on Escape, locks page scroll, and restores focus when done.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  // Keep the latest callback without re-running the effect (which would steal focus).
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const first = container?.querySelector<HTMLElement>("[data-autofocus]") ?? container?.querySelector<HTMLElement>(focusable);
    (first ?? container)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        escapeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;
      const items = Array.from(containerRef.current.querySelectorAll<HTMLElement>(focusable)).filter((element) => element.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}
