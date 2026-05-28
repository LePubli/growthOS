-- Migration 003 — Signals
CREATE TABLE IF NOT EXISTS signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  UUID REFERENCES prospects(id) ON DELETE CASCADE,
  type         VARCHAR(100) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  source       VARCHAR(100),
  severity     VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read      BOOLEAN DEFAULT FALSE,
  signal_date  TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_prospect ON signals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
CREATE INDEX IF NOT EXISTS idx_signals_unread ON signals(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON signals(severity);

-- Migration 005 — Sourcing Jobs
CREATE TABLE IF NOT EXISTS sourcing_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  sources      JSONB DEFAULT '[]',
  config       JSONB DEFAULT '{}',
  status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress     INTEGER DEFAULT 0,
  found_count  INTEGER DEFAULT 0,
  new_count    INTEGER DEFAULT 0,
  error        TEXT,
  created_by   UUID,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_jobs_status ON sourcing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_jobs_created ON sourcing_jobs(created_at DESC);

-- Migration 004 — Email sequences
CREATE TABLE IF NOT EXISTS email_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id              UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number              INTEGER NOT NULL,
  wait_days                INTEGER DEFAULT 0,
  subject_template         TEXT NOT NULL,
  body_template            TEXT NOT NULL,
  use_ai_personalization   BOOLEAN DEFAULT FALSE,
  ai_prompt                TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id     UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  prospect_id     UUID REFERENCES prospects(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  current_step    INTEGER DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced', 'error')),
  sent_count      INTEGER DEFAULT 0,
  open_count      INTEGER DEFAULT 0,
  reply_count     INTEGER DEFAULT 0,
  next_send_at    TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_sends (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_contact_id   UUID REFERENCES sequence_contacts(id) ON DELETE CASCADE,
  step_number           INTEGER NOT NULL,
  subject               TEXT NOT NULL,
  body_html             TEXT NOT NULL,
  tracking_id           VARCHAR(32),
  status                VARCHAR(20) DEFAULT 'pending',
  sent_at               TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  replied_at            TIMESTAMPTZ,
  error                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sequence_contacts_unique ON sequence_contacts(sequence_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_tracking ON email_sends(tracking_id);
CREATE INDEX IF NOT EXISTS idx_sequence_contacts_send ON sequence_contacts(next_send_at) WHERE status = 'active';
