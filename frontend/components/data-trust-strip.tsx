"use client";

import React from "react";
import Link from "next/link";
import { TrackRecordVerify } from "@/lib/api";

interface DataTrustStripProps {
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  verifyResult: TrackRecordVerify | null;
}

export function DataTrustStrip({
  dates,
  selectedDate,
  onSelectDate,
  verifyResult,
}: DataTrustStripProps) {
  const isChainOk = verifyResult?.ok ?? true;
  const entriesCount = verifyResult?.entries ?? dates.length;

  return (
    <div className="bg-chalk rounded-xl p-4 sm:p-5 border border-basalt/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2.5 h-2.5 rounded-full inline-block ${
              isChainOk ? "bg-verdigris" : "bg-madder"
            }`}
          />
          <span className="text-sm font-semibold text-basalt">
            {isChainOk
              ? `Record chain verified (${entriesCount} entries)`
              : `Cryptographic chain broken at index ${verifyResult?.first_broken}`}
          </span>
        </div>
        <p className="text-xs text-basalt/60 leading-relaxed max-w-[65ch]">
          Every daily Parity Score is cryptographically hash-chained and audit-logged in append-only storage.
        </p>
      </div>

      {/* Date ticks preview */}
      <div className="flex items-center space-x-4 shrink-0">
        <div className="flex items-center space-x-1" title="Trading day audit strip">
          {dates.slice(-25).map((d) => {
            const isSelected = d === selectedDate;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(d)}
                className={`w-1.5 h-5 rounded-xs transition-all focus-visible:ring-1 focus-visible:ring-basalt ${
                  isSelected
                    ? "bg-basalt scale-y-125"
                    : "bg-verdigris/40 hover:bg-verdigris"
                }`}
                title={`Audit tick: ${d}`}
              />
            );
          })}
        </div>

        <Link
          href="/data-trust"
          className="text-xs font-medium text-basalt hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-basalt rounded-xs px-2 py-1 bg-limestone/60 border border-basalt/10"
        >
          Data trust
        </Link>
      </div>
    </div>
  );
}
