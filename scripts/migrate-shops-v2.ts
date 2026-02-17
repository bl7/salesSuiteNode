import { pool } from '../src/db/pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating shops table...');
    await client.query('BEGIN');
    
    // Add missing columns
    await client.query(`
      ALTER TABLE shops 
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS contact_name TEXT,
      ADD COLUMN IF NOT EXISTS contact_email TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT
    `);
    
    // Make latitude and longitude optional
    await client.query(`
      ALTER TABLE shops 
      ALTER COLUMN latitude DROP NOT NULL,
      ALTER COLUMN longitude DROP NOT NULL
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
