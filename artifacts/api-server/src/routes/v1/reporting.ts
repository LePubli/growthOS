import { Router } from "express";
import { db, prospectsTable, dealsTable, signalsTable, activitiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function toCSV(rows: Record<string, any>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map(row =>
    columns.map(col => {
      const v = row[col] ?? "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    }).join(",")
  ).join("\n");
  return `${header}\n${body}`;
}

router.get("/csv/:entity", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { entity } = req.params;

  let csv = "";
  let filename = "export.csv";

  if (entity === "prospects") {
    const rows = await db.select().from(prospectsTable)
      .where(eq(prospectsTable.tenantId, tenantId))
      .orderBy(desc(prospectsTable.createdAt))
      .limit(10000);
    const cols = ["id","firstName","lastName","email","phone","company","jobTitle","website","status","score","address","createdAt"];
    csv = toCSV(rows.map(r => ({ ...r, score: r.score ?? 0, address: r.address ?? "" })), cols);
    filename = "prospects.csv";

  } else if (entity === "deals") {
    const rows = await db.select().from(dealsTable)
      .where(eq(dealsTable.tenantId, tenantId))
      .orderBy(desc(dealsTable.createdAt))
      .limit(10000);
    const cols = ["id","title","company","value","stage","probability","closeDate","prospect","createdAt"];
    csv = toCSV(rows.map(r => ({ ...r, closeDate: r.closeDate ?? "", prospect: r.prospect ?? "" })), cols);
    filename = "deals.csv";

  } else if (entity === "signals") {
    const rows = await db.select().from(signalsTable)
      .where(eq(signalsTable.tenantId, tenantId))
      .orderBy(desc(signalsTable.createdAt))
      .limit(10000);
    const cols = ["id","type","company","title","description","score","isRead","isStarred","createdAt"];
    csv = toCSV(rows.map(r => ({ ...r, description: r.description ?? "", score: r.score ?? 0 })), cols);
    filename = "signals.csv";

  } else if (entity === "activities") {
    const rows = await db.select().from(activitiesTable)
      .where(eq(activitiesTable.tenantId, tenantId))
      .orderBy(desc(activitiesTable.createdAt))
      .limit(10000);
    const cols = ["id","type","title","description","status","prospectId","dealId","scheduledAt","doneAt","createdAt"];
    csv = toCSV(rows.map(r => ({
      ...r,
      description: r.description ?? "",
      prospectId: r.prospectId ?? "",
      dealId: r.dealId ?? "",
      scheduledAt: r.scheduledAt ?? "",
      doneAt: r.doneAt ?? "",
    })), cols);
    filename = "activities.csv";

  } else {
    res.status(400).json({ error: "Entité non supportée. Valeurs valides : prospects, deals, signals, activities" });
    return;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

router.get("/pdf/:reportType", async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { reportType } = req.params;
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  let title = "Rapport GrowthOS";
  let tableHtml = "";

  if (reportType === "pipeline") {
    title = "Rapport Pipeline Commercial";
    const rows = await db.select().from(dealsTable).where(eq(dealsTable.tenantId, tenantId)).orderBy(desc(dealsTable.createdAt)).limit(200);
    const total = rows.reduce((s, r) => s + Number(r.value ?? 0), 0);
    const wonDeals = rows.filter(r => r.stage === "won");
    const wonValue = wonDeals.reduce((s, r) => s + Number(r.value ?? 0), 0);
    tableHtml = `
      <div class="stats">
        <div class="stat"><div class="stat-value">${rows.length}</div><div class="stat-label">Deals total</div></div>
        <div class="stat"><div class="stat-value">${(total/1000).toFixed(0)}k€</div><div class="stat-label">Pipeline total</div></div>
        <div class="stat"><div class="stat-value">${wonDeals.length}</div><div class="stat-label">Deals gagnés</div></div>
        <div class="stat"><div class="stat-value">${(wonValue/1000).toFixed(0)}k€</div><div class="stat-label">CA généré</div></div>
      </div>
      <table>
        <thead><tr><th>Deal</th><th>Entreprise</th><th>Valeur</th><th>Étape</th><th>Probabilité</th><th>Clôture</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.title}</td><td>${r.company ?? ""}</td><td class="num">${Number(r.value ?? 0).toLocaleString("fr-FR")}€</td><td><span class="badge badge-${r.stage}">${r.stage}</span></td><td class="num">${r.probability ?? 0}%</td><td>${r.closeDate ?? ""}</td></tr>`).join("")}</tbody>
      </table>`;
  } else if (reportType === "prospects") {
    title = "Rapport Prospection";
    const rows = await db.select().from(prospectsTable).where(eq(prospectsTable.tenantId, tenantId)).orderBy(desc(prospectsTable.createdAt)).limit(200);
    const byStatus = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    tableHtml = `
      <div class="stats">
        <div class="stat"><div class="stat-value">${rows.length}</div><div class="stat-label">Prospects total</div></div>
        ${Object.entries(byStatus).map(([s, c]) => `<div class="stat"><div class="stat-value">${c}</div><div class="stat-label">${s}</div></div>`).join("")}
      </div>
      <table>
        <thead><tr><th>Nom</th><th>Email</th><th>Entreprise</th><th>Statut</th><th>Score</th><th>Créé le</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.firstName ?? ""} ${r.lastName ?? ""}</td><td>${r.email ?? ""}</td><td>${r.company ?? ""}</td><td><span class="badge badge-${r.status}">${r.status}</span></td><td class="num">${r.score ?? 0}</td><td>${new Date(r.createdAt).toLocaleDateString("fr-FR")}</td></tr>`).join("")}</tbody>
      </table>`;
  } else if (reportType === "activity") {
    title = "Rapport Activités";
    const rows = await db.select().from(activitiesTable).where(eq(activitiesTable.tenantId, tenantId)).orderBy(desc(activitiesTable.createdAt)).limit(200);
    const byType = rows.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {} as Record<string, number>);
    tableHtml = `
      <div class="stats">
        <div class="stat"><div class="stat-value">${rows.length}</div><div class="stat-label">Activités total</div></div>
        ${Object.entries(byType).map(([t, c]) => `<div class="stat"><div class="stat-value">${c}</div><div class="stat-label">${t}</div></div>`).join("")}
      </div>
      <table>
        <thead><tr><th>Type</th><th>Titre</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.type}</td><td>${r.title ?? ""}</td><td>${r.status ?? ""}</td><td>${new Date(r.createdAt).toLocaleDateString("fr-FR")}</td></tr>`).join("")}</tbody>
      </table>`;
  } else {
    res.status(400).json({ error: "reportType doit être pipeline, prospects ou activity" });
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, Arial, sans-serif; }
  body { color: #111; font-size: 12px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #0F766E; margin-bottom: 24px; }
  .logo { font-size: 22px; font-weight: 900; color: #0F766E; }
  .logo span { color: #111; }
  .meta { text-align: right; font-size: 11px; color: #666; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #F0FDF4; border-left: 4px solid #0F766E; padding: 12px 16px; border-radius: 4px; }
  .stat-value { font-size: 22px; font-weight: 800; color: #0F766E; }
  .stat-label { font-size: 11px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #F8FAFC; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 8px 12px; text-align: left; border-bottom: 2px solid #E2E8F0; color: #64748B; }
  td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  tr:hover td { background: #F8FAFC; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge-won, .badge-qualified { background: #D1FAE5; color: #065F46; }
  .badge-lead, .badge-new { background: #F3F4F6; color: #374151; }
  .badge-proposal { background: #EDE9FE; color: #5B21B6; }
  .badge-negotiation { background: #FEF3C7; color: #92400E; }
  .badge-lost { background: #FEE2E2; color: #991B1B; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; display: flex; justify-content: space-between; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div><div class="logo">Growth<span>OS</span></div><div style="font-size:11px;color:#666;margin-top:4px;">Plateforme Sales Intelligence</div></div>
  <div class="meta"><div style="font-size:16px;font-weight:700;color:#111">${title}</div><div>Généré le ${now}</div></div>
</div>
${tableHtml}
<div class="footer"><span>GrowthOS — Confidentiel</span><span>${now}</span></div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
