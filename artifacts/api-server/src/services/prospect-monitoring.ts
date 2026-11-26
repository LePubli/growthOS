import { randomUUID } from "node:crypto";
import { pool, activityLabel } from "@workspace/db";
import { publishNotification } from "./notification.service";
import { logger } from "../lib/logger";
import {changeDescription,prospectFieldLabels,type FieldChanges} from '../lib/prospect-change-history';

type RecordData = Record<string, any>;
export type CompanySnapshot = {
  siren: string;
  requestedSiret: string | null;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  fields: Record<string, string | null>;
  managers: string[];
  financials: string[];
  establishments: {
    siret: string;
    address: string | null;
    status: string | null;
    activity: string | null;
  }[];
};
type Prospect = {
  [key:string]:any;
  id: string;
  tenant_id: string;
  siren: string | null;
  siret: string | null;
  company: string | null;
};
type Watch = {
  enabled: boolean;
  interval_hours: number;
  checked_at: Date | null;
  next_check_at: Date;
  last_attempt_at: Date | null;
  last_error: string | null;
  snapshot: CompanySnapshot | null;
  lease_token: string | null;
};
export class MonitoringError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 1000)
    : null;
const number = (value: unknown): string | null =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : null;
const status = (value: unknown, establishment = false) =>
  value === "A"
    ? "Active"
    : value === (establishment ? "F" : "C")
      ? establishment
        ? "Fermé"
        : "Cessée"
      : null;
const records = (value: unknown): RecordData[] =>
  Array.isArray(value)
    ? value.filter((v) => v && typeof v === "object" && !Array.isArray(v))
    : [];

// Libellés du référentiel Annuaire des Entreprises, tranches-effectifs.json.
const employeeLabels: Record<string, string> = {
  NN: "Unité non employeuse (année de référence)",
  "00": "0 salarié au 31 décembre, avec salariés en cours d’année",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

export function companySnapshot(
  legal: RecordData,
  requestedSiret: string | null,
): CompanySnapshot {
  const sites = records(legal.matching_etablissements);
  if (legal.siege?.siret && !sites.some((s) => s.siret === legal.siege.siret))
    sites.push(legal.siege);
  const local = requestedSiret
    ? sites.find((s) => s.siret === requestedSiret)
    : null;
  const managers = records(legal.dirigeants)
    .map((person) =>
      [
        text(person.denomination) ||
          [text(person.prenoms), text(person.nom)].filter(Boolean).join(" "),
        text(person.qualite),
      ]
        .filter(Boolean)
        .join(" · "),
    )
    .filter(Boolean)
    .sort()
    .slice(0, 50);
  const finances =
    legal.finances &&
    typeof legal.finances === "object" &&
    !Array.isArray(legal.finances)
      ? legal.finances
      : {};
  const financials = Object.entries(finances)
    .filter(([year]) => /^\d{4}$/.test(year))
    .sort()
    .reverse()
    .slice(0, 5)
    .flatMap(([year, data]) => {
      const row = data && typeof data === "object" ? (data as RecordData) : {};
      const ca = number(row.ca),
        result = number(row.resultat_net);
      return ca !== null || result !== null
        ? [
            `${year} · CA ${ca === null ? "non communiqué" : Number(ca).toLocaleString("fr-FR") + " €"} · résultat net ${result === null ? "non communiqué" : Number(result).toLocaleString("fr-FR") + " €"}`,
          ]
        : [];
    });
  const ape = text(legal.activite_principale);
  return {
    siren: legal.siren,
    requestedSiret,
    sourceUrl:
      "https://annuaire-entreprises.data.gouv.fr/entreprise/" + legal.siren,
    sourceUpdatedAt:
      text(legal.date_mise_a_jour_insee) || text(legal.date_mise_a_jour),
    fields: {
      Dénomination: text(legal.nom_complet) || text(legal.nom_raison_sociale),
      "État de l’entreprise": status(legal.etat_administratif),
      "État de l’établissement": local
        ? status(local.etat_administratif, true)
        : null,
      "SIRET contrôlé": local ? text(local.siret) : null,
      "Adresse de l’établissement": local ? text(local.adresse) : null,
      "Code postal de l’établissement": local ? text(local.code_postal) : null,
      "Ville de l’établissement": local ? text(local.libelle_commune) : null,
      "Adresse du siège": text(legal.siege?.adresse),
      "Code APE de l’entreprise": ape,
      "Activité de l’entreprise": activityLabel(ape),
      "Code APE de l’établissement": text(local?.activite_principale),
      "Nomenclature de l’activité": text(local?.nomenclature_activite_principale) || (!requestedSiret?text(legal.nomenclature_activite_principale):null),
      "Activité de l’établissement": activityLabel(
        text(local?.activite_principale),
      ),
      "Catégorie juridique · code": text(legal.nature_juridique),
      "Date de création": text(legal.date_creation),
      "Date de cessation de l’entreprise": text(legal.date_fermeture),
      "Date de fermeture de l’établissement": text(local?.date_fermeture),
      "Catégorie d’entreprise": text(legal.categorie_entreprise),
      "Effectif · tranche Insee": text(legal.tranche_effectif_salarie),
      "Effectif salarié":
        employeeLabels[String(legal.tranche_effectif_salarie)] || null,
      "Année de l’effectif":
        number(legal.annee_tranche_effectif_salarie) ||
        text(legal.annee_tranche_effectif_salarie),
      "Nombre d’établissements": number(legal.nombre_etablissements),
      "Établissements ouverts": number(legal.nombre_etablissements_ouverts),
      "Numéro de TVA": text(legal.tva),
      "Opposition à la diffusion commerciale":
        legal.opposition_diffusion_commerciale === true
          ? "Oui"
          : legal.opposition_diffusion_commerciale === false
            ? "Non"
            : null,
    },
    managers,
    financials,
    establishments: sites
      .filter(
        (s) =>
          /^\d{14}$/.test(s.siret || "") && s.siret.startsWith(legal.siren),
      )
      .slice(0, 30)
      .map((s) => ({
        siret: s.siret,
        address: text(s.adresse),
        status: status(s.etat_administratif, true),
        activity: text(s.activite_principale),
      }))
      .sort((a, b) => a.siret.localeCompare(b.siret)),
  };
}

export function snapshotChanges(
  before: CompanySnapshot,
  after: CompanySnapshot,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  if (
    before.siren !== after.siren ||
    before.requestedSiret !== after.requestedSiret
  )
    return changes;
  for (const [field, value] of Object.entries(after.fields)) {
    if (
      value !== null &&
      before.fields[field] !== undefined &&
      before.fields[field] !== value
    )
      changes[field] = { before: before.fields[field], after: value };
  }
  for (const field of ["managers", "financials"] as const) {
    if (
      after[field].length &&
      JSON.stringify(before[field]) !== JSON.stringify(after[field])
    )
      changes[field === "managers" ? "Dirigeants" : "Données financières"] = {
        before: before[field],
        after: after[field],
      };
  }
  return changes;
}

async function prospect(tenantId: string, id: string): Promise<Prospect> {
  const { rows } = await pool.query<Prospect>(
    "SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2",
    [id, tenantId],
  );
  if (!rows[0]) throw new MonitoringError(404, "Prospect introuvable");
  return rows[0];
}
async function ensureWatch(p: Prospect) {
  await pool.query(
    "INSERT INTO prospect_monitoring(prospect_id,tenant_id) VALUES($1,$2) ON CONFLICT(prospect_id) DO NOTHING",
    [p.id, p.tenant_id],
  );
}
export async function monitoringState(tenantId: string, id: string) {
  const p = await prospect(tenantId, id);
  const { rows } = await pool.query<Watch>(
    "SELECT * FROM prospect_monitoring WHERE prospect_id=$1 AND tenant_id=$2",
    [id, tenantId],
  );
  const events = await pool.query(
    'SELECT id,detected_at AS "detectedAt",changes,source_url AS "sourceUrl" FROM prospect_changes WHERE prospect_id=$1 AND tenant_id=$2 ORDER BY detected_at DESC,id DESC LIMIT 30',
    [id, tenantId],
  );
  const w = rows[0];
  if (
    w?.snapshot &&
    (w.snapshot.siren !== (p.siren || p.siret?.slice(0, 9)) ||
      w.snapshot.requestedSiret !== p.siret)
  ) {
    w.snapshot = null;
    w.checked_at = null;
  }
  return {
    enabled: w?.enabled ?? false,
    intervalHours: w?.interval_hours ?? 24,
    checkedAt: w?.checked_at ?? null,
    nextCheckAt: w?.enabled ? w.next_check_at : null,
    lastAttemptAt: w?.last_attempt_at ?? null,
    error: w?.last_error ?? null,
    snapshot: w?.snapshot ?? null,
    changes: events.rows,
    lastSync:p.source_details?.officialSync || null,
  };
}
export async function configureMonitoring(
  tenantId: string,
  id: string,
  enabled: boolean,
  intervalHours: number,
) {
  const p = await prospect(tenantId, id);
  if (enabled && !/^\d{9}$/.test(p.siren || p.siret?.slice(0, 9) || ""))
    throw new MonitoringError(
      422,
      "Un SIREN ou SIRET vérifié est nécessaire pour activer la veille.",
    );
  await ensureWatch(p);
  await pool.query(
    `UPDATE prospect_monitoring SET enabled=$3,interval_hours=$4,
    next_check_at=CASE WHEN $3 THEN COALESCE(checked_at+$4::integer*INTERVAL '1 hour',NOW()) ELSE next_check_at END
    WHERE prospect_id=$1 AND tenant_id=$2`,
    [id, tenantId, enabled, intervalHours],
  );
  return monitoringState(tenantId, id);
}
async function directorySnapshot(p: Prospect): Promise<CompanySnapshot> {
  const siren = p.siren || p.siret?.slice(0, 9) || "";
  if (!/^\d{9}$/.test(siren))
    throw new MonitoringError(
      422,
      "Renseignez un SIREN ou SIRET vérifié pour contrôler cette entreprise.",
    );
  const endpoint =
    process.env.GROWTHOS_SMOKE_TEST === "true" &&
    process.env.COMPANY_DIRECTORY_API_URL
      ? process.env.COMPANY_DIRECTORY_API_URL
      : "https://recherche-entreprises.api.gouv.fr/search";
  const url = new URL(endpoint);
  url.searchParams.set("q", p.siret || siren);
  url.searchParams.set("per_page", "1");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok)
    throw new MonitoringError(
      502,
      "L’Annuaire officiel est indisponible. Le dernier statut connu est conservé.",
    );
  const body = await response.text();
  if (body.length > 1500000)
    throw new MonitoringError(
      502,
      "La réponse de l’Annuaire dépasse la taille acceptée.",
    );
  const legal = records(JSON.parse(body).results).find(
    (item) => item.siren === siren,
  );
  if (!legal)
    throw new MonitoringError(
      502,
      "Aucune réponse officielle ne confirme ce SIREN. Le statut reste à vérifier.",
    );
  return companySnapshot(legal, p.siret);
}
export async function verifyProspect(
  tenantId: string,
  id: string,
  force = false,
) {
  const p = await prospect(tenantId, id);
  if (!/^\d{9}$/.test(p.siren || p.siret?.slice(0, 9) || ""))
    throw new MonitoringError(
      422,
      "Renseignez un SIREN ou SIRET vérifié pour contrôler cette entreprise.",
    );
  await ensureWatch(p);
  const token = randomUUID();
  const claimed = await pool.query(
    `UPDATE prospect_monitoring SET lease_token=$3,lease_until=NOW()+INTERVAL '90 seconds',last_attempt_at=NOW()
    WHERE prospect_id=$1 AND tenant_id=$2 AND (lease_until IS NULL OR lease_until<NOW())
    AND (snapshot IS NULL OR snapshot->>'siren'<>$5 OR COALESCE(snapshot->>'requestedSiret','')<>$6 OR $4 OR checked_at<NOW()-INTERVAL '1 minute')
    AND (last_attempt_at IS NULL OR last_attempt_at<NOW()-INTERVAL '1 minute') RETURNING prospect_id`,
    [
      id,
      tenantId,
      token,
      force,
      p.siren || p.siret?.slice(0, 9),
      p.siret || "",
    ],
  );
  if (!claimed.rowCount) return monitoringState(tenantId, id);
  let connection;
  let notification: Record<string, unknown> | undefined;
  try {
    const snapshot = await directorySnapshot(p);
    connection = await pool.connect();
    await connection.query("BEGIN");
    const current = await connection.query<Prospect>(
      "SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
      [id, tenantId],
    );
    if (
      !current.rows[0] ||
      current.rows[0].siren !== p.siren ||
      current.rows[0].siret !== p.siret
    )
      throw new MonitoringError(
        409,
        "L’identité du prospect a changé pendant la vérification. Relancez le contrôle.",
      );
    const locked = await connection.query<Watch>(
      "SELECT * FROM prospect_monitoring WHERE prospect_id=$1 AND tenant_id=$2 AND lease_token=$3 FOR UPDATE",
      [id, tenantId, token],
    );
    const watch = locked.rows[0];
    if (!watch)
      throw new MonitoringError(
        409,
        "Une autre vérification est déjà en cours.",
      );
    if(watch.snapshot?.sourceUpdatedAt && snapshot.sourceUpdatedAt &&
      Date.parse(snapshot.sourceUpdatedAt)<Date.parse(watch.snapshot.sourceUpdatedAt))
      throw new MonitoringError(502,'La source a renvoyé une version plus ancienne. Les dernières données sont conservées.');
    const sourceChanges = watch.snapshot
      ? snapshotChanges(watch.snapshot, snapshot)
      : {};
    const live=current.rows[0];
    const synced:FieldChanges={};
    if(watch.enabled){
      const exactSite=!!(p.siret && snapshot.fields['SIRET contrôlé']===p.siret);
      const ape=exactSite?snapshot.fields['Code APE de l’établissement']:!p.siret?snapshot.fields['Code APE de l’entreprise']:null;
      const desired:Record<string,string|null>={company:snapshot.fields['Dénomination']?.slice(0,160)||null,siren:snapshot.siren,
        ...(exactSite?{address:snapshot.fields['Adresse de l’établissement']?.slice(0,320)||null,
          postalCode:/^\d{5}$/.test(snapshot.fields['Code postal de l’établissement']||'')?snapshot.fields['Code postal de l’établissement']:null,
          city:snapshot.fields['Ville de l’établissement']?.slice(0,120)||null}:{}),
        ...(/^\d{2}\.\d{2}[A-Z]$/.test(ape||'')?{apeCode:ape,nafLabel:activityLabel(ape)?.slice(0,250)||null,
          nafVersion:snapshot.fields['Nomenclature de l’activité']?.slice(0,32)||null}:{})};
      const columns:Record<string,string>={company:'company',siren:'siren',address:'address',postalCode:'postal_code',city:'city',apeCode:'ape_code',nafLabel:'naf_label',nafVersion:'naf_version'};
      for(const [field,value] of Object.entries(desired))if(value && value!==(live[columns[field]]||null))
        synced[field]={before:live[columns[field]]||null,after:value};
      if(Object.keys(synced).length || Object.keys(sourceChanges).length){
        const details=live.source_details && typeof live.source_details==='object'?live.source_details:{};
        const cross=details.crossSource && typeof details.crossSource==='object'?details.crossSource:{};
        const fieldSources={...cross.fieldSources};
        const appliedAt=new Date().toISOString();
        for(const field of Object.keys(synced))fieldSources[field]={source:'entreprises',sourceUrl:snapshot.sourceUrl,capturedAt:appliedAt,automatic:true};
        const previousConflicts=Array.isArray(cross.conflicts)?cross.conflicts:[];
        const superseded=previousConflicts.filter((c:RecordData)=>c.field in synced);
        const nextDetails={...details,officialSync:{appliedAt,sourceUrl:snapshot.sourceUrl,sourceUpdatedAt:snapshot.sourceUpdatedAt,
          fields:[...Object.keys(synced).map(f=>prospectFieldLabels[f]||f),...Object.keys(sourceChanges)]},crossSource:{...cross,fieldSources,
          conflicts:previousConflicts.filter((c:RecordData)=>!(c.field in synced)),
          resolutions:[...(Array.isArray(cross.resolutions)?cross.resolutions:[]),...superseded.map((c:RecordData)=>({...c,decision:'official_update',resolvedAt:appliedAt}))].slice(-80)}};
        const values:unknown[]=[id,tenantId,JSON.stringify(nextDetails)];
        const assignments=['source_details=$3','updated_at=NOW()'];
        for(const [field,change] of Object.entries(synced)){values.push(change.after);assignments.push(columns[field]+'=$'+values.length);}
        if(['address','postalCode','city'].some(field=>field in synced))assignments.push('lat=NULL','lng=NULL');
        await connection.query('UPDATE prospects SET '+assignments.join(',')+' WHERE id=$1 AND tenant_id=$2',values);
      }
    }
    const changes:FieldChanges={...sourceChanges,...Object.fromEntries(Object.entries(synced).map(([field,change])=>['Fiche · '+(prospectFieldLabels[field]||field),change]))};
    if (Object.keys(changes).length) {
      const eventId = randomUUID();
      await connection.query(
        "INSERT INTO prospect_changes(id,prospect_id,tenant_id,changes,source_url) VALUES($1,$2,$3,$4,$5)",
        [eventId, id, tenantId, JSON.stringify(changes), snapshot.sourceUrl],
      );
      await connection.query(`INSERT INTO activities(type,title,description,status,done_at,prospect_id,tenant_id)
        VALUES('data_update',$1,$2,'done',NOW(),$3,$4)`,[
        watch.enabled?'Mise à jour automatique · veille officielle':'Changements détectés · contrôle officiel',
        changeDescription('Annuaire des entreprises',snapshot.sourceUrl,changes,
          watch.enabled?'Veille activée : données officielles mises à jour automatiquement. Les coordonnées non publiées restent conservées.':'Changements détectés dans la source. Veille désactivée : les champs CRM sont conservés.',snapshot.sourceUpdatedAt||undefined),
        id,tenantId,
      ]);
      if (watch.enabled) {
        const saved = await connection.query(
          `INSERT INTO notifications(type,title,body,href,payload,tenant_id)
        VALUES('system',$1,$2,$3,$4,$5) RETURNING id,type,title,body,href,payload,read,created_at AS "createdAt"`,
          [
            "Changement chez " + (p.company || snapshot.siren),
            Object.keys(changes).join(", "),
            "/prospects/" + id,
            JSON.stringify({ prospectId: id, eventId }),
            tenantId,
          ],
        );
        notification = saved.rows[0];
      }
    }
    await connection.query(
      `UPDATE prospect_monitoring SET snapshot=$4,checked_at=NOW(),last_error=NULL,
      next_check_at=NOW()+interval_hours*INTERVAL '1 hour',lease_token=NULL,lease_until=NULL
      WHERE prospect_id=$1 AND tenant_id=$2 AND lease_token=$3`,
      [id, tenantId, token, JSON.stringify(snapshot)],
    );
    await connection.query("COMMIT");
    if (notification) publishNotification(tenantId, notification);
  } catch (err) {
    if (connection) await connection.query("ROLLBACK");
    await pool.query(
      `UPDATE prospect_monitoring SET lease_token=NULL,lease_until=NULL,last_error=$4,next_check_at=NOW()+INTERVAL '15 minutes'
      WHERE prospect_id=$1 AND tenant_id=$2 AND lease_token=$3`,
      [
        id,
        tenantId,
        token,
        err instanceof MonitoringError
          ? err.message
          : "La vérification officielle a échoué. Le dernier résultat reste consultable.",
      ],
    );
  } finally {
    connection?.release();
  }
  return monitoringState(tenantId, id);
}
let ticking = false;
export async function runProspectWatch() {
  if (ticking) return;
  ticking = true;
  try {
    const due =
      await pool.query(`SELECT m.prospect_id,m.tenant_id FROM prospect_monitoring m JOIN prospects p
      ON p.id=m.prospect_id AND p.tenant_id=m.tenant_id
      WHERE m.enabled AND m.next_check_at<=NOW() AND (m.lease_until IS NULL OR m.lease_until<NOW())
      ORDER BY m.next_check_at LIMIT 20`);
    for (const row of due.rows) {
      await verifyProspect(row.tenant_id, row.prospect_id, true);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    ticking = false;
  }
}
export function startProspectWatch() {
  if (process.env.GROWTHOS_SMOKE_TEST === "true") return;
  const tick = () =>
    runProspectWatch().catch((err) =>
      logger.error({ err }, "Prospect watch failed"),
    );
  void tick();
  setInterval(tick, 60000).unref();
}
