import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { registerSSEClient } from "../../services/notification.service";

const router = Router();

router.get("/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`: connected\n\n`);

  const tenantId = req.auth!.tenantId;
  const unregister = registerSSEClient(tenantId, res);

  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { /* ignore */ }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregister();
  });
});

router.get("/", requireAuth, async (req, res) => {
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.tenantId, req.auth!.tenantId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const now = Date.now();
  const formatted = rows.map(n => ({
    ...n,
    at: formatRelative(n.createdAt, now),
  }));
  res.json(formatted);
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const [updated] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, req.params.id),
      eq(notificationsTable.tenantId, req.auth!.tenantId),
    ))
    .returning();
  if (!updated) { res.status(404).json({ error: "Notification introuvable" }); return; }
  res.json(updated);
});

router.post("/mark-all-read", requireAuth, async (req, res) => {
  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.tenantId, req.auth!.tenantId));
  res.json({ ok: true });
});

router.delete("/:id", requireAuth, async (req, res) => {
  await db.delete(notificationsTable).where(
    and(
      eq(notificationsTable.id, req.params.id),
      eq(notificationsTable.tenantId, req.auth!.tenantId),
    )
  );
  res.status(204).send();
});

function formatRelative(date: Date, now: number): string {
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  return `il y a ${diffD}j`;
}

export default router;
