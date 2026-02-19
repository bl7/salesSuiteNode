import { Pool } from 'pg';
import { pool } from '../../db/pool';

export interface Region {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  shop_count?: number;
  created_at: Date;
  updated_at: Date;
}

export class RegionRepository {
  constructor(private readonly db: Pool = pool) {}

  /** List all regions for a company, including a shop count. */
  async findAll(companyId: string): Promise<Region[]> {
    const result = await this.db.query<Region>(
      `
      SELECT
        r.*,
        COUNT(s.id)::int AS shop_count
      FROM regions r
      LEFT JOIN shops s ON s.region_id = r.id AND s.company_id = r.company_id AND s.is_active = true
      WHERE r.company_id = $1
      GROUP BY r.id
      ORDER BY r.name ASC
      `,
      [companyId]
    );
    return result.rows;
  }

  /** Get a single region (with shop count). */
  async findById(id: string, companyId: string): Promise<Region | undefined> {
    const result = await this.db.query<Region>(
      `
      SELECT
        r.*,
        COUNT(s.id)::int AS shop_count
      FROM regions r
      LEFT JOIN shops s ON s.region_id = r.id AND s.company_id = r.company_id AND s.is_active = true
      WHERE r.id = $1 AND r.company_id = $2
      GROUP BY r.id
      `,
      [id, companyId]
    );
    return result.rows[0];
  }

  /** Create a new region. */
  async create(data: {
    companyId: string;
    name: string;
    description?: string;
    color?: string;
  }): Promise<Region> {
    const result = await this.db.query<Region>(
      `
      INSERT INTO regions (company_id, name, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        data.companyId,
        data.name,
        data.description ?? null,
        data.color ?? '#f4a261',
      ]
    );
    return { ...result.rows[0]!, shop_count: 0 };
  }

  /** Update a region's name, description, or colour. */
  async update(
    id: string,
    companyId: string,
    data: { name?: string; description?: string | null; color?: string }
  ): Promise<Region | undefined> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { updates.push(`description = $${idx++}`); values.push(data.description); }
    if (data.color !== undefined) { updates.push(`color = $${idx++}`); values.push(data.color); }

    if (updates.length === 0) return this.findById(id, companyId);

    updates.push(`updated_at = NOW()`);
    values.push(id, companyId); // appended last

    const result = await this.db.query<Region>(
      `
      UPDATE regions
      SET ${updates.join(', ')}
      WHERE id = $${idx++} AND company_id = $${idx++}
      RETURNING *
      `,
      values
    );
    return result.rows[0];
  }

  /** Delete a region. Shops lose their region_id (ON DELETE SET NULL in migration). */
  async delete(id: string, companyId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM regions WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Assign a region to a shop. */
  async assignShopRegion(
    shopId: string,
    regionId: string | null,
    companyId: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE shops SET region_id = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`,
      [regionId, shopId, companyId]
    );
  }

  /** Assign a default region to a staff member. */
  async assignStaffRegion(
    companyUserId: string,
    regionId: string | null,
    companyId: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE company_users SET default_region_id = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`,
      [regionId, companyUserId, companyId]
    );
  }
}

export const regionRepository = new RegionRepository();
