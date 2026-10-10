"use client";

import React, { useRef } from "react";
import { scaleLinear } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { ParityResponse } from "@/lib/api";

interface TimeScrubberProps {
  history: ParityResponse[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function TimeScrubber({ history, selectedDate, onSelectDate }: TimeScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const validHistory = history.filter((h) => h.trade_date);
  const dates = validHistory.map((h) => h.trade_date);
  const currentIndex = dates.indexOf(selectedDate);
  const activeIndex = currentIndex >= 0 ? currentIndex : dates.length - 1;

  // Keyboard navigation (no idle looping play)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && activeIndex > 0) {
      e.preventDefault();
      onSelectDate(dates[activeIndex - 1]);
    } else if (e.key === "ArrowRight" && activeIndex < dates.length - 1) {
      e.preventDefault();
      onSelectDate(dates[activeIndex + 1]);
    }
  };

  if (validHistory.length === 0) return null;

  const width = 800;
  const height = 52;
  const margin = { top: 6, right: 12, bottom: 18, left: 12 };

  const xScale = scaleLinear()
    .domain([0, validHistory.length - 1])
    .range([margin.left, width - margin.right]);

  const yScale = scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  // gaps stay as gaps — defined() drops null scores
  const areaGen = area<ParityResponse>()
    .defined((d) => d.score !== null)
    .x((_, i) => xScale(i))
    .y0(height - margin.bottom)
    .y1((d) => yScale(d.score ?? 0))
    .curve(curveMonotoneX);

  const lineGen = line<ParityResponse>()
    .defined((d) => d.score !== null)
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.score ?? 0))
    .curve(curveMonotoneX);

  const areaPath = areaGen(validHistory) ?? "";
  const linePath = lineGen(validHistory) ?? "";

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * width;
    const rawIdx = Math.round(xScale.invert(clickX));
    const clamped = Math.max(0, Math.min(validHistory.length - 1, rawIdx));
    onSelectDate(dates[clamped]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1) return; // only while pressed
    handlePointerDown(e);
  };

  const currentItem = validHistory[activeIndex];
  const markerX = xScale(activeIndex);
  const markerY = currentItem?.score !== null && currentItem?.score !== undefined
    ? yScale(currentItem.score)
    : height / 2;

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl p-3 space-y-2 select-none"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Trading date timeline. Use arrow keys to step. Currently at ${selectedDate}.`}
    >
      <div className="flex items-center justify-between text-xs px-1" style={{ color: "var(--color-muted)" }}>
        <div className="flex items-center space-x-3">
          <span className="font-medium tabular-nums" style={{ color: "var(--color-text)" }}>{selectedDate}</span>
          <span>
            {currentItem?.score !== null && currentItem?.score !== undefined
              ? `Parity ${currentItem.score}`
              : "No score"}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[11px]">
          <span>Arrow keys to step</span>
          <span className="tabular-nums">
            {activeIndex + 1} / {validHistory.length}
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-12 touch-none"
          style={{ cursor: "ew-resize", display: "block" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Baseline */}
          <line
            x1={margin.left} y1={height - margin.bottom}
            x2={width - margin.right} y2={height - margin.bottom}
            stroke="var(--color-line)" strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaPath} fill="var(--color-text)" fillOpacity="0.06" />

          {/* Sparkline — gaps preserved */}
          <path
            d={linePath} fill="none"
            stroke="var(--color-text)" strokeOpacity="0.60"
            strokeWidth="1.5" strokeLinejoin="round"
          />

          {/* Selected date cursor */}
          <line
            x1={markerX} y1={margin.top}
            x2={markerX} y2={height - margin.bottom}
            stroke="var(--color-verdigris)" strokeWidth="2"
          />

          {/* Marker dot */}
          <circle
            cx={markerX} cy={markerY} r="4"
            fill="var(--color-verdigris)"
            stroke="var(--color-surface)" strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}
