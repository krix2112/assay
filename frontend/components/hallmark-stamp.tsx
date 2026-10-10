"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ParityResponse } from "@/lib/api";

interface HallmarkStampProps {
  parity: ParityResponse | null;
}

export function HallmarkStamp({ parity }: HallmarkStampProps) {
  const score = parity?.score ?? null;
  const isNoScore = score === null;
  const [displayScore, setDisplayScore] = useState<number | null>(score);

  // Smooth rolling counter effect
  useEffect(() => {
    if (score === null) {
      setDisplayScore(null);
      return;
    }
    const target = score;
    const start = displayScore ?? target;
    if (start === target) return;

    const duration = 400;
    const startTime = performance.now();

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.round(start + (target - start) * progress);
      setDisplayScore(current);
      if (progress < 1) requestAnimationFrame(frame);
    };

    const req = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(req);
  }, [score, displayScore]);

  return (
    <div
      className="flex flex-col items-center justify-center p-6 rounded-xl space-y-4 text-center select-none h-full"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
    >
      <div className="space-y-1">
        <h3 className="text-xs font-semibold tracking-wide" style={{ color: "var(--color-muted)" }}>
          Gold parity score
        </h3>
        <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>Cross-contract basis agreement index</p>
      </div>

      {/* Octagonal Hallmark Stamp */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20 }}
        className="relative flex items-center justify-center w-36 h-36"
      >
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-none">
          {/* Octagonal path */}
          <polygon
            points="35,5 85,5 115,35 115,85 85,115 35,115 5,85 5,35"
            fill={isNoScore ? "none" : "var(--color-surface)"}
            stroke="var(--color-text)"
            strokeWidth={isNoScore ? "1.5" : "2.5"}
            strokeDasharray={isNoScore ? "4 3" : undefined}
          />
          {/* Inner ring */}
          <polygon
            points="37,10 83,10 110,37 110,83 83,110 37,110 10,83 10,37"
            fill="none"
            stroke="var(--color-text)"
            strokeWidth="0.75"
            strokeOpacity="0.4"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          {!isNoScore ? (
            <>
              <span className="font-display font-bold text-4xl sm:text-5xl tracking-tight tabular-nums" style={{ color: "var(--color-text)" }}>
                {displayScore !== null ? displayScore : score}
              </span>
              <span className="text-[11px] font-medium tracking-wide mt-0.5" style={{ color: "var(--color-muted)" }}>
                of 100
              </span>
            </>
          ) : (
            <div className="space-y-0.5">
              <span className="font-display font-semibold text-sm block" style={{ color: "var(--color-madder)" }}>
                No score
              </span>
              <span className="text-[9px] block leading-tight" style={{ color: "var(--color-muted)" }}>
                {parity?.explanation || "Insufficient data"}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Draft Validation Pill */}
      {parity?.is_draft && (
        <div
          className="inline-flex items-center px-2.5 py-1 rounded-xs text-[11px] font-medium"
          style={{ background: "var(--color-page)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
        >
          Draft — not validated
        </div>
      )}
    </div>
  );
}
