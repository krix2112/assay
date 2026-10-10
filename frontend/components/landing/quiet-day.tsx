"use client";

import React from "react";

const STREAKS = [
  { symbol: "GOLDM", color: "#C9A24B", devBps: "+0.4 bps", price: "7,520.40" },
  { symbol: "GOLDTEN", color: "#D9B866", devBps: "-0.2 bps", price: "7,520.10" },
  { symbol: "GOLDGUINEA", color: "#B98A2F", devBps: "+0.1 bps", price: "7,520.25" },
  { symbol: "GOLDPETAL", color: "#E6CF8F", devBps: "-0.3 bps", price: "7,519.95" },
];

export function QuietDayDemo() {
  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left explanation */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
            Quiet day mode
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
            Most days look like this.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
            When markets work properly, there is nothing to trade. Assay tells you that too.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            All four contracts track within fractional basis points of one another. The parity score stays high, volatility remains low, and no artificial trading alert is triggered.
          </p>

          <div
            className="p-3 rounded-xs border text-xs"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
              color: "var(--color-muted)",
            }}
          >
            <strong className="block text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--color-text)" }}>
              Data Notice
            </strong>
            Sample data. These are not real MCX prices.
          </div>
        </div>

        {/* Right demo card */}
        <div className="lg:col-span-7">
          <div
            className="rounded-xs border p-6"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b mb-6" style={{ borderColor: "var(--color-line)" }}>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Sample Date: 2026-03-04
                </span>
                <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  High cross-contract agreement
                </div>
              </div>
              <div className="text-right">
                <span className="font-display font-bold text-3xl tabular-nums leading-none text-[#3F7D6E]">
                  96
                </span>
                <span className="text-xs ml-1" style={{ color: "var(--color-muted)" }}>/ 100</span>
                <div className="text-[10px] font-mono text-[#3F7D6E]">STRONG PARITY</div>
              </div>
            </div>

            {/* Quiet Touchstone Slab visual */}
            <div
              className="p-5 rounded-xs mb-6 relative overflow-hidden"
              style={{
                background: "#172220",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="text-[11px] font-mono mb-4 flex justify-between" style={{ color: "#9AA5A1" }}>
                <span>4 STREAKS AT PARITY</span>
                <span>Sample data. These are not real MCX prices.</span>
              </div>

              {/* 4 tight parallel lines */}
              <div className="space-y-3.5 py-2">
                {STREAKS.map((s) => (
                  <div key={s.symbol} className="flex items-center gap-3">
                    <span className="font-mono text-xs w-24 shrink-0 text-[#E4E8E3]">
                      {s.symbol}
                    </span>
                    <div className="flex-1 h-1 rounded-full relative" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full w-full"
                        style={{
                          background: s.color,
                          boxShadow: `0 0 6px ${s.color}40`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs w-16 text-right tabular-nums text-[#72B7A5]">
                      {s.devBps}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t text-[11px] font-mono flex justify-between" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#9AA5A1" }}>
                <span>MAX DISCREPANCY: 0.6 BPS</span>
                <span>STATUS: EQUILIBRIUM</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {STREAKS.map((s) => (
                <div
                  key={s.symbol}
                  className="p-2.5 rounded-xs border text-left"
                  style={{
                    background: "var(--color-page)",
                    borderColor: "var(--color-line)",
                  }}
                >
                  <span className="text-[10px] font-mono block" style={{ color: "var(--color-muted)" }}>
                    {s.symbol}
                  </span>
                  <span className="text-xs font-semibold tabular-nums block" style={{ color: "var(--color-text)" }}>
                    INR {s.price}/g
                  </span>
                  <span className="text-[10px] font-mono text-[#3F7D6E] block mt-0.5">
                    {s.devBps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
