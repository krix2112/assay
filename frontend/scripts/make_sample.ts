/**
 * Deterministic sample data generator for Assay demo mode.
 * Generates ~45 trading days of synthetic metrics matching exact backend schemas.
 */

import * as fs from "fs";
import * as path from "path";

// Simple deterministic PRNG (Linear Congruential Generator)
function makePrng(seed = 42) {
  let s = seed;
  return function next() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const prng = makePrng(1337);

const SYMBOLS = [
  { symbol: "GOLDM", grams: 100, purity: 0.995, expStart: 3, expEnd: 5 },
  { symbol: "GOLDTEN", grams: 10, purity: 0.999, expStart: 27, expEnd: 31 },
  { symbol: "GOLDGUINEA", grams: 8, purity: 0.999, expStart: 27, expEnd: 31 },
  { symbol: "GOLDPETAL", grams: 1, purity: 0.999, expStart: 27, expEnd: 31 },
];

function generateTradingDays(count = 45): string[] {
  const days: string[] = [];
  const cur = new Date("2026-08-10T00:00:00Z");
  while (days.length < count) {
    const dayOfWeek = cur.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function run() {
  const sampleDir = path.resolve(__dirname, "../lib/sample");
  fs.mkdirSync(sampleDir, { recursive: true });

  const tradingDays = generateTradingDays(45);
  const parityHistory: any[] = [];
  const contractsByDate: Record<string, any[]> = {};
  const spreadsByDate: Record<string, any[]> = {};
  const trackRecordEntries: any[] = [];

  let basePrice = 7500.0; // INR per fine gram
  let prevHash: string | null = null;

  for (let i = 0; i < tradingDays.length; i++) {
    const tradeDate = tradingDays[i];
    const isShortHistory = i < 10;
    const isNoScoreDay = i === 22;
    const isDislocationDay = i === 34 || i === 35;
    const isWarningDay = i === 15;

    // Drifting gold price
    const dailyReturn = (prng() - 0.48) * 0.015;
    basePrice *= 1 + dailyReturn;

    // 1. Contracts
    const dayContracts: any[] = [];
    const expiries = [
      { date: "2026-10-05", daysTo: Math.max(1, 40 - i) },
      { date: "2026-11-05", daysTo: 70 - i },
      { date: "2026-12-05", daysTo: 100 - i },
    ];
    const lateExpiries = [
      { date: "2026-10-30", daysTo: Math.max(1, 65 - i) },
      { date: "2026-11-30", daysTo: 95 - i },
      { date: "2026-12-31", daysTo: 125 - i },
    ];

    for (const spec of SYMBOLS) {
      const expList = spec.symbol === "GOLDM" ? expiries : lateExpiries;
      for (let eIdx = 0; eIdx < expList.length; eIdx++) {
        const exp = expList[eIdx];
        const expiryDate = exp.date;
        const daysToExpiry = exp.daysTo;

        // Spread deviation in bps
        let deviationBps = (prng() - 0.5) * 14;
        if (spec.symbol === "GOLDM") deviationBps += 4;
        if (spec.symbol === "GOLDTEN") deviationBps -= 3;
        if (isDislocationDay && spec.symbol === "GOLDTEN") {
          deviationBps += 38.5; // Deliberate dislocation
        }

        const finePrice = basePrice * (1 + deviationBps / 10000);
        const pricePerGram = finePrice * spec.purity;
        const quoteUnits = spec.symbol === "GOLDM" || spec.symbol === "GOLDTEN" ? 10 : spec.grams;
        const close = Math.round(pricePerGram * quoteUnits * 100) / 100;

        let label = "High";
        if (eIdx === 1) label = "Medium";
        if (eIdx === 2) label = "Low";
        if (daysToExpiry <= 2) label = "Untradeable";
        if (isNoScoreDay && spec.symbol === "GOLDPETAL") label = "Unknown";

        const volume = Math.floor(prng() * 5000 * (1 / (eIdx + 1)));
        const oi = Math.floor(prng() * 12000 * (1 / (eIdx + 1)));

        dayContracts.push({
          symbol: spec.symbol,
          expiry_date: expiryDate,
          trade_date: tradeDate,
          close: close.toFixed(2),
          price_per_gram: pricePerGram.toFixed(4),
          fine_gold_price_per_gram: finePrice.toFixed(4),
          volume,
          open_interest: oi,
          volume_ratio: (0.8 + prng() * 0.4).toFixed(4),
          oi_ratio: (0.9 + prng() * 0.3).toFixed(4),
          days_to_expiry: daysToExpiry,
          history_days: i + 1,
          label,
          reason: `Confidence scored ${label}`,
        });
      }
    }
    contractsByDate[tradeDate] = dayContracts;

    // 2. Spreads
    const pairs = [
      { a: "GOLDM", expA: expiries[0].date, b: "GOLDTEN", expB: lateExpiries[0].date },
      { a: "GOLDM", expA: expiries[0].date, b: "GOLDGUINEA", expB: lateExpiries[0].date },
      { a: "GOLDM", expA: expiries[0].date, b: "GOLDPETAL", expB: lateExpiries[0].date },
      { a: "GOLDTEN", expA: lateExpiries[0].date, b: "GOLDGUINEA", expB: lateExpiries[0].date },
      { a: "GOLDTEN", expA: lateExpiries[0].date, b: "GOLDPETAL", expB: lateExpiries[0].date },
      { a: "GOLDGUINEA", expA: lateExpiries[0].date, b: "GOLDPETAL", expB: lateExpiries[0].date },
    ];

    const daySpreads: any[] = [];
    for (const p of pairs) {
      const cA = dayContracts.find((c) => c.symbol === p.a && c.expiry_date === p.expA);
      const cB = dayContracts.find((c) => c.symbol === p.b && c.expiry_date === p.expB);
      if (!cA || !cB) continue;

      const pA = parseFloat(cA.fine_gold_price_per_gram);
      const pB = parseFloat(cB.fine_gold_price_per_gram);
      const spreadBps = ((pA - pB) / pB) * 10000;

      let robustZ: string | null = null;
      if (!isShortHistory) {
        let zVal = (spreadBps - 2.0) / 4.5;
        if (isDislocationDay && (p.a === "GOLDTEN" || p.b === "GOLDTEN")) {
          zVal = 3.42;
        }
        robustZ = zVal.toFixed(2);
      }

      let weaker = "High";
      if (cA.label === "Medium" || cB.label === "Medium") weaker = "Medium";
      if (cA.label === "Low" || cB.label === "Low") weaker = "Low";
      if (cA.label === "Unknown" || cB.label === "Unknown") weaker = "Unknown";
      if (cA.label === "Untradeable" || cB.label === "Untradeable") weaker = "Untradeable";

      daySpreads.push({
        trade_date: tradeDate,
        symbol_a: p.a,
        expiry_a: p.expA,
        symbol_b: p.b,
        expiry_b: p.expB,
        expiry_gap_days: 25,
        spread_bps: spreadBps.toFixed(2),
        rolling_median_bps: isShortHistory ? null : "2.10",
        rolling_mad_bps: isShortHistory ? null : "3.05",
        robust_z: robustZ,
        history_days: i + 1,
        weaker_liquidity_label: weaker,
        method_version: "v1",
      });
    }
    spreadsByDate[tradeDate] = daySpreads;

    // 3. Parity Score
    let score: number | null = Math.floor(78 + (prng() * 18));
    let status = "Computed";
    let explanation = "Strong agreement across contracts with typical basis spreads.";

    if (isShortHistory) {
      explanation = "Baseline history building (lookback period establishing).";
    } else if (isNoScoreDay) {
      score = null;
      status = "Insufficient Pairs";
      explanation = "Untradeable liquidity on petal contract prevented robust calculation.";
    } else if (isDislocationDay) {
      score = 42;
      status = "Computed";
      explanation = "Dislocation observed in GOLDTEN near-month contract.";
    } else if (isWarningDay) {
      explanation = "Exchange timestamp disparity noted on file import.";
    }

    const parityItem = {
      trade_date: tradeDate,
      score,
      status,
      pairs_used: isNoScoreDay ? 1 : 6,
      explanation,
      details: {
        pairs_used: isNoScoreDay ? 1 : 6,
        pairs_excluded: isNoScoreDay ? 5 : 0,
      },
      method_version: "v1",
      computed_at: `${tradeDate}T18:30:00Z`,
      is_draft: true,
      unvalidated: true,
      draft_notice: "Parity Score v1 is a draft. It has NOT been validated against known dislocations.",
    };
    parityHistory.push(parityItem);

    // 4. Track Record Entry
    const recordPayload = {
      trade_date: tradeDate,
      parity: {
        score: score ? String(score) : null,
        status,
        pairs_used: isNoScoreDay ? 1 : 6,
        pairs_excluded: isNoScoreDay ? 5 : 0,
      },
      liquidity_label_counts: { High: 4, Medium: 4, Low: 4 },
      data_quality_counts: isWarningDay ? { DATE_MISMATCH: 1 } : { PASS: 12 },
      files_imported_by_status: { success: 1 },
      method_versions: { parity: "v1", liquidity: "v1", normalize: "v1", spreads: "v1" },
      code_version: "95e1bc0",
      latest_backtest_verdict: "inconclusive",
    };
    const canonical = JSON.stringify(recordPayload);
    const hash = `hash_${i}_${tradeDate.replace(/-/g, "")}`;
    trackRecordEntries.push({
      id: i + 1,
      trade_date: tradeDate,
      revision: 1,
      record: recordPayload,
      canonical_json: canonical,
      prev_hash: prevHash,
      hash,
      created_at: `${tradeDate}T18:30:05Z`,
    });
    prevHash = hash;
  }

  // 5. Data Quality Scorecard
  const dataQualitySummary = {
    data_policy:
      "The product itself does not scrape. Local development data is private and not published.",
    date_from: tradingDays[0],
    date_to: tradingDays[tradingDays.length - 1],
    files_by_status: { success: 44, date_mismatch: 1 },
    rows_accepted: 540,
    rows_quarantined: 0,
    issues_by_check: [
      { check_name: "DATE_MISMATCH", severity: "WARN", count: 1 },
      { check_name: "MISSING_ROWS", severity: "INFO", count: 0 },
    ],
    anomalous_dates: [
      { date: tradingDays[15], status: "date_mismatch", reason: "Exchange file date differed by 1 day" },
    ],
    contract_coverage: SYMBOLS.map((s) => ({
      symbol: s.symbol,
      first_date: tradingDays[0],
      last_date: tradingDays[tradingDays.length - 1],
      trading_days_present: 45,
    })),
  };

  // 6. Backtest Latest
  const backtestLatest = {
    id: "sim-run-20261009-v1",
    created_at: "2026-10-09T18:30:00Z",
    code_version: "v1",
    params: {
      entry_z: 2.0,
      exit_z: 0.5,
      max_hold_days: 10,
      train_fraction: 0.6,
      max_open: 4,
    },
    data_from: tradingDays[0],
    data_to: tradingDays[tradingDays.length - 1],
    train_to: tradingDays[26],
    status: "completed",
    summary: {
      verdict: "inconclusive",
      explanation: "Trade count (8) below minimum sample threshold (10) for conclusive verdict.",
      held_out: {
        trade_count: 8,
        win_rate: 0.625,
        net_pnl: 14200.5,
        sharpe: 1.15,
        max_drawdown_pct: 0.032,
      },
      train: {
        trade_count: 12,
        win_rate: 0.583,
        net_pnl: 18900.0,
      },
    },
    equity_curve: tradingDays.slice(27).map((d, idx) => ({
      trade_date: d,
      strategy_pnl: (idx * 800 + (prng() - 0.3) * 400).toFixed(2),
      gross_pnl: (idx * 850 + (prng() - 0.3) * 400).toFixed(2),
      costs: (idx * 50).toFixed(2),
      gold_return: ((prng() - 0.5) * 0.01).toFixed(6),
      open_positions: idx % 2 === 0 ? 2 : 1,
    })),
    trades: [
      {
        id: 1,
        entry_date: tradingDays[28],
        exit_date: tradingDays[32],
        symbol_a: "GOLDM",
        expiry_a: "2026-11-05",
        symbol_b: "GOLDTEN",
        expiry_b: "2026-11-30",
        direction: "long_b_short_a",
        lots_a: 1,
        lots_b: 10,
        entry_spread_bps: "24.50",
        exit_spread_bps: "4.20",
        gross_pnl: "15200.00",
        costs: "750.00",
        net_pnl: "14450.00",
        exit_reason: "mean_reversion",
        residual_gram_mismatch: "0.00",
      },
    ],
  };

  const trackRecordVerify = {
    ok: true,
    entries: trackRecordEntries.length,
    first_broken: null,
  };

  fs.writeFileSync(path.join(sampleDir, "parity_history.json"), JSON.stringify(parityHistory, null, 2));
  fs.writeFileSync(path.join(sampleDir, "parity_latest.json"), JSON.stringify(parityHistory[parityHistory.length - 1], null, 2));
  fs.writeFileSync(path.join(sampleDir, "contracts_by_date.json"), JSON.stringify(contractsByDate, null, 2));
  fs.writeFileSync(path.join(sampleDir, "spreads_by_date.json"), JSON.stringify(spreadsByDate, null, 2));
  fs.writeFileSync(path.join(sampleDir, "data_quality_summary.json"), JSON.stringify(dataQualitySummary, null, 2));
  fs.writeFileSync(path.join(sampleDir, "backtest_latest.json"), JSON.stringify(backtestLatest, null, 2));
  fs.writeFileSync(path.join(sampleDir, "track_record.json"), JSON.stringify(trackRecordEntries, null, 2));
  fs.writeFileSync(path.join(sampleDir, "track_record_verify.json"), JSON.stringify(trackRecordVerify, null, 2));

  console.log(`Generated deterministic sample dataset with ${tradingDays.length} trading days.`);
}

run();
