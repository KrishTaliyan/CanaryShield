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
        line: token("border"),
        ink: { DEFAULT: token("text"), muted: token("text-muted"), subtle: token("text-subtle") },
        brand: { DEFAULT: token("brand"), hover: token("brand-hover"), fg: token("brand-fg"), soft: token("brand-soft") },
        saffron: { DEFAULT: token("saffron"), soft: token("saffron-soft") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
      },
      boxShadow: {
        raised: "var(--shadow-raised)",
        "raised-sm": "var(--shadow-raised-sm)",
        inset: "var(--shadow-inset)",
        float: "var(--shadow-float)",
      },
      borderRadius: { card: "20px", control: "12px" },
      transitionTimingFunction: { soft: "var(--ease-soft)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        pop: { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(1.25)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 200ms var(--ease-soft)",
        "rise-in": "rise-in 350ms var(--ease-soft)",
        "scale-in": "scale-in 220ms var(--ease-soft)",
        "slide-in-right": "slide-in-right 320ms var(--ease-soft)",
        pop: "pop 400ms var(--ease-soft)",
      },
    },
  },
  plugins: [],
};
