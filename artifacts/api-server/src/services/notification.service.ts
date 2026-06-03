import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import type { Response } from "express";

export type NotifType = "signal" | "deal" | "email" | "team" | "system";

export interface CreateNotifInput {
  type: NotifType;
  title: string;
  body: string;
  href?: string;
  payload?: Record<string, unknown>;
  tenantId: string;
  userId?: string;
}

const sseClients = new Map<string, Set<Response>>();

function getTenantClients(tenantId: string): Set<Response> {
  if (!sseClients.has(tenantId)) sseClients.set(tenantId, new Set());
  return sseClients.get(tenantId)!;
}

export function registerSSEClient(tenantId: string, res: Response): () => void {
  const clients = getTenantClients(tenantId);
  clients.add(res);
  return () => clients.delete(res);
}

function pushSSE(tenantId: string, data: Record<string, unknown>): void {
  const clients = getTenantClients(tenantId);
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

export async function createNotification(input: CreateNotifInput): Promise<void> {
  try {
    const [notif] = await db.insert(notificationsTable).values({
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      payload: input.payload ?? {},
      tenantId: input.tenantId,
      userId: input.userId ?? null,
    }).returning();

    pushSSE(input.tenantId, {
      event: "notification",
      notification: {
        ...notif,
        at: "à l'instant",
      },
    });
  } catch (err) {
    console.error("[notifications] failed to create notification:", err);
  }
}
