import { pool } from "@workspace/db";
import { logger } from "../logger";
import { emitSignalReceived } from "./event-emitter";

export type SignalType = "funding" | "hiring" | "news" | "tech_change" | "leadership_change";
export type SignalStatus = "new" | "read" | "actioned";

export interface Signal {
  id: string;
  type: SignalType;
  company: string;
  title: string;
  description: string | null;
  score: number;
  status: SignalStatus;
  isRead: boolean;
  isStarred: boolean;
  detectedAt: string;
  createdAt: string;
  tenantId: string;
}

/* ─── Mock signal templates ────────────────────────────── */

const MOCK_BY_TYPE: Record<SignalType, { title: (c: string) => string; desc: (c: string) => string; score: number }[]> = {
  funding: [
    { title: (c) => `${c} lève des fonds — Série A détectée`, desc: (c) => `${c} vient de boucler un tour de table. Signal fort d'expansion — moment idéal pour pitcher une solution growth.`, score: 90 },
    { title: (c) => `Seed round ${c} — investisseurs confirmés`, desc: (c) => `${c} a finalisé un Seed Round. Phase de go-to-market imminente — équipe commerciale en structuration.`, score: 82 },
    { title: (c) => `${c} : nouveau tour de financement Série B`, desc: (c) => `Levée Série B confirmée pour ${c}. Forte probabilité de budget tech et outreach en expansion.`, score: 88 },
  ],
  hiring: [
    { title: (c) => `${c} recrute un VP Sales`, desc: (c) => `${c} ouvre un poste VP Sales — signal de structuration commerciale forte. Décideurs accessibles et en mode croissance.`, score: 75 },
    { title: (c) => `${c} : 5 postes BDR ouverts`, desc: (c) => `${c} ouvre plusieurs postes Business Developer. Expansion commerciale confirmée — context parfait pour un outil prospection.`, score: 70 },
    { title: (c) => `${c} recrute un Head of Revenue`, desc: (c) => `Recrutement Head of Revenue chez ${c}. Restructuration go-to-market en cours, budget outreach probable.`, score: 78 },
  ],
  news: [
    { title: (c) => `${c} annonce une expansion internationale`, desc: (c) => `${c} ouvre de nouveaux marchés. Besoin en outils de prospection multicanal identifié.`, score: 65 },
    { title: (c) => `Partenariat stratégique pour ${c}`, desc: (c) => `${c} annonce un partenariat majeur. Montée en charge probable — revue de leur stack CRM à prévoir.`, score: 60 },
    { title: (c) => `${c} dans le Top 10 des scale-ups 2026`, desc: (c) => `${c} classé parmi les meilleures scale-ups. Profil idéal pour une offre growth enterprise.`, score: 68 },
  ],
  tech_change: [
    { title: (c) => `${c} migre vers un nouveau CRM`, desc: (c) => `Changement de stack CRM détecté chez ${c}. Fenêtre d'opportunité ouverte pour notre intégration native.`, score: 72 },
    { title: (c) => `${c} adopte Salesforce Enterprise`, desc: (c) => `Déploiement Salesforce chez ${c} — réorganisation commerciale en cours, opportunité d'intégration directe.`, score: 74 },
    { title: (c) => `Stack tech renouvelée chez ${c}`, desc: (c) => `${c} modernise son infrastructure. Ouverture potentielle à de nouveaux outils de prospection et d'automation.`, score: 66 },
  ],
  leadership_change: [
    { title: (c) => `Nouveau CEO chez ${c}`, desc: (c) => `Changement de direction chez ${c}. Moment clé pour reprendre contact — nouveau décideur, nouvelles priorités.`, score: 80 },
    { title: (c) => `${c} : nouveau Chief Revenue Officer`, desc: (c) => `Nomination d'un CRO chez ${c}. Revue stratégique commerciale probable dans les 90 jours.`, score: 85 },
    { title: (c) => `${c} nomme un VP Marketing`, desc: (c) => `Nouveau VP Marketing chez ${c} — renouvellement de la stack marketing prévisible sous 6 mois.`, score: 76 },
  ],
};

const SIGNAL_TYPES: SignalType[] = ["funding", "hiring", "news", "tech_change", "leadership_change"];

function pickSignalTemplate(type: SignalType, company: string, seed: number) {
  const templates = MOCK_BY_TYPE[type];
  const t = templates[seed % templates.length];
  return { title: t.title(company), description: t.desc(company), score: t.score };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ─── Service ────────────────────────────────────────────── */

class SignalService {
  async generateMockSignals(company: string, tenantId: string): Promise<Signal[]> {
    const seed = hashCode(`${company}-${Date.now()}`);
    const count = 1 + (seed % 3);
    const created: Signal[] = [];

    for (let i = 0; i < count; i++) {
      const type = SIGNAL_TYPES[(seed + i) % SIGNAL_TYPES.length];
      const { title, description, score } = pickSignalTemplate(type, company, seed + i);

      const result = await pool.query<{
        id: string; type: string; company: string; title: string; description: string;
        score: number; status: string; is_read: boolean; is_starred: boolean;
        detected_at: Date; created_at: Date; tenant_id: string;
      }>(
        `INSERT INTO signals (type, company, title, description, score, status, detected_at, tenant_id)
         VALUES ($1, $2, $3, $4, $5, 'new', NOW(), $6)
         RETURNING *`,
        [type, company, title, description, score, tenantId],
      );

      const row = result.rows[0];
      const signal: Signal = {
        id: row.id,
        type: row.type as SignalType,
        company: row.company,
        title: row.title,
        description: row.description,
        score: row.score,
        status: (row.status as SignalStatus) ?? "new",
        isRead: row.is_read,
        isStarred: row.is_starred,
        detectedAt: row.detected_at?.toISOString() ?? row.created_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        tenantId: row.tenant_id,
      };

      created.push(signal);

      emitSignalReceived({
        signalId: signal.id,
        accountId: company,
        type: signal.type,
        impactScore: signal.score,
        title: signal.title,
      });

      logger.info({ signalId: signal.id, company, type }, "Mock signal generated");
    }

    return created;
  }

  async generateForAllAccounts(tenantId: string): Promise<Signal[]> {
    const companiesRes = await pool.query<{ company: string }>(
      `SELECT DISTINCT company FROM prospects WHERE tenant_id = $1 AND company IS NOT NULL LIMIT 10`,
      [tenantId],
    );

    const allSignals: Signal[] = [];
    for (const row of companiesRes.rows) {
      const signals = await this.generateMockSignals(row.company, tenantId);
      allSignals.push(...signals);
    }

    if (allSignals.length === 0) {
      const fallbackCompanies = ["TechCorp", "StartupX", "BigSales SAS", "Acme Corp"];
      for (const company of fallbackCompanies) {
        const signals = await this.generateMockSignals(company, tenantId);
        allSignals.push(...signals);
      }
    }

    return allSignals;
  }

  async getSignalsByAccount(company: string, tenantId: string): Promise<Signal[]> {
    const result = await pool.query<{
      id: string; type: string; company: string; title: string; description: string;
      score: number; status: string; is_read: boolean; is_starred: boolean;
      detected_at: Date; created_at: Date; tenant_id: string;
    }>(
      `SELECT * FROM signals WHERE LOWER(company) = LOWER($1) AND tenant_id = $2 ORDER BY created_at DESC`,
      [company, tenantId],
    );
    return result.rows.map(this.mapRow);
  }

  async getGlobalSignals(
    tenantId: string,
    filters?: { type?: string; status?: string; minScore?: number },
  ): Promise<Signal[]> {
    let q = `SELECT * FROM signals WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters?.type) {
      q += ` AND type = $${idx++}`;
      params.push(filters.type);
    }
    if (filters?.status) {
      q += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.minScore !== undefined) {
      q += ` AND score >= $${idx++}`;
      params.push(filters.minScore);
    }

    q += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(q, params);
    return result.rows.map(this.mapRow);
  }

  async updateStatus(id: string, tenantId: string, status: SignalStatus): Promise<Signal | null> {
    const isRead = status === "read" || status === "actioned";
    const result = await pool.query<{
      id: string; type: string; company: string; title: string; description: string;
      score: number; status: string; is_read: boolean; is_starred: boolean;
      detected_at: Date; created_at: Date; tenant_id: string;
    }>(
      `UPDATE signals SET status = $1, is_read = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [status, isRead, id, tenantId],
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: {
    id: string; type: string; company: string; title: string; description: string;
    score: number; status: string; is_read: boolean; is_starred: boolean;
    detected_at: Date; created_at: Date; tenant_id: string;
  }): Signal {
    return {
      id: row.id,
      type: row.type as SignalType,
      company: row.company,
      title: row.title,
      description: row.description,
      score: row.score,
      status: (row.status as SignalStatus) ?? "new",
      isRead: row.is_read,
      isStarred: row.is_starred,
      detectedAt: row.detected_at?.toISOString?.() ?? row.created_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      tenantId: row.tenant_id,
    };
  }
}

export const signalService = new SignalService();
