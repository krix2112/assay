"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ContractDayItem } from "@/lib/api";
import { TRANSITION } from "@/lib/motion";

interface TouchstoneProps {
  contracts: ContractDayItem[];
  selectedDate: string;
}

// Gold streak identities — colours use CSS vars so dark mode works
const STREAK_CONFIG: Record<string, { varName: string; label: string; grams: string }> = {
  GOLDM:      { varName: "--color-gold-m",      label: "GOLDM",      grams: "100 g" },
  GOLDTEN:    { varName: "--color-gold-ten",     label: "GOLDTEN",    grams: "10 g"  },
  GOLDGUINEA: { varName: "--color-gold-guinea",  label: "GOLDGUINEA", grams: "8 g"   },
  GOLDPETAL:  { varName: "--color-gold-petal",   label: "GOLDPETAL",  grams: "1 g"   },
};

// Three scale options in bps
const SCALE_OPTIONS = [10, 25, 50] as const;
type Scale = (typeof SCALE_OPTIONS)[number];

// Minimum rendered width so very-small deviations are still visible
const MIN_STREAK_PX = 3;

export function Touchstone({ contracts }: TouchstoneProps) {
  const [manualScale, setManualScale] = useState<Scale | null>(null);

  // Extract nearest expiry for each of the 4 symbols
  const nearestContracts = useMemo(() => {
    const map: Record<string, ContractDayItem> = {};
    for (const c of contracts) {
      if (!map[c.symbol] || c.expiry_date < map[c.symbol].expiry_date) {
        map[c.symbol] = c;
      }
    }
    return Object.values(map);
  }, [contracts]);

  // Fine-gold price median
  const medianFinePrice = useMemo(() => {
    const prices = nearestContracts
      .map((c) => (c.fine_gold_price_per_gram ? Number(c.fine_gold_price_per_gram) : null))
      .filter((p): p is number => p !== null && p > 0)
      .sort((a, b) => a - b);
    if (prices.length === 0) return 0;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }, [nearestContracts]);

  // Raw streaks
  const rawStreaks = useMemo(() => {
    return ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"].map((sym) => {
      const contract = nearestContracts.find((c) => c.symbol === sym);
      const conf = STREAK_CONFIG[sym];
      if (!contract || !contract.fine_gold_price_per_gram || medianFinePrice === 0) {
        return {
          symbol: sym, contract: null,
          deviationBps: 0, varName: conf.varName,
          grams: conf.grams, liquidity: "Unknown",
        };
      }
      const price = Number(contract.fine_gold_price_per_gram);
      const devBps = ((price - medianFinePrice) / medianFinePrice) * 10000;
      return {
        symbol: sym, contract,
        deviationBps: devBps, varName: conf.varName,
        grams: conf.grams, liquidity: contract.label || "High",
      };
    });
  }, [nearestContracts, medianFinePrice]);

  // Auto-scale: pick smallest ±N that fits all deviations
  const autoScale = useMemo<Scale>(() => {
    const maxAbs = Math.max(...rawStreaks.map((s) => Math.abs(s.deviationBps)));
    for (const s of SCALE_OPTIONS) {
      if (maxAbs <= s) return s;
    }
    return 50;
  }, [rawStreaks]);

  const activeScale = manualScale ?? autoScale;

  const streaks = useMemo(() => {
    return rawStreaks.map((s) => {
      const isClamped = Math.abs(s.deviationBps) > activeScale;
      const clampedBps = Math.max(-activeScale, Math.min(activeScale, s.deviationBps));
      return { ...s, isClamped, clampedBps };
    });
  }, [rawStreaks, activeScale]);

  // SVG layout
  const width = 860;
  const height = 240;
  const margin = { top: 40, right: 180, bottom: 40, left: 180 };
  const plotWidth = width - margin.left - margin.right;
  const zeroX = margin.left + plotWidth / 2;
  const halfPlot = plotWidth / 2;

  const bpsToX = (bps: number) => zeroX + (bps / activeScale) * halfPlot;

  const rowHeight = 36;
  const startY = margin.top + 20;

  // Ticks: always 5 marks at multiples of scale/2
  const half = activeScale / 2;
  const ticks = [-activeScale, -half, 0, half, activeScale];

  return (
    <section
      aria-label="The Touchstone: cross-contract gold price agreement"
      className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
      style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
    >
      {/* Stone grain texture */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
        <filter id="stone-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#stone-grain)" />
      </svg>

      <div className="relative z-10 space-y-4">
        {/* Header row */}
        <div
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
        >
          <div>
            <h2
              className="font-display text-lg sm:text-xl font-semibold tracking-tight"
              style={{ color: "var(--color-surface)" }}
            >
              The Touchstone
            </h2>
            <p className="text-xs leading-normal mt-0.5" style={{ color: "rgba(255,255,255,0.60)" }}>
              Deviations from the median fine-gold price (INR {medianFinePrice > 0 ? medianFinePrice.toFixed(2) : "—"}/g).
              Axis: ±{activeScale} bps
              {manualScale === null ? ` (auto)` : " (manual)"}.
            </p>
          </div>

          {/* Scale toggle */}
          <div
            className="flex items-center rounded-xs overflow-hidden shrink-0"
            role="group"
            aria-label="Axis scale"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          >
            {SCALE_OPTIONS.map((s) => {
              const isActive = s === activeScale;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setManualScale(s === autoScale && manualScale === null ? null : s)}
                  aria-pressed={isActive}
                  className="px-3 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                    color: isActive ? "var(--color-surface)" : "rgba(255,255,255,0.50)",
                    transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
                  }}
                >
                  ±{s}
                </button>
              );
            })}
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-auto font-body">
            {/* Grid ticks */}
            <AnimatePresence mode="wait">
              <motion.g
                key={activeScale}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={TRANSITION.fast}
              >
                {ticks.map((tick) => {
                  const x = bpsToX(tick);
                  const isZero = tick === 0;
                  return (
                    <g key={tick}>
                      <line
                        x1={x} y1={margin.top} x2={x} y2={height - margin.bottom}
                        stroke="rgba(255,255,255,1)"
                        strokeOpacity={isZero ? 0.40 : 0.10}
                        strokeWidth={isZero ? 1.5 : 1}
                        strokeDasharray={isZero ? undefined : "2 3"}
                      />
                      <text
                        x={x} y={height - margin.bottom + 16}
                        fill="rgba(255,255,255,1)" fillOpacity={isZero ? 0.85 : 0.45}
                        fontSize="10" textAnchor="middle" className="tabular-nums"
                      >
                        {tick === 0 ? "0" : `${tick > 0 ? "+" : ""}${tick}`}
                      </text>
                    </g>
                  );
                })}
                {/* bps label under right edge */}
                <text
                  x={bpsToX(activeScale)} y={height - margin.bottom + 28}
                  fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle"
                >
                  bps
                </text>
              </motion.g>
            </AnimatePresence>

            {/* Four gold streaks */}
            {streaks.map((s, idx) => {
              const y = startY + idx * rowHeight;
              const targetX = bpsToX(s.clampedBps);
              const isPositive = s.clampedBps >= 0;
              // Pixel width — always at least MIN_STREAK_PX when contract exists
              const rawPx = Math.abs(targetX - zeroX);
              const streakPx = s.contract ? Math.max(MIN_STREAK_PX, rawPx) : 0;
              const xStart = isPositive ? zeroX : (s.contract ? Math.min(targetX, zeroX - MIN_STREAK_PX) : zeroX);

              let strokeDash: string | undefined;
              let isHollow = false;
              if (s.liquidity === "Medium")  strokeDash = "6 4";
              if (s.liquidity === "Low")     strokeDash = "2 4";
              if (s.liquidity === "Unknown" || s.liquidity === "Untradeable") isHollow = true;

              const colorVal = `var(${s.varName})`;

              return (
                <g key={s.symbol}>
                  {/* Left label */}
                  <text
                    x={margin.left - 14} y={y + 4}
                    fill="rgba(255,255,255,0.90)" fontSize="12" fontWeight="600" textAnchor="end"
                  >
                    {s.symbol}
                  </text>
                  <text
                    x={margin.left - 14} y={y + 15}
                    fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="end"
                  >
                    {s.contract ? `exp ${s.contract.expiry_date.slice(5)} · ${s.grams}` : "No data"}
                  </text>

                  {/* Track line */}
                  <line
                    x1={margin.left} y1={y} x2={width - margin.right} y2={y}
                    stroke="rgba(255,255,255,0.06)" strokeWidth="1"
                  />

                  {/* Animated streak */}
                  {!isHollow ? (
                    <motion.rect
                      key={`${s.symbol}-${activeScale}`}
                      initial={{ width: 0, x: zeroX }}
                      animate={{ x: xStart, width: streakPx }}
                      transition={TRANSITION.springSnap}
                      y={y - 4} height="8" rx="2"
                      fill={colorVal}
                      stroke={strokeDash ? colorVal : "none"}
                      strokeWidth={strokeDash ? "1.5" : "0"}
                      strokeDasharray={strokeDash}
                    />
                  ) : (
                    <motion.rect
                      key={`${s.symbol}-${activeScale}-hollow`}
                      initial={{ width: 0, x: zeroX }}
                      animate={{ x: xStart, width: streakPx }}
                      transition={TRANSITION.springSnap}
                      y={y - 4} height="8" rx="2"
                      fill="none" stroke={colorVal} strokeWidth="1.5" strokeDasharray="4 2"
                    />
                  )}

                  {/* Clamp break mark */}
                  {s.isClamped && (
                    <g transform={`translate(${isPositive ? width - margin.right - 8 : margin.left + 4}, ${y - 6})`}>
                      <line x1="0" y1="0" x2="4" y2="12" stroke="var(--color-madder)" strokeWidth="2" />
                      <line x1="4" y1="0" x2="8" y2="12" stroke="var(--color-madder)" strokeWidth="2" />
                    </g>
                  )}

                  {/* Right label — value */}
                  <text
                    x={width - margin.right + 14} y={y + 4}
                    fill={s.isClamped ? "var(--color-madder)" : "rgba(255,255,255,0.88)"}
                    fontSize="12" fontWeight="600" className="tabular-nums"
                  >
                    {s.contract
                      ? `${s.deviationBps > 0 ? "+" : ""}${s.deviationBps.toFixed(1)} bps`
                      : "—"}
                  </text>
                  <text
                    x={width - margin.right + 14} y={y + 15}
                    fill="rgba(255,255,255,0.45)" fontSize="9"
                  >
                    {s.liquidity}{isHollow ? " (excluded)" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-[11px]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}
        >
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-1.5 rounded-xs inline-block" style={{ background: "rgba(255,255,255,0.70)" }} />
            <span>High (solid)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 inline-block" style={{ borderTop: "2px dashed rgba(255,255,255,0.70)" }} />
            <span>Medium (dashed)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 inline-block" style={{ borderTop: "2px dotted rgba(255,255,255,0.70)" }} />
            <span>Low (dotted)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-1.5 rounded-xs inline-block" style={{ border: "1px solid rgba(255,255,255,0.55)" }} />
            <span>Untradeable / Unknown (hollow)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span style={{ color: "var(--color-madder)" }}>»</span>
            <span>Clamped — value exceeds scale</span>
          </div>
        </div>
      </div>
    </section>
  );
}
