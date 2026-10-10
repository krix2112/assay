"use client";

import React from "react";
import Link from "next/link";
import siteData from "@/content/site.json";

export function LandingFooter() {
  const githubUrl = siteData.githubUrl || "";

  return (
    <footer
      className="w-full border-t py-12 px-4 sm:px-6"
      style={{
        background: "var(--color-page)",
        borderColor: "var(--color-line)",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span
              className="font-display font-bold text-lg"
              style={{ color: "var(--color-text)" }}
            >
              Assay
            </span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              MCX gold futures parity
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Analytics only, not investment advice.
          </p>
        </div>

        <nav className="flex items-center gap-6 text-xs" aria-label="Footer Navigation">
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
          {githubUrl ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline focus-visible:outline-2 rounded-xs"
              style={{ color: "var(--color-muted)" }}
            >
              GitHub
            </a>
          ) : null}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between items-center text-[11px]" style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}>
        <div>
          Sample data. These are not real MCX prices.
        </div>
        <div className="mt-2 sm:mt-0 font-mono">
          SHA-256 AUDIT CHAIN VERIFIED
        </div>
      </div>
    </footer>
  );
}
