import { pool } from "@workspace/db";
import { logger } from "../logger";

export interface IndexDocumentInput {
  sourceType: string;
  sourceId: string;
  content: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryDocument {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult extends MemoryDocument {
  score: number;
}

export interface MemoryStats {
  total: number;
  bySourceType: Record<string, number>;
}

/** Mock embedding — random 1536-dim vector. Swap for OpenAI later. */
function mockEmbedding(): number[] {
  const v: number[] = [];
  for (let i = 0; i < 1536; i++) v.push(Math.random() * 2 - 1);
  return v;
}

class MemoryService {
  /** Upsert a document + generate (mock) embedding. Returns the document id. */
  async indexDocument(data: IndexDocumentInput): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const docResult = await client.query<{ id: string }>(
        `INSERT INTO memory_documents (source_type, source_id, content, tenant_id, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (source_type, source_id, tenant_id)
         DO UPDATE SET
           content    = EXCLUDED.content,
           metadata   = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING id`,
        [
          data.sourceType,
          data.sourceId,
          data.content,
          data.tenantId,
          JSON.stringify(data.metadata ?? {}),
        ],
      );

      const documentId = docResult.rows[0].id;
      const embedding = mockEmbedding();

      await client.query(
        `INSERT INTO memory_embeddings (document_id, embedding)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (document_id)
         DO UPDATE SET embedding = EXCLUDED.embedding`,
        [documentId, JSON.stringify(embedding)],
      );

      await client.query("COMMIT");
      logger.info({ documentId, sourceType: data.sourceType }, "Memory document indexed");
      return documentId;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err, sourceType: data.sourceType }, "Failed to index memory document");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Keyword search over content (ILIKE). Vector similarity is a TODO once OpenAI is wired. */
  async search(query: string, tenantId: string, limit = 10): Promise<SearchResult[]> {
    if (!query.trim()) return this.listRecent(tenantId, limit);

    const result = await pool.query<MemoryDocument & { score: number }>(
      `SELECT
         id,
         source_type  AS "sourceType",
         source_id    AS "sourceId",
         content,
         tenant_id    AS "tenantId",
         metadata,
         created_at   AS "createdAt",
         updated_at   AS "updatedAt",
         1.0          AS score
       FROM memory_documents
       WHERE tenant_id = $1
         AND content ILIKE $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [tenantId, `%${query}%`, limit],
    );

    return result.rows;
  }

  /** Return most recently indexed documents. */
  async listRecent(tenantId: string, limit = 20): Promise<MemoryDocument[]> {
    const result = await pool.query<MemoryDocument>(
      `SELECT
         id,
         source_type  AS "sourceType",
         source_id    AS "sourceId",
         content,
         tenant_id    AS "tenantId",
         metadata,
         created_at   AS "createdAt",
         updated_at   AS "updatedAt"
       FROM memory_documents
       WHERE tenant_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows;
  }

  /** Count documents and group by source type. */
  async getStats(tenantId: string): Promise<MemoryStats> {
    const [totalRes, byTypeRes] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM memory_documents WHERE tenant_id = $1`,
        [tenantId],
      ),
      pool.query<{ source_type: string; count: string }>(
        `SELECT source_type, COUNT(*) AS count
         FROM memory_documents
         WHERE tenant_id = $1
         GROUP BY source_type
         ORDER BY count DESC`,
        [tenantId],
      ),
    ]);

    const bySourceType: Record<string, number> = {};
    for (const row of byTypeRes.rows) {
      bySourceType[row.source_type] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalRes.rows[0].count, 10),
      bySourceType,
    };
  }

  /** Delete a single document (cascade removes its embedding). */
  async deleteDocument(id: string, tenantId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM memory_documents WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const memoryService = new MemoryService();
