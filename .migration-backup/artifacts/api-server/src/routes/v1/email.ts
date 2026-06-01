import { Router } from "express";
import { db } from "@workspace/db";
import { sequencesTable, prospectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendEmail, buildProspectingEmail } from "../../services/email";

const router = Router();

// POST /email/send — send a one-off email to a prospect
router.post("/send", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { to, subject, html, prospectId } = req.body;
    if (!to || !subject) { res.status(400).json({ error: "Missing to or subject" }); return; }

    const result = await sendEmail({ to, subject, html: html || `<p>${subject}</p>` });
    res.json(result);
    return;
  } catch (err) {
    res.status(500).json({ error: "Send failed" });
    return;
  }
});

// POST /email/sequences/:id/launch — launch a sequence for a prospect
router.post("/sequences/:id/launch", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    if (!tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { prospectId, senderName } = req.body;
    if (!prospectId) { res.status(400).json({ error: "Missing prospectId" }); return; }

    const [prospect] = await db.select().from(prospectsTable)
      .where(and(eq(prospectsTable.id, prospectId), eq(prospectsTable.tenantId, tenantId)));

    if (!prospect || !prospect.email) {
      res.status(404).json({ error: "Prospect not found or has no email" });
      return;
    }

    const [sequence] = await db.select().from(sequencesTable)
      .where(and(eq(sequencesTable.id, req.params.id), eq(sequencesTable.tenantId, tenantId)));

    if (!sequence) { res.status(404).json({ error: "Sequence not found" }); return; }

    // Send first step immediately
    const html = buildProspectingEmail({
      firstName: prospect.firstName || "là",
      company: prospect.company || "",
      senderName: senderName || "L'équipe GrowthOS",
      bodyHtml: `<p>Je me permets de vous contacter concernant ${sequence.name}.</p>`,
    });

    const result = await sendEmail({
      to: prospect.email,
      subject: `${sequence.name} — étape 1`,
      html,
      tags: [{ name: "sequence", value: sequence.id }, { name: "prospect", value: prospect.id }],
    });

    res.json({ ...result, message: result.success ? "Séquence lancée avec succès" : "Email non envoyé (configurez Resend)" });
    return;
  } catch (err) {
    res.status(500).json({ error: "Launch failed" });
    return;
  }
});

export default router;
