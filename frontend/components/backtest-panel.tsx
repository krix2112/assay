"use client";

import React, { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX } from "d3-shape";
import { useQuery } from "@tanstack/react-query";
import { getLatestBacktest, BacktestLatest } from "@/lib/api";
import { useCrosshair } from "@/lib/crosshair";
import { TRANSITION } from "@/lib/motion";
import { motion } from "motion/react";

const W = 640, H = 140;
const M = { top: 16, right: 16, bottom: 28, left: 56 };

const VERDICT_COLOUR: Record<string, string> = {
  positive_after_costs_unvalidated: "var(--color-verdigris)",
  no_persistent_edge_after_costs:    "var(--color-madder)",
  insufficient_data:                 "var(--color-gold-m)",
};

export function BacktestPanel() {
  const { data: bt, isLoading } = useQuery<BacktestLatest | null>({
    queryKey: ["backtest-latest"],
    queryFn: getLatestBacktest,
  });

  const { crosshairDate } = useCrosshair();

  // Build equity curve series
  const curve = useMemo(() => bt?.equity_curve ?? [], [bt]);

  const stratPnls = curve.map((r) => Number(r.strategy_pnl));
  const goldPnls  = curve.map((r, i) => {
    // cumulative sum of gold_return (percentage) scaled to first stratPnl
    const dailyReturn = Number(r.gold_return ?? 0);
    return i === 0
      ? stratPnls[0]
      : (curve.slice(0, i + 1).reduce((acc, d) => acc * (1 + Number(d.gold_return ?? 0)), 1) - 1) * 1e6;
  });

  const allVals = [...stratPnls, ...goldPnls].filter((v) => isFinite(v));
  const yLo = allVals.length ? Math.min(...allVals) : 0;
  const yHi = allVals.length ? Math.max(...allVals) : 1000;

  const xSc = scaleLinear().domain([0, Math.max(1, curve.length - 1)]).range([M.left, W - M.right]);
  const ySc = scaleLinear().domain([yLo, yHi]).range([H - M.bottom, M.top]);

  const stratLineGen = line<number>()
    .defined((_, i) => stratPnls[i] != null && isFinite(stratPnls[i]))
    .x((_, i) => xSc(i))
    .y((v) => ySc(v))
    .curve(curveMonotoneX);

  const goldLineGen = line<number>()
    .defined((_, i) => goldPnls[i] != null && isFinite(goldPnls[i]))
    .x((_, i) => xSc(i))
    .y((v) => ySc(v))
    .curve(curveMonotoneX);

  const stratPath = stratLineGen(stratPnls) ?? "";
  const goldPath  = goldLineGen(goldPnls) ?? "";

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5 sm:p-6 animate-pulse"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", height: 200 }}
      />
    );
  }

  if (!bt) return null;

  const verdict = bt.summary?.verdict ?? "unknown";
  const heldOut = bt.summary?.held_out ?? {};
  const verdictColor = VERDICT_COLOUR[verdict] ?? "var(--color-muted)";

  // Cursor index
  const cursorIdx = crosshairDate
    ? curve.findIndex((r) => r.trade_date === crosshairDate)
    : -1;
  const cursorX = cursorIdx >= 0 ? xSc(cursorIdx) : null;

  // Y-axis ticks
  const yTicks = ySc.ticks(3);

  return (
    <motion.div
      className="rounded-xl p-5 sm:p-6 space-y-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION.slow}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 justify-between">
        <div>
          <h3
            className="font-display text-base sm:text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Backtest verdict
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            Held-out period only. Training numbers are not shown.
          </p>
        </div>
        <span
          className="text-xs font-mono font-semibold rounded-xs px-2 py-0.5 border uppercase tracking-wider"
          style={{
            color: verdictColor,
            background: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
            borderColor: verdictColor,
          }}
        >
          {verdict}
        </span>
      </div>

      {/* Equity curve */}
      {curve.length > 1 && (
        <div className="w-full overflow-x-auto" role="img" aria-label="Backtest strategy vs gold equity curve">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[360px]"
            style={{ display: "block" }}
          >
            {/* Y ticks */}
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left} y1={ySc(t)} x2={W - M.right} y2={ySc(t)}
                  stroke="var(--color-line)" strokeWidth="1"
                />
                <text
                  x={M.left - 4} y={ySc(t) + 4}
                  textAnchor="end" fontSize="9"
                  fontFamily="var(--font-body)"
                  fill="var(--color-muted)"
                >
                  {(t / 1000).toFixed(0)}k
                </text>
              </g>
            ))}

            {/* Zero line */}
            {yLo < 0 && (
              <line
                x1={M.left} y1={ySc(0)} x2={W - M.right} y2={ySc(0)}
                stroke="var(--color-text)" strokeOpacity="0.20" strokeWidth="1"
              />
            )}

            {/* Gold benchmark — gaps stay as gaps */}
            <path
              d={goldPath}
              fill="none"
              stroke="var(--color-gold-m)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeOpacity="0.70"
            />

            {/* Strategy equity — gaps stay as gaps */}
            <path
              d={stratPath}
              fill="none"
              stroke="var(--color-verdigris)"
              strokeWidth="2"
            />

            {/* Crosshair */}
            {cursorX !== null && (
              <line
                x1={cursorX} y1={M.top}
                x2={cursorX} y2={H - M.bottom}
                stroke="var(--color-text)" strokeOpacity="0.30" strokeWidth="1"
              />
            )}

            {/* X axis labels: first and last */}
            {curve.length > 0 && (
              <>
                <text
                  x={M.left} y={H - 4}
                  fontSize="9" fontFamily="var(--font-body)" fill="var(--color-muted)"
                >
                  {curve[0].trade_date.slice(5)}
                </text>
                <text
                  x={W - M.right} y={H - 4}
                  textAnchor="end" fontSize="9" fontFamily="var(--font-body)" fill="var(--color-muted)"
                >
                  {curve[curve.length - 1].trade_date.slice(5)}
                </text>
              </>
            )}

            {/* Legend */}
            <g>
              <line x1={W - M.right - 72} y1={M.top + 8} x2={W - M.right - 56} y2={M.top + 8}
                stroke="var(--color-verdigris)" strokeWidth="2" />
              <text x={W - M.right - 52} y={M.top + 12}
                fontSize="9" fontFamily="var(--font-body)" fill="var(--color-muted)">Strategy</text>
              <line x1={W - M.right - 72} y1={M.top + 22} x2={W - M.right - 56} y2={M.top + 22}
                stroke="var(--color-gold-m)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={W - M.right - 52} y={M.top + 26}
                fontSize="9" fontFamily="var(--font-body)" fill="var(--color-muted)">Buy-hold gold</text>
            </g>
          </svg>
        </div>
      )}

      {/* Key held-out metrics */}
      <div className="flex flex-wrap gap-4 text-sm">
        {[
          { label: "Trades",       value: String(heldOut.trade_count ?? "—") },
          { label: "Win rate",     value: heldOut.win_rate != null ? `${(Number(heldOut.win_rate) * 100).toFixed(0)}%` : "—" },
          { label: "Net PnL",      value: heldOut.net_pnl != null ? `₹${Number(heldOut.net_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—" },
          { label: "Sharpe",       value: heldOut.sharpe != null ? Number(heldOut.sharpe).toFixed(2) : "—" },
          { label: "Max drawdown", value: heldOut.max_drawdown_pct != null ? `${(Number(heldOut.max_drawdown_pct) * 100).toFixed(1)}%` : "—" },
        ].map((m, i) => (
          <React.Fragment key={m.label}>
            {i > 0 && (
              <span
                aria-hidden
                style={{ display: "inline-block", width: 1, background: "var(--color-line)", alignSelf: "stretch", margin: "0 0.25rem" }}
              />
            )}
            <div className="flex flex-col">
              <span className="font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>{m.value}</span>
              <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>{m.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Compliance disclaimer */}
      <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Backtest results are synthetic and based on historical sample data only. Past performance is
        not indicative of future results. This is not investment advice. Trade count in the held-out
        period is small; results are illustrative only.
      </p>
    </motion.div>
  );
}
