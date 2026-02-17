import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface EmailToken {
  id: string; // The token itself
  user_id: string;
  token_type: 'email_verify' | 'password_reset';
  expires_at: Date;
  created_at: Date;
}

export class EmailTokenRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: { token: string; userId: string; tokenType: string; expiresAt: Date }, client?: PoolClient): Promise<EmailToken> {
    const query = `
      INSERT INTO email_tokens (id, user_id, token_type, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [data.token, data.userId, data.tokenType, data.expiresAt]);
    return result.rows[0];
  }

  async findById(token: string, client?: PoolClient): Promise<EmailToken | undefined> {
    const query = 'SELECT * FROM email_tokens WHERE id = $1';
    const result = await (client || this.db).query(query, [token]);
    return result.rows[0];
  }

  async delete(token: string, client?: PoolClient): Promise<void> {
    const query = 'DELETE FROM email_tokens WHERE id = $1';
    await (client || this.db).query(query, [token]);
  }
}

export const emailTokenRepository = new EmailTokenRepository();
