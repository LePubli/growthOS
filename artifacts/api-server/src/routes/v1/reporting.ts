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

export default router;
