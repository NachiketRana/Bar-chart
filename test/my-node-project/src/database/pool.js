// database/index.js

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const poolConfig = connectionString ? { connectionString } : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    port: Number(process.env.DB_PORT) || 5432,
};

console.log('Using DB connection:', connectionString ? 'DATABASE_URL' : `user=${poolConfig.user} host=${poolConfig.host} db=${poolConfig.database}`);

const pool = new Pool(poolConfig);

// helper functions
const getData = async (query) => {
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        throw new Error('Error fetching data: ' + error.message);
    }
};

const createData = async (query, values) => {
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        throw new Error('Error creating data: ' + error.message);
    }
};

module.exports = {
    getData,
    createData,
};