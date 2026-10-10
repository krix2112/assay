import { z } from "zod";

// --- Zod Schemas ---

export const ParityResponseSchema = z.object({
  trade_date: z.string(),
  score: z.number().nullable(),
  status: z.string(),
  pairs_used: z.number(),
  explanation: z.string(),
  details: z.record(z.string(), z.any()),
  method_version: z.string(),
  computed_at: z.string(),
  is_draft: z.boolean().default(true),
  unvalidated: z.boolean().default(true),
  draft_notice: z.string().optional(),
});
export type ParityResponse = z.infer<typeof ParityResponseSchema>;

export const ContractDayItemSchema = z.object({
  symbol: z.string(),
  expiry_date: z.string(),
  trade_date: z.string(),
  close: z.union([z.string(), z.number()]),
  price_per_gram: z.union([z.string(), z.number()]).nullable().optional(),
  fine_gold_price_per_gram: z.union([z.string(), z.number()]).nullable().optional(),
  volume: z.number(),
  open_interest: z.number(),
  volume_ratio: z.union([z.string(), z.number()]).nullable().optional(),
  oi_ratio: z.union([z.string(), z.number()]).nullable().optional(),
  days_to_expiry: z.number(),
  history_days: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export type ContractDayItem = z.infer<typeof ContractDayItemSchema>;

export const SpreadItemSchema = z.object({
  trade_date: z.string(),
  symbol_a: z.string(),
  expiry_a: z.string(),
  symbol_b: z.string(),
  expiry_b: z.string(),
  expiry_gap_days: z.number(),
  spread_bps: z.union([z.string(), z.number()]),
  rolling_median_bps: z.union([z.string(), z.number()]).nullable().optional(),
  rolling_mad_bps: z.union([z.string(), z.number()]).nullable().optional(),
  robust_z: z.union([z.string(), z.number()]).nullable().optional(),
  history_days: z.number(),
  weaker_liquidity_label: z.string(),
  method_version: z.string(),
});
export type SpreadItem = z.infer<typeof SpreadItemSchema>;

export const CheckCountItemSchema = z.object({
  check_name: z.string(),
  severity: z.string(),
  count: z.number(),
});

export const DateAnomalyItemSchema = z.object({
  date: z.string().nullable(),
  status: z.string(),
  reason: z.string().nullable().optional(),
});

export const ContractCoverageItemSchema = z.object({
  symbol: z.string(),
  first_date: z.string().nullable().optional(),
  last_date: z.string().nullable().optional(),
  trading_days_present: z.number().default(0),
});

export const DataQualitySummarySchema = z.object({
  data_policy: z.string(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  files_by_status: z.record(z.string(), z.number()).default({}),
  rows_accepted: z.number().default(0),
  rows_quarantined: z.number().default(0),
  issues_by_check: z.array(CheckCountItemSchema).default([]),
  anomalous_dates: z.array(DateAnomalyItemSchema).default([]),
  contract_coverage: z.array(ContractCoverageItemSchema).default([]),
});
export type DataQualitySummary = z.infer<typeof DataQualitySummarySchema>;

export const BacktestDailyItemSchema = z.object({
  trade_date: z.string(),
  strategy_pnl: z.union([z.string(), z.number()]),
  gross_pnl: z.union([z.string(), z.number()]),
  costs: z.union([z.string(), z.number()]),
  gold_return: z.union([z.string(), z.number()]).nullable().optional(),
  open_positions: z.number(),
});

export const BacktestTradeItemSchema = z.object({
  id: z.number(),
  entry_date: z.string(),
  exit_date: z.string(),
  symbol_a: z.string(),
  expiry_a: z.string(),
  symbol_b: z.string(),
  expiry_b: z.string(),
  direction: z.string(),
  lots_a: z.number(),
  lots_b: z.number(),
  entry_spread_bps: z.union([z.string(), z.number()]),
  exit_spread_bps: z.union([z.string(), z.number()]),
  gross_pnl: z.union([z.string(), z.number()]),
  costs: z.union([z.string(), z.number()]),
  net_pnl: z.union([z.string(), z.number()]),
  exit_reason: z.string(),
  residual_gram_mismatch: z.union([z.string(), z.number()]),
});

export const BacktestLatestSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  code_version: z.string(),
  params: z.record(z.string(), z.any()),
  data_from: z.string(),
  data_to: z.string(),
  train_to: z.string(),
  status: z.string(),
  summary: z.record(z.string(), z.any()),
  equity_curve: z.array(BacktestDailyItemSchema).default([]),
  trades: z.array(BacktestTradeItemSchema).default([]),
});
export type BacktestLatest = z.infer<typeof BacktestLatestSchema>;

export const TrackRecordVerifySchema = z.object({
  ok: z.boolean(),
  entries: z.number(),
  first_broken: z.number().nullable().optional(),
});
export type TrackRecordVerify = z.infer<typeof TrackRecordVerifySchema>;

export const TrackRecordEntrySchema = z.object({
  id: z.number(),
  trade_date: z.string(),
  revision: z.number(),
  record: z.record(z.string(), z.any()),
  canonical_json: z.string(),
  prev_hash: z.string().nullable().optional(),
  hash: z.string(),
  created_at: z.string(),
});
export type TrackRecordEntry = z.infer<typeof TrackRecordEntrySchema>;

// --- API Client Configuration & Implementation ---

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO === "true";

// Helper for HTTP requests
async function fetchFromApi<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} for ${url}`);
  }
  const json = await res.json();
  return schema.parse(json);
}

// Client functions with Demo Mode fallback
export async function getLatestParity(): Promise<ParityResponse> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/parity_latest.json");
    return ParityResponseSchema.parse(data.default || data);
  }
  return fetchFromApi("/parity/latest", ParityResponseSchema);
}

export async function getParityHistory(
  fromDate?: string,
  toDate?: string
): Promise<ParityResponse[]> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/parity_history.json");
    let list: ParityResponse[] = z.array(ParityResponseSchema).parse(data.default || data);
    if (fromDate) list = list.filter((p) => p.trade_date >= fromDate);
    if (toDate) list = list.filter((p) => p.trade_date <= toDate);
    return list;
  }
  const params = new URLSearchParams();
  if (fromDate) params.append("from", fromDate);
  if (toDate) params.append("to", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchFromApi(`/parity/history${query}`, z.array(ParityResponseSchema));
}

export async function getContractsByDate(dateStr: string): Promise<ContractDayItem[]> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/contracts_by_date.json");
    const dict = (data.default || data) as Record<string, any[]>;
    const list = dict[dateStr] || [];
    return z.array(ContractDayItemSchema).parse(list);
  }
  return fetchFromApi(`/contracts/${dateStr}`, z.array(ContractDayItemSchema));
}

export async function getSpreadsByDate(dateStr: string): Promise<SpreadItem[]> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/spreads_by_date.json");
    const dict = (data.default || data) as Record<string, any[]>;
    const list = dict[dateStr] || [];
    return z.array(SpreadItemSchema).parse(list);
  }
  return fetchFromApi(`/spreads?date=${dateStr}`, z.array(SpreadItemSchema));
}

/**
 * Concurrency-limited runner for batch API calls (concurrency limit = 6, 1 retry).
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      let lastErr: unknown;
      let success = false;
      // 1 retry on failure (attempt 0, then attempt 1)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          results[current] = await fn(item);
          success = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!success) {
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new Error(`Failed to fetch date ${String(item)}: ${msg}`);
      }
      completed++;
      onProgress?.(completed, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function getAllSpreads(
  dates?: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, SpreadItem[]>> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/spreads_by_date.json");
    const dict = (data.default || data) as Record<string, any[]>;
    const res: Record<string, SpreadItem[]> = {};
    for (const [k, v] of Object.entries(dict)) {
      res[k] = z.array(SpreadItemSchema).parse(v);
    }
    return res;
  }
  if (!dates || dates.length === 0) return {};
  const results = await mapConcurrent(
    dates,
    6,
    async (d) => ({ date: d, data: await getSpreadsByDate(d) }),
    onProgress
  );
  const out: Record<string, SpreadItem[]> = {};
  for (const r of results) {
    out[r.date] = r.data;
  }
  return out;
}

export async function getAllContracts(
  dates?: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Record<string, ContractDayItem[]>> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/contracts_by_date.json");
    const dict = (data.default || data) as Record<string, any[]>;
    const res: Record<string, ContractDayItem[]> = {};
    for (const [k, v] of Object.entries(dict)) {
      res[k] = z.array(ContractDayItemSchema).parse(v);
    }
    return res;
  }
  if (!dates || dates.length === 0) return {};
  const results = await mapConcurrent(
    dates,
    6,
    async (d) => ({ date: d, data: await getContractsByDate(d) }),
    onProgress
  );
  const out: Record<string, ContractDayItem[]> = {};
  for (const r of results) {
    out[r.date] = r.data;
  }
  return out;
}

export async function getDataQualitySummary(
  dateFrom?: string,
  dateTo?: string
): Promise<DataQualitySummary> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/data_quality_summary.json");
    return DataQualitySummarySchema.parse(data.default || data);
  }
  const params = new URLSearchParams();
  if (dateFrom) params.append("date_from", dateFrom);
  if (dateTo) params.append("date_to", dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchFromApi(`/data-quality/summary${query}`, DataQualitySummarySchema);
}

export async function getLatestBacktest(): Promise<BacktestLatest> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/backtest_latest.json");
    return BacktestLatestSchema.parse(data.default || data);
  }
  return fetchFromApi("/backtest/latest", BacktestLatestSchema);
}

export async function getTrackRecordVerify(): Promise<TrackRecordVerify> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/track_record_verify.json");
    return TrackRecordVerifySchema.parse(data.default || data);
  }
  return fetchFromApi("/track-record/verify", TrackRecordVerifySchema);
}

export async function getTrackRecord(limit = 100): Promise<TrackRecordEntry[]> {
  if (IS_DEMO_MODE) {
    const data = await import("@/lib/sample/track_record.json");
    const list = (data.default || data).slice(0, limit);
    return z.array(TrackRecordEntrySchema).parse(list);
  }
  return fetchFromApi(`/track-record?limit=${limit}`, z.array(TrackRecordEntrySchema));
}
