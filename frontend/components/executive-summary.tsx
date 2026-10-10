"use client";

import React, { useEffect, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line, curveMonotoneX, area } from "d3-shape";
import { ParityResponse, SpreadItem } from "@/lib/api";
import { TRANSITION, DURATION } from "@/lib/motion";
import { motion } from "motion/react";

interface ExecutiveSummaryProps {
  history: ParityResponse[];
  currentParity: ParityResponse | null;
  spreads: SpreadItem[];
  selectedDate: string;
  verifyOk: boolean;
}

/**
 * Compute count-up from `from` to `to` over `durationMs` using rAF.
 * Returns current value and a ref to track whether animation has run.
 */
function useCountUp(target: number | null, durationMs: number) {
  const [display, setDisplay] = useState<number | null>(target);
  const prevTarget = useRef<number | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target === null) { setDisplay(null); return; }
    if (prevTarget.current === target) return;

    // Only count up on first view (not on every scrubber change)
    const isFirst = !hasAnimated.current;
    hasAnimated.current = true;
    prevTarget.current = target;

    if (!isFirst) { setDisplay(target); return; }

    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease out
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, durationMs]);

  return display;
}

export function ExecutiveSummary({
  history,
  currentParity,
  spreads,
  selectedDate,
  verifyOk,
}: ExecutiveSummaryProps) {
  const score = currentParity?.score ?? null;
  const displayScore = useCountUp(score, DURATION.slow);

  // 14-day sparkline slice
  const selectedIdx = history.findIndex((h) => h.trade_date === selectedDate);
  const slice = history.slice(Math.max(0, selectedIdx - 13), selectedIdx + 1);

  // Delta vs previous scored day
  const prevScored = history
    .slice(0, Math.max(0, selectedIdx))
    .filter((h) => h.score !== null)
    .slice(-1)[0];
  const delta = score !== null && prevScored?.score !== null && prevScored?.score !== undefined
    ? score - (prevScored.score as number)
    : null;

  // Verdict sentence
  const verdict = currentParity
    ? currentParity.explanation
    : "No data for this date.";

  // Fact metrics
  const pairsUsed    = currentParity?.details?.pairs_used ?? currentParity?.pairs_used ?? 0;
  const pairsExcl    = currentParity?.details?.pairs_excluded ?? 0;
  const liquidityLow = spreads.filter(
    (s) => s.weaker_liquidity_label === "Low" || s.weaker_liquidity_label === "Untradeable"
  ).length;
  const checksOk = verifyOk;

  // "What changed since yesterday" — top 3 differences
  const changes: string[] = [];
  if (delta !== null && Math.abs(delta) >= 1) {
    changes.push(`Score ${delta > 0 ? "+" : ""}${delta.toFixed(0)} vs previous scored day`);
  }
  const dislocationPairs = spreads.filter(
    (s) => s.robust_z !== null && Math.abs(Number(s.robust_z)) >= 2.0
      && (s.weaker_liquidity_label === "High" || s.weaker_liquidity_label === "Medium")
  );
  if (dislocationPairs.length > 0) {
    changes.push(
      `${dislocationPairs.length} pair${dislocationPairs.length > 1 ? "s" : ""} above z ≥ 2.0 threshold`
    );
  }
  if (pairsExcl > 0) {
    changes.push(`${pairsExcl} pair${pairsExcl > 1 ? "s" : ""} excluded by liquidity`);
  }
  // Trim to 3
  const topChanges = changes.slice(0, 3);

  // Sparkline SVG
  const W = 180, H = 36;
  const m = { t: 4, b: 4, l: 0, r: 0 };
  const xSc = scaleLinear().domain([0, Math.max(1, slice.length - 1)]).range([m.l, W - m.r]);
  const ySc = scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
  const lineGen = line<ParityResponse>()
    .defined((d) => d.score !== null)
    .x((_, i) => xSc(i))
    .y((d) => ySc(d.score ?? 0))
    .curve(curveMonotoneX);
  const areaGen = area<ParityResponse>()
    .defined((d) => d.score !== null)
    .x((_, i) => xSc(i))
    .y0(H - m.b)
    .y1((d) => ySc(d.score ?? 0))
    .curve(curveMonotoneX);
  const linePath = lineGen(slice) ?? "";
  const areaPath = areaGen(slice) ?? "";

  // Score colour
  const scoreColor =
    score === null ? "var(--color-muted)"
    : score >= 75 ? "var(--color-verdigris)"
    : score >= 50 ? "var(--color-gold-m)"
    : "var(--color-madder)";

  return (
    <motion.div
      className="rounded-xl p-5 sm:p-6 space-y-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION.base}
    >
      {/* Top row: score stamp + sparkline + verdict */}
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        {/* Score + delta */}
        <div className="flex items-end gap-4 shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              Parity score
            </span>
            <span
              className="font-display tabular-nums leading-none"
              style={{
                fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
                fontWeight: 700,
                color: scoreColor,
                transition: `color var(--dur-base) var(--ease-out)`,
              }}
            >
              {displayScore !== null ? displayScore : "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>/ 100</span>
          </div>

          {delta !== null && (
            <div
              className="mb-2 text-sm font-medium tabular-nums"
              style={{ color: delta >= 0 ? "var(--color-verdigris)" : "var(--color-madder)" }}
            >
              {delta > 0 ? "+" : ""}{delta.toFixed(0)} today
            </div>
          )}
        </div>

        {/* 14-day sparkline */}
        <div className="shrink-0 self-end mb-1" aria-hidden="true">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            style={{ display: "block", overflow: "visible" }}
          >
            <path d={areaPath} fill="var(--color-verdigris)" fillOpacity="0.12" />
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-verdigris)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Current point */}
            {slice.length > 0 && slice[slice.length - 1].score !== null && (
              <circle
                cx={xSc(slice.length - 1)}
                cy={ySc(slice[slice.length - 1].score ?? 0)}
                r="3"
                fill="var(--color-verdigris)"
                stroke="var(--color-surface)"
                strokeWidth="1.5"
              />
            )}
          </svg>
          <div className="text-[9px] text-center mt-0.5" style={{ color: "var(--color-muted)" }}>14-day</div>
        </div>

        {/* Verdict */}
        <p
          className="text-sm leading-relaxed flex-1"
          style={{ color: "var(--color-text)" }}
        >
          {verdict}
        </p>
      </div>

      {/* Fact row — 4 metrics with hairline dividers */}
      <div
        className="flex flex-wrap gap-y-2 text-sm py-3"
        style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}
      >
        {[
          { label: "Pairs scored",     value: String(pairsUsed) },
          { label: "Pairs excluded",   value: String(pairsExcl) },
          { label: "Low / untradeable",value: String(liquidityLow) },
          { label: "Chain integrity",  value: checksOk ? "Verified" : "Broken" },
        ].map((fact, idx) => (
          <React.Fragment key={fact.label}>
            {idx > 0 && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "1px",
                  alignSelf: "stretch",
                  background: "var(--color-line)",
                  margin: "0 1.25rem",
                }}
              />
            )}
            <div className="flex flex-col">
              <span
                className="tabular-nums font-semibold font-display text-xl leading-tight"
                style={{
                  color: fact.label === "Chain integrity" && !checksOk
                    ? "var(--color-madder)"
                    : "var(--color-text)",
                }}
              >
                {fact.value}
              </span>
              <span className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>
                {fact.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* What changed */}
      {topChanges.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
            What changed
          </p>
          <ul className="space-y-0.5">
            {topChanges.map((c) => (
              <li
                key={c}
                className="text-xs"
                style={{ color: "var(--color-text)" }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
