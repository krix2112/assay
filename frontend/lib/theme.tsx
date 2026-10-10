"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (toggleElement?: HTMLElement | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Inline script run before first paint — avoids flash.
// Injected into <head> by RootLayout as a dangerouslySetInnerHTML script.
export const THEME_INIT_SCRIPT = `(function(){
  try {
    var stored = localStorage.getItem('assay-theme');
    var preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', preferred);
  } catch(e) {}
})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const initialized = useRef(false);

  // Read from DOM on first mount (set by the inline script)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = localStorage.getItem("assay-theme") as Theme | null;
    const attr = document.documentElement.getAttribute("data-theme") as Theme | null;
    setTheme(stored || attr || "light");
  }, []);

  const toggleTheme = useCallback((toggleElement?: HTMLElement | null) => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      localStorage.setItem("assay-theme", next);
      document.documentElement.setAttribute("data-theme", next);

      // View Transitions API — circular reveal from toggle button
      const supportsVT =
        typeof document !== "undefined" &&
        "startViewTransition" in document;
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        // instant: already applied above
        return next;
      }

      if (supportsVT && toggleElement) {
        const rect = toggleElement.getBoundingClientRect();
        const cx = Math.round(rect.left + rect.width / 2);
        const cy = Math.round(rect.top + rect.height / 2);
        const maxR = Math.ceil(
          Math.hypot(
            Math.max(cx, window.innerWidth - cx),
            Math.max(cy, window.innerHeight - cy)
          )
        );
        (document as any).startViewTransition(() => {
          // theme already applied; this just drives the transition
        });
        const style = document.createElement("style");
        style.textContent = `
          ::view-transition-old(root) { animation: none; }
          ::view-transition-new(root) {
            clip-path: circle(0px at ${cx}px ${cy}px);
            animation: assay-reveal ${220}ms cubic-bezier(0.16,1,0.3,1) forwards;
          }
          @keyframes assay-reveal {
            to { clip-path: circle(${maxR}px at ${cx}px ${cy}px); }
          }
        `;
        document.head.appendChild(style);
        setTimeout(() => style.remove(), 400);
      }
      // Fallback: CSS cross-fade is handled by the transition on [data-theme] vars in globals.css

      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
