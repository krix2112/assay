"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { scaleLinear, scaleTime } from "d3-scale";
import { line, area, curveLinear } from "d3-shape";
import {
  getParityHistory,
  getAllSpreads,
  SpreadItem,
  ParityResponse,
  IS_DEMO_MODE,
} from "@/lib/api";
import { ApiErrorState } from "@/components/api-error-state";
import { EmptyDataState } from "@/components/empty-data-state";

const PAIR_OPTIONS = [
  { a: "GOLDM", b: "GOLDTEN", label: "GOLDM — GOLDTEN (100g vs 10g)" },
  { a: "GOLDM", b: "GOLDGUINEA", label: "GOLDM — GOLDGUINEA (100g vs 8g)" },
  { a: "GOLDM", b: "GOLDPETAL", label: "GOLDM — GOLDPETAL (100g vs 1g)" },
  { a: "GOLDTEN", b: "GOLDGUINEA", label: "GOLDTEN — GOLDGUINEA (10g vs 8g)" },
  { a: "GOLDTEN", b: "GOLDPETAL", label: "GOLDTEN — GOLDPETAL (10g vs 1g)" },
  { a: "GOLDGUINEA", b: "GOLDPETAL", label: "GOLDGUINEA — GOLDPETAL (8g vs 1g)" },
];

export default function SpreadsPage() {
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const activePair = PAIR_OPTIONS[selectedPairIndex];

  // Fetch trading dates
  const {
    data: history = [],
    isLoading: isHistoryLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<ParityResponse[]>({
    queryKey: ["parity-history"],
    queryFn: () => getParityHistory(),
  });

  const tradingDates = useMemo(() => history.map((h) => h.trade_date), [history]);

  // Fetch all spreads
  const {
    data: spreadsMap = {},
    isLoading: isSpreadsLoading,
    error: spreadsError,
    refetch: refetchSpreads,
  } = useQuery<Record<string, SpreadItem[]>>({
    queryKey: ["all-spreads", tradingDates],
    queryFn: () => getAllSpreads(tradingDates),
    enabled: tradingDates.length > 0,
  });

  // Extract time-series for the selected pair across all dates
  // Keep gaps as gaps: preserve trade_date order and mark missing days as null
  const pairSeries = useMemo(() => {
    return tradingDates.map((dateStr) => {
      const items = spreadsMap[dateStr] || [];
      const item = items.find(
        (s) =>
          (s.symbol_a === activePair.a && s.symbol_b === activePair.b) ||
          (s.symbol_a === activePair.b && s.symbol_b === activePair.a)
      );
      if (!item) {
        return {
          dateStr,
          dateObj: new Date(dateStr),
          hasData: false,
          spreadBps: null,
          medianBps: null,
          madBps: null,
          robustZ: null,
          lowerBand: null,
          upperBand: null,
          item: null,
        };
      }

      const spread = Number(item.spread_bps);
      const median = item.rolling_median_bps != null ? Number(item.rolling_median_bps) : null;
      const mad = item.rolling_mad_bps != null ? Number(item.rolling_mad_bps) : null;
      const z = item.robust_z != null ? Number(item.robust_z) : null;

      // Robust z band: +/- 2 robust z corresponds to median +/- 2 * (1.4826 * MAD)
      let lowerBand: number | null = null;
      let upperBand: number | null = null;
      if (median != null && mad != null) {
        const spreadUnit = 1.4826 * mad;
        lowerBand = median - 2 * spreadUnit;
        upperBand = median + 2 * spreadUnit;
      }

      return {
        dateStr,
        dateObj: new Date(dateStr),
        hasData: true,
        spreadBps: spread,
        medianBps: median,
        madBps: mad,
        robustZ: z,
        lowerBand,
        upperBand,
        item,
      };
    });
  }, [tradingDates, spreadsMap, activePair]);

  // Outlier / dislocation days where |robust_z| >= 2.0
  const dislocationDays = useMemo(() => {
    return pairSeries
      .filter((p) => p.robustZ != null && Math.abs(p.robustZ) >= 2.0)
      .reverse();
  }, [pairSeries]);

  // Latest populated item for Hero stats
  const latestPoint = useMemo(() => {
    for (let i = pairSeries.length - 1; i >= 0; i--) {
      if (pairSeries[i].hasData) return pairSeries[i];
    }
    return null;
  }, [pairSeries]);

  if (historyError || (spreadsError && !IS_DEMO_MODE)) {
    return (
      <ApiErrorState
        title="Cannot reach the Assay API. Is it running?"
        onRetry={() => {
          refetchHistory();
          refetchSpreads();
        }}
      />
    );
  }

  // Handle empty database
  if (!isHistoryLoading && (!history || history.length === 0)) {
    return <EmptyDataState />;
  }

  // Chart Dimensions
  const W = 1000;
  const H = 340;
  const M = { top: 30, right: 30, bottom: 40, left: 60 };

  // Collect all values for y scale domain
  const yVals = pairSeries
    .flatMap((p) => [p.spreadBps, p.medianBps, p.lowerBand, p.upperBand])
    .filter((v): v is number => v != null && isFinite(v));

  const yMin = yVals.length > 0 ? Math.floor(Math.min(...yVals) - 2) : -10;
  const yMax = yVals.length > 0 ? Math.ceil(Math.max(...yVals) + 2) : 10;

  const xScale = scaleLinear()
    .domain([0, Math.max(1, pairSeries.length - 1)])
    .range([M.left, W - M.right]);

  const yScale = scaleLinear()
    .domain([yMin, yMax])
    .range([H - M.bottom, M.top]);

  // Gaps stay gaps: line defined predicate skips null dates
  const spreadLine = line<(typeof pairSeries)[0]>()
    .defined((d) => d.spreadBps != null)
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.spreadBps!))
    .curve(curveLinear);

  const medianLine = line<(typeof pairSeries)[0]>()
    .defined((d) => d.medianBps != null)
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.medianBps!))
    .curve(curveLinear);

  const bandArea = area<(typeof pairSeries)[0]>()
    .defined((d) => d.lowerBand != null && d.upperBand != null)
    .x((_, i) => xScale(i))
    .y0((d) => yScale(d.lowerBand!))
    .y1((d) => yScale(d.upperBand!))
    .curve(curveLinear);

  const spreadPath = spreadLine(pairSeries) || "";
  const medianPath = medianLine(pairSeries) || "";
  const bandPath = bandArea(pairSeries) || "";

  // Ticks
  const yTicks = yScale.ticks(6);
  const xStep = Math.max(1, Math.floor(pairSeries.length / 8));

  return (
    <div className="space-y-8 py-4 sm:py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-tag-gold) 12%, transparent)",
                color: "var(--color-tag-gold)",
                border: "1px solid var(--color-tag-gold)",
              }}
            >
              PAIR BASKET EXPLORER
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-muted) 15%, transparent)",
                color: "var(--color-muted)",
                border: "1px solid var(--color-line)",
              }}
            >
              No carry adjustment in v1
            </span>
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            Cross-Contract Spread Dynamics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Rolling basis point spread tracking with ±2 robust z-score bands and dislocation markers.
          </p>
        </div>

        {/* Pair Picker */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="pair-select" className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
            Select Pair:
          </label>
          <select
            id="pair-select"
            value={selectedPairIndex}
            onChange={(e) => setSelectedPairIndex(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-semibold rounded-xs border transition-colors cursor-pointer"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
              color: "var(--color-text)",
            }}
          >
            {PAIR_OPTIONS.map((opt, idx) => (
              <option key={opt.label} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Touchstone Slab Hero */}
      <section
        aria-label="Pair Overview Slab"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        {/* Stone grain texture */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-spreads" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-spreads)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                Active Pair Specification
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {activePair.a} vs {activePair.b}
              </h2>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Expiry gap: <strong className="text-white">{latestPoint?.item?.expiry_gap_days ?? "—"} days</strong> · Method: <code className="text-xs text-white/90">v1 (backward-only MAD)</code>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Latest Spread
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {latestPoint?.spreadBps != null ? `${latestPoint.spreadBps > 0 ? "+" : ""}${latestPoint.spreadBps.toFixed(2)}` : "—"}
                <span className="text-xs font-normal text-white/60 ml-1">bps</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Rolling Median
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {latestPoint?.medianBps != null ? `${latestPoint.medianBps.toFixed(2)}` : "—"}
                <span className="text-xs font-normal text-white/60 ml-1">bps</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Robust Z-Score
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {latestPoint?.robustZ != null ? `${latestPoint.robustZ > 0 ? "+" : ""}${latestPoint.robustZ.toFixed(2)}` : "—"}
                <span className="text-xs font-normal text-white/60 ml-1">σ</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Dislocation Events
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {dislocationDays.length}
                <span className="text-xs font-normal text-white/60 ml-1">sessions (|z| ≥ 2)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spread Time Series Chart */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Historical Spread & ±2 Robust Z-Band
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Gaps stay gaps: unobserved trading days or missing contract pairs are preserved as broken lines without interpolation.
            </p>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 text-xs select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 inline-block" style={{ background: "var(--color-verdigris)" }} />
              <span style={{ color: "var(--color-text)" }}>Daily Spread (bps)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 inline-block border-t border-dashed" style={{ borderColor: "var(--color-gold-m)" }} />
              <span style={{ color: "var(--color-text)" }}>Median</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs inline-block" style={{ background: "color-mix(in srgb, var(--color-verdigris) 18%, transparent)" }} />
              <span style={{ color: "var(--color-muted)" }}>±2 Robust Z Band</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--color-madder)" }} />
              <span style={{ color: "var(--color-text)" }}>|z| ≥ 2 Outlier</span>
            </div>
          </div>
        </div>

        {/* SVG Canvas */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px] h-auto select-none font-mono">
            {/* Horizontal Grid lines & Y labels */}
            {yTicks.map((tick) => {
              const y = yScale(tick);
              const isZero = tick === 0;
              return (
                <g key={tick}>
                  <line
                    x1={M.left}
                    y1={y}
                    x2={W - M.right}
                    y2={y}
                    stroke="var(--color-line)"
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? undefined : "3 3"}
                  />
                  <text
                    x={M.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--color-muted)"
                    className="tabular-nums"
                  >
                    {tick > 0 ? `+${tick}` : tick}
                  </text>
                </g>
              );
            })}

            {/* X Axis dates */}
            {pairSeries.map((p, idx) => {
              if (idx % xStep !== 0 && idx !== pairSeries.length - 1) return null;
              const x = xScale(idx);
              return (
                <g key={p.dateStr}>
                  <line
                    x1={x}
                    y1={H - M.bottom}
                    x2={x}
                    y2={H - M.bottom + 5}
                    stroke="var(--color-line)"
                  />
                  <text
                    x={x}
                    y={H - M.bottom + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-muted)"
                  >
                    {p.dateStr.slice(5)}
                  </text>
                </g>
              );
            })}

            {/* Shaded +/-2 Robust Z Band */}
            {bandPath && (
              <path
                d={bandPath}
                fill="var(--color-verdigris)"
                fillOpacity="0.14"
                className="chart-gap"
              />
            )}

            {/* Rolling Median Line */}
            {medianPath && (
              <path
                d={medianPath}
                fill="none"
                stroke="var(--color-gold-m)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="chart-gap"
              />
            )}

            {/* Spread bps Line */}
            {spreadPath && (
              <path
                d={spreadPath}
                fill="none"
                stroke="var(--color-verdigris)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="chart-gap"
              />
            )}

            {/* Dislocation Day Markers (|z| >= 2.0) */}
            {pairSeries.map((p, idx) => {
              if (p.spreadBps == null || p.robustZ == null || Math.abs(p.robustZ) < 2.0) {
                return null;
              }
              const cx = xScale(idx);
              const cy = yScale(p.spreadBps);
              return (
                <g key={`marker-${p.dateStr}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4.5"
                    fill="var(--color-madder)"
                    stroke="var(--color-surface)"
                    strokeWidth="1.5"
                  />
                  <title>
                    {`${p.dateStr}: ${p.spreadBps > 0 ? "+" : ""}${p.spreadBps.toFixed(2)} bps (z=${p.robustZ.toFixed(2)})`}
                  </title>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Dislocation Days Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Sessions Beyond ±2 Robust Z-Band
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Dates where basis agreement diverged beyond the normal distribution envelope.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums" style={{ color: "var(--color-muted)" }}>
            {dislocationDays.length} sessions
          </span>
        </div>

        <div
          className="w-full overflow-x-auto rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b font-medium select-none"
                style={{
                  borderColor: "var(--color-line)",
                  background: "color-mix(in srgb, var(--color-surface) 90%, var(--color-page))",
                  color: "var(--color-muted)",
                }}
              >
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Spread (bps)</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Median (bps)</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Robust Z</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Liquidity Tier</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Expiry Gap</th>
              </tr>
            </thead>

            <tbody className="divide-y font-mono" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
              {dislocationDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs font-sans" style={{ color: "var(--color-muted)" }}>
                    No dislocation sessions observed beyond ±2 robust z for this pair.
                  </td>
                </tr>
              ) : (
                dislocationDays.map((d) => {
                  const z = d.robustZ!;
                  return (
                    <tr key={d.dateStr} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5 font-semibold font-sans">{d.dateStr}</td>
                      <td className="px-4 py-2.5 tabular-nums font-bold" style={{ color: "var(--color-madder)" }}>
                        {d.spreadBps! > 0 ? "+" : ""}{d.spreadBps!.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--color-muted)" }}>
                        {d.medianBps != null ? d.medianBps.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold" style={{ color: "var(--color-madder)" }}>
                        {z > 0 ? `+${z.toFixed(2)}` : z.toFixed(2)}σ
                      </td>
                      <td className="px-4 py-2.5 font-sans">
                        <span
                          className="px-2 py-0.5 rounded-xs text-[11px] font-medium border"
                          style={{
                            background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                            borderColor: "var(--color-line)",
                          }}
                        >
                          {d.item?.weaker_liquidity_label || "Standard"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--color-muted)" }}>
                        {d.item?.expiry_gap_days != null ? `${d.item.expiry_gap_days}d` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
