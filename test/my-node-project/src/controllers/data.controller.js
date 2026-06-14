import db from '../database/connection.js';

// Ensure DDL constraint exists to enable upserts on startup
const ensureUniqueConstraint = async () => {
  try {
    await db.query(`
      ALTER TABLE stock_intraday 
      ADD CONSTRAINT unique_symbol_datetime UNIQUE (symbol, datetime)
    `);
    console.log("PostgreSQL: unique constraint verified/created.");
  } catch (err) {
    // Constraint already exists, ignore
  }
};
ensureUniqueConstraint();

// Sync live data from Yahoo Finance Chart API and cache inside Postgres database
const syncYahooFinanceToDb = async (symbol, interval) => {
  if (!symbol) return;
  const symbolUpper = symbol.toUpperCase();
  
  // Define timeframes, fetch ranges and cache expiry thresholds
  const intervalConfigs = {
    '1h': { yfInterval: '1h', range: '60d', ageMs: 15 * 60 * 1000 },        // 15 min cache expiry
    '1d': { yfInterval: '1d', range: 'max', ageMs: 2 * 60 * 60 * 1000 },     // 2 hour cache expiry
    '1w': { yfInterval: '1wk', range: 'max', ageMs: 12 * 60 * 60 * 1000 },   // 12 hour cache expiry
    '1m': { yfInterval: '1mo', range: 'max', ageMs: 24 * 60 * 60 * 1000 }   // 24 hour cache expiry
  };
  
  const config = intervalConfigs[interval.toLowerCase()] || intervalConfigs['1d'];
  
  // 1. Check if database has fresh data for this symbol
  try {
    const checkRes = await db.query(
      'SELECT MIN(datetime) as earliest, MAX(datetime) as latest FROM stock_intraday WHERE symbol = $1',
      [symbolUpper]
    );
    const earliest = checkRes.rows[0]?.earliest;
    const latest = checkRes.rows[0]?.latest;
    
    if (latest && earliest) {
      const earliestMs = new Date(earliest).getTime();
      const latestMs = new Date(latest).getTime();
      const nowMs = Date.now();
      
      const cachedYears = (latestMs - earliestMs) / (365.25 * 24 * 60 * 60 * 1000);
      const isFresh = (nowMs - latestMs < config.ageMs);
      
      // If we configured a 'max' sync, but database only has a small sliver (e.g. less than 15 years),
      // we bypass cache hit and trigger a full sync to populate history.
      const needsFullSync = (config.range === 'max' && cachedYears < 15);
      
      if (!needsFullSync && isFresh) {
        console.log(`[Cache Hit] Serving ${symbolUpper} (${interval}) from PostgreSQL`);
        return;
      }
    }
  } catch (err) {
    console.warn(`[Cache Check Warn] Proceeding to sync ${symbolUpper}:`, err.message);
  }
  
  // 2. Fetch live data from Yahoo Finance Chart API
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbolUpper}?interval=${config.yfInterval}&range=${config.range}`;
  console.log(`[Cache Sync] Fetching ${symbolUpper} from Yahoo Finance: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Yahoo API returned status ${res.status}`);
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error("No chart result returned from Yahoo Finance API");
    }
    
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const { open, high, low, close, volume } = quote;
    
    if (timestamps.length === 0 || !close) {
      console.warn(`[Cache Sync Warn] No candles returned for ${symbolUpper}.`);
      return;
    }
    
    // 3. Upsert rows into Postgres
    let upsertCount = 0;
    for (let i = 0; i < timestamps.length; i++) {
      const op = parseFloat(open[i]);
      const hi = parseFloat(high[i]);
      const lo = parseFloat(low[i]);
      const cl = parseFloat(close[i]);
      const vol = parseInt(volume[i]);
      
      // Skip empty or invalid candles
      if (isNaN(op) || isNaN(hi) || isNaN(lo) || isNaN(cl)) {
        continue;
      }
      
      const dt = new Date(timestamps[i] * 1000).toISOString();
      const finalVol = isNaN(vol) ? 0 : vol;
      
      await db.query(`
        INSERT INTO stock_intraday(symbol, open, high, low, close, volume, datetime)
        VALUES($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol, datetime) 
        DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume
      `, [symbolUpper, op, hi, lo, cl, finalVol, dt]);
      
      upsertCount++;
    }
    
    console.log(`[Cache Sync Done] Synced ${symbolUpper}: upserted ${upsertCount} rows.`);
    
  } catch (err) {
    console.error(`[Cache Sync Error] Sync failed for ${symbolUpper}:`, err.message);
  }
};

// Helper function to calculate basic indicators (SMA/EMA)
const calculateIndicators = (data) => {
  const groupedBySymbol = {};
  for (const row of data) {
    if (!groupedBySymbol[row.symbol]) groupedBySymbol[row.symbol] = [];
    groupedBySymbol[row.symbol].push(row);
  }

  for (const symbol in groupedBySymbol) {
    const symbolData = groupedBySymbol[symbol];
    
    // SMA 50
    const smaPeriod = 50;
    for (let i = 0; i < symbolData.length; i++) {
      if (i >= smaPeriod - 1) {
        let sum = 0;
        for (let j = i - smaPeriod + 1; j <= i; j++) {
          sum += parseFloat(symbolData[j].close);
        }
        symbolData[i].sma50 = sum / smaPeriod;
      } else {
        symbolData[i].sma50 = null;
      }
    }

    // EMA 20
    const emaPeriod = 20;
    const k = 2 / (emaPeriod + 1);
    let ema = null;
    
    for (let i = 0; i < symbolData.length; i++) {
      const close = parseFloat(symbolData[i].close);
      if (i === 0) {
        ema = close;
      } else {
        ema = (close - ema) * k + ema;
      }
      
      if (i >= emaPeriod - 1) {
         symbolData[i].ema20 = ema;
      } else {
         symbolData[i].ema20 = null;
      }
    }
  }
  return data;
};

// GET /data?symbol=AAPL&interval=1d  OR  GET /data
export const getData = async (req, res) => {
  try {
    const { symbol, interval, limitYears } = req.query;
    
    const requestSymbol = symbol || 'AAPL';
    const requestInterval = interval || '1d';

    // Default to 'day' if not provided or invalid
    const intervalMap = {
      '1h': 'hour',
      '1d': 'day',
      '1w': 'week',
      '1m': 'month',
      '1y': 'year'
    };
    const truncType = intervalMap[requestInterval.toLowerCase()] || 'day';
    
    // 1. Sync database cache with Yahoo Finance live data
    await syncYahooFinanceToDb(requestSymbol, requestInterval);

    // 2. Query database as single source of truth
    const dateSelector = truncType === 'hour'
      ? `DATE_TRUNC('hour', datetime) AS date`
      : `DATE(DATE_TRUNC('${truncType}', datetime)) AS date`;

    let query = `
      SELECT
        symbol,
        ${dateSelector},
        (ARRAY_AGG(open  ORDER BY datetime ASC))[1] AS open,
        MAX(high)                                   AS high,
        MIN(low)                                    AS low,
        (ARRAY_AGG(close ORDER BY datetime DESC))[1] AS close,
        SUM(volume)                                 AS volume
      FROM stock_intraday
      WHERE symbol = $1 ${limitYears ? `AND datetime >= NOW() - INTERVAL '${parseInt(limitYears)} years'` : ''}
      GROUP BY symbol, DATE_TRUNC('${truncType}', datetime)
      ORDER BY date ASC
    `;
    const params = [requestSymbol.toUpperCase()];

    const { rows } = await db.query(query, params);
    const enrichedRows = calculateIndicators(rows);
    return res.json(enrichedRows);
  } catch (err) {
    console.error('getData error:', err.stack || err);
    return res.status(500).json({ error: err.message || 'Failed to fetch data' });
  }
};

export const createData = async (req, res) => {
  try {
    const { symbol, open, high, low, close, volume, datetime } = req.body;
    const { rows } = await db.query(
      'INSERT INTO stock_intraday(symbol, open, high, low, close, volume, datetime) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [symbol, open, high, low, close, volume, datetime]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createData error:', err.stack || err);
    return res.status(500).json({ error: err.message || 'Failed to create data' });
  }
};
