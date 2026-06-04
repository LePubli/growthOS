import { logger } from "../logger";

export type SentimentLabel = "pos" | "neg" | "neu";

export interface SentimentResult {
  sentiment: SentimentLabel;
  score: number;
  tone: string;
  keywords: string[];
}

const POSITIVE_WORDS = [
  "excellent", "parfait", "bravo", "super", "génial", "merci", "félicitations",
  "recommande", "top", "leader", "innovation", "croissance", "succès", "award",
  "fiable", "professionnel", "qualité", "satisfait", "confiance", "positif",
];

const NEGATIVE_WORDS = [
  "arnaque", "nul", "horrible", "scandale", "problème", "escroquerie", "faillite",
  "plainte", "fraude", "défaut", "mauvais", "décevant", "insuffisant", "litige",
  "crise", "catastrophe", "incompétent", "mensonge", "manipulation", "danger",
];

export class SentimentAnalyzer {
  analyzeText(text: string): SentimentResult {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    let posCount = 0;
    let negCount = 0;
    const foundPositive: string[] = [];
    const foundNegative: string[] = [];

    for (const w of words) {
      if (POSITIVE_WORDS.some(p => w.includes(p))) {
        posCount++;
        foundPositive.push(w);
      }
      if (NEGATIVE_WORDS.some(n => w.includes(n))) {
        negCount++;
        foundNegative.push(w);
      }
    }

    const total = posCount + negCount;
    let sentiment: SentimentLabel = "neu";
    let score = 0;
    let tone = "Neutre";

    if (total === 0) {
      sentiment = "neu";
      score = 0;
      tone = "Neutre";
    } else if (posCount > negCount) {
      const ratio = posCount / total;
      score = Math.min(0.99, ratio);
      sentiment = "pos";
      tone = score > 0.8 ? "Très positif" : "Positif";
    } else if (negCount > posCount) {
      const ratio = negCount / total;
      score = -Math.min(0.99, ratio);
      sentiment = "neg";
      tone = score < -0.8 ? "Très négatif" : "Négatif";
    } else {
      sentiment = "neu";
      score = 0;
      tone = "Mitigé";
    }

    logger.debug({ sentiment, score }, "Sentiment analysis complete");

    return {
      sentiment,
      score,
      tone,
      keywords: sentiment === "pos" ? foundPositive.slice(0, 5) : foundNegative.slice(0, 5),
    };
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
