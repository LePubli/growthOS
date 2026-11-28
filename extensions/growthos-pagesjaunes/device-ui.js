const el = (id) => document.getElementById(id);
let deviceRun = null;
const names = {
  societe_com: "Societe.com",
  pappers: "Pappers",
  pagesjaunes: "PagesJaunes",
  google_maps: "Google Maps",
  google_search: "Google Search",
  bing: "Bing",
};
const origins = {
  societe_com: ["https://www.societe.com/*", "https://societe.com/*"],
  pappers: ["https://www.pappers.fr/*", "https://pappers.fr/*"],
  pagesjaunes: ["https://www.pagesjaunes.fr/*", "https://pagesjaunes.fr/*"],
  google_maps: [
    "https://www.google.com/*",
    "https://google.com/*",
    "https://maps.google.com/*",
    "https://www.google.fr/*",
    "https://google.fr/*",
  ],
  google_search: [
    "https://www.google.com/*",
    "https://google.com/*",
    "https://www.google.fr/*",
    "https://google.fr/*",
  ],
  bing: ["https://www.bing.com/*", "https://bing.com/*"],
};
const reasons = {
  SECURITY_CHALLENGE: "Contrôle de sécurité : ouvrez la source.",
  CONSENT_REQUIRED: "Consentement demandé sur la source.",
  PERMISSION_REQUIRED: "Autorisation de lecture nécessaire.",
  AMBIGUOUS: "Le bon établissement doit être choisi.",
  NO_RESULTS: "Aucun résultat confirmé.",
  UNREADABLE: "Page non lisible.",
  TAB_CLOSED: "Onglet fermé.",
  USER_NAVIGATION: "Navigation changée.",
  READER_ERROR: "Lecture interrompue.",
  WEB_REFERENCES: "Liens Web repérés.",
};
async function send(action, payload = {}) {
  const r = await chrome.runtime.sendMessage({ action, payload });
  if (!r?.ok) throw Error(r?.error || "Connecteur indisponible.");
  return r;
}
function render(run) {
  deviceRun = run;
  if (!run) {
    el("status").textContent =
      "Lancez une collecte depuis la fiche prospect GrowthOS.";
    el("authorize").hidden = true;
    el("stop").hidden = true;
    return;
  }
  el("company").textContent = run.prospect.company;
  el("back").href =
    "https://agile.le-publicitaire.fr/prospects/" +
    run.prospect.id +
    "?view=enrichments";
  el("status").textContent =
    {
      permission_required: "Autorisation requise pour les sources de ce lot.",
      running: "Lecture des sources sur cet appareil…",
      finished:
        "Lectures terminées. Revenez dans GrowthOS pour suivre la synchronisation et les comparaisons.",
      cancelled: "Collecte arrêtée.",
      expired: "Collecte expirée.",
    }[run.status] || run.status;
  el("authorize").hidden = run.status !== "permission_required";
  el("stop").hidden =
    ["cancelled", "expired"].includes(run.status) ||
    (run.status === "finished" && run.jobs.every((j) => j.acked));
  el("jobs").replaceChildren();
  for (const j of run.jobs) {
    const card = document.createElement("article"),
      h = document.createElement("h3"),
      p = document.createElement("p");
    h.textContent = names[j.source] || j.source;
    p.textContent = j.acked
      ? "Reçu par GrowthOS : " +
        (j.receipt?.applied
          ? "enregistré"
          : j.receipt?.status === "needs_review"
            ? "à comparer"
            : "bilan disponible")
      : j.state === "ready"
        ? "Lecture terminée · en attente de synchronisation"
        : j.state === "reading"
          ? "Lecture en cours"
          : "En attente";
    if (j.outcome?.reasonCode)
      p.textContent +=
        " · " + (reasons[j.outcome.reasonCode] || "Intervention nécessaire");
    card.append(h, p);
    if (j.tabId) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "secondary";
      b.textContent = "Ouvrir cette source";
      b.onclick = () =>
        send("device-focus", { runId: run.runId, jobId: j.id }).catch(
          (e) => (el("error").textContent = e.message),
        );
      card.append(b);
    }
    el("jobs").append(card);
  }
}
el("authorize").addEventListener("click", () => {
  if (!deviceRun) return;
  // Call during the actual extension UI gesture, before any await/message.
  const request = chrome.permissions.request({
    origins: [
      ...new Set(deviceRun.jobs.flatMap((j) => origins[j.source] || [])),
    ],
  });
  el("authorize").disabled = true;
  el("error").textContent = "";
  request
    .then((granted) => {
      if (!granted)
        return send("device-denied", { runId: deviceRun.runId }).then(() => {
          throw Error("Autorisation refusée. Aucun lecteur ne sera lancé.");
        });
      return send("device-authorized", { runId: deviceRun.runId });
    })
    .then((r) => render(r.deviceRun))
    .catch((e) => (el("error").textContent = e.message))
    .finally(() => (el("authorize").disabled = false));
});
el("stop").addEventListener("click", () =>
  send("device-cancel", { runId: deviceRun.runId })
    .then((r) => render(r.deviceRun))
    .catch((e) => (el("error").textContent = e.message)),
);
const refresh = () =>
  send("device-get")
    .then((r) => render(r.deviceRun))
    .catch((e) => (el("error").textContent = e.message));
void refresh();
setInterval(refresh, 1500);
