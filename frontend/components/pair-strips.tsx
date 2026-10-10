"use client";

import React, { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { median, quantile } from "d3-array";
import { SpreadItem } from "@/lib/api";
import { useCrosshair } from "@/lib/crosshair";
import { TRANSITION } from "@/lib/motion";
import { motion } from "motion/react";

interface PairStripsProps {
  spreadsByDate: Record<string, SpreadItem[]>;
  dates: string[];
  selectedDate: string;
  isLoading?: boolean;
}

const PAIR_DEFS = [
  { a: "GOLDM",      b: "GOLDTEN",    label: "GOLDM / GOLDTEN"     },
  { a: "GOLDM",      b: "GOLDGUINEA", label: "GOLDM / GOLDGUINEA"  },
  { a: "GOLDM",      b: "GOLDPETAL",  label: "GOLDM / GOLDPETAL"   },
  { a: "GOLDTEN",    b: "GOLDGUINEA", label: "GOLDTEN / GOLDGUINEA"},
  { a: "GOLDTEN",    b: "GOLDPETAL",  label: "GOLDTEN / GOLDPETAL" },
  { a: "GOLDGUINEA", b: "GOLDPETAL",  label: "GOLDGUINEA / GOLDPETAL"},
];

const W = 760, STRIP_H = 24, LABEL_W = 160;
const GAP = 10;
const MARGIN = { top: 24, right: 20, bottom: 24, left: LABEL_W + 16 };

export function PairStrips({
  spreadsByDate,
  dates,
  selectedDate,
  isLoading = false,
}: PairStripsProps) {
  const { crosshairDate } = useCrosshair();
  const activeCursor = crosshairDate ?? selectedDate;

  // Collect historical z-scores per pair
  const pairData = useMemo(() => {
    return PAIR_DEFS.map((pair) => {
      const zScores: number[] = [];
      for (const d of dates) {
        const dayData = spreadsByDate[d] || [];
        const item = dayData.find((s) => s.symbol_a === pair.a && s.symbol_b === pair.b);
        if (item?.robust_z != null) zScores.push(Number(item.robust_z));
      }
      // Current z (for cursor date)
      const cursorData = spreadsByDate[activeCursor] || [];
      const cursorItem = cursorData.find((s) => s.symbol_a === pair.a && s.symbol_b === pair.b);
      const currentZ = cursorItem?.robust_z != null ? Number(cursorItem.robust_z) : null;

      return {
        ...pair,
        zScores,
        med: zScores.length ? (median(zScores) ?? null) : null,
        q25: zScores.length >= 4 ? (quantile(zScores.slice().sort((a,b)=>a-b), 0.25) ?? null) : null,
        q75: zScores.length >= 4 ? (quantile(zScores.slice().sort((a,b)=>a-b), 0.75) ?? null) : null,
        lo:  zScores.length ? Math.min(...zScores) : null,
        hi:  zScores.length ? Math.max(...zScores) : null,
        currentZ,
      };
    });
  }, [spreadsByDate, dates, activeCursor]);

  // Shared x scale — domain [-5, +5] bps z-score
  const xDomain: [number, number] = [-5, 5];
  const xSc = scaleLinear()
    .domain(xDomain)
    .range([MARGIN.left, W - MARGIN.right])
    .clamp(true);

  const totalH = MARGIN.top + PAIR_DEFS.length * (STRIP_H + GAP) + MARGIN.bottom;

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
          Pair z-score distributions
        </h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
          Historical spread z-score range per pair. Box: 25–75 percentile. Tick: median.
          Marker: current date.
        </p>
      </div>

      <div className="w-full overflow-x-auto" role="img" aria-label="Pair z-score distribution strips">
        <svg
          viewBox={`0 0 ${W} ${totalH}`}
          className="w-full min-w-[440px]"
          style={{ display: "block" }}
        >
          {/* X axis ticks */}
          {[-4, -2, 0, 2, 4].map((t) => (
            <g key={t}>
              <line
                x1={xSc(t)} y1={MARGIN.top - 4}
                x2={xSc(t)} y2={totalH - MARGIN.bottom}
                stroke="var(--color-line)" strokeWidth="1"
              />
              <text
                x={xSc(t)} y={totalH - MARGIN.bottom + 12}
                textAnchor="middle" fontSize="9"
                fontFamily="var(--font-body)"
                fill="var(--color-muted)"
              >
                {t > 0 ? `+${t}` : t}z
              </text>
            </g>
          ))}

          {/* Zero line */}
          <line
            x1={xSc(0)} y1={MARGIN.top - 4}
            x2={xSc(0)} y2={totalH - MARGIN.bottom}
            stroke="var(--color-text)" strokeOpacity="0.25" strokeWidth="1"
          />

          {/* Loading skeleton */}
          {isLoading && (
            <g className="animate-pulse">
              {PAIR_DEFS.map((pair, idx) => {
                const y = MARGIN.top + idx * (STRIP_H + GAP);
                return (
                  <g key={`skel-strip-${pair.label}`}>
                    <text
                      x={MARGIN.left - 10} y={y + STRIP_H / 2 + 4}
                      textAnchor="end" fontSize="10"
                      fontFamily="var(--font-body)"
                      fill="var(--color-muted)"
                    >
                      {pair.label}
                    </text>
                    <rect
                      x={xSc(-2.5)} y={y + 5}
                      width={xSc(2.5) - xSc(-2.5)}
                      height={STRIP_H - 10}
                      rx="2"
                      fill="var(--color-page)"
                      fillOpacity="0.6"
                      stroke="var(--color-line)"
                      strokeWidth="0.5"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Loaded strips */}
          {!isLoading && pairData.map((pair, idx) => {
            const y = MARGIN.top + idx * (STRIP_H + GAP);
            const midY = y + STRIP_H / 2;
            const hasData = pair.zScores.length > 0;

            return (
              <g key={pair.label}>
                {/* Label */}
                <text
                  x={MARGIN.left - 10} y={midY + 4}
                  textAnchor="end" fontSize="10"
                  fontFamily="var(--font-body)"
                  fill="var(--color-text)"
                  fontWeight="500"
                >
                  {pair.label}
                </text>

                {!hasData ? (
                  <text
                    x={MARGIN.left + 20} y={midY + 4}
                    fontSize="9" fontFamily="var(--font-body)"
                    fill="var(--color-muted)" fontStyle="italic"
                  >
                    No distribution data recorded
                  </text>
                ) : (
                  <>
                    {/* Full range whisker */}
                    {pair.lo !== null && pair.hi !== null && (
                      <line
                        x1={xSc(pair.lo)} y1={midY}
                        x2={xSc(pair.hi)} y2={midY}
                        stroke="var(--color-muted)" strokeWidth="1.5"
                      />
                    )}

                    {/* IQR box */}
                    {pair.q25 !== null && pair.q75 !== null && (
                      <motion.rect
                        key={pair.label}
                        initial={{ width: 0, x: xSc(0) }}
                        animate={{
                          x: xSc(pair.q25),
                          width: xSc(pair.q75) - xSc(pair.q25),
                        }}
                        transition={TRANSITION.base}
                        y={y + 4}
                        height={STRIP_H - 8}
                        rx="2"
                        fill="var(--color-verdigris)"
                        fillOpacity="0.20"
                        stroke="var(--color-verdigris)"
                        strokeWidth="1"
                        strokeOpacity="0.50"
                      />
                    )}

                    {/* Median tick */}
                    {pair.med !== null && (
                      <line
                        x1={xSc(pair.med)} y1={y + 3}
                        x2={xSc(pair.med)} y2={y + STRIP_H - 3}
                        stroke="var(--color-verdigris)" strokeWidth="2"
                      />
                    )}

                    {/* Extreme whisker ends */}
                    {pair.lo !== null && (
                      <line
                        x1={xSc(pair.lo)} y1={y + 6}
                        x2={xSc(pair.lo)} y2={y + STRIP_H - 6}
                        stroke="var(--color-muted)" strokeWidth="1.5"
                      />
                    )}
                    {pair.hi !== null && (
                      <line
                        x1={xSc(pair.hi)} y1={y + 6}
                        x2={xSc(pair.hi)} y2={y + STRIP_H - 6}
                        stroke="var(--color-muted)" strokeWidth="1.5"
                      />
                    )}

                    {/* Current z marker (diamond) */}
                    {pair.currentZ !== null ? (() => {
                      const cx = xSc(pair.currentZ);
                      const s = 5;
                      return (
                        <motion.path
                          d={`M${cx},${midY - s} L${cx + s},${midY} L${cx},${midY + s} L${cx - s},${midY} Z`}
                          fill="var(--color-gold-m)"
                          stroke="var(--color-surface)"
                          strokeWidth="1"
                          animate={{ d: `M${cx},${midY - s} L${cx + s},${midY} L${cx},${midY + s} L${cx - s},${midY} Z` }}
                          transition={TRANSITION.base}
                        />
                      );
                    })() : (
                      /* No data marker for this date */
                      <circle
                        cx={xSc(0)} cy={midY} r="3"
                        fill="none" stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="1.5 1.5"
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="sr-only">
        Pair z-score distribution strips. Each row shows the historical range, IQR box,
        median and current position for one contract pair.
        Current date: {activeCursor}.
      </p>
    </div>
  );
}
