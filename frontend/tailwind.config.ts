import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // No darkMode selector — we use [data-theme="dark"] via CSS vars
  theme: {
    extend: {
      colors: {
        // Semantic tokens — always read from CSS variables so they
        // automatically switch with the theme.
        page:       "var(--color-page)",
        surface:    "var(--color-surface)",
        raised:     "var(--color-raised)",
        text:       "var(--color-text)",
        muted:      "var(--color-muted)",
        line:       "var(--color-line)",
        touchstone: "var(--color-touchstone)",
        verdigris:  "var(--color-verdigris)",
        madder:     "var(--color-madder)",
        // Legacy aliases (keep existing components working)
        limestone:  "var(--color-limestone)",
        chalk:      "var(--color-chalk)",
        basalt:     "var(--color-basalt)",
        gold: {
          m:      "var(--color-gold-m)",
          ten:    "var(--color-gold-ten)",
          guinea: "var(--color-gold-guinea)",
          petal:  "var(--color-gold-petal)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body:    ["var(--font-body)",    "sans-serif"],
      },
      borderRadius: {
        xs: "2px",
        xl: "14px",
      },
      boxShadow: {
        none: "none",
      },
      transitionDuration: {
        fast: "120ms",
        base: "220ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
