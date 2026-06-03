/**
 * Realistic data seeder for GrowthOS — French B2B context.
 * Run with: pnpm seed:realistic
 *
 * Creates:
 *  - 1 tenant + 2 users
 *  - 5 French B2B accounts (via prospects)
 *  - 8 realistic contacts
 *  - 4 deals in different pipeline stages
 *  - 3 completed meetings with rich transcripts
 *  - 5 realistic signals
 *  - 20 memory documents (emails, notes, call reports)
 *  - 5 knowledge articles indexed in memory
 */

import { pool } from "@workspace/db";

/* ─── Helpers ──────────────────────────────────────────────── */
async function upsertTenant(slug: string, name: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = $1`, [slug],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`, [name, slug],
  );
  return res.rows[0].id;
}

async function upsertUser(email: string, password_hash: string, first_name: string, last_name: string, role: string, tenant_id: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`, [email],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [email, password_hash, first_name, last_name, role, tenant_id],
  );
  return res.rows[0].id;
}

/* ─── Main seeder ──────────────────────────────────────────── */
async function seed() {
  console.log("🌱 Starting realistic data seeder...");

  const tenantId = await upsertTenant("growthos-demo", "GrowthOS Demo");
  console.log(`✅ Tenant: ${tenantId}`);

  const adminId = await upsertUser(
    "admin@growthos.fr",
    "$2b$10$demohashedpassword123456789012",
    "Sophie", "Martin", "admin", tenantId,
  );
  const userId2 = await upsertUser(
    "pierre.dubois@growthos.fr",
    "$2b$10$demohashedpassword123456789012",
    "Pierre", "Dubois", "member", tenantId,
  );
  console.log(`✅ Users: ${adminId}, ${userId2}`);

  /* ── Prospects / Contacts ── */
  const prospects = [
    { first_name: "Jean", last_name: "Dupont",       email: "jdupont@techcorp.fr",        company: "TechCorp",       job_title: "VP Sales",             score: 88 },
    { first_name: "Marie", last_name: "Laurent",     email: "mlaurent@agrisolutions.fr",  company: "AgriSolutions",  job_title: "Directrice Générale",  score: 72 },
    { first_name: "Paul", last_name: "Bertrand",     email: "pbertrand@finaxio.fr",       company: "Finaxio",        job_title: "CFO",                  score: 65 },
    { first_name: "Emma", last_name: "Leroy",        email: "eleroy@medianova.fr",        company: "MediaNova",      job_title: "CMO",                  score: 91 },
    { first_name: "Lucas", last_name: "Moreau",      email: "lmoreau@industrialfab.fr",   company: "IndustrialFab",  job_title: "CEO",                  score: 54 },
    { first_name: "Camille", last_name: "Petit",     email: "cpetit@techcorp.fr",         company: "TechCorp",       job_title: "Head of Marketing",    score: 77 },
    { first_name: "Antoine", last_name: "Roux",      email: "aroux@agrisolutions.fr",     company: "AgriSolutions",  job_title: "VP Operations",        score: 60 },
    { first_name: "Isabelle", last_name: "Simon",    email: "isimon@finaxio.fr",          company: "Finaxio",        job_title: "Sales Director",       score: 83 },
  ];

  const prospectIds: Record<string, string> = {};
  for (const p of prospects) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM prospects WHERE email = $1 AND tenant_id = $2`, [p.email, tenantId],
    );
    if (existing.rows[0]) {
      prospectIds[p.email] = existing.rows[0].id;
      continue;
    }
    const res = await pool.query<{ id: string }>(
      `INSERT INTO prospects (first_name, last_name, email, company, job_title, score, status, tenant_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'qualified',$7,$8) RETURNING id`,
      [p.first_name, p.last_name, p.email, p.company, p.job_title, p.score, tenantId, adminId],
    );
    prospectIds[p.email] = res.rows[0].id;
  }
  console.log(`✅ Prospects: ${Object.keys(prospectIds).length} créés/existants`);

  /* ── Deals ── */
  const deals = [
    {
      title: "TechCorp — Licence Enterprise",
      company: "TechCorp",
      value: 48000,
      stage: "negotiation",
      probability: 70,
      close_date: "2026-07-15",
      prospect: "Jean Dupont",
      health_score: 72,
      risk_factors: JSON.stringify([
        { code: "stalled", label: "Deal bloqué depuis 3 semaines", severity: "high" },
        { code: "no_champion", label: "Pas de champion interne identifié", severity: "medium" },
      ]),
      ai_recommendations: "Organiser une réunion ROI avec le CFO. Proposer un pilote de 30 jours gratuit pour accélérer la décision.",
    },
    {
      title: "MediaNova — Pack Growth",
      company: "MediaNova",
      value: 22500,
      stage: "proposal",
      probability: 55,
      close_date: "2026-06-30",
      prospect: "Emma Leroy",
      health_score: 85,
      risk_factors: JSON.stringify([]),
      ai_recommendations: "Deal sain. Préparer la proposition commerciale avec un focus sur les métriques SEO et la génération de leads.",
    },
    {
      title: "Finaxio — Intégration CRM",
      company: "Finaxio",
      value: 15000,
      stage: "qualification",
      probability: 35,
      close_date: "2026-08-01",
      prospect: "Paul Bertrand",
      health_score: 48,
      risk_factors: JSON.stringify([
        { code: "budget_unclear", label: "Budget non confirmé", severity: "high" },
        { code: "multiple_stakeholders", label: "5 décideurs impliqués", severity: "medium" },
        { code: "competitor_present", label: "HubSpot en compétition", severity: "high" },
      ]),
      ai_recommendations: "Identifier le vrai décideur. Organiser une démo technique pour le CTO. Préparer une battle card vs HubSpot.",
    },
    {
      title: "AgriSolutions — Suite Premium",
      company: "AgriSolutions",
      value: 34000,
      stage: "closed_won",
      probability: 100,
      close_date: "2026-05-28",
      prospect: "Marie Laurent",
      health_score: 95,
      risk_factors: JSON.stringify([]),
      ai_recommendations: "Deal gagné ! Planifier l'onboarding et identifier les opportunités d'upsell.",
    },
  ];

  for (const d of deals) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM deals WHERE title = $1 AND tenant_id = $2`, [d.title, tenantId],
    );
    if (existing.rows[0]) continue;
    await pool.query(
      `INSERT INTO deals (title, company, value, stage, probability, close_date, prospect, tenant_id, created_by, health_score, risk_factors, ai_recommendations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
      [d.title, d.company, d.value, d.stage, d.probability, d.close_date, d.prospect, tenantId, adminId, d.health_score, d.risk_factors, d.ai_recommendations],
    );
  }
  console.log(`✅ Deals: ${deals.length} créés`);

  /* ── Meetings ── */
  const meetings = [
    {
      title: "Démo TechCorp — Qualification approfondie",
      status: "completed",
      transcript: `Jean Dupont (VP Sales TechCorp) : Merci de vous connecter. On a regardé votre solution et ça semble correspondre à certains de nos besoins.

Sophie Martin (GrowthOS) : Parfait, Jean. Pouvez-vous me parler de vos défis actuels en matière de prospection ?

Jean Dupont : On a une équipe de 12 commerciaux. Le problème principal, c'est qu'ils passent 60% de leur temps à des tâches administratives — mise à jour CRM, recherche d'infos sur les prospects, rédaction d'emails. On perd énormément de temps.

Sophie Martin : Je comprends. Quel est votre objectif de croissance pour cette année ?

Jean Dupont : On vise +40% de CA. On est à 2,3M€ et on vise 3,2M€. C'est ambitieux, mais réalisable si on optimise.

Sophie Martin : Et côté budget, vous avez une enveloppe allouée à des outils de sales intelligence ?

Jean Dupont : Oui, on a prévu entre 40 000 et 60 000€ pour cette année. Mais il faudra justifier l'investissement auprès du CFO.

Sophie Martin : Très bien. Quelles sont vos principales objections ou points d'interrogation sur GrowthOS ?

Jean Dupont : La principale question, c'est le temps d'intégration avec notre Salesforce existant. Et la courbe d'apprentissage pour nos commerciaux.

Sophie Martin : On a une intégration Salesforce native en 48h. Et la formation complète prend 2 heures.

Jean Dupont : Ça répond à mes questions. Je vais en parler à Camille (Head of Marketing) et au CFO. On peut planifier une démo technique la semaine prochaine ?

Prochaines étapes :
- Démo technique avec l'équipe IT — 10 juin
- Présentation ROI au CFO — 17 juin
- Décision finale attendue — 30 juin`,
      summary: "Jean Dupont (VP Sales TechCorp) très intéressé. Budget confirmé : 40-60k€. Objection principale : intégration Salesforce (résolue). Prochaines étapes : démo technique + présentation ROI au CFO. Probabilité de close : 70%.",
      action_items: JSON.stringify([
        { text: "Planifier démo technique avec l'IT TechCorp", done: false, owner: "Sophie Martin" },
        { text: "Préparer présentation ROI personnalisée pour le CFO", done: false, owner: "Sophie Martin" },
        { text: "Envoyer synthèse de la réunion à Jean Dupont", done: true, owner: "Sophie Martin" },
      ]),
    },
    {
      title: "Premier contact — Finaxio",
      status: "completed",
      transcript: `Paul Bertrand (CFO Finaxio) : Bonjour Sophie. Je n'ai que 30 minutes. Qu'est-ce que vous avez à nous proposer ?

Sophie Martin : Bonjour Paul. En 30 minutes, je vais vous montrer comment GrowthOS peut vous aider à identifier des opportunités cachées dans votre pipeline commercial.

Paul Bertrand : Notre vraie problématique, c'est qu'on a 5 commerciaux et zéro visibilité sur ce qui se passe dans leurs deals. Je découvre les mauvaises nouvelles le dernier jour du trimestre.

Sophie Martin : C'est exactement le problème que résout notre Deal Coach IA. Il analyse chaque deal en temps réel et vous alerte dès qu'un risque apparaît.

Paul Bertrand : Intéressant. Et côté prix ?

Sophie Martin : Pour une équipe de 5, on est autour de 15 000€/an. 

Paul Bertrand : C'est dans notre budget théorique, mais je dois consulter les autres parties prenantes. On a 5 personnes qui ont leur mot à dire : moi, le CEO, le VP Sales, le CTO et la RH.

Sophie Martin : Je comprends. Je peux vous préparer un dossier de présentation pour faciliter la décision collective ?

Paul Bertrand : Oui, envoyez-moi ça. Et sachez qu'HubSpot nous a aussi fait une proposition.

Sophie Martin : Parfait, je vais vous préparer une comparaison détaillée.

Note : Budget non formellement validé. 5 décideurs. HubSpot en compétition. Deal fragile.`,
      summary: "Paul Bertrand (CFO Finaxio) intéressé mais prudent. Budget théorique confirmé ~15k€ mais 5 décideurs impliqués et HubSpot en compétition. Deal à risque. Priorité : préparer battle card vs HubSpot et identifier champion interne.",
      action_items: JSON.stringify([
        { text: "Envoyer dossier comparatif GrowthOS vs HubSpot", done: false, owner: "Pierre Dubois" },
        { text: "Identifier le champion interne chez Finaxio", done: false, owner: "Sophie Martin" },
        { text: "Planifier démo pour le CEO", done: false, owner: "Pierre Dubois" },
      ]),
    },
    {
      title: "Closing call — AgriSolutions",
      status: "completed",
      transcript: `Marie Laurent (DG AgriSolutions) : Sophie, on a pris notre décision. On part avec GrowthOS.

Sophie Martin : Marie, c'est une excellente nouvelle ! Qu'est-ce qui a fait la différence dans votre choix ?

Marie Laurent : Plusieurs choses. D'abord, votre IA SDR — on a testé en beta et en 2 semaines, on a généré 3 meetings qualifiés qu'on n'aurait jamais eu autrement. Ensuite, le Deal Coach — il a identifié un risque sur notre plus gros deal qu'on n'avait pas vu. On a pu réagir à temps.

Sophie Martin : Et l'équipe a bien adopté la solution ?

Marie Laurent : Antoine (VP Ops) était sceptique au départ, mais maintenant il est converti. Il dit que c'est l'outil le plus utile qu'il ait jamais utilisé.

Sophie Martin : Super. Pour la mise en place, on peut démarrer l'onboarding dès lundi ?

Marie Laurent : Oui, parfait. On a aussi un besoin d'intégration avec notre ERP SAP. C'est prévu dans la roadmap ?

Sophie Martin : Oui, l'intégration SAP est disponible dès maintenant. Je vais vous mettre en contact avec notre équipe technique.

Marie Laurent : Parfait. Et une dernière chose — on a 3 filiales en Belgique qui pourraient être intéressées. On pourrait en parler lors du bilan à 3 mois ?

Sophie Martin : Absolument, ça sera noté dans notre agenda.

Résultat : Deal GAGNÉ — 34 000€ — Contrat 2 ans. Opportunité upsell filiales Belgique (potentiel +25k€).`,
      summary: "Deal GAGNÉ avec AgriSolutions — 34 000€ (contrat 2 ans). Facteurs clés : test beta AI SDR (3 meetings générés en 2 semaines) + Deal Coach (risque identifié à temps). Upsell potentiel : 3 filiales en Belgique (25k€). Onboarding lundi.",
      action_items: JSON.stringify([
        { text: "Envoyer contrat signé à Marie Laurent", done: true, owner: "Sophie Martin" },
        { text: "Planifier session onboarding lundi 9h", done: true, owner: "Pierre Dubois" },
        { text: "Mettre en contact équipe technique pour intégration SAP", done: false, owner: "Sophie Martin" },
        { text: "Agenda bilan 3 mois + discussion filiales Belgique", done: false, owner: "Sophie Martin" },
      ]),
    },
  ];

  for (const m of meetings) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM meetings WHERE title = $1 AND tenant_id = $2`, [m.title, tenantId],
    );
    if (existing.rows[0]) continue;
    await pool.query(
      `INSERT INTO meetings (title, status, transcript, summary, action_items, tenant_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [m.title, m.status, m.transcript, m.summary, m.action_items, tenantId],
    );
  }
  console.log(`✅ Meetings: ${meetings.length} créés`);

  /* ── Signals ── */
  const signals = [
    { type: "funding", company: "TechCorp", title: "TechCorp lève 8M€ en Série B pour accélérer son expansion européenne", description: "La fintech TechCorp annonce une levée de fonds de 8M€ menée par Partech. L'objectif : doubler l'équipe commerciale et ouvrir 3 nouveaux marchés en Europe.", score: 95 },
    { type: "hiring", company: "MediaNova", title: "MediaNova recrute un VP Sales — signal d'expansion commerciale fort", description: "MediaNova publie une offre pour un VP Sales avec 10+ ans d'expérience et un objectif de structurer une équipe de 20 commerciaux d'ici fin 2026.", score: 87 },
    { type: "news", company: "AgriSolutions", title: "AgriSolutions remporte l'appel d'offres du Ministère de l'Agriculture (2,3M€)", description: "AgriSolutions a été sélectionnée pour déployer sa plateforme de gestion agronomique dans 1200 exploitations françaises. Contrat sur 3 ans.", score: 78 },
    { type: "expansion", company: "Finaxio", title: "Finaxio ouvre un bureau à Barcelone et recrute 15 profils tech", description: "La fintech nantaise Finaxio confirme son expansion internationale avec l'ouverture d'un bureau espagnol et une levée de 3,5M€ en seed.", score: 71 },
    { type: "news", company: "IndustrialFab", title: "IndustrialFab signe un partenariat avec Siemens pour l'industrie 4.0", description: "IndustrialFab et Siemens s'associent pour déployer des solutions IoT industrielles dans les usines françaises. Potentiel de 50M€ sur 5 ans.", score: 64 },
  ];

  for (const s of signals) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM signals WHERE title = $1 AND tenant_id = $2`, [s.title, tenantId],
    );
    if (existing.rows[0]) continue;
    await pool.query(
      `INSERT INTO signals (type, company, title, description, score, tenant_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'new')`,
      [s.type, s.company, s.title, s.description, s.score, tenantId],
    );
  }
  console.log(`✅ Signals: ${signals.length} créés`);

  /* ── Memory Documents ── */
  const memoryDocs = [
    { sourceType: "email", sourceId: "email-001", content: "Objet: Re: Démo GrowthOS — suivi\n\nBonjour Sophie,\n\nMerci pour la présentation de vendredi. J'ai discuté avec Jean Dupont et nous sommes très intéressés par le module AI SDR. Notre budget serait en ordre pour Q3. Je vous propose qu'on planifie une session technique avec notre équipe IT la semaine du 9 juin.\n\nBien cordialement,\nCamille Petit\nHead of Marketing, TechCorp", metadata: { company: "TechCorp", type: "inbound_email" } },
    { sourceType: "call_note", sourceId: "call-001", content: "Appel 15 mai — Paul Bertrand (CFO Finaxio)\n\nDurée : 32 min\nPoints clés :\n- Budget théorique confirmé ~15k€/an mais doit passer en comité\n- 5 décideurs : CFO, CEO, VP Sales, CTO, DRH\n- HubSpot a déjà fait une démo — prix agressif mais fonctionnalités limitées\n- Principale objection : courbe d'apprentissage pour l'équipe\n- Prochaine étape : démo CEO + dossier comparatif\n- Date limite de décision : fin juillet 2026", metadata: { company: "Finaxio", type: "call_note" } },
    { sourceType: "email", sourceId: "email-002", content: "Objet: Opportunité GrowthOS — MediaNova\n\nBonjour Sophie,\n\nSuite à notre échange lors du SaaStr Paris, je reviens vers vous. Nous cherchons une solution pour automatiser notre prospection B2B. Notre équipe de 8 commerciaux génère actuellement 40 leads/mois. Notre objectif est d'atteindre 150 leads qualifiés avec le même effectif.\n\nNous aurions également un besoin spécifique sur l'Account Intelligence pour nos comptes stratégiques dans les médias et l'entertainment.\n\nDisponible pour une démo jeudi prochain ?\n\nEmma Leroy\nCMO, MediaNova", metadata: { company: "MediaNova", type: "inbound_email" } },
    { sourceType: "call_note", sourceId: "call-002", content: "Appel découverte — Lucas Moreau (CEO IndustrialFab)\n\nDurée : 18 min\nNotes :\n- Secteur industriel, 280 employés, CA 45M€\n- Équipe commerciale de 4 personnes uniquement\n- Problème principal : manque de visibilité sur le pipeline\n- Budget très contraint pour 2026 (investissement prioritaire en machines CNC)\n- Intéressé par une démo mais pas de budget prévu avant 2027\n- À relancer en octobre 2026 pour budget 2027\nStatut : prospect froid — nurturing long terme", metadata: { company: "IndustrialFab", type: "call_note" } },
    { sourceType: "meeting_note", sourceId: "meeting-note-001", content: "Réunion interne — Revue pipeline Q2\n\nParticipants : Sophie Martin, Pierre Dubois\nDate : 28 mai 2026\n\nRésumé pipeline :\n- TechCorp (48k€) : 70% de probabilité, decision Q3. RDV technique confirmé 10 juin.\n- MediaNova (22,5k€) : 55%, proposal en cours. Emma très enthousiaste.\n- Finaxio (15k€) : deal fragile. 5 stakeholders + HubSpot en concurrence. Besoin d'un champion.\n- AgriSolutions (34k€) : GAGNÉ — contrat signé. Onboarding en cours.\n\nForecast Q3 : 68 500€ en weighted revenue.\nForecast Q4 objectif : 95 000€.", metadata: { type: "internal_meeting" } },
    { sourceType: "email", sourceId: "email-003", content: "Objet: Retour sur la POC — TechCorp\n\nBonjour Sophie,\n\nJ'ai discuté avec Jean après la démonstration. Voici nos retours :\n\n1. L'AI SDR est impressionnante — en mode test, elle a généré 3 emails personnalisés en 30 secondes qui semblent réellement écrits par un humain.\n2. Le Deal Coach nous a montré un signal d'alarme sur un de nos deals que notre commercial n'avait pas vu.\n3. Question : est-ce que l'intégration avec Salesforce inclut la synchronisation bidirectionnelle des notes ?\n\nNous souhaitons avancer. Jean vous contactera pour la suite.\n\nCamille", metadata: { company: "TechCorp", type: "inbound_email" } },
    { sourceType: "competitor_intel", sourceId: "comp-001", content: "Intelligence concurrentielle — HubSpot Sales Hub\n\nPoints forts HubSpot vs GrowthOS :\n- Prix : HubSpot ~8k€/an vs GrowthOS ~15k€/an pour 5 utilisateurs\n- Notoriété : HubSpot bien connu des directeurs marketing\n- Intégrations : écosystème plus large (600+ intégrations)\n\nFaiblesses HubSpot par rapport à GrowthOS :\n- Pas d'IA native pour coaching deal en temps réel\n- Pas de signal intelligence intégré\n- La qualité de personnalisation des emails est générique\n- Pas de Growth Memory / second cerveau commercial\n\nArguments de différenciation à utiliser :\n1. ROI démontrable en 30 jours vs configuration HubSpot 3-6 mois\n2. IA native vs add-ons HubSpot payants\n3. Support humain dédié vs support email uniquement", metadata: { type: "competitor_intel", competitor: "HubSpot" } },
    { sourceType: "email", sourceId: "email-004", content: "Objet: Proposition commerciale — Finaxio\n\nMonsieur Bertrand,\n\nSuite à notre échange téléphonique, je vous adresse notre proposition commerciale.\n\nOffre GrowthOS — Pack Intelligence Commerciale\n• 5 utilisateurs commerciaux\n• AI SDR + Deal Coach + Revenue Intelligence\n• Intégration CRM sur mesure\n• Formation 4h + support dédié 12 mois\n\nInvestissement : 15 000€ HT/an (1 250€/mois)\nROI estimé : +35% de deals closés en 6 mois\n\nNote : Cette offre inclut une période d'essai gratuite de 30 jours sans engagement.\n\nJe reste disponible pour répondre à vos questions et organiser une présentation pour votre comité de direction.\n\nCordialement,\nPierre Dubois\nAccount Executive, GrowthOS", metadata: { company: "Finaxio", type: "outbound_email" } },
    { sourceType: "call_note", sourceId: "call-003", content: "Appel de suivi — Emma Leroy (CMO MediaNova)\n\nDurée : 25 min\nNotes :\n- Emma a partagé la démo avec son équipe — retour très positif\n- Budget : 20-25k€ disponible immédiatement (n'attend pas Q3)\n- Besoin urgent : lancement campagne ABM septembre 2026\n- Décision possible avant fin juin si on peut démontrer l'impact sur leur segment 'media & entertainment'\n- Intéressée par un accès test 2 semaines avec 2 commerciaux\n- Point d'attention : confidentialité des données clients (ils gèrent des célébrités)\nAction : Envoyer accord de confidentialité + accès sandbox", metadata: { company: "MediaNova", type: "call_note" } },
    { sourceType: "email", sourceId: "email-005", content: "Objet: Deal gagné — AgriSolutions — Notes d'onboarding\n\nÀ : Équipe GrowthOS\n\nBonne nouvelle ! AgriSolutions a signé pour 34k€/2 ans.\n\nNotes pour l'onboarding :\n- Marie Laurent (DG) est notre champion. Antoine Roux (VP Ops) était sceptique mais converti.\n- Intégration SAP requise — voir avec l'équipe tech\n- Formation souhaitée : 3 sessions × 2h pour les 6 commerciaux\n- Cas d'usage prioritaire : génération de leads sur le marché des coopératives agricoles\n- Potentiel upsell : 3 filiales Belgique (discussion à 3 mois)\n\nSophie Martin", metadata: { company: "AgriSolutions", type: "internal_email" } },
    // 10 additional memory documents
    { sourceType: "email", sourceId: "email-006", content: "Objet: Question sur la sécurité des données — TechCorp\n\nBonjour,\n\nNous avons besoin de confirmer votre conformité RGPD avant de finaliser le contrat. Notamment :\n- Hébergement des données en Europe ?\n- Politique de rétention des données ?\n- Accès des équipes GrowthOS à nos données ?\n\nMerci d'avance.\nJean Dupont", metadata: { company: "TechCorp", type: "inbound_email", topic: "security" } },
    { sourceType: "call_note", sourceId: "call-004", content: "Appel découverte — Marie Laurent (DG AgriSolutions) — 5 mai\n\nDurée : 45 min — Premier contact très positif\nContexte : AgriSolutions, 85 employés, CA 12M€, secteur Agritech\nProblème principal : Équipe de 6 commerciaux qui gère 400+ agriculteurs — impossible de personnaliser la relation\nBesoin : Automatiser la qualification des leads et la génération de contenu pour des profils très spécifiques (agricultures bio, viticulture, grandes cultures)\nBudget : 30-40k€ disponible maintenant — décision possible en juin\nTest beta proposé et accepté !", metadata: { company: "AgriSolutions", type: "call_note" } },
    { sourceType: "market_intel", sourceId: "market-001", content: "Note de marché — Sales Intelligence France 2026\n\nLe marché français des outils de sales intelligence croît de 34% par an. Les principales tendances :\n1. IA générative pour la personnalisation (tous les acteurs l'intègrent)\n2. Signal intelligence : les acheteurs veulent des triggers en temps réel\n3. Revenue intelligence : le board veut des prévisions précises\n4. Convergence CRM + IA : les CRM traditionnels perdent des parts de marché\n\nGrowthOS se positionne avantageusement sur les segments PME-ETI (50-500 employés) qui n'ont pas les ressources pour implémenter Salesforce Einstein.\n\nOpportunité : 12 000 PME françaises avec une équipe commerciale de 3+ personnes.", metadata: { type: "market_intelligence" } },
    { sourceType: "email", sourceId: "email-007", content: "Objet: Benchmark ROI — résultats de nos clients 2025\n\nVoici les chiffres de ROI de nos clients après 6 mois d'utilisation :\n\n• +27% de deals closés en moyenne\n• +45% de productivité commerciale (temps gagné sur admin)\n• -38% de cycle de vente (détection précoce des blocages)\n• 3,2x le ROI sur l'investissement initial\n\nCas client similaire à TechCorp : SaaS B2B, 10 commerciaux\n- Avant GrowthOS : 8 deals/mois, taille moy. 18k€\n- Après 6 mois : 13 deals/mois, taille moy. 23k€\n- ROI : 380% en 6 mois\n\nCes chiffres peuvent être partagés avec le CFO de TechCorp pour justifier l'investissement.", metadata: { type: "roi_data" } },
    { sourceType: "email", sourceId: "email-008", content: "Objet: Retour Beta Test — AgriSolutions\n\nSophie,\n\nOn vient de terminer les 2 premières semaines de beta.\nRésultats :\n- AI SDR : 3 meetings générés (sur 2 semaines !). Les emails sont bluffants — Antoine a dit 'c'est comme si quelqu'un avait passé 2h à les écrire'\n- Deal Coach : il a détecté que notre deal avec la Coopérative du Beaujolais était en danger (pas de contact depuis 3 semaines). On a relancé et ça avance de nouveau.\n- Growth Memory : on commence à comprendre la valeur — les infos sur nos clients remontent automatiquement lors des analyses.\n\nDécision : On signe pour la version complète.\n\nMarie Laurent", metadata: { company: "AgriSolutions", type: "inbound_email" } },
    { sourceType: "call_note", sourceId: "call-005", content: "Appel négociation — TechCorp — 20 mai\n\nDurée : 20 min\nParticipants : Jean Dupont, Sophie Martin\n\nJean a demandé :\n1. Remise de 10% sur la première année → Accordé si signature avant 30 juin\n2. Formation supplémentaire pour 12 commerciaux → OK, inclus dans le tarif\n3. SLA garanti à 99,9% → OK, inclus dans le contrat standard\n4. Pilote gratuit 30 jours → Proposé, Jean veut 45 jours\n\nPosition actuelle : on accepte 45 jours de pilote + 10% de remise si signature 30 juin.\nJean doit valider avec son CFO et revenir vendredi.", metadata: { company: "TechCorp", type: "negotiation_note" } },
    { sourceType: "email", sourceId: "email-009", content: "Objet: Introduction — Isabelle Simon (Sales Director, Finaxio)\n\nBonjour Pierre,\n\nSuite à l'échange de Paul avec votre équipe, je me présente : je suis Isabelle Simon, Sales Director chez Finaxio depuis 6 ans.\n\nJe suis la personne qui utiliserait GrowthOS au quotidien avec mon équipe de 5 commerciaux. J'ai regardé votre démo et je dois dire que le module Deal Coach répond exactement à mon besoin principal : savoir, en temps réel, quels deals sont en danger.\n\nMon problème actuel : je découvre les bad surprises lors de la revue mensuelle avec Paul. C'est trop tard.\n\nQuestion : est-ce qu'on peut organiser une démo focalisée sur le Deal Coach pour mon équipe uniquement ?\n\nIsabelle Simon\nSales Director, Finaxio", metadata: { company: "Finaxio", type: "inbound_email" } },
    { sourceType: "call_note", sourceId: "call-006", content: "Appel qualification — Emma Leroy (CMO MediaNova) — 22 mai\n\nDurée : 30 min\n\nContexte MediaNova : agence de communication digitale, 45 employés, clients dans le luxe et l'entertainment\nÉquipe commerciale : 8 personnes dont 3 senior account managers\n\nBesoins identifiés :\n1. Account Intelligence pour leurs 50 comptes stratégiques (L'Oréal, LVMH, Canal+)\n2. AI SDR pour la prospection de nouvelles marques\n3. Revenue Intelligence pour les forecasts trimestriels\n\nBudget : 20-25k€, disponible immédiatement\nTimeline : veut démarrer en septembre pour la rentrée\nNiveau de maturité : très avancé technologiquement\nDécision : Emma décide seule → process simplifié\n\nNote : Potentiel de renouvellement et d'expansion très fort.", metadata: { company: "MediaNova", type: "qualification_note" } },
    { sourceType: "email", sourceId: "email-010", content: "Objet: Contrat AgriSolutions — Confirmation et prochaines étapes\n\nMarie,\n\nMerci pour la signature du contrat ! Nous sommes ravis d'accueillir AgriSolutions dans la famille GrowthOS.\n\nVoici les prochaines étapes confirmées :\n\n📅 Lundi 2 juin — Session d'onboarding (9h-11h) avec toute l'équipe commerciale\n📅 Mercredi 4 juin — Configuration intégration SAP avec notre équipe technique\n📅 Vendredi 6 juin — Formation avancée AI SDR (Antoine Roux + 2 commerciaux)\n📅 Bilan 1 mois — 30 juin 2026\n📅 Revue trimestrielle — Discussion expansion filiales Belgique\n\nVotre Customer Success Manager attitré : Pierre Dubois (pierre.dubois@growthos.fr)\n\nBienvenue à bord !\nSophie Martin", metadata: { company: "AgriSolutions", type: "outbound_email" } },
  ];

  for (const doc of memoryDocs) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM memory_documents WHERE source_type = $1 AND source_id = $2 AND tenant_id = $3`,
      [doc.sourceType, doc.sourceId, tenantId],
    );
    if (existing.rows[0]) continue;

    const docRes = await pool.query<{ id: string }>(
      `INSERT INTO memory_documents (source_type, source_id, content, tenant_id, metadata)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [doc.sourceType, doc.sourceId, doc.content, tenantId, JSON.stringify(doc.metadata)],
    );

    // Deterministic text-based embedding (keyword frequency vector)
    const keywords = ["budget", "deal", "prix", "risque", "équipe", "sales", "growthos", "crm", "pipeline", "client",
      "réunion", "contrat", "offre", "intégration", "objection", "roi", "commercial", "prospect", "signaux", "ia"];
    const contentLower = doc.content.toLowerCase();
    const embedding = keywords.map(kw => {
      const count = (contentLower.match(new RegExp(kw, 'g')) || []).length;
      return count > 0 ? Math.min(count / 10, 1) : 0;
    });
    // Pad to 1536 dimensions with deterministic values
    while (embedding.length < 1536) {
      const seed = embedding.length % keywords.length;
      embedding.push(embedding[seed] * 0.1);
    }

    await pool.query(
      `INSERT INTO memory_embeddings (document_id, embedding)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (document_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [docRes.rows[0].id, JSON.stringify(embedding)],
    );
  }
  console.log(`✅ Memory documents: ${memoryDocs.length} créés`);

  /* ── Knowledge Articles ── */
  const articles = [
    {
      title: "Comment répondre à l'objection 'C'est trop cher'",
      category: "objection",
      content: `## Objection Prix — Script de vente (Framework SPIN)

### 1. Écoute et validation
"Je vous entends, Paul. Le prix est une considération importante. Puis-je vous poser quelques questions pour mieux comprendre ?"

### 2. Recadrage ROI
Calculez le coût du problème actuel :
- Combien de deals perdez-vous chaque mois par manque de visibilité ?
- Quel est le coût d'un commercial qui rate ses objectifs ?
- Combien d'heures par semaine votre équipe perd-elle en tâches admin ?

Formule : "Si GrowthOS vous permet de closer 3 deals supplémentaires par trimestre à 15k€ chacun, le ROI est de 280% en 6 mois."

### 3. Comparaison coût/opportunité
- 15k€/an = 1 250€/mois = 52€/jour pour toute l'équipe
- Soit moins que le coût d'une demi-journée de consultant commercial

### 4. Offre de dérisquage
- Pilote gratuit 30 jours sans CB
- Paiement mensuel possible (pas d'engagement annuel obligatoire)
- Garantie ROI : 30% d'amélioration en 90 jours ou remboursement

### 5. Question de clôture
"Si on démontre un ROI positif en 30 jours, est-ce que le prix reste un obstacle ?"`,
      tags: ["objection", "prix", "budget", "roi", "spin"],
    },
    {
      title: "Playbook Prospection — Marché SaaS B2B France",
      category: "playbook",
      content: `## Playbook Prospection SaaS B2B (AIDA Framework)

### Cible Idéale (ICP)
- Entreprises 50-500 employés
- Équipe commerciale de 3-20 personnes
- CA entre 5M€ et 50M€
- Secteurs : Tech, Services, Industrie, Agritech

### Séquence de prospection (7 jours)

**Jour 1 — Signal Trigger Email**
Déclencheur : lever de fonds, recrutement VP Sales, expansion
Objet : "[Prénom], félicitations pour [signal] — une opportunité ?"
Personnalisation : mentionner le signal précis + angle commercial

**Jour 3 — LinkedIn Connect + Message**
Connexion personnalisée + message court (300 caractères max)
"Bonjour [Prénom], j'ai vu [signal]. On aide des équipes comme [Entreprise] à [bénéfice spécifique]. 15 min cette semaine ?"

**Jour 5 — Email de valeur**
Partager un cas client similaire avec chiffres précis
ROI tangible + preuve sociale sectorielle

**Jour 7 — Breakup Email**
"C'est ma dernière tentative..."
Souvent le meilleur taux de réponse (15-20%)

### Taux de conversion attendus
- Email 1 : 3-5% de réponse
- LinkedIn : 8-12% d'acceptation, 3-5% de réponse
- Breakup email : 10-15% de réponse
- Objectif global : 1 meeting pour 15 prospects ciblés`,
      tags: ["prospection", "saas", "aida", "sequence", "linkedin"],
    },
    {
      title: "Script de découverte — 30 minutes pour qualifier un deal",
      category: "script",
      content: `## Script de Qualification — Méthode MEDDIC (30 min)

### Ouverture (2 min)
"Merci de me consacrer ces 30 minutes. Mon objectif est simple : comprendre si GrowthOS peut vraiment vous aider. Si ce n'est pas le cas, je vous le dirai clairement."

### Situation actuelle (8 min)
Questions :
1. "Pouvez-vous me décrire votre processus commercial actuel, de la prospection à la signature ?"
2. "Combien de commerciaux dans votre équipe ? Quels sont leurs outils ?"
3. "Comment mesurez-vous leur performance ? KPIs ?"

### Identification du problème (8 min)
Questions :
1. "Quels sont les 3 principaux défis que votre équipe commerciale rencontre ?"
2. "Qu'est-ce qui vous empêche d'atteindre vos objectifs de croissance ?"
3. "Si vous ne faites rien, qu'est-ce qui se passe dans 6 mois ?"

### Impact / Enjeux (5 min)
Questions :
1. "Quel est le coût mensuel de ce problème pour vous ?"
2. "Avez-vous essayé d'autres solutions ? Qu'est-ce qui n'a pas fonctionné ?"

### Budget & Décision (5 min)
Questions :
1. "Avez-vous un budget alloué pour ce type de solution ?"
2. "Qui d'autre serait impliqué dans la décision ?"
3. "Quelle est votre timeline idéale ?"

### Clôture qualification (2 min)
Si qualifié : "Parfait, je vous propose une démo personnalisée mardi — ça vous convient ?"
Si non qualifié : "Je pense que ce n'est pas le bon moment. Je reviens vers vous dans [délai]."`,
      tags: ["script", "qualification", "meddic", "découverte", "demo"],
    },
    {
      title: "Procédure — Onboarding nouveau client (72h)",
      category: "procedure",
      content: `## Procédure Onboarding Client — J+0 à J+3

### J+0 (Jour de signature)
□ Envoyer email de bienvenue avec accès plateforme
□ Assigner un Customer Success Manager (CSM)
□ Créer le ticket Notion de suivi client
□ Programmer les réunions d'onboarding (J+1, J+3, J+30)

### J+1 (Kickoff — 2h)
**Matin : Session technique (1h)**
□ Configuration du compte (domaine, équipe, permissions)
□ Import des prospects existants (CSV ou API)
□ Connexion CRM si applicable (Salesforce / HubSpot / Pipedrive)
□ Test de l'intégration email (Gmail / Outlook)

**Après-midi : Formation utilisateurs (1h)**
□ Navigation générale + dashboard
□ Module Growth Memory : indexation des 10 premiers documents
□ Module AI SDR : création du premier email IA

### J+3 (Formation avancée — 2h)
□ Deal Coach : analyse des deals existants + mise en place des alertes
□ Revenue Intelligence : configuration du forecast
□ Workflows automatisés : premier workflow actif
□ Formation Playbooks & Knowledge Base

### J+30 (Bilan mensuel — 1h)
□ Revue des KPIs : deals closés, meetings générés, Win Rate
□ Identification des points bloquants
□ Roadmap personnalisée J+60 / J+90
□ Discussion potentiel d'expansion (utilisateurs supplémentaires, modules)`,
      tags: ["onboarding", "client", "procédure", "csm", "kickoff"],
    },
    {
      title: "FAQ — Questions fréquentes lors des démos",
      category: "faq",
      content: `## FAQ Commercial GrowthOS — 15 Questions Clés

**Q1 : Combien de temps pour l'intégration avec Salesforce ?**
R : 48h pour une intégration standard. L'équipe technique prend en charge l'ensemble de la migration.

**Q2 : Est-ce que l'IA remplace mes commerciaux ?**
R : Non. GrowthOS augmente vos commerciaux — ils passent moins de temps sur l'admin et plus de temps à vendre.

**Q3 : Quelle est la politique de sécurité des données ?**
R : Hébergement 100% Europe (AWS Paris). Conformité RGPD complète. Pas d'accès de GrowthOS aux données clients.

**Q4 : Comment fonctionne le Deal Coach IA ?**
R : Il analyse en temps réel toutes les interactions (emails, réunions, signaux) et calcule un Health Score pour chaque deal. Il alerte automatiquement quand un deal est à risque.

**Q5 : Quelle est la différence avec HubSpot ?**
R : HubSpot est un CRM. GrowthOS est une couche d'intelligence commerciale. On s'intègre avec HubSpot et on ajoute l'IA par-dessus.

**Q6 : Y a-t-il un engagement minimum ?**
R : Non. Paiement mensuel possible, résiliation à tout moment.

**Q7 : Combien de temps pour voir les premiers résultats ?**
R : Nos clients voient une amélioration dès la 1ère semaine (gain de temps) et les premiers deals closés grâce à GrowthOS apparaissent généralement au bout de 4-6 semaines.

**Q8 : Est-ce qu'on peut importer nos données existantes ?**
R : Oui — import CSV, API REST, et connecteurs natifs Salesforce/HubSpot/Pipedrive.

**Q9 : Combien d'utilisateurs inclus dans le prix ?**
R : Le prix de base inclut 5 utilisateurs. Utilisateurs supplémentaires à 200€/mois/utilisateur.

**Q10 : GrowthOS fonctionne-t-il pour les équipes <5 personnes ?**
R : Oui, on a des clients avec 2-3 commerciaux. Le ROI est proportionnellement encore plus élevé.`,
      tags: ["faq", "objections", "démo", "questions", "comparaison"],
    },
  ];

  for (const article of articles) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM knowledge_articles WHERE title = $1 AND tenant_id = $2`, [article.title, tenantId],
    );
    if (existing.rows[0]) {
      // Also index in memory if not already done
      continue;
    }

    const artRes = await pool.query<{ id: string }>(
      `INSERT INTO knowledge_articles (title, content, category, tags, tenant_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [article.title, article.content, article.category, article.tags, tenantId],
    );
    const artId = artRes.rows[0].id;

    // Index in memory_documents
    const docContent = `[${article.category.toUpperCase()}] ${article.title}\n\n${article.content}`;
    const docExisting = await pool.query<{ id: string }>(
      `SELECT id FROM memory_documents WHERE source_type = 'knowledge_base' AND source_id = $1 AND tenant_id = $2`,
      [artId, tenantId],
    );
    if (!docExisting.rows[0]) {
      const docRes = await pool.query<{ id: string }>(
        `INSERT INTO memory_documents (source_type, source_id, content, tenant_id, metadata)
         VALUES ('knowledge_base',$1,$2,$3,$4) RETURNING id`,
        [artId, docContent, tenantId, JSON.stringify({ articleId: artId, title: article.title, category: article.category, tags: article.tags })],
      );
      const keywords = ["budget", "deal", "prix", "risque", "équipe", "sales", "growthos", "crm", "pipeline", "client",
        "réunion", "contrat", "offre", "intégration", "objection", "roi", "commercial", "prospect", "signaux", "ia"];
      const contentLower = docContent.toLowerCase();
      const embedding = keywords.map(kw => {
        const count = (contentLower.match(new RegExp(kw, 'g')) || []).length;
        return count > 0 ? Math.min(count / 10, 1) : 0;
      });
      while (embedding.length < 1536) {
        const seed = embedding.length % keywords.length;
        embedding.push(embedding[seed] * 0.1);
      }
      await pool.query(
        `INSERT INTO memory_embeddings (document_id, embedding) VALUES ($1,$2::jsonb) ON CONFLICT (document_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
        [docRes.rows[0].id, JSON.stringify(embedding)],
      );
    }
  }
  console.log(`✅ Knowledge articles: ${articles.length} créés`);

  console.log("\n🎉 Seeding réaliste terminé avec succès !");
  console.log("═══════════════════════════════════════");
  console.log(`Tenant : growthos-demo (${tenantId})`);
  console.log("Compte admin : admin@growthos.fr");
  console.log("───────────────────────────────────────");
  console.log("Connexion: utilisez le compte admin@growthos.fr");
  console.log("(mot de passe: voir la variable d'env SEED_PASSWORD)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
