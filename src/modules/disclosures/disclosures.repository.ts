import { pool } from '../../db/pool';

export interface WorkTrackingDisclosure {
  id: string;
  user_id: string;
  disclosure_acknowledged: boolean;
  policy_version: string;
  app_version: string | null;
  device_id: string | null;
  acknowledged_at: Date;
}

export const disclosuresRepository = {
  async getDisclosure(userId: string, policyVersion: string): Promise<WorkTrackingDisclosure | null> {
    const res = await pool.query(
      'SELECT * FROM work_tracking_disclosures WHERE user_id = $1 AND policy_version = $2',
      [userId, policyVersion]
    );
    return res.rows[0] || null;
  },

  async acknowledgeDisclosure(
    userId: string,
    policyVersion: string,
    appVersion?: string,
    deviceId?: string
  ): Promise<WorkTrackingDisclosure> {
    const res = await pool.query(
      `INSERT INTO work_tracking_disclosures (user_id, disclosure_acknowledged, policy_version, app_version, device_id, acknowledged_at)
       VALUES ($1, true, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, policy_version)
       DO UPDATE SET 
         disclosure_acknowledged = true,
         app_version = EXCLUDED.app_version,
         device_id = EXCLUDED.device_id,
         acknowledged_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, policyVersion, appVersion || null, deviceId || null]
    );
    return res.rows[0];
  }
};
