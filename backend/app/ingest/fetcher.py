"""MCX Bhavcopy fetcher with tenacity retry and checksum generation."""

import hashlib
from dataclasses import dataclass
from datetime import UTC, date, datetime

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.core.logging import logger

MCX_BHAVCOPY_URL: str = "https://www.mcxindia.com/market-data/bhavcopy/GetDateWiseBhavCopy"


@dataclass(frozen=True)
class RawFetch:
    """Immutable representation of a raw HTTP fetch response."""

    requested_date: date
    content: bytes
    status_code: int
    fetched_at: datetime
    sha256: str
    url: str


class LiveFetchDisabledError(RuntimeError):
    """Raised when automated MCX live fetching is invoked while disabled."""

    pass


def _should_retry_exception(exc: BaseException) -> bool:
    """Return True if exception is a transient network error or 5xx server error."""
    if isinstance(exc, httpx.RequestError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return False


@retry(
    reraise=True,
    stop=stop_after_attempt(settings.MCX_MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception(_should_retry_exception),
)
def _execute_http_request(
    client: httpx.Client,
    url: str,
    params: dict[str, str],
    headers: dict[str, str],
    timeout: float,
) -> httpx.Response:
    """Execute HTTP GET with tenacity retry policy."""
    response = client.get(url, params=params, headers=headers, timeout=timeout)
    if response.status_code >= 500:
        # Trigger retry for server errors
        response.raise_for_status()
    if 400 <= response.status_code < 500:
        # Client errors must not be retried; raise immediately
        response.raise_for_status()
    return response


def fetch_bhavcopy(
    requested_date: date,
    *,
    client: httpx.Client | None = None,
    url: str | None = None,
    headers: dict[str, str] | None = None,
    timeout: float | None = None,
) -> RawFetch:
    """Download official MCX Bhavcopy for requested_date.

    Refuses execution unless MCX_LIVE_FETCH_ENABLED is True in application settings.

    Args:
        requested_date: Date to query in DD/MM/YYYY format.
        client: Optional httpx.Client instance for testing / reuse.
        url: Optional override URL.
        headers: Optional override headers.
        timeout: Optional timeout in seconds.

    Returns:
        RawFetch instance containing raw response bytes, status, and checksum.
    """
    if not settings.MCX_LIVE_FETCH_ENABLED:
        msg = (
            "Automated MCX live fetching is disabled by default. "
            "Systematic or automated data collection requires prior written consent from MCX. "
            "To load data, use manual import via 'python scripts/import_file.py <path>'."
        )
        logger.warning("MCX live fetch refused", reason="Live fetch disabled by default")
        raise LiveFetchDisabledError(msg)

    target_url = url or settings.MCX_BHAVCOPY_URL or MCX_BHAVCOPY_URL
    req_timeout = timeout if timeout is not None else settings.MCX_REQUEST_TIMEOUT_SECONDS

    # MCX date format is DD/MM/YYYY
    formatted_date = requested_date.strftime("%d/%m/%Y")
    params = {
        "InstrumentName": "FUTCOM",
        "fromDate": formatted_date,
    }

    # Honest header without browser spoofing
    request_headers = {
        "User-Agent": settings.MCX_USER_AGENT,
        "Accept": "application/json",
    }
    if headers:
        request_headers.update(headers)

    logger.info(
        "Fetching MCX bhavcopy",
        requested_date=requested_date.isoformat(),
        url=target_url,
    )

    fetched_at = datetime.now(UTC)

    own_client = False
    if client is None:
        client = httpx.Client()
        own_client = True

    try:
        response = _execute_http_request(
            client=client,
            url=target_url,
            params=params,
            headers=request_headers,
            timeout=req_timeout,
        )
        content_bytes = response.content
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

        return RawFetch(
            requested_date=requested_date,
            content=content_bytes,
            status_code=response.status_code,
            fetched_at=fetched_at,
            sha256=sha256_hash,
            url=str(response.url),
        )
    finally:
        if own_client:
            client.close()
