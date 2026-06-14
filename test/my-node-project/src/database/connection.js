import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',    
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || '8761',        // or set in .env
  port: Number(process.env.DB_PORT) || 5432,
});

pool.connect()
  .then(client => { client.release(); console.log('Postgres connected'); })
  .catch(err => { console.error('Postgres connection error:', err.stack || err); });

export const query = (text, params) => pool.query(text, params);
export default { query, pool };