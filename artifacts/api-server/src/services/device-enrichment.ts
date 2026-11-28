import { captureIdentityMatches } from "../lib/enrichment-identity";
import { randomUUID, createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { CloudBrowserError } from "./cloud-browser";
import { appendCloudResult } from "./cloud-results";
import { targetCaptureReview, applyTargetCapture } from "../routes/v1/sourcing";
import {
  recordDiagnosticEvent,
  errorDiagnosticDetails,
} from "../lib/diagnostics";
import { isProspectIdentityDuplicate } from "../lib/prospect-identity";
export const DEVICE_SOURCES = [
  "societe_com",
  "pappers",
  "pagesjaunes",
  "google_maps",
  "google_search",
  "bing",
] as const;
const reasons: Record<string, string> = {
  SECURITY_CHALLENGE: "La source demande un contrôle de sécurité dans Chrome.",
  CONSENT_REQUIRED: "Un consentement est demandé par la source.",
  PERMISSION_REQUIRED: "Autorisez cette source dans le connecteur Chrome.",
  UNREADABLE: "Aucune fiche lisible sur cette page.",
  NO_RESULTS: "Aucun résultat confirmé pour cette recherche.",
  AMBIGUOUS: "Plusieurs fiches possibles ; comparez le bon établissement.",
  TAB_CLOSED: "L’onglet de collecte a été fermé.",
  USER_NAVIGATION: "L’onglet de collecte a changé ; reprenez explicitement.",
  DEVICE_PAUSED: "La collecte locale est en pause.",
  READER_ERROR: "Le lecteur local n’a pas pu terminer.",
  WEB_REFERENCES:
    "Des liens Web ont été repérés, sans nouvelle coordonnée confirmée.",
};
export const DEVICE_REASONS = Object.keys(reasons) as [string, ...string[]];
export function deviceBusy(job: any) {
  const e = job.result?.deviceExecution;
  return !!(
    e &&
    ["pending", "receiving"].includes(e.state) &&
    Date.parse(e.expiresAt) > Date.now()
  );
}
export function assertDeviceFree(job: any) {
  if (deviceBusy(job))
    throw new CloudBrowserError(
      423,
      "Une collecte locale utilise cette tâche. Arrêtez-la dans GrowthOS avant de reprendre dans le cloud.",
    );
}
export async function devicePlan(
  tenant: string,
  user: string,
  prospectId: string,
  deviceId: string,
  runId: string,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const p = (
      await c.query("SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2", [
        prospectId,
        tenant,
      ])
    ).rows[0];
    if (!p) throw new CloudBrowserError(404, "Prospect introuvable.");
    const parent = (
      await c.query(
        "SELECT * FROM prospect_enrichment_jobs WHERE prospect_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1",
        [prospectId, tenant],
      )
    ).rows[0];
    if (!parent)
      throw new CloudBrowserError(
        409,
        "Lancez d’abord un enrichissement pour préparer les sources.",
      );
    if (["queued", "running"].includes(parent.status))
      throw new CloudBrowserError(
        423,
        "Attendez le bilan de la collecte cloud avant de reprendre les sources localement.",
      );
    if (parent.status === "cancelled")
      throw new CloudBrowserError(
        409,
        "Cet enrichissement est annulé. Lancez un nouvel enrichissement.",
      );
    const ids = Object.values(parent.steps || {})
      .map((s: any) => s.jobId)
      .filter(Boolean);
    const rows = (
      await c.query(
        `SELECT j.*,p.source FROM cloud_browser_jobs j JOIN cloud_browser_profiles p ON p.id=j.profile_id AND p.tenant_id=j.tenant_id WHERE j.id=ANY($1::uuid[]) AND j.tenant_id=$2 AND j.created_by=$3 AND j.prospect_id=$4 AND j.mode='enrich' ORDER BY j.id FOR UPDATE OF j`,
        [ids, tenant, user, prospectId],
      )
    ).rows;
    const jobs = [];
    for (const j of rows) {
      if (
        !DEVICE_SOURCES.includes(j.source) ||
        ["queued", "running", "cancelled"].includes(j.status) ||
        j.result?.applied
      )
        continue;
      const old = j.result?.deviceExecution;
      if (
        old?.runId === runId &&
        old.deviceId === deviceId &&
        old.state === "cancelled"
      )
        throw new CloudBrowserError(
          409,
          "Ce lot local est arrêté. Préparez un nouveau lot.",
        );
      if (deviceBusy(j) && (old.runId !== runId || old.deviceId !== deviceId))
        throw new CloudBrowserError(
          423,
          "Une autre collecte locale est déjà en cours sur ce prospect.",
        );
      if (
        old?.runId === runId &&
        old.deviceId === deviceId &&
        old.state === "received"
      ) {
        jobs.push({
          id: j.id,
          source: j.source,
          query: j.query,
          area: j.area || "",
        });
        continue;
      }
      const result = {
        ...j.result,
        deviceExecution: {
          runId,
          deviceId,
          state: "pending",
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
        message:
          "Lecture sur le navigateur de l’utilisateur en attente d’autorisation Chrome.",
      };
      await c.query(
        "UPDATE cloud_browser_jobs SET status='awaiting_user',result=$2,error=NULL,updated_at=NOW() WHERE id=$1",
        [j.id, JSON.stringify(result)],
      );
      jobs.push({
        id: j.id,
        source: j.source,
        query: j.query,
        area: j.area || "",
      });
    }
    if (!jobs.length)
      throw new CloudBrowserError(
        409,
        "Aucune source à reprendre localement dans ce bilan.",
      );
    await c.query("COMMIT");
    void recordDiagnosticEvent({
      tenantId: tenant,
      userId: user,
      level: "info",
      component: "device-browser",
      code: "DEVICE_RUN_PREPARED",
      message: "Sources préparées pour le navigateur utilisateur",
      prospectId,
      jobId: parent.id,
      details: { sourceCount: jobs.length, executor: "device" },
    });
    return {
      runId,
      deviceId,
      prospect: {
        id: p.id,
        company: p.company || p.siren || p.siret || "Entreprise",
        city: p.city,
        address: p.address,
        phone: p.phone,
        siren: p.siren,
        siret: p.siret,
      },
      jobs: jobs.sort(
        (a, b) =>
          DEVICE_SOURCES.indexOf(a.source) - DEVICE_SOURCES.indexOf(b.source),
      ),
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function cancelDevicePlan(
  tenant: string,
  user: string,
  prospectId: string,
  deviceId: string,
  runId: string,
) {
  const q = await pool.query(
    `UPDATE cloud_browser_jobs SET status='awaiting_user',lease=NULL,lease_until=NULL,result=jsonb_set(result,'{deviceExecution,state}','"cancelled"'),updated_at=NOW() WHERE tenant_id=$1 AND created_by=$2 AND prospect_id=$3 AND result->'deviceExecution'->>'runId'=$4 AND result->'deviceExecution'->>'deviceId'=$5 AND status IN ('awaiting_user','running') AND result->'deviceExecution'->>'state' IN ('pending','receiving') RETURNING id`,
    [tenant, user, prospectId, runId, deviceId],
  );
  void recordDiagnosticEvent({
    tenantId: tenant,
    userId: user,
    level: "info",
    component: "device-browser",
    code: "DEVICE_RUN_STOPPED",
    message: "Collecte locale arrêtée ; preuves déjà reçues conservées",
    prospectId,
    details: { sourceCount: q.rowCount || 0, executor: "device" },
  });
  return { stopped: q.rowCount || 0 };
}
export async function deviceResult(
  tenant: string,
  user: string,
  id: string,
  input: {
    deviceId: string;
    runId: string;
    status: "completed" | "awaiting_user";
    reasonCode?: string;
    captures: unknown[];
    references: { url: string; label: string }[];
  },
) {
  const digest = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex"),
    c = await pool.connect(),
    lease = randomUUID();
  let job: any,
    source: string = "",
    result: any;
  try {
    await c.query("BEGIN");
    job = (
      await c.query(
        "SELECT j.*,p.source FROM cloud_browser_jobs j JOIN cloud_browser_profiles p ON p.id=j.profile_id AND p.tenant_id=j.tenant_id WHERE j.id=$1 AND j.tenant_id=$2 AND j.created_by=$3 FOR UPDATE OF j",
        [id, tenant, user],
      )
    ).rows[0];
    if (!job || job.mode !== "enrich" || !job.prospect_id)
      throw new CloudBrowserError(404, "Tâche cible introuvable.");
    source = job.source;
    const e = job.result?.deviceExecution;
    if (!e || e.runId !== input.runId || e.deviceId !== input.deviceId)
      throw new CloudBrowserError(
        409,
        "La collecte locale a été remplacée. Les résultats restent dans Chrome.",
      );
    if (e.state === "received") {
      if (e.digest !== digest)
        throw new CloudBrowserError(
          409,
          "Un autre résultat a déjà été reçu pour cette étape.",
        );
      await c.query("COMMIT");
      return {
        jobId: id,
        status: job.status,
        alreadyReceived: true,
        applied: !!job.result?.applied,
      };
    }
    if (
      !["pending", "receiving"].includes(e.state) ||
      job.status === "cancelled" ||
      job.result?.applied
    )
      throw new CloudBrowserError(
        409,
        "La collecte locale est arrêtée ou expirée. Les résultats restent dans Chrome.",
      );
    if (job.status === "running" && job.lease && e.state !== "receiving")
      throw new CloudBrowserError(
        423,
        "La tâche est utilisée par un autre exécutant.",
      );
    if (e.digest && e.digest !== digest)
      throw new CloudBrowserError(409, "Le résultat de cette étape a changé.");
    const captures = [];
    for (const raw of input.captures) {
      if (!raw || typeof raw !== "object" || (raw as any).source !== source)
        throw new CloudBrowserError(
          400,
          "La capture appartient à une autre source.",
        );
      const observed = (raw as any).capturedAt;
      if (
        observed !== undefined &&
        (!Number.isSafeInteger(observed) ||
          observed < Date.now() - 24 * 60 * 60_000 ||
          observed > Date.now() + 5 * 60_000)
      )
        throw new CloudBrowserError(
          400,
          "Horodatage de capture invalide ou expiré. Relancez la lecture sur cet appareil.",
        );
      const capture = {
        ...raw,
        id: "task_" + id,
        collectionMode: "visible",
        capturedAt:
          observed === undefined ? Date.now() : Math.min(observed, Date.now()),
      };
      const preview = await targetCaptureReview(
        tenant,
        job.prospect_id,
        capture,
      );
      if (preview.status !== 200)
        throw new CloudBrowserError(
          400,
          "Capture locale invalide. Ouvrez une fiche de la source choisie.",
        );
      captures.push(capture);
    }
    result = appendCloudResult(
      {
        ...job.result,
        captures: [],
        drafts: [],
        captureHistory: [
          ...(job.result?.captureHistory || []),
          ...(job.result?.captures || []),
        ].slice(-20),
      },
      {
        results: captures,
        references: input.references,
        message:
          reasons[input.reasonCode || ""] ||
          "Lecture locale terminée ; comparaison d’identité en cours.",
      },
      id,
      source,
      true,
    );
    for (const entry of result.captures) {
      const original = captures.find(
        (c) =>
          c.company === entry.company &&
          c.sourceUrl === entry.sourceUrl &&
          c.siret === entry.siret,
      );
      if (original) entry.capturedAt = original.capturedAt;
    }
    result.deviceExecution = { ...e, state: "receiving", digest };
    await c.query(
      "UPDATE cloud_browser_jobs SET status='running',result=$2,lease=$3,lease_until=NOW()+INTERVAL '2 minutes',error=NULL,updated_at=NOW() WHERE id=$1",
      [id, JSON.stringify(result), lease],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  let status =
      input.status === "awaiting_user"
        ? "awaiting_user"
        : result.captures.length
          ? "needs_review"
          : "completed",
    applied = false;
  try {
    const prospect = (
      await pool.query("SELECT * FROM prospects WHERE id=$1 AND tenant_id=$2", [
        job.prospect_id,
        tenant,
      ])
    ).rows[0];
    const matches = prospect
      ? result.captures.filter(
          (c: any) =>
            captureIdentityMatches(prospect, c) ||
            (["societe_com", "pappers"].includes(source) &&
              c.companyDetails &&
              /^\d{14}$/.test(prospect.siret || "") &&
              /^\d{14}$/.test(c.siret || "") &&
              c.siret.slice(0, 9) === prospect.siret.slice(0, 9)),
        )
      : [];
    const selected =
      matches.length === 1
        ? matches[0]
        : result.captures.length === 1
          ? result.captures[0]
          : null;
    if (input.status === "completed" && selected) {
      const receipt = {
        ...result,
        captures: [selected],
        captureHistory: [
          ...result.captureHistory,
          ...result.captures.filter((c: any) => c !== selected),
        ].slice(-20),
        deviceExecution: {
          ...result.deviceExecution,
          state: "received",
          receivedAt: new Date().toISOString(),
        },
      };
      const saved = await applyTargetCapture(
        tenant,
        user,
        job.prospect_id,
        id,
        selected,
        true,
        { lease, result: receipt },
      );
      if (saved.status === 200) {
        applied = true;
        status = "completed";
      } else
        result.message =
          "error" in saved ? saved.error : "Vérifiez le bon établissement.";
    } else if (result.captures.length > 1) result.message = reasons.AMBIGUOUS;
  } catch (error) {
    status = "needs_review";
    result.message = isProspectIdentityDuplicate(error)
      ? "Un identifiant est déjà présent dans le CRM. Comparez les dossiers avant de continuer."
      : "La capture est conservée ; l’enregistrement CRM doit être vérifié.";
    void recordDiagnosticEvent({
      tenantId: tenant,
      userId: user,
      component: "device-browser",
      code: isProspectIdentityDuplicate(error)
        ? "DEVICE_IDENTITY_CONFLICT"
        : "DEVICE_SAVE_FAILED",
      level: isProspectIdentityDuplicate(error) ? "warn" : "error",
      message: "Capture locale conservée après échec CRM",
      source,
      prospectId: job.prospect_id,
      jobId: id,
      details: errorDiagnosticDetails(error),
    });
  }
  if (!applied) {
    result.deviceExecution = {
      ...result.deviceExecution,
      state: "received",
      receivedAt: new Date().toISOString(),
    };
    const q = await pool.query(
      "UPDATE cloud_browser_jobs SET status=$3,result=$4,lease=NULL,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status='running' AND lease=$5 RETURNING id",
      [id, tenant, status, JSON.stringify(result), lease],
    );
    if (!q.rowCount)
      throw new CloudBrowserError(
        409,
        "La tâche a été arrêtée pendant la réception. Les résultats restent dans Chrome.",
      );
  }
  void recordDiagnosticEvent({
    tenantId: tenant,
    userId: user,
    component: "device-browser",
    code: applied ? "DEVICE_CAPTURE_APPLIED" : "DEVICE_RESULT_RECEIVED",
    level:
      status === "awaiting_user" || status === "needs_review" ? "warn" : "info",
    message: applied
      ? "Données locales rapprochées et enregistrées"
      : "Résultat de lecture locale enregistré",
    source,
    prospectId: job.prospect_id,
    jobId: id,
    details: {
      status,
      executor: "device",
      reasonCode: input.reasonCode || null,
      resultCount: result.captures.length,
      referenceCount: result.references?.length || 0,
    },
  });
  return { jobId: id, status, applied };
}
