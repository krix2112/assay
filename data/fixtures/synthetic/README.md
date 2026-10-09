# Synthetic Test Fixtures

All files in this directory (`data/fixtures/synthetic/`) are **purely synthetic test fixtures** generated specifically for automated testing and software verification.

- **No Real Exchange Data**: The prices, volumes, open interest figures, and records in these files are fabricated and do not represent real market transactions or quotations from the Multi Commodity Exchange of India (MCX).
- **Schema Parity**: These fixtures strictly replicate the JSON schema format (`IsSuccess`, `Message`, `Data` with fields `Date`, `Symbol`, `ExpiryDate`, `Open`, `High`, `Low`, `Close`, `PreviousClose`, `Volume`, `OpenInterest`, `InstrumentName`) to test parser robustness, error handling, contract filtering, and edge cases (such as weekends, differing dates, malformed values, and duplicate rows).
