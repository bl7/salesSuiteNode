import { pool } from '../src/db/pool';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding lead_id and shop_id to tasks table...');
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL
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
