"use client";

import React, { useMemo } from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { ContractDayItem } from "@/lib/api";

interface TermStructureProps {
  currentContracts: ContractDayItem[];
  previousContracts: ContractDayItem[];
  selectedDate: string;
}

const SYMBOLS = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"];

export function TermStructure({
  currentContracts,
  previousContracts,
  selectedDate,
}: TermStructureProps) {
  // Compute common shared Y scale domain across all contracts on both days
  const { minY, maxY } = useMemo(() => {
    const all = [...currentContracts, ...previousContracts];
    const prices = all
      .map((c) => (c.fine_gold_price_per_gram ? Number(c.fine_gold_price_per_gram) : null))
      .filter((p): p is number => p !== null && p > 0);

    if (prices.length === 0) return { minY: 7400, maxY: 7600 };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.15 || 20;
    return { minY: Math.floor(min - padding), maxY: Math.ceil(max + padding) };
  }, [currentContracts, previousContracts]);

  return (
    <div
      className="rounded-xl p-5 sm:p-6 space-y-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
    >
      <div
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div>
          <h3
            className="font-display text-base sm:text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Term Structure Curves
          </h3>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Fine gold price per gram by contract expiry. Ghost line shows previous trading day.
          </p>
        </div>
        <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Shared Y-scale (INR/g) for honest comparison
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SYMBOLS.map((sym) => {
          const curSymContracts = currentContracts
            .filter((c) => c.symbol === sym)
            .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
          const prevSymContracts = previousContracts
            .filter((c) => c.symbol === sym)
            .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

          const width = 200;
          const height = 130;
          const margin = { top: 15, right: 20, bottom: 25, left: 35 };

          const yScale = scaleLinear()
            .domain([minY, maxY])
            .range([height - margin.bottom, margin.top]);

          const xScale = scalePoint()
            .domain(
              Array.from(
                new Set([
                  ...curSymContracts.map((c) => c.expiry_date),
                  ...prevSymContracts.map((c) => c.expiry_date),
                ])
              ).sort()
            )
            .range([margin.left, width - margin.right])
            .padding(0.4);

          const lineGen = line<ContractDayItem>()
            .defined((d: ContractDayItem) => d.fine_gold_price_per_gram != null && Number(d.fine_gold_price_per_gram) > 0)
            .x((d: ContractDayItem) => xScale(d.expiry_date) || 0)
            .y((d: ContractDayItem) => yScale(Number(d.fine_gold_price_per_gram) || 0));

          return (
            <div
              key={sym}
              className="p-3 rounded-xs space-y-2"
              style={{ background: "var(--color-page)", border: "1px solid var(--color-line)" }}
            >
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold" style={{ color: "var(--color-text)" }}>{sym}</span>
                <span className="text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
                  {curSymContracts.length} expiries
                </span>
              </div>

              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none font-body">
                {/* Y Axis Gridlines */}
                {[minY, Math.round((minY + maxY) / 2), maxY].map((val) => {
                  const y = yScale(val);
                  return (
                    <g key={val}>
                      <line
                        x1={margin.left}
                        y1={y}
                        x2={width - margin.right}
                        y2={y}
                        stroke="var(--color-line)"
                        strokeWidth="1"
                      />
                      <text
                        x={margin.left - 4}
                        y={y + 3}
                        fill="var(--color-muted)"
                        fontSize="8"
                        textAnchor="end"
                        className="tabular-nums"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Ghost line for previous day */}
                {prevSymContracts.length > 0 && (
                  <path
                    d={lineGen(prevSymContracts) || ""}
                    fill="none"
                    stroke="var(--color-text)"
                    strokeOpacity="0.25"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Current day line */}
                {curSymContracts.length > 0 && (
                  <path
                    d={lineGen(curSymContracts) || ""}
                    fill="none"
                    stroke="var(--color-text)"
                    strokeWidth="1.75"
                  />
                )}

                {/* Points */}
                {curSymContracts.map((c) => {
                  const x = xScale(c.expiry_date) || 0;
                  const y = yScale(Number(c.fine_gold_price_per_gram) || 0);
                  const isHigh = c.label === "High";
                  const isMedium = c.label === "Medium";
                  const r = isHigh ? 3.5 : isMedium ? 3 : 2.5;

                  return (
                    <g key={c.expiry_date}>
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill="var(--color-verdigris)"
                        stroke="var(--color-surface)"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={height - margin.bottom + 12}
                        fill="var(--color-muted)"
                        fontSize="8"
                        textAnchor="middle"
                        className="tabular-nums"
                      >
                        {c.expiry_date.slice(5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
