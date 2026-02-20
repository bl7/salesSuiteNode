import { Pool, PoolClient } from 'pg';

import { pool } from '../../db/pool';

export interface Shop {
  id: string;
  company_id: string;
  external_shop_code: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  is_active: boolean;
  notes: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  operating_hours: string | null;
  preferred_visit_days: string | null;
  payment_status: string | null;
  region_id: string | null;
  region_name: string | null; // joined
  is_assigned_to_me?: boolean; // joined
  created_at: Date;
  updated_at: Date;
}

export class ShopRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
      companyId: string;
      name: string;
      latitude?: number | null;
      longitude?: number | null;
      geofenceRadiusM: number;
      externalShopCode?: string;
      notes?: string;
      address?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      operatingHours?: string;
      preferredVisitDays?: string;
      paymentStatus?: string;
      regionId?: string;
  }, client?: PoolClient): Promise<Shop> {
      const query = `
          INSERT INTO shops (
            company_id, name, latitude, longitude, geofence_radius_m, 
            external_shop_code, notes, address, contact_name, contact_email, contact_phone, 
            operating_hours, preferred_visit_days, payment_status, region_id,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
          RETURNING *
      `;
      const result = await (client || this.db).query(query, [
          data.companyId, 
          data.name, 
          data.latitude ?? null, 
          data.longitude ?? null, 
          data.geofenceRadiusM, 
          data.externalShopCode, 
          data.notes,
          data.address,
          data.contactName,
          data.contactEmail,
          data.contactPhone,
          data.operatingHours,
          data.preferredVisitDays,
          data.paymentStatus,
          data.regionId ?? null
      ]);
      return result.rows[0];
  }

  async findAll(params: { companyId: string; q?: string; status?: string; regionId?: string; page?: number; limit?: number; repCompanyUserId?: string }): Promise<{ shops: Shop[]; total: number }> {
      let query = `
          SELECT 
            s.*, 
            (SELECT count(*)::int FROM shop_assignments sa WHERE sa.shop_id = s.id) as assignment_count,
            ${params.repCompanyUserId ? `EXISTS(SELECT 1 FROM shop_assignments sa WHERE sa.shop_id = s.id AND sa.rep_company_user_id = $2) as is_assigned_to_me,` : ''}
            r.name as region_name,
            COUNT(*) OVER()::int as total_count
          FROM shops s
          LEFT JOIN regions r ON s.region_id = r.id
          WHERE s.company_id = $1
      `;
      const values: any[] = [params.companyId];
      if (params.repCompanyUserId) {
        values.push(params.repCompanyUserId);
      }
      let idx = values.length + 1;

      if (params.regionId) {
          query += ` AND s.region_id = $${idx++}`;
          values.push(params.regionId);
      }

      if (params.status) {
           if (params.status === 'active') query += ` AND s.is_active = true`;
           else if (params.status === 'inactive') query += ` AND s.is_active = false`;
      }
      
      if (params.q) {
          query += ` AND s.name ILIKE $${idx}`;
          values.push(`%${params.q}%`);
          idx++;
      }

      query += ` ORDER BY s.name ASC`;
      
      if (params.page && params.limit) {
          const offset = (params.page - 1) * params.limit;
          query += ` LIMIT $${idx++} OFFSET $${idx++}`;
          values.push(params.limit, offset);
      }

      const result = await this.db.query(query, values);
      const total = result.rows.length > 0 ? result.rows[0].total_count : 0;
      
      const shops = result.rows.map(row => {
          const { total_count, ...rest } = row;
          return rest as Shop;
      });

      return { shops, total };
  }

  async findById(shopId: string, companyId: string): Promise<Shop | undefined> {
    const query = `
        SELECT 
          s.*, 
          (SELECT count(*)::int FROM shop_assignments sa WHERE sa.shop_id = s.id) as assignment_count,
          r.name as region_name
        FROM shops s
        LEFT JOIN regions r ON s.region_id = r.id
        WHERE s.id = $1 AND s.company_id = $2
    `;
    const result = await this.db.query(query, [shopId, companyId]);
    return result.rows[0];
  }

  async update(id: string, companyId: string, data: { 
      name?: string; 
      isActive?: boolean; 
      notes?: string | null; 
      geofenceRadiusM?: number; 
      latitude?: number | null; 
      longitude?: number | null;
      address?: string | null;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      operatingHours?: string | null;
      preferredVisitDays?: string | null;
      paymentStatus?: string | null;
      regionId?: string | null;
  }): Promise<Shop | undefined> {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
      if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.isActive); }
      if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(data.notes); }
      if (data.geofenceRadiusM !== undefined) { updates.push(`geofence_radius_m = $${idx++}`); values.push(data.geofenceRadiusM); }
      if (data.latitude !== undefined) { updates.push(`latitude = $${idx++}`); values.push(data.latitude); }
      if (data.longitude !== undefined) { updates.push(`longitude = $${idx++}`); values.push(data.longitude); }
      if (data.address !== undefined) { updates.push(`address = $${idx++}`); values.push(data.address); }
      if (data.contactName !== undefined) { updates.push(`contact_name = $${idx++}`); values.push(data.contactName); }
      if (data.contactEmail !== undefined) { updates.push(`contact_email = $${idx++}`); values.push(data.contactEmail); }
      if (data.contactPhone !== undefined) { updates.push(`contact_phone = $${idx++}`); values.push(data.contactPhone); }
      if (data.operatingHours !== undefined) { updates.push(`operating_hours = $${idx++}`); values.push(data.operatingHours); }
      if (data.preferredVisitDays !== undefined) { updates.push(`preferred_visit_days = $${idx++}`); values.push(data.preferredVisitDays); }
      if (data.paymentStatus !== undefined) { updates.push(`payment_status = $${idx++}`); values.push(data.paymentStatus); }
      if (data.regionId !== undefined) { updates.push(`region_id = $${idx++}`); values.push(data.regionId); }
      
      updates.push(`updated_at = NOW()`);

      const shopIdVal = id;
      const compIdVal = companyId;

      const query = `
        UPDATE shops
        SET ${updates.join(', ')}
        WHERE id = $${idx++} AND company_id = $${idx++}
        RETURNING *
      `;

      values.push(shopIdVal);
      values.push(compIdVal);
      
      const result = await this.db.query(query, values);
      return result.rows[0];
  }
}
export const shopRepository = new ShopRepository();
