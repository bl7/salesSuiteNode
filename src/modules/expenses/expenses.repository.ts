import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Expense {
  id: string;
  company_id: string;
  rep_company_user_id: string;
  amount: number;
  category: string;
  description: string | null;
  date: Date;
  created_at: Date;
  // Joined fields
  rep_name?: string;
}

export class ExpenseRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
    companyId: string;
    repCompanyUserId: string;
    amount: number;
    category: string;
    description?: string;
    date?: string;
  }, client?: PoolClient): Promise<Expense> {
    const query = `
      INSERT INTO expenses (company_id, rep_company_user_id, amount, category, description, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [
      data.companyId,
      data.repCompanyUserId,
      data.amount,
      data.category,
      data.description,
      data.date || new Date().toISOString()
    ]);
    return result.rows[0];
  }

  async createBulk(companyId: string, repCompanyUserId: string, expenses: any[]): Promise<Expense[]> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const results: Expense[] = [];
      for (const exp of expenses) {
        const res = await this.create({
          companyId,
          repCompanyUserId,
          ...exp
        }, client);
        results.push(res);
      }
      await client.query('COMMIT');
      return results;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findAll(params: {
    companyId: string;
    repCompanyUserId?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
  }): Promise<Expense[]> {
    let query = `
      SELECT e.*, u.full_name as rep_name
      FROM expenses e
      JOIN company_users cu ON e.rep_company_user_id = cu.id
      JOIN users u ON cu.user_id = u.id
      WHERE e.company_id = $1
    `;
    const values: any[] = [params.companyId];
    let idx = 2;

    if (params.repCompanyUserId) {
      query += ` AND e.rep_company_user_id = $${idx++}`;
      values.push(params.repCompanyUserId);
    }

    if (params.dateFrom) {
      query += ` AND e.date >= $${idx++}`;
      values.push(params.dateFrom);
    }

    if (params.dateTo) {
      query += ` AND e.date <= $${idx++}`;
      values.push(params.dateTo);
    }

    if (params.category) {
      query += ` AND e.category = $${idx++}`;
      values.push(params.category);
    }

    query += ` ORDER BY e.date DESC, e.created_at DESC`;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  async findById(id: string): Promise<Expense | undefined> {
    const query = `SELECT * FROM expenses WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0];
  }

  async update(id: string, data: {
    amount?: number;
    category?: string;
    description?: string;
  }): Promise<Expense> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.amount !== undefined) {
      fields.push(`amount = $${idx++}`);
      values.push(data.amount);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(data.category);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }

    values.push(id);
    const query = `
      UPDATE expenses 
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM expenses WHERE id = $1', [id]);
  }
}


export const expenseRepository = new ExpenseRepository();
