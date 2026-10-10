"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IS_DEMO_MODE } from "@/lib/api";
import { useTheme } from "@/lib/theme";

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
  { label: "About the method", href: "/about" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const { theme, toggleTheme } = useTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isDark = theme === "dark";

  const handleToggle = () => {
    toggleTheme(toggleRef.current);
  };

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-surface selection:text-text"
      style={{ background: "var(--color-page)", color: "var(--color-text)" }}
    >
      {/* Sample Data Banner — visible in both themes on /dashboard */}
      {(IS_DEMO_MODE || pathname === "/dashboard" || pathname === "/") && (
        <div
          role="status"
          aria-live="polite"
          className="sample-banner"
        >
          Sample data. These are not real MCX prices.
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row max-w-[1440px] w-full mx-auto">
        {/* Desktop Slim Left Rail */}
        <aside
          aria-label="Main Navigation"
          className="hidden md:flex flex-col w-52 shrink-0 p-6 space-y-8"
          style={{ borderRight: "1px solid var(--color-line)" }}
        >
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="font-display font-bold text-xl tracking-tight block focus-visible:outline-2 rounded-xs"
              style={{ color: "var(--color-text)" }}
            >
              Assay
            </Link>
            <p className="text-xs leading-tight" style={{ color: "var(--color-muted)" }}>
              MCX gold futures parity
            </p>
          </div>

          <nav className="flex flex-col space-y-1.5" aria-label="Sections">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/dashboard" && pathname === "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color:           isActive ? "var(--color-text)"  : "var(--color-muted)",
                    background:      isActive ? "var(--color-surface)" : "transparent",
                    borderLeft:      isActive ? "2px solid var(--color-text)" : "2px solid transparent",
                    transition:      "color var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)",
                    fontWeight:      isActive ? 600 : 400,
                  }}
                  className="px-3 py-2 rounded-xs text-sm"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle — pinned to bottom of rail */}
          <div className="mt-auto">
            <button
              ref={toggleRef}
              type="button"
              onClick={handleToggle}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-pressed={isDark}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xs text-sm"
              style={{
                color:      "var(--color-muted)",
                border:     "1px solid var(--color-line)",
                background: "transparent",
                transition: "color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
              }}
            >
              <span>{isDark ? "Dark" : "Light"}</span>
              {/* Simple toggle icon: sun / moon glyphs, no emoji */}
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="currentColor"
                style={{ flexShrink: 0 }}
              >
                {isDark ? (
                  /* Sun */
                  <path d="M8 11A3 3 0 1 1 8 5a3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
                ) : (
                  /* Moon */
                  <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
                )}
              </svg>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-sm border-t z-40 px-2 py-1.5 flex justify-around items-center"
          style={{
            background:   "color-mix(in srgb, var(--color-surface) 95%, transparent)",
            borderColor:  "var(--color-line)",
          }}
        >
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color:      isActive ? "var(--color-text)" : "var(--color-muted)",
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
    </div>
  );
}
