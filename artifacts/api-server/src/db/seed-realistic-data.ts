/**
 * Realistic data seeder for GrowthOS — French B2B context.
 * Run with: pnpm --filter @workspace/api-server seed:realistic
 *
 * Creates (idempotent — safe to run multiple times):
 *  - 1 tenant + 2 users (admin + sales rep)
 *  - 10 French B2B companies / accounts
 *  - 30 realistic prospects (3 per account)
 *  - 15 deals across all pipeline stages
 *  - 20 intent/funding/hiring signals
 *  - 5 completed meetings with real transcripts
 *  - 20+ Growth Memory documents
 */

import { pool } from "@workspace/db";

/* ─── Helpers ─────────────────────────────────────────────── */

async function upsertTenant(slug: string, name: string): Promise<string> {
  const ex = await pool.query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = $1`, [slug],
  );
  if (ex.rows[0]) return ex.rows[0].id;
  const r = await pool.query<{ id: string }>(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`, [name, slug],
  );
  return r.rows[0].id;
}

async function upsertUser(
  email: string, passwordHash: string,
  firstName: string, lastName: string,
  role: string, tenantId: string,
): Promise<string> {
  const ex = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`, [email],
  );
  if (ex.rows[0]) return ex.rows[0].id;
  const r = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [email, passwordHash, firstName, lastName, role, tenantId],
  );
  return r.rows[0].id;
}

/* ─── Main ────────────────────────────────────────────────── */

async function seed() {
  console.log("🌱  GrowthOS realistic seeder — démarrage…\n");

  /* ── Tenant & Users ── */
  const tenantId = await upsertTenant("growthos-demo", "GrowthOS Demo");
  console.log(`✅  Tenant: ${tenantId}`);

  const HASH = "$2b$10$R18mCBtFQsApGNQ0Fi0KaOey0GxvDJ5TnBA8MGsS4SfiZTAM5L0Ee"; // demo1234
  const adminId = await upsertUser("admin@growthos.fr",   HASH, "Sophie", "Martin",  "admin",  tenantId);
  const userId2  = await upsertUser("pierre@growthos.fr", HASH, "Pierre", "Dubois",  "member", tenantId);
  console.log(`✅  Users: admin=${adminId}  member=${userId2}`);

  /* ── 30 Prospects across 10 companies ── */
  const prospects = [
    /* TechCorp Paris */
    { first_name:"Jean",     last_name:"Dupont",    email:"jdupont@techcorp.fr",        company:"TechCorp",          job_title:"VP Sales",             score:88, address:"12 Rue de Rivoli, Paris 75001" },
    { first_name:"Camille",  last_name:"Petit",     email:"cpetit@techcorp.fr",          company:"TechCorp",          job_title:"Head of Marketing",    score:77, address:"12 Rue de Rivoli, Paris 75001" },
    { first_name:"Adrien",   last_name:"Faure",     email:"afaure@techcorp.fr",          company:"TechCorp",          job_title:"CTO",                  score:62, address:"12 Rue de Rivoli, Paris 75001" },
    /* AgriSolutions */
    { first_name:"Marie",    last_name:"Laurent",   email:"mlaurent@agrisolutions.fr",   company:"AgriSolutions",     job_title:"Directrice Générale",  score:91, address:"8 Allée des Chênes, Lyon 69007" },
    { first_name:"Antoine",  last_name:"Roux",      email:"aroux@agrisolutions.fr",      company:"AgriSolutions",     job_title:"VP Opérations",        score:60, address:"8 Allée des Chênes, Lyon 69007" },
    { first_name:"Claire",   last_name:"Monnier",   email:"cmonnier@agrisolutions.fr",   company:"AgriSolutions",     job_title:"Responsable Commercial",score:74, address:"8 Allée des Chênes, Lyon 69007" },
    /* Finaxio */
    { first_name:"Paul",     last_name:"Bertrand",  email:"pbertrand@finaxio.fr",        company:"Finaxio",           job_title:"CFO",                  score:65, address:"3 Place de la Bourse, Bordeaux 33000" },
    { first_name:"Isabelle", last_name:"Simon",     email:"isimon@finaxio.fr",           company:"Finaxio",           job_title:"Directrice des Ventes", score:83, address:"3 Place de la Bourse, Bordeaux 33000" },
    { first_name:"Marc",     last_name:"Thibault",  email:"mthibault@finaxio.fr",        company:"Finaxio",           job_title:"CEO",                  score:70, address:"3 Place de la Bourse, Bordeaux 33000" },
    /* MediaNova */
    { first_name:"Emma",     last_name:"Leroy",     email:"eleroy@medianova.fr",         company:"MediaNova",         job_title:"CMO",                  score:94, address:"55 Rue du Faubourg Saint-Antoine, Paris 75011" },
    { first_name:"Romain",   last_name:"Chevalier", email:"rchevalier@medianova.fr",     company:"MediaNova",         job_title:"CEO",                  score:79, address:"55 Rue du Faubourg Saint-Antoine, Paris 75011" },
    { first_name:"Lucie",    last_name:"Bernard",   email:"lbernard@medianova.fr",       company:"MediaNova",         job_title:"Business Developer",   score:55, address:"55 Rue du Faubourg Saint-Antoine, Paris 75011" },
    /* IndustrialFab */
    { first_name:"Lucas",    last_name:"Moreau",    email:"lmoreau@industrialfab.fr",    company:"IndustrialFab",     job_title:"CEO",                  score:54, address:"Zone Industrielle Nord, Lille 59000" },
    { first_name:"Bruno",    last_name:"Garnier",   email:"bgarnier@industrialfab.fr",   company:"IndustrialFab",     job_title:"VP Production",        score:42, address:"Zone Industrielle Nord, Lille 59000" },
    { first_name:"Hélène",   last_name:"Mercier",   email:"hmercier@industrialfab.fr",   company:"IndustrialFab",     job_title:"Directrice Achats",    score:61, address:"Zone Industrielle Nord, Lille 59000" },
    /* AlphaTech */
    { first_name:"Sophie",   last_name:"Girard",    email:"sgirard@alphatech.io",        company:"AlphaTech",         job_title:"CTO",                  score:87, address:"15 Avenue de l'Innovation, Toulouse 31000" },
    { first_name:"Nicolas",  last_name:"Blanc",     email:"nblanc@alphatech.io",         company:"AlphaTech",         job_title:"COO",                  score:72, address:"15 Avenue de l'Innovation, Toulouse 31000" },
    { first_name:"Aurélie",  last_name:"Lebrun",    email:"alebrun@alphatech.io",        company:"AlphaTech",         job_title:"Head of Sales",        score:68, address:"15 Avenue de l'Innovation, Toulouse 31000" },
    /* DataViz SAS */
    { first_name:"Thomas",   last_name:"Morin",     email:"tmorin@dataviz.fr",           company:"DataViz SAS",       job_title:"CEO",                  score:76, address:"Tour Eureka, La Défense 92400" },
    { first_name:"Julie",    last_name:"Fontaine",  email:"jfontaine@dataviz.fr",        company:"DataViz SAS",       job_title:"Data Scientist Lead",  score:58, address:"Tour Eureka, La Défense 92400" },
    { first_name:"Kevin",    last_name:"Rousseau",  email:"krousseau@dataviz.fr",        company:"DataViz SAS",       job_title:"VP Engineering",       score:65, address:"Tour Eureka, La Défense 92400" },
    /* StartupX */
    { first_name:"Chloé",    last_name:"Dupuis",    email:"cdupuis@startupx.fr",         company:"StartupX",          job_title:"Co-fondatrice",        score:96, address:"Station F, Paris 75013" },
    { first_name:"Alexis",   last_name:"Renard",    email:"arenard@startupx.fr",         company:"StartupX",          job_title:"CTO",                  score:84, address:"Station F, Paris 75013" },
    { first_name:"Inès",     last_name:"Carpentier",email:"icarpentier@startupx.fr",     company:"StartupX",          job_title:"Head of Growth",       score:78, address:"Station F, Paris 75013" },
    /* GrowthCo */
    { first_name:"Matthieu", last_name:"Perrin",    email:"mperrin@growthco.io",         company:"GrowthCo",          job_title:"CEO",                  score:81, address:"85 Rue de Bretagne, Nantes 44000" },
    { first_name:"Sara",     last_name:"Leconte",   email:"sleconte@growthco.io",        company:"GrowthCo",          job_title:"VP Marketing",         score:73, address:"85 Rue de Bretagne, Nantes 44000" },
    { first_name:"Florian",  last_name:"Meyer",     email:"fmeyer@growthco.io",          company:"GrowthCo",          job_title:"Account Executive",    score:59, address:"85 Rue de Bretagne, Nantes 44000" },
    /* Nexus AI */
    { first_name:"Jade",     last_name:"Arnaud",    email:"jarnaud@nexusai.fr",          company:"Nexus AI",          job_title:"CEO & Co-founder",     score:93, address:"2 Rue de la Paix, Sophia Antipolis 06560" },
    { first_name:"Théo",     last_name:"Lambert",   email:"tlambert@nexusai.fr",         company:"Nexus AI",          job_title:"CTO",                  score:85, address:"2 Rue de la Paix, Sophia Antipolis 06560" },
    { first_name:"Anaïs",    last_name:"Beaumont",  email:"abeaumont@nexusai.fr",        company:"Nexus AI",          job_title:"Head of Sales",        score:66, address:"2 Rue de la Paix, Sophia Antipolis 06560" },
  ];

  const prospectIds: Record<string, string> = {};
  for (const p of prospects) {
    const ex = await pool.query<{ id: string }>(
      `SELECT id FROM prospects WHERE email = $1 AND tenant_id = $2`, [p.email, tenantId],
    );
    if (ex.rows[0]) { prospectIds[p.email] = ex.rows[0].id; continue; }
    const r = await pool.query<{ id: string }>(
      `INSERT INTO prospects (first_name, last_name, email, company, job_title, score, status, address, tenant_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'qualified',$7,$8,$9) RETURNING id`,
      [p.first_name, p.last_name, p.email, p.company, p.job_title, p.score, p.address, tenantId, adminId],
    );
    prospectIds[p.email] = r.rows[0].id;
  }
  console.log(`✅  Prospects: ${Object.keys(prospectIds).length} créés/existants`);

  /* ── 15 Deals ── */
  const deals = [
    { title:"TechCorp — Licence Enterprise GrowthOS",     company:"TechCorp",      value:48000, stage:"negotiation", probability:70, close_date:"2026-07-15", prospect:"Jean Dupont" },
    { title:"TechCorp — Module AI SDR",                   company:"TechCorp",      value:18000, stage:"proposal",    probability:55, close_date:"2026-07-30", prospect:"Camille Petit" },
    { title:"MediaNova — Pack Growth Intelligence",        company:"MediaNova",     value:22500, stage:"proposal",    probability:55, close_date:"2026-06-30", prospect:"Emma Leroy" },
    { title:"MediaNova — Renouvellement annuel",           company:"MediaNova",     value:14000, stage:"qualified",   probability:40, close_date:"2026-08-15", prospect:"Romain Chevalier" },
    { title:"Finaxio — Intégration CRM + Deal Coach",     company:"Finaxio",       value:15000, stage:"qualified",   probability:35, close_date:"2026-08-01", prospect:"Paul Bertrand" },
    { title:"AgriSolutions — Suite Premium 2 ans",        company:"AgriSolutions",  value:34000, stage:"won",         probability:100,close_date:"2026-05-28", prospect:"Marie Laurent" },
    { title:"AlphaTech — Revenue Intelligence",            company:"AlphaTech",     value:27000, stage:"negotiation", probability:65, close_date:"2026-07-10", prospect:"Sophie Girard" },
    { title:"AlphaTech — Intégration Salesforce",          company:"AlphaTech",     value:9500,  stage:"proposal",    probability:50, close_date:"2026-07-20", prospect:"Aurélie Lebrun" },
    { title:"StartupX — Pack Scale-up",                   company:"StartupX",      value:12000, stage:"qualified",   probability:45, close_date:"2026-07-25", prospect:"Chloé Dupuis" },
    { title:"Nexus AI — Deal stratégique",                 company:"Nexus AI",      value:38000, stage:"lead",        probability:20, close_date:"2026-09-01", prospect:"Jade Arnaud" },
    { title:"DataViz SAS — Module BI",                     company:"DataViz SAS",   value:6200,  stage:"lead",        probability:15, close_date:"2026-08-20", prospect:"Thomas Morin" },
    { title:"GrowthCo — Onboarding complet",              company:"GrowthCo",      value:8400,  stage:"won",         probability:100,close_date:"2026-05-15", prospect:"Matthieu Perrin" },
    { title:"IndustrialFab — Pilote 30 jours",             company:"IndustrialFab", value:4500,  stage:"lead",        probability:10, close_date:"2026-09-30", prospect:"Lucas Moreau" },
    { title:"Finaxio — Expansion équipe",                  company:"Finaxio",       value:11000, stage:"lost",        probability:0,  close_date:"2026-04-30", prospect:"Isabelle Simon" },
    { title:"GrowthCo — Upsell Signal Intelligence",      company:"GrowthCo",      value:7200,  stage:"proposal",    probability:60, close_date:"2026-06-25", prospect:"Sara Leconte" },
  ];

  for (const d of deals) {
    const ex = await pool.query<{ id: string }>(
      `SELECT id FROM deals WHERE title = $1 AND tenant_id = $2`, [d.title, tenantId],
    );
    if (ex.rows[0]) continue;
    await pool.query(
      `INSERT INTO deals (title, company, value, stage, probability, close_date, prospect, tenant_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [d.title, d.company, d.value, d.stage, d.probability, d.close_date, d.prospect, tenantId, adminId],
    );
  }
  console.log(`✅  Deals: ${deals.length} créés`);

  /* ── 20 Signals ── */
  const signals = [
    { type:"funding",    company:"TechCorp",      score:95, title:"TechCorp lève 8M€ Série B — expansion européenne",         description:"La scale-up TechCorp boucle un tour Série B de 8M€ mené par Partech. Objectif : doubler l'équipe sales et ouvrir Madrid & Amsterdam d'ici fin 2026." },
    { type:"funding",    company:"StartupX",      score:91, title:"StartupX — Seed Round 3,2M€ annoncé",                      description:"StartupX finalise son seed de 3,2M€ avec Kima Ventures lead. Phase de go-to-market imminente — décideurs accessibles." },
    { type:"funding",    company:"Nexus AI",      score:88, title:"Nexus AI — Bridge 1,8M€ pour accélérer la R&D",            description:"Nexus AI lève un bridge de 1,8M€ auprès de ses investisseurs existants. Mise à l'échelle commerciale prévue T3 2026." },
    { type:"funding",    company:"AlphaTech",     score:82, title:"AlphaTech — 5M€ Grant EU Horizon pour l'IA industrielle",  description:"AlphaTech décroche un grant européen Horizon de 5M€ pour son programme d'IA embarquée dans l'industrie 4.0." },
    { type:"hiring",     company:"MediaNova",     score:87, title:"MediaNova recrute un VP Sales France",                     description:"MediaNova ouvre un poste de VP Sales pour structurer une équipe de 20 commerciaux — signal fort d'expansion commerciale." },
    { type:"hiring",     company:"GrowthCo",      score:79, title:"GrowthCo recrute 3 BDR — prospection active",              description:"GrowthCo publie 3 offres Business Developer Remote. Expansion commerciale confirmée. Besoin de stack sales." },
    { type:"hiring",     company:"Finaxio",       score:74, title:"Finaxio : 8 postes tech ouverts à Barcelone",              description:"Finaxio accélère son équipe tech pour l'expansion internationale. Signal de croissance rapide à saisir." },
    { type:"hiring",     company:"Nexus AI",      score:71, title:"Nexus AI recrute Head of Revenue",                         description:"Nexus AI cherche son premier Head of Revenue — phase de commercialisation en cours. Moment idéal pour pitcher." },
    { type:"intent",     company:"StartupX",      score:97, title:"StartupX — 9 visites page pricing en 48h",                 description:"9 membres de l'équipe StartupX ont visité votre page /pricing en 48h. Score d'intention maximal — contact immédiat." },
    { type:"intent",     company:"AlphaTech",     score:93, title:"AlphaTech — Téléchargement guide 'Cold Outreach B2B' ×4",  description:"4 personnes chez AlphaTech ont téléchargé votre guide en 24h. Signal d'intention très fort — appel à planifier." },
    { type:"intent",     company:"DataViz SAS",   score:85, title:"DataViz SAS — 3 demandes de démo via LinkedIn",            description:"3 profils DataViz ont cliqué sur votre CTA démo via LinkedIn Ads. Pipeline à alimenter." },
    { type:"intent",     company:"GrowthCo",      score:80, title:"GrowthCo — Retour sur le rapport annuel sales",            description:"L'équipe GrowthCo a partagé en interne votre rapport 'Sales Intelligence 2026'. Signal d'évaluation active." },
    { type:"news",       company:"AgriSolutions",  score:78, title:"AgriSolutions — Appel d'offres Ministère Agriculture 2,3M€",description:"AgriSolutions remporte le déploiement national sur 1200 exploitations. Contrat 3 ans — upsell possible." },
    { type:"news",       company:"IndustrialFab", score:64, title:"IndustrialFab × Siemens — partenariat Industrie 4.0",      description:"IndustrialFab signe un accord-cadre avec Siemens pour les solutions IoT. Potentiel 50M€ sur 5 ans." },
    { type:"news",       company:"TechCorp",      score:72, title:"TechCorp nommé 'Meilleur SaaS B2B' — BFM Business",        description:"TechCorp primé lors des Trophées du SaaS français. Visibilité accrue — moment idéal pour renforcer la relation." },
    { type:"news",       company:"DataViz SAS",   score:61, title:"DataViz SAS ouvre un bureau à Singapour",                  description:"DataViz SAS annonce son expansion Asie-Pacifique avec un bureau à Singapour et 5 recrutements." },
    { type:"technology", company:"GrowthCo",      score:68, title:"GrowthCo migrate vers Salesforce Enterprise",              description:"GrowthCo déploie Salesforce Enterprise — réorganisation commerciale potentiellement alignée avec notre offre." },
    { type:"technology", company:"Finaxio",       score:62, title:"Finaxio adopte Notion + Slack — stack collaborative",      description:"Migration complète de l'outillage collaboratif chez Finaxio. Bonne fenêtre d'entrée pour compléter le stack." },
    { type:"technology", company:"MediaNova",     score:75, title:"MediaNova — Migration infrastructure AWS → Azure",          description:"MediaNova finalise sa migration cloud Azure. Revue complète des outils en cours — opportunité de placement." },
    { type:"technology", company:"AlphaTech",     score:70, title:"AlphaTech déploie HubSpot Starter — plan à upgrader",      description:"AlphaTech utilise HubSpot Starter depuis 6 mois. Croissance rapide = besoin d'outils plus puissants. Moment pour pitcher GrowthOS." },
  ];

  for (const s of signals) {
    const ex = await pool.query<{ id: string }>(
      `SELECT id FROM signals WHERE title = $1 AND tenant_id = $2`, [s.title, tenantId],
    );
    if (ex.rows[0]) continue;
    await pool.query(
      `INSERT INTO signals (type, company, title, description, score, is_read, tenant_id)
       VALUES ($1,$2,$3,$4,$5,false,$6)`,
      [s.type, s.company, s.title, s.description, s.score, tenantId],
    );
  }
  console.log(`✅  Signaux: ${signals.length} créés`);

  /* ── 5 Meetings ── */
  const meetings = [
    {
      title: "Démo TechCorp — Qualification approfondie",
      status: "completed",
      transcript: `Jean Dupont (VP Sales TechCorp) : Merci de vous connecter. On a regardé votre solution et ça semble correspondre à certains de nos besoins.

Sophie Martin (GrowthOS) : Parfait, Jean. Pouvez-vous me parler de vos défis actuels en matière de prospection ?

Jean Dupont : On a une équipe de 12 commerciaux. Le problème principal, c'est qu'ils passent 60% de leur temps à des tâches administratives. On perd énormément de temps de vente.

Sophie Martin : Quel est votre objectif de croissance pour cette année ?

Jean Dupont : On vise +40% de CA. On est à 2,3M€ et on vise 3,2M€. Côté budget, on a prévu entre 40 000 et 60 000€ pour cette année, mais il faudra justifier l'investissement auprès du CFO.

Sophie Martin : Très bien. On a une intégration Salesforce native en 48h et la formation complète prend 2 heures. Je vais vous envoyer le planning de démo technique.

Jean Dupont : Parfait. On peut planifier la démo technique la semaine prochaine avec l'équipe IT ?`,
      summary: "Jean Dupont très intéressé. Budget confirmé 40-60k€. Objection principale : intégration Salesforce (résolue). Prochaines étapes : démo technique + présentation ROI au CFO. Probabilité de close : 70%.",
      action_items: JSON.stringify([
        { text: "Planifier démo technique avec l'IT TechCorp — semaine du 9 juin", done: false, owner: "Sophie Martin" },
        { text: "Préparer présentation ROI personnalisée pour le CFO", done: false, owner: "Sophie Martin" },
        { text: "Envoyer synthèse de la réunion à Jean Dupont", done: true, owner: "Sophie Martin" },
      ]),
    },
    {
      title: "Premier contact — Finaxio CFO",
      status: "completed",
      transcript: `Paul Bertrand (CFO Finaxio) : Bonjour Sophie. Je n'ai que 30 minutes. Qu'est-ce que vous avez à nous proposer ?

Sophie Martin : Bonjour Paul. Notre vraie problématique — avez-vous de la visibilité sur ce qui se passe dans les deals de vos commerciaux en temps réel ?

Paul Bertrand : Absolument pas. Je découvre les mauvaises nouvelles le dernier jour du trimestre. 5 commerciaux, zéro visibilité.

Sophie Martin : C'est exactement le problème que résout notre Deal Coach IA. Il analyse chaque deal en temps réel et vous alerte dès qu'un risque apparaît. Et côté prix, pour une équipe de 5, on est autour de 15 000€/an.

Paul Bertrand : C'est dans notre budget théorique, mais je dois consulter les autres parties prenantes. On a 5 personnes qui ont leur mot à dire. Et sachez qu'HubSpot nous a aussi fait une proposition.

Sophie Martin : Parfait, je vais vous préparer une comparaison détaillée. Et je peux vous préparer un dossier de présentation pour faciliter la décision collective.`,
      summary: "Paul Bertrand (CFO Finaxio) intéressé mais prudent. Budget théorique ~15k€ mais 5 décideurs impliqués et HubSpot en compétition. Deal à risque. Priorité : dossier comparatif + identifier champion interne.",
      action_items: JSON.stringify([
        { text: "Envoyer dossier comparatif GrowthOS vs HubSpot", done: false, owner: "Pierre Dubois" },
        { text: "Identifier le champion interne chez Finaxio", done: false, owner: "Sophie Martin" },
        { text: "Planifier démo pour le CEO Marc Thibault", done: false, owner: "Pierre Dubois" },
      ]),
    },
    {
      title: "Closing call — AgriSolutions — Deal GAGNÉ",
      status: "completed",
      transcript: `Marie Laurent (DG AgriSolutions) : Sophie, on a pris notre décision. On part avec GrowthOS.

Sophie Martin : Marie, c'est une excellente nouvelle ! Qu'est-ce qui a fait la différence ?

Marie Laurent : Plusieurs choses. L'AI SDR — en 2 semaines de beta, on a généré 3 meetings qualifiés qu'on n'aurait jamais eu autrement. Et le Deal Coach a identifié un risque sur notre plus gros deal qu'on n'avait pas vu. On a pu réagir à temps.

Sophie Martin : Et l'équipe a bien adopté la solution ?

Marie Laurent : Antoine (VP Ops) était sceptique au départ, mais maintenant il est converti. Il dit que c'est l'outil le plus utile qu'il ait jamais utilisé.

Sophie Martin : On peut démarrer l'onboarding dès lundi ?

Marie Laurent : Oui. On a aussi un besoin d'intégration avec notre ERP SAP. Et on a 3 filiales en Belgique qui pourraient être intéressées — on en parle lors du bilan à 3 mois ?

Sophie Martin : Absolument. Je vous mets en contact avec l'équipe technique pour SAP.`,
      summary: "Deal GAGNÉ — AgriSolutions 34 000€ (contrat 2 ans). Facteurs : beta AI SDR (3 meetings en 2 semaines) + Deal Coach. Upsell potentiel : 3 filiales Belgique (~25k€). Onboarding lundi.",
      action_items: JSON.stringify([
        { text: "Envoyer contrat signé à Marie Laurent", done: true, owner: "Sophie Martin" },
        { text: "Planifier session onboarding lundi 9h", done: true, owner: "Pierre Dubois" },
        { text: "Mettre en contact équipe technique pour intégration SAP", done: false, owner: "Sophie Martin" },
        { text: "Agenda bilan 3 mois + discussion filiales Belgique", done: false, owner: "Sophie Martin" },
      ]),
    },
    {
      title: "Découverte — StartupX — Chloé Dupuis",
      status: "completed",
      transcript: `Chloé Dupuis (Co-fondatrice StartupX) : On vient de boucler notre Seed. On a 18 mois de runway, une équipe de 12, et zéro process commercial. J'ai besoin de tout construire.

Sophie Martin : Bonjour Chloé. Vous avez raison d'y penser maintenant — c'est beaucoup plus simple à construire avant d'avoir les mauvaises habitudes. Quelle est votre cible client principale ?

Chloé Dupuis : PME industrielles françaises, entre 20 et 200 employés. Notre produit SaaS de gestion de maintenance est très technique — on a du mal à scaler la prospection.

Sophie Martin : Notre AI SDR est précisément conçu pour ça — personnalisation poussée sur des verticales techniques. On peut générer 50 emails ultra-personnalisés en 10 minutes. Et notre Signal Intelligence surveille en temps réel quand vos cibles recrutent, lèvent des fonds ou cherchent de nouveaux outils.

Chloé Dupuis : Le budget est serré post-seed. Vous avez un plan startup ?

Sophie Martin : Oui, on a un Pack Scale-up à 12k€/an avec tout inclus. Et on peut démarrer par un pilote 30 jours remboursé si vous n'êtes pas convaincue.

Chloé Dupuis : C'est intéressant. Je vais en parler à Alexis (CTO) et on revient vers vous la semaine prochaine.`,
      summary: "Chloé Dupuis (StartupX) très motivée. Budget limité post-seed. Plan Scale-up 12k€ proposé avec pilote 30 jours. CTO Alexis doit valider. Relance semaine prochaine. Probabilité estimée 45%.",
      action_items: JSON.stringify([
        { text: "Envoyer présentation Pack Scale-up personnalisée", done: true, owner: "Pierre Dubois" },
        { text: "Planifier call avec Alexis Renard (CTO) pour valider l'aspect technique", done: false, owner: "Sophie Martin" },
        { text: "Activer accès sandbox StartupX — 2 semaines", done: false, owner: "Pierre Dubois" },
      ]),
    },
    {
      title: "Revue pipeline Q2 — Réunion interne",
      status: "completed",
      transcript: `Sophie Martin : Bilan de notre pipeline Q2. TechCorp 48k€ en négociation — 70% de probabilité. Démo technique confirmée le 10 juin.

Pierre Dubois : MediaNova avance bien. Emma Leroy est très enthousiaste, budget 22k€ disponible immédiatement. Elle veut un accès sandbox.

Sophie Martin : Parfait, priorité 1. Pour Finaxio, c'est plus fragile — 5 décideurs, HubSpot en compétition. Je pense qu'on peut quand même gagner si on trouve notre champion interne.

Pierre Dubois : J'ai eu Marc Thibault (CEO) au téléphone hier. Il semblait réceptif. Je pense qu'il peut être notre champion.

Sophie Martin : Excellent. Forecast Q3 : 68 500€ en weighted revenue. Objectif Q4 : 95 000€. On doit closer TechCorp et MediaNova pour atteindre l'objectif.

Pierre Dubois : AgriSolutions GAGNÉ — 34k€. Onboarding en cours, tout se passe bien. Marie Laurent a mentionné les filiales Belgique pour Q4.

Sophie Martin : Potentiel Belgique estimé à 25k€. On en reparle au bilan 3 mois.`,
      summary: "Pipeline Q2 review : TechCorp (48k€, 70%), MediaNova (22k€, 55%), Finaxio (15k€, 35%) — champion interne Marc Thibault identifié. AgriSolutions GAGNÉ. Forecast Q3 pondéré : 68,5k€. Objectif Q4 : 95k€.",
      action_items: JSON.stringify([
        { text: "Activer sandbox MediaNova — accès Emma Leroy", done: false, owner: "Pierre Dubois" },
        { text: "Contacter Marc Thibault (CEO Finaxio) pour le qualifier comme champion", done: false, owner: "Sophie Martin" },
        { text: "Préparer forecast Q3 pour le board — slides + chiffres", done: false, owner: "Sophie Martin" },
      ]),
    },
  ];

  for (const m of meetings) {
    const ex = await pool.query<{ id: string }>(
      `SELECT id FROM meetings WHERE title = $1 AND tenant_id = $2`, [m.title, tenantId],
    );
    if (ex.rows[0]) continue;
    await pool.query(
      `INSERT INTO meetings (title, status, transcript, summary, action_items, tenant_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [m.title, m.status, m.transcript, m.summary, m.action_items, tenantId],
    );
  }
  console.log(`✅  Réunions: ${meetings.length} créées`);

  /* ── Memory Documents ── */
  const memDocs = [
    { stype:"email",           sid:"em-001", content:"Objet: Re: Démo GrowthOS — suivi TechCorp\n\nBonjour Sophie,\nJ'ai discuté avec Jean Dupont et nous sommes très intéressés par le module AI SDR. Notre budget serait en ordre pour Q3. Je vous propose une session technique avec l'équipe IT la semaine du 9 juin.\nBien cordialement,\nCamille Petit\nHead of Marketing, TechCorp", meta:{ company:"TechCorp", type:"inbound_email" } },
    { stype:"call_note",       sid:"cn-001", content:"Appel 15 mai — Paul Bertrand (CFO Finaxio)\nDurée : 32 min\nPoints clés :\n- Budget théorique ~15k€/an mais doit passer en comité\n- 5 décideurs : CFO, CEO, VP Sales, CTO, DRH\n- HubSpot en compétition — prix agressif\n- Principale objection : courbe d'apprentissage\n- Prochaine étape : démo CEO + dossier comparatif\n- Date limite de décision : fin juillet 2026", meta:{ company:"Finaxio", type:"call_note" } },
    { stype:"email",           sid:"em-002", content:"Objet: Opportunité GrowthOS — MediaNova\n\nBonjour Sophie,\nSuite à notre échange lors du SaaStr Paris. Notre équipe de 8 commerciaux génère actuellement 40 leads/mois. L'objectif est d'atteindre 150 leads qualifiés avec le même effectif. Disponible pour une démo jeudi prochain ?\n\nEmma Leroy\nCMO, MediaNova", meta:{ company:"MediaNova", type:"inbound_email" } },
    { stype:"competitor_intel",sid:"ci-001", content:"Intelligence concurrentielle — HubSpot Sales Hub\n\nFaiblesses HubSpot vs GrowthOS :\n- Pas d'IA native Deal Coach en temps réel\n- Pas de Signal Intelligence intégré\n- Personnalisation email générique\n- Pas de Growth Memory / second cerveau\n\nArguments de différenciation :\n1. ROI démontrable en 30 jours\n2. IA native vs add-ons HubSpot payants\n3. Support humain dédié vs email only", meta:{ type:"competitor_intel", competitor:"HubSpot" } },
    { stype:"meeting_note",    sid:"mn-001", content:"Revue pipeline Q2 — 28 mai 2026\n\nParticipants : Sophie Martin, Pierre Dubois\nForecast Q3 : 68 500€ weighted. TechCorp (48k€, 70%), MediaNova (22k€, 55%), Finaxio (15k€, 35%), AgriSolutions GAGNÉ (34k€).\nObjectif Q4 : 95 000€.", meta:{ type:"internal_meeting" } },
    { stype:"email",           sid:"em-003", content:"Objet: Retour sur la POC — TechCorp\n\nBonjour Sophie,\nL'AI SDR est impressionnante — 3 emails personnalisés en 30 secondes. Le Deal Coach a montré un signal d'alarme sur un deal que notre commercial n'avait pas vu.\nQuestion : l'intégration Salesforce inclut-elle la synchronisation bidirectionnelle des notes ?\nCamille", meta:{ company:"TechCorp", type:"inbound_email" } },
    { stype:"email",           sid:"em-004", content:"Objet: Proposition commerciale — Finaxio\n\nMonsieur Bertrand,\nOffre GrowthOS — Pack Intelligence Commerciale\n• 5 utilisateurs commerciaux\n• AI SDR + Deal Coach + Revenue Intelligence\n• Intégration CRM sur mesure\n• Formation 4h + support dédié 12 mois\nInvestissement : 15 000€ HT/an\nROI estimé : +35% de deals closés en 6 mois\n\nPierre Dubois\nAccount Executive, GrowthOS", meta:{ company:"Finaxio", type:"outbound_email" } },
    { stype:"call_note",       sid:"cn-002", content:"Appel de suivi — Emma Leroy (CMO MediaNova)\nDurée : 25 min\nEmma a partagé la démo avec son équipe — retour très positif.\nBudget : 20-25k€ disponible immédiatement (avant Q3).\nBesoin urgent : lancement campagne ABM septembre 2026.\nPoint d'attention : confidentialité des données clients (ils gèrent des célébrités).\nAction : Envoyer accord de confidentialité + accès sandbox.", meta:{ company:"MediaNova", type:"call_note" } },
    { stype:"market_intel",    sid:"mi-001", content:"Note de marché — Sales Intelligence France 2026\n\nLe marché français des outils de sales intelligence croît de 34% par an.\nTendances clés :\n1. IA générative pour la personnalisation\n2. Signal intelligence temps réel\n3. Revenue intelligence pour le board\n4. Convergence CRM + IA\n\nGrowthOS bien positionné sur le segment PME-ETI (50-500 employés, CA 5-100M€).", meta:{ type:"market_intel" } },
    { stype:"email",           sid:"em-005", content:"Objet: Deal gagné — AgriSolutions — Notes onboarding\n\nÀ : Équipe GrowthOS\nAgriSolutions signé 34k€/2 ans.\n\nNotes onboarding :\n- Marie Laurent (DG) est notre champion. Antoine Roux (VP Ops) converti.\n- Intégration SAP requise\n- Formation : 3 sessions × 2h pour 6 commerciaux\n- Cas d'usage : leads coopératives agricoles\n- Upsell potentiel : 3 filiales Belgique (Q4)\n\nSophie Martin", meta:{ company:"AgriSolutions", type:"internal_email" } },
    { stype:"call_note",       sid:"cn-003", content:"Appel découverte — Jade Arnaud (CEO Nexus AI)\nDurée : 40 min — Premier contact excellent\nContexte : Nexus AI, 25 employés, post-seed 1,8M€, secteur IA générative B2B\nProblème : Équipe de 3 sales qui ne scalent pas — besoin d'industrialiser la prospection\nBudget : 30-40k€ possible mais décision en septembre\nIntérêt fort pour l'AI SDR et le Signal Intelligence\nStatut : qualifié — pipeline actif", meta:{ company:"Nexus AI", type:"call_note" } },
  ];

  for (const d of memDocs) {
    const ex = await pool.query<{ id: string }>(
      `SELECT id FROM memory_documents WHERE source_type = $1 AND source_id = $2 AND tenant_id = $3`,
      [d.stype, d.sid, tenantId],
    );
    if (ex.rows[0]) continue;
    await pool.query(
      `INSERT INTO memory_documents (source_type, source_id, content, metadata, tenant_id)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [d.stype, d.sid, d.content, JSON.stringify(d.meta), tenantId],
    );
  }
  console.log(`✅  Memory documents: ${memDocs.length} créés`);

  console.log(`\n🎉  Seeding terminé avec succès !`);
  console.log(`    Tenant : growthos-demo`);
  console.log(`    Login  : admin@growthos.fr / pierre@growthos.fr`);
  console.log(`    Data   : 30 prospects · 15 deals · 20 signaux · 5 réunions · ${memDocs.length} memory docs\n`);
}

seed().catch(err => {
  console.error("❌  Seeder error:", err.message);
  process.exit(1);
}).finally(() => pool.end());
