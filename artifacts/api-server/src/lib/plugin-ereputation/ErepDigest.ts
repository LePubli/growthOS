import { z } from "zod";
import { pool } from "@workspace/db";
import { logger } from "../logger";
import { sendInternalEmail } from "../../services/email";
import { CampaignError, parisDay } from "./CampaignService";
import { alertService, CRISIS_LEVELS } from "./AlertService";

/**
 * E-réputation — lot 3 : e-mails internes à l'agence.
 *  - récapitulatif quotidien (8 h, heure de Paris) et hebdomadaire (lundi 8 h) ;
 *  - e-mail immédiat pour les alertes critiques (si activé) ;
 *  - destinataires : uniquement des membres de l'agence choisis dans les
 *    réglages, jamais le client ni la cible ;
 *  - un envoi par période au plus (erep_email_log), interrupteur
 *    EREP_ALERT_EMAIL_ENABLED (false par défaut, « log » pour une recette).
 */
export const EmailSettingsInput = z.object({
  daily: z.boolean().optional(),
  weekly: z.boolean().optional(),
  immediateCritical: z.boolean().optional(),
  recipients: z.array(z.string().uuid()).max(20).optional(),
});
export type EmailSettings = { daily: boolean; weekly: boolean; immediateCritical: boolean; recipients: string[] };

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const appUrl = () => (process.env.EREP_APP_URL || "").replace(/\/+$/, "");
const link = (path: string) => /^https?:\/\//.test(appUrl()) ? `${appUrl()}${path}` : null;
export const emailMode = () => process.env.EREP_ALERT_EMAIL_ENABLED === "true" ? "smtp" : process.env.EREP_ALERT_EMAIL_ENABLED === "log" ? "log" : "off";

function parisClock(at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(at).map(p => [p.type, p.value]));
  return { hour: Number(parts.hour), weekday: parts.weekday as string };
}

type Digest = { subject: string; html: string; text: string; empty: boolean; campaigns: number };

export class ErepDigest {
  async getSettings(tenantId: string): Promise<EmailSettings & { mode: string; lastSends: unknown[] }> {
    const row = (await pool.query(`SELECT daily, weekly, immediate_critical, recipients FROM erep_email_settings WHERE tenant_id = $1`, [tenantId])).rows[0];
    const lastSends = (await pool.query(
      `SELECT kind, period_key, status, recipients, error, sent_at FROM erep_email_log WHERE tenant_id = $1 ORDER BY sent_at DESC LIMIT 10`, [tenantId])).rows;
    return { daily: !!row?.daily, weekly: !!row?.weekly, immediateCritical: !!row?.immediate_critical, recipients: row?.recipients ?? [], mode: emailMode(), lastSends };
  }

  async members(tenantId: string) {
    return (await pool.query(`SELECT id, email, first_name, last_name, role FROM users WHERE tenant_id = $1 ORDER BY email`, [tenantId])).rows
      .map(u => ({ id: u.id, email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null, role: u.role }));
  }

  async saveSettings(tenantId: string, input: z.infer<typeof EmailSettingsInput>, userId?: string): Promise<EmailSettings> {
    const current = await this.getSettings(tenantId);
    const recipients = [...new Set(input.recipients ?? current.recipients)];
    if (recipients.length) {
      const ok = (await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, recipients])).rows[0].n;
      if (ok !== recipients.length) throw new CampaignError("Destinataire hors de l'agence refusé", 400);
    }
    const next = { daily: input.daily ?? current.daily, weekly: input.weekly ?? current.weekly, immediateCritical: input.immediateCritical ?? current.immediateCritical, recipients };
    await pool.query(
      `INSERT INTO erep_email_settings (tenant_id, daily, weekly, immediate_critical, recipients, updated_by) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id) DO UPDATE SET daily = EXCLUDED.daily, weekly = EXCLUDED.weekly, immediate_critical = EXCLUDED.immediate_critical,
         recipients = EXCLUDED.recipients, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [tenantId, next.daily, next.weekly, next.immediateCritical, JSON.stringify(recipients), userId ?? null]);
    return next;
  }

  private async recipients(tenantId: string, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    return (await pool.query(`SELECT email FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, ids])).rows.map(r => r.email);
  }

  /** Contenu du récapitulatif (aperçu ou envoi). */
  async build(tenantId: string, kind: "daily" | "weekly", now = new Date()): Promise<Digest> {
    const days = kind === "daily" ? 1 : 7;
    const today = parisDay(now);
    const campaigns = (await pool.query(
      `SELECT c.id, c.name, c.target_name, c.reputation_score,
              (SELECT score FROM erep_score_history h WHERE h.campaign_id = c.id AND h.day <= ($2::date - $3::int) ORDER BY day DESC LIMIT 1) AS score_before,
              (SELECT COUNT(*)::int FROM erep_mentions m WHERE m.campaign_id = c.id AND m.sentiment = 'neg' AND NOT m.baseline AND m.status <> 'ignored' AND m.first_seen_at >= $4) AS negatives,
              (SELECT COUNT(*)::int FROM erep_mentions m WHERE m.campaign_id = c.id AND m.severity = 'critical' AND m.status <> 'ignored' AND m.first_seen_at >= $4) AS criticals,
              (SELECT COUNT(*)::int FROM erep_mentions m WHERE m.campaign_id = c.id AND NOT m.baseline AND m.first_seen_at >= $4) AS mentions,
              (SELECT level FROM erep_crisis_plans p WHERE p.campaign_id = c.id AND p.status = 'open') AS crisis_level
         FROM erep_campaigns c WHERE c.tenant_id = $1 AND c.status = 'active' ORDER BY c.name`,
      [tenantId, today, days, new Date(now.getTime() - days * 86400_000)])).rows;
    const alerts = (await pool.query(
      `SELECT a.campaign_id, a.severity, a.title FROM erep_alerts a JOIN erep_campaigns c ON c.id = a.campaign_id
        WHERE a.tenant_id = $1 AND a.dedup_key IS NOT NULL AND a.created_at >= $2 ORDER BY a.severity = 'high' DESC, a.created_at DESC`,
      [tenantId, new Date(now.getTime() - days * 86400_000)])).rows;
    const label = kind === "daily" ? "quotidien" : "hebdomadaire";
    const period = kind === "daily" ? "les dernières 24 h" : "les 7 derniers jours";
    const empty = kind === "daily" && !alerts.length && !campaigns.some(c => c.negatives || c.criticals);
    const delta = (c: any) => c.reputation_score == null || c.score_before == null ? "" : ` (${c.reputation_score - c.score_before >= 0 ? "+" : ""}${c.reputation_score - c.score_before})`;
    const rows = campaigns.map(c => {
      const url = link(`/ereputation/watch?campaign=${c.id}&tab=score`);
      const alertList = alerts.filter(a => a.campaign_id === c.id).slice(0, 3);
      return {
        html: `<tr><td style="padding:10px;border-bottom:1px solid #eee"><strong>${url ? `<a href="${esc(url)}">${esc(c.name)}</a>` : esc(c.name)}</strong><br>
          <span style="color:#555">Score : ${c.reputation_score == null ? "non évalué" : `${c.reputation_score}/100${esc(delta(c))}`}
          · ${c.mentions} nouvelle(s) mention(s), ${c.negatives} négative(s)${c.criticals ? `, <strong style="color:#b91c1c">${c.criticals} critique(s)</strong>` : ""}
          ${c.crisis_level ? ` · <strong style="color:#b91c1c">Plan « ${esc(CRISIS_LEVELS[c.crisis_level])} » ouvert</strong>` : ""}</span>
          ${alertList.length ? `<ul style="margin:6px 0 0;padding-left:18px">${alertList.map(a => `<li>${esc(a.title)}</li>`).join("")}</ul>` : ""}</td></tr>`,
        text: `- ${c.name} : score ${c.reputation_score ?? "non évalué"}${delta(c)}, ${c.mentions} nouvelle(s) mention(s), ${c.negatives} négative(s), ${c.criticals} critique(s)${c.crisis_level ? `, plan « ${CRISIS_LEVELS[c.crisis_level]} » ouvert` : ""}\n${alertList.map(a => `    • ${a.title}`).join("\n")}`,
      };
    });
    const subject = `E-réputation — récapitulatif ${label} : ${alerts.length} alerte(s), ${campaigns.length} campagne(s)`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#1a1a2e">
      <h2 style="margin:0 0 4px">Récapitulatif e-réputation ${label}</h2>
      <p style="color:#555;margin:0 0 12px">Sur ${period} : ${alerts.length} alerte(s), dont ${alerts.filter(a => a.severity === "high").length} critique(s). Document interne à l'agence.</p>
      <table style="width:100%;border-collapse:collapse">${rows.map(r => r.html).join("") || `<tr><td>Aucune campagne active.</td></tr>`}</table>
      <p style="color:#999;font-size:12px;margin-top:16px">Envoyé par GrowthOS aux membres de l'agence choisis dans E-réputation → Veille → Alertes. Aucune réponse ni publication n'est faite automatiquement.</p>
      </body></html>`;
    const text = `Récapitulatif e-réputation ${label} (${period}) : ${alerts.length} alerte(s).\n\n${rows.map(r => r.text).join("\n")}\n`;
    return { subject, html, text, empty, campaigns: campaigns.length };
  }

  /** Envoi d'un récapitulatif, au plus une fois par période. */
  async send(tenantId: string, kind: "daily" | "weekly", now = new Date()): Promise<{ status: string; error?: string }> {
    if (emailMode() === "off") return { status: "disabled" };
    const settings = await this.getSettings(tenantId);
    const to = await this.recipients(tenantId, settings.recipients);
    if (!to.length) return { status: "no_recipient" };
    const reserved = await pool.query(
      `INSERT INTO erep_email_log (tenant_id, kind, period_key, status, recipients) VALUES ($1,$2,$3,'failed',$4)
       ON CONFLICT (tenant_id, kind, period_key) WHERE kind IN ('daily','weekly') DO NOTHING RETURNING id`,
      [tenantId, kind, parisDay(now), to.length]);
    const logId = reserved.rows[0]?.id;
    if (!logId) return { status: "already_sent" };
    const digest = await this.build(tenantId, kind, now);
    if (digest.empty) { await pool.query(`UPDATE erep_email_log SET status = 'empty' WHERE id = $1`, [logId]); return { status: "empty" }; }
    const result = await sendInternalEmail({ tenantId, to, subject: digest.subject, html: digest.html, text: digest.text });
    await pool.query(`UPDATE erep_email_log SET status = $2, error = $3 WHERE id = $1`, [logId, result.success ? "sent" : "failed", result.error?.slice(0, 300) ?? null]);
    return result.success ? { status: "sent" } : { status: "failed", error: result.error };
  }

  /** E-mail immédiat pour une alerte critique (si activé). */
  async sendImmediate(tenantId: string, alertId: string): Promise<void> {
    if (emailMode() === "off") return;
    const settings = await this.getSettings(tenantId);
    if (!settings.immediateCritical) return;
    const to = await this.recipients(tenantId, settings.recipients);
    const alert = (await pool.query(`SELECT a.title, a.description, a.href FROM erep_alerts a WHERE a.id = $1 AND a.tenant_id = $2`, [alertId, tenantId])).rows[0];
    if (!to.length || !alert) return;
    const url = alert.href ? link(alert.href) : null;
    const result = await sendInternalEmail({
      tenantId, to, subject: `Alerte e-réputation critique — ${alert.title}`.slice(0, 200), text: `${alert.title}\n\n${alert.description}\n${url ?? ""}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:16px">
        <h2 style="color:#b91c1c;margin:0 0 8px">${esc(alert.title)}</h2><p>${esc(alert.description)}</p>${url ? `<p><a href="${esc(url)}">Ouvrir dans GrowthOS</a></p>` : ""}
        <p style="color:#999;font-size:12px">Alerte interne à l'agence. Aucune réponse ni publication n'est faite automatiquement.</p></body></html>`,
    });
    await pool.query(`INSERT INTO erep_email_log (tenant_id, kind, period_key, status, recipients, error) VALUES ($1,'immediate',$2,$3,$4,$5)`,
      [tenantId, alertId, result.success ? "sent" : "failed", to.length, result.error?.slice(0, 300) ?? null]);
    if (result.success) await pool.query(`UPDATE erep_alerts SET emailed_at = NOW() WHERE id = $1`, [alertId]);
  }

  /** Envoi de test du récapitulatif quotidien aux destinataires choisis. */
  async sendTest(tenantId: string): Promise<{ sent: boolean; recipients: number; error?: string; mode: string }> {
    const settings = await this.getSettings(tenantId);
    const to = await this.recipients(tenantId, settings.recipients);
    if (!to.length) throw new CampaignError("Choisissez au moins un destinataire de l'agence.", 400);
    const digest = await this.build(tenantId, "daily");
    const result = await sendInternalEmail({ tenantId, to, subject: `[Test] ${digest.subject}`, html: digest.html, text: digest.text });
    await pool.query(`INSERT INTO erep_email_log (tenant_id, kind, period_key, status, recipients, error) VALUES ($1,'test',$2,$3,$4,$5)`,
      [tenantId, new Date().toISOString(), result.success ? "sent" : "failed", to.length, result.error?.slice(0, 300) ?? null]);
    return { sent: result.success, recipients: to.length, error: result.error, mode: emailMode() };
  }

  /** Planification : à partir de 8 h (Paris), quotidien chaque jour, hebdomadaire le lundi. */
  async tick(now = new Date()): Promise<number> {
    if (emailMode() === "off") return 0;
    const { hour, weekday } = parisClock(now);
    if (hour < 8) return 0;
    const tenants = (await pool.query(`SELECT tenant_id, daily, weekly FROM erep_email_settings WHERE daily OR weekly`)).rows;
    let sent = 0;
    for (const t of tenants) {
      try {
        if (t.daily && (await this.send(t.tenant_id, "daily", now)).status === "sent") sent++;
        if (t.weekly && weekday === "Mon" && (await this.send(t.tenant_id, "weekly", now)).status === "sent") sent++;
      } catch (error) {
        logger.warn({ reason: error instanceof Error ? error.message : "unknown" }, "E-rep digest failed");
      }
    }
    return sent;
  }
}

export const erepDigest = new ErepDigest();
alertService.onCritical = (tenantId, alertId) => erepDigest.sendImmediate(tenantId, alertId);

/** Démarre la planification des récapitulatifs (toutes les 5 minutes). */
export function startErepAlerts(): void {
  if (process.env.GROWTHOS_SMOKE_TEST === "true") return;
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { await erepDigest.tick(); } catch (error) { logger.warn({ reason: error instanceof Error ? error.message : "unknown" }, "E-rep digest scheduler failed"); }
    finally { busy = false; }
  };
  setInterval(() => void tick(), 5 * 60_000).unref();
}
