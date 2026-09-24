import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeMode } from "../../lib/contexts";
import { storage } from "../../lib/storage";

const key = "canaryshield.theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Light / dark / system theme, applied as a class on <html>. */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const value = useMemo(() => ({
    mode,
    resolved,
    setMode: (next: ThemeMode) => {
      setMode(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        storage.set(key, next);
      }
    },
  }), [mode, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
