"use client";

import React from "react";
import proofData from "@/content/proof.json";

export function ProofFacts() {
  const { facts } = proofData;

  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-10 max-w-2xl">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Verifiable facts
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          Every claim checked against code and tests.
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          We do not ask for trust on reputation. Every assertion below is counted and tested directly in the codebase.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {facts.map((fact) => (
          <div
            key={fact.id}
            className="p-5 rounded-xs border flex flex-col justify-between"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3 text-[11px] font-mono">
                <span
                  className="px-2 py-0.5 rounded-xs"
                  style={{
                    background: "var(--color-page)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-verdigris)",
                  }}
                >
                  VERIFIED
                </span>
                <span style={{ color: "var(--color-muted)" }}>
                  Verified: {fact.lastVerified}
                </span>
              </div>

              <h3
                className="font-display font-semibold text-base leading-snug mb-2"
                style={{ color: "var(--color-text)" }}
              >
                {fact.headline}
              </h3>

              <p
                className="text-xs leading-relaxed mb-4"
                style={{ color: "var(--color-muted)" }}
              >
                {fact.detail}
              </p>
            </div>

            <div
              className="pt-3 border-t text-[11px] font-mono truncate"
              style={{
                borderColor: "var(--color-line)",
                color: "var(--color-muted)",
              }}
              title={fact.source}
            >
              Source: {fact.source}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
