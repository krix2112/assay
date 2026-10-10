"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";

export function FloatingPillNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isDark = theme === "dark";

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav
        aria-label="Main Navigation"
        className="pointer-events-auto flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border shadow-md transition-colors backdrop-blur-md"
        style={{
          background: isDark
            ? "rgba(23, 34, 32, 0.88)"
            : "rgba(243, 244, 240, 0.90)",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.12)"
            : "rgba(42, 52, 49, 0.14)",
          color: "var(--color-text)",
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-display font-bold tracking-tight hover:opacity-80 transition-opacity focus-visible:outline-2"
          style={{ color: "var(--color-text)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--color-gold-m)" }}
          />
          <span>Assay</span>
        </Link>

        <span
          className="h-3 w-px mx-0.5"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(42, 52, 49, 0.15)",
          }}
        />

        {/* Links */}
        <Link
          href="/#product-tour"
          className="px-2.5 py-1 rounded-full text-xs transition-colors hover:text-text focus-visible:outline-2"
          style={{
            color: "var(--color-muted)",
          }}
        >
          Product
        </Link>

        <Link
          href="/method"
          className="px-2.5 py-1 rounded-full text-xs transition-colors hover:text-text focus-visible:outline-2"
          style={{
            color: pathname === "/method" ? "var(--color-text)" : "var(--color-muted)",
            fontWeight: pathname === "/method" ? 600 : 400,
          }}
        >
          Method
        </Link>

        <Link
          href="/dashboard"
          className="px-2.5 py-1 rounded-full text-xs transition-colors hover:text-text focus-visible:outline-2"
          style={{
            color: pathname === "/dashboard" ? "var(--color-text)" : "var(--color-muted)",
            fontWeight: pathname === "/dashboard" ? 600 : 400,
          }}
        >
          Dashboard
        </Link>

        <span
          className="h-3 w-px mx-0.5"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(42, 52, 49, 0.15)",
          }}
        />

        {/* Theme Toggle */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => toggleTheme(toggleRef.current)}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={isDark}
          className="p-1.5 rounded-full hover:opacity-80 transition-opacity focus-visible:outline-2 flex items-center justify-center"
          style={{ color: "var(--color-muted)" }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="currentColor"
          >
            {isDark ? (
              <path d="M8 11A3 3 0 1 1 8 5a3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.708l1.414 1.414a.5.5 0 0 1 0 .708z" />
            ) : (
              <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
            )}
          </svg>
        </button>
      </nav>
    </header>
  );
}
