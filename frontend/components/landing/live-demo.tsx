"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { TimeScrubber } from "@/components/time-scrubber";
import { Touchstone } from "@/components/touchstone";
import { HallmarkStamp } from "@/components/hallmark-stamp";
import parityHistorySample from "@/lib/sample/parity_history.json";
import contractsByDateSample from "@/lib/sample/contracts_by_date.json";
import type { ParityResponse, ContractDayItem } from "@/lib/api";

export function LiveDemo() {
  const history = parityHistorySample as unknown as ParityResponse[];
  const contractsMap = contractsByDateSample as unknown as Record<string, ContractDayItem[]>;

  // Initialize to latest sample date
  const [selectedDate, setSelectedDate] = useState<string>(
    history[history.length - 1]?.trade_date || "2026-03-05"
  );

  const activeParity = useMemo(() => {
    return history.find((h) => h.trade_date === selectedDate) || history[history.length - 1];
  }, [history, selectedDate]);

  const activeContracts = useMemo(() => {
    return contractsMap[selectedDate] || [];
  }, [contractsMap, selectedDate]);

  const verdict = useMemo(() => {
    const score = activeParity?.score ?? 94;
    if (score >= 90) {
      return "Equilibrium — all four contracts agree within 1.5 bps of the fine-gold median.";
    } else if (score >= 75) {
      return "Moderate spread — minor basis dispersion across delivery tenors.";
    } else {
      return "Dislocation — noticeable price deviation between wholesale and retail lots.";
    }
  }, [activeParity]);

  return (
    <section
      id="live-demo"
      className="w-full py-20 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto border-t"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="mb-8 max-w-2xl">
        <span
          className="text-xs font-mono uppercase tracking-widest block mb-2"
          style={{ color: "var(--color-gold-m)" }}
        >
          Interactive Demonstration
        </span>
        <h2
          className="font-display font-bold text-3xl sm:text-4xl tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Try it.
        </h2>
        <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Scrub through 45 days of MCX parity calculations. Watch streaks, score, and the verdict adapt instantly.
        </p>
      </div>

      <div
        className="p-6 rounded-xs border space-y-6"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-line)",
        }}
      >
        {/* Timeline Scrubber */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono" style={{ color: "var(--color-muted)" }}>
            <span>TIMELINE SCRUBBER (45 TRADING DAYS)</span>
            <span>ACTIVE: {selectedDate}</span>
          </div>
          <TimeScrubber
            history={history}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Dynamic Verdict Header */}
        <div
          className="p-3.5 rounded-xs border flex items-center justify-between text-xs"
          style={{
            background: "var(--color-page)",
            borderColor: "var(--color-line)",
          }}
        >
          <div>
            <span className="font-mono text-[10px] uppercase block" style={{ color: "var(--color-muted)" }}>
              Daily Assay Verdict
            </span>
            <span className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
              {verdict}
            </span>
          </div>
          <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-xs" style={{ background: "var(--color-surface)", color: "var(--color-gold-m)", border: "1px solid var(--color-line)" }}>
            SCORE {activeParity?.score ?? "--"}/100
          </div>
        </div>

        {/* Touchstone Slab & Hallmark Stamp */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8">
            <Touchstone
              contracts={activeContracts}
              selectedDate={selectedDate}
            />
          </div>
          <div className="lg:col-span-4">
            <HallmarkStamp parity={activeParity} />
          </div>
        </div>

        {/* Bottom Bar: Disclaimer and CTA */}
        <div
          className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-gold-m)" }} />
            <span>Sample data. These are not real MCX prices.</span>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xs font-semibold text-xs border transition-opacity hover:opacity-85 focus-visible:outline-2"
            style={{
              background: "var(--color-text)",
              color: "var(--color-page)",
              borderColor: "var(--color-text)",
            }}
          >
            <span>Open the full dashboard</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
