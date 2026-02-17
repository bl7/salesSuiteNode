import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Product {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  // Joined
  current_price?: number;
  currency_code?: string;
  order_count?: number;
}

export class ProductRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
    companyId: string;
    name: string;
    sku: string;
    description?: string | null;
    unit: string;
    price: number;
    currencyCode: string; // Add this param
  }, client?: PoolClient): Promise<Product> {
    const dbClient = client || await this.db.connect();
    const shouldRelease = !client;
    
    try {
        if (shouldRelease) await dbClient.query('BEGIN');

        // 1. Create Product
        const insertProductQuery = `
            INSERT INTO products (company_id, name, sku, description, unit, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING *
        `;
        const productRes = await dbClient.query(insertProductQuery, [
            data.companyId, data.name, data.sku, data.description, data.unit
        ]);
        const product = productRes.rows[0];

        // 2. Create Price
        const insertPriceQuery = `
            INSERT INTO product_prices (company_id, product_id, price, currency_code, starts_at)
            VALUES ($1, $2, $3, $4, NOW())
        `;
        await dbClient.query(insertPriceQuery, [
            data.companyId, product.id, data.price, data.currencyCode
        ]);

        if (shouldRelease) await dbClient.query('COMMIT');

        // Return with price attached
        product.current_price = data.price;
        product.currency_code = data.currencyCode;
        return product;

    } catch (e) {
        if (shouldRelease) await dbClient.query('ROLLBACK');
        throw e;
    } finally {
        if (shouldRelease) (dbClient as PoolClient).release();
    }
  }

  async findAll(companyId: string, params: { q?: string; status?: string }): Promise<Product[]> {
    let query = `
      SELECT p.*,
             (SELECT price FROM product_prices pp WHERE pp.product_id = p.id AND pp.ends_at IS NULL ORDER BY pp.starts_at DESC LIMIT 1) as current_price,
             (SELECT currency_code FROM product_prices pp WHERE pp.product_id = p.id AND pp.ends_at IS NULL ORDER BY pp.starts_at DESC LIMIT 1) as currency_code,
             (SELECT count(*)::int FROM order_items oi WHERE oi.product_id = p.id) as order_count
      FROM products p
      WHERE p.company_id = $1
    `;
    const values: any[] = [companyId];
    let idx = 2;

    if (params.status) {
        if (params.status === 'active') query += ` AND p.is_active = true`;
        else if (params.status === 'inactive') query += ` AND p.is_active = false`;
    }

    if (params.q) {
        query += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`;
        values.push(`%${params.q}%`);
    }

    query += ` ORDER BY p.name ASC`;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  async findById(id: string, companyId: string): Promise<Product | undefined> {
    const query = `
      SELECT p.*,
             (SELECT price FROM product_prices pp WHERE pp.product_id = p.id AND pp.ends_at IS NULL ORDER BY pp.starts_at DESC LIMIT 1) as current_price,
             (SELECT currency_code FROM product_prices pp WHERE pp.product_id = p.id AND pp.ends_at IS NULL ORDER BY pp.starts_at DESC LIMIT 1) as currency_code
      FROM products p
      WHERE p.id = $1 AND p.company_id = $2
    `;
    const result = await this.db.query(query, [id, companyId]);
    return result.rows[0];
  }

  async update(id: string, companyId: string, data: {
      name?: string;
      description?: string | null;
      unit?: string;
      isActive?: boolean;
      sku?: string;
  }, client?: PoolClient): Promise<Product | undefined> {
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
        if (data.description !== undefined) { updates.push(`description = $${idx++}`); values.push(data.description); }
        if (data.unit !== undefined) { updates.push(`unit = $${idx++}`); values.push(data.unit); }
        if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.isActive); }
        if (data.sku !== undefined) { updates.push(`sku = $${idx++}`); values.push(data.sku); }
        
        updates.push(`updated_at = NOW()`);
        
        values.push(id);
        values.push(companyId);

        const query = `
            UPDATE products
            SET ${updates.join(', ')}
            WHERE id = $${idx++} AND company_id = $${idx++}
            RETURNING *
        `;
        const result = await (client || this.db).query(query, values);
        return result.rows[0];
  }

  async setPrice(productId: string, companyId: string, price: number, currencyCode: string, client?: PoolClient): Promise<any> {
       const dbClient = client || await this.db.connect();
       const shouldRelease = !client;
       
       try {
           if (shouldRelease) await dbClient.query('BEGIN');
           
           // Close current price
           await dbClient.query(`
               UPDATE product_prices 
               SET ends_at = NOW() 
               WHERE product_id = $1 AND company_id = $2 AND ends_at IS NULL
           `, [productId, companyId]);
           
           // Insert new price
           const query = `
               INSERT INTO product_prices (company_id, product_id, price, currency_code, starts_at)
               VALUES ($1, $2, $3, $4, NOW())
               RETURNING *
           `;
           const result = await dbClient.query(query, [companyId, productId, price, currencyCode]);
           
           if (shouldRelease) await dbClient.query('COMMIT');
           return result.rows[0];
       } catch(e) {
           if (shouldRelease) await dbClient.query('ROLLBACK');
           throw e;
       } finally {
           if (shouldRelease) (dbClient as PoolClient).release();
       }
  }

  async delete(id: string, companyId: string): Promise<boolean> {
      // Check for orders usage first? The DB foreign key might cascade or restrict.
      // Usually restrict.
      // We can check manually.
      const checkQuery = `SELECT count(*) FROM order_items WHERE product_id = $1`;
      const checkRes = await this.db.query(checkQuery, [id]);
      if (parseInt(checkRes.rows[0].count) > 0) return false;

      const query = `DELETE FROM products WHERE id = $1 AND company_id = $2`;
      const result = await this.db.query(query, [id, companyId]);
      return (result.rowCount || 0) > 0;
  }
}

export const productRepository = new ProductRepository();
