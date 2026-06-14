import db from './src/database/connection.js';

// Sample day-wise data for AAPL, MSFT and GOOGL (last 1300 trading days = ~5 years)
const generateDayData = (symbol, basePrice, startDate) => {
  const rows = [];
  let price = basePrice;
  const date = new Date(startDate);

  for (let i = 0; i < 1300; i++) {
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }

    const change = (Math.random() - 0.48) * price * 0.02; // slight upward bias
    const open = parseFloat(price.toFixed(2));
    const close = parseFloat((price + change).toFixed(2));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * 0.005).toFixed(2));
    const low  = parseFloat((Math.min(open, close) - Math.random() * price * 0.005).toFixed(2));
    const volume = Math.floor(Math.random() * 20000000 + 5000000);

    // Store as a single row per day at market open time (09:30)
    const datetime = new Date(date);
    datetime.setHours(9, 30, 0, 0);

    rows.push({ symbol, open, high, low, close, volume, datetime: datetime.toISOString() });

    price = close;
    date.setDate(date.getDate() + 1);
  }

  return rows;
};

const seed = async () => {
  try {
    console.log('Clearing existing data...');
    await db.query('DELETE FROM stock_intraday');

    const toSeed = [];
    // Start date approx 5 years ago from May 2026 -> May 2021
    toSeed.push(...generateDayData('AAPL', 130, '2021-05-01'));
    toSeed.push(...generateDayData('MSFT', 250, '2021-05-01'));
    toSeed.push(...generateDayData('GOOGL', 110, '2021-05-01'));
    toSeed.push(...generateDayData('AMZN', 160, '2021-05-01'));
    toSeed.push(...generateDayData('META', 300, '2021-05-01'));
    toSeed.push(...generateDayData('TSLA', 200, '2021-05-01'));
    toSeed.push(...generateDayData('NVDA', 150, '2021-05-01'));
    toSeed.push(...generateDayData('NFLX', 500, '2021-05-01'));
    toSeed.push(...generateDayData('AMD', 80, '2021-05-01'));
    toSeed.push(...generateDayData('INTC', 50, '2021-05-01'));

    for (const row of toSeed) {
      await db.query(
        'INSERT INTO stock_intraday(symbol, open, high, low, close, volume, datetime) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [row.symbol, row.open, row.high, row.low, row.close, row.volume, row.datetime]
      );
    }

    console.log(`✅ Seeded ${toSeed.length} rows for: ${[...new Set(toSeed.map(r => r.symbol))].join(', ')}`);
  } catch (e) {
    console.error('Seed error:', e.stack || e);
  } finally {
    process.exit();
  }
};

seed();
