"use client";

import React, { useEffect, useRef, useState } from "react";

interface TourStep {
  num: string;
  title: string;
  tag: string;
  summary: string;
  detail: string;
  annotation: {
    label: string;
    caption: string;
  };
}

const TOUR_STEPS: TourStep[] = [
  {
    num: "01",
    title: "Four contracts, one metal.",
    tag: "Stage S1 / S2: Multi-Contract Ingest",
    summary:
      "MCX trades GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL simultaneously.",
    detail:
      "Delivery denominations span 1 kg down to 1 gram, with differing purities (995 vs 999). Assay ingests official Bhavcopy records directly.",
    annotation: {
      label: "LOT SIZES",
      caption: "From wholesale 1 kg bars to retail 1 g lots.",
    },
  },
  {
    num: "02",
    title: "Normalise to fine-gold equivalent.",
    tag: "Stage S5: Conversion Math",
    summary:
      "All quote units are reduced to standard INR per 1 fine gram.",
    detail:
      "Raw quotations cannot be compared on headline prices. Dividing by contract multipliers and purity factors reveals true basis point spreads.",
    annotation: {
      label: "PURITY BAND",
      caption: "995 fineness vs 999 fineness equalised.",
    },
  },
  {
    num: "03",
    title: "Fade illiquid contracts.",
    tag: "Stage S5: Liquidity Discount",
    summary:
      "Discount spreads formed against dormant or zero-volume trades.",
    detail:
      "Thinly traded contracts can post stale marks that do not reflect executable liquidity. Assay applies volume-weighted fade penalties.",
    annotation: {
      label: "LIQUIDITY FADE",
      caption: "Stale quotes discounted to prevent false alarms.",
    },
  },
  {
    num: "04",
    title: "Score the hallmark.",
    tag: "Stage S5: Daily Parity Index",
    summary:
      "Compute median pairwise spread against historical baseline on a 0–100 scale.",
    detail:
      "When contracts agree within tight basis points, the score approaches 100. Dislocation pulls the hallmark score downward.",
    annotation: {
      label: "HALLMARK SCORE",
      caption: "0 to 100 benchmark of market agreement.",
    },
  },
  {
    num: "05",
    title: "Seal the audit chain.",
    tag: "Stage S6: Trust Ledger",
    summary:
      "Bind each daily result with SHA-256 cryptographic hash chaining.",
    detail:
      "Every import batch links to the prior digest. Modifying history alters downstream hashes, providing indisputable integrity.",
    annotation: {
      label: "SHA-256 SEAL",
      caption: "Immutable cryptographic ledger.",
    },
  },
];

export function ScrollTour() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Track step intersection on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const stepEls = containerRef.current.querySelectorAll(".tour-step-card");
      const centerY = window.innerHeight * 0.45;

      stepEls.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
          setActiveStep(index);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const current = TOUR_STEPS[activeStep] || TOUR_STEPS[0];

  return (
    <section
      id="product-tour"
      ref={containerRef}
      className="w-full py-20 px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto border-t"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="mb-12 max-w-2xl">
        <span
          className="text-xs font-mono uppercase tracking-widest block mb-2"
          style={{ color: "var(--color-gold-m)" }}
        >
          Product Tour
        </span>
        <h2
          className="font-display font-bold text-3xl sm:text-4xl tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          How Assay tests the market.
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Five deterministic steps turn four raw Bhavcopy quotations into an auditable
          parity score.
        </p>
      </div>

      {/* Grid: Left scrolling steps, Right sticky inspection card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Step cards */}
        <div className="lg:col-span-7 space-y-8">
          {TOUR_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <div
                key={step.num}
                onClick={() => setActiveStep(idx)}
                className={`tour-step-card p-6 rounded-xs border transition-all duration-300 cursor-pointer ${
                  isActive ? "shadow-sm" : "opacity-75 hover:opacity-100"
                }`}
                style={{
                  background: isActive
                    ? "var(--color-surface)"
                    : "var(--color-page)",
                  borderColor: isActive
                    ? "var(--color-text)"
                    : "var(--color-line)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="font-mono text-xs font-semibold px-2 py-0.5 rounded-xs"
                    style={{
                      background: "var(--color-page)",
                      color: "var(--color-gold-m)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    STEP {step.num}
                  </span>
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {step.tag}
                  </span>
                </div>

                <h3
                  className="font-display font-semibold text-xl leading-snug mb-2"
                  style={{ color: "var(--color-text)" }}
                >
                  {step.title}
                </h3>

                <p
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: "var(--color-muted)" }}
                >
                  {step.summary}
                </p>

                <div
                  className="pt-3 border-t text-xs leading-normal"
                  style={{
                    borderColor: "var(--color-line)",
                    color: isActive ? "var(--color-text)" : "var(--color-muted)",
                  }}
                >
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Sticky Inspector Card */}
        <div className="lg:col-span-5 sticky top-24">
          <div
            className="p-6 rounded-xs border relative overflow-hidden"
            style={{
              background: "#172220",
              borderColor: "rgba(255, 255, 255, 0.12)",
              color: "#E4E8E3",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-6 text-xs font-mono">
              <span className="text-[#D9B866]">INSPECTION FACE {current.num}/05</span>
              <span className="text-[#9AA5A1]">STAGE VERIFICATION</span>
            </div>

            <div className="py-6 space-y-4">
              <div
                className="inline-block px-2.5 py-1 rounded-xs border text-xs font-mono tracking-widest uppercase"
                style={{
                  background: "rgba(201, 162, 75, 0.12)",
                  borderColor: "rgba(201, 162, 75, 0.4)",
                  color: "#E6CF8F",
                }}
              >
                {current.annotation.label}
              </div>

              <h4 className="font-display font-bold text-2xl text-[#F3F4F0]">
                {current.title}
              </h4>

              <p className="text-sm leading-relaxed text-[#9AA5A1]">
                {current.annotation.caption}
              </p>

              <div className="pt-4 border-t border-white/10 flex justify-between text-xs font-mono text-[#9AA5A1]">
                <span>METHOD: DETERMINISTIC</span>
                <span>AUDIT: VERIFIED</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xs bg-black/30 border border-white/5 text-[11px] font-mono text-[#9AA5A1]">
              Click any step on the left to rotate focus to that stage.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
