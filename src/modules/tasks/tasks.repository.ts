import { Pool, PoolClient } from 'pg';
import { pool } from '../../db/pool';

export interface Task {
  id: string;
  rep_company_user_id: string;
  rep_name: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'in_progress';
  due_at: string | null;
  completed_at: string | null;
  lead_id: string | null;
  shop_id: string | null;
  created_at: string;
  updated_at: string;
}

export class TaskRepository {
  constructor(private readonly db: Pool = pool) {}

  async create(data: {
      companyId: string;
      createdByCompanyUserId: string;
      title: string;
      assignedToCompanyUserId: string;
      description?: string;
      dueDate?: Date;
      leadId?: string;
      shopId?: string;
  }): Promise<Task> {
      const insertQuery = `
          INSERT INTO tasks (
              company_id, created_by_company_user_id, title, assigned_to_company_user_id, description, due_date, status, lead_id, shop_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, NOW(), NOW())
          RETURNING id
      `;
      const result = await this.db.query(insertQuery, [
          data.companyId, 
          data.createdByCompanyUserId, 
          data.title, 
          data.assignedToCompanyUserId, 
          data.description, 
          data.dueDate,
          data.leadId,
          data.shopId
      ]);
      
      const task = await this.findById(result.rows[0].id, data.companyId);
      if (!task) throw new Error('Failed to create task');
      return task;
  }

  async findAll(params: {
      companyId: string;
      status?: string;
      assignedToId?: string;
      createdById?: string;
      dateFrom?: string;
      dateTo?: string;
  }): Promise<Task[]> {
      let query = `
          SELECT 
            t.id,
            t.title,
            t.description,
            t.assigned_to_company_user_id as rep_company_user_id,
            u.full_name as rep_name,
            t.status,
            t.due_date as due_at,
            t.completed_at,
            t.created_at,
            t.updated_at,
            t.lead_id,
            t.shop_id
          FROM tasks t
          LEFT JOIN company_users cu ON t.assigned_to_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE t.company_id = $1
      `;
      const values: any[] = [params.companyId];
      let idx = 2;

      if (params.status) { query += ` AND t.status = $${idx++}`; values.push(params.status); }
      if (params.assignedToId) { query += ` AND t.assigned_to_company_user_id = $${idx++}`; values.push(params.assignedToId); }
      if (params.createdById) { query += ` AND t.created_by_company_user_id = $${idx++}`; values.push(params.createdById); }
      if (params.dateFrom) { query += ` AND t.due_date >= $${idx++}`; values.push(params.dateFrom); }
      if (params.dateTo) { query += ` AND t.due_date <= $${idx++}`; values.push(params.dateTo); }

      query += ` ORDER BY t.due_date ASC`;
      const result = await this.db.query(query, values);
      return result.rows;
  }

  async findById(id: string, companyId: string): Promise<Task | undefined> {
       const query = `
          SELECT 
            t.id,
            t.title,
            t.description,
            t.assigned_to_company_user_id as rep_company_user_id,
            u.full_name as rep_name,
            t.status,
            t.due_date as due_at,
            t.completed_at,
            t.created_at,
            t.updated_at,
            t.lead_id,
            t.shop_id
          FROM tasks t
          LEFT JOIN company_users cu ON t.assigned_to_company_user_id = cu.id
          LEFT JOIN users u ON cu.user_id = u.id
          WHERE t.id = $1 AND t.company_id = $2
      `;
      const result = await this.db.query(query, [id, companyId]);
      return result.rows[0];
  }

  async update(id: string, companyId: string, data: {
      title?: string;
      description?: string;
      status?: string;
      dueDate?: Date | null;
      leadId?: string | null;
      shopId?: string | null;
  }): Promise<Task | undefined> {
       const updates: string[] = [];
       const values: any[] = [];
       let idx = 1;

       if (data.title !== undefined) { updates.push(`title = $${idx++}`); values.push(data.title); }
       if (data.description !== undefined) { updates.push(`description = $${idx++}`); values.push(data.description); }
       if (data.status !== undefined) { updates.push(`status = $${idx++}`); values.push(data.status); }
       if (data.dueDate !== undefined) { updates.push(`due_date = $${idx++}`); values.push(data.dueDate); }
       if (data.leadId !== undefined) { updates.push(`lead_id = $${idx++}`); values.push(data.leadId); }
       if (data.shopId !== undefined) { updates.push(`shop_id = $${idx++}`); values.push(data.shopId); }

       updates.push(`updated_at = NOW()`);
       values.push(id);
       values.push(companyId);

        const query = `
            UPDATE tasks
            SET ${updates.join(', ')}
            WHERE id = $${idx++} AND company_id = $${idx++}
            RETURNING id
        `;
        const result = await this.db.query(query, values);
        if (result.rows.length === 0) return undefined;

        return this.findById(result.rows[0].id, companyId);
  }
}
export const taskRepository = new TaskRepository();
