import { pool } from "@workspace/db";
import { logger } from "../logger";
import { memoryService } from "../plugin-growth-memory/MemoryService";

export type MeetingStatus = "pending" | "processing" | "completed" | "error";

export interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  transcript: string | null;
  summary: string | null;
  actionItems: ActionItem[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  owner: string;
  task: string;
  deadline?: string;
}

export interface CreateMeetingInput {
  title: string;
  tenantId: string;
  simulatedFileName?: string;
}

/* ─── Mock AI pipeline ──────────────────────────────────────── */

const MOCK_TRANSCRIPTS = [
  `[00:00] Alice: Bonjour tout le monde. On commence par faire le point sur le pipeline Q3.
[00:15] Bob: Oui, on a 14 deals en cours. Les plus chauds sont Acme Corp et TechFlow — ils attendent notre offre révisée.
[01:02] Alice: Super. Concernant Acme, leur principal frein c'est le ROI. On doit préparer un cas d'usage chiffré.
[01:45] Carol: Je peux m'en charger d'ici vendredi avec les chiffres du secteur retail.
[02:10] Bob: TechFlow a mentionné un concurrent — Datastream. On doit différencier sur l'intégration native CRM.
[02:55] Alice: Action : Bob prépare la battle card Datastream pour lundi. Carol fait le business case Acme.
[03:30] Alice: Dernier point : onboarding de Nexus Ltd. Ils ont signé la semaine dernière.
[03:45] Carol: Kickoff prévu jeudi 9h. Tout est configuré.
[04:00] Alice: Parfait. On se retrouve même créneau la semaine prochaine.`,

  `[00:00] Sophie: On attaque la review produit. Trois features à prioriser pour le Q4.
[00:20] Marc: La feature numéro 1 côté clients c'est l'export CSV avancé — 68% des comptes enterprise le demandent.
[01:05] Sophie: On peut livrer ça en combien de temps ?
[01:10] Marc: Deux sprints, soit 4 semaines.
[01:30] Léa: Attention, il faut d'abord refactorer le module de permissions sinon on aura des blocages.
[01:55] Sophie: OK. Action : Léa fait un chiffrage de la dette technique pour mercredi. Marc prépare les maquettes export CSV.
[02:40] Sophie: Feature 2 : les rapports automatiques par email. Client principal qui attend ça : GlobalTrade.
[03:00] Marc: Je peux l'intégrer dans le même sprint que l'export.
[03:20] Sophie: On valide. Feature 3 : SSO SAML — c'est un deal-breaker pour 3 prospects enterprise.
[03:50] Léa: On peut faire appel à notre partenaire d'identité pour accélérer. Je prends contact dès demain.
[04:10] Sophie: Parfait. Prochaine review dans 2 semaines avec les maquettes finalisées.`,

  `[00:00] Julien: Réunion de lancement du projet GrowthOS Phase 2. Objectif : doubler les MRR d'ici 6 mois.
[00:35] Emma: On a identifié 3 leviers : upsell base existante, expansion marché mid-market, et réduction churn.
[01:20] Julien: Pour l'upsell, on lance la campagne email la semaine prochaine. Emma coordonne avec le marketing.
[01:45] Thomas: Pour le mid-market, j'ai 8 prospects qualifiés en pipeline. Premier closing visé fin du mois.
[02:30] Emma: Churn : on a 2 comptes à risque — RetailPro et Startup X. J'ai planifié des calls de rétention cette semaine.
[03:00] Julien: Action items : Emma envoie la séquence email d'ici vendredi. Thomas prépare les decks mid-market.
[03:25] Thomas: Je dois aussi finaliser le partenariat avec DataSync — ça débloque 3 deals en attente.
[03:50] Julien: Top. On fait un point express jeudi 14h pour valider les avancées.`,
];

const MOCK_SUMMARIES = [
  "Review du pipeline Q3 : 14 deals actifs. Focus sur Acme Corp (business case ROI à préparer) et TechFlow (différenciation vs Datastream). Onboarding Nexus Ltd confirmé pour jeudi.",
  "Review produit Q4 : priorisation de 3 features — export CSV avancé (2 sprints), rapports email automatiques, SSO SAML. Refacto permissions à chiffrer en préalable.",
  "Lancement Phase 2 GrowthOS : objectif doublement MRR en 6 mois via upsell, expansion mid-market et réduction churn. Deux comptes à risque identifiés (RetailPro, Startup X).",
];

const MOCK_ACTION_ITEMS: ActionItem[][] = [
  [
    { owner: "Carol", task: "Préparer le business case ROI pour Acme Corp (secteur retail)", deadline: "Vendredi" },
    { owner: "Bob", task: "Créer la battle card de différenciation vs Datastream", deadline: "Lundi" },
    { owner: "Carol", task: "Finaliser la configuration onboarding Nexus Ltd pour le kickoff jeudi" },
  ],
  [
    { owner: "Léa", task: "Chiffrage de la dette technique du module permissions", deadline: "Mercredi" },
    { owner: "Marc", task: "Préparer les maquettes de l'export CSV avancé" },
    { owner: "Léa", task: "Prendre contact avec le partenaire d'identité pour le SSO SAML", deadline: "Demain" },
  ],
  [
    { owner: "Emma", task: "Envoyer la séquence email d'upsell à la base existante", deadline: "Vendredi" },
    { owner: "Thomas", task: "Préparer les decks mid-market pour les 8 prospects qualifiés" },
    { owner: "Thomas", task: "Finaliser le partenariat DataSync pour débloquer 3 deals" },
    { owner: "Emma", task: "Conduire les calls de rétention RetailPro et Startup X cette semaine" },
  ],
];

function pickMock(id: string) {
  const idx = id.charCodeAt(0) % MOCK_TRANSCRIPTS.length;
  return { transcript: MOCK_TRANSCRIPTS[idx], summary: MOCK_SUMMARIES[idx], actionItems: MOCK_ACTION_ITEMS[idx] };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/* ─── Service ───────────────────────────────────────────────── */

class MeetingService {
  async createMeeting(data: CreateMeetingInput): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO meetings (title, tenant_id)
       VALUES ($1, $2)
       RETURNING id`,
      [data.title, data.tenantId],
    );
    const id = result.rows[0].id;
    logger.info({ id, title: data.title }, "Meeting created");

    // Fire-and-forget async processing
    this.processMeeting(id, data.tenantId).catch((err) =>
      logger.error({ err, id }, "Meeting processing failed"),
    );

    return id;
  }

  async processMeeting(id: string, tenantId: string): Promise<void> {
    // Mark as processing
    await pool.query(
      `UPDATE meetings SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [id],
    );
    logger.info({ id }, "Meeting processing started");

    // Simulate AI pipeline delay (2-4s)
    await sleep(2000 + Math.random() * 2000);

    const mock = pickMock(id);

    // Update with results
    await pool.query(
      `UPDATE meetings
       SET status      = 'completed',
           transcript  = $2,
           summary     = $3,
           action_items = $4::jsonb,
           updated_at   = NOW()
       WHERE id = $1`,
      [id, mock.transcript, mock.summary, JSON.stringify(mock.actionItems)],
    );

    logger.info({ id }, "Meeting processing completed");

    // ── Critical: index transcript into Growth Memory ──
    try {
      await memoryService.indexDocument({
        sourceType: "meeting",
        sourceId: id,
        content: `${mock.summary}\n\nTranscript complet:\n${mock.transcript}`,
        tenantId,
        metadata: { pluginSource: "meeting-intelligence", actionItemsCount: mock.actionItems.length },
      });
      logger.info({ id }, "Meeting transcript indexed in Growth Memory");
    } catch (err) {
      logger.warn({ err, id }, "Failed to index meeting transcript in Growth Memory");
    }
  }

  async listMeetings(tenantId: string): Promise<Meeting[]> {
    const result = await pool.query<Meeting & { action_items: ActionItem[] }>(
      `SELECT
         id,
         title,
         status,
         transcript,
         summary,
         action_items   AS "actionItems",
         tenant_id      AS "tenantId",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
       FROM meetings
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async getMeeting(id: string, tenantId: string): Promise<Meeting | null> {
    const result = await pool.query<Meeting & { action_items: ActionItem[] }>(
      `SELECT
         id,
         title,
         status,
         transcript,
         summary,
         action_items   AS "actionItems",
         tenant_id      AS "tenantId",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
       FROM meetings
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async triggerProcessing(id: string, tenantId: string): Promise<boolean> {
    const meeting = await this.getMeeting(id, tenantId);
    if (!meeting) return false;
    if (meeting.status === "processing" || meeting.status === "completed") return true;

    this.processMeeting(id, tenantId).catch((err) =>
      logger.error({ err, id }, "Meeting processing failed on manual trigger"),
    );
    return true;
  }

  async deleteMeeting(id: string, tenantId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM meetings WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const meetingService = new MeetingService();
