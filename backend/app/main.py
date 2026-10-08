"""Main FastAPI application entrypoint."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan events handler for startup and shutdown."""
    setup_logging(environment=settings.ENVIRONMENT)
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

app.include_router(health_router)
