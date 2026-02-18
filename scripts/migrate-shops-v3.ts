import { pool } from '../src/db/pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating shops table (v3) - Adding metadata fields...');
    await client.query('BEGIN');
    
    // Add missing columns for premium shop metadata
    await client.query(`
      ALTER TABLE shops 
      ADD COLUMN IF NOT EXISTS operating_hours TEXT,
      ADD COLUMN IF NOT EXISTS preferred_visit_days TEXT,
      ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'up_to_date'
    `);
    
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
