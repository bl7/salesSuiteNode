
import { pool } from '../src/db/pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration: Adding missing columns to visits table...');
    await client.query('BEGIN');

    const columns = [
      { name: 'is_verified', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'distance_m', type: 'DOUBLE PRECISION' },
      { name: 'verification_method', type: 'TEXT DEFAULT \'none\'' },
      { name: 'gps_accuracy_m', type: 'DOUBLE PRECISION' },
      { name: 'exception_reason', type: 'TEXT' },
      { name: 'exception_note', type: 'TEXT' },
      { name: 'verified_at', type: 'TIMESTAMP' },
      { name: 'end_lat', type: 'DOUBLE PRECISION' },
      { name: 'end_lng', type: 'DOUBLE PRECISION' }
    ];

    for (const col of columns) {
      await client.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`Checked/Added column: ${col.name}`);
    }

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
