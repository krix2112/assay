"use client";

import React, { useState } from "react";
import { scaleLinear } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { ParityResponse } from "@/lib/api";

interface ParityHistoryChartProps {
  history: ParityResponse[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function ParityHistoryChart({
  history,
  selectedDate,
  onSelectDate,
}: ParityHistoryChartProps) {
  const [hoveredItem, setHoveredItem] = useState<{
    item: ParityResponse;
    x: number;
    y: number;
  } | null>(null);

  if (history.length === 0) return null;

  const width = 860;
  const height = 220;
  const margin = { top: 20, right: 30, bottom: 35, left: 45 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xScale = scaleLinear()
    .domain([0, history.length - 1])
    .range([margin.left, width - margin.right]);

  const yScale = scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  // Segment generation to ensure gaps where score is null (no interpolation)
  const segments: ParityResponse[][] = [];
  let currentSegment: ParityResponse[] = [];

  history.forEach((d) => {
    if (d.score !== null) {
      currentSegment.push(d);
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
  });
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const lineGen = line<ParityResponse>()
    .x((d: ParityResponse) => xScale(history.indexOf(d)))
    .y((d: ParityResponse) => yScale(d.score || 0))
    .curve(curveMonotoneX);

  const areaGen = area<ParityResponse>()
    .x((d: ParityResponse) => xScale(history.indexOf(d)))
    .y0(height - margin.bottom)
    .y1((d: ParityResponse) => yScale(d.score || 0))
    .curve(curveMonotoneX);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * width;
    const rawIdx = Math.round(xScale.invert(clickX));
    const clampedIdx = Math.max(0, Math.min(history.length - 1, rawIdx));
    const item = history[clampedIdx];
    if (item) {
      setHoveredItem({
        item,
        x: xScale(clampedIdx),
        y: item.score !== null ? yScale(item.score) : height / 2,
      });
    }
  };

  const activeIdx = history.findIndex((h) => h.trade_date === selectedDate);
  const activeX = activeIdx >= 0 ? xScale(activeIdx) : null;

  return (
    <div className="bg-chalk rounded-xl p-5 sm:p-6 border border-basalt/10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-basalt/10 pb-3">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-basalt">
            Parity Score History
          </h3>
          <p className="text-xs text-basalt/60">
            Daily consistency index [0–100]. Gaps indicate missing data or uncomputed days.
          </p>
        </div>
        <span className="text-[11px] text-basalt/50 tabular-nums">
          45-day rolling window
        </span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair touch-none select-none font-body"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredItem(null)}
          onClick={() => {
            if (hoveredItem) onSelectDate(hoveredItem.item.trade_date);
          }}
        >
          {/* Y Axis Gridlines and Labels */}
          {[0, 25, 50, 75, 100].map((val) => {
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
                  x={margin.left - 8}
                  y={y + 3}
                  fill="var(--color-muted)"
                  fontSize="10"
                  textAnchor="end"
                  className="tabular-nums"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area and Line Segments (with gaps) */}
          {segments.map((seg, idx) => (
            <g key={idx}>
              <path d={areaGen(seg) || ""} fill="var(--color-verdigris)" fillOpacity="0.12" />
              <path
                d={lineGen(seg) || ""}
                fill="none"
                stroke="var(--color-verdigris)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* X Axis Dates */}
          {history.map((d, i) => {
            if (i % 8 !== 0 && i !== history.length - 1) return null;
            const x = xScale(i);
            return (
              <g key={d.trade_date}>
                <line
                  x1={x}
                  y1={height - margin.bottom}
                  x2={x}
                  y2={height - margin.bottom + 4}
                  stroke="var(--color-line)"
                />
                <text
                  x={x}
                  y={height - margin.bottom + 16}
                  fill="var(--color-muted)"
                  fontSize="10"
                  textAnchor="middle"
                  className="tabular-nums"
                >
                  {d.trade_date.slice(5)}
                </text>
              </g>
            );
          })}

          {/* Scrubbed Date Indicator */}
          {activeX !== null && (
            <line
              x1={activeX}
              y1={margin.top}
              x2={activeX}
              y2={height - margin.bottom}
              stroke="var(--color-text)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeOpacity="0.6"
            />
          )}

          {/* Hover Pointer */}
          {hoveredItem && (
            <g transform={`translate(${hoveredItem.x}, ${hoveredItem.y})`}>
              <circle r="5" fill="var(--color-verdigris)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredItem && (
          <div
            className="absolute pointer-events-none bg-basalt text-chalk text-xs p-2.5 rounded-xs shadow-none border border-basalt/20 z-20 space-y-1"
            style={{
              left: Math.min(plotWidth, Math.max(margin.left, hoveredItem.x - 60)),
              top: Math.max(margin.top, hoveredItem.y - 65),
            }}
          >
            <div className="font-semibold tabular-nums">{hoveredItem.item.trade_date}</div>
            <div className="text-chalk/80">
              Score:{" "}
              <span className="font-bold text-chalk tabular-nums">
                {hoveredItem.item.score !== null ? hoveredItem.item.score : "No score"}
              </span>
            </div>
            <div className="text-[10px] text-chalk/60 leading-tight">
              {hoveredItem.item.status} · {hoveredItem.item.pairs_used} pairs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
