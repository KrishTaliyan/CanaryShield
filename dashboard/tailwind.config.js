/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: { DEFAULT: token("surface"), 2: token("surface-2") },
        sunken: token("sunken"),
        line: { DEFAULT: token("border"), strong: token("border-strong") },
        ink: { DEFAULT: token("text"), muted: token("text-muted"), subtle: token("text-subtle") },
        primary: { DEFAULT: token("primary"), hover: token("primary-hover"), fg: token("primary-fg") },
        accent: { DEFAULT: token("accent"), soft: token("accent-soft") },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
        canary: token("canary"),
        baseline: token("baseline"),
        threshold: token("threshold"),
        on: { accent: token("on-accent"), danger: token("on-danger"), success: token("on-success") },
      },
      boxShadow: {
        raised: "var(--shadow-raised)",
        "raised-sm": "var(--shadow-raised-sm)",
        "raised-lg": "var(--shadow-raised-lg)",
        inset: "var(--shadow-inset)",
        "inset-sm": "var(--shadow-inset-sm)",
        float: "var(--shadow-float)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      fontFamily: {
        mono: ["\"JetBrains Mono\"", "\"Cascadia Code\"", "Consolas", "\"SFMono-Regular\"", "monospace"],
      },
      transitionTimingFunction: {
        soft: "var(--ease-soft)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        "soft-pulse": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
      },
      animation: {
        "fade-in": "fade-in 180ms var(--ease-soft)",
        "rise-in": "rise-in 260ms var(--ease-soft)",
        "scale-in": "scale-in 200ms var(--ease-soft)",
        "slide-in-right": "slide-in-right 260ms var(--ease-soft)",
        "slide-in-left": "slide-in-left 260ms var(--ease-soft)",
        "slide-in-up": "slide-in-up 260ms var(--ease-soft)",
        shimmer: "shimmer 1.4s linear infinite",
        "soft-pulse": "soft-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
