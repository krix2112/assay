"use client";

import React from "react";
import Link from "next/link";

interface EmptyDataStateProps {
  title?: string;
  description?: string;
}

export function EmptyDataState({
  title = "No data yet. Import a Bhavcopy file.",
  description = "The Assay database has no market session records. Import MCX Bhavcopy CSV files via the backend CLI to populate contracts, spreads, and the cryptographic track record.",
}: EmptyDataStateProps) {
  return (
    <div
      className="w-full max-w-2xl mx-auto py-12 px-4 space-y-5"
      role="region"
      aria-label="Empty state notification"
    >
      <div className="space-y-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs inline-block"
          style={{
            background: "color-mix(in srgb, var(--color-tag-gold) 12%, transparent)",
            color: "var(--color-tag-gold)",
            border: "1px solid var(--color-tag-gold)",
          }}
        >
          AWAITING BHAVCOPY INGESTION
        </span>
        <h1
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h1>
      </div>

      <div
        className="p-5 sm:p-6 rounded-xl space-y-4"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
          {description}
        </p>

        <div
          className="p-3 rounded-xs font-mono text-xs space-y-1"
          style={{
            background: "var(--color-page)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text)",
          }}
        >
          <div className="text-[10px] uppercase font-sans font-semibold tracking-wider" style={{ color: "var(--color-muted)" }}>
            CLI Ingestion Command:
          </div>
          <code>python -m app.cli ingest path/to/bhavcopy.csv</code>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Outside demonstrator mode, Assay never generates synthetic numbers when the database is empty.
          To view an illustrative session with sample MCX data, start the application with{" "}
          <code>NEXT_PUBLIC_DEMO=true</code>.
        </p>

        <div className="pt-1 flex items-center gap-3">
          <Link
            href="/method"
            className="text-xs font-semibold underline hover:opacity-80"
            style={{ color: "var(--color-muted)" }}
          >
            Review data verification pipeline and methodology
          </Link>
        </div>
      </div>
    </div>
  );
}
