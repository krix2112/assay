"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX } from "d3-shape";
import { median, extent } from "d3-array";
import { ContractDayItem } from "@/lib/api";

interface AgreementBandProps {
  contractsByDate: Record<string, ContractDayItem[]>;
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
}

const SYMBOLS = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"] as const;
type SymbolType = (typeof SYMBOLS)[number];

const SYMBOL_COLORS: Record<SymbolType, string> = {
  GOLDM:      "var(--color-gold-m)",
  GOLDTEN:    "var(--color-gold-ten)",
  GOLDGUINEA: "var(--color-gold-guinea)",
  GOLDPETAL:  "var(--color-gold-petal)",
};

const SYMBOL_LABELS: Record<SymbolType, string> = {
  GOLDM:      "Gold Mini (100g)",
  GOLDTEN:    "Gold 10g",
  GOLDGUINEA: "Gold Guinea (8g)",
  GOLDPETAL:  "Gold Petal (1g)",
};

// Dimensions
const W = 760;
const PRICE_H = 180;
const MID_GAP = 32;
const DEV_H = 120;
const M = { top: 20, right: 64, bottom: 24, left: 56 };
const CHART_H = M.top + PRICE_H + MID_GAP + DEV_H + M.bottom;

const MINIMAP_H = 36;
const MINIMAP_M = { top: 4, right: M.right, bottom: 16, left: M.left };

/** Helper to extract fine gold price per gram for a symbol on date */
function getContractPrice(contracts: ContractDayItem[], sym: SymbolType): number | null {
  const match = contracts
    .filter((c) => c.symbol === sym)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))[0];
  if (!match || match.fine_gold_price_per_gram == null) return null;
  const p = Number(match.fine_gold_price_per_gram);
  return p > 0 ? p : null;
}

function getContractLabel(contracts: ContractDayItem[], sym: SymbolType): string {
  const match = contracts
    .filter((c) => c.symbol === sym)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))[0];
  return match?.label ?? "Unknown";
}

/** Collision avoidance for end-of-line labels with leader lines */
function avoidLabelCollisions(
  items: { sym: SymbolType; y: number; valText: string; color: string }[],
  minY: number,
  maxY: number,
  spacing = 13
) {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y);

  // Relax overlapping positions iteratively
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      const overlap = spacing - (next.y - cur.y);
      if (overlap > 0) {
        cur.y -= overlap / 2;
        next.y += overlap / 2;
      }
    }
  }

  // Clamp within bounds
  for (const item of sorted) {
    item.y = Math.max(minY + 6, Math.min(maxY - 6, item.y));
  }
  return sorted;
}

export function AgreementBand({
  contractsByDate,
  dates,
  selectedDate,
  onSelectDate,
  isLoading = false,
}: AgreementBandProps) {
  const uid = useId();
  const clipId = `band-clip-${uid.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);

  // Enabled series toggle
  const [enabledSymbols, setEnabledSymbols] = useState<Set<SymbolType>>(
    new Set(SYMBOLS)
  );
  // Hovered series for dimming
  const [hoveredSymbol, setHoveredSymbol] = useState<SymbolType | null>(null);

  // Zoom / visible range: [startIndex, endIndex]
  const [visibleRange, setVisibleRange] = useState<[number, number]>(() => {
    const end = Math.max(0, dates.length - 1);
    const start = Math.max(0, end - 29); // default 30 days
    return [start, end];
  });

  // Keep visible range valid when dates change
  useEffect(() => {
    if (dates.length === 0) return;
    setVisibleRange(([s, e]) => {
      const maxIdx = dates.length - 1;
      const newE = Math.min(maxIdx, Math.max(2, e));
      const newS = Math.max(0, Math.min(newE - 2, s));
      return [newS, newE];
    });
  }, [dates.length]);

  // Decoupled hover crosshair (local to this component to maintain 60fps)
  const [hoverDateIndex, setHoverDateIndex] = useState<number | null>(null);

  // Animation frame throttle ref
  const rafRef = useRef<number | null>(null);

  // Drag pan state
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startRange: [number, number];
  }>({
    isDragging: false,
    startX: 0,
    startRange: [0, 0],
  });

  // Brush handle drag state
  const brushDragRef = useRef<{
    mode: "left" | "right" | "window" | null;
    startX: number;
    startRange: [number, number];
  }>({
    mode: null,
    startX: 0,
    startRange: [0, 0],
  });

  // 1. Compute daily data across ALL dates
  const dailyData = useMemo(() => {
    return dates.map((date) => {
      const contracts = contractsByDate[date] || [];
      const prices: Record<SymbolType, number | null> = {
        GOLDM:      getContractPrice(contracts, "GOLDM"),
        GOLDTEN:    getContractPrice(contracts, "GOLDTEN"),
        GOLDGUINEA: getContractPrice(contracts, "GOLDGUINEA"),
        GOLDPETAL:  getContractPrice(contracts, "GOLDPETAL"),
      };
      const labels: Record<SymbolType, string> = {
        GOLDM:      getContractLabel(contracts, "GOLDM"),
        GOLDTEN:    getContractLabel(contracts, "GOLDTEN"),
        GOLDGUINEA: getContractLabel(contracts, "GOLDGUINEA"),
        GOLDPETAL:  getContractLabel(contracts, "GOLDPETAL"),
      };

      const validPrices = Object.values(prices).filter((p): p is number => p !== null);
      const med = validPrices.length > 0 ? (median(validPrices) ?? null) : null;

      const deviations: Record<SymbolType, number | null> = {
        GOLDM:      med && prices.GOLDM != null ? ((prices.GOLDM - med) / med) * 10000 : null,
        GOLDTEN:    med && prices.GOLDTEN != null ? ((prices.GOLDTEN - med) / med) * 10000 : null,
        GOLDGUINEA: med && prices.GOLDGUINEA != null ? ((prices.GOLDGUINEA - med) / med) * 10000 : null,
        GOLDPETAL:  med && prices.GOLDPETAL != null ? ((prices.GOLDPETAL - med) / med) * 10000 : null,
      };

      const validDevs = Object.values(deviations).filter((d): d is number => d !== null);
      const minDev = validDevs.length > 0 ? Math.min(...validDevs) : null;
      const maxDev = validDevs.length > 0 ? Math.max(...validDevs) : null;
      const spreadBps = minDev !== null && maxDev !== null ? maxDev - minDev : null;

      return {
        date,
        prices,
        labels,
        median: med,
        deviations,
        minDev,
        maxDev,
        spreadBps,
      };
    });
  }, [dates, contractsByDate]);

  // Widest day across the dataset
  const widestDay = useMemo(() => {
    return dailyData.reduce<{ date: string; spreadBps: number } | null>((acc, d) => {
      if (d.spreadBps === null) return acc;
      if (!acc || d.spreadBps > acc.spreadBps) {
        return { date: d.date, spreadBps: d.spreadBps };
      }
      return acc;
    }, null);
  }, [dailyData]);

  const [startIdx, endIdx] = visibleRange;
  const visibleDates = dates.slice(Math.floor(startIdx), Math.ceil(endIdx) + 1);
  const visibleData = dailyData.slice(Math.floor(startIdx), Math.ceil(endIdx) + 1);
  const visibleCount = Math.max(1, endIdx - startIdx);

  // Auto-rescaling scales
  // 1. Time X-scale
  const xSc = useMemo(() => {
    return scaleLinear()
      .domain([startIdx, endIdx])
      .range([M.left, W - M.right]);
  }, [startIdx, endIdx]);

  // 2. Price Y-scale
  const yPriceSc = useMemo(() => {
    const visiblePrices = visibleData.flatMap((d) =>
      Array.from(enabledSymbols)
        .map((sym) => d.prices[sym])
        .filter((p): p is number => p !== null)
    );
    const [pLo, pHi] = extent(visiblePrices);
    const lo = pLo ?? 7400;
    const hi = pHi ?? 7600;
    const pad = Math.max(5, (hi - lo) * 0.12);
    return scaleLinear()
      .domain([lo - pad, hi + pad])
      .range([M.top + PRICE_H, M.top]);
  }, [visibleData, enabledSymbols]);

  // 3. Deviation Y-scale
  const yDevSc = useMemo(() => {
    const visibleDevs = visibleData.flatMap((d) =>
      Array.from(enabledSymbols)
        .map((sym) => d.deviations[sym])
        .filter((v): v is number => v !== null)
    );
    const [dLo, dHi] = extent(visibleDevs);
    const lo = dLo ?? -20;
    const hi = dHi ?? 20;
    const maxAbs = Math.max(15, Math.abs(lo), Math.abs(hi));
    const pad = maxAbs * 0.2;
    const topY = M.top + PRICE_H + MID_GAP;
    const bottomY = topY + DEV_H;
    return scaleLinear()
      .domain([-(maxAbs + pad), maxAbs + pad])
      .range([bottomY, topY]);
  }, [visibleData, enabledSymbols]);

  // Minimap scales
  const minimapXSc = useMemo(() => {
    return scaleLinear()
      .domain([0, Math.max(1, dates.length - 1)])
      .range([MINIMAP_M.left, W - MINIMAP_M.right]);
  }, [dates.length]);

  const minimapYSc = useMemo(() => {
    const allPrices = dailyData.flatMap((d) =>
      Object.values(d.prices).filter((p): p is number => p !== null)
    );
    const [pLo, pHi] = extent(allPrices);
    return scaleLinear()
      .domain([pLo ?? 7400, pHi ?? 7600])
      .range([MINIMAP_H - MINIMAP_M.bottom, MINIMAP_M.top]);
  }, [dailyData]);

  // Path generators with monotone interpolation and GAP preservation
  const makePriceLine = useCallback((sym: SymbolType) => {
    return line<{ idx: number; price: number | null }>()
      .defined((d) => d.price !== null)
      .x((d) => xSc(d.idx))
      .y((d) => yPriceSc(d.price ?? 0))
      .curve(curveMonotoneX);
  }, [xSc, yPriceSc]);

  const makeDevLine = useCallback((sym: SymbolType) => {
    return line<{ idx: number; dev: number | null }>()
      .defined((d) => d.dev !== null)
      .x((d) => xSc(d.idx))
      .y((d) => yDevSc(d.dev ?? 0))
      .curve(curveMonotoneX);
  }, [xSc, yDevSc]);

  const devEnvelopeArea = useMemo(() => {
    return area<(typeof dailyData)[0] & { idx: number }>()
      .defined((d) => d.minDev !== null && d.maxDev !== null)
      .x((d) => xSc(d.idx))
      .y0((d) => yDevSc(d.minDev ?? 0))
      .y1((d) => yDevSc(d.maxDev ?? 0))
      .curve(curveMonotoneX);
  }, [xSc, yDevSc]);

  // Minimap median line
  const minimapLine = useMemo(() => {
    return line<(typeof dailyData)[0] & { idx: number }>()
      .defined((d) => d.median !== null)
      .x((d) => minimapXSc(d.idx))
      .y((d) => minimapYSc(d.median ?? 0))
      .curve(curveMonotoneX);
  }, [minimapXSc, minimapYSc]);

  // Interactive Zoom / Pan Handler with requestAnimationFrame
  const updateRange = useCallback((newStart: number, newEnd: number) => {
    const maxIdx = Math.max(2, dates.length - 1);
    let s = Math.max(0, newStart);
    let e = Math.min(maxIdx, newEnd);

    // Min 2-day window clamp
    if (e - s < 2) {
      if (s === 0) e = 2;
      else if (e === maxIdx) s = maxIdx - 2;
      else e = s + 2;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setVisibleRange([s, e]);
    });
  }, [dates.length]);

  // Wheel Zoom around mouse cursor
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * W;

    // Fractional position between M.left and (W - M.right)
    const frac = Math.max(0, Math.min(1, (svgX - M.left) / (W - M.left - M.right)));
    const anchorIdx = startIdx + frac * (endIdx - startIdx);

    // Zoom factor: wheel down zooms out, wheel up zooms in
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
    const curSpan = endIdx - startIdx;
    const newSpan = Math.max(2, Math.min(dates.length - 1, curSpan * zoomFactor));

    const newStart = anchorIdx - frac * newSpan;
    const newEnd = newStart + newSpan;
    updateRange(newStart, newEnd);
  };

  // Drag Pan on Main Chart
  const handleChartPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // left click only
    chartSvgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startRange: [startIdx, endIdx],
    };
  };

  const handleChartPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * W;

    // Update hover crosshair
    const dateIdx = Math.round(xSc.invert(svgX));
    if (dateIdx >= 0 && dateIdx < dates.length) {
      setHoverDateIndex(dateIdx);
    } else {
      setHoverDateIndex(null);
    }

    // Process drag pan if active
    if (dragRef.current.isDragging) {
      const dx = e.clientX - dragRef.current.startX;
      const chartWidth = rect.width;
      const span = dragRef.current.startRange[1] - dragRef.current.startRange[0];
      const deltaIdx = -(dx / chartWidth) * span;

      updateRange(
        dragRef.current.startRange[0] + deltaIdx,
        dragRef.current.startRange[1] + deltaIdx
      );
    }
  };

  const handleChartPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try {
        chartSvgRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Double click resets zoom
  const handleDoubleClick = () => {
    const end = Math.max(0, dates.length - 1);
    const start = Math.max(0, end - 29);
    updateRange(start, end);
  };

  // Keyboard navigation (+, -, ArrowLeft, ArrowRight, Home)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const span = endIdx - startIdx;
    const center = (startIdx + endIdx) / 2;

    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      const newSpan = Math.max(2, span * 0.85);
      updateRange(center - newSpan / 2, center + newSpan / 2);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      const newSpan = Math.min(dates.length - 1, span * 1.18);
      updateRange(center - newSpan / 2, center + newSpan / 2);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateRange(startIdx - 2, endIdx - 2);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateRange(startIdx + 2, endIdx + 2);
    } else if (e.key === "Home") {
      e.preventDefault();
      updateRange(0, Math.max(2, dates.length - 1));
    }
  };

  // Range preset buttons (1 week, 2 weeks, 1 month, All)
  const setPreset = (days: number | "all") => {
    const end = Math.max(0, dates.length - 1);
    if (days === "all") {
      updateRange(0, end);
    } else {
      updateRange(Math.max(0, end - days + 1), end);
    }
  };

  // Brush handle interaction on minimap
  const handleBrushDown = (mode: "left" | "right" | "window", e: React.PointerEvent) => {
    e.stopPropagation();
    brushDragRef.current = {
      mode,
      startX: e.clientX,
      startRange: [startIdx, endIdx],
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handleBrushMove = (e: React.PointerEvent) => {
    const { mode, startX, startRange } = brushDragRef.current;
    if (!mode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - startX;
    const scaleFactor = (dates.length - 1) / (rect.width - MINIMAP_M.left - MINIMAP_M.right);
    const dIdx = dx * scaleFactor;

    if (mode === "left") {
      updateRange(startRange[0] + dIdx, startRange[1]);
    } else if (mode === "right") {
      updateRange(startRange[0], startRange[1] + dIdx);
    } else if (mode === "window") {
      updateRange(startRange[0] + dIdx, startRange[1] + dIdx);
    }
  };

  const handleBrushUp = () => {
    brushDragRef.current.mode = null;
  };

  // Click on minimap background jumps window
  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * W;
    const targetIdx = minimapXSc.invert(clickX);
    const span = endIdx - startIdx;
    updateRange(targetIdx - span / 2, targetIdx + span / 2);
  };

  // End-of-line labels for price and deviation panes
  const lastVisibleIdx = Math.min(dates.length - 1, Math.floor(endIdx));
  const lastPoint = dailyData[lastVisibleIdx];

  const priceEndLabels = useMemo(() => {
    if (!lastPoint) return [];
    const raw = Array.from(enabledSymbols)
      .map((sym) => {
        const p = lastPoint.prices[sym];
        return p !== null
          ? {
              sym,
              y: yPriceSc(p),
              valText: `₹${p.toFixed(0)}`,
              color: SYMBOL_COLORS[sym],
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return avoidLabelCollisions(raw, M.top, M.top + PRICE_H);
  }, [lastPoint, enabledSymbols, yPriceSc]);

  const devEndLabels = useMemo(() => {
    if (!lastPoint) return [];
    const topDevY = M.top + PRICE_H + MID_GAP;
    const raw = Array.from(enabledSymbols)
      .map((sym) => {
        const d = lastPoint.deviations[sym];
        return d !== null
          ? {
              sym,
              y: yDevSc(d),
              valText: `${d >= 0 ? "+" : ""}${d.toFixed(1)}bps`,
              color: SYMBOL_COLORS[sym],
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return avoidLabelCollisions(raw, topDevY, topDevY + DEV_H);
  }, [lastPoint, enabledSymbols, yDevSc]);

  // Scrubber date marker
  const scrubberIdx = dates.indexOf(selectedDate);
  const scrubberX = scrubberIdx >= 0 ? xSc(scrubberIdx) : null;

  // Hover data for tooltip
  const activeTooltipData = hoverDateIndex !== null ? dailyData[hoverDateIndex] : null;

  // Tooltip contract rows sorted by price descending
  const tooltipRows = useMemo(() => {
    if (!activeTooltipData) return [];
    return SYMBOLS.map((sym) => ({
      sym,
      name: SYMBOL_LABELS[sym],
      color: SYMBOL_COLORS[sym],
      price: activeTooltipData.prices[sym],
      dev: activeTooltipData.deviations[sym],
      label: activeTooltipData.labels[sym],
    })).sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }, [activeTooltipData]);

  // X axis ticks
  const xTickIndices = useMemo(() => {
    const count = Math.min(8, Math.max(3, Math.floor((W - M.left - M.right) / 80)));
    const step = Math.max(1, Math.floor((endIdx - startIdx) / count));
    const ticks: number[] = [];
    for (let i = Math.ceil(startIdx); i <= Math.floor(endIdx); i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] !== Math.floor(endIdx)) {
      ticks.push(Math.floor(endIdx));
    }
    return ticks;
  }, [startIdx, endIdx]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-xl p-5 sm:p-6 space-y-4 focus-visible:outline-2 focus-visible:outline-focus outline-none"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      aria-label="Agreement Band interactive stock chart"
    >
      {/* Header with Title, Range Presets, and Current Window info */}
      <div
        className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-3"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div>
          <div className="flex items-center space-x-2">
            <h3
              className="font-display text-base sm:text-lg font-semibold tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              Agreement band & deviation
            </h3>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-xs"
              style={{ background: "var(--color-page)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
            >
              Interactive · {visibleCount + 1} days visible
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            Fine gold price per gram (top) and daily median basis-point deviation (bottom).
          </p>
        </div>

        {/* Range Buttons & Axis Range Indicator */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div
            className="flex items-center rounded-xs p-0.5"
            style={{ background: "var(--color-page)", border: "1px solid var(--color-line)" }}
          >
            {[
              { label: "1 week",  days: 5 },
              { label: "2 weeks", days: 10 },
              { label: "1 month", days: 22 },
              { label: "All",     days: "all" as const },
            ].map(({ label, days }) => {
              const isActive =
                days === "all"
                  ? startIdx <= 0 && endIdx >= dates.length - 1
                  : Math.abs(endIdx - startIdx - (days - 1)) <= 1;
              return (
                <button
                  key={label}
                  onClick={() => setPreset(days)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-xs transition-colors cursor-pointer"
                  style={{
                    background: isActive ? "var(--color-surface)" : "transparent",
                    color: isActive ? "var(--color-text)" : "var(--color-muted)",
                    boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
            {visibleDates[0]} → {visibleDates[visibleDates.length - 1]}
          </span>
        </div>
      </div>

      {/* Contract Legend with toggle & hover highlight */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {SYMBOLS.map((sym) => {
          const isEnabled = enabledSymbols.has(sym);
          const isHovered = hoveredSymbol === sym;
          return (
            <button
              key={sym}
              type="button"
              onClick={() => {
                setEnabledSymbols((prev) => {
                  const next = new Set(prev);
                  if (next.has(sym)) {
                    if (next.size > 1) next.delete(sym); // prevent toggling off all
                  } else {
                    next.add(sym);
                  }
                  return next;
                });
              }}
              onMouseEnter={() => setHoveredSymbol(sym)}
              onMouseLeave={() => setHoveredSymbol(null)}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-xs transition-opacity cursor-pointer"
              style={{
                opacity: isEnabled ? (hoveredSymbol && !isHovered ? 0.35 : 1) : 0.4,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: SYMBOL_COLORS[sym] }}
              />
              <span className="font-medium" style={{ color: "var(--color-text)" }}>
                {sym}
              </span>
              <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>
                ({SYMBOL_LABELS[sym]})
              </span>
            </button>
          );
        })}

        {/* Widest day indicator in legend */}
        {widestDay && (
          <span className="text-[11px] ml-auto flex items-center space-x-1" style={{ color: "var(--color-muted)" }}>
            <span
              className="w-2 h-2 inline-block rounded-xs"
              style={{ background: "var(--color-madder)", opacity: 0.8 }}
            />
            <span>
              Widest spread: <strong className="tabular-nums" style={{ color: "var(--color-text)" }}>+{widestDay.spreadBps.toFixed(1)} bps</strong> ({widestDay.date})
            </span>
          </span>
        )}
      </div>

      {/* Main Dual-Pane Chart SVG */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          ref={chartSvgRef}
          viewBox={`0 0 ${W} ${CHART_H}`}
          className="w-full h-auto cursor-crosshair touch-none"
          style={{ display: "block" }}
          onWheel={handleWheel}
          onPointerDown={handleChartPointerDown}
          onPointerMove={handleChartPointerMove}
          onPointerUp={handleChartPointerUp}
          onPointerLeave={() => {
            dragRef.current.isDragging = false;
            setHoverDateIndex(null);
          }}
          onDoubleClick={handleDoubleClick}
          onClick={() => {
            if (hoverDateIndex !== null && dates[hoverDateIndex]) {
              onSelectDate(dates[hoverDateIndex]);
            }
          }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={M.left} y={M.top - 4} width={W - M.left - M.right} height={CHART_H - M.top} />
            </clipPath>
          </defs>

          {/* ============================================================
              TOP PANE: Price (fine-gold INR/g)
              ============================================================ */}
          <g>
            {/* Top Pane Title & Unit */}
            <text
              x={M.left} y={M.top - 6}
              fontSize="10" fontFamily="var(--font-body)"
              fill="var(--color-muted)" fontWeight="600"
            >
              Price (INR/g fine gold)
            </text>

            {/* Price Y Gridlines & Labels */}
            {yPriceSc.ticks(4).map((val) => {
              const y = yPriceSc(val);
              return (
                <g key={`y-p-${val}`}>
                  <line
                    x1={M.left} y1={y} x2={W - M.right} y2={y}
                    stroke="var(--color-line)" strokeWidth="1"
                  />
                  <text
                    x={M.left - 6} y={y + 3}
                    textAnchor="end" fontSize="9"
                    fontFamily="var(--font-body)"
                    fill="var(--color-muted)" className="tabular-nums"
                  >
                    {val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Price Curves */}
            <g clipPath={`url(#${clipId})`}>
              {SYMBOLS.map((sym) => {
                if (!enabledSymbols.has(sym)) return null;
                const points = dailyData.map((d, idx) => ({ idx, price: d.prices[sym] }));
                const pathStr = makePriceLine(sym)(points) ?? "";
                const isHovered = hoveredSymbol === sym;
                const opacity = hoveredSymbol && !isHovered ? 0.25 : 1;
                const strokeW = isHovered ? 2.5 : 1.75;

                return (
                  <g key={`price-line-${sym}`} style={{ opacity, transition: "opacity 120ms ease" }}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={SYMBOL_COLORS[sym]}
                      strokeWidth={strokeW}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* Points markers when zoomed to <= 7 days */}
                    {visibleCount <= 7 && points.slice(Math.max(0, startIdx), endIdx + 1).map((pt) => {
                      if (pt.price === null) return null;
                      return (
                        <circle
                          key={`pt-${sym}-${pt.idx}`}
                          cx={xSc(pt.idx)}
                          cy={yPriceSc(pt.price)}
                          r="3"
                          fill={SYMBOL_COLORS[sym]}
                          stroke="var(--color-surface)"
                          strokeWidth="1.2"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* End-of-line collision-free price labels */}
            {priceEndLabels.map((lbl) => (
              <g key={`plbl-${lbl.sym}`}>
                <line
                  x1={W - M.right} y1={yPriceSc(lastPoint?.prices[lbl.sym] ?? 0)}
                  x2={W - M.right + 6} y2={lbl.y}
                  stroke="var(--color-line)" strokeWidth="0.75"
                />
                <text
                  x={W - M.right + 8} y={lbl.y + 3}
                  fontSize="9" fontFamily="var(--font-body)"
                  fill={lbl.color} fontWeight="600" className="tabular-nums"
                >
                  {lbl.valText}
                </text>
              </g>
            ))}
          </g>

          {/* ============================================================
              DIVIDER & X-AXIS TICKS (between panes)
              ============================================================ */}
          <g>
            <line
              x1={M.left} y1={M.top + PRICE_H + MID_GAP / 2}
              x2={W - M.right} y2={M.top + PRICE_H + MID_GAP / 2}
              stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 3"
            />
            {xTickIndices.map((idx) => {
              const x = xSc(idx);
              const dateStr = dates[idx];
              if (!dateStr) return null;
              return (
                <text
                  key={`xtick-${idx}`}
                  x={x} y={M.top + PRICE_H + MID_GAP / 2 - 4}
                  textAnchor="middle" fontSize="9"
                  fontFamily="var(--font-body)" fill="var(--color-muted)"
                  className="tabular-nums"
                >
                  {dateStr.slice(5)}
                </text>
              );
            })}
          </g>

          {/* ============================================================
              BOTTOM PANE: Deviation from Median (bps)
              ============================================================ */}
          <g>
            {/* Bottom Pane Title & Unit */}
            <text
              x={M.left} y={M.top + PRICE_H + MID_GAP - 6}
              fontSize="10" fontFamily="var(--font-body)"
              fill="var(--color-muted)" fontWeight="600"
            >
              Deviation from median (bps)
            </text>

            {/* Zero Baseline Line */}
            <line
              x1={M.left} y1={yDevSc(0)} x2={W - M.right} y2={yDevSc(0)}
              stroke="var(--color-text)" strokeOpacity="0.4" strokeWidth="1"
            />
            <text
              x={M.left - 6} y={yDevSc(0) + 3}
              textAnchor="end" fontSize="9"
              fontFamily="var(--font-body)" fill="var(--color-text)" fontWeight="600"
            >
              0 bps
            </text>

            {/* Deviation Y Gridlines & Labels */}
            {yDevSc.ticks(4).filter((v) => v !== 0).map((val) => {
              const y = yDevSc(val);
              return (
                <g key={`y-d-${val}`}>
                  <line
                    x1={M.left} y1={y} x2={W - M.right} y2={y}
                    stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 2"
                  />
                  <text
                    x={M.left - 6} y={y + 3}
                    textAnchor="end" fontSize="8"
                    fontFamily="var(--font-body)"
                    fill="var(--color-muted)" className="tabular-nums"
                  >
                    {val > 0 ? `+${val.toFixed(0)}` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Shaded Deviation Envelope & Curves */}
            <g clipPath={`url(#${clipId})`}>
              {/* Shaded envelope between min and max deviation */}
              <path
                d={devEnvelopeArea(dailyData.map((d, idx) => ({ ...d, idx }))) ?? ""}
                fill="var(--color-verdigris)"
                fillOpacity="0.14"
              />

              {/* Widest day annotation callout (hidden when zoomed very tight to avoid covering lines) */}
              {widestDay && (() => {
                const wIdx = dates.indexOf(widestDay.date);
                if (wIdx < startIdx || wIdx > endIdx) return null;
                // Hide when zoomed in to fewer than 5 days
                if (endIdx - startIdx < 5) return null;
                const wx = xSc(wIdx);
                const topY = M.top + PRICE_H + MID_GAP;
                const devData = dailyData[wIdx];
                const peakDev = devData?.maxDev ?? 0;
                const peakY = yDevSc(peakDev);
                return (
                  <g className="pointer-events-none">
                    <circle cx={wx} cy={peakY} r="3" fill="var(--color-madder)" />
                    <line
                      x1={wx} y1={peakY} x2={wx} y2={topY + 18}
                      stroke="var(--color-madder)" strokeWidth="1.2" strokeDasharray="2 3"
                    />
                    <rect
                      x={Math.max(M.left, wx - 48)}
                      y={topY + 2}
                      width="96"
                      height="16"
                      rx="2"
                      fill="var(--color-surface)"
                      stroke="var(--color-line)"
                    />
                    <text
                      x={Math.max(M.left + 48, wx)} y={topY + 13}
                      fontSize="8" fontFamily="monospace"
                      textAnchor="middle"
                      fill="var(--color-madder)" fontWeight="600"
                    >
                      WIDEST: +{widestDay.spreadBps.toFixed(1)} BPS
                    </text>
                  </g>
                );
              })()}

              {/* Contract Deviation Curves */}
              {SYMBOLS.map((sym) => {
                if (!enabledSymbols.has(sym)) return null;
                const points = dailyData.map((d, idx) => ({ idx, dev: d.deviations[sym] }));
                const pathStr = makeDevLine(sym)(points) ?? "";
                const isHovered = hoveredSymbol === sym;
                const opacity = hoveredSymbol && !isHovered ? 0.25 : 1;
                const strokeW = isHovered ? 2.5 : 1.75;

                return (
                  <g key={`dev-line-${sym}`} style={{ opacity, transition: "opacity 120ms ease" }}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={SYMBOL_COLORS[sym]}
                      strokeWidth={strokeW}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* Points markers when zoomed <= 7 days */}
                    {visibleCount <= 7 && points.slice(Math.max(0, startIdx), endIdx + 1).map((pt) => {
                      if (pt.dev === null) return null;
                      return (
                        <circle
                          key={`pt-dev-${sym}-${pt.idx}`}
                          cx={xSc(pt.idx)}
                          cy={yDevSc(pt.dev)}
                          r="3"
                          fill={SYMBOL_COLORS[sym]}
                          stroke="var(--color-surface)"
                          strokeWidth="1.2"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* End-of-line collision-free deviation labels */}
            {devEndLabels.map((lbl) => (
              <g key={`dlbl-${lbl.sym}`}>
                <line
                  x1={W - M.right} y1={yDevSc(lastPoint?.deviations[lbl.sym] ?? 0)}
                  x2={W - M.right + 6} y2={lbl.y}
                  stroke="var(--color-line)" strokeWidth="0.75"
                />
                <text
                  x={W - M.right + 8} y={lbl.y + 3}
                  fontSize="8" fontFamily="var(--font-body)"
                  fill={lbl.color} fontWeight="600" className="tabular-nums"
                >
                  {lbl.valText}
                </text>
              </g>
            ))}
          </g>

          {/* ============================================================
              SCRUBBER DATE MARKER (distinct line on the whole chart)
              ============================================================ */}
          {scrubberX !== null && scrubberX >= M.left && scrubberX <= W - M.right && (
            <g pointerEvents="none">
              <line
                x1={scrubberX} y1={M.top} x2={scrubberX} y2={M.top + PRICE_H + MID_GAP + DEV_H}
                stroke="var(--color-text)" strokeWidth="1.5" strokeDasharray="3 3"
                strokeOpacity="0.55"
              />
              <circle
                cx={scrubberX} cy={M.top} r="3"
                fill="var(--color-text)"
              />
            </g>
          )}

          {/* ============================================================
              HOVER CROSSHAIR (vertical cursor line)
              ============================================================ */}
          {hoverDateIndex !== null && (() => {
            const hx = xSc(hoverDateIndex);
            if (hx < M.left || hx > W - M.right) return null;
            return (
              <line
                x1={hx} y1={M.top} x2={hx} y2={M.top + PRICE_H + MID_GAP + DEV_H}
                stroke="var(--color-verdigris)" strokeWidth="1" strokeDasharray="2 2"
                pointerEvents="none"
              />
            );
          })()}
        </svg>

        {/* ============================================================
            HOVER TOOLTIP CARD (floating, sorted by price)
            ============================================================ */}
        {activeTooltipData && (
          <div
            className="p-3 rounded-xs text-xs space-y-2 pointer-events-none mt-2"
            style={{
              background: "var(--color-touchstone)",
              color: "var(--color-surface)",
              border: "1px solid var(--color-line)",
            }}
          >
            <div className="flex items-center justify-between pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="font-semibold">
                Date: <span className="tabular-nums">{activeTooltipData.date}</span>
                {activeTooltipData.date === selectedDate && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-xs" style={{ background: "var(--color-verdigris)", color: "#172220" }}>
                    Scrubber date
                  </span>
                )}
              </div>
              <div className="text-[11px] opacity-80 tabular-nums">
                Daily median: ₹{activeTooltipData.median ? activeTooltipData.median.toFixed(2) : "N/A"}/g · Spread: {activeTooltipData.spreadBps ? `${activeTooltipData.spreadBps.toFixed(1)} bps` : "N/A"}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {tooltipRows.map((r) => (
                <div
                  key={r.sym}
                  className="p-2 rounded-xs space-y-0.5"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center space-x-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.color }} />
                    <span>{r.sym}</span>
                  </div>
                  <div className="text-[11px] tabular-nums font-semibold">
                    {r.price !== null ? `₹${r.price.toFixed(2)}/g` : "No price"}
                  </div>
                  <div className="text-[10px] flex items-center justify-between opacity-85">
                    <span className="tabular-nums">
                      {r.dev !== null ? `${r.dev >= 0 ? "+" : ""}${r.dev.toFixed(1)} bps` : "N/A"}
                    </span>
                    <span className="font-medium text-[9px] px-1 rounded-xs" style={{ background: "rgba(255,255,255,0.15)" }}>
                      {r.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[10px] opacity-60 text-right">
              Click to select date as page scrubber
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          OVERVIEW STRIP (MINIMAP & BRUSH)
          ============================================================ */}
      <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
        <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-muted)" }}>
          <span>Overview strip (drag window or handles to zoom & pan)</span>
          <span className="tabular-nums">{dates[0]} → {dates[dates.length - 1]}</span>
        </div>

        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${W} ${MINIMAP_H}`}
            className="w-full h-auto cursor-pointer"
            style={{ display: "block" }}
            onClick={handleMinimapClick}
            onPointerMove={handleBrushMove}
            onPointerUp={handleBrushUp}
          >
            {/* Background base */}
            <rect
              x={MINIMAP_M.left} y={MINIMAP_M.top}
              width={W - MINIMAP_M.left - MINIMAP_M.right}
              height={MINIMAP_H - MINIMAP_M.top - MINIMAP_M.bottom}
              fill="var(--color-page)" fillOpacity="0.4"
            />

            {/* Minimap median trace */}
            <path
              d={minimapLine(dailyData.map((d, idx) => ({ ...d, idx }))) ?? ""}
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="1.2"
              strokeOpacity="0.6"
            />

            {/* Draggable brush window */}
            {(() => {
              const brushX = minimapXSc(startIdx);
              const brushEnd = minimapXSc(endIdx);
              const brushW = Math.max(8, brushEnd - brushX);
              const brushY = MINIMAP_M.top;
              const brushH = MINIMAP_H - MINIMAP_M.top - MINIMAP_M.bottom;

              return (
                <g>
                  {/* Dimmed outside areas */}
                  <rect
                    x={MINIMAP_M.left} y={brushY}
                    width={Math.max(0, brushX - MINIMAP_M.left)} height={brushH}
                    fill="var(--color-touchstone)" fillOpacity="0.12"
                  />
                  <rect
                    x={brushEnd} y={brushY}
                    width={Math.max(0, W - MINIMAP_M.right - brushEnd)} height={brushH}
                    fill="var(--color-touchstone)" fillOpacity="0.12"
                  />

                  {/* Window body */}
                  <rect
                    x={brushX} y={brushY}
                    width={brushW} height={brushH}
                    rx="1"
                    fill="var(--color-verdigris)" fillOpacity="0.12"
                    stroke="var(--color-verdigris)" strokeWidth="1.5"
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => handleBrushDown("window", e)}
                  />

                  {/* Left handle */}
                  <rect
                    x={brushX - 3} y={brushY - 2}
                    width={6} height={brushH + 4}
                    rx="2"
                    fill="var(--color-text)"
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(e) => handleBrushDown("left", e)}
                  />

                  {/* Right handle */}
                  <rect
                    x={brushEnd - 3} y={brushY - 2}
                    width={6} height={brushH + 4}
                    rx="2"
                    fill="var(--color-text)"
                    style={{ cursor: "ew-resize" }}
                    onPointerDown={(e) => handleBrushDown("right", e)}
                  />
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Screen Reader live announcement */}
      <div className="sr-only" aria-live="polite">
        Agreement band displaying {visibleCount} trading days from {visibleDates[0]} to {visibleDates[visibleDates.length - 1]}.
        Top price pane spans ₹{yPriceSc.domain()[0].toFixed(0)} to ₹{yPriceSc.domain()[1].toFixed(0)} per gram.
        Bottom deviation pane spans {yDevSc.domain()[0].toFixed(1)} to {yDevSc.domain()[1].toFixed(1)} basis points.
      </div>
    </div>
  );
}
