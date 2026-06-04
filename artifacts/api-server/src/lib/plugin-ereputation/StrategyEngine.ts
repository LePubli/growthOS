import { pool } from "@workspace/db";
import { logger } from "../logger";

interface AuditRow {
  id: string;
  score: number;
  technical_details: Record<string, unknown>;
  ai_strategy: string | null;
  created_at: string;
}

interface SerpRow {
  keyword: string;
  position: number | null;
  volume: number;
}

interface SentimentRow {
  sentiment: string;
  count: string;
}

export interface ContentRequest {
  platform: "LinkedIn" | "X" | "Blog" | "Newsletter" | "Instagram";
  tone: "professionnel" | "inspirant" | "éducatif" | "storytelling";
}

export class StrategyEngine {
  async generateAutomatedStrategy(campaignId: string): Promise<string> {
    let recentAudit: AuditRow | null = null;
    let serpData: SerpRow[] = [];
    let sentimentSummary: SentimentRow[] = [];

    try {
      const auditRes = await pool.query<AuditRow>(
        `SELECT id, score, technical_details, ai_strategy, created_at
         FROM erep_audits WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [campaignId],
      );
      recentAudit = auditRes.rows[0] ?? null;
    } catch { /* table may not exist yet */ }

    try {
      const serpRes = await pool.query<SerpRow>(
        `SELECT keyword, position, volume FROM erep_serp_tracking WHERE campaign_id = $1 ORDER BY date DESC LIMIT 20`,
        [campaignId],
      );
      serpData = serpRes.rows;
    } catch { /* ignore */ }

    try {
      const sentRes = await pool.query<SentimentRow>(
        `SELECT sentiment, COUNT(*) as count FROM erep_sentiment_logs WHERE campaign_id = $1 GROUP BY sentiment`,
        [campaignId],
      );
      sentimentSummary = sentRes.rows;
    } catch { /* ignore */ }

    const currentScore = recentAudit?.score ?? 50;
    const negCount = parseInt(sentimentSummary.find(s => s.sentiment === "neg")?.count ?? "0", 10);
    const posCount = parseInt(sentimentSummary.find(s => s.sentiment === "pos")?.count ?? "0", 10);
    const lowPosSerpKeywords = serpData.filter(s => (s.position ?? 99) > 10);
    const highPriorityKw = lowPosSerpKeywords.slice(0, 3).map(s => `"${s.keyword}"`).join(", ");

    const actions: string[] = [];

    if (currentScore < 40) {
      actions.push("🚨 PRIORITÉ CRITIQUE : Score de réputation faible. Lancer une campagne de content marketing intensive.");
    } else if (currentScore < 70) {
      actions.push("⚠️ Score modéré. Renforcer la présence positive sur les canaux clés.");
    } else {
      actions.push("✅ Bonne réputation. Maintenir et amplifier la visibilité.");
    }

    if (negCount > 5) {
      actions.push(`🔴 ${negCount} mentions négatives détectées → Générer des réponses IA personnalisées et publier 3 articles de blog positifs.`);
    }

    if (highPriorityKw) {
      actions.push(`📉 Positions SERP faibles sur ${highPriorityKw} → Créer 5 posts LinkedIn optimisés et 2 articles long-form.`);
    }

    if (posCount > negCount) {
      actions.push(`💚 Capitaliser sur ${posCount} mentions positives → Republier les témoignages sur LinkedIn et créer des case studies.`);
    }

    actions.push("📊 Programmer 15 posts sur 30 jours : 5 LinkedIn, 5 X/Twitter, 3 Blog, 2 Newsletter.");
    actions.push("🔗 Identifier 3 nouveaux sites PBN à DA > 30 pour renforcer le netlinking.");

    const strategy = actions.join("\n\n");
    logger.info({ campaignId, actions: actions.length }, "Automated strategy generated");
    return strategy;
  }

  async generateContent(
    campaignId: string,
    platform: ContentRequest["platform"],
    tone: ContentRequest["tone"],
  ): Promise<string> {
    let campaignName = "votre entreprise";
    let targetType = "B2B";
    let keywords: string[] = [];

    try {
      const res = await pool.query(
        `SELECT name, target_type, keywords FROM erep_campaigns WHERE id = $1`,
        [campaignId],
      );
      if (res.rows[0]) {
        campaignName = res.rows[0].name;
        targetType = res.rows[0].target_type;
        keywords = Array.isArray(res.rows[0].keywords) ? res.rows[0].keywords : [];
      }
    } catch { /* ignore */ }

    const kw = keywords.slice(0, 3).join(", ") || "votre secteur";

    const templates: Record<string, string> = {
      LinkedIn: `🚀 Chez **${campaignName}**, nous transformons ${kw} avec une approche ${tone}.

Notre équipe est fière de partager nos dernières innovations qui redéfinissent les standards du marché.

${targetType === "B2B"
  ? "➡️ Vous cherchez à optimiser votre ROI ? Contactez-nous pour un audit gratuit."
  : "➡️ Rejoignez notre communauté de leaders engagés pour l'excellence."}

#Innovation #${campaignName.replace(/\s/g, "")} #Growth`,

      X: `🔥 ${campaignName} redefines ${kw}. Notre approche ${tone} génère des résultats mesurables. Découvrez comment → [lien] #GrowthHacking #${targetType}`,

      Blog: `# ${campaignName} : Leader ${tone} sur ${kw}

## Introduction

Dans un marché en constante évolution, ${campaignName} se positionne comme un acteur incontournable dans le domaine de ${kw}.

## Notre Vision

Grâce à une approche ${tone}, nous avons développé des solutions qui répondent aux défis spécifiques du secteur ${targetType}.

## Résultats Concrets

- **+45%** d'amélioration de la visibilité organique en 6 mois
- **3× plus** d'engagements sur les réseaux sociaux
- Présence sur la **1ère page Google** pour 8 mots-clés stratégiques

## Conclusion

Contactez ${campaignName} pour découvrir comment nous pouvons transformer votre présence digitale.`,

      Newsletter: `Bonjour,

Ce mois-ci, ${campaignName} a franchi de nouvelles étapes sur ${kw}.

**Faits marquants :**
• Nouveau record de visibilité sur nos mots-clés stratégiques
• ${posContent(tone)} résultats sur nos dernières campagnes
• Prochaines initiatives : renforcement de notre présence sur LinkedIn et Blog

Merci de votre confiance.

L'équipe ${campaignName}`,

      Instagram: `✨ ${campaignName} ✨

${tone === "inspirant" ? "Chaque défi est une opportunité de grandir. Voici ce que nous avons accompli ce mois-ci sur " + kw + "." : "Excellence et innovation sont nos maîtres mots. Découvrez notre dernière réalisation sur " + kw + "."}

👆 Swipe pour en savoir plus

#${campaignName.replace(/\s/g, "")} #${kw.split(",")[0]?.trim().replace(/\s/g, "") ?? "Innovation"} #Digital`,
    };

    return templates[platform] ?? templates["LinkedIn"]!;
  }
}

function posContent(tone: string): string {
  const map: Record<string, string> = {
    professionnel: "Excellents",
    inspirant: "Inspirants",
    éducatif: "Enrichissants",
    storytelling: "Mémorables",
  };
  return map[tone] ?? "Positifs";
}

export const strategyEngine = new StrategyEngine();
