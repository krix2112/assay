"use client";

import React from "react";

interface ApiErrorStateProps {
  title?: string;
  onRetry?: () => void;
}

export function ApiErrorState({
  title = "Cannot reach the Assay API. Is it running?",
  onRetry,
}: ApiErrorStateProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4 space-y-5" role="alert" aria-live="assertive">
      <div className="space-y-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
          style={{
            background: "color-mix(in srgb, var(--color-tag-madder) 12%, transparent)",
            color: "var(--color-tag-madder)",
            border: "1px solid var(--color-tag-madder)",
          }}
        >
          API CONNECTION ERROR
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
          The application attempted to query the live Assay backend service at{" "}
          <code className="px-1.5 py-0.5 rounded-xs text-xs font-mono" style={{ background: "var(--color-page)" }}>
            {apiUrl}
          </code>
          , but received no response or an error status.
        </p>

        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          In production and live mode, real-looking mock numbers are never shown if the real API cannot be contacted.
          Verify that the FastAPI service is active, or configure <code>NEXT_PUBLIC_DEMO=true</code> in your environment to run in demonstrator mode.
        </p>

        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold rounded-xs transition-opacity hover:opacity-90 focus-visible:outline-2"
              style={{
                background: "var(--color-text)",
                color: "var(--color-page)",
              }}
            >
              Retry connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
