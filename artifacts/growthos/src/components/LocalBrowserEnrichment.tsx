import { useEffect, useRef, useState } from "react";
import { Monitor, Loader2, Square, RotateCw } from "lucide-react";
import apiClient from "@/lib/api-client";
import {
  isMobileConnectorRequired,
  localDeviceCommand,
  pingLocalPagesJaunes,
} from "@/lib/pagesjaunes-device";
type DeviceRun = {
  runId: string;
  deviceId: string;
  status: string;
  prospect: { id: string; company: string };
  jobs: {
    id: string;
    source: string;
    state: string;
    acked?: boolean;
    receipt?: { status: string; applied?: boolean };
    outcome?: {
      status: "completed" | "awaiting_user";
      reasonCode?: string;
      captures: unknown[];
      references: { url: string; label: string }[];
    };
  }[];
};
export function LocalBrowserEnrichment({
  prospectId,
  paused,
  onSaved,
  onReview,
}: {
  prospectId: string;
  paused: boolean;
  onSaved?: () => Promise<void>;
  onReview?: (jobId: string, source: string) => void;
}) {
  const [run, setRun] = useState<DeviceRun | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [preparation, setPreparation] = useState<{
    runId: string;
    deviceId: string;
  } | null>(null);
  const contextKey = "growthos-device-preparation:" + prospectId;
  const clearPreparation = (id: string) => {
    try {
      const previous = JSON.parse(localStorage.getItem(contextKey) || "null");
      if (previous?.runId === id) localStorage.removeItem(contextKey);
    } catch {}
    setPreparation((p) => (p?.runId === id ? null : p));
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(contextKey) || "null");
      if (saved?.runId && saved.deviceId) setPreparation(saved);
    } catch {}
  }, [contextKey]);
  const flight = useRef(false),
    retryAfter = useRef(0),
    stopped = useRef(""),
    callbacks = useRef({ onSaved });
  callbacks.current = { onSaved };
  useEffect(() => {
    if (isMobileConnectorRequired()) return;
    let alive = true;
    const tick = async () => {
      if (flight.current || Date.now() < retryAfter.current) return;
      flight.current = true;
      try {
        const current = (await localDeviceCommand("device-get"))
          .deviceRun as DeviceRun | null;
        if (!current || current.prospect.id !== prospectId) return;
        if (alive) setRun(current);
        if (current.status === "cancelled") {
          if (stopped.current !== current.runId) {
            await apiClient.post("/browser/device-stop", {
              prospectId,
              runId: current.runId,
              deviceId: current.deviceId,
            });
            stopped.current = current.runId;
          }
          return;
        }
        if (current.status === "finished" && current.jobs.every((j) => j.acked))
          clearPreparation(current.runId);
        for (const job of current.jobs.filter(
          (j) => j.state === "ready" && !j.acked && j.outcome,
        )) {
          const receipt = await apiClient.post<any>(
            "/browser/jobs/" + job.id + "/device-result",
            {
              ...job.outcome,
              runId: current.runId,
              deviceId: current.deviceId,
            },
          );
          const acknowledged = await localDeviceCommand("device-ack", {
            runId: current.runId,
            jobId: job.id,
            receipt,
          });
          if (alive) {
            setRun(acknowledged.deviceRun);
            setError("");
          }
          void callbacks.current.onSaved?.().catch(() => {});
        }
      } catch (e) {
        if (alive && run) {
          setError(
            e instanceof Error
              ? e.message
              : "Synchronisation locale impossible.",
          );
          retryAfter.current = Date.now() + 15000;
        }
      } finally {
        flight.current = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [prospectId, !!run]);
  const start = async () => {
    setBusy(true);
    setError("");
    let plan: DeviceRun | null = null;
    try {
      const extension = await pingLocalPagesJaunes(),
        version = (extension.version || "").split(".").map(Number);
      if (version[0] === 0 && !(version[1] >= 12))
        throw Error(
          "Installez le connecteur Chrome 0.12.0 ou plus récent, rechargez l’extension puis GrowthOS.",
        );
      const deviceId =
        localStorage.getItem("growthos-device-id") || crypto.randomUUID();
      localStorage.setItem("growthos-device-id", deviceId);
      let context: { runId: string; deviceId: string } | null = null;
      try {
        context = JSON.parse(localStorage.getItem(contextKey) || "null");
      } catch {}
      if (!context || context.deviceId !== deviceId)
        context = { deviceId, runId: crypto.randomUUID() };
      localStorage.setItem(contextKey, JSON.stringify(context));
      setPreparation(context);
      plan = await apiClient.post<DeviceRun>("/browser/device-plan", {
        prospectId,
        ...context,
      });
      const response = await localDeviceCommand("device-begin", plan);
      setRun(response.deviceRun);
      setMessage(
        "Autorisez les sources dans l’onglet du connecteur qui vient de s’ouvrir. Les résultats seront synchronisés ici.",
      );
    } catch (e) {
      if (plan) {
        void localDeviceCommand("device-cancel", { runId: plan.runId }).catch(
          () => {},
        );
        void apiClient
          .post("/browser/device-stop", {
            prospectId,
            deviceId: plan.deviceId,
            runId: plan.runId,
          })
          .catch(() => {});
        clearPreparation(plan.runId);
      }
      setError(e instanceof Error ? e.message : "Lancement local impossible.");
    } finally {
      setBusy(false);
    }
  };
  const stop = async (requested?: { runId: string; deviceId: string }) => {
    const target = requested || run || preparation;
    if (!target) return;
    setBusy(true);
    try {
      if (run && run.runId === target.runId)
        await localDeviceCommand("device-cancel", { runId: run.runId });
      await apiClient.post("/browser/device-stop", {
        prospectId,
        deviceId: target.deviceId,
        runId: target.runId,
      });
      if (run && run.runId === target.runId)
        setRun({ ...run, status: "cancelled" });
      stopped.current = target.runId;
      clearPreparation(target.runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arrêt impossible.");
    } finally {
      setBusy(false);
    }
  };
  const active =
    !!run && ["running", "permission_required"].includes(run.status);
  return (
    <section
      className="atlas-360-detail-module rounded-2xl border p-4 space-y-3"
      aria-label="Collecte sur cet appareil"
    >
      <h3 className="font-semibold flex gap-2 items-center">
        <Monitor size={18} /> Collecte dans mon navigateur
      </h3>
      <p className="text-sm">
        Reprendre les sources du dernier bilan dans Chrome ou Edge sur cet
        ordinateur, avec ses sessions. Gardez GrowthOS ouvert pour synchroniser
        les résultats.
      </p>
      {isMobileConnectorRequired() ? (
        <p>
          Ce mode nécessite Chrome ou Edge avec l’extension sur ordinateur. Le
          navigateur cloud reste disponible sur téléphone.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="atlas-enrichments-primary"
            disabled={busy || paused || active}
            onClick={() => void start()}
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Monitor size={15} />
            )}{" "}
            Reprendre les sources sur cet appareil
          </button>
          {!isMobileConnectorRequired() && (
            <button
              type="button"
              className="atlas-360-link-button atlas-360-link-button-secondary"
              onClick={() =>
                void (async () => {
                  const current =
                    run || (await localDeviceCommand("device-get")).deviceRun;
                  if (!current)
                    throw Error(
                      "Aucun lot local disponible. Lancez la reprise depuis cette fiche.",
                    );
                  await localDeviceCommand("device-show", {
                    runId: current.runId,
                  });
                })().catch((e) => setError(e.message))
              }
            >
              Ouvrir les commandes Chrome
            </button>
          )}
          {preparation && preparation.runId !== run?.runId && (
            <button
              type="button"
              className="atlas-360-link-button atlas-360-link-button-secondary"
              disabled={busy}
              onClick={() => void stop(preparation)}
            >
              Arrêter la préparation locale
            </button>
          )}
          {run &&
            run.status !== "cancelled" &&
            (active || run.jobs.some((j) => !j.acked)) && (
              <button
                type="button"
                className="atlas-360-link-button atlas-360-link-button-secondary"
                disabled={busy}
                onClick={() => void stop()}
              >
                <Square size={13} /> Arrêter la collecte locale
              </button>
            )}
        </>
      )}
      {paused && (
        <p className="text-sm">
          Attendez la fin de la collecte cloud avant de reprendre localement.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {run && (
        <>
          <p role="status">
            {run.status === "permission_required"
              ? "Autorisation requise dans le connecteur"
              : run.status === "running"
                ? "Lecture locale en cours"
                : run.status === "cancelled"
                  ? "Collecte locale arrêtée"
                  : "Lectures locales terminées"}{" "}
            · {run.jobs.filter((j) => j.acked).length}/{run.jobs.length}{" "}
            résultat(s) reçu(s) par GrowthOS.
          </p>
          <ul>
            {run.jobs.map((job) => (
              <li key={job.id} className="text-sm">
                {job.source.replaceAll("_", " ")} ·{" "}
                {job.acked
                  ? job.receipt?.applied
                    ? "Enregistré"
                    : job.receipt?.status === "needs_review"
                      ? "À comparer"
                      : "Bilan reçu"
                  : job.state === "reading"
                    ? "Lecture en cours"
                    : job.state === "ready"
                      ? "À synchroniser"
                      : "En attente"}{" "}
                {job.acked && job.receipt?.status === "needs_review" && (
                  <button
                    type="button"
                    className="atlas-360-link-button atlas-360-link-button-secondary"
                    onClick={() => onReview?.(job.id, job.source)}
                  >
                    Comparer la capture
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="atlas-360-link-button atlas-360-link-button-secondary"
            onClick={() => {
              retryAfter.current = 0;
              setError("");
            }}
          >
            <RotateCw size={13} /> Réessayer la synchronisation
          </button>
        </div>
      )}
    </section>
  );
}
