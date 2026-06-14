import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(client => {
    client.release();
    console.log('Postgres connected');
  })
  .catch(err => {
    console.error('Postgres connection error:', err.stack || err);
  });

export const query = (text, params) => pool.query(text, params);
export default { query, pool };