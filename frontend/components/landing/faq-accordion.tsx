"use client";

import React, { useState } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "faq-parity",
    question: "What does the parity score measure?",
    answer:
      "The parity score is a 0 to 100 index that measures how closely all active pairwise combinations of MCX gold contracts agree on the fine-gold equivalent price. A score near 100 means contracts trade within fractional basis points of one another. A lower score highlights substantial cross-contract dispersion.",
  },
  {
    id: "faq-four",
    question: "Why test four contracts instead of just the main contract?",
    answer:
      "MCX lists GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL with delivery lot sizes ranging from 1 kg down to 1 gram. Each serves different market participants—from bullion importers to retail jewelers. Monitoring all four reveals whether smaller denomination contracts trade at a persistent distortion compared to wholesale benchmarks.",
  },
  {
    id: "faq-signals",
    question: "Does Assay offer real-time trading signals?",
    answer:
      "No. Assay is an end-of-day analytics and verification engine. It evaluates official daily bhavcopy records, audits data integrity, and calculates structured parity metrics. It does not publish tick-by-tick predictions or execute automated market orders.",
  },
  {
    id: "faq-scraping",
    question: "Does the product automate scraping?",
    answer:
      "The product itself does not scrape. Local development data is private and not published.",
  },
  {
    id: "faq-lookahead",
    question: "How do you prevent look-ahead bias?",
    answer:
      "All rolling statistics, medians, and MAD values are strictly backward-looking. Look-ahead tests pass in our backend test suite (including test_lookahead_temporal_isolation), ensuring that introducing or mutating subsequent days has zero mathematical effect on historical metrics or backtest entries.",
  },
  {
    id: "faq-ledger",
    question: "Can historical data be modified retroactively?",
    answer:
      "No. Raw imported records are stored in an append-only ledger protected by database audit constraints. Furthermore, every batch is cryptographically bound into an SHA-256 hash chain: if past data were manipulated, the entire downstream hash sequence would break.",
  },
];

export function FaqAccordion() {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    "faq-parity": true,
  });

  const toggle = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-4xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-10 text-center">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Frequently asked questions
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          Clarity on design and methodology.
        </h2>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq) => {
          const isOpen = !!openIds[faq.id];
          return (
            <div
              key={faq.id}
              className="border rounded-xs overflow-hidden transition-colors"
              style={{
                background: "var(--color-surface)",
                borderColor: isOpen ? "var(--color-text)" : "var(--color-line)",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(faq.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${faq.id}`}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 focus-visible:outline-2"
              >
                <span
                  className="font-display font-semibold text-base sm:text-lg"
                  style={{ color: "var(--color-text)" }}
                >
                  {faq.question}
                </span>
                <span
                  className="font-mono text-xs w-6 h-6 flex items-center justify-center shrink-0 rounded-xs border"
                  style={{
                    borderColor: "var(--color-line)",
                    color: "var(--color-muted)",
                  }}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              <div
                id={`panel-${faq.id}`}
                className={`px-5 transition-all duration-300 ease-out overflow-hidden ${
                  isOpen ? "max-h-96 pb-5 opacity-100" : "max-h-0 pb-0 opacity-0"
                }`}
              >
                <p
                  className="text-sm leading-relaxed border-t pt-3"
                  style={{
                    borderColor: "var(--color-line)",
                    color: "var(--color-muted)",
                  }}
                >
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
