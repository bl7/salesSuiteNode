import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Order {
  id: string;
  company_id: string;
  order_number: string;
  shop_id: string | null;
  lead_id: string | null;
  placed_by_company_user_id: string;
  status: 'received' | 'processing' | 'shipped' | 'closed' | 'cancelled';
  total_amount: number;
  currency_code: string;
  placed_at: Date;
  processed_at: Date | null;
  shipped_at: Date | null;
  closed_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  notes: string | null;
  // Joined
  shop_name?: string | null;
  shop_address?: string | null;
  placed_by_name?: string | null;
  items_count?: number;
  items?: any[];
}

export class OrderRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
      companyId: string;
      placedByCompanyUserId: string;
      shopId?: string | null;
      leadId?: string | null;
      notes?: string;
      items: {
          productId: string;
          productName: string;
          productSku: string;
          quantity: number;
          unitPrice: number;
          notes?: string;
      }[]
  }, client?: PoolClient): Promise<Order> {
      const dbClient = client || await this.db.connect();
      const shouldRelease = !client;

      try {
          if (shouldRelease) await dbClient.query('BEGIN');

          // Generate Order Number (Simple timestamp based for now, or sequence)
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

          const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

          const insertOrderQuery = `
              INSERT INTO orders (
                  company_id, order_number, shop_id, lead_id, placed_by_company_user_id, status, notes, total_amount, currency_code, placed_at
              )
              VALUES ($1, $2, $3, $4, $5, 'received', $6, $7, 'NPR', NOW())
              RETURNING *
          `;
          const orderRes = await dbClient.query(insertOrderQuery, [
              data.companyId, orderNumber, data.shopId, data.leadId, data.placedByCompanyUserId, data.notes, totalAmount
          ]);
          const order = orderRes.rows[0];

          // Insert items
          const insertedItems = [];
          for (const item of data.items) {
              const lineTotal = item.quantity * item.unitPrice;
              const itemRes = await dbClient.query(`
                  INSERT INTO order_items (company_id, order_id, product_id, product_name, product_sku, quantity, unit_price, line_total, notes)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  RETURNING *
              `, [
                  data.companyId, order.id, item.productId, item.productName, item.productSku, item.quantity, item.unitPrice, 
                  lineTotal, item.notes
              ]);
              insertedItems.push(itemRes.rows[0]);
          }

          if (shouldRelease) await dbClient.query('COMMIT');
          
          order.items = insertedItems;
          return order;

      } catch (e) {
          if (shouldRelease) await dbClient.query('ROLLBACK');
          throw e;
      } finally {
          if (shouldRelease) (dbClient as PoolClient).release();
      }
  }



  async update(id: string, companyId: string, data: {
      items?: {
          productId: string;
          productName: string;
          productSku: string;
          quantity: number;
          unitPrice: number;
          notes?: string;
      }[];
      notes?: string;
      status?: 'received' | 'processing' | 'shipped' | 'closed';
  }): Promise<Order> {
    const client = await this.db.connect();
    try {
        await client.query('BEGIN');

        // Update main order fields
        if (data.notes !== undefined || data.status !== undefined) {
             const updates: string[] = [];
             const values: any[] = [];
             let idx = 1;

             if (data.notes !== undefined) {
                 updates.push(`notes = $${idx++}`);
                 values.push(data.notes);
             }
             if (data.status !== undefined) {
                 updates.push(`status = $${idx++}`);
                 values.push(data.status);
             }

             if (updates.length > 0) {
                 values.push(id, companyId);
                 await client.query(`
                     UPDATE orders 
                     SET ${updates.join(', ')}, updated_at = NOW()
                     WHERE id = $${idx++} AND company_id = $${idx++}
                 `, values);
             }
        }

        // Update Items (Full Replace Strategy for simplicity)
        if (data.items) {
            // 1. Delete existing items
            await client.query('DELETE FROM order_items WHERE order_id = $1 AND company_id = $2', [id, companyId]);

            // 2. Insert new items
            const insertedItems = [];
            let newTotal = 0;

            for (const item of data.items) {
                 const lineTotal = item.quantity * item.unitPrice;
                 newTotal += lineTotal;

                 const itemRes = await client.query(`
                     INSERT INTO order_items (company_id, order_id, product_id, product_name, product_sku, quantity, unit_price, line_total, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING *
                 `, [
                     companyId, id, item.productId, item.productName, item.productSku, item.quantity, item.unitPrice, 
                     lineTotal, item.notes
                 ]);
                 insertedItems.push(itemRes.rows[0]);
            }

            // 3. Update Order Total
            await client.query(`
                UPDATE orders SET total_amount = $1 WHERE id = $2 AND company_id = $3
            `, [newTotal, id, companyId]);
        }

        await client.query('COMMIT');

        // Return updated order
        return (await this.findById(id, companyId))!; 

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
  }

  async findAll(params: {
      companyId: string;
      status?: string;
      q?: string;
      shopId?: string;
      repId?: string;
      dateFrom?: string;
      dateTo?: string;
  }): Promise<Order[]> {
      let query = `
          SELECT o.*, s.name as shop_name, s.address as shop_address, u.full_name as placed_by_name,
                 (SELECT count(*)::int FROM order_items oi WHERE oi.order_id = o.id) as items_count
          FROM orders o
          LEFT JOIN shops s ON o.shop_id = s.id
          LEFT JOIN company_users cu ON o.placed_by_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE o.company_id = $1
      `;
      const values: any[] = [params.companyId];
      let idx = 2;

      if (params.status) { query += ` AND o.status = $${idx++}`; values.push(params.status); }
      if (params.shopId) { query += ` AND o.shop_id = $${idx++}`; values.push(params.shopId); }
      if (params.repId) { query += ` AND o.placed_by_company_user_id = $${idx++}`; values.push(params.repId); }
      if (params.dateFrom) { query += ` AND o.placed_at >= $${idx++}`; values.push(params.dateFrom); }
      if (params.dateTo) { query += ` AND o.placed_at <= $${idx++}`; values.push(params.dateTo); }
      if (params.q) {
          query += ` AND (o.order_number ILIKE $${idx} OR s.name ILIKE $${idx})`;
          values.push(`%${params.q}%`);
          idx++;
      }

      query += ` ORDER BY o.placed_at DESC`;

      const result = await this.db.query(query, values);
      return result.rows;
  }

  async findById(id: string, companyId: string): Promise<Order | undefined> {
      const query = `
          SELECT 
              o.id, o.company_id, o.order_number, o.shop_id, o.lead_id, 
              o.placed_by_company_user_id, o.status, o.total_amount, 
              o.currency_code, o.notes, o.placed_at, o.processed_at, 
              o.shipped_at, o.closed_at, o.cancelled_at, o.cancel_reason, 
              o.cancel_note, o.created_at, o.updated_at,
              s.name as shop_name, s.address as shop_address, 
              u.full_name as placed_by_name
          FROM orders o
          LEFT JOIN shops s ON o.shop_id = s.id
          LEFT JOIN company_users cu ON o.placed_by_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE o.id = $1 AND o.company_id = $2
      `;
      const result = await this.db.query(query, [id, companyId]);
      const order = result.rows[0];
      if (order) {
          // Get items
          const itemsRes = await this.db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
          order.items = itemsRes.rows;
      }
      return order;
  }

  async cancel(id: string, companyId: string, reason: string | null, note: string | null): Promise<Order | undefined> {
      const query = `
          UPDATE orders
          SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $3, cancel_note = $4, updated_at = NOW()
          WHERE id = $1 AND company_id = $2
          RETURNING *
      `;
      const result = await this.db.query(query, [id, companyId, reason, note]);
      return result.rows[0];
  }

  async getCounts(companyId: string): Promise<{
    received: number;
    processing: number;
    shipped: number;
    closed: number;
    cancelled: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'received') as received,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'shipped') as shipped,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM orders
      WHERE company_id = $1
    `;
    const result = await this.db.query(query, [companyId]);
    const row = result.rows[0];
    return {
      received: parseInt(row.received || '0'),
      processing: parseInt(row.processing || '0'),
      shipped: parseInt(row.shipped || '0'),
      closed: parseInt(row.closed || '0'),
      cancelled: parseInt(row.cancelled || '0')
    };
  }
}
export const orderRepository = new OrderRepository();
