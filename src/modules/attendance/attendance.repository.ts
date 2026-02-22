import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface AttendanceLog {
  id: string;
  company_id: string;
  rep_company_user_id: string;
  clock_in_at: Date;
  clock_out_at: Date | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  notes: string | null;
  rep_name?: string; // joined
}

export class AttendanceRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
    companyId: string;
    repCompanyUserId: string;
    latitude: number;
    longitude: number;
    notes?: string;
  }, client?: PoolClient): Promise<AttendanceLog> {
    const query = `
      INSERT INTO attendance_logs (company_id, rep_company_user_id, clock_in_latitude, clock_in_longitude, notes, clock_in_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [
      data.companyId,
      data.repCompanyUserId,
      data.latitude,
      data.longitude,
      data.notes
    ]);
    return result.rows[0];
  }

  async findActiveLog(repCompanyUserId: string): Promise<AttendanceLog | undefined> {
    const query = `
      SELECT * FROM attendance_logs 
      WHERE rep_company_user_id = $1 AND clock_out_at IS NULL
      ORDER BY clock_in_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [repCompanyUserId]);
    return result.rows[0];
  }

  async updateClockOut(id: string, data: {
    latitude: number;
    longitude: number;
    notes?: string;
  }, client?: PoolClient): Promise<AttendanceLog> {
    const query = `
      UPDATE attendance_logs
      SET clock_out_at = NOW(), clock_out_latitude = $1, clock_out_longitude = $2, notes = COALESCE(notes || ' | ' || $3, $3, notes)
      WHERE id = $4
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [data.latitude, data.longitude, data.notes, id]);
    return result.rows[0];
  }

  async findAll(params: {
    companyId: string;
    repCompanyUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AttendanceLog[]> {
    let query = `
      SELECT al.*, u.full_name as rep_name
      FROM attendance_logs al
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
      query += ` AND al.clock_in_at >= $${idx++}`;
      values.push(params.dateFrom);
    }

    if (params.dateTo) {
      query += ` AND al.clock_in_at <= $${idx++}`;
      values.push(params.dateTo);
    }

    const result = await this.db.query(query, values);
    return result.rows;
  }
}

export const attendanceRepository = new AttendanceRepository();
