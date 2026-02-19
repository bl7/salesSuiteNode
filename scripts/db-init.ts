
import { pool } from '../src/db/pool';

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Starting database initialization...');
    await client.query('BEGIN');

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 1. Companies
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        address TEXT,
        plan TEXT DEFAULT 'free',
        subscription_ends_at TIMESTAMP,
        staff_limit INT DEFAULT 5,
        staff_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created companies table');

    // 2. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified_at TIMESTAMP,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created users table');

    // 3. Company Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('boss', 'manager', 'rep')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
        phone TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, user_id)
      );
    `);
    console.log('Checked/Created company_users table');

    // 4. Email Tokens
    await client.query(`
        CREATE TABLE IF NOT EXISTS email_tokens (
            id TEXT PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            token_type TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('Checked/Created email_tokens table');

    // 5. Shops
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        geofence_radius_m INT DEFAULT 100,
        external_shop_code TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created shops table');

    // 6. Shop Assignments
    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
        company_user_id UUID REFERENCES company_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(shop_id, company_user_id)
      );
    `);
    console.log('Checked/Created shop_assignments table');

    // 7. Leads
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        status TEXT DEFAULT 'new',
        assigned_rep_company_user_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        created_by_company_user_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        notes TEXT,
        converted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created leads table');

    // 8. Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sku TEXT,
        unit TEXT,
        description TEXT,
        base_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency_code TEXT DEFAULT 'NPR',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created products table');

    // 8b. Product Prices
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10, 2) NOT NULL,
        currency_code TEXT DEFAULT 'NPR',
        starts_at TIMESTAMP DEFAULT NOW(),
        ends_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created product_prices table');

    // 9. Orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
        rep_company_user_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created orders table');

     // 10. Order Items
    await client.query('DROP TABLE IF EXISTS order_items CASCADE');
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        product_name TEXT,
        product_sku TEXT,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        line_total DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Re-created order_items table');

    // 11. Visits
    await client.query('DROP TABLE IF EXISTS visits CASCADE');
    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
        rep_company_user_id UUID REFERENCES company_users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'ongoing',
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        notes TEXT,
        purpose TEXT,
        outcome TEXT,
        image_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        distance_m DOUBLE PRECISION,
        verification_method TEXT DEFAULT 'none',
        gps_accuracy_m DOUBLE PRECISION,
        exception_reason TEXT,
        exception_note TEXT,
        verified_at TIMESTAMP,
        end_lat DOUBLE PRECISION,
        end_lng DOUBLE PRECISION,
        approved_by_manager_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        flagged_by_manager_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        manager_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Re-created visits table');

    // 12. Tasks
    await client.query('DROP TABLE IF EXISTS tasks CASCADE');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        assigned_to_company_user_id UUID REFERENCES company_users(id) ON DELETE CASCADE,
        created_by_company_user_id UUID REFERENCES company_users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        due_date TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Re-created tasks table');

    // 13. Attendance
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        rep_company_user_id UUID REFERENCES company_users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
        timestamp TIMESTAMP DEFAULT NOW(),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Checked/Created attendance table');


    await client.query('COMMIT');
    console.log('Database initialization completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
