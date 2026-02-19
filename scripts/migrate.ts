import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load .env relative to project root
dotenv.config({ path: join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL matching .env not found!");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run migrate <migration-file>");
    process.exit(1);
  }

  try {
    const sql = readFileSync(file, 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log("✅ Migration completed successfully");
    await pool.end();
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    await pool.end();
    process.exit(1);
  }
}

run();
