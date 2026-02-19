import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Company {
  id: string;
  name: string;
  slug: string;
  address: string;
  plan: string;
  subscription_ends_at: Date | null;
  staff_limit: number;
  staff_count?: number; // joined
  created_at: Date;
  updated_at: Date;
}

export class CompanyRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(company: { name: string; slug: string; address: string }, client?: PoolClient): Promise<Company> {
    const query = `
      INSERT INTO companies (name, slug, address, plan, staff_limit)
      VALUES ($1, $2, $3, 'starter', 5)
      RETURNING *
    `;
    const result = await (client || this.db).query(query, [company.name, company.slug, company.address]);
    return result.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<Company | undefined> {
    const query = `
      SELECT c.*, 
             (SELECT COUNT(*)::int FROM company_users WHERE company_id = c.id) as staff_count
      FROM companies c 
      WHERE c.id = $1
    `;
    const result = await (client || this.db).query(query, [id]);
    return result.rows[0];
  }
}

export const companyRepository = new CompanyRepository();
