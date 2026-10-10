"use client";

import React from "react";

const SEGMENTS = [
  {
    title: "Arbitrage & Relative Value Traders",
    subtitle: "Separate genuine dislocations from illiquid illusions.",
    items: [
      "Filter out stale quotes from dormant contract expiries.",
      "Track basis point spreads across delivery months in real fine-gold terms.",
      "Evaluate statistical bounds using median absolute deviation instead of fragile variance.",
    ],
  },
  {
    title: "Jewellers & Bullion Dealers",
    subtitle: "Benchmark retail physical lots against exchange parity.",
    items: [
      "Compare smaller delivery denominations (8g Guinea, 1g Petal) to benchmark 1kg bars.",
      "Detect when retail-oriented contract premia diverge from wholesale bullion parity.",
      "Maintain a verified historical record of domestic basis point premiums.",
    ],
  },
  {
    title: "Quantitative Analysts & Risk Officers",
    subtitle: "Rely on an audit-chained, immutable reference series.",
    items: [
      "Strict temporal isolation ensuring backward-only lookups in backtests.",
      "SHA-256 cryptographic chain ensures datasets have not been retroactively altered.",
      "Clear exclusion metrics for zero-volume or quarantined bhavcopy records.",
    ],
  },
];

export function Audience() {
  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-10 max-w-2xl">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Who it is for
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          Built for teams who test rather than speculate.
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Whether you hedge physical inventory or evaluate futures basis relationships, Assay provides uncompromised clarity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SEGMENTS.map((s) => (
          <div
            key={s.title}
            className="p-6 rounded-xs border flex flex-col justify-between"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
            }}
          >
            <div>
              <h3 className="font-display font-semibold text-lg leading-snug mb-2" style={{ color: "var(--color-text)" }}>
                {s.title}
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>
                {s.subtitle}
              </p>

              <ul className="space-y-2.5 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {s.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--color-gold-1)" }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
