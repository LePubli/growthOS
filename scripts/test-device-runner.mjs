import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
const root = new URL("../extensions/growthos-pagesjaunes/", import.meta.url),
  listeners = [],
  alarms = [],
  storage = {},
  tabs = new Map();
let next = 1,
  granted = false,
  security = false,
  closed = false;
const copy = (v) => (v === undefined ? undefined : structuredClone(v));
const chrome = {
  runtime: {
    getURL: (p) => "chrome-extension://unit/" + p,
    getManifest: () => ({ version: "0.12.0" }),
    onMessage: { addListener: (f) => listeners.push(f) },
    onStartup: { addListener: () => {} },
  },
  sidePanel: { setPanelBehavior: async () => {} },
  storage: {
    local: {
      get: async (k) => ({ [k]: copy(storage[k]) }),
      set: async (v) => Object.assign(storage, copy(v)),
    },
  },
  alarms: {
    create: async () => {},
    onAlarm: { addListener: (f) => alarms.push(f) },
  },
  permissions: { contains: async () => granted },
  tabs: {
    create: async (d) => {
      const t = { ...d, id: next++, status: "complete" };
      tabs.set(t.id, t);
      return copy(t);
    },
    get: async (id) => {
      if (closed) {
        tabs.delete(id);
        throw Error("Closed");
      }
      if (!tabs.has(id)) throw Error("Unknown");
      return copy(tabs.get(id));
    },
    update: async (id, d) => {
      Object.assign(tabs.get(id), d);
      return copy(tabs.get(id));
    },
    query: async () => [],
    onActivated: { addListener: () => {} },
  },
  scripting: {
    executeScript: async (d) => {
      const tab = tabs.get(d.target.tabId);
      if (d.func?.name === "drPage")
        return [
          {
            result: {
              url: tab.url,
              security,
              consent: false,
              links: [
                {
                  url: "https://www.societe.com/societe/atelier-966777111.html",
                  label: "ATELIER",
                  text: "59100 Roubaix",
                },
              ],
              refs: [],
              empty: false,
            },
          },
        ];
      return [
        {
          result: {
            results: [
              {
                source: "societe_com",
                sourceUrl: tab.url,
                company: "ATELIER",
                siret: "96677711100019",
                address: "8 rue du Test 59100 Roubaix",
                codePostal: "59100",
                city: "Roubaix",
                companyDetails: {
                  fields: {},
                  managers: [],
                  establishments: [],
                  links: [],
                },
              },
            ],
          },
        },
      ];
    },
  },
};
let context = vm.createContext({
  chrome,
  URL,
  crypto: webcrypto,
  Date,
  console,
  setTimeout: (f) => setTimeout(f, 0),
  clearTimeout,
  AbortController,
  Promise,
  fetch: async () => {
    throw Error("No external network in queue tests");
  },
});
context.importScripts = (p) =>
  vm.runInContext(readFileSync(new URL(p, root), "utf8"), context);
vm.runInContext(readFileSync(new URL("background.js", root), "utf8"), context);
const own = { url: "chrome-extension://unit/device.html" },
  web = { url: "https://agile.le-publicitaire.fr/prospects/test" };
async function send(action, payload = {}, sender = web) {
  return new Promise((resolve, reject) => {
    let responding = false;
    for (const f of listeners) {
      const pending = f({ action, payload }, sender, (r) => {
        responding = true;
        resolve(r);
      });
      if (pending) responding = true;
    }
    if (!responding) reject(Error("No listener " + action));
  });
}
const id = (n) => "10000000-0000-4000-8000-" + String(n).padStart(12, "0");
const plan = (n) => ({
  runId: id(n),
  deviceId: id(2),
  prospect: {
    id: id(3),
    company: "ATELIER",
    city: "Roubaix",
    siret: "96677711100019",
  },
  jobs: [
    { id: id(4), source: "societe_com", query: "966777111", area: "Roubaix" },
  ],
});
const get = async () => (await send("device-get")).deviceRun;
const settle = async () => {
  for (let i = 0; i < 200; i++) {
    const r = await get();
    if (r.status === "finished") return r;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw Error("Queue did not finish");
};
assert.equal(
  (await send("device-begin", plan(1), { url: "https://evil.example/" })).ok,
  false,
);
assert.equal(
  (
    await send("device-begin", {
      ...plan(1),
      jobs: [{ ...plan(1).jobs[0], source: "unknown" }],
    })
  ).ok,
  false,
);
assert.equal((await send("device-begin", plan(1))).ok, true);
assert.equal((await get()).status, "permission_required");
assert.equal(tabs.size, 1, "No source tab before authorization");
assert.equal((await send("device-begin", plan(1))).deviceRun.runId, id(1));
assert.equal(
  tabs.size,
  1,
  "Un lancement rejoué ne réinitialise pas le lot ni ses onglets",
);
assert.equal(
  (await send("device-authorized", { runId: id(1) }, web)).ok,
  false,
  "Only extension UI can authorize",
);
assert.equal(
  (await send("device-authorized", { runId: id(1) }, own)).ok,
  false,
  "Missing host grants block execution",
);
granted = true;
assert.equal((await send("device-authorized", { runId: id(1) }, own)).ok, true);
let run = await settle();
assert.equal(run.jobs[0].state, "ready");
assert.equal(run.jobs[0].outcome.captures[0].siret, "96677711100019");
assert(!run.jobs[0].acked, "Chrome read is not a CRM receipt");
assert.equal(
  (await send("device-begin", plan(5))).ok,
  false,
  "Unacknowledged data cannot be overwritten",
);
const sourceTab = run.jobs[0].tabId;
await send("device-ack", {
  runId: id(1),
  jobId: id(4),
  receipt: { status: "completed", applied: true },
});
run = await get();
assert(
  run.jobs[0].acked && !run.jobs[0].outcome,
  "Only server acknowledgement releases capture payload",
);
security = true;
await send("device-begin", plan(5));
await send("device-authorized", { runId: id(5) }, own);
run = await settle();
assert.equal(
  run.jobs[0].tabId,
  sourceTab,
  "Resume preserves the actual source tab",
);
assert.equal(run.jobs[0].outcome.reasonCode, "SECURITY_CHALLENGE");
assert.equal(
  run.jobs[0].outcome.captures.length,
  0,
  "Challenge never produces guessed data",
);
await send("device-cancel", { runId: id(5) });
assert.equal((await get()).status, "cancelled");
// Recreate the service worker with its persisted queue state.
listeners.length = 0;
alarms.length = 0;
context = vm.createContext({
  chrome,
  URL,
  crypto: webcrypto,
  Date,
  console,
  setTimeout: (f) => setTimeout(f, 0),
  clearTimeout,
  AbortController,
  Promise,
});
context.importScripts = (p) =>
  vm.runInContext(readFileSync(new URL(p, root), "utf8"), context);
vm.runInContext(readFileSync(new URL("background.js", root), "utf8"), context);
await alarms[0]({ name: "growthos-device-queue" });
assert.equal(
  (await get()).status,
  "cancelled",
  "Worker wake cannot restart a stopped queue",
);
security = false;
closed = true;
await send("device-begin", plan(6));
await send("device-authorized", { runId: id(6) }, own);
run = await settle();
assert.equal(run.jobs[0].outcome.reasonCode, "TAB_CLOSED");
assert.equal(run.jobs[0].outcome.captures.length, 0);
const closedTab = run.jobs[0].tabId;
await send("device-cancel", { runId: id(6) });
closed = false;
granted = true;
await send("device-begin", plan(7));
await send("device-authorized", { runId: id(7) }, own);
run = await settle();
assert.equal(run.jobs[0].outcome.status, "completed");
assert.notEqual(
  run.jobs[0].tabId,
  closedTab,
  "Un nouvel essai recrée un onglet fermé sans boucle TAB_CLOSED",
);
await send("device-ack", {
  runId: id(7),
  jobId: id(4),
  receipt: { status: "completed", applied: true },
});
const tabCount = tabs.size;
await send("device-begin", plan(8));
await send("device-denied", { runId: id(8) }, own);
run = await get();
assert.equal(run.status, "finished");
assert.equal(run.jobs[0].outcome.reasonCode, "PERMISSION_REQUIRED");
assert.equal(
  tabs.size,
  tabCount + 1,
  "Un refus de permission ouvre seulement les commandes, aucune source",
);
const html = readFileSync(new URL("device.html", root), "utf8");
assert(html.includes("device-ui.js") && html.includes('role="status"'));
const ui = readFileSync(new URL("device-ui.js", root), "utf8");
assert(ui.includes("chrome.permissions.request"));
console.log(
  "✓ Exécuteur local : origine, permissions avant lecture, file persistante, onglet dédié, identité lue, accusé CRM, contrôle sécurité, arrêt/reprise et onglet fermé",
);
