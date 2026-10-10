"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_DEMO_MODE } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { FloatingPillNav } from "@/components/nav/floating-pill-nav";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Contracts",  href: "/contracts" },
  { label: "Spreads",    href: "/spreads" },
  { label: "Data trust", href: "/data-trust" },
  { label: "Backtest",   href: "/backtest" },
  { label: "Track record", href: "/track-record" },
  { label: "About the method", href: "/method" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isDark = theme === "dark";

  const handleToggle = () => {
    toggleTheme(toggleRef.current);
  };

  const isStandalone = pathname === "/" || pathname === "/method";

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-surface selection:text-text pt-16 sm:pt-20"
      style={{ background: "var(--color-page)", color: "var(--color-text)" }}
    >
      {/* Top Floating Pill Navigation */}
      <FloatingPillNav />

      {/* Sample Data Banner — visible in both themes on /dashboard */}
      {(IS_DEMO_MODE || pathname === "/dashboard") && (
        <div
          role="status"
          aria-live="polite"
          className="sample-banner"
        >
          Sample data. These are not real MCX prices.
        </div>
      )}

      {/* Full-width container (giving charts full 1440px width without rail constraint) */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-12">
        <main className="w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-sm border-t z-40 px-2 py-1.5 flex justify-around items-center"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 95%, transparent)",
          borderColor: "var(--color-line)",
        }}
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: isActive ? "var(--color-text)" : "var(--color-muted)",
                fontWeight: isActive ? 700 : 400,
                transition: "color var(--dur-fast) var(--ease-out)",
              }}
              className="px-2 py-1.5 rounded-xs text-xs text-center"
            >
              {item.label}
            </Link>
          );
        })}
        {/* Mobile theme toggle */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="px-2 py-1.5 rounded-xs text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          {isDark ? "Light" : "Dark"}
        </button>
      </nav>
    </div>
  );
}
