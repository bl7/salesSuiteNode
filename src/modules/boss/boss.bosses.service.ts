import bcrypt from 'bcrypt';
import { pool } from '../../db/pool';

export class BossBossesService {
  async getBosses() {
    const res = await pool.query('SELECT id, email, full_name as "fullName", created_at as "createdAt" FROM bosses ORDER BY created_at DESC');
    return res.rows;
  }

  async createBoss(input: { email: string, password: string, fullName?: string }) {
    const email = input.email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM bosses WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new Error('A boss with this email already exists');
    const hash = await bcrypt.hash(input.password, 10);
    await pool.query(
      'INSERT INTO bosses (email, password_hash, full_name) VALUES ($1, $2, $3)',
      [email, hash, input.fullName?.trim() || '']
    );
    return { ok: true };
  }

  async updateBoss(id: string, requesterId: string, input: { email?: string, fullName?: string, newPassword?: string }) {
    const isSelf = id === requesterId;
    if (input.newPassword !== undefined && !isSelf) {
      throw new Error('You can only change your own password');
    }

    const existing = await pool.query('SELECT id FROM bosses WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new Error('Boss not found');

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.email !== undefined) {
      const normalized = input.email.toLowerCase().trim();
      const conflict = await pool.query('SELECT id FROM bosses WHERE email = $1 AND id != $2', [normalized, id]);
      if (conflict.rows.length > 0) throw new Error('A boss with this email already exists');
      updates.push(`email = $${idx++}`);
      values.push(normalized);
    }
    if (input.fullName !== undefined) {
      updates.push(`full_name = $${idx++}`);
      values.push(input.fullName.trim());
    }
    if (input.newPassword !== undefined && isSelf) {
      const hash = await bcrypt.hash(input.newPassword, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE bosses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
        values
      );
    }
    return { ok: true };
  }

  async deleteBoss(id: string, requesterId: string) {
    if (id === requesterId) throw new Error('You cannot delete your own account');
    const res = await pool.query('DELETE FROM bosses WHERE id = $1 RETURNING id', [id]);
    if (res.rowCount === 0) throw new Error('Boss not found');
    return { ok: true };
  }
}

export const bossBossesService = new BossBossesService();
