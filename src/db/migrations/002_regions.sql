CREATE TABLE IF NOT EXISTS regions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#f4a261', -- hex colour for UI chips
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_regions_company
  ON regions (company_id);

-- auto-update updated_at
DROP TRIGGER IF EXISTS trg_regions_updated_at ON regions;
CREATE TRIGGER trg_regions_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── shops: add optional region FK ─────────────────────────────────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shops_region
  ON shops (company_id, region_id);

-- ── company_users: add optional default region ────────────────────────────
-- Lets managers filter their dashboard by the rep's home region.
ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS default_region_id UUID REFERENCES regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_users_region
  ON company_users (company_id, default_region_id);
