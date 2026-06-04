import { pool } from "./index";

const SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  branding JSONB,
  settings JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  score INTEGER DEFAULT 0,
  is_starred BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT,
  value NUMERIC(12,2) DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'lead',
  probability INTEGER DEFAULT 20,
  close_date TEXT,
  prospect TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  steps JSONB DEFAULT '[]',
  enrolled INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  open_rate NUMERIC(5,2) DEFAULT 0,
  reply_rate NUMERIC(5,2) DEFAULT 0,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  score INTEGER DEFAULT 50,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'done',
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP,
  done_at TIMESTAMP,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL DEFAULT 'prospect_created',
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  executions INTEGER DEFAULT 0,
  last_run_at TIMESTAMP,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outreach',
  variables JSONB DEFAULT '[]',
  used_count INTEGER DEFAULT 0,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events JSONB DEFAULT '[]',
  secret TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deliveries INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS plugin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL,
  plugin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plugin_audit_logs_plugin_id_idx ON plugin_audit_logs(plugin_id);
CREATE INDEX IF NOT EXISTS plugin_audit_logs_created_at_idx ON plugin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_plugins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        UNIQUE NOT NULL,
  name         TEXT        NOT NULL,
  version      TEXT        NOT NULL,
  description  TEXT,
  author       TEXT        NOT NULL DEFAULT 'Unknown',
  manifest     JSONB       NOT NULL DEFAULT '{}',
  files_path   TEXT        NOT NULL,
  state        TEXT        NOT NULL DEFAULT 'uploaded'
               CHECK (state IN ('uploaded', 'installed', 'active', 'error')),
  extends      TEXT,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS uploaded_plugins_state_idx ON uploaded_plugins(state);
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SQL_GROWTH_MEMORY = `
CREATE TABLE IF NOT EXISTS memory_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT        NOT NULL,
  source_id   TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  tenant_id   TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS memory_documents_tenant_idx ON memory_documents(tenant_id);
CREATE INDEX IF NOT EXISTS memory_documents_source_idx ON memory_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS memory_documents_updated_idx ON memory_documents(updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_embeddings (
  document_id UUID  PRIMARY KEY REFERENCES memory_documents(id) ON DELETE CASCADE,
  embedding   JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const SQL_MEETING_INTELLIGENCE = `
CREATE TABLE IF NOT EXISTS meetings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  transcript   TEXT,
  summary      TEXT,
  action_items JSONB       NOT NULL DEFAULT '[]',
  tenant_id    TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meetings_tenant_idx  ON meetings(tenant_id);
CREATE INDEX IF NOT EXISTS meetings_status_idx  ON meetings(status);
CREATE INDEX IF NOT EXISTS meetings_created_idx ON meetings(created_at DESC);
`;

export async function runMeetingIntelligenceMigration(): Promise<void> {
  await pool.query(SQL_MEETING_INTELLIGENCE);
}

export async function runGrowthMemoryMigration(): Promise<void> {
  await pool.query(SQL_GROWTH_MEMORY);
}

const SQL_PLUGIN_STATES = `
CREATE TABLE IF NOT EXISTS plugin_states (
  plugin_id TEXT PRIMARY KEY,
  state     TEXT NOT NULL DEFAULT 'ACTIVE',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function runPluginStateMigration(): Promise<void> {
  await pool.query(SQL_PLUGIN_STATES);
}

const SQL_ACCOUNT_INTELLIGENCE = `
CREATE TABLE IF NOT EXISTS account_metrics (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       TEXT        NOT NULL,
  tenant_id        TEXT        NOT NULL,
  health_score     INTEGER     NOT NULL DEFAULT 0,
  engagement_level TEXT        NOT NULL DEFAULT 'low'
                               CHECK (engagement_level IN ('low', 'medium', 'high', 'very_high')),
  last_activity_at TIMESTAMPTZ,
  score_breakdown  JSONB       NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS account_metrics_tenant_idx  ON account_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS account_metrics_score_idx   ON account_metrics(health_score DESC);
CREATE INDEX IF NOT EXISTS account_metrics_activity_idx ON account_metrics(last_activity_at DESC);
`;

export async function runAccountIntelligenceMigration(): Promise<void> {
  await pool.query(SQL_ACCOUNT_INTELLIGENCE);
}

const SQL_SIGNAL_INTELLIGENCE = `
ALTER TABLE signals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'read', 'actioned'));
ALTER TABLE signals ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
`;

export async function runSignalIntelligenceMigration(): Promise<void> {
  await pool.query(SQL_SIGNAL_INTELLIGENCE);
}

const SQL_DEAL_COACH = `
ALTER TABLE deals ADD COLUMN IF NOT EXISTS health_score INTEGER NOT NULL DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS risk_factors JSONB NOT NULL DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_recommendations TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_coached_at TIMESTAMPTZ;
`;

export async function runDealCoachMigration(): Promise<void> {
  await pool.query(SQL_DEAL_COACH);
}

const SQL_KNOWLEDGE_BASE = `
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'faq'
              CHECK (category IN ('playbook','objection','script','procedure','faq')),
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  tenant_id   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_articles_tenant_idx    ON knowledge_articles(tenant_id);
CREATE INDEX IF NOT EXISTS knowledge_articles_category_idx  ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS knowledge_articles_created_idx   ON knowledge_articles(created_at DESC);
`;

export async function runKnowledgeBaseMigration(): Promise<void> {
  await pool.query(SQL_KNOWLEDGE_BASE);
}

const SQL_SOURCING = `
CREATE TABLE IF NOT EXISTS sourcing_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'queued',
  count       INTEGER     NOT NULL DEFAULT 0,
  duration    TEXT        NOT NULL DEFAULT '—',
  params      JSONB       NOT NULL DEFAULT '{}',
  progress    INTEGER     NOT NULL DEFAULT 0,
  error       TEXT,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sourcing_jobs_tenant_idx  ON sourcing_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS sourcing_jobs_status_idx  ON sourcing_jobs(status);
CREATE INDEX IF NOT EXISTS sourcing_jobs_created_idx ON sourcing_jobs(created_at DESC);
`;

const SQL_NOTIFICATIONS = `
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL DEFAULT 'system',
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  href        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  payload     JSONB       NOT NULL DEFAULT '{}',
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_tenant_idx  ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at DESC);
`;

export async function runSourcingMigration(): Promise<void> {
  await pool.query(SQL_SOURCING);
}

export async function runNotificationsMigration(): Promise<void> {
  await pool.query(SQL_NOTIFICATIONS);
}

export async function runMigrations(maxAttempts = 10): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await pool.query(SQL);
      return;
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      await sleep(delay);
    }
  }
}
