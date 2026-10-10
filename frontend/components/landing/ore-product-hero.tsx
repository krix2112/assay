"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import type { ProjectedTag } from "./ore-3d-scene";

const DynamicOre3DScene = dynamic(
  () => import("./ore-3d-scene").then((mod) => mod.Ore3DScene),
  {
    ssr: false,
    loading: () => null,
  }
);

export function OreProductHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad3D, setShouldLoad3D] = useState(false);
  const [is3DReady, setIs3DReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pointerParallax, setPointerParallax] = useState({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tags, setTags] = useState<ProjectedTag[]>([]);
  const [tagsRevealed, setTagsRevealed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Resize check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Idle load for 3D scene after first paint
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    if ("requestIdleCallback" in window) {
      const idleId = (window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback(
        () => setShouldLoad3D(true),
        { timeout: 1200 }
      );
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        }
      };
    } else {
      const timer = setTimeout(() => setShouldLoad3D(true), 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // Reveal tags sequence under 2.2s
  useEffect(() => {
    const timer = setTimeout(() => {
      setTagsRevealed(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  // Pointer move handler (subtle parallax)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setPointerParallax({ x: nx * 0.8, y: -ny * 0.6 });
  };

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const progress = Math.min(1, Math.max(0, scrollY / 600));
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full min-h-screen flex flex-col justify-between overflow-hidden px-4 sm:px-8 lg:px-12 pt-28 pb-10"
      style={{
        background: "#101A18", // Full-viewport basalt-green hero in both themes
        color: "#E4E8E3",
      }}
    >
      {/* 1. Faint static/pointer-reactive dust dots backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(201, 162, 75, 0.28) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          transform: `translate(${pointerParallax.x * 6}px, ${pointerParallax.y * 6}px)`,
          transition: "transform 0.2s ease-out",
        }}
      />

      {/* 2. Top Banner notification */}
      <div className="relative z-20 flex justify-between items-center text-xs">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono"
          style={{
            background: "rgba(23, 34, 32, 0.75)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            color: "#9AA5A1",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--color-gold-m)" }}
          />
          <span>Sample data. These are not real MCX prices.</span>
        </div>

        <div className="hidden sm:block text-[11px] font-mono tracking-wider" style={{ color: "#9AA5A1" }}>
          MCX GOLD FUTURES PARITY INTELLIGENCE
        </div>
      </div>

      {/* 3. Main Stage: Left Headline & Right 3D Ore Stage */}
      <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 py-8">
        {/* Left Column: Headline, Copy, Action Buttons */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <span
              className="text-xs font-mono uppercase tracking-widest block text-[#D9B866]"
            >
              Assay intelligence
            </span>
            <h1
              className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight text-[#F3F4F0]"
            >
              Meet Assay.
            </h1>
          </div>

          <p
            className="text-base sm:text-lg leading-relaxed text-[#9AA5A1] max-w-md"
          >
            The daily test for MCX gold contracts. We check whether the four
            gold contracts agree, and show our work.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border transition-all duration-200 hover:bg-[#E4E8E3] hover:text-[#101A18] focus-visible:outline-2"
              style={{
                borderColor: "rgba(255, 255, 255, 0.35)",
                color: "#F3F4F0",
                background: "rgba(255, 255, 255, 0.04)",
              }}
            >
              <span>Open the dashboard</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>

            <a
              href="#product-tour"
              className="text-sm font-semibold text-[#D9B866] hover:underline focus-visible:outline-2 px-2 py-1"
            >
              See how it tests
            </a>
          </div>

          {/* Four contract pill tags */}
          <div className="pt-6 border-t flex flex-wrap gap-3 text-xs" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
            <span className="font-mono text-[11px] text-[#9AA5A1]">MCX CONTRACTS:</span>
            <span className="font-mono text-[11px] text-[#C9A24B]">GOLDM (1kg)</span>
            <span className="font-mono text-[11px] text-[#D9B866]">GOLDTEN (10g)</span>
            <span className="font-mono text-[11px] text-[#B98A2F]">GOLDGUINEA (8g)</span>
            <span className="font-mono text-[11px] text-[#E6CF8F]">GOLDPETAL (1g)</span>
          </div>
        </div>

        {/* Right Column: 3D Ore & Shards with Dynamic Dotted Leader Lines */}
        <div className="lg:col-span-7 relative h-[420px] sm:h-[500px] lg:h-[560px] w-full flex items-center justify-center">
          {/* Static Poster (Visible on first paint, fades when 3D is active) */}
          <div
            className={`absolute inset-0 transition-opacity duration-700 pointer-events-none flex items-center justify-center ${
              is3DReady && !hasError ? "opacity-0" : "opacity-100"
            }`}
          >
            <Image
              src="/images/ore-poster.webp"
              alt="A decorative 3D model of gold ore"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 750px"
              className="object-contain"
            />
          </div>

          {/* Interactive 3D Canvas Scene */}
          {shouldLoad3D && !hasError && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ${
                is3DReady ? "opacity-100" : "opacity-0"
              }`}
            >
              <DynamicOre3DScene
                onTagsUpdate={setTags}
                pointerParallax={pointerParallax}
                scrollProgress={scrollProgress}
                onFrameRendered={() => setIs3DReady(true)}
                onError={() => setHasError(true)}
              />
            </div>
          )}

          {/* SVG Dotted Leader Lines Overlay (Desktop only) */}
          {!isMobile && tagsRevealed && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-30"
              style={{ overflow: "visible" }}
            >
              {tags.map((tag) => {
                if (!tag.visible) return null;
                const isRight = tag.targetSide === "right";
                // Tag label box positions
                const labelX = isRight ? tag.screenX + 80 : tag.screenX - 80;
                const labelY = tag.screenY - 30;

                return (
                  <g key={tag.id} className="transition-opacity duration-300">
                    {/* Dotted connector leader line */}
                    <path
                      d={`M ${tag.screenX} ${tag.screenY} L ${labelX} ${labelY}`}
                      fill="none"
                      stroke="rgba(217, 184, 102, 0.75)"
                      strokeWidth="1.2"
                      strokeDasharray="3 4"
                    />
                    {/* Anchor dot on ore */}
                    <circle
                      cx={tag.screenX}
                      cy={tag.screenY}
                      r="3"
                      fill="#D9B866"
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Projected Annotation HTML Tags */}
          {tagsRevealed && (
            <div className="absolute inset-0 pointer-events-none z-30">
              {tags.map((tag, idx) => {
                // Mobile displays first 2 tags in fixed corner slots
                if (isMobile) {
                  if (idx >= 2) return null;
                  return (
                    <div
                      key={tag.id}
                      className={`absolute p-2.5 rounded-xs border backdrop-blur-sm ${
                        idx === 0 ? "top-2 right-2" : "bottom-2 right-2"
                      }`}
                      style={{
                        background: "rgba(16, 26, 24, 0.88)",
                        borderColor: "rgba(217, 184, 102, 0.4)",
                        maxWidth: "200px",
                      }}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider block text-[#D9B866]">
                        {tag.label}
                      </span>
                      <p className="text-[11px] leading-tight text-[#E4E8E3] mt-0.5">
                        {tag.caption}
                      </p>
                    </div>
                  );
                }

                if (!tag.visible) return null;
                const isRight = tag.targetSide === "right";
                const posX = isRight ? tag.screenX + 80 : tag.screenX - 220;
                const posY = tag.screenY - 45;

                return (
                  <div
                    key={tag.id}
                    className="absolute p-2 rounded-xs border backdrop-blur-sm transition-all duration-200"
                    style={{
                      left: `${posX}px`,
                      top: `${posY}px`,
                      background: "rgba(16, 26, 24, 0.88)",
                      borderColor: "rgba(217, 184, 102, 0.45)",
                      maxWidth: "210px",
                    }}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest block text-[#D9B866]">
                      {tag.label}
                    </span>
                    <p className="text-[11px] leading-snug text-[#E4E8E3] mt-0.5">
                      {tag.caption}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Corner Texts */}
      <div
        className="relative z-20 pt-6 border-t flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs"
        style={{ borderColor: "rgba(255, 255, 255, 0.1)", color: "#9AA5A1" }}
      >
        <div className="max-w-md leading-relaxed text-[11px]">
          Assay normalises four MCX gold contracts to one fine gram and tests
          whether their settlement prices hold parity or drift apart.
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span>Scroll to see how it tests</span>
          <span className="w-8 h-px bg-[#D9B866]" />
        </div>
      </div>
    </section>
  );
}
