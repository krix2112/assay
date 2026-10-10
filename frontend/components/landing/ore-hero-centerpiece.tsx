"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

// Load 3D scene dynamically with ssr: false so Three.js is not bundled on server or other pages
const DynamicOreScene = dynamic(
  () => import("./ore-scene").then((mod) => mod.OreScene),
  {
    ssr: false,
    loading: () => null,
  }
);

interface OreHeroCenterpieceProps {
  splitProgress?: number;
}

export function OreHeroCenterpiece({ splitProgress = 0 }: OreHeroCenterpieceProps) {
  const [shouldLoad3D, setShouldLoad3D] = useState(false);
  const [is3DReady, setIs3DReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);

  // Check WebGL availability and idle callback scheduling
  useEffect(() => {
    // Check reduced motion or save-data preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Check save-data mode
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const isSaveData = !!nav.connection?.saveData;

    // Test WebGL context support
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) {
        setIsWebGLSupported(false);
        return;
      }
    } catch {
      setIsWebGLSupported(false);
      return;
    }

    if (prefersReducedMotion || isSaveData) {
      // Stay on high-fidelity static poster
      return;
    }

    // Schedule 3D scene initialization strictly after first paint
    if ("requestIdleCallback" in window) {
      const idleId = (window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback(
        () => {
          setShouldLoad3D(true);
        },
        { timeout: 1200 }
      );
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        }
      };
    } else {
      const timer = setTimeout(() => {
        setShouldLoad3D(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSceneLoaded = () => {
    setIs3DReady(true);
  };

  const handleSceneError = () => {
    setHasError(true);
  };

  return (
    <div
      className="relative w-full h-[320px] sm:h-[360px] overflow-hidden rounded-xs flex items-center justify-center"
      style={{
        background: "transparent",
      }}
    >
      {/* 1. Static Poster: Rendered immediately on first paint */}
      {/* Ensures zero layout shift, instantaneous visual appearance, and graceful fallback */}
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
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-contain"
        />
      </div>

      {/* 2. Interactive 3D Canvas Scene: Loaded after idle callback */}
      {shouldLoad3D && isWebGLSupported && !hasError && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            is3DReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <DynamicOreScene
            splitProgress={splitProgress}
            onLoaded={handleSceneLoaded}
            onError={handleSceneError}
          />
        </div>
      )}
    </div>
  );
}
