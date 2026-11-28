import { z } from "zod";
import { pool } from "@workspace/db";
import { logger } from "../logger";
import { llmService, resolveDefaultAiProvider } from "../llm/LLMService";
import { CampaignError } from "./CampaignService";

/**
 * E-réputation — lot 3 : sentiment par IA et brouillons de réponse.
 *
 *  - Le fournisseur est celui choisi par l'agence (Paramètres → IA). Sans
 *    fournisseur, l'analyse locale reste en place (analysis_source = 'local').
 *  - Une correction manuelle (analysis_source = 'manual') n'est jamais écrasée.
 *  - Les brouillons de réponse ne sont jamais publiés : l'agence les copie et
 *    les valide elle-même.
 */
const BATCH = 10;
const MAX_ATTEMPTS = 2;

const Verdict = z.object({
  i: z.number().int().min(0),
  sentiment: z.enum(["pos", "neg", "neu"]),
  score: z.number().min(-1).max(1),
  critical: z.boolean().optional().default(false),
  themes: z.array(z.string().max(60)).max(6).optional().default([]),
});

/** Extrait le premier tableau JSON d'une réponse de modèle (les modèles ajoutent parfois du texte). */
export function parseVerdicts(answer: string | null): z.infer<typeof Verdict>[] | null {
  if (!answer) return null;
  const start = answer.indexOf("["), end = answer.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(answer.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed.map(v => Verdict.safeParse(v)).filter(r => r.success).map(r => (r as { data: z.infer<typeof Verdict> }).data);
  } catch { return null; }
}

function prompt(target: { name: string; person: boolean }, items: { title: string | null; excerpt: string | null; kind: string }[]): string {
  const lines = items.map((m, i) => `${i}. [${m.kind}] ${(m.title ?? "").slice(0, 300)} — ${(m.excerpt ?? "").slice(0, 600)}`.replace(/\s+/g, " "));
  return `Tu es analyste en e-réputation pour une agence française. Cible surveillée : « ${target.name} » (${target.person ? "personne physique" : "entreprise ou organisation"}).
Pour chaque mention ci-dessous, évalue le sentiment EXPRIMÉ À PROPOS DE LA CIBLE (pas celui du sujet général) :
- sentiment : "pos", "neg" ou "neu" ; une mention qui ne parle pas de la cible est "neu" ;
- score : nombre de -1 (très négatif) à 1 (très positif) ;
- critical : true uniquement pour une accusation grave (arnaque, fraude, pénal, diffamation), un appel au boycott ou l'exposition de données personnelles ;
- themes : 1 à 4 thèmes courts en français (ex. "délais", "service client", "prix").
Réponds UNIQUEMENT par un tableau JSON, sans texte autour : [{"i":0,"sentiment":"neg","score":-0.6,"critical":false,"themes":["délais"]}]
Mentions :
${lines.join("\n")}`;
}

export class ErepAI {
  /**
   * Analyse par IA des mentions encore évaluées localement (plafonné par appel).
   * Retourne le nombre de mentions requalifiées et le fournisseur utilisé.
   */
  async analyzePending(campaignId: string, tenantId: string, limit = 40): Promise<{ analyzed: number; provider: string | null }> {
    const provider = await resolveDefaultAiProvider(tenantId);
    if (!provider) return { analyzed: 0, provider: null };
    const target = (await pool.query(`SELECT target_name, target_type FROM erep_campaigns WHERE id = $1 AND tenant_id = $2`, [campaignId, tenantId])).rows[0];
    if (!target) return { analyzed: 0, provider };
    const { rows } = await pool.query(
      `SELECT id, kind, title, excerpt FROM erep_mentions
        WHERE campaign_id = $1 AND analysis_source = 'local' AND analysis_attempts < $2 AND status <> 'ignored'
        ORDER BY baseline ASC, first_seen_at DESC LIMIT $3`, [campaignId, MAX_ATTEMPTS, Math.max(1, Math.min(200, limit))]);
    let analyzed = 0;
    for (let offset = 0; offset < rows.length; offset += BATCH) {
      const batch = rows.slice(offset, offset + BATCH);
      const ids = batch.map(r => r.id);
      const verdicts = parseVerdicts(await llmService.generate(prompt({ name: target.target_name, person: target.target_type === "B2C" }, batch), { tenantId, provider }).catch(() => null));
      const answered = new Set<number>();
      for (const v of verdicts ?? []) {
        if (v.i >= batch.length || answered.has(v.i)) continue;
        answered.add(v.i);
        const themes = v.themes.map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 4);
        const sentiment = v.critical ? "neg" : v.sentiment;
        const score = Number((v.critical ? Math.min(v.score, -0.8) : v.score).toFixed(2));
        const updated = await pool.query(
          `UPDATE erep_mentions SET sentiment = $2, score = $3, severity = $4, themes = $5, analysis_source = 'ai', analyzed_at = NOW()
            WHERE id = $1 AND analysis_source = 'local' RETURNING id`,
          [batch[v.i].id, sentiment, score, v.critical ? "critical" : "normal", JSON.stringify(themes)]);
        if (!updated.rows[0]) continue;
        await pool.query(`UPDATE erep_sentiment_logs SET sentiment = $2, score = $3 WHERE mention_id = $1`, [batch[v.i].id, sentiment, score]);
        analyzed++;
      }
      // Réponse absente ou incomplète : nouvel essai au passage suivant, puis repli local définitif.
      const missed = ids.filter((_, i) => !answered.has(i));
      if (missed.length) await pool.query(`UPDATE erep_mentions SET analysis_attempts = analysis_attempts + 1 WHERE id = ANY($1::uuid[])`, [missed]);
    }
    if (rows.length) logger.info({ campaignId, provider, analyzed, pending: rows.length }, "E-rep AI sentiment analysis");
    return { analyzed, provider };
  }

  /** Correction manuelle du sentiment par l'agence : prioritaire sur toute analyse. */
  async correct(mentionId: string, tenantId: string, input: { sentiment: "pos" | "neg" | "neu"; critical?: boolean }) {
    const score = input.sentiment === "pos" ? 0.6 : input.sentiment === "neg" ? (input.critical ? -0.9 : -0.6) : 0;
    const { rows } = await pool.query(
      `UPDATE erep_mentions SET sentiment = $3, score = $4, severity = $5, analysis_source = 'manual', analyzed_at = NOW()
        WHERE id = $1 AND tenant_id = $2 RETURNING id, campaign_id, sentiment, severity, analysis_source`,
      [mentionId, tenantId, input.sentiment, score, input.critical && input.sentiment === "neg" ? "critical" : "normal"]);
    if (!rows[0]) throw new CampaignError("Mention introuvable", 404);
    await pool.query(`UPDATE erep_sentiment_logs SET sentiment = $2, score = $3 WHERE mention_id = $1`, [mentionId, input.sentiment, score]);
    return rows[0];
  }

  /**
   * Brouillon de réponse à un avis, à relire et publier par l'agence.
   * IA si un fournisseur est configuré, sinon modèle local neutre.
   */
  async replyDraft(reviewId: string, tenantId: string): Promise<{ draft: string; source: "ai" | "template" }> {
    const { rows } = await pool.query(
      `SELECT r.id, r.rating::float AS rating, r.text, r.author, c.target_name, c.target_type
         FROM erep_reviews r JOIN erep_campaigns c ON c.id = r.campaign_id
        WHERE r.id = $1 AND c.tenant_id = $2`, [reviewId, tenantId]);
    const review = rows[0];
    if (!review) throw new CampaignError("Avis introuvable", 404);
    const negative = review.rating != null ? review.rating <= 2 : false;
    let draft: string | null = null, source: "ai" | "template" = "template";
    const provider = await resolveDefaultAiProvider(tenantId);
    if (provider) {
      const answer = await llmService.generate(
        `Rédige en français une réponse publique, courte (60 à 110 mots), courtoise et factuelle, au nom de « ${review.target_name} », à l'avis client ci-dessous.
Règles : remercier ; si l'avis est négatif, reconnaître le ressenti sans polémiquer, proposer un échange par un canal privé ; ne jamais contester agressivement,
ne jamais promettre de remboursement ni d'avantage, ne citer aucune donnée personnelle, ne pas inventer de faits. Réponds uniquement par le texte de la réponse.
Note : ${review.rating ?? "inconnue"}/5. Avis : « ${String(review.text ?? "").slice(0, 1500)} »`, { tenantId, provider }).catch(() => null);
      if (answer && answer.trim().length >= 20) { draft = answer.trim().slice(0, 1200); source = "ai"; }
    }
    if (!draft) {
      draft = negative
        ? `Bonjour, merci d'avoir pris le temps de partager votre retour. Nous sommes désolés que votre expérience n'ait pas été à la hauteur de vos attentes. Nous souhaitons comprendre précisément ce qui s'est passé : pouvez-vous nous contacter directement afin que nous puissions en parler ? Cordialement, ${review.target_name}`
        : `Bonjour, merci beaucoup pour votre avis et pour votre confiance. Vos encouragements font plaisir à toute l'équipe. Au plaisir de vous retrouver prochainement ! Cordialement, ${review.target_name}`;
    }
    await pool.query(`UPDATE erep_reviews SET reply_draft = $2, reply_draft_source = $3, reply_draft_at = NOW() WHERE id = $1`, [reviewId, draft, source]);
    return { draft, source };
  }
}

export const erepAI = new ErepAI();
