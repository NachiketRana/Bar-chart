# Project Documentation: Stock Market Dashboard

This document provides a complete overview of your full-stack stock market application. It explains the architecture, how the frontend and backend communicate, and the specific purpose of every important file in your `test` folder.

---

## 🏗️ High-Level Architecture

Your application is divided into three main layers:
1. **Database Layer (PostgreSQL):** Stores historical stock data (Open, High, Low, Close, Volume).
2. **Backend Layer (Node.js & Express):** Connects to the database, processes requests, aggregates data based on timeframes (1D, 1W, 1M, 1Y), and serves it as a REST API.
3. **Frontend Layer (React & Vite):** Fetches data from the backend and renders it into a beautiful, interactive candlestick chart using the `lightweight-charts` library.

---

## 🖥️ Backend (`my-node-project`)

The backend is an Express API that serves stock data to the frontend.

### `server.js`
**Purpose:** The entry point of your backend application.
**How it works:** It initializes the Express server, enables `cors` (so your React app on port 5173 can talk to your backend on port 5000), parses incoming JSON, and mounts your API routes at the `/api/stocks` prefix. It listens for requests on port 5000.

### `src/routes/data_routes.js`
**Purpose:** The "Menu" of your API.
**How it works:** This file defines the specific URL paths a user can visit. Since it is mounted at `/api/stocks` in `server.js`, a route defined here as `/:symbol` actually maps to `http://localhost:5000/api/stocks/AAPL`. When a route is hit, it passes the request to the appropriate function in the controller.

### `src/controllers/data.controller.js`
**Purpose:** The "Brain" of your API.
**How it works:** This file contains the actual logic for fetching data. 
- It looks at the query parameters (like `?interval=1w`).
- It maps the interval to a PostgreSQL timeframe (`day`, `week`, `month`, `year`).
- It runs complex SQL queries using `DATE_TRUNC` to group the data by time, and `ARRAY_AGG` to figure out the exact open and close prices for that timeframe.
- It returns the final aggregated data as a JSON response.

### `src/database/connection.js` & `pool.js`
**Purpose:** Establishes the connection to PostgreSQL.
**How it works:** It uses the `pg` (node-postgres) library to create a connection pool. It reads your database credentials from a `.env` file and allows the controller to safely query the database.

### `seedStocks.js`
**Purpose:** A utility script to populate your database with fake data.
**How it works:** When you run this file, it deletes everything in the `stock_intraday` table and inserts 5 years of randomized, realistic-looking daily stock data for AAPL, MSFT, and GOOGL.

---

## 🎨 Frontend (`my-react-app`)

The frontend is a React Single Page Application (SPA) built with Vite.

### `src/App.jsx`
**Purpose:** The main layout and state manager.
**How it works:** 
- It manages the state for the selected stock (`selectedSymbol`) and the selected timeframe (`intervalState`).
- It contains a `useEffect` hook that uses the native `fetch` API to request data from your backend (`http://localhost:5000/api/stocks/?interval=1d`).
- It renders the UI controls (the Dropdown menu and the 1D/1W/1M/1Y buttons).
- It passes the fetched, filtered data down to the chart component as "props".

### `src/components/CandlestickChart.jsx`
**Purpose:** The visual centerpiece of the app.
**How it works:** 
- It uses the `lightweight-charts` library to draw a highly interactive canvas chart.
- **Data Formatting:** It converts the raw dates from your backend into Unix timestamps that the chart understands.
- **Indicators:** It contains mathematical functions to calculate the EMA 20 (Exponential Moving Average) and SMA 50 (Simple Moving Average) directly in the browser when you click the toggle buttons.
- **Volume Pane:** It configures a secondary `HistogramSeries` to sit cleanly at the bottom 20% of the chart to show trading volume.
- **Tooltip:** It listens to your mouse movements (`subscribeCrosshairMove`) and updates a custom HTML legend with the exact OHLCV and indicator values for whatever candle you are hovering over.

### `package.json` (Root Folder)
**Purpose:** Manages the entire workspace.
**How it works:** We installed a tool called `concurrently` here. When you type `npm run dev` in the root folder, it reads this file and automatically boots up both your Node.js backend and your React frontend at the exact same time.

---

## 🔄 Data Flow Summary
1. User clicks the **"1W"** button in `App.jsx`.
2. `App.jsx` updates its state and sends a `GET` request to `http://localhost:5000/api/stocks/?interval=1w`.
3. `server.js` receives the request and sends it to `data_routes.js`.
4. `data_routes.js` triggers the `getData` function inside `data.controller.js`.
5. `data.controller.js` connects to PostgreSQL, tells it to group the 5 years of daily data into weekly chunks using `DATE_TRUNC`, and sends the result back as JSON.
6. `App.jsx` receives the JSON and hands it to `CandlestickChart.jsx`.
7. `CandlestickChart.jsx` calculates the new EMA/SMA lines and paints the updated weekly candles and volume bars onto the screen.
