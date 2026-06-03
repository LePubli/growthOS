import { pool } from "@workspace/db";
import { revenueService } from "../plugin-revenue-intelligence/RevenueService";
import { dealCoachService } from "../plugin-ai-deal-coach/DealCoachService";
import { logger } from "../logger";

export interface CommandOverview {
  totalActiveDeals: number;
  totalPipelineValue: number;
  atRiskDeals: number;
  atRiskValue: number;
  forecast90d: number;
  winRate: number;
  avgHealthScore: number;
  topSignals: { id: string; company: string; title: string; type: string; score: number; detectedAt: string }[];
  recentWins: { title: string; company: string | null; value: number; closedAt: string }[];
  pluginActivity: { pluginId: string; pluginName: string; action: string; createdAt: string }[];
}

export interface AssistantResponse {
  answer: string;
  sources: { type: string; label: string }[];
  confidence: "high" | "medium" | "low";
}

class ExecutiveService {
  async getCommandOverview(tenantId: string): Promise<CommandOverview> {
    const [kpis, health, signals, wins, auditLogs] = await Promise.all([
      revenueService.getCoreKPIs(tenantId).catch(() => null),
      dealCoachService.getPipelineHealth(tenantId).catch(() => null),
      pool.query<{ id: string; company: string; title: string; type: string; score: number; detected_at: string }>(
        `SELECT id, company, title, type, score, detected_at
         FROM signals
         WHERE tenant_id = $1
         ORDER BY score DESC, detected_at DESC
         LIMIT 3`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query<{ title: string; company: string | null; value: string; updated_at: string }>(
        `SELECT title, company, value, updated_at
         FROM deals
         WHERE tenant_id = $1 AND stage = 'closed_won'
         ORDER BY updated_at DESC
         LIMIT 5`,
        [tenantId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query<{ plugin_id: string; plugin_name: string; action: string; created_at: string }>(
        `SELECT plugin_id, plugin_name, action, created_at
         FROM plugin_audit_logs
         ORDER BY created_at DESC
         LIMIT 6`,
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const forecast = kpis ? await revenueService.getForecast(tenantId).catch(() => []) : [];
    const forecast90 = forecast.find(f => f.period === "90d")?.weightedValue ?? 0;

    return {
      totalActiveDeals: health?.totalDeals ?? 0,
      totalPipelineValue: kpis?.totalPipelineValue ?? 0,
      atRiskDeals: health?.atRiskCount ?? 0,
      atRiskValue: health?.atRiskValue ?? 0,
      forecast90d: forecast90,
      winRate: kpis?.winRate ?? 0,
      avgHealthScore: health?.avgHealthScore ?? 0,
      topSignals: signals.rows.map(s => ({
        id: s.id,
        company: s.company,
        title: s.title,
        type: s.type,
        score: s.score,
        detectedAt: s.detected_at,
      })),
      recentWins: wins.rows.map(w => ({
        title: w.title,
        company: w.company,
        value: parseFloat(w.value ?? "0"),
        closedAt: w.updated_at,
      })),
      pluginActivity: auditLogs.rows.map(l => ({
        pluginId: l.plugin_id,
        pluginName: l.plugin_name,
        action: l.action,
        createdAt: l.created_at,
      })),
    };
  }

  async queryAssistant(question: string, tenantId: string): Promise<AssistantResponse> {
    const q = question.toLowerCase();

    try {
      if (q.includes("win rate") || q.includes("taux de gain") || q.includes("conversion")) {
        const kpis = await revenueService.getCoreKPIs(tenantId);
        return {
          answer: `Votre taux de gain actuel est de **${kpis.winRate.toFixed(1)}%** (${kpis.closedWonCount} deals gagnés sur ${kpis.closedWonCount + kpis.closedLostCount} closés). La taille moyenne d'un deal est de **${kpis.avgDealSize.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}** avec un cycle de vente de **${Math.round(kpis.avgSalesCycleDays)} jours** en moyenne.`,
          sources: [{ type: "revenue-intelligence", label: "KPIs Revenue" }],
          confidence: "high",
        };
      }

      if (q.includes("risk") || q.includes("risque") || q.includes("danger") || q.includes("at risk")) {
        const health = await dealCoachService.getPipelineHealth(tenantId);
        const atRiskDeals = await dealCoachService.getAtRiskDeals(tenantId);
        const dealList = atRiskDeals.slice(0, 3).map(d =>
          `• **${d.title}** (${d.company ?? "—"}) — Score ${d.health_score}/100 · ${d.value ? parseFloat(d.value).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }) : "N/A"}`
        ).join("\n");
        return {
          answer: `Vous avez **${health.atRiskCount} deals à risque** représentant **${health.atRiskValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}** de pipeline menacé (score < 40).\n\n${dealList || "Aucun deal à risque identifié."}\n\nRecommandation : relancez ces deals avec l'AI SDR ou demandez un coaching deal approfondi.`,
          sources: [{ type: "ai-deal-coach", label: "Pipeline Health" }],
          confidence: "high",
        };
      }

      if (q.includes("forecast") || q.includes("prévision") || q.includes("prevision") || q.includes("90") || q.includes("pipeline")) {
        const [kpis, forecast] = await Promise.all([
          revenueService.getCoreKPIs(tenantId),
          revenueService.getForecast(tenantId),
        ]);
        const f90 = forecast.find(f => f.period === "90d");
        return {
          answer: `Pipeline actuel : **${kpis.totalPipelineValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}** sur ${kpis.totalPipelineCount} deals.\n\nForecast 90 jours pondéré : **${(f90?.weightedValue ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}** (meilleur cas : ${(f90?.bestCase ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}).\n\nARR estimé : **${kpis.arrEstimate.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}**.`,
          sources: [{ type: "revenue-intelligence", label: "Forecast Pipeline" }],
          confidence: "high",
        };
      }

      if (q.includes("signal") || q.includes("actu") || q.includes("opportunit")) {
        const signals = await pool.query<{ company: string; title: string; score: number }>(
          `SELECT company, title, score FROM signals WHERE tenant_id = $1 ORDER BY score DESC, detected_at DESC LIMIT 5`,
          [tenantId],
        );
        const list = signals.rows.map(s => `• **${s.company}** — ${s.title} (score ${s.score})`).join("\n");
        return {
          answer: `Voici les **${signals.rows.length} meilleurs signaux business** détectés :\n\n${list || "Aucun signal disponible."}\n\nCes opportunités méritent une action rapide de votre équipe SDR.`,
          sources: [{ type: "signal-intelligence", label: "Signaux Business" }],
          confidence: "medium",
        };
      }

      if (q.includes("health") || q.includes("santé") || q.includes("score")) {
        const health = await dealCoachService.getPipelineHealth(tenantId);
        return {
          answer: `Score de santé moyen du pipeline : **${Math.round(health.avgHealthScore)}/100**.\n\n• Deals en bonne santé : **${health.healthyCount}** (score ≥ 70)\n• Deals à risque : **${health.atRiskCount}** (score < 40)\n• Total deals actifs : **${health.totalDeals}**\n\nLe pipeline est ${health.avgHealthScore >= 65 ? "🟢 en bonne forme" : health.avgHealthScore >= 45 ? "🟡 à surveiller" : "🔴 en danger"}.`,
          sources: [{ type: "ai-deal-coach", label: "Health Score" }],
          confidence: "high",
        };
      }

      // Default
      const kpis = await revenueService.getCoreKPIs(tenantId).catch(() => null);
      return {
        answer: `Je n'ai pas trouvé de réponse spécifique à votre question. Voici un résumé de votre activité actuelle :\n\n• **Pipeline** : ${kpis ? kpis.totalPipelineValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }) : "N/A"}\n• **Win Rate** : ${kpis ? kpis.winRate.toFixed(1) + "%" : "N/A"}\n• **Santé moyenne** : ${kpis ? Math.round(kpis.avgHealthScore) + "/100" : "N/A"}\n\nEssayez : "Quels sont nos deals à risque ?", "Quel est notre forecast 90 jours ?" ou "Montre-moi les meilleurs signaux".`,
        sources: [],
        confidence: "low",
      };
    } catch (err) {
      logger.warn({ err }, "Executive assistant query failed, returning fallback");
      return {
        answer: "Je suis en train d'analyser vos données... Réessayez dans quelques instants.",
        sources: [],
        confidence: "low",
      };
    }
  }
}

export const executiveService = new ExecutiveService();
