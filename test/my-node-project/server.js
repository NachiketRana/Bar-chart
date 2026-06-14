import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './src/routes/data_routes.js';

const app = express();

// allow everything in dev (safe for local development) - restart nodemon
app.use(cors());            // <--- allow all origins, simpler for testing
app.use(express.json());

// simple request logger to see incoming requests in terminal
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} from ${req.headers.origin || 'unknown'}`);
  next();
});

app.use('/api/stocks', routes); // base URL is now /api/stocks

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
