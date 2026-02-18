import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface User {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  is_platform_admin: boolean;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository {
  constructor(private readonly db: Pool = pool) {}

  async findByEmail(email: string, client?: PoolClient): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await (client || this.db).query(query, [email]);
    return result.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await (client || this.db).query(query, [id]);
    return result.rows[0];
  }

  async create(user: { email: string; fullName: string; passwordHash: string }, client?: PoolClient): Promise<User> {
    const query = `
      INSERT INTO users (email, full_name, password_hash)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [user.email, user.fullName, user.passwordHash]);
    return result.rows[0];
  }

  async updateLastLogin(id: string, client?: PoolClient): Promise<void> {
    const query = 'UPDATE users SET last_login_at = NOW() WHERE id = $1';
    await (client || this.db).query(query, [id]);
  }

  async update(id: string, data: { fullName?: string; passwordHash?: string }, client?: PoolClient): Promise<User | undefined> {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.fullName !== undefined) { updates.push(`full_name = $${idx++}`); values.push(data.fullName); }
      if (data.passwordHash !== undefined) { updates.push(`password_hash = $${idx++}`); values.push(data.passwordHash); }
      
      updates.push(`updated_at = NOW()`);
      
      if (updates.length === 1) return this.findById(id, client); // Only updated_at

      values.push(id);
      
      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;
      
      const result = await (client || this.db).query(query, values);
      return result.rows[0];
  }
}

export const userRepository = new UserRepository();
