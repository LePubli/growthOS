import { Router } from "express";
import { db } from "@workspace/db";
import { prospectsTable, dealsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";

const router = Router();

// GET /search?q=...  — global full-text search across prospects & deals
router.get("/", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) { res.json({ prospects: [], deals: [] }); return; }

    const pattern = `%${q}%`;

    const [prospects, deals] = await Promise.all([
      db.select({
        id: prospectsTable.id,
        firstName: prospectsTable.firstName,
        lastName: prospectsTable.lastName,
        email: prospectsTable.email,
        company: prospectsTable.company,
        jobTitle: prospectsTable.jobTitle,
        status: prospectsTable.status,
      })
        .from(prospectsTable)
        .where(
          and(
            eq(prospectsTable.tenantId, tenantId),
            or(
              ilike(prospectsTable.firstName, pattern),
              ilike(prospectsTable.lastName, pattern),
              ilike(prospectsTable.email, pattern),
              ilike(prospectsTable.company, pattern),
              ilike(prospectsTable.jobTitle, pattern),
            )
          )
        )
        .limit(6),
      db.select({
        id: dealsTable.id,
        title: dealsTable.title,
        company: dealsTable.company,
        stage: dealsTable.stage,
        value: dealsTable.value,
      })
        .from(dealsTable)
        .where(
          and(
            eq(dealsTable.tenantId, tenantId),
            or(
              ilike(dealsTable.title, pattern),
              ilike(dealsTable.company, pattern),
            )
          )
        )
        .limit(4),
    ]);

    res.json({ prospects, deals });
    return;
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
    return;
  }
});

export default router;
