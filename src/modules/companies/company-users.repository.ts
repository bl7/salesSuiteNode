import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  role: 'boss' | 'manager' | 'rep' | 'back_office' | 'dispatch_supervisor';
  status: 'active' | 'inactive' | 'invited';
  phone: string | null;
  created_at: Date;
  updated_at: Date;
}

export class CompanyUserRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(companyId: string, userId: string, role: string, status: string, phone?: string, client?: PoolClient): Promise<CompanyUser> {
    const query = `
      INSERT INTO company_users (company_id, user_id, role, status, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [companyId, userId, role, status, phone]);
    return result.rows[0];
  }

  async findByUserId(userId: string): Promise<CompanyUser | undefined> {
    const query = 'SELECT * FROM company_users WHERE user_id = $1';
    const result = await this.db.query(query, [userId]);
    return result.rows[0];
  }

  async findAll(companyId: string, params: { role?: string; status?: string; q?: string }): Promise<any[]> {
      let query = `
          SELECT 
            cu.id as "company_user_id", 
            cu.user_id as "user_id", 
            u.full_name as "full_name", 
            u.email, 
            cu.phone, 
            cu.role, 
            cu.status, 
            u.last_login_at as "last_login_at",
            cu.created_at,
            cu.updated_at
          FROM company_users cu
          JOIN users u ON cu.user_id = u.id
          WHERE cu.company_id = $1
      `;
      const values: any[] = [companyId];
      let idx = 2;

      if (params.role) { query += ` AND cu.role = $${idx++}`; values.push(params.role); }
      if (params.status) { query += ` AND cu.status = $${idx++}`; values.push(params.status); }
      if (params.q) {
          query += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`;
          values.push(`%${params.q}%`);
          idx++;
      }

      query += ` ORDER BY u.full_name ASC`;
      const result = await this.db.query(query, values);
      return result.rows;
  }
  
  async findById(id: string, companyId: string): Promise<any> {
       const query = `
          SELECT 
            cu.id as "company_user_id", 
            cu.user_id as "user_id", 
            u.full_name as "full_name", 
            u.email, 
            cu.phone, 
            cu.role, 
            cu.status, 
            u.last_login_at as "last_login_at",
            cu.created_at,
            cu.updated_at
          FROM company_users cu
          JOIN users u ON cu.user_id = u.id
          WHERE cu.id = $1 AND cu.company_id = $2
      `;
      const result = await this.db.query(query, [id, companyId]);
      return result.rows[0];
  }

  async getCounts(companyId: string) {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'invited') as invited,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive
      FROM company_users
      WHERE company_id = $1
    `;
    const result = await this.db.query(query, [companyId]);
    const row = result.rows[0];
    return {
       active: parseInt(row.active || '0'),
       invited: parseInt(row.invited || '0'),
       inactive: parseInt(row.inactive || '0')
    };
  }

  async update(id: string, companyId: string, data: { role?: string; status?: string; phone?: string; fullName?: string }, client?: PoolClient): Promise<any> {
      const dbClient = client || await this.db.connect();
      const shouldRelease = !client;
      try {
           if (shouldRelease) await dbClient.query('BEGIN');
           
           // Update company_user fields
           if (data.role || data.status || data.phone) {
               const updates: string[] = [];
               const values: any[] = [];
               let idx = 1;

               if (data.role) { updates.push(`role = $${idx++}`); values.push(data.role); }
               if (data.status) { updates.push(`status = $${idx++}`); values.push(data.status); }
               if (data.phone) { updates.push(`phone = $${idx++}`); values.push(data.phone); }
               
               if (updates.length > 0) {
                   values.push(id);
                   values.push(companyId);
                   await dbClient.query(`UPDATE company_users SET ${updates.join(', ')} WHERE id = $${idx++} AND company_id = $${idx++}`, values);
               }
           }
           
           // Update user fields (fullName)
           if (data.fullName) {
               // Get userId
               const cuRes = await dbClient.query(`SELECT user_id FROM company_users WHERE id = $1`, [id]);
               if (cuRes.rows.length > 0) {
                   const userId = cuRes.rows[0].user_id;
                   await dbClient.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [data.fullName, userId]);
               }
           }
           
           if (shouldRelease) await dbClient.query('COMMIT');
           
           // Return updated
           return this.findById(id, companyId);

      } catch (e) {
          if (shouldRelease) await dbClient.query('ROLLBACK');
          throw e;
      } finally {
          if (shouldRelease) (dbClient as PoolClient).release();
      }
  }

  async delete(id: string, companyId: string, client?: PoolClient): Promise<void> {
    const query = 'DELETE FROM company_users WHERE id = $1 AND company_id = $2';
    await (client || this.db).query(query, [id, companyId]);
  }
}

export const companyUserRepository = new CompanyUserRepository();
