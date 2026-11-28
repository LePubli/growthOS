import { pool } from "@workspace/db";
import { logger } from "../logger";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { createNotification } from "../../services/notification.service";
import { CampaignError, parisDay } from "./CampaignService";
import { changeLog, type ChangeActor } from "./ChangeLog";

/**
 * E-réputation — lot 3 : alertes et plans de crise.
 *
 *  - Une alerte est créée au plus une fois (clé de dédoublonnage par campagne),
 *    enregistrée dans erep_alerts, poussée dans la cloche de notifications avec
 *    un lien vers la campagne, et peut déclencher un e-mail immédiat.
 *  - Les alertes restent internes à l'agence : plus aucune écriture dans le fil
 *    « signals » de la prospection (données personnelles d'une cible B2C).
 *  - Un plan de crise s'ouvre quand un seuil est franchi et ne se ferme que par
 *    une décision de l'agence. Aucune action n'est exécutée automatiquement :
 *    le plan liste des actions légitimes à réaliser et cocher.
 */
export type AlertType = "crisis" | "negative_mention" | "critical_mention" | "low_review" | "rating_drop" | "negative_serp" | "score_low" | "score_drop" | "watch_blocked";
export type Severity = "high" | "medium" | "low";

export interface AlertRules {
  negativeMention: boolean;
  criticalMention: boolean;
  lowReview: boolean;
  /** Baisse de note moyenne (sur 5) qui déclenche une alerte ; null = désactivé. */
  ratingDrop: number | null;
  /** Un résultat négatif qui entre dans ce top déclenche une alerte ; null = désactivé. */
  negativeSerpTop: number | null;
  scoreLow: number | null;
  scoreDrop: number | null;
  watchBlocked: boolean;
  crisis: { alertScore: number; crisisScore: number; criticalAlert: number; criticalCrisis: number; negativeVigilance: number; negativeAlert: number };
}

export const DEFAULT_RULES: AlertRules = {
  negativeMention: true, criticalMention: true, lowReview: true, ratingDrop: 0.3, negativeSerpTop: 10, scoreLow: 40, scoreDrop: 10, watchBlocked: true,
  crisis: { alertScore: 55, crisisScore: 40, criticalAlert: 1, criticalCrisis: 3, negativeVigilance: 2, negativeAlert: 5 },
};

export const CRISIS_LEVELS: Record<number, string> = { 1: "Vigilance", 2: "Alerte", 3: "Crise" };

type Action = { id: string; label: string; level: number; done: boolean; doneAt: string | null; doneBy: string | null; assigneeId: string | null };

/** Actions légitimes par niveau. Rien n'est publié ni envoyé automatiquement. */
function actionTemplates(level: number, person: boolean): Omit<Action, "done" | "doneAt" | "doneBy" | "assigneeId">[] {
  const all = [
    { id: "qualify", level: 1, label: "Qualifier les nouvelles mentions négatives dans le fil de veille" },
    { id: "review_drafts", level: 1, label: "Préparer les réponses aux avis récents (brouillons à faire valider)" },
    { id: "content_plan", level: 1, label: "Planifier un contenu positif sur une propriété maîtrisée" },
    { id: "client_inform", level: 2, label: "Informer le client et valider avec lui la ligne de réponse" },
    { id: "reply_publish", level: 2, label: "Publier les réponses validées aux avis négatifs (action humaine)" },
    { id: "source_contact", level: 2, label: "Demander une rectification factuelle au site source" },
    { id: "positive_content", level: 2, label: "Publier deux contenus positifs et légitimes (site, profils, communiqué)" },
    { id: "watch_daily", level: 2, label: "Passer la veille en rythme quotidien" },
    ...(person ? [{ id: "personal_data", level: 2, label: "Vérifier l'exposition de données personnelles et demander leur retrait" }] : []),
    { id: "single_contact", level: 3, label: "Désigner un interlocuteur unique côté client et côté agence" },
    { id: "statement", level: 3, label: "Préparer une déclaration validée par le client" },
    { id: "platform_report", level: 3, label: "Signaler à la plateforme les contenus illicites ou faux avis (procédure officielle)" },
    person
      ? { id: "rgpd_delist", level: 3, label: "Déposer une demande de déréférencement RGPD (droit à l'effacement) auprès des moteurs" }
      : { id: "legal", level: 3, label: "Consulter un avocat en cas de propos diffamatoires" },
    { id: "burial", level: 3, label: "Accélérer l'enfouissement des résultats négatifs par des contenus et profils légitimes" },
  ];
  return all.filter(a => a.level <= level);
}

function mergeRules(stored: any): AlertRules {
  const r = stored && typeof stored === "object" ? stored : {};
  return { ...DEFAULT_RULES, ...r, crisis: { ...DEFAULT_RULES.crisis, ...(r.crisis ?? {}) } };
}


const hrefOf = (campaignId: string, tab = "alerts") => `/ereputation/watch?campaign=${campaignId}&tab=${tab}`;

type CampaignRow = { id: string; tenant_id: string; target_name: string; target_type: string; reputation_score: number | null; status: string };

export class AlertService {
  /** Envoi immédiat des alertes critiques (branché par ErepDigest pour éviter une dépendance circulaire). */
  onCritical: ((tenantId: string, alertId: string) => Promise<void>) | null = null;

  private async campaign(campaignId: string): Promise<CampaignRow | null> {
    return (await pool.query(`SELECT id, tenant_id, target_name, target_type, reputation_score, status FROM erep_campaigns WHERE id = $1`, [campaignId])).rows[0] ?? null;
  }

  async getRules(campaignId: string): Promise<AlertRules> {
    const row = (await pool.query(`SELECT rules FROM erep_alert_settings WHERE campaign_id = $1`, [campaignId])).rows[0];
    return mergeRules(row?.rules);
  }

  async saveRules(campaignId: string, tenantId: string, input: Partial<AlertRules>, userId?: string): Promise<AlertRules> {
    const rules = mergeRules({ ...(await this.getRules(campaignId)), ...input, crisis: { ...(await this.getRules(campaignId)).crisis, ...(input.crisis ?? {}) } });
    if (rules.crisis.crisisScore > rules.crisis.alertScore) throw new CampaignError("Le seuil de crise doit être inférieur ou égal au seuil d'alerte.", 400);
    await pool.query(
      `INSERT INTO erep_alert_settings (campaign_id, tenant_id, rules, updated_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (campaign_id) DO UPDATE SET rules = EXCLUDED.rules, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [campaignId, tenantId, JSON.stringify(rules), userId ?? null]);
    return rules;
  }

  /** Crée l'alerte si elle n'existe pas encore (clé de dédoublonnage). Retourne son id si créée. */
  async raise(c: CampaignRow, a: { type: AlertType; severity: Severity; title: string; description: string; dedupKey: string; payload?: Record<string, unknown>; tab?: string }): Promise<string | null> {
    const href = hrefOf(c.id, a.tab);
    const { rows } = await pool.query(
      `INSERT INTO erep_alerts (campaign_id, tenant_id, type, severity, title, description, score, dedup_key, payload, href)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (campaign_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING RETURNING id`,
      [c.id, c.tenant_id, a.type, a.severity, a.title.slice(0, 300), a.description.slice(0, 1000), c.reputation_score ?? null, a.dedupKey, JSON.stringify(a.payload ?? {}), href]);
    const id = rows[0]?.id as string | undefined;
    if (!id) return null;
    await createNotification({
      type: "signal", title: a.title.slice(0, 200), body: a.description.slice(0, 500), href, tenantId: c.tenant_id,
      payload: { module: "ereputation", campaignId: c.id, alertId: id, alertType: a.type, severity: a.severity },
    });
    // Déclencheur Autopilot existant (actions internes uniquement) ; l'alerte est déjà enregistrée.
    pluginEventBus.emit("erep.alert", {
      persisted: true, alertId: id, campaignId: c.id, tenantId: c.tenant_id, targetName: c.target_name,
      alertType: a.type, severity: a.severity, title: a.title, description: a.description, score: c.reputation_score ?? 0,
    }).catch(() => undefined);
    if (a.severity === "high" && this.onCritical) this.onCritical(c.tenant_id, id).catch(err => logger.warn({ reason: err instanceof Error ? err.message : "unknown" }, "E-rep immediate alert e-mail failed"));
    return id;
  }

  /** Alertes d'un passage de veille terminé (mentions, avis, SERP, blocage), puis score et crise. */
  async evaluateRun(runId: string): Promise<number> {
    const run = (await pool.query(`SELECT id, campaign_id, status FROM erep_watch_runs WHERE id = $1`, [runId])).rows[0];
    if (!run) return 0;
    const c = await this.campaign(run.campaign_id);
    if (!c) return 0;
    const rules = await this.getRules(c.id);
    let raised = 0;
    const count = (id: string | null) => { if (id) raised++; };

    if (rules.watchBlocked && run.status === "awaiting_user") {
      count(await this.raise(c, { type: "watch_blocked", severity: "low", dedupKey: `blocked:${runId}`, tab: "runs",
        title: `Veille en attente : ${c.target_name}`, description: "Une source demande une vérification (captcha ou consentement) dans le navigateur cloud, puis « Reprendre »." }));
    }

    const mentions = (await pool.query(
      `SELECT id, kind, title, url, severity FROM erep_mentions
        WHERE run_id = $1 AND NOT baseline AND status <> 'ignored' AND sentiment = 'neg' ORDER BY first_seen_at`, [runId])).rows;
    if (rules.criticalMention) {
      for (const m of mentions.filter(m => m.severity === "critical")) {
        count(await this.raise(c, { type: "critical_mention", severity: "high", dedupKey: `critical:${m.id}`, tab: "mentions",
          title: `Mention critique : ${c.target_name}`, description: `${m.title ?? "Mention"}${m.url ? ` — ${m.url}` : ""}`.slice(0, 1000), payload: { mentionId: m.id } }));
      }
    }
    const normal = mentions.filter(m => m.severity !== "critical" && m.kind !== "review");
    if (rules.negativeMention && normal.length) {
      count(await this.raise(c, { type: "negative_mention", severity: "medium", dedupKey: `negative:${runId}`, tab: "mentions",
        title: `${normal.length} nouvelle(s) mention(s) négative(s) : ${c.target_name}`,
        description: normal.slice(0, 3).map(m => m.title ?? m.url ?? "Mention").join(" · "), payload: { mentionIds: normal.map(m => m.id) } }));
    }

    if (rules.lowReview) {
      const low = (await pool.query(
        `SELECT r.id, r.source, r.rating::float AS rating, r.text FROM erep_reviews r
          WHERE r.run_id = $1 AND r.rating <= 2
            AND EXISTS (SELECT 1 FROM erep_mentions m WHERE m.campaign_id = r.campaign_id AND m.fingerprint = 'review:' || r.fingerprint AND NOT m.baseline AND m.status <> 'ignored')`, [runId])).rows;
      if (low.length) {
        count(await this.raise(c, { type: "low_review", severity: "medium", dedupKey: `reviews:${runId}`, tab: "reviews",
          title: `${low.length} nouvel(s) avis à 1 ou 2 étoiles : ${c.target_name}`,
          description: low.slice(0, 2).map(r => `${r.rating}/5 « ${String(r.text ?? "").slice(0, 120)} »`).join(" · "), payload: { reviewIds: low.map(r => r.id) } }));
      }
    }

    if (rules.ratingDrop != null) {
      const stats = (await pool.query(
        `SELECT id, source, run_id, rating::float AS rating, ROW_NUMBER() OVER (PARTITION BY source ORDER BY captured_at DESC) AS n
           FROM erep_review_stats WHERE campaign_id = $1 AND rating IS NOT NULL`, [c.id])).rows.filter(r => Number(r.n) <= 2);
      for (const latest of stats.filter(s => Number(s.n) === 1 && s.run_id === runId)) {
        const prev = stats.find(s => s.source === latest.source && Number(s.n) === 2);
        if (prev && prev.rating - latest.rating >= rules.ratingDrop - 1e-9) {
          count(await this.raise(c, { type: "rating_drop", severity: "medium", dedupKey: `rating:${latest.id}`, tab: "reviews",
            title: `Note en baisse sur ${latest.source === "pagesjaunes" ? "PagesJaunes" : "Google Maps"} : ${c.target_name}`,
            description: `Note passée de ${String(prev.rating).replace(".", ",")} à ${String(latest.rating).replace(".", ",")}/5.` }));
        }
      }
    }

    if (rules.negativeSerpTop != null) {
      // Résultat négatif entré dans le top N par rapport au relevé précédent de la même requête.
      const entered = (await pool.query(
        `WITH cur AS (SELECT engine, query FROM erep_serp_collections WHERE run_id = $1),
              prev AS (SELECT DISTINCT ON (p.engine, p.query) p.engine, p.query, p.run_id FROM erep_serp_collections p JOIN cur USING (engine, query)
                        WHERE p.campaign_id = $2 AND p.run_id <> $1 ORDER BY p.engine, p.query, p.captured_at DESC)
         SELECT s.engine, s.query, s.position, s.url, s.title, m.id AS mention_id, m.severity
           FROM erep_serp_snapshots s JOIN prev ON prev.engine = s.engine AND prev.query = s.query
           JOIN erep_mentions m ON m.campaign_id = s.campaign_id AND m.kind = 'serp' AND m.url = s.url AND m.sentiment = 'neg' AND m.status <> 'ignored'
          WHERE s.run_id = $1 AND s.position <= $3
            AND NOT EXISTS (SELECT 1 FROM erep_serp_snapshots o WHERE o.run_id = prev.run_id AND o.engine = s.engine AND o.query = s.query AND o.url = s.url AND o.position <= $3)`,
        [runId, c.id, rules.negativeSerpTop])).rows;
      // Un même résultat relevé sur plusieurs requêtes : une seule alerte (meilleure position).
      const byMention = new Map<string, any[]>();
      for (const r of entered) byMention.set(r.mention_id, [...(byMention.get(r.mention_id) ?? []), r]);
      for (const [mentionId, hits] of byMention) {
        const best = hits.reduce((a, b) => (b.position < a.position ? b : a));
        count(await this.raise(c, { type: "negative_serp", severity: best.position <= 3 ? "high" : "medium", dedupKey: `serp:${mentionId}:${runId}`, tab: "serp",
          title: `Résultat négatif en position ${best.position} (${best.engine === "bing" ? "Bing" : "Google"}) : ${c.target_name}`,
          description: `${best.title ?? best.url} — ${hits.length} requête(s) : ${hits.slice(0, 3).map(h => `« ${h.query} » (${h.position})`).join(", ")}`,
          payload: { mentionId, url: best.url, position: best.position, queries: hits.map(h => h.query) } }));
      }
    }

    raised += await this.evaluateScore(c.id);
    await this.evaluateCrisis(c.id);
    return raised;
  }

  /** Score sous le seuil (au franchissement) ou en baisse sur 7 jours. */
  async evaluateScore(campaignId: string): Promise<number> {
    const c = await this.campaign(campaignId);
    if (!c || c.reputation_score == null) return 0;
    const rules = await this.getRules(c.id);
    const today = parisDay();
    const hist = (await pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, score FROM erep_score_history WHERE campaign_id = $1 AND score IS NOT NULL AND day >= ($2::date - INTERVAL '7 days') AND day < $2::date ORDER BY day DESC`,
      [c.id, today])).rows;
    const s = c.reputation_score;
    let raised = 0;
    if (rules.scoreLow != null && s < rules.scoreLow && !(hist[0] && hist[0].score < rules.scoreLow)) {
      if (await this.raise(c, { type: "score_low", severity: "high", dedupKey: `score_low:${today}`, tab: "score",
        title: `Score sous ${rules.scoreLow}/100 : ${c.target_name}`, description: `Score de réputation à ${s}/100.` })) raised++;
    }
    const max7 = hist.length ? Math.max(...hist.map(h => h.score)) : null;
    if (rules.scoreDrop != null && max7 !== null && max7 - s >= rules.scoreDrop) {
      if (await this.raise(c, { type: "score_drop", severity: "medium", dedupKey: `score_drop:${today}`, tab: "score",
        title: `Score en baisse de ${max7 - s} points : ${c.target_name}`, description: `Score passé de ${max7} à ${s}/100 en 7 jours.` })) raised++;
    }
    return raised;
  }

  /** Niveau de crise (0 = aucun) et ses raisons, à partir des mesures réelles. */
  async crisisLevel(campaignId: string): Promise<{ level: number; reasons: string[] }> {
    const c = await this.campaign(campaignId);
    if (!c) return { level: 0, reasons: [] };
    const t = (await this.getRules(campaignId)).crisis;
    const m = (await pool.query(
      `SELECT COUNT(*) FILTER (WHERE severity = 'critical' AND first_seen_at >= NOW() - INTERVAL '72 hours')::int AS critical72,
              COUNT(*) FILTER (WHERE sentiment = 'neg' AND NOT baseline AND first_seen_at >= NOW() - INTERVAL '7 days')::int AS negative7
         FROM erep_mentions WHERE campaign_id = $1 AND status <> 'ignored'`, [campaignId])).rows[0];
    const serp = (await pool.query(
      `WITH latest AS (SELECT DISTINCT ON (engine, query) engine, query, run_id FROM erep_serp_collections WHERE campaign_id = $1 ORDER BY engine, query, captured_at DESC)
       SELECT MIN(s.position)::int AS best FROM latest l JOIN erep_serp_snapshots s ON s.run_id = l.run_id AND s.engine = l.engine AND s.query = l.query
         JOIN erep_mentions m ON m.campaign_id = $1 AND m.kind = 'serp' AND m.url = s.url AND m.sentiment = 'neg' AND m.status <> 'ignored'`, [campaignId])).rows[0]?.best ?? null;
    const today = parisDay();
    const max7 = (await pool.query(`SELECT MAX(score)::int AS m FROM erep_score_history WHERE campaign_id = $1 AND day >= ($2::date - INTERVAL '7 days') AND day < $2::date`, [campaignId, today])).rows[0]?.m ?? null;
    const s = c.reputation_score;
    const reasons: { level: number; text: string }[] = [];
    if (s != null && s < t.crisisScore) reasons.push({ level: 3, text: `Score ${s}/100 sous le seuil de crise (${t.crisisScore})` });
    else if (s != null && s < t.alertScore) reasons.push({ level: 2, text: `Score ${s}/100 sous le seuil d'alerte (${t.alertScore})` });
    if (m.critical72 >= t.criticalCrisis) reasons.push({ level: 3, text: `${m.critical72} mention(s) critique(s) en 72 h` });
    else if (m.critical72 >= t.criticalAlert) reasons.push({ level: 2, text: `${m.critical72} mention(s) critique(s) en 72 h` });
    if (m.negative7 >= t.negativeAlert) reasons.push({ level: 2, text: `${m.negative7} nouvelle(s) mention(s) négative(s) en 7 jours` });
    else if (m.negative7 >= t.negativeVigilance) reasons.push({ level: 1, text: `${m.negative7} nouvelle(s) mention(s) négative(s) en 7 jours` });
    if (serp != null && serp <= 3) reasons.push({ level: 2, text: `Résultat négatif en position ${serp} des recherches` });
    else if (serp != null && serp <= 10) reasons.push({ level: 1, text: `Résultat négatif en première page (position ${serp})` });
    const scoreDrop = (await this.getRules(campaignId)).scoreDrop;
    if (s != null && max7 != null && scoreDrop != null && max7 - s >= scoreDrop) reasons.push({ level: 1, text: `Score en baisse de ${max7 - s} points en 7 jours` });
    const level = reasons.reduce((l, r) => Math.max(l, r.level), 0);
    return { level, reasons: reasons.sort((a, b) => b.level - a.level).map(r => r.text) };
  }

  /** Ouvre ou fait monter le plan de crise ; ne le ferme jamais automatiquement. */
  async evaluateCrisis(campaignId: string): Promise<{ planId: string | null; level: number }> {
    const c = await this.campaign(campaignId);
    if (!c || c.status === "archived") return { planId: null, level: 0 };
    const { level, reasons } = await this.crisisLevel(campaignId);
    const open = (await pool.query(`SELECT id, level, actions FROM erep_crisis_plans WHERE campaign_id = $1 AND status = 'open'`, [campaignId])).rows[0];
    if (!level) return { planId: open?.id ?? null, level: open?.level ?? 0 };
    const person = c.target_type === "B2C";
    const fresh = (existing: Action[]) => actionTemplates(level, person).filter(a => !existing.some(e => e.id === a.id))
      .map(a => ({ ...a, done: false, doneAt: null, doneBy: null, assigneeId: null }));
    let planId: string;
    if (!open) {
      const inserted = await pool.query(
        `INSERT INTO erep_crisis_plans (tenant_id, campaign_id, level, reasons, actions) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (campaign_id) WHERE status = 'open' DO NOTHING RETURNING id`,
        [c.tenant_id, c.id, level, JSON.stringify(reasons), JSON.stringify(fresh([]))]);
      if (!inserted.rows[0]) return { planId: null, level };
      planId = inserted.rows[0].id;
      await changeLog.record(pool, { tenantId: c.tenant_id, campaignId: c.id, action: "crisis_open", changes: { crisisLevel: { before: null, after: CRISIS_LEVELS[level] } } });
    } else if (level > open.level) {
      planId = open.id;
      await pool.query(`UPDATE erep_crisis_plans SET level = $2, reasons = $3, actions = actions || $4::jsonb, escalated_at = NOW() WHERE id = $1`,
        [open.id, level, JSON.stringify(reasons), JSON.stringify(fresh(open.actions ?? []))]);
      await changeLog.record(pool, { tenantId: c.tenant_id, campaignId: c.id, action: "crisis_escalate", changes: { crisisLevel: { before: CRISIS_LEVELS[open.level], after: CRISIS_LEVELS[level] } } });
    } else {
      await pool.query(`UPDATE erep_crisis_plans SET reasons = $2 WHERE id = $1`, [open.id, JSON.stringify(reasons)]);
      return { planId: open.id, level: open.level };
    }
    await this.raise(c, { type: "crisis", severity: level >= 2 ? "high" : "medium", dedupKey: `crisis:${planId}:${level}`, tab: "crisis",
      title: `Plan de crise « ${CRISIS_LEVELS[level]} » ouvert : ${c.target_name}`, description: reasons.join(" · "), payload: { planId, level } });
    return { planId, level };
  }

  // ── Lecture et actions de l'agence ──────────────────────────────────────────
  async listAlerts(tenantId: string, filters: { campaignId?: string; open?: boolean; limit?: number }) {
    const where = ["a.tenant_id = $1", "a.dedup_key IS NOT NULL"]; const values: unknown[] = [tenantId];
    if (filters.campaignId) { values.push(filters.campaignId); where.push(`a.campaign_id = $${values.length}`); }
    if (filters.open) where.push("NOT a.is_resolved");
    values.push(Math.max(1, Math.min(200, filters.limit ?? 100)));
    const { rows } = await pool.query(
      `SELECT a.id, a.campaign_id, c.name AS campaign_name, a.type, a.severity, a.title, a.description, a.href, a.payload, a.is_resolved, a.resolved_at, a.created_at, a.emailed_at
         FROM erep_alerts a JOIN erep_campaigns c ON c.id = a.campaign_id WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT $${values.length}`, values);
    return rows;
  }

  async resolveAlert(alertId: string, tenantId: string, userId: string | undefined, resolved: boolean) {
    const { rows } = await pool.query(
      `UPDATE erep_alerts SET is_resolved = $3, resolved_at = CASE WHEN $3 THEN NOW() END, resolved_by = CASE WHEN $3 THEN $4::uuid END
        WHERE id = $1 AND tenant_id = $2 RETURNING id, is_resolved`, [alertId, tenantId, resolved, userId ?? null]);
    if (!rows[0]) throw new CampaignError("Alerte introuvable", 404);
    return rows[0];
  }

  async crisis(campaignId: string) {
    const plans = (await pool.query(
      `SELECT id, level, status, reasons, actions, close_note, opened_at, escalated_at, closed_at FROM erep_crisis_plans WHERE campaign_id = $1 ORDER BY opened_at DESC LIMIT 10`, [campaignId])).rows;
    return { current: await this.crisisLevel(campaignId), open: plans.find(p => p.status === "open") ?? null, history: plans.filter(p => p.status === "closed") };
  }

  private async plan(planId: string, tenantId: string) {
    const plan = (await pool.query(`SELECT * FROM erep_crisis_plans WHERE id = $1 AND tenant_id = $2`, [planId, tenantId])).rows[0];
    if (!plan) throw new CampaignError("Plan de crise introuvable", 404);
    return plan;
  }

  async updateAction(planId: string, tenantId: string, actionId: string, input: { done?: boolean; assigneeId?: string | null }, actor: ChangeActor) {
    const plan = await this.plan(planId, tenantId);
    if (plan.status !== "open") throw new CampaignError("Ce plan de crise est clôturé.", 409);
    const actions = (plan.actions as Action[]);
    const action = actions.find(a => a.id === actionId);
    if (!action) throw new CampaignError("Action introuvable", 404);
    if (input.assigneeId !== undefined) {
      if (input.assigneeId && !(await pool.query(`SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2`, [input.assigneeId, tenantId])).rows[0]) throw new CampaignError("Membre de l'agence introuvable", 400);
      action.assigneeId = input.assigneeId;
    }
    if (input.done !== undefined) { action.done = input.done; action.doneAt = input.done ? new Date().toISOString() : null; action.doneBy = input.done ? (actor.email ?? actor.userId ?? null) : null; }
    await pool.query(`UPDATE erep_crisis_plans SET actions = $2 WHERE id = $1`, [planId, JSON.stringify(actions)]);
    return { ...plan, actions };
  }

  async closePlan(planId: string, tenantId: string, note: string, actor: ChangeActor) {
    const plan = await this.plan(planId, tenantId);
    if (plan.status !== "open") throw new CampaignError("Ce plan de crise est déjà clôturé.", 409);
    await pool.query(`UPDATE erep_crisis_plans SET status = 'closed', closed_at = NOW(), closed_by = $2, close_note = $3 WHERE id = $1`, [planId, actor.userId ?? null, note.slice(0, 1000) || null]);
    await changeLog.record(pool, { tenantId, campaignId: plan.campaign_id, actor, action: "crisis_close", changes: { crisisLevel: { before: CRISIS_LEVELS[plan.level], after: null } } });
    return { id: planId, status: "closed" };
  }

  /** Correction manuelle en « critique » : alerte immédiate si la règle est active. */
  async onMentionCorrected(mentionId: string): Promise<void> {
    const m = (await pool.query(`SELECT id, campaign_id, title, url, severity, baseline FROM erep_mentions WHERE id = $1`, [mentionId])).rows[0];
    if (!m || m.severity !== "critical") return;
    const c = await this.campaign(m.campaign_id);
    if (!c || !(await this.getRules(c.id)).criticalMention) return;
    await this.raise(c, { type: "critical_mention", severity: "high", dedupKey: `critical:${m.id}`, tab: "mentions",
      title: `Mention critique : ${c.target_name}`, description: `${m.title ?? "Mention"}${m.url ? ` — ${m.url}` : ""}`, payload: { mentionId: m.id } });
    await this.evaluateCrisis(c.id);
  }
}

export const alertService = new AlertService();
