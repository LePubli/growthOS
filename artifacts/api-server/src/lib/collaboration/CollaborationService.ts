import { pool } from "@workspace/db";

export interface MentionData {
  id: string;
  tenant_id: string;
  author_id: string | null;
  mentioned_user_id: string;
  entity_type: string;
  entity_id: string | null;
  content: string;
  is_read: boolean;
  created_at: Date;
}

export interface AuditLogData {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  ip_address: string | null;
  created_at: Date;
}

export const CollaborationService = {
  /**
   * Crée une mention et notifie l'utilisateur mentionné via la table notifications.
   */
  async addMention(params: {
    tenantId: string;
    authorId: string;
    mentionedUserId: string;
    entityType: string;
    entityId?: string;
    content: string;
  }): Promise<MentionData> {
    const result = await pool.query(
      `INSERT INTO mentions (tenant_id, author_id, mentioned_user_id, entity_type, entity_id, content)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        params.tenantId,
        params.authorId,
        params.mentionedUserId,
        params.entityType,
        params.entityId ?? null,
        params.content,
      ],
    );
    const mention = result.rows[0] as MentionData;

    // Notifier l'utilisateur mentionné
    const authorRow = await pool.query(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [params.authorId],
    );
    const author = authorRow.rows[0];
    const authorName = author
      ? `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim()
      : "Quelqu'un";

    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, href, payload)
       VALUES ($1, $2, 'mention', $3, $4, $5, $6)`,
      [
        params.tenantId,
        params.mentionedUserId,
        `${authorName} vous a mentionné`,
        params.content.slice(0, 120),
        params.entityId ? `/${params.entityType}s/${params.entityId}` : null,
        JSON.stringify({ entityType: params.entityType, entityId: params.entityId }),
      ],
    );

    return mention;
  },

  /**
   * Enregistre une action dans audit_logs.
   */
  async logAudit(params: {
    tenantId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
    ipAddress?: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO audit_logs
         (tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        params.tenantId,
        params.userId ?? null,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.ipAddress ?? null,
      ],
    );
  },

  async getMentions(tenantId: string, userId: string, onlyUnread = false): Promise<MentionData[]> {
    let q = `
      SELECT m.*, u.first_name as author_first, u.last_name as author_last
      FROM mentions m
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.tenant_id = $1 AND m.mentioned_user_id = $2
    `;
    const params: unknown[] = [tenantId, userId];
    if (onlyUnread) { q += ` AND m.is_read = false`; }
    q += ` ORDER BY m.created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    return result.rows;
  },

  async markMentionRead(mentionId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE mentions SET is_read = true WHERE id = $1 AND mentioned_user_id = $2`,
      [mentionId, userId],
    );
  },
};
