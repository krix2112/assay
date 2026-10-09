"""Application configuration settings."""

from datetime import date

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/assay",
        description="PostgreSQL connection string with psycopg3 driver",
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment (development, staging, production)",
    )
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="Allowed CORS origins",
    )
    MCX_LIVE_FETCH_ENABLED: bool = Field(
        default=False,
        description="Enable live network fetching from MCX. Requires written consent from MCX.",
    )
    MCX_BHAVCOPY_URL: str = Field(
        default="https://www.mcxindia.com/market-data/bhavcopy/GetDateWiseBhavCopy",
        description="MCX Bhavcopy endpoint URL",
    )
    MCX_REQUEST_TIMEOUT_SECONDS: float = Field(
        default=15.0,
        description="HTTP request timeout for MCX API calls",
    )
    MCX_USER_AGENT: str = Field(
        default="Assay-research/0.1 (student hackathon project)",
        description="User-Agent header for MCX requests",
    )
    MCX_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum retry attempts for MCX fetcher",
    )
    RAW_DATA_DIR: str = Field(
        default="data/raw",
        description="Directory to archive raw ingested fetches",
    )
    # GOLDTEN contracts launched recently; 2025-01-01 is an approximate threshold
    # that must be verified against MCX specifications.
    GOLDTEN_FIRST_DATE: date = Field(
        default=date(2025, 1, 1),
        description="Approximate earliest valid trading date for GOLDTEN contracts (must verify)",
    )
    # Liquidity parameters (S6)
    LIQUIDITY_LOOKBACK_DAYS: int = Field(
        default=20,
        description="Lookback trading days window to calculate median volume and OI",
    )
    LIQUIDITY_MIN_HISTORY_DAYS: int = Field(
        default=5,
        description="Minimum prior trading days required before scoring liquidity confidence",
    )
    LIQUIDITY_HIGH_THRESHOLD: float = Field(
        default=0.8,
        description="Volume and OI ratio threshold for High liquidity label",
    )
    LIQUIDITY_MEDIUM_THRESHOLD: float = Field(
        default=0.4,
        description="Volume and OI ratio threshold for Medium liquidity label",
    )
    LIQUIDITY_LOW_THRESHOLD: float = Field(
        default=0.1,
        description="Volume and OI ratio threshold for Low liquidity label",
    )
    # Analytics / Spreads and Parity parameters (S7, S8)
    PAIR_MAX_EXPIRY_GAP_DAYS: int = Field(
        default=10,
        description="Maximum allowed calendar days between contract expiries for pairing",
    )
    SPREAD_LOOKBACK_DAYS: int = Field(
        default=20,
        description="Lookback trading days window to compute rolling median and MAD of spread_bps",
    )
    SPREAD_MIN_HISTORY: int = Field(
        default=10,
        description="Minimum history trading days required to compute robust_z",
    )
    PARITY_Z_CAP: float = Field(
        default=4.0,
        description="Cap on absolute robust_z in penalty computation",
    )
    PARITY_WEIGHT_HIGH: float = Field(
        default=1.0,
        description="Parity score weight for High liquidity pairs",
    )
    PARITY_WEIGHT_MEDIUM: float = Field(
        default=0.6,
        description="Parity score weight for Medium liquidity pairs",
    )
    PARITY_WEIGHT_LOW: float = Field(
        default=0.3,
        description="Parity score weight for Low liquidity pairs",
    )
    ANALYTICS_METHOD_VERSION: str = Field(
        default="v1",
        description="Version string recorded with spreads and parity scores",
    )
    # Walk-forward Backtest parameters (S9)
    BACKTEST_ENTRY_Z: float = Field(
        default=2.0,
        description="Absolute robust_z threshold to generate an entry signal",
    )
    BACKTEST_EXIT_Z: float = Field(
        default=0.5,
        description="Absolute robust_z threshold to trigger an exit signal",
    )
    BACKTEST_MAX_HOLD_DAYS: int = Field(
        default=10,
        description="Maximum holding period in calendar/trading days before exit",
    )
    BACKTEST_TRAIN_FRACTION: float = Field(
        default=0.6,
        description="Fraction of trading days assigned to training window",
    )
    BACKTEST_ATTRIB_MIN_DAYS: int = Field(
        default=20,
        description="Minimum days required to compute regression attribution",
    )
    BACKTEST_MIN_TRADES: int = Field(
        default=10,
        description="Minimum held-out trades required for non-insufficient verdict",
    )
    BACKTEST_MIN_DAYS: int = Field(
        default=60,
        description="Minimum held-out days required for non-insufficient verdict",
    )
    BACKTEST_MAX_OPEN: int = Field(
        default=4,
        description="Maximum simultaneous open positions allowed across all pairs",
    )
    BACKTEST_COST_BPS_PER_SIDE: float = Field(
        default=5.0,
        description="Placeholder transaction cost in bps per side",
    )
    BACKTEST_SLIPPAGE_HIGH_BPS: float = Field(
        default=2.0,
        description="Placeholder slippage in bps for High liquidity pairs",
    )
    BACKTEST_SLIPPAGE_MEDIUM_BPS: float = Field(
        default=6.0,
        description="Placeholder slippage in bps for Medium liquidity pairs",
    )
    BACKTEST_SLIPPAGE_LOW_BPS: float = Field(
        default=15.0,
        description="Placeholder slippage in bps for Low liquidity pairs",
    )
    BACKTEST_CODE_VERSION: str = Field(
        default="v1",
        description="Code version recorded with backtest runs",
    )


settings = Settings()
