# 📈 Full-Stack Stock Market Dashboard & Elliott Wave System

A comprehensive stock analysis repository featuring two major systems:
1. **Full-Stack Stock Dashboard:** A real-time responsive dashboard powered by React (Vite), Node.js (Express), PostgreSQL, and Lightweight Charts.
2. **Elliott Wave Analysis System:** A Python-based algorithmic CLI scanner & detector that identifies Elliott Wave setups, computes oscillators, scans Nifty 50, and generates interactive HTML visualizations.

---

## 📂 Project Structure

```text
├── elliott_wave_system/        # 🐍 Python Elliott Wave System
│   ├── app.py                  # Streamlit application entry (optional visual dashboard)
│   ├── main.py                 # CLI entry point (scans and analyses)
│   ├── data_loader.py          # Fetches historical data via yfinance
│   ├── indicators.py           # Technical indicators logic (RSI, EWO, etc.)
│   ├── wave_detector.py        # Algorithmic wave and signal detection
│   ├── scanner.py              # Batch scanner logic for Nifty 50
│   ├── visualization.py        # Plotly chart configuration
│   └── requirements.txt        # Python dependency manifest
│
├── test/                       # 🌐 Full-Stack Node/React Dashboard
│   ├── my-node-project/        # Node.js & Express REST API Backend
│   │   ├── src/                # Backend source (controllers, database pools, routes)
│   │   ├── server.js           # Server start script
│   │   ├── seedStocks.js       # Database seeder utility
│   │   └── .env.example        # Environment variable template
│   │
│   ├── my-react-app/           # React & Vite Frontend Dashboard
│   │   ├── src/                # React source code (components, custom charts, styles)
│   │   ├── index.html          # HTML shell
│   │   └── vite.config.js      # Vite configuration
│   │
│   ├── package.json            # Root workspace config (coordinates frontend/backend run)
│   └── node_modules/           # Core npm packages
│
├── .gitignore                  # Git exclude manifest
└── README.md                   # Project index documentation (this file)
```

---

## 🌐 1. Full-Stack Stock Dashboard Setup (`test/`)

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database running locally or in the cloud

### Backend Database Configuration
1. Create a PostgreSQL database (e.g., named `postgres` or `stock_dashboard`).
2. Create a table named `stock_intraday` to store stock records.
3. Navigate to the backend directory:
   ```bash
   cd test/my-node-project
   ```
4. Copy the `.env.example` file to create your own configuration:
   ```bash
   cp .env.example .env
   ```
5. Edit your `.env` file with your actual database URL and credentials:
   ```env
   DATABASE_URL=postgres://your_user:your_password@localhost:5432/your_database
   PORT=5000
   ```
6. Install dependencies and run the seeder script to populate 5 years of daily stock data for testing:
   ```bash
   npm install
   node seedStocks.js
   ```

### Running the Whole Dashboard (Frontend + Backend)
You can start both the Node.js backend API and the React Vite dev server concurrently with a single command:
1. Navigate to the `test/` directory:
   ```bash
   cd test
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development environment:
   ```bash
   npm run dev
   ```
- **Backend API:** Available at `http://localhost:5000`
- **React Frontend:** Open `http://localhost:5173` in your browser

---

## 🐍 2. Elliott Wave System Setup (`elliott_wave_system/`)

A command-line tool that downloads stock market data, identifies Elliott Wave patterns, computes indicators like the Elliott Wave Oscillator (EWO), and scans the Nifty 50 index for trade signals.

### Installation
1. Navigate to the Python project directory:
   ```bash
   cd elliott_wave_system
   ```
2. Install the required libraries (virtual environment recommended):
   ```bash
   pip install -r requirements.txt
   ```

### Usage Instructions

#### Run Analysis on a Single Stock
Run wave analysis on a stock ticker (e.g., `TCS.NS` or `AAPL`) and output an interactive HTML chart:
```bash
python main.py --symbol TCS.NS --interval 1d --period 1y
```
- The interactive Plotly chart will be saved as `TCS_NS_chart.html` in the root folder.

#### Run a Batch Scan on Nifty 50 Stocks
Scan the Nifty 50 index for active buy/sell trade configurations based on Elliott Wave triggers:
```bash
python main.py --scan --interval 1d
```

---

## 🛠️ Tech Stack & Key Libraries
- **Frontend:** React, Vite, CSS, Lightweight Charts (by TradingView)
- **Backend:** Node.js, Express, `pg` (node-postgres), Nodemon
- **Database:** PostgreSQL
- **Python analysis:** `yfinance`, `pandas`, `numpy`, `ta` (Technical Analysis library), `plotly`

---

## 🛡️ Security & Housekeeping
- Environment files (`.env`) are excluded from Git to prevent database credentials leak.
- Large folders like `node_modules/` and Python `__pycache__/` are ignored automatically via `.gitignore`.
- Always use the `.env.example` template when deploying on staging or production.
