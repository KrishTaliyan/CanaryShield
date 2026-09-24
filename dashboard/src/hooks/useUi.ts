import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./useAppContext";

/** Matches a CSS media query, updating on change. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Calls handler on Ctrl/Cmd + key (e.g. "k"). */
export function useHotkey(key: string, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === key) {
        event.preventDefault();
        handlerRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}

function cssColor(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value ? `rgb(${value.split(/\s+/).join(", ")})` : "#888";
}

/**
 * Resolved theme colors for SVG charts. SVG presentation attributes cannot
 * read CSS variables, so charts get concrete colors that update with the theme.
 */
export function useChartColors() {
  const { resolved } = useTheme();
  return useMemo(() => ({
    canary: cssColor("canary"),
    baseline: cssColor("baseline"),
    threshold: cssColor("threshold"),
    grid: cssColor("border"),
    axis: cssColor("text-subtle"),
    text: cssColor("text"),
    surface: cssColor("surface-2"),
    accent: cssColor("accent"),
    success: cssColor("success"),
    warning: cssColor("warning"),
    danger: cssColor("danger"),
    info: cssColor("info"),
    primary: cssColor("primary"),
    theme: resolved,
  }), [resolved]);
}

/** A timestamp that ticks every `intervalMs` (for countdowns, "x ago"). */
export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}
