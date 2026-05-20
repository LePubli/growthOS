-- ============================================================
-- CRM Prospecting Plugin — Migration 002
-- Tables pipeline
-- ============================================================

CREATE TABLE IF NOT EXISTS pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(20) DEFAULT '#017E84',
  icon        VARCHAR(10),
  order_index INTEGER DEFAULT 0,
  probability FLOAT DEFAULT 0.5,  -- probabilité de closing (0-1)
  is_won      BOOLEAN DEFAULT FALSE,
  is_lost     BOOLEAN DEFAULT FALSE,
  auto_action JSONB DEFAULT '{}',  -- action auto au passage (ex: envoyer email)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON pipeline_stages(pipeline_id, order_index);

-- Pipeline par défaut + stages
DO $$
DECLARE
  p_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO pipelines (id, name, is_default) VALUES (p_id, 'Pipeline principal', TRUE)
  ON CONFLICT DO NOTHING;

  INSERT INTO pipeline_stages (pipeline_id, name, color, order_index, probability) VALUES
    (p_id, 'Nouveau',     '#6C757D', 0, 0.1),
    (p_id, 'Contacté',    '#017E84', 1, 0.2),
    (p_id, 'Qualifié',    '#17A2B8', 2, 0.4),
    (p_id, 'Proposition', '#F0AD4E', 3, 0.6),
    (p_id, 'Négociation', '#FD7E14', 4, 0.8),
    (p_id, 'Gagné',       '#28A745', 5, 1.0),
    (p_id, 'Perdu',       '#DC3545', 6, 0.0)
  ON CONFLICT DO NOTHING;
END $$;

-- FK prospect -> stage
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;
