// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// Mock database data for 3 stocks
const stockData = {
  "AAPL": [
    { time: '2024-04-01', value: 170.21 },
    { time: '2024-04-02', value: 171.10 },
    // ... add 2 months of data here
  ],
  "GOOGL": [ /* ... data ... */],
  "TSLA": [ /* ... data ... */]
};

app.get('/api/stocks/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const data = stockData[symbol];
  if (data) {
    res.json(data);
  } else {
    res.status(404).send('Stock not found');
  }
});

app.listen(5000, () => console.log('Backend running on port 5000'));