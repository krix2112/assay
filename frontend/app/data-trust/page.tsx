"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getDataQualitySummary, DataQualitySummary, IS_DEMO_MODE } from "@/lib/api";
import { VALIDATION_RULES, ValidationRuleDefinition } from "@/lib/validation-rules";
import { ApiErrorState } from "@/components/api-error-state";
import { EmptyDataState } from "@/components/empty-data-state";

export default function DataTrustPage() {
  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery<DataQualitySummary>({
    queryKey: ["data-quality-summary"],
    queryFn: () => getDataQualitySummary(),
  });

  // Group validation rules into the three architectural tiers
  const fileRules = useMemo(
    () => VALIDATION_RULES.filter((r) => r.category === "file"),
    []
  );
  const rowRules = useMemo(
    () => VALIDATION_RULES.filter((r) => r.category === "row"),
    []
  );
  const conflictRules = useMemo(
    () => VALIDATION_RULES.filter((r) => r.category === "conflict"),
    []
  );

  if (error && !IS_DEMO_MODE) {
    return (
      <ApiErrorState
        title="Cannot reach the Assay API. Is it running?"
        onRetry={() => refetch()}
      />
    );
  }

  // Pre-calculate totals for first-paint rendering (no mock numbers outside demo mode)
  const rowsAccepted = summary?.rows_accepted ?? 0;
  const rowsQuarantined = summary?.rows_quarantined ?? 0;
  const totalRows = rowsAccepted + rowsQuarantined;
  const acceptedPct = totalRows > 0 ? (rowsAccepted / totalRows) * 100 : 0;

  const filesByStatus = summary?.files_by_status ?? {};
  const issuesByCheck = summary?.issues_by_check ?? [];
  const anomalousDates = summary?.anomalous_dates ?? [];
  const contractCoverage = summary?.contract_coverage ?? [];

  // Handle empty database
  const isEmpty =
    !isLoading &&
    (!summary ||
      (rowsAccepted === 0 &&
        rowsQuarantined === 0 &&
        Object.keys(filesByStatus).length === 0 &&
        contractCoverage.length === 0));

  if (isEmpty) {
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
              STAGE S3 & S4 AUDIT SCORECARD
            </span>
            <Link
              href="/method"
              className="text-[11px] font-semibold uppercase tracking-wider underline hover:opacity-80"
              style={{ color: "var(--color-muted)" }}
            >
              Verification pipeline
            </Link>
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1"
            style={{ color: "var(--color-text)" }}
          >
            Data Trust & Ingestion Scorecard
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            Deterministic ingestion tracking, quarantine partitions, and per-contract temporal coverage.
          </p>
        </div>

        <div className="text-xs shrink-0" style={{ color: "var(--color-muted)" }}>
          Window: <strong className="font-mono" style={{ color: "var(--color-text)" }}>{summary?.date_from || "—"}</strong> to{" "}
          <strong className="font-mono" style={{ color: "var(--color-text)" }}>{summary?.date_to || "—"}</strong>
        </div>
      </div>

      {/* Touchstone Slab Hero */}
      <section
        aria-label="Data Trust Policy Slab"
        className="w-full rounded-xl p-5 sm:p-7 relative overflow-hidden select-none"
        style={{ background: "var(--color-touchstone)", color: "var(--color-surface)" }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <filter id="stone-grain-trust" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#stone-grain-trust)" />
        </svg>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#EED9A0]">
                Public Ledger Governance Policy
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {summary?.data_policy || "The product itself does not scrape. Local development data is private and not published."}
              </h2>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Append-only enforcement: <code className="text-xs text-white/90">Triggers + SHA-256 Digest</code>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Rows Accepted
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {rowsAccepted.toLocaleString()}
                <span className="text-xs font-normal text-white/60 ml-1">rows</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Rows Quarantined
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {rowsQuarantined.toLocaleString()}
                <span className="text-xs font-normal text-white/60 ml-1">errors</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Accepted Ratio
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {acceptedPct.toFixed(1)}%
                <span className="text-xs font-normal text-white/60 ml-1">clean</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.65)" }}>
                Imported Files
              </span>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                {Object.values(filesByStatus).reduce((a, b) => a + b, 0)}
                <span className="text-xs font-normal text-white/60 ml-1">bhavcopies</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Row Acceptance Ratio Bar & File Ingestion Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rows accepted vs quarantined */}
        <section
          className="rounded-xl p-5 border space-y-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-muted)" }}>
              Row Ingestion Integrity
            </h3>
            <span className="text-xs font-mono font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>
              {rowsAccepted} / {totalRows} rows accepted
            </span>
          </div>

          <div className="h-3 w-full rounded-xs overflow-hidden flex" style={{ background: "color-mix(in srgb, var(--color-line) 40%, transparent)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${acceptedPct}%`,
                background: "var(--color-verdigris)",
              }}
              title={`Accepted: ${rowsAccepted} rows (${acceptedPct.toFixed(1)}%)`}
            />
            {rowsQuarantined > 0 && (
              <div
                className="h-full transition-all"
                style={{
                  width: `${100 - acceptedPct}%`,
                  background: "var(--color-madder)",
                }}
                title={`Quarantined: ${rowsQuarantined} rows`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ background: "var(--color-verdigris)" }} />
              <span>Accepted ({rowsAccepted})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ background: "var(--color-madder)" }} />
              <span>Quarantined ({rowsQuarantined})</span>
            </span>
          </div>
        </section>

        {/* Files by Status */}
        <section
          className="rounded-xl p-5 border space-y-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-muted)" }}>
            Bhavcopy Files by Status
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(filesByStatus).map(([st, cnt]) => {
              const isOk = st === "success";
              const isWarn = st === "date_mismatch";
              return (
                <div
                  key={st}
                  className="p-3 rounded-xs border space-y-1"
                  style={{
                    background: "var(--color-page)",
                    borderColor: "var(--color-line)",
                  }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider block"
                    style={{
                      color: isOk
                        ? "var(--color-verdigris)"
                        : isWarn
                        ? "var(--color-gold-m)"
                        : "var(--color-madder)",
                    }}
                  >
                    {st.replace("_", " ")}
                  </span>
                  <div className="font-mono text-xl font-bold tabular-nums" style={{ color: "var(--color-text)" }}>
                    {cnt}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Contract Temporal Coverage Timeline */}
      <section
        className="rounded-xl p-5 sm:p-6 border space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div>
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
            Per-Contract Coverage Timeline
          </h3>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Session presence across the ingested calendar range for each tracked gold specification.
          </p>
        </div>

        <div className="space-y-3">
          {contractCoverage.map((item) => {
            const pct = Math.min(100, Math.max(0, (item.trading_days_present / 45) * 100));
            return (
              <div key={item.symbol} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold" style={{ color: "var(--color-text)" }}>
                      {item.symbol}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--color-muted)" }}>
                      {item.first_date ?? "—"} → {item.last_date ?? "—"}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold" style={{ color: "var(--color-text)" }}>
                    {item.trading_days_present} days ({pct.toFixed(0)}%)
                  </span>
                </div>

                <div className="h-2 w-full rounded-xs overflow-hidden" style={{ background: "color-mix(in srgb, var(--color-line) 40%, transparent)" }}>
                  <div
                    className="h-full rounded-xs transition-all"
                    style={{
                      width: `${pct}%`,
                      background: "var(--color-verdigris)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Anomalous Dates & Findings Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomalous Dates */}
        <section
          className="rounded-xl p-5 border space-y-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
            Anomalous Dates Logged
          </h3>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Exchange publications where calendar date mismatch or missing payload was encountered.
          </p>

          <div className="space-y-2 pt-1">
            {anomalousDates.length === 0 ? (
              <div className="p-4 rounded-xs border text-xs text-center" style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}>
                Zero anomalous dates detected.
              </div>
            ) : (
              anomalousDates.map((ad, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xs border space-y-1 font-mono text-xs"
                  style={{
                    background: "var(--color-page)",
                    borderColor: "var(--color-line)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-sans" style={{ color: "var(--color-text)" }}>
                      {ad.date || "Unknown Date"}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-xs text-[11px] font-semibold border"
                      style={{
                        background: "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
                        color: "var(--color-gold-m)",
                        borderColor: "var(--color-gold-m)",
                      }}
                    >
                      {ad.status}
                    </span>
                  </div>
                  <p className="text-xs font-sans" style={{ color: "var(--color-muted)" }}>
                    {ad.reason || "Exchange returned non-matching schedule payload."}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Observed Quality Findings */}
        <section
          className="rounded-xl p-5 border space-y-3"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-text)" }}>
            Observed Quality Findings
          </h3>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Aggregated issue occurrences across all processed file headers and row payloads.
          </p>

          <div className="w-full overflow-x-auto rounded-xs border" style={{ borderColor: "var(--color-line)" }}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}>
                  <th scope="col" className="px-3 py-2 uppercase tracking-wider text-[11px] font-semibold">Check Identifier</th>
                  <th scope="col" className="px-3 py-2 uppercase tracking-wider text-[11px] font-semibold">Severity</th>
                  <th scope="col" className="px-3 py-2 uppercase tracking-wider text-[11px] font-semibold text-right">Occurrences</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
                {issuesByCheck.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center font-sans" style={{ color: "var(--color-muted)" }}>
                      No quality issues logged in the active window.
                    </td>
                  </tr>
                ) : (
                  issuesByCheck.map((issue, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-sans font-semibold">{issue.check_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded-xs text-[10px] uppercase font-bold"
                          style={{
                            background:
                              issue.severity === "ERROR"
                                ? "color-mix(in srgb, var(--color-madder) 15%, transparent)"
                                : "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
                            color:
                              issue.severity === "ERROR" ? "var(--color-madder)" : "var(--color-gold-m)",
                          }}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{issue.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* "What We Rejected and Why" Section */}
      <section
        className="rounded-xl p-5 sm:p-7 border space-y-6"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs"
              style={{
                background: "color-mix(in srgb, var(--color-madder) 15%, transparent)",
                color: "var(--color-madder)",
                border: "1px solid var(--color-madder)",
              }}
            >
              12 AUDIT RULES
            </span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Sourced from <code className="text-xs">backend/app/validate/validator.py</code> & <code className="text-xs">processor.py</code>
            </span>
          </div>
          <h3 className="font-display text-xl font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
            What We Rejected and Why
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Assay separates data handling into three distinct enforcement layers: file-level structure checks, pure row-level validations, and immutable ledger conflict protections.
          </p>
        </div>

        {/* Tier 1: File-Level Checks */}
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-text)" }}>
            1. File-Level Checks ({fileRules.length} rules)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {fileRules.map((rule) => (
              <div
                key={rule.code}
                className="p-3.5 rounded-xs border space-y-2 flex flex-col justify-between"
                style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--color-text)" }}>
                      {rule.code}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-xs text-[10px] uppercase font-bold"
                      style={{
                        background:
                          rule.severity === "error"
                            ? "color-mix(in srgb, var(--color-madder) 15%, transparent)"
                            : "color-mix(in srgb, var(--color-muted) 20%, transparent)",
                        color: rule.severity === "error" ? "var(--color-madder)" : "var(--color-muted)",
                      }}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <p className="text-xs leading-normal" style={{ color: "var(--color-muted)" }}>
                    {rule.description}
                  </p>
                </div>
                <div className="pt-2 border-t text-[11px]" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
                  <strong className="block text-[10px] uppercase tracking-wider text-muted">Action:</strong>
                  {rule.quarantineAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 2: Row-Level Validations */}
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-text)" }}>
            2. Row-Level Pure Validations ({rowRules.length} rules)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {rowRules.map((rule) => (
              <div
                key={rule.code}
                className="p-3.5 rounded-xs border space-y-2 flex flex-col justify-between"
                style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--color-text)" }}>
                      {rule.code}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-xs text-[10px] uppercase font-bold"
                      style={{
                        background:
                          rule.severity === "error"
                            ? "color-mix(in srgb, var(--color-madder) 15%, transparent)"
                            : "color-mix(in srgb, var(--color-gold-m) 15%, transparent)",
                        color: rule.severity === "error" ? "var(--color-madder)" : "var(--color-gold-m)",
                      }}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <p className="text-xs leading-normal" style={{ color: "var(--color-muted)" }}>
                    {rule.description}
                  </p>
                </div>
                <div className="pt-2 border-t text-[11px]" style={{ borderColor: "var(--color-line)", color: "var(--color-text)" }}>
                  <strong className="block text-[10px] uppercase tracking-wider text-muted">Action:</strong>
                  {rule.quarantineAction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 3: Ledger Conflict Check */}
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-[11px]" style={{ color: "var(--color-text)" }}>
            3. Ledger Revision Protection ({conflictRules.length} rule)
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {conflictRules.map((rule) => (
              <div
                key={rule.code}
                className="p-4 rounded-xs border space-y-2"
                style={{ background: "var(--color-page)", borderColor: "var(--color-line)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold" style={{ color: "var(--color-text)" }}>
                      {rule.code}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-madder)" }}>
                      Silent Data Rewrite Prevention
                    </span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-xs text-[10px] uppercase font-bold"
                    style={{
                      background: "color-mix(in srgb, var(--color-madder) 15%, transparent)",
                      color: "var(--color-madder)",
                    }}
                  >
                    CRITICAL ERROR
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {rule.description}
                </p>
                <div className="p-3 rounded-xs border text-xs leading-relaxed" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-text)" }}>
                  <strong>Immutability Guarantee:</strong> {rule.quarantineAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
