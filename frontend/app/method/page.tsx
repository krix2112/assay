import React from "react";
import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "About the method — Assay",
  description:
    "Deterministic data pipeline, verification rules, and methodological boundaries for MCX gold parity testing.",
};

export default function MethodPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-page)", color: "var(--color-text)" }}>
      <LandingNav />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs border rounded-xs font-mono" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-muted)" }}>
            <span>METHODOLOGY SPECIFICATION</span>
            <span>VERSION 1.0</span>
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight" style={{ color: "var(--color-text)" }}>
            About the Assay method
          </h1>

          <p className="text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Assay tests whether four MCX gold futures contracts trade at parity on an equivalent fine-gold basis. Here is how the pipeline operates, what rules govern verification, and where the boundaries of the analysis lie.
          </p>

          <div className="p-3 rounded-xs border text-xs" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-muted)" }}>
            <span className="font-semibold block mb-0.5" style={{ color: "var(--color-text)" }}>
              Data Notice
            </span>
            Sample data. These are not real MCX prices.
          </div>
        </div>

        {/* Section 1: The Six Pipeline Stages */}
        <section className="space-y-6 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            1. The pipeline stages
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Data flows deterministically from raw exchange publications into verified parity metrics across six sequential stages:
          </p>

          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block text-base mb-1 font-display" style={{ color: "var(--color-text)" }}>
                Stage S1 & S2: Ingest and parsing
              </strong>
              Raw MCX Bhavcopy CSV files are ingested and parsed. Only four target symbols are processed: GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL. All non-gold contracts are safely counted and filtered out of scope.
            </div>

            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block text-base mb-1 font-display" style={{ color: "var(--color-text)" }}>
                Stage S3: Pure validation
              </strong>
              Every parsed row passes through 11 discrete validation checks in <code className="text-xs px-1 py-0.5 rounded-xs" style={{ background: "var(--color-page)" }}>validator.py</code>. Rows violating schema constraints, negative volumes, inverted OHLC values, or unlisted contract dates are quarantined into audit records. In the pipeline import, a 12th conflict check (<code className="text-xs px-1 py-0.5 rounded-xs" style={{ background: "var(--color-page)" }}>CONFLICTING_REVISION</code>) guards against silent data rewrites.
            </div>

            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block text-base mb-1 font-display" style={{ color: "var(--color-text)" }}>
                Stage S4: Immutable ledger
              </strong>
              Accepted rows are written to an append-only database table. Database triggers forbid destructive updates or row deletes.
            </div>

            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block text-base mb-1 font-display" style={{ color: "var(--color-text)" }}>
                Stage S5: Normalisation & derived analytics
              </strong>
              Contract quotes are normalized to 1 fine gram INR. Pairwise spreads in basis points, rolling medians, and median absolute deviation (MAD) values are computed using backward-only windows. Liquidity fade penalties downweight spreads formed against dormant or low-volume contracts.
            </div>

            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block text-base mb-1 font-display" style={{ color: "var(--color-text)" }}>
                Stage S6: Audit sealing and hash chaining
              </strong>
              Each completed day produces an SHA-256 cryptographic digest binding its accepted rows, derived metrics, and previous day hash.
            </div>
          </div>
        </section>

        {/* Section 2: Audit Trail and Trigger Limit */}
        <section className="space-y-4 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            2. Evidence and trigger limits
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            We are explicit about where database constraints succeed and where independent verification is required:
          </p>

          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="text-xs font-mono uppercase" style={{ color: "var(--color-verdigris)" }}>
              Cryptographic integrity principle
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              A database owner could remove the trigger; the hash chain plus an outside copy of the latest hash is the real evidence.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
              While SQL triggers prevent accidental application-level updates or deletes, true immutability comes from publishing SHA-256 state hashes externally so tampering can be detected mathematically.
            </p>
          </div>
        </section>

        {/* Section 3: Look-ahead tests */}
        <section className="space-y-4 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            3. Temporal isolation
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            We do not use marketing phrases like &ldquo;zero look-ahead bias&rdquo; or &ldquo;bias-free&rdquo;. Instead, we verify temporal isolation in code:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-2" style={{ color: "var(--color-muted)" }}>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Look-ahead tests pass:</strong> Test suites in <code className="text-xs">backend/tests/test_analytics.py</code> (<code className="text-xs">test_lookahead_temporal_isolation</code>) and <code className="text-xs">backend/tests/test_backtest.py</code> (<code className="text-xs">test_lookahead_temporal_isolation</code>) verify that injecting wild price swings into future days leaves historical rolling medians, robust z-scores, and trade entries completely unchanged.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Held-out evaluation:</strong> Backtest strategy parameters are tested on chronologically sequestered test windows rather than fitted in-sample.
            </li>
          </ul>
        </section>

        {/* Section 4: Unverified items */}
        <section className="space-y-4 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            4. Unverified assumptions
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            To prevent over-interpretation, users must consider the following methodological limitations:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Settlement price proxy
              </strong>
              <p style={{ color: "var(--color-muted)" }}>
                End-of-day official settlement prices are used as execution approximations. They do not reflect midday bid-ask spreads or liquidity surges.
              </p>
            </div>
            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Purity conversion constancy
              </strong>
              <p style={{ color: "var(--color-muted)" }}>
                995 (GOLDM) vs 999 (others) fineness conversion uses standard physical ratios without adjusting for local refinery conversion premiums.
              </p>
            </div>
            <div className="p-4 rounded-xs border" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
              <strong className="block mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Fixed friction assumption
              </strong>
              <p style={{ color: "var(--color-muted)" }}>
                Transaction costs in the backtest engine reflect standard exchange dues and do not model custom broker commission tiers or financing rates.
              </p>
            </div>
          </div>
        </section>

        {/* Action button */}
        <div className="border-t pt-8 flex items-center gap-4" style={{ borderColor: "var(--color-line)" }}>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xs text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-text)",
              color: "var(--color-page)",
            }}
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xs text-sm font-semibold border transition-colors hover:bg-surface"
            style={{
              borderColor: "var(--color-line)",
              color: "var(--color-text)",
            }}
          >
            Back to landing page
          </Link>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
