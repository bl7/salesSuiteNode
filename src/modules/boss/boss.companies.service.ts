import { pool } from '../../db/pool';

export class BossCompaniesService {
  async getCompanies(q: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const baseSql = `
      WITH staff_counts AS (
        SELECT company_id, COUNT(*)::text AS total, COUNT(*) FILTER (WHERE status = 'active')::text AS active, COUNT(*) FILTER (WHERE status = 'inactive')::text AS inactive, COUNT(*) FILTER (WHERE status = 'invited')::text AS invited
        FROM company_users GROUP BY company_id
      ),
      primary_contact AS (
        SELECT DISTINCT ON (company_id) company_id, u.email AS contact_email, cu.phone AS contact_phone
        FROM company_users cu JOIN users u ON u.id = cu.user_id WHERE cu.role IN ('boss', 'manager') ORDER BY company_id, CASE WHEN cu.role = 'boss' THEN 0 ELSE 1 END
      ),
      base AS (
        SELECT c.id AS company_id, c.name AS company_name, c.slug AS company_slug, c.status AS company_status, c.plan AS company_plan, c.created_at::text AS company_created_at, c.address AS company_address, c.subscription_ends_at::text, COALESCE(c.subscription_suspended, false) AS subscription_suspended, COALESCE(c.staff_limit, 5)::text AS staff_limit, COALESCE(sc.total, '0') AS staff_total, COALESCE(sc.active, '0') AS staff_active, COALESCE(sc.inactive, '0') AS staff_inactive, COALESCE(sc.invited, '0') AS staff_invited, pc.contact_email, pc.contact_phone
        FROM companies c LEFT JOIN staff_counts sc ON sc.company_id = c.id LEFT JOIN primary_contact pc ON pc.company_id = c.id
      )
    `;

    const searchCondition = q ? `WHERE (b.company_name ILIKE $1 OR b.contact_email ILIKE $1)` : "";
    const searchArg = q ? `%${q}%` : null;
    const params = searchArg ? [searchArg, limit, offset] : [limit, offset];
    const limitOffset = searchArg ? `LIMIT $2 OFFSET $3` : `LIMIT $1 OFFSET $2`;

    const listResult = await pool.query(`${baseSql} SELECT b.*, COUNT(*) OVER()::text AS total_count FROM base b ${searchCondition} ORDER BY b.company_created_at DESC ${limitOffset}`, params);
    const totalCount = listResult.rows[0]?.total_count ? parseInt(listResult.rows[0].total_count, 10) : 0;
    const companies = listResult.rows.map((r: any) => ({
      id: r.company_id, name: r.company_name, slug: r.company_slug, status: r.company_status, plan: r.company_plan, createdAt: r.company_created_at, address: r.company_address ?? "", subscriptionEndsAt: r.subscription_ends_at, subscriptionSuspended: r.subscription_suspended, staffLimit: parseInt(r.staff_limit, 10), contactEmail: r.contact_email ?? null, contactPhone: r.contact_phone ?? null,
      staff: { total: parseInt(r.staff_total, 10), active: parseInt(r.staff_active, 10), inactive: parseInt(r.staff_inactive, 10), invited: parseInt(r.staff_invited, 10) },
    }));

    const totalsResult = await pool.query(`WITH subs AS (SELECT id, COALESCE(subscription_suspended, false) AS suspended, subscription_ends_at AS ends_at FROM companies) SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE NOT suspended AND ends_at IS NOT NULL AND ends_at >= NOW())::text AS active_sub, COUNT(*) FILTER (WHERE suspended OR ends_at IS NULL OR ends_at < NOW())::text AS expired_sub FROM subs`);
    const tr = totalsResult.rows[0];
    const totals = { companies: parseInt(tr?.total ?? "0", 10), activeSubscription: parseInt(tr?.active_sub ?? "0", 10), expiredSubscription: parseInt(tr?.expired_sub ?? "0", 10) };

    const recentResult = await pool.query(`SELECT name AS company_name, created_at::text AS company_created_at FROM companies ORDER BY created_at DESC LIMIT 10`);
    const recentSignups = recentResult.rows.map((row: any) => ({ name: row.company_name, createdAt: row.company_created_at }));

    return { companies, totals, totalCount, page, limit, recentSignups, ok: true };
  }

  async updateCompany(companyId: string, staffLimit: number) {
    const result = await pool.query(`UPDATE companies SET staff_limit = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [staffLimit, companyId]);
    if (result.rowCount === 0) throw new Error("Company not found");
    return { ok: true, staffLimit };
  }

  async subscriptionAction(companyId: string, bossId: string, actionData: any) {
    if (actionData.action === "add_months") {
      const kind = actionData.kind ?? "payment";
      const result = await pool.query(`SELECT subscription_ends_at FROM companies WHERE id = $1`, [companyId]);
      if (!result.rows[0]) throw new Error("Company not found");
      const currentEnd = result.rows[0].subscription_ends_at ? new Date(result.rows[0].subscription_ends_at) : null;
      const now = new Date();
      const newEnd = new Date(currentEnd && currentEnd > now ? currentEnd : now);
      newEnd.setMonth(newEnd.getMonth() + actionData.months);
      await pool.query(`UPDATE companies SET subscription_ends_at = $1, subscription_suspended = false, updated_at = NOW() WHERE id = $2`, [newEnd.toISOString(), companyId]);
      await pool.query(`INSERT INTO company_payments (company_id, months_added, days_added, kind, amount_notes, recorded_by_boss_id, notes) VALUES ($1, $2, NULL, $3, $4, $5, $6)`, [companyId, actionData.months, kind, actionData.amountNotes ?? null, bossId, actionData.note ?? null]);
      return { ok: true, subscriptionEndsAt: newEnd.toISOString() };
    }

    if (actionData.action === "add_days") {
      const kind = actionData.kind ?? "grace";
      const result = await pool.query(`SELECT subscription_ends_at FROM companies WHERE id = $1`, [companyId]);
      if (!result.rows[0]) throw new Error("Company not found");
      const currentEnd = result.rows[0].subscription_ends_at ? new Date(result.rows[0].subscription_ends_at) : null;
      const now = new Date();
      const newEnd = new Date(currentEnd && currentEnd > now ? currentEnd : now);
      newEnd.setDate(newEnd.getDate() + actionData.days);
      await pool.query(`UPDATE companies SET subscription_ends_at = $1, subscription_suspended = false, updated_at = NOW() WHERE id = $2`, [newEnd.toISOString(), companyId]);
      await pool.query(`INSERT INTO company_payments (company_id, months_added, days_added, kind, amount_notes, recorded_by_boss_id, notes) VALUES ($1, 0, $2, $3, NULL, $4, $5)`, [companyId, actionData.days, kind, bossId, actionData.note ?? null]);
      return { ok: true, subscriptionEndsAt: newEnd.toISOString() };
    }

    if (actionData.action === "suspend") {
      const result = await pool.query(`UPDATE companies SET subscription_suspended = true, updated_at = NOW() WHERE id = $1 RETURNING id`, [companyId]);
      if (result.rowCount === 0) throw new Error("Company not found");
      return { ok: true };
    }

    if (actionData.action === "resume") {
      const result = await pool.query(`UPDATE companies SET subscription_suspended = false, updated_at = NOW() WHERE id = $1 RETURNING id`, [companyId]);
      if (result.rowCount === 0) throw new Error("Company not found");
      return { ok: true };
    }

    throw new Error("Unknown action");
  }
}

export const bossCompaniesService = new BossCompaniesService();
