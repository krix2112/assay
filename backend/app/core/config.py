"""Application configuration settings."""

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


settings = Settings()
