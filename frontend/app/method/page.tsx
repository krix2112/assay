import React from "react";
import Link from "next/link";

export const metadata = {
  title: "About the method — Assay",
  description:
    "Deterministic data pipeline, mathematical formulas in plain words, and unverified assumptions for MCX gold parity testing.",
};

export default function MethodPage() {
  return (
    <div className="space-y-12 py-4 sm:py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
              color: "var(--color-verdigris)",
              border: "1px solid var(--color-verdigris)",
            }}
          >
            SPECIFICATION & METHODOLOGY NOTE
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
            VERSION 1.0
          </span>
        </div>

        <h1
          className="font-display font-bold text-3xl sm:text-4xl tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          About the Assay Method
        </h1>

        <p className="text-base sm:text-lg leading-relaxed max-w-3xl" style={{ color: "var(--color-muted)" }}>
          Assay tests whether four MCX gold futures contracts trade at parity on an equivalent fine-gold basis.
          Here is how the pipeline operates, every mathematical formula explained in plain words, and the explicit list of unverified boundaries.
        </p>
      </div>

      {/* Touchstone Slab Hero */}
      <section
        aria-label="Methodological Principles Slab"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-method" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-method)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                Governing Philosophy
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Deterministic Calculation, Zero Silent Rewrites
              </h2>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Target specifications: GOLDM (100g), GOLDTEN (10g), GOLDGUINEA (8g), GOLDPETAL (1g)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-sans text-xs leading-relaxed text-white/85">
            <div className="space-y-1">
              <strong className="block text-white font-semibold text-sm">1. Temporal Isolation</strong>
              <p style={{ color: "rgba(255,255,255,0.70)" }}>
                Every derived metric uses backward-only rolling windows. No future price or volume data can alter past rolling medians or z-scores.
              </p>
            </div>
            <div className="space-y-1">
              <strong className="block text-white font-semibold text-sm">2. Audit Quarantine</strong>
              <p style={{ color: "rgba(255,255,255,0.70)" }}>
                Rows with invalid bounds, inverted prices, or date mismatches are quarantined with their raw bytes intact, never silently corrected.
              </p>
            </div>
            <div className="space-y-1">
              <strong className="block text-white font-semibold text-sm">3. Cryptographic Proof</strong>
              <p style={{ color: "rgba(255,255,255,0.70)" }}>
                SHA-256 state chaining seals accepted daily records into an immutable audit chain verified mathematically from genesis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: The Six Pipeline Stages */}
      <section className="space-y-5 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
        <div className="space-y-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
              color: "var(--color-verdigris)",
              border: "1px solid var(--color-verdigris)",
            }}
          >
            ARCHITECTURE
          </span>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            1. The Six Pipeline Stages
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Data flows deterministically from raw exchange publications into verified parity metrics across sequential stages:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stages S1 & S2: Ingest & Parse
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Raw Bhavcopy Ingestion
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              MCX Bhavcopy CSV publications are ingested byte-for-byte and archived under their SHA-256 digest. Only the four target gold contracts (GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL) are extracted; all non-gold commodities are filtered out-of-scope without error.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stage S3: Validate
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Pure Validation Rules
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              Every parsed row passes through 11 discrete checks in <code className="text-xs font-mono">validator.py</code>. Rows violating schema constraints, negative volumes, inverted OHLC values, or unlisted contract dates are quarantined into audit records.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stage S4: Store
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Immutable Database Ledger
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              Accepted rows are written to an append-only database table. SQL triggers prevent destructive updates and deletes. A 12th validation check (<code className="text-xs font-mono">CONFLICTING_REVISION</code>) blocks silent overwrites of conflicting contract revisions.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stage S5: Derived Analytics
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Normalization & Basis Spreads
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              Quotes are normalized to 1 gram of 999 fine gold. Pairwise basis point spreads, 20-day rolling medians, and rolling Median Absolute Deviations (MAD) are computed using backward-only windows. Liquidity confidence penalties downweight dormant expiries.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stage S6: Publish
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Audit Sealing & Hash Chaining
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              Each completed session generates a canonical JSON representation of its parity score, liquidity counts, and data quality metrics. The payload is sealed with a SHA-256 digest linked to the preceding entry hash.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-1.5" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-verdigris)" }}>
              Stage S9: Backtest
            </span>
            <strong className="block font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Sequestered Walk-Forward Simulation
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              Mean-reversion signals (|z| ≥ 2.0) are simulated across a chronologically sequestered held-out window (40% of observations), providing verifiable out-of-sample attribution free from look-ahead leakage.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Formulas in Plain Words */}
      <section className="space-y-5 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
        <div className="space-y-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
              color: "var(--color-gold-m)",
              border: "1px solid var(--color-gold-m)",
            }}
          >
            MATHEMATICAL DEFINITIONS
          </span>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            2. Every Formula in Plain Words
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Explicit mathematical formulations translated into transparent plain English:
          </p>
        </div>

        <div className="space-y-4 text-xs leading-relaxed">
          {/* Formula 1: Price per gram */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                A. Quoted Price per Gram
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                Price_per_g = Close / Lot_Size_Grams
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Price per gram equals the published MCX contract close price divided by the physical contract denomination in grams: 100 grams for GOLDM, 10 grams for GOLDTEN, 8 grams for GOLDGUINEA, and 1 gram for GOLDPETAL.
            </p>
          </div>

          {/* Formula 2: Fine Gold Normalization */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                B. Fine-Gold Price Normalization (999 Equivalent)
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                Fine_Price = Price_per_g × (1000 / Fineness)
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Fine-gold price per gram scales the quote by its certified metallurgical purity. For GOLDM (995 fineness), the price is multiplied by 1000/995 (~1.005025). For GOLDTEN, GOLDGUINEA, and GOLDPETAL (999 fineness), the price is multiplied by 1000/999 (~1.001001). This converts all quotes to an identical 1.0 gram pure gold basis.
            </p>
          </div>

          {/* Formula 3: Spread in bps */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                C. Cross-Contract Spread in Basis Points (bps)
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                Spread_bps = ((Fine_A - Fine_B) / Fine_B) × 10,000
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Spread in basis points measures the fractional premium or discount between two contracts on an identical fine-gold basis. One basis point equals 0.01% (one-hundredth of a percent). A spread of +15 bps means Contract A trades 0.15% richer than Contract B per gram of fine gold.
            </p>
          </div>

          {/* Formula 4: Rolling Median and MAD */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                D. Rolling Median & Median Absolute Deviation (MAD)
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                MAD = Median( |Spread_i - Rolling_Median| )
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              The rolling median is the 50th percentile of pairwise spreads over a strict backward-looking 20-day historical window. Rolling MAD is the median of absolute deviations from that median. We use MAD rather than standard deviation because financial tick distributions exhibit fat tails; MAD resists contamination from single-day anomalous spikes.
            </p>
          </div>

          {/* Formula 5: Robust Z-Score */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                E. Robust Z-Score
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                Robust_Z = (Spread - Rolling_Median) / (1.4826 × MAD)
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Robust z-score measures how many standard-deviation equivalents the current spread deviates from its 20-day median. The scale factor 1.4826 normalizes the MAD so that it asymptotically equals standard deviation under a Gaussian distribution. Values exceeding |z| ≥ 2.0 indicate statistical dislocations.
            </p>
          </div>

          {/* Formula 6: Gold Parity Score */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                F. Gold Parity Score (0 to 100 Index)
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                Score = 100 - Aggregate_Penalties
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              The parity score is a bounded index measuring cross-contract price coherence. Starting from 100, penalties are deducted according to the magnitude of robust z divergence on all eligible pairs, weighted by liquidity confidence tiers. A score of 100 represents tight cross-contract alignment; scores below 70 indicate pronounced dislocation.
            </p>
          </div>

          {/* Formula 7: Attribution Regression */}
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between">
              <strong className="font-display text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                G. Walk-Forward Attribution Regression
              </strong>
              <code className="text-xs font-mono font-bold" style={{ color: "var(--color-muted)" }}>
                R_strategy = Alpha + (Beta × R_gold) + Residual
              </code>
            </div>
            <p style={{ color: "var(--color-text)" }}>
              Ordinary least squares (OLS) linear regression of daily strategy return against benchmark gold return. Beta measures passive directional gold exposure, daily alpha quantifies basis-reversion edge independent of market drift, and R-squared reveals what proportion of strategy variance is driven by underlying gold price moves.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Unverified Items */}
      <section className="space-y-5 border-t pt-8" style={{ borderColor: "var(--color-line)" }}>
        <div className="space-y-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-madder) 15%, transparent)",
              color: "var(--color-madder)",
              border: "1px solid var(--color-madder)",
            }}
          >
            METHODOLOGICAL BOUNDARIES
          </span>
          <h2 className="font-display font-semibold text-2xl" style={{ color: "var(--color-text)" }}>
            3. Catalog of Unverified Assumptions
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            To prevent over-interpretation, users must evaluate these four explicit methodological simplifications:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              1. Quotation Basis Assumption
            </div>
            <p style={{ color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-text)" }}>Settlement price proxy:</strong> Official end-of-day settlement prices published by MCX are used as proxies for trade execution. They do not capture midday bid-ask spreads, order book depth, or intraday price slippage that a live execution engine would encounter.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              2. Purity Treatment Assumption
            </div>
            <p style={{ color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-text)" }}>Constant refinery fineness:</strong> 995 vs 999 purity conversions assume fixed mathematical ratios without accounting for local commercial melting charges, physical delivery assay variances, or refinery conversion premiums in physical bullion hubs.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              3. Cost Figures Assumption
            </div>
            <p style={{ color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-text)" }}>Fixed friction assumption:</strong> Backtest costs model standard exchange dues and transaction dues as placeholder figures. Broker commissions, Securities Transaction Tax (STT), clearing fees, and margin financing carry costs are not verified.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
            <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              4. Expiry Window Rules Assumption
            </div>
            <p style={{ color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-text)" }}>Calendar window thresholds:</strong> Exclusion cutoff rules (such as blocking signals ≤ 3 days before contract expiry) are fixed heuristic approximations and do not adjust dynamically for physical delivery tender intentions or exchange margin step-up schedules.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Footer */}
      <div className="border-t pt-8 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--color-line)" }}>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-xs text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--color-text)", color: "var(--color-page)" }}
        >
          Return to Dashboard
        </Link>
        <Link
          href="/contracts"
          className="px-4 py-2 rounded-xs text-xs font-semibold border transition-colors hover:bg-surface"
          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
        >
          Inspect Contracts
        </Link>
        <Link
          href="/spreads"
          className="px-4 py-2 rounded-xs text-xs font-semibold border transition-colors hover:bg-surface"
          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
        >
          Pair Explorer
        </Link>
        <Link
          href="/data-trust"
          className="px-4 py-2 rounded-xs text-xs font-semibold border transition-colors hover:bg-surface"
          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
        >
          Data Trust Scorecard
        </Link>
        <Link
          href="/backtest"
          className="px-4 py-2 rounded-xs text-xs font-semibold border transition-colors hover:bg-surface"
          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
        >
          Backtest
        </Link>
        <Link
          href="/track-record"
          className="px-4 py-2 rounded-xs text-xs font-semibold border transition-colors hover:bg-surface"
          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
        >
          Track Record Chain
        </Link>
      </div>
    </div>
  );
}
