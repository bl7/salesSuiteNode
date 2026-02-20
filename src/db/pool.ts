import { Pool, PoolConfig, types } from 'pg';

// Override the default parsing for timestamp without time zone (OID 1114)
// This forces node-postgres to treat the incoming timestamp as UTC, ignoring the Node server's local timezone.
types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + "Z");
});
import { env } from '../config/env';

// Remove sslmode from connection string as we'll configure SSL separately
const connectionString = env.DATABASE_URL.replace(/[?&]sslmode=\w+/, '');

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const poolConfig: PoolConfig = {
  connectionString,
  ssl: isLocal ? false : {
    rejectUnauthorized: false,
  },
  max: 25, // Optimized for VPS (Adjust based on your VPS RAM/CPU)
  idleTimeoutMillis: 60000, // Keep idle connections open longer to reduce handshake overhead
  connectionTimeoutMillis: 15000, // 15s timeout for initial connection over WAN
};

export const pool = new Pool(poolConfig);

// Test the connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
