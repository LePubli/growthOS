import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService, AIRequest } from './ai-gateway.service';

export type AgentId =
  | 'sdr-agent'
  | 'seo-agent'
  | 'copywriting-agent'
  | 'scoring-agent'
  | 'reputation-agent'
  | 'research-agent'
  | 'email-agent';

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  preferredProvider?: string;
  preferLocalFirst: boolean;
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'sdr-agent',
    name: 'SDR Agent',
    icon: '🎯',
    description: 'Rédige des emails de prospection personnalisés, analyse les profils prospects et propose des accroches commerciales percutantes.',
    preferLocalFirst: true,
    systemPrompt: `Tu es un expert en prospection B2B et développement commercial.
Tu rédiges des emails de prospection courts, personnalisés et percutants.
Tu analyses les données entreprises (secteur, taille, signaux) pour créer des messages ciblés.
Ton style : direct, professionnel, humain. Jamais de spam. Toujours orienté valeur.
Réponds UNIQUEMENT en français sauf demande explicite.`,
  },
  {
    id: 'email-agent',
    name: 'Email Agent',
    icon: '📧',
    description: 'Optimise et personnalise les séquences email. Analyse les taux d\'ouverture et propose des améliorations.',
    preferLocalFirst: true,
    systemPrompt: `Tu es un expert en email marketing B2B.
Tu optimises les objets d'emails, les corps de messages et les appels à l'action.
Tu analyses les performances des séquences email et proposes des améliorations basées sur les données.
Style : concis, percutant, conversationnel. Max 150 mots par email.`,
  },
  {
    id: 'scoring-agent',
    name: 'Scoring Agent',
    icon: '📊',
    description: 'Analyse les données prospects et calcule un score de propension d\'achat avec explications détaillées.',
    preferLocalFirst: true,
    systemPrompt: `Tu es un analyste commercial expert en qualification de leads B2B.
Tu analyses les données d'une entreprise (secteur NAF, taille, signaux, présence web) pour évaluer sa propension à acheter.
Tu retournes TOUJOURS un JSON structuré avec :
- score: number (0-100)
- category: "HOT" | "WARM" | "COLD"
- factors: array of {label, impact, reason}
- recommendations: string[]
Sois précis et data-driven.`,
  },
  {
    id: 'seo-agent',
    name: 'SEO Agent',
    icon: '🔍',
    description: 'Audite la présence web des prospects, analyse leur positionnement SEO et identifie les opportunités.',
    preferLocalFirst: false,
    systemPrompt: `Tu es un expert SEO et marketing digital.
Tu analyses la présence web des entreprises : site web, réseaux sociaux, positionnement Google, e-réputation.
Tu identifies les forces, faiblesses et opportunités.
Tu proposes des services pertinents selon les lacunes détectées.
Réponds de manière structurée avec sections claires.`,
  },
  {
    id: 'reputation-agent',
    name: 'E-Réputation Agent',
    icon: '⭐',
    description: 'Analyse la réputation en ligne des entreprises (avis, réseaux sociaux, presse) et propose des stratégies.',
    preferLocalFirst: true,
    systemPrompt: `Tu es un expert en e-réputation et gestion de l'image de marque.
Tu analyses les avis clients, la présence sur les réseaux sociaux, les mentions dans la presse.
Tu identifies les risques réputationnels et proposes des stratégies d'amélioration.
Tu restes objectif et factuel dans ton analyse.`,
  },
  {
    id: 'copywriting-agent',
    name: 'Copywriting Agent',
    icon: '✍️',
    description: 'Génère du contenu marketing de qualité : articles, posts LinkedIn, landing pages, accroches publicitaires.',
    preferLocalFirst: true,
    systemPrompt: `Tu es un copywriter expert spécialisé B2B et marketing digital.
Tu crées du contenu engageant, persuasif et orienté conversion.
Tu adaptes ton style au canal (LinkedIn, email, landing page, article de blog).
Tu optimises pour le lecteur ET pour les moteurs de recherche.
Toujours apporter de la valeur, jamais de contenu creux.`,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    icon: '🔬',
    description: 'Effectue des recherches approfondies sur les entreprises, secteurs et marchés pour qualifier les prospects.',
    preferLocalFirst: false,
    systemPrompt: `Tu es un analyste business expert.
Tu recherches et synthétises des informations sur les entreprises, secteurs d'activité et marchés.
Tu identifies les tendances, opportunités et menaces.
Tu fournis des insights actionnables pour les équipes commerciales.
Tes analyses sont structurées, sourcées et pertinentes.`,
  },
];

@Injectable()
export class AIAgentsService {
  private readonly logger = new Logger(AIAgentsService.name);

  constructor(private readonly gateway: AIGatewayService) {}

  getAgents(): AgentConfig[] {
    return AGENTS;
  }

  getAgent(id: AgentId): AgentConfig | undefined {
    return AGENTS.find(a => a.id === id);
  }

  /**
   * Exécute un agent avec un prompt utilisateur.
   */
  async runAgent(
    agentId: AgentId,
    userMessage: string,
    context?: Record<string, any>,
    tenantId?: string,
  ) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error(`Agent '${agentId}' introuvable`);

    // Construit le contexte enrichi si fourni
    let enrichedMessage = userMessage;
    if (context && Object.keys(context).length > 0) {
      enrichedMessage = `${userMessage}\n\nContexte disponible:\n${JSON.stringify(context, null, 2)}`;
    }

    const req: AIRequest = {
      systemPrompt: agent.systemPrompt,
      messages: [{ role: 'user', content: enrichedMessage }],
      maxTokens: 2048,
      temperature: 0.7,
      tenantId,
      agentId,
    };

    const provider = agent.preferLocalFirst ? undefined : 'anthropic';
    return this.gateway.complete(req, provider as any);
  }

  /**
   * Score IA d'un prospect.
   */
  async scoreProspect(prospect: {
    company_name: string;
    naf_code?: string;
    naf_label?: string;
    city?: string;
    employee_range?: string;
    website?: string;
    email?: string;
    phone?: string;
    sources_used?: string[];
  }, tenantId?: string) {
    const prompt = `Analyse ce prospect B2B et calcule son score de propension à acheter nos services marketing/digital :

Entreprise : ${prospect.company_name}
Secteur : ${prospect.naf_label || prospect.naf_code || 'Non renseigné'}
Ville : ${prospect.city || 'Non renseignée'}
Effectifs : ${prospect.employee_range || 'Non renseignés'}
Site web : ${prospect.website || 'Non renseigné'}
Email : ${prospect.email ? '✓ Disponible' : '✗ Manquant'}
Téléphone : ${prospect.phone ? '✓ Disponible' : '✗ Manquant'}
Sources : ${(prospect.sources_used || []).join(', ') || 'Non renseignées'}

Retourne UNIQUEMENT un JSON valide (pas de markdown) :`;

    const response = await this.runAgent('scoring-agent', prompt, undefined, tenantId);

    try {
      // Parse le JSON retourné
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { ...JSON.parse(jsonMatch[0]), provider: response.provider, model: response.model };
      }
    } catch {}

    // Fallback si parsing échoue
    return {
      score: 50,
      category: 'WARM',
      factors: [{ label: 'Analyse automatique', impact: 'neutral', reason: 'Score calculé par règles' }],
      recommendations: ['Enrichir les données du prospect'],
      provider: response.provider,
      model: response.model,
    };
  }

  /**
   * Génère un email de prospection personnalisé.
   */
  async generateProspectingEmail(prospect: {
    company_name: string;
    naf_label?: string;
    city?: string;
    website?: string;
  }, template: string, tenantId?: string) {
    const prompt = `Personnalise cet email de prospection pour le prospect suivant :

Entreprise : ${prospect.company_name}
Secteur : ${prospect.naf_label || 'Non renseigné'}
Ville : ${prospect.city || ''}
Site web : ${prospect.website || 'Non renseigné'}

Template à personnaliser :
---
${template}
---

Retourne UNIQUEMENT l'email personnalisé, sans introduction ni commentaire.`;

    return this.runAgent('sdr-agent', prompt, undefined, tenantId);
  }

  /**
   * Analyse SEO d'un domaine.
   */
  async analyzeSEO(domain: string, tenantId?: string) {
    const prompt = `Analyse la présence web et SEO de ce domaine/entreprise : ${domain}
    
Évalue :
1. Qualité probable du site web
2. Présence sur les réseaux sociaux
3. Référencement local probable
4. Points d'amélioration identifiables
5. Services que nous pourrions proposer

Sois concis et actionnable.`;

    return this.runAgent('seo-agent', prompt, undefined, tenantId);
  }
}
