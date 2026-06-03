import { pool } from "@workspace/db";
import { logger } from "../logger";

/**
 * TemplateService — framework-based sales content generation.
 * Uses AIDA, SPIN, MEDDIC frameworks with real DB context instead of generic lorem ipsum.
 * Falls back gracefully when data is sparse.
 */

export interface TemplateContext {
  accountName: string;
  industry?: string;
  revenue?: string;
  contactName?: string;
  contactTitle?: string;
  recentSignal?: string;
  meetingExcerpt?: string;
  dealStage?: string;
  dealValue?: number;
  riskFactors?: string[];
}

async function fetchContext(accountId: string, tenantId: string): Promise<TemplateContext> {
  const [accountRes, signalRes, meetingRes, dealRes] = await Promise.all([
    pool.query<{ company: string; job_title?: string; first_name?: string; last_name?: string }>(
      `SELECT company, job_title, first_name, last_name
       FROM prospects
       WHERE tenant_id = $1 AND (id = $2 OR company ILIKE $3)
       LIMIT 1`,
      [tenantId, accountId, `%${accountId}%`],
    ).catch(() => ({ rows: [] as any[] })),
    pool.query<{ title: string; type: string }>(
      `SELECT title, type FROM signals WHERE tenant_id = $1 ORDER BY score DESC, detected_at DESC LIMIT 1`,
      [tenantId],
    ).catch(() => ({ rows: [] as any[] })),
    pool.query<{ summary: string; transcript: string }>(
      `SELECT summary, transcript FROM meetings WHERE tenant_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
      [tenantId],
    ).catch(() => ({ rows: [] as any[] })),
    pool.query<{ title: string; stage: string; value: string; health_score: number; risk_factors: any[] }>(
      `SELECT title, stage, value, health_score, risk_factors
       FROM deals WHERE tenant_id = $1 AND stage NOT IN ('closed_won','closed_lost')
       ORDER BY value DESC NULLS LAST LIMIT 1`,
      [tenantId],
    ).catch(() => ({ rows: [] as any[] })),
  ]);

  const prospect = accountRes.rows[0];
  const signal = signalRes.rows[0];
  const meeting = meetingRes.rows[0];
  const deal = dealRes.rows[0];

  return {
    accountName: prospect?.company ?? accountId,
    contactName: prospect ? `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || undefined : undefined,
    contactTitle: prospect?.job_title ?? undefined,
    recentSignal: signal?.title ?? undefined,
    meetingExcerpt: meeting?.summary?.slice(0, 200) ?? meeting?.transcript?.slice(0, 200) ?? undefined,
    dealStage: deal?.stage ?? undefined,
    dealValue: deal?.value ? parseFloat(deal.value) : undefined,
    riskFactors: Array.isArray(deal?.risk_factors) ? deal.risk_factors.map((r: any) => r.label ?? r.code) : [],
  };
}

/** AIDA framework email — Attention, Interest, Desire, Action */
export function buildAIDAEmail(ctx: TemplateContext, goal: string, tone: string): string {
  const salutation = ctx.contactName ? `Bonjour ${ctx.contactName.split(' ')[0]}` : "Bonjour";
  const signalHook = ctx.recentSignal
    ? `J'ai vu que ${ctx.accountName} ${ctx.recentSignal.toLowerCase().includes('levé') ? ctx.recentSignal : 'connaît une période de forte croissance'}.`
    : `${ctx.accountName} est sur notre radar depuis quelques temps — et pour de bonnes raisons.`;

  return `${salutation},

**Attention** — ${signalHook}

**Intérêt** — Dans ce contexte, les équipes comme la vôtre font face à un défi commun : ${goal.includes('meeting') ? 'qualifier et convertir les prospects entrants plus rapidement' : 'optimiser la performance commerciale sans ajouter de ressources'}.

**Désir** — GrowthOS aide des équipes commerciales B2B à augmenter leur Win Rate de +23% en moyenne, grâce à une IA qui analyse chaque signal, réunion et interaction pour recommander la prochaine meilleure action.${ctx.meetingExcerpt ? `\n\nNos clients similaires nous disent souvent : "${ctx.meetingExcerpt.slice(0, 100)}..."` : ''}

**Action** — Seriez-vous disponible 20 minutes cette semaine pour un échange rapide ? Je peux vous montrer comment nous avons aidé des entreprises similaires à ${ctx.accountName}.

Cordialement,
[Votre prénom]`;
}

/** SPIN framework coaching recommendations */
export function buildSPINCoaching(ctx: TemplateContext): string {
  const riskList = ctx.riskFactors?.length
    ? ctx.riskFactors.map(r => `• ${r}`).join('\n')
    : '• Aucun risque critique identifié';

  return `## Coaching SPIN — ${ctx.accountName}

**Situation** — Deal ${ctx.dealStage ?? 'en cours'}${ctx.dealValue ? ` · ${ctx.dealValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}` : ''}. ${ctx.meetingExcerpt ? `Dernière réunion : "${ctx.meetingExcerpt.slice(0, 150)}"` : 'Aucune réunion récente documentée.'}

**Problème** — Facteurs de risque identifiés :
${riskList}

**Implication** — Si ces risques ne sont pas adressés dans les 2 semaines, la probabilité de closing chute significativement. Un deal à ce stade non relancé a 60% de chances de stagner.

**Besoin-Solution** — Actions recommandées :
1. Relancer ${ctx.contactName ?? 'le contact principal'} avec une démonstration personnalisée axée sur ROI
2. Proposer une preuve de concept rapide (POC 2 semaines)
3. Identifier un champion interne chez ${ctx.accountName}
4. Partager un cas client du même secteur

**Prochaine étape** : Planifier un appel de qualification approfondie avant la fin de semaine.`;
}

/** Objection handling script — MEDDIC influenced */
export function buildObjectionScript(objection: string, ctx: TemplateContext): string {
  const objLower = objection.toLowerCase();

  if (objLower.includes('prix') || objLower.includes('cher') || objLower.includes('budget')) {
    return `## Script — Objection Prix / Budget

**Écoute active** : "Je comprends tout à fait, le budget est une contrainte réelle. Puis-je vous poser quelques questions pour mieux comprendre la situation ?"

**Recadrage ROI** : "Nos clients comme vous génèrent en moyenne 3,2€ de revenus additionnels pour 1€ investi dans GrowthOS. Sur votre base de ${ctx.dealValue ? ctx.dealValue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }) : 'votre pipeline actuel'}, cela représenterait un ROI significatif."

**Champion interne** : "Qui dans votre organisation serait le mieux placé pour évaluer l'impact métier ? Votre VP Sales ou CFO ?"

**Étape suivante** : Proposer un calcul ROI personnalisé gratuit + présentation à la direction.

**Phrase de clôture** : "Si nous pouvions démontrer un ROI positif en 90 jours, est-ce que le budget deviendrait une question secondaire ?"`;
  }

  if (objLower.includes('temps') || objLower.includes('priorité') || objLower.includes('occupé')) {
    return `## Script — Objection Timing / Priorité

**Validation** : "Vous avez raison, le timing est crucial. C'est exactement pourquoi je vous contacte maintenant."

**Urgence créatrice** : "${ctx.recentSignal ? `Compte tenu de "${ctx.recentSignal}", votre fenêtre d'opportunité est maintenant.` : 'Vos concurrents investissent dans l\'IA commerciale. Chaque trimestre d\'attente représente du terrain perdu.'}"

**Effort minimal** : "Je ne vous demande que 20 minutes. Nos clients témoignent que l'onboarding prend moins de 48h."

**Étape suivante** : "Quel est le meilleur moment pour vous — mardi matin ou jeudi après-midi ?"`;
  }

  return `## Script — Objection : "${objection}"

**Écoute** : Reformulez l'objection pour montrer que vous avez compris.

**Clarification** : "Est-ce votre principale préoccupation, ou y a-t-il autre chose ?"

**Réponse** : Adressez directement avec des faits, chiffres, et un cas client similaire à ${ctx.accountName}.

**Pivot** : "Si cet aspect était résolu, seriez-vous prêt à avancer ?"

**Étape suivante** : Proposez une démonstration personnalisée focalisée sur ce point spécifique.`;
}

class TemplateService {
  async getEmailTemplate(accountId: string, goal: string, tone: string, tenantId: string): Promise<string> {
    try {
      const ctx = await fetchContext(accountId, tenantId);
      return buildAIDAEmail(ctx, goal, tone);
    } catch (err) {
      logger.warn({ err }, "TemplateService.getEmailTemplate failed, using minimal fallback");
      return `Bonjour,\n\nJe vous contacte concernant une opportunité pertinente pour votre équipe.\n\n${goal}\n\nCordialement,\n[Votre prénom]`;
    }
  }

  async getDealCoachingScript(accountId: string, tenantId: string): Promise<string> {
    try {
      const ctx = await fetchContext(accountId, tenantId);
      return buildSPINCoaching(ctx);
    } catch (err) {
      logger.warn({ err }, "TemplateService.getDealCoachingScript failed");
      return "## Coaching SPIN\n\nAnalysez la situation, identifiez les problèmes, évaluez les implications, et proposez votre solution.";
    }
  }

  async getObjectionScript(objection: string, accountId: string, tenantId: string): Promise<string> {
    try {
      const ctx = await fetchContext(accountId, tenantId);
      return buildObjectionScript(objection, ctx);
    } catch (err) {
      logger.warn({ err }, "TemplateService.getObjectionScript failed");
      return `## Script Objection\n\nObjection : "${objection}"\n\nÉcoutez, clarifiez, répondez avec des faits, et proposez une étape suivante.`;
    }
  }
}

export const templateService = new TemplateService();
