import { pool } from "@workspace/db";
import { signalService } from "../plugin-signal-intelligence/SignalService";
import { logger } from "../logger";

/* ─── Types ─────────────────────────────────────────────── */

export interface DraftContext {
  accountId: string;
  goal: string;
  tone?: "formal" | "casual" | "friendly";
  tenantId: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
  generatedBy: "ollama" | "mock";
  model?: string;
  contextUsed: { signals: number; memories: number; account: string };
}

export interface LinkedInDraft {
  message: string;
  characterCount: number;
  generatedBy: "ollama" | "mock";
  model?: string;
  contextUsed: { signals: number; memories: number; account: string };
}

export interface SequenceStep {
  step: number;
  day: number;
  channel: "email" | "linkedin" | "call";
  subject?: string;
  body: string;
}

export interface SequenceDraft {
  name: string;
  steps: SequenceStep[];
  generatedBy: "ollama" | "mock";
  model?: string;
  contextUsed: { signals: number; memories: number; account: string };
}

export interface PromptTemplate {
  id: string;
  name: string;
  goal: string;
  tone: string;
  description: string;
  emoji: string;
}

/* ─── Prompt templates library ───────────────────────────── */

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: "meeting", name: "Prise de RDV", goal: "book a demo meeting", tone: "friendly", description: "Proposes a quick discovery call", emoji: "📅" },
  { id: "intro", name: "Introduction", goal: "introduce GrowthOS and build rapport", tone: "casual", description: "First-touch warm intro", emoji: "👋" },
  { id: "upsell", name: "Upsell client", goal: "present a new feature and upsell", tone: "formal", description: "Existing client expansion", emoji: "🚀" },
  { id: "reactivate", name: "Réactivation", goal: "re-engage a cold prospect", tone: "friendly", description: "Re-engage after 30+ days silence", emoji: "🔥" },
  { id: "event", name: "Événement", goal: "invite to an exclusive webinar or event", tone: "casual", description: "Event-based outreach", emoji: "🎯" },
];

/* ─── Ollama integration ─────────────────────────────────── */

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
  } catch (err) {
    logger.debug({ err }, "Ollama not reachable — falling back to MockLLM");
    return null;
  }
}

/* ─── Context builder ────────────────────────────────────── */

async function buildContext(ctx: DraftContext): Promise<{
  accountName: string;
  signals: Awaited<ReturnType<typeof signalService.getSignalsByAccount>>;
  memories: { content: string; category: string }[];
}> {
  // Load signals for this account
  const signals = await signalService.getSignalsByAccount(ctx.accountId, ctx.tenantId).catch(() => []);

  // Load memory snippets
  const memRes = await pool.query<{ content: string; category: string }>(
    `SELECT content, category FROM memory_entries WHERE tenant_id = $1 AND (
       LOWER(content) LIKE $2 OR account_name LIKE $2
     ) ORDER BY created_at DESC LIMIT 5`,
    [ctx.tenantId, `%${ctx.accountId.toLowerCase()}%`],
  ).catch(() => ({ rows: [] as { content: string; category: string }[] }));

  return { accountName: ctx.accountId, signals, memories: memRes.rows };
}

function buildPromptContext(
  ctx: DraftContext,
  accountName: string,
  signals: { type: string; title: string; score: number }[],
  memories: { content: string; category: string }[],
): string {
  const signalLines = signals.slice(0, 3).map(s => `- [${s.type}] ${s.title} (impact: ${s.score})`).join("\n");
  const memoryLines = memories.slice(0, 3).map(m => `- [${m.category}] ${m.content}`).join("\n");
  const tone = ctx.tone ?? "friendly";
  return `
You are an elite Sales Development Representative for GrowthOS, a CRM & AI sales platform.

TARGET ACCOUNT: ${accountName}
GOAL: ${ctx.goal}
TONE: ${tone}

RECENT SIGNALS (from Signal Intelligence):
${signalLines || "- No signals detected yet"}

MEMORY CONTEXT (from Growth Memory):
${memoryLines || "- No memory entries yet"}
`.trim();
}

/* ─── Mock LLM fallback ──────────────────────────────────── */

const SIGNAL_HOOKS: Record<string, string> = {
  funding:           "J'ai vu que {account} vient de boucler un tour de financement — félicitations ! C'est souvent le moment où les équipes commerciales passent à la vitesse supérieure.",
  hiring:            "J'ai remarqué que {account} recrute activement en ce moment, notamment des profils commerciaux. Signe clair d'une phase de croissance ambitieuse.",
  news:              "{account} fait parler d'elle dernièrement — belle visibilité. C'est justement ce contexte qui m'a poussé à vous contacter.",
  tech_change:       "J'ai vu que {account} renouvelle sa stack tech — c'est le bon moment pour évaluer de nouveaux outils.",
  leadership_change: "Avec les récents changements de direction chez {account}, c'est souvent une période de revue stratégique. Je voulais saisir cette fenêtre.",
};

function getSignalHook(signals: { type: string }[], account: string): string {
  const sig = signals[0];
  if (!sig) return `Je suis tombé sur {account} dans notre radar et je voulais prendre contact directement.`.replace("{account}", account);
  const tpl = SIGNAL_HOOKS[sig.type] ?? SIGNAL_HOOKS.news;
  return tpl.replace(/\{account\}/g, account);
}

function goalCTA(goal: string): string {
  const lower = goal.toLowerCase();
  if (lower.includes("meeting") || lower.includes("rdv") || lower.includes("démo")) return "Auriez-vous 20 minutes cette semaine pour un échange rapide ?";
  if (lower.includes("upsell") || lower.includes("feature")) return "Pouvons-nous planifier une démo de la nouvelle fonctionnalité ?";
  if (lower.includes("event") || lower.includes("webinar")) return "Je vous réserve une place — dites-moi si vous êtes disponible.";
  if (lower.includes("reactivat") || lower.includes("re-engag")) return "Je voulais reprendre contact et voir si la situation a évolué de votre côté.";
  return "Seriez-vous ouvert à un échange de 15 minutes ?";
}

function mockEmail(account: string, goal: string, tone: string, signals: { type: string; title: string }[], memories: { content: string }[]): EmailDraft {
  const hook = getSignalHook(signals, account);
  const cta  = goalCTA(goal);
  const memCtx = memories[0] ? `\n\nEn remontant notre historique, je vois que ${memories[0].content.slice(0, 100)}…` : "";

  const bodies: Record<string, string> = {
    formal: `Madame, Monsieur,

${hook}

Dans ce contexte, GrowthOS pourrait vous apporter une valeur significative : notre plateforme CRM + IA aide les équipes commerciales à identifier les bons comptes au bon moment, grâce à une intelligence contextuelle en temps réel.${memCtx}

Objectif : ${goal}.

${cta}

Cordialement,
[Votre nom]
GrowthOS | Sales Intelligence Platform`,

    casual: `Salut,

${hook}

Je voulais vous contacter directement car je pense que GrowthOS peut vraiment vous aider à accélérer votre croissance en ce moment.${memCtx}

En 2 mots : on aide des équipes comme la vôtre à ${goal} grâce à notre CRM IA.

${cta}

À très vite,
[Votre nom]`,

    friendly: `Bonjour,

${hook}

Je voulais prendre quelques secondes pour me présenter — je m'appelle [Nom] et je travaille chez GrowthOS, une plateforme CRM + IA pensée pour les équipes commerciales en hypercroissance.${memCtx}

Ce qui nous distingue ? Notre moteur de Signal Intelligence détecte exactement les bons moments pour contacter les bons comptes — comme maintenant avec ${account}.

${cta}

Belle journée,
[Votre nom]`,
  };

  return {
    subject: `${account} × GrowthOS — ${goal.slice(0, 40)}`,
    body: bodies[tone] ?? bodies.friendly,
    tone,
    generatedBy: "mock",
    contextUsed: { signals: signals.length, memories: memories.length, account },
  };
}

function mockLinkedIn(account: string, goal: string, tone: string, signals: { type: string }[], memories: { content: string }[]): LinkedInDraft {
  const hook = getSignalHook(signals, account);
  const cta  = goalCTA(goal);

  const msgs: Record<string, string> = {
    formal: `Bonjour, j'ai suivi avec attention le développement de ${account}. ${hook} Je pense que GrowthOS peut vous aider à ${goal}. ${cta}`,
    casual: `Bonjour ! ${hook} On aide des équipes comme la vôtre à ${goal}. ${cta}`,
    friendly: `Bonjour ! ${hook} On travaille avec des équipes similaires à ${account} pour ${goal}. ${cta}`,
  };

  const message = (msgs[tone] ?? msgs.friendly).slice(0, 300);
  return {
    message,
    characterCount: message.length,
    generatedBy: "mock",
    contextUsed: { signals: signals.length, memories: memories.length, account },
  };
}

function mockSequence(account: string, goal: string, signals: { type: string; title: string }[], memories: { content: string }[]): SequenceDraft {
  const hook = getSignalHook(signals, account);
  const cta  = goalCTA(goal);

  return {
    name: `Séquence ${account} — ${goal.slice(0, 30)}`,
    steps: [
      {
        step: 1, day: 0, channel: "email",
        subject: `${account} × GrowthOS — Question rapide`,
        body: `Bonjour,\n\n${hook}\n\nJe voulais simplement savoir si ${goal} est actuellement une priorité pour votre équipe.\n\n${cta}\n\nCordialement,\n[Votre nom]`,
      },
      {
        step: 2, day: 3, channel: "linkedin",
        body: `Bonjour, j'ai envoyé un email il y a quelques jours concernant ${account}. Je voulais prendre contact ici aussi — ${goal}. ${cta}`,
      },
      {
        step: 3, day: 7, channel: "email",
        subject: `Re: ${account} × GrowthOS — Dernière tentative`,
        body: `Bonjour,\n\nJe me permets de relancer une dernière fois. Notre radar Signal Intelligence a détecté ${signals[0]?.title ?? "des signaux positifs"} chez ${account} — c'est exactement le contexte où GrowthOS crée le plus de valeur.\n\nSi maintenant n'est pas le bon moment, pas de souci — je reste disponible.\n\nBonne journée,\n[Votre nom]`,
      },
    ],
    generatedBy: "mock",
    contextUsed: { signals: signals.length, memories: memories.length, account },
  };
}

/* ─── Service ────────────────────────────────────────────── */

class AISDRService {
  async draftEmail(ctx: DraftContext): Promise<EmailDraft> {
    const { accountName, signals, memories } = await buildContext(ctx);
    const tone = ctx.tone ?? "friendly";

    const promptCtx = buildPromptContext(ctx, accountName, signals, memories);
    const prompt = `${promptCtx}

Write a ${tone} cold outreach EMAIL in French to achieve the goal: "${ctx.goal}".
Return a JSON object with keys: subject (string), body (string), tone (string).
Return ONLY valid JSON, no markdown, no explanation.`;

    const raw = await ollamaGenerate(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { subject?: string; body?: string; tone?: string };
        if (parsed.subject && parsed.body) {
          return {
            subject: parsed.subject,
            body: parsed.body,
            tone: parsed.tone ?? tone,
            generatedBy: "ollama",
            model: OLLAMA_MODEL,
            contextUsed: { signals: signals.length, memories: memories.length, account: accountName },
          };
        }
      } catch {
        logger.warn({ raw }, "Failed to parse Ollama JSON, falling back to mock");
      }
    }

    return mockEmail(accountName, ctx.goal, tone, signals, memories);
  }

  async draftLinkedInMessage(ctx: DraftContext): Promise<LinkedInDraft> {
    const { accountName, signals, memories } = await buildContext(ctx);
    const tone = ctx.tone ?? "casual";

    const promptCtx = buildPromptContext(ctx, accountName, signals, memories);
    const prompt = `${promptCtx}

Write a SHORT ${tone} LinkedIn connection message in French (max 300 characters) to achieve: "${ctx.goal}".
Return a JSON object with key: message (string).
Return ONLY valid JSON, no markdown.`;

    const raw = await ollamaGenerate(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { message?: string };
        if (parsed.message) {
          const msg = parsed.message.slice(0, 300);
          return {
            message: msg,
            characterCount: msg.length,
            generatedBy: "ollama",
            model: OLLAMA_MODEL,
            contextUsed: { signals: signals.length, memories: memories.length, account: accountName },
          };
        }
      } catch {
        logger.warn({ raw }, "Failed to parse Ollama JSON, falling back to mock");
      }
    }

    return mockLinkedIn(accountName, ctx.goal, tone, signals, memories);
  }

  async generateSequence(ctx: DraftContext): Promise<SequenceDraft> {
    const { accountName, signals, memories } = await buildContext(ctx);

    const promptCtx = buildPromptContext(ctx, accountName, signals, memories);
    const prompt = `${promptCtx}

Create a 3-step outreach SEQUENCE in French (email → linkedin → email) to achieve: "${ctx.goal}".
Return a JSON object with:
- name: string
- steps: array of {step, day, channel, subject?, body}
Return ONLY valid JSON.`;

    const raw = await ollamaGenerate(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { name?: string; steps?: SequenceStep[] };
        if (parsed.name && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return {
            name: parsed.name,
            steps: parsed.steps,
            generatedBy: "ollama",
            model: OLLAMA_MODEL,
            contextUsed: { signals: signals.length, memories: memories.length, account: accountName },
          };
        }
      } catch {
        logger.warn({ raw }, "Failed to parse Ollama sequence JSON, falling back to mock");
      }
    }

    return mockSequence(accountName, ctx.goal, signals, memories);
  }

  getTemplates(): PromptTemplate[] {
    return PROMPT_TEMPLATES;
  }

  async checkOllamaStatus(): Promise<{ available: boolean; model: string; baseUrl: string }> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return { available: res.ok, model: OLLAMA_MODEL, baseUrl: OLLAMA_BASE_URL };
    } catch {
      return { available: false, model: OLLAMA_MODEL, baseUrl: OLLAMA_BASE_URL };
    }
  }
}


export interface PlaybookDraft {
  accountName: string;
  talkingPoints: string[];
  objections: { objection: string; response: string }[];
  competitorNotes: string;
  nextSteps: string[];
  generatedBy: "ollama" | "mock";
  model?: string;
  contextUsed: { signals: number; memories: number; account: string };
}

const PLAYBOOK_TALKING_POINTS: Record<string, string[]> = {
  funding: [
    "Félicitez pour le financement et montrez que vous suivez leur actualité",
    "Questionnez sur les objectifs de croissance post-levée (recrutement, nouveaux marchés)",
    "Montrez comment GrowthOS accélère le time-to-revenue pour les équipes en expansion",
  ],
  hiring: [
    "Reliez le recrutement commercial à leur besoin d'outillage SDR",
    "Parlez de l'onboarding accéléré grâce à l'IA (réduction du ramp time de 40%)",
    "Proposez un POC avant la prise de poste des nouvelles recrues",
  ],
  tech_change: [
    "Profitez du changement de stack pour positionner GrowthOS comme complément naturel",
    "Évoquez l'intégration native avec leur nouveau CRM",
    "Proposez une démo personnalisée avec leur stack actuelle",
  ],
  news: [
    "Commencez par féliciter/mentionner l'actualité récente pour créer un lien personnel",
    "Reliez leur croissance à un besoin de structuration commerciale",
    "Parlez de clients similaires (profil, stade) qui ont accéléré avec GrowthOS",
  ],
  leadership_change: [
    "Adressez-vous au nouveau décideur directement — fenêtre d'opportunité courte",
    "Proposez un audit gratuit de la stack commerciale actuelle",
    "Parlez de ROI et de quick wins dans les 90 premiers jours",
  ],
};

const COMMON_OBJECTIONS = [
  {
    objection: "On est déjà équipés avec un CRM",
    response: "GrowthOS ne remplace pas votre CRM — il se connecte dessus et ajoute la couche d'intelligence IA qui transforme les données en actions. L'intégration prend moins de 2h.",
  },
  {
    objection: "Ce n'est pas le bon moment, on est en pleine réorganisation",
    response: "C'est précisément le meilleur moment — les réorganisations créent une fenêtre pour adopter de nouveaux outils sans résistance au changement. On peut démarrer sur un scope réduit.",
  },
  {
    objection: "Votre solution est trop chère",
    response: "Nos clients récupèrent en moyenne 4h de travail SDR par semaine et augmentent le taux de réponse de 35%. Sur 5 commerciaux, le ROI est positif dès le 2ème mois.",
  },
  {
    objection: "On manque de temps pour mettre ça en place",
    response: "L'onboarding se fait en 1 session de 45 min. Après ça, l'IA travaille en arrière-plan — aucune saisie supplémentaire n'est requise de votre équipe.",
  },
];

function mockPlaybook(
  account: string,
  signals: { type: string; title: string }[],
  memories: { content: string }[],
): PlaybookDraft {
  const topSignalType = (signals[0]?.type ?? "news") as keyof typeof PLAYBOOK_TALKING_POINTS;
  const talkingPoints = PLAYBOOK_TALKING_POINTS[topSignalType] ?? PLAYBOOK_TALKING_POINTS.news;

  const nextSteps = [
    `Envoyer un premier email de prise de contact personnalisé via AI SDR → mentionner "${signals[0]?.title?.slice(0, 40) ?? "leur actualité récente"}"`,
    `Planifier un appel de découverte de 20 min cette semaine — utiliser Calendar pour proposer un slot`,
    `Préparer une démonstration personnalisée avec les cas clients similaires à ${account}`,
    memories[0] ? `S'appuyer sur le contexte mémoire : "${memories[0].content.slice(0, 60)}…"` : `Enrichir le compte dans Growth Memory avant le prochain contact`,
  ];

  return {
    accountName: account,
    talkingPoints,
    objections: COMMON_OBJECTIONS,
    competitorNotes: `Pour ${account}, les alternatives probables sont HubSpot Sales Hub, Salesforce Sales Cloud, ou Pipedrive. Différenciateur clé de GrowthOS : Signal Intelligence temps réel + AI SDR natif + plugin runtime extensible — vs. intégrations tierces coûteuses chez les concurrents.`,
    nextSteps,
    generatedBy: "mock",
    contextUsed: { signals: signals.length, memories: memories.length, account },
  };
}

export const aiSDRService = new AISDRService();

// Standalone export for playbook (kept outside class for tree-shaking)
export async function generatePlaybook(ctx: DraftContext): Promise<PlaybookDraft> {
  const { accountName, signals, memories } = await buildContext(ctx);

  const promptCtx = buildPromptContext(ctx, accountName, signals, memories);
  const prompt = `${promptCtx}

Generate a Sales Playbook in French for account "${accountName}".
Return a JSON object with:
- talkingPoints: string[] (4 points)
- objections: array of {objection: string, response: string} (3 objections)
- competitorNotes: string (competitive intel paragraph)
- nextSteps: string[] (4 action items)
Return ONLY valid JSON, no markdown.`;

  const raw = await ollamaGenerate(prompt);
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<PlaybookDraft>;
      if (p.talkingPoints && p.objections && p.nextSteps) {
        return {
          accountName,
          talkingPoints: p.talkingPoints,
          objections: p.objections,
          competitorNotes: p.competitorNotes ?? "",
          nextSteps: p.nextSteps,
          generatedBy: "ollama",
          model: OLLAMA_MODEL,
          contextUsed: { signals: signals.length, memories: memories.length, account: accountName },
        };
      }
    } catch { /* fall through */ }
  }

  return mockPlaybook(accountName, signals, memories);
}
