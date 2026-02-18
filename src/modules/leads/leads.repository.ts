import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Lead {
  id: string;
  company_id: string;
  shop_id: string | null;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  assigned_rep_company_user_id: string | null;
  created_by_company_user_id: string;
  notes: string | null;
  converted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Joined
  shop_name?: string | null;
  assigned_rep_name?: string | null;
}

export class LeadsRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
    companyId: string;
    createdByCompanyUserId: string;
    name: string;
    shopId?: string | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    assignedRepCompanyUserId?: string | null;
    notes?: string | null;
  }, client?: PoolClient): Promise<Lead> {
    const query = `
      INSERT INTO leads (
        company_id, created_by_company_user_id, name, shop_id, contact_name, phone, email, address, 
        latitude, longitude, assigned_rep_company_user_id, notes, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', NOW(), NOW())
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [
      data.companyId,
      data.createdByCompanyUserId,
      data.name,
      data.shopId,
      data.contactName,
      data.phone,
      data.email,
      data.address,
      data.latitude,
      data.longitude,
      data.assignedRepCompanyUserId,
      data.notes
    ]);
    return result.rows[0];
  }

  async findAll(params: {
    companyId: string;
    status?: string;
    q?: string;
    createdById?: string; 
  }): Promise<Lead[]> {
    let query = `
      SELECT l.*, s.name as shop_name, u.full_name as assigned_rep_name
      FROM leads l
      LEFT JOIN shops s ON l.shop_id = s.id
      LEFT JOIN company_users cu ON l.assigned_rep_company_user_id = cu.id
      LEFT JOIN users u ON cu.user_id = u.id
      WHERE l.company_id = $1
    `;
    const values: any[] = [params.companyId];
    let idx = 2;

    if (params.status) {
      query += ` AND l.status = $${idx++}`;
      values.push(params.status);
    }

    if (params.q) {
      query += ` AND (l.name ILIKE $${idx} OR l.contact_name ILIKE $${idx} OR l.phone ILIKE $${idx})`;
      values.push(`%${params.q}%`);
      idx++;
    }
    
    // Reps should only see leads they created? Doc says: "reps see only leads they created".
    if (params.createdById) {
       query += ` AND l.created_by_company_user_id = $${idx++}`;
       values.push(params.createdById);
    }

    query += ` ORDER BY l.created_at DESC`;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  async findById(id: string, companyId: string): Promise<Lead | undefined> {
    const query = `
      SELECT l.*, s.name as shop_name, u.full_name as assigned_rep_name
      FROM leads l
      LEFT JOIN shops s ON l.shop_id = s.id
      LEFT JOIN company_users cu ON l.assigned_rep_company_user_id = cu.id
      LEFT JOIN users u ON cu.user_id = u.id
      WHERE l.id = $1 AND l.company_id = $2
    `;
    const result = await this.db.query(query, [id, companyId]);
    return result.rows[0];
  }
  
  async update(id: string, companyId: string, data: {
    status?: string;
    name?: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    assignedRepCompanyUserId?: string | null;
    notes?: string | null;
    convertedAt?: Date | null;
    shopId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }, client?: PoolClient): Promise<Lead | undefined> {
      // Build dynamic update
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(data.status); }
      if (data.name !== undefined) { updates.push(`name = $${idx++}`); values.push(data.name); }
      if (data.contactName !== undefined) { updates.push(`contact_name = $${idx++}`); values.push(data.contactName); }
      if (data.phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(data.phone); }
      if (data.email !== undefined) { updates.push(`email = $${idx++}`); values.push(data.email); }
      if (data.address !== undefined) { updates.push(`address = $${idx++}`); values.push(data.address); }
      if (data.latitude !== undefined) { updates.push(`latitude = $${idx++}`); values.push(data.latitude); }
      if (data.longitude !== undefined) { updates.push(`longitude = $${idx++}`); values.push(data.longitude); }
      if (data.assignedRepCompanyUserId !== undefined) { updates.push(`assigned_rep_company_user_id = $${idx++}`); values.push(data.assignedRepCompanyUserId); }
      if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(data.notes); }
      if (data.convertedAt !== undefined) { updates.push(`converted_at = $${idx++}`); values.push(data.convertedAt); }
      if (data.shopId !== undefined) { updates.push(`shop_id = $${idx++}`); values.push(data.shopId); }
      
      updates.push(`updated_at = NOW()`);
      
      if (updates.length === 1) return this.findById(id, companyId); // Only updated_at

      values.push(id);
      values.push(companyId);

      const query = `
        UPDATE leads
        SET ${updates.join(', ')}
        WHERE id = $${idx++} AND company_id = $${idx++}
        RETURNING *
      `;
      
      const result = await (client || this.db).query(query, values);
      return result.rows[0];
  }

  async delete(id: string, companyId: string): Promise<boolean> {
    const query = 'DELETE FROM leads WHERE id = $1 AND company_id = $2';
    const result = await this.db.query(query, [id, companyId]);
    return (result.rowCount || 0) > 0;
  }
}

export const leadsRepository = new LeadsRepository();
