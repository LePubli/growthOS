import { pool } from "@workspace/db";

/**
 * E-réputation — lot 3 : modèle du score sur 100 et son explication.
 *
 * Quatre composantes, chacune sur 100, pondérées puis normalisées sur les
 * seules composantes mesurées (une composante sans donnée n'est jamais
 * remplacée par une valeur par défaut) :
 *
 *  - SERP (40 %) : moyenne de
 *      · la visibilité du site de la cible (suivi de position, 30 derniers jours :
 *        top 3 = 100, top 10 = 70, top 20 = 40, au-delà = 10, absent du top 100 = 0) ;
 *      · la tonalité de la première page (dernier relevé par moteur et requête) :
 *        chaque résultat du top 10 pèse 1 / log2(position + 1) ; positif ou site
 *        de la cible = 100, neutre = 70, négatif = 0.
 *  - Sentiment des mentions (30 %) : moyenne de (score + 1) × 50, pondérée par
 *    l'ancienneté (demi-vie 60 jours) ; avis et mentions ignorées exclus.
 *  - Avis (20 %) : dernière note lue par source, pondérée par le nombre d'avis,
 *    convertie de 1–5 en 0–100.
 *  - Liens (10 %) : autorité moyenne des sites PBN actifs × 1,5 (plafond 100).
 *
 * Chaque « facteur » chiffre son impact en points du score final : la
 * différence entre le score réel et le score si cet élément était neutre.
 */
export const SCORE_WEIGHTS = { serp: 0.4, sentiment: 0.3, reviews: 0.2, backlinks: 0.1 } as const;
export type ComponentKey = keyof typeof SCORE_WEIGHTS;

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  serp: "Résultats de recherche", sentiment: "Sentiment des mentions", reviews: "Avis clients", backlinks: "Liens et autorité",
};

export interface ScoreFactor {
  label: string;
  /** Impact en points du score sur 100 (négatif = fait baisser le score). */
  impact: number;
  tone: "neg" | "pos" | "info";
  url?: string | null;
}
export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  measured: boolean;
  value: number | null;
  weight: number;
  /** Poids après normalisation sur les composantes mesurées. */
  effectiveWeight: number;
  /** Points apportés au score final (value × poids effectif). */
  points: number | null;
  basis: string;
  /** Facteur → impact en points de la composante (0–100), converti ensuite. */
  factors: ScoreFactor[];
}

const HALF_LIFE_DAYS = 60;
const NEUTRAL_SERP = 70;
const posWeight = (p: number) => 1 / Math.log2(p + 1);
const round1 = (v: number) => Math.round(v * 10) / 10;
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };
const SOURCE: Record<string, string> = { google_search: "Google", bing: "Bing", google_maps: "Google Maps", pagesjaunes: "PagesJaunes" };

/** Mesure brute des composantes (sur 100) avec leurs facteurs d'impact (en points de composante). */
export async function measureComponents(campaignId: string, sinceDays = 30): Promise<Record<ComponentKey, Omit<ScoreComponent, "effectiveWeight" | "points">>> {
  const target = (await pool.query(`SELECT target_url FROM erep_campaigns WHERE id = $1`, [campaignId])).rows[0];
  const ownHost = host(target?.target_url ?? null);
  const days = Math.max(1, Math.min(365, Math.round(sinceDays)));

  // ── SERP : visibilité du site de la cible
  const tracking = (await pool.query(
    `SELECT keyword, position FROM erep_serp_tracking WHERE campaign_id = $1 AND date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')`, [campaignId, days])).rows;
  const trackValue = (p: number | null) => p == null ? 0 : p <= 3 ? 100 : p <= 10 ? 70 : p <= 20 ? 40 : 10;
  const visibility = tracking.length ? tracking.reduce((s, r) => s + trackValue(r.position), 0) / tracking.length : null;

  // ── SERP : tonalité de la première page (dernier relevé de chaque requête)
  const page = (await pool.query(
    `WITH latest AS (SELECT DISTINCT ON (engine, query) engine, query, run_id FROM erep_serp_collections
                      WHERE campaign_id = $1 AND captured_at >= NOW() - ($2::int * INTERVAL '1 day') ORDER BY engine, query, captured_at DESC)
     SELECT l.engine, l.query, s.position, s.url, s.title, m.sentiment, m.status, m.severity
       FROM latest l LEFT JOIN erep_serp_snapshots s ON s.run_id = l.run_id AND s.engine = l.engine AND s.query = l.query AND s.position <= 10
       LEFT JOIN LATERAL (SELECT sentiment, status, severity FROM erep_mentions WHERE campaign_id = $1 AND kind = 'serp' AND url = s.url LIMIT 1) m ON true`,
    [campaignId, days])).rows;
  const queries = new Map<string, typeof page>();
  for (const r of page) { const k = `${r.engine}|${r.query}`; if (!queries.has(k)) queries.set(k, []); if (r.position != null) queries.get(k)!.push(r); }
  // Une requête dont le relevé est vide n'apporte pas de mesure de tonalité.
  const measuredQueries = [...queries.values()].filter(rows => rows.length);
  const valueOf = (r: any) => (ownHost && (host(r.url) === ownHost || host(r.url).endsWith("." + ownHost))) ? 100
    : r.status === "ignored" ? NEUTRAL_SERP : r.sentiment === "pos" ? 100 : r.sentiment === "neg" ? 0 : NEUTRAL_SERP;
  const serpFactors: ScoreFactor[] = [];
  let tone: number | null = null;
  const serpByUrl = new Map<string, { url: string; title: string | null; engine: string; best: number; queries: Set<string>; impact: number; own: boolean; v: number; critical: boolean }>();
  if (measuredQueries.length) {
    let sum = 0;
    for (const rows of measuredQueries) {
      const total = rows.reduce((s, r) => s + posWeight(r.position), 0);
      sum += rows.reduce((s, r) => s + posWeight(r.position) * valueOf(r), 0) / total;
      for (const r of rows) {
        const v = valueOf(r);
        if (v === NEUTRAL_SERP) continue;
        const own = !!ownHost && (host(r.url) === ownHost || host(r.url).endsWith("." + ownHost));
        // Impact sur la tonalité (moyenne des requêtes), avant combinaison avec la visibilité.
        // Un même résultat relevé sur plusieurs requêtes est regroupé en un seul facteur.
        const delta = (posWeight(r.position) * (v - NEUTRAL_SERP)) / total / measuredQueries.length;
        const agg = serpByUrl.get(r.url) ?? { url: r.url, title: r.title, engine: r.engine, best: r.position, queries: new Set<string>(), impact: 0, own, v, critical: r.severity === "critical" };
        agg.impact += delta; agg.best = Math.min(agg.best, r.position); agg.queries.add(r.query);
        serpByUrl.set(r.url, agg);
      }
    }
    tone = sum / measuredQueries.length;
    for (const f of serpByUrl.values()) {
      const where = f.queries.size === 1 ? `pour « ${[...f.queries][0]} »` : `sur ${f.queries.size} requêtes`;
      serpFactors.push({
        label: `${f.own ? "Site de la cible" : f.v > NEUTRAL_SERP ? "Résultat positif" : `Résultat négatif${f.critical ? " critique" : ""}`} en position ${f.best} sur ${SOURCE[f.engine] ?? f.engine} ${where}${f.title ? ` : ${String(f.title).slice(0, 90)}` : ""}`,
        impact: f.impact, tone: f.v > NEUTRAL_SERP ? "pos" : "neg", url: f.url,
      });
    }
  }
  const serpParts = [visibility, tone].filter((v): v is number => v !== null);
  const serpValue = serpParts.length ? serpParts.reduce((a, b) => a + b, 0) / serpParts.length : null;
  const toneShare = serpParts.length ? (tone !== null ? 1 / serpParts.length : 0) : 0;
  for (const f of serpFactors) f.impact *= toneShare;
  if (visibility !== null) {
    const absent = tracking.filter(r => r.position == null).length;
    const top10 = tracking.filter(r => r.position != null && r.position <= 10).length;
    serpFactors.push({
      label: `Site de la cible : ${top10}/${tracking.length} relevé(s) en première page${absent ? `, ${absent} absent(s) du top 100` : ""}`,
      impact: (visibility - NEUTRAL_SERP) / serpParts.length, tone: visibility >= NEUTRAL_SERP ? "pos" : "neg",
    });
  }
  const serpBasis = [
    visibility !== null ? `${tracking.length} relevé(s) de position du site sur ${days} jours` : ownHost ? "site de la cible jamais relevé" : "aucun site de la cible renseigné",
    tone !== null ? `${measuredQueries.length} requête(s) analysée(s) en première page` : "aucune première page relevée",
  ].join(" · ");

  // ── Sentiment des mentions (hors avis et mentions ignorées), pondéré par l'ancienneté
  const logs = (await pool.query(
    `SELECT l.score::float AS score, l.sentiment, l.text, l.source_url, m.title, m.severity,
            EXTRACT(EPOCH FROM (NOW() - l.detected_at)) / 86400 AS age
       FROM erep_sentiment_logs l LEFT JOIN erep_mentions m ON m.id = l.mention_id
      WHERE l.campaign_id = $1 AND (m.id IS NULL OR (m.status <> 'ignored' AND m.kind <> 'review'))`, [campaignId])).rows;
  let sentimentValue: number | null = null;
  const sentimentFactors: ScoreFactor[] = [];
  if (logs.length) {
    const w = logs.map(l => Math.pow(0.5, Math.max(0, Number(l.age)) / HALF_LIFE_DAYS));
    const total = w.reduce((a, b) => a + b, 0);
    const v = logs.map(l => Math.max(0, Math.min(100, (Math.max(-1, Math.min(1, Number(l.score) || 0)) + 1) * 50)));
    sentimentValue = v.reduce((s, x, i) => s + x * w[i], 0) / total;
    logs.forEach((l, i) => {
      if (Math.abs(v[i] - 50) < 1) return;
      sentimentFactors.push({
        label: `Mention ${v[i] > 50 ? "positive" : l.severity === "critical" ? "critique" : "négative"} : ${String(l.title || l.text || "").slice(0, 110)}`,
        impact: (w[i] * (v[i] - 50)) / total, tone: v[i] > 50 ? "pos" : "neg", url: l.source_url,
      });
    });
  }
  const pos = logs.filter(l => l.sentiment === "pos").length, neg = logs.filter(l => l.sentiment === "neg").length;
  const sentimentBasis = logs.length ? `${logs.length} mention(s) : ${pos} positive(s), ${neg} négative(s), ${logs.length - pos - neg} neutre(s) ; les plus récentes comptent davantage` : "aucune mention analysée";

  // ── Avis
  const stats = (await pool.query(
    `SELECT DISTINCT ON (source) source, rating::float AS rating, review_count FROM erep_review_stats
      WHERE campaign_id = $1 AND rating IS NOT NULL ORDER BY source, captured_at DESC`, [campaignId])).rows;
  let reviewsValue: number | null = null;
  const reviewFactors: ScoreFactor[] = [];
  if (stats.length) {
    const weightOf = (r: any) => Math.max(1, Number(r.review_count) || 1);
    const total = stats.reduce((s, r) => s + weightOf(r), 0);
    const rating = stats.reduce((s, r) => s + r.rating * weightOf(r), 0) / total;
    reviewsValue = Math.max(0, Math.min(100, ((rating - 1) / 4) * 100));
    for (const r of stats) {
      const v = ((r.rating - 1) / 4) * 100;
      reviewFactors.push({ label: `${SOURCE[r.source] ?? r.source} : ${String(r.rating).replace(".", ",")}/5${r.review_count != null ? ` sur ${r.review_count} avis` : " (nombre d'avis non lu)"}`,
        impact: (weightOf(r) * (v - 50)) / total, tone: v >= 50 ? "pos" : "neg" });
    }
  }
  const lowReviews = Number((await pool.query(`SELECT COUNT(*)::int AS n FROM erep_reviews WHERE campaign_id = $1 AND rating <= 2`, [campaignId])).rows[0]?.n ?? 0);
  const reviewsBasis = stats.length ? `${stats.length} fiche(s) d'avis lue(s)${lowReviews ? ` · ${lowReviews} avis à 1 ou 2 étoiles collecté(s)` : ""}` : "aucune fiche d'avis lue";

  // ── Liens
  const pbn = (await pool.query(`SELECT AVG(da_score) AS avg_da, COUNT(*)::int AS n FROM erep_pbn_sites WHERE campaign_id = $1 AND status = 'active'`, [campaignId])).rows[0];
  const backlinksValue = pbn?.avg_da != null ? Math.min(100, Number(pbn.avg_da) * 1.5) : null;

  const comp = (key: ComponentKey, value: number | null, basis: string, factors: ScoreFactor[]) =>
    ({ key, label: COMPONENT_LABELS[key], measured: value !== null, value: value === null ? null : Math.round(value), weight: SCORE_WEIGHTS[key], basis, factors });
  return {
    serp: comp("serp", serpValue, serpBasis, serpFactors),
    sentiment: comp("sentiment", sentimentValue, sentimentBasis, sentimentFactors),
    reviews: comp("reviews", reviewsValue, reviewsBasis, reviewFactors),
    backlinks: comp("backlinks", backlinksValue, backlinksValue !== null ? `${pbn.n} site(s) de liens actif(s), autorité moyenne ${Math.round(Number(pbn.avg_da))}` : "aucun site de liens actif", []),
  };
}

/** Score final et composantes avec poids effectifs et facteurs convertis en points du score final. */
export async function computeScore(campaignId: string, sinceDays = 30): Promise<{ score: number | null; components: ScoreComponent[] }> {
  const raw = await measureComponents(campaignId, sinceDays);
  const list = (Object.keys(SCORE_WEIGHTS) as ComponentKey[]).map(k => raw[k]);
  const measuredWeight = list.filter(c => c.measured).reduce((s, c) => s + c.weight, 0);
  const components: ScoreComponent[] = list.map(c => {
    const effectiveWeight = c.measured && measuredWeight ? c.weight / measuredWeight : 0;
    return {
      ...c, effectiveWeight: Math.round(effectiveWeight * 1000) / 1000,
      points: c.measured ? round1((c.value as number) * effectiveWeight) : null,
      factors: c.factors.map(f => ({ ...f, impact: round1(f.impact * effectiveWeight) })).filter(f => f.tone === "info" || Math.abs(f.impact) >= 0.1)
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 8),
    };
  });
  const score = measuredWeight ? Math.round(list.filter(c => c.measured).reduce((s, c) => s + (c.value as number) * c.weight, 0) / measuredWeight) : null;
  return { score, components };
}

export interface ScoreExplanation {
  score: number | null;
  level: { key: "excellent" | "good" | "fragile" | "critical" | "none"; label: string };
  components: ScoreComponent[];
  /** Phrases courtes, lisibles par le client final, sans donnée inventée. */
  summary: string[];
  topFactors: (ScoreFactor & { component: ComponentKey })[];
  unmeasured: { key: ComponentKey; label: string; basis: string }[];
  previous: { day: string; score: number; delta: number; byComponent: { key: ComponentKey; label: string; delta: number }[] } | null;
  history: { day: string; score: number }[];
  weights: typeof SCORE_WEIGHTS;
}

const LEVELS = [
  { min: 80, key: "excellent", label: "Excellente réputation" }, { min: 60, key: "good", label: "Bonne réputation" },
  { min: 40, key: "fragile", label: "Réputation fragile" }, { min: 0, key: "critical", label: "Réputation critique" },
] as const;
const fmtDay = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${String(Math.abs(round1(v))).replace(".", ",")} pt${Math.abs(v) >= 2 ? "s" : ""}`;

/** Points apportés par chaque composante d'un relevé historisé (mêmes règles de normalisation). */
function pointsOf(values: Partial<Record<ComponentKey, number | null>>): Record<ComponentKey, number> {
  const keys = Object.keys(SCORE_WEIGHTS) as ComponentKey[];
  const measured = keys.filter(k => values[k] != null);
  const total = measured.reduce((s, k) => s + SCORE_WEIGHTS[k], 0);
  return Object.fromEntries(keys.map(k => [k, values[k] != null && total ? (values[k] as number) * SCORE_WEIGHTS[k] / total : 0])) as Record<ComponentKey, number>;
}

export async function explainScore(campaignId: string, today: string): Promise<ScoreExplanation> {
  const { score, components } = await computeScore(campaignId, 30);
  const history = (await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, score, components FROM erep_score_history
      WHERE campaign_id = $1 AND score IS NOT NULL AND day >= ($2::date - INTERVAL '90 days') ORDER BY day`, [campaignId, today])).rows;
  const level = score === null ? { key: "none" as const, label: "Non évalué" } : (() => { const l = LEVELS.find(x => score >= x.min)!; return { key: l.key, label: l.label }; })();
  const unmeasured = components.filter(c => !c.measured).map(c => ({ key: c.key, label: c.label, basis: c.basis }));
  const topFactors = components.flatMap(c => c.factors.map(f => ({ ...f, component: c.key })))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 6);

  let previous: ScoreExplanation["previous"] = null;
  const prior = [...history].reverse().find(h => h.day < today);
  if (prior && score !== null) {
    const before = pointsOf(prior.components ?? {});
    const now = pointsOf(Object.fromEntries(components.map(c => [c.key, c.value])));
    previous = {
      day: prior.day, score: prior.score, delta: score - prior.score,
      byComponent: components.map(c => ({ key: c.key, label: c.label, delta: round1(now[c.key] - before[c.key]) })).filter(x => Math.abs(x.delta) >= 0.5)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    };
  }

  const summary: string[] = [];
  if (score === null) {
    summary.push("Aucune mesure réelle sur les 30 derniers jours : lancez une veille pour obtenir un score.");
  } else {
    const measured = components.filter(c => c.measured);
    summary.push(`${score}/100 — ${level.label.toLowerCase()}. Calcul sur ${measured.length} composante(s) mesurée(s) : ${measured.map(c => `${c.label.toLowerCase()} ${c.value}/100 (${Math.round(c.effectiveWeight * 100)} %)`).join(", ")}.`);
    const worst = topFactors.filter(f => f.impact < 0).slice(0, 3);
    if (worst.length) summary.push(`Ce qui pèse le plus : ${worst.map(f => `${f.label} (${pts(f.impact)})`).join(" ; ")}.`);
    const best = topFactors.filter(f => f.impact > 0).slice(0, 2);
    if (best.length) summary.push(`Ce qui soutient le score : ${best.map(f => `${f.label} (${pts(f.impact)})`).join(" ; ")}.`);
    if (previous) {
      summary.push(previous.delta === 0
        ? `Stable depuis le relevé du ${fmtDay(previous.day)}.`
        : `${previous.delta > 0 ? "En hausse" : "En baisse"} de ${Math.abs(previous.delta)} point(s) depuis le relevé du ${fmtDay(previous.day)}${previous.byComponent.length ? `, surtout : ${previous.byComponent.slice(0, 2).map(x => `${x.label.toLowerCase()} ${pts(x.delta)}`).join(", ")}` : ""}.`);
    } else {
      summary.push("Premier relevé : l'évolution sera affichée à partir du prochain jour de mesure.");
    }
  }
  if (unmeasured.length) summary.push(`Non mesuré${unmeasured.length > 1 ? "s" : ""} : ${unmeasured.map(u => `${u.label.toLowerCase()} (${u.basis})`).join(", ")}${score !== null ? " — leur poids est réparti sur les composantes mesurées, aucune valeur n'est supposée" : ""}.`);

  return { score, level, components, summary, topFactors, unmeasured, previous, history: history.map(h => ({ day: h.day, score: h.score })), weights: SCORE_WEIGHTS };
}
