/* Dedicated local read queue. No GrowthOS access token, cookie or password.
   Only bounded source adapters run; records persist until server acknowledgement. */
const DR_KEY = "growthos_device_run_v1";
let drWorking = false;
const drOrigins = {
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
const drGet = async () =>
  (await chrome.storage.local.get(DR_KEY))[DR_KEY] || null;
const drSave = async (run, replace = false) =>
  withStorageWrite(async () => {
    const previous = await drGet();
    if (previous && previous.runId !== run.runId && !replace) return;
    if (previous?.runId === run.runId) {
      for (const j of run.jobs) {
        const old = previous.jobs.find((v) => v.id === j.id);
        if (old?.acked) {
          j.acked = true;
          j.receipt = old.receipt;
          delete j.outcome;
        }
      }
      if (previous.status === "cancelled") run.status = "cancelled";
    }
    await chrome.storage.local.set({ [DR_KEY]: run });
  });
function drAllowed(source, value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (drOrigins[source] || []).some(
        (o) => new URL(o.replace("/*", "/")).hostname === u.hostname,
      )
    );
  } catch {
    return false;
  }
}
function drSearch(source, target, job) {
  const q = encodeURIComponent(job.query || target.company),
    where = encodeURIComponent(job.area || target.city || "");
  const siren = target.siret?.slice(0, 9) || target.siren;
  return {
    societe_com: "https://www.societe.com/recherche?q=" + q,
    pappers: /^\d{9}$/.test(siren || "")
      ? "https://www.pappers.fr/entreprise/" + siren
      : "https://www.pappers.fr/recherche?q=" + q,
    pagesjaunes:
      "https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=" +
      q +
      "&ou=" +
      where,
    google_maps: "https://www.google.com/maps/search/" + q + "+" + where,
    google_search: "https://www.google.com/search?q=" + q + "+" + where,
    bing: "https://www.bing.com/search?q=" + q + "+" + where,
  }[source];
}
function drPage() {
  const text = (document.body?.innerText || "").slice(0, 18000),
    shown = (n) =>
      !!n?.getClientRects().length &&
      getComputedStyle(n).visibility !== "hidden";
  const security =
    !!document.querySelector(
      '#challenge-stage,#challenge-running,iframe[src*="challenges.cloudflare.com"],iframe[src*="recaptcha"],form[action*="sorry"]',
    ) ||
    /v[eé]rifiez que vous [eê]tes humain|verify you are human|unusual traffic|trafic inhabituel|compl[eé]ter? le ["«]?challenge/i.test(
      text,
    );
  const consent =
    !!document.querySelector('form[action*="consent"]') ||
    /avant de continuer vers google|before you continue to google/i.test(text);
  const links = [...document.querySelectorAll("a[href]")]
    .filter(shown)
    .flatMap((a) => {
      try {
        const u = new URL(a.href, location.href);
        if (u.protocol !== "https:" || u.username || u.password) return [];
        const card = a.closest('article,li,.finder-card,[role="article"]') || a;
        return [
          {
            url: u.href,
            label: (a.getAttribute("aria-label") || a.innerText || "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180),
            text: (card.innerText || "").replace(/\s+/g, " ").slice(0, 1000),
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(0, 300);
  const refs = [
    ...document.querySelectorAll(
      "#b_results .b_algo h2 a,#search a:has(h3),#rso a:has(h3)",
    ),
  ]
    .filter(shown)
    .slice(0, 20)
    .map((a) => ({
      url: a.href,
      label: (a.innerText || "").trim().slice(0, 180),
    }));
  return {
    url: location.href,
    security,
    consent,
    links,
    refs,
    empty: /aucun résultat|did not match any documents|no results found/i.test(
      text,
    ),
  };
}
const drNorm = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function drPick(links, source, target) {
  const siren = target.siret?.slice(0, 9) || target.siren;
  const candidates = links.filter(
    (l) =>
      drAllowed(source, l.url) &&
      {
        societe_com: /\/societe\/[a-z0-9-]+-\d{9}\.html(?:[?#]|$)/i,
        pappers: /\/entreprise\/(?:[a-z0-9-]+-)?\d{9}(?:[/?#]|$)/i,
        pagesjaunes: /\/pros\/\d+/,
        google_maps: /\/maps\/place\//,
      }[source]?.test(l.url),
  );
  const matching = candidates.filter((l) =>
    siren && ["societe_com", "pappers"].includes(source)
      ? new URL(l.url).pathname.match(/(?:-|\/)(\d{9})(?:\.html|\/)?$/)?.[1] ===
        siren
      : drNorm(l.label) === drNorm(target.company) &&
        (!target.city || drNorm(l.text).includes(drNorm(target.city))),
  );
  const unique = [
    ...new Map(matching.map((l) => [l.url.split("#")[0], l])).values(),
  ];
  return unique.length === 1 ? unique[0] : null;
}
async function drInject(tabId, script) {
  const r = await chrome.scripting.executeScript({
    target: { tabId },
    ...(typeof script === "function" ? { func: script } : { files: [script] }),
  });
  return r?.[0]?.result;
}
async function drRead(job, target) {
  const result = async () => {
    if (job.source === "pagesjaunes") {
      const p = await drInject(job.tabId, readBusinessProfile);
      return p?.name
        ? {
            results: [
              {
                ...p,
                source: "pagesjaunes",
                company: p.name,
                collectionMode: "visible",
                pagesjaunesProfile: p,
              },
            ],
          }
        : { results: [] };
    }
    return drInject(
      job.tabId,
      job.source === "societe_com"
        ? "societe.js"
        : job.source === "pappers"
          ? "pappers.js"
          : "capture.js",
    );
  };
  let page = await drInject(job.tabId, drPage);
  if (!drAllowed(job.source, page.url))
    return {
      status: "awaiting_user",
      reasonCode: "USER_NAVIGATION",
      captures: [],
      references: [],
    };
  if (page.security || page.consent)
    return {
      status: "awaiting_user",
      reasonCode: page.security ? "SECURITY_CHALLENGE" : "CONSENT_REQUIRED",
      captures: [],
      references: [],
    };
  const detail =
    job.source === "societe_com"
      ? /\/societe\//.test(new URL(page.url).pathname)
      : job.source === "pappers"
        ? /\/entreprise\//.test(new URL(page.url).pathname)
        : job.source === "pagesjaunes"
          ? /\/pros\//.test(new URL(page.url).pathname)
          : job.source === "google_maps"
            ? /\/maps\/place\//.test(new URL(page.url).pathname)
            : true;
  if (!detail) {
    const chosen = drPick(page.links, job.source, target);
    if (!chosen)
      return {
        status: "awaiting_user",
        reasonCode: page.empty ? "NO_RESULTS" : "AMBIGUOUS",
        captures: [],
        references: page.refs,
      };
    const current = await chrome.tabs.get(job.tabId);
    if (current.url !== page.url)
      return {
        status: "awaiting_user",
        reasonCode: "USER_NAVIGATION",
        captures: [],
        references: [],
      };
    await chrome.tabs.update(job.tabId, { url: chosen.url, active: false });
    await waitTab(job.tabId, 20000);
    await wait(1000);
    page = await drInject(job.tabId, drPage);
    if (!drAllowed(job.source, page.url))
      return {
        status: "awaiting_user",
        reasonCode: "USER_NAVIGATION",
        captures: [],
        references: [],
      };
    if (page.security || page.consent)
      return {
        status: "awaiting_user",
        reasonCode: page.security ? "SECURITY_CHALLENGE" : "CONSENT_REQUIRED",
        captures: [],
        references: [],
      };
  }
  let read;
  for (let attempt = 0; attempt < 3; attempt++) {
    read = await result();
    if (read?.results?.length || read?.drafts?.length) break;
    await wait(1000);
  }
  const captures = [...(read?.results || []), ...(read?.drafts || [])]
    .filter(
      (c) => c.source === job.source && drAllowed(job.source, c.sourceUrl),
    )
    .slice(0, 25);
  return {
    status:
      captures.length || page.refs.length || page.empty
        ? "completed"
        : "awaiting_user",
    reasonCode: captures.length
      ? undefined
      : page.refs.length
        ? "WEB_REFERENCES"
        : page.empty
          ? "NO_RESULTS"
          : "UNREADABLE",
    captures: captures.map((c) => ({ ...c, capturedAt: Date.now() })),
    references: page.refs,
  };
}
async function drProcess() {
  if (drWorking || busy) return;
  drWorking = true;
  busy = true;
  try {
    for (;;) {
      let run = await drGet();
      if (!run || run.status !== "running") break;
      if (Date.now() - run.createdAt > 24 * 60 * 60 * 1000) {
        run.status = "expired";
        await drSave(run);
        break;
      }
      const job = run.jobs.find(
        (j) => j.state === "pending" || j.state === "reading",
      );
      if (!job) {
        run.status = "finished";
        await drSave(run);
        break;
      }
      let outcome;
      try {
        if (
          !(await chrome.permissions.contains({
            origins: drOrigins[job.source],
          }))
        )
          outcome = {
            status: "awaiting_user",
            reasonCode: "PERMISSION_REQUIRED",
            captures: [],
            references: [],
          };
        else {
          if (!job.tabId) {
            const tab = await chrome.tabs.create({
              url: drSearch(job.source, run.prospect, job),
              active: false,
            });
            job.tabId = tab.id;
          }
          job.state = "reading";
          await drSave(run);
          await waitTab(job.tabId, 20000);
          await wait(1000);
          // Recheck stop and generation after every potentially long browser step.
          const still = await drGet();
          if (still?.runId !== run.runId || still.status !== "running") break;
          outcome = await drRead(job, run.prospect);
        }
      } catch (error) {
        let exists = true;
        try {
          if (job.tabId) await chrome.tabs.get(job.tabId);
        } catch {
          exists = false;
        }
        outcome = {
          status: "awaiting_user",
          reasonCode: exists ? "READER_ERROR" : "TAB_CLOSED",
          captures: [],
          references: [],
        };
      }
      const current = await drGet();
      if (current?.runId !== run.runId || current.status !== "running") break;
      const entry = current.jobs.find((j) => j.id === job.id);
      Object.assign(entry, {
        tabId: job.tabId,
        state: "ready",
        outcome,
        acked: false,
      });
      await drSave(current);
    }
  } finally {
    drWorking = false;
    busy = false;
  }
}
async function drAction(action, payload = {}, sender) {
  if (action === "device-get") {
    const run = await drGet();
    if (run?.status === "running") void drProcess();
    return { ok: true, deviceRun: run };
  }
  if (action === "device-begin") {
    if (
      !UUID.test(payload.runId || "") ||
      !UUID.test(payload.deviceId || "") ||
      !UUID.test(payload.prospect?.id || "") ||
      typeof payload.prospect.company !== "string" ||
      payload.prospect.company.length > 160 ||
      !Array.isArray(payload.jobs) ||
      !payload.jobs.length ||
      payload.jobs.length > 6 ||
      payload.jobs.some(
        (j) =>
          !UUID.test(j.id || "") ||
          !drOrigins[j.source] ||
          typeof j.query !== "string" ||
          j.query.length > 160 ||
          typeof j.area !== "string" ||
          j.area.length > 120,
      )
    )
      throw Error("Plan de collecte locale invalide.");
    if (
      new Set(payload.jobs.map((j) => j.id)).size !== payload.jobs.length ||
      new Set(payload.jobs.map((j) => j.source)).size !== payload.jobs.length
    )
      throw Error("Sources ou tâches répétées dans ce lot.");
    if (busy || (await currentTask())?.mode === "enrich")
      throw Error("Terminez la capture déjà en cours dans le connecteur.");
    const old = await drGet();
    if (old?.runId === payload.runId) {
      if (
        old.deviceId !== payload.deviceId ||
        old.prospect.id !== payload.prospect.id ||
        payload.jobs.some(
          (j) => !old.jobs.some((v) => v.id === j.id && v.source === j.source),
        )
      )
        throw Error("Le plan de ce lot a changé.");
      return { ok: true, deviceRun: old };
    }
    if (
      old &&
      old.jobs.some((j) => j.state !== "pending" && !j.acked) &&
      old.status !== "cancelled"
    )
      throw Error(
        "Synchronisez ou arrêtez d’abord la collecte locale précédente.",
      );
    const run = {
      runId: payload.runId,
      deviceId: payload.deviceId,
      prospect: Object.fromEntries(
        ["id", "company", "city", "address", "phone", "siren", "siret"]
          .filter((k) => typeof payload.prospect[k] === "string")
          .map((k) => [
            k,
            payload.prospect[k].slice(0, k === "address" ? 320 : 160),
          ]),
      ),
      jobs: payload.jobs.map((j) => ({
        id: j.id,
        source: j.source,
        query: j.query,
        area: j.area,
        state: "pending",
        acked: false,
        ...(old?.prospect.id === payload.prospect.id
          ? { tabId: old.jobs.find((v) => v.source === j.source)?.tabId }
          : {}),
      })),
      status: "permission_required",
      createdAt: Date.now(),
    };
    if (old?.jobs.some((j) => j.outcome && !j.acked)) {
      const archive =
        (await chrome.storage.local.get("growthos_device_archives_v1"))
          .growthos_device_archives_v1 || [];
      await chrome.storage.local.set({
        growthos_device_archives_v1: [old, ...archive].slice(0, 3),
      });
    }
    for (const job of run.jobs)
      if (job.tabId) {
        try {
          const tab = await chrome.tabs.get(job.tabId);
          if (!drAllowed(job.source, tab.url)) delete job.tabId;
        } catch {
          delete job.tabId;
        }
      }
    await drSave(run, true);
    await chrome.tabs.create({
      url: chrome.runtime.getURL("device.html"),
      active: true,
    });
    return { ok: true, deviceRun: run };
  }
  const run = await drGet();
  if (!run || run.runId !== payload.runId)
    throw Error("Collecte locale introuvable.");
  if (action === "device-ack") {
    const job = run.jobs.find((j) => j.id === payload.jobId);
    if (!job || job.state !== "ready") throw Error("Résultat non disponible.");
    job.acked = true;
    job.receipt = payload.receipt || null;
    delete job.outcome;
    await drSave(run);
    return { ok: true, deviceRun: run };
  }
  if (action === "device-show") {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("device.html"),
      active: true,
    });
    return { ok: true, deviceRun: run };
  }
  if (action === "device-denied") {
    run.status = "finished";
    for (const j of run.jobs.filter((j) => j.state === "pending"))
      Object.assign(j, {
        state: "ready",
        outcome: {
          status: "awaiting_user",
          reasonCode: "PERMISSION_REQUIRED",
          captures: [],
          references: [],
        },
        acked: false,
      });
    await drSave(run);
    return { ok: true, deviceRun: run };
  }
  if (action === "device-cancel") {
    run.status = "cancelled";
    await drSave(run);
    return { ok: true, deviceRun: run };
  }
  if (action === "device-authorized") {
    if (run.status === "cancelled" || run.status === "expired")
      throw Error("Lancez une nouvelle collecte depuis GrowthOS.");
    if (
      !(await chrome.permissions.contains({
        origins: [...new Set(run.jobs.flatMap((j) => drOrigins[j.source]))],
      }))
    )
      throw Error("Autorisez les sources pour démarrer.");
    run.status = "running";
    await drSave(run);
    await chrome.alarms.create("growthos-device-queue", {
      periodInMinutes: 0.5,
    });
    void drProcess();
    return { ok: true, deviceRun: run };
  }
  if (action === "device-focus") {
    const job = run.jobs.find((j) => j.id === payload.jobId);
    if (!job?.tabId) throw Error("Aucun onglet source disponible.");
    await chrome.tabs.update(job.tabId, { active: true });
    return { ok: true };
  }
  if (action === "device-resume") {
    const job = run.jobs.find((j) => j.id === payload.jobId);
    if (!job || !job.acked)
      throw Error("Attendez la synchronisation du résultat dans GrowthOS.");
    // A new server plan is required: never change an already acknowledged result.
    await chrome.tabs.create({
      url:
        "https://agile.le-publicitaire.fr/prospects/" +
        run.prospect.id +
        "?view=enrichments",
      active: true,
    });
    return { ok: true };
  }
  throw Error("Action de collecte locale inconnue.");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!String(message?.action || "").startsWith("device-")) return false;
  const own = sender.url?.startsWith(chrome.runtime.getURL("")),
    origin = (() => {
      try {
        return new URL(sender.url).origin;
      } catch {
        return "";
      }
    })();
  const web = [
    "device-begin",
    "device-get",
    "device-ack",
    "device-cancel",
    "device-show",
  ].includes(message.action);
  if (!own && (origin !== "https://agile.le-publicitaire.fr" || !web)) {
    reply({ ok: false, error: "Origine non autorisée" });
    return false;
  }
  drAction(message.action, message.payload, sender)
    .then(reply)
    .catch((e) => reply({ ok: false, error: String(e.message || e) }));
  return true;
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "growthos-device-queue") void drProcess();
});
chrome.runtime.onStartup?.addListener(() => void drProcess());
