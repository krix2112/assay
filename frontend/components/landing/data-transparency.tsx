"use client";

import React from "react";

export function DataTransparency() {
  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-10 max-w-2xl">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Data transparency
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          Explicit boundaries. No hidden heuristics.
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Assay is built on verifiable pipeline stages. We document our source inputs, what we deliberately do not attempt, and our explicit assumptions.
        </p>
      </div>

      {/* Dotted Flow Diagram */}
      <div
        className="p-6 rounded-xs border mb-10 overflow-x-auto"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-line)",
        }}
      >
        <div className="text-xs font-mono mb-4 flex items-center justify-between" style={{ color: "var(--color-muted)" }}>
          <span>Pipeline execution flow</span>
          <span>Deterministic & append-only</span>
        </div>

        <div className="min-w-[640px] flex items-center justify-between relative py-4">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center w-36">
            <div
              className="w-10 h-10 rounded-xs border flex items-center justify-center font-mono text-xs font-bold mb-2"
              style={{
                background: "var(--color-page)",
                borderColor: "var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              S1/S2
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>MCX Bhavcopy</span>
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Official daily CSV</span>
          </div>

          {/* Dotted connector 1 */}
          <div className="flex-1 border-t-2 border-dotted mx-2 relative" style={{ borderColor: "var(--color-muted)" }}>
            <span
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-30"
              style={{ background: "var(--color-gold-1)" }}
            />
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center w-36">
            <div
              className="w-10 h-10 rounded-xs border flex items-center justify-center font-mono text-xs font-bold mb-2"
              style={{
                background: "var(--color-page)",
                borderColor: "var(--color-line)",
                color: "var(--color-verdigris)",
              }}
            >
              S3
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Validation</span>
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>11 check codes</span>
          </div>

          {/* Dotted connector 2 */}
          <div className="flex-1 border-t-2 border-dotted mx-2 relative" style={{ borderColor: "var(--color-muted)" }}>
            <span
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-30"
              style={{ background: "var(--color-gold-1)" }}
            />
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center w-36">
            <div
              className="w-10 h-10 rounded-xs border flex items-center justify-center font-mono text-xs font-bold mb-2"
              style={{
                background: "var(--color-page)",
                borderColor: "var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              S4
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Immutable Store</span>
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Trigger-protected ledger</span>
          </div>

          {/* Dotted connector 3 */}
          <div className="flex-1 border-t-2 border-dotted mx-2 relative" style={{ borderColor: "var(--color-muted)" }}>
            <span
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-30"
              style={{ background: "var(--color-gold-1)" }}
            />
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center w-36">
            <div
              className="w-10 h-10 rounded-xs border flex items-center justify-center font-mono text-xs font-bold mb-2"
              style={{
                background: "var(--color-page)",
                borderColor: "var(--color-line)",
                color: "var(--color-gold-1)",
              }}
            >
              S5
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Derived Parity</span>
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Backward rolling stats</span>
          </div>

          {/* Dotted connector 4 */}
          <div className="flex-1 border-t-2 border-dotted mx-2 relative" style={{ borderColor: "var(--color-muted)" }}>
            <span
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-30"
              style={{ background: "var(--color-gold-1)" }}
            />
          </div>

          {/* Step 5 */}
          <div className="flex flex-col items-center text-center w-36">
            <div
              className="w-10 h-10 rounded-xs border flex items-center justify-center font-mono text-xs font-bold mb-2"
              style={{
                background: "var(--color-page)",
                borderColor: "var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              S6
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Audit Seal</span>
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>SHA-256 chained hash</span>
          </div>
        </div>
      </div>

      {/* Three Detailed Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: What we use */}
        <div
          className="p-6 rounded-xs border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-line)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-verdigris)" }}
            />
            <h3 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
              What we use
            </h3>
          </div>
          <ul className="space-y-3 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Official MCX Bhavcopy:</strong> Daily official trade files containing open, high, low, close, volume, and open interest.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Contract specifications:</strong> Defined contract unit multipliers and purity certifications (995 for GOLDM, 999 for others).
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Strict calendar filters:</strong> Enforcing expected expiry week windows and rejecting unlisted contract rows.
            </li>
          </ul>
        </div>

        {/* Column 2: What we do not do */}
        <div
          className="p-6 rounded-xs border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-line)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-madder)" }}
            />
            <h3 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
              What we do not do
            </h3>
          </div>
          <ul className="space-y-3 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            <li>
              <strong style={{ color: "var(--color-text)" }}>No intraday tick prediction:</strong> Assay does not forecast tick direction or provide millisecond order-routing signals.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>No black-box models:</strong> Zero unexplainable neural nets. All metrics use clear arithmetic and robust medians.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>No price publication:</strong> Assay evaluates agreement between contracts; it does not issue gold spot prices.
            </li>
          </ul>
        </div>

        {/* Column 3: Unverified assumptions */}
        <div
          className="p-6 rounded-xs border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-line)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-gold-1)" }}
            />
            <h3 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
              Unverified items
            </h3>
          </div>
          <ul className="space-y-3 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Settlement price proxy:</strong> End-of-day closing prices approximate execution prices without accounting for intraday slippage.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Physical conversion constant:</strong> Refining fees and vaulting differential between 995 and 999 gold are treated as invariant.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Fixed transaction costs:</strong> Backtests assume standard exchange fees without broker-specific tier discounts.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
