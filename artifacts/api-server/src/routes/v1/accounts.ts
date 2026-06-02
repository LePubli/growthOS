import { Router } from "express";
import { db } from "@workspace/db";
import { prospectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { accountService } from "../../lib/plugin-account-intelligence/AccountService";

const router = Router();

// GET /accounts — aggregate prospects by company
router.get("/", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const prospects = await db
      .select()
      .from(prospectsTable)
      .where(eq(prospectsTable.tenantId, tenantId));

    // Group by company field
    const grouped = new Map<string, any>();
    for (const p of prospects) {
      const key = p.company || "Inconnu";
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: key,
          domain: p.email ? p.email.split("@")[1] || "" : "",
          industry: "",
          size: "",
          city: "",
          contactCount: 0,
          dealValue: 0,
          dealCount: 0,
          status: "prospect",
          lastActivity: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("fr-FR") : "—",
          score: 0,
          contacts: [],
        });
      }
      const acc = grouped.get(key);
      acc.contactCount++;
      acc.score = Math.max(acc.score, p.score || 0);
      if (p.status === "won") { acc.status = "customer"; acc.dealCount++; }
      else if (p.status === "qualified" || p.status === "proposal" || p.status === "negotiation") acc.status = "active";
      acc.contacts.push({
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || key,
        email: p.email || "",
        phone: p.phone || "",
        role: p.jobTitle || "",
      });
    }

    res.json([...grouped.values()]);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});


// GET /accounts/:id/360 — full 360° view of an account
router.get("/:id/360", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const accountId = decodeURIComponent(req.params.id);
    const data = await accountService.getAccount360(accountId, tenantId);
    if (!data) { res.status(404).json({ error: "Account not found" }); return; }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /accounts/:id/score — health score + breakdown
router.get("/:id/score", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const accountId = decodeURIComponent(req.params.id);
    const breakdown = await accountService.calculateHealthScore(accountId, tenantId);
    res.json({ accountId, healthScore: breakdown.total, breakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/:id/refresh — trigger score recalculation
router.post("/:id/refresh", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const accountId = decodeURIComponent(req.params.id);
    const metrics = await accountService.upsertMetrics(accountId, tenantId);
    res.json({ success: true, metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
