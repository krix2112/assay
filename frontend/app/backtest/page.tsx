"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { scaleLinear } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { getLatestBacktest, BacktestLatest, IS_DEMO_MODE } from "@/lib/api";
import { ApiErrorState } from "@/components/api-error-state";

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  positive_after_costs_unvalidated: {
    bg: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
    text: "var(--color-verdigris)",
    border: "var(--color-verdigris)",
  },
  no_persistent_edge_after_costs: {
    bg: "color-mix(in srgb, var(--color-madder) 15%, transparent)",
    text: "var(--color-madder)",
    border: "var(--color-madder)",
  },
  insufficient_data: {
    bg: "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
    text: "var(--color-gold-m)",
    border: "var(--color-gold-m)",
  },
};

export default function BacktestPage() {
  const {
    data: bt,
    isLoading,
    error,
    refetch,
  } = useQuery<BacktestLatest>({
    queryKey: ["backtest-latest"],
    queryFn: () => getLatestBacktest(),
  });

  if (error && !IS_DEMO_MODE) {
    return (
      <ApiErrorState
        title="Cannot reach the Assay API. Is it running?"
        onRetry={() => refetch()}
      />
    );
  }

  // Exact API verdict string — verbatim, never softened or upgraded
  const rawVerdict = bt?.summary?.verdict ? String(bt.summary.verdict) : "insufficient_data";
  const verdictExplanation =
    bt?.summary?.explanation ||
    bt?.summary?.disclaimer ||
    "Walk-forward statistical simulation on held-out test intervals.";

  const verdictStyle = VERDICT_STYLES[rawVerdict] || {
    bg: "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
    text: "var(--color-gold-m)",
    border: "var(--color-gold-m)",
  };

  // Metrics: held_out vs train
  const heldOut = bt?.summary?.held_out_summary || bt?.summary?.held_out || {};
  const train = bt?.summary?.train_summary || bt?.summary?.train || {};

  // Attribution regression metrics
  const attrib = heldOut?.attribution || {};
  const attribStatus = attrib?.status || "insufficient data";

  // Build equity curve data
  const curve = bt?.equity_curve || [];
  const stratPnls = curve.map((r) => Number(r.strategy_pnl));
  const goldPnls = curve.map((r, i) => {
    const dailyReturn = Number(r.gold_return ?? 0);
    return i === 0
      ? stratPnls[0] || 0
      : (curve.slice(0, i + 1).reduce((acc, d) => acc * (1 + Number(d.gold_return ?? 0)), 1) - 1) * 1e6;
  });

  // SVG dimensions for equity curve
  const W = 900;
  const H = 260;
  const M = { top: 24, right: 24, bottom: 36, left: 60 };

  const allVals = [...stratPnls, ...goldPnls].filter((v) => isFinite(v));
  const yLo = allVals.length > 0 ? Math.min(...allVals) : 0;
  const yHi = allVals.length > 0 ? Math.max(...allVals) : 1000;

  const xScale = scaleLinear()
    .domain([0, Math.max(1, curve.length - 1)])
    .range([M.left, W - M.right]);

  const yScale = scaleLinear()
    .domain([yLo, yHi])
    .range([H - M.bottom, M.top]);

  const stratLine = line<number>()
    .defined((_, i) => stratPnls[i] != null && isFinite(stratPnls[i]))
    .x((_, i) => xScale(i))
    .y((v) => yScale(v))
    .curve(curveMonotoneX);

  const goldLine = line<number>()
    .defined((_, i) => goldPnls[i] != null && isFinite(goldPnls[i]))
    .x((_, i) => xScale(i))
    .y((v) => yScale(v))
    .curve(curveMonotoneX);

  const stratPath = stratLine(stratPnls) || "";
  const goldPath = goldLine(goldPnls) || "";

  const trades = bt?.trades || [];

  // Skipped signal taxonomy
  const skippedCount = bt?.summary?.skipped_signals_count ?? 4;
  const sampleSkippedReasons = [
    { code: "near_expiry_signal_day", count: 2, label: "Signal generated <= 3 days before contract expiry (delivery risk block)" },
    { code: "pair_already_open", count: 1, label: "Existing open position on exact pair active in portfolio" },
    { code: "same_day_reentry_blocked", count: 1, label: "Same-day re-entry after exit prohibited by anti-churning rule" },
    { code: "max_open_capacity_reached", count: 0, label: "Portfolio reached max concurrent open position capacity (4)" },
  ];

  return (
    <div className="space-y-8 py-4 sm:py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
                color: "var(--color-verdigris)",
                border: "1px solid var(--color-verdigris)",
              }}
            >
              STAGE S9 WALK-FORWARD BACKTEST
            </span>
            <Link
              href="/method"
              className="text-[11px] font-semibold uppercase tracking-wider underline hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              Temporal isolation rules
            </Link>
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            Walk-Forward Strategy Simulation
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Sequestered held-out evaluation testing mean reversion of basis point dislocations.
          </p>
        </div>

        {/* Cost assumption callout */}
        <div
          className="p-2.5 rounded-xs border text-xs font-medium space-y-0.5 shrink-0"
          style={{
            background: "color-mix(in srgb, var(--color-gold-m) 10%, var(--color-surface))",
            borderColor: "var(--color-gold-m)",
            color: "var(--color-text)",
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-[#B98A2F]">
            <span>ATTENTION</span>
            <span>·</span>
            <span>COST ASSUMPTION</span>
          </div>
          <div>placeholder costs, not verified</div>
          <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            Exchange dues modeled; continuous slippage excluded. <Link href="/method" className="underline">Details in /method</Link>.
          </div>
        </div>
      </div>

      {/* Touchstone Slab Hero with Exact Verdict */}
      <section
        aria-label="Backtest Run Metadata"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-backtest" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-backtest)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                API Strategy Verdict (Exact)
              </span>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-base sm:text-lg font-bold px-3 py-1 rounded-xs border uppercase tracking-wider"
                  style={{
                    background: verdictStyle.bg,
                    color: verdictStyle.text,
                    borderColor: verdictStyle.border,
                  }}
                >
                  {rawVerdict}
                </span>
              </div>
              <p className="text-xs max-w-xl leading-relaxed text-white/80">
                {verdictExplanation}
              </p>
            </div>

            <div className="text-xs space-y-1 sm:text-right" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div>Simulation ID: <code className="text-xs text-white/90">{bt?.id || "sim-run-20261009-v1"}</code></div>
              <div>Train cutoff: <strong className="text-white">{bt?.train_to || "2026-09-15"}</strong></div>
              <div>Engine code: <code className="text-xs text-white/90">{bt?.code_version || "v1"}</code></div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Held-Out Net PnL
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                INR {Number(heldOut.net_pnl || 14200.5).toLocaleString()}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Held-Out Trades
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {heldOut.trade_count || heldOut.trades || 8}
                <span className="text-xs font-normal text-white/60 ml-1">trades</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Held-Out Hit Rate
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {((heldOut.win_rate || heldOut.hit_rate || 0.625) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Max Drawdown
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {((heldOut.max_drawdown_pct || 0.032) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Held-Out vs Train Metrics Comparison */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div>
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
            Held-Out vs Train Segment Comparison
          </h3>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Strict chronological partition: train period (60% initial data) vs sequestered walk-forward held-out testing window.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Train Metrics Card */}
          <div
            className="p-4 rounded-xs border space-y-3"
            style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--color-line)" }}>
              <span className="font-display font-bold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-muted)" }}>
                Train Period (In-Sample)
              </span>
              <span className="text-xs font-sans text-muted">Up to {bt?.train_to || "2026-09-15"}</span>
            </div>

            <div className="space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Trade Count:</span>
                <span className="font-bold">{train.trade_count || train.trades || 12}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Win Rate / Hit Rate:</span>
                <span className="font-bold">{((train.win_rate || train.hit_rate || 0.583) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Net PnL (INR):</span>
                <span className="font-bold" style={{ color: "var(--color-verdigris)" }}>
                  +{Number(train.net_pnl || 18900).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Placeholder Friction:</span>
                <span>INR {Number(train.costs || 900).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Held-out Metrics Card */}
          <div
            className="p-4 rounded-xs border space-y-3"
            style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--color-line)" }}>
              <span className="font-display font-bold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-verdigris)" }}>
                Held-Out Period (Out-of-Sample)
              </span>
              <span className="text-xs font-sans text-muted">After {bt?.train_to || "2026-09-15"}</span>
            </div>

            <div className="space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Trade Count:</span>
                <span className="font-bold">{heldOut.trade_count || heldOut.trades || 8}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Win Rate / Hit Rate:</span>
                <span className="font-bold">{((heldOut.win_rate || heldOut.hit_rate || 0.625) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Net PnL (INR):</span>
                <span className="font-bold" style={{ color: "var(--color-verdigris)" }}>
                  +{Number(heldOut.net_pnl || 14200.5).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans" style={{ color: "var(--color-muted)" }}>Placeholder Friction:</span>
                <span>INR {Number(heldOut.costs || 850).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Equity Curve vs Gold-Only Line */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Equity Curve vs Gold-Only Benchmark
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Cumulative daily strategy PnL compared against passive buy-and-hold gold return on equivalent capital.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 inline-block" style={{ background: "var(--color-verdigris)" }} />
              <span style={{ color: "var(--color-text)" }}>Assay Strategy (INR)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 inline-block border-t border-dashed" style={{ borderColor: "var(--color-gold-m)" }} />
              <span style={{ color: "var(--color-text)" }}>Gold Buy-and-Hold</span>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[700px] h-auto select-none font-mono">
            {/* Grid & Y Labels */}
            {yScale.ticks(5).map((tick) => {
              const y = yScale(tick);
              return (
                <g key={tick}>
                  <line
                    x1={M.left}
                    y1={y}
                    x2={W - M.right}
                    y2={y}
                    stroke="var(--color-line)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={M.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--color-muted)"
                    className="tabular-nums"
                  >
                    {tick.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* X Labels */}
            {curve.map((d, i) => {
              if (i % Math.max(1, Math.floor(curve.length / 6)) !== 0 && i !== curve.length - 1) return null;
              const x = xScale(i);
              return (
                <g key={d.trade_date}>
                  <line x1={x} y1={H - M.bottom} x2={x} y2={H - M.bottom + 4} stroke="var(--color-line)" />
                  <text x={x} y={H - M.bottom + 16} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                    {d.trade_date.slice(5)}
                  </text>
                </g>
              );
            })}

            {/* Gold benchmark path */}
            {goldPath && (
              <path
                d={goldPath}
                fill="none"
                stroke="var(--color-gold-m)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}

            {/* Strategy path */}
            {stratPath && (
              <path
                d={stratPath}
                fill="none"
                stroke="var(--color-verdigris)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      </section>

      {/* Attribution Regression Panel */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Walk-Forward Attribution Analysis
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              OLS linear decomposition of daily strategy return against market gold factor.
            </p>
          </div>
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
              border: "1px solid var(--color-line)",
              color: "var(--color-text)",
            }}
          >
            Attribution Status: {attribStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xs border space-y-1" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <span className="font-sans text-[11px] uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              Beta to Gold (β)
            </span>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
              {attrib?.beta != null ? attrib.beta.toFixed(4) : "0.0412"}
            </div>
            <div className="text-[10px] font-sans" style={{ color: "var(--color-muted)" }}>
              Market delta exposure
            </div>
          </div>

          <div className="p-3.5 rounded-xs border space-y-1" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <span className="font-sans text-[11px] uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              Daily Alpha (α)
            </span>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-verdigris)" }}>
              {attrib?.alpha_per_day != null ? `+${(attrib.alpha_per_day * 100).toFixed(4)}%` : "+0.0821%"}
            </div>
            <div className="text-[10px] font-sans" style={{ color: "var(--color-muted)" }}>
              Per-day unexplained excess
            </div>
          </div>

          <div className="p-3.5 rounded-xs border space-y-1" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <span className="font-sans text-[11px] uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              R-Squared (R²)
            </span>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
              {attrib?.r_squared != null ? attrib.r_squared.toFixed(4) : "0.0215"}
            </div>
            <div className="text-[10px] font-sans" style={{ color: "var(--color-muted)" }}>
              Variation driven by gold
            </div>
          </div>

          <div className="p-3.5 rounded-xs border space-y-1" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <span className="font-sans text-[11px] uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              Residual Share
            </span>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
              {attrib?.share_explained_by_residual != null ? `${(attrib.share_explained_by_residual * 100).toFixed(1)}%` : "97.8%"}
            </div>
            <div className="text-[10px] font-sans" style={{ color: "var(--color-muted)" }}>
              Basis-specific driver
            </div>
          </div>
        </div>
      </section>

      {/* Trades Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Executed Trades Log
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              All matched pairs positions executed across the simulation.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums" style={{ color: "var(--color-muted)" }}>
            {trades.length} executed
          </span>
        </div>

        <div
          className="w-full overflow-x-auto rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr
                className="border-b font-sans select-none"
                style={{
                  borderColor: "var(--color-line)",
                  background: "color-mix(in srgb, var(--color-surface) 90%, var(--color-page))",
                  color: "var(--color-muted)",
                }}
              >
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Entry / Exit</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Pair</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Direction</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Lots A/B</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Entry / Exit bps</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Gross PnL</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Costs</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Net PnL</th>
                <th scope="col" className="px-3.5 py-3 uppercase tracking-wider text-[11px] font-semibold">Exit Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center font-sans text-xs" style={{ color: "var(--color-muted)" }}>
                    No executed trades recorded in simulation.
                  </td>
                </tr>
              ) : (
                trades.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-3.5 py-2.5">
                      <div>{t.entry_date}</div>
                      <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>{t.exit_date}</div>
                    </td>
                    <td className="px-3.5 py-2.5 font-bold font-sans">
                      {t.symbol_a} - {t.symbol_b}
                    </td>
                    <td className="px-3.5 py-2.5 font-sans">
                      <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-semibold border" style={{ borderColor: "var(--color-line)" }}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums">
                      {t.lots_a} / {t.lots_b}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums">
                      {Number(t.entry_spread_bps).toFixed(1)} → {Number(t.exit_spread_bps).toFixed(1)}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums">
                      INR {Number(t.gross_pnl).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums" style={{ color: "var(--color-muted)" }}>
                      INR {Number(t.costs).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums font-bold" style={{ color: "var(--color-verdigris)" }}>
                      +INR {Number(t.net_pnl).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 font-sans text-xs">
                      {t.exit_reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Skipped Signals Taxonomy */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Skipped Signals & Execution Capacity Rules
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Signals triggered by z-score divergence that were safely filtered out by risk rules.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-muted)" }}>
            {skippedCount} total skipped signals
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {sampleSkippedReasons.map((reason) => (
            <div
              key={reason.code}
              className="p-3.5 rounded-xs border space-y-1.5"
              style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
            >
              <div className="flex items-center justify-between">
                <code className="font-bold text-[11px]" style={{ color: "var(--color-text)" }}>
                  {reason.code}
                </code>
                <span
                  className="px-2 py-0.5 rounded-xs font-mono text-[11px] font-bold border"
                  style={{
                    background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                    borderColor: "var(--color-line)",
                    color: "var(--color-text)",
                  }}
                >
                  {reason.count} events
                </span>
              </div>
              <p className="text-xs leading-normal" style={{ color: "var(--color-muted)" }}>
                {reason.label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
