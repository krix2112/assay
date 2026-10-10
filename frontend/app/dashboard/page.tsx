"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  getAllContracts,
  getAllSpreads,
  getContractsByDate,
  getParityHistory,
  getSpreadsByDate,
  getTrackRecordVerify,
  ContractDayItem,
  SpreadItem,
} from "@/lib/api";
import { TRANSITION, DURATION } from "@/lib/motion";
import { CrosshairProvider } from "@/lib/crosshair";
import { TimeScrubber }      from "@/components/time-scrubber";
import { Touchstone }         from "@/components/touchstone";
import { HallmarkStamp }      from "@/components/hallmark-stamp";
import { DailyBriefSection }  from "@/components/daily-brief-section";
import { ExecutiveSummary }   from "@/components/executive-summary";
import { ParityHistoryChart } from "@/components/parity-history-chart";
import { SpreadHeatmap }      from "@/components/spread-heatmap";
import { TermStructure }      from "@/components/term-structure";
import { DataTrustStrip }     from "@/components/data-trust-strip";
import { AgreementBand }      from "@/components/agreement-band";
import { PairStrips }         from "@/components/pair-strips";
import { LiquidityRibbon }    from "@/components/liquidity-ribbon";
import { BacktestPanel }      from "@/components/backtest-panel";

/** Wraps sections that animate their content when the date changes */
function DateAnimated({
  selectedDate,
  children,
}: {
  selectedDate: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={selectedDate}
        initial={{ opacity: 0.6, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.6, y: -4 }}
        transition={TRANSITION.base}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Parity history (all dates)
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery({
    queryKey: ["parity-history"],
    queryFn: () => getParityHistory(),
  });

  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (history && history.length > 0 && !selectedDate) {
      setSelectedDate(history[history.length - 1].trade_date);
    }
  }, [history, selectedDate]);

  const currentParity = useMemo(() => {
    if (!history) return null;
    return history.find((h) => h.trade_date === selectedDate) || null;
  }, [history, selectedDate]);

  const { previousDate, tradingDates } = useMemo(() => {
    if (!history) return { previousDate: null, tradingDates: [] };
    const dates = history.map((h) => h.trade_date);
    const idx = dates.indexOf(selectedDate);
    return { previousDate: idx > 0 ? dates[idx - 1] : null, tradingDates: dates };
  }, [history, selectedDate]);

  // Multi-day datasets for heatmap, agreement band, liquidity ribbon, and pair strips
  const {
    data: spreadsByDateMap = {},
    isLoading: isSpreadsLoading,
    error: spreadsError,
    refetch: refetchSpreads,
  } = useQuery({
    queryKey: ["all-spreads", tradingDates],
    queryFn: () => getAllSpreads(tradingDates),
    enabled: tradingDates.length > 0,
  });

  const {
    data: contractsByDateMap = {},
    isLoading: isContractsLoading,
    error: contractsError,
    refetch: refetchContracts,
  } = useQuery({
    queryKey: ["all-contracts", tradingDates],
    queryFn: () => getAllContracts(tradingDates),
    enabled: tradingDates.length > 0,
  });

  // Active day contracts and spreads derived directly from full datasets
  const contracts = useMemo(() => {
    return contractsByDateMap[selectedDate] || [];
  }, [contractsByDateMap, selectedDate]);

  const previousContracts = useMemo(() => {
    return previousDate ? contractsByDateMap[previousDate] || [] : [];
  }, [contractsByDateMap, previousDate]);

  const spreads = useMemo(() => {
    return spreadsByDateMap[selectedDate] || [];
  }, [spreadsByDateMap, selectedDate]);

  // Verification status
  const { data: verifyResult } = useQuery({
    queryKey: ["track-record-verify"],
    queryFn: () => getTrackRecordVerify(),
  });

  // Error state
  if (historyError) {
    return (
      <div className="max-w-2xl py-12 space-y-4">
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-madder)" }}>
          Unable to load Assay data
        </h1>
        <div
          className="p-5 rounded-xl space-y-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-madder)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text)" }}>
            Failed to connect to the Assay backend API at{" "}
            <code className="px-1.5 py-0.5 rounded-xs text-xs" style={{ background: "var(--color-page)" }}>
              {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
            </code>
            .
          </p>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Ensure the FastAPI server is running, or set{" "}
            <code>NEXT_PUBLIC_DEMO=true</code> to use sample data.
          </p>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (isHistoryLoading || !selectedDate) {
    return (
      <div className="space-y-6 max-w-5xl animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-xs" style={{ background: "var(--color-surface)" }} />
          <div className="h-4 w-96 rounded-xs" style={{ background: "var(--color-surface)" }} />
        </div>
        <div className="h-16 w-full rounded-xl" style={{ background: "var(--color-surface)" }} />
        <div className="h-64 w-full rounded-xl" style={{ background: "var(--color-surface)" }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-56 rounded-xl" style={{ background: "var(--color-surface)" }} />
          <div className="lg:col-span-2 h-56 rounded-xl" style={{ background: "var(--color-surface)" }} />
        </div>
      </div>
    );
  }

  return (
    <CrosshairProvider>
      <div className="space-y-7 max-w-5xl">
        {/* Page header */}
        <header
          className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
              Dashboard{" "}
              <span className="font-normal" style={{ color: "var(--color-muted)" }}>
                · {selectedDate}
              </span>
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed max-w-[75ch]" style={{ color: "var(--color-muted)" }}>
              How closely the four MCX gold contracts agree today, adjusted for size and purity.
            </p>
          </div>

          {/* Date selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <label htmlFor="date-select" className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Date:
            </label>
            <select
              id="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-xs tabular-nums"
              style={{
                background: "var(--color-surface)",
                color:      "var(--color-text)",
                border:     "1px solid var(--color-line)",
              }}
            >
              {tradingDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Executive summary — always above scrubber */}
        <DateAnimated selectedDate={selectedDate}>
          <ExecutiveSummary
            history={history ?? []}
            currentParity={currentParity}
            spreads={spreads}
            selectedDate={selectedDate}
            verifyOk={verifyResult?.ok ?? true}
          />
        </DateAnimated>

        {/* Time Scrubber */}
        {history && history.length > 0 && (
          <TimeScrubber
            history={history}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {/* The Touchstone */}
        <DateAnimated selectedDate={selectedDate}>
          <Touchstone contracts={contracts} selectedDate={selectedDate} />
        </DateAnimated>

        {/* Hallmark Stamp + Daily Brief — equal-height row */}
        <DateAnimated selectedDate={selectedDate}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <HallmarkStamp parity={currentParity} />
            <div className="lg:col-span-2 flex flex-col">
              <DailyBriefSection
                parity={currentParity}
                spreads={spreads}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </DateAnimated>

        {/* Error notification if multi-day fetch fails */}
        {(spreadsError || contractsError) && (
          <div
            role="alert"
            className="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-madder)" }}
          >
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-madder)" }}>
                Failed to load market datasets
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                {((spreadsError || contractsError) as Error)?.message || "A network error occurred while retrieving dates."}
              </div>
            </div>
            <button
              onClick={() => {
                refetchSpreads();
                refetchContracts();
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xs self-start sm:self-auto cursor-pointer"
              style={{
                background: "var(--color-page)",
                border: "1px solid var(--color-line)",
                color: "var(--color-text)",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Agreement Band */}
        <AgreementBand
          contractsByDate={contractsByDateMap}
          dates={tradingDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          isLoading={isContractsLoading}
        />

        {/* Spread Heatmap */}
        <SpreadHeatmap
          spreadsByDate={spreadsByDateMap}
          dates={tradingDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          isLoading={isSpreadsLoading}
        />

        {/* Parity History */}
        {history && history.length > 0 && (
          <ParityHistoryChart
            history={history}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {/* Pair Strips */}
        <PairStrips
          spreadsByDate={spreadsByDateMap}
          dates={tradingDates}
          selectedDate={selectedDate}
          isLoading={isSpreadsLoading}
        />

        {/* Liquidity Ribbon */}
        <LiquidityRibbon
          contractsByDate={contractsByDateMap}
          dates={tradingDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          isLoading={isContractsLoading}
        />

        {/* Term Structure */}
        <DateAnimated selectedDate={selectedDate}>
          <TermStructure
            currentContracts={contracts}
            previousContracts={previousContracts}
            selectedDate={selectedDate}
          />
        </DateAnimated>

        {/* Backtest Verdict */}
        <BacktestPanel />

        {/* Data Trust Strip */}
        <DataTrustStrip
          dates={tradingDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          verifyResult={verifyResult || null}
        />
      </div>
    </CrosshairProvider>
  );
}
