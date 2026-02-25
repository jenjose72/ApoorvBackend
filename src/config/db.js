// Database configuration for Neon (Postgres)
// Reads connection string from .env: set DATABASE_URL or NEON_DATABASE_URL
// Example .env entry:
// 

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Prefer DATABASE_URL, fall back to NEON_DATABASE_URL
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';

if (!connectionString) {
	console.warn('Warning: no DATABASE_URL or NEON_DATABASE_URL found in environment. Database will not be connected.');
}

// Neon/Postgres typically requires SSL. We set rejectUnauthorized=false to allow self-signed certs
// when connecting to some serverless providers. Adjust if you have a CA-signed cert.
const pool = new Pool({
	connectionString: connectionString || undefined,
	ssl: connectionString ? { rejectUnauthorized: false } : false,
	max: Number(process.env.PG_MAX_CLIENTS) || 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
	console.error('Unexpected error on idle Postgres client', err);
});

/**
 * Simple query helper.
 * Usage:
 * import { query } from './src/config/db.js'
 * const res = await query('SELECT 1');
 */
async function query(text, params) {
	return pool.query(text, params);
}

export { pool, query };

// Optional: export default pool;
