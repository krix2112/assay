"""Main FastAPI application entrypoint."""

from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.backtest import router as backtest_router
from app.api.contracts import router as contracts_router
from app.api.data_quality import router as data_quality_router
from app.api.health import router as health_router
from app.api.parity import router as parity_router
from app.api.publish import router as publish_router
from app.api.spreads import router as spreads_router
from app.core.config import settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan events handler for startup and shutdown."""
    setup_logging(environment=settings.ENVIRONMENT)
    if settings.ENVIRONMENT == "production" and settings.MCX_LIVE_FETCH_ENABLED:
        msg = "Startup aborted: Automated MCX live fetching is strictly prohibited in production."
        logger.critical("MCX live fetching prohibited in production", error=msg)
        raise RuntimeError(msg)
    logger.info("Starting Assay API", environment=settings.ENVIRONMENT)
    yield
    logger.info("Shutting down Assay API")


app = FastAPI(
    title="Assay API",
    description="Daily intelligence tool comparing MCX gold futures contracts",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Router prefixes gated in production when PUBLIC_DATA_APPROVED is False
GATED_ROUTE_PREFIXES: tuple[str, ...] = (
    "/data-quality",
    "/contracts",
    "/spreads",
    "/parity",
    "/backtest",
    "/track-record",
)


@app.middleware("http")
async def gate_public_data_approval(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Enforce data approval gate in production for all data router prefixes."""
    if settings.ENVIRONMENT == "production" and not settings.PUBLIC_DATA_APPROVED:
        path = request.url.path
        if any(path.startswith(prefix) for prefix in GATED_ROUTE_PREFIXES):
            return JSONResponse(
                status_code=503,
                content={"detail": "Data not approved for public display"},
            )
    response: Response = await call_next(request)
    return response


app.include_router(health_router)
app.include_router(data_quality_router)
app.include_router(contracts_router)
app.include_router(spreads_router)
app.include_router(parity_router)
app.include_router(backtest_router)
app.include_router(publish_router)
