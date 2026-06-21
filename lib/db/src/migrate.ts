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

const SQL_PROSPECT_GEO = `
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS prospects_geo_idx ON prospects(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
`;

export async function runProspectGeoMigration(): Promise<void> {
  await pool.query(SQL_PROSPECT_GEO);
}

const SQL_ENRICHMENT = `
CREATE TABLE IF NOT EXISTS enrichment_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  endpoint_url TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  last_tested_at TIMESTAMP,
  test_status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrichment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  processed_data JSONB,
  confidence_score FLOAT DEFAULT 0.0,
  fetched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(prospect_id, source_id, data_type)
);

CREATE TABLE IF NOT EXISTS enrichment_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  impact_score INTEGER DEFAULT 50,
  detected_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrichment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  cache_value JSONB NOT NULL,
  source_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS enrichment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  sources_attempted INTEGER DEFAULT 0,
  sources_succeeded INTEGER DEFAULT 0,
  sources_failed INTEGER DEFAULT 0,
  error_log JSONB,
  triggered_by TEXT DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_enrichment_data_prospect ON enrichment_data(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_data_source ON enrichment_data(source_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_signals_prospect ON enrichment_signals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_key ON enrichment_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_prospect ON enrichment_history(prospect_id);
`;

export async function runEnrichmentMigration(): Promise<void> {
  await pool.query(SQL_ENRICHMENT);
}

const SQL_EREPUTATION = `
CREATE TABLE IF NOT EXISTS erep_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'B2B',
  target_name TEXT NOT NULL,
  target_url TEXT,
  keywords JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  reputation_score INTEGER DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erep_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50,
  technical_details JSONB,
  ai_strategy TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erep_serp_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  position INTEGER,
  url TEXT,
  volume INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erep_content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erep_sentiment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  source_url TEXT,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neu',
  score NUMERIC(4,2) DEFAULT 0,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erep_pbn_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES erep_campaigns(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  da_score INTEGER DEFAULT 0,
  pa_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erep_campaigns_tenant ON erep_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erep_audits_campaign ON erep_audits(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_serp_campaign ON erep_serp_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_posts_campaign ON erep_content_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_sentiment_campaign ON erep_sentiment_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_pbn_tenant ON erep_pbn_sites(tenant_id);
`;

export async function runEreputationMigration(): Promise<void> {
  await pool.query(SQL_EREPUTATION);
}

const SQL_EREP_INTEGRATIONS = `
-- Alerts E-Rep persistées par l'EventBus
CREATE TABLE IF NOT EXISTS erep_alerts (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID      REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  tenant_id   UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        TEXT      NOT NULL DEFAULT 'warning'
              CHECK (type IN ('crisis','warning','score_drop','serp_drop')),
  severity    TEXT      NOT NULL DEFAULT 'medium'
              CHECK (severity IN ('high','medium','low')),
  title       TEXT      NOT NULL,
  description TEXT,
  score       INTEGER   DEFAULT 50,
  is_resolved BOOLEAN   NOT NULL DEFAULT false,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_alerts_tenant   ON erep_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erep_alerts_campaign ON erep_alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_alerts_resolved ON erep_alerts(is_resolved);

-- Colonne reputation_health_score sur accounts (ajout conditionnel — la table accounts
-- est créée dans runEreputationMigration ou runMigrations selon l'environnement)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
  ) THEN
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reputation_health_score INTEGER DEFAULT 50;
  END IF;
END
$$;

-- Portail client : contenu en attente d'approbation
CREATE TABLE IF NOT EXISTS erep_approvals (
  id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID      REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  tenant_id     UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id       UUID      REFERENCES erep_content_posts(id) ON DELETE CASCADE,
  submitted_by  UUID      REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by   UUID      REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT      NOT NULL DEFAULT 'pending_approval'
                CHECK (status IN ('pending_approval','approved','rejected','scheduled')),
  reviewer_note TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_approvals_tenant   ON erep_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erep_approvals_campaign ON erep_approvals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_erep_approvals_status   ON erep_approvals(status);
`;

export async function runErepIntegrationsMigration(): Promise<void> {
  await pool.query(SQL_EREP_INTEGRATIONS);
}

const SQL_TASKS = `
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'todo'
               CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority     TEXT        NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('high', 'medium', 'low')),
  due_date     TIMESTAMP,
  completed_at TIMESTAMP,
  entity_type  TEXT,
  entity_id    UUID,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tasks_tenant_idx   ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx   ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_entity_idx   ON tasks(entity_type, entity_id) WHERE entity_id IS NOT NULL;
`;

export async function runTasksMigration(): Promise<void> {
  await pool.query(SQL_TASKS);
}

const SQL_ENTERPRISE = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  entity_type  TEXT        NOT NULL,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  metadata     JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx   ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx   ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx  ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS consent_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT        NOT NULL,
  granted      BOOLEAN     NOT NULL DEFAULT false,
  ip_address   TEXT,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS consent_logs_tenant_idx ON consent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS consent_logs_user_idx   ON consent_logs(user_id);

CREATE TABLE IF NOT EXISTS sso_configs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider          TEXT        NOT NULL CHECK (provider IN ('azure','okta','google','onelogin','saml')),
  sso_url           TEXT        NOT NULL,
  entity_id         TEXT,
  certificate       TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT false,
  attribute_mapping JSONB,
  updated_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS sso_configs_tenant_idx ON sso_configs(tenant_id);
`;

export async function runEnterpriseMigration(): Promise<void> {
  await pool.query(SQL_ENTERPRISE);
}

const SQL_SAAS = `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  plan                    TEXT        NOT NULL DEFAULT 'starter',
  status                  TEXT        NOT NULL DEFAULT 'trialing',
  current_period_end      TIMESTAMP,
  created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_idx ON subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount            INTEGER     NOT NULL DEFAULT 0,
  currency          TEXT        NOT NULL DEFAULT 'eur',
  status            TEXT        NOT NULL DEFAULT 'draft',
  invoice_url       TEXT,
  created_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_tenant_idx   ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS invoices_created_idx  ON invoices(created_at DESC);

CREATE TABLE IF NOT EXISTS usage_limits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource        TEXT        NOT NULL,
  limit_value     INTEGER     NOT NULL DEFAULT 1000,
  current_usage   INTEGER     NOT NULL DEFAULT 0,
  period_start    TIMESTAMP   NOT NULL DEFAULT date_trunc('month', NOW()),
  updated_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, resource)
);
CREATE INDEX IF NOT EXISTS usage_limits_tenant_idx ON usage_limits(tenant_id);

CREATE TABLE IF NOT EXISTS mentions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  mentioned_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type         TEXT        NOT NULL,
  entity_id           UUID,
  content             TEXT        NOT NULL,
  is_read             BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mentions_tenant_idx        ON mentions(tenant_id);
CREATE INDEX IF NOT EXISTS mentions_mentioned_user_idx ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS mentions_entity_idx        ON mentions(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  response_code   INTEGER,
  payload         JSONB,
  response_body   TEXT,
  error_message   TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_logs_webhook_idx ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS webhook_logs_status_idx  ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS webhook_logs_created_idx ON webhook_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  event_name  TEXT        NOT NULL,
  properties  JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analytics_events_tenant_idx  ON analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS analytics_events_event_idx   ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at DESC);
`;

export async function runSaaSMigration(): Promise<void> {
  await pool.query(SQL_SAAS);
}

export async function runProviderKeysMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS provider_api_keys (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider       TEXT        NOT NULL,
      api_key        TEXT        NOT NULL,
      api_secret     TEXT,
      endpoint_url   TEXT,
      is_active      BOOLEAN     NOT NULL DEFAULT true,
      last_used_at   TIMESTAMP,
      created_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
      CONSTRAINT provider_api_keys_tenant_provider_uq UNIQUE(tenant_id, provider)
    );
    CREATE INDEX IF NOT EXISTS provider_api_keys_tenant_idx   ON provider_api_keys(tenant_id);
    CREATE INDEX IF NOT EXISTS provider_api_keys_provider_idx ON provider_api_keys(provider);
  `);
}

export async function runPlansMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name             TEXT        NOT NULL UNIQUE,
      display_name     TEXT        NOT NULL,
      description      TEXT,
      price_monthly    INTEGER     NOT NULL DEFAULT 0,
      price_yearly     INTEGER     NOT NULL DEFAULT 0,
      features         JSONB       NOT NULL DEFAULT '[]',
      limits           JSONB       NOT NULL DEFAULT '{}',
      is_active        BOOLEAN     NOT NULL DEFAULT true,
      is_default       BOOLEAN     NOT NULL DEFAULT false,
      stripe_price_id  TEXT,
      stripe_price_yearly_id TEXT,
      created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP   NOT NULL DEFAULT NOW()
    );

    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

    -- 3 plans par défaut
    INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, features, limits, is_active, is_default)
    VALUES
      ('starter', 'Starter', 'Idéal pour démarrer votre prospection B2B',
       4900, 49000,
       '["Jusqu\''à 500 prospects","3 séquences email","2 utilisateurs","1 000 emails/mois","Support email","Export CSV"]'::jsonb,
       '{"users":2,"prospects":500,"sequences":3,"emails_per_month":1000,"enrichments_per_month":50,"signals_per_month":20}'::jsonb,
       true, true),
      ('pro', 'Pro', 'Pour les équipes de vente ambitieuses',
       14900, 149000,
       '["Jusqu\''à 5 000 prospects","Séquences illimitées","10 utilisateurs","50 000 emails/mois","Enrichissement IA","Signaux d\''intention","Support prioritaire","API access"]'::jsonb,
       '{"users":10,"prospects":5000,"sequences":-1,"emails_per_month":50000,"enrichments_per_month":500,"signals_per_month":200}'::jsonb,
       true, false),
      ('enterprise', 'Enterprise', 'Solutions sur mesure pour les grandes équipes',
       49900, 499000,
       '["Prospects illimités","Utilisateurs illimités","Emails illimités","Toutes intégrations","SLA garanti","Account Manager dédié","Onboarding custom","SSO / SAML"]'::jsonb,
       '{"users":-1,"prospects":-1,"sequences":-1,"emails_per_month":-1,"enrichments_per_month":-1,"signals_per_month":-1}'::jsonb,
       true, false)
    ON CONFLICT (name) DO NOTHING;
  `);
}

export async function runRBACMigration(): Promise<void> {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

    CREATE TABLE IF NOT EXISTS rbac_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      permissions JSONB NOT NULL DEFAULT '[]',
      is_system BOOLEAN NOT NULL DEFAULT false,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS rbac_roles_name_tenant_idx
      ON rbac_roles (name, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

    CREATE TABLE IF NOT EXISTS rbac_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      module TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rbac_role_permissions (
      role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS rbac_user_roles (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (user_id, role_id)
    );

    -- Permissions
    INSERT INTO rbac_permissions (name, description, module) VALUES
      ('prospects:read',    'Voir les prospects',            'crm'),
      ('prospects:write',   'Créer/modifier les prospects',  'crm'),
      ('prospects:delete',  'Supprimer les prospects',       'crm'),
      ('deals:read',        'Voir le pipeline',              'crm'),
      ('deals:write',       'Créer/modifier les deals',      'crm'),
      ('deals:delete',      'Supprimer les deals',           'crm'),
      ('signals:read',      'Voir les signaux',              'intelligence'),
      ('signals:write',     'Gérer les signaux',             'intelligence'),
      ('sequences:read',    'Voir les séquences',            'outreach'),
      ('sequences:write',   'Créer/modifier les séquences',  'outreach'),
      ('sequences:send',    'Envoyer les séquences',         'outreach'),
      ('templates:read',    'Voir les templates',            'outreach'),
      ('templates:write',   'Créer/modifier les templates',  'outreach'),
      ('activities:read',   'Voir les activités',            'crm'),
      ('activities:write',  'Créer les activités',           'crm'),
      ('accounts:read',     'Voir les comptes',              'intelligence'),
      ('accounts:write',    'Modifier les comptes',          'intelligence'),
      ('enrichment:read',   'Voir l enrichissement',         'intelligence'),
      ('enrichment:write',  'Lancer l enrichissement',       'intelligence'),
      ('sourcing:read',     'Voir le sourcing',              'intelligence'),
      ('sourcing:write',    'Lancer le sourcing',            'intelligence'),
      ('analytics:read',    'Voir les analytics',            'analytics'),
      ('analytics:export',  'Exporter les données',          'analytics'),
      ('meetings:read',     'Voir les réunions',             'collaboration'),
      ('meetings:write',    'Créer les réunions',            'collaboration'),
      ('tasks:read',        'Voir les tâches',               'collaboration'),
      ('tasks:write',       'Créer/modifier les tâches',     'collaboration'),
      ('workflows:read',    'Voir les workflows',            'automation'),
      ('workflows:write',   'Créer/modifier les workflows',  'automation'),
      ('webhooks:read',     'Voir les webhooks',             'system'),
      ('webhooks:write',    'Configurer les webhooks',       'system'),
      ('plugins:read',      'Voir les plugins',              'system'),
      ('plugins:write',     'Activer/désactiver les plugins','system'),
      ('users:read',        'Voir les utilisateurs',         'admin'),
      ('users:write',       'Créer/modifier les utilisateurs','admin'),
      ('users:delete',      'Supprimer les utilisateurs',    'admin'),
      ('roles:read',        'Voir les rôles',                'admin'),
      ('roles:write',       'Créer/modifier les rôles',      'admin'),
      ('billing:read',      'Voir la facturation',           'admin'),
      ('billing:write',     'Modifier la facturation',       'admin'),
      ('ereputation:read',  'Voir l e-réputation',           'ereputation'),
      ('ereputation:write', 'Gérer l e-réputation',          'ereputation'),
      ('ai:use',            'Utiliser les outils IA',        'ai'),
      ('memory:read',       'Voir la mémoire',               'ai'),
      ('memory:write',      'Écrire dans la mémoire',        'ai')
    ON CONFLICT (name) DO NOTHING;

    -- Rôles système
    INSERT INTO rbac_roles (name, description, permissions, is_system, tenant_id) VALUES
      ('admin',      'Administrateur — accès complet',
       '["prospects:read","prospects:write","prospects:delete","deals:read","deals:write","deals:delete","signals:read","signals:write","sequences:read","sequences:write","sequences:send","templates:read","templates:write","activities:read","activities:write","accounts:read","accounts:write","enrichment:read","enrichment:write","sourcing:read","sourcing:write","analytics:read","analytics:export","meetings:read","meetings:write","tasks:read","tasks:write","workflows:read","workflows:write","webhooks:read","webhooks:write","plugins:read","plugins:write","users:read","users:write","users:delete","roles:read","roles:write","billing:read","billing:write","ereputation:read","ereputation:write","ai:use","memory:read","memory:write"]'::jsonb,
       true, NULL),
      ('manager',    'Manager — supervision équipe + analytics',
       '["prospects:read","prospects:write","deals:read","deals:write","signals:read","sequences:read","sequences:write","sequences:send","activities:read","activities:write","accounts:read","enrichment:read","analytics:read","analytics:export","meetings:read","meetings:write","tasks:read","tasks:write","users:read","ereputation:read","ai:use","memory:read"]'::jsonb,
       true, NULL),
      ('commercial', 'Commercial — CRM + prospection + outreach',
       '["prospects:read","prospects:write","deals:read","deals:write","signals:read","sequences:read","sequences:write","sequences:send","templates:read","activities:read","activities:write","accounts:read","meetings:read","meetings:write","tasks:read","tasks:write","ai:use","memory:read","memory:write"]'::jsonb,
       true, NULL),
      ('viewer',     'Observateur — lecture seule',
       '["prospects:read","deals:read","signals:read","sequences:read","activities:read","accounts:read","analytics:read","meetings:read","tasks:read","ereputation:read"]'::jsonb,
       true, NULL)
    ON CONFLICT DO NOTHING;
  `);
}

export async function runAutopilotMigration(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS autopilot_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      condition_json JSONB NOT NULL DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_config JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS autopilot_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      rule_id UUID REFERENCES autopilot_rules(id) ON DELETE SET NULL,
      trigger_event TEXT NOT NULL,
      execution_result TEXT NOT NULL DEFAULT 'success',
      result_details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_autopilot_rules_tenant ON autopilot_rules(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_autopilot_rules_event ON autopilot_rules(trigger_event);
    CREATE INDEX IF NOT EXISTS idx_autopilot_logs_tenant ON autopilot_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_autopilot_logs_rule ON autopilot_logs(rule_id);
  `);
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

export async function runDealProspectLinkMigration(): Promise<void> {
  await pool.query(`
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
  `);
}

export async function runSignalEnhanceMigration(): Promise<void> {
  await pool.query(`
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
  `);
}
