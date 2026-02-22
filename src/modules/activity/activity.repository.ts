import { pool } from '../../db/pool';

export interface DailyActivityLog {
  id: string;
  company_id: string;
  rep_company_user_id: string;
  date: string;
  walking_duration_ms: number;
  driving_duration_ms: number;
  still_duration_ms: number;
  total_distance_km: number;
  last_updated_at: string;
}

export class ActivityRepository {
  async upsert(data: {
    companyId: string;
    repCompanyUserId: string;
    date: string;
    walking_duration_ms?: number;
    driving_duration_ms?: number;
    still_duration_ms?: number;
    total_distance_km?: number;
  }) {
    const query = `
      INSERT INTO staff_activity_logs (
        company_id, 
        rep_company_user_id, 
        date, 
        walking_duration_ms, 
        driving_duration_ms, 
        still_duration_ms, 
        total_distance_km,
        last_updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (rep_company_user_id, date) DO UPDATE SET
        walking_duration_ms = EXCLUDED.walking_duration_ms,
        driving_duration_ms = EXCLUDED.driving_duration_ms,
        still_duration_ms = EXCLUDED.still_duration_ms,
        total_distance_km = EXCLUDED.total_distance_km,
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      data.companyId,
      data.repCompanyUserId,
      data.date,
      data.walking_duration_ms || 0,
      data.driving_duration_ms || 0,
      data.still_duration_ms || 0,
      data.total_distance_km || 0
    ]);
    
    return result.rows[0];
  }

  async findAll(params: {
    companyId: string;
    repCompanyUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    let query = `
      SELECT al.*, u.full_name as rep_name
      FROM staff_activity_logs al
      JOIN company_users cu ON al.rep_company_user_id = cu.id
      JOIN users u ON cu.user_id = u.id
      WHERE al.company_id = $1
    `;
    const values: any[] = [params.companyId];
    let idx = 2;

    if (params.repCompanyUserId) {
      query += ` AND al.rep_company_user_id = $${idx++}`;
      values.push(params.repCompanyUserId);
    }
    if (params.dateFrom) {
      query += ` AND al.date >= $${idx++}`;
      values.push(params.dateFrom);
    }
    if (params.dateTo) {
      query += ` AND al.date <= $${idx++}`;
      values.push(params.dateTo);
    }

    query += ` ORDER BY al.date DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

export const activityRepository = new ActivityRepository();
