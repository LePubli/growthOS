import { pool } from "./index";

/**
 * E-réputation — lot 1 « fondations » (agent 3, 28/11/2026).
 *
 * Migration strictement additive et idempotente, exécutée après
 * runEreputationMigration() et runErepIntegrationsMigration() :
 *  - cible personne physique (B2C) ou entité (B2B), liée au CRM ;
 *  - mandat RGPD et date de fin de conservation pour les personnes ;
 *  - score « non évalué » (NULL) au lieu d'une valeur par défaut fictive ;
 *  - historique des modifications conservé après suppression d'une campagne.
 *
 * Aucune table existante n'est supprimée ; aucune colonne existante n'est renommée.
 */
const SQL_EREPUTATION_FOUNDATIONS = `
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS subject_aliases JSONB NOT NULL DEFAULT '[]';
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS subject_location TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS subject_role TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS mandate_reference TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS mandate_signatory TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS mandate_signed_at DATE;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS mandate_scope TEXT;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS retention_until DATE;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE erep_campaigns ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMP;

-- Un score n'existe que s'il a été calculé à partir de mesures réelles.
ALTER TABLE erep_campaigns ALTER COLUMN reputation_score DROP DEFAULT;
ALTER TABLE erep_campaigns ALTER COLUMN reputation_score DROP NOT NULL;

-- Correction des valeurs fictives historiques (50 par défaut, 0 sans mesure) :
-- une campagne sans aucune mesure n'a pas de score. Idempotent.
UPDATE erep_campaigns c SET reputation_score = NULL
 WHERE c.reputation_score IS NOT NULL AND c.score_updated_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM erep_serp_tracking s WHERE s.campaign_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM erep_sentiment_logs l WHERE l.campaign_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM erep_pbn_sites p WHERE p.campaign_id = c.id AND p.status = 'active');

CREATE INDEX IF NOT EXISTS idx_erep_campaigns_prospect ON erep_campaigns(prospect_id);
CREATE INDEX IF NOT EXISTS idx_erep_campaigns_retention ON erep_campaigns(retention_until) WHERE retention_until IS NOT NULL;

-- Historique des interventions. campaign_id n'a volontairement pas de clé
-- étrangère : la trace d'une suppression doit survivre à la campagne.
CREATE TABLE IF NOT EXISTS erep_change_log (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  UUID      NOT NULL,
  actor_user_id UUID,
  actor_email  TEXT,
  action       TEXT      NOT NULL,
  changes      JSONB     NOT NULL DEFAULT '{}',
  redacted     BOOLEAN   NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_change_log_campaign ON erep_change_log(tenant_id, campaign_id, created_at DESC);
`;

/**
 * E-réputation — lot 2 « veille » (agent 3). Additive et idempotente.
 * Toutes les données collectées dépendent de la campagne (ON DELETE CASCADE) :
 * la suppression ou la purge RGPD d'une campagne efface aussi sa veille.
 */
const SQL_EREPUTATION_WATCH = `
CREATE TABLE IF NOT EXISTS erep_watch_settings (
  campaign_id     UUID        PRIMARY KEY REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engines         JSONB       NOT NULL DEFAULT '["google_search","bing"]',
  extra_queries   JSONB       NOT NULL DEFAULT '[]',
  maps_url        TEXT,
  pagesjaunes_url TEXT,
  news_enabled    BOOLEAN     NOT NULL DEFAULT true,
  rss_feeds       JSONB       NOT NULL DEFAULT '[]',
  frequency       TEXT        NOT NULL DEFAULT 'daily' CHECK (frequency IN ('off','daily','weekly')),
  daily_depth     INTEGER     NOT NULL DEFAULT 20 CHECK (daily_depth BETWEEN 10 AND 100),
  weekly_depth    INTEGER     NOT NULL DEFAULT 50 CHECK (weekly_depth BETWEEN 10 AND 100),
  next_run_at     TIMESTAMPTZ,
  next_weekly_at  TIMESTAMPTZ,
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_watch_settings_due ON erep_watch_settings(next_run_at) WHERE frequency <> 'off';

CREATE TABLE IF NOT EXISTS erep_watch_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL CHECK (kind IN ('daily','weekly','manual')),
  depth        INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_user','completed','partial','failed','cancelled')),
  steps        JSONB       NOT NULL DEFAULT '[]',
  stats        JSONB       NOT NULL DEFAULT '{}',
  message      TEXT,
  lease        UUID,
  lease_until  TIMESTAMPTZ,
  attempts     INTEGER     NOT NULL DEFAULT 0,
  not_before   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_erep_watch_runs_active ON erep_watch_runs(campaign_id) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS idx_erep_watch_runs_queue ON erep_watch_runs(status, not_before);
CREATE INDEX IF NOT EXISTS idx_erep_watch_runs_campaign ON erep_watch_runs(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS erep_serp_snapshots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  run_id      UUID        NOT NULL REFERENCES erep_watch_runs(id) ON DELETE CASCADE,
  engine      TEXT        NOT NULL,
  query       TEXT        NOT NULL,
  position    INTEGER     NOT NULL,
  url         TEXT        NOT NULL,
  title       TEXT,
  snippet     TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_serp_snapshots_lookup ON erep_serp_snapshots(campaign_id, engine, query, captured_at DESC);

-- Une ligne par requête lue avec succès, y compris un relevé vide.
CREATE TABLE IF NOT EXISTS erep_serp_collections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  run_id       UUID        NOT NULL REFERENCES erep_watch_runs(id) ON DELETE CASCADE,
  engine       TEXT        NOT NULL,
  query        TEXT        NOT NULL,
  depth        INTEGER     NOT NULL,
  result_count INTEGER     NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, engine, query)
);
CREATE INDEX IF NOT EXISTS idx_erep_serp_collections_lookup ON erep_serp_collections(campaign_id, engine, query, captured_at DESC);

CREATE TABLE IF NOT EXISTS erep_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  run_id         UUID        REFERENCES erep_watch_runs(id) ON DELETE SET NULL,
  source         TEXT        NOT NULL,
  fingerprint    TEXT        NOT NULL,
  external_id    TEXT,
  author         TEXT,
  rating         NUMERIC(2,1),
  review_date    TEXT,
  text           TEXT,
  owner_response BOOLEAN     NOT NULL DEFAULT false,
  sentiment      TEXT        NOT NULL DEFAULT 'neu',
  score          NUMERIC(4,2) NOT NULL DEFAULT 0,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS erep_review_stats (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  run_id       UUID        REFERENCES erep_watch_runs(id) ON DELETE SET NULL,
  source       TEXT        NOT NULL,
  rating       NUMERIC(2,1),
  review_count INTEGER,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erep_review_stats_campaign ON erep_review_stats(campaign_id, source, captured_at DESC);

CREATE TABLE IF NOT EXISTS erep_mentions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id   UUID        NOT NULL REFERENCES erep_campaigns(id) ON DELETE CASCADE,
  run_id        UUID        REFERENCES erep_watch_runs(id) ON DELETE SET NULL,
  kind          TEXT        NOT NULL CHECK (kind IN ('serp','review','news')),
  source        TEXT        NOT NULL,
  fingerprint   TEXT        NOT NULL,
  url           TEXT,
  title         TEXT,
  excerpt       TEXT,
  published_at  TIMESTAMPTZ,
  sentiment     TEXT        NOT NULL DEFAULT 'neu',
  score         NUMERIC(4,2) NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','ignored')),
  baseline      BOOLEAN     NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_erep_mentions_feed ON erep_mentions(campaign_id, status, first_seen_at DESC);
`;

export async function runEreputationFoundationsMigration(): Promise<void> {
  await pool.query(SQL_EREPUTATION_FOUNDATIONS);
  await pool.query(SQL_EREPUTATION_WATCH);
}
