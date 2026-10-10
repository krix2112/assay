"use client";

import React from "react";
import reviewsData from "@/content/reviews.json";
import siteData from "@/content/site.json";

interface Review {
  id: string;
  author: string;
  role: string;
  organization: string;
  content: string;
  date: string;
}

export function PilotReviews() {
  const reviews = (reviewsData.reviews || []) as Review[];
  const feedbackUrl = siteData.feedbackUrl || "";

  return (
    <section className="w-full py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t" style={{ borderColor: "var(--color-line)" }}>
      <div className="mb-8 max-w-2xl">
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Pilot validation
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: "var(--color-text)" }}>
          Institutional pilot feedback
        </h2>
        <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--color-muted)" }}>
          Direct verification from physical bullion desks, jewellers, and quantitative market makers.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div
          className="p-8 rounded-xs border space-y-4"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-line)",
          }}
        >
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--color-gold-1)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-gold-1)" }} />
            <span>ACTIVE PRIVATE PILOT</span>
          </div>

          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--color-text)" }}>
            Assay is currently in private pilot testing with participating bullion desks and institutional traders. Feedback and validation reports will be published here upon independent verification.
          </p>

          <div
            className="pt-4 border-t text-xs flex flex-wrap items-center justify-between gap-4"
            style={{
              borderColor: "var(--color-line)",
              color: "var(--color-muted)",
            }}
          >
            <span>
              Are you testing MCX gold parity? Share observations from your desk.
            </span>

            {feedbackUrl ? (
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Submit pilot feedback
              </a>
            ) : (
              <span className="text-[11px] font-mono">
                Pilot desks may submit logs via their dedicated communication channel.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="p-6 rounded-xs border"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
              }}
            >
              <p className="text-sm italic mb-4" style={{ color: "var(--color-text)" }}>
                &ldquo;{r.content}&rdquo;
              </p>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                <span className="font-semibold block" style={{ color: "var(--color-text)" }}>
                  {r.author}
                </span>
                <span>{r.role}, {r.organization}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
