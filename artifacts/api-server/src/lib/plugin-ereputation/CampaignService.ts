import { pool } from "@workspace/db";
type PoolClient = { query: typeof pool.query };
import { logger } from "../logger";
import { memoryService } from "../plugin-growth-memory/MemoryService";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { sentimentAnalyzer } from "./SentimentAnalyzer";
import { changeLog, type ChangeActor } from "./ChangeLog";

/**
 * Campagnes e-réputation.
 *
 * Cible : « B2B » = entité (entreprise, établissement, marque) ;
 *         « B2C » = personne physique (particulier, dirigeant).
 * Une campagne B2C exige un mandat RGPD et une date de fin de conservation
 * (voir docs/ereputation/CAHIER-DES-CHARGES.md §4).
 *
 * Règle transversale : aucune mesure n'est inventée. Un score sans mesure réelle
 * vaut null (« non évalué ») et une écriture en échec remonte une erreur.
 */

export type TargetType = "B2B" | "B2C";
export type CampaignStatus = "active" | "paused" | "archived";
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["active", "paused", "archived"];

export class CampaignError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export interface CampaignInput {
  name: string;
  targetType: TargetType;
  targetName: string;
  targetUrl?: string | null;
  keywords?: string[];
  description?: string | null;
  prospectId?: string | null;
  subjectAliases?: string[];
  subjectLocation?: string | null;
  subjectRole?: string | null;
  mandateReference?: string | null;
  mandateSignatory?: string | null;
  mandateSignedAt?: string | null;
  mandateScope?: string | null;
  retentionUntil?: string | null;
  status?: CampaignStatus;
}

export interface CreateCampaignInput extends CampaignInput {
  tenantId: string;
  actor?: ChangeActor;
}

export interface Mandate {
  reference: string | null;
  signatory: string | null;
  signedAt: string | null;
  scope: string | null;
  retentionUntil: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  targetType: TargetType;
  subjectKind: "person" | "entity";
  targetName: string;
  targetUrl: string | null;
  keywords: string[];
  description: string | null;
  prospectId: string | null;
  prospectLabel: string | null;
  subjectAliases: string[];
  subjectLocation: string | null;
  subjectRole: string | null;
  mandate: Mandate;
  status: CampaignStatus;
  /** null = non évalué (aucune mesure réelle). */
  reputationScore: number | null;
  scoreUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDashboard {
  campaign: Campaign;
  reputationScore: number | null;
  scoreBreakdown: { serp: number | null; sentiment: number | null; backlinks: number | null; social: null };
  serpEvolution: { date: string; avgPosition: number }[];
  sentimentSummary: { pos: number; neg: number; neu: number };
  recentPosts: Post[];
  aiTasks: string[];
}

export interface Post {
  id: string;
  platform: string;
  contentText: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
}

/** Champs suivis dans l'historique, avec leur nom de colonne SQL. */
const TRACKED_FIELDS: Record<string, string> = {
  name: "name", targetType: "target_type", targetName: "target_name", targetUrl: "target_url",
  keywords: "keywords", description: "description", prospectId: "prospect_id",
  subjectAliases: "subject_aliases", subjectLocation: "subject_location", subjectRole: "subject_role",
  mandateReference: "mandate_reference", mandateSignatory: "mandate_signatory",
  mandateSignedAt: "mandate_signed_at", mandateScope: "mandate_scope",
  retentionUntil: "retention_until", status: "status",
};
const JSON_FIELDS = new Set(["keywords", "subjectAliases"]);

const CAMPAIGN_SELECT = `SELECT c.*, NULLIF(TRIM(CONCAT_WS(' ', p.company, CASE WHEN p.company IS NULL THEN CONCAT_WS(' ', p.first_name, p.last_name) END)), '') AS prospect_label
  FROM erep_campaigns c LEFT JOIN prospects p ON p.id = c.prospect_id AND p.tenant_id = c.tenant_id`;

function isoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    // Les colonnes DATE sont lues en heure locale par node-postgres.
    const y = value.getFullYear(), m = String(value.getMonth() + 1).padStart(2, "0"), d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function isoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(v => v.trim()).filter(Boolean))];
}

export class CampaignService {
  async listCampaigns(tenantId: string, options: { includeArchived?: boolean } = {}): Promise<Campaign[]> {
    const { rows } = await pool.query(
      `${CAMPAIGN_SELECT} WHERE c.tenant_id = $1 ${options.includeArchived ? "" : "AND c.status <> 'archived'"}
       ORDER BY c.created_at DESC`,
      [tenantId],
    );
    return rows.map(r => this.mapCampaign(r));
  }

  async getCampaign(campaignId: string, tenantId: string): Promise<Campaign | null> {
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return null;
    const { rows } = await pool.query(`${CAMPAIGN_SELECT} WHERE c.id = $1 AND c.tenant_id = $2`, [campaignId, tenantId]);
    return rows[0] ? this.mapCampaign(rows[0]) : null;
  }

  /** Vérifie la cohérence métier d'une campagne complète (création ou état après modification). */
  private validate(c: CampaignInput, tenantToday = new Date()): void {
    if (!c.name?.trim()) throw new CampaignError("Le nom de la campagne est requis");
    if (!c.targetName?.trim()) throw new CampaignError("Le nom de la cible est requis");
    if (c.targetType !== "B2B" && c.targetType !== "B2C") throw new CampaignError("Type de cible invalide : B2B (entité) ou B2C (personne physique)");
    if (c.targetType === "B2C") {
      // Personne physique : mandat RGPD obligatoire (cahier des charges §4).
      const missing = [
        !c.mandateReference?.trim() && "référence du mandat",
        !c.mandateSignatory?.trim() && "signataire du mandat",
        !c.mandateSignedAt && "date de signature du mandat",
        !c.retentionUntil && "date de fin de conservation",
      ].filter(Boolean);
      if (missing.length) throw new CampaignError(`Personne physique : mandat RGPD incomplet (${missing.join(", ")})`);
      if (c.mandateSignedAt! > c.retentionUntil!) throw new CampaignError("La fin de conservation doit suivre la signature du mandat");
      const today = isoDate(tenantToday)!;
      if (c.mandateSignedAt! > today) throw new CampaignError("La date de signature du mandat ne peut pas être future");
      if ((c.status ?? "active") === "active" && c.retentionUntil! < today) {
        throw new CampaignError("Conservation expirée : renouvelez le mandat avant d'activer la campagne");
      }
    }
  }

  private async assertProspect(client: PoolClient | typeof pool, tenantId: string, prospectId: string | null | undefined): Promise<void> {
    if (!prospectId) return;
    const { rowCount } = await client.query(`SELECT 1 FROM prospects WHERE id = $1 AND tenant_id = $2`, [prospectId, tenantId]);
    if (!rowCount) throw new CampaignError("Fiche CRM introuvable dans votre agence", 404);
  }

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const data: CampaignInput = {
      ...input,
      name: input.name?.trim(), targetName: input.targetName?.trim(),
      keywords: cleanList(input.keywords), subjectAliases: cleanList(input.subjectAliases),
      status: input.status ?? "active",
    };
    this.validate(data);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.assertProspect(client, input.tenantId, data.prospectId);
      const { rows } = await client.query(
        `INSERT INTO erep_campaigns (name, tenant_id, target_type, target_name, target_url, keywords, status,
           description, prospect_id, subject_aliases, subject_location, subject_role,
           mandate_reference, mandate_signatory, mandate_signed_at, mandate_scope, retention_until,
           reputation_score, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULL,$18,$18) RETURNING id`,
        [data.name, input.tenantId, data.targetType, data.targetName, data.targetUrl || null,
          JSON.stringify(data.keywords), data.status, data.description || null, data.prospectId || null,
          JSON.stringify(data.subjectAliases), data.subjectLocation || null, data.subjectRole || null,
          data.mandateReference || null, data.mandateSignatory || null, data.mandateSignedAt || null,
          data.mandateScope || null, data.retentionUntil || null, input.actor?.userId ?? null],
      );
      const id = rows[0].id as string;
      const created: Record<string, { before: null; after: unknown }> = {};
      for (const key of Object.keys(TRACKED_FIELDS)) {
        const value = (data as unknown as Record<string, unknown>)[key];
        if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && !value.length)) created[key] = { before: null, after: value };
      }
      await changeLog.record(client, { tenantId: input.tenantId, campaignId: id, actor: input.actor, action: "create", changes: created });
      await client.query("COMMIT");
      const campaign = (await this.getCampaign(id, input.tenantId))!;
      logger.info({ campaignId: id }, "E-reputation campaign created");
      pluginEventBus.emit("erep.campaign.created", {
        campaignId: id, tenantId: input.tenantId, targetName: campaign.targetName, targetType: campaign.targetType,
      }).catch((err) => logger.warn({ err }, "Could not emit erep.campaign.created"));
      return campaign;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Modification partielle. Seuls les champs fournis sont modifiés ; chaque écart est historisé. */
  async updateCampaign(campaignId: string, tenantId: string, patch: CampaignInput | Partial<CampaignInput>, actor?: ChangeActor): Promise<Campaign> {
    const current = await this.getCampaign(campaignId, tenantId);
    if (!current) throw new CampaignError("Campagne introuvable", 404);
    const before = this.toInput(current);
    const normalized: Partial<CampaignInput> = { ...patch };
    if (patch.keywords) normalized.keywords = cleanList(patch.keywords);
    if (patch.subjectAliases) normalized.subjectAliases = cleanList(patch.subjectAliases);
    if (typeof patch.name === "string") normalized.name = patch.name.trim();
    if (typeof patch.targetName === "string") normalized.targetName = patch.targetName.trim();
    const after: CampaignInput = { ...before, ...normalized };
    // Une personne physique reste une personne : sinon la purge RGPD et
    // l'expurgation de l'historique (qui se fondent sur target_type) ne
    // s'appliqueraient plus aux données déjà collectées.
    if (before.targetType === "B2C" && after.targetType !== "B2C") {
      throw new CampaignError("Une campagne personne physique ne peut pas devenir une entité : créez une nouvelle campagne entité");
    }
    this.validate(after);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(TRACKED_FIELDS)) {
      if (!(key in normalized)) continue;
      const a = (before as unknown as Record<string, unknown>)[key] ?? null;
      const b = (after as unknown as Record<string, unknown>)[key] ?? null;
      const empty = (v: unknown) => v === null || v === "" || (Array.isArray(v) && !v.length);
      if (empty(a) && empty(b)) continue;
      if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { before: a, after: b };
    }
    if (!Object.keys(changes).length) return current;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if ("prospectId" in changes) await this.assertProspect(client, tenantId, after.prospectId);
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of Object.keys(changes)) {
        const value = (after as unknown as Record<string, unknown>)[key];
        values.push(JSON_FIELDS.has(key) ? JSON.stringify(value ?? []) : (value === "" ? null : value ?? null));
        sets.push(`${TRACKED_FIELDS[key]} = $${values.length}`);
      }
      values.push(actor?.userId ?? null, campaignId, tenantId);
      const { rowCount } = await client.query(
        `UPDATE erep_campaigns SET ${sets.join(", ")}, updated_by = $${values.length - 2}, updated_at = NOW()
         WHERE id = $${values.length - 1} AND tenant_id = $${values.length}`,
        values,
      );
      if (!rowCount) throw new CampaignError("Campagne introuvable", 404);
      const onlyStatus = Object.keys(changes).length === 1 && "status" in changes;
      await changeLog.record(client, { tenantId, campaignId, actor, action: onlyStatus ? "status" : "update", changes });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return (await this.getCampaign(campaignId, tenantId))!;
  }

  async setStatus(campaignId: string, tenantId: string, status: CampaignStatus, actor?: ChangeActor): Promise<Campaign> {
    return this.updateCampaign(campaignId, tenantId, { status }, actor);
  }

  /**
   * Suppression définitive de la campagne et de toutes ses données collectées
   * (cascade SQL). L'historique est conservé ; pour une personne physique, les
   * valeurs personnelles de l'historique sont expurgées.
   */
  async deleteCampaign(campaignId: string, tenantId: string, actor?: ChangeActor, reason: "delete" | "retention_purge" = "delete"): Promise<{ deleted: true; redacted: boolean }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT id, name, target_type, target_name FROM erep_campaigns WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [campaignId, tenantId],
      );
      if (!rows[0]) throw new CampaignError("Campagne introuvable", 404);
      const person = rows[0].target_type === "B2C";
      const counts = await client.query(
        `SELECT (SELECT COUNT(*) FROM erep_serp_tracking WHERE campaign_id = $1)::int AS serp,
                (SELECT COUNT(*) FROM erep_sentiment_logs WHERE campaign_id = $1)::int AS mentions,
                (SELECT COUNT(*) FROM erep_content_posts WHERE campaign_id = $1)::int AS posts,
                (SELECT COUNT(*) FROM erep_audits WHERE campaign_id = $1)::int AS audits,
                (SELECT COUNT(*) FROM erep_mentions WHERE campaign_id = $1)::int AS "watchMentions",
                (SELECT COUNT(*) FROM erep_reviews WHERE campaign_id = $1)::int AS reviews`,
        [campaignId],
      );
      // Copies indexées dans la mémoire IA (audits, variations de score) : pas de
      // clé étrangère, donc supprimées explicitement avant la cascade des audits.
      const memory = await client.query(
        `DELETE FROM memory_documents
          WHERE tenant_id = $2
            AND (metadata->>'campaignId' = $1::text
                 OR (source_type IN ('ereputation_audit', 'erep_audit')
                     AND (source_id = $1::text
                          OR source_id IN (SELECT id::text FROM erep_audits WHERE campaign_id = $1::text::uuid))))`,
        [campaignId, tenantId],
      );
      counts.rows[0].memoryDocuments = memory.rowCount ?? 0;
      // Les sites PBN appartiennent à l'agence : ils sont détachés, pas supprimés (ON DELETE SET NULL).
      await client.query(`DELETE FROM erep_campaigns WHERE id = $1 AND tenant_id = $2`, [campaignId, tenantId]);
      if (person) await changeLog.redactCampaign(client, tenantId, campaignId);
      await changeLog.record(client, {
        tenantId, campaignId, actor, action: reason, redacted: person,
        changes: {
          name: { before: person ? "[données personnelles purgées]" : rows[0].name, after: null },
          deletedData: { before: counts.rows[0], after: null },
        },
      });
      await client.query("COMMIT");
      logger.info({ campaignId, reason }, "E-reputation campaign deleted");
      return { deleted: true, redacted: person };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDashboard(campaignId: string, tenantId: string): Promise<CampaignDashboard | null> {
    const campaign = await this.getCampaign(campaignId, tenantId);
    if (!campaign) return null;

    const reputationScore = await this.calculateReputationScore(campaignId);
    const [serpEvolution, sentimentSummary, recentPosts, scoreBreakdown] = await Promise.all([
      this.getSerpEvolution(campaignId), this.getSentimentSummary(campaignId),
      this.getRecentPosts(campaignId), this.getScoreBreakdown(campaignId),
    ]);

    // Tâches dérivées uniquement des mesures disponibles (aucune consigne codée en dur).
    const aiTasks: string[] = [];
    const measured = serpEvolution.length + sentimentSummary.pos + sentimentSummary.neg + sentimentSummary.neu;
    if (!measured) aiTasks.push("Aucune mesure : lancer une première collecte SERP ou de mentions");
    if (sentimentSummary.neg > 0) aiTasks.push(`${sentimentSummary.neg} mention(s) négative(s) à qualifier et à traiter`);
    if (reputationScore !== null && reputationScore < 50) aiTasks.push("Score inférieur à 50 : lancer un audit approfondi");
    if (campaign.mandate.retentionUntil) {
      const days = Math.ceil((new Date(campaign.mandate.retentionUntil).getTime() - Date.now()) / 86400000);
      if (days <= 30) aiTasks.push(`Mandat RGPD : fin de conservation dans ${Math.max(0, days)} jour(s), renouveler ou clôturer`);
    }

    return {
      campaign: { ...campaign, reputationScore },
      reputationScore, scoreBreakdown, serpEvolution, sentimentSummary, recentPosts, aiTasks,
    };
  }

  /** Lecture des composantes mesurées ; null = composante sans mesure. */
  private async readComponents(campaignId: string, sinceDays?: number) {
    const serpRes = await pool.query(
      // position NULL = absence constatée du top 100 : mesure réelle, notée 0.
      `SELECT AVG(CASE WHEN position IS NULL THEN 0 WHEN position <= 3 THEN 100 WHEN position <= 10 THEN 70 WHEN position <= 20 THEN 40 ELSE 10 END) AS score
       FROM erep_serp_tracking WHERE campaign_id = $1
       ${sinceDays ? `AND date >= CURRENT_DATE - INTERVAL '${Number(sinceDays)} days'` : ""}`,
      [campaignId],
    );
    const sentRes = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE sentiment = 'pos')::int AS pos, COUNT(*) FILTER (WHERE sentiment = 'neg')::int AS neg, COUNT(*)::int AS total
       FROM erep_sentiment_logs WHERE campaign_id = $1`,
      [campaignId],
    );
    const pbnRes = await pool.query(
      `SELECT AVG(da_score) AS avg_da FROM erep_pbn_sites WHERE campaign_id = $1 AND status = 'active'`,
      [campaignId],
    );
    const serp = serpRes.rows[0]?.score != null ? Math.round(Number(serpRes.rows[0].score)) : null;
    const total = Number(sentRes.rows[0]?.total ?? 0);
    const sentiment = total
      ? Math.max(0, Math.min(100, Math.round((Number(sentRes.rows[0].pos) / total) * 100 - (Number(sentRes.rows[0].neg) / total) * 30)))
      : null;
    const backlinks = pbnRes.rows[0]?.avg_da != null ? Math.min(100, Math.round(Number(pbnRes.rows[0].avg_da) * 1.5)) : null;
    return { serp, sentiment, backlinks };
  }

  /**
   * Score pondéré 40 % SERP + 30 % sentiment + 20 % backlinks, normalisé sur les
   * seules composantes mesurées. Sans aucune mesure : null.
   * L'événement erep.score.updated n'est émis que si le score change, pour ne
   * pas recréer d'alertes à chaque consultation du tableau de bord.
   */
  async calculateReputationScore(campaignId: string): Promise<number | null> {
    const c = await this.readComponents(campaignId, 30);
    const readings = [
      { score: c.serp, weight: 0.4 }, { score: c.sentiment, weight: 0.3 }, { score: c.backlinks, weight: 0.2 },
    ].filter((r): r is { score: number; weight: number } => r.score !== null);
    const weight = readings.reduce((sum, r) => sum + r.weight, 0);
    const final = weight ? Math.round(readings.reduce((sum, r) => sum + r.score * r.weight, 0) / weight) : null;

    const { rows } = await pool.query<{ tenant_id: string; target_name: string; reputation_score: number | null }>(
      `SELECT tenant_id, target_name, reputation_score FROM erep_campaigns WHERE id = $1`, [campaignId],
    );
    const previous = rows[0]?.reputation_score ?? null;
    if (!rows[0] || previous === final) return final;

    await pool.query(
      `UPDATE erep_campaigns SET reputation_score = $1, score_updated_at = NOW() WHERE id = $2`,
      [final, campaignId],
    );
    if (final !== null) {
      pluginEventBus.emit("erep.score.updated", {
        campaignId, tenantId: rows[0].tenant_id, targetName: rows[0].target_name,
        previousScore: previous ?? final, newScore: final,
      }).catch(err => logger.warn({ err }, "Could not emit erep.score.updated"));
    }
    return final;
  }

  async runAudit(campaignId: string, tenantId: string): Promise<Record<string, unknown>> {
    const evidence = await pool.query<{ total: string }>(
      `SELECT (SELECT COUNT(*) FROM erep_serp_tracking WHERE campaign_id = $1) +
              (SELECT COUNT(*) FROM erep_sentiment_logs WHERE campaign_id = $1) AS total`, [campaignId]);
    const count = Number(evidence.rows[0]?.total || 0);
    if (count === 0) throw new CampaignError("Aucune mesure SERP ou mention réelle : audit impossible sans données.", 422);
    const score = await this.calculateReputationScore(campaignId);

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (score === null) weaknesses.push("Mesures trop anciennes : aucune donnée sur les 30 derniers jours");
    else if (score >= 70) strengths.push("Bonne réputation mesurée");
    else if (score >= 40) strengths.push("Réputation correcte avec des opportunités d'amélioration");
    else weaknesses.push("Score de réputation insuffisant — action prioritaire");

    const technicalDetails = {
      score, checkedAt: new Date().toISOString(),
      measurements: { source: "erep_serp_tracking + erep_sentiment_logs", count },
      strengths, weaknesses,
    };
    const { rows } = await pool.query(
      `INSERT INTO erep_audits (campaign_id, score, technical_details, ai_strategy) VALUES ($1, $2, $3, NULL) RETURNING id`,
      [campaignId, score ?? 0, JSON.stringify(technicalDetails)],
    );
    const auditId = rows[0].id as string;

    const campaign = await this.getCampaign(campaignId, tenantId);
    if (campaign) {
      await memoryService.indexDocument({
        sourceType: "ereputation_audit", sourceId: auditId,
        content: `Audit SEO/E-Réputation pour ${campaign.targetName}: score ${score ?? "non évalué"}/100. Points forts: ${strengths.join(", ") || "N/A"}. Points faibles: ${weaknesses.join(", ") || "N/A"}.`,
        tenantId, metadata: { campaignId, targetName: campaign.targetName, score },
      }).catch(() => undefined); // plugin mémoire facultatif
    }
    logger.info({ campaignId, score }, "E-reputation audit completed");
    return { auditId, score, technicalDetails };
  }

  async addSentimentLog(campaignId: string, text: string, sourceUrl?: string | null) {
    const result = sentimentAnalyzer.analyzeText(text);
    await pool.query(
      `INSERT INTO erep_sentiment_logs (campaign_id, source_url, text, sentiment, score) VALUES ($1, $2, $3, $4, $5)`,
      [campaignId, sourceUrl || null, text, result.sentiment, result.score],
    );
    if (result.score < -0.5) {
      try {
        const campaign = await pool.query(`SELECT target_name FROM erep_campaigns WHERE id = $1`, [campaignId]);
        const targetName = campaign.rows[0]?.target_name ?? "Inconnu";
        await pluginEventBus.emit("signal.received", {
          type: "reputation_crisis", company: targetName,
          title: `Mention très négative pour ${targetName}`,
          description: `Mention très négative détectée (score: ${result.score.toFixed(2)}): "${text.slice(0, 100)}..."`,
          impactScore: 90,
          metadata: { campaignId, sentiment: result.sentiment, score: result.score },
        });
      } catch (err) {
        logger.warn({ err }, "Could not emit reputation crisis signal");
      }
    }
    return result;
  }

  async getSerpData(campaignId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT keyword, position, url, volume, date,
              LAG(position) OVER (PARTITION BY keyword ORDER BY date, created_at) AS previous_position
       FROM erep_serp_tracking WHERE campaign_id = $1 ORDER BY date DESC, keyword`,
      [campaignId],
    );
    return rows;
  }

  async addSerpEntry(campaignId: string, keyword: string, position: number | null, url?: string | null, volume?: number | null): Promise<void> {
    await pool.query(
      `INSERT INTO erep_serp_tracking (campaign_id, keyword, position, url, volume) VALUES ($1, $2, $3, $4, $5)`,
      [campaignId, keyword, position, url || null, volume ?? null],
    );
  }

  async createPost(campaignId: string, platform: string, content: string, scheduledAt?: string): Promise<Record<string, unknown>> {
    const { rows } = await pool.query(
      `INSERT INTO erep_content_posts (campaign_id, platform, content_text, scheduled_at) VALUES ($1, $2, $3, $4) RETURNING *`,
      [campaignId, platform, content, scheduledAt ?? null],
    );
    return rows[0];
  }

  async getPosts(campaignId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(`SELECT * FROM erep_content_posts WHERE campaign_id = $1 ORDER BY created_at DESC`, [campaignId]);
    return rows;
  }

  async getPbnSites(tenantId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(`SELECT * FROM erep_pbn_sites WHERE tenant_id = $1 ORDER BY da_score DESC NULLS LAST`, [tenantId]);
    return rows;
  }

  async addPbnSite(tenantId: string, campaignId: string | null, url: string, daScore: number | null, paScore: number | null): Promise<Record<string, unknown>> {
    if (campaignId && !(await this.getCampaign(campaignId, tenantId))) throw new CampaignError("Campagne introuvable", 404);
    const { rows } = await pool.query(
      `INSERT INTO erep_pbn_sites (tenant_id, campaign_id, url, da_score, pa_score) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, campaignId ?? null, url, daScore, paScore],
    );
    return rows[0];
  }

  async getSentimentLogs(campaignId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(
      `SELECT * FROM erep_sentiment_logs WHERE campaign_id = $1 ORDER BY detected_at DESC LIMIT 50`, [campaignId],
    );
    return rows;
  }

  /** Score global de l'agence : moyenne des seules campagnes évaluées. */
  async getGlobalScore(tenantId: string) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS campaigns,
              COUNT(reputation_score)::int AS evaluated,
              ROUND(AVG(reputation_score))::int AS score
       FROM erep_campaigns WHERE tenant_id = $1 AND status <> 'archived'`,
      [tenantId],
    );
    const mentions = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE l.sentiment = 'pos')::int AS pos, COUNT(*) FILTER (WHERE l.sentiment = 'neg')::int AS neg, COUNT(*)::int AS total
       FROM erep_sentiment_logs l JOIN erep_campaigns c ON c.id = l.campaign_id WHERE c.tenant_id = $1 AND c.status <> 'archived'`,
      [tenantId],
    );
    return { ...rows[0], mentions: mentions.rows[0] } as {
      campaigns: number; evaluated: number; score: number | null; mentions: { pos: number; neg: number; total: number };
    };
  }

  private async getSerpEvolution(campaignId: string) {
    const { rows } = await pool.query(
      `SELECT date::text AS date, AVG(position) AS avg_position FROM erep_serp_tracking
       WHERE campaign_id = $1 AND position IS NOT NULL GROUP BY date ORDER BY date DESC LIMIT 30`,
      [campaignId],
    );
    return rows.map(r => ({ date: r.date, avgPosition: parseFloat(r.avg_position) })).reverse();
  }

  private async getSentimentSummary(campaignId: string) {
    const { rows } = await pool.query(
      `SELECT sentiment, COUNT(*)::int AS count FROM erep_sentiment_logs WHERE campaign_id = $1 GROUP BY sentiment`, [campaignId],
    );
    const summary = { pos: 0, neg: 0, neu: 0 };
    for (const r of rows) if (r.sentiment in summary) summary[r.sentiment as keyof typeof summary] = Number(r.count);
    return summary;
  }

  private async getRecentPosts(campaignId: string): Promise<Post[]> {
    const { rows } = await pool.query(
      `SELECT * FROM erep_content_posts WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 5`, [campaignId],
    );
    return rows.map(r => ({ id: r.id, platform: r.platform, contentText: r.content_text, status: r.status, scheduledAt: r.scheduled_at, publishedAt: r.published_at }));
  }

  private async getScoreBreakdown(campaignId: string): Promise<CampaignDashboard["scoreBreakdown"]> {
    const c = await this.readComponents(campaignId);
    return { ...c, social: null };
  }

  private toInput(c: Campaign): CampaignInput {
    return {
      name: c.name, targetType: c.targetType, targetName: c.targetName, targetUrl: c.targetUrl,
      keywords: c.keywords, description: c.description, prospectId: c.prospectId,
      subjectAliases: c.subjectAliases, subjectLocation: c.subjectLocation, subjectRole: c.subjectRole,
      mandateReference: c.mandate.reference, mandateSignatory: c.mandate.signatory,
      mandateSignedAt: c.mandate.signedAt, mandateScope: c.mandate.scope,
      retentionUntil: c.mandate.retentionUntil, status: c.status,
    };
  }

  private mapCampaign(row: Record<string, unknown>): Campaign {
    const targetType = row.target_type === "B2C" ? "B2C" : "B2B";
    const status = CAMPAIGN_STATUSES.includes(row.status as CampaignStatus) ? row.status as CampaignStatus : "paused";
    return {
      id: row.id as string,
      name: row.name as string,
      targetType,
      subjectKind: targetType === "B2C" ? "person" : "entity",
      targetName: row.target_name as string,
      targetUrl: (row.target_url as string | null) ?? null,
      keywords: Array.isArray(row.keywords) ? row.keywords as string[] : [],
      description: (row.description as string | null) ?? null,
      prospectId: (row.prospect_id as string | null) ?? null,
      prospectLabel: (row.prospect_label as string | null) ?? null,
      subjectAliases: Array.isArray(row.subject_aliases) ? row.subject_aliases as string[] : [],
      subjectLocation: (row.subject_location as string | null) ?? null,
      subjectRole: (row.subject_role as string | null) ?? null,
      mandate: {
        reference: (row.mandate_reference as string | null) ?? null,
        signatory: (row.mandate_signatory as string | null) ?? null,
        signedAt: isoDate(row.mandate_signed_at),
        scope: (row.mandate_scope as string | null) ?? null,
        retentionUntil: isoDate(row.retention_until),
      },
      status,
      reputationScore: row.reputation_score == null ? null : Number(row.reputation_score),
      scoreUpdatedAt: isoTimestamp(row.score_updated_at),
      createdAt: isoTimestamp(row.created_at)!,
      updatedAt: isoTimestamp(row.updated_at)!,
    };
  }
}

export const campaignService = new CampaignService();
