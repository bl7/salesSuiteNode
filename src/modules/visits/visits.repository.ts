import { Pool } from 'pg';
import { pool } from '../../db/pool';

export interface Visit {
  id: string;
  company_id: string;
  shop_id: string;
  rep_company_user_id: string;
  visit_date: Date;
  started_at: Date;
  ended_at: Date | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  purpose: string | null;
  outcome: string | null;
  image_url: string | null;
  is_verified: boolean;
  distance_m: number | null;
  verification_method: string | null;
  gps_accuracy_m: number | null;
  exception_reason: string | null;
  exception_note: string | null;
  verified_at: Date | null;
  end_lat: number | null;
  end_lng: number | null;
  approved_by_manager_id: string | null;
  approved_at: Date | null;
  flagged_by_manager_id: string | null;
  manager_note: string | null;
  created_at: Date;
  // Joined
  shop_name?: string;
  rep_name?: string;
  region_id?: string;
  region_name?: string;
}

export class VisitRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
      companyId: string;
      shopId: string;
      repCompanyUserId: string;
      latitude?: number | null;
      longitude?: number | null;
      gpsAccuracyM?: number | null;
      notes?: string;
      purpose?: string;
      outcome?: string;
      imageUrl?: string;
      isVerified?: boolean;
      distanceM?: number | null;
      verificationMethod?: string;
      verifiedAt?: Date | null;
      exceptionReason?: string | null;
      exceptionNote?: string | null;
  }): Promise<Visit> {
      const query = `
          INSERT INTO visits (
              company_id, shop_id, rep_company_user_id, started_at, latitude, longitude, notes, purpose, outcome, image_url, status,
              is_verified, distance_m, verification_method, gps_accuracy_m, exception_reason, exception_note, verified_at
          )
          VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, 'ongoing', $10, $11, $12, $13, $14, $15, $16)
          RETURNING *, started_at as visit_date
      `;
      const result = await this.db.query(query, [
          data.companyId, data.shopId, data.repCompanyUserId, data.latitude, data.longitude,
          data.notes, data.purpose, data.outcome, data.imageUrl,
          data.isVerified ?? false, data.distanceM, data.verificationMethod ?? 'none',
          data.gpsAccuracyM, data.exceptionReason ?? null, data.exceptionNote ?? null,
          data.verifiedAt ?? null
      ]);
      return result.rows[0];
  }

  async findAll(params: {
      companyId: string;
      repId?: string;
      shopId?: string;
      dateFrom?: string;
      dateTo?: string;
      exceptionsOnly?: boolean;
      regionId?: string;
  }): Promise<Visit[]> {
      let query = `
          SELECT v.*, v.started_at as visit_date, s.name as shop_name, u.full_name as rep_name,
                 r.id as region_id, r.name as region_name
          FROM visits v
          LEFT JOIN shops s ON v.shop_id = s.id
          LEFT JOIN regions r ON s.region_id = r.id
          LEFT JOIN company_users cu ON v.rep_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE v.company_id = $1
      `;
      const values: any[] = [params.companyId];
      let idx = 2;

      if (params.repId) { query += ` AND v.rep_company_user_id = $${idx++}`; values.push(params.repId); }
      if (params.shopId) { query += ` AND v.shop_id = $${idx++}`; values.push(params.shopId); }
      if (params.dateFrom) { query += ` AND v.started_at >= $${idx++}`; values.push(params.dateFrom); }
      if (params.dateTo) { query += ` AND v.started_at <= $${idx++}`; values.push(params.dateTo); }
      if (params.regionId) { query += ` AND s.region_id = $${idx++}`; values.push(params.regionId); }
      if (params.exceptionsOnly) { query += ` AND v.exception_reason IS NOT NULL`; }

      query += ` ORDER BY v.started_at DESC`;
      const result = await this.db.query(query, values);
      return result.rows;
  }

  async findById(id: string, companyId: string): Promise<Visit | undefined> {
      const query = `
          SELECT v.*, v.started_at as visit_date, s.name as shop_name, u.full_name as rep_name,
                 r.id as region_id, r.name as region_name
          FROM visits v
          LEFT JOIN shops s ON v.shop_id = s.id
          LEFT JOIN regions r ON s.region_id = r.id
          LEFT JOIN company_users cu ON v.rep_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE v.id = $1 AND v.company_id = $2
      `;
      const result = await this.db.query(query, [id, companyId]);
      return result.rows[0];
  }

  async update(id: string, companyId: string, data: {
      status?: string;
      notes?: string;
      purpose?: string;
      outcome?: string;
      imageUrl?: string;
      latitude?: number;
      longitude?: number;
      endLat?: number | null;
      endLng?: number | null;
      // Manager actions
      approvedByManagerId?: string | null;
      approvedAt?: Date | null;
      flaggedByManagerId?: string | null;
      managerNote?: string | null;
  }): Promise<Visit | undefined> {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.status !== undefined) {
          updates.push(`status = $${idx++}`); values.push(data.status);
          if (data.status === 'completed') {
              updates.push(`ended_at = NOW()`);
          }
      }
      if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(data.notes); }
      if (data.purpose !== undefined) { updates.push(`purpose = $${idx++}`); values.push(data.purpose); }
      if (data.outcome !== undefined) { updates.push(`outcome = $${idx++}`); values.push(data.outcome); }
      if (data.imageUrl !== undefined) { updates.push(`image_url = $${idx++}`); values.push(data.imageUrl); }
      if (data.latitude !== undefined) { updates.push(`latitude = $${idx++}`); values.push(data.latitude); }
      if (data.longitude !== undefined) { updates.push(`longitude = $${idx++}`); values.push(data.longitude); }
      if (data.endLat !== undefined) { updates.push(`end_lat = $${idx++}`); values.push(data.endLat); }
      if (data.endLng !== undefined) { updates.push(`end_lng = $${idx++}`); values.push(data.endLng); }
      if (data.approvedByManagerId !== undefined) { updates.push(`approved_by_manager_id = $${idx++}`); values.push(data.approvedByManagerId); }
      if (data.approvedAt !== undefined) { updates.push(`approved_at = $${idx++}`); values.push(data.approvedAt); }
      if (data.flaggedByManagerId !== undefined) { updates.push(`flagged_by_manager_id = $${idx++}`); values.push(data.flaggedByManagerId); }
      if (data.managerNote !== undefined) { updates.push(`manager_note = $${idx++}`); values.push(data.managerNote); }

      updates.push(`updated_at = NOW()`);

      values.push(id);
      values.push(companyId);

      const query = `
          UPDATE visits
          SET ${updates.join(', ')}
          WHERE id = $${idx++} AND company_id = $${idx++}
          RETURNING *, started_at as visit_date
      `;
      const result = await this.db.query(query, values);
      return result.rows[0];
  }
}

export const visitRepository = new VisitRepository();
