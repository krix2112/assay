"use client";

import React, { useId, useState } from "react";
import { scaleSequential } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import { SpreadItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";

interface SpreadHeatmapProps {
  spreadsByDate: Record<string, SpreadItem[]>;
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
}

const PAIRS = [
  { label: "GOLDM / GOLDTEN",     a: "GOLDM",      b: "GOLDTEN"    },
  { label: "GOLDM / GOLDGUINEA",  a: "GOLDM",      b: "GOLDGUINEA" },
  { label: "GOLDM / GOLDPETAL",   a: "GOLDM",      b: "GOLDPETAL"  },
  { label: "GOLDTEN / GOLDGUINEA",a: "GOLDTEN",     b: "GOLDGUINEA" },
  { label: "GOLDTEN / GOLDPETAL", a: "GOLDTEN",     b: "GOLDPETAL"  },
  { label: "GOLDGUINEA / GOLDPETAL", a: "GOLDGUINEA", b: "GOLDPETAL" },
];

const ROW_H = 28;
const LABEL_W = 176;

export function SpreadHeatmap({
  spreadsByDate,
  dates,
  selectedDate,
  onSelectDate,
  isLoading = false,
}: SpreadHeatmapProps) {
  const uid = useId();
  const rawId = uid.replace(/:/g, "");
  const hatchId = `hatch-${rawId}`;
  const noDataId = `nodata-${rawId}`;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [hoveredCell, setHoveredCell] = useState<{
    pair: string;
    date: string;
    item: SpreadItem | null;
  } | null>(null);

  // Last 30 trading days
  const activeDates = dates.slice(-30);

  // Colour scale from tokens
  const loColor  = isDark ? "#72B7A5" : "#3F7D6E";
  const midColor = isDark ? "#2A3234" : "#E4E6E0";
  const hiColor  = isDark ? "#DE8570" : "#B4503C";

  const colorLo  = scaleSequential(interpolateRgb(midColor, loColor)).domain([0, -4]);
  const colorHi  = scaleSequential(interpolateRgb(midColor, hiColor)).domain([0, 4]);

  const getColor = (z: number | null) => {
    if (z === null) return "transparent";
    const clamped = Math.max(-4, Math.min(4, z));
    return clamped <= 0 ? colorLo(clamped) : colorHi(clamped);
  };

  const getSpread = (a: string, b: string, dateStr: string): SpreadItem | null => {
    const list = spreadsByDate[dateStr] || [];
    return list.find((s) => s.symbol_a === a && s.symbol_b === b) || null;
  };

  // Hatch line colour — WCAG AA compliant (>= 3.0:1 in both modes)
  const hatchStroke = isDark ? "rgba(228,232,227,0.50)" : "rgba(42,52,49,0.35)";
  const dotColor = isDark ? "rgba(228,232,227,0.40)" : "rgba(42,52,49,0.35)";

  const totalWidth = LABEL_W + Math.max(1, activeDates.length) * 26;
  const totalHeight = (PAIRS.length + 1) * (ROW_H + 2) + 4;

  return (
    <div
      className="rounded-xl p-5 sm:p-6 space-y-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
    >
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div>
          <h3
            className="font-display text-base sm:text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Spread deviation heatmap
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            Robust z-scores across contract pairs (last 30 trading days).
          </p>
        </div>

        {/* Legend chips */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-xs inline-block" style={{ background: loColor }} />
            <span>−4z tight</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-xs inline-block" style={{ background: midColor, border: "1px solid var(--color-line)" }} />
            <span>0z par</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-xs inline-block" style={{ background: hiColor }} />
            <span>+4z wide</span>
          </span>
          {/* No baseline */}
          <span className="flex items-center space-x-1">
            <svg width="12" height="12" aria-hidden="true" className="rounded-xs overflow-hidden">
              <defs>
                <pattern id={`${hatchId}-legend`} width="4" height="4"
                  patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="4" stroke={hatchStroke} strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect width="12" height="12" fill={`url(#${hatchId}-legend)`}
                stroke="var(--color-line)" strokeWidth="0.75" />
            </svg>
            <span>No baseline</span>
          </span>
          {/* No data */}
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
      </div>

      {/* Grid container */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <svg
            width="100%"
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
            style={{ display: "block", overflow: "visible" }}
            role="img"
            aria-label="Spread z-score heatmap grid"
          >
            <defs>
              {/* Hatched pattern: no baseline */}
              <pattern
                id={hatchId}
                width="4" height="4"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="4" stroke={hatchStroke} strokeWidth="1.5" />
              </pattern>

              {/* Dotted pattern: no data for this pair and date */}
              <pattern
                id={noDataId}
                width="4" height="4"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="0.8" fill={dotColor} />
              </pattern>
            </defs>

            {/* Column date headers */}
            {activeDates.map((d, i) => {
              const x = LABEL_W + i * 26 + 13;
              const isSelected = d === selectedDate;
              const showLabel = i % 5 === 0 || isSelected || i === activeDates.length - 1;
              return (
                <text
                  key={d}
                  x={x}
                  y={ROW_H - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="var(--font-body), sans-serif"
                  fill={isSelected ? "var(--color-text)" : "var(--color-muted)"}
                  fontWeight={isSelected ? "600" : "400"}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectDate(d)}
                >
                  {showLabel ? d.slice(5) : ""}
                </text>
              );
            })}

            {/* Loading skeleton state */}
            {isLoading && (
              <g className="animate-pulse">
                {PAIRS.map((pair, pIdx) => {
                  const rowY = ROW_H + 2 + pIdx * (ROW_H + 2);
                  return (
                    <g key={`skel-${pair.label}`}>
                      <text
                        x={LABEL_W - 6}
                        y={rowY + ROW_H / 2 + 4}
                        textAnchor="end"
                        fontSize="10"
                        fontFamily="var(--font-body), sans-serif"
                        fill="var(--color-muted)"
                      >
                        {pair.label}
                      </text>
                      {activeDates.map((d, cIdx) => (
                        <rect
                          key={`skel-cell-${d}-${pair.label}`}
                          x={LABEL_W + cIdx * 26}
                          y={rowY}
                          width={24}
                          height={ROW_H}
                          rx="2"
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

            {/* Loaded Pair rows */}
            {!isLoading && PAIRS.map((pair, pIdx) => {
              const rowY = ROW_H + 2 + pIdx * (ROW_H + 2);
              return (
                <g key={pair.label}>
                  {/* Row label */}
                  <text
                    x={LABEL_W - 6}
                    y={rowY + ROW_H / 2 + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="var(--font-body), sans-serif"
                    fill="var(--color-text)"
                    fontWeight="500"
                  >
                    {pair.label}
                  </text>

                  {/* Day cells */}
                  {activeDates.map((d, cIdx) => {
                    const item = getSpread(pair.a, pair.b, d);
                    const isSelected = d === selectedDate;
                    const zVal = item?.robust_z != null ? Number(item.robust_z) : null;
                    const isExcluded = item?.weaker_liquidity_label === "Untradeable"
                      || item?.weaker_liquidity_label === "Unknown";
                    const noBaseline = zVal === null && item !== null && !isExcluded;
                    const hasNoData = item === null;
                    const cellX = LABEL_W + cIdx * 26;
                    const cellW = 24;
                    const cellH = ROW_H;

                    // Fill & stroke determination
                    let cellFill = "transparent";
                    let cellStroke = isSelected ? "var(--color-text)" : "var(--color-line)";
                    let cellStrokeWidth = isSelected ? 1.5 : 0.5;
                    let strokeDash: string | undefined = undefined;

                    if (hasNoData) {
                      cellFill = `url(#${noDataId})`;
                      cellStroke = "var(--color-line)";
                      cellStrokeWidth = 0.75;
                      strokeDash = "2 2";
                    } else if (isExcluded || noBaseline) {
                      cellFill = `url(#${hatchId})`;
                    } else if (zVal !== null) {
                      cellFill = getColor(zVal);
                    }

                    return (
                      <g
                        key={d}
                        style={{ cursor: "pointer" }}
                        onClick={() => onSelectDate(d)}
                        onMouseEnter={() => setHoveredCell({ pair: pair.label, date: d, item })}
                        onMouseLeave={() => setHoveredCell(null)}
                        role="button"
                        aria-label={`${pair.label} on ${d}: ${hasNoData ? "no data" : zVal !== null ? `z=${zVal}` : noBaseline ? "building baseline" : "excluded"}`}
                      >
                        <rect
                          x={cellX} y={rowY}
                          width={cellW} height={cellH}
                          rx="2"
                          fill={cellFill}
                          stroke={cellStroke}
                          strokeWidth={cellStrokeWidth}
                          strokeDasharray={strokeDash}
                        />
                        {/* Semi-transparent hatched overlay if excluded */}
                        {isExcluded && !hasNoData && (
                          <rect
                            x={cellX} y={rowY} width={cellW} height={cellH} rx="2"
                            fill={`url(#${hatchId})`}
                            opacity="0.5"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="p-3 rounded-xs text-xs flex flex-wrap gap-4 items-center justify-between"
          style={{
            background: "var(--color-touchstone)",
            color: "var(--color-surface)",
          }}
        >
          <div>
            <span className="font-semibold">{hoveredCell.pair}</span>
            {" "}on{" "}
            <span className="tabular-nums font-medium">{hoveredCell.date}</span>
          </div>
          {hoveredCell.item ? (
            <div className="flex gap-4 tabular-nums">
              <span>
                Spread: <strong>{hoveredCell.item.spread_bps} bps</strong>
              </span>
              <span>
                Robust z:{" "}
                <strong>
                  {hoveredCell.item.robust_z != null
                    ? `${Number(hoveredCell.item.robust_z) > 0 ? "+" : ""}${hoveredCell.item.robust_z}`
                    : "N/A (building baseline)"}
                </strong>
              </span>
              <span>
                Liquidity: <strong>{hoveredCell.item.weaker_liquidity_label}</strong>
              </span>
            </div>
          ) : (
            <div className="text-[11px] opacity-80">
              No spread data recorded for this contract pair on this date.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
