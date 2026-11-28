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

export async function runEreputationFoundationsMigration(): Promise<void> {
  await pool.query(SQL_EREPUTATION_FOUNDATIONS);
}
