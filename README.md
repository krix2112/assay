# Assay

Assay is a daily intelligence tool that monitors and compares Multi Commodity Exchange of India (MCX) gold futures contracts—specifically GOLDM (100g), GOLDTEN (10g), GOLDGUINEA (8g), and GOLDPETAL (1g)—to identify pricing disparities, evaluate liquidity profiles, and surface actionable parity insights.

---

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Python 3.12](https://www.python.org/) & [uv](https://docs.astral.sh/uv/)
- [Node.js 20+](https://nodejs.org/) & npm

---

## Local Development Setup

### 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

---

### 2. Step-by-Step Execution

#### Step 1: Start the PostgreSQL Database
Launch the PostgreSQL 16 container with the named volume:
```bash
docker compose up -d assay-db
```

#### Step 2: Apply Database Migrations
Navigate to the backend directory and run Alembic migrations:
```bash
cd backend
uv sync
uv run alembic upgrade head
```

#### Step 3: Start the Backend API
Start the FastAPI server with hot-reload enabled:
```bash
uv run uvicorn app.main:app --reload --port 8000
```
The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs) and health status at [http://localhost:8000/health](http://localhost:8000/health).

#### Step 4: Start the Frontend Application
In a separate terminal, install dependencies and launch the Next.js development server:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality & Testing Commands

### Backend
Run linting, static type checking, and automated tests from the `backend/` directory:
```bash
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest
```

### Frontend
Run linting and build validation from the `frontend/` directory:
```bash
cd frontend
npm run lint
npm run build
```

---

## Recreating the Local Database Volume

If you need to reset the local database and recreate the Docker volume:
```bash
# Stop containers and remove the named volume
docker compose down -v

# Start the database container with a fresh volume
docker compose up -d assay-db

# Re-run migrations
cd backend
uv run alembic upgrade head
```

---

## Data Sources and Terms

- **No Automated MCX Downloads**: Assay does not automate downloads or scraping from the Multi Commodity Exchange of India (MCX).
- **Manual Import**: Market data is supplied via manual import of Bhavcopy files obtained directly through the official MCX website for personal, non-commercial research purposes.
- **Data Protection**: Raw MCX data files and fixtures are never committed to version control or republished.
- **Live Ingestion**: Automated live fetching is disabled by default (`MCX_LIVE_FETCH_ENABLED=False`) and strictly requires prior written consent from MCX or access via an authorized licensed data feed.
- **Public Database Integrity**: The public database tables must strictly hold only real, manually imported data. Synthetic test fixtures are guarded and prohibited from public tables, executing exclusively in temporary schemas during tests.
