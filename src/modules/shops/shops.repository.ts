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
  }, client?: PoolClient): Promise<Shop> {
      const query = `
          INSERT INTO shops (
            company_id, name, latitude, longitude, geofence_radius_m, 
            external_shop_code, notes, address, contact_name, contact_email, contact_phone, 
            operating_hours, preferred_visit_days, payment_status,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
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
          data.paymentStatus
      ]);
      return result.rows[0];
  }

  async findAll(params: { companyId: string; q?: string; status?: string }): Promise<Shop[]> {
      let query = `
          SELECT s.*, (SELECT count(*)::int FROM shop_assignments sa WHERE sa.shop_id = s.id) as assignment_count
          FROM shops s
          WHERE s.company_id = $1
      `;
      const values: any[] = [params.companyId];
      let idx = 2;

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
      const result = await this.db.query(query, values);
      return result.rows;
  }

  async findById(shopId: string, companyId: string): Promise<Shop | undefined> {
    const query = `
        SELECT s.*, (SELECT count(*)::int FROM shop_assignments sa WHERE sa.shop_id = s.id) as assignment_count
        FROM shops s
        WHERE s.id = $1 AND s.company_id = $2
    `;
    const result = await this.db.query(query, [shopId, companyId]);
    return result.rows[0];
  }

  async update(id: string, companyId: string, data: { 
      name?: string; 
      isActive?: boolean; 
      notes?: string; 
      geofenceRadiusM?: number; 
      latitude?: number | null; 
      longitude?: number | null;
      address?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      operatingHours?: string;
      preferredVisitDays?: string;
      paymentStatus?: string;
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
