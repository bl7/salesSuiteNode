import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface ShopAssignment {
  id: string;
  company_id: string;
  shop_id: string;
  rep_company_user_id: string;
  is_primary: boolean;
  assigned_at: Date;
}

export class ShopAssignmentRepository {
  constructor(private readonly db: Pool = pool) {}

  async findAll(companyId: string): Promise<ShopAssignment[]> {
    const query = `
      SELECT 
        sa.id, 
        sa.shop_id, 
        sa.rep_company_user_id, 
        sa.is_primary, 
        sa.assigned_at,
        s.name as shop_name
      FROM shop_assignments sa
      JOIN shops s ON sa.shop_id = s.id
      WHERE sa.company_id = $1
      ORDER BY sa.assigned_at DESC
    `;
    const result = await this.db.query(query, [companyId]);
    return result.rows;
  }

  async upsert(data: {
    companyId: string;
    shopId: string;
    repCompanyUserId: string;
    isPrimary: boolean;
  }, client?: PoolClient): Promise<ShopAssignment> {
    const dbClient = client || this.db;

    if (data.isPrimary) {
      await dbClient.query(
        `UPDATE shop_assignments SET is_primary = FALSE WHERE company_id = $1 AND shop_id = $2`,
        [data.companyId, data.shopId]
      );
    }

    const query = `
      INSERT INTO shop_assignments (company_id, shop_id, rep_company_user_id, is_primary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id, shop_id, rep_company_user_id)
      DO UPDATE SET is_primary = EXCLUDED.is_primary, assigned_at = NOW()
      RETURNING *
    `;
    const result = await dbClient.query(query, [
      data.companyId, data.shopId, data.repCompanyUserId, data.isPrimary
    ]);
    return result.rows[0];
  }

  async delete(id: string, companyId: string): Promise<boolean> {
    const query = `DELETE FROM shop_assignments WHERE id = $1 AND company_id = $2`;
    const result = await this.db.query(query, [id, companyId]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const shopAssignmentRepository = new ShopAssignmentRepository();
