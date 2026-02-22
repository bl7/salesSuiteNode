CREATE TABLE IF NOT EXISTS work_tracking_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disclosure_acknowledged BOOLEAN NOT NULL DEFAULT false,
  policy_version VARCHAR(50) NOT NULL,
  app_version VARCHAR(50),
  device_id VARCHAR(255),
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, policy_version)
);
