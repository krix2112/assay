/**
 * Canonical Data Validation Rules for Stage S3 (Pure Validation) and Stage S4 (Ledger Ingestion).
 *
 * Sourced directly from:
 * - backend/app/validate/models.py (CheckName enum and Severity enum)
 * - backend/app/validate/validator.py (validate_single_row and validate_bhavcopy)
 * - backend/app/pipeline/processor.py (Stage S4 conflicting revision detection)
 */

export interface ValidationRuleDefinition {
  code: string;
  category: "file" | "row" | "conflict";
  name: string;
  severity: "error" | "warning" | "info";
  description: string;
  quarantineAction: string;
  sourceFile: string;
}

export const VALIDATION_RULES: ValidationRuleDefinition[] = [
  // -------------------------------------------------------------
  // File-Level Checks (Stage S3: validate_bhavcopy)
  // Sourced from: backend/app/validate/validator.py (lines 223-260)
  // -------------------------------------------------------------
  {
    code: "DATE_MISMATCH",
    category: "file",
    name: "Date Mismatch",
    severity: "error",
    description:
      "Exchange returned a bhavcopy with a trade date differing from the requested schedule date.",
    quarantineAction:
      "File status marked as date_mismatch. Rows are audited and retained under their true returned date; not silently rewritten.",
    sourceFile: "backend/app/validate/validator.py:L223-L245",
  },
  {
    code: "PARSE_ERROR",
    category: "file",
    name: "Parse Error",
    severity: "error",
    description:
      "Raw payload could not be parsed into expected MCX CSV schema or had malformed fields.",
    quarantineAction:
      "Unparsed row is quarantined into data_quality_logs with its raw byte payload preserved.",
    sourceFile: "backend/app/validate/validator.py:L247-L260",
  },
  {
    code: "UNKNOWN_SYMBOL",
    category: "file",
    name: "Non-Gold / Out-of-Scope Symbol",
    severity: "info",
    description:
      "Contract symbol belongs to base metals, energy, or agri rather than the four gold contracts (GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL).",
    quarantineAction:
      "Filtered cleanly out of scope; counted in out_of_scope_count and never stored as an error.",
    sourceFile: "backend/app/validate/validator.py:L261-L267",
  },

  // -------------------------------------------------------------
  // Row-Level Checks (Stage S3: validate_single_row)
  // Sourced from: backend/app/validate/validator.py (lines 45-201)
  // -------------------------------------------------------------
  {
    code: "DUPLICATE_ROW",
    category: "row",
    name: "Duplicate Row",
    severity: "error",
    description:
      "Duplicate contract primary key (symbol, expiry_date, trade_date) appears multiple times within the same file.",
    quarantineAction:
      "All duplicate copies are quarantined to prevent ambiguous state insertion.",
    sourceFile: "backend/app/validate/validator.py:L61-L76",
  },
  {
    code: "EXPIRY_BEFORE_TRADE_DATE",
    category: "row",
    name: "Expiry Before Trade Date",
    severity: "error",
    description:
      "Contract expiration date is earlier than the reported trade date.",
    quarantineAction:
      "Row is rejected and quarantined into audit logs.",
    sourceFile: "backend/app/validate/validator.py:L78-L93",
  },
  {
    code: "EXPIRY_OUTSIDE_WINDOW",
    category: "row",
    name: "Expiry Outside Window",
    severity: "warning",
    description:
      "Contract expiration day falls outside the standard monthly schedule (days 3-5 for GOLDM; days 27-31 for others).",
    quarantineAction:
      "Row is accepted because exchange holiday calendar shifts are valid, but logged as a warning.",
    sourceFile: "backend/app/validate/validator.py:L95-L114",
  },
  {
    code: "NON_POSITIVE_PRICE",
    category: "row",
    name: "Non-Positive Price",
    severity: "error",
    description:
      "Open, High, Low, or Close price is less than or equal to zero.",
    quarantineAction:
      "Row is quarantined immediately.",
    sourceFile: "backend/app/validate/validator.py:L116-L131",
  },
  {
    code: "INCONSISTENT_OHLC",
    category: "row",
    name: "Inconsistent OHLC",
    severity: "error",
    description:
      "Price bounds are inverted (High < Low, or Open/Close lies outside [Low, High]).",
    quarantineAction:
      "Row is quarantined immediately as an invalid price record.",
    sourceFile: "backend/app/validate/validator.py:L133-L154",
  },
  {
    code: "NEGATIVE_VOLUME_OR_OI",
    category: "row",
    name: "Negative Volume or Open Interest",
    severity: "error",
    description:
      "Volume < 0 or Open Interest < 0 reported in exchange record.",
    quarantineAction:
      "Row is quarantined immediately.",
    sourceFile: "backend/app/validate/validator.py:L156-L168",
  },
  {
    code: "ZERO_VOLUME",
    category: "row",
    name: "Zero Trading Volume",
    severity: "warning",
    description:
      "Zero volume recorded while contract has a positive settlement close price.",
    quarantineAction:
      "Row is accepted for price continuity, but tagged with a warning and downweighted in liquidity.",
    sourceFile: "backend/app/validate/validator.py:L170-L182",
  },
  {
    code: "GOLDTEN_BEFORE_LISTING",
    category: "row",
    name: "GOLDTEN Traded Before Listing",
    severity: "warning",
    description:
      "GOLDTEN contract observed before its official exchange listing date (2026-08-10 threshold).",
    quarantineAction:
      "Accepted if present in exchange publication, but flagged for audit inspection.",
    sourceFile: "backend/app/validate/validator.py:L184-L199",
  },

  // -------------------------------------------------------------
  // Pipeline / Ledger Conflict Check (Stage S4: processor.py)
  // Sourced from: backend/app/pipeline/processor.py (lines 212-258)
  // -------------------------------------------------------------
  {
    code: "CONFLICTING_REVISION",
    category: "conflict",
    name: "Conflicting Revision",
    severity: "error",
    description:
      "Incoming row matches an existing contract primary key (symbol, expiry_date, trade_date) but has conflicting OHLC or volume values.",
    quarantineAction:
      "Existing database row is preserved immutably. Incoming conflicting row is quarantined into data_quality_logs.",
    sourceFile: "backend/app/pipeline/processor.py:L212-L258",
  },
];
