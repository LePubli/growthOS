import { logger } from "../logger";

export type SentimentLabel = "pos" | "neg" | "neu";

export interface SentimentResult {
  sentiment: SentimentLabel;
  /** -1 (très négatif) … +1 (très positif). */
  score: number;
  tone: string;
  keywords: string[];
  /** Accusation grave (arnaque, fraude, diffamation…) ou exposition de données personnelles. */
  critical: boolean;
}

/**
 * Analyse locale (repli quand aucun fournisseur IA n'est configuré).
 * Lexique français sans accents, correspondance par préfixe de mot, prise en
 * compte des négations proches (« pas satisfait », « jamais déçu »).
 */
const POSITIVE = [
  "excellent", "parfait", "bravo", "super", "genial", "merci", "felicitation", "recommand", "top", "leader",
  "innovation", "croissance", "succes", "award", "fiable", "professionnel", "qualite", "satisfait", "confiance",
  "positif", "serieu", "impeccable", "efficace", "ravi", "rapide", "competent", "agreable", "soigne", "bien",
];
const NEGATIVE = [
  "arnaque", "nul", "horrible", "scandale", "probleme", "escroc", "faillite", "plainte", "fraude", "defaut",
  "mauvais", "decevant", "decu", "insuffisant", "litige", "crise", "catastroph", "incompetent", "mensonge", "menteur",
  "manipulation", "danger", "abandon", "retard", "inadmissible", "honteux", "voleur", "malhonnete", "fuir", "pire",
  "aucune reponse", "injoignable", "condamn", "diffam",
];
/** Termes qui justifient une gravité « critique » (plan de crise). */
const CRITICAL = [
  "arnaque", "escroc", "fraude", "voleur", "vol ", "malhonnete", "diffam", "harcel", "menace", "condamn",
  "mise en examen", "garde a vue", "liquidation judiciaire", "redressement judiciaire", "plainte penale", "porter plainte",
  "faux avis", "usurpation", "numero de telephone personnel", "adresse personnelle", "donnees personnelles",
];
const NEGATORS = new Set(["pas", "jamais", "aucun", "aucune", "ni", "sans", "guere", "non"]);

export const normalizeText = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();

export class SentimentAnalyzer {
  analyzeText(text: string): SentimentResult {
    const flat = normalizeText(text || "");
    const tokens = flat.split(/[^a-z0-9]+/).filter(Boolean);
    let pos = 0, neg = 0;
    const foundPositive: string[] = [], foundNegative: string[] = [];
    tokens.forEach((token, i) => {
      if (NEGATORS.has(token)) return;
      const isPos = POSITIVE.some(p => token.startsWith(p));
      const isNeg = !isPos && NEGATIVE.some(n => !n.includes(" ") && token.startsWith(n));
      if (!isPos && !isNeg) return;
      const negated = NEGATORS.has(tokens[i - 1] ?? "") || NEGATORS.has(tokens[i - 2] ?? "");
      const positive = negated ? !isPos : isPos;
      if (positive) { pos++; foundPositive.push(token); } else { neg++; foundNegative.push(token); }
    });
    // Expressions de plusieurs mots.
    for (const phrase of NEGATIVE.filter(n => n.includes(" "))) if (flat.includes(phrase)) { neg++; foundNegative.push(phrase); }
    const critical = CRITICAL.some(c => (` ${flat} `).includes(c.endsWith(" ") ? ` ${c}` : c));
    if (critical && neg === 0) neg = 1;

    const total = pos + neg;
    let sentiment: SentimentLabel = "neu", score = 0, tone = "Neutre";
    if (total && pos > neg) {
      score = Math.min(0.99, pos / total); sentiment = "pos"; tone = score > 0.8 ? "Très positif" : "Positif";
    } else if (total && neg > pos) {
      score = -Math.min(0.99, neg / total); sentiment = "neg"; tone = score < -0.8 ? "Très négatif" : "Négatif";
    } else if (total) {
      tone = "Mitigé";
    }
    if (critical) { sentiment = "neg"; score = Math.min(score, -0.8); tone = "Critique"; }
    logger.debug({ sentiment, score, critical }, "Sentiment analysis complete");
    return {
      sentiment, score: Number(score.toFixed(2)), tone, critical,
      keywords: (sentiment === "pos" ? foundPositive : foundNegative).slice(0, 5),
    };
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
