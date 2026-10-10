import React from "react";
import Link from "next/link";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-basalt">{title}</h1>
        <p className="text-sm text-basalt/70 leading-relaxed max-w-[75ch]">{description}</p>
      </div>
      <div className="p-6 bg-chalk rounded-xl border border-basalt/10 space-y-3">
        <p className="text-sm font-medium text-basalt">Coming soon in the next release.</p>
        <p className="text-xs text-basalt/60 leading-relaxed">
          This section is currently under development. The core daily intelligence view is available on the Today page.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-block px-3 py-1.5 bg-basalt text-chalk text-xs font-medium rounded-xs focus-visible:ring-2 focus-visible:ring-basalt"
          >
            Return to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
