import React from "react";
import { FloatingPillNav } from "@/components/nav/floating-pill-nav";
import { OreProductHero } from "@/components/landing/ore-product-hero";
import { ScrollTour } from "@/components/landing/scroll-tour";
import { LiveDemo } from "@/components/landing/live-demo";
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
      {/* Floating pill navigation at the top */}
      <FloatingPillNav />

      <main className="flex-1 w-full flex flex-col">
        {/* Part A: Full-viewport dark product hero */}
        <OreProductHero />

        {/* Part B: Product tour sticky scroll story */}
        <ScrollTour />

        {/* Part C: Live interactive demo section */}
        <LiveDemo />

        {/* Supporting sections */}
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
