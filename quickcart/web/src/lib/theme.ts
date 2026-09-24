import { useEffect, useState } from "react";

const key = "quickcart.theme";

function readSaved(): "light" | "dark" {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked: fall back to the system setting.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark theme, saved in this browser. */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(readSaved);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(key, theme);
    } catch {
      // Not saved; the theme still applies for this visit.
    }
  }, [theme]);
  return { theme, toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")) };
}
