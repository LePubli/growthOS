import crypto from "crypto";
import { pool } from "@workspace/db";
import { logger } from "../logger";

export interface WebhookPayload {
  event: string;
  tenant_id: string;
  timestamp: string;
  data: unknown;
}

export const WebhookService = {
  /**
   * Déclenche les webhooks pour un tenant et un type d'événement.
   * Signe le payload avec HMAC-SHA256 et log la livraison.
   */
  async triggerEvent(
    tenantId: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    // Récupérer les webhooks actifs du tenant qui écoutent cet event
    const result = await pool.query(
      `SELECT id, url, secret, events FROM webhooks
       WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId],
    );
    if (result.rows.length === 0) return;

    const payload: WebhookPayload = {
      event: eventType,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      result.rows
        .filter((wh) => {
          const events: string[] = Array.isArray(wh.events)
            ? wh.events
            : JSON.parse(wh.events ?? "[]");
          return events.includes(eventType) || events.includes("*");
        })
        .map((wh) => WebhookService._deliver(wh.id, wh.url, wh.secret, body, eventType)),
    );
  },

  async _deliver(
    webhookId: string,
    url: string,
    secret: string | null,
    body: string,
    eventType: string,
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GrowthOS-Webhook/1.0",
      "X-GrowthOS-Event": eventType,
      "X-GrowthOS-Timestamp": Date.now().toString(),
    };

    if (secret) {
      const sig = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");
      headers["X-GrowthOS-Signature"] = `sha256=${sig}`;
    }

    let status = "failed";
    let responseCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      responseCode = res.status;
      responseBody = (await res.text()).slice(0, 500);
      status = res.ok ? "delivered" : "failed";
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Erreur réseau";
      logger.warn({ webhookId, url, errorMessage }, "Webhook delivery failed");
    }

    // Log la livraison
    try {
      await pool.query(
        `INSERT INTO webhook_logs (webhook_id, event_type, status, response_code, payload, response_body, error_message)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [webhookId, eventType, status, responseCode, body, responseBody, errorMessage],
      );

      // Mettre à jour le compteur + timestamp sur le webhook
      await pool.query(
        `UPDATE webhooks
         SET deliveries = deliveries + 1, last_triggered_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [webhookId],
      );
    } catch (logErr) {
      logger.error({ logErr }, "Échec enregistrement webhook log");
    }
  },

  async getLogs(
    tenantId: string,
    webhookId?: string,
    limit = 50,
  ): Promise<unknown[]> {
    let q = `
      SELECT wl.*, w.name as webhook_name, w.url
      FROM webhook_logs wl
      JOIN webhooks w ON w.id = wl.webhook_id
      WHERE w.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    if (webhookId) {
      q += ` AND wl.webhook_id = $2`;
      params.push(webhookId);
    }
    q += ` ORDER BY wl.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await pool.query(q, params);
    return result.rows;
  },

  /**
   * Vérifie la signature HMAC d'un webhook entrant.
   */
  verifySignature(secret: string, body: string, signature: string): boolean {
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  },
};
