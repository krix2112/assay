"use client";

import React, { useMemo } from "react";
import { ParityResponse, SpreadItem } from "@/lib/api";

interface DailyBriefSectionProps {
  parity: ParityResponse | null;
  spreads: SpreadItem[];
  selectedDate: string;
}

export function DailyBriefSection({
  parity,
  spreads,
  selectedDate,
}: DailyBriefSectionProps) {
  const watchPairs = useMemo(() => {
    return spreads
      .filter((s) => {
        const z = s.robust_z != null ? Number(s.robust_z) : null;
        const isTradeable = s.weaker_liquidity_label === "High" || s.weaker_liquidity_label === "Medium";
        return z !== null && Math.abs(z) >= 2.0 && isTradeable;
      })
      .sort((a, b) => Math.abs(Number(b.robust_z || 0)) - Math.abs(Number(a.robust_z || 0)))
      .slice(0, 2);
  }, [spreads]);

  return (
    <div
      className="rounded-xl p-5 sm:p-6 space-y-5 h-full"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
    >
      <div className="space-y-2">
        <h3
          className="font-display text-base sm:text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Daily intelligence brief
        </h3>
        <p className="text-sm leading-relaxed max-w-[75ch]" style={{ color: "var(--color-text)" }}>
          {parity
            ? parity.explanation
            : "No data available for the selected trading date."}
        </p>
      </div>

      {/* Pairs to watch */}
      <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold" style={{ color: "var(--color-text)" }}>Pairs worth watching</span>
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Threshold: |z| ≥ 2.0</span>
        </div>

        {watchPairs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {watchPairs.map((pair) => (
              <div
                key={`${pair.symbol_a}-${pair.symbol_b}`}
                className="p-3 rounded-xs space-y-1"
                style={{ background: "var(--color-page)", border: "1px solid var(--color-line)" }}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span style={{ color: "var(--color-text)" }}>
                    {pair.symbol_a} / {pair.symbol_b}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--color-madder)" }}>
                    z = {Number(pair.robust_z) > 0 ? "+" : ""}{pair.robust_z}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-muted)" }}>
                  <span className="tabular-nums">Spread: {pair.spread_bps} bps</span>
                  <span>{pair.weaker_liquidity_label} liquidity</span>
                </div>
                <div className="text-[10px] pt-1 italic" style={{ color: "var(--color-muted)" }}>
                  Informational — may not be tradeable
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs italic" style={{ color: "var(--color-muted)" }}>
            No pairs exceed deviation thresholds today. All spreads within normal baseline bounds.
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="pt-2 text-[11px]" style={{ borderTop: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
        Analytics only — not investment advice.
      </div>
    </div>
  );
}
