-- Create staff activity logs table
CREATE TABLE IF NOT EXISTS staff_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    rep_company_user_id UUID NOT NULL REFERENCES company_users(id),
    date DATE NOT NULL,
    walking_duration_ms BIGINT DEFAULT 0,
    driving_duration_ms BIGINT DEFAULT 0,
    still_duration_ms BIGINT DEFAULT 0,
    total_distance_km DECIMAL(10, 3) DEFAULT 0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rep_company_user_id, date)
);

CREATE INDEX idx_staff_activity_date ON staff_activity_logs(date);
CREATE INDEX idx_staff_activity_rep ON staff_activity_logs(rep_company_user_id);
