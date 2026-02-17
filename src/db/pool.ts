import { Pool, PoolConfig } from 'pg';
import { env } from '../config/env';

// Remove sslmode from connection string as we'll configure SSL separately
const connectionString = env.DATABASE_URL.replace(/[?&]sslmode=\w+/, '');

const poolConfig: PoolConfig = {
  connectionString,
  ssl: {
    rejectUnauthorized: false, // For Aiven and other cloud providers with self-signed certs
  },
  max: 5, // Aiven Free tier only allows 5 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

// Test the connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
