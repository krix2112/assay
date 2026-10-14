"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getTrackRecord,
  getTrackRecordVerify,
  TrackRecordEntry,
  TrackRecordVerify,
  IS_DEMO_MODE,
} from "@/lib/api";
import { ApiErrorState } from "@/components/api-error-state";

export default function TrackRecordPage() {
  const [selectedEntry, setSelectedEntry] = useState<TrackRecordEntry | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<TrackRecordVerify | null>(null);

  // Fetch chain entries
  const {
    data: entries = [],
    isLoading: isEntriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useQuery<TrackRecordEntry[]>({
    queryKey: ["track-record"],
    queryFn: () => getTrackRecord(100),
  });

  // Verification status query
  const {
    data: initialVerify,
    error: verifyError,
    refetch: refetchVerify,
  } = useQuery<TrackRecordVerify>({
    queryKey: ["track-record-verify"],
    queryFn: () => getTrackRecordVerify(),
  });

  if (entriesError && !IS_DEMO_MODE) {
    return (
      <ApiErrorState
        title="Cannot reach the Assay API. Is it running?"
        onRetry={() => {
          refetchEntries();
          refetchVerify();
        }}
      />
    );
  }

  const activeVerify = verifyStatus || initialVerify;
  const isChainOk = activeVerify ? activeVerify.ok : true;
  const latestEntry = entries[entries.length - 1];

  const handleVerifyClick = async () => {
    setIsVerifying(true);
    try {
      const res = await getTrackRecordVerify();
      setVerifyStatus(res);
    } catch {
      setVerifyStatus({ ok: false, entries: entries.length, first_broken: null });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-8 py-4 sm:py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
                color: "var(--color-verdigris)",
                border: "1px solid var(--color-verdigris)",
              }}
            >
              STAGE S6 CRYPTOGRAPHIC LEDGER
            </span>
            <Link
              href="/method"
              className="text-[11px] font-semibold uppercase tracking-wider underline hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              Immutability methodology
            </Link>
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            Cryptographic Track Record Chain
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            SHA-256 state chain mathematically binding each session&apos;s accepted inputs, derived spreads, and antecedent block hash.
          </p>
        </div>

        {/* Verify Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleVerifyClick}
            disabled={isVerifying}
            className="px-4 py-2 text-xs font-semibold rounded-xs transition-opacity hover:opacity-90 focus-visible:outline-2 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            style={{
              background: "var(--color-text)",
              color: "var(--color-page)",
            }}
          >
            <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs"
              style={{
                background: isChainOk
                  ? "color-mix(in srgb, var(--color-verdigris) 20%, transparent)"
                  : "color-mix(in srgb, var(--color-madder) 20%, transparent)",
                color: isChainOk ? "var(--color-verdigris)" : "var(--color-madder)",
              }}
            >
              {isChainOk ? "VALID" : "BROKEN"}
            </span>
          </button>
        </div>
      </div>

      {/* Touchstone Slab Hero */}
      <section
        aria-label="Track Record Slab"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-track" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-track)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                SHA-256 Ledger State
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {isChainOk ? "Chain Intact: Genesis to Latest" : "Integrity Warning: Broken Hash Link"}
              </h2>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Total entries verified: <strong className="text-white">{activeVerify?.entries || entries.length} blocks</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block font-sans" style={{ color: "rgba(255,255,255,0.65)" }}>
                Latest Block Date
              </span>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                {latestEntry?.trade_date || "2026-10-09"}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block font-sans" style={{ color: "rgba(255,255,255,0.65)" }}>
                Latest Hash Digest
              </span>
              <div className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs" title={latestEntry?.hash}>
                {latestEntry?.hash ? `${latestEntry.hash.slice(0, 16)}...${latestEntry.hash.slice(-8)}` : "—"}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block font-sans" style={{ color: "rgba(255,255,255,0.65)" }}>
                Verification Outcome
              </span>
              <div className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: isChainOk ? "var(--color-verdigris)" : "var(--color-madder)" }}>
                {isChainOk ? "0 BROKEN LINKS" : `BROKEN AT #${activeVerify?.first_broken ?? 0}`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Scope and Trust Boundaries Note */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="space-y-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
            style={{
              background: "color-mix(in srgb, var(--color-verdigris) 15%, transparent)",
              color: "var(--color-verdigris)",
              border: "1px solid var(--color-verdigris)",
            }}
          >
            CRYPTOGRAPHIC EVIDENCE BOUNDARIES
          </span>
          <h3 className="font-display text-lg font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
            What the Hash Chain Does and Does Not Prove
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <strong className="block font-semibold text-sm" style={{ color: "var(--color-verdigris)" }}>
              What this chain proves
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              The mathematical sequence, exact byte representation, and tamper-detection of state from genesis.
              Any retrospective modification of historical prices, trade logs, or summary scores alters subsequent SHA-256 digests and immediately invalidates the chain.
            </p>
          </div>

          <div className="p-4 rounded-xs border space-y-2" style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}>
            <strong className="block font-semibold text-sm" style={{ color: "var(--color-madder)" }}>
              What this chain does not prove
            </strong>
            <p style={{ color: "var(--color-muted)" }}>
              The external economic truth or executable validity of the exchange price inputs.
              A cryptographically valid chain certifies that published calculations were computed strictly from recorded inputs without post-hoc manipulation, but does not guarantee exchange bhavcopy quotes match live fills.
            </p>
          </div>
        </div>

        {/* Database owner boundary callout per User Correction #4 */}
        <div
          className="p-4 rounded-xs border space-y-1 text-xs leading-relaxed"
          style={{
            background: "color-mix(in srgb, var(--color-gold-m) 8%, var(--color-surface))",
            borderColor: "var(--color-gold-m)",
          }}
        >
          <div className="font-semibold text-[11px] uppercase tracking-wider text-[#B98A2F]">
            CRITICAL DATABASE OWNER LIMITATION
          </div>
          <p className="font-medium" style={{ color: "var(--color-text)" }}>
            A database owner could remove the append-only trigger. The hash chain is only strong evidence if a copy of the latest hash is kept somewhere outside the database.
          </p>
          <p style={{ color: "var(--color-muted)" }}>
            External publication of daily SHA-256 heads to immutable third-party timestamping systems creates a non-repudiable audit anchor that even root administrators cannot forge retrospectively.
          </p>
        </div>
      </section>

      {/* Chain Ledger Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Historical Chain Ledger
            </h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              All daily sealed blocks arranged chronologically from genesis.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums" style={{ color: "var(--color-muted)" }}>
            {entries.length} entries recorded
          </span>
        </div>

        <div
          className="w-full overflow-x-auto rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr
                className="border-b font-sans select-none"
                style={{
                  borderColor: "var(--color-line)",
                  background: "color-mix(in srgb, var(--color-surface) 90%, var(--color-page))",
                  color: "var(--color-muted)",
                }}
              >
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Block ID</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Trade Date</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Revision</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Previous Hash</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Current Hash</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold">Created At (UTC)</th>
                <th scope="col" className="px-4 py-3 uppercase tracking-wider text-[11px] font-semibold text-right">Payload</th>
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-sans text-xs" style={{ color: "var(--color-muted)" }}>
                    {isEntriesLoading ? "Loading track record chain..." : "No track record blocks found."}
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isGenesis = !e.prev_hash;
                  return (
                    <tr
                      key={e.id}
                      className="transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-2.5 font-bold tabular-nums">#{e.id}</td>
                      <td className="px-4 py-2.5 font-sans font-semibold">{e.trade_date}</td>
                      <td className="px-4 py-2.5 tabular-nums">rev {e.revision}</td>
                      <td className="px-4 py-2.5 tabular-nums text-xs" style={{ color: "var(--color-muted)" }}>
                        {isGenesis ? (
                          <span className="font-sans italic">Genesis (null)</span>
                        ) : (
                          `${e.prev_hash!.slice(0, 10)}...`
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold" style={{ color: "var(--color-verdigris)" }}>
                        {e.hash.slice(0, 12)}...
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs" style={{ color: "var(--color-muted)" }}>
                        {e.created_at.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(e)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-xs border hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-2 cursor-pointer"
                          style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
                        >
                          Inspect JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* JSON Inspection Modal */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--color-line)" }}>
              <div>
                <h4 className="font-display font-bold text-sm" style={{ color: "var(--color-text)" }}>
                  Canonical JSON Block #{selectedEntry.id} ({selectedEntry.trade_date})
                </h4>
                <div className="text-[11px] font-mono text-muted">
                  SHA-256: {selectedEntry.hash}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="px-2.5 py-1 text-xs font-semibold rounded-xs border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}
              >
                Close
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <pre
                className="p-3 rounded-xs font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed"
                style={{ background: "var(--color-page)", color: "var(--color-text)" }}
              >
                {selectedEntry.canonical_json || JSON.stringify(selectedEntry.record, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
