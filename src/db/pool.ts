import { Pool, PoolConfig } from 'pg';
import { env } from '../config/env';

// Remove sslmode from connection string as we'll configure SSL separately
const connectionString = env.DATABASE_URL.replace(/[?&]sslmode=\w+/, '');

const poolConfig: PoolConfig = {
  connectionString,
  ssl: {
    rejectUnauthorized: false, // For Aiven and other cloud providers with self-signed certs
  },
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

// Test the connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
