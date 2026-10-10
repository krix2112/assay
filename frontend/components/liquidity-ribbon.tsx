"use client";

import React, { useId, useMemo } from "react";
import { ContractDayItem } from "@/lib/api";
import { useCrosshair } from "@/lib/crosshair";
import { useTheme } from "@/lib/theme";

interface LiquidityRibbonProps {
  contractsByDate: Record<string, ContractDayItem[]>;
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
}

const SYMBOLS = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"] as const;

/** Map liquidity label → fill colour variable + opacity */
const LABEL_COLOUR: Record<string, { fill: string; opacity: number }> = {
  High:        { fill: "var(--color-verdigris)", opacity: 0.90 },
  Medium:      { fill: "var(--color-gold-m)",    opacity: 0.90 },
  Low:         { fill: "var(--color-madder)",    opacity: 0.72 },
  Untradeable: { fill: "var(--color-madder)",    opacity: 1.00 },
  Unknown:     { fill: "var(--color-muted)",     opacity: 0.70 },
};

const W = 760, RIBBON_H = 18, LABEL_W = 108;
const GAP = 4;
const MARGIN = { top: 24, right: 16, bottom: 20, left: LABEL_W + 12 };

export function LiquidityRibbon({
  contractsByDate,
  dates,
  selectedDate,
  onSelectDate,
  isLoading = false,
}: LiquidityRibbonProps) {
  const uid = useId();
  const rawId = uid.replace(/:/g, "");
  const noDataId = `ribbon-nodata-${rawId}`;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const dotColor = isDark ? "rgba(228,232,227,0.40)" : "rgba(42,52,49,0.35)";

  const { crosshairDate, setCrosshairDate } = useCrosshair();
  const activeDates = dates.slice(-30);
  const activeCursor = crosshairDate ?? selectedDate;

  const rows = useMemo(() => {
    return SYMBOLS.map((sym) => ({
      sym,
      cells: activeDates.map((d) => {
        const contracts = contractsByDate[d] || [];
        const match = contracts
          .filter((c) => c.symbol === sym)
          .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))[0];
        return {
          date: d,
          hasData: Boolean(match),
          label: match?.label ?? "No data",
        };
      }),
    }));
  }, [contractsByDate, activeDates]);

  const cellW = (W - MARGIN.left - MARGIN.right) / Math.max(1, activeDates.length);
  const totalH = MARGIN.top + SYMBOLS.length * (RIBBON_H + GAP) + MARGIN.bottom;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const svgX = frac * W;
    const idx = Math.floor((svgX - MARGIN.left) / cellW);
    const clamped = Math.max(0, Math.min(activeDates.length - 1, idx));
    setCrosshairDate(activeDates[clamped] || null);
  };

  return (
    <div
      className="rounded-xl p-5 sm:p-6 space-y-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
    >
      <div>
        <h3
          className="font-display text-base sm:text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Liquidity ribbon
        </h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
          Liquidity classification per contract over time, aligned to the time axis.
        </p>
      </div>

      <div
        className="w-full overflow-x-auto"
        role="img"
        aria-label="Liquidity ribbon timeline"
      >
        <svg
          viewBox={`0 0 ${W} ${totalH}`}
          className="w-full min-w-[440px]"
          style={{ display: "block", cursor: "crosshair" }}
          onPointerMove={handlePointer}
          onPointerLeave={() => setCrosshairDate(null)}
          onClick={() => { if (activeCursor) onSelectDate(activeCursor); }}
        >
          <defs>
            <pattern id={noDataId} width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill={dotColor} />
            </pattern>
          </defs>

          {/* X axis labels */}
          {[0, Math.floor(activeDates.length / 3), Math.floor(activeDates.length * 2 / 3), activeDates.length - 1].map((i) => (
            <text
              key={i}
              x={MARGIN.left + i * cellW + cellW / 2}
              y={totalH - 4}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-body)"
              fill="var(--color-muted)"
            >
              {activeDates[i]?.slice(5) ?? ""}
            </text>
          ))}

          {/* Skeleton state */}
          {isLoading && (
            <g className="animate-pulse">
              {SYMBOLS.map((sym, rIdx) => {
                const y = MARGIN.top + rIdx * (RIBBON_H + GAP);
                return (
                  <g key={`skel-${sym}`}>
                    <text
                      x={MARGIN.left - 8}
                      y={y + RIBBON_H / 2 + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontFamily="var(--font-body)"
                      fill="var(--color-muted)"
                    >
                      {sym}
                    </text>
                    {activeDates.map((d, cIdx) => (
                      <rect
                        key={`skel-c-${sym}-${d}`}
                        x={MARGIN.left + cIdx * cellW + 0.5}
                        y={y}
                        width={Math.max(1, cellW - 1)}
                        height={RIBBON_H}
                        rx="1"
                        fill="var(--color-page)"
                        fillOpacity="0.6"
                        stroke="var(--color-line)"
                        strokeWidth="0.5"
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          )}

          {/* Loaded rows */}
          {!isLoading && rows.map((row, rIdx) => {
            const y = MARGIN.top + rIdx * (RIBBON_H + GAP);
            return (
              <g key={row.sym}>
                {/* Symbol label */}
                <text
                  x={MARGIN.left - 8}
                  y={y + RIBBON_H / 2 + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="var(--font-body)"
                  fill="var(--color-text)"
                  fontWeight="500"
                >
                  {row.sym}
                </text>

                {/* Cells */}
                {row.cells.map((cell, cIdx) => {
                  const cx = MARGIN.left + cIdx * cellW;
                  const isActive = cell.date === activeCursor;
                  const style = LABEL_COLOUR[cell.label];

                  if (!cell.hasData || !style) {
                    return (
                      <rect
                        key={cell.date}
                        x={cx + 0.5}
                        y={y}
                        width={Math.max(1, cellW - 1)}
                        height={RIBBON_H}
                        rx="1"
                        fill={`url(#${noDataId})`}
                        stroke={isActive ? "var(--color-text)" : "var(--color-line)"}
                        strokeWidth={isActive ? 1.5 : 0.75}
                        strokeDasharray={isActive ? undefined : "2 2"}
                        aria-label={`${row.sym} ${cell.date}: no data`}
                      />
                    );
                  }

                  return (
                    <rect
                      key={cell.date}
                      x={cx + 0.5}
                      y={y}
                      width={Math.max(1, cellW - 1)}
                      height={RIBBON_H}
                      rx="1"
                      fill={style.fill}
                      fillOpacity={style.opacity}
                      stroke={isActive ? "var(--color-text)" : "none"}
                      strokeWidth={isActive ? 1.5 : 0}
                      aria-label={`${row.sym} ${cell.date}: ${cell.label}`}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Vertical cursor */}
          {!isLoading && (() => {
            const idx = activeDates.indexOf(activeCursor);
            if (idx < 0) return null;
            const cx = MARGIN.left + idx * cellW + cellW / 2;
            return (
              <line
                x1={cx} y1={MARGIN.top - 4}
                x2={cx} y2={totalH - MARGIN.bottom}
                stroke="var(--color-text)"
                strokeOpacity="0.30"
                strokeWidth="1"
              />
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: "var(--color-muted)" }}>
        {Object.entries(LABEL_COLOUR).map(([lbl, style]) => (
          <span key={lbl} className="flex items-center space-x-1">
            <span
              className="w-3 h-3 rounded-xs inline-block"
              style={{ background: style.fill, opacity: style.opacity, border: "1px solid var(--color-line)" }}
            />
            <span>{lbl}</span>
          </span>
        ))}
        {/* No data swatch */}
        <span className="flex items-center space-x-1">
          <svg width="12" height="12" aria-hidden="true" className="rounded-xs overflow-hidden">
            <defs>
              <pattern id={`${noDataId}-legend`} width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill={dotColor} />
              </pattern>
            </defs>
            <rect width="12" height="12" fill={`url(#${noDataId}-legend)`}
              stroke="var(--color-line)" strokeWidth="0.75" strokeDasharray="2 2" />
          </svg>
          <span>No data</span>
        </span>
      </div>

      <p className="sr-only">
        Liquidity ribbon showing daily classification for each of the four MCX gold contracts over the last 30 trading days.
        Current date: {activeCursor}.
      </p>
    </div>
  );
}
