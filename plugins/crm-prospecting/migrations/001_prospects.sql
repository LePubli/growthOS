-- ============================================================
-- CRM Prospecting Plugin — Migration 001
-- Table prospects (tenant schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS prospects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    VARCHAR(500) NOT NULL,
  siren           VARCHAR(9),
  siret           VARCHAR(14),
  naf_code        VARCHAR(10),
  naf_label       VARCHAR(255),
  legal_form      VARCHAR(100),
  address         TEXT,
  postal_code     VARCHAR(10),
  city            VARCHAR(100),
  department      VARCHAR(3),
  region          VARCHAR(100),
  country         VARCHAR(2) DEFAULT 'FR',
  employee_range  VARCHAR(50),
  phone           VARCHAR(30),
  email           VARCHAR(255),
  email_verified  BOOLEAN DEFAULT FALSE,
  email_confidence FLOAT DEFAULT 0,
  website         VARCHAR(500),
  linkedin_url    VARCHAR(500),

  -- Scoring
  propensity_score    FLOAT,
  propensity_category VARCHAR(10) CHECK (propensity_category IN ('HOT', 'WARM', 'COLD')),
  score_details       JSONB DEFAULT '{}',

  -- Pipeline
  stage_id        UUID,
  pipeline_id     UUID,
  assigned_to     UUID,
  deal_value      DECIMAL(10,2),

  -- Metadata
  sources_used    JSONB DEFAULT '[]',
  tags            JSONB DEFAULT '[]',
  custom_fields   JSONB DEFAULT '{}',
  notes           TEXT,

  -- Status
  is_archived     BOOLEAN DEFAULT FALSE,
  is_unsubscribed BOOLEAN DEFAULT FALSE,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_siren ON prospects(siren) WHERE siren IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage_id);
CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(propensity_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_city ON prospects(city);
CREATE INDEX IF NOT EXISTS idx_prospects_naf ON prospects(naf_code);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned ON prospects(assigned_to);

-- Full text search
CREATE INDEX IF NOT EXISTS idx_prospects_search ON prospects USING gin(
  to_tsvector('french', COALESCE(company_name, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(naf_label, ''))
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospects_updated_at ON prospects;
CREATE TRIGGER prospects_updated_at BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id   UUID REFERENCES prospects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  type          VARCHAR(50) NOT NULL, -- call, email, meeting, note, task
  title         VARCHAR(255),
  description   TEXT,
  outcome       VARCHAR(100),
  metadata      JSONB DEFAULT '{}',
  is_done       BOOLEAN DEFAULT FALSE,
  done_at       TIMESTAMPTZ,
  due_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_prospect ON activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(due_at) WHERE is_done = FALSE;
