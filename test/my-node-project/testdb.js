import db from './src/database/connection.js';
const run = async () => {
  try {
    const r = await db.query(`
      SELECT symbol, count(*) as count
      FROM stock_intraday
      GROUP BY symbol
      ORDER BY count DESC
    `);
    console.log(r.rows);
  } catch (e) { console.error(e.stack || e); }
  process.exit();
};
run();