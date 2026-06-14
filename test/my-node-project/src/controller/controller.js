// This file exports functions that handle the business logic for various routes.

const pool = require('../database/connection');

const getData = async (req, res) => {
  try {
    // replace 'stocks' with your actual table name created by day_stock.py
    const { rows } = await pool.query('SELECT * FROM stock_intraday ORDER BY time DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};

const createData = async (req, res) => {
  try {
    const { symbol, price, time } = req.body;
    const result = await db.query(
      'INSERT INTO stocks(symbol, price, time) VALUES($1,$2,$3) RETURNING *',
      [symbol, price, time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create data' });
  }
};

module.exports = {
  getData,
  createData,
};