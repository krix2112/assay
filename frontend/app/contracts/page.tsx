"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getParityHistory,
  getContractsByDate,
  ContractDayItem,
  ParityResponse,
  IS_DEMO_MODE,
} from "@/lib/api";
import { ApiErrorState } from "@/components/api-error-state";
import { EmptyDataState } from "@/components/empty-data-state";

// Column tooltip definitions — exactly one plain sentence per column
const COLUMN_TOOLTIPS: Record<string, string> = {
  symbol: "The standardized MCX gold futures contract trading identifier.",
  expiry_date: "The exact calendar date on which this futures contract terminates.",
  close: "Official exchange settlement close price published by MCX in Indian Rupees.",
  price_per_gram: "Quoted close price divided by the contract physical lot size in grams.",
  fine_gold_price_per_gram: "Quoted price mathematically converted to one gram of 999 fine gold.",
  volume_ratio: "Daily trading volume divided by the contract's 20-day rolling baseline.",
  oi_ratio: "Daily open interest divided by the contract's 20-day rolling baseline.",
  days_to_expiry: "Number of calendar days remaining until the contract expires.",
  label: "Liquidity confidence classification assigned by Assay's rules engine.",
};

type SortKey =
  | "symbol"
  | "expiry_date"
  | "close"
  | "price_per_gram"
  | "fine_gold_price_per_gram"
  | "volume_ratio"
  | "oi_ratio"
  | "days_to_expiry"
  | "label";

const LIQUIDITY_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  High: {
    bg: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
    text: "var(--color-verdigris)",
    border: "var(--color-verdigris)",
  },
  Medium: {
    bg: "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
    text: "var(--color-gold-m)",
    border: "var(--color-gold-m)",
  },
  Low: {
    bg: "color-mix(in srgb, var(--color-madder) 15%, transparent)",
    text: "var(--color-madder)",
    border: "var(--color-madder)",
  },
  Untradeable: {
    bg: "color-mix(in srgb, var(--color-muted) 20%, transparent)",
    text: "var(--color-muted)",
    border: "var(--color-line)",
  },
};

/**
 * Small distribution bar component for normalized ratios.
 * Baseline is 1.0 (midpoint). Max is capped at 2.5 for visualization.
 */
function RatioDistributionBar({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  if (value == null || !isFinite(value)) {
    return <span className="text-xs" style={{ color: "var(--color-muted)" }}>—</span>;
  }

  const cappedVal = Math.min(2.5, Math.max(0, value));
  const pct = (cappedVal / 2.5) * 100;
  const isHigh = value >= 1.0;

  return (
    <div className="flex items-center gap-2" title={`${label}: ${value.toFixed(2)}x baseline`}>
      <span className="font-mono text-xs tabular-nums w-10 text-right">
        {value.toFixed(2)}x
      </span>
      <div
        className="relative w-16 h-2 rounded-xs overflow-hidden shrink-0"
        style={{ background: "color-mix(in srgb, var(--color-line) 40%, transparent)" }}
      >
        {/* Baseline mark at 1.0 = (1.0 / 2.5) * 100 = 40% */}
        <div
          className="absolute top-0 bottom-0 w-px z-10"
          style={{ left: "40%", background: "var(--color-text)", opacity: 0.3 }}
        />
        <div
          className="h-full rounded-xs transition-all"
          style={{
            width: `${pct}%`,
            background: isHigh ? "var(--color-verdigris)" : "var(--color-gold-m)",
          }}
        />
      </div>
    </div>
  );
}

export default function ContractsPage() {
  // Query parity history to obtain all available dates
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<ParityResponse[]>({
    queryKey: ["parity-history"],
    queryFn: () => getParityHistory(),
  });

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("expiry_date");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Auto-select latest trade date on initial mount
  useEffect(() => {
    if (history && history.length > 0 && !selectedDate) {
      setSelectedDate(history[history.length - 1].trade_date);
    }
  }, [history, selectedDate]);

  // Query contracts for active selected date
  const {
    data: contracts = [],
    isLoading: isContractsLoading,
    error: contractsError,
    refetch: refetchContracts,
  } = useQuery<ContractDayItem[]>({
    queryKey: ["contracts-by-date", selectedDate],
    queryFn: () => getContractsByDate(selectedDate),
    enabled: Boolean(selectedDate),
  });

  // Dates list from history
  const datesList = useMemo(() => {
    return history ? history.map((h) => h.trade_date) : [];
  }, [history]);

  // Summary statistics for Touchstone slab
  const stats = useMemo(() => {
    if (!contracts || contracts.length === 0) {
      return { totalVolume: 0, totalOi: 0, medianFinePrice: 0, activeCount: 0 };
    }
    const totalVolume = contracts.reduce((acc, c) => acc + (c.volume || 0), 0);
    const totalOi = contracts.reduce((acc, c) => acc + (c.open_interest || 0), 0);
    const finePrices = contracts
      .map((c) => (c.fine_gold_price_per_gram ? Number(c.fine_gold_price_per_gram) : null))
      .filter((p): p is number => p !== null && p > 0)
      .sort((a, b) => a - b);
    let medianFinePrice = 0;
    if (finePrices.length > 0) {
      const mid = Math.floor(finePrices.length / 2);
      medianFinePrice =
        finePrices.length % 2 !== 0
          ? finePrices[mid]
          : (finePrices[mid - 1] + finePrices[mid]) / 2;
    }
    return {
      totalVolume,
      totalOi,
      medianFinePrice,
      activeCount: contracts.length,
    };
  }, [contracts]);

  // Sorted contracts: strictly one row per contract expiry
  const sortedContracts = useMemo(() => {
    return [...contracts].sort((a, b) => {
      let vA: any = a[sortKey];
      let vB: any = b[sortKey];

      if (
        sortKey === "close" ||
        sortKey === "price_per_gram" ||
        sortKey === "fine_gold_price_per_gram" ||
        sortKey === "volume_ratio" ||
        sortKey === "oi_ratio" ||
        sortKey === "days_to_expiry"
      ) {
        vA = vA != null ? Number(vA) : -Infinity;
        vB = vB != null ? Number(vB) : -Infinity;
      } else {
        vA = String(vA ?? "");
        vB = String(vB ?? "");
      }

      if (vA < vB) return sortAsc ? -1 : 1;
      if (vA > vB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [contracts, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  // Handle explicit API error
  if (historyError || (contractsError && !IS_DEMO_MODE)) {
    return (
      <ApiErrorState
        title="Cannot reach the Assay API. Is it running?"
        onRetry={() => {
          refetchHistory();
          refetchContracts();
        }}
      />
    );
  }

  // Handle empty database
  if (!isHistoryLoading && (!history || history.length === 0)) {
    return <EmptyDataState />;
  }

  return (
    <div className="space-y-8 py-4 sm:py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-tag-verdigris) 12%, transparent)",
                color: "var(--color-tag-verdigris)",
                border: "1px solid var(--color-tag-verdigris)",
              }}
            >
              CONTRACT SPECIFICATIONS & NORMALIZATION
            </span>
            <Link
              href="/method"
              className="text-[11px] font-semibold uppercase tracking-wider underline hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              Methodology note
            </Link>
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            MCX Gold Futures Contracts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Normalized per-gram conversion and liquidity indicators for every active contract expiry.
          </p>
        </div>

        {/* Date Selector */}
        {datesList.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="contracts-date-select" className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Trade Date:
            </label>
            <select
              id="contracts-date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded-xs border transition-colors cursor-pointer"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              {datesList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Touchstone Slab Hero */}
      <section
        aria-label="Contract Summary Slab"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        {/* Stone grain texture */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-contracts" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-contracts)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                Touchstone Basket Overview
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Session of {selectedDate || "—"}
              </h2>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Quotation basis: Official settlement prices · <Link href="/method" className="underline hover:text-white">Unverified assumption</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Median Fine Gold
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {stats.medianFinePrice > 0 ? `INR ${stats.medianFinePrice.toFixed(2)}` : "—"}
                <span className="text-xs font-normal text-white/60 ml-1">/g</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Active Expiries
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {stats.activeCount}
                <span className="text-xs font-normal text-white/60 ml-1">contracts</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Session Volume
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {stats.totalVolume.toLocaleString()}
                <span className="text-xs font-normal text-white/60 ml-1">lots</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Open Interest
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {stats.totalOi.toLocaleString()}
                <span className="text-xs font-normal text-white/60 ml-1">lots</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contracts Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Individual Contract Days
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Each row isolates an exact contract and expiry. Expiries are never blended into one row.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums" style={{ color: "var(--color-muted)" }}>
            {sortedContracts.length} rows
          </span>
        </div>

        <div
          className="w-full overflow-x-auto rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b font-medium select-none"
                style={{
                  borderColor: "var(--color-line)",
                  background: "color-mix(in srgb, var(--color-surface) 90%, var(--color-page))",
                }}
              >
                {[
                  { key: "symbol", label: "Symbol" },
                  { key: "expiry_date", label: "Expiry" },
                  { key: "close", label: "Close (INR)" },
                  { key: "price_per_gram", label: "Price / g" },
                  { key: "fine_gold_price_per_gram", label: "Fine Gold / g" },
                  { key: "volume_ratio", label: "Volume Ratio" },
                  { key: "oi_ratio", label: "OI Ratio" },
                  { key: "days_to_expiry", label: "DTE" },
                  { key: "label", label: "Liquidity" },
                ].map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      title={COLUMN_TOOLTIPS[col.key]}
                      onClick={() => handleSort(col.key as SortKey)}
                      className="px-3.5 py-3 cursor-pointer transition-colors hover:text-text"
                      style={{ color: isSorted ? "var(--color-text)" : "var(--color-muted)" }}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-[11px] focus-visible:outline-2"
                        aria-label={`Sort by ${col.label}. ${COLUMN_TOOLTIPS[col.key]}`}
                      >
                        <span>{col.label}</span>
                        <span className="font-mono text-[10px]">
                          {isSorted ? (sortAsc ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                    {isContractsLoading ? "Loading contract records..." : "No contracts found for selected date."}
                  </td>
                </tr>
              ) : (
                sortedContracts.map((c) => {
                  const badge = LIQUIDITY_BADGES[c.label || "Untradeable"] || LIQUIDITY_BADGES.Untradeable;
                  const closeNum = Number(c.close);
                  const ppgNum = c.price_per_gram ? Number(c.price_per_gram) : null;
                  const fppgNum = c.fine_gold_price_per_gram ? Number(c.fine_gold_price_per_gram) : null;
                  const volRatio = c.volume_ratio != null ? Number(c.volume_ratio) : null;
                  const oiRatio = c.oi_ratio != null ? Number(c.oi_ratio) : null;

                  return (
                    <tr
                      key={`${c.symbol}-${c.expiry_date}`}
                      className="transition-colors hover:bg-black/5 dark:hover:bg-white/5 font-mono"
                      style={{ color: "var(--color-text)" }}
                    >
                      {/* Symbol */}
                      <td className="px-3.5 py-2.5 font-bold font-sans">
                        {c.symbol}
                      </td>

                      {/* Expiry */}
                      <td className="px-3.5 py-2.5 tabular-nums">
                        {c.expiry_date}
                      </td>

                      {/* Close */}
                      <td className="px-3.5 py-2.5 tabular-nums font-semibold">
                        {closeNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Price per gram */}
                      <td className="px-3.5 py-2.5 tabular-nums" style={{ color: "var(--color-muted)" }}>
                        {ppgNum != null ? ppgNum.toFixed(2) : "—"}
                      </td>

                      {/* Fine gold price per gram */}
                      <td className="px-3.5 py-2.5 tabular-nums font-semibold" style={{ color: "var(--color-gold-m)" }}>
                        {fppgNum != null ? fppgNum.toFixed(2) : "—"}
                      </td>

                      {/* Volume Ratio with Distribution Bar */}
                      <td className="px-3.5 py-2.5">
                        <RatioDistributionBar value={volRatio} label="Volume Ratio" />
                      </td>

                      {/* OI Ratio with Distribution Bar */}
                      <td className="px-3.5 py-2.5">
                        <RatioDistributionBar value={oiRatio} label="Open Interest Ratio" />
                      </td>

                      {/* Days to Expiry */}
                      <td className="px-3.5 py-2.5 tabular-nums">
                        {c.days_to_expiry}d
                      </td>

                      {/* Liquidity Label + Reason Tooltip */}
                      <td className="px-3.5 py-2.5 font-sans">
                        <span
                          title={c.reason || `Scored ${c.label}`}
                          className="inline-block px-2 py-0.5 rounded-xs text-[11px] font-semibold border cursor-help"
                          style={{
                            background: badge.bg,
                            color: badge.text,
                            borderColor: badge.border,
                          }}
                        >
                          {c.label || "Untradeable"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
