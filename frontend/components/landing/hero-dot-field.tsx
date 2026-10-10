"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OreHeroCenterpiece } from "./ore-hero-centerpiece";

interface Dot {
  x: number;
  y: number;
  targetY: number;
  startY: number;
  vx: number;
  vy: number;
  color: string;
  contractIndex: number;
  alpha: number;
}

const CONTRACT_COLORS = [
  "#C9A24B", // GOLDM
  "#D9B866", // GOLDTEN
  "#B98A2F", // GOLDGUINEA
  "#E6CF8F", // GOLDPETAL
];

export function HeroDotField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stampVisible, setStampVisible] = useState(false);
  const [splitProgress, setSplitProgress] = useState(0);

  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  // Scroll tracking to drive the 4-piece ore split
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // Step 1 begins around 80px down and concludes around 480px
      const start = 60;
      const end = 440;
      const progress = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
      setSplitProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let startTime = performance.now();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Intersection observer to pause offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];

    const initDots = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = Math.max(340, rect.height);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      dots = [];
      const numSteps = Math.floor(width / 14);
      const centerY = height * 0.5;

      // 4 streaks representing the 4 contracts
      for (let c = 0; c < 4; c++) {
        const color = CONTRACT_COLORS[c];
        // In full parity, all streaks cluster around centerY with tiny 14px spacing
        const targetBaseline = centerY + (c - 1.5) * 14;
        // In dispersed starting state, they drift widely
        const initialDrift = (c - 1.5) * 44 + Math.sin(c * 2) * 16;

        for (let i = 0; i < numSteps; i++) {
          const x = (i / (numSteps - 1)) * (width - 40) + 20;
          const curveNoise = Math.sin((i / numSteps) * Math.PI * 3 + c) * 10;
          const targetY = targetBaseline + Math.sin((i / numSteps) * Math.PI * 2) * 3;
          const startY = centerY + initialDrift + curveNoise;

          dots.push({
            x,
            y: prefersReducedMotion ? targetY : startY,
            startY,
            targetY,
            vx: 0,
            vy: 0,
            color,
            contractIndex: c,
            alpha: 0.85,
          });
        }
      }

      if (prefersReducedMotion) {
        setStampVisible(true);
      }
    };

    initDots();
    window.addEventListener("resize", initDots);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const render = (now: number) => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(1, elapsed / 1.6);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      if (progress >= 0.95 && !stampVisible) {
        setStampVisible(true);
      }

      ctx.clearRect(0, 0, width, height);

      // Render touchstone dark texture backdrop
      ctx.fillStyle = "rgba(23, 34, 32, 0.96)";
      ctx.fillRect(0, 0, width, height);

      // Faint alignment reference guidelines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      const centerY = height * 0.5;
      ctx.beginPath();
      ctx.moveTo(10, centerY);
      ctx.lineTo(width - 10, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      const mouse = mouseRef.current;
      const repelRadius = 70;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        if (!prefersReducedMotion) {
          const baseGoalY = dot.startY + (dot.targetY - dot.startY) * easedProgress;

          let dx = dot.x - mouse.x;
          let dy = dot.y - mouse.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          let pushX = 0;
          let pushY = 0;

          if (mouse.active && dist < repelRadius && dist > 0) {
            const force = (1 - dist / repelRadius) * 16;
            pushX = (dx / dist) * force;
            pushY = (dy / dist) * force;
          }

          const targetY = baseGoalY + pushY;
          dot.vy += (targetY - dot.y) * 0.12;
          dot.vy *= 0.72;
          dot.y += dot.vy;

          if (pushX !== 0) {
            dot.vx += pushX * 0.1;
            dot.vx *= 0.65;
            dot.x += dot.vx;
          }
        }

        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("resize", initDots);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [stampVisible]);

  return (
    <section className="w-full pt-10 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Sample data banner notice */}
      <div
        className="mb-6 inline-flex items-center gap-2 px-3 py-1 text-xs border rounded-xs"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-line)",
          color: "var(--color-muted)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--color-gold-1)" }}
        />
        <span>Sample data. These are not real MCX prices.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Headline and Story */}
        <div className="lg:col-span-5 space-y-6">
          <h1
            className="font-display font-bold text-4xl sm:text-5xl leading-[1.08] tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Four MCX gold contracts. One question: do they agree?
          </h1>

          <p
            className="text-base sm:text-lg leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            MCX trades four gold futures contracts of different lot sizes and
            purities. Assay normalises them to one fine gram and tests whether
            their prices hold parity or drift apart.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xs text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2"
              style={{
                background: "var(--color-text)",
                color: "var(--color-page)",
              }}
            >
              Open dashboard
            </Link>
            <Link
              href="/method"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xs text-sm font-semibold border transition-colors hover:bg-surface focus-visible:outline-2"
              style={{
                borderColor: "var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              Read the method
            </Link>
          </div>

          <div
            className="pt-4 border-t flex flex-wrap gap-4 text-xs"
            style={{
              borderColor: "var(--color-line)",
              color: "var(--color-muted)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: CONTRACT_COLORS[0] }} />
              <span>GOLDM (1 kg, 995)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: CONTRACT_COLORS[1] }} />
              <span>GOLDTEN (10 g, 999)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: CONTRACT_COLORS[2] }} />
              <span>GOLDGUINEA (8 g, 999)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: CONTRACT_COLORS[3] }} />
              <span>GOLDPETAL (1 g, 999)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Touchstone Slab Canvas with 3D Ore Centrepiece */}
        <div className="lg:col-span-7">
          <div
            ref={containerRef}
            className="relative rounded-xs overflow-hidden shadow-sm"
            style={{
              background: "#172220",
              border: "1px solid var(--color-line)",
              minHeight: "360px",
            }}
          >
            {/* Top header on touchstone */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b text-xs relative z-20"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                color: "#9AA5A1",
                background: "rgba(23, 34, 32, 0.8)",
              }}
            >
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase">
                <span>Touchstone verification</span>
                <span className="text-[10px] opacity-60">Gold ore assay</span>
              </div>
              <div className="text-[11px] text-right font-mono">
                Sample data. These are not real MCX prices.
              </div>
            </div>

            {/* Canvas dot field (layer 1) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
              aria-label="Touchstone simulation showing four MCX gold contract streaks settling into alignment"
            />

            {/* 3D Ore Centrepiece (layer 2) */}
            <div className="relative z-10 w-full h-[320px] sm:h-[350px]">
              <OreHeroCenterpiece splitProgress={splitProgress} />
            </div>

            {/* Score & Hallmark Stamp (layer 3) */}
            <div
              className={`absolute bottom-4 right-4 p-3 rounded-xs border backdrop-blur-sm z-20 transition-all duration-500 ${
                stampVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
              }`}
              style={{
                background: "rgba(23, 34, 32, 0.85)",
                borderColor: "rgba(201, 162, 75, 0.4)",
                color: "#E4E8E3",
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#D9B866]">
                  Parity score
                </span>
                <span className="font-display font-bold text-3xl tabular-nums leading-none text-[#E6CF8F]">
                  94
                </span>
                <span className="text-xs text-[#9AA5A1]">/ 100</span>
              </div>
              <div className="text-[10px] font-mono mt-1 text-[#9AA5A1]">
                ASSAY HALLMARK VERIFIED
              </div>
            </div>

            {/* Touchstone caption (layer 4) */}
            <div
              className="relative z-20 px-4 py-2 border-t text-[11px] flex justify-between items-center"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                color: "#9AA5A1",
                background: "rgba(23, 34, 32, 0.8)",
              }}
            >
              <span>Scroll down to assay the ore into four contract pieces.</span>
              <span className="font-mono">Drag to rotate</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
