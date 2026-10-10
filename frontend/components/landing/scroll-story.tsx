"use client";

import React, { useState } from "react";

interface Step {
  step: string;
  title: string;
  summary: string;
  detail: string;
  tag: string;
}

const STEPS: Step[] = [
  {
    step: "01",
    title: "Ingest four contracts",
    summary: "GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL trade side by side on MCX.",
    detail: "Each contract carries a different delivery size and fineness: from 1 kg (995 fineness) down to 1 g (999 fineness). Because their trading volumes and participants differ, quotes often drift apart.",
    tag: "Stage S1 / S2",
  },
  {
    step: "02",
    title: "Normalise to fine-gold equivalent",
    summary: "Convert quote units and purity to standard INR per 1 fine gram.",
    detail: "Raw quotations (quoted per 10g or per 1g or per 8g) cannot be compared directly. Assay divides contract prices by their fine gram conversion factors, creating a unified common denominator.",
    tag: "Stage S5 Normalise",
  },
  {
    step: "03",
    title: "Fade illiquid contracts",
    summary: "Discount spreads formed against stale or zero-volume trades.",
    detail: "A contract with zero trades or tiny open interest may publish an artificial quote. Assay computes pairwise volume weights and flags illiquid pairs so phantom discrepancies do not distort real parity.",
    tag: "Stage S5 Liquidity",
  },
  {
    step: "04",
    title: "Score the hallmark",
    summary: "Calculate pairwise spread medians in basis points on a 0 to 100 index.",
    detail: "The median spread across all active pairs is calibrated against a historical baseline. When contracts agree within 2 bps, the score climbs toward 100; as deviations widen, the score drops.",
    tag: "Stage S5 Analytics",
  },
  {
    step: "05",
    title: "Seal the audit chain",
    summary: "Bind each daily result with cryptographic SHA-256 hash chaining.",
    detail: "Every batch of ingested rows and published analytics incorporates the hash digest of the prior day's run. Any modification of historical numbers invalidates the chain downstream.",
    tag: "Stage S6 Trust",
  },
];

export function ScrollStory() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-10 max-w-2xl">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          How it works
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          From four separate quotations to one verified parity score.
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Five deterministic steps turn raw exchange Bhavcopy records into an auditable measure of cross-contract agreement.
        </p>
      </div>

      {/* 5-step grid — fully visible on first paint */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STEPS.map((s, idx) => {
          const isSelected = activeStep === idx;
          return (
            <div
              key={s.step}
              onClick={() => setActiveStep(idx)}
              className="p-5 rounded-xs border transition-colors cursor-pointer flex flex-col justify-between"
              style={{
                background: isSelected ? "var(--color-surface)" : "var(--color-page)",
                borderColor: isSelected ? "var(--color-text)" : "var(--color-line)",
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="font-mono text-xs font-semibold px-2 py-0.5 rounded-xs"
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-gold-1)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    {s.step}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>
                    {s.tag}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-lg leading-snug mb-2" style={{ color: "var(--color-text)" }}>
                  {s.title}
                </h3>

                <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--color-muted)" }}>
                  {s.summary}
                </p>
              </div>

              <div
                className="pt-3 border-t text-[11px] leading-normal"
                style={{
                  borderColor: "var(--color-line)",
                  color: isSelected ? "var(--color-text)" : "var(--color-muted)",
                }}
              >
                {s.detail}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
