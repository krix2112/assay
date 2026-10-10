import React from "react";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroDotField } from "@/components/landing/hero-dot-field";
import { ScrollStory } from "@/components/landing/scroll-story";
import { DataTransparency } from "@/components/landing/data-transparency";
import { QuietDayDemo } from "@/components/landing/quiet-day";
import { ProofFacts } from "@/components/landing/proof-facts";
import { PilotReviews } from "@/components/landing/pilot-reviews";
import { Audience } from "@/components/landing/audience";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "Assay — MCX Gold Futures Parity Intelligence",
  description:
    "Assay normalises four MCX gold contracts to one fine gram and tests whether their prices hold parity or drift apart.",
};

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col selection:bg-surface selection:text-text"
      style={{
        background: "var(--color-page)",
        color: "var(--color-text)",
      }}
    >
      {/* Sample data banner */}
      <div
        role="status"
        aria-live="polite"
        className="sample-banner"
      >
        Sample data. These are not real MCX prices.
      </div>

      <LandingNav />

      <main className="flex-1 w-full flex flex-col">
        <HeroDotField />
        <ScrollStory />
        <DataTransparency />
        <QuietDayDemo />
        <ProofFacts />
        <PilotReviews />
        <Audience />
        <FaqAccordion />
      </main>

      <LandingFooter />
    </div>
  );
}
