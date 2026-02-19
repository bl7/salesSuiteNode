import { Pool } from 'pg';
import { pool } from '../../db/pool';

export interface CoverageReportItem {
  rep_id: string;
  rep_name: string;
  total_assigned: number;
  shops_visited: number;
  visit_count: number;
  orders_count: number;
  total_sales: number;
  coverage_percentage: number;
}

export class ReportsRepository {
  constructor(private readonly db: Pool = pool) {}

  async getCoverageReport(companyId: string, from: Date, to: Date, regionId?: string): Promise<CoverageReportItem[]> {
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      let regionFilterShops = '';
      let regionFilterVisits = '';
      let regionFilterOrders = '';
      const params = [companyId, fromIso, toIso];

      if (regionId) {
          params.push(regionId);
          regionFilterShops = `AND s.region_id = $${params.length}`;
          regionFilterVisits = `AND s.region_id = $${params.length}`;
          regionFilterOrders = `AND s.region_id = $${params.length}`;
      }

      const query = `
        SELECT 
          cu.id as rep_id,
          u.full_name as rep_name,
          COALESCE(sa_counts.count, 0)::int as total_assigned,
          COALESCE(v_counts.unique_shops, 0)::int as shops_visited,
          COALESCE(v_counts.total_visits, 0)::int as visit_count,
          COALESCE(o_counts.count, 0)::int as orders_count,
          COALESCE(o_counts.sales, 0)::float as total_sales
        FROM company_users cu
        JOIN users u ON cu.user_id = u.id
        -- Subquery for assignments
        LEFT JOIN (
            SELECT rep_company_user_id, COUNT(*) as count 
            FROM shop_assignments sa
            JOIN shops s ON sa.shop_id = s.id
            WHERE sa.company_id = $1 ${regionFilterShops}
            GROUP BY rep_company_user_id
        ) sa_counts ON sa_counts.rep_company_user_id = cu.id
        -- Subquery for visits
        LEFT JOIN (
            SELECT v.rep_company_user_id, COUNT(DISTINCT v.shop_id) as unique_shops, COUNT(*) as total_visits
            FROM visits v
            JOIN shops s ON v.shop_id = s.id
            WHERE v.company_id = $1 AND v.started_at >= $2 AND v.started_at <= $3 ${regionFilterVisits}
            GROUP BY v.rep_company_user_id
        ) v_counts ON v_counts.rep_company_user_id = cu.id
        -- Subquery for orders
        LEFT JOIN (
            SELECT o.placed_by_company_user_id, COUNT(*) as count, SUM(o.total_amount) as sales
            FROM orders o
            JOIN shops s ON o.shop_id = s.id
            WHERE o.company_id = $1 AND o.placed_at >= $2 AND o.placed_at <= $3 ${regionFilterOrders}
            GROUP BY o.placed_by_company_user_id
        ) o_counts ON o_counts.placed_by_company_user_id = cu.id
        
        WHERE cu.company_id = $1 AND cu.role = 'rep' AND cu.status = 'active'
        ORDER BY shops_visited DESC
      `;
      
      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
          rep_id: row.rep_id,
          rep_name: row.rep_name,
          total_assigned: row.total_assigned,
          shops_visited: row.shops_visited,
          visit_count: row.visit_count,
          orders_count: row.orders_count,
          total_sales: row.total_sales,
          coverage_percentage: row.total_assigned > 0 
              ? Math.round((row.shops_visited / row.total_assigned) * 100) 
              : 0
      }));
  }

  async getAtRiskShops(companyId: string): Promise<AtRiskShopItem[]> {
    const query = `
      SELECT
        s.id AS shop_id,
        s.name AS shop_name,
        -- Most recent assignment's rep
        u.full_name AS assigned_rep_name,
        sa.rep_company_user_id AS assigned_rep_id,
        -- Days since last visit
        CASE 
          WHEN MAX(v.started_at) IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - MAX(v.started_at))::int
        END AS days_since_last_visit,
        MAX(v.started_at) AS last_visit_at,
        -- Days since last order
        CASE 
          WHEN MAX(o.placed_at) IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - MAX(o.placed_at))::int
        END AS days_since_last_order,
        MAX(o.placed_at) AS last_order_at,
        -- Order value in last 30 days
        COALESCE(SUM(CASE WHEN o.placed_at >= NOW() - INTERVAL '30 days' THEN o.total_amount ELSE 0 END), 0)::float AS total_order_value_30d
      FROM shops s
      -- Get the most recent assignment per shop
      LEFT JOIN LATERAL (
        SELECT rep_company_user_id FROM shop_assignments
        WHERE shop_id = s.id AND company_id = $1
        ORDER BY created_at DESC LIMIT 1
      ) sa ON true
      LEFT JOIN company_users cu ON sa.rep_company_user_id = cu.id
      LEFT JOIN users u ON cu.user_id = u.id
      LEFT JOIN visits v ON v.shop_id = s.id AND v.company_id = $1
      LEFT JOIN orders o ON o.shop_id = s.id AND o.company_id = $1
      WHERE s.company_id = $1 AND s.is_active = true
      GROUP BY s.id, s.name, u.full_name, sa.rep_company_user_id
      ORDER BY total_order_value_30d DESC, days_since_last_visit DESC NULLS FIRST
      LIMIT 50
    `;
    const result = await this.db.query(query, [companyId]);
    return result.rows;
  }

  async getLeaderboard(companyId: string): Promise<LeaderboardItem[]> {
    const query = `
      SELECT
        cu.id AS rep_id,
        u.full_name AS rep_name,
        -- Today
        COALESCE(SUM(CASE WHEN v.started_at >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS visits_today,
        COALESCE(SUM(CASE WHEN o.placed_at >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS orders_today,
        COALESCE(SUM(CASE WHEN o.placed_at >= CURRENT_DATE THEN o.total_amount ELSE 0 END), 0)::float AS revenue_today,
        -- This week (Mon–now)
        COALESCE(SUM(CASE WHEN v.started_at >= DATE_TRUNC('week', NOW()) THEN 1 ELSE 0 END), 0)::int AS visits_week,
        COALESCE(SUM(CASE WHEN o.placed_at >= DATE_TRUNC('week', NOW()) THEN 1 ELSE 0 END), 0)::int AS orders_week,
        COALESCE(SUM(CASE WHEN o.placed_at >= DATE_TRUNC('week', NOW()) THEN o.total_amount ELSE 0 END), 0)::float AS revenue_week,
        -- MTD
        COALESCE(SUM(CASE WHEN v.started_at >= DATE_TRUNC('month', NOW()) THEN 1 ELSE 0 END), 0)::int AS visits_mtd,
        COALESCE(SUM(CASE WHEN o.placed_at >= DATE_TRUNC('month', NOW()) THEN 1 ELSE 0 END), 0)::int AS orders_mtd,
        COALESCE(SUM(CASE WHEN o.placed_at >= DATE_TRUNC('month', NOW()) THEN o.total_amount ELSE 0 END), 0)::float AS revenue_mtd,
        -- Exception rate (MTD)
        COALESCE(SUM(CASE WHEN v.started_at >= DATE_TRUNC('month', NOW()) AND v.exception_reason IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS exceptions_mtd,
        -- Verified rate (MTD)
        COALESCE(SUM(CASE WHEN v.started_at >= DATE_TRUNC('month', NOW()) AND v.is_verified = true THEN 1 ELSE 0 END), 0)::int AS verified_mtd
      FROM company_users cu
      JOIN users u ON cu.user_id = u.id
      LEFT JOIN visits v ON v.rep_company_user_id = cu.id AND v.company_id = $1
      LEFT JOIN orders o ON o.placed_by_company_user_id = cu.id AND o.company_id = $1
      WHERE cu.company_id = $1 AND cu.role = 'rep' AND cu.status = 'active'
      GROUP BY cu.id, u.full_name
      ORDER BY revenue_mtd DESC
    `;
    const result = await this.db.query(query, [companyId]);
    return result.rows.map(r => ({
      ...r,
      exception_rate_mtd: r.visits_mtd > 0 ? Math.round((r.exceptions_mtd / r.visits_mtd) * 100) : 0,
      verified_rate_mtd: r.visits_mtd > 0 ? Math.round((r.verified_mtd / r.visits_mtd) * 100) : 0,
    }));
  }

  async getUnvisitedShops(companyId: string, days: number, repId?: string, regionId?: string): Promise<UnvisitedShopItem[]> {
    const values: any[] = [companyId, days];
    let repFilter = '';
    let regionFilter = '';

    if (repId) {
      values.push(repId);
      repFilter = `AND sa.rep_company_user_id = $${values.length}`;
    }

    if (regionId) {
      values.push(regionId);
      regionFilter = `AND s.region_id = $${values.length}`;
    }

    const query = `
      SELECT
        s.id AS shop_id,
        s.name AS shop_name,
        s.address AS shop_address,
        u.full_name AS assigned_rep_name,
        sa.rep_company_user_id AS assigned_rep_id,
        MAX(v.started_at) AS last_visit_at,
        CASE
          WHEN MAX(v.started_at) IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - MAX(v.started_at))::int
        END AS days_since_last_visit,
        COALESCE(SUM(CASE WHEN o.placed_at >= NOW() - INTERVAL '30 days' THEN o.total_amount ELSE 0 END), 0)::float AS revenue_30d
      FROM shops s
      LEFT JOIN LATERAL (
        SELECT rep_company_user_id FROM shop_assignments
        WHERE shop_id = s.id AND company_id = $1
        ORDER BY created_at DESC LIMIT 1
      ) sa ON true
      LEFT JOIN company_users cu ON sa.rep_company_user_id = cu.id
      LEFT JOIN users u ON cu.user_id = u.id
      LEFT JOIN visits v ON v.shop_id = s.id AND v.company_id = $1
      LEFT JOIN orders o ON o.shop_id = s.id AND o.company_id = $1
      WHERE s.company_id = $1
        AND s.is_active = true
        ${repFilter}
        ${regionFilter}
      GROUP BY s.id, s.name, s.address, u.full_name, sa.rep_company_user_id
      HAVING MAX(v.started_at) IS NULL
          OR MAX(v.started_at) < NOW() - ($2 || ' days')::INTERVAL
      ORDER BY revenue_30d DESC, days_since_last_visit DESC NULLS FIRST
    `;
    const result = await this.db.query(query, values);
    return result.rows;
  }

  async getFlaggedReps(companyId: string): Promise<FlaggedRepItem[]> {
    // 1. High exception rate (>30%) this week — any rep with >= 3 visits
    const exceptionRateQuery = `
      SELECT
        cu.id AS rep_id,
        u.full_name AS rep_name,
        COUNT(*) AS total_visits,
        SUM(CASE WHEN v.exception_reason IS NOT NULL THEN 1 ELSE 0 END)::int AS exception_count,
        ROUND((SUM(CASE WHEN v.exception_reason IS NOT NULL THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100) AS exception_rate,
        'high_exception_rate' AS flag_type,
        NULL::text AS detail
      FROM visits v
      JOIN company_users cu ON v.rep_company_user_id = cu.id
      JOIN users u ON cu.user_id = u.id
      WHERE v.company_id = $1
        AND v.started_at >= DATE_TRUNC('week', NOW())
      GROUP BY cu.id, u.full_name
      HAVING COUNT(*) >= 3
        AND (SUM(CASE WHEN v.exception_reason IS NOT NULL THEN 1 ELSE 0 END)::numeric / COUNT(*)) > 0.3
    `;

    // 2. Repeatedly starting visits far from shops (avg distance > 500m) this week
    const farAwayQuery = `
      SELECT
        cu.id AS rep_id,
        u.full_name AS rep_name,
        COUNT(*) AS total_visits,
        0::int AS exception_count,
        0 AS exception_rate,
        'frequent_far_starts' AS flag_type,
        ROUND(AVG(v.distance_m))::text || 'm avg distance' AS detail
      FROM visits v
      JOIN company_users cu ON v.rep_company_user_id = cu.id
      JOIN users u ON cu.user_id = u.id
      WHERE v.company_id = $1
        AND v.started_at >= DATE_TRUNC('week', NOW())
        AND v.distance_m IS NOT NULL
      GROUP BY cu.id, u.full_name
      HAVING COUNT(*) >= 3
        AND AVG(v.distance_m) > 500
    `;

    // 3. Same coordinates used for different shops this week (GPS copy-paste fraud)
    const repeatedCoordsQuery = `
      SELECT
        cu.id AS rep_id,
        u.full_name AS rep_name,
        COUNT(*) AS total_visits,
        0::int AS exception_count,
        0 AS exception_rate,
        'repeated_coordinates' AS flag_type,
        COUNT(DISTINCT v.shop_id)::text || ' shops, same coords' AS detail
      FROM visits v
      JOIN company_users cu ON v.rep_company_user_id = cu.id
      JOIN users u ON cu.user_id = u.id
      WHERE v.company_id = $1
        AND v.started_at >= DATE_TRUNC('week', NOW())
        AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
      GROUP BY cu.id, u.full_name, ROUND(v.latitude::numeric, 3), ROUND(v.longitude::numeric, 3)
      HAVING COUNT(DISTINCT v.shop_id) > 2
    `;

    const [r1, r2, r3] = await Promise.all([
      this.db.query(exceptionRateQuery, [companyId]),
      this.db.query(farAwayQuery, [companyId]),
      this.db.query(repeatedCoordsQuery, [companyId]),
    ]);

    // Merge and deduplicate by rep_id + flag_type
    const all = [...r1.rows, ...r2.rows, ...r3.rows];
    return all;
  }
}

export const reportsRepository = new ReportsRepository();

export interface AtRiskShopItem {
  shop_id: string;
  shop_name: string;
  assigned_rep_name: string | null;
  assigned_rep_id: string | null;
  days_since_last_visit: number | null;
  days_since_last_order: number | null;
  total_order_value_30d: number;
  last_visit_at: string | null;
  last_order_at: string | null;
}

export interface UnvisitedShopItem {
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  assigned_rep_name: string | null;
  assigned_rep_id: string | null;
  last_visit_at: string | null;
  days_since_last_visit: number | null;
  revenue_30d: number;
}

export interface LeaderboardItem {
  rep_id: string;
  rep_name: string;
  visits_today: number;
  orders_today: number;
  revenue_today: number;
  visits_week: number;
  orders_week: number;
  revenue_week: number;
  visits_mtd: number;
  orders_mtd: number;
  revenue_mtd: number;
  exceptions_mtd: number;
  verified_mtd: number;
  exception_rate_mtd: number;
  verified_rate_mtd: number;
}

export interface FlaggedRepItem {
  rep_id: string;
  rep_name: string;
  flag_type: 'high_exception_rate' | 'frequent_far_starts' | 'repeated_coordinates';
  total_visits: number;
  exception_count: number;
  exception_rate: number;
  detail: string | null;
}
