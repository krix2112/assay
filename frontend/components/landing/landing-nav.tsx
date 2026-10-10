"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";

export function LandingNav() {
  const { theme, toggleTheme } = useTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isDark = theme === "dark";

  return (
    <header
      className="w-full border-b"
      style={{
        background: "var(--color-page)",
        borderColor: "var(--color-line)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex flex-col focus-visible:outline-2 rounded-xs"
          >
            <span
              className="font-display font-bold text-xl tracking-tight leading-none"
              style={{ color: "var(--color-text)" }}
            >
              Assay
            </span>
            <span
              className="text-[11px] leading-tight"
              style={{ color: "var(--color-muted)" }}
            >
              MCX gold futures parity
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm" aria-label="Main Navigation">
          <Link
            href="/dashboard"
            className="hover:underline focus-visible:outline-2 rounded-xs"
            style={{ color: "var(--color-muted)" }}
          >
            Dashboard
          </Link>
          <Link
            href="/method"
            className="hover:underline focus-visible:outline-2 rounded-xs"
            style={{ color: "var(--color-muted)" }}
          >
            About the method
          </Link>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => toggleTheme(toggleRef.current)}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-xs"
            style={{
              color: "var(--color-muted)",
              border: "1px solid var(--color-line)",
              background: "transparent",
            }}
          >
            <span>{isDark ? "Dark" : "Light"}</span>
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
      </div>
    </header>
  );
}
