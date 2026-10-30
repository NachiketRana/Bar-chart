# Algorithmic Trading & Analytics Dashboard (PERN + Python Quantitative Engine)

![Dashboard Screenshot](link_to_image)

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15_Alpine-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

An enterprise-grade, full-stack quantitative financial analysis platform built on the **PERN stack (PostgreSQL, Express, React, Node.js)** and integrated with a **Python Algorithmic Elliott Wave Detection Engine**. 

Designed for low-latency time-series analysis, the system features a **hybrid Cache-Aside database pipeline** that serves multi-timeframe market telemetry from local storage while dynamically synchronizing upstream financial feeds with sub-minute failover and atomic upserts.

---

## 🛠 Tech Stack

| Layer | Technologies | Architectural Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Lightweight Charts (Canvas/WebGL), Lucide Icons | High-throughput sub-millisecond candlestick chart rendering and interactive multi-timeframe exploration. |
| **Backend API** | Node.js (ESM), Express.js, `pg` (Connection Pooling) | RESTful API gateway, automated DDL constraint validation, and multi-tiered cache invalidation logic. |
| **Database** | PostgreSQL 15 (Alpine), Docker Volume (`pgdata`) | ACID-compliant time-series storage with composite index deduplication `(symbol, datetime)`. |
| **Quant Engine** | Python 3.11, Pandas, NumPy, YFinance, SciPy | Algorithmic ZigZag pivot identification, 5-wave impulse & 3-wave corrective pattern matching, and Fibonacci target forecasting. |
| **Infrastructure** | Docker, Docker Compose, Alpine Linux | Multi-stage, containerized orchestration with service dependency healthchecks (`pg_isready`) and bridge networking. |

---

## 🏛 System Architecture & Data Flow

```
   ┌──────────────────────────────────────────────────────────────┐
   │                     Client Browser (React 19)                │
   │      - TradingView Lightweight Charts (WebGL/Canvas)         │
   │      - Multi-timeframe Selector (1h, 1d, 1w, 1m)             │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ HTTP GET /api/stocks/:symbol?interval=
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                   API Gateway (Node.js / Express)            │
   │     1. Evaluates cache freshness against PostgreSQL          │
   └───────────────┬──────────────────────────────▲───────────────┘
                   │                              │
        [Cache Miss or Stale]              [Cache Hit]
                   │                              │
                   ▼                              │
   ┌──────────────────────────────┐               │
   │   Yahoo Finance Chart API    │               │
   │   (Upstream Streaming Feed)  │               │
   └───────────────┬──────────────┘               │
                   │ Raw Candles                  │
                   ▼                              │
   ┌──────────────────────────────────────────────┴───────────────┐
   │                     PostgreSQL 15 Engine                     │
   │                                                              │
   │  - Schema: stock_intraday(symbol, open, high, low, close...) │
   │  - Constraint: UNIQUE (symbol, datetime)                     │
   │  - Query: ON CONFLICT DO UPDATE SET (Atomic Upsert)          │
   └──────────────────────────────▲───────────────────────────────┘
                                  │ Direct Ingestion
   ┌──────────────────────────────┴───────────────────────────────┐
   │         Python 3.11 Elliott Wave & Quantitative Engine       │
   │  - ZigZag Adaptive Peak / Trough Extrema Filtering          │
   │  - Motive (1-5) & Corrective (A-B-C) Wave Validation         │
   │  - RSI / Elliott Wave Oscillator (EWO) Divergence Signals    │
   │  - Automated CLI Scanner across Nifty 50 & Equities          │
   └──────────────────────────────────────────────────────────────┘
```

### 1. Hybrid Cache-Aside Ingestion Layer
To prevent rate-limiting against upstream market feeds and guarantee deterministic query latencies under concurrent client load, the Express service implements a **Cache-Aside / Write-Through** pattern:

1. **Staleness Evaluation:** When a client requests OHLCV data for an equity symbol, the backend queries `SELECT MIN(datetime) as earliest, MAX(datetime) as latest FROM stock_intraday WHERE symbol = $1`.
2. **Multi-Tiered Time-to-Live (TTL) Policy:** The delta `(Date.now() - latest)` is evaluated against interval-specific thresholds:
   - **`1h` Interval:** `15 Minutes` TTL (captures intraday volatility while minimizing API overhead).
   - **`1d` Interval:** `2 Hours` TTL (aligns with end-of-day settlement windows).
   - **`1w` Interval:** `12 Hours` TTL.
   - **`1m` Interval:** `24 Hours` TTL.
3. **Atomic Upsert Pipeline:** On a cache miss or threshold expiration, the service streams new candles from the Yahoo Finance chart endpoint and dispatches a bulk PostgreSQL upsert:
   ```sql
   INSERT INTO stock_intraday (symbol, open, high, low, close, volume, datetime)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (symbol, datetime) 
   DO UPDATE SET 
       open = EXCLUDED.open,
       high = EXCLUDED.high,
       low = EXCLUDED.low,
       close = EXCLUDED.close,
       volume = EXCLUDED.volume;
   ```
4. **Single Source of Truth:** The API queries and returns validated, deduped time-series data exclusively from PostgreSQL, guaranteeing data consistency.

### 2. Algorithmic Elliott Wave Engine (Python)
The repository contains an algorithmic wave pattern detector located in `elliott_wave_system/`:
- **ZigZag Pivot Filter:** Eliminates sub-threshold market noise via dynamic percentage-based swing-reversal detection.
- **Structural Validation:** Implements strict Elliott Wave structural rules (e.g., Wave 2 does not retrace >100% of Wave 1; Wave 3 is never the shortest impulse wave; Wave 4 does not enter Wave 1 price territory).
- **Oscillator Divergence:** Cross-references price action against the **Elliott Wave Oscillator (EWO = SMA 5 - SMA 35)** and **RSI** to pinpoint high-probability Wave 3 expansions and Wave 5 terminal divergences.
- **Fibonacci Target Projection:** Automatically calculates extension clusters ($1.618, $2.618$) and retracement zones ($0.382, $0.500, $0.618$).

---

## 🚀 Local Setup & Deployment

The application is containerized with Docker Compose to eliminate environment configuration drift.

### Prerequisites
- [Docker Engine](https://docs.docker.com/engine/install/) (v24.x+) & [Docker Compose](https://docs.docker.com/compose/) (v2.x+)
- (Optional for standalone Python scripts) Python 3.11+ and Node.js 20+

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/NachiketRana/Bar-chart.git
cd Bar-chart

# 2. Configure environment variables from template
cp .env.example .env

# 3. Spin up the entire infrastructure stack (PostgreSQL, Backend, Frontend)
docker compose up --build
```

### Access Endpoints
Once the containers pass their healthchecks, the application is live at:
- **Web Frontend Dashboard:** `http://localhost:5173`
- **Express REST API:** `http://localhost:5000`
- **PostgreSQL Database:** `localhost:5432` (`postgres` / `postgres`)

### Running the Python Elliott Wave Engine Standalone
```bash
# Install Python dependencies
pip install -r elliott_wave_system/requirements.txt

# Run single-symbol analysis with interactive chart generation
python elliott_wave_system/main.py --symbol INFY.NS --interval 1d --period 1y

# Run batch scanner across Nifty 50 constituents
python elliott_wave_system/main.py --scan --interval 1d
```

---

## 🔒 Security & Reliability Architecture
- **Zero Hardcoded Secrets:** Connection strings and credentials are injected exclusively at runtime via Docker secrets / environment variables.
- **Fail-Safe Startup Ordering:** The Node backend uses Docker Compose healthchecks (`pg_isready`) with retry intervals to prevent startup race conditions before database initialization.
- **Data Persistence:** Database state is mounted to an isolated local Docker volume (`pgdata`), ensuring complete persistence across container lifecycle events.

---

## ⚠️ Disclaimer

This software is developed strictly for educational and technical research purposes. Nothing contained within this codebase or generated reports constitutes financial, investment, or trading advice. Past performance and algorithmic wave projections do not guarantee future market results.
