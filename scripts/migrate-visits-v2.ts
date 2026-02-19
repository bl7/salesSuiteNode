import { pool } from '../src/db/pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding end_lat, end_lng, verified_at to visits table...');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE visits
      ADD COLUMN IF NOT EXISTS end_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS end_lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
