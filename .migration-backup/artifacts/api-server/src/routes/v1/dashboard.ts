import { Router } from "express";
import { db } from "@workspace/db";
import { prospectsTable, dealsTable, sequencesTable, signalsTable } from "@workspace/db";
import { eq, and, ne, count, sum, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  const tenantId = req.auth!.tenantId;

  const [
    [{ totalProspects }],
    [{ pipelineValue }],
    [{ wonValue }],
    [{ activeSequences }],
    [{ unreadSignals }],
    recentProspects,
    stageRows,
  ] = await Promise.all([
    db.select({ totalProspects: count() }).from(prospectsTable).where(eq(prospectsTable.tenantId, tenantId)),
    db.select({ pipelineValue: sum(dealsTable.value) }).from(dealsTable).where(
      and(eq(dealsTable.tenantId, tenantId), ne(dealsTable.stage, "lost"), ne(dealsTable.stage, "won"))
    ),
    db.select({ wonValue: sum(dealsTable.value) }).from(dealsTable).where(
      and(eq(dealsTable.tenantId, tenantId), eq(dealsTable.stage, "won"))
    ),
    db.select({ activeSequences: count() }).from(sequencesTable).where(
      and(eq(sequencesTable.tenantId, tenantId), eq(sequencesTable.status, "active"))
    ),
    db.select({ unreadSignals: count() }).from(signalsTable).where(
      and(eq(signalsTable.tenantId, tenantId), eq(signalsTable.isRead, false))
    ),
    db.select().from(prospectsTable).where(eq(prospectsTable.tenantId, tenantId))
      .orderBy(desc(prospectsTable.createdAt)).limit(5),
    db.select({
      stage: dealsTable.stage,
      total: count(),
      value: sum(dealsTable.value),
    }).from(dealsTable).where(eq(dealsTable.tenantId, tenantId))
      .groupBy(dealsTable.stage),
  ]);

  const pipelineStages = stageRows.map(r => ({
    stage: r.stage,
    count: Number(r.total),
    value: Number(r.value) || 0,
  }));

  res.json({
    overview: {
      total_prospects: Number(totalProspects),
      pipeline_value: Number(pipelineValue) || 0,
      won_value: Number(wonValue) || 0,
      active_sequences: Number(activeSequences),
      unread_signals: Number(unreadSignals),
    },
    recent_prospects: recentProspects,
    pipeline_stages: pipelineStages,
  });
});

export default router;
