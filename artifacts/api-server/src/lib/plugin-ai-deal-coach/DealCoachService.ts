import { pool } from "@workspace/db";
import { signalService } from "../plugin-signal-intelligence/SignalService";
import { pluginEventBus } from "../plugin-runtime/event-bus";
import { logger } from "../logger";

/* ─── Types ─────────────────────────────────────────────── */

export interface RiskFactor {
  code: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
}

export interface CoachResult {
  dealId: string;
  dealTitle: string;
  company: string | null;
  stage: string;
  value: number;
  healthScore: number;
  riskFactors: RiskFactor[];
  aiRecommendations: string;
  lastCoachedAt: string;
  contextUsed: { meetings: number; memories: number; signals: number };
}

interface DealRow {
  id: string;
  title: string;
  company: string | null;
  value: string | null;
  stage: string;
  probability: number | null;
  close_date: string | null;
  health_score: number;
  risk_factors: RiskFactor[];
  ai_recommendations: string | null;
  last_coached_at: Date | null;
  created_at: Date;
  updated_at: Date;
  tenant_id: string;
}

/* ─── Ollama helper ──────────────────────────────────────── */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? "llama3.2";

async function ollamaGenerate(prompt: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

/* ─── Health score formula ───────────────────────────────── */

function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function calcHealthScore(params: {
  daysSinceLastMeeting: number | null;
  meetingsCount: number;
  signalsCount: number;
  highImpactSignals: number;
  memoryCount: number;
  stage: string;
  daysSinceCreated: number;
  value: number;
}): number {
  let score = 50;

  // Meeting recency
  const { daysSinceLastMeeting: dl } = params;
  if (dl === null || dl > 30) score -= 25;
  else if (dl > 14)           score -= 10;
  else if (dl <= 7)           score += 20;
  else                        score += 10;

  // Meeting volume
  if (params.meetingsCount >= 3) score += 10;
  else if (params.meetingsCount === 0) score -= 5;

  // Signals
  if (params.highImpactSignals > 0) score += 10;
  else if (params.signalsCount === 0) score -= 5;

  // Memory context richness
  if (params.memoryCount >= 3) score += 10;
  else if (params.memoryCount === 0) score -= 5;

  // Stage
  if (params.stage === "negotiation") score += 10;
  else if (params.stage === "proposal") score += 5;
  else if (params.stage === "closed_lost") score = 0;
  else if (params.stage === "closed_won") score = 100;

  // Staleness penalty
  if (params.daysSinceCreated > 60 && ["lead", "qualified"].includes(params.stage)) score -= 15;
  else if (params.daysSinceCreated > 30 && params.stage === "proposal") score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ─── Risk factory ───────────────────────────────────────── */

function buildRiskFactors(params: {
  daysSinceLastMeeting: number | null;
  meetingsCount: number;
  signalsCount: number;
  memoryCount: number;
  stage: string;
  value: number;
  daysSinceCreated: number;
  company: string | null;
}): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (params.daysSinceLastMeeting === null || params.daysSinceLastMeeting > 21) {
    risks.push({
      code: "NO_RECENT_MEETING",
      label: "Aucune réunion récente",
      severity: params.daysSinceLastMeeting === null ? "critical" : "high",
      detail: params.daysSinceLastMeeting === null
        ? "Aucune réunion enregistrée — engagement inconnu"
        : `Dernière réunion il y a ${params.daysSinceLastMeeting} jours — risque de refroidissement`,
    });
  }

  if (params.signalsCount === 0) {
    risks.push({
      code: "NO_SIGNALS",
      label: "Aucun signal business détecté",
      severity: "medium",
      detail: "Absence de signaux (financement, recrutement, actualités) — contexte de déclenchement manquant",
    });
  }

  if (params.memoryCount === 0) {
    risks.push({
      code: "NO_MEMORY",
      label: "Aucun contexte mémoire",
      severity: "medium",
      detail: "Pas d'informations enregistrées dans Growth Memory — historique de relation absent",
    });
  }

  if (params.value > 5000 && ["lead", "qualified"].includes(params.stage) && params.daysSinceCreated > 30) {
    risks.push({
      code: "HIGH_VALUE_STALLED",
      label: "Deal haute valeur bloqué",
      severity: "critical",
      detail: `Deal de ${params.value.toLocaleString("fr-FR")}€ bloqué en phase "${params.stage}" depuis ${params.daysSinceCreated} jours`,
    });
  }

  if (params.daysSinceCreated > 60 && !["closed_won", "closed_lost", "negotiation"].includes(params.stage)) {
    risks.push({
      code: "STALE_DEAL",
      label: "Deal vieillissant",
      severity: "medium",
      detail: `Créé il y a ${params.daysSinceCreated} jours — risque d'attrition progressive`,
    });
  }

  if (risks.length === 0) {
    risks.push({
      code: "LOW_SIGNAL_VOLUME",
      label: "Faible volume de signaux",
      severity: "low",
      detail: "Deal actif mais peu de signaux contextuels — enrichissement recommandé",
    });
  }

  return risks;
}

/* ─── Mock recommendations ───────────────────────────────── */

function mockRecommendations(
  company: string | null,
  riskFactors: RiskFactor[],
  signals: { type: string; title: string }[],
  stage: string,
): string {
  const lines: string[] = [];

  if (riskFactors.some(r => r.code === "NO_RECENT_MEETING")) {
    lines.push("1. **Planifier une réunion de suivi immédiatement** — Proposez un slot cette semaine via Calendar. L'absence de contact est le risque n°1 de perte de deal.");
  }

  if (signals.length > 0) {
    lines.push(`2. **Exploiter le signal "${signals[0].title.slice(0, 50)}"** — Utilisez ce déclencheur comme opening dans votre prochain message pour montrer que vous suivez l'actualité du compte.`);
  } else {
    lines.push("2. **Générer des signaux via Signal Intelligence** — Cliquez sur \"Générer Signaux Mock\" pour détecter des opportunités de déclenchement.");
  }

  if (riskFactors.some(r => r.code === "HIGH_VALUE_STALLED")) {
    lines.push("3. **Escalader au manager de compte** — Deal à forte valeur bloqué trop longtemps. Un appel de direction peut débloquer la situation.");
  } else if (stage === "proposal") {
    lines.push("3. **Relancer sur la proposition** — Si aucune réponse sous 5 jours, envoyez un email de valeur ajoutée (étude de cas, ROI similaire).");
  } else {
    lines.push(`3. **Utiliser AI SDR pour rédiger un email de relance personnalisé** pour ${company ?? "ce compte"} — le contexte Memory + Signals est disponible.`);
  }

  return lines.join("\n\n");
}

/* ─── Service ────────────────────────────────────────────── */

class DealCoachService {
  async analyzeDeal(dealId: string, tenantId: string): Promise<CoachResult> {
    // 1. Fetch deal
    const dealRes = await pool.query<DealRow>(
      `SELECT * FROM deals WHERE id = $1 AND tenant_id = $2`,
      [dealId, tenantId],
    );
    if (!dealRes.rows[0]) throw new Error(`Deal ${dealId} not found`);
    const deal = dealRes.rows[0];
    const company = deal.company ?? "";

    // 2. Fetch related meetings (by company)
    const meetingsRes = await pool.query<{ id: string; created_at: Date; title: string }>(
      `SELECT id, created_at, title FROM meetings WHERE tenant_id = $1 AND (
         LOWER(account_name) = LOWER($2) OR LOWER(title) LIKE $3
       ) ORDER BY created_at DESC LIMIT 10`,
      [tenantId, company, `%${company.toLowerCase()}%`],
    ).catch(() => ({ rows: [] as { id: string; created_at: Date; title: string }[] }));
    const meetings = meetingsRes.rows;

    // 3. Fetch memory snippets
    const memRes = await pool.query<{ id: string; content: string; category: string }>(
      `SELECT id, content, category FROM memory_entries WHERE tenant_id = $1 AND (
         LOWER(content) LIKE $2 OR LOWER(account_name) LIKE $2
       ) ORDER BY created_at DESC LIMIT 5`,
      [tenantId, `%${company.toLowerCase()}%`],
    ).catch(() => ({ rows: [] as { id: string; content: string; category: string }[] }));
    const memories = memRes.rows;

    // 4. Fetch signals
    const signals = await signalService.getSignalsByAccount(company, tenantId).catch(() => []);
    const highImpactSignals = signals.filter(s => s.score >= 70).length;

    // 5. Compute params
    const lastMeeting = meetings[0]?.created_at ?? null;
    const daysSinceLastMeeting = daysSince(lastMeeting);
    const daysSinceCreated = daysSince(deal.created_at) ?? 0;
    const value = parseFloat(deal.value ?? "0") || 0;

    // 6. Health score
    const healthScore = calcHealthScore({
      daysSinceLastMeeting,
      meetingsCount: meetings.length,
      signalsCount: signals.length,
      highImpactSignals,
      memoryCount: memories.length,
      stage: deal.stage,
      daysSinceCreated,
      value,
    });

    // 7. Risk factors
    const riskFactors = buildRiskFactors({
      daysSinceLastMeeting,
      meetingsCount: meetings.length,
      signalsCount: signals.length,
      memoryCount: memories.length,
      stage: deal.stage,
      value,
      daysSinceCreated,
      company,
    });

    // 8. Recommendations (try Ollama first)
    let aiRecommendations: string;
    const prompt = `Tu es un coach commercial expert. Analyse ce deal et génère 3 recommandations en français (format markdown avec titres en gras).
Deal: "${deal.title}" - ${company} - ${deal.stage} - ${value}€
Risques: ${riskFactors.map(r => r.label).join(", ")}
Signaux: ${signals.slice(0, 2).map(s => s.title).join(", ") || "Aucun"}
Réponse: uniquement les 3 recommandations numérotées, concises et actionnables.`;

    const ollamaRaw = await ollamaGenerate(prompt);
    aiRecommendations = ollamaRaw ?? mockRecommendations(company, riskFactors, signals, deal.stage);

    // 9. Persist results
    await pool.query(
      `UPDATE deals SET health_score = $1, risk_factors = $2, ai_recommendations = $3, last_coached_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [healthScore, JSON.stringify(riskFactors), aiRecommendations, dealId, tenantId],
    );

    // 10. Emit events
    const event = healthScore < 40 ? "deal.at_risk" : "deal.coached";
    pluginEventBus
      .emit(event, { dealId, company, healthScore, riskCount: riskFactors.length })
      .catch(err => logger.error({ err }, `Failed to emit ${event}`));

    logger.info({ dealId, company, healthScore, event }, "Deal coached");

    return {
      dealId,
      dealTitle: deal.title,
      company,
      stage: deal.stage,
      value,
      healthScore,
      riskFactors,
      aiRecommendations,
      lastCoachedAt: new Date().toISOString(),
      contextUsed: { meetings: meetings.length, memories: memories.length, signals: signals.length },
    };
  }

  async getPipelineHealth(tenantId: string): Promise<{
    totalDeals: number;
    avgHealthScore: number;
    atRiskCount: number;
    healthyCount: number;
    byStage: { stage: string; count: number; avgScore: number }[];
    totalValue: number;
    atRiskValue: number;
  }> {
    const res = await pool.query<{
      stage: string; cnt: string; avg_score: string; total_value: string;
    }>(
      `SELECT stage, COUNT(*) as cnt, AVG(health_score) as avg_score, SUM(COALESCE(value::numeric,0)) as total_value
       FROM deals WHERE tenant_id = $1 AND stage NOT IN ('closed_won','closed_lost')
       GROUP BY stage ORDER BY stage`,
      [tenantId],
    );

    const atRiskRes = await pool.query<{ cnt: string; val: string }>(
      `SELECT COUNT(*) as cnt, SUM(COALESCE(value::numeric,0)) as val
       FROM deals WHERE tenant_id = $1 AND health_score < 40 AND stage NOT IN ('closed_won','closed_lost')`,
      [tenantId],
    );

    const totalRes = await pool.query<{ cnt: string; avg: string; val: string }>(
      `SELECT COUNT(*) as cnt, AVG(health_score) as avg, SUM(COALESCE(value::numeric,0)) as val
       FROM deals WHERE tenant_id = $1 AND stage NOT IN ('closed_won','closed_lost')`,
      [tenantId],
    );

    const total = totalRes.rows[0];
    const atRisk = atRiskRes.rows[0];

    return {
      totalDeals: parseInt(total.cnt) || 0,
      avgHealthScore: Math.round(parseFloat(total.avg) || 50),
      atRiskCount: parseInt(atRisk.cnt) || 0,
      healthyCount: (parseInt(total.cnt) || 0) - (parseInt(atRisk.cnt) || 0),
      byStage: res.rows.map(r => ({
        stage: r.stage,
        count: parseInt(r.cnt),
        avgScore: Math.round(parseFloat(r.avg_score) || 50),
      })),
      totalValue: parseFloat(total.val) || 0,
      atRiskValue: parseFloat(atRisk.val) || 0,
    };
  }

  async getAtRiskDeals(tenantId: string): Promise<DealRow[]> {
    const res = await pool.query<DealRow>(
      `SELECT * FROM deals WHERE tenant_id = $1 AND health_score < 40 AND stage NOT IN ('closed_won','closed_lost')
       ORDER BY health_score ASC, value DESC LIMIT 20`,
      [tenantId],
    );
    return res.rows;
  }

  async getAllDeals(tenantId: string): Promise<DealRow[]> {
    const res = await pool.query<DealRow>(
      `SELECT * FROM deals WHERE tenant_id = $1 AND stage NOT IN ('closed_lost')
       ORDER BY health_score ASC, value DESC LIMIT 50`,
      [tenantId],
    );
    return res.rows;
  }

  async getDealCoach(dealId: string, tenantId: string): Promise<CoachResult | null> {
    const res = await pool.query<DealRow>(
      `SELECT * FROM deals WHERE id = $1 AND tenant_id = $2`,
      [dealId, tenantId],
    );
    if (!res.rows[0]) return null;
    const d = res.rows[0];
    return {
      dealId: d.id,
      dealTitle: d.title,
      company: d.company,
      stage: d.stage,
      value: parseFloat(d.value ?? "0") || 0,
      healthScore: d.health_score,
      riskFactors: Array.isArray(d.risk_factors) ? d.risk_factors : [],
      aiRecommendations: d.ai_recommendations ?? "",
      lastCoachedAt: d.last_coached_at?.toISOString() ?? "",
      contextUsed: { meetings: 0, memories: 0, signals: 0 },
    };
  }
}

export const dealCoachService = new DealCoachService();
