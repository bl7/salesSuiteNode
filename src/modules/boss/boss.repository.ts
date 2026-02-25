import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Boss {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: Date;
  updated_at: Date;
}

export class BossRepository {
  constructor(private readonly db: Pool = pool) {}

  async findByEmail(email: string, client?: PoolClient): Promise<Boss | undefined> {
    const query = 'SELECT * FROM bosses WHERE email = $1';
    const result = await (client || this.db).query(query, [email.toLowerCase().trim()]);
    return result.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<Boss | undefined> {
    const query = 'SELECT * FROM bosses WHERE id = $1';
    const result = await (client || this.db).query(query, [id]);
    return result.rows[0];
  }
}

export const bossRepository = new BossRepository();
